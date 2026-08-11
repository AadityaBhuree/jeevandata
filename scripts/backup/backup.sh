#!/usr/bin/env bash
# =============================================================================
# backup.sh — Jeevandata full-stack backup to S3/R2 (MinIO-compatible).
#
# Backs up:
#   1. PostgreSQL — logical dump (pg_dump -Fc) + WAL archive copy (PITR)
#      Optionally (PG_BASEBACKUP=true) a physical base backup that, together
#      with the continuous WAL archive, enables true point-in-time recovery.
#   2. Redis      — RDB snapshot streamed over the wire (redis-cli --rdb)
#   3. Qdrant     — per-collection snapshot via the REST API
#
# Uploads everything to an S3-compatible endpoint (MinIO locally, Cloudflare
# R2 in production) under  <bucket>/<STAMP>/...  and prunes anything older
# than RETENTION_DAYS.
#
# Env (all optional — defaults match docker-compose):
#   S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET
#   PG_HOST PG_PORT PG_USER PG_PASSWORD PG_DB PG_BASEBACKUP PG_WAL_DIR
#   REDIS_HOST REDIS_PORT REDIS_PASSWORD
#   QDRANT_URL QDRANT_COLLECTIONS
#   STAGE_DIR RETENTION_DAYS
#
# Exit code: 0 = all components backed up, 1 = at least one failed.
# =============================================================================
set -euo pipefail

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STAGE_DIR="${STAGE_DIR:-/staging}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

S3_ENDPOINT="${S3_ENDPOINT:-http://minio:9000}"
S3_ACCESS_KEY="${S3_ACCESS_KEY:-minioadmin}"
S3_SECRET_KEY="${S3_SECRET_KEY:-minioadmin}"
S3_BUCKET="${S3_BUCKET:-jeevandata-backups}"

PG_HOST="${PG_HOST:-postgres}"; PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-jeevandata}"; PG_PASSWORD="${PG_PASSWORD:-jeevandata_secret}"; PG_DB="${PG_DB:-jeevandata}"
PG_BASEBACKUP="${PG_BASEBACKUP:-false}"

REDIS_HOST="${REDIS_HOST:-redis}"; REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-redis_secret}"

QDRANT_URL="${QDRANT_URL:-http://qdrant:6333}"
QDRANT_COLLECTIONS="${QDRANT_COLLECTIONS:-face_embeddings}"

PG_WAL_DIR="${PG_WAL_DIR:-/pgdata/wal_archive}"

MC_ALIAS="jeevandata-backup"
WORK="$STAGE_DIR/$STAMP"
mkdir -p "$WORK"
FAILURES=0

log()  { echo "[backup:$STAMP] $*"; }
fail() { log "ERROR: $*"; FAILURES=$((FAILURES + 1)); }

# ─── 1. PostgreSQL ────────────────────────────────────────────────────────────
log "PostgreSQL: dumping $PG_DB (custom format)..."
if PGPASSWORD="$PG_PASSWORD" pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -Fc -f "$WORK/postgres.dump"; then
  log "PostgreSQL dump OK ($(du -h "$WORK/postgres.dump" | cut -f1))"
else
  fail "pg_dump failed (is postgres healthy and reachable?)"
fi

if [ "$PG_BASEBACKUP" = "true" ]; then
  log "PostgreSQL: physical base backup (PITR base)..."
  if PGPASSWORD="$PG_PASSWORD" pg_basebackup -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -D "$WORK/pg_base" -Fp -Xs; then
    log "PostgreSQL base backup OK ($(du -sh "$WORK/pg_base" | cut -f1))"
  else
    fail "pg_basebackup failed"
  fi
fi

# ─── 2. Redis ─────────────────────────────────────────────────────────────────
log "Redis: streaming RDB snapshot..."
if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning --rdb "$WORK/redis.rdb" >/dev/null; then
  log "Redis RDB OK ($(du -h "$WORK/redis.rdb" | cut -f1))"
else
  fail "redis-cli --rdb failed"
fi

