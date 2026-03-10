import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { AlarmClock, Bell, BellOff, Loader2, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface ReminderRulesManagerProps {
  eventRequestId: number;
  tspContactUserId?: string | null;
  eventStatus?: string | null;
}

// Rule type definitions with context-appropriate availability
const RULE_TYPE_CONFIG = {
  no_contact: {
    label: 'No Contact Logged',
    description: 'Remind me if no contact attempt has been logged',
    defaultThreshold: 5,
    thresholdLabel: 'days without contact',
    applicableStatuses: ['new', 'in_process'],
  },
  stale_event: {
    label: 'Stale / No Updates',
    description: 'Remind me if the event has had no updates',
    defaultThreshold: 7,
    thresholdLabel: 'days without updates',
    applicableStatuses: ['new', 'in_process'],
  },
  date_approaching_inprocess: {
    label: 'Desired Date Approaching',
    description: 'Remind me when the desired date is nearing while still in process',
    defaultThreshold: 14,
    thresholdLabel: 'days before desired date',
    applicableStatuses: ['new', 'in_process'],
  },
  date_approaching_scheduled: {
    label: 'Event Date Approaching',
    description: 'Remind me as the scheduled event date approaches',
    defaultThreshold: 7,
    thresholdLabel: 'days before event',
    applicableStatuses: ['scheduled'],
  },
  staffing_unmet: {
    label: 'Staffing Needs Unmet',
    description: 'Remind me if staffing needs are still unmet',
    defaultThreshold: 7,
    thresholdLabel: 'days before event with unmet needs',
    applicableStatuses: ['scheduled'],
  },
  general_checkin: {
    label: 'General Check-In',
    description: 'Periodic reminder to check in on this event',
    defaultThreshold: 7,
    thresholdLabel: 'N/A (uses frequency)',
    applicableStatuses: ['new', 'in_process', 'scheduled', 'stalled'],
  },
} as const;

type RuleType = keyof typeof RULE_TYPE_CONFIG;

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'every_3_days', label: 'Every 3 days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
];

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'both', label: 'Email & SMS' },
];

interface ReminderRule {
  id?: number;
  ruleType: string;
  enabled: boolean;
  thresholdDays: number;
  frequency: string;
  channel: string;
  lastSentAt?: string | null;
}

