import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || '';

const socket = io(SOCKET_URL, {
  // Prefer WebSocket for lowest latency; fall back to polling if WS is blocked
  // (e.g. corporate proxies, restrictive firewalls).
  transports: ['websocket', 'polling'],
  autoConnect: false, // Don't connect until we have a valid token
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  auth: (cb: (data: { token: string }) => void) => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') || '' : '';
    cb({ token });
  },
});

export default socket;
export function getSocket() { return socket; }
