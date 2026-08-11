# Disaster Recovery & Backup Restore — Jeevandata

> **Scope:** Every backup artifact produced by Phase 7.4 and the exact procedure
> to restore it. For the _backup_ side (what runs, when, where) see the backup
> service in `docker-compose.yml` and `scripts/backup/backup.sh`.

---

## 1. Backup inventory

| Component  | Artifact(s) per run          | Schedule (cron)               | Remote location                      | Retention |
| :--------- | :--------------------------- | :---------------------------- | :----------------------------------- | :-------- |
| PostgreSQL | `postgres.dump` (custom fmt) | daily `0 2 * * *`             | `<bucket>/<STAMP>/postgres.dump`     | 14 days   |
| PostgreSQL | `pg_base/` (physical base)   | weekly `0 3 * * 0`            | `<bucket>/<STAMP>/pg_base/`          | 14 days   |
| PostgreSQL | `wal/*.gz` (WAL archive)     | continuous (every backup run) | `<bucket>/<STAMP>/wal/`              | 14 days   |
| Redis      | `redis.rdb`                  | daily `0 2 * * *`             | `<bucket>/<STAMP>/redis.rdb`         | 14 days   |
| Qdrant     | `qdrant-<col>.snapshot`      | daily `0 2 * * *`             | `<bucket>/<STAMP>/qdrant-*.snapshot` | 14 days   |

- **Bucket:** `jeevandata-backups` on the S3/R2 endpoint (MinIO `http://minio:9000` locally, Cloudflare R2 in production).
- **Retention:** objects older than `BACKUP_RETENTION_DAYS` (default 14) are pruned automatically by `mc rm --older-than`.

---

## 2. Restore goals & RTO/RPO

| Recovery goal            | Procedure                            | RTO  | RPO    |
| :----------------------- | :----------------------------------- | :--- | :----- |
| Point-in-time (any time) | §4.2 PITR (weekly base + WAL replay) | ~30m | ≤5 min |
| Last known good (today)  | §4.1 logical dump restore            | ~15m | ≤24h   |
| Redis only               | §5 RDB restore                       | ~5m  | ≤24h   |
| Qdrant only              | §6 snapshot restore                  | ~5m  | ≤24h   |

---

## 3. Before you start

1. **Stop writes:** if restoring a _primary_ database, stop the backend and the
   affected services so no new data is written mid-restore.
2. **Download the artifact set** you need from S3/R2, e.g. with `mc`:

   ```bash
   mc alias set s3 http://minio:9000 minioadmin minioadmin
   mc ls s3/jeevandata-backups/          # list backup runs
   mc cp --recursive s3/jeevandata-backups/20260728T020000Z/ ./restore/
   ```

3. **Pick the newest STAMP** that contains all the artifacts you need (a weekly
   base run contains `pg_base/` + `wal/`; a daily run contains the logical dump).

---

## 4. Restore PostgreSQL

### 4.1 Logical dump (simplest — restores up to dump time)

```bash
# Fresh container with a matching Postgres version (16)
docker run -d --name jeevandata-postgres-restore   -e POSTGRES_USER=jeevandata -e POSTGRES_PASSWORD=jeevandata_secret   -e POSTGRES_DB=jeevandata -v jeevandata_restore_data:/var/lib/postgresql/data   pgvector/pgvector:pg16

# Wait for healthy, then restore (custom format -> schema + data)
cat restore/postgres.dump | docker exec -i jeevandata-postgres-restore   pg_restore -U jeevandata -d jeevandata --no-owner --no-privileges -v
```

> The dump is **logical** — it is a point-in-time snapshot of when it ran. For a
> recovery closer to the incident use §4.2.

### 4.2 Point-in-time recovery (base + WAL replay)

Requires a weekly `pg_base/` run **plus** the `wal/` segments from that run and
**all subsequent runs** up to your target time.

```bash
# 1. Restore the physical base into the data dir
rm -rf /tmp/restore-data && mkdir -p /tmp/restore-data
cp -a restore/pg_base/. /tmp/restore-data/

# 2. Point Postgres at the WAL archive (local dir of downloaded wal/ segments)
cat >> /tmp/restore-data/postgresql.auto.conf <<EOF
restore_command = 'cp /tmp/wal/%f %p'
recovery_target_time = '2026-07-28 10:30:00+00'
EOF

# 3. Create the recovery signal file (PG12+)
touch /tmp/restore-data/recovery.signal

# 4. Boot with the restored data dir, WAL replay runs automatically
docker run -d --name jeevandata-postgres-pitr   -e POSTGRES_USER=jeevandata -e POSTGRES_PASSWORD=jeevandata_secret   -e POSTGRES_DB=jeevandata   -v /tmp/restore-data:/var/lib/postgresql/data   pgvector/pgvector:pg16
```

- **PITR granularity:** `archive_timeout=300` forces a WAL switch every 5 min,
  so the newest recoverable point lags real time by at most ~5 minutes.
