# Contributing to Jeevandata

Thank you for your interest in contributing to **Jeevandata** — an enterprise-grade, privacy-first, AI-driven contactless patient intake and face-recognition platform for healthcare clinics.

---

## 1. Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment. All contributors and participants are expected to maintain professional conduct, prioritize patient data privacy and safety, and adhere to healthcare compliance standards (HIPAA, FHIR, and local digital health regulations).

---

## 2. Prerequisites & Environment

Before you begin, ensure your local development machine has:

- **Node.js**: `v20.x` or higher (LTS recommended)
- **Package Manager**: `pnpm` `v9.15.4` or higher (`corepack enable` or `npm i -g pnpm`)
- **Docker & Docker Compose**: Docker Desktop with Compose v2
- **Git**: Configured with your developer signature
- **Browser**: Google Chrome or Chromium (required for WebRTC camera testing and CDP journey verification)

---

## 3. Local Development Setup

### 3.1 Clone & Install

```bash
git clone https://github.com/AadityaBhuree/jeevandata.git
cd jeevandata
pnpm install
```

### 3.2 Environment Configuration

Copy the example environment files:

```bash
cp .env.example .env
cp .env.example .env.docker
```

Edit `.env` to supply local credentials. Development default fallback values are provided for non-sensitive local testing.

### 3.3 Start Infrastructure Services

Start the core backing services (PostgreSQL, Redis, Qdrant, MinIO, Whisper, Prometheus, Grafana):

```bash
# Start all local dev services in Docker
pnpm docker:dev

# Run database migrations and seed data
pnpm db:migrate
pnpm db:seed
```

### 3.4 Launch Applications

```bash
# Start frontend and backend in concurrent development mode
pnpm dev
```

- **Frontend (Next.js)**: `http://localhost:3000`
- **Backend (NestJS API)**: `http://localhost:4000`
- **Swagger Documentation**: `http://localhost:4000/api/docs`
- **Grafana Dashboards**: `http://localhost:3001`
- **Prometheus**: `http://localhost:9090`
- **Qdrant Console**: `http://localhost:6333/dashboard`

---

## 4. Repository Structure

This repository is organized as a Turborepo monorepo:

```
jeevandata/
├── apps/
│   ├── backend/          # NestJS 10 API, Prisma ORM, WebSockets, AI orchestration
│   └── frontend/         # Next.js 14 (App Router), Tailwind CSS, MediaPipe vision
├── packages/
│   ├── shared-schemas/   # Zod validation schemas across client and server
│   ├── shared-types/     # Shared TypeScript interfaces, types, and enums
│   └── shared-utils/     # Common helper functions (crypto, hashing, math)
├── monitoring/           # Prometheus alerts, scrape config, Grafana dashboards
├── k8s/                  # Kubernetes deployments, services, HPA, ingress
├── docs/                 # Operational runbooks (DR, secrets, TLS, architecture)
└── scripts/              # Verification, backup, secret validation, journey scripts
```

---

## 5. Development Workflow & Guidelines

### 5.1 Branching Strategy

- `main`: Production-ready branch. All changes are merged through tested and reviewed Pull Requests.
- Feature branches: `feat/<feature-name>`, `fix/<issue-name>`, `docs/<topic>`, `chore/<task>`.

### 5.2 Commit Conventions

All commits follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new user-facing feature or enhancement
- `fix:` A bug fix
- `test:` Adding or correcting tests
- `docs:` Documentation updates or new guides
- `style:` Formatting, missing semicolons, etc. (no production code change)
- `refactor:` Code restructuring without behavioral changes
- `chore:` Dependency updates, tooling, configuration
- `perf:` Performance improvements

**Rules:**
1. Atomic commits: Each commit should represent one logical change.
2. Separate test and production changes when possible.
3. Keep frontend and backend changes in distinct commits unless touching shared packages.

### 5.3 Code Quality & Testing

Before creating a commit or submitting a Pull Request, run the full verification pipeline:

```bash
# 1. Typecheck all packages and apps
pnpm typecheck

# 2. Lint and format checks
pnpm lint
pnpm format:check

# 3. Backend unit and integration tests
pnpm --filter @jeevandata/backend test

# 4. Frontend unit tests
pnpm --filter @jeevandata/frontend test

# 5. Automated headless browser journey verification
pnpm verify:browser
```

---

## 6. Security & Privacy Rules

When working on Jeevandata, keep these healthcare safety principles in mind:

- **Never store raw facial images**: Store only normalized numerical vector embeddings in Qdrant.
- **PHI Protection**: Personal Health Information must never be logged in plaintext, committed to Git, or exposed in client bundles.
- **Offline Data**: Data cached in IndexedDB must be encrypted using AES-256-GCM with non-extractable keys (`services/crypto.ts`).
- **Secrets**: Never commit `.env` or credential files. Use `scripts/validate-secrets.sh` to check secrets hygiene.

---

## 7. Submitting Pull Requests

1. Ensure all CI checks (typecheck, lint, tests) pass locally.
2. Provide a descriptive PR title following conventional commit naming.
3. In the PR description, explain:
   - What changed and why.
   - Any manual or automated verification performed.
   - Reference any related issues.
