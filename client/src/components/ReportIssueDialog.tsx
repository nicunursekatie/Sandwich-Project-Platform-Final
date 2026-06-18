import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import type { WorkingRecordContext } from '@/contexts/issue-report-context';
import { Loader2, MessageSquareWarning } from 'lucide-react';

const RECORD_TYPE_OPTIONS = [
  { value: 'event_request', label: 'Event request' },
  { value: 'collection', label: 'Collection' },
  { value: 'volunteer_signup', label: 'Volunteer signup' },
  { value: 'other', label: 'Other' },
];

function buildPagePath(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workingRecord: WorkingRecordContext | null;
}

export function ReportIssueDialog({
  open,
  onOpenChange,
  workingRecord,
}: ReportIssueDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [pagePath, setPagePath] = useState('');
  const [pageLabel, setPageLabel] = useState('');
  const [whatDoing, setWhatDoing] = useState('');
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [actualOutcome, setActualOutcome] = useState('');
  const [recordType, setRecordType] = useState('');
  const [recordId, setRecordId] = useState('');
  const [recordLabel, setRecordLabel] = useState('');

  useEffect(() => {
    if (!open) return;
    setPagePath(buildPagePath());
    setPageLabel(
      workingRecord?.pageLabel ||
        (typeof document !== 'undefined' ? document.title : '') ||
        ''
    );
    setRecordType(workingRecord?.recordType || '');
    setRecordId(workingRecord?.recordId || '');
    setRecordLabel(workingRecord?.recordLabel || '');
  }, [open, workingRecord]);

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/user-issue-reports', {
        pagePath,
        pageLabel: pageLabel.trim() || undefined,
        whatDoing: whatDoing.trim(),
        expectedOutcome: expectedOutcome.trim(),
        actualOutcome: actualOutcome.trim(),
        recordType: recordType || undefined,
        recordId: recordId.trim() || undefined,
        recordLabel: recordLabel.trim() || undefined,
        clientTimestamp: new Date().toISOString(),
      }),
    onSuccess: () => {
      toast({
        title: 'Report submitted',
        description: 'Thank you — the team will review what happened.',
        duration: 8000,
      });
      setWhatDoing('');
      setExpectedOutcome('');
      setActualOutcome('');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not submit report',
        description: error.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
    },
  });

  const canSubmit =
    !!user &&
    whatDoing.trim().length > 0 &&
    expectedOutcome.trim().length > 0 &&
    actualOutcome.trim().length > 0 &&
    pagePath.trim().length > 0;

  const reportedAtLabel = format(new Date(), 'MMM d, yyyy h:mm a');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-amber-600" />
            Report a problem
          </DialogTitle>
          <DialogDescription>
            Tell us what went wrong so we can fix it. Your name ({user?.email || 'signed-in user'})
            and the time of this report are saved automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Report time: </span>
            {reportedAtLabel}
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-page-label">Where were you in the app?</Label>
            <Input
              id="issue-page-label"
              value={pageLabel}
              onChange={(e) => setPageLabel(e.target.value)}
              placeholder="e.g. Event Management — Scheduled tab"
            />
            <p className="text-xs text-muted-foreground truncate" title={pagePath}>
              Path: {pagePath || '—'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-what-doing">What were you trying to do? *</Label>
            <Textarea
              id="issue-what-doing"
              value={whatDoing}
              onChange={(e) => setWhatDoing(e.target.value)}
              placeholder="e.g. Mark an event as scheduled after filling in the date and driver"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-expected">What did you expect to happen? *</Label>
            <Textarea
              id="issue-expected"
              value={expectedOutcome}
              onChange={(e) => setExpectedOutcome(e.target.value)}
              placeholder="e.g. The event should move to Scheduled and stay saved"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-actual">What actually happened? *</Label>
            <Textarea
              id="issue-actual"
              value={actualOutcome}
              onChange={(e) => setActualOutcome(e.target.value)}
              placeholder="e.g. I got a success toast but the event is still in In Process"
              rows={2}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Record type (optional)</Label>
              <Select
                value={recordType || 'none'}
                onValueChange={(v) => setRecordType(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not applicable</SelectItem>
                  {RECORD_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue-record-id">Record ID (optional)</Label>
              <Input
                id="issue-record-id"
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
                placeholder="e.g. 1234"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-record-label">Record name (optional)</Label>
            <Input
              id="issue-record-label"
              value={recordLabel}
              onChange={(e) => setRecordLabel(e.target.value)}
              placeholder="e.g. Acme Corp volunteer event"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit || submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit report'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
