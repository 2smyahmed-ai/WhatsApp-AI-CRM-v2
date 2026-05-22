interface ConnectionStatusProps {
  status: 'connected' | 'disconnected' | 'connecting';
}

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
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
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
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