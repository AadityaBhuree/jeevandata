# Jeevandata — Engineering Roadmap

> **Version:** 0.2.0 | **Status:** Active Development
> **All phases complete** — Phase 7 (Infrastructure & Deployment) 6/6 steps done (7.1 CI/CD ✅, 7.2 orchestration ✅, 7.3 secrets ✅, 7.4 backup/DR ✅, 7.5 SSL/TLS ✅, 7.6 monitoring ✅). Jeevandata is feature-complete per this roadmap.

---

## How to Use This Plan

Each phase contains numbered steps. Every step is sized for a **single atomic commit** — one logical change that can be reviewed, tested, and pushed independently. Steps within a phase can be parallelized where indicated.

**Commit convention per step:** `feat:`, `fix:`, `test:`, `style:`, `refactor:`, `docs:`, `chore:`, `perf:`

---

## Progress Overview

| Phase | Title                          | Status      | Steps      | Est. Effort |
| :---- | :----------------------------- | :---------- | :--------- | :---------- |
| **1** | Emergency Repairs              | ✅ **Done** | 7/7        | Completed   |
| **2** | Testing & Validation           | ✅ **Done** | 8/8        | Completed   |
| **3** | Backend Production Hardening   | ✅ **Done** | 7/7        | Completed   |
| **4** | Authentication & Multi-Tenancy | ✅ **Done** | 6/6        | Completed   |
| **5** | UI/UX Excellence               | ✅ **Done** | 8/8        | Completed   |
| **6** | Feature Expansion              | ✅ **Done** | 8/8        | Completed   |
| **7** | Infrastructure & Deployment    | ✅ **Done** | 6/6        | Completed   |
|       | **Total remaining**            |             | **1 step** | **1–2h**    |

---

## Phase 1 — Emergency Repairs ✅

> **Goal:** Fix critical auth gaps, add input validation, rate limiting, and session timeout enforcement.

| Step    | Description                                                            | Status | Files                                                                      |
| :------ | :--------------------------------------------------------------------- | :----- | :------------------------------------------------------------------------- |
| 1.1–1.4 | `@Public()` decorator, JWT strategy, AuthModule, mark endpoints public | ✅     | `common/decorators/`, `common/strategies/`, `auth/`, `app.module.ts`       |
| 1.5     | Complete Zod validation on all controllers (Dashboard, Transcription)  | ✅     | `shared-schemas`, `dashboard.controller.ts`, `transcription.controller.ts` |
| 1.6     | Rate limiting on face search endpoints (10 req/min)                    | ✅     | `face.controller.ts`                                                       |
| 1.7     | BullMQ session timeout worker (auto-close stale sessions)              | ✅     | `session-timeout.worker.ts`, `session.module.ts`                           |

---

## Phase 2 — Testing & Validation ✅

> **Goal:** Achieve >70% backend coverage, validate all FSM transitions, add E2E tests for critical paths, and set up frontend testing. **All steps complete.**

### Step 2.1 — Backend: Controller E2E tests ✅

Supertest-based E2E tests validating the full HTTP layer (routes, Zod validation, error formatting, response shape).

| Suite                                | Endpoints covered                                             | Status |
| :----------------------------------- | :------------------------------------------------------------ | :----- |
| `test/face.e2e-spec.ts`              | search, search-with-details, register, embedding, history     | ✅     |
| `test/intake.e2e-spec.ts`            | POST session, GET session/:id, complete, status               | ✅     |
| `test/ai.e2e-spec.ts`                | intake-agent, brief                                           | ✅     |
| `test/dashboard.e2e-spec.ts`         | active-sessions, recent-briefs, latest-brief, review, history | ✅     |
| `test/pms.e2e-spec.ts`               | POST sync (adapters + cache fallback)                         | ✅     |
| `test/health.e2e-spec.ts`            | GET /health, /health/ready, /health/live                      | ✅     |
| `test/rate-limit.e2e-spec.ts`        | Throttler enforcement on protected routes                     | ✅     |
| `test/health-rate-limit.e2e-spec.ts` | Health endpoints bypass rate limiting                         | ✅     |
| `test/intake-kiosk.e2e-spec.ts`      | Kiosk completion regression — real FSM + patientId            | ✅     |

**Result:** 195 E2E tests green across 14 suites.

### Step 2.1b — Kiosk completion regression E2E ✅

Guards the three production bugs found during the live clinic-journey verification (Qdrant point IDs, FSM dead-end, patientId UUID write). Unlike the earlier intake suite (which mocked `IntakeService` — _why those bugs shipped_), this spec runs the **real controller + real IntakeService + real SessionService FSM**, faking only Prisma (stateful in-memory), Redis, and the AI brief:

| Test                                                          | Guards                                               |
| :------------------------------------------------------------ | :--------------------------------------------------- |
| Fresh `INITIATED` kiosk session → `complete` → 200 + FSM walk | Fast-forward revert → `INITIATED → TRANSCRIBING` 400 |
| Complete with **no patientId** → 400 "Patient not identified" | Old empty-UUID behavior returning 200                |
| `TIMED_OUT` session rejects completion                        | Fast-forward must not weaken terminal states         |
| Idempotent replay (`Idempotency-Key`) returns existing record | Offline-outbox path interacting with the new code    |

