import { useState, useEffect, useCallback } from 'react';

// Define all onboarding steps/tooltips in the app
export type OnboardingStep =
  | 'nav-badge-intro'           // First time seeing a navigation badge
  | 'team-chat-badge'           // Team chat has unread messages
  | 'gmail-badge'               // Gmail inbox has unread
  | 'notifications-badge'       // Notifications bell
  | 'event-reminders-badge'     // Event reminders
  | 'suggestions-badge'         // Suggestions/messaging
  | 'action-center-intro'       // Action center walkthrough
  | 'smart-search-intro'        // Smart search feature
  | 'holding-zone-intro'        // Holding zone explanation
  | 'project-threads-intro';    // Project threads

const STORAGE_KEY = 'sandwich-onboarding-completed';

interface OnboardingState {
  completedSteps: OnboardingStep[];
  lastUpdated: string;
}

function getStoredState(): OnboardingState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading onboarding state:', e);
  }
  return { completedSteps: [], lastUpdated: new Date().toISOString() };
}

function saveState(state: OnboardingState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving onboarding state:', e);
  }
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(getStoredState);

  // Check if a step has been completed
  const isStepCompleted = useCallback((step: OnboardingStep): boolean => {
    return state.completedSteps.includes(step);
  }, [state.completedSteps]);

  // Check if a step should be shown (not completed yet)
  const shouldShowStep = useCallback((step: OnboardingStep): boolean => {
    return !state.completedSteps.includes(step);
  }, [state.completedSteps]);

  // Mark a step as completed
  const completeStep = useCallback((step: OnboardingStep): void => {
    setState(prev => {
      if (prev.completedSteps.includes(step)) {
        return prev;
      }
      const newState = {
        completedSteps: [...prev.completedSteps, step],
        lastUpdated: new Date().toISOString()
      };
      saveState(newState);
      return newState;
    });
  }, []);

  // Reset all onboarding (useful for testing or if user wants to see hints again)
  const resetOnboarding = useCallback((): void => {
    const newState = { completedSteps: [], lastUpdated: new Date().toISOString() };
    saveState(newState);
    setState(newState);
  }, []);

  // Reset a specific step
  const resetStep = useCallback((step: OnboardingStep): void => {
    setState(prev => {
      const newState = {
        completedSteps: prev.completedSteps.filter(s => s !== step),
        lastUpdated: new Date().toISOString()
      };
      saveState(newState);
      return newState;
    });
  }, []);

  // Get completion percentage
  const getCompletionPercentage = useCallback((): number => {
    const totalSteps = 10; // Update this if you add more steps
    return Math.round((state.completedSteps.length / totalSteps) * 100);
  }, [state.completedSteps]);

  return {
    completedSteps: state.completedSteps,
    isStepCompleted,
    shouldShowStep,
    completeStep,
    resetOnboarding,
    resetStep,
    getCompletionPercentage
  };
}

// Tooltip content configuration
export const onboardingContent: Record<OnboardingStep, { title: string; message: string; action?: string }> = {
  'nav-badge-intro': {
    title: 'You have unread items!',
    message: 'Red badges show how many unread messages or items are waiting for you. Click to check them out!',
    action: 'Got it!'
  },
  'team-chat-badge': {
    title: 'New team messages',
    message: 'Your team has sent messages! Click here to join the conversation.',
    action: 'View messages'
  },
  'gmail-badge': {
    title: 'Unread emails',
    message: 'You have unread emails in your connected inbox. Click to review them.',
    action: 'Check inbox'
  },
  'notifications-badge': {
    title: 'New notifications',
    message: 'Important updates are waiting for you here. Click to see what\'s new!',
    action: 'View notifications'
  },
  'event-reminders-badge': {
    title: 'Upcoming reminders',
    message: 'You have event reminders that need your attention.',
    action: 'See reminders'
  },
  'suggestions-badge': {
    title: 'New suggestions',
    message: 'Team members have shared suggestions with you. Check them out!',
    action: 'View suggestions'
  },
  'action-center-intro': {
    title: 'Your Action Center',
    message: 'This is where you\'ll find tasks and items that need your attention, prioritized by importance.',
    action: 'Explore'
  },
  'smart-search-intro': {
    title: 'Smart Search',
    message: 'Use AI-powered search to quickly find anything - events, people, documents, and more.',
    action: 'Try it'
  },
  'holding-zone-intro': {
    title: 'Holding Zone',
    message: 'Items that need review or approval appear here. Stay on top of pending requests!',
    action: 'Got it'
  },
  'project-threads-intro': {
    title: 'Project Threads',
    message: 'Keep discussions organized by project. All related conversations in one place.',
    action: 'Explore'
  }
};
