import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Clock,
  Phone,
  MailCheck,
  MailX,
  Server,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

interface ApplicationErrorLogEntry {
  id: number;
  source: string;
  severity: string;
  category: string | null;
  message: string;
  details: Record<string, unknown> | null;
  userId: string | null;
  phoneNumber: string | null;
  requestPath: string | null;
  emailSent: boolean | null;
  createdAt: string;
}

const SOURCE_LABELS: Record<string, string> = {
  sms_parser: 'SMS Parser',
  sms_webhook: 'SMS Webhook',
  health_check: 'Health Check',
  cron: 'Scheduled Job',
  api: 'API',
  email: 'Email',
  database: 'Database',
  integration: 'Integration',
  sync: 'Google Sheets Sync',
  process: 'Process Crash',
  client: 'Client (JS)',
};

function severityColor(severity: string) {
  switch (severity) {
    case 'critical':
      return 'text-red-800 bg-red-50 border-red-200';
    case 'error':
      return 'text-red-700 bg-red-50/50 border-red-100';
    case 'warning':
      return 'text-amber-800 bg-amber-50 border-amber-200';
    default:
      return 'text-gray-700 bg-gray-50 border-gray-200';
  }
}

export function ApplicationErrorLog() {
  const [days, setDays] = useState<string>('7');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const queryParams = new URLSearchParams({ days, limit: '200' });
  if (sourceFilter !== 'all') queryParams.set('source', sourceFilter);

  const {
    data: errors = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<ApplicationErrorLogEntry[]>({
    queryKey: ['/api/admin/application-error-logs', days, sourceFilter],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/application-error-logs?${queryParams.toString()}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to load application error logs');
      return response.json();
    },
  });

  const criticalCount = errors.filter((e) => e.severity === 'critical').length;
  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const smsCount = errors.filter((e) => e.source.startsWith('sms')).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-orange-600" />
              Application Error Logs
            </CardTitle>
            <CardDescription className="mt-1">
              Server-side errors — SMS parse failures, integration outages, webhook
              issues, and scheduled job problems. Critical/error-level events also
              email admin.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="sms_parser">SMS Parser</SelectItem>
                <SelectItem value="sms_webhook">SMS Webhook</SelectItem>
                <SelectItem value="health_check">Health Check</SelectItem>
                <SelectItem value="cron">Cron Jobs</SelectItem>
                <SelectItem value="sync">Google Sheets Sync</SelectItem>
                <SelectItem value="api">API Errors</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="database">Database</SelectItem>
                <SelectItem value="process">Process Crashes</SelectItem>
                <SelectItem value="client">Client (JS)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 hours</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {!isLoading && (
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
            <div>
              <span className="font-semibold text-gray-900">{errors.length}</span> total
            </div>
            <div>
              <span className="font-semibold text-red-700">{criticalCount + errorCount}</span>{' '}
              errors
            </div>
            <div>
              <span className="font-semibold text-gray-900">{smsCount}</span> SMS-related
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading error logs...</div>
        ) : errors.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No application errors logged in the selected period.</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-2">
              {errors.map((error) => {
                const isExpanded = expandedId === error.id;
                const createdDate = parseISO(error.createdAt);

                return (
                  <Collapsible
                    key={error.id}
                    open={isExpanded}
                    onOpenChange={(open) => setExpandedId(open ? error.id : null)}
                  >
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <CollapsibleTrigger className="w-full text-left hover:bg-gray-50 transition-colors">
                        <div className="p-3 flex items-start gap-3">
                          <div className="mt-0.5">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 flex-wrap">
                              <span className="font-medium text-sm break-words">
                                {error.message}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${severityColor(error.severity)}`}
                              >
                                {error.severity}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {SOURCE_LABELS[error.source] || error.source}
                              </Badge>
                              {error.emailSent ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-green-300 text-green-700"
                                >
                                  <MailCheck className="w-3 h-3 mr-1" />
                                  Emailed
                                </Badge>
                              ) : error.severity === 'error' || error.severity === 'critical' ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-gray-300 text-gray-500"
                                >
                                  <MailX className="w-3 h-3 mr-1" />
                                  Not emailed
                                </Badge>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(createdDate, { addSuffix: true })}
                              </span>
                              {error.category && (
                                <span className="text-gray-500">{error.category}</span>
                              )}
                              {error.phoneNumber && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {error.phoneNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-3 pb-4 pt-2 border-t border-gray-100 bg-gray-50 space-y-3 text-xs">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">Timestamp</div>
                              <div className="text-gray-600 font-mono">
                                {format(createdDate, 'MMM d, yyyy HH:mm:ss')}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">Log ID</div>
                              <div className="text-gray-600 font-mono">#{error.id}</div>
                            </div>
                            {error.requestPath && (
                              <div>
                                <div className="font-semibold text-gray-700 mb-1">Path</div>
                                <div className="text-gray-600 font-mono">{error.requestPath}</div>
                              </div>
                            )}
                          </div>

                          {error.details && Object.keys(error.details).length > 0 && (
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">Details</div>
                              <pre className="text-gray-600 font-mono whitespace-pre-wrap break-all bg-white p-2 rounded border">
                                {JSON.stringify(error.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
