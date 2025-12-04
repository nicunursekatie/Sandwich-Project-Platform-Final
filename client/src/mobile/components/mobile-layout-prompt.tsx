import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Smartphone, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOBILE_PREFERENCE_KEY = 'tsp-mobile-layout-preference';
const PROMPT_DISMISSED_KEY = 'tsp-mobile-prompt-dismissed';

type MobilePreference = 'mobile' | 'desktop' | null;

/**
 * Detects if user is on a mobile device
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // Check screen width
  const isSmallScreen = window.innerWidth < 768;

  // Check user agent for mobile devices
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // Check for touch capability
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  return (isSmallScreen && hasTouch) || isMobileUserAgent;
}

/**
 * Gets stored mobile preference
 */
function getMobilePreference(): MobilePreference {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(MOBILE_PREFERENCE_KEY);
  return stored as MobilePreference;
}

/**
 * Sets mobile preference
 */
function setMobilePreference(pref: MobilePreference): void {
  if (typeof window === 'undefined') return;
  if (pref) {
    localStorage.setItem(MOBILE_PREFERENCE_KEY, pref);
  } else {
    localStorage.removeItem(MOBILE_PREFERENCE_KEY);
  }
}

/**
 * Checks if prompt was recently dismissed
 */
function wasPromptDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
  if (!dismissed) return false;

  // Check if dismissed within last 24 hours
  const dismissedTime = parseInt(dismissed, 10);
  const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
  return hoursSinceDismissed < 24;
}

/**
 * Marks prompt as dismissed
 */
function dismissPrompt(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROMPT_DISMISSED_KEY, Date.now().toString());
}

/**
 * Mobile layout prompt - shows on desktop routes for mobile users
 * Asks if they want to switch to mobile layout
 */
export function MobileLayoutPrompt() {
  const [location, navigate] = useLocation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Only show on desktop routes (not /m/*)
    if (location.startsWith('/m')) {
      setShowPrompt(false);
      return;
    }

    // Check if on mobile device
    if (!isMobileDevice()) {
      setShowPrompt(false);
      return;
    }

    // Check preference
    const preference = getMobilePreference();
    if (preference === 'desktop') {
      setShowPrompt(false);
      return;
    }

    // Auto-redirect if preference is mobile
    if (preference === 'mobile') {
      navigate('/m');
      return;
    }

    // Check if recently dismissed
    if (wasPromptDismissed()) {
      setShowPrompt(false);
      return;
    }

    // Show prompt after a short delay
    const timer = setTimeout(() => {
      setIsAnimating(true);
      setShowPrompt(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [location, navigate]);

  const handleUseMobile = () => {
    setMobilePreference('mobile');
    navigate('/m');
  };

  const handleStayDesktop = () => {
    setMobilePreference('desktop');
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    dismissPrompt();
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[100]",
        "transition-transform duration-300 ease-out",
        isAnimating ? "translate-y-0" : "translate-y-full"
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-4 mb-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </button>

        <div className="p-5">
          {/* Icon and message */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Use mobile layout?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                We have a touch-friendly layout optimized for your device with easier navigation.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleStayDesktop}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl font-medium text-sm",
                "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
                "active:scale-[0.98] transition-transform"
              )}
            >
              Stay on desktop
            </button>
            <button
              onClick={handleUseMobile}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl font-medium text-sm",
                "bg-brand-primary text-white",
                "flex items-center justify-center gap-1",
                "active:scale-[0.98] transition-transform"
              )}
            >
              Use mobile layout
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check/set mobile preference
 */
export function useMobilePreference() {
  const [preference, setPreference] = useState<MobilePreference>(null);

  useEffect(() => {
    setPreference(getMobilePreference());
  }, []);

  const updatePreference = (pref: MobilePreference) => {
    setMobilePreference(pref);
    setPreference(pref);
  };

  const clearPreference = () => {
    localStorage.removeItem(MOBILE_PREFERENCE_KEY);
    localStorage.removeItem(PROMPT_DISMISSED_KEY);
    setPreference(null);
  };

  return {
    preference,
    setPreference: updatePreference,
    clearPreference,
    isMobile: isMobileDevice(),
  };
}

export default MobileLayoutPrompt;
