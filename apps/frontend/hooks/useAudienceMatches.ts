'use client';

/**
 * Resolve an `AudienceFilter` into the set of phone numbers it matches, by
 * asking the server — the same endpoint and the same evaluator the contacts list
 * uses. Keeping the predicate on one side of the wire is the whole point: a
 * second implementation in the browser would eventually disagree with the one
 * that actually decides who receives a broadcast.
 *
 * Returns `null` while no filter is active, which reads as "everything passes"
 * — distinct from an empty set, which means "nothing matched".
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useCustomFields } from './useCustomFields';
import { filterableFields, filterQueryParam, type AudienceFilter } from '../lib/audience-filter';

interface MatchedContact {
  phone: string;
}

export function useAudienceMatches(filter: AudienceFilter) {
  const { definitions } = useCustomFields();
  const fields = useMemo(() => filterableFields(definitions), [definitions]);
  const query = filterQueryParam(filter, fields);

  const [phones, setPhones] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only the newest response may write state — typing "5000" into a number
  // condition fires four requests, and they can land out of order.
  const requestRef = useRef(0);

  useEffect(() => {
    if (!query) {
      requestRef.current += 1; // cancel any in-flight response
      setPhones(null);
      setLoading(false);
      setError(null);
      return;
    }

    const token = ++requestRef.current;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const matches = await api.get<MatchedContact[]>(
          `/api/contacts?filter=${encodeURIComponent(query)}`,
        );
        if (token !== requestRef.current) return;
        setPhones(new Set((Array.isArray(matches) ? matches : []).map((contact) => contact.phone)));
        setError(null);
      } catch (err) {
        if (token !== requestRef.current) return;
        setError(err instanceof Error ? err.message : 'Could not apply the filter');
        setPhones(new Set());
      } finally {
        if (token === requestRef.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return { phones, loading, error, active: Boolean(query) };
}
