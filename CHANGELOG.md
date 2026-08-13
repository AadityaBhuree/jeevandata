# Changelog — Jeevandata

All notable changes are documented here, grouped by roadmap phase. Jeevandata
is an AI-powered clinic intake system: a kiosk recognizes patients by face,
an AI voice assistant interviews them, and a clinical brief is generated for
the doctor before the consultation.

## [1.0.0] — 2026-08

**All 7 roadmap phases complete.** 428+ commits, 1,127 tests (331 backend
unit + 195 backend E2E + 601 frontend), no open bugs.

### Phase 1 — Emergency Repairs

- Authentication infrastructure (bcrypt + JWT access/refresh rotation)
- Shared Zod validation schemas (`shared-schemas`) with fail-fast env validation
- Rate limiting (Throttler), security headers (helmet), health endpoints

### Phase 2 — Testing & Validation

- 195 E2E tests across all controllers (face, intake, AI, dashboard, PMS, health)
- Full backend unit suite (331 tests) + frontend Vitest suite (601 tests)
- Coverage reporting and regression tests for the session FSM

### Phase 3 — Backend Production Hardening

- PMS/EMR sync module (HL7 FHIR + custom API adapters, retry, caching)
- Audit logging wired into every PHI-touching service
- OpenTelemetry/Jaeger tracing, Prometheus metrics, Alertmanager
- Zod env validation on boot; `lib/env.ts` for frontend public vars

### Phase 4 — Authentication & Multi-Tenancy

- Register / login / refresh / profile / logout endpoints
- Role-based access control (ADMIN, SYSTEM, DOCTOR, RECEPTIONIST)
- API-key auth for external integrations, clinic multi-tenancy CRUD
- Frontend login UI with protected routes and role gating

### Phase 5 — UI/UX Excellence

- Design system, dark mode, animations, accessibility (axe-core, keyboard nav)
- i18n in English, Hindi, Marathi, and Spanish; PWA mobile camera support
- Offline mode with IndexedDB sync (PHI-encrypted cache, mutation outbox)

### Phase 6 — Feature Expansion

- Face registration + match kiosk flow, voice intake with live transcription
- Admin analytics dashboard (clinic KPIs), HIPAA audit module
- Monitoring stack: Prometheus, Grafana dashboards, Alertmanager, backup service

### Phase 7 — Infrastructure & Deployment

- GitHub Actions CI/CD (lint, typecheck, test --coverage, build, deploy)
- Kubernetes manifests (probes, HPA, Ingress + TLS)
- Secrets management (`validate-secrets.sh`), disaster-recovery docs
- Caddy TLS edge with HSTS/CSP, automated backups to MinIO/R2

[1.0.0]: https://github.com/AadityaBhuree/jeevandata/releases/tag/v1.0.0
