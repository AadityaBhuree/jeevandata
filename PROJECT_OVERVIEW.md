# Jeevandata — Project Motive & Workflow

> **Full name:** Face Detection & Clinical AI Intake System
> **Directory:** `jeevandata/`
> **Version:** 1.0.0 · **Status:** All 7 phases complete

---

## 1. The Motive — Why This Project Exists

### The problem it solves

In clinics and hospitals, the check-in process is slow, paper-heavy, and wastes
the doctor's most valuable resource: **time with the patient**.

The typical flow today looks like:

```
Patient arrives → queues at reception → fills forms → waits
→ finally sees the doctor → doctor spends the FIRST 5–10 MINUTES
   just asking intake questions (what brings you in? how long? how bad?)
```

That means:

- **Long queues** at reception during peak hours.
- **Doctors lose 30–40% of each consultation** to repetitive intake questions.
- **Critical symptoms can be missed** because nobody screens for emergencies
  before the patient sits down.
- **Friction for returning patients** — they have to re-identify and re-explain
  every visit, even though the clinic already knows them.

### The vision

> **"The patient should be fully triaged BEFORE they walk into the room."**

Jeevandata makes check-in **contactless, automatic, and AI-assisted**:

1. A camera kiosk at the entrance **recognizes the patient by face** — no forms,
   no ID card scanning, no typing your name at a screen.
2. An **AI voice assistant conducts the intake conversation** — "What brings you
   in today? How long has it hurt? On a scale of 1–10…?"
3. The system **screens for emergencies** in real time and flags them instantly.
4. A **structured clinical brief** is ready on the doctor's dashboard before the
   patient enters the room — so the doctor starts the visit already informed.

### Core design principle: Privacy-first

This is a **healthcare** system handling sensitive data. Privacy is not an
afterthought — it is engineered into the architecture:

| Principle                            | How it's enforced                                                                                                    |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| **No raw face images stored**        | Only 512-dimensional normalized numeric vectors are saved — the face image itself is never persisted for recognition |
| **Aadhaar (national ID) protection** | Stored exclusively as SHA-256 hashes, never plaintext                                                                |
| **Consent governance**               | `consentGranted` flag is mandatory before any face vector is registered                                              |
| **Full audit trail**                 | Every patient lookup, face search, and EMR export creates an immutable `AuditLog` entry                              |
| **Offline-first resilience**         | `PmsPatientCache` keeps clinics running through internet outages                                                     |

---

## 2. Who Uses This System

| Role                    | What they get                                                                                                          |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **Patients**            | 10-second contactless check-in + a voice conversation instead of paper forms                                           |
| **Doctors**             | A pre-built clinical brief (chief complaint, risk flags, vitals to check, ICD-10 hints) before the consultation starts |
| **Receptionists**       | Automatic patient identification, no manual re-entry                                                                   |
| **Clinic admins**       | Dashboards, analytics, compliance audit logs                                                                           |
| **Clinic staff (auth)** | Role-based accounts (`RECEPTIONIST` / `DOCTOR` / `ADMIN` / `SYSTEM`) with JWT auth                                     |

---

## 3. The End-to-End Workflow

This is the heart of the product — trace a single patient visit:

```
┌────────────────────────────────────────────────────────────────────┐
│ STEP 1 — ARRIVAL                                                    │
│ Patient walks up to the camera kiosk. The camera feed opens.        │
└──────────────────────────────┬─────────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│ STEP 2 — FACE DETECTION (on-device, in the browser)                │
│ MediaPipe Tasks Vision (WASM/WebGL) analyzes each frame and        │
│ extracts 478 3D facial landmarks — no image ever leaves the device │
└──────────────────────────────┬─────────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│ STEP 3 — LIVENESS CHECK (anti-spoofing)                            │
│ Eye Aspect Ratio (EAR) algorithm verifies the person is a REAL     │
│ human — 2 valid blinks in an 8-second window. Rejects photos,      │
│ videos, and printed images.                                        │
└──────────────────────────────┬─────────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│ STEP 4 — IDENTITY SEARCH                                          │
│ 132 identity landmarks → geometric normalization → 512-dim vector  │
│ → cosine search in Qdrant vector DB (threshold ≥ 0.82)             │
└──────────────────────────────┬─────────────────────────────────────┘
              ┌────────────────┴────────────────┐
              ▼                                 ▼
   ┌──────────────────────┐          ┌──────────────────────────┐
   │ MATCH FOUND          │          │ NO MATCH (NEW PATIENT)   │
   │ "Welcome back,       │          │ Registration dialog:     │
   │  [Name]!" — load     │          │ name, DOB, mobile,       │
   │  patient context     │          │ consent → store vector   │
   └──────────┬───────────┘          └────────────┬─────────────┘
              └───────────────┬───────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│ STEP 5 — AI VOICE INTAKE (the core differentiator)                 │
│ • Patient speaks symptoms into a microphone                        │
│ • Opus audio streams over WebSocket → Whisper STT transcribes      │
│ • Gemini 2.0 Flash conducts an empathetic, one-question-at-a-time  │
│   conversation: chief complaint → onset/duration → severity (1-10) │
│   → associated symptoms → medication/allergy changes               │
│ • EMERGENCY SCREENING: chest pain, severe dyspnea, acute bleeding  │
│   → instantly flagged and escalated                                │
│ • Multi-language: English, Hindi, Marathi, Spanish                 │
└──────────────────────────────┬─────────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│ STEP 6 — CLINICAL BRIEF GENERATION                                │
│ Gemini produces structured JSON:                                   │
│ summary · chiefComplaint · riskFlags · vitalsToCheck ·             │
│ suggestedFollowups · medicationsNote · icd10Hints                 │
└──────────────────────────────┬─────────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│ STEP 7 — DOCTOR READY                                            │
│ Brief saved to PostgreSQL, synced to EMR/PMS (HL7 FHIR / custom)  │
│ → appears on the Doctor Dashboard                                  │
│ → patient walks in, doctor is ALREADY informed                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. System Architecture

```
Browser (Next.js 14 PWA)
  • MediaPipe face landmarks (on-device)
  • EAR liveness detection
  • Camera + microphone (WebRTC)
  • Socket.IO client + Web Audio API
            │  HTTP/REST + WebSocket
            ▼
NestJS Backend (API Gateway)
  ┌──────────┬───────────┬───────────┬───────────┬────────────┐
  │  Face    │    AI     │  Intake   │  Session  │    PMS     │
  │ Module   │  Module   │  Module   │  Gateway  │   Module   │
  │ (Qdrant) │ (Gemini)  │ (Briefs)  │ (Sockets) │ (EMR sync) │
  └────┬─────┴─────┬─────┴─────┬─────┴─────┬─────┴──────┬─────┘
       │           │           │           │            │
       ▼           ▼           ▼           ▼            ▼
   Qdrant     Gemini 2.0   PostgreSQL   Redis 7 +    HL7 FHIR /
   512-dim     Flash       16 + Prisma   BullMQ      Custom API
   vectors                 + Auth (JWT)
```

**Supporting services (docker-compose):** Qdrant (vector search), PostgreSQL
(relational), Redis (cache/queues), MinIO/R2 (object storage), whisper.cpp
(speech-to-text).

### Backend module map (14 modules)

| Module           | Responsibility                                                     |
| :--------------- | :----------------------------------------------------------------- |
| `face/`          | Qdrant vector search, patient registration, embedding upsert       |
| `ai/`            | Gemini intake agent + clinical brief generator (with retry)        |
| `intake/`        | Session records, intake data, brief persistence                    |
| `session/`       | Socket.IO gateway, session FSM, Redis cache, BullMQ timeout worker |
| `pms/`           | EMR/PMS sync via pluggable adapters (HL7 FHIR + custom)            |
| `auth/`          | Register / login / refresh / profile / logout (bcrypt + JWT)       |
| `audit/`         | Compliance audit logging (wired into all PHI-touching services)    |
| `dashboard/`     | Doctor metrics, active sessions, briefs                            |
| `transcription/` | Whisper speech-to-text client                                      |
| `health/`        | `/health`, `/health/ready`, `/health/live`                         |
| `opentelemetry/` | Jaeger tracing instrumentation                                     |
| `api-keys/`      | API key management for external integrations                       |
| `clinics/`       | Multi-tenancy clinic CRUD                                          |
| `analytics/`     | Clinic KPIs — volume, hours, flow, export                          |
| `monitoring/`    | Prometheus metrics, latency percentiles, alert evaluation          |

---

## 5. Key Data Entities

```
Patient (1) ──── (N) FaceEmbedding      ← 512-dim vectors in Qdrant
   │
   ├─── (N) IntakeSession ── (N) SessionTranscript
   │            │
   │            └── (N) IntakeRecord    ← ClinicalBrief JSON
   │
ClinicUser (auth): email, passwordHash, role, clinicId
RefreshToken: SHA-256 hash, expiresAt, revokedAt (rotation)
AuditLog: action, actor, resource, details, ip
PmsPatientCache: offline-first EMR cache
```

---

## 6. Engineering Quality — What's Built Around the Core

| Area              | Status                                                                                                              |
| :---------------- | :------------------------------------------------------------------------------------------------------------------ |
| **Testing**       | 331 backend unit tests + 195 E2E tests (14 suites) + 601 frontend tests (45 files) — 1,127 tests total              |
| **Validation**    | Zod schemas shared across frontend/backend via `shared-schemas`                                                     |
| **Security**      | JWT auth, bcrypt hashing, refresh-token rotation, rate limiting, helmet, env validation fail-fast                   |
| **Observability** | OpenTelemetry/Jaeger tracing, pino structured logging, health checks                                                |
| **UI/UX**         | Design system, dark mode, animations, accessibility (axe-core, keyboard nav), i18n (en/hi/mr/es), PWA mobile camera |
| **Privacy**       | No raw face storage, SHA-256 Aadhaar, mandatory consent, full audit trail                                           |

---

## 7. Current Roadmap Status

| Phase | Title                                                                                                      | Status  |
| :---- | :--------------------------------------------------------------------------------------------------------- | :------ |
| 1     | Emergency repairs (auth infra, validation, rate limits)                                                    | ✅ Done |
| 2     | Testing & validation (unit + E2E + frontend)                                                               | ✅ Done |
| 3     | Backend hardening (PMS sync, audit wiring, OTel, env validation)                                           | ✅ Done |
| 4     | Auth & multi-tenancy (login/register, RBAC, API keys, clinics)                                             | ✅ Done |
| 5     | UI/UX excellence                                                                                           | ✅ Done |
| 6     | Feature expansion (registration UI, mobile, i18n, a11y, admin analytics, HIPAA audit, offline, monitoring) | ✅ Done |
| 7     | Infrastructure & deployment (CI/CD, k8s, secrets, backup/DR, TLS)                                          | ✅ Done |

See **`PLAN.md`** for the detailed step-by-step roadmap.

---

_This document describes what the project does, why it exists, and how data
flows through it. For implementation details, see `PLAN.md`, `readme.md`, and
the module source under `apps/backend/src/modules/`._
