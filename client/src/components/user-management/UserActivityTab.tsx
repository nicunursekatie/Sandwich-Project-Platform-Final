import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Calendar, Clock, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserActivityTabProps {
  userId: string;
  userName: string;
}

export function UserActivityTab({ userId, userName }: UserActivityTabProps) {
  const { data: activityStats, isLoading } = useQuery({
    queryKey: ['/api/enhanced-user-activity/user-stats', userId],
    queryFn: async () => {
      const res = await fetch(`/api/enhanced-user-activity/user-stats/${userId}?days=30`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch activity stats');
      return res.json();
    },
  });

  const { data: recentLogs } = useQuery({
    queryKey: ['/api/enhanced-user-activity/logs', userId],
    queryFn: async () => {
      const res = await fetch(`/api/enhanced-user-activity/logs?userId=${userId}&days=7`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch activity logs');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  const totalActions = activityStats?.totalActions || 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">User Activity</h3>
        <p className="text-sm text-gray-600">
          Activity history for {userName} (last 30 days)
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-brand-primary-light rounded-lg">
                <Activity className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Actions</p>
                <p className="text-2xl font-bold">{totalActions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Top Sections</p>
                <p className="text-lg font-semibold">
                  {activityStats?.sectionBreakdown?.[0]?.section || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Most Active</p>
                <p className="text-lg font-semibold">
                  {activityStats?.peakUsageTimes?.[0]?.hour
                    ? `${activityStats.peakUsageTimes[0].hour}:00`
                    : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Work Summary */}
      {recentLogs && recentLogs.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Recent Work Summary</h4>
          <div className="space-y-2">
            {(() => {
              // Filter out "View" actions - only show actual work
              const workActions = recentLogs.filter((log: any) => 
                log.action !== 'View' && 
                log.details && 
                !log.details.toLowerCase().includes('viewed')
              );
              
              if (workActions.length === 0) {
                return (
                  <p className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">
                    No recorded work actions in the last 7 days (only page views)
                  </p>
                );
              }
              
              return workActions.slice(0, 5).map((log: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {log.details}
                    </p>
                    {log.section && (
                      <p className="text-xs text-gray-500 mt-1">
                        {log.section} • {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}


      {totalActions === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>No activity recorded in the last 30 days</p>
        </div>
      )}
    </div>
  );
}
