# Deploy on Oracle Cloud "Always Free" — 100% free, 24/7, never sleeps

This is the **free** hosting runbook. It runs the **entire** stack (Postgres +
Redis + backend + frontend + HTTPS) on a single Oracle Cloud **Always Free**
ARM VM, which runs forever at no cost and **never sleeps** — the one thing
Baileys absolutely needs.

> **Why not Vercel / Render-free / Railway-free?**
> Baileys keeps a live WebSocket to WhatsApp 24/7 and stores its session on disk.
> Vercel is serverless (stateless, ephemeral disk, seconds-long functions) — it
> **cannot** run the backend at all. Render's free tier and similar **sleep**
> after ~15 min idle, which **drops the WhatsApp link** and forces a QR re-scan.
> Oracle's free VM is a real always-on Linux box, so none of that applies.
> (Vercel's free tier is still great if you ever want to serve only the Next.js
> frontend from it — but the backend must live on a box like this one.)

**What you need:** an Oracle Cloud account (credit card required for identity
verification — **Always Free resources are never charged**), ~40 minutes, and a
free domain (we use DuckDNS below). HTTPS is mandatory: the backend sets `Secure`
login cookies in production.

---

## 1. Create the Always Free VM

1. Sign up at <https://www.oracle.com/cloud/free/> → "Start for free".
2. Console → **Compute → Instances → Create instance**.
3. **Image & shape:**
   - Image: **Ubuntu 22.04**.
   - Shape: **Change shape → Ampere (Arm) → VM.Standard.A1.Flex**.
   - Set **2 OCPU / 12 GB RAM** (well within the Always Free cap of 4 OCPU /
     24 GB total — generous headroom for Docker builds).
   > If you hit "Out of host capacity", try a different Availability Domain, or
   > retry later / pick another home region. This is the most common Oracle
   > annoyance — it is a capacity limit, not a billing one.
