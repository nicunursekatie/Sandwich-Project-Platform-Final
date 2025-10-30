import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, Mail, MessageSquare, X, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { EventRequest } from '@shared/schema';

interface LogContactAttemptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest | null;
  onLogContact: (data: {
    contactAttempts: number;
    lastContactAttempt: string;
    contactMethod: string;
    unresponsiveNotes: string;
    contactOutcome: string;
  }) => Promise<void>;
}

const CONTACT_METHODS = [
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'both', label: 'Phone & Email', icon: MessageSquare },
];

const CONTACT_OUTCOMES = [
  { value: 'successful', label: 'Successfully contacted - Got response' },
  { value: 'no_answer', label: 'No answer - No response' },
  { value: 'left_message', label: 'Left voicemail/message' },
  { value: 'wrong_number', label: 'Wrong/disconnected number' },
  { value: 'email_bounced', label: 'Email bounced/failed' },
  { value: 'requested_callback', label: 'Requested callback/follow-up' },
  { value: 'other', label: 'Other (see notes)' },
];

export default function LogContactAttemptDialog({
  isOpen,
  onClose,
  eventRequest,
  onLogContact,
}: LogContactAttemptDialogProps) {
  const { toast } = useToast();
  const [contactMethod, setContactMethod] = useState<string>('');
  const [contactOutcome, setContactOutcome] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [customDateTime, setCustomDateTime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default date/time to current when dialog opens
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setCustomDateTime(localDateTime);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!contactMethod || !contactOutcome) {
      toast({
        title: 'Missing information',
        description: 'Please select both contact method and outcome.',
        variant: 'destructive',
      });
      return;
    }

    if (!eventRequest) return;

    setIsSubmitting(true);
    try {
      const currentAttempts = eventRequest.contactAttempts || 0;
      const attemptNumber = currentAttempts + 1;

      // Use custom date/time or current time
      const contactDate = customDateTime ? new Date(customDateTime) : new Date();

      // Build the notes with structured information
      const timestamp = contactDate.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const methodLabel = CONTACT_METHODS.find(m => m.value === contactMethod)?.label || contactMethod;
      const outcomeLabel = CONTACT_OUTCOMES.find(o => o.value === contactOutcome)?.label || contactOutcome;

      const attemptLog = `[${timestamp}] Attempt #${attemptNumber} - ${methodLabel}: ${outcomeLabel}${notes ? `\n${notes}` : ''}`;

      // Append to existing unresponsive notes or create new
      const existingNotes = eventRequest.unresponsiveNotes || '';
      const updatedNotes = existingNotes
        ? `${existingNotes}\n\n${attemptLog}`
        : attemptLog;

      await onLogContact({
        contactAttempts: attemptNumber,
        lastContactAttempt: contactDate.toISOString(),
        contactMethod,
        unresponsiveNotes: updatedNotes,
        contactOutcome,
      });

      toast({
        title: 'Contact attempt logged',
        description: `Logged attempt #${attemptNumber} via ${methodLabel}`,
      });

      // Reset form
      setContactMethod('');
      setContactOutcome('');
      setNotes('');
      setCustomDateTime('');
      onClose();
    } catch (error) {
      toast({
        title: 'Failed to log contact',
        description: 'There was an error logging the contact attempt.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setContactMethod('');
      setContactOutcome('');
      setNotes('');
      setCustomDateTime('');
      onClose();
    }
  };

  if (!eventRequest) return null;

  const currentAttempts = eventRequest.contactAttempts || 0;
  const nextAttemptNumber = currentAttempts + 1;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md sm:max-w-lg" data-testid="dialog-log-contact">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-[#236383]">
            <MessageSquare className="w-5 h-5" />
            <span>Log Contact Attempt</span>
          </DialogTitle>
          <DialogDescription>
            Record your contact attempt for {eventRequest.firstName} {eventRequest.lastName} - {eventRequest.organizationName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Attempt Counter */}
          <div className="bg-gradient-to-r from-[#e6f2f5] to-[#f0f7f9] border border-[#007E8C]/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#007E8C] font-medium">Previous Attempts</p>
                <p className="text-2xl font-bold text-[#1A2332]">{currentAttempts}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#007E8C] font-medium">This Will Be</p>
                <p className="text-2xl font-bold text-[#FBAD3F]">Attempt #{nextAttemptNumber}</p>
              </div>
            </div>
            {eventRequest.lastContactAttempt && (
              <p className="text-xs text-gray-600 mt-2">
                Last attempt: {new Date(eventRequest.lastContactAttempt).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            )}
          </div>

          {/* Date/Time of Contact */}
          <div className="space-y-2">
            <Label htmlFor="contact-datetime" className="text-[#1A2332] font-medium">
              Date & Time of Contact *
            </Label>
            <Input
              id="contact-datetime"
              type="datetime-local"
              value={customDateTime}
              onChange={(e) => setCustomDateTime(e.target.value)}
              className="w-full"
              data-testid="input-contact-datetime"
            />
            <p className="text-xs text-gray-500">
              Defaults to current date/time. You can change this to log a contact from earlier.
            </p>
          </div>

          {/* Contact Method */}
          <div className="space-y-2">
            <Label htmlFor="contact-method" className="text-[#1A2332] font-medium">
              Contact Method *
            </Label>
            <Select value={contactMethod} onValueChange={setContactMethod}>
              <SelectTrigger id="contact-method" className="w-full">
                <SelectValue placeholder="Select how you contacted them" />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_METHODS.map((method) => {
                  const Icon = method.icon;
                  return (
                    <SelectItem key={method.value} value={method.value}>
                      <div className="flex items-center space-x-2">
                        <Icon className="w-4 h-4" />
                        <span>{method.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Contact Outcome */}
          <div className="space-y-2">
            <Label htmlFor="contact-outcome" className="text-[#1A2332] font-medium">
              What Happened? *
            </Label>
            <Select value={contactOutcome} onValueChange={setContactOutcome}>
              <SelectTrigger id="contact-outcome" className="w-full">
                <SelectValue placeholder="Select the outcome" />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_OUTCOMES.map((outcome) => (
                  <SelectItem key={outcome.value} value={outcome.value}>
                    {outcome.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="contact-notes" className="text-[#1A2332] font-medium">
              Notes (Optional)
            </Label>
            <Textarea
              id="contact-notes"
              placeholder="Add any additional details about this contact attempt..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              This will be saved with a timestamp and attempt number in the event record.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !contactMethod || !contactOutcome}
              className="flex-1 bg-[#007E8C] hover:bg-[#006B75] text-white"
              data-testid="button-submit-contact-log"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Logging...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Log Attempt #{nextAttemptNumber}
                </>
              )}
            </Button>
            <Button
              onClick={handleClose}
              disabled={isSubmitting}
              variant="outline"
              className="flex-1 sm:flex-none"
              data-testid="button-cancel-contact-log"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
