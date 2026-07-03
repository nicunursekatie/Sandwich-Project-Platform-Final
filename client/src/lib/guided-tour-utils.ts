/** Dispatches a request for GuidedTour to start a tour by id. */
export function startGuidedTour(tourId: string): void {
  window.dispatchEvent(
    new CustomEvent('guided-tour:start', { detail: { tourId } })
  );
}

const WELCOME_PROMPT_KEY_PREFIX = 'sandwich-welcome-tour-prompt-';

export function getWelcomeTourPromptState(userId: string): 'shown' | null {
  const value = localStorage.getItem(`${WELCOME_PROMPT_KEY_PREFIX}${userId}`);
  return value === 'shown' ? 'shown' : null;
}

export function markWelcomeTourPromptShown(userId: string): void {
  localStorage.setItem(`${WELCOME_PROMPT_KEY_PREFIX}${userId}`, 'shown');
}

export function getDefaultWelcomeTourId(hasEventPlanningAccess: boolean): string {
  return hasEventPlanningAccess ? 'platform-getting-started' : 'dashboard-assignments';
}
