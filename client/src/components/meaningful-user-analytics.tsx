import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sandwich,
  Calendar,
  MessageSquare,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MeaningfulActivity {
  userId: string;
  userName: string;
  email: string;
  role: string;
  // Event load (current state — not time-windowed)
  eventsAssigned: number;
  eventsAssignedCompleted: number;
  eventsAssignedActive: number;
  // Per-window activity
  collectionLogsRecorded: number;
  messagesSent: number;
  resourcesAccessed: number;
  daysActive: number;
  lastActive: Date | null;
  totalContributionValue: number;
}

interface PlatformImpact {
  totalSandwichesRecorded: number;
  totalCollectionLogs: number;
  totalEventsActive: number;
  totalEventsCompleted: number;
  totalHostsConnected: number;
  totalReportsGenerated: number;
  activeContributors: number;
  userProductivity: number;
  totalMessages: number;
  totalResourceAccesses: number;
}

export default function MeaningfulUserAnalytics(): React.ReactElement {
  const [selectedTimeframe, setSelectedTimeframe] = useState('30');
  const [sortBy, setSortBy] = useState('contribution');

  const { data: platformImpact } = useQuery<PlatformImpact>({
    queryKey: [
      '/api/meaningful-analytics/platform-impact',
      selectedTimeframe,
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/meaningful-analytics/platform-impact?days=${selectedTimeframe}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        throw new Error(`Failed to load platform impact (${res.status})`);
      }
      return res.json();
    },
    staleTime: 300000,
  });

  const { data: userActivities } = useQuery<MeaningfulActivity[]>({
    queryKey: [
      '/api/meaningful-analytics/user-contributions',
      selectedTimeframe,
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/meaningful-analytics/user-contributions?days=${selectedTimeframe}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        throw new Error(`Failed to load user contributions (${res.status})`);
      }
      return res.json();
    },
    staleTime: 180000,
  });

  // Filter out the literal sample-data row in case the fallback ever fires.
  const sortedUsers =
    userActivities
      ?.filter((user) => {
        const isSampleData =
          user.email?.includes('admin@sandwich.project') ||
          user.userName?.toLowerCase() === 'admin user';
        return !isSampleData;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'contribution':
            return b.totalContributionValue - a.totalContributionValue;
          case 'events':
            return b.eventsAssigned - a.eventsAssigned;
          case 'logs':
            return b.collectionLogsRecorded - a.collectionLogsRecorded;
          case 'messages':
            return b.messagesSent - a.messagesSent;
          case 'resources':
            return b.resourcesAccessed - a.resourcesAccessed;
          case 'active':
            return b.daysActive - a.daysActive;
          default:
            return 0;
        }
      }) || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Platform Impact Analytics
          </h1>
          <p className="text-gray-600">
            See how your team is using the platform to advance the mission
          </p>
        </div>
        <div className="flex gap-3">
          <Select
            value={selectedTimeframe}
            onValueChange={setSelectedTimeframe}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 3 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mission Impact Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Collection Logs
            </CardTitle>
            <Sandwich className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {platformImpact?.totalCollectionLogs?.toLocaleString() ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Logs recorded in selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {platformImpact?.totalEventsActive ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently new, in process, scheduled, or standby
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Contributors
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {platformImpact?.activeContributors ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Team members active in selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {platformImpact?.totalMessages?.toLocaleString() ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Chat messages across the team in period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Contributions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Team Contributions</CardTitle>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contribution">Overall Impact</SelectItem>
                <SelectItem value="events">Events Assigned</SelectItem>
                <SelectItem value="logs">Collection Logs</SelectItem>
                <SelectItem value="messages">Messages Sent</SelectItem>
                <SelectItem value="resources">Resources Accessed</SelectItem>
                <SelectItem value="active">Days Active</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedUsers.map((user) => (
              <div
                key={user.userId}
                className="flex flex-col gap-4 p-4 border rounded-lg sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1 sm:min-w-[180px]">
                  <p className="text-sm font-medium leading-none">
                    {user.userName}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.role}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-5 sm:flex-1">
                  <div>
                    <div className="text-lg font-semibold">
                      {user.eventsAssigned}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Events
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {user.eventsAssignedCompleted} done ·{' '}
                      {user.eventsAssignedActive} active
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">
                      {user.collectionLogsRecorded}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Collection Logs
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">
                      {user.messagesSent}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Messages
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">
                      {user.resourcesAccessed}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Resources
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">
                      {user.daysActive}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Days Active
                    </div>
                  </div>
                </div>

                <div className="text-right text-xs text-muted-foreground sm:min-w-[140px]">
                  Last active{' '}
                  {user.lastActive
                    ? formatDistanceToNow(new Date(user.lastActive), {
                        addSuffix: true,
                      })
                    : 'never'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* What This Means */}
      <Card className="bg-brand-primary-lighter border-brand-primary-border">
        <CardHeader>
          <CardTitle className="text-brand-primary-darker">
            Understanding Your Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="text-brand-primary-dark">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">Events Assigned</h4>
              <p className="text-sm">
                Total events where the user is the TSP contact or an additional
                contact. Shown alongside how many are completed vs. still
                active (new, in process, scheduled, or standby). Not limited to
                the selected time period — reflects current event load.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Collection Logs</h4>
              <p className="text-sm">
                Number of sandwich collection entries logged by the user in the
                selected period. Counts log entries, not the sandwich totals.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Messages Sent</h4>
              <p className="text-sm">
                Chat messages and project-thread comments sent in the selected
                period. Edited or deleted messages are excluded.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Resources Accessed</h4>
              <p className="text-sm">
                Document uploads, views, and downloads in the resources section
                during the selected period.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
