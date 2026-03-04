# Mexxie Prism — Docker Deployment Guide

Two modes are covered:
- **Local** — replace your manual `node server.js` + QuestDB launch with one command
- **Cloud** — deploy to a $6/mo DigitalOcean droplet with full HTTPS

---

## Mode 1: Local Development (Docker Desktop)

Replaces having to manually start QuestDB and the API server separately.

### Prerequisites
- Docker Desktop installed (you already have this ✅)
- Project cloned locally

### Start everything

```bash
# From the project root:
docker compose up
```

This starts:
- **QuestDB** on `http://localhost:9000` (web console + REST API)
- **mexxie-api** on `http://localhost:3001`

### First-time data setup

```bash
# With containers running, seed the QuestDB tables:
docker exec mexxie-api node seed.js

# Or run your existing sync script to push QuestDB → Cloud:
node mexxie-api/scripts/sync-to-cloud.js
```

### Common commands

```bash
docker compose up -d          # Start in background
docker compose down           # Stop containers (data preserved)
docker compose down -v        # Stop + WIPE all QuestDB data (full reset)
docker compose logs -f        # Follow all logs
docker compose logs mexxie-api -f  # API logs only

# Open a shell inside the API container:
docker exec -it mexxie-api sh

# Query QuestDB directly:
curl "http://localhost:9000/exec?query=SELECT+count()+FROM+prism_stock_universe"
```

### Verify it's working

```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok","db":true,"env":"local"}

curl http://localhost:3001/api/stocks | head -c 200
# Expected: array of stock objects
```

---

## Mode 2: Cloud Deployment (DigitalOcean + HTTPS)

### Step 1 — Create a Droplet

1. Go to [digitalocean.com](https://digitalocean.com)
2. Create → Droplet
3. Choose: **Ubuntu 24.04 LTS**, **Basic**, **$6/mo (1 vCPU, 1GB RAM)**
4. Add your SSH key
5. Note the IP address (e.g. `143.198.12.34`)

> **$6/mo** handles the full stack: QuestDB + API + Nginx + your stock data.
> Upgrade to $12/mo (2GB RAM) if you plan to store 3,000+ stocks with full history.

### Step 2 — Point a domain to the VM

In your domain registrar's DNS settings, add:
```
A    mexxie.yourdomain.com    →    143.198.12.34
```

Wait 5–10 minutes for DNS to propagate.

### Step 3 — Set up the VM

```bash
# SSH into the droplet:
ssh root@143.198.12.34

# Install Docker:
curl -fsSL https://get.docker.com | sh

# Verify:
docker --version && docker compose version
```

### Step 4 — Copy the project to the VM

From your **laptop**:
```bash
# Copy project files (excluding node_modules, .git, certs):
rsync -av --exclude='node_modules' --exclude='.git' --exclude='certs' \
  "/Users/mexx/Desktop/Mexxie Ultimate Stock App built by Claude AI /Current Production/" \
  root@143.198.12.34:/opt/mexxie/
```

### Step 5 — Configure environment

On the **VM**:
```bash
cd /opt/mexxie

# Create env file from template:
cp .env.example .env.prod

# Edit it (add API keys if you want server-side refresh):
nano .env.prod
```

### Step 6 — Configure your domain in nginx.conf

On the **VM**, edit `nginx.conf`:
```bash
nano /opt/mexxie/nginx.conf

# Replace every instance of YOUR_DOMAIN with your actual domain:
# e.g. mexxie.yourdomain.com
```

### Step 7 — Get SSL certificate (Let's Encrypt, free)

```bash
cd /opt/mexxie

# Start nginx temporarily on port 80 (for ACME challenge):
docker compose -f docker-compose.prod.yml up nginx -d

# Get certificate:
docker compose -f docker-compose.prod.yml run --rm --no-deps certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --email you@youremail.com --agree-tos --no-eff-email \
  -d mexxie.yourdomain.com

# Stop nginx (restart will pick up the cert):
docker compose -f docker-compose.prod.yml stop nginx
```

### Step 8 — Start everything

```bash
cd /opt/mexxie
docker compose -f docker-compose.prod.yml up -d
```

### Step 9 — Verify

```bash
# Check all containers are running:
docker compose -f docker-compose.prod.yml ps

# Test API health:
curl https://mexxie.yourdomain.com/api/health
# Expected: {"status":"ok","db":true,"env":"cloud"}  ← note: uses QuestDB in this setup

# Test stocks:
curl https://mexxie.yourdomain.com/api/stocks/count
```

### Step 10 — Connect the app

1. Open `https://christophergayle.github.io/kubora/mexxie_prism.html`
2. Go to ⚙️ Settings → API Server
3. Enter: `https://mexxie.yourdomain.com`
4. Click ✓ Save → verify "✅ Connected · X stocks"

---

## Syncing QuestDB Data to the Cloud VM

Once the VM is running, you can push your full QuestDB universe from your laptop:

```bash
# From your laptop (make sure local QuestDB is running):
node mexxie-api/scripts/sync-to-cloud.js https://mexxie.yourdomain.com
```

---

## SSL Certificate Renewal (Monthly Cron)

On the VM, add to root's crontab (`crontab -e`):
```
0 3 1 * * cd /opt/mexxie && docker compose -f docker-compose.prod.yml run --rm certbot >> /var/log/certbot-renew.log 2>&1 && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## Backup QuestDB Data

```bash
# On the VM — backup QuestDB data directory:
docker run --rm \
  -v mexxie_questdb_data:/data \
  -v /root/backups:/backup \
  alpine tar czf /backup/questdb-$(date +%Y%m%d).tar.gz /data

# Restore:
docker run --rm \
  -v mexxie_questdb_data:/data \
  -v /root/backups:/backup \
  alpine tar xzf /backup/questdb-20260101.tar.gz -C /
```

---

## Architecture After Deployment

```
Internet
  │
  ▼ HTTPS :443
┌─────────────────────────────────┐
│  DigitalOcean Droplet ($6/mo)   │
│                                 │
│  ┌─────────┐  ┌───────────┐    │
│  │  Nginx  │→ │mexxie-api │    │
│  │  :443   │  │  :3001    │    │
│  └─────────┘  └─────┬─────┘    │
│                     │          │
│               ┌─────▼──────┐   │
│               │  QuestDB   │   │
│               │   :9000    │   │
│               │  (internal)│   │
│               └────────────┘   │
└─────────────────────────────────┘
  ▲ API calls from GitHub Pages
  └── christophergayle.github.io/kubora/mexxie_prism.html
```

---

## Cost Summary

| Service | Monthly Cost |
|---------|-------------|
| GitHub Pages (frontend) | Free |
| DigitalOcean Droplet 1GB | $6 |
| Let's Encrypt SSL | Free |
| Domain name | $10–15/yr (optional) |
| **Total** | **~$6/mo** |

vs. current setup (laptop backend): **$0/mo but laptop must stay on**

---

## Troubleshooting

**Containers won't start:**
```bash
docker compose -f docker-compose.prod.yml logs
```

**QuestDB health check failing:**
```bash
docker exec mexxie-questdb curl -s http://localhost:9000/exec?query=SELECT+1
```

**SSL cert not found:**
```bash
# Check certbot volume:
docker run --rm -v mexxie_ssl_certs:/certs alpine ls /certs/live/
```

**API not reachable from outside:**
```bash
# Check firewall — open ports 80 and 443:
ufw allow 80/tcp && ufw allow 443/tcp && ufw reload
```
