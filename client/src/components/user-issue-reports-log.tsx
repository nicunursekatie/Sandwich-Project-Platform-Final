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
import { ChevronDown, ChevronRight, MessageSquareWarning, RefreshCw, User } from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import type { UserIssueReport } from '@shared/schema';

const RECORD_TYPE_LABELS: Record<string, string> = {
  event_request: 'Event request',
  collection: 'Collection',
  volunteer_signup: 'Volunteer signup',
  other: 'Other',
};

export function UserIssueReportsLog() {
  const [days, setDays] = useState<string>('30');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const {
    data: reports = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<UserIssueReport[]>({
    queryKey: ['/api/user-issue-reports/admin', days],
    queryFn: async () => {
      const response = await fetch(
        `/api/user-issue-reports/admin?days=${days}&limit=200`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to load user issue reports');
      return response.json();
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareWarning className="h-5 w-5 text-amber-600" />
              User Problem Reports
            </CardTitle>
            <CardDescription>
              Issues reported by users through the in-app &quot;Report a problem&quot; form
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading reports…</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No user reports in this period.</div>
        ) : (
          <ScrollArea className="h-[480px] pr-4">
            <div className="space-y-3">
              {reports.map((report) => {
                const isExpanded = expandedId === report.id;
                return (
                  <Collapsible
                    key={report.id}
                    open={isExpanded}
                    onOpenChange={(open) => setExpandedId(open ? report.id : null)}
                  >
                    <div className="rounded-lg border bg-white">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-start gap-3 p-4 text-left hover:bg-gray-50/80"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-gray-500" />
                          )}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {report.pageLabel || report.pagePath}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                #{report.id}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">{report.whatDoing}</p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {report.userName || report.userEmail || report.userId}
                              </span>
                              <span>
                                {format(parseISO(String(report.createdAt)), 'MMM d, yyyy h:mm a')}
                              </span>
                              <span>
                                ({formatDistanceToNow(parseISO(String(report.createdAt)), { addSuffix: true })})
                              </span>
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t px-4 pb-4 pt-3 space-y-3 text-sm">
                          <DetailBlock label="Where" value={report.pageLabel || '—'} />
                          <DetailBlock label="Page path" value={report.pagePath} mono />
                          <DetailBlock label="What they were doing" value={report.whatDoing} />
                          <DetailBlock label="Expected" value={report.expectedOutcome} />
                          <DetailBlock label="Actual" value={report.actualOutcome} />
                          {(report.recordType || report.recordId || report.recordLabel) && (
                            <div className="rounded-md bg-amber-50/80 border border-amber-100 p-3 space-y-1">
                              <p className="font-medium text-amber-900">Record context</p>
                              {report.recordType && (
                                <p>
                                  <span className="text-muted-foreground">Type: </span>
                                  {RECORD_TYPE_LABELS[report.recordType] || report.recordType}
                                </p>
                              )}
                              {report.recordId && (
                                <p>
                                  <span className="text-muted-foreground">ID: </span>
                                  {report.recordId}
                                </p>
                              )}
                              {report.recordLabel && (
                                <p>
                                  <span className="text-muted-foreground">Name: </span>
                                  {report.recordLabel}
                                </p>
                              )}
                            </div>
                          )}
                          {report.userEmail && (
                            <DetailBlock label="Reporter email" value={report.userEmail} />
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

function DetailBlock({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-gray-800 whitespace-pre-wrap ${mono ? 'font-mono text-xs break-all' : ''}`}>
        {value}
      </p>
    </div>
  );
}
