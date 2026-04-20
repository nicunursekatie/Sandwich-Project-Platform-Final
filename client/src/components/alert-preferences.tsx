import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Mail,
  Smartphone,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { SMSSetupSection } from './alert-preferences/SMSSetupSection';

/**
 * Alert Preferences
 *
 * One flat list of alerts. Each row: on/off toggle, channel checkboxes,
 * saved inline. No tabs, no separate "customize" view, no big Save button.
 *
 * Alert catalog and channel semantics live in `shared/alert-catalog.ts` —
 * the backend reads the same catalog to honor these settings.
 */

interface AlertRow {
  type: string;
  name: string;
  description: string;
  category: 'event' | 'communication' | 'task' | 'collection';
  availableChannels: Array<'email' | 'sms' | 'in_app'>;
  implemented: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  hasSavedPreference: boolean;
}

interface AlertPreferencesResponse {
  alerts: AlertRow[];
}

interface UpdateArgs {
  type: string;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
}

const CATEGORY_ORDER: Array<AlertRow['category']> = [
  'event',
  'task',
  'collection',
  'communication',
];

const CATEGORY_LABEL: Record<AlertRow['category'], string> = {
  event: 'Events',
  task: 'Tasks & Assignments',
  collection: 'Collection Reminders',
  communication: 'Mentions & Messages',
};

export default function AlertPreferences() {
  const { toast } = useToast();
  const client = useQueryClient();

  const { data, isLoading } = useQuery<AlertPreferencesResponse>({
    queryKey: ['/api/notifications/alert-preferences'],
    queryFn: () => apiRequest('GET', '/api/notifications/alert-preferences'),
  });

  const { data: smsStatus, isLoading: smsStatusLoading } = useQuery<any>({
    queryKey: ['/api/users/sms-status'],
    queryFn: () => apiRequest('GET', '/api/users/sms-status'),
  });

  const hasSmsOptIn = !!smsStatus?.hasConfirmedOptIn;

  const updateMutation = useMutation({
    mutationFn: (args: UpdateArgs) =>
      apiRequest('PUT', '/api/notifications/alert-preferences', args),
    onMutate: async (args) => {
      // Optimistic update so the toggle feels instant
      await client.cancelQueries({ queryKey: ['/api/notifications/alert-preferences'] });
      const previous = client.getQueryData<AlertPreferencesResponse>([
        '/api/notifications/alert-preferences',
      ]);
      if (previous) {
        client.setQueryData<AlertPreferencesResponse>(
          ['/api/notifications/alert-preferences'],
          {
            alerts: previous.alerts.map((a) =>
              a.type === args.type
                ? {
                    ...a,
                    emailEnabled: args.emailEnabled ?? a.emailEnabled,
                    smsEnabled: args.smsEnabled ?? a.smsEnabled,
                    hasSavedPreference: true,
                  }
                : a
            ),
          }
        );
      }
      return { previous };
    },
    onError: (err, _args, ctx) => {
      if (ctx?.previous) {
        client.setQueryData(['/api/notifications/alert-preferences'], ctx.previous);
      }
      toast({
        title: 'Failed to save',
        description: (err as any)?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['/api/notifications/alert-preferences'] });
    },
  });

  const alertsByCategory = useMemo(() => {
    const grouped: Record<AlertRow['category'], AlertRow[]> = {
      event: [],
      task: [],
      collection: [],
      communication: [],
    };
    for (const alert of data?.alerts ?? []) {
      grouped[alert.category].push(alert);
    }
    return grouped;
  }, [data]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-primary" />
            Alert Preferences
          </CardTitle>
          <CardDescription>
            Choose which alerts you receive and how. Changes save automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasSmsOptIn && !smsStatusLoading && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <span className="font-medium">SMS isn't set up yet.</span> You can
              still choose SMS for any alert below, but you won't actually receive
              text messages until you set up SMS in the section below.
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your preferences…</p>
          ) : (
            <div className="space-y-6">
              {CATEGORY_ORDER.map((category) => {
                const items = alertsByCategory[category];
                if (items.length === 0) return null;
                return (
                  <div key={category} className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                      {CATEGORY_LABEL[category]}
                    </h3>
                    <div className="space-y-2">
                      {items.map((alert) => (
                        <AlertRow
                          key={alert.type}
                          alert={alert}
                          hasSmsOptIn={hasSmsOptIn}
                          onChange={(updates) =>
                            updateMutation.mutate({ type: alert.type, ...updates })
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Accordion type="single" collapsible defaultValue={hasSmsOptIn ? undefined : 'sms-setup'}>
        <AccordionItem value="sms-setup">
          <AccordionTrigger className="text-sm font-medium">
            {hasSmsOptIn ? 'Manage SMS setup' : 'Set up SMS to receive text alerts'}
          </AccordionTrigger>
          <AccordionContent>
            <SMSSetupSection userSMSStatus={smsStatus} isLoading={smsStatusLoading} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

interface AlertRowProps {
  alert: AlertRow;
  hasSmsOptIn: boolean;
  onChange: (updates: { emailEnabled?: boolean; smsEnabled?: boolean }) => void;
}

function AlertRow({ alert, hasSmsOptIn, onChange }: AlertRowProps) {
  const isOn = alert.emailEnabled || alert.smsEnabled;

  const toggleAll = (enabled: boolean) => {
    if (enabled) {
      // Turn back on: restore email by default (safe — everyone has email)
      onChange({ emailEnabled: true });
    } else {
      // Turn off: disable both channels
      onChange({ emailEnabled: false, smsEnabled: false });
    }
  };

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${
        alert.implemented ? 'bg-white' : 'bg-slate-50 border-dashed'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900">{alert.name}</span>
            {!alert.implemented && (
              <Badge variant="outline" className="text-xs">
                Coming soon
              </Badge>
            )}
            {alert.implemented && alert.hasSavedPreference && isOn && (
              <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                <CheckCircle className="h-3 w-3 mr-1" />
                On
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1">{alert.description}</p>
        </div>
        <Switch
          checked={isOn}
          onCheckedChange={toggleAll}
          disabled={!alert.implemented}
          aria-label={`Enable ${alert.name}`}
        />
      </div>

      {alert.implemented && isOn && (
        <div className="flex flex-wrap gap-4 pl-1">
          {alert.availableChannels.includes('email') && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={alert.emailEnabled}
                onCheckedChange={(c) => onChange({ emailEnabled: c === true })}
              />
              <Mail className="h-4 w-4 text-slate-500" />
              Email
            </label>
          )}
          {alert.availableChannels.includes('sms') && (
            <label
              className={`flex items-center gap-2 text-sm ${hasSmsOptIn ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
              title={hasSmsOptIn ? undefined : 'Set up SMS below to enable this channel'}
            >
              <Checkbox
                checked={alert.smsEnabled}
                onCheckedChange={(c) => onChange({ smsEnabled: c === true })}
                disabled={!hasSmsOptIn}
              />
              <Smartphone className="h-4 w-4 text-slate-500" />
              SMS
              {!hasSmsOptIn && (
                <span className="text-xs text-slate-500">(not set up)</span>
              )}
            </label>
          )}
        </div>
      )}

      {!alert.implemented && (
        <p className="text-xs text-slate-500 italic flex items-center gap-1">
          <Clock className="h-3 w-3" />
          This alert isn't wired up yet — we'll turn it on in a future release.
        </p>
      )}
    </div>
  );
}
