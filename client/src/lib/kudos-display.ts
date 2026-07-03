const PLACEHOLDER_ENTITY_NAMES = new Set([
  'unknown',
  'unknown entity',
  'legacy entry',
]);

export function isDisplayableKudosEntityName(
  name: string | null | undefined
): boolean {
  if (!name?.trim()) return false;
  return !PLACEHOLDER_ENTITY_NAMES.has(name.trim().toLowerCase());
}

export function kudosContextLabel(contextType: string): string {
  switch (contextType) {
    case 'task':
      return 'Task';
    case 'project':
      return 'Project';
    case 'onboarding_challenge':
      return 'Onboarding';
    default:
      return contextType.replace(/_/g, ' ');
  }
}
