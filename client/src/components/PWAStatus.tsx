import { usePWA } from '@/hooks/usePWA';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export function PWAStatus() {
  const { isStandalone } = usePWA();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Only show status if running as installed PWA
  if (!isStandalone) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-xs">
        <Smartphone className="w-3 h-3 mr-1" />
        App Mode
      </Badge>
      <Badge variant={isOnline ? 'default' : 'destructive'} className="text-xs">
        {isOnline ? (
          <>
            <Wifi className="w-3 h-3 mr-1" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3 mr-1" />
            Offline
          </>
        )}
      </Badge>
    </div>
  );
}