### Step 2.2 — Backend: Service unit tests ✅

| Service            | Spec file                   | Status |
| :----------------- | :-------------------------- | :----- |
| `AuditService`     | `audit.service.spec.ts`     | ✅     |
| `FaceService`      | `face.service.spec.ts`      | ✅     |
| `IntakeService`    | `intake.service.spec.ts`    | ✅     |
| `SessionService`   | `session.service.spec.ts`   | ✅     |
| `DashboardService` | `dashboard.service.spec.ts` | ✅     |
| `PmsService`       | `pms.service.spec.ts`       | ✅     |
| `HealthService`    | `health.service.spec.ts`    | ✅     |

**Result:** 76 unit tests green across 7 suites.

### Step 2.3 — Guard & validation pipe tests ✅

JwtAuthGuard (valid/expired/missing/malformed/`@Public()` bypass), ZodValidationPipe, HttpExceptionFilter, TransformInterceptor, LoggingInterceptor — covered via E2E suites and guard specs.

### Step 2.4 — BullMQ worker tests ✅

Session timeout worker covered via `SessionService` specs (stale-session → TIMED_OUT, no-op, Prisma error, queue failure) and Redis-mocked E2E suites.

### Steps 2.5–2.7 — Frontend: Vitest + RTL suite ✅

| Area          | Files                                                                               | Status |
| :------------ | :---------------------------------------------------------------------------------- | :----- |
| Setup         | Vitest + Testing Library + jsdom + coverage config                                  | ✅     |
| Hooks         | `useFaceDetection`, `useLivenessDetection`, `useLanguage`                           | ✅     |
| Components    | `Button`, `Badge`, `BriefCard`, `LanguageSelector`, `DarkModeToggle`, UI primitives | ✅     |
| Stores        | `face-store`, `session-store` (Zustand)                                             | ✅     |
| Lib utilities | `face-embedding`, `face-geometry`, `utils`, `api.ts`, `socket.ts`                   | ✅     |
| i18n          | Locale fallback, interpolation, missing-key, Hindi/Marathi/Spanish content          | ✅     |
| Accessibility | axe-core scan over intake page, keyboard + ARIA patterns                            | ✅     |

**Result:** 601 frontend tests green (current).

### Step 2.8 — Coverage & CI integration ✅

- Backend coverage report generated (`COVERAGE_REPORT.md`): 76 unit + 113 E2E tests
- Remaining: CI pipeline (GitHub Actions) tracked in Phase 7.1

---

## Phase 3 — Backend Production Hardening ✅ (complete)

> **Goal:** Fill remaining backend gaps: PMS sync, audit wiring, health checks, structured logging, and configuration validation.

### Step 3.1 — Complete PMS/EMR sync module ✅

- HL7 FHIR resource mapping (Patient, Encounter, Observation) via `adapters/hl7-fhir.adapter.ts`
- Storage-agnostic interface: `PmsAdapter` (FHIR, custom API) + `CustomApiAdapter`
- Retry with exponential backoff for network failures
- `PmsPatientCache` read-through/write-through caching
- `lastSyncedAt` tracking per patient

### Step 3.2 — Wire audit logging into all modules ✅

- `AuditService` injected into FaceService, IntakeService, DashboardService, PmsService, TranscriptionService
- Logs on face search, patient lookup, brief generation, EMR sync, session view
- Fire-and-forget pattern — audit failures never block the primary operation

### Step 3.3 — Health checks + OpenTelemetry tracing ✅

- `GET /health`, `/health/ready`, `/health/live` with per-dependency status + latency
- `modules/opentelemetry/` — Jaeger/OpenTelemetry instrumentation (traces + spans on service boundaries)

### Step 3.4 — Unit tests for previously-uncovered modules ✅

`health.service.spec.ts`, `dashboard.service.spec.ts`, `pms.service.spec.ts` — closes the 0% coverage gaps.

### Step 3.4b — Unit tests for security-critical infrastructure ✅

`jwt-auth.guard.spec.ts`, `roles.guard.spec.ts`, `zod-validation.pipe.spec.ts`, `http-exception.filter.spec.ts` — 31 tests covering the authz/validation/error-path layer.

### Step 3.5 — Add configuration validation ✅

Validate all critical env vars at startup (both backend and frontend):

- Backend: `config/validation.schema.ts` (Zod) validates all env vars on bootstrap
- Frontend: `lib/env.ts` validates `NEXT_PUBLIC_*` vars, fails fast in production builds
- Verified: `validation.schema.spec.ts` + `lib/__tests__/env.test.ts`

### Step 3.6 — API documentation with Swagger/OpenAPI ✅

