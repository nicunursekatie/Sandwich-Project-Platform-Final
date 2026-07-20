/** Encode each path segment so spaces / special chars work in fetch, iframe, and window.open.
 * Idempotent: already-encoded segments are decoded first so callers can safely encode twice.
 */
export function encodeAssetPath(path: string): string {
  if (!path.startsWith('/')) return path;
  return path
    .split('/')
    .map((segment, index) => {
      if (index === 0 || !segment) return segment;
      try {
        segment = decodeURIComponent(segment);
      } catch {
        // Segment had a malformed escape — encode the raw value.
      }
      return encodeURIComponent(segment);
    })
    .join('/');
}
