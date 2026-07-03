import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';
import { reportProblem, type IssueReportDraft } from '@/contexts/issue-report-context';
import { submitQuickIssueReport } from '@/lib/submit-issue-report';

export type ErrorToastOptions = {
  title: string;
  description?: string;
  duration?: number;
  /** Prefill the report form. `true` = derive from title/description. `false` = no Report button. */
  report?: boolean | IssueReportDraft;
};

function buildReportDraft(
  title: string,
  description: string | undefined,
  report: boolean | IssueReportDraft | undefined
): IssueReportDraft | null {
  if (report === false) return null;
  const extra = typeof report === 'object' ? report : {};
  return {
    whatDoing: extra.whatDoing ?? title,
    expectedOutcome: extra.expectedOutcome ?? 'The action should complete successfully.',
    actualOutcome:
      extra.actualOutcome ?? [title, description].filter(Boolean).join(': '),
    pageLabel: extra.pageLabel,
    recordType: extra.recordType,
    recordId: extra.recordId,
    recordLabel: extra.recordLabel,
  };
}

/** Destructive toast with an optional "Report this" action (works outside React hooks). */
export function errorToast({
  title,
  description,
  duration = 10000,
  report = true,
}: ErrorToastOptions) {
  const draft = buildReportDraft(title, description, report);

  return toast({
    variant: 'destructive',
    title,
    description,
    duration,
    action: draft ? (
      <ToastAction
        altText="Report this problem"
        onClick={(event) => {
          event.preventDefault();
          void submitQuickIssueReport(draft)
            .then(() => {
              toast({
                title: 'Report submitted',
                description: 'Thanks — the team will review what happened.',
                duration: 8000,
              });
            })
            .catch(() => {
              reportProblem(draft);
            });
        }}
      >
        Report this
      </ToastAction>
    ) : undefined,
  });
}

export function useErrorToast() {
  return { errorToast };
}
