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
  TrendingUp,
  Target,
  Calendar,
  Users,
  CheckCircle,
  ArrowRight,
  Clock,
  MapPin,
} from 'lucide-react';
import type { SandwichCollection } from '@shared/schema';
import {
  calculateTotalSandwiches,
  parseCollectionDate,
} from '@/lib/analytics-utils';

interface ActionItem {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'volunteer-recruitment' | 'scheduling' | 'recognition' | 'planning';
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

  // Fetch event requests for forward-looking insights
  const { data: eventRequests } = useQuery<any[]>({
    queryKey: ['/api/event-requests'],
    queryFn: async () => {
      const response = await fetch('/api/event-requests?all=true');
      if (!response.ok) throw new Error('Failed to fetch event requests');
      return response.json();
    },
  });

  const collections = collectionsData?.collections || [];

  // Calculate actionable insights focused on forward-looking event forecasting
  const actionItems = useMemo((): ActionItem[] => {
    if (!collections.length) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const dayOfWeek = today.getDay();

    // Current week analysis (Wed-Tue)
    const currentWeekStart = new Date(today);
    const daysFromWednesday = (dayOfWeek + 4) % 7;
    currentWeekStart.setDate(today.getDate() - daysFromWednesday);
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date >= currentWeekStart && date <= today;
    });

    const currentWeekTotal = currentWeekCollections.reduce(
      (sum, c) => sum + calculateTotalSandwiches(c),
      0
    );

    // Calculate weekly average (Wed-Tue weeks)
    const weekMap = new Map<string, number>();
    collections.forEach((c) => {
      const date = parseCollectionDate(c.collectionDate);
      const weekStart = new Date(date);
      const collectionDayOfWeek = date.getDay();
      const daysFromWed = (collectionDayOfWeek + 4) % 7;
      weekStart.setDate(date.getDate() - daysFromWed);
      const weekKey = weekStart.toISOString().split('T')[0];
      const current = weekMap.get(weekKey) || 0;
      weekMap.set(weekKey, current + calculateTotalSandwiches(c));
    });

    const weeklyTotals = Array.from(weekMap.values());
    const avgWeekly = weeklyTotals.length > 0
      ? weeklyTotals.reduce((a, b) => a + b, 0) / weeklyTotals.length
      : 0;

    const daysElapsedInWeek = (dayOfWeek + 4) % 7 + 1;
    const projectedWeekTotal = currentWeekTotal > 0
      ? Math.round((currentWeekTotal / daysElapsedInWeek) * 7)
      : currentWeekTotal;

    const actions: ActionItem[] = [];

    // Calculate average collections by day of week for forecasting
    const dayOfWeekTotals = new Map<number, { total: number; count: number }>();
    collections.forEach((c) => {
      const date = parseCollectionDate(c.collectionDate);
      const dow = date.getDay();
      const current = dayOfWeekTotals.get(dow) || { total: 0, count: 0 };
      dayOfWeekTotals.set(dow, {
        total: current.total + calculateTotalSandwiches(c),
        count: current.count + 1,
      });
    });

