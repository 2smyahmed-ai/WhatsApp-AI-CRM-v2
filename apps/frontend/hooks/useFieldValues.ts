'use client';

/**
 * The values each contact field actually holds — "tower" → ["A", "B", "C"].
 *
 * The filter builder turns these into choices, so picking an audience by tower
 * is a click rather than a recalled spelling. Read once and shared across mounts
 * (both the contacts list and the broadcast audience step want them), because
 * they change only when contacts do.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export type FieldValues = Record<string, string[]>;

let cache: FieldValues | null = null;
let inflight: Promise<FieldValues> | null = null;

export function useFieldValues() {
  const [values, setValues] = useState<FieldValues>(cache ?? {});

  useEffect(() => {
    if (cache) return;

    let alive = true;
    if (!inflight) {
      inflight = api
        .get<FieldValues>('/api/contacts/field-values')
        .then((data) => (data && typeof data === 'object' ? data : {}))
        .catch(() => ({}) as FieldValues)
        .finally(() => {
          inflight = null;
        });
    }

    inflight.then((data) => {
      cache = data;
      if (alive) setValues(data);
    });

    return () => {
      alive = false;
    };
  }, []);

  return values;
}
