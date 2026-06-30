import { create } from 'zustand';

/**
 * App-wide count of conversations with new inbound messages the user hasn't
 * looked at yet. Driven by the NotificationProvider (one bump per inbound
 * message that arrives while the user isn't actively viewing the inbox) and
 * surfaced as a badge on the header inbox icon + the sidebar Conversations item.
 * Reset whenever the user opens the inbox.
 */
interface ChatUnreadStore {
  total: number;
  bump: () => void;
  reset: () => void;
}

export const useChatUnread = create<ChatUnreadStore>((set) => ({
  total: 0,
  bump: () => set((s) => ({ total: Math.min(s.total + 1, 999) })),
  reset: () => set({ total: 0 }),
}));
