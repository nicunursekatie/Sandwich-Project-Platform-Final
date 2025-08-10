import React from 'react';
import { SmartTooltipGuide } from './SmartTooltipGuide';
import { ContextualTooltip, InfoTooltip, FeatureTooltip, TipTooltip } from './ContextualTooltip';
import { useSmartGuide } from './useSmartGuide';
import { HelpProvider } from './HelpProvider';
import { HelpToggle } from './HelpToggle';

// Main intelligent guide system that combines all tooltip and guide functionality
interface IntelligentGuideSystemProps {
  children: React.ReactNode;
  enableSmartGuides?: boolean;
  enableContextualTooltips?: boolean;
  className?: string;
}

export function IntelligentGuideSystem({
  children,
  enableSmartGuides = true,
  enableContextualTooltips = true,
  className = ''
}: IntelligentGuideSystemProps) {
  // Help system completely disabled - just return children without any help features
  return <div className={className}>{children}</div>;
  const { userContext, trackActivity } = useSmartGuide();

  // Track page navigation
  React.useEffect(() => {
    trackActivity(`visited-${window.location.pathname}`);
  }, [trackActivity]);

  return (
    <HelpProvider>
      <div className={`intelligent-guide-system ${className}`}>
        {children}
        
        {/* Smart Tooltip Guide - DISABLED */}
        {false && enableSmartGuides && (
          <SmartTooltipGuide userContext={userContext} />
        )}
        
        {/* Help Toggle - DISABLED */}
        {false && (
          <div className="fixed top-4 right-4 z-30">
            <HelpToggle />
          </div>
        )}
      </div>
    </HelpProvider>
  );
}

// Export convenience components for easy use throughout the app
export {
  ContextualTooltip,
  InfoTooltip,
  FeatureTooltip,
  TipTooltip,
  SmartTooltipGuide,
  useSmartGuide,
  HelpToggle
};