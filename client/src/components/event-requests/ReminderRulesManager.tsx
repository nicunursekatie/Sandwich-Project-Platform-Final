import { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { AlarmClock, Loader2, Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
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

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface ReminderRulesManagerProps {
  eventRequestId: number;
  tspContactUserId?: string | null;
  eventStatus?: string | null;
}

/**
 * Each rule type is either *condition-based* (system checks daily, fires when
 * the condition is met) or *frequency-based* (fires on a recurring cadence the
 * user chooses).  The config below drives both the UI and save-time
 * normalization so the rest of the code never needs to branch on this.
 */
const RULE_TYPE_CONFIG = {
  no_contact: {
    label: 'No Contact Logged',
    description: 'Alert when no contact has been logged for a set number of days',
    defaultThreshold: 5,
    thresholdPrefix: 'After',
    thresholdLabel: 'days with no contact',
    applicableStatuses: ['new', 'in_process'],
    isConditionBased: true,
  },
  stale_event: {
    label: 'Stale / No Updates',
    description: 'Alert when no updates have been made for a set number of days',
    defaultThreshold: 7,
    thresholdPrefix: 'After',
    thresholdLabel: 'days with no updates',
    applicableStatuses: ['new', 'in_process'],
    isConditionBased: true,
  },
  date_approaching_inprocess: {
    label: 'Desired Date Approaching',
    description: 'Alert when the desired event date is coming up soon',
    defaultThreshold: 14,
    thresholdPrefix: 'Within',
    thresholdLabel: 'days of desired date',
    applicableStatuses: ['new', 'in_process'],
    isConditionBased: true,
  },
  date_approaching_scheduled: {
    label: 'Event Date Approaching',
    description: 'Alert when the scheduled event date is coming up soon',
    defaultThreshold: 7,
    thresholdPrefix: 'Within',
    thresholdLabel: 'days of event',
    applicableStatuses: ['scheduled'],
    isConditionBased: true,
  },
  staffing_unmet: {
    label: 'Staffing Needs Unmet',
    description: 'Alert if roles are still unfilled close to the event date',
    defaultThreshold: 7,
    thresholdPrefix: 'Within',
    thresholdLabel: 'days of event',
    applicableStatuses: ['scheduled'],
    isConditionBased: true,
  },
  missing_details: {
    label: 'Missing Key Details',
    description: 'Alert if sandwich count/type, location, or pickup time are still missing',
    defaultThreshold: 7,
    thresholdPrefix: 'Within',
    thresholdLabel: 'days of event',
    applicableStatuses: ['scheduled'],
    isConditionBased: true,
  },
  general_checkin: {
    label: 'General Check-In',
    description: 'Periodic reminder to check in on this event',
    defaultThreshold: 7,
    thresholdLabel: '',
    applicableStatuses: ['new', 'in_process', 'scheduled', 'stalled'],
    isConditionBased: false,
  },
} as const;

type RuleType = keyof typeof RULE_TYPE_CONFIG;

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'every_3_days', label: 'Every 3 days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
] as const;

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'both', label: 'Email & SMS' },
] as const;

