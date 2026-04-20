# JyotishConnect Deployment Guide

## Option A: Render (Recommended — free tier available)

Render auto-detects Node.js from `render.yaml` and deploys from git.

### One-time setup

1. Create a Render account at render.com
2. New → Web Service → "Build and deploy from a Git repository"
3. Connect this GitHub repo — Render reads `render.yaml` automatically

### Set environment variables

In Render dashboard → your service → Environment, add:

```
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_publishable_key
JWT_SECRET=<generate: openssl rand -hex 48>
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
CLEANUP_SECRET=<generate: openssl rand -hex 32>
ADMIN_SEED_SECRET=<generate: openssl rand -hex 32>
ALLOWED_ORIGINS=https://your-flutter-app.netlify.app
```

> **Free tier note:** The free plan spins down after 15 min of inactivity (cold start ~30s).
> Upgrade to Starter ($7/mo) for always-on with no spin-down.

### Add `RENDER_DEPLOY_HOOK_URL` to GitHub Secrets

Render dashboard → your service → Settings → Deploy Hook → copy the URL.

GitHub repo → Settings → Secrets → Actions → New secret:
- Name: `RENDER_DEPLOY_HOOK_URL`
- Value: the deploy hook URL from Render

The `.github/workflows/deploy.yml` triggers this hook on every push to `main` that touches `backend/api/`.

### Verify deployment

```bash
curl https://your-app.onrender.com/health
# → {"status":"ok","db":"connected","uptime":...}
```

### Bootstrap first admin

```bash
curl -X POST https://your-app.onrender.com/admin/seed \
  -H "Content-Type: application/json" \
  -H "x-seed-secret: $ADMIN_SEED_SECRET" \
  -d '{"email":"admin@example.com","password":"securepassword123"}'
```

### Set up Razorpay webhook

In Razorpay dashboard → Webhooks:
- URL: `https://your-app.onrender.com/webhook/razorpay`
- Events: `payment.captured`
- Secret: matches `RAZORPAY_WEBHOOK_SECRET`

### Set up cleanup cron (cron-job.org — free)

1. Sign up at cron-job.org
2. New cronjob:
   - URL: `https://your-app.onrender.com/call/cleanup`
   - Method: POST
   - Header: `x-cleanup-secret: <your CLEANUP_SECRET>`
   - Schedule: every 5 minutes

---

## Option B: Docker Compose (VPS / bare metal)

```bash
# 1. Clone repo and enter directory
git clone <repo-url> && cd vedic-caller

# 2. Copy and fill in env vars
cp backend/api/.env.example backend/api/.env
# Edit backend/api/.env — set SUPABASE_URL, SUPABASE_KEY, JWT_SECRET, etc.

# 3. Export vars for docker-compose
export $(grep -v '^#' backend/api/.env | xargs)

# 4. Start services (db + api + cleanup cron)
docker compose up -d

# 5. With nginx TLS (production only):
# First obtain certs: certbot certonly --standalone -d yourdomain.com
# Then:
docker compose --profile production up -d

# 6. Check health
curl http://localhost:3000/health
```

### Apply database migrations to Supabase

```bash
# If using Supabase cloud (recommended):
supabase db push

# If using local Postgres from docker compose:
for f in supabase/migrations/*.sql; do
  docker compose exec db psql -U postgres jyotish -f /migrations/$(basename $f)
done
```

---

## Flutter Web Build

```bash
cd apps/mobile
flutter build web --release

# Serve static files from build/web/
# Upload to Netlify, Vercel, or Render Static Site (all free)
# Update ALLOWED_ORIGINS in Render/docker to include the hosting URL
```

---

## Post-Deploy Checklist

- [ ] `GET /health` returns `{"status":"ok","db":"connected"}`
- [ ] `POST /admin/seed` creates first admin user
- [ ] Seeker registration + login works
- [ ] Astrologer registration + login works
- [ ] Call start → Agora channel token returned (not null)
- [ ] Razorpay webhook verified (test via Razorpay dashboard → Test webhook)
- [ ] Cleanup cron fires every 5 min (check Render logs)
- [ ] Flutter web app points to prod API URL
- [ ] CORS allows Flutter web origin
