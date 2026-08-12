# TLS / SSL & Domain Setup — Jeevandata (Phase 7.5)

> End-to-end HTTPS for the clinic kiosk. Two supported paths:
> **Caddy** (docker-compose, auto Let's Encrypt — recommended) and
> **cert-manager + ingress-nginx** (Kubernetes). Both deliver the same HSTS,
> CSP and security headers.

---

## 1. The two paths at a glance

|              | Caddy (compose)          | cert-manager (k8s)       |
| ------------ | ------------------------ | ------------------------ |
| Certificates | automatic, Let's Encrypt | automatic, Let's Encrypt |
| Renewal      | built-in (no cron)       | cert-manager controller  |
| Config file  | `caddy/Caddyfile`        | `k8s/ingress.yaml`       |
| Ideal for    | single VM / docker host  | existing cluster         |

Both paths terminate TLS at the edge and pass plain HTTP to the app
containers; the backend sets `trust proxy` so it still sees the real client.

---

## 2. DNS prerequisites (both paths)

Create **A records** pointing at your host's public IP:

```text
app.jeevandata.health   A  203.0.113.10
api.jeevandata.health  A  203.0.113.10
```

- **Apex domain** (`jeevandata.health`) works too — set `APP_DOMAIN` to it
  instead of a subdomain.
- Let's Encrypt requires the domain to resolve **from the public internet**
  to the machine that will answer port 80/443 (HTTP-01 challenge).
- If you only have the backend reachable publicly, use a split setup:
  frontend via a CDN and the API on a subdomain.

---

## 3. Path A — Caddy (docker compose) [recommended]

Caddy obtains, renews, and reloads Let's Encrypt certs itself — no cron, no
certbot, no kube config.

### 3.1 Environment variables

Add to your `.env` (next to `docker-compose.yml`):

```env
APP_DOMAIN=app.jeevandata.health
API_DOMAIN=api.jeevandata.health
# Optional: receive expiry notices; leave empty if unsure
ACME_EMAIL=you@example.com
# Set true only while testing to avoid LE rate limits (certs will be untrusted)
CADDY_STAGING=false
```

### 3.2 Bring it up

```bash
docker compose -f docker-compose.yml -f docker-compose.app.yml \
```

Caddy listens on 80/443, redirects HTTP→HTTPS, and proxies:

```text
https://app.jeevandata.health  ->  frontend:3000
https://api.jeevandata.health  ->  backend:4000
```

### 3.3 Verify

```bash
curl -sI https://app.jeevandata.health | grep -i 'strict-transport\|content-security'
curl -s https://api.jeevandata.health/health  # 200
```

Then check the cert with [SSL Labs](https://www.ssllabs.com/ssltest/) or:

```bash
echo | openssl s_client -servername app.jeevandata.health -connect app.jeevandata.health:443 2>/dev/null | openssl x509 -noout -issuer -enddate
```

### 3.4 Local testing (self-signed, no DNS)

```bash
# hosts file (C:\Windows\System32\drivers\etc\hosts on Windows)
# 127.0.0.1  app.jeevandata.local api.jeevandata.local

docker compose -f docker-compose.yml -f docker-compose.app.yml \
  -f docker-compose.tls.local.yml up -d
```

This uses `caddy/Caddyfile.local` + an internal CA (`local_certs`). The
browser warning is expected. To trust it, import the generated root CA into
your OS trust store:

```text
./data/caddy/pki/authorities/local/root.crt
```

---

## 4. Path B — cert-manager + ingress-nginx (Kubernetes)

### 4.1 Prerequisites

```bash
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager --namespace cert-manager \
  --create-namespace --set installCRDs=true
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.allowSnippetAnnotations=true   # required for security headers
```

### 4.2 ClusterIssuer

```yaml
# k8s/letsencrypt-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: you@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

```bash
kubectl apply -f k8s/letsencrypt-issuer.yaml
```

### 4.3 The Ingress

`k8s/ingress.yaml` already carries the `letsencrypt-prod` ClusterIssuer
annotation plus HSTS/CSP/security headers via `configuration-snippet`.
Replace `jeevandata.example.com` with your real domains and apply:

```bash
kubectl apply -f k8s/ingress.yaml
kubectl get certificate   # cert should become Ready within a minute or two
```

---

## 5. Headers applied at the edge

| Header                      | Value                                                         | Why                                  |
| --------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`                         | force HTTPS for a year               |
| `Content-Security-Policy`   | kiosk-tailored (`self`, blob:, wss:, camera)                  | camera/mic + WASM workers still work |
| `X-Content-Type-Options`    | `nosniff`                                                     | no MIME sniffing                     |
| `X-Frame-Options`           | `DENY`                                                        | no clickjacking                      |
| `Referrer-Policy`           | `strict-origin-when-cross-origin` (app) / `no-referrer` (api) | leak nothing sensitive               |
| `Permissions-Policy`        | `camera=(self), microphone=(self)`                            | limit browser feature use            |
| `-Server`                   | (removed)                                                     | hide Caddy version banner            |

The backend also sets helmet HSTS itself (`apps/backend/src/main.ts`) for
any deployment that exposes the API directly. `trust proxy` is **opt-in**
(`TRUST_PROXY=1` env) so a directly-exposed API never trusts spoofable
`X-Forwarded-For`; set it when serving behind Caddy/nginx.

> **Path difference:** the Caddy API block deliberately omits CSP (JSON API),
> while the k8s ingress applies the same CSP to both hosts because they share
> one Ingress. Swagger UI renders fine under it (inline scripts allowed).

---

## 6. CORS

The API CORS whitelist is already env-driven (`CORS_ORIGINS` in
`apps/backend/src/main.ts`). With TLS:

```env
CORS_ORIGINS=https://app.jeevandata.health
```

Note the **scheme change** — `http://localhost:3000` will not match once the
app is served over HTTPS. Include both when running mixed local + prod:

```env
CORS_ORIGINS=http://localhost:3000,https://app.jeevandata.health
```

---

## 7. Troubleshooting

| Symptom                           | Likely cause / fix                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Cert never issues (Caddy)         | DNS not publicly resolvable; port 80 blocked by firewall; set `CADDY_STAGING=true` first to rule out rate limits |
| Cert never issues (cert-manager)  | ClusterIssuer missing, or `allowSnippetAnnotations` off for the snippet                                          |
| Browser warns self-signed locally | expected — trust `data/caddy/pki/authorities/local/root.crt`                                                     |
| Mixed content on kiosk page       | camera/mic require a secure context; serve everything over HTTPS (or localhost)                                  |
| API returns wrong client IP       | backend `trust proxy` missing — verify `app.set('trust proxy', 1)` in `main.ts`                                  |
| HSTS not visible                  | browsers cache HSTS; use an incognito window or `curl -I` to verify raw                                          |

---

## 8. Renewal & monitoring

- **Caddy**: automatic. Watch `docker logs jeevandata-caddy` for renewal
  warnings ~30 days before expiry.
- **cert-manager**: automatic. `kubectl get certificates -A` shows expiry.
- Set a Prometheus alert on `certificate_expiration` if using kube-prometheus.

---

## 9. Local end-to-end demo — the real app behind the edge

Verified full-stack bring-up: the **real** backend + frontend containers behind
the local self-signed Caddy edge, with Postgres, Redis, Qdrant and MinIO as
dependencies. Exercised end-to-end (build → boot → HTTPS → headers → API calls
through the proxy) and reproducible on a dev machine with Docker Desktop.

**What it proves:** the same TLS/security-header path production traffic will
take — only the certificate is self-signed instead of Let's Encrypt.

### 9.1 Prerequisites

- Docker Desktop running (`docker info` responds)
- Hosts entries so the browser can resolve the vhosts (admin shell):

  ```bash
  echo "127.0.0.1 app.jeevandata.local api.jeevandata.local" >> /c/Windows/System32/drivers/etc/hosts
  ```

  No hosts file? Use `curl --resolve <host>:443:127.0.0.1` instead (see 9.5).

### 9.2 Generate the root `.env`

`docker-compose.app.yml` loads a root `.env` (gitignored). The backend needs
**container hostnames**, not `localhost` — start from your `apps/backend/.env`
values and rewrite the URL hosts:

```env
DATABASE_URL=postgresql://jeevandata:jeevandata_secret@jeevandata-postgres:5432/jeevandata?schema=public
REDIS_URL=redis://default:redis_secret@jeevandata-redis:6379
QDRANT_URL=http://jeevandata-qdrant:6333
R2_ENDPOINT=http://jeevandata-minio:9000
WHISPER_API_URL=http://jeevandata-whisper:9001/inference
FRONTEND_URL=https://app.jeevandata.local
BACKEND_URL=https://api.jeevandata.local
CORS_ORIGINS=https://app.jeevandata.local,http://localhost:3000
TRUST_PROXY=1
```

> **NODE_ENV:** `docker-compose.app.yml` forces `NODE_ENV=production`, and the
> backend's Zod validation then _requires_ a real `GOOGLE_GEMINI_API_KEY` (it
> refuses to boot without one). For a local demo with no key, override to
> development with a small extra compose file (keep it untracked, e.g.
> `/tmp/local-dev.yml`):
>
> ```yaml
> services:
>   backend:
>     environment:
>       NODE_ENV: development
>       SWAGGER_ENABLED: 'true'
> ```

### 9.3 Build the images

Tag with the GHCR names `docker-compose.app.yml` expects, so compose uses the
local builds instead of pulling:

```bash
docker build -f Dockerfile.backend -t ghcr.io/aadityabhuree/jeevandata/backend:latest .
docker build -f Dockerfile.frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://api.jeevandata.local \
  --build-arg NEXT_PUBLIC_WS_URL=wss://api.jeevandata.local \
  -t ghcr.io/aadityabhuree/jeevandata/frontend:latest .
```

`NEXT_PUBLIC_*` values are baked into the client bundle at build time — they
must match the edge URLs the browser will call. (`NEXT_PUBLIC_WS_URL` is wss://
because Caddy proxies the WebSocket upgrade through TLS.)

### 9.4 Bring it up

Target the services explicitly — whisper and the monitoring/backup stack stay
down unless wanted:

```bash
docker compose -f docker-compose.yml -f docker-compose.app.yml \
  -f docker-compose.tls.yml -f docker-compose.tls.local.yml \
  -f /tmp/local-dev.yml up -d \
  postgres redis qdrant minio minio-init backend frontend caddy
```

Wait until the backend answers `/health/live` and Caddy reports `healthy`
(its probe hits the admin API — enabled via `admin localhost:2019` in both
Caddyfiles because Caddy 2.9 ships it disabled; the probe uses `127.0.0.1`
since the container's busybox `wget` resolves `localhost` to `::1`, which
nothing listens on).

### 9.5 Verify (curl — no hosts file needed)

```bash
# Frontend over HTTPS (expect 200 + CSP/nosniff/DENY/referrer/permissions)
curl -skI https://app.jeevandata.local --resolve app.jeevandata.local:443:127.0.0.1

# API live + headers (expect HSTS 1y, nosniff, DENY, no-referrer)
curl -sk https://api.jeevandata.local/health/live --resolve api.jeevandata.local:443:127.0.0.1

# Readiness — whisper reports unhealthy unless it is also up (expected: 503)
curl -sk https://api.jeevandata.local/health/ready --resolve api.jeevandata.local:443:127.0.0.1

# HTTP -> HTTPS redirect (expect 308)
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  http://app.jeevandata.local --resolve app.jeevandata.local:80:127.0.0.1

# Cert issuer (expect: CN=Caddy Local Authority - ECC Intermediate)
echo | openssl s_client -connect 127.0.0.1:443 -servername api.jeevandata.local 2>/dev/null | grep issuer

# Full API round-trip through the proxy (auth reaches Postgres; 401 for
# unknown users is correct — the point is the request path works over TLS)
curl -sk -X POST https://api.jeevandata.local/auth/login \
  --resolve api.jeevandata.local:443:127.0.0.1 \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@jeevandata.local","password":"admin"}'
```

In a browser (hosts file in place): open `https://app.jeevandata.local`, accept
the self-signed warning (or trust `data/caddy/pki/authorities/local/root.crt`
once) and walk the kiosk.

### 9.6 Tear down

```bash
docker compose -f docker-compose.yml -f docker-compose.app.yml \
  -f docker-compose.tls.yml -f docker-compose.tls.local.yml down -v
```

`-v` also drops the compose volumes — omit it to keep data for the next run.

### 9.7 Gotchas verified along the way

- **Caddy 2.9 admin API is disabled by default** — the compose healthcheck
  needs `admin localhost:2019` in the Caddyfile global block (both files now
  set it).
- **Healthcheck IPv6 trap** — busybox `wget localhost:2019` resolves to `::1`
  and fails; the committed healthcheck uses `http://127.0.0.1:2019/config/`.
- **No `.dockerignore` before this session** — the build context dragged local
  `node_modules`/`.next`/`.git`; a `.dockerignore` is now committed.
- **Production-mode env validation** — `GOOGLE_GEMINI_API_KEY` (and the other
  AI keys) must be real when `NODE_ENV=production`; the backend refuses to
  boot otherwise. Local demo: `NODE_ENV=development` override.
