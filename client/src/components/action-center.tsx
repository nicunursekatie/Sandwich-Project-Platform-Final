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

  const collections = collectionsData?.collections || [];

  // Calculate actionable insights focused on operations, not individual hosts
  const actionItems = useMemo((): ActionItem[] => {
    if (!collections.length) return [];

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const dayOfWeek = today.getDay();

    // Current week analysis
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date >= currentWeekStart && date <= today;
    });

    const currentWeekTotal = currentWeekCollections.reduce(
      (sum, c) => sum + calculateTotalSandwiches(c),
      0
    );

    // Calculate weekly average
    const weekMap = new Map<string, number>();
    collections.forEach((c) => {
      const date = parseCollectionDate(c.collectionDate);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      const current = weekMap.get(weekKey) || 0;
      weekMap.set(weekKey, current + calculateTotalSandwiches(c));
    });

    const weeklyTotals = Array.from(weekMap.values());
    const avgWeekly = weeklyTotals.length > 0
      ? weeklyTotals.reduce((a, b) => a + b, 0) / weeklyTotals.length
      : 0;

    const projectedWeekTotal = dayOfWeek > 0
      ? Math.round((currentWeekTotal / dayOfWeek) * 7)
      : currentWeekTotal;

    const weeklyGap = avgWeekly - projectedWeekTotal;

    const actions: ActionItem[] = [];

    // HIGH PRIORITY: Weekly pace behind
    if (weeklyGap > 500 && dayOfWeek >= 3) {
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


    // MEDIUM PRIORITY: Celebrate top collection day
    if (currentWeekCollections.length > 0) {
      const bestDayThisWeek = currentWeekCollections.reduce(
        (max, c) => calculateTotalSandwiches(c) > calculateTotalSandwiches(max) ? c : max,
        currentWeekCollections[0]
      );
      const bestDayTotal = calculateTotalSandwiches(bestDayThisWeek);

      if (bestDayTotal > 300) {
        actions.push({
          id: 'celebrate-success',
          priority: 'medium',
          category: 'recognition',
          title: 'Celebrate This Week\'s Success',
          description: `${bestDayTotal.toLocaleString()} sandwiches collected on ${parseCollectionDate(bestDayThisWeek.collectionDate).toLocaleDateString()}`,
          impact: 'Build momentum and volunteer morale',
          action: 'Share success story on social media',
          data: { bestDayThisWeek, bestDayTotal },
        });
      }
    }

    // MEDIUM PRIORITY: Month-end push
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dayOfMonth = today.getDate();
    const daysRemaining = daysInMonth - dayOfMonth;

    if (daysRemaining <= 7 && daysRemaining > 0) {
      const currentMonthCollections = collections.filter((c) => {
        const date = parseCollectionDate(c.collectionDate);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });

      const currentMonthTotal = currentMonthCollections.reduce(
        (sum, c) => sum + calculateTotalSandwiches(c),
        0
      );

      // Get average monthly total
      const monthMap = new Map<string, number>();
      collections.forEach((c) => {
        const date = parseCollectionDate(c.collectionDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const current = monthMap.get(monthKey) || 0;
        monthMap.set(monthKey, current + calculateTotalSandwiches(c));
      });

      const monthlyTotals = Array.from(monthMap.values());
      const avgMonthly = monthlyTotals.length > 0
        ? monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length
        : 0;

      const monthlyGap = avgMonthly - currentMonthTotal;

      if (monthlyGap > 1000) {
        actions.push({
          id: 'month-end-push',
          priority: 'medium',
          category: 'volunteer-recruitment',
          title: `${daysRemaining} Days Left in Month`,
          description: `Currently ${Math.round((monthlyGap / avgMonthly) * 100)}% below monthly average`,
          impact: `Need ${Math.round(monthlyGap / daysRemaining)} sandwiches/day to reach average`,
          action: 'Schedule end-of-month volunteer drive',
          data: { daysRemaining, monthlyGap, currentMonthTotal, avgMonthly },
        });
      }
    }


    // LOW PRIORITY: Maintain momentum
    const recentWeeks = Array.from(weekMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 4)
      .map(([, total]) => total);

    const isUptrend = recentWeeks.length >= 2 && recentWeeks[0] > recentWeeks[recentWeeks.length - 1];

    if (isUptrend && recentWeeks[0] > avgWeekly * 1.1) {
      actions.push({
        id: 'maintain-momentum',
        priority: 'low',
        category: 'planning',
        title: 'Momentum Building - Keep It Going!',
        description: `Collections up ${Math.round(((recentWeeks[0] - avgWeekly) / avgWeekly) * 100)}% vs average`,
        impact: 'Sustaining growth builds program capacity',
        action: 'Thank volunteers and maintain engagement',
        data: { recentWeeks, avgWeekly },
      });
    }

    return actions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [collections]);

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
