#!/usr/bin/env bash
# validate-secrets.sh — sanity-check a .env file (or the environment) for
# missing secrets and known-insecure defaults before booting a service or
# shipping a deploy. Safe to run in CI (never prints values).
#
# Usage:
#   ./scripts/validate-secrets.sh --env local --file .env
#   ./scripts/validate-secrets.sh --env production --file .env
#   ./scripts/validate-secrets.sh --env production          # uses the environment
set -euo pipefail

ENV="local"
FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV="$2"; shift 2 ;;
    --file) FILE="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

# Values are read and immediately discarded; only presence/length is reported.
get() {
  local key="$1"
  if [[ -n "$FILE" ]]; then
    local line
    line=$(grep -E "^${key}=" "$FILE" 2>/dev/null | tail -1 || true)
    [[ -z "$line" ]] && return 1
    printf '%s' "${line#*=}" | tr -d ''  # strip CR (Windows-edited .env)
  else
    [[ -z "${!key+x}" ]] && return 1
    printf '%s' "${!key}"
  fi
}

problems=0
warn() { echo "  [MISSING] $1" >&2; problems=$((problems+1)); }
warn_val() { echo "  [INSECURE] $1" >&2; problems=$((problems+1)); }
warn_len() { echo "  [WEAK] $1 (length ${2}) — want >= 32 chars" >&2; problems=$((problems+1)); }

# Secrets that must always exist (all environments).
ALWAYS=(DATABASE_URL REDIS_URL JWT_SECRET)
# Production additionally requires the AI keys + storage credentials.
if [[ "$ENV" == "production" || "$ENV" == "staging" ]]; then
  ALWAYS+=(JWT_REFRESH_SECRET QDRANT_URL R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY \
           GOOGLE_GEMINI_API_KEY PMS_API_KEY)
fi

# Known-insecure defaults that must be replaced outside local dev.
INSECURE_DEFAULTS=(change-me change-this-to-a-strong-random-secret password secret)

# Exact values that are EXPECTED in local dev (docker-compose defaults). They
# are whitelisted ONLY in --env local; staging/production still flag them.
# Format: KEY=expected-value (value matched exactly, not as substring).
LOCAL_DEV_WHITELIST=(
  "DATABASE_URL=postgresql://jeevandata:jeevandata_secret@localhost:5432/jeevandata?schema=public"
  "REDIS_URL=redis://default:redis_secret@localhost:6380"
  "QDRANT_URL=http://localhost:6333"
  "R2_ACCESS_KEY_ID=minioadmin"
  "R2_SECRET_ACCESS_KEY=minioadmin"
  "R2_ENDPOINT=http://localhost:9000"
  "WHISPER_API_URL=http://localhost:9001/inference"
)

# Returns 0 if $key=$value matches an entry in the LOCAL_DEV_WHITELIST.
is_local_dev_default() {
  local entry
  for entry in "${LOCAL_DEV_WHITELIST[@]}"; do
    if [[ "$entry" == "$key=$value" ]]; then
      return 0
    fi
  done
  return 1
}

for key in "${ALWAYS[@]}"; do
  if ! value=$(get "$key") || [[ -z "$value" ]]; then
    warn "$key is not set"
    continue
  fi
  # No trimming of values here; length check uses the raw value.
  if [[ "$key" == "JWT_SECRET" || "$key" == "JWT_REFRESH_SECRET" ]]; then
    len=${#value}
    if [[ $len -lt 32 ]]; then
      warn_len "$key" "$len"
    fi
  fi
  # In local mode, skip the insecure-default check for known dev values.
  if [[ "$ENV" == "local" ]] && is_local_dev_default; then
    continue
  fi
  for bad in "${INSECURE_DEFAULTS[@]}"; do
    if [[ "$value" == *"$bad"* ]]; then
      warn_val "$key looks like a placeholder/known-insecure value"
      break
    fi
  done
done

if [[ $problems -gt 0 ]]; then
  echo "validate-secrets: $problems problem(s) found for env=$ENV" >&2
  exit 1
fi
echo "validate-secrets: OK (env=$ENV)"
