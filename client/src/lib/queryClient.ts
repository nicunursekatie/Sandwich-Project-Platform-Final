import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
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
    } else if (!navigator.onLine) {
      errorMessage = 'NETWORK_ERROR';
    }
    
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  body?: any
): Promise<any> {
  const isFormData = body instanceof FormData;
  
  const res = await fetch(url, {
    method,
    headers: isFormData ? {} : (body ? { "Content-Type": "application/json" } : {}),
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // If response has content, parse as JSON
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await res.json();
  }
  
  // For empty responses (like 204), return null
  return null;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Don't retry for auth, permission, or validation errors
        const noRetryErrors = ['AUTH_EXPIRED', 'PERMISSION_DENIED', 'VALIDATION_ERROR'];
        const errorMessage = error?.message || '';
        
        if (noRetryErrors.some(code => errorMessage.includes(code))) {
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
        
        return retryableErrors.some(code => errorMessage.includes(code)) && failureCount < 1;
      },
    },
  },
});
