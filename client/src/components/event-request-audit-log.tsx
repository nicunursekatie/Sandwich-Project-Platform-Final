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
} from 'lucide-react';
import { format } from 'date-fns';
import { useActivityTracker } from '@/hooks/useActivityTracker';

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
  const [timeFilter, setTimeFilter] = useState('24');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { trackView, trackClick, trackFilter, trackSearch } =
    useActivityTracker();

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
      return response.json();
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
    switch (action) {
      case 'CREATE':
        return <Plus className="h-4 w-4" />;
      case 'PRIMARY_CONTACT_COMPLETED':
        return <UserCheck className="h-4 w-4" />;
      case 'EVENT_DETAILS_UPDATED':
        return <Edit className="h-4 w-4" />;
      case 'STATUS_CHANGED':
        return <RefreshCw className="h-4 w-4" />;
      case 'FOLLOW_UP_RECORDED':
        return <Mail className="h-4 w-4" />;
      case 'MARKED_UNRESPONSIVE':
        return <AlertTriangle className="h-4 w-4" />;
      case 'DELETE':
        return <Trash2 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'PRIMARY_CONTACT_COMPLETED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'EVENT_DETAILS_UPDATED':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'STATUS_CHANGED':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'FOLLOW_UP_RECORDED':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
      case 'MARKED_UNRESPONSIVE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'DELETE':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
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
      trackSearch('Audit Log Search', value, 'Audit', 'Event Requests');
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Loading Audit Log...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Event Request Audit Log
            {eventId && <Badge variant="outline">Event #{eventId}</Badge>}
          </div>
          <Button onClick={handleRefresh} size="sm" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Complete tracking of all changes made to event requests - who did what
          and when
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {showFilters && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by organization, contact, user, or action..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <Select
                  value={timeFilter}
                  onValueChange={(value) => handleFilterChange('time', value)}
                >
                  <SelectTrigger className="w-32">
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

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <Select
                  value={actionFilter}
                  onValueChange={(value) => handleFilterChange('action', value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="CREATE">Create Request</SelectItem>
                    <SelectItem value="PRIMARY_CONTACT_COMPLETED">
                      Contact Completed
                    </SelectItem>
                    <SelectItem value="EVENT_DETAILS_UPDATED">
                      Details Updated
                    </SelectItem>
                    <SelectItem value="STATUS_CHANGED">
                      Status Changed
                    </SelectItem>
                    <SelectItem value="FOLLOW_UP_RECORDED">
                      Follow-up Recorded
                    </SelectItem>
                    <SelectItem value="MARKED_UNRESPONSIVE">
                      Marked Unresponsive
                    </SelectItem>
                    <SelectItem value="DELETE">Deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {uniqueUsers.length > 0 && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <Select
                    value={userFilter}
                    onValueChange={(value) => handleFilterChange('user', value)}
                  >
                    <SelectTrigger className="w-48">
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
          </div>
        )}

        {/* Results Summary */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {filteredLogs.length}{' '}
            {filteredLogs.length === 1 ? 'entry' : 'entries'} found
          </span>
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSearch('')}
              className="h-6 px-2"
            >
              Clear search
            </Button>
          )}
        </div>

        {/* Audit Log Entries */}
        <ScrollArea className={compact ? 'h-96' : 'h-[600px]'}>
          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No audit entries found for the selected criteria</p>
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={log.id}>
                  <div className="flex items-start space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
                    <Badge
                      variant="outline"
                      className={`${getActionColor(log.action)} shrink-0`}
                    >
                      {getActionIcon(log.action)}
                      <span className="ml-1 text-xs">
                        {log.action.replace('_', ' ')}
                      </span>
                    </Badge>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {log.organizationName} - {log.contactName}
                        </p>
                        <div className="flex items-center text-xs text-gray-500 space-x-2">
                          <User className="h-3 w-3" />
                          <span>{log.userEmail}</span>
                          <Clock className="h-3 w-3 ml-2" />
                          <span>
                            {format(
                              new Date(log.timestamp),
                              'MMM d, yyyy h:mm a'
                            )}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {log.actionDescription}
                      </p>

                      {/* Additional Details */}
                      {(log.statusChange ||
                        log.followUpMethod ||
                        log.details) && (
                        <div className="mt-2 space-y-1 text-xs">
                          {log.statusChange && (
                            <div className="flex items-center text-brand-primary dark:text-blue-400">
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Status: {log.statusChange}
                            </div>
                          )}
                          {log.followUpMethod && (
                            <div className="flex items-center text-green-600 dark:text-green-400">
                              {log.followUpMethod === 'email' ? (
                                <Mail className="h-3 w-3 mr-1" />
                              ) : (
                                <Phone className="h-3 w-3 mr-1" />
                              )}
                              Follow-up: {log.followUpMethod}
                            </div>
                          )}
                          {log.details?.updatedFields && (
                            <div className="flex items-center text-gray-500">
                              <Edit className="h-3 w-3 mr-1" />
                              Updated: {log.details.updatedFields.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 shrink-0">
                      Event #{log.eventId}
                    </div>
                  </div>

                  {index < filteredLogs.length - 1 && (
                    <Separator className="my-2" />
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
