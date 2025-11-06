import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { getMlkDayString } from '@/lib/mlk-day-utils';

interface MlkDayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMarkAsMLK: () => void;
  onSkip: () => void;
  eventDate: Date | string;
}

export function MlkDayDialog({
  isOpen,
  onClose,
  onMarkAsMLK,
  onSkip,
  eventDate,
}: MlkDayDialogProps) {
  const date = typeof eventDate === 'string' ? new Date(eventDate) : eventDate;
  const year = date.getFullYear();
  const mlkDayString = getMlkDayString(year);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-purple-600 fill-purple-600" />
            <DialogTitle>MLK Day of Service Event?</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            This event is scheduled during MLK Day week ({mlkDayString}).
            <br /><br />
            Would you like to designate this as an <strong>MLK Day of Service</strong> event? 
            This will add a special badge and help us track our MLK Day service impact.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onSkip}
            data-testid="button-skip-mlk"
          >
            Not an MLK Event
          </Button>
          <Button
            onClick={onMarkAsMLK}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            data-testid="button-mark-mlk"
          >
            <Heart className="w-4 h-4 mr-2 fill-white" />
            Yes, Mark as MLK Day Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
