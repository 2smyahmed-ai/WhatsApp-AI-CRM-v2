import { useTranslation } from 'react-i18next';

interface QRCodeDisplayProps {
  qrCode: string;
}

export default function QRCodeDisplay({ qrCode }: QRCodeDisplayProps) {
  const { t } = useTranslation('common');
  return (
    <div className="flex justify-center">
      <img src={qrCode} alt={t('qrCodeAlt')} className="max-w-xs" />
    </div>
  );
}