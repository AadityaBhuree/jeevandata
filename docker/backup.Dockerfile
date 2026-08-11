# =============================================================================
# jeevandata-backup — scheduled full-stack backup container (Phase 7.4).
#
# Alpine base with the exact client tools each backup step needs:
#   postgresql16-client  -> pg_dump / pg_basebackup (16.x, matches pgvector:pg16)
#   redis-tools          -> redis-cli --rdb (RDB stream over the wire)
#   curl                 -> Qdrant snapshot REST API
#   minio-client         -> mc (S3/R2 uploads + retention pruning)
# =============================================================================
FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      curl \
      postgresql16-client \
      redis-tools \
      minio-client \
      tzdata \
  && rm -rf /var/cache/apk/* \
  && mc --version >/dev/null 2>&1 \
  && pg_dump --version \
  && redis-cli --version

COPY scripts/backup/backup.sh /usr/local/bin/backup.sh
COPY scripts/backup/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
