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
any deployment that exposes the API directly, and `trust proxy` so
`req.ip`/`req.protocol` stay correct behind the edge.

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
