import { useState, useEffect } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Smartphone, X, Download } from 'lucide-react';

export function PWAInstallPrompt() {
  const { canInstall, promptInstall, isStandalone } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed the prompt OR if app was already installed
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    const wasInstalled = localStorage.getItem('pwa-installed');
    if (wasDismissed || wasInstalled) {
      setDismissed(true);
    }

    // Show prompt after a delay to avoid annoying users immediately
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setDismissed(true);
      // Mark as installed permanently
      localStorage.setItem('pwa-installed', 'true');
      localStorage.setItem('pwa-install-dismissed', 'true');
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if:
  // - Already installed/standalone
  // - User dismissed
  // - Can't install (browser doesn't support or already installed)
  // - Prompt delay hasn't elapsed
  if (isStandalone || dismissed || !canInstall || !showPrompt) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 p-4 shadow-lg border-2 border-primary/20 bg-card">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        data-testid="dismiss-pwa-prompt"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Smartphone className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">Install TSP App</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Install The Sandwich Project app on your device for quick access, offline support, and real-time updates.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleInstall}
              size="sm"
              className="flex-1"
              data-testid="install-pwa-button"
            >
              <Download className="w-4 h-4 mr-1" />
              Install
            </Button>
            <Button
              onClick={handleDismiss}
              size="sm"
              variant="outline"
              data-testid="dismiss-pwa-button"
            >
              Not Now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
