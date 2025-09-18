import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Mail,
  Phone,
  Clock,
} from 'lucide-react';
import type { EventRequest } from '@shared/schema';

// Follow-up Dialog Component
interface FollowUpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest | null;
  onFollowUpCompleted: (notes: string) => void;
  isLoading: boolean;
  followUpType: '1-day' | '1-month';
  notes: string;
  setNotes: (notes: string) => void;
}

const FollowUpDialog: React.FC<FollowUpDialogProps> = ({
  isOpen,
  onClose,
  eventRequest,
  onFollowUpCompleted,
  isLoading,
  followUpType,
  notes,
  setNotes,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFollowUpCompleted(notes);
  };

  if (!eventRequest) return null;

  const isOneDay = followUpType === '1-day';
  const title = isOneDay ? '1-Day Follow-up' : '1-Month Follow-up';
  const description = isOneDay 
    ? 'Record follow-up communication one day after the event'
    : 'Record follow-up communication one month after the event';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-orange-600" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>
            {description} with{' '}
            <strong>
              {eventRequest.firstName} {eventRequest.lastName}
            </strong>{' '}
            at <strong>{eventRequest.organizationName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Information */}
          <div className="bg-[#e6f2f5] border border-[#007E8C]/20 rounded-lg p-3">
            <h4 className="font-medium text-[#1A2332] mb-2">Event Details</h4>
            <div className="space-y-1 text-sm">
                              <div><strong>Event Date:</strong> {
                                eventRequest.desiredEventDate ? 
                                  (eventRequest.desiredEventDate instanceof Date ? 
                                    eventRequest.desiredEventDate.toLocaleDateString() : 
                                    eventRequest.desiredEventDate.toString()) : 
                                  'Not specified'
                              }</div>
              <div><strong>Address:</strong> {eventRequest.eventAddress || 'Not specified'}</div>
              <div><strong>Estimated Sandwiches:</strong> {eventRequest.estimatedSandwichCount || 'Not specified'}</div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-[#e6f2f5] border border-[#007E8C]/30 rounded-lg p-3">
            <h4 className="font-medium text-[#1A2332] mb-2">Contact Information</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-[#007E8C]" />
                <span>{eventRequest.email}</span>
              </div>
              {eventRequest.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-[#007E8C]" />
                  <span>{eventRequest.phone}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const phoneNumber = eventRequest.phone;
                      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                      
                      if (isMobile) {
                        window.location.href = `tel:${phoneNumber}`;
                      } else {
                        navigator.clipboard.writeText(phoneNumber || '');
                      }
                    }}
                    className="ml-auto text-xs"
                  >
                    {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'Call' : 'Copy'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Follow-up Notes */}
          <div className="space-y-2">
            <Label htmlFor="followup-notes">Follow-up Notes</Label>
            <Textarea
              id="followup-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`Record notes from your ${followUpType} follow-up communication...`}
              className="min-h-[120px]"
              required
            />
          </div>

          {/* Information */}
          <div className={`${isOneDay ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'} border rounded-lg p-3`}>
            <h4 className={`font-medium ${isOneDay ? 'text-orange-900' : 'text-green-900'} mb-2`}>
              {title} Guidelines:
            </h4>
            <ul className={`text-sm ${isOneDay ? 'text-orange-800' : 'text-green-800'} space-y-1`}>
              {isOneDay ? (
                <>
                  <li>• Ask how the event went and if there were any issues</li>
                  <li>• Gather feedback on sandwich quality and quantity</li>
                  <li>• Note any suggestions for future events</li>
                </>
              ) : (
                <>
                  <li>• Check if they're planning any future events</li>
                  <li>• Ask about their overall experience with TSP</li>
                  <li>• Gather feedback for program improvement</li>
                </>
              )}
            </ul>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!notes.trim() || isLoading}
              className={`text-white ${isOneDay ? 'bg-orange-600 hover:bg-orange-700' : 'bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)]'}`}
              data-testid={`button-confirm-followup-${followUpType}`}
            >
              {isLoading ? 'Saving...' : `Complete ${title}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FollowUpDialog;