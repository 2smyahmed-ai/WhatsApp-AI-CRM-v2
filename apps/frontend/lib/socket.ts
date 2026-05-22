import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || '';

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  // Callback form ensures a fresh token is used on every connect/reconnect attempt
  auth: (cb: (data: { token: string }) => void) => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') || '' : '';
    cb({ token });
  },
});

export default socket;
export function getSocket() { return socket; }