- **Timeline safety:** because `pg_basebackup` uses `-Xs` (stream WAL), the base
  is consistent. After recovery the server runs in a new timeline; promote by
  removing `recovery.signal` when the new primary is promoted (or the image
  auto-promotes on a clean shutdown with `recovery_target_action=promote`).

---

## 5. Restore Redis

The `redis.rdb` artifact is a full RDB snapshot (captured live via
`redis-cli --rdb`). Redis also runs with `--appendonly yes`, but the _backup_
artifact is the RDB — restore that into a fresh `redis-data` volume:

```bash
# 1. Stop the redis container and remove its data volume
docker compose stop redis
docker compose rm -f redis
docker volume rm jeevandata_redis-data   # name may be <project>_redis-data

# 2. Recreate the volume and drop the RDB in place
#    (start once with a helper to populate, then replace dump.rdb)
docker run --rm -v jeevandata_redis-data:/data alpine sh -c   "cp /dev/null /data/dump.rdb"   # ensure dir exists + is writable
cp restore/redis.rdb /var/lib/docker/volumes/jeevandata_redis-data/_data/dump.rdb
#    (or, on Linux hosts: docker cp restore/redis.rdb <tmp-container>:/data/dump.rdb)

# 3. Start redis again — it loads dump.rdb on boot. If AOF exists it is
#    preferred over RDB; delete any appendonly.aof first to force RDB load.
docker compose up -d redis
```

> **Why RDB over AOF?** The AOF is continuous and could replay the corruption
> that caused the incident. Restoring the last known-good RDB gives a clean
> point-in-time snapshot.

---

## 6. Restore Qdrant (vector snapshots)

The `qdrant-<col>.snapshot` files are Qdrant collection snapshots. Restore via
its HTTP API (the snapshot must be reachable by the Qdrant container — either
mounted into it or streamed as a multipart upload):

```bash
# Option A — multipart upload (Qdrant copies it into its snapshots dir)
curl -X PUT http://localhost:6333/collections/face_embeddings/snapshots/restore   -F "snapshot=@restore/qdrant-face_embeddings.snapshot"

# Option B — local path (place the file where Qdrant can read it, then)
# cp restore/qdrant-face_embeddings.snapshot <qdrant-storage>/snapshots/
# curl -X PUT http://localhost:6333/collections/face_embeddings/snapshots/restore #   -H 'Content-Type: application/json' #   -d '{"location": "/qdrant/snapshots/qdrant-face_embeddings.snapshot"}'

# Verify
curl -s http://localhost:6333/collections/face_embeddings | head -c 400
```

> Restoring a snapshot **replaces** the collection contents. The collection
> must exist (create an empty one first if the API rejects a missing target).
> Run this for every collection in `QDRANT_COLLECTIONS`.

---

## 7. Restore object storage (MinIO / R2)

Media (faces, audio, files) lives in `minio-data` (volume) locally, or Cloudflare
R2 buckets (`jeevandata-media`, etc.) in production. The daily backup does **not**
replicate the media buckets — it uploads _backups into_ the same MinIO. For a
local stack disaster:

```bash
# MinIO data volume itself is the source of truth locally
docker compose stop minio
docker volume rm jeevandata_minio-data
# restore from the last snapshot/backup of minio-data, then:
docker compose up -d minio
```

In production, R2 is the source of truth (no restore needed — re-apply media
from the bucket). Backups written into R2 under `jeevandata-backups/` must not
be confused with the media buckets.

---

## 8. Full-stack restore (runbook)

1. `docker compose down` the whole stack.
2. Remove the volumes to restore into: `postgres-data`, `redis-data`,
   `qdrant-storage`, `minio-data` (only the ones you are restoring).
3. Follow §4.2 (or §4.1), §5, §6 for each component, using the **same STAMP**.
4. `docker compose up -d` and wait for all healthchecks to pass.
5. Verify: `GET /health/ready` returns `healthy`; run the browser journey
   (`node scripts/browser-journey.mjs`) or a smoke API call to confirm data.
6. Re-run the **next scheduled backup** so the recovery point moves forward.

---

## 9. DR testing (scheduled drill)

- **Monthly:** restore the latest weekly base into a throwaway container and
  verify `pg_restore --list`/table counts — validates the backup is readable.
- **Quarterly:** full §8 runbook on a staging machine — validates RTO.
- **After every schema change:** confirm the logical dump still restores cleanly
  (a new migration can invalidate `pg_dump -Fc` restores).

---

## 10. Notes & limitations

- **WAL retention** matches the backup retention (14 days). A PITR target older
  than the oldest kept `pg_base/` + WAL range is not recoverable.
- **`pg_dump` runs concurrently with live traffic** — it produces a consistent
  snapshot (custom format) thanks to MVCC; no downtime required.
- **Backup container ordering:** `depends_on` waits for postgres/redis/qdrant/
  minio healthchecks, so the first `RUN_ON_START` backup never races a booting
  database.
- **S3/R2 credentials:** the compose defaults target local MinIO. For R2 set
  `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` (keep the
  credentials in `.env`, not the compose file).
