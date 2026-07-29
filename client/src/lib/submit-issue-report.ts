import { apiRequest, ApiError } from '@/lib/queryClient';
import type { IssueReportDraft } from '@/contexts/issue-report-context';

function buildPagePath(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function buildPayload(draft: IssueReportDraft) {
  const pagePath = buildPagePath();
  return {
    pagePath,
    pageLabel:
      draft.pageLabel ||
      (typeof document !== 'undefined' ? document.title : '') ||
      undefined,
    whatDoing: draft.whatDoing?.trim() || 'Using the platform',
    expectedOutcome:
      draft.expectedOutcome?.trim() || 'The action should complete successfully.',
    actualOutcome: draft.actualOutcome?.trim() || 'Something went wrong.',
    recordType: draft.recordType || undefined,
    recordId: draft.recordId?.trim() || undefined,
    recordLabel: draft.recordLabel?.trim() || undefined,
    clientTimestamp: new Date().toISOString(),
  };
}

/** Submit a user issue report (DB + Google Sheet via server). Requires login. */
export async function submitIssueReport(draft: IssueReportDraft = {}) {
  return apiRequest('POST', '/api/user-issue-reports', buildPayload(draft));
}

/** Fallback when user is not logged in — logs crash context to /api/client-error. */
export async function submitAnonymousErrorReport(draft: IssueReportDraft) {
  const payload = buildPayload(draft);
  return fetch('/api/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      message: payload.actualOutcome,
      stack: [
        `What doing: ${payload.whatDoing}`,
        `Expected: ${payload.expectedOutcome}`,
        payload.recordLabel ? `Record: ${payload.recordLabel}` : '',
        payload.recordId ? `Record ID: ${payload.recordId}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      url: `${window.location.origin}${payload.pagePath}`,
      userAgent: navigator.userAgent,
      timestamp: payload.clientTimestamp,
    }),
  });
}

/**
 * One-click report from error toasts. Tries authenticated issue report first,
 * then anonymous client-error logging.
 */
export async function submitQuickIssueReport(draft: IssueReportDraft = {}) {
  try {
    return await submitIssueReport(draft);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const res = await submitAnonymousErrorReport(draft);
      if (!res.ok) throw new Error('Could not submit report');
      return { anonymous: true };
    }
    throw error;
  }
}
