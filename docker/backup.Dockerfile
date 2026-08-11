# =============================================================================
# jeevandata-backup — scheduled full-stack backup container (Phase 7.4).
#
# Alpine base with the exact client tools each backup step needs:
#   postgresql16-client -> pg_dump / pg_basebackup (16.x, matches pgvector:pg16)
#   redis               -> redis-cli --rdb (RDB stream over the wire)
#   curl                -> Qdrant snapshot REST API
#   mc (official binary)-> S3/R2 uploads + retention pruning
#
# NOTE: Alpine's `mc` package is Midnight Commander and its `minio-client` ships
# the binary as `mcli` (not `mc`). The official static mc binary from dl.min.io
# is what the rest of the stack (minio-init etc.) uses, so download it directly.
# =============================================================================
FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      curl \
      postgresql16-client \
      redis \
      tzdata \
  && curl -fsSLo /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc \
  && chmod +x /usr/local/bin/mc \
  && rm -rf /var/cache/apk/* \
  && mc --version \
  && pg_dump --version \
  && redis-cli --version

COPY scripts/backup/backup.sh /usr/local/bin/backup.sh
COPY scripts/backup/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