# ─── 3. Qdrant ────────────────────────────────────────────────────────────────
for col in $QDRANT_COLLECTIONS; do
  log "Qdrant: snapshoting collection '$col'..."
  # POST /collections/{c}/snapshots is async (202): creation is queued and the
  # snapshot becomes downloadable shortly after. Poll up to ~60s for it.
  snap_name=""
  for _ in $(seq 1 12); do
    snap_json="$(curl -fsS -X POST "$QDRANT_URL/collections/$col/snapshots" 2>/dev/null || true)"
    snap_name="$(printf '%s' "$snap_json" | sed -n 's/.*"result":{[^}]*"name":"\([^"]*\)".*/\1/p')"
    [ -n "$snap_name" ] && break
    sleep 5
  done
  if [ -z "$snap_name" ]; then
    fail "Qdrant snapshot request failed for '$col' (response: $snap_json)"
    continue
  fi
  ok=0
  for _ in $(seq 1 6); do
    if curl -fsS "$QDRANT_URL/collections/$col/snapshots/$snap_name" -o "$WORK/qdrant-$col.snapshot" 2>/dev/null; then
      ok=1
      break
    fi
    sleep 5
  done
  if [ "$ok" = "1" ]; then
    log "Qdrant snapshot '$snap_name' OK ($(du -h "$WORK/qdrant-$col.snapshot" | cut -f1))"
    # Delete the snapshot from the server so snapshots do not pile up in the
    # qdrant container between backup runs.
    curl -fsS -X DELETE "$QDRANT_URL/collections/$col/snapshots/$snap_name" >/dev/null 2>&1 \
      || log "note: could not delete server snapshot '$snap_name'"
  else
    fail "Qdrant snapshot download failed for '$col'"
  fi
done

# ─── 4. WAL archive copy (PITR) ───────────────────────────────────────────────
if [ -d "$PG_WAL_DIR" ] && [ -n "$(ls -A "$PG_WAL_DIR" 2>/dev/null)" ]; then
  mkdir -p "$WORK/wal"
  log "PostgreSQL: copying new WAL segments to staging..."
  # -n: never overwrite an already-staged segment (WAL files are immutable);
  # postgres archives each segment once, so first copy wins.
  if cp -n "$PG_WAL_DIR"/* "$WORK/wal/" 2>/dev/null; then
    log "WAL copy OK ($(find "$WORK/wal" -type f | wc -l) segments)"
  else
    fail "WAL copy failed"
  fi
  # Local retention: prune archived segments older than RETENTION_DAYS so the
  # data volume does not grow without bound (archive_timeout=300 produces one
  # segment every 5 min). Remote pruning happens on S3 after upload.
  pruned=$(find "$PG_WAL_DIR" -type f -mtime "+$RETENTION_DAYS" -delete -print 2>/dev/null | wc -l)
  [ "$pruned" -gt 0 ] && log "Pruned $pruned local WAL segment(s) older than ${RETENTION_DAYS}d"
else
  log "WAL archive empty — skipping"
fi

# ─── 5. Upload to S3/R2 ───────────────────────────────────────────────────────
log "Uploading to $S3_ENDPOINT/$S3_BUCKET ..."
if mc alias set "$MC_ALIAS" "$S3_ENDPOINT" "$S3_ACCESS_KEY" "$S3_SECRET_KEY" >/dev/null 2>&1 && mc mb "$MC_ALIAS/$S3_BUCKET" --ignore-existing >/dev/null 2>&1 && mc mirror "$WORK" "$MC_ALIAS/$S3_BUCKET/$STAMP/"; then
  log "Upload OK"
else
  fail "S3 upload failed (is minio healthy and reachable?)"
fi

# ─── 6. Retention ─────────────────────────────────────────────────────────────
log "Pruning backups older than ${RETENTION_DAYS}d..."
if mc rm --recursive --force --older-than "${RETENTION_DAYS}d" "$MC_ALIAS/$S3_BUCKET/" >/dev/null 2>&1; then
  log "Retention prune OK"
else
  log "Retention prune skipped (nothing to prune yet)"
fi

# ─── 7. Cleanup ───────────────────────────────────────────────────────────────
rm -rf "$STAGE_DIR/$STAMP"

if [ "$FAILURES" -gt 0 ]; then
  log "Backup FINISHED WITH $FAILURES FAILURE(S)"
  exit 1
fi
log "Backup completed successfully"
