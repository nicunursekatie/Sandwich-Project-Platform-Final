import React, { useState } from 'react';
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
  User as UserIcon,
  Mail,
  MailCheck,
  MailX,
  Clock,
  ExternalLink,
  Monitor,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

interface ClientErrorLogEntry {
  id: number;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userRole: string | null;
  message: string;
  stack: string | null;
  componentStack: string | null;
  url: string | null;
  referrer: string | null;
  userAgent: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  ipAddress: string | null;
  sessionId: string | null;
  emailSent: boolean | null;
  createdAt: string;
}

export function ClientErrorLog() {
  const [days, setDays] = useState<string>('7');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const {
    data: errors = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<ClientErrorLogEntry[]>({
    queryKey: ['/api/admin/client-error-logs', days],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/client-error-logs?days=${days}&limit=200`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to load error logs');
      return response.json();
    },
  });

  // Summary stats
  const uniqueUsers = new Set(errors.map((e) => e.userId).filter(Boolean)).size;
  const uniqueMessages = new Set(errors.map((e) => e.message)).size;
  const emailedCount = errors.filter((e) => e.emailSent).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Client Error Logs
            </CardTitle>
            <CardDescription className="mt-1">
              Errors caught by the app's error boundary. Each error is also emailed to
              the admin.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 hours</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        </div>

        {!isLoading && (
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
            <div>
              <span className="font-semibold text-gray-900">{errors.length}</span>{' '}
              total errors
            </div>
            <div>
              <span className="font-semibold text-gray-900">{uniqueMessages}</span>{' '}
              unique messages
            </div>
            <div>
              <span className="font-semibold text-gray-900">{uniqueUsers}</span>{' '}
              affected users
            </div>
            <div>
              <span className="font-semibold text-gray-900">{emailedCount}</span>{' '}
              emailed
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
            <p>No errors logged in the selected period.</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
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
                              <span className="font-medium text-red-700 text-sm break-words">
                                {error.message}
                              </span>
                              {error.emailSent ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-green-300 text-green-700 bg-green-50"
                                >
                                  <MailCheck className="w-3 h-3 mr-1" />
                                  Emailed
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-gray-300 text-gray-500"
                                >
                                  <MailX className="w-3 h-3 mr-1" />
                                  Not emailed
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(createdDate, {
                                  addSuffix: true,
                                })}
                              </span>
                              {(error.userName || error.userEmail) && (
                                <span className="flex items-center gap-1">
                                  <UserIcon className="w-3 h-3" />
                                  {error.userName || error.userEmail}
                                  {error.userRole && (
                                    <span className="text-gray-400">
                                      ({error.userRole})
                                    </span>
                                  )}
                                </span>
                              )}
                              {!error.userId && (
                                <span className="text-gray-400 italic">
                                  anonymous
                                </span>
                              )}
                              {error.url && (
                                <span className="flex items-center gap-1 truncate max-w-[300px]">
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">
                                    {(() => {
                                      try {
                                        return new URL(error.url).pathname;
                                      } catch {
                                        return error.url;
                                      }
                                    })()}
                                  </span>
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
                              <div className="font-semibold text-gray-700 mb-1">
                                Timestamp
                              </div>
                              <div className="text-gray-600 font-mono">
                                {format(createdDate, 'MMM d, yyyy HH:mm:ss')}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">
                                Log ID
                              </div>
                              <div className="text-gray-600 font-mono">
                                #{error.id}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">
                                User
                              </div>
                              <div className="text-gray-600 font-mono break-all">
                                {error.userEmail || 'Not signed in'}
                                {error.userId && (
                                  <div className="text-gray-400">
                                    id: {error.userId}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">
                                Viewport
                              </div>
                              <div className="text-gray-600 font-mono flex items-center gap-1">
                                <Monitor className="w-3 h-3" />
                                {error.viewportWidth && error.viewportHeight
                                  ? `${error.viewportWidth} × ${error.viewportHeight}`
                                  : 'unknown'}
                              </div>
                            </div>
                          </div>

                          {error.url && (
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">
                                Full URL
                              </div>
                              <div className="text-gray-600 font-mono break-all">
                                {error.url}
                              </div>
                            </div>
                          )}

                          {error.referrer && (
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">
                                Referrer
                              </div>
                              <div className="text-gray-600 font-mono break-all">
                                {error.referrer}
                              </div>
                            </div>
                          )}

                          {error.userAgent && (
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">
                                User Agent
                              </div>
                              <div className="text-gray-600 font-mono break-all">
                                {error.userAgent}
                              </div>
                            </div>
                          )}

                          {error.componentStack && (
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">
                                React Component Stack
                              </div>
                              <pre className="text-gray-700 bg-white border border-gray-200 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap font-mono text-[11px]">
                                {error.componentStack}
                              </pre>
                            </div>
                          )}

                          {error.stack && (
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">
                                JavaScript Stack Trace
                              </div>
                              <pre className="text-gray-100 bg-gray-900 rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap font-mono text-[11px]">
                                {error.stack}
                              </pre>
                            </div>
                          )}

                          <div className="flex gap-3 text-[11px] text-gray-400 pt-1">
                            {error.ipAddress && <span>IP: {error.ipAddress}</span>}
                            {error.sessionId && (
                              <span className="truncate max-w-[200px]">
                                Session: {error.sessionId}
                              </span>
                            )}
                          </div>
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
