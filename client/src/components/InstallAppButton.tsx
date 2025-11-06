import { usePWA } from '@/hooks/usePWA';
import { Button } from '@/components/ui/button';
import { Download, Check } from 'lucide-react';

export function InstallAppButton() {
  const { canInstall, isInstalled, promptInstall } = usePWA();

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      console.log('App installed successfully!');
    }
  };

  // Don't show if already installed
  if (isInstalled) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full bg-green-50 border-green-200 text-green-700 cursor-default hover:bg-green-50"
        disabled
        data-testid="app-installed-button"
      >
        <Check className="w-4 h-4 mr-2" />
        App Installed
      </Button>
    );
  }

  // Don't show if can't install
  if (!canInstall) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full bg-brand-primary/5 border-brand-primary/20 text-brand-primary hover:bg-brand-primary/10 hover:border-brand-primary/30"
      onClick={handleInstall}
      data-testid="install-app-button"
    >
      <Download className="w-4 h-4 mr-2" />
      Install App
    </Button>
  );
}
