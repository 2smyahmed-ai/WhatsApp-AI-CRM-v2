interface QRCodeDisplayProps {
  qrCode: string;
}

export default function QRCodeDisplay({ qrCode }: QRCodeDisplayProps) {
  return (
    <div className="flex justify-center">
      <img src={qrCode} alt="WhatsApp QR Code" className="max-w-xs" />
    </div>
  );
}