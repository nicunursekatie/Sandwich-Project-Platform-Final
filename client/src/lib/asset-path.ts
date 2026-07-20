/** Encode each path segment so spaces / special chars work in fetch, iframe, and window.open. */
export function encodeAssetPath(path: string): string {
  if (!path.startsWith('/')) return path;
  return path
    .split('/')
    .map((segment, index) =>
      index === 0 || !segment ? segment : encodeURIComponent(segment)
    )
    .join('/');
}
