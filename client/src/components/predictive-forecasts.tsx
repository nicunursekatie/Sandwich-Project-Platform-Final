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
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  AlertCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { SandwichCollection } from '@shared/schema';
import {
  calculateTotalSandwiches,
  parseCollectionDate,
} from '@/lib/analytics-utils';

export default function PredictiveForecasts() {
  const { data: collectionsData } = useQuery<{ collections: SandwichCollection[] }>({
    queryKey: ['/api/sandwich-collections/all'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?limit=5000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
  });

  // Fetch event requests for scheduled events forecast
  const { data: eventRequests } = useQuery<any[]>({
    queryKey: ['/api/event-requests'],
    queryFn: async () => {
      const response = await fetch('/api/event-requests?all=true');
      if (!response.ok) throw new Error('Failed to fetch event requests');
      return response.json();
    },
  });

  const collections = collectionsData?.collections || [];

  const forecasts = useMemo(() => {
    if (!collections.length) return null;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthProgress = dayOfMonth / daysInMonth;

    // Calculate scheduled events for current week (Wed-Tue)
    // Week runs Wednesday to Tuesday
    const currentWeekStart = new Date(today);
    const dayOfWeek = today.getDay(); // 0=Sun, 3=Wed
    const daysFromWednesday = (dayOfWeek + 4) % 7; // Days since last Wednesday
    currentWeekStart.setDate(today.getDate() - daysFromWednesday);
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6); // Wed + 6 = Tue
    currentWeekEnd.setHours(23, 59, 59, 999);

    const scheduledThisWeek = (eventRequests || []).filter((event) => {
      if (!event.desiredEventDate) return false;
      if (!['in_process', 'scheduled'].includes(event.status)) return false;

      const eventDate = new Date(event.desiredEventDate);
      return eventDate >= currentWeekStart && eventDate <= currentWeekEnd;
    });

    const scheduledWeeklyTotal = scheduledThisWeek.reduce(
      (sum, event) => sum + (event.estimatedSandwichCount || 0),
      0
    );

    // Get current week collections (already completed)
    const currentWeekCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date >= currentWeekStart && date <= today;
    });

    const currentWeekTotal = currentWeekCollections.reduce(
      (sum, c) => sum + calculateTotalSandwiches(c),
      0
    );

    // Get current month data
    const currentMonthCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const currentMonthTotal = currentMonthCollections.reduce(
      (sum, c) => sum + calculateTotalSandwiches(c),
      0
    );

    // Calculate historical averages
    const weekMap = new Map<string, number>();
    const monthMap = new Map<string, number>();

    collections.forEach((c) => {
      const date = parseCollectionDate(c.collectionDate);

      // Week aggregation (Wed-Tue)
      const weekStart = new Date(date);
      const collectionDayOfWeek = date.getDay();
      const daysFromWed = (collectionDayOfWeek + 4) % 7;
      weekStart.setDate(date.getDate() - daysFromWed);
      const weekKey = weekStart.toISOString().split('T')[0];
      const weekCurrent = weekMap.get(weekKey) || 0;
      weekMap.set(weekKey, weekCurrent + calculateTotalSandwiches(c));

      // Month aggregation
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthCurrent = monthMap.get(monthKey) || 0;
      monthMap.set(monthKey, monthCurrent + calculateTotalSandwiches(c));
    });

    const weeklyTotals = Array.from(weekMap.values());
    const monthlyTotals = Array.from(monthMap.values());

    const avgWeekly = weeklyTotals.length > 0
      ? weeklyTotals.reduce((a, b) => a + b, 0) / weeklyTotals.length
      : 0;

    const avgMonthly = monthlyTotals.length > 0
      ? monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length
      : 0;

    // Weekly projection - combine historical pace with scheduled events
    // For Wed-Tue week: Wed=0 days, Thu=1, Fri=2, Sat=3, Sun=4, Mon=5, Tue=6
    const todayDayOfWeek = today.getDay();
    const daysElapsedInWeek = (todayDayOfWeek + 4) % 7 + 1; // +1 to count today as complete

    // Calculate average collections by day of week for remaining days
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

    // Calculate expected collections for remaining days based on historical averages
    let expectedRemainingDays = 0;
    for (let i = 1; i <= 7 - daysElapsedInWeek; i++) {
      const futureDayOfWeek = (todayDayOfWeek + i) % 7;
      const dayData = dayOfWeekTotals.get(futureDayOfWeek);
      if (dayData && dayData.count > 0) {
        expectedRemainingDays += dayData.total / dayData.count;
      }
    }

    // Combined projection: Already collected + Scheduled events + Expected remaining individual donations
    const weeklyProjected = currentWeekTotal + scheduledWeeklyTotal + Math.round(expectedRemainingDays);

    const weeklyVsAvg = avgWeekly > 0 ? ((weeklyProjected - avgWeekly) / avgWeekly) * 100 : 0;

    // Monthly projection
    const monthlyProjected = monthProgress > 0
      ? Math.round(currentMonthTotal / monthProgress)
      : currentMonthTotal;
    const monthlyVsAvg = ((monthlyProjected - avgMonthly) / avgMonthly) * 100;

    // Calculate remaining days needed for monthly average
    const monthlyGap = avgMonthly - currentMonthTotal;
    const daysRemaining = daysInMonth - dayOfMonth;
    const dailyNeeded = daysRemaining > 0 ? Math.round(monthlyGap / daysRemaining) : 0;

    // Get recent weekly trend (last 4 weeks)
    const recentWeeks = Array.from(weekMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 4)
      .reverse();

    const trendData = recentWeeks.map(([week, total], idx) => ({
      week: `Week ${idx + 1}`,
      actual: total,
      average: avgWeekly,
    }));

    // Add current week projection
    trendData.push({
      week: 'This Week',
      actual: weeklyProjected,
      average: avgWeekly,
    });

    // Calculate trend direction
    const recentThreeWeeks = recentWeeks.slice(-3).map(([, total]) => total);
    const isUptrend = recentThreeWeeks.length >= 2 &&
      recentThreeWeeks[recentThreeWeeks.length - 1] > recentThreeWeeks[0];

    return {
      weekly: {
        current: currentWeekTotal,
        projected: weeklyProjected,
        scheduled: scheduledWeeklyTotal,
        scheduledEventCount: scheduledThisWeek.length,
        expectedIndividual: Math.round(expectedRemainingDays),
        average: Math.round(avgWeekly),
        vsAvg: weeklyVsAvg,
        dayOfWeek: todayDayOfWeek,
        daysRemaining: 7 - daysElapsedInWeek,
      },
      monthly: {
        current: currentMonthTotal,
        projected: monthlyProjected,
        average: Math.round(avgMonthly),
        vsAvg: monthlyVsAvg,
        progress: monthProgress * 100,
        dayOfMonth,
        daysInMonth,
        dailyNeeded: dailyNeeded > 0 ? dailyNeeded : 0,
        gap: monthlyGap > 0 ? monthlyGap : 0,
      },
      trend: {
        isUptrend,
        data: trendData,
      },
    };
  }, [collections, eventRequests]);

  if (!forecasts) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading forecast data...</p>
      </div>
    );
  }

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = weekdays[forecasts.weekly.dayOfWeek];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-brand-primary">Predictive Forecasts</h2>
        <p className="text-gray-600 mt-2">
          Projections based on current pace and historical patterns • Week runs Wed-Tue
        </p>
      </div>

      {/* Weekly Forecast */}
      <Card className="border-l-4 border-l-brand-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Weekly Forecast (Wed-Tue)</CardTitle>
              <CardDescription>
                Projected end-of-week total based on {currentDayName}'s data
              </CardDescription>
            </div>
            <Calendar className="h-8 w-8 text-brand-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Current Week (through {currentDayName})</p>
              <p className="text-3xl font-bold text-brand-primary">
                {forecasts.weekly.current.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1 italic">From collection log</p>
            </div>
            <div className="text-center p-4 bg-brand-primary/10 rounded-lg border-2 border-brand-primary">
              <p className="text-sm text-gray-600 mb-1">Projected Week Total</p>
              <p className="text-3xl font-bold text-brand-primary">
                {forecasts.weekly.projected.toLocaleString()}
              </p>
              <div className="text-xs text-brand-primary mt-2 space-y-0.5">
                <div>{forecasts.weekly.current.toLocaleString()} already collected</div>
                {forecasts.weekly.scheduled > 0 && (
                  <div>+ {forecasts.weekly.scheduledEventCount} scheduled event{forecasts.weekly.scheduledEventCount !== 1 ? 's' : ''} ({forecasts.weekly.scheduled.toLocaleString()})</div>
                )}
                {forecasts.weekly.expectedIndividual > 0 && (
                  <div>+ Expected individual donations ({forecasts.weekly.expectedIndividual.toLocaleString()})</div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">Event requests + historical avg by day</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                {forecasts.weekly.vsAvg >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={`text-sm font-semibold ${
                    forecasts.weekly.vsAvg >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {forecasts.weekly.vsAvg > 0 ? '+' : ''}
                  {Math.round(forecasts.weekly.vsAvg)}% vs avg
                </span>
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Weekly Average</p>
              <p className="text-3xl font-bold text-gray-700">
                {forecasts.weekly.average.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1 italic">Historical avg (all weeks)</p>
            </div>
          </div>

          {forecasts.weekly.vsAvg < -10 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Behind Weekly Pace</p>
                <p className="text-sm text-amber-800 mt-1">
                  Need approximately{' '}
                  {Math.round((forecasts.weekly.average - forecasts.weekly.projected) / forecasts.weekly.daysRemaining)}{' '}
                  sandwiches per day over the next {forecasts.weekly.daysRemaining} days to reach average.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Forecast */}
      <Card className="border-l-4 border-l-brand-teal">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Monthly Forecast</CardTitle>
              <CardDescription>
                End-of-month projection • {Math.round(forecasts.monthly.progress)}% of month complete
              </CardDescription>
            </div>
            <Target className="h-8 w-8 text-brand-teal" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Month Progress</span>
              <span className="text-sm font-semibold text-brand-primary">
                Day {forecasts.monthly.dayOfMonth} of {forecasts.monthly.daysInMonth}
              </span>
            </div>
            <Progress value={forecasts.monthly.progress} className="h-3" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Current Month Total</p>
              <p className="text-3xl font-bold text-brand-primary">
                {forecasts.monthly.current.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1 italic">From collection log</p>
            </div>
            <div className="text-center p-4 bg-brand-teal/10 rounded-lg border-2 border-brand-teal">
              <p className="text-sm text-gray-600 mb-1">Projected Month Total</p>
              <p className="text-3xl font-bold text-brand-teal">
                {forecasts.monthly.projected.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-2 italic">Based on current pace</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                {forecasts.monthly.vsAvg >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={`text-sm font-semibold ${
                    forecasts.monthly.vsAvg >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {forecasts.monthly.vsAvg > 0 ? '+' : ''}
                  {Math.round(forecasts.monthly.vsAvg)}% vs avg
                </span>
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Monthly Average</p>
              <p className="text-3xl font-bold text-gray-700">
                {forecasts.monthly.average.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1 italic">Historical avg (all months)</p>
            </div>
          </div>

          {forecasts.monthly.gap > 0 && (
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
              <p className="font-semibold text-blue-900 mb-2">Path to Monthly Average</p>
              <p className="text-sm text-blue-800">
                Need {forecasts.monthly.gap.toLocaleString()} more sandwiches over the next{' '}
                {forecasts.monthly.daysInMonth - forecasts.monthly.dayOfMonth} days to reach monthly average.
              </p>
              <p className="text-sm text-blue-800 mt-1">
                <span className="font-semibold">Daily target: </span>
                ~{forecasts.monthly.dailyNeeded.toLocaleString()} sandwiches/day
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trend Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Trend Analysis
          </CardTitle>
          <CardDescription>
            Recent performance vs. historical average
            {forecasts.trend.isUptrend && (
              <Badge className="ml-2 bg-green-100 text-green-800">Upward Trend</Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecasts.trend.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(1)}K`} />
                <Tooltip
                  formatter={(value: number) => value.toLocaleString()}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #ccc' }}
                />
                <ReferenceLine
                  y={forecasts.weekly.average}
                  stroke="#666"
                  strokeDasharray="3 3"
                  label="Average"
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="var(--color-brand-primary)"
                  strokeWidth={3}
                  dot={{ fill: 'var(--color-brand-primary)', r: 5 }}
                  name="Actual"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