- `@nestjs/swagger` + `swagger-ui-express` installed
- `config/swagger.config.ts` — DocumentBuilder + bearer auth + tags, wired in `main.ts`
- All 8 controllers decorated with `@ApiTags`/`@ApiOperation`; JWT routes get `@ApiBearerAuth`; face DTOs get `@ApiProperty`
- Hosted at `/api/docs` (disabled in production unless `SWAGGER_ENABLED=true`)

**Est. effort:** 2h

### Step 3.7 — Frontend structured logger ✅

- `frontend/src/lib/logger.ts` — level filtering via `NEXT_PUBLIC_LOG_LEVEL`, no debug in prod, Error/context serialization
- All stray `console.*` calls replaced (page.tsx, intake page, useFaceDetection, socket.ts)
- `lib/__tests__/logger.test.ts` — 7 tests; also fixed 7 pre-existing frontend typecheck errors

**Est. effort:** 1.5h

---

## Phase 4 — Authentication & Multi-Tenancy ✅

> **Goal:** Complete the auth system: login/register endpoints, API key management, role-based access control, clinic multi-tenancy, and frontend session/RBAC UI.

### Step 4.1 — Auth endpoints: login, register, profile ✅

- `POST /auth/register` — creates a RECEPTIONIST account (bcrypt-hashed password; role/clinicId never accepted from the client)
- `POST /auth/login` — returns access JWT + refresh token + expiry
- `GET /auth/profile` — current user info (JWT-protected)
- `POST /auth/refresh` — token rotation with SHA-256 hashed storage + reuse protection
- `POST /auth/logout` — revokes all refresh tokens
- Password strength validation (min 8 chars, mixed case, number) via `registerUserSchema`

**Delivered:** `auth/auth.controller.ts`, `auth/auth.service.ts`, `auth/auth.module.ts`, `common/strategies/jwt.strategy.ts`, `test/auth.e2e-spec.ts` (14 tests).

### Step 4.2 — RBAC infrastructure (guards + decorators) ✅

- `@Roles()` decorator + `RolesGuard` (reads `user.role` from JWT payload)
- `JwtAuthGuard` registered as global `APP_GUARD`; `@Public()` opt-out
- `CurrentUser` param decorator (`id`, `email`, `role`, `clinicId`)

**Delivered:** `common/guards/jwt-auth.guard.ts`, `common/guards/roles.guard.ts`, `common/decorators/*.ts` (+31 unit tests in Step 3.4b).

### Step 4.2b — Apply RBAC to sensitive endpoints ✅

- `GET /dashboard/*` → `@Roles(DOCTOR, RECEPTIONIST)`; remove `@Public()`
- `PATCH /brief/:id/review` → `@Roles(DOCTOR)` only
- `POST /face/register-patient` → `@Roles(RECEPTIONIST, DOCTOR)`; kiosk endpoints (`search`, `search-with-details`, `embedding`) stay `@Public`
- JWT payload + strategy now carry `clinicId`

### Step 4.3 — API key authentication for external integrations ✅

- `ApiKeyGuard` validating `X-API-Key` header; `api_keys` table (SHA-256 hashed keys, prefix for identification)
- API key management endpoints (ADMIN/SYSTEM): `POST /api-keys`, `GET /api-keys`, `DELETE /api-keys/:id`
- `ApiKeyGuard` applied to `POST /sync/pms` + `POST /sync/patient-context`

### Step 4.4 — Clinic multi-tenancy ✅

- `Clinic` model + `clinicId` FK on `clinic_users`, `patients`, `intake_sessions`, `api_keys`
- `ClinicsModule` CRUD (ADMIN/SYSTEM only) with audit logging
- `clinicId` propagated through JWT payload, `GET /auth/profile`, and login response

### Step 4.5 — Frontend login UI & session management ✅

- `/login` page with email/password form + client validation
- Zustand `auth-store` (tokens + user in localStorage, hydrate on boot)
- `api.ts` attaches `Authorization: Bearer` + single-attempt refresh on 401
- `useAuth` hook; logout action in dashboard header

### Step 4.6 — Frontend RBAC UI ✅

- `RequireAuth` route wrapper (redirect to `/login` when guest, access-denied when wrong role)
- Role badge in header; hide doctor-only actions (e.g. Mark Reviewed) from RECEPTIONIST

---

## Phase 5 — UI/UX Excellence ✅

> **Goal:** Beautiful, responsive, accessible frontend with animations, dark mode, and polished interactions.

| Step | Description                                                                      | Status |
| :--- | :------------------------------------------------------------------------------- | :----- |
| 5.1  | Design system animations + globals.css                                           | ✅     |
| 5.2  | ToastProvider + Dialog components                                                | ✅     |
| 5.3  | Enhanced Button with CVA variants                                                | ✅     |
| 5.4  | Landing page redesign                                                            | ✅     |
| 5.5  | FaceOverlay multi-state detection UI                                             | ✅     |
| 5.6  | Intake page fixes + ESLint config                                                | ✅     |
| 5.7  | Dashboard skeleton loaders + lucide icons                                        | ✅     |
| 5.8  | Dark mode with system preference detection                                       | ✅     |
| 5.9  | Dark mode on sub-components (TranscriptView, VoiceInput, FaceRegistrationDialog) | ✅     |

---

## Phase 6 — Feature Expansion ✅

> **Goal:** Ship the remaining major features: patient registration UI, mobile support, multi-language, accessibility, admin dashboard, HIPAA compliance, offline mode, and monitoring.

### Step 6.1 — Patient registration UI & flow ✅

- `FaceRegistrationDialog` complete: name, DOB, mobile, consent checkbox
- Form validation (mobile format, DOB range, name length), progressive disclosure
- Connected to `POST /face/register-patient`, success confirmation + transition to intake
- Dark mode applied to dialog

### Step 6.2 — Mobile camera support (PWA) ✅

- Rear camera `facingMode: { exact: 'environment' }` on mobile
- `useMobileDetection` hook → responsive UI layout
- Camera selection dropdown (front/back) when multiple cameras available
- Optimized MediaPipe WASM loading for mobile (smaller model, CPU delegate fallback)

### Step 6.3 — Multi-language intake support ✅

- Language selector on intake start screen (`LanguageSelector`)
- Language passed to Gemini system instruction; UI labels translated via lightweight i18n (`i18n/`)
- Supported: English (`en`), Hindi (`hi`), Marathi (`mr`), Spanish (`es`)
- Patient language preference stored in session metadata; `<html lang>` synced
- Full test coverage: locale detection, localStorage persistence, interpolation, missing-key fallback

### Step 6.4 — Advanced accessibility ✅

- Screen reader support: skip link, video `aria-label`, status live regions
- Keyboard navigation + focus management across all intake components
- ARIA labels on camera, recording, and status controls
- axe-core automated scan over the intake page (in Vitest suite)
- Component a11y tests: `LanguageSelector` (menu-button ARIA pattern, roving focus), `DarkModeToggle` (aria-expanded/haspopup, Escape focus return)

### Step 6.5 — Clinic admin dashboard with analytics ✅

- `GET /analytics/overview` — total/returning/new sessions, face match rate, avg intake duration, brief success rate, active count (rolling 7/30/90-day window, optional `clinicId`)
- `GET /analytics/volume` — zero-filled daily patient volume (local-date buckets)
- `GET /analytics/hours` — 24-cell peak clinic hours heatmap
- `GET /analytics/flow` — real-time patient flow board (waiting → in intake → triaged → with doctor)
- `GET /analytics/export` — CSV download (BOM-prefixed for Excel)
- All endpoints `@Roles(ADMIN, SYSTEM)` + audit-logged + Swagger docs
- Frontend: `/admin` route gated to ADMIN/SYSTEM via `RequireAuth allowedRoles`; `components/admin/` — `StatCard`, dependency-free `VolumeChart` (hover labels, aria-labels), `HoursHeatmap`, `FlowBoard`, range switcher, CSV export, loading skeletons + error alert

**Delivered:** `modules/analytics/`, `test/analytics.e2e-spec.ts` (11 tests), `analytics.service.spec.ts` (17 tests), `app/admin/`, `components/admin/` (+14 frontend tests)

### Step 6.6 — HIPAA compliance audit module ✅

- `GET /audit/logs` — paginated audit trail viewer filtered by action, actor, role, resource type, and date range (end-of-day inclusive `to`)
- `GET /audit/logs/export` — CSV download with PHI anonymization (names, mobiles, Aadhaar, emails redacted in `details`; IP last octet/group masked; RFC-4180 escaping, 10k row cap)
- `GET /audit/patients/:patientId/access-summary` — PHI access accounting per patient per day (access counts, unique actors, action breakdown, rolling 7/30/90/365-day window)
- `GET /audit/retention` + `POST /audit/retention/cleanup` — retention policy (default 90 days via `AUDIT_RETENTION_DAYS`, validated 1–3650) and manual cleanup trigger
- All endpoints `@Roles(ADMIN, SYSTEM)` + Swagger tag; every read is audit-logged
- Frontend: `/admin/audit` route gated to ADMIN/SYSTEM; filter bar, log table with role badges + pagination, anonymized CSV export, PHI access summary card, retention policy card with confirmed cleanup; dark mode + skeletons + error alert

**Delivered:** `modules/audit/` controller + service extensions, `test/audit.e2e-spec.ts` (16 tests), `audit.service.spec.ts` (34 tests), `app/admin/audit/` (+13 frontend tests). Review fixes: inclusive date range, IP masking, keystroke-driven refetch elimination.

### Step 6.7 — Offline mode with IndexedDB sync ✅

