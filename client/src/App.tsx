import { Switch, Route } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, lazy } from 'react';

import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { initGA } from '../lib/analytics';
import { useAnalytics } from '../hooks/use-analytics';
import { useEnhancedTracking } from '../hooks/use-enhanced-tracking';

import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LoadingState } from '@/components/ui/loading';
import { ErrorBoundary } from '@/components/error-boundary';

import Dashboard from '@/pages/dashboard';
import Landing from '@/pages/landing';
import SignupPage from '@/pages/signup';
import ResetPassword from '@/pages/reset-password';
import NotFound from '@/pages/not-found';

function Router() {
  const { isAuthenticated, isLoading, error } = useAuth();

  // Track page views when routes change
  useAnalytics();

  // Enhanced tracking for detailed user behavior analytics
  useEnhancedTracking();

  if (isLoading) {
    return (
      <LoadingState
        text="Authenticating..."
        size="lg"
        className="min-h-screen"
      />
    );
  }

  // Enhanced error handling for authentication issues
  if (error && error.message && !error.message.includes('401')) {
    console.error('[App] Authentication error:', error);
    // For non-401 errors, show error state
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-md p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 text-center backdrop-blur-sm">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            Authentication Error
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            There was a problem verifying your account. Please try logging in
            again.
          </p>
          <button
            onClick={() => (window.location.href = '/')}
            className="w-full px-6 py-3 bg-brand-primary hover:bg-brand-primary-dark active:bg-brand-primary-dark text-white font-medium rounded-xl transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-brand-primary/20"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // If not authenticated, show public routes with login option
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/signup" component={SignupPage} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route
          path="/sms-opt-in"
          component={lazy(() => import('./pages/sms-opt-in'))}
        />
        <Route path="/login">
          {() => {
            // Redirect to the backend login page
            window.location.href = '/';
            return (
              <LoadingState
                text="Redirecting to login..."
                size="lg"
                className="min-h-screen"
              />
            );
          }}
        </Route>
        <Route path="/stream-messages">
          {() => (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
              <div className="max-w-md p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 text-center backdrop-blur-sm">
                <div className="w-12 h-12 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-brand-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6V5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v1"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                  Authentication Required
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                  Please log in to access the messaging system and continue your
                  work.
                </p>
                <button
                  onClick={() => (window.location.href = '/')}
                  className="w-full px-6 py-3 bg-brand-primary hover:bg-brand-primary-dark active:bg-brand-primary-dark text-white font-medium rounded-xl transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-brand-primary/20"
                >
                  Login to Continue
                </button>
              </div>
            </div>
          )}
        </Route>
        <Route path="/">
          {() => {
            // Redirect unauthenticated users directly to login
            window.location.href = '/';
            return (
              <LoadingState
                text="Redirecting to login..."
                size="lg"
                className="min-h-screen"
              />
            );
          }}
        </Route>
        <Route>
          {() => {
            // Default fallback - redirect to login
            window.location.href = '/';
            return (
              <LoadingState
                text="Redirecting to login..."
                size="lg"
                className="min-h-screen"
              />
            );
          }}
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/messages">
        {() => <Dashboard initialSection="messages" />}
      </Route>
      <Route path="/stream-messages">
        {() => <Dashboard initialSection="stream-messages" />}
      </Route>
      <Route path="/inbox">{() => <Dashboard initialSection="inbox" />}</Route>
      <Route path="/suggestions">
        {() => <Dashboard initialSection="suggestions" />}
      </Route>
      <Route path="/google-sheets">
        {() => <Dashboard initialSection="google-sheets" />}
      </Route>
      <Route path="/meetings">
        {() => <Dashboard initialSection="meetings" />}
      </Route>
      <Route path="/projects">
        {() => <Dashboard initialSection="projects" />}
      </Route>
      <Route path="/projects/:id">
        {(params) => <Dashboard initialSection={`project-${params.id}`} />}
      </Route>
      <Route path="/weekly-monitoring">
        {() => <Dashboard initialSection="weekly-monitoring" />}
      </Route>
      <Route path="/wishlist">
        {() => <Dashboard initialSection="wishlist" />}
      </Route>
      <Route path="/important-links">
        {() => <Dashboard initialSection="important-links" />}
      </Route>
      <Route path="/event-requests">
        {() => <Dashboard initialSection="event-requests" />}
      </Route>
      <Route path="/event-reminders">
        {() => <Dashboard initialSection="event-reminders" />}
      </Route>
      <Route
        path="/sms-opt-in"
        component={lazy(() => import('./pages/sms-opt-in'))}
      />
      <Route path="/dashboard">{() => <Dashboard />}</Route>
      <Route path="/dashboard/:section">
        {(params) => <Dashboard initialSection={params.section} />}
      </Route>
      <Route path="/">{() => <Dashboard />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Initialize Google Analytics when app loads
  useEffect(() => {
    // Verify required environment variable is present
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn(
        'Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID'
      );
    } else {
      initGA();
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
