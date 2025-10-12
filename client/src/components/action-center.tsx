import { useMemo } from 'react';
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
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Target,
  Calendar,
  Users,
  Phone,
  Mail,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import type { SandwichCollection, Host } from '@shared/schema';
import {
  calculateTotalSandwiches,
  parseCollectionDate,
} from '@/lib/analytics-utils';

interface ActionItem {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'engagement' | 'growth' | 'recognition' | 'planning';
  title: string;
  description: string;
  impact: string;
  action: string;
  data?: any;
}

export default function ActionCenter() {
  // Fetch collections data
  const { data: collectionsData } = useQuery<{ collections: SandwichCollection[] }>({
    queryKey: ['/api/sandwich-collections/all'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?limit=5000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
  });

  // Fetch hosts data
  const { data: hostsData } = useQuery<Host[]>({
    queryKey: ['/api/hosts'],
  });

  const collections = collectionsData?.collections || [];
  const hosts = hostsData || [];

  // Calculate actionable insights
  const actionItems = useMemo((): ActionItem[] => {
    if (!collections.length || !hosts.length) return [];

    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Get collections from this month and last month
    const thisMonthCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const lastMonthCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    });

    // Calculate host performance
    const hostPerformance = hosts.map((host) => {
      const thisMonthTotal = thisMonthCollections
        .filter((c) => c.hostName === host.name)
        .reduce((sum, c) => sum + calculateTotalSandwiches(c), 0);

      const lastMonthTotal = lastMonthCollections
        .filter((c) => c.hostName === host.name)
        .reduce((sum, c) => sum + calculateTotalSandwiches(c), 0);

      const allTimeCollections = collections.filter((c) => c.hostName === host.name);
      const allTimeTotal = allTimeCollections.reduce(
        (sum, c) => sum + calculateTotalSandwiches(c),
        0
      );
      const avgMonthly = allTimeTotal / Math.max(1, allTimeCollections.length / 12);

      const lastCollection = allTimeCollections.sort((a, b) => {
        return (
          new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime()
        );
      })[0];

      const daysSinceLastCollection = lastCollection
        ? Math.floor(
            (today.getTime() - parseCollectionDate(lastCollection.collectionDate).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 999;

      return {
        host,
        thisMonthTotal,
        lastMonthTotal,
        avgMonthly,
        percentChange:
          lastMonthTotal > 0
            ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
            : 0,
        daysSinceLastCollection,
        allTimeTotal,
      };
    });

    const actions: ActionItem[] = [];

    // HIGH PRIORITY: Hosts with significant decline
    const decliningHosts = hostPerformance
      .filter(
        (h) =>
          h.percentChange < -30 &&
          h.lastMonthTotal > 0 &&
          h.daysSinceLastCollection < 90
      )
      .sort((a, b) => a.percentChange - b.percentChange)
      .slice(0, 5);

    if (decliningHosts.length > 0) {
      actions.push({
        id: 'declining-hosts',
        priority: 'high',
        category: 'engagement',
        title: `Re-engage ${decliningHosts.length} Declining Hosts`,
        description: `${decliningHosts.length} hosts have decreased collections by 30%+ this month`,
        impact: 'Could recover 500-2000 sandwiches',
        action: 'Contact for check-in',
        data: decliningHosts,
      });
    }

    // HIGH PRIORITY: Inactive hosts (60+ days)
    const inactiveHosts = hostPerformance
      .filter((h) => h.daysSinceLastCollection >= 60 && h.daysSinceLastCollection < 180)
      .sort((a, b) => b.allTimeTotal - a.allTimeTotal)
      .slice(0, 5);

    if (inactiveHosts.length > 0) {
      actions.push({
        id: 'inactive-hosts',
        priority: 'high',
        category: 'engagement',
        title: `${inactiveHosts.length} Hosts Haven't Collected in 60+ Days`,
        description: 'Previously active hosts may need support or re-engagement',
        impact: `These hosts contributed ${inactiveHosts.reduce((s, h) => s + h.allTimeTotal, 0).toLocaleString()} sandwiches historically`,
        action: 'Schedule check-in calls',
        data: inactiveHosts,
      });
    }

    // MEDIUM PRIORITY: Top performers to thank
    const topPerformers = hostPerformance
      .filter((h) => h.thisMonthTotal > 0)
      .sort((a, b) => b.thisMonthTotal - a.thisMonthTotal)
      .slice(0, 5);

    if (topPerformers.length > 0) {
      actions.push({
        id: 'top-performers',
        priority: 'medium',
        category: 'recognition',
        title: 'Thank Top Performers This Month',
        description: `${topPerformers.length} hosts are leading this month with exceptional contributions`,
        impact: 'Boost morale and retention',
        action: 'Send recognition messages',
        data: topPerformers,
      });
    }

    // MEDIUM PRIORITY: Growing hosts
    const growingHosts = hostPerformance
      .filter((h) => h.percentChange > 50 && h.thisMonthTotal > 100)
      .sort((a, b) => b.percentChange - a.percentChange)
      .slice(0, 3);

    if (growingHosts.length > 0) {
      actions.push({
        id: 'growing-hosts',
        priority: 'medium',
        category: 'growth',
        title: `${growingHosts.length} Hosts Showing Strong Growth`,
        description: 'Hosts with 50%+ increase could share best practices',
        impact: 'Scale success strategies network-wide',
        action: 'Interview for case studies',
        data: growingHosts,
      });
    }

    // MEDIUM PRIORITY: Weekly pace projection
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const thisWeekCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date >= thisWeekStart && date <= today;
    });

    const thisWeekTotal = thisWeekCollections.reduce(
      (sum, c) => sum + calculateTotalSandwiches(c),
      0
    );

    const dayOfWeek = today.getDay();
    const projectedWeekTotal =
      dayOfWeek > 0 ? Math.round((thisWeekTotal / dayOfWeek) * 7) : thisWeekTotal;

    // Get average weekly total
    const allWeeklyTotals: number[] = [];
    const weekMap = new Map<string, number>();

    collections.forEach((c) => {
      const date = parseCollectionDate(c.collectionDate);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      const current = weekMap.get(weekKey) || 0;
      weekMap.set(weekKey, current + calculateTotalSandwiches(c));
    });

    allWeeklyTotals.push(...Array.from(weekMap.values()));
    const avgWeekly =
      allWeeklyTotals.length > 0
        ? allWeeklyTotals.reduce((a, b) => a + b, 0) / allWeeklyTotals.length
        : 0;

    const weeklyGap = avgWeekly - projectedWeekTotal;

    if (weeklyGap > 500 && dayOfWeek >= 3) {
      actions.push({
        id: 'weekly-gap',
        priority: 'high',
        category: 'planning',
        title: 'Weekly Collection Below Pace',
        description: `Tracking ${Math.abs(Math.round((weeklyGap / avgWeekly) * 100))}% below average for this week`,
        impact: `${Math.round(weeklyGap)} sandwich shortfall projected`,
        action: 'Rally hosts for end-of-week push',
        data: { thisWeekTotal, projectedWeekTotal, avgWeekly },
      });
    }

    return actions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [collections, hosts]);

  const priorityColors = {
    high: 'bg-red-100 text-red-800 border-red-300',
    medium: 'bg-amber-100 text-amber-800 border-amber-300',
    low: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const categoryIcons = {
    engagement: AlertTriangle,
    growth: TrendingUp,
    recognition: CheckCircle,
    planning: Calendar,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-brand-primary">Action Center</h2>
        <p className="text-gray-600 mt-2">
          Prioritized actions based on your data • {actionItems.length} items need attention
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-red-600">
                  {actionItems.filter((a) => a.priority === 'high').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Medium Priority</p>
                <p className="text-2xl font-bold text-amber-600">
                  {actionItems.filter((a) => a.priority === 'medium').length}
                </p>
              </div>
              <Target className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Engagement</p>
                <p className="text-2xl font-bold text-brand-primary">
                  {actionItems.filter((a) => a.category === 'engagement').length}
                </p>
              </div>
              <Users className="h-8 w-8 text-brand-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recognition</p>
                <p className="text-2xl font-bold text-green-600">
                  {actionItems.filter((a) => a.category === 'recognition').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Items */}
      <div className="space-y-4">
        {actionItems.map((item) => {
          const Icon = categoryIcons[item.category];
          return (
            <Card
              key={item.id}
              className={`border-l-4 ${
                item.priority === 'high'
                  ? 'border-l-red-500'
                  : item.priority === 'medium'
                  ? 'border-l-amber-500'
                  : 'border-l-blue-500'
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Icon className="h-6 w-6 text-gray-600 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-xl">{item.title}</CardTitle>
                        <Badge className={priorityColors[item.priority]}>
                          {item.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <CardDescription className="text-base">
                        {item.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Potential Impact</p>
                    <p className="font-semibold text-brand-primary">{item.impact}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Recommended Action</p>
                    <p className="font-semibold text-brand-primary">{item.action}</p>
                  </div>
                </div>

                {/* Data Details */}
                {item.data && Array.isArray(item.data) && item.data.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      Hosts to Contact:
                    </p>
                    <div className="space-y-2">
                      {item.data.slice(0, 5).map((hostData: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white p-3 rounded-lg border"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{hostData.host.name}</p>
                            <p className="text-sm text-gray-600">
                              {hostData.percentChange !== undefined &&
                                `${hostData.percentChange > 0 ? '+' : ''}${Math.round(hostData.percentChange)}% vs last month`}
                              {hostData.daysSinceLastCollection !== undefined &&
                                ` • ${hostData.daysSinceLastCollection} days since last collection`}
                              {hostData.thisMonthTotal !== undefined &&
                                ` • ${hostData.thisMonthTotal.toLocaleString()} this month`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {hostData.host.email && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={`mailto:${hostData.host.email}`}>
                                  <Mail className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {hostData.host.phone && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={`tel:${hostData.host.phone}`}>
                                  <Phone className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weekly Gap Details */}
                {item.id === 'weekly-gap' && item.data && (
                  <div className="border-t pt-4 mt-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-gray-600">This Week So Far</p>
                        <p className="text-2xl font-bold text-brand-primary">
                          {item.data.thisWeekTotal?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Projected Total</p>
                        <p className="text-2xl font-bold text-amber-600">
                          {item.data.projectedWeekTotal?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Weekly Average</p>
                        <p className="text-2xl font-bold text-gray-700">
                          {Math.round(item.data.avgWeekly)?.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <Button className="w-full" size="lg">
                    {item.action}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {actionItems.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                All Caught Up!
              </h3>
              <p className="text-gray-600">
                No urgent actions needed right now. Keep up the great work!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
