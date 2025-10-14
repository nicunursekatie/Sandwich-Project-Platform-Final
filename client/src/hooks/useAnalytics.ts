import { useCallback } from 'react';
import { trackEvent } from '../lib/analytics';

/**
 * Hook for tracking Google Analytics events
 *
 * Common event categories:
 * - 'navigation' - Page navigation, menu clicks
 * - 'engagement' - Content interaction, downloads
 * - 'form' - Form submissions, input interactions
 * - 'button' - Button clicks
 * - 'social' - Social shares, communications
 * - 'error' - Error occurrences
 */
export function useAnalytics() {
  // Navigation tracking
  const trackNavigation = useCallback((destination: string, source?: string) => {
    trackEvent('navigate', 'navigation', `${source || 'unknown'} -> ${destination}`);
  }, []);

  // Button click tracking
  const trackButtonClick = useCallback((buttonName: string, location?: string) => {
    trackEvent('click', 'button', `${location || 'unknown'} - ${buttonName}`);
  }, []);

  // Form submission tracking
  const trackFormSubmit = useCallback((formName: string, success: boolean = true) => {
    trackEvent(
      success ? 'submit_success' : 'submit_error',
      'form',
      formName
    );
  }, []);

  // Download tracking
  const trackDownload = useCallback((fileName: string, fileType?: string) => {
    trackEvent('download', 'engagement', `${fileType || 'file'} - ${fileName}`);
  }, []);

  // Document view tracking
  const trackDocumentView = useCallback((documentName: string, documentType?: string) => {
    trackEvent('view', 'engagement', `${documentType || 'document'} - ${documentName}`);
  }, []);

  // Communication tracking
  const trackCommunication = useCallback((type: 'email' | 'sms' | 'chat', recipient?: string) => {
    trackEvent('send', 'social', `${type}${recipient ? ` - ${recipient}` : ''}`);
  }, []);

  // Search tracking
  const trackSearch = useCallback((query: string, resultsCount?: number) => {
    trackEvent('search', 'engagement', query, resultsCount);
  }, []);

  // Error tracking
  const trackError = useCallback((errorMessage: string, location?: string) => {
    trackEvent('error', 'error', `${location || 'unknown'} - ${errorMessage}`);
  }, []);

  // Report generation tracking
  const trackReportGeneration = useCallback((reportType: string, format?: string) => {
    trackEvent('generate', 'engagement', `${reportType}${format ? ` - ${format}` : ''}`);
  }, []);

  // Data entry tracking
  const trackDataEntry = useCallback((dataType: string, location?: string) => {
    trackEvent('entry', 'form', `${location || 'unknown'} - ${dataType}`);
  }, []);

  // Feature usage tracking
  const trackFeatureUse = useCallback((featureName: string, action?: string) => {
    trackEvent(action || 'use', 'engagement', featureName);
  }, []);

  return {
    trackNavigation,
    trackButtonClick,
    trackFormSubmit,
    trackDownload,
    trackDocumentView,
    trackCommunication,
    trackSearch,
    trackError,
    trackReportGeneration,
    trackDataEntry,
    trackFeatureUse,
  };
}
