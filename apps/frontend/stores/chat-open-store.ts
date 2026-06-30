import { create } from 'zustand';

interface ChatOpenStore {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const useChatOpen = create<ChatOpenStore>((set) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
}));
