#!/usr/bin/env bash
# test-validate-secrets.sh — automated tests for scripts/validate-secrets.sh.
#
# Covers: local-dev whitelist behavior (local vs production), placeholder and
# weak JWT detection, missing-secret reporting, CRLF .env handling, value
# privacy (the validator must never print values), nonexistent-file handling,
# unknown-option rejection, and env-mode (no --file).
#
# Run from anywhere:  bash scripts/test-validate-secrets.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALIDATOR="$ROOT/scripts/validate-secrets.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

# assert <description> <expected_exit> <grep_pattern> <cmd...>
assert() {
  local desc="$1" want_exit="$2" pattern="$3"
  shift 3
  local out rc=0 ok=1
  out=$("$@" 2>&1) || rc=$?
  [[ "$rc" == "$want_exit" ]] || ok=0
  if [[ -n "$pattern" ]] && ! grep -qE "$pattern" <<<"$out"; then ok=0; fi
  if [[ $ok == 1 ]]; then
    pass=$((pass + 1))
    echo "  PASS  $desc"
  else
    fail=$((fail + 1))
    echo "  FAIL  $desc (exit=$rc want=$want_exit)"
    sed 's/^/        | /' <<<"$out"
  fi
}

# Sanity: the validator itself must be syntactically valid.
bash -n "$VALIDATOR"

# Deterministic strong JWT (40 chars) — no openssl dependency.
STRONG_JWT='0123456789abcdef0123456789abcdef01234567'

# --- 1. Local whitelist ---
cat >"$TMP/local-ok.env" <<EOF
DATABASE_URL=postgresql://jeevandata:jeevandata_secret@localhost:5432/jeevandata?schema=public
REDIS_URL=redis://default:redis_secret@localhost:6380
JWT_SECRET=$STRONG_JWT
EOF
assert "local mode accepts whitelisted dev defaults" 0 'OK \(env=local\)' \
  bash "$VALIDATOR" --env local --file "$TMP/local-ok.env"

# --- 2. Production still flags dev creds ---
assert "production mode still flags dev DB creds" 1 '\[INSECURE\] DATABASE_URL' \
  bash "$VALIDATOR" --env production --file "$TMP/local-ok.env"

# --- 3. Placeholder JWT ---
cat >"$TMP/placeholder.env" <<EOF
DATABASE_URL=postgresql://u:p@h:5432/db
REDIS_URL=redis://:pw@h:6379
JWT_SECRET=change-this-to-a-strong-random-secret
EOF
assert "placeholder JWT flagged insecure" 1 '\[INSECURE\] JWT_SECRET' \
  bash "$VALIDATOR" --env local --file "$TMP/placeholder.env"

# --- 4. Weak JWT ---
cat >"$TMP/short.env" <<EOF
DATABASE_URL=postgresql://u:p@h:5432/db
REDIS_URL=redis://:pw@h:6379
JWT_SECRET=short
EOF
assert "short JWT flagged weak with length" 1 '\[WEAK\] JWT_SECRET \(length 5\)' \
  bash "$VALIDATOR" --env local --file "$TMP/short.env"

# --- 5. CRLF .env ---
printf 'DATABASE_URL=postgresql://jeevandata:jeevandata_secret@localhost:5432/jeevandata?schema=public\r\nREDIS_URL=redis://default:redis_secret@localhost:6380\r\nJWT_SECRET=%s\r\n' \
  "$STRONG_JWT" >"$TMP/crlf.env"
assert "CRLF .env passes (CR stripped)" 0 'OK \(env=local\)' \
  bash "$VALIDATOR" --env local --file "$TMP/crlf.env"

# --- 6. Missing required secret ---
cat >"$TMP/missing.env" <<EOF
DATABASE_URL=postgresql://u:p@h:5432/db
REDIS_URL=redis://:pw@h:6379
EOF
assert "missing JWT_SECRET reported" 1 '\[MISSING\] JWT_SECRET' \
  bash "$VALIDATOR" --env local --file "$TMP/missing.env"

# --- 7. Privacy: values are never printed ---
cat >"$TMP/secret.env" <<EOF
DATABASE_URL=postgresql://u:p@h:5432/db
REDIS_URL=redis://:pw@h:6379
JWT_SECRET=TOP_SECRET_SENTINEL_${STRONG_JWT}
EOF
out=$(bash "$VALIDATOR" --env local --file "$TMP/secret.env" 2>&1) || true
if ! grep -q 'TOP_SECRET_SENTINEL' <<<"$out"; then
  pass=$((pass + 1))
  echo "  PASS  values never printed"
else
  fail=$((fail + 1))
  echo "  FAIL  values leaked into output"
  sed 's/^/        | /' <<<"$out"
fi

# --- 8. Nonexistent file ---
assert "missing file reports secrets missing (no crash)" 1 '\[MISSING\] DATABASE_URL' \
  bash "$VALIDATOR" --env local --file "$TMP/does-not-exist.env"

# --- 9. Unknown option ---
assert "unknown option exits 2" 2 'Unknown option' \
  bash "$VALIDATOR" --bogus

# --- 10. Env-mode (no --file) ---
# Runs via assert (NOT a bare subshell) so pass/fail counters are updated in
# the parent shell; the export/unset side effects stay inside the
# command-substitution subshell. Unset first so CI env vars can't leak in.
run_env_mode() {
  unset DATABASE_URL REDIS_URL JWT_SECRET QDRANT_URL R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY
  export DATABASE_URL='postgresql://jeevandata:jeevandata_secret@localhost:5432/jeevandata?schema=public'
  export REDIS_URL='redis://default:redis_secret@localhost:6380'
  export JWT_SECRET="$STRONG_JWT"
  bash "$VALIDATOR" --env local
}
  assert "env-mode (no --file) validates exported vars" 0 'OK \(env=local\)'  run_env_mode

echo
echo "validate-secrets tests: $pass passed, $fail failed"
[[ $fail -eq 0 ]]