interface ReminderRule {
  id?: number;
  ruleType: string;
  enabled: boolean;
  thresholdDays: number;
  frequency: string;
  channel: string;
  lastSentAt?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Serialize rules into a stable string for dirty-state comparison. */
function serializeRules(rules: ReminderRule[]): string {
  return JSON.stringify(
    rules
      .map(r => ({
        ruleType: r.ruleType,
        enabled: r.enabled,
        thresholdDays: r.thresholdDays,
        frequency: r.frequency,
        channel: r.channel,
      }))
      .sort((a, b) => a.ruleType.localeCompare(b.ruleType)),
  );
}

/** Normalize rules before saving — condition-based rules always use 'daily'. */
function normalizeForSave(rules: ReminderRule[]): ReminderRule[] {
  return rules.map(r => {
    const config = RULE_TYPE_CONFIG[r.ruleType as RuleType];
    return config?.isConditionBased ? { ...r, frequency: 'daily' } : r;
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReminderRulesManager({
  eventRequestId,
  tspContactUserId,
  eventStatus,
}: ReminderRulesManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const editorDirtyRef = useRef(false);

  const isAssignedContact = user?.id && tspContactUserId && user.id === tspContactUserId;
  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';
  if (!isAssignedContact && !isAdminUser) return null;

  const { data, isLoading, dataUpdatedAt } = useQuery({
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

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && editorDirtyRef.current) {
        setShowUnsavedWarning(true);
        return;
      }
      setIsOpen(open);
    },
    [],
  );

  const handleDiscardAndClose = useCallback(() => {
    setShowUnsavedWarning(false);
    editorDirtyRef.current = false;
    setIsOpen(false);
  }, []);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-8 relative ${
              activeRuleCount > 0
                ? 'border-[#007E8C] text-[#007E8C] hover:bg-[#007E8C]/10'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
            title={activeRuleCount > 0 ? `${activeRuleCount} active reminder(s)` : 'Set up reminders'}
          >
            <AlarmClock className="w-4 h-4 mr-1" />
            Reminders
            {activeRuleCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-[#007E8C] text-white hover:bg-[#007E8C]"
              >
                {activeRuleCount}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <AlarmClock className="w-5 h-5 text-[#007E8C]" />
              Reminder Rules
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Configure when you want to be reminded about this event.
            </DialogDescription>
          </DialogHeader>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#007E8C]" />
            </div>
          ) : (
            <RulesEditor
              // Using dataUpdatedAt as key forces a clean remount when server
              // data changes, eliminating the need for useEffect sync.
              key={dataUpdatedAt}
              eventRequestId={eventRequestId}
              serverRules={existingRules}
              eventStatus={eventStatus || 'new'}
              onDirtyChange={(dirty) => {
                editorDirtyRef.current = dirty;
              }}
              onSaved={() => {
                editorDirtyRef.current = false;
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

      {/* Unsaved changes confirmation */}
      <Dialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Unsaved Changes
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              You have unsaved reminder changes. Closing will discard them.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUnsavedWarning(false)}
            >
              Keep Editing
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDiscardAndClose}
            >
              Discard Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Rules editor (inner form)
// ---------------------------------------------------------------------------

function RulesEditor({
  eventRequestId,
  serverRules,
  eventStatus,
  onDirtyChange,
  onSaved,
  onError,
}: {
  eventRequestId: number;
  serverRules: ReminderRule[];
  eventStatus: string;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
  onError: () => void;
}) {
  // Initialize local state directly from props — no useEffect needed because
  // the parent uses `key={dataUpdatedAt}` to remount on server data changes.
  const [rules, setRules] = useState<ReminderRule[]>(() =>
    serverRules.map(r => ({ ...r })),
  );
  const [defaultChannel, setDefaultChannel] = useState(
    () => serverRules[0]?.channel || 'email',
  );

  // Stable snapshot of server state for dirty comparison
  const serverSnapshot = useRef(serializeRules(serverRules));

  // Notify parent whenever dirty state changes
  const updateDirtyState = useCallback(
    (nextRules: ReminderRule[]) => {
      const isDirty = serializeRules(nextRules) !== serverSnapshot.current;
      onDirtyChange(isDirty);
    },
    [onDirtyChange],
  );

  const isDirty = serializeRules(rules) !== serverSnapshot.current;

  // Available rule types for the current event status
  const availableRuleTypes = useMemo(() => {
    return (Object.entries(RULE_TYPE_CONFIG) as [RuleType, (typeof RULE_TYPE_CONFIG)[RuleType]][])
      .filter(([, config]) => (config.applicableStatuses as readonly string[]).includes(eventStatus))
      .map(([type, config]) => ({ type, ...config }));
  }, [eventStatus]);

  // Rule types not yet added
  const addableRuleTypes = useMemo(() => {
    const existingTypes = new Set(rules.map(r => r.ruleType));
    return availableRuleTypes.filter(rt => !existingTypes.has(rt.type));
  }, [availableRuleTypes, rules]);

  // --- Mutations ---

  const bulkSaveMutation = useMutation({
    mutationFn: async (rulesToSave: ReminderRule[]) => {
      const res = await fetch('/api/event-check-in-reminders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventRequestId,
          rules: normalizeForSave(rulesToSave).map(r => ({
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
      const res = await fetch(
        `/api/event-check-in-reminders/${eventRequestId}/${ruleType}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: onSaved,
    onError,
  });

  // --- Actions ---

  const addRule = (ruleType: RuleType) => {
    const config = RULE_TYPE_CONFIG[ruleType];
    setRules(prev => {
      const next = [
        ...prev,
        {
          ruleType,
          enabled: true,
          thresholdDays: config.defaultThreshold,
          frequency: config.isConditionBased ? 'daily' : 'weekly',
          channel: defaultChannel,
        },
      ];
      updateDirtyState(next);
      return next;
    });
  };

  const updateRule = (index: number, updates: Partial<ReminderRule>) => {
    setRules(prev => {
      const next = prev.map((r, i) => (i === index ? { ...r, ...updates } : r));
      updateDirtyState(next);
      return next;
    });
  };

  const removeRule = (index: number) => {
    const rule = rules[index];
    if (rule.id) {
      deleteMutation.mutate(rule.ruleType);
    }
    setRules(prev => {
      const next = prev.filter((_, i) => i !== index);
      updateDirtyState(next);
      return next;
    });
  };

  const handleSave = () => {
    bulkSaveMutation.mutate(rules);
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
            setRules(prev => {
              const next = prev.map(r => ({ ...r, channel: val }));
              updateDirtyState(next);
              return next;
            });
          }}
        >
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
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
                  rule.enabled
                    ? 'border-[#007E8C]/30 bg-[#007E8C]/5'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) =>
                        updateRule(index, { enabled: checked })
                      }
                      className="flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          rule.enabled ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {config.label}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {config.description}
                      </p>
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
                    {config.isConditionBased ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">
                          {config.thresholdPrefix}
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={rule.thresholdDays}
                          onChange={(e) =>
                            updateRule(index, {
                              thresholdDays: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-16 h-7 text-sm text-center"
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {config.thresholdLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Remind me</span>
                        <Select
                          value={rule.frequency}
                          onValueChange={(val) =>
                            updateRule(index, { frequency: val })
                          }
                        >
                          <SelectTrigger className="w-32 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FREQUENCY_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add rule buttons */}
      {addableRuleTypes.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-gray-500 uppercase tracking-wide">
            Add reminder
          </Label>
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
                  <span className="text-xs text-gray-400 ml-2">
                    {rt.description}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save button — only shows when there are unsaved changes */}
      {rules.length > 0 && (
        <Button
          className={`w-full text-white ${
            isDirty
              ? 'bg-[#007E8C] hover:bg-[#006570]'
              : 'bg-gray-400 cursor-default'
          }`}
          onClick={handleSave}
          disabled={isSaving || !isDirty}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isDirty ? 'Save Changes' : 'Saved'}
        </Button>
      )}
    </div>
  );
}
