'use client';

import { useRealtimeSync } from '../../hooks/useRealtimeSync';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtimeSync();
  return <>{children}</>;
}
