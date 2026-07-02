import { logger } from './logger';

/**
 * Centralized, fail-fast environment configuration.
 *
 * Required variables are validated once at process startup. If any are missing
 * (or, for secrets, dangerously weak) the process refuses to boot instead of
 * silently signing tokens with `undefined` or running with insecure defaults.
 *
 * Import `env` anywhere instead of reaching for `process.env.X!`.
 */

const isProduction = process.env.NODE_ENV === 'production';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateJwtSecret(): string {
  const secret = requireEnv('JWT_SECRET');
  const weak = new Set(['secret', 'changeme', 'jwt_secret', 'dev', 'test']);
  if (weak.has(secret.toLowerCase())) {
    throw new Error('JWT_SECRET is set to a well-known placeholder value. Use a strong random secret.');
  }
  if (isProduction && secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
  return secret;
}

function validateRedisUrl(): string | undefined {
  const url = process.env.REDIS_URL;
  if (!url || url.trim() === '') {
    if (isProduction) {
      throw new Error(
        'REDIS_URL is required in production. ' +
        'Broadcasts and automation flows depend on Redis queues. ' +
        'Set REDIS_URL to a managed Redis instance (e.g. Upstash, Redis Cloud).',
      );
    }
    // Dev: warn and fall back to localhost so Bull still works locally.
    return undefined;
  }
  return url;
}

function validateS3(): S3Config | undefined {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    // Self-hosted single-tenant deployments can opt into durable local-disk
    // storage (a persistent Docker volume) instead of external object storage.
    const allowLocal = process.env.ALLOW_LOCAL_STORAGE === 'true';
    if (isProduction && !allowLocal) {
      // Hard-fail in production — local disk is ephemeral on most cloud platforms.
      throw new Error(
        'S3_BUCKET is required in production unless ALLOW_LOCAL_STORAGE=true. ' +
        'Either set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY ' +
        '(recommended for ephemeral/cloud hosts), or set ALLOW_LOCAL_STORAGE=true to ' +
        'store uploads on a persistent local volume (fine for a single self-hosted instance).',
      );
    }
    return undefined; // local disk (dev, or prod with ALLOW_LOCAL_STORAGE=true)
  }

  const errors: string[] = [];
  if (!process.env.S3_ACCESS_KEY_ID) errors.push('S3_ACCESS_KEY_ID');
  if (!process.env.S3_SECRET_ACCESS_KEY) errors.push('S3_SECRET_ACCESS_KEY');
  if (errors.length > 0) {
    throw new Error(
      `S3_BUCKET is set but the following S3 credentials are missing: ${errors.join(', ')}`,
    );
  }

  return {
    bucket,
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    publicUrl: process.env.S3_PUBLIC_URL,
  };
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

let cached: Env | null = null;

export interface DevSuperuser {
  email: string;
  password: string;
  name: string;
}

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  publicUrl?: string;
}

export interface WebPushConfig {
  publicKey: string;
  privateKey: string;
  subject: string; // "mailto:you@example.com" or a https URL
}

export interface Env {
  isProduction: boolean;
  jwtSecret: string;
  databaseUrl: string;
  frontendUrl: string;
  port: number;
  redisUrl?: string;
  s3?: S3Config;
  devSuperuser?: DevSuperuser;
  /** Web Push (phone/desktop notifications). Optional — feature is disabled if unset. */
  webPush?: WebPushConfig;
}

/**
 * Web Push is opt-in: set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (and optionally
 * VAPID_SUBJECT) to enable phone/desktop push. If neither is set the feature is
 * silently disabled. If only one is set that's a misconfiguration → fail fast.
 */
function validateWebPush(): WebPushConfig | undefined {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey && !privateKey) return undefined;
  if (!publicKey || !privateKey) {
    throw new Error('Both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set to enable Web Push.');
  }
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@nexuscrm.app';
  return { publicKey, privateKey, subject };
}

function buildDevSuperuser(): DevSuperuser | undefined {
  const email = process.env.DEV_SUPERUSER_EMAIL?.trim();
  const password = process.env.DEV_SUPERUSER_PASSWORD;
  const name = process.env.DEV_SUPERUSER_NAME?.trim() || 'Developer';

  if (!email && !password) return undefined;

  if (!email || !password) {
    throw new Error(
      'Both DEV_SUPERUSER_EMAIL and DEV_SUPERUSER_PASSWORD must be set to provision the developer super-account.',
    );
  }
  if (isProduction && password.length < 12) {
    throw new Error('DEV_SUPERUSER_PASSWORD must be at least 12 characters in production.');
  }

  return { email: email.toLowerCase(), password, name };
}

function buildEnv(): Env {
  const errors: string[] = [];
  let jwtSecret = '';
  let databaseUrl = '';
  let redisUrl: string | undefined;
  let s3: S3Config | undefined;
  let devSuperuser: DevSuperuser | undefined;
  let webPush: WebPushConfig | undefined;

  try { jwtSecret = validateJwtSecret(); } catch (e) { errors.push((e as Error).message); }
  try { databaseUrl = requireEnv('DATABASE_URL'); } catch (e) { errors.push((e as Error).message); }
  try { redisUrl = validateRedisUrl(); } catch (e) { errors.push((e as Error).message); }
  try { s3 = validateS3(); } catch (e) { errors.push((e as Error).message); }
  try { devSuperuser = buildDevSuperuser(); } catch (e) { errors.push((e as Error).message); }
  try { webPush = validateWebPush(); } catch (e) { errors.push((e as Error).message); }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}`);
  }

  return {
    isProduction,
    jwtSecret,
    databaseUrl,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    port: optionalNumber('PORT', 4000),
    redisUrl,
    s3,
    devSuperuser,
    webPush,
  };
}

export function loadEnv(): Env {
  if (!cached) {
    cached = buildEnv();
    logger.info('Environment validated', {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: cached.port,
      redisConfigured: Boolean(cached.redisUrl),
      s3Configured: Boolean(cached.s3),
      devSuperuserConfigured: Boolean(cached.devSuperuser),
      webPushConfigured: Boolean(cached.webPush),
    });
  }
  return cached;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return loadEnv()[prop as keyof Env];
  },
});
