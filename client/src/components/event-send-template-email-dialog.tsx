import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Send,
  Loader2,
  Check,
  ArrowLeftRight,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface EventSendTemplateEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: number;
  recipientEmail?: string;
  recipientName?: string;
  isReturning?: boolean; // Whether this is a returning organization
  onEmailSent?: () => void;
}

interface TemplateData {
  newOrgSubject: string;
  newOrgBody: string;
  returningContactSubject: string;
  returningContactBody: string;
}

type DialogState = 'compose' | 'sending' | 'sent';

export default function EventSendTemplateEmailDialog({
  isOpen,
  onClose,
  eventId,
  recipientEmail,
  recipientName,
  isReturning = false,
  onEmailSent,
}: EventSendTemplateEmailDialogProps) {
  const { toast } = useToast();
  const [useReturningTemplate, setUseReturningTemplate] = useState(isReturning);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dialogState, setDialogState] = useState<DialogState>('compose');
  const [sentResult, setSentResult] = useState<{
    sentTo: string;
    sentAt: string;
    processedSubject: string;
    processedBody: string;
  } | null>(null);

  // Fetch user's templates
  const { data: templates } = useQuery<TemplateData>({
    queryKey: ['/api/user/email-templates'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/user/email-templates');
      return res.json();
    },
    enabled: isOpen,
  });

  // Load template into form when templates load or when template type toggles
  useEffect(() => {
    if (!templates) return;
    if (useReturningTemplate) {
      setSubject(templates.returningContactSubject);
      setBody(templates.returningContactBody);
    } else {
      setSubject(templates.newOrgSubject);
      setBody(templates.newOrgBody);
    }
  }, [templates, useReturningTemplate]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setDialogState('compose');
      setSentResult(null);
      setUseReturningTemplate(isReturning);
      // Reset subject/body to template defaults so edited-but-unsent content doesn't persist
      if (templates) {
        if (isReturning) {
          setSubject(templates.returningContactSubject);
          setBody(templates.returningContactBody);
        } else {
          setSubject(templates.newOrgSubject);
          setBody(templates.newOrgBody);
        }
      } else {
        setSubject('');
        setBody('');
      }
    }
  }, [isOpen, isReturning]);

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/events/${eventId}/send-email`, {
        subject,
        body,
        templateType: useReturningTemplate ? 'returning_contact' : 'new_org',
      });
      return res.json();
    },
    onMutate: () => {
      setDialogState('sending');
    },
    onSuccess: (data) => {
      setDialogState('sent');
      setSentResult({
        sentTo: data.sentTo,
        sentAt: data.sentAt,
        processedSubject: data.processedSubject,
        processedBody: data.processedBody,
      });
      // Invalidate email logs for this event
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/email-logs`] });
      onEmailSent?.();
      toast({
        title: 'Email sent',
        description: `Email sent to ${data.sentTo}`,
      });
    },
    onError: (error: any) => {
      setDialogState('compose');
      toast({
        title: 'Failed to send',
        description: error?.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    setDialogState('compose');
    setSentResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {dialogState === 'sent' ? 'Email Sent' : 'Send Email to Organizer'}
          </DialogTitle>
        </DialogHeader>

        {/* COMPOSE STATE */}
        {dialogState === 'compose' && (
          <div className="space-y-4">
            {/* Recipient info */}
            {recipientEmail && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>To:</span>
                <Badge variant="secondary">
                  {recipientName ? `${recipientName} <${recipientEmail}>` : recipientEmail}
                </Badge>
              </div>
            )}

            {/* Template toggle */}
            <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
              <span className="text-sm font-medium">
                Template: {useReturningTemplate ? 'Returning Contact' : 'New Organization'}
              </span>
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-3 h-3 text-muted-foreground" />
                <Switch
                  checked={useReturningTemplate}
                  onCheckedChange={setUseReturningTemplate}
                />
                <span className="text-xs text-muted-foreground">
                  {useReturningTemplate ? 'Returning' : 'New'}
                </span>
              </div>
            </div>

            {/* Subject */}
            <div>
              <Label htmlFor="send-subject">Subject</Label>
              <Input
                id="send-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>

            {/* Body */}
            <div>
              <Label htmlFor="send-body">Body</Label>
              <Textarea
                id="send-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                placeholder="Email body..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Merge variables like {'{{contact_name}}'} will be replaced with actual data when sent.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={!subject.trim() || !body.trim()}
              >
                <Send className="w-4 h-4 mr-2" />
                Send Email
              </Button>
            </div>
          </div>
        )}

        {/* SENDING STATE */}
        {dialogState === 'sending' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Sending email...</p>
          </div>
        )}

        {/* SENT STATE */}
        {dialogState === 'sent' && sentResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 mb-4">
              <Check className="w-5 h-5" />
              <span className="font-medium">Email sent successfully</span>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">To:</span>{' '}
                <span className="font-medium">{sentResult.sentTo}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Sent at:</span>{' '}
                <span>{new Date(sentResult.sentAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Subject:</span>{' '}
                <span className="font-medium">{sentResult.processedSubject}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Body:</span>
                <div className="mt-1 p-3 bg-muted rounded-md whitespace-pre-wrap text-xs max-h-[200px] overflow-y-auto">
                  {sentResult.processedBody}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
