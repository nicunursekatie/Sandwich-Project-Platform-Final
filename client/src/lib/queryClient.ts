import { QueryClient, QueryFunction } from '@tanstack/react-query';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let text = '';
    try {
      text = (await res.text()) || res.statusText;
    } catch (e) {
      // If we can't read the response text, use status text
      text = res.statusText || 'Unknown error';
    }

    // Create more specific error messages based on status codes
    let errorMessage = `${res.status}: ${text}`;

    if (res.status === 401) {
      errorMessage = 'AUTH_EXPIRED';
    } else if (res.status === 403) {
      errorMessage = 'PERMISSION_DENIED';
    } else if (res.status === 404) {
      errorMessage = 'DATA_LOADING_ERROR';
    } else if (res.status >= 500) {
      errorMessage = 'DATABASE_ERROR';
    } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
      errorMessage = 'NETWORK_ERROR';
    }

    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  body?: any,
  timeoutMs: number = 30000 // 30 second default timeout
): Promise<any> {
  const isFormData = body instanceof FormData;
  
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: isFormData
        ? {}
        : body
          ? { 'Content-Type': 'application/json' }
          : {},
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal: controller.signal,
    });

    // Clear the timeout since the request completed
    clearTimeout(timeoutId);
    
    await throwIfResNotOk(res);

    // If response has content, parse as JSON
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        const jsonData = await res.json();
        // Ensure we return a valid object, not null/undefined
        return jsonData ?? {};
      } catch (parseError) {
        console.warn('Failed to parse JSON response:', parseError);
        return {};
      }
    }

    // For empty responses (like 204), return empty object instead of null
    // This prevents "null is not an object" errors when accessing properties
    return {};
  } catch (error: any) {
    // Clear timeout on error
    clearTimeout(timeoutId);
    
    // Handle timeout/abort errors
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    
    // Re-throw other errors
    throw error;
  }
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: 'include',
    });

    if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    // Check content-type to prevent parsing HTML as JSON
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const preview = await res.text().catch(() => '');
      console.warn('DATA_LOADING_ERROR: Non-JSON API response', { 
        url: res.url, 
        status: res.status, 
        contentType, 
        preview: preview?.slice(0, 200) 
      });
      throw new Error('DATA_LOADING_ERROR: Non-JSON response from API');
    }
    
    try {
      const jsonData = await res.json();
      // Ensure we return a valid object, not null/undefined
      return jsonData ?? {};
    } catch (parseError) {
      // Get a preview of the actual response to debug HTML vs JSON issues
      const preview = await res.clone().text().catch(() => '');
      console.warn('DEBUGGING: Failed to parse JSON response', { 
        url: res.url, 
        status: res.status, 
        contentType: res.headers.get('content-type'),
        bodyPreview: preview?.slice(0, 200),
        error: parseError 
      });
      return {};
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity
      retry: (failureCount, error) => {
        // Don't retry for auth, permission, or validation errors
        const noRetryErrors = [
          'AUTH_EXPIRED',
          'PERMISSION_DENIED',
          'VALIDATION_ERROR',
        ];
        const errorMessage = error?.message || '';

        if (noRetryErrors.some((code) => errorMessage.includes(code))) {
          return false;
        }

        // Only retry network errors up to 2 times
        if (errorMessage.includes('NETWORK_ERROR') && failureCount < 2) {
          return true;
        }

        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        // Retry database errors once, but not auth/permission errors
        const errorMessage = error?.message || '';
        const retryableErrors = ['DATABASE_ERROR', 'NETWORK_ERROR'];

        return (
          retryableErrors.some((code) => errorMessage.includes(code)) &&
          failureCount < 1
        );
      },
    },
  },
});
