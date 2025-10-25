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
import { logger } from '@/lib/logger';

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

  // Fetch weekly monitoring status to check if core hosts have reported
  const { data: weeklyMonitoring } = useQuery<any[]>({
    queryKey: ['/api/core/monitoring/weekly-status', 0], // 0 = current week
    queryFn: async () => {
      const response = await fetch('/api/core/monitoring/weekly-status/0');
      if (!response.ok) throw new Error('Failed to fetch weekly monitoring');
      return response.json();
    },
  });

  const collections = collectionsData?.collections || [];

  const forecasts = useMemo(() => {
    if (!collections.length) return null;

    // Check if core hosts have reported for current week
    const coreHostsReported = weeklyMonitoring ? 
      weeklyMonitoring.filter((status: any) => status.hasSubmitted).length : 0;
    const totalCoreHosts = weeklyMonitoring ? weeklyMonitoring.length : 8; // Default to 8 expected hosts
    const reportingPercentage = totalCoreHosts > 0 ? (coreHostsReported / totalCoreHosts) * 100 : 100;
    const hasIncompleteReporting = reportingPercentage < 80; // Flag if less than 80% have reported

    const today = new Date();

    // Helper function for consistent date formatting
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthProgress = dayOfMonth / daysInMonth;

    // Calculate scheduled events for current week (Fri-Thu)
    // Week runs Friday to Thursday (distribution day)
    const currentWeekStart = new Date(today);
    const dayOfWeek = today.getDay(); // 0=Sun, 5=Fri
    const daysFromFriday = (dayOfWeek + 2) % 7; // Days since last Friday
    currentWeekStart.setDate(today.getDate() - daysFromFriday);
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6); // Fri + 6 = Thu
    currentWeekEnd.setHours(23, 59, 59, 999);

    // Check if current week is complete (past Thursday)
    const isCurrentWeekComplete = today > currentWeekEnd;

    const scheduledThisWeek = (eventRequests || []).filter((event) => {
      if (!event.desiredEventDate) return false;
      // Include in_process, scheduled, AND completed events for accurate weekly totals
      if (!['in_process', 'scheduled', 'completed'].includes(event.status)) return false;

      const eventDate = new Date(event.desiredEventDate);
      return eventDate >= currentWeekStart && eventDate <= currentWeekEnd;
    });

    // Debug: Show ALL events in the current week range regardless of status
    const allEventsThisWeek = (eventRequests || []).filter((event) => {
      if (!event.desiredEventDate) return false;
      const eventDate = new Date(event.desiredEventDate);
      return eventDate >= currentWeekStart && eventDate <= currentWeekEnd;
    });

    logger.log('🔍 ALL events this week (any status):', allEventsThisWeek.map(e => ({
      org: e.organizationName,
      date: e.desiredEventDate,
      count: e.estimatedSandwichCount,
      status: e.status
    })));

    const scheduledWeeklyTotal = scheduledThisWeek.reduce(
      (sum, event) => sum + (event.estimatedSandwichCount || 0),
      0
    );

    // Get current week collections (already completed AND planned for future dates this week)
    const currentWeekCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date >= currentWeekStart && date <= currentWeekEnd;
    });

    // Split into completed (past) and planned (future)
    const completedThisWeek = currentWeekCollections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date <= today;
    });

    const plannedThisWeek = currentWeekCollections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date > today;
    });

    const currentWeekTotal = currentWeekCollections.reduce(
      (sum, c) => sum + calculateTotalSandwiches(c),
      0
    );

    const completedTotal = completedThisWeek.reduce(
      (sum, c) => sum + calculateTotalSandwiches(c),
      0
    );

    const plannedTotal = plannedThisWeek.reduce(
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

    // Baseline expectation for individual donations per week (5k sandwiches)
    const baselineIndividualExpectation = 5000;

    // Combined projection: Already collected + Scheduled events + Baseline individual expectation
    const weeklyProjected = currentWeekTotal + scheduledWeeklyTotal + baselineIndividualExpectation;

    // Debug logging
    logger.log('=== WEEKLY FORECAST DEBUG ===');
    logger.log('Week range:', formatDate(currentWeekStart), 'to', formatDate(currentWeekEnd));
    logger.log('Today:', today.toLocaleDateString());
    logger.log('Current day of week:', todayDayOfWeek, '(0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)');
    logger.log('---');
    logger.log('Completed this week (past dates):', completedTotal);
    logger.log('Planned collections this week (future dates):', plannedTotal);
    logger.log('Planned collections detail:', plannedThisWeek.map(c => ({
      date: c.collectionDate,
      total: calculateTotalSandwiches(c),
      individual: c.individualSandwiches || 0,
      groups: c.groupCollections || []
    })));
    logger.log('---');
    logger.log('Scheduled events total:', scheduledWeeklyTotal);
    logger.log('Scheduled events count:', scheduledThisWeek.length);
    logger.log('Scheduled events detail:', scheduledThisWeek.map(e => ({
      org: e.organizationName,
      date: e.desiredEventDate,
      count: e.estimatedSandwichCount,
      status: e.status
    })));
    logger.log('---');
    logger.log('Expected remaining individual donations:', Math.round(expectedRemainingDays));
    logger.log('Days elapsed in week:', daysElapsedInWeek);
    logger.log('Days remaining in week:', 7 - daysElapsedInWeek);
    logger.log('---');
    logger.log('📊 TOTAL PROJECTED:', weeklyProjected);
    logger.log('📈 Average weekly:', Math.round(avgWeekly));
    logger.log('Difference:', weeklyProjected - avgWeekly);

    // Also log ALL collections with future dates to help find the missing 2900
    const allFutureCollections = collections.filter((c) => {
      const date = parseCollectionDate(c.collectionDate);
      return date > today;
    }).slice(0, 20); // First 20 to not spam console
    logger.log('---');
    logger.log('🔍 ALL future collections (first 20):', allFutureCollections.map(c => ({
      date: c.collectionDate,
      total: calculateTotalSandwiches(c),
      host: c.hostName || 'Unknown',
      groups: c.groupCollections || []
    })));

    const weeklyVsAvg = avgWeekly > 0 ? ((weeklyProjected - avgWeekly) / avgWeekly) * 100 : 0;
    const weeklyAbsDiff = Math.abs(weeklyProjected - avgWeekly);
    // Within range if difference is 300 or less sandwiches
    const isWeeklyWithinRange = weeklyAbsDiff <= 300;

    // Monthly projection
    const monthlyProjected = monthProgress > 0
      ? Math.round(currentMonthTotal / monthProgress)
      : currentMonthTotal;
    const monthlyVsAvg = ((monthlyProjected - avgMonthly) / avgMonthly) * 100;
    const monthlyAbsDiff = Math.abs(monthlyProjected - avgMonthly);
    const isMonthlyWithinRange = monthlyAbsDiff <= 300;

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
        completed: completedTotal,
        planned: plannedTotal,
        projected: weeklyProjected,
        scheduled: scheduledWeeklyTotal,
        scheduledEventCount: scheduledThisWeek.length,
        expectedIndividual: baselineIndividualExpectation,
        average: Math.round(avgWeekly),
        vsAvg: weeklyVsAvg,
        absDiff: weeklyAbsDiff,
        isWithinRange: isWeeklyWithinRange,
        dayOfWeek: todayDayOfWeek,
        daysRemaining: 7 - daysElapsedInWeek,
        isComplete: isCurrentWeekComplete,
        weekStart: formatDate(currentWeekStart),
        weekEnd: formatDate(currentWeekEnd),
        // Host reporting status
        coreHostsReported,
        totalCoreHosts,
        reportingPercentage,
        hasIncompleteReporting,
      },
      monthly: {
        current: currentMonthTotal,
        projected: monthlyProjected,
        average: Math.round(avgMonthly),
        vsAvg: monthlyVsAvg,
        absDiff: monthlyAbsDiff,
        isWithinRange: isMonthlyWithinRange,
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
  }, [collections, eventRequests, weeklyMonitoring]);

  if (!forecasts) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading forecast data...</p>
      </div>
    );
  }

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = weekdays[forecasts.weekly.dayOfWeek];

  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-brand-primary">Predictive Forecasts</h2>
        <p className="text-gray-600 mt-2">
          Projections based on current pace and historical patterns • Week runs Fri-Thu
        </p>
      </div>

      {/* Weekly Forecast */}
      <Card className="border-l-4 border-l-brand-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                Weekly Forecast
                {!forecasts.weekly.isComplete && (
                  <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                    Week in Progress
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {forecasts.weekly.weekStart} - {forecasts.weekly.weekEnd} • Currently {currentDayName}
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
            <div className={`text-center p-4 rounded-lg border-2 ${
              forecasts.weekly.vsAvg >= 10
                ? 'bg-[#007E8C]/10 border-[#007E8C]'
                : forecasts.weekly.isWithinRange || forecasts.weekly.vsAvg >= 0
                ? 'bg-brand-primary/10 border-brand-primary'
                : forecasts.weekly.vsAvg >= -10
                ? 'bg-brand-orange/20 border-brand-orange'
                : 'bg-[#A31C41]/10 border-[#A31C41]'
            }`}>
              <p className="text-sm text-gray-600 mb-1">Projected Week Total</p>
              <p className={`text-3xl font-bold ${
                forecasts.weekly.vsAvg >= 10 ? 'text-[#007E8C]' :
                forecasts.weekly.isWithinRange || forecasts.weekly.vsAvg >= 0 ? 'text-brand-primary' :
                forecasts.weekly.vsAvg >= -10 ? 'text-brand-orange' :
                'text-[#A31C41]'
              }`}>
                {forecasts.weekly.projected.toLocaleString()}
              </p>
              <div className="text-xs text-gray-700 mt-2 space-y-0.5">
                <div>{forecasts.weekly.completed.toLocaleString()} completed (past)</div>
                {forecasts.weekly.planned > 0 && (
                  <div>+ {forecasts.weekly.planned.toLocaleString()} planned group collections</div>
                )}
                {forecasts.weekly.scheduled > 0 && (
                  <div>+ {forecasts.weekly.scheduledEventCount} scheduled event{forecasts.weekly.scheduledEventCount !== 1 ? 's' : ''} ({forecasts.weekly.scheduled.toLocaleString()})</div>
                )}
                {forecasts.weekly.expectedIndividual > 0 && (
                  <div>+ {forecasts.weekly.expectedIndividual.toLocaleString()} expected individual</div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">Collections log + events + historical avg</p>

              {/* Clear status indicator */}
              <div className={`mt-3 px-3 py-2 rounded-md font-semibold text-sm ${
                forecasts.weekly.vsAvg >= 10
                  ? 'bg-[#007E8C] text-white'
                  : forecasts.weekly.isWithinRange || forecasts.weekly.vsAvg >= 0
                  ? 'bg-brand-primary text-white'
                  : forecasts.weekly.vsAvg >= -10
                  ? 'bg-brand-orange text-white'
                  : 'bg-[#A31C41] text-white'
              }`}>
                {forecasts.weekly.vsAvg >= 10 ? (
                  <>
                    <TrendingUp className="inline h-4 w-4 mr-1" />
                    Exceeding Average (+{Math.round(forecasts.weekly.vsAvg)}%)
                  </>
                ) : forecasts.weekly.isWithinRange || forecasts.weekly.vsAvg >= 0 ? (
                  <>
                    <Target className="inline h-4 w-4 mr-1" />
                    On Track (Within Range)
                  </>
                ) : forecasts.weekly.vsAvg >= -10 ? (
                  <>
                    <AlertCircle className="inline h-4 w-4 mr-1" />
                    Slightly Below Average ({Math.round(forecasts.weekly.vsAvg)}%)
                  </>
                ) : (
                  <>
                    <TrendingDown className="inline h-4 w-4 mr-1" />
                    Significantly Below Average ({Math.round(forecasts.weekly.vsAvg)}%)
                  </>
                )}
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
            <div className="bg-[#A31C41]/10 border-2 border-[#A31C41] rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[#A31C41] mt-0.5" />
              <div>
                <p className="font-semibold text-[#A31C41]">Action Needed: Below Weekly Target</p>
                <p className="text-sm text-gray-700 mt-1">
                  Need {Math.round(forecasts.weekly.average - forecasts.weekly.projected).toLocaleString()} more sandwiches this week to reach average weekly performance.
                </p>
              </div>
            </div>
          )}
          {forecasts.weekly.vsAvg >= -10 && forecasts.weekly.vsAvg < 0 && (
            <div className="bg-brand-orange/10 border-2 border-brand-orange rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-brand-orange mt-0.5" />
              <div>
                <p className="font-semibold text-brand-orange">Slightly Below Weekly Average</p>
                <p className="text-sm text-gray-700 mt-1">
                  {Math.round(forecasts.weekly.average - forecasts.weekly.projected).toLocaleString()} more sandwiches needed this week to meet historical average.
                </p>
              </div>
            </div>
          )}
          {forecasts.weekly.vsAvg >= 10 && (
            <div className="bg-[#007E8C]/10 border-2 border-[#007E8C] rounded-lg p-4 flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-[#007E8C] mt-0.5" />
              <div>
                <p className="font-semibold text-[#007E8C]">Excellent Week!</p>
                <p className="text-sm text-gray-700 mt-1">
                  On track to exceed weekly average by {Math.round(forecasts.weekly.projected - forecasts.weekly.average).toLocaleString()} sandwiches.
                </p>
              </div>
            </div>
          )}

          {/* Actionable Suggestions - What to do */}
          <div className="mt-6 bg-brand-teal/10 border-2 border-brand-teal rounded-lg p-4">
            <h4 className="font-semibold text-brand-teal mb-2 flex items-center gap-2">
              <Target className="h-5 w-5" />
              What to do this week
            </h4>
            <div className="space-y-2 text-sm">
              {forecasts.weekly.vsAvg < -10 && (
                <>
                  <p className="text-gray-700">• <strong>Priority:</strong> Add one more collection event or send out volunteer reminder to {forecasts.weekly.daysRemaining} remaining days</p>
                  <p className="text-gray-700">• <strong>Goal:</strong> Recruit ~{Math.round((forecasts.weekly.average - forecasts.weekly.projected) / forecasts.weekly.daysRemaining)} sandwiches/day for remaining {forecasts.weekly.daysRemaining} days</p>
                </>
              )}
              {forecasts.weekly.vsAvg >= -10 && forecasts.weekly.vsAvg < 0 && (
                <>
                  <p className="text-gray-700">• <strong>Action:</strong> Light outreach to individual volunteers could close the gap</p>
                  <p className="text-gray-700">• <strong>Target:</strong> {Math.round(forecasts.weekly.average - forecasts.weekly.projected)} more sandwiches needed this week</p>
                </>
              )}
              {forecasts.weekly.isWithinRange && forecasts.weekly.vsAvg >= 0 && forecasts.weekly.vsAvg < 10 && (
                <>
                  <p className="text-gray-700">• <strong>Status:</strong> On track! Maintain current momentum</p>
                  <p className="text-gray-700">• <strong>Recommendation:</strong> Continue regular host check-ins and event coordination</p>
                </>
              )}
              {forecasts.weekly.vsAvg >= 10 && (
                <>
                  <p className="text-gray-700">• <strong>Celebrate:</strong> Share this success with your team and volunteers!</p>
                  <p className="text-gray-700">• <strong>Opportunity:</strong> Document what worked well this week to replicate in future weeks</p>
                </>
              )}
              <p className="text-gray-700">• <strong>Scheduled events:</strong> {forecasts.weekly.scheduledEventCount} event{forecasts.weekly.scheduledEventCount !== 1 ? 's' : ''} for {forecasts.weekly.scheduled.toLocaleString()} sandwiches</p>
              <p className="text-gray-700">• <strong>Expected individual collections:</strong> ~{forecasts.weekly.expectedIndividual.toLocaleString()} sandwiches from regular donors</p>
            </div>
          </div>
          
          {/* Host Reporting Warning */}
          {forecasts.weekly.hasIncompleteReporting && forecasts.weekly.vsAvg < 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-800">Incomplete Host Reporting</p>
                <p className="text-sm text-gray-700 mt-1">
                  Only {forecasts.weekly.coreHostsReported} of {forecasts.weekly.totalCoreHosts} core hosts ({Math.round(forecasts.weekly.reportingPercentage)}%) have reported this week. 
                  Low count may be due to missing data rather than actual performance issues.
                </p>
                <p className="text-xs text-gray-600 mt-2 italic">
                  Check the Weekly Monitoring dashboard to see which hosts haven't reported yet.
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
                {currentMonth} • Day {forecasts.monthly.dayOfMonth} of {forecasts.monthly.daysInMonth} ({Math.round(forecasts.monthly.progress)}% complete)
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
            <div className={`text-center p-4 rounded-lg border-2 ${
              forecasts.monthly.vsAvg >= 10
                ? 'bg-[#007E8C]/10 border-[#007E8C]'
                : forecasts.monthly.isWithinRange || forecasts.monthly.vsAvg >= 0
                ? 'bg-brand-teal/10 border-brand-teal'
                : forecasts.monthly.vsAvg >= -10
                ? 'bg-brand-orange/20 border-brand-orange'
                : 'bg-[#A31C41]/10 border-[#A31C41]'
            }`}>
              <p className="text-sm text-gray-600 mb-1">Projected Month Total</p>
              <p className={`text-3xl font-bold ${
                forecasts.monthly.vsAvg >= 10 ? 'text-[#007E8C]' :
                forecasts.monthly.isWithinRange || forecasts.monthly.vsAvg >= 0 ? 'text-brand-teal' :
                forecasts.monthly.vsAvg >= -10 ? 'text-brand-orange' :
                'text-[#A31C41]'
              }`}>
                {forecasts.monthly.projected.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-2 italic">Based on current pace</p>

              {/* Clear status indicator */}
              <div className={`mt-3 px-3 py-2 rounded-md font-semibold text-sm ${
                forecasts.monthly.vsAvg >= 10
                  ? 'bg-[#007E8C] text-white'
                  : forecasts.monthly.isWithinRange || forecasts.monthly.vsAvg >= 0
                  ? 'bg-brand-teal text-white'
                  : forecasts.monthly.vsAvg >= -10
                  ? 'bg-brand-orange text-white'
                  : 'bg-[#A31C41] text-white'
              }`}>
                {forecasts.monthly.vsAvg >= 10 ? (
                  <>
                    <TrendingUp className="inline h-4 w-4 mr-1" />
                    Exceeding Average (+{Math.round(forecasts.monthly.vsAvg)}%)
                  </>
                ) : forecasts.monthly.isWithinRange || forecasts.monthly.vsAvg >= 0 ? (
                  <>
                    <Target className="inline h-4 w-4 mr-1" />
                    On Track (Within Range)
                  </>
                ) : forecasts.monthly.vsAvg >= -10 ? (
                  <>
                    <AlertCircle className="inline h-4 w-4 mr-1" />
                    Slightly Below Average ({Math.round(forecasts.monthly.vsAvg)}%)
                  </>
                ) : (
                  <>
                    <TrendingDown className="inline h-4 w-4 mr-1" />
                    Significantly Below Average ({Math.round(forecasts.monthly.vsAvg)}%)
                  </>
                )}
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
            <div className="bg-brand-primary/10 border-2 border-brand-primary rounded-lg p-4">
              <p className="font-semibold text-brand-primary mb-2">Path to Monthly Average</p>
              <p className="text-sm text-gray-700">
                Need {forecasts.monthly.gap.toLocaleString()} more sandwiches over the remaining{' '}
                {forecasts.monthly.daysInMonth - forecasts.monthly.dayOfMonth} days to reach monthly average.
              </p>
              <p className="text-sm text-gray-700 mt-1">
                <span className="font-semibold">Weekly target: </span>
                ~{Math.round((forecasts.monthly.gap / (forecasts.monthly.daysInMonth - forecasts.monthly.dayOfMonth)) * 7).toLocaleString()} sandwiches/week for remaining weeks
              </p>
            </div>
          )}

          {/* Monthly Actionable Suggestions */}
          <div className="mt-6 bg-brand-orange/10 border-2 border-brand-orange rounded-lg p-4">
            <h4 className="font-semibold text-brand-orange mb-2 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              What to do this month
            </h4>
            <div className="space-y-2 text-sm">
              {forecasts.monthly.vsAvg < 0 && forecasts.monthly.gap > 0 && (
                <>
                  <p className="text-gray-700">• <strong>Priority:</strong> Schedule additional events to close the {forecasts.monthly.gap.toLocaleString()}-sandwich gap</p>
                  <p className="text-gray-700">• <strong>Target:</strong> Aim for {Math.round((forecasts.monthly.gap / (forecasts.monthly.daysInMonth - forecasts.monthly.dayOfMonth)) * 7).toLocaleString()} sandwiches per remaining week</p>
                  <p className="text-gray-700">• <strong>Strategy:</strong> Focus on high-volume group collections and event partnerships</p>
                </>
              )}
              {forecasts.monthly.isWithinRange || forecasts.monthly.vsAvg >= 0 && (
                <>
                  <p className="text-gray-700">• <strong>Status:</strong> Monthly goals on track!</p>
                  <p className="text-gray-700">• <strong>Recommendation:</strong> Maintain current collection pace and event schedule</p>
                  <p className="text-gray-700">• <strong>Planning:</strong> Start recruiting for next month's events now</p>
                </>
              )}
              {forecasts.monthly.vsAvg >= 10 && (
                <>
                  <p className="text-gray-700">• <strong>Celebrate:</strong> Exceeding monthly average - great momentum!</p>
                  <p className="text-gray-700">• <strong>Opportunity:</strong> Use this success to recruit new hosts and volunteers</p>
                </>
              )}
            </div>
          </div>
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
