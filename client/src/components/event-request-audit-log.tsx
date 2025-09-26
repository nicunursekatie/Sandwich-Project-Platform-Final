import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Shield,
  Clock,
  User,
  FileText,
  Mail,
  Phone,
  UserCheck,
  Trash2,
  Edit,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  Calendar,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useAuth } from '@/hooks/useAuth';
import {
  hasPermission,
  PERMISSIONS,
} from '@shared/auth-utils';

interface AuditLogEntry {
  id: number;
  action: string;
  eventId: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  organizationName: string;
  contactName: string;
  actionDescription: string;
  details: any;
  statusChange: string | null;
  followUpMethod: string | null;
  oldData: any;
  newData: any;
  changeDescription: string;
}

interface EventRequestAuditLogProps {
  eventId?: string;
  showFilters?: boolean;
  compact?: boolean;
}

export function EventRequestAuditLog({
  eventId,
  showFilters = true,
  compact = false,
}: EventRequestAuditLogProps) {
  const { user: currentUser } = useAuth();
  const [timeFilter, setTimeFilter] = useState('24');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const { trackView, trackClick, trackFilter, trackSearch } =
    useActivityTracker();

  // Check permissions
  if (!hasPermission(currentUser, PERMISSIONS.EVENT_REQUESTS_VIEW)) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" data-testid="audit-log-access-denied">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader className="pb-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-xl font-sub-heading text-gray-900">Access Restricted</CardTitle>
            <CardDescription className="text-base text-gray-600 leading-relaxed">
              You don't have permission to view event request audit logs. Contact an
              administrator if you need access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Track component view on mount
  useEffect(() => {
    trackView(
      'Event Request Audit Log',
      'Audit',
      'Event Requests',
      eventId
        ? `Viewing audit log for event ${eventId}`
        : 'Viewing general event request audit log'
    );
  }, [trackView, eventId]);

  // Fetch audit logs
  const {
    data: auditLogs,
    isLoading,
    refetch,
  } = useQuery<AuditLogEntry[]>({
    queryKey: [
      '/api/event-requests/audit-logs',
      timeFilter,
      actionFilter,
      userFilter,
      eventId,
    ],
    enabled: hasPermission(currentUser, PERMISSIONS.EVENT_REQUESTS_VIEW),
    queryFn: async () => {
      const params = new URLSearchParams({
        hours: timeFilter,
        limit: '100',
        offset: '0',
      });

      if (actionFilter !== 'all') params.append('action', actionFilter);
      if (userFilter !== 'all') params.append('userId', userFilter);
      if (eventId) params.append('eventId', eventId);

      const response = await fetch(`/api/event-requests/audit-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      return data.logs || []; // Extract the logs array from the response
    },
    refetchInterval: eventId ? undefined : 30000, // Auto-refresh every 30 seconds for general view
  });

  // Get unique users for filter
  const uniqueUsers = React.useMemo(() => {
    if (!auditLogs) return [];
    const users = new Map();
    auditLogs.forEach((log) => {
      if (log.userId && log.userEmail) {
        users.set(log.userId, { id: log.userId, email: log.userEmail });
      }
    });
    return Array.from(users.values());
  }, [auditLogs]);

  // Filter logs by search term
  const filteredLogs = React.useMemo(() => {
    if (!auditLogs) return [];
    if (!searchTerm) return auditLogs;

    const term = searchTerm.toLowerCase();
    return auditLogs.filter(
      (log) =>
        log.organizationName.toLowerCase().includes(term) ||
        log.contactName.toLowerCase().includes(term) ||
        log.userEmail.toLowerCase().includes(term) ||
        log.actionDescription.toLowerCase().includes(term)
    );
  }, [auditLogs, searchTerm]);

  const getActionIcon = (action: string) => {
    const iconClass = "h-5 w-5";
    switch (action) {
      case 'CREATE':
        return <Plus className={iconClass} />;
      case 'PRIMARY_CONTACT_COMPLETED':
        return <UserCheck className={iconClass} />;
      case 'EVENT_DETAILS_UPDATED':
        return <Edit className={iconClass} />;
      case 'STATUS_CHANGED':
        return <RefreshCw className={iconClass} />;
      case 'FOLLOW_UP_RECORDED':
        return <Mail className={iconClass} />;
      case 'MARKED_UNRESPONSIVE':
        return <AlertTriangle className={iconClass} />;
      case 'DELETE':
        return <Trash2 className={iconClass} />;
      default:
        return <FileText className={iconClass} />;
    }
  };

  const getActionStyle = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'PRIMARY_CONTACT_COMPLETED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'EVENT_DETAILS_UPDATED':
      case 'UPDATE':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'STATUS_CHANGED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'FOLLOW_UP_RECORDED':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'MARKED_UNRESPONSIVE':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'DELETE':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Helper function to render field changes from structured _auditMetadata or fallback to changeDescription
  const renderFieldChanges = (log: AuditLogEntry) => {
    // First, try to use structured data from _auditMetadata.changes (NEW enhanced format)
    try {
      if (log.newData || log.oldData) {
        let metadataChanges: any[] = [];
        
        // Try to extract structured changes from newData or oldData
        if (log.newData) {
          const newDataParsed = typeof log.newData === 'string' ? JSON.parse(log.newData) : log.newData;
          metadataChanges = newDataParsed?._auditMetadata?.changes || [];
        }
        
        if (metadataChanges.length === 0 && log.oldData) {
          const oldDataParsed = typeof log.oldData === 'string' ? JSON.parse(log.oldData) : log.oldData;
          metadataChanges = oldDataParsed?._auditMetadata?.changes || [];
        }

        // If we have structured changes, render them properly
        if (metadataChanges.length > 0) {
          return (
            <div className="mt-3 space-y-2">
              <div className="text-sm font-medium text-gray-700 mb-2">What Changed:</div>
              {metadataChanges.map((change: any, index: number) => (
                <div key={index} className="flex items-start text-sm bg-gray-50 p-2 rounded border-l-4 border-l-teal-500">
                  <Edit className="h-4 w-4 mr-2 mt-0.5 text-orange-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900">
                      {change.fieldDisplayName}:
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {change.oldValue && change.oldValue !== '(empty)' && (
                        <span className="inline-flex items-center px-2 py-1 text-xs bg-red-100 text-red-700 rounded line-through">
                          {String(change.oldValue).length > 30 
                            ? `${String(change.oldValue).substring(0, 27)}...` 
                            : String(change.oldValue)}
                        </span>
                      )}
                      {change.oldValue && change.oldValue !== '(empty)' && <span className="text-gray-400">→</span>}
                      <span className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-700 rounded font-medium">
                        {String(change.newValue).length > 30 
                          ? `${String(change.newValue).substring(0, 27)}...` 
                          : String(change.newValue)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        }
      }
    } catch (error) {
      console.warn('Failed to parse structured audit metadata:', error);
    }

    // Fallback: If we have a changeDescription from the enhanced AuditLogger but no structured data
    if (log.changeDescription && log.changeDescription !== log.actionDescription) {
      return (
        <div className="mt-3">
          <div className="text-sm font-medium text-gray-700 mb-2">What Changed:</div>
          <div className="flex items-start text-sm bg-gray-50 p-2 rounded border-l-4 border-l-teal-500">
            <Edit className="h-4 w-4 mr-2 mt-0.5 text-orange-600 flex-shrink-0" />
            <span className="text-gray-800">{log.changeDescription}</span>
          </div>
        </div>
      );
    }

    // Fallback to legacy details display
    if (log.details?.updatedFields) {
      return (
        <div className="mt-3">
          <div className="text-sm font-medium text-gray-700 mb-2">Fields Updated:</div>
          <div className="flex items-center text-sm bg-gray-50 p-2 rounded">
            <Edit className="h-4 w-4 mr-2 text-orange-600" />
            <span className="text-gray-800">{log.details.updatedFields.join(', ')}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  const handleRefresh = () => {
    trackClick(
      'Refresh Audit Log',
      'Audit',
      'Event Requests',
      'Manual refresh of audit log data'
    );
    refetch();
  };

  const handleFilterChange = (type: string, value: string) => {
    switch (type) {
      case 'time':
        setTimeFilter(value);
        trackFilter('Time Filter', value, 'Audit', 'Event Requests');
        break;
      case 'action':
        setActionFilter(value);
        trackFilter('Action Filter', value, 'Audit', 'Event Requests');
        break;
      case 'user':
        setUserFilter(value);
        trackFilter('User Filter', value, 'Audit', 'Event Requests');
        break;
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value) {
      trackSearch(value, 'Audit', 'Event Requests');
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full shadow-lg" data-testid="audit-log-loading">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl font-sub-heading text-gray-900">
            <Shield className="h-6 w-6 text-teal-600" />
            Loading Audit Log...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded-md w-3/4"></div>
            <div className="h-6 bg-gray-200 rounded-md w-1/2"></div>
            <div className="h-6 bg-gray-200 rounded-md w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-lg" data-testid="audit-log">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-teal-600" />
            <div>
              <h1 className="text-2xl font-sub-heading text-gray-900">Event Request Audit Log</h1>
              {eventId && (
                <Badge variant="outline" className="mt-1 text-teal-700 border-teal-300 bg-teal-50">
                  Event #{eventId}
                </Badge>
              )}
            </div>
          </div>
          <Button 
            onClick={handleRefresh} 
            className="btn-tsp-primary"
            data-testid="button-refresh-audit-log"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription className="text-base text-gray-600 leading-relaxed">
          Complete tracking of all changes made to event requests - who did what and when
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {showFilters && (
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full md:w-auto flex items-center gap-2 text-base"
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4" />
                Filters
                <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-4 mt-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search by organization, contact, user, or action..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 text-base h-12"
                  data-testid="input-search-audit-log"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time Range
                  </label>
                  <Select
                    value={timeFilter}
                    onValueChange={(value) => handleFilterChange('time', value)}
                  >
                    <SelectTrigger className="h-12 text-base" data-testid="select-time-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Last Hour</SelectItem>
                      <SelectItem value="24">Last 24h</SelectItem>
                      <SelectItem value="72">Last 3 days</SelectItem>
                      <SelectItem value="168">Last Week</SelectItem>
                      <SelectItem value="720">Last Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Action Type
                  </label>
                  <Select
                    value={actionFilter}
                    onValueChange={(value) => handleFilterChange('action', value)}
                  >
                    <SelectTrigger className="h-12 text-base" data-testid="select-action-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="CREATE">Create Request</SelectItem>
                      <SelectItem value="PRIMARY_CONTACT_COMPLETED">Contact Completed</SelectItem>
                      <SelectItem value="EVENT_DETAILS_UPDATED">Details Updated</SelectItem>
                      <SelectItem value="STATUS_CHANGED">Status Changed</SelectItem>
                      <SelectItem value="FOLLOW_UP_RECORDED">Follow-up Recorded</SelectItem>
                      <SelectItem value="MARKED_UNRESPONSIVE">Marked Unresponsive</SelectItem>
                      <SelectItem value="DELETE">Deleted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {uniqueUsers.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      User
                    </label>
                    <Select
                      value={userFilter}
                      onValueChange={(value) => handleFilterChange('user', value)}
                    >
                      <SelectTrigger className="h-12 text-base" data-testid="select-user-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        {uniqueUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Results Summary */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <span className="text-base font-medium text-gray-700">
            {filteredLogs.length}{' '}
            {filteredLogs.length === 1 ? 'entry' : 'entries'} found
          </span>
          {searchTerm && (
            <Button
              variant="ghost"
              onClick={() => handleSearch('')}
              className="text-teal-600 hover:text-teal-700"
              data-testid="button-clear-search"
            >
              Clear search
            </Button>
          )}
        </div>

        {/* Audit Log Entries */}
        <ScrollArea className={compact ? 'h-96' : 'h-[600px]'} data-testid="audit-log-entries">
          <div className="space-y-4">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No audit entries found</p>
                <p className="text-base">Try adjusting your search criteria or time range</p>
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <Card key={log.id} className="shadow-sm hover:shadow-md transition-shadow" data-testid={`audit-entry-${log.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      {/* Action Badge */}
                      <div className={`inline-flex items-center px-3 py-2 rounded-lg border ${getActionStyle(log.action)} flex-shrink-0`}>
                        {getActionIcon(log.action)}
                        <span className="ml-2 text-sm font-medium">
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                          <h3 className="text-lg font-medium text-gray-900">
                            {log.organizationName} - {log.contactName}
                          </h3>
                          <div className="flex items-center text-sm text-gray-500 space-x-4">
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              <span>{log.userEmail}</span>
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              <span>
                                {format(new Date(log.timestamp), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Primary description */}
                        <p className="text-base text-gray-700 mb-3 leading-relaxed">
                          {log.changeDescription || log.actionDescription}
                        </p>

                        {/* Field Changes Display */}
                        {renderFieldChanges(log)}

                        {/* Enhanced Follow-up Context Display */}
                        {(() => {
                          // Try to get follow-up context from _auditActionContext
                          let followUpContext: any = {};
                          try {
                            if (log.newData) {
                              const newDataParsed = typeof log.newData === 'string' ? JSON.parse(log.newData) : log.newData;
                              followUpContext = newDataParsed?._auditActionContext || {};
                            }
                          } catch (error) {
                            console.warn('Failed to parse audit action context:', error);
                          }
                          
                          const hasFollowUpData = log.statusChange || log.followUpMethod || followUpContext.followUpMethod;
                          
                          if (hasFollowUpData) {
                            return (
                              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                <div className="text-sm font-medium text-gray-700 mb-2">Additional Context:</div>
                                <div className="space-y-2">
                                  {log.statusChange && (
                                    <div className="flex items-center text-sm text-blue-700">
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Status: {log.statusChange}
                                    </div>
                                  )}
                                  {(log.followUpMethod || followUpContext.followUpMethod) && (
                                    <div className="flex items-center text-sm text-green-700">
                                      <Mail className="h-4 w-4 mr-2" />
                                      Method: {log.followUpMethod || followUpContext.followUpMethod}
                                    </div>
                                  )}
                                  {followUpContext.followUpAction && (
                                    <div className="flex items-center text-sm text-blue-700">
                                      <UserCheck className="h-4 w-4 mr-2" />
                                      Action: {followUpContext.followUpAction}
                                    </div>
                                  )}
                                  {followUpContext.notes && (
                                    <div className="flex items-start text-sm text-gray-700">
                                      <FileText className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                                      <span>{followUpContext.notes}</span>
                                    </div>
                                  )}
                                  {followUpContext.updatedEmail && (
                                    <div className="flex items-center text-sm text-purple-700">
                                      <Mail className="h-4 w-4 mr-2" />
                                      Updated Email: {followUpContext.updatedEmail}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}