/**
 * Three-state van-needed control for event request cards.
 *
 * States:
 *  - Confirmed (`vanDriverNeeded` true): solid teal "Van Needed" badge.
 *  - Likely (`vanNeededLikely` true, `vanDriverNeeded` false): amber-outline
 *    "Van Likely Needed" badge; click to upgrade to confirmed.
 *  - Unknown (both false): small "Needs Van?" button. Clicking opens a dialog
 *    with [Possibly / For sure / Cancel].
 *
 * Sets fields via PATCH. The Mark-Scheduled flow has its own inline panel that
 * picks up the "likely" state when the user transitions the event; this control
 * is for the in-process tab where the user is still triaging logistics.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Truck, HelpCircle } from 'lucide-react';
import { apiRequest, queryClient, invalidateEventRequestQueries } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface VanNeededBadgeAndButtonProps {
  eventRequestId: number;
  vanDriverNeeded: boolean | null | undefined;
  vanNeededLikely: boolean | null | undefined;
  canEdit?: boolean;
}

type VanChoice = 'likely' | 'confirmed';

export function VanNeededBadgeAndButton({
  eventRequestId,
  vanDriverNeeded,
  vanNeededLikely,
  canEdit = true,
}: VanNeededBadgeAndButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest('PATCH', `/api/event-requests/${eventRequestId}`, data),
    onSuccess: () => {
      invalidateEventRequestQueries(queryClient);
      setDialogOpen(false);
    },
    onError: () => {
      toast({
        title: 'Could not update van status',
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const applyChoice = (choice: VanChoice) => {
    if (choice === 'confirmed') {
      // Confirmed wins — clear the soft flag if it was set.
      updateMutation.mutate({ vanDriverNeeded: true, vanNeededLikely: false });
    } else {
      updateMutation.mutate({ vanNeededLikely: true, vanDriverNeeded: false });
    }
  };

  const clearVan = () => {
    updateMutation.mutate({ vanDriverNeeded: false, vanNeededLikely: false });
  };

  // CONFIRMED — solid teal badge
  if (vanDriverNeeded) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              onClick={() => canEdit && setDialogOpen(true)}
              className={`inline-flex items-center gap-1 whitespace-nowrap bg-[#007E8C] text-white border-transparent ${canEdit ? 'cursor-pointer hover:opacity-80' : ''}`}
              data-testid="badge-van-needed"
            >
              <Truck className="w-3 h-3" />
              Van Needed
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {canEdit ? <p>A van has been confirmed as needed. Click to change.</p> : <p>A van is needed for this event.</p>}
          </TooltipContent>
        </Tooltip>

        <VanChoiceDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          current="confirmed"
          onChoose={applyChoice}
          onClear={clearVan}
          isSaving={updateMutation.isPending}
        />
      </TooltipProvider>
    );
  }

  // LIKELY — amber outline badge
  if (vanNeededLikely) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              onClick={() => canEdit && setDialogOpen(true)}
              className={`inline-flex items-center gap-1 whitespace-nowrap bg-amber-50 text-amber-700 border-amber-300 ${canEdit ? 'cursor-pointer hover:bg-amber-100' : ''}`}
              data-testid="badge-van-likely-needed"
            >
              <Truck className="w-3 h-3" />
              Van Likely Needed
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Flagged as likely needing a van. You'll be prompted to confirm when scheduling.</p>
            {canEdit && <p className="text-xs text-muted-foreground mt-1">Click to change.</p>}
          </TooltipContent>
        </Tooltip>

        <VanChoiceDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          current="likely"
          onChoose={applyChoice}
          onClear={clearVan}
          isSaving={updateMutation.isPending}
        />
      </TooltipProvider>
    );
  }

  // UNKNOWN — show the "Needs Van?" button (only when editable)
  if (!canEdit) return null;
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setDialogOpen(true)}
        className="h-6 px-2 text-xs border-slate-300 text-slate-600 hover:bg-slate-100"
        data-testid="button-needs-van"
      >
        <HelpCircle className="w-3 h-3 mr-1" />
        Needs Van?
      </Button>

      <VanChoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        current="none"
        onChoose={applyChoice}
        onClear={clearVan}
        isSaving={updateMutation.isPending}
      />
    </>
  );
}

interface VanChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the current state is, so we can show the right CTAs/clear option. */
  current: 'none' | 'likely' | 'confirmed';
  onChoose: (choice: VanChoice) => void;
  onClear: () => void;
  isSaving: boolean;
}

function VanChoiceDialog({
  open,
  onOpenChange,
  current,
  onChoose,
  onClear,
  isSaving,
}: VanChoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Will this event need a van?</DialogTitle>
          <DialogDescription>
            {current === 'none'
              ? "Flag this now so the team is reminded to confirm before scheduling."
              : current === 'likely'
                ? "Currently flagged as likely. You can confirm it now or change the flag."
                : "Currently confirmed as needing a van. You can downgrade or clear the flag."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Button
            type="button"
            variant={current === 'confirmed' ? 'secondary' : 'default'}
            disabled={isSaving || current === 'confirmed'}
            onClick={() => onChoose('confirmed')}
            className="w-full justify-start bg-[#007E8C] hover:bg-[#006873] text-white disabled:opacity-50"
            data-testid="button-van-confirmed"
          >
            <Truck className="w-4 h-4 mr-2" />
            For sure — van is needed
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isSaving || current === 'likely'}
            onClick={() => onChoose('likely')}
            className="w-full justify-start border-amber-300 text-amber-700 hover:bg-amber-50"
            data-testid="button-van-likely"
          >
            <Truck className="w-4 h-4 mr-2" />
            Possibly — flag as likely
          </Button>

          {current !== 'none' && (
            <Button
              type="button"
              variant="ghost"
              disabled={isSaving}
              onClick={onClear}
              className="w-full justify-start text-slate-500 hover:text-slate-700"
              data-testid="button-van-clear"
            >
              Clear the flag — van not needed
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
