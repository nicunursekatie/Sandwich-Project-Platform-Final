/** Shown when Replit/host returns HTML instead of the API (deploy restart, sleep, crash). */
export const SERVER_UNAVAILABLE_MESSAGE =
  'The server is restarting or temporarily unavailable. Wait a moment and try again.';

export const RATE_LIMITED_MESSAGE =
  'Too many requests — wait a moment and try again.';

/** Detect Replit "app isn't live" and similar proxy HTML error pages. */
export function isServerUnavailableBody(body: string | undefined | null): boolean {
  if (!body) return false;
  const lower = body.toLowerCase();
  if (lower.includes("this app isn't live yet") || lower.includes('this app is not live yet')) {
    return true;
  }
  // Generic HTML error page on an API route (not our JSON errors)
  if (lower.includes('<!doctype html') || lower.includes('<html')) {
    return (
      lower.includes('isn') &&
      lower.includes('live') &&
      lower.includes('yet')
    );
  }
  return false;
}

export function isServerUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; status?: number; message?: string };
  if (e.code === 'SERVER_UNAVAILABLE' || e.code === 'RATE_LIMITED') return true;
  if (e.status === 429 || e.status === 502 || e.status === 503 || e.status === 504) return true;
  if (typeof e.message === 'string' && isServerUnavailableBody(e.message)) return true;
  return false;
}

/** Map ApiError / fetch failures to user-facing toast copy. */
export function describeApiError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): { title: string; description: string } {
  if (!error || typeof error !== 'object') {
    return { title: 'Error', description: fallback };
  }

  const e = error as {
    code?: string;
    status?: number;
    message?: string;
    data?: { message?: string };
  };

  if (e.code === 'SERVER_UNAVAILABLE' || isServerUnavailableBody(e.message)) {
    return { title: 'Server Unavailable', description: SERVER_UNAVAILABLE_MESSAGE };
  }

  if (e.code === 'RATE_LIMITED' || e.status === 429) {
    return { title: 'Server Busy', description: RATE_LIMITED_MESSAGE };
  }

  if (e.status === 502 || e.status === 503 || e.status === 504) {
    return { title: 'Server Unavailable', description: SERVER_UNAVAILABLE_MESSAGE };
  }

  if (
    e.message?.includes('Failed to fetch') ||
    e.message?.includes('Request timeout') ||
    e.code === 'NETWORK_ERROR'
  ) {
    return {
      title: 'Connection Error',
      description: 'Could not reach the server. Check your connection and try again.',
    };
  }

  const description = e.data?.message || e.message || fallback;
  return { title: 'Error', description };
}
