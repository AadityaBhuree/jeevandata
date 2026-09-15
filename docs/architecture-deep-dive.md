# Jeevandata — Architectural Deep Dive

This document details the internal technical architecture, data pipelines, security boundaries, and design patterns powering the Jeevandata platform.

---

## 1. System Context & Overview

Jeevandata is designed as a privacy-preserving, contactless patient intake and AI triaging system for clinical environments.

```
                  ┌──────────────────────────────────────────────┐
                  │                 Patient Kiosk                │
                  │   - Next.js 14 PWA                           │
                  │   - MediaPipe Vision (WASM/WebGL)            │
                  │   - WebCrypto (AES-256-GCM) IndexedDB        │
                  └──────────────┬───────────────────────────────┘
                                 │ HTTPS / WSS
                                 ▼
                  ┌──────────────────────────────────────────────┐
                  │                Edge Proxy                    │
                  │   - Caddy 2.9 (Auto TLS / HSTS / CSP)        │
                  │   - Rate Limiting & Proxy Headers            │
                  └──────────────┬───────────────────────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────────────────────┐
                  │             NestJS 10 API Server             │
                  │   - Global JWT Auth & RBAC Guards            │
                  │   - Socket.IO Real-time Gateway              │
                  │   - BullMQ Session Timeout Workers           │
                  └──────┬──────────────┬───────────────┬────────┘
                         │              │               │
        PostgreSQL 16    │     Qdrant   │   Redis 7     │   AI Providers
      ┌──────────────────┴┐  ┌──────────┴┐ ┌────────────┴┐  ┌─────────────┐
      │ Patient Records   │  │ 512-dim   │ │ Pub/Sub     │  │ Gemini 2.0  │
      │ Session FSM State │  │ Face      │ │ BullMQ Jobs │  │ Claude 3.5  │
      │ Clinical Briefs   │  │ Vectors   │ │ Session TTL │  │ Whisper STT │
      │ Audit Logs (HIPAA)│  └───────────┘ └─────────────┘  └─────────────┘
      └───────────────────┘
```

---

## 2. Real-Time Patient Intake Data Flow

### 2.1 Contactless Face Identification Pipeline
1. **Camera Acquisition**: `useCamera` captures a 30 FPS video stream via standard WebRTC `getUserMedia()`.
2. **On-Device Landmark Detection**: Google MediaPipe Face Landmarker analyzes video frames in WebGL/WASM without sending video frames over the network.
3. **Liveness Verification**:
   - Eye Aspect Ratio (EAR) calculates blink frequency:
     $$\text{EAR} = \frac{\|p_2 - p_6\| + \|p_3 - p_5\|}{2 \|p_1 - p_4\|}$$
   - Requires at least two verified blinks within an 8-second window to defeat static photo/screen spoofing.
4. **Normalized Vector Extraction**:
   - 132 key facial landmarks are extracted and centered on the nose bridge.
   - Coordinate features, pairwise distances, and geometric ratios form a 512-dimensional vector.
   - The vector is L2-normalized: $\|\vec{v}\|_2 = 1.0$.
5. **Similarity Search in Qdrant**:
   - Vector is posted to `/face/search`.
   - Qdrant runs cosine distance search with a threshold of $\ge 0.82$.
   - **Privacy Guarantee**: No raw camera images are ever saved or transmitted to permanent storage. Only anonymized numerical vectors are matched.

### 2.2 Conversational AI & Clinical Brief Flow
1. **Session Initialization**:
   - Session created with status `INITIATED` and assigned a timeout worker (BullMQ).
   - Socket.IO connection established with JWT token authentication.
2. **Audio Streaming & STT**:
   - Audio recorded in WebM/Opus slices (250ms chunks).
   - Streamed over WebSockets to Whisper STT for low-latency transcription.
3. **LLM Triaging Engine**:
   - Transcribed text is analyzed by Google Gemini 2.0 Flash (`IntakeAgentService`).
   - If Gemini is degraded or unavailable, the system transparently falls back to Anthropic Claude 3.5 Sonnet.
   - Identifies chief complaints, duration, severity, and critical emergency red flags (e.g., chest pain, shortness of breath).
4. **Clinical Brief Compilation**:
   - Upon intake completion, `BriefGeneratorService` structures symptoms into an SBAR-compliant format (Situation, Background, Assessment, Recommendation).
   - Structured JSON is committed to PostgreSQL and emitted in real-time via `brief:ready` to the Doctor Dashboard.

---

## 3. Multi-Tenancy & Security Isolation

### 3.1 Clinic Scoping Model
- Every patient record, intake session, and staff account belongs to a specific `clinicId`.
- The backend utilizes `@CurrentUser()` parameter decorators and `getClinicFilter()` to automatically enforce tenant scoping across Prisma queries.
- Kiosk endpoints operate on non-sensitive, public discovery flows, while administrative and doctor endpoints strictly require `ADMIN` or `DOCTOR` RBAC claims.

### 3.2 Offline-First Architecture & Encryption
- Kiosks support unstable hospital network environments via IndexedDB (Dexie).
- **Encryption at Rest**:
  - All cached patient data, transcripts, and queued outbox requests are encrypted using WebCrypto `AES-256-GCM` with keys derived via PBKDF2.
- **Idempotent Outbox Replay**:
  - Offline requests carry a unique `Idempotency-Key` header (ULID).
  - When network reconnects, transactions drain sequentially. Re-delivered mutations return cached records without duplicating patient entries.

---

## 4. Disaster Recovery & Observability Architecture

- **PostgreSQL PITR**: Continuous WAL archiving to S3/MinIO enables Point-in-Time Recovery with an RPO $\le 5$ minutes.
- **Metrics & Telemetry**:
  - Prometheus scrapes `/metrics` every 15 seconds.
  - Grafana renders live dashboards for HTTP latency, 5xx error spikes, and face matching response times.
  - Alertmanager routes critical alerts to operations teams via Slack webhooks.
