import { useEffect, useRef } from 'react';
import socket from '../lib/socket';

/**
 * Registers a socket.io event listener for the lifetime of the component.
 *
 * Uses a stable ref so the listener is registered exactly ONCE per call-site
 * (not re-registered every time the callback's closure changes). The ref is
 * updated on every render, so the callback always captures the latest state
 * without needing to be in the dependency array.
 */
export function useSocket(event: string, callback: (...args: any[]) => void) {
  const callbackRef = useRef(callback);
  // Keep the ref current on every render — this is safe because refs are
  // updated synchronously before any effects run.
  callbackRef.current = callback;

  useEffect(() => {
    // Stable wrapper: the identity never changes, so socket.off works correctly.
    const handler = (...args: any[]) => callbackRef.current(...args);
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  // Only re-register when the event name itself changes (which is rare /never).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}

export default socket;