- **IndexedDB (Dexie) v3 layer** — patient records, active sessions, transcripts, briefs, an outbox mutation queue (`COMPLETE_SESSION` / `REGISTER_PATIENT`), and a PHI-free sync log (ids are session/mutation ids — never mobile numbers)
- **PHI encrypted at rest** — patients (name/dob/mobile/data), transcripts, briefs, session `localData`, and outbox payloads (incl. face embeddings) stored AES-256-GCM (WebCrypto, PBKDF2-derived non-extractable device key); v3 upgrade purges any legacy plaintext rows
- **Outbox replay with idempotency** — every replay sends an `Idempotency-Key` header; backend returns existing records on re-delivery instead of 400/409 (both `completeSession` and `registerPatient`)
- **Drain-until-empty flush** — loops (bounded) so mutations enqueued mid-flush sync immediately; first-failure stop preserves ordering
- **`OfflineIndicator`** banner (queued count, syncing spinner, retry button, back-online confirmation) + `useOnlineStatus` hook; `initOfflineSync` guards against double init (StrictMode-safe)
- **PWA** — `next-pwa` `NetworkFirst` for pages/static; SW registers in production only; `/api/` HTTP caching removed (auth'd PHI must not live in the HTTP cache — offline data flows through encrypted IndexedDB)
- Wired into `useIntakeConversation` (offline completion queue + transcript/brief caching), intake page (patient/session caching), and `FaceRegistrationDialog` (offline registration queue)

**Delivered:** `services/crypto.ts`, `services/db.ts` (v3), `services/sync.ts`, `services/api.ts`, `hooks/useOnlineStatus.ts`, `components/ui/offline-indicator.tsx`, `next.config.js`; backend idempotency in `intake.*` + `face.*`; tests: `crypto.test.ts` (7), `db.test.ts` (+7), `sync.test.ts` (+4), `face-registration.service.spec.ts` (new, 6), `intake.service.spec.ts` (+4), E2E header passthrough ×4. Frontend 586 tests / backend 250 unit + 181 E2E.

**Est. effort:** 3–4h (✅ complete)

### Step 6.8 — Performance monitoring & alerting ✅

- **Prometheus `GET /metrics`** — request counter, duration histogram, error counter, active-sessions gauge (from WebSocket gateway), Qdrant/face latency histogram (instrumented in `FaceService`), session-timeout counter; `MetricsInterceptor` records every request globally; `collectDefaultMetrics` for Node.js runtime
- **Monitoring API** — `GET /monitoring/latency` (p50/p95/p99 + sample count for HTTP and Qdrant, windowed over 1h/24h/7d), `GET /monitoring/alerts` (evaluates thresholds: HTTP error rate > 1% over 5 min, face-match p95 > 2s, session timeout rate > 5%); `@Roles(ADMIN, SYSTEM)`
- **Admin UI** — `LatencyPanel` (percentile bars with counts), `AlertsPanel` (severity badges OK/WARNING/CRITICAL, value vs threshold), wired into `/admin` with skeletons + error handling
- `/metrics` is `@Public()` and skips the response envelope + throttle for scrape compatibility

**Delivered:** `modules/opentelemetry/metrics.service.ts` + `prometheus.controller.ts`, `common/interceptors/metrics.interceptor.ts`, `modules/monitoring/` (service + controller + module), FaceService/SessionService/gateway instrumentation, `test/prometheus.e2e-spec.ts` (10 tests), `metrics.service.spec.ts` + `monitoring.service.spec.ts` (18 tests); frontend `monitoringApi` + `LatencyPanel` + `AlertsPanel` (+11 tests). Review fixes: min-sample guards on all three alert thresholds + interceptor failure isolation (+3 tests). Backend 284 unit + 191 E2E, frontend 599 tests — all green.

**Est. effort:** 3–4h (✅ complete)

---

### Step 6.9 — Browser verification tooling ✅

- `scripts/browser-journey.mjs` — reusable CDP script driving a **real Chrome** (headless default, fake camera/mic) through the kiosk flow: landing → Start New Intake Session → `/intake/<uuid>` → Start Camera → live stream + liveness UI
- Reports PASS/FAIL per step; collects console errors, network failures, exceptions; optional screenshot; exit codes 0/1/2 for CI
- Auto-detects Chrome on Windows/macOS/Linux (`CHROME_PATH` override), `FRONTEND_URL`/`BACKEND_URL` env; flags: `--no-headless`, `--screenshot <path>`, `--fail-on-console-errors`
- Root alias: `pnpm verify:browser`
- Verified live: 6/6 steps PASS, exit 0, zero orphaned Chrome processes (review fix: `process.exit()` → `process.exitCode` so the `finally` cleanup always runs)

**Delivered:** `scripts/browser-journey.mjs` (commit `ff06085`), `package.json` `verify:browser` alias (commit `71f177f`)

---

## Phase 7 — Infrastructure & Deployment ✅ (6/6 steps done)

> **Goal:** Production-ready deployment with CI/CD, container orchestration, secrets management, and disaster recovery.

### Step 7.1 — CI/CD pipeline (GitHub Actions) ✅

**Delivered:** `.github/workflows/ci.yml` (commit `d7a4d63`), 3 parallel jobs on push to main / PR to main:

- **quality** — `pnpm lint` + `pnpm format:check` + `pnpm typecheck` (Prisma generated first)
- **test** — backend unit `--coverage`, backend E2E (service-layer mocked — no DB required), frontend vitest `--coverage`; coverage/ artifacts uploaded (14-day retention)
- **build** — `pnpm build` (turbo, cached) with dist/.next artifacts uploaded
- pnpm/action-setup@v4 (9.15.4) + setup-node@v4 `cache: pnpm`, frozen lockfile, concurrency cancel-in-progress, non-secret env defaults (validation schema provides defaults for every key — verified)
- ✅ **Follow-up complete (commit `ed00cf5`):** `deploy.yml` — builds + pushes backend/frontend images to GHCR (sha + latest, gha cache), smoke-tests the backend image in a container (`/health/live` probe), then deploys to staging and promotes to production behind a manual approval gate (jobs gated on `STAGING_HOST`/`PRODUCTION_HOST` secrets; env written from `APP_ENV_B64`)
- ✅ Added `docker-compose.app.yml` (backend/frontend GHCR images + healthcheck, extending postgres/redis/qdrant from `docker-compose.yml`) used by the SSH deploy steps; `Dockerfile.frontend` now accepts `NEXT_PUBLIC_API_URL`/`WS_URL` build args; `next.config.js` enables `output: standalone`
- **To activate remote deploys:** create `staging`/`production` environments + required reviewer on `production`, add the documented secrets (`STAGING_HOST`/`USER`/`SSH_KEY`, `PRODUCTION_*`, `APP_ENV_B64`), and point `NEXT_PUBLIC_*` build URLs at the real domains

**Est. effort:** 2h (✅ CI portion complete)

### Step 7.2 — Container orchestration ✅ (commit `0ad6fcc`)

- **docker-compose.yml:** `deploy.resources` limits on all 9 infra services (postgres 2 CPU/2 GB, redis 1/512 MB, qdrant 2/1 GB, minio 1/1 GB, whisper 4/2 GB, prometheus/grafana/alertmanager/redis-commander modest caps) — validated with `docker compose config`
- **`k8s/` manifests:** namespace, backend + frontend Deployments (rolling update `maxUnavailable: 0`, startup/readiness/liveness probes against `/health/live` + `/health/ready`, resource requests/limits, `runAsNonRoot` + `imagePullPolicy: Always`), ClusterIP Services, ConfigMap (non-secret env), `secret.example.yaml` template (envFrom — created before rollout), `autoscaling/v2` HPAs (backend CPU 60% + memory 75%, 2–8; frontend CPU 60%, 2–6; scale-down stabilization 300s), nginx Ingress with TLS (`jeevandata-tls` secret, cert-manager annotation)
- **Dockerfile.backend:** non-root `nodejs` user (uid 1000) + chown'd copies so `runAsNonRoot` works
- Review fixes applied: backend non-root user, `imagePullPolicy: Always` (GHCR `:latest` re-pushed each deploy), secret-before-rollout note
- **To activate:** install nginx-ingress + cert-manager, `kubectl create secret generic jeevandata-secrets`, replace example domains

**Est. effort:** 3–4h (✅ complete)

### Step 7.3 — Secrets management ✅ (commit `0a8ad81`)

- `docs/secrets-management.md` — full secret inventory (DB, Redis, Qdrant, R2, Gemini/Anthropic/OpenAI, JWT pair, PMS, MinIO, Slack), per-environment storage/injection matrix (local `.env`, CI secrets, `deploy.yml` `APP_ENV_B64`, k8s Secret), Doppler/Vault integration, strong-secret generation, rotation runbook, leak response
- `scripts/validate-secrets.sh` — checks a `.env` file or env for missing secrets, known-insecure defaults, and JWT length (<32); per-env requirements (production/staging adds AI keys + storage + PMS); exits 1 on problems, never prints values. Tested (7 findings / OK / weak-JWT cases)

**Est. effort:** 1.5h (✅ complete)

### Step 7.4 — Database backup & disaster recovery ✅ (commits `cd62245`→`6459af7`)

**Delivered:**

- **`scripts/backup/backup.sh`** — full-stack backup: PostgreSQL logical dump
  (`pg_dump -Fc`) + optional weekly physical base (`pg_basebackup -Xs`) + WAL
  archive copy, Redis RDB (live `redis-cli --rdb` stream), and Qdrant
  per-collection snapshots via the REST API (async creation polled); uploads
  everything to S3/R2 (MinIO-compatible) under `<bucket>/<STAMP>/...` and prunes
  objects older than `BACKUP_RETENTION_DAYS` (14d) via `mc rm --older-than`;
  per-component failure tracking, non-zero exit on any failure
- **`scripts/backup/entrypoint.sh`** — crond-based scheduler: daily logical backup
  (`BACKUP_SCHEDULE`, default `0 2 * * *`), weekly physical base (`BACKUP_BASE_SCHEDULE`,
  default `0 3 * * 0`), optional `BACKUP_RUN_ON_START` baseline run; log streamed
  to stdout for `docker logs`
- **`docker/backup.Dockerfile`** — Alpine with exactly the client tools each step
  needs (postgresql16-client, redis-tools, curl, minio-client)
- **`docker-compose.yml`** — new `backup` service (resource-capped, depends on
  healthy postgres/redis/qdrant/minio, mounts `postgres-data` read-only for WAL
  - a `backup-staging` volume); Postgres now runs with `archive_mode=on` +
    `archive_timeout=300` archiving WAL to `wal_archive/` inside the data volume
    (PITR enabled, ≤5 min RPO); `minio-init` also creates the `jeevandata-backups` bucket
- **`docs/disaster-recovery.md`** — restore procedures for every artifact:
  logical dump restore, point-in-time recovery (base + WAL replay with
  `recovery.signal`), Redis RDB restore, Qdrant snapshot restore (multipart +
  local-path), MinIO/R2 media, full-stack runbook, RTO/RPO table, scheduled DR
  drill guidance
- Validated: `bash -n` clean on both scripts, `docker compose config` passes,
  YAML parses

**Est. effort:** 2h (✅ complete)

### Step 7.5 — SSL/TLS & domain setup ✅

**Delivered:**

- `caddy/Caddyfile` — Caddy reverse proxy: automatic Let's Encrypt (no certbot cron), HTTP/3, two virtual hosts (`APP_DOMAIN` → frontend:3000, `API_DOMAIN` → backend:4000), long-cache immutable `/_next/static`, edge security headers (HSTS 1y + subdomains, kiosk-tailored CSP with camera/mic/blob/WebSocket allowances, nosniff, frame DENY, referrer + permissions policies, Server banner removed)
- `caddy/Caddyfile.local` — self-signed variant (internal CA `local_certs`) for offline TLS testing; documented root-CA trust path
- `docker-compose.tls.yml` + `docker-compose.tls.local.yml` — Caddy compose service (80/443, `APP_DOMAIN`/`API_DOMAIN`/`ACME_EMAIL` env, healthcheck, `caddy_data`/`caddy_config` volumes); local override swaps in the self-signed Caddyfile
- Backend `main.ts` — `trust proxy` via Express adapter (correct `req.ip`/`req.protocol` behind the edge) + explicit helmet HSTS (1y, includeSubDomains) so direct API deployments still enforce HTTPS
- Frontend `next.config.js` — `headers()` (HSTS, nosniff, X-Frame-Options DENY, referrer, permissions-policy) for direct deploys; CSP intentionally left at the edge
- `k8s/ingress.yaml` — `ssl-redirect: true` + HSTS/CSP/security headers via `configuration-snippet` (requires `allowSnippetAnnotations` on ingress-nginx)
- `docs/tls-setup.md` — 211-line runbook: Caddy vs cert-manager paths, DNS prereqs, env vars, header table, CORS scheme note, local self-signed workflow, troubleshooting, renewal/monitoring
- Validated: `caddy validate` (prod + local) both `Valid configuration`, `docker compose config` passes (with a root `.env` present — app.yml requires it), backend 321 unit tests green, backend + frontend `tsc --noEmit` clean, next.config.js loads with `headers` function

**Est. effort:** 1.5h (✅ complete — Phase 7 now 6/6)

**Est. effort:** 1.5h

### Step 7.6 — Monitoring stack (Prometheus + Grafana + Alertmanager) ✅

**Delivered:**

- `monitoring/prometheus.yml` — scrape config targeting the backend `GET /metrics` (`host.docker.internal:4000`, 15s interval, 15d retention); backend exposes counters/histograms/gauges from Phase 6.8
- `monitoring/grafana/provisioning/` — auto-registered Prometheus datasource + dashboard provider (folder watched for updates)
- `monitoring/grafana/dashboards/jeevandata.json` — **Jeevandata — API & Clinic Monitoring** dashboard: request rate by route, 5xx error rate (threshold 1% → yellow, 5% → red), HTTP latency p50/p95/p99, Qdrant search latency, face-match p95 (threshold 2s), active sessions, session timeouts, request volume vs 5xx, Node.js memory/event-loop/CPU panels
- `monitoring/prometheus-alerts.yml` — 4 Prometheus rules (validated via `promtool check rules`): 5xx error rate > 1% over 5m (critical, min 20 requests), face-match p95 > 2s over 10m (warning, min 5 samples), session timeout rate > 5% over 24h (warning, min 10 sessions — mirrors backend `MIN_TIMEOUT_SESSIONS`), backend-down (critical)
- `monitoring/alertmanager.yml` — Slack webhook receiver (`${SLACK_WEBHOOK_URL}`, placeholder default keeps the container bootable), grouping by alertname/severity/service, `send_resolved`, null receiver for info-level
- Backend: new `jeevandata_sessions_completed_total` counter (+`incrementSessionsCompleted`) wired into `SessionService.updateStatus` (COMPLETED) **and** `DashboardService.markBriefReviewed` (which writes COMPLETED directly, bypassing the FSM) so the timeout-rate denominator is accurate
- `docker-compose.yml` — `prometheus` (:9090, `host-gateway`) + `grafana` (:3001) + `alertmanager` (:9093, `SLACK_WEBHOOK_URL` env) with healthchecks, volumes, and `rule_files`/`alerting.alertmanagers` wiring
- Validated: dashboard JSON parses, all YAML parses, `promtool check rules` (4 rules OK), `amtool check-config` (2 receivers OK), `docker compose config` passes, backend 287 unit + 191 E2E green

**Est. effort:** 3h (✅ complete)

---

## README Roadmap — Feature Status

| Feature                                                | Phase         | Status |
| :----------------------------------------------------- | :------------ | :----- |
| Core face detection & liveness verification            | Built-in      | ✅     |
| Qdrant vector search integration                       | Built-in      | ✅     |
| Gemini 2.0 Flash AI intake agent                       | Built-in      | ✅     |
| Clinical brief generation pipeline                     | Built-in      | ✅     |
| WebSocket session management                           | Built-in      | ✅     |
| Doctor dashboard with briefs                           | Built-in      | ✅     |
| JWT authentication infrastructure                      | Phase 1       | ✅     |
| Rate limiting                                          | Phase 1       | ✅     |
| Input validation (Zod)                                 | Phase 1       | ✅     |
| Session timeout worker                                 | Phase 1       | ✅     |
| Backend unit tests (321 tests)                         | Phase 2.2     | ✅     |
| Backend E2E tests (14 suites, 195 tests)               | Phase 2.1     | ✅     |
| Frontend Vitest suite (45+ files, 601 tests)           | Phase 2.5–2.7 | ✅     |
| PMS/EMR sync adapters                                  | Phase 3.1     | ✅     |
| Audit logging wiring                                   | Phase 3.2     | ✅     |
| Health checks + OpenTelemetry tracing                  | Phase 3.3     | ✅     |
| Patient registration UI & flow                         | Phase 6.1     | ✅     |
| Mobile camera support (iOS/Android)                    | Phase 6.2     | ✅     |
| Multi-language intake support                          | Phase 6.3     | ✅     |
| Advanced accessibility (axe, keyboard)                 | Phase 6.4     | ✅     |
| Dark mode UI                                           | Phase 5.8–5.9 | ✅     |
| Config validation                                      | Phase 3.5     | ✅     |
| Swagger/OpenAPI docs                                   | Phase 3.6     | ✅     |
| Frontend structured logger                             | Phase 3.7     | ✅     |
| Auth endpoints + RBAC                                  | Phase 4.1–4.2 | ✅     |
| API keys + multi-tenancy                               | Phase 4.3–4.4 | ✅     |
| Login UI + frontend auth                               | Phase 4.5–4.6 | ✅     |
| Clinic admin dashboard with analytics                  | Phase 6.5     | ✅     |
| HIPAA compliance audit module                          | Phase 6.6     | ✅     |
| Offline mode with IndexedDB sync                       | Phase 6.7     | ✅     |
| Performance monitoring & alerting                      | Phase 6.8     | ✅     |
| Browser verification tooling (CDP journey script)      | Phase 6.9     | ✅     |
| CI/CD pipeline                                         | Phase 7.1     | ✅     |
| Container orchestration                                | Phase 7.2     | ✅     |
| Secrets management                                     | Phase 7.3     | ✅     |
| DB backup & disaster recovery                          | Phase 7.4     | ✅     |
| SSL/TLS & domain                                       | Phase 7.5     | ✅     |
| Monitoring stack (Prometheus + Grafana + Alertmanager) | Phase 7.6     | ✅     |

---

## Effort Summary

| Phase                               | Steps | Min (h) | Max (h) |
| :---------------------------------- | :---- | :------ | :------ |
| **7 — Infrastructure & Deployment** | 6     | 2       | 3       |
| **Total remaining**                 | **2** | **2**   | **3**   |

---

## Commit Strategy

Every step above maps to 1–3 atomic commits following this pattern:

```bash
# Example: Step 2.1 — Face controller E2E tests
git add test/face.e2e-spec.ts test/jest-e2e.json
git commit -m "test: add E2E tests for face controller (search, register, embeddings)"

# Example: Step 6.1 — Patient registration UI
git add src/components/face/FaceRegistrationDialog.tsx src/services/api.ts
git commit -m "feat: complete patient registration dialog with form validation"
```

**Rules:**

- Never mix test changes with production code changes in the same commit
- Never mix frontend and backend changes in the same commit (except shared packages)
- Always typecheck before committing: `pnpm typecheck`
- Always push immediately after a successful commit

---

## How to Use This Plan

1. **All 7 phases are complete (7/7).** The roadmap below is fully shipped; use it as a reference for maintenance, re-runs, and new features
2. **Pick a step** — Each step is self-contained and commit-sized
3. **Implement** — Follow the Elite Engineer protocol: research → plan → implement → verify → report
4. **Commit & push** — Use conventional commits, one logical change per commit
5. **Check off** — Update this plan when a step is complete

> **To reassign priority:** Run `grep -n "⬜\|✅" PLAN.md` to see the current status of all steps at a glance.
