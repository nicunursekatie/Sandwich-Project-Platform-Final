import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Clock } from 'lucide-react';
import type { EventRequest } from '@shared/schema';
import { logger } from '@/lib/logger';

const postponementFormSchema = z.object({
  postponementReason: z.string().min(1, 'Postponement reason is required'),
  tentativeNewDate: z.date().optional().nullable(),
  postponementNotes: z.string().optional(),
});

type PostponementFormData = z.infer<typeof postponementFormSchema>;

interface PostponementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: EventRequest | null;
  onPostpone: (eventId: number, data: {
    postponementReason: string;
    tentativeNewDate?: string;
    postponementNotes?: string;
  }) => Promise<void>;
}

export const PostponementDialog: React.FC<PostponementDialogProps> = ({
  isOpen,
  onClose,
  request,
  onPostpone,
}) => {
  const form = useForm<PostponementFormData>({
    resolver: zodResolver(postponementFormSchema),
    defaultValues: {
      postponementReason: '',
      tentativeNewDate: null,
      postponementNotes: '',
    },
  });

  // Reset form when dialog opens or request changes
  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        postponementReason: '',
        tentativeNewDate: null,
        postponementNotes: '',
      });
    }
  }, [isOpen, request, form]);

  const onSubmit = async (data: PostponementFormData) => {
    if (!request) return;

    try {
      const submitData = {
        postponementReason: data.postponementReason,
        tentativeNewDate: data.tentativeNewDate 
          ? format(data.tentativeNewDate, 'yyyy-MM-dd')
          : undefined,
        postponementNotes: data.postponementNotes || undefined,
      };

      await onPostpone(request.id, submitData);
      form.reset();
      onClose();
    } catch (error) {
      logger.error('Failed to postpone event:', error);
    }
  };

  if (!request) return null;

  const originalDate = request.desiredEventDate ? new Date(request.desiredEventDate) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        form.reset();
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Mark Event as Postponed
          </DialogTitle>
          <DialogDescription>
            Event: <strong>{request.organizationName}</strong>
            {request.department && ` - ${request.department}`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Show current event details */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Contact:</span>
                <span className="font-medium">{request.firstName} {request.lastName}</span>
              </div>
              {originalDate && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Originally Requested:</span>
                  <span className="font-medium">{format(originalDate, 'PPP')}</span>
                </div>
              )}
            </div>

            {/* Postponement Reason */}
            <FormField
              control={form.control}
              name="postponementReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    Postponement Reason <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Organizer requested different date, scheduling conflict, etc."
                      data-testid="input-postponement-reason"
                    />
                  </FormControl>
                  <FormDescription>
                    Briefly explain why this event is being postponed
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tentative New Date */}
            <FormField
              control={form.control}
              name="tentativeNewDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-base font-semibold">
                    Tentative New Date (Optional)
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                          data-testid="button-select-tentative-date"
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a tentative date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    If there's a potential future date, select it here
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Postponement Notes */}
            <FormField
              control={form.control}
              name="postponementNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    Additional Notes (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Any additional details about the postponement, follow-up plans, or context..."
                      rows={4}
                      data-testid="textarea-postponement-notes"
                    />
                  </FormControl>
                  <FormDescription>
                    Add any relevant details about the postponement situation
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  onClose();
                }}
                disabled={form.formState.isSubmitting}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="button-submit"
              >
                <Clock className="w-4 h-4 mr-2" />
                {form.formState.isSubmitting ? 'Postponing...' : 'Mark as Postponed'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
