# JyotishConnect Deployment Guide

## Option A: Railway (Recommended — zero-config)

Railway auto-detects Node.js and deploys from git. No Dockerfile required.

### One-time setup

1. Create a Railway account at railway.app
2. Create a new project → "Deploy from GitHub repo"
3. Select this repository

### Set Railway environment variables

In Railway dashboard → Variables, add all vars from `backend/api/.env.example`:

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
ALLOWED_ORIGINS=https://your-flutter-web-app.com
```

### Add `RAILWAY_TOKEN` to GitHub Secrets

1. Railway dashboard → Account Settings → Tokens → Create token
2. GitHub repo → Settings → Secrets → New secret: `RAILWAY_TOKEN`

The `.github/workflows/deploy.yml` auto-deploys on every push to `main` that touches `backend/api/`.

### Verify deployment

```bash
curl https://your-railway-app.up.railway.app/health
# → {"status":"ok","db":"connected","uptime":...}
```

### Bootstrap first admin

```bash
curl -X POST https://your-railway-app.up.railway.app/admin/seed \
  -H "Content-Type: application/json" \
  -H "x-seed-secret: $ADMIN_SEED_SECRET" \
  -d '{"email":"admin@example.com","password":"securepassword123"}'
```

### Set up Razorpay webhook

In Razorpay dashboard → Webhooks:
- URL: `https://your-railway-app.up.railway.app/webhook/razorpay`
- Events: `payment.captured`
- Secret: matches `RAZORPAY_WEBHOOK_SECRET`

### Set up cleanup cron

Railway Cron jobs or use an external cron service (cron-job.org):
- URL: `POST https://your-railway-app.up.railway.app/call/cleanup`
- Header: `x-cleanup-secret: $CLEANUP_SECRET`
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
# Upload to Netlify, Vercel, or Firebase Hosting
# Update ALLOWED_ORIGINS in Railway/docker to include the hosting URL
```

---

## Post-Deploy Checklist

- [ ] `GET /health` returns `{"status":"ok","db":"connected"}`
- [ ] `POST /admin/seed` creates first admin user
- [ ] Seeker registration + login works
- [ ] Astrologer registration + login works
- [ ] Call start → Agora channel token returned (not null)
- [ ] Razorpay webhook verified (test via Razorpay dashboard → Test webhook)
- [ ] Cleanup cron fires every 5 min (check Railway logs)
- [ ] Flutter web app points to prod API URL
- [ ] CORS allows Flutter web origin
