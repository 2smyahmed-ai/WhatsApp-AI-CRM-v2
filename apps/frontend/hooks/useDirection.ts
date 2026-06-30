import { useLanguage } from '@/components/providers/I18nProvider';

export function useDirection() {
  const { dir, isRTL } = useLanguage();
  return { dir, isRTL };
}