    // Look ahead at next 4 weeks and forecast based on scheduled events + expected individual donations
    for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() + (weekOffset * 7));

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // For current week, only calculate expected donations for remaining days
      const isCurrentWeek = weekOffset === 0;
      const startDay = isCurrentWeek ? today : weekStart;

      // Get scheduled events for this week
      const scheduledThisWeek = (eventRequests || []).filter((event) => {
        if (!event.desiredEventDate) return false;
        if (!['in_process', 'scheduled'].includes(event.status)) return false;

        const eventDate = new Date(event.desiredEventDate);
        return eventDate >= weekStart && eventDate <= weekEnd;
      });

      const scheduledTotal = scheduledThisWeek.reduce(
        (sum, event) => sum + (event.estimatedSandwichCount || 0),
        0
      );

      // Calculate expected individual donations for the week (or remaining days)
      let expectedIndividualDonations = 0;
      const currentDate = new Date(startDay);
      while (currentDate <= weekEnd) {
        const dow = currentDate.getDay();
        const dayData = dayOfWeekTotals.get(dow);
        if (dayData && dayData.count > 0) {
          expectedIndividualDonations += dayData.total / dayData.count;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Total forecast = scheduled events + expected individual donations + already collected (if current week)
      const alreadyCollected = isCurrentWeek ? currentWeekTotal : 0;
      const totalForecast = alreadyCollected + scheduledTotal + Math.round(expectedIndividualDonations);

      // Get historical average for comparison
      const historicalWeeks = Array.from(weekMap.values());
      const avgForWeek = historicalWeeks.length > 0
        ? historicalWeeks.reduce((a, b) => a + b, 0) / historicalWeeks.length
        : avgWeekly;

      // Flag if total forecast is significantly below average
      const gap = avgForWeek - totalForecast;
      const percentBelow = avgForWeek > 0 ? (gap / avgForWeek) * 100 : 0;

      if (gap > 500 && percentBelow > 20) {
        const weekLabel = weekOffset === 0 ? 'This Week' :
                         weekOffset === 1 ? 'Next Week' :
                         `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        actions.push({
          id: `low-forecast-week-${weekOffset}`,
          priority: weekOffset === 0 ? 'high' : weekOffset === 1 ? 'high' : 'medium',
          category: 'volunteer-recruitment',
          title: `${weekLabel}: Forecasted Below Average`,
          description: `Forecast ${totalForecast.toLocaleString()} sandwiches vs ${Math.round(avgForWeek).toLocaleString()} average`,
          impact: `Need ${Math.round(gap).toLocaleString()} more sandwiches to reach typical week`,
          action: `Recruit volunteers for collections during ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          data: { weekStart, weekEnd, totalForecast, scheduledTotal, expectedIndividualDonations: Math.round(expectedIndividualDonations), avgForWeek, gap, scheduledEventCount: scheduledThisWeek.length },
        });
      }
    }

    // MEDIUM: Current week falling behind pace (only if not already flagged above)
    const weeklyGap = avgWeekly - projectedWeekTotal;
    const alreadyFlaggedThisWeek = actions.some(a => a.id === 'low-forecast-week-0');

    if (!alreadyFlaggedThisWeek && weeklyGap > 500 && dayOfWeek >= 3) {
      actions.push({
        id: 'weekly-pace',
        priority: 'high',
        category: 'volunteer-recruitment',
        title: 'Weekly Collections Below Average Pace',
        description: `Currently tracking ${Math.abs(Math.round((weeklyGap / avgWeekly) * 100))}% below typical weekly collections`,
        impact: `Need ~${Math.round(weeklyGap)} more sandwiches to reach average week`,
        action: 'Recruit volunteers for end-of-week collections',
        data: { currentWeekTotal, projectedWeekTotal, avgWeekly, gap: weeklyGap },
      });
    }

    return actions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [collections, eventRequests]);

  const priorityColors = {
    high: 'bg-red-100 text-red-800 border-red-300',
    medium: 'bg-amber-100 text-amber-800 border-amber-300',
    low: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const categoryIcons = {
    'volunteer-recruitment': Users,
    scheduling: Calendar,
    recognition: CheckCircle,
    planning: Target,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-brand-primary">Action Center</h2>
        <p className="text-gray-600 mt-2">
          Strategic opportunities for volunteer recruitment and program growth • {actionItems.length} insights
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
                <p className="text-sm text-gray-600">Recruitment</p>
                <p className="text-2xl font-bold text-brand-primary">
                  {actionItems.filter((a) => a.category === 'volunteer-recruitment').length}
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
                <p className="text-sm text-gray-600">Scheduling</p>
                <p className="text-2xl font-bold text-brand-teal">
                  {actionItems.filter((a) => a.category === 'scheduling').length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-brand-teal" />
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

                {/* Weekly Pace Details */}
                {item.id === 'weekly-pace' && item.data && (
                  <div className="border-t pt-4 mt-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-gray-600">This Week So Far</p>
                        <p className="text-2xl font-bold text-brand-primary">
                          {item.data.currentWeekTotal?.toLocaleString()}
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
                Program is running smoothly. Keep up the great work!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
