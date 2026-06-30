import { useTranslation } from 'react-i18next';

interface ConnectionStatusProps {
  status: 'connected' | 'disconnected' | 'connecting';
}

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const { t } = useTranslation('common');

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'connecting':
        return 'text-yellow-600 bg-yellow-100';
      case 'disconnected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return t('status.connected');
      case 'connecting':
        return t('status.connecting');
      case 'disconnected':
        return t('status.disconnected');
      default:
        return t('status.inactive');
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <div className={`px-2 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </div>
    </div>
  );
}