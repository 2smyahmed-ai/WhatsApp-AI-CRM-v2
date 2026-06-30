import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

type KeyBucket = { [id: string]: any };
type KeyStore = Partial<Record<keyof SignalDataTypeMap, KeyBucket>>;

interface StoredAuthData {
  creds?: any;
  keys?: KeyStore;
}

/**
 * Baileys auth state backed by PostgreSQL (WhatsAppSession.data column).
 *
 * Replaces useMultiFileAuthState so the WhatsApp session survives container
 * restarts and ephemeral filesystem deployments. The entire auth state
 * (credentials + signal keys) is serialized into a single JSON column.
 *
 * The in-memory key store is seeded from DB on startup and flushed back on
 * every key mutation and credential save — Baileys calls these infrequently
 * (handshake + periodic key rotations), so the write amplification is low.
 */
export async function useDbAuthState(sessionId: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  async function readRow(): Promise<StoredAuthData> {
    try {
      const row = await prisma.whatsAppSession.findUnique({ where: { sessionId } });
      if (!row?.data || typeof row.data !== 'object') return {};
      return row.data as StoredAuthData;
    } catch (err) {
      logger.warn('db_auth_state.read_failed', { sessionId, error: String(err) });
      return {};
    }
  }

  async function writeRow(data: StoredAuthData): Promise<void> {
    try {
      await prisma.whatsAppSession.upsert({
        where: { sessionId },
        create: { sessionId, data: data as any },
        update: { data: data as any },
      });
    } catch (err) {
      logger.error('db_auth_state.write_failed', { sessionId, error: String(err) });
    }
  }

  const stored = await readRow();

  // Rehydrate Buffer objects (Baileys stores keys as binary data).
  const creds: AuthenticationCreds = stored.creds
    ? JSON.parse(JSON.stringify(stored.creds), BufferJSON.reviver)
    : initAuthCreds();

  // In-memory key store seeded from DB. All mutations are flushed immediately.
  const memKeys: KeyStore = stored.keys
    ? JSON.parse(JSON.stringify(stored.keys), BufferJSON.reviver)
    : {};

  async function flush(): Promise<void> {
    await writeRow({
      creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
      keys: JSON.parse(JSON.stringify(memKeys, BufferJSON.replacer)),
    });
  }

  return {
    state: {
      creds,
      keys: {
        async get<T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[],
        ): Promise<{ [id: string]: SignalDataTypeMap[T] }> {
          const bucket = (memKeys[type] ?? {}) as Record<string, SignalDataTypeMap[T]>;
          const result: { [id: string]: SignalDataTypeMap[T] } = {};
          for (const id of ids) {
            if (id in bucket) result[id] = bucket[id];
          }
          return result;
        },

        async set(
          data: { [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null } },
        ): Promise<void> {
          for (const [rawType, idMap] of Object.entries(data) as [keyof SignalDataTypeMap, any][]) {
            if (!memKeys[rawType]) (memKeys as any)[rawType] = {};
            for (const [id, value] of Object.entries(idMap ?? {})) {
              if (value == null) {
                delete (memKeys[rawType] as any)[id];
              } else {
                (memKeys[rawType] as any)[id] = value;
              }
            }
          }
          await flush();
        },

        async clear(): Promise<void> {
          for (const type of Object.keys(memKeys) as (keyof SignalDataTypeMap)[]) {
            delete memKeys[type];
          }
          await flush();
        },
      },
    },
    saveCreds: flush,
  };
}
