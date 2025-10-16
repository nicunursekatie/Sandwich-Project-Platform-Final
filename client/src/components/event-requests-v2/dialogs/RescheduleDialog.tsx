import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { CalendarIcon, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { EventRequest } from '@shared/schema';

interface RescheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: EventRequest | null;
  onReschedule: (eventId: number, newDate: Date) => void;
}

export const RescheduleDialog: React.FC<RescheduleDialogProps> = ({
  isOpen,
  onClose,
  request,
  onReschedule,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (request) {
      // Use scheduled date if available, otherwise fall back to desired date
      const currentDate = request.scheduledEventDate || request.desiredEventDate;
      setSelectedDate(currentDate ? new Date(currentDate) : undefined);
    }
  }, [request]);

  const handleSubmit = async () => {
    if (!request || !selectedDate) return;

    setIsSubmitting(true);
    try {
      await onReschedule(request.id, selectedDate);
      onClose();
    } catch (error) {
      console.error('Failed to reschedule event:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!request) return null;

  const originalDate = request.desiredEventDate ? new Date(request.desiredEventDate) : null;
  const currentScheduledDate = request.scheduledEventDate ? new Date(request.scheduledEventDate) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Reschedule Event</DialogTitle>
          <DialogDescription>
            Select a new date for the event at {request.organizationName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Show current dates for reference */}
          <div className="space-y-2 p-3 bg-gray-50 rounded-lg text-sm">
            {originalDate && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Originally Requested:</span>
                <span className="font-medium">{format(originalDate, 'PPP')}</span>
              </div>
            )}
            {currentScheduledDate && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Currently Scheduled:</span>
                <span className="font-medium">{format(currentScheduledDate, 'PPP')}</span>
              </div>
            )}
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label>New Event Date</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className="rounded-md border"
            />
          </div>

          {/* Warning if changing from original requested date */}
          {selectedDate && originalDate &&
           selectedDate.toDateString() !== originalDate.toDateString() && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">Different from requested date</p>
                <p className="text-amber-700">
                  The organizer originally requested {format(originalDate, 'PPP')}.
                  Make sure to communicate this change.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedDate || isSubmitting}
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Rescheduling...' : 'Reschedule Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};