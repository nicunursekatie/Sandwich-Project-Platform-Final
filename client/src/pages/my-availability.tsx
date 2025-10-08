import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  addWeeks,
  subWeeks,
} from 'date-fns';
import {
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { insertAvailabilitySlotSchema } from '@shared/schema';
import type { AvailabilitySlot } from '@shared/schema';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { LoadingState } from '@/components/ui/loading';

const formSchema = insertAvailabilitySlotSchema.extend({
  startAt: z.string().min(1, 'Start date and time is required'),
  endAt: z.string().min(1, 'End date and time is required'),
});

type FormData = z.infer<typeof formSchema>;

export default function MyAvailability() {
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);

  const handleBack = () => {
    window.location.href = '/dashboard';
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Fetch availability slots
  const { data: slots = [], isLoading } = useQuery<AvailabilitySlot[]>({
    queryKey: ['/api/availability', user?.id],
    enabled: !!user?.id,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Omit<FormData, 'userId'>) =>
      apiRequest('/api/availability', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/availability'] });
      setDialogOpen(false);
      form.reset();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FormData> }) =>
      apiRequest(`/api/availability/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/availability'] });
      setDialogOpen(false);
      setEditingSlot(null);
      form.reset();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/availability/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/availability'] });
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: user?.id || '',
      startAt: '',
      endAt: '',
      status: 'available',
      notes: '',
    },
  });

  const onSubmit = (data: FormData) => {
    if (editingSlot) {
      updateMutation.mutate({ id: editingSlot.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (slot: AvailabilitySlot) => {
    setEditingSlot(slot);
    form.reset({
      userId: slot.userId,
      startAt: slot.startAt,
      endAt: slot.endAt,
      status: slot.status,
      notes: slot.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this availability slot?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setEditingSlot(null);
    form.reset({
      userId: user?.id || '',
      startAt: '',
      endAt: '',
      status: 'available',
      notes: '',
    });
    setDialogOpen(true);
  };

  const getSlotsForDay = (day: Date) => {
    return slots.filter((slot) => {
      const slotStart = parseISO(slot.startAt);
      const slotEnd = parseISO(slot.endAt);
      return isSameDay(slotStart, day) || isSameDay(slotEnd, day);
    });
  };

  if (isLoading) {
    return <LoadingState text="Loading availability..." size="lg" />;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Back Button Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-4"
          data-testid="button-back-to-dashboard"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Availability</h1>
        <Button
          onClick={handleAddNew}
          data-testid="button-add-availability"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Availability
        </Button>
      </div>

      {/* Weekly Calendar View */}
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Week of {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
              data-testid="button-previous-week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(new Date())}
              data-testid="button-current-week"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
              data-testid="button-next-week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const daySlots = getSlotsForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={`border rounded-lg p-3 min-h-[120px] ${
                  isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
              >
                <div className="font-semibold text-sm mb-2 text-gray-900">
                  {format(day, 'EEE')}
                  <div className="text-xs text-gray-500">{format(day, 'MMM dd')}</div>
                </div>
                <div className="space-y-1">
                  {daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`text-xs p-1.5 rounded cursor-pointer ${
                        slot.status === 'available'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                      onClick={() => handleEdit(slot)}
                      data-testid={`slot-${slot.id}`}
                    >
                      <Clock className="inline h-3 w-3 mr-1" />
                      {format(parseISO(slot.startAt), 'h:mm a')}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Availability Slots List */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          All Availability Slots
        </h2>

        {slots.length === 0 ? (
          <div
            className="text-center py-12"
            data-testid="empty-state"
          >
            <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">
              No availability slots set yet
            </p>
            <Button onClick={handleAddNew} data-testid="button-add-first">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Slot
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                data-testid={`slot-item-${slot.id}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge
                      className={
                        slot.status === 'available'
                          ? 'bg-green-100 text-green-800 border-green-300'
                          : 'bg-red-100 text-red-800 border-red-300'
                      }
                      data-testid={`badge-status-${slot.id}`}
                    >
                      {slot.status === 'available' ? 'Available' : 'Unavailable'}
                    </Badge>
                    <span className="text-sm font-medium text-gray-900">
                      {format(parseISO(slot.startAt), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <Clock className="inline h-4 w-4 mr-1" />
                    {format(parseISO(slot.startAt), 'h:mm a')} -{' '}
                    {format(parseISO(slot.endAt), 'h:mm a')}
                    {slot.endAt !== slot.startAt && 
                     !isSameDay(parseISO(slot.startAt), parseISO(slot.endAt)) && (
                      <span className="ml-1">
                        (ends {format(parseISO(slot.endAt), 'MMM dd, yyyy')})
                      </span>
                    )}
                  </div>
                  {slot.notes && (
                    <p className="text-sm text-gray-500 mt-1" data-testid={`notes-${slot.id}`}>
                      {slot.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(slot)}
                    data-testid={`button-edit-${slot.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(slot.id)}
                    data-testid={`button-delete-${slot.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSlot ? 'Edit Availability' : 'Add Availability'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="startAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date & Time</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select start date and time"
                        data-testid="input-start-datetime"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date & Time</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select end date and time"
                        data-testid="input-end-datetime"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Status</FormLabel>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Unavailable</span>
                        <FormControl>
                          <Switch
                            checked={field.value === 'available'}
                            onCheckedChange={(checked) =>
                              field.onChange(checked ? 'available' : 'unavailable')
                            }
                            data-testid="switch-status"
                          />
                        </FormControl>
                        <span className="text-sm text-gray-600">Available</span>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Add any notes about this availability"
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setEditingSlot(null);
                    form.reset();
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  data-testid="button-save"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
