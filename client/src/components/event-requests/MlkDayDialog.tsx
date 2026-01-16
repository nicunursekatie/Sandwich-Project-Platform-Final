import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { getMlkDayString } from '@/lib/mlk-day-utils';
import { cn } from '@/lib/utils';

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
    <AlertDialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
      <AlertDialogPrimitive.Portal>
        {/* Higher z-index overlay to appear above parent dialog */}
        <AlertDialogPrimitive.Overlay
          className="fixed inset-0 z-[10100] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <AlertDialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[10101] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "sm:rounded-lg"
          )}
        >
          <div className="flex flex-col space-y-2 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <Heart className="w-6 h-6 text-purple-600 fill-purple-600" />
              <AlertDialogPrimitive.Title className="text-lg font-semibold">
                MLK Day of Service Event?
              </AlertDialogPrimitive.Title>
            </div>
            <AlertDialogPrimitive.Description className="text-sm text-muted-foreground pt-2">
              This event is scheduled during MLK Day week ({mlkDayString}).
              <br /><br />
              Would you like to designate this as an <strong>MLK Day of Service</strong> event?
              This will add a special badge and help us track our MLK Day service impact.
            </AlertDialogPrimitive.Description>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0">
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
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
