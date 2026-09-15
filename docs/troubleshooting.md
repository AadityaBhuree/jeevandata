# Jeevandata — Troubleshooting & Diagnostics Guide

This guide covers common issues, failure modes, and debugging workflows when running, developing, or testing Jeevandata across both local and containerized environments.

---

## 1. Quick Diagnostics Cheat Sheet

| Diagnostic Need | Command / URL | What It Verifies |
|---|---|---|
| **API Health & Dependencies** | `curl -i http://localhost:4000/health/ready` | Checks Postgres, Redis, and Qdrant readiness |
| **API Liveness** | `curl -i http://localhost:4000/health/live` | Confirms HTTP process is responsive |
| **Prometheus Metrics** | `curl http://localhost:4000/metrics` | Confirms metrics scraping and counter states |
| **Browser E2E Journey** | `pnpm verify:browser` | Headless Chrome automated kiosk check-in audit |
| **Docker Service Status** | `docker compose ps` | Confirms all containers are healthy |
| **Secret Hygiene** | `./scripts/validate-secrets.sh .env` | Validates environment configuration keys |

---

## 2. Frontend & Camera Issues

### 2.1 "Camera not accessible" or `NotAllowedError`
- **Symptom**: Kiosk displays "Camera unavailable" or permission prompt is denied.
- **Root Causes**:
  - Browser blocked camera permissions for `http://localhost:3000`.
  - Another application (e.g. Zoom, Teams) holds an exclusive lock on the camera device.
  - HTTPS is required by the browser when running on non-localhost domains or IPs.
- **Resolution**:
  - Open Chrome Site Settings (`chrome://settings/content/camera`) and ensure `localhost` is allowed.
  - When testing across the local network (e.g. tablet or mobile device), use Caddy TLS (`pnpm docker:tls:local` or `https://localhost:8443`) because WebRTC `getUserMedia()` requires a Secure Context (`HTTPS` or `localhost`).

### 2.2 MediaPipe FaceLandmarker WASM Download Failure
- **Symptom**: Console error `Failed to fetch face_landmarker.task` or stuck on "Loading AI vision models...".
- **Root Causes**:
  - Network timeout when fetching the Google CDN MediaPipe bundle.
  - Content Security Policy (CSP) blocking external WASM/binary fetches.
- **Resolution**:
  - Verify internet connectivity or proxy settings.
  - Check `next.config.js` or Caddy CSP headers: ensure `connect-src` allows `cdn.jsdelivr.net` and `storage.googleapis.com`.
  - For offline kiosks, ensure pre-bundled MediaPipe task models in `public/models/` are accessible directly via HTTP 200.

### 2.3 Hydration Mismatch Warnings
- **Symptom**: React warning during initial load: `Text content does not match server-rendered HTML`.
- **Root Causes**:
  - LocalStorage or client-side theme/language state reading synchronously during SSR before hydration completes.
- **Resolution**:
  - Wrap client-only reads in `useEffect()` or use the `useMounted()` hook pattern to delay rendering until client hydration settles.

---

## 3. Backend & Database Issues

### 3.1 PostgreSQL Connection Refused / Migration Errors
- **Symptom**: `PrismaClientInitializationError: Can't reach database server at localhost:5432`.
- **Root Causes**:
  - Local PostgreSQL service already running on host port `5432`, colliding with Docker's mapped port.
  - Docker container not yet in healthy state.
- **Resolution**:
  - Verify container status: `docker compose ps postgres`.
  - Check for port collisions: `netstat -ano | findstr :5432` (Windows) or `lsof -i :5432` (Linux/macOS).
  - Re-run migrations: `pnpm db:migrate`.

### 3.2 Qdrant Vector Search Connectivity or Collection Missing
- **Symptom**: `FaceService` errors with `Collection 'patient_faces' does not exist` or connection timeout on port `6333`.
- **Root Causes**:
  - Qdrant container is initializing or collection was dropped.
- **Resolution**:
  - Test Qdrant directly: `curl http://localhost:6333/collections`.
  - Restart Qdrant: `docker compose restart qdrant`.
  - Collection is automatically initialized on application bootstrap; check backend logs for `[FaceService] Qdrant collection verified`.

### 3.3 Redis & BullMQ Session Stalling
- **Symptom**: Session timeouts not triggering or background workers failing to process queue jobs.
- **Root Causes**:
  - Redis memory limit reached or connection dropped.
- **Resolution**:
  - Check Redis ping: `docker compose exec redis redis-cli ping` (should return `PONG`).
  - Inspect BullMQ queues: visit Redis Commander at `http://localhost:8081` to view stalled jobs and error traces.

---

## 4. Voice Intake & AI Integration

### 4.1 Gemini API Key Invalid or Rate Limited
- **Symptom**: `500 Internal Server Error` during AI turn generation, logs show `RESOURCE_EXHAUSTED` or `API_KEY_INVALID`.
- **Resolution**:
  - Verify your `GEMINI_API_KEY` in `.env`.
  - Test the fallback mechanism: If `ANTHROPIC_API_KEY` is configured, Jeevandata automatically degrades to Claude 3.5 Sonnet when Gemini experiences rate limiting or outages.
  - If both APIs fail, the system activates the rule-based fallback intake agent to prevent patient session blocking.

### 4.2 Whisper STT Transcription Latency or Failure
- **Symptom**: Audio chunks sent over WebSocket, but no transcript returns.
- **Resolution**:
  - Check Whisper service: `docker compose ps whisper`.
  - In local development without Whisper container resources, verify that client-side Web Speech API or backend mocked transcription is active.

---

## 5. Security & TLS Triage

### 5.1 Self-Signed Certificate Warnings in Local Caddy Mode
- **Symptom**: Browser displays `NET::ERR_CERT_AUTHORITY_INVALID` when visiting `https://localhost:8443`.
- **Resolution**:
  - Export the Caddy local root CA: `docker compose -f docker-compose.tls.local.yml exec caddy cat /data/caddy/pki/authorities/local/root.crt > caddy-root.crt`.
  - Import `caddy-root.crt` into your operating system's Trusted Root Certification Authorities store.
  - Refer to [docs/tls-setup.md](tls-setup.md) for step-by-step certificate trust commands.
