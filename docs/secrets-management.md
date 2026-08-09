# Secrets Management — Jeevandata

How secrets are stored, injected, validated, and rotated across **local**, **staging**, and **production**.

## 1. Secret inventory

| Secret                                    | Used by                             | Local default                                                         | Staging/Prod                                     | Rotate how often           |
| :---------------------------------------- | :---------------------------------- | :-------------------------------------------------------------------- | :----------------------------------------------- | :------------------------- |
| `DATABASE_URL`                            | Backend (Prisma/Postgres)           | `postgresql://jeevandata:jeevandata_secret@localhost:5432/jeevandata` | Postgres password (e.g. from Vault)              | quarterly / on team change |
| `REDIS_URL`                               | Backend (sessions, BullMQ)          | `redis://:redis_secret@localhost:6380`                                | Redis password                                   | quarterly                  |
| `QDRANT_URL`                              | Backend (face vectors)              | `http://localhost:6333`                                               | Internal URL                                     | on infra change            |
| `QDRANT_API_KEY`                          | Backend (Qdrant auth)               | _(empty — auth disabled in dev)_                                      | API key                                          | quarterly                  |
| `R2_ACCESS_KEY_ID`                        | Backend (audio/face object storage) | `minioadmin`                                                          | Cloudflare R2 key                                | quarterly                  |
| `R2_SECRET_ACCESS_KEY`                    | Backend (object storage)            | `minioadmin`                                                          | Cloudflare R2 secret                             | quarterly                  |
| `GOOGLE_GEMINI_API_KEY`                   | Backend (intake agent)              | _(empty)_                                                             | Gemini API key                                   | 90 days                    |
| `ANTHROPIC_API_KEY`                       | Backend (brief fallback)            | _(empty)_                                                             | Anthropic key (if used)                          | 90 days                    |
| `OPENAI_API_KEY`                          | Backend (transcription fallback)    | _(empty)_                                                             | OpenAI key (if used)                             | 90 days                    |
| `JWT_SECRET`                              | Backend (access tokens)             | `change-this-to-a-strong-random-secret`                               | **≥ 32 random bytes**                            | immediately on leak        |
| `JWT_REFRESH_SECRET`                      | Backend (refresh tokens)            | _(from .env)_                                                         | **≥ 32 random bytes, different from JWT_SECRET** | immediately on leak        |
| `PMS_API_KEY`                             | Backend (external PMS/EMR sync)     | _(empty)_                                                             | PMS provider key                                 | quarterly                  |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | docker-compose (dev object store)   | `minioadmin` / `minioadmin`                                           | n/a (MinIO is dev-only)                          | n/a                        |
| `SLACK_WEBHOOK_URL`                       | Alertmanager (monitoring alerts)    | _(empty)_                                                             | Slack incoming webhook                           | on webhook compromise      |

## 2. Where secrets live per environment

| Environment                | Source of truth                         | Injection                                                                                                                           |
| :------------------------- | :-------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| **Local dev**              | `apps/backend/.env` (gitignored)        | `@nestjs/config` reads the file at boot; docker-compose uses `POSTGRES_PASSWORD`/`REDIS_URL` etc. from the compose file or host env |
| **CI**                     | GitHub **Actions secrets**              | `env:` block in `.github/workflows/*.yml`                                                                                           |
| **Staging/Prod (compose)** | GitHub Actions secrets → SSH            | `deploy.yml` writes `APP_ENV_B64` → `.env` on the host; `docker-compose.app.yml` `env_file: .env`                                   |
| **Staging/Prod (k8s)**     | `k8s/secret.example.yaml` → real Secret | `kubectl create secret generic jeevandata-secrets`; Deployment `envFrom.secretRef`                                                  |

## 3. Tools (recommended)

- **Local only:** plain gitignored `.env` + `scripts/validate-secrets.sh` for a quick sanity check.
- **Team / cloud:** [Doppler](https://www.doppler.com) or [HashiCorp Vault](https://www.vaultproject.io) as the single source of truth.
  - Doppler: `doppler secrets download --format docker --no-file > .env` to materialise `.env` on a host.
  - Vault: `vault kv get -format=json secret/jeevandata/prod | jq -r '.data.data | to_entries[] | "\(.key)=\(.value)"' > .env`.
- **Secrets must never be committed.** `.env`, `*.pem`, `*.key` are gitignored — verify with `git check-ignore` before adding new files.

## 4. Generating strong secrets

```bash
openssl rand -base64 48    # JWT_SECRET / JWT_REFRESH_SECRET / QDRANT_API_KEY
openssl rand -hex 24       # DB / Redis passwords
```

## 5. Rotation runbook

1. Generate new value with the command above.
2. Update the environment's source of truth (Vault/Doppler/GitHub secret).
3. If a client was already issued tokens with the old `JWT_SECRET`: the **refresh-token table** (hashed) still validates, but access tokens are immediately invalid — users re-login. This is the intended blast-radius of JWT rotation.
4. Update `REDIS_URL`/`DATABASE_URL` passwords **in the service config too** (docker-compose env or k8s Secret), then restart.
5. Confirm `/health/ready` returns healthy for all dependencies.
6. Delete the old value from wherever it was stored (Vault history scrub / key versioning handles this automatically).

## 6. Leak response

- **Immediately rotate** any credential that may have leaked (don't just delete the line from git history).
- Revoke the exposed value at the provider (Gemini/OpenAI/R2/Postgres).
- If a `JWT_SECRET` was leaked, revoke all refresh tokens (`DELETE FROM refresh_tokens`) so old access tokens die at next validation.
- Check audit logs (`GET /audit/logs`) for suspicious activity in the window.

## 7. Validation

`scripts/validate-secrets.sh` checks a `.env` file (or the environment) for missing secrets and known-insecure defaults. The known compose dev defaults (`jeevandata_secret`, `minioadmin`, localhost URLs) are **whitelisted only in `--env local`** — staging/production still flag them:

```bash
./scripts/validate-secrets.sh --env local --file .env
./scripts/validate-secrets.sh --env production --file .env
```

Exits non-zero and lists every problem; safe to run in CI before a deploy.
