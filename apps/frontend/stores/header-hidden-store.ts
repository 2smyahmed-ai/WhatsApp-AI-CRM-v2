import { create } from 'zustand';

interface HeaderHiddenStore {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

export const useHeaderHidden = create<HeaderHiddenStore>((set) => ({
  hidden: false,
  setHidden: (hidden) => set({ hidden }),
}));
