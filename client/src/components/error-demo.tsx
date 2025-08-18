import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DynamicErrorMessageDisplay, useDynamicError } from './dynamic-error-message';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { Badge } from '@/components/ui/badge';

export function ErrorDemoComponent() {
  const { currentError, showError, clearError, handleErrorAction } = useDynamicError();
  const errorHandler = useErrorHandler();

  const demoErrors = [
    {
      code: 'AUTH_EXPIRED',
      label: 'Session Expired',
      description: 'Simulate an expired authentication session'
    },
    {
      code: 'PERMISSION_DENIED',
      label: 'Access Denied',
      description: 'Simulate insufficient permissions'
    },
    {
      code: 'NETWORK_ERROR',
      label: 'Connection Issue',
      description: 'Simulate network connectivity problems'
    },
    {
      code: 'VALIDATION_ERROR',
      label: 'Form Validation',
      description: 'Simulate form validation errors'
    },
    {
      code: 'DATABASE_ERROR',
      label: 'Save Failed',
      description: 'Simulate database operation failure'
    },
    {
      code: 'FILE_UPLOAD_ERROR',
      label: 'Upload Failed',
      description: 'Simulate file upload problems'
    },
    {
      code: 'DATA_LOADING_ERROR',
      label: 'Loading Failed',
      description: 'Simulate data loading issues'
    },
    {
      code: 'EXTERNAL_SERVICE_ERROR',
      label: 'Service Down',
      description: 'Simulate external service unavailability'
    }
  ];

  const triggerError = (errorCode: string) => {
    const context = {
      userRole: 'core_team',
      currentPage: '/error-demo',
      attemptedAction: 'demo error trigger',
      userId: 'demo-user'
    };
    
    showError(errorCode, context);
  };

  const triggerRealNetworkError = async () => {
    try {
      // Try to fetch from a non-existent endpoint
      await fetch('/api/non-existent-endpoint');
    } catch (error) {
      errorHandler.handleNetworkError(error as Error);
    }
  };

  const triggerFormError = () => {
    // Simulate a form error with validation data
    const mockFormData = {
      email: 'invalid-email',
      password: '',
      confirmPassword: 'different'
    };
    
    errorHandler.handleFormError('VALIDATION_ERROR', mockFormData);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🚨 Dynamic Error Message System
            <Badge variant="outline" className="text-xs">Demo</Badge>
          </CardTitle>
          <CardDescription>
            Test the new dynamic error handling system with contextual recovery suggestions.
            This system provides user-friendly error messages with actionable recovery steps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {demoErrors.map((error) => (
              <Button
                key={error.code}
                variant="outline"
                size="sm"
                onClick={() => triggerError(error.code)}
                className="flex flex-col h-auto p-3 text-left"
              >
                <span className="font-medium text-sm">{error.label}</span>
                <span className="text-xs text-gray-500 mt-1">{error.description}</span>
              </Button>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium text-sm mb-3">Advanced Error Handling:</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={triggerRealNetworkError}
              >
                Real Network Error
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={triggerFormError}
              >
                Form Validation Error
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  throw new Error('Uncaught JavaScript Error for Testing');
                }}
              >
                JavaScript Error
              </Button>
            </div>
          </div>

          {currentError && (
            <div className="mt-6">
              <DynamicErrorMessageDisplay
                error={currentError}
                onAction={handleErrorAction}
                onDismiss={clearError}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Key Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-sm mb-2">🎯 Smart Error Detection</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Automatically categorizes error types</li>
                <li>• Provides context-aware messages</li>
                <li>• Suggests specific recovery actions</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-sm mb-2">🔧 Recovery Actions</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• One-click retry for failed operations</li>
                <li>• Automatic form validation guidance</li>
                <li>• Smart navigation suggestions</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-sm mb-2">📊 Error Analytics</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Logs errors for monitoring</li>
                <li>• Tracks user context and actions</li>
                <li>• Helps improve user experience</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-sm mb-2">💡 Prevention Tips</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Shows how to avoid similar issues</li>
                <li>• Provides best practice guidance</li>
                <li>• Educates users about the platform</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}