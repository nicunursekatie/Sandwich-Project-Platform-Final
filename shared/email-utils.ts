/**
 * Email normalization helpers.
 *
 * Per RFC 5321 the local part of an email *can* technically be case-sensitive,
 * but in practice every real-world provider treats it case-insensitively.
 * Treating user-provided emails case-sensitively has burned us (two accounts
 * with identical-modulo-case emails couldn't log into each other), so we
 * canonicalize to lowercase at every boundary: signup, login, password reset,
 * invites, any email-based user lookup.
 *
 * Backed up by a functional `UNIQUE (LOWER(email))` index on `users`, so even
 * if a code path forgets to normalize, Postgres rejects the duplicate.
 */

/**
 * Canonical form of an email for storage and lookup.
 * Trims whitespace, lowercases. Returns empty string for null/undefined.
 */
export function normalizeEmail(input: string | null | undefined): string {
  if (!input) return '';
  return input.trim().toLowerCase();
}

/**
 * True when both arguments normalize to the same canonical email.
 * Use this whenever you'd otherwise write `a.email === b.email`.
 */
export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeEmail(a);
  const nb = normalizeEmail(b);
  return na !== '' && na === nb;
}
