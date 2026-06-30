# Deploying for Your Agency (single business, one WhatsApp number)

This is the focused runbook for running the CRM for **one agency**: you + a
manager as admins, 3 sales as agents, on **one existing WhatsApp number**,
served from a **cloud server on your own domain with HTTPS**.

It uses the existing instance-per-business setup (`docker-compose.tenant.yml`)
with the deployment fixes applied (Redis added, durable local storage enabled,
schema-drift migration added). You are running exactly **one** instance.

---

## 0. What you need first

- A small cloud server (VPS) — 2 vCPU / 4 GB RAM is plenty for 5 users.
- **Docker + Docker Compose plugin** installed on it.
- **Node.js 20+** on the server (only to run the one-time provisioning script),
  or run that script on your laptop and copy the generated file up.
- A **domain/subdomain** for the CRM, e.g. `crm.youragency.com`, with a DNS
  **A record** pointing at the server's public IP.
- **Caddy** for automatic HTTPS (recommended) — a container or system package.

---

## 1. Get the code on the server

```bash
git clone <your-repo-url> whatsapp-crm
cd whatsapp-crm
npm install            # needed only to run the provisioning script below
```

## 2. Provision your instance (one time)

This generates `tenants/agency/.env` with auto-generated DB password, JWT secret,
and NextAuth secret, and seeds your owner account on first boot.

```bash
DEV_SUPERUSER_EMAIL=dev@youragency.com \
DEV_SUPERUSER_PASSWORD='a-different-strong-12+char-pass' \
npm run provision-tenant --workspace=apps/backend -- \
  --slug agency \
  --name "Your Agency" \
  --admin-email you@youragency.com \
  --admin-password 'your-strong-owner-password' \
  --public-url https://crm.youragency.com \
  --frontend-port 3101 \
  --backend-port 4101 \
  --established
```

Notes:
- `--established` skips the 15-day new-number warm-up ramp — correct for your
  **existing, trusted** number.
- `--admin-email` / `--admin-password` = your **owner** login (SUPER_ADMIN).
- `DEV_SUPERUSER_*` is an optional separate backdoor login; omit it if you don't
  want one.
- Run this on your laptop instead if the server has no Node — then copy the
  resulting `tenants/agency/.env` to the same path on the server.

## 3. Launch the stack

```bash
docker compose --env-file tenants/agency/.env -f docker-compose.tenant.yml -p crm-agency up -d --build
```

This brings up Postgres + Redis + backend + frontend. The backend **runs database
migrations and creates your owner account automatically on first boot.** Media
uploads are stored on the persistent `uploads` Docker volume (no external S3
needed). First build takes a few minutes.

Check it's healthy:
```bash
docker compose -p crm-agency ps
curl -fsS http://localhost:4101/health        # -> {"status":"ok",...}
```

## 4. Route your domain (Caddy → automatic HTTPS)

Add to your `Caddyfile`:
```
crm.youragency.com {
  handle /api/*       { reverse_proxy localhost:4101 }
  handle /socket.io/* { reverse_proxy localhost:4101 }
  handle              { reverse_proxy localhost:3101 }
}
```
Reload Caddy. Caddy fetches a TLS cert automatically, so the site is HTTPS — which
is required for login cookies to work (the backend sets `Secure` cookies in
production).

## 5. Connect your WhatsApp number

1. Open `https://crm.youragency.com` and log in as the owner
   (`you@youragency.com`).
2. Go to the **WhatsApp** page and scan the QR with the agency's phone
   (WhatsApp → Linked Devices → Link a device).
3. The session is stored in the `wa_session` volume and survives restarts.

> ⚠️ This uses Baileys (unofficial). Keep the linked phone online, and avoid
> blasting cold contacts early — it's the one real ban risk for the number.

## 6. Create your team (the 5 logins)

As the owner, go to **Admin → Users → Create User**. Create four accounts and
assign each to your agency team (it was created automatically with your owner
account):

| Person  | Role    | Can do                                              |
|---------|---------|-----------------------------------------------------|
| You     | (owner) | Everything (already created)                        |
| Manager | `ADMIN` | Everything: users, settings, delete data            |
| Sales 1 | `AGENT` | Chat, contacts, deals, tasks — **cannot delete** contacts/conversations/users |
| Sales 2 | `AGENT` | same as Sales 1                                     |
| Sales 3 | `AGENT` | same as Sales 1                                     |

Putting all five on the **same team** ensures everyone sees the shared inbox and
gets live updates. Turn on the team's **auto-assign** if you want new chats
distributed round-robin to the three sales agents.

---

## Day-to-day operations

```bash
docker compose -p crm-agency ps                 # status
docker compose -p crm-agency logs -f backend    # backend logs
docker compose -p crm-agency restart backend    # restart after config change
docker compose -p crm-agency down               # stop (keeps all data)
```

### Backups (do this — it's one DB)
```bash
# Database
docker compose -p crm-agency exec postgres pg_dump -U crm crm_agency > backup-$(date +%F).sql
# Uploaded media + WhatsApp session live in named volumes:
#   crm-agency_uploads, crm-agency_wa_session  (back these up too)
```

### Updating to a new version
```bash
git pull
docker compose --env-file tenants/agency/.env -f docker-compose.tenant.yml -p crm-agency up -d --build
# migrations run automatically on boot; data volumes are preserved
```

---

## What was fixed to make this deployable
- **Redis** added to the deploy stack (broadcasts + automation flows require it;
  the backend refuses to boot without it in production).
- **Durable local storage** enabled via `ALLOW_LOCAL_STORAGE=true` so a single
  self-hosted instance stores media on a persistent volume instead of paying for
  external S3.
- **Schema-drift migration** (`20260628000000_reconcile_schema_drift`) added so a
  fresh database exactly matches the schema — without it the `Setting` table was
  missing and the backend failed on boot.
