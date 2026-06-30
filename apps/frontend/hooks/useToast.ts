'use client';

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'message';

export interface ToastOptions {
  /** Bold heading rendered above the message (e.g. a contact name). */
  title?: string;
  /** When set, the toast is clickable and navigates here on click. */
  href?: string;
  /** Auto-dismiss after this many ms (default 4500). */
  duration?: number;
}

export interface Toast extends ToastOptions {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  add: (message: string, type?: ToastType, opts?: ToastOptions) => string;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = 'info', opts) => {
    const id = Math.random().toString(36).slice(2, 9);
    set((s) => ({ toasts: [...s.toasts, { id, message, type, ...opts }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, opts?.duration ?? 4500);
    return id;
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  const { add } = useToastStore();
  return {
    success: (msg: string) => add(msg, 'success'),
    error:   (msg: string) => add(msg, 'error'),
    info:    (msg: string) => add(msg, 'info'),
    warning: (msg: string) => add(msg, 'warning'),
    message: (msg: string, opts?: ToastOptions) => add(msg, 'message', opts),
  };
}
