import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface CheckInReminderToggleProps {
  eventRequestId: number;
  tspContactUserId?: string | null;
}

const frequencyLabels: Record<string, string> = {
  daily: 'Daily',
  every_3_days: 'Every 3 days',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
};

const channelLabels: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  both: 'Email & SMS',
};

export function CheckInReminderToggle({
  eventRequestId,
  tspContactUserId,
}: CheckInReminderToggleProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Only show if the current user is the TSP contact
  const isAssignedContact = user?.id && tspContactUserId && user.id === tspContactUserId;
  if (!isAssignedContact) return null;

  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['check-in-reminder', eventRequestId],
    queryFn: async () => {
      const res = await fetch(`/api/event-check-in-reminders/${eventRequestId}`);
      if (!res.ok) throw new Error('Failed to fetch reminder');
      return res.json();
    },
  });

  const reminder = data?.reminder;
  const isEnabled = reminder?.enabled ?? false;

  const saveMutation = useMutation({
    mutationFn: async (settings: {
      enabled: boolean;
      frequency: string;
      channel: string;
    }) => {
      const res = await fetch('/api/event-check-in-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventRequestId,
          ...settings,
        }),
      });
      if (!res.ok) throw new Error('Failed to save reminder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['check-in-reminder', eventRequestId],
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save reminder settings',
        variant: 'destructive',
      });
    },
  });

  const handleQuickToggle = () => {
    if (isEnabled) {
      // Turn off
      saveMutation.mutate({
        enabled: false,
        frequency: reminder?.frequency || 'weekly',
        channel: reminder?.channel || 'email',
      });
      toast({ title: 'Reminder turned off', description: 'You will no longer receive check-in reminders for this event.' });
    } else {
      // Turn on with defaults or existing settings
      saveMutation.mutate({
        enabled: true,
        frequency: reminder?.frequency || 'weekly',
        channel: reminder?.channel || 'email',
      });
      toast({ title: 'Reminder turned on', description: 'You will receive weekly check-in reminders for this event.' });
    }
  };

  const handleSave = (frequency: string, channel: string) => {
    saveMutation.mutate({ enabled: true, frequency, channel });
    setIsOpen(false);
    toast({
      title: 'Reminder updated',
      description: `You'll receive ${frequencyLabels[frequency]?.toLowerCase()} reminders via ${channelLabels[channel]?.toLowerCase()}.`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1.5 text-xs px-2 ${
              isEnabled
                ? 'text-[#007E8C] hover:bg-[#007E8C]/10'
                : 'text-gray-400 hover:bg-gray-100'
            }`}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isEnabled ? (
              <Bell className="w-3.5 h-3.5" />
            ) : (
              <BellOff className="w-3.5 h-3.5" />
            )}
            {isEnabled ? (
              <span>
                {frequencyLabels[reminder?.frequency || 'weekly']}
              </span>
            ) : (
              <span>Remind me</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4" align="end">
          <ReminderSettings
            enabled={isEnabled}
            frequency={reminder?.frequency || 'weekly'}
            channel={reminder?.channel || 'email'}
            onToggle={handleQuickToggle}
            onSave={handleSave}
            isSaving={saveMutation.isPending}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ReminderSettings({
  enabled,
  frequency,
  channel,
  onToggle,
  onSave,
  isSaving,
}: {
  enabled: boolean;
  frequency: string;
  channel: string;
  onToggle: () => void;
  onSave: (frequency: string, channel: string) => void;
  isSaving: boolean;
}) {
  const [localFrequency, setLocalFrequency] = useState(frequency);
  const [localChannel, setLocalChannel] = useState(channel);

  useEffect(() => {
    setLocalFrequency(frequency);
    setLocalChannel(channel);
  }, [frequency, channel]);

  const hasChanges = localFrequency !== frequency || localChannel !== channel;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="reminder-toggle" className="text-sm font-semibold">
          Check-in Reminders
        </Label>
        <Switch
          id="reminder-toggle"
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={isSaving}
        />
      </div>

      {enabled && (
        <>
          <div className="space-y-2">
            <Label className="text-xs text-gray-500">Frequency</Label>
            <Select value={localFrequency} onValueChange={setLocalFrequency}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="every_3_days">Every 3 days</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Every 2 weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-500">Notify via</Label>
            <Select value={localChannel} onValueChange={setLocalChannel}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="both">Email & SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasChanges && (
            <Button
              size="sm"
              className="w-full h-8 text-xs bg-[#007E8C] hover:bg-[#006570]"
              onClick={() => onSave(localFrequency, localChannel)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : null}
              Save Changes
            </Button>
          )}
        </>
      )}
    </div>
  );
}
