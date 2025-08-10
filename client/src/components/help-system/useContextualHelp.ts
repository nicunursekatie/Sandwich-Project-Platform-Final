import { useHelp } from './HelpProvider';
import { HelpContent } from './HelpBubble';

interface UseContextualHelpOptions {
  id: string;
  autoShow?: boolean;
  showOnce?: boolean;
}

export function useContextualHelp(id: string, options: Partial<UseContextualHelpOptions> = {}) {
  const { getHelpContent, isHelpEnabled, registerHelp } = useHelp();
  
  const helpContent = getHelpContent(id);
  
  const registerContextualHelp = (content: Omit<HelpContent, 'id'>) => {
    registerHelp(id, { ...content, id });
  };

  const shouldShowHelp = () => {
    // Auto-help completely disabled - must be manually triggered
    return false;
  };

  const markAsShown = () => {
    if (options.showOnce) {
      localStorage.setItem(`help-${id}-shown`, 'true');
    }
  };

  return {
    helpContent,
    shouldShowHelp: shouldShowHelp(),
    registerContextualHelp,
    markAsShown,
    isHelpEnabled
  };
}