import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Mail,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Loader2,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface EmailLogEntry {
  id: number;
  eventId: number;
  sentAt: string;
  sentBy: string;
  recipientEmail: string;
  subject: string;
  body: string;
  templateType: string | null;
  senderName: string;
  senderEmail: string | null;
}

interface EventEmailLogDisplayProps {
  eventId: number;
  compact?: boolean; // For card view vs. full detail view
}

export default function EventEmailLogDisplay({ eventId, compact = false }: EventEmailLogDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Lazy-load: only fetch email logs when the user expands the section (or in full/non-compact view)
  const shouldFetch = !compact || expanded;

  const { data: logs, isLoading } = useQuery<EmailLogEntry[]>({
    queryKey: [`/api/events/${eventId}/email-logs`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/events/${eventId}/email-logs`);
      return res.json();
    },
    enabled: shouldFetch,
  });

  // In compact mode, show a lightweight toggle before data is fetched
  if (compact && !expanded && !logs) {
    return (
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Mail className="w-3 h-3" />
            <ChevronRight className="w-3 h-3" />
            View email history
          </button>
        </CollapsibleTrigger>
      </Collapsible>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading email history...
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    if (compact && expanded) {
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Mail className="w-3 h-3" />
          No emails sent yet
        </div>
      );
    }
    return null;
  }

  const firstLog = logs[0]; // Most recent
  const hasMultiple = logs.length > 1;

  // Compact badge for card views
  if (compact) {
    return (
      <div className="space-y-1">
        {/* First/most recent email badge */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="w-3 h-3 text-green-600" />
          <span>
            Initial email sent{' '}
            {new Date(firstLog.sentAt).toLocaleDateString()}{' '}
            {new Date(firstLog.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' by '}
            {firstLog.senderName}
          </span>
          {firstLog.templateType && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {firstLog.templateType === 'new_org' ? 'New' : 'Returning'}
            </Badge>
          )}
        </div>

        {/* Expandable log list if multiple */}
        {hasMultiple && (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                {expanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                View {logs.length} sent email{logs.length !== 1 ? 's' : ''}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 space-y-1 pl-4 border-l-2 border-muted">
                {logs.map((log) => (
                  <div key={log.id} className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>
                        {new Date(log.sentAt).toLocaleDateString()}{' '}
                        {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>—</span>
                      <span className="font-medium">{log.subject}</span>
                    </div>
                    <div className="flex items-center gap-1 pl-3.5">
                      <User className="w-2.5 h-2.5" />
                      <span>by {log.senderName} to {log.recipientEmail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  }

  // Full detail view
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-1.5">
        <Mail className="w-4 h-4" />
        Email History ({logs.length})
      </h4>
      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="border rounded-md p-2 text-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">{log.subject}</span>
                {log.templateType && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {log.templateType === 'new_org' ? 'New Org' : 'Returning'}
                  </Badge>
                )}
              </div>
              <button
                onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                className="text-xs text-primary hover:underline"
              >
                {expandedLogId === log.id ? 'Hide' : 'View'}
              </button>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Sent {new Date(log.sentAt).toLocaleString()} by {log.senderName} to {log.recipientEmail}
            </div>
            {expandedLogId === log.id && (
              <div className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                {log.body}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