export function ReminderRulesManager({
  eventRequestId,
  tspContactUserId,
  eventStatus,
}: ReminderRulesManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Only show if the current user is the assigned TSP contact
  const isAssignedContact = user?.id && tspContactUserId && user.id === tspContactUserId;
  if (!isAssignedContact) return null;

  const { data, isLoading } = useQuery({
    queryKey: ['check-in-reminder', eventRequestId],
    queryFn: async () => {
      const res = await fetch(`/api/event-check-in-reminders/${eventRequestId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch reminders');
      return res.json();
    },
    enabled: isOpen,
  });

  const existingRules: ReminderRule[] = data?.reminders || [];
  const activeRuleCount = existingRules.filter((r: ReminderRule) => r.enabled).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 relative ${
            activeRuleCount > 0
              ? 'text-[#007E8C] hover:bg-[#007E8C]/10'
              : 'text-gray-400 hover:bg-gray-100'
          }`}
          title={activeRuleCount > 0 ? `${activeRuleCount} active reminder(s)` : 'Set up reminders'}
        >
          <AlarmClock className="w-4 h-4" />
          {activeRuleCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#007E8C] rounded-full text-white text-[8px] flex items-center justify-center font-bold">
              {activeRuleCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlarmClock className="w-5 h-5 text-[#007E8C]" />
            Reminder Rules
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Configure when you want to be reminded about this event.
          </p>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#007E8C]" />
          </div>
        ) : (
          <RulesEditor
            eventRequestId={eventRequestId}
            existingRules={existingRules}
            eventStatus={eventStatus || 'new'}
            onSaved={() => {
              queryClient.invalidateQueries({
                queryKey: ['check-in-reminder', eventRequestId],
              });
              toast({
                title: 'Reminders saved',
                description: 'Your reminder rules have been updated.',
              });
            }}
            onError={() => {
              toast({
                title: 'Error',
                description: 'Failed to save reminder settings.',
                variant: 'destructive',
              });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RulesEditor({
  eventRequestId,
  existingRules,
  eventStatus,
  onSaved,
  onError,
}: {
  eventRequestId: number;
  existingRules: ReminderRule[];
  eventStatus: string;
  onSaved: () => void;
  onError: () => void;
}) {
  // Build local state from existing rules
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [defaultChannel, setDefaultChannel] = useState('email');
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (!hasInitialized || existingRules.length > 0) {
      setRules(existingRules.length > 0 ? existingRules.map(r => ({ ...r })) : []);
      if (existingRules.length > 0) {
        setDefaultChannel(existingRules[0].channel || 'email');
      }
      setHasInitialized(true);
    }
  }, [existingRules]);

  // Available rule types for the current event status
  const availableRuleTypes = useMemo(() => {
    return (Object.entries(RULE_TYPE_CONFIG) as [RuleType, typeof RULE_TYPE_CONFIG[RuleType]][])
      .filter(([_, config]) => (config.applicableStatuses as readonly string[]).includes(eventStatus))
      .map(([type, config]) => ({ type, ...config }));
  }, [eventStatus]);

  // Rule types not yet added
  const addableRuleTypes = useMemo(() => {
    const existingTypes = new Set(rules.map(r => r.ruleType));
    return availableRuleTypes.filter(rt => !existingTypes.has(rt.type));
  }, [availableRuleTypes, rules]);

  const bulkSaveMutation = useMutation({
    mutationFn: async (rulesToSave: ReminderRule[]) => {
      const res = await fetch('/api/event-check-in-reminders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventRequestId,
          rules: rulesToSave.map(r => ({
            ruleType: r.ruleType,
            enabled: r.enabled,
            thresholdDays: r.thresholdDays,
            frequency: r.frequency,
            channel: r.channel,
          })),
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: onSaved,
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: async (ruleType: string) => {
      const res = await fetch(`/api/event-check-in-reminders/${eventRequestId}/${ruleType}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: onSaved,
    onError,
  });

  const addRule = (ruleType: RuleType) => {
    const config = RULE_TYPE_CONFIG[ruleType];
    setRules(prev => [
      ...prev,
      {
        ruleType,
        enabled: true,
        thresholdDays: config.defaultThreshold,
        frequency: 'weekly',
        channel: defaultChannel,
      },
    ]);
  };

  const updateRule = (index: number, updates: Partial<ReminderRule>) => {
    setRules(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const removeRule = (index: number) => {
    const rule = rules[index];
    if (rule.id) {
      // Delete from server
      deleteMutation.mutate(rule.ruleType);
    }
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const enabledRules = rules.filter(r => r.enabled);
    const disabledRules = rules.filter(r => !r.enabled);
    bulkSaveMutation.mutate([...enabledRules, ...disabledRules]);
  };

  const isSaving = bulkSaveMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-4 mt-2">
      {/* Global channel preference */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
        <Label className="text-sm font-medium text-gray-700">Notify via</Label>
        <Select
          value={defaultChannel}
          onValueChange={(val) => {
            setDefaultChannel(val);
            // Apply to all rules
            setRules(prev => prev.map(r => ({ ...r, channel: val })));
          }}
        >
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Existing rules */}
      {rules.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          No reminders configured. Add one below.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => {
            const config = RULE_TYPE_CONFIG[rule.ruleType as RuleType];
            if (!config) return null;

            return (
              <div
                key={rule.ruleType}
                className={`border rounded-lg p-3 space-y-3 transition-colors ${
                  rule.enabled ? 'border-[#007E8C]/30 bg-[#007E8C]/5' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => updateRule(index, { enabled: checked })}
                      className="flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${rule.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                        {config.label}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{config.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
                    onClick={() => removeRule(index)}
                    title="Remove rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {rule.enabled && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Threshold days - not shown for general_checkin */}
                    {rule.ruleType !== 'general_checkin' && (
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={rule.thresholdDays}
                          onChange={(e) => updateRule(index, { thresholdDays: parseInt(e.target.value) || 1 })}
                          className="w-16 h-7 text-sm text-center"
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">{config.thresholdLabel}</span>
                      </div>
                    )}

                    {/* Frequency */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Check</span>
                      <Select
                        value={rule.frequency}
                        onValueChange={(val) => updateRule(index, { frequency: val })}
                      >
                        <SelectTrigger className="w-32 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCY_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add rule button */}
      {addableRuleTypes.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-gray-500 uppercase tracking-wide">Add reminder</Label>
          <div className="grid gap-2">
            {addableRuleTypes.map((rt) => (
              <button
                key={rt.type}
                onClick={() => addRule(rt.type)}
                className="flex items-center gap-2 text-left px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-[#007E8C] hover:bg-[#007E8C]/5 transition-colors text-sm text-gray-600 hover:text-[#007E8C]"
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">{rt.label}</span>
                  <span className="text-xs text-gray-400 ml-2">{rt.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save button */}
      {rules.length > 0 && (
        <Button
          className="w-full bg-[#007E8C] hover:bg-[#006570] text-white"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Reminder Rules
        </Button>
      )}
    </div>
  );
}