4. **SSH keys:** "Generate a key pair for me" → **download the private key**
   (you'll SSH with it). Or paste your own public key.
5. **Create.** When it's running, copy the **Public IP address**.

> The whole stack fits comfortably; this is a single-business instance. ARM is
> fine — every base image used (`node:22-slim`, `postgres:15`, `redis:7-alpine`,
> `caddy:2-alpine`) has an arm64 build, and `ffmpeg` installs via apt on arm64,
> so the images build natively on the VM.

---

## 2. Open the firewall (TWO layers — both are required)

Oracle blocks inbound traffic in two independent places. You must open **80**
and **443** in both.

**Layer A — VCN Security List (cloud firewall):**
Console → **Networking → Virtual Cloud Networks → (your VCN) → Subnet →
Security List → Add Ingress Rules**. Add two rules:

| Source CIDR | IP Protocol | Destination Port |
|-------------|-------------|------------------|
| `0.0.0.0/0` | TCP         | `80`             |
| `0.0.0.0/0` | TCP         | `443`            |

**Layer B — the VM's own iptables (the gotcha everyone misses):**
Oracle's Ubuntu image ships iptables rules that drop everything except SSH.
SSH in first (see step 3), then run:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save   # persist across reboots
```

---

## 3. Connect and prepare the server

SSH in with the key from step 1 (default user is `ubuntu`):

```bash
chmod 600 your-key.key            # local: lock down the key file
ssh -i your-key.key ubuntu@YOUR_PUBLIC_IP
```

Install Docker + the Compose plugin, and add 2 GB swap (steadier Docker builds
on a small box):

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# 2 GB swap
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Apply the docker group membership (or just log out/in)
exec sg docker newgrp `id -gn`
```

Don't forget **Layer B** of the firewall from step 2 now that you're in.

---

## 4. Point a free domain at the VM (DuckDNS)

Caddy needs a real hostname to issue a TLS certificate.

1. Go to <https://www.duckdns.org>, sign in, create a subdomain, e.g.
   `mybiz.duckdns.org`.
2. Set its IP to your VM's **Public IP** and **Update**.
3. Verify from your laptop: `ping mybiz.duckdns.org` should resolve to the IP.

> Prefer your own domain? Skip DuckDNS and add a DNS **A record** pointing
> `crm.yourbiz.com` → the VM's public IP. Use that hostname everywhere below.

---

## 5. Get the code on the server

```bash
git clone <your-repo-url> whatsapp-crm
cd whatsapp-crm
```

You do **not** need Node installed on the server if you run the provisioning
script on your laptop and copy the `.env` up (next step explains both).

---

## 6. Provision the instance (one time)

This generates `tenants/<slug>/.env` with auto-generated DB password, JWT secret,
and NextAuth secret, and seeds your owner account on first boot. Run it on the
server (needs Node 20+), **or** run it on your laptop and `scp` the resulting
`tenants/<slug>/.env` to the same path on the server.

```bash
npm install                       # only to run the script

DEV_SUPERUSER_EMAIL=dev@yourbiz.com \
DEV_SUPERUSER_PASSWORD='a-different-strong-12+char-pass' \
npm run provision-tenant --workspace=apps/backend -- \
  --slug mybiz \
  --name "My Business" \
  --admin-email you@yourbiz.com \
  --admin-password 'your-strong-owner-password' \
  --public-url https://mybiz.duckdns.org \
  --established
```

- `--public-url` **must** be `https://<your DuckDNS or domain>` — it is baked
  into the frontend build and used for cookies/CORS.
- `--established` skips the 15-day new-number warm-up ramp — correct for an
  existing, trusted WhatsApp number. Omit it for a brand-new number.

Then **append the two Caddy variables** to the generated file (the provisioner
doesn't write these). Match `CADDY_DOMAIN` to your `--public-url` host:

```bash
cat >> tenants/mybiz/.env <<'EOF'

# Edge HTTPS proxy (docker-compose.caddy.yml)
CADDY_DOMAIN=mybiz.duckdns.org
CADDY_EMAIL=you@yourbiz.com
EOF
```

---

## 7. Launch everything (app + HTTPS) in one command

This brings up Postgres + Redis + backend + frontend **and** the Caddy proxy
that terminates HTTPS. The backend runs DB migrations and seeds the owner
automatically on first boot. The first build takes several minutes on ARM.

```bash
docker compose --env-file tenants/mybiz/.env \
  -f docker-compose.tenant.yml -f docker-compose.caddy.yml \
  -p crm-mybiz up -d --build
```

Check health:

```bash
docker compose -p crm-mybiz ps
docker compose -p crm-mybiz logs -f caddy      # watch the cert get issued
```

Then open **https://mybiz.duckdns.org** in a browser. The padlock should be
green within a minute of Caddy starting (it provisions the Let's Encrypt cert
on first request).

> If the cert never issues, it's almost always the firewall: re-check **both**
> layers in step 2 (port 80 must be reachable for the ACME challenge).

---

## 8. Connect WhatsApp & create your team

From here, follow the existing runbook — these steps are host-agnostic:

- **Connect the number:** [DEPLOY_AGENCY.md](DEPLOY_AGENCY.md) §5 — log in as the
  owner, open the WhatsApp page, scan the QR. The session persists in the
  `wa_session` volume across restarts.
- **Create the 5 logins / roles:** [DEPLOY_AGENCY.md](DEPLOY_AGENCY.md) §6.

> ⚠️ Baileys is unofficial. Keep the linked phone online, and don't blast cold
> contacts early — that's the real ban risk for the number.

---

## Day-to-day operations

```bash
docker compose -p crm-mybiz ps                 # status
docker compose -p crm-mybiz logs -f backend    # backend logs
docker compose -p crm-mybiz restart backend    # restart a service
docker compose -p crm-mybiz down               # stop (keeps all data)
```

### Backups (do these — it's one box)

```bash
# Database
docker compose -p crm-mybiz exec postgres pg_dump -U crm crm_mybiz > backup-$(date +%F).sql
# Media + WhatsApp session live in named volumes — back these up too:
#   crm-mybiz_uploads, crm-mybiz_wa_session
```

### Update to a new version

```bash
git pull
docker compose --env-file tenants/mybiz/.env \
  -f docker-compose.tenant.yml -f docker-compose.caddy.yml \
  -p crm-mybiz up -d --build
# migrations run automatically on boot; data volumes are preserved
```

---

## Cost reality check

| Resource | Cost |
|----------|------|
| Oracle Always Free ARM VM (2 OCPU / 12 GB) | **$0 forever** |
| DuckDNS domain | **$0** |
| Let's Encrypt TLS (via Caddy) | **$0** |
| **Total** | **$0/month** |

The only thing Oracle's free tier asks for is a card for identity verification;
Always Free shapes are never billed. If you'd rather avoid Oracle's signup
friction, the cheapest paid equivalent is a Hetzner / Contabo VPS (~€4/mo) — the
exact same commands work, just skip step 1–2 and the ARM notes.
