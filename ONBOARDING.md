# Deployment & Onboarding a New Business

This product is sold **instance-per-business**: each customer runs its own fully
isolated stack — separate database, WhatsApp number/session, secrets, and
subdomain. One business can **never** see another's contacts or messages; they
are physically separate. Your developer super-account is baked into every
instance, so you can log into any of them with full access.

> Data model: within an instance, a contact is keyed by phone number and shared
> across that business's team. Across businesses there is no sharing at all —
> Acme's contacts live in `crm_acme`, Beta's in `crm_beta`.

---

## Prerequisites (once per server)

- Docker + Docker Compose
- A reverse proxy for HTTPS + subdomain routing (Caddy recommended — auto-TLS)
- A wildcard DNS record `*.yourapp.com` → your server

## Verify the deployment first (once)

Before onboarding real customers, confirm the whole pipeline works on a Docker host:

```bash
bash verify-deploy.sh
```

It provisions a throwaway tenant, builds + boots the stack, checks migrations,
owner seeding, login, and the frontend, prints **GREEN LIGHT**, then tears it
all down. If it passes, you're clear to onboard real businesses.

## Onboard a business

From the **repo root**:

```bash
# 1) Generate the tenant's isolated env (secrets auto-generated)
DEV_SUPERUSER_EMAIL=dev@you.com DEV_SUPERUSER_PASSWORD=your-strong-dev-pass \
npm run provision-tenant --workspace=apps/backend -- \
  --slug acme \
  --name "Acme Corp" \
  --admin-email owner@acme.com \
  --admin-password "OwnerStrongPass123" \
  --public-url https://acme.yourapp.com \
  --frontend-port 3101 \
  --backend-port 4101

# 2) Launch the isolated stack (own Postgres + backend + frontend)
docker compose --env-file tenants/acme/.env -f docker-compose.tenant.yml -p crm-acme up -d --build
```

The backend container **migrates its database and creates the owner account on
first boot** — no manual seeding.

### 3) Route the subdomain (Caddyfile)

```
acme.yourapp.com {
  handle /api/*       { reverse_proxy localhost:4101 }
  handle /socket.io/* { reverse_proxy localhost:4101 }
  handle              { reverse_proxy localhost:3101 }
}
```

Reload Caddy. Then open `https://acme.yourapp.com`, log in as the owner (or your
developer account), and scan the WhatsApp QR on the WhatsApp page. The session is
stored in that tenant's `wa_session` volume and survives restarts.

**Each new business:** pick a fresh `--slug`, `--public-url`, and a new pair of
`--frontend-port` / `--backend-port`, then repeat.

## Manage an instance

```bash
docker compose -p crm-acme ps                  # status
docker compose -p crm-acme logs -f backend     # logs
docker compose -p crm-acme down                # stop (keeps data volumes)
docker compose -p crm-acme down -v             # stop AND delete its data ⚠️
```

## Updating all tenants to a new release

Rebuild and restart each project (data volumes are preserved; migrations run on
boot):

```bash
git pull
for t in tenants/*/.env; do
  slug=$(basename "$(dirname "$t")")
  docker compose --env-file "$t" -f docker-compose.tenant.yml -p "crm-$slug" up -d --build
done
```

---

## Notes & limits

- **One WhatsApp number per instance.** A business needing several numbers under
  one shared inbox is the single case this model doesn't cover.
- **Local dev** (no Docker): copy `apps/backend/.env.example` → `apps/backend/.env`
  and `apps/frontend/.env.example` → `apps/frontend/.env.local`, run
  `docker compose up -d` (the root `docker-compose.yml` gives you Postgres+Redis),
  `npm run db:migrate -w apps/backend`, then `npm run dev`.
- **Graduating to multi-tenant:** ideal up to a few dozen businesses. Past that,
  migrate to a single multi-tenant deployment (a `Tenant` model + tenant-scoped
  queries + per-tenant Baileys session pool). Because data is already
  team-scoped, that's a migration, not a rewrite. Revisit on ops pain, not
  feature need.
```
