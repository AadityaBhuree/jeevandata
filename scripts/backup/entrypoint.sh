#!/bin/sh
# =============================================================================
# entrypoint.sh — backup container entrypoint.
#
# Installs a crontab that runs:
#   BACKUP_SCHEDULE      (default 0 2 * * * — daily 02:00)  logical full backup
#   BACKUP_BASE_SCHEDULE (default 0 3 * * 0 — Sunday 03:00) physical base + WAL
# and runs one backup immediately at startup if BACKUP_RUN_ON_START=true so a
# fresh deployment gets an instant baseline without waiting for the first cron
# tick. All backup output is appended to /var/log/backup.log, which is tailed
# to stdout so `docker logs` shows progress.
# =============================================================================
set -e

SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"
BASE_SCHEDULE="${BACKUP_BASE_SCHEDULE:-0 3 * * 0}"
RUN_ON_START="${BACKUP_RUN_ON_START:-true}"

mkdir -p /staging /var/log
touch /var/log/backup.log

if [ "$RUN_ON_START" = "true" ]; then
  echo "[backup] run-on-start backup..."
  /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1 \
    || echo "[backup] startup backup reported errors (see /var/log/backup.log)"
fi

{
  echo "$SCHEDULE /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1"
  echo "$BASE_SCHEDULE PG_BASEBACKUP=true /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1"
} > /etc/crontabs/root

echo "[backup] crontab installed:"
cat /etc/crontabs/root

# Stream the log to stdout for docker logs; crond keeps running in foreground.
tail -f /var/log/backup.log &
exec crond -f -l 8
