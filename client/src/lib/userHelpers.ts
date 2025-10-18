export function formatLastLogin(lastLoginAt: string | null): string {
  if (!lastLoginAt) return 'Never';
  const date = new Date(lastLoginAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getDisplayName(
  firstName?: string,
  lastName?: string,
  email?: string
): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim() || email || '';
}
