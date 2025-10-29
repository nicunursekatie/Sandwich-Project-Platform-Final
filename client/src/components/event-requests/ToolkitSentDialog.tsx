import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  Shield,
  Mail,
  Phone,
  X,
} from 'lucide-react';
import { EventEmailComposer } from '@/components/event-email-composer';
import type { EventRequest } from '@shared/schema';
import { useIsMobile } from '@/hooks/use-mobile';

// ToolkitSentDialog Component - handles marking toolkit as sent and optionally sending email
interface ToolkitSentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest | null;
  onToolkitSent: (toolkitSentDate: string) => void;
  isLoading: boolean;
}

const ToolkitSentDialog = ({
  isOpen,
  onClose,
  eventRequest,
  onToolkitSent,
  isLoading,
}: ToolkitSentDialogProps) => {
  const isMobile = useIsMobile();
  const [toolkitSentDate, setToolkitSentDate] = useState('');
  const [toolkitSentTime, setToolkitSentTime] = useState('');
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Initialize date/time when dialog opens
  useEffect(() => {
    if (isOpen && eventRequest) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const timeStr = now.toTimeString().slice(0, 5); // HH:MM format
      setToolkitSentDate(dateStr);
      setToolkitSentTime(timeStr);
      setShowEmailComposer(false);
      setEmailSent(false);
    }
  }, [isOpen, eventRequest]);

  const handleSubmit = () => {
    if (!toolkitSentDate || !toolkitSentTime) return;

    // Combine date and time into ISO string
    const combinedDateTime = new Date(
      `${toolkitSentDate}T${toolkitSentTime}`
    ).toISOString();
    onToolkitSent(combinedDateTime);
  };

  const handleEmailSent = () => {
    setEmailSent(true);
    setShowEmailComposer(false);
  };

  if (!eventRequest) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="border-b border-[#007E8C]/10 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center space-x-2 text-[#236383] text-xl">
            <Shield className="w-5 h-5 text-[#007E8C]" aria-hidden="true" />
            <span>Mark Toolkit as Sent</span>
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2">
            Record when the toolkit was sent to{' '}
            <strong>
              {eventRequest.firstName} {eventRequest.lastName}
            </strong>{' '}
            at <strong>{eventRequest.organizationName}</strong>. This will move
            the event to "In Process" status.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">{!showEmailComposer ? (
          <div className="space-y-6 pt-4">
            {/* Date and Time Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="toolkit-sent-date" className="text-[#236383] font-medium">Toolkit Sent Date</Label>
                <Input
                  id="toolkit-sent-date"
                  type="date"
                  value={toolkitSentDate}
                  onChange={(e) => setToolkitSentDate(e.target.value)}
                  className="border-[#007E8C]/30 focus:border-[#007E8C] focus:ring-[#007E8C]/20"
                  data-testid="input-toolkit-sent-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toolkit-sent-time" className="text-[#236383] font-medium">Toolkit Sent Time</Label>
                <Input
                  id="toolkit-sent-time"
                  type="time"
                  value={toolkitSentTime}
                  onChange={(e) => setToolkitSentTime(e.target.value)}
                  className="border-[#007E8C]/30 focus:border-[#007E8C] focus:ring-[#007E8C]/20"
                  data-testid="input-toolkit-sent-time"
                />
              </div>
            </div>

            {/* Email Status Display */}
            {emailSent && (
              <div className="p-4 bg-[#007E8C]/5 border border-[#007E8C]/30 rounded-lg">
                <div className="flex items-center space-x-2 text-[#007E8C]">
                  <CheckCircle className="w-5 h-5" aria-hidden="true" />
                  <span className="font-semibold">Email successfully sent!</span>
                </div>
                <p className="text-sm text-[#236383] mt-1">
                  The toolkit email has been sent to {eventRequest.email}
                </p>
              </div>
            )}

            {/* Information */}
            <div className="bg-[#47B3CB]/5 border border-[#47B3CB]/30 rounded-lg p-4">
              <h4 className="font-semibold text-[#236383] uppercase tracking-wide text-sm mb-3">
                What happens when you mark toolkit as sent:
              </h4>
              <ul className="text-sm text-[#236383] space-y-2">
                <li>• Event status will change from "New" to "In Process"</li>
                <li>• Event will appear in the "In Process" tab</li>
                {!emailSent && (
                  <li>
                    • You can optionally send an email to{' '}
                    {eventRequest.firstName} with toolkit attachments
                  </li>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between space-x-4 pt-4 border-t border-[#007E8C]/10">
              <div className="flex space-x-2">
              {!emailSent && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEmailComposer(true)}
                  className="flex items-center space-x-2 border-[#007E8C]/30 text-[#007E8C] hover:bg-[#007E8C]/5"
                  data-testid="button-send-toolkit-email"
                >
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  <span>Send Toolkit Email</span>
                </Button>
              )}

                {eventRequest?.phone && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const phoneNumber = eventRequest.phone;

                      if (isMobile) {
                        // On mobile, open the dialer
                        window.location.href = `tel:${phoneNumber}`;
                      } else {
                        // On desktop, copy to clipboard
                        if (phoneNumber) {
                          navigator.clipboard.writeText(phoneNumber)
                            .then(() => {
                              window.alert(`Phone number copied!\n${phoneNumber} has been copied to your clipboard.`);
                            })
                            .catch(() => {
                              window.alert(`Failed to copy phone number.\nPlease copy manually: ${phoneNumber}`);
                            });
                        } else {
                          window.alert('No phone number available to copy.');
                        }
                      }
                    }}
                    className="flex items-center space-x-2 border-[#47B3CB]/30 text-[#47B3CB] hover:bg-[#47B3CB]/5"
                    data-testid="button-call-contact"
                    title={eventRequest.phone}
                  >
                    <Phone className="w-4 h-4" aria-hidden="true" />
                    <span>{isMobile ? 'Call' : 'Copy Number'}</span>
                  </Button>
                )}
              </div>

              <div className="flex space-x-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  data-testid="button-cancel-toolkit-sent"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!toolkitSentDate || !toolkitSentTime || isLoading}
                  className="bg-[#007E8C] hover:bg-[#236383] text-white shadow-sm"
                  data-testid="button-confirm-toolkit-sent"
                >
                  <Shield className="w-4 h-4 mr-2" aria-hidden="true" />
                  {isLoading ? 'Marking as Sent...' : 'Mark as Sent'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Send Toolkit Email</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmailComposer(false)}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
            <EventEmailComposer
              eventRequest={{
                ...eventRequest,
                firstName: eventRequest.firstName || '',
                lastName: eventRequest.lastName || '',
                organizationName: eventRequest.organizationName || '',
                email: eventRequest.email || '',
                phone: eventRequest.phone || undefined,
              } as any}
              onEmailSent={handleEmailSent}
              isOpen={showEmailComposer}
              onClose={() => setShowEmailComposer(false)}
            />
          </div>
        )}</div>
      </DialogContent>
    </Dialog>
  );
};

export default ToolkitSentDialog;