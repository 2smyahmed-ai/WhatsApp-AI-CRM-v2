/**
 * Provision a brand-new, fully-isolated instance for one business (Path A —
 * instance-per-business). This generates `tenants/<slug>/.env` with freshly
 * generated secrets; `docker-compose.tenant.yml` then brings up an isolated
 * stack (its own Postgres + backend + frontend). The backend container migrates
 * its database and seeds the owner on first boot — so this script needs no DB
 * connection itself.
 *
 * Run from the repo ROOT:
 *   npx ts-node apps/backend/scripts/provision-tenant.ts \
 *     --slug acme \
 *     --name "Acme Corp" \
 *     --admin-email owner@acme.com \
 *     --admin-password "OwnerStrongPass123" \
 *     --public-url https://acme.yourapp.com \
 *     --frontend-port 3101 \
 *     --backend-port 4101
 *
 * Your developer super-account (so you can log into every instance) comes from
 * DEV_SUPERUSER_EMAIL / DEV_SUPERUSER_PASSWORD in the environment, or
 * --dev-email / --dev-password.
 */
// Namespace imports so the script runs under plain `ts-node` regardless of the
// caller's tsconfig (no esModuleInterop dependency).
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface Args { [k: string]: string }

function parseArgs(): Args {
  const out: Args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const secret = (bytes = 48) => crypto.randomBytes(bytes).toString('hex');

function main() {
  const args = parseArgs();

  const slug = (args.slug || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(slug)) {
    fail('Provide a valid --slug (lowercase letters, digits, dashes; 2–31 chars). e.g. --slug acme');
  }

  const name = args.name || `${slug} business`;
  const adminEmail = args['admin-email'];
  const adminPassword = args['admin-password'];
  const publicUrl = (args['public-url'] || `https://${slug}.yourapp.com`).replace(/\/$/, '');
  const frontendPort = args['frontend-port'] || '3101';
  const backendPort = args['backend-port'] || '4101';
  // Pass --established (or --established true) when the business connects an
  // already-trusted, long-lived number that should skip the new-number warm-up ramp.
  const established = args.established === 'true' ? 'true' : 'false';

  if (!adminEmail || !adminPassword) fail('Provide --admin-email and --admin-password for the business owner.');
  if (adminPassword.length < 8) fail('--admin-password must be at least 8 characters.');

  const devEmail = (args['dev-email'] || process.env.DEV_SUPERUSER_EMAIL || '').toLowerCase();
  const devPassword = args['dev-password'] || process.env.DEV_SUPERUSER_PASSWORD || '';
  if (!devEmail || !devPassword) {
    console.warn('⚠  No developer super-account set — pass --dev-email/--dev-password (or set DEV_SUPERUSER_* in env) to log into every instance.');
  }

  // Always write under the repo root (scripts → backend → apps → root), so the
  // output lands at `tenants/<slug>/.env` no matter where the script is invoked.
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const envRel = path.join('tenants', slug, '.env');
  const tenantDir = path.join(repoRoot, 'tenants', slug);
  const envPath = path.join(tenantDir, '.env');
  fs.mkdirSync(tenantDir, { recursive: true });
  if (fs.existsSync(envPath)) fail(`Tenant "${slug}" already provisioned (${envRel} exists). Delete it to re-provision.`);

  const dbUser = 'crm';
  const dbPassword = secret(24);
  const dbName = `crm_${slug.replace(/-/g, '_')}`;

  const lines = [
    `# Tenant: ${name} (${slug}) — generated ${new Date().toISOString()}`,
    `# Bring up with:`,
    `#   docker compose --env-file ${envRel} -f docker-compose.tenant.yml -p crm-${slug} up -d --build`,
    ``,
    `COMPOSE_PROJECT_NAME=crm-${slug}`,
    `TENANT_SLUG=${slug}`,
    `TENANT_NAME=${name}`,
    `PUBLIC_URL=${publicUrl}`,
    ``,
    `# Host-published ports (point your reverse proxy here)`,
    `FRONTEND_PORT=${frontendPort}`,
    `BACKEND_PORT=${backendPort}`,
    ``,
    `# Database (lives inside this tenant's compose project)`,
    `POSTGRES_DB=${dbName}`,
    `POSTGRES_USER=${dbUser}`,
    `POSTGRES_PASSWORD=${dbPassword}`,
    `DATABASE_URL=postgresql://${dbUser}:${dbPassword}@postgres:5432/${dbName}`,
    ``,
    `# Backend secrets`,
    `JWT_SECRET=${secret()}`,
    `WHATSAPP_PROVIDER=baileys`,
    `# true skips the 15-day new-number warm-up ramp (for an already-trusted number)`,
    `WHATSAPP_ESTABLISHED=${established}`,
    `# true actually enforces warm-up daily caps (opt-in; leave false for existing numbers)`,
    `WARMUP_ENFORCE=false`,
    ``,
    `# Frontend / NextAuth`,
    `NEXTAUTH_SECRET=${secret(32)}`,
    ``,
    `# Business owner — seeded on first boot (create-only)`,
    `OWNER_EMAIL=${adminEmail}`,
    `OWNER_PASSWORD=${adminPassword}`,
    `OWNER_NAME=${name}`,
    ``,
    `# Developer super-account — same across every tenant so you can log into all of them`,
    `DEV_SUPERUSER_EMAIL=${devEmail}`,
    `DEV_SUPERUSER_PASSWORD=${devPassword}`,
    `DEV_SUPERUSER_NAME=Developer`,
    ``,
    `# Optional AI bot (Groq)`,
    `GROQ_API_KEY=`,
    `GROQ_MODEL=`,
    ``,
  ];
  fs.writeFileSync(envPath, lines.join('\n'), { encoding: 'utf8', mode: 0o600 });
  console.log(`✓ Wrote ${envRel}`);

  console.log(`
✓ Tenant "${slug}" ready to deploy.

  1) Launch the isolated stack (from repo root):
       docker compose --env-file ${envRel} -f docker-compose.tenant.yml -p crm-${slug} up -d --build

  2) Point your reverse proxy at it (Caddy — automatic HTTPS).
     ${publicUrl.replace(/^https?:\/\//, '')} {
       handle /api/*       { reverse_proxy localhost:${backendPort} }
       handle /socket.io/* { reverse_proxy localhost:${backendPort} }
       handle              { reverse_proxy localhost:${frontendPort} }
     }

  3) Open ${publicUrl}, log in as the owner (${adminEmail}) or your developer
     account, then scan the WhatsApp QR on the WhatsApp page.

  The database migrates and the owner account is created automatically on first boot.
`);
}

main();
