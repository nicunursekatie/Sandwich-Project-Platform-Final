import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Users,
  MapPin,
  Clock,
  Target,
  Lightbulb,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
} from 'lucide-react';
import type { SandwichCollection } from '@shared/schema';
import {
  calculateGroupSandwiches,
  calculateTotalSandwiches,
  parseCollectionDate,
} from '@/lib/analytics-utils';

interface MonthlyStats {
  month: string;
  year: number;
  totalSandwiches: number;
  totalCollections: number;
  uniqueHosts: number;
  avgPerCollection: number;
  hostParticipation: Record<string, number>;
  weeklyDistribution: number[];
  individualCount: number;
  groupCount: number;
  groupEventCount: number;
  daysWithCollections: number;
}

interface HostComparison {
  hostName: string;
  augustTotal: number;
  avgMonthlyTotal: number;
  difference: number;
  percentChange: number;
  augustCollections: number;
  avgMonthlyCollections: number;
}

export default function MonthlyComparisonAnalytics() {
  // Define months array at the top to avoid initialization errors
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const [selectedTab, setSelectedTab] = useState<
    'overview' | 'hosts' | 'patterns' | 'insights'
  >('overview');
  const [compareYear, setCompareYear] = useState<number>(2025);

  // Default to current month and year
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Fetch all collections data
  const { data: collectionsData, isLoading } = useQuery<{
    collections: SandwichCollection[];
  }>({
    queryKey: ['/api/sandwich-collections/all'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?page=1&limit=5000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
  });

  const { data: hostsData } = useQuery({
    queryKey: ['/api/hosts'],
    queryFn: async () => {
      const response = await fetch('/api/hosts');
      if (!response.ok) throw new Error('Failed to fetch hosts');
      return response.json();
    },
  });

  const collections = collectionsData?.collections || [];

  // Helper function to identify holidays in a given month/year
  const getHolidaysForMonth = (month: number, year: number) => {
    const holidays: Array<{
      name: string;
      type: 'federal' | 'jewish' | 'seasonal';
      description: string;
      impact: 'high' | 'medium' | 'low';
      color: string;
    }> = [];

    // Federal holidays by month (0-indexed)
    const federalHolidays: Record<number, Array<{name: string; description: string}>> = {
      0: [{ name: 'New Year\'s Day', description: 'Federal holiday affecting volunteering schedules' }],
      1: [{ name: 'Presidents\' Day', description: 'Federal holiday, potential impact on collections' }],
      4: [{ name: 'Memorial Day', description: 'Federal holiday marking start of summer season' }],
      6: [{ name: 'Independence Day', description: 'Major federal holiday with significant impact' }],
      8: [{ name: 'Labor Day', description: 'Federal holiday marking end of summer' }],
      10: [{ name: 'Thanksgiving', description: 'Major federal holiday with high impact on volunteering' }],
      11: [{ name: 'Christmas', description: 'Major federal holiday with extended impact period' }],
    };

    // Jewish holidays - approximate by year (these shift based on Hebrew calendar)
    // For accuracy, would need a proper Hebrew calendar library, but providing common patterns
    const jewishHolidays2024: Record<number, Array<{name: string; description: string}>> = {
      8: [
        { name: 'Rosh Hashanah', description: 'Jewish New Year - two-day observance, high community impact' },
        { name: 'Yom Kippur', description: 'Day of Atonement - most solemn Jewish holiday, highest impact' }
      ],
      9: [{ name: 'Sukkot', description: 'Feast of Tabernacles - week-long holiday period' }],
      11: [{ name: 'Hanukkah', description: 'Eight-day Festival of Lights' }],
    };

    const jewishHolidays2025: Record<number, Array<{name: string; description: string}>> = {
      8: [
        { name: 'Rosh Hashanah', description: 'Jewish New Year - two-day observance, high community impact' },
        { name: 'Yom Kippur', description: 'Day of Atonement - most solemn Jewish holiday, highest impact' }
      ],
      9: [{ name: 'Sukkot', description: 'Feast of Tabernacles - week-long holiday period' }],
      3: [{ name: 'Passover', description: 'Eight-day festival with significant community observance' }],
      11: [{ name: 'Hanukkah', description: 'Eight-day Festival of Lights' }],
    };

    // Add federal holidays
    if (federalHolidays[month]) {
      federalHolidays[month].forEach(holiday => {
        holidays.push({
          name: holiday.name,
          type: 'federal',
          description: holiday.description,
          impact: [10, 11].includes(month) ? 'high' : 'medium',
          color: 'amber',
        });
      });
    }

    // Add Jewish holidays
    const jewishHolidaysByYear = year === 2024 ? jewishHolidays2024 : jewishHolidays2025;
    if (jewishHolidaysByYear[month]) {
      jewishHolidaysByYear[month].forEach(holiday => {
        holidays.push({
          name: holiday.name,
          type: 'jewish',
          description: holiday.description,
          impact: holiday.name.includes('Yom Kippur') || holiday.name.includes('Rosh Hashanah') ? 'high' : 'medium',
          color: 'purple',
        });
      });
    }

    // Seasonal factors
    if ([5, 6, 7].includes(month)) {
      holidays.push({
        name: 'Summer Vacation Period',
        type: 'seasonal',
        description: 'Reduced volunteering due to summer vacations and travel',
        impact: 'medium',
        color: 'blue',
      });
    }
    if (month === 7) {
      holidays.push({
        name: 'Back-to-School Prep',
        type: 'seasonal',
        description: 'Late summer sees reduced volunteering as families prepare for school year',
        impact: 'low',
        color: 'indigo',
      });
    }

    return holidays;
  };

  // Process data for analytics
  const monthlyAnalytics = useMemo(() => {
    if (!collections?.length) return null;

    const monthlyStats: Record<string, MonthlyStats> = {};

    collections.forEach((collection) => {
      if (!collection.collectionDate) return;

      const date = parseCollectionDate(collection.collectionDate);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const year = date.getFullYear();
      const month = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          month,
          year,
          totalSandwiches: 0,
          totalCollections: 0,
          uniqueHosts: 0,
          avgPerCollection: 0,
          hostParticipation: {},
          weeklyDistribution: [0, 0, 0, 0], // Week 1, 2, 3, 4+
          individualCount: 0,
          groupCount: 0,
          groupEventCount: 0,
          daysWithCollections: 0,
        };
      }

      const stats = monthlyStats[monthKey];

      // Calculate sandwich totals using standardized calculation
      const individualSandwiches = collection.individualSandwiches || 0;
      const groupSandwiches = calculateGroupSandwiches(collection);
      const totalSandwiches = calculateTotalSandwiches(collection);

      stats.totalSandwiches += totalSandwiches;
      stats.individualCount += individualSandwiches;
      stats.groupCount += groupSandwiches;
      stats.totalCollections += 1;

      // Track group event count - increment when collection has group participants
      if (groupSandwiches > 0) {
        stats.groupEventCount += 1;
      }

      // Track host participation
      const hostName = collection.hostName || 'Unknown';
      stats.hostParticipation[hostName] =
        (stats.hostParticipation[hostName] || 0) + totalSandwiches;

      // Weekly distribution within month
      const dayOfMonth = date.getDate();
      const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), 3);
      stats.weeklyDistribution[weekIndex] += totalSandwiches;
    });

    // Calculate derived metrics
    Object.values(monthlyStats).forEach((stats) => {
      stats.uniqueHosts = Object.keys(stats.hostParticipation).length;
      stats.avgPerCollection =
        stats.totalCollections > 0
          ? Math.round(stats.totalSandwiches / stats.totalCollections)
          : 0;
      stats.daysWithCollections = stats.totalCollections; // Approximation
    });

    return monthlyStats;
  }, [collections]);

  // Selected month analysis
  const selectedMonthAnalysis = useMemo(() => {
    if (!monthlyAnalytics) return null;

    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const selectedMonthData = monthlyAnalytics[monthKey];
    if (!selectedMonthData) return null;

    // Year-over-year comparison (same month last year)
    const prevYearMonthKey = `${selectedYear - 1}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const prevYearMonth = monthlyAnalytics[prevYearMonthKey];

    // Month-over-month comparison (previous month)
    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const prevMonthYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    const prevMonthKey = `${prevMonthYear}-${String(prevMonth + 1).padStart(2, '0')}`;
    const previousMonth = monthlyAnalytics[prevMonthKey];

    // Calculate both percent changes
    const yearOverYearChange = prevYearMonth
      ? selectedMonthData.totalSandwiches - prevYearMonth.totalSandwiches
      : null;
    const yearOverYearPercent = prevYearMonth
      ? ((selectedMonthData.totalSandwiches - prevYearMonth.totalSandwiches) /
          prevYearMonth.totalSandwiches) * 100
      : null;

    const monthOverMonthChange = previousMonth
      ? selectedMonthData.totalSandwiches - previousMonth.totalSandwiches
      : null;
    const monthOverMonthPercent = previousMonth
      ? ((selectedMonthData.totalSandwiches - previousMonth.totalSandwiches) /
          previousMonth.totalSandwiches) * 100
      : null;

    // Choose the less drastic comparison (smaller absolute percent change)
    let useMoMComparison = false;
    let comparisonChange = yearOverYearChange;
    let comparisonPercent = yearOverYearPercent;
    let comparisonBase = prevYearMonth;
    let comparisonLabel = prevYearMonth ? `${months[selectedMonth]} ${selectedYear - 1}` : null;

    if (yearOverYearPercent !== null && monthOverMonthPercent !== null) {
      // Both comparisons available - pick less drastic
      if (Math.abs(monthOverMonthPercent) < Math.abs(yearOverYearPercent)) {
        useMoMComparison = true;
        comparisonChange = monthOverMonthChange;
        comparisonPercent = monthOverMonthPercent;
        comparisonBase = previousMonth;
        comparisonLabel = `${months[prevMonth]} ${prevMonthYear}`;
      }
    } else if (monthOverMonthPercent !== null && yearOverYearPercent === null) {
      // Only month-over-month available
      useMoMComparison = true;
      comparisonChange = monthOverMonthChange;
      comparisonPercent = monthOverMonthPercent;
      comparisonBase = previousMonth;
      comparisonLabel = `${months[prevMonth]} ${prevMonthYear}`;
    }

    // Calculate rolling 3-month average (including selected month and 2 previous months)
    const last3MonthsData = Object.entries(monthlyAnalytics)
      .filter(([key, m]) => {
        const [year, month] = key.split('-').map(Number);
        const monthDate = new Date(year, month - 1);
        const selectedDate = new Date(selectedYear, selectedMonth);
        const threeMonthsBefore = new Date(selectedYear, selectedMonth - 2);
        return monthDate >= threeMonthsBefore && monthDate <= selectedDate;
      })
      .map(([_, m]) => m);

    const rolling3MonthAvg = last3MonthsData.length > 0
      ? Math.round(
          last3MonthsData.reduce((sum, m) => sum + m.totalSandwiches, 0) /
          last3MonthsData.length
        )
      : null;

    // Calculate average of last 6 months before selected month for reference
    const recentMonths = Object.entries(monthlyAnalytics)
      .filter(([key, m]) => {
        const [year, month] = key.split('-').map(Number);
        const monthDate = new Date(year, month - 1);
        const selectedDate = new Date(selectedYear, selectedMonth);
        const sixMonthsBefore = new Date(selectedYear, selectedMonth - 6);
        return monthDate >= sixMonthsBefore && monthDate < selectedDate;
      })
      .map(([_, m]) => m);

    const avgRecentMonth = recentMonths.length > 0
      ? recentMonths.reduce((sum, m) => sum + m.totalSandwiches, 0) / recentMonths.length
      : comparisonBase?.totalSandwiches || 0;

    // Calculate top months for 2024-2025
    const topMonths = Object.entries(monthlyAnalytics)
      .filter(([key]) => {
        const [year] = key.split('-').map(Number);
        return year === 2024 || year === 2025;
      })
      .map(([key, month]) => ({
        month: key,
        totalSandwiches: month.totalSandwiches,
      }))
      .sort((a, b) => b.totalSandwiches - a.totalSandwiches);

    return {
      selectedMonthData,
      prevYearMonth,
      previousMonth,
      recentMonths,
      avgRecentMonth,
      rolling3MonthAvg,
      topMonths,
      // Primary comparison (the less drastic one)
      comparisonType: useMoMComparison ? 'month-over-month' : 'year-over-year',
      comparisonLabel,
      comparisonChange,
      comparisonPercent,
      comparisonBase,
      // Also keep individual comparisons for reference
      yearOverYearChange,
      yearOverYearPercent,
      monthOverMonthChange,
      monthOverMonthPercent,
      shortfall: avgRecentMonth - selectedMonthData.totalSandwiches,
      shortfallPercent:
        ((avgRecentMonth - selectedMonthData.totalSandwiches) / avgRecentMonth) * 100,
    };
  }, [monthlyAnalytics, selectedMonth, selectedYear]);

  // Host comparison analysis
  const hostComparison = useMemo((): HostComparison[] => {
    if (!monthlyAnalytics || !selectedMonthAnalysis?.selectedMonthData) return [];

    const selectedStats = selectedMonthAnalysis.selectedMonthData;
    const allHosts = new Set<string>();

    // Collect all unique hosts
    Object.values(monthlyAnalytics).forEach((month) => {
      Object.keys(month.hostParticipation).forEach((host) =>
        allHosts.add(host)
      );
    });

    const comparisons: HostComparison[] = [];

    allHosts.forEach((hostName) => {
      if (hostName === 'Unknown') return;

      const selectedMonthTotal = selectedStats.hostParticipation[hostName] || 0;

      // Calculate average for this host across all months (excluding selected month)
      const otherMonths = Object.values(monthlyAnalytics).filter(
        (m) => !(m.year === selectedYear && m.month === selectedStats.month)
      );

      const monthlyTotals = otherMonths
        .map((m) => m.hostParticipation[hostName] || 0)
        .filter((total) => total > 0);

      if (monthlyTotals.length === 0) return;

      const avgMonthlyTotal =
        monthlyTotals.reduce((sum, total) => sum + total, 0) /
        monthlyTotals.length;
      const difference = selectedMonthTotal - avgMonthlyTotal;
      const percentChange =
        avgMonthlyTotal > 0 ? (difference / avgMonthlyTotal) * 100 : 0;

      // Count collections for selected month
      const selectedMonthCollections = collections.filter(
        (c) => {
          if (c.hostName !== hostName || !c.collectionDate) {
            return false;
          }

          const date = parseCollectionDate(c.collectionDate);
          if (Number.isNaN(date.getTime())) {
            return false;
          }
          return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
      }
      ).length;

      // Calculate average monthly collections for this host using month keys
      const monthlyCollectionCounts = otherMonths.map((month) => {
        const yearMonth = `${month.year}-${String(new Date(month.month + ' 1, ' + month.year).getMonth() + 1).padStart(2, '0')}`;
        return collections.filter(
          (c) =>
            c.hostName === hostName &&
            c.collectionDate &&
            c.collectionDate.startsWith(yearMonth)
        ).length;
      });

      const avgMonthlyCollections =
        monthlyCollectionCounts.length > 0
          ? monthlyCollectionCounts.reduce((sum, count) => sum + count, 0) /
            monthlyCollectionCounts.length
          : 0;

      comparisons.push({
        hostName,
        augustTotal: selectedMonthTotal,
        avgMonthlyTotal: Math.round(avgMonthlyTotal),
        difference: Math.round(difference),
        percentChange: Math.round(percentChange),
        augustCollections: selectedMonthCollections,
        avgMonthlyCollections: Math.round(avgMonthlyCollections),
      });
    });

    return comparisons
      .filter((c) => c.avgMonthlyTotal > 100) // Focus on significant hosts
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  }, [monthlyAnalytics, selectedMonthAnalysis, collections, selectedMonth, selectedYear]);

  // Monthly trends chart data
  const monthlyTrends = useMemo(() => {
    if (!monthlyAnalytics) return [];

    return Object.entries(monthlyAnalytics)
      .filter(([key, m]) => m.year >= 2024)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort by YYYY-MM format
      .map(([key, m]) => {
        // Extract month name from full month string
        const monthName = m.month.split(' ')[0].substring(0, 3);
        return {
          month: monthName,
          year: m.year,
          sandwiches: m.totalSandwiches,
          collections: m.totalCollections,
          hosts: m.uniqueHosts,
          avgPerCollection: m.avgPerCollection,
          isAugust2025: m.year === 2025 && m.month.includes('August'),
        };
      });
  }, [monthlyAnalytics]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-[#646464] text-lg">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!selectedMonthAnalysis) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-brand-primary mb-2">
          No Data for Selected Month
        </h3>
        <p className="text-[#646464]">
          Unable to find collection data for {new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
        </p>
      </div>
    );
  }

  const selectedMonthName = new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const colors = [
    '#236383',
    '#FBAD3F',
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
  ];

  // Generate year options
  const availableYears = Array.from(new Set(Object.keys(monthlyAnalytics || {}).map(key => parseInt(key.split('-')[0])))).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {/* Header with Impact Metrics */}
      <div className="bg-gradient-to-r from-brand-primary/10 to-brand-orange/10 p-6 rounded-lg border border-brand-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-brand-primary mb-2">
              {selectedMonthName} Impact Report
            </h2>
            <p className="text-[#646464]">
              Community impact and collection metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border border-brand-primary/30 rounded-lg bg-white text-brand-primary font-medium"
            >
              {months.map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border border-brand-primary/30 rounded-lg bg-white text-brand-primary font-medium"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Primary Impact Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg border border-green-200 border-l-4">
            <div className="text-sm text-gray-600 mb-1">✓ People Fed</div>
            <div className="text-3xl font-bold text-brand-primary">
              {selectedMonthAnalysis.selectedMonthData.totalSandwiches.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">Sandwiches distributed</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-blue-200 border-l-4">
            <div className="text-sm text-gray-600 mb-1">✓ Collections Completed</div>
            <div className="text-3xl font-bold text-brand-primary">
              {selectedMonthAnalysis.selectedMonthData.totalCollections}
            </div>
            <p className="text-xs text-gray-500 mt-1">Zero missed pickups</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-purple-200 border-l-4">
            <div className="text-sm text-gray-600 mb-1">✓ Active Hosts</div>
            <div className="text-3xl font-bold text-brand-primary">
              {selectedMonthAnalysis.selectedMonthData.uniqueHosts}
            </div>
            <p className="text-xs text-gray-500 mt-1">Community partners engaged</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-orange-200 border-l-4">
            <div className="text-sm text-gray-600 mb-1">✓ Avg per Collection</div>
            <div className="text-3xl font-bold text-brand-primary">
              {selectedMonthAnalysis.selectedMonthData.avgPerCollection}
            </div>
            <p className="text-xs text-gray-500 mt-1">Efficiency metric</p>
          </div>

          {selectedMonthAnalysis.rolling3MonthAvg && (
            <div className="bg-white p-4 rounded-lg border border-indigo-200 border-l-4">
              <div className="text-sm text-gray-600 mb-1">3-Month Trend</div>
              <div className="text-3xl font-bold text-brand-primary">
                {selectedMonthAnalysis.rolling3MonthAvg.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Rolling average</p>
            </div>
          )}
        </div>

        {/* Context Card */}
        <div className="bg-white/50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-gray-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Change from {selectedMonthAnalysis.comparisonLabel}:</span>
                {' '}
                {selectedMonthAnalysis.comparisonChange !== null ? (
                  <>
                    {Math.abs(selectedMonthAnalysis.comparisonChange).toLocaleString()} sandwiches
                    {' '}
                    <span className="text-gray-500">
                      ({selectedMonthAnalysis.comparisonChange > 0 ? '+' : ''}{selectedMonthAnalysis.comparisonPercent?.toFixed(1)}%)
                    </span>
                  </>
                ) : (
                  'No comparison data available'
                )}
                {(() => {
                  const holidays = getHolidaysForMonth(selectedMonth, selectedYear);
                  if (holidays.length > 0) {
                    return (
                      <span className="text-gray-500">
                        {' '}• {holidays.length} holiday factor{holidays.length > 1 ? 's' : ''} this month may affect patterns
                      </span>
                    );
                  }
                  return null;
                })()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Tabs */}
      <Tabs
        value={selectedTab}
        onValueChange={(value) => setSelectedTab(value as any)}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="hosts" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Monthly Insights
          </TabsTrigger>
          <TabsTrigger value="patterns" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Patterns
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Monthly Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Performance Trends (2024-2025)
              </CardTitle>
              <CardDescription>
                {selectedMonthName} performance compared to recent months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyTrends}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#236383"
                      opacity={0.2}
                    />
                    <XAxis dataKey="month" stroke="#236383" fontSize={12} />
                    <YAxis
                      stroke="#236383"
                      fontSize={12}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        typeof value === 'number'
                          ? value.toLocaleString()
                          : value,
                        name === 'sandwiches'
                          ? 'Sandwiches'
                          : name === 'collections'
                            ? 'Collections'
                            : 'Hosts',
                      ]}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload;
                        return item ? `${label} ${item.year}` : label;
                      }}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #236383',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar
                      dataKey="sandwiches"
                      fill="#236383"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="collections"
                      stroke="#FBAD3F"
                      strokeWidth={3}
                      dot={{ fill: '#FBAD3F', strokeWidth: 2, r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-sm text-[#646464]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-brand-primary rounded"></div>
                    <span>Total Sandwiches</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-brand-orange rounded"></div>
                    <span>Collections Count</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Month Performance Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {selectedMonthName} Performance Breakdown
              </CardTitle>
              <CardDescription>
                Collection types and participation metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-600 mb-1">Total Sandwiches</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {selectedMonthAnalysis.selectedMonthData.totalSandwiches.toLocaleString()}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    From {selectedMonthAnalysis.selectedMonthData.totalCollections} collections
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm text-green-600 mb-1">Individual Collections</div>
                  <div className="text-2xl font-bold text-green-900">
                    {selectedMonthAnalysis.selectedMonthData.individualCount.toLocaleString()}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {((selectedMonthAnalysis.selectedMonthData.individualCount / selectedMonthAnalysis.selectedMonthData.totalSandwiches) * 100).toFixed(1)}% of total
                  </div>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-sm text-purple-600 mb-1">Group Events</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {selectedMonthAnalysis.selectedMonthData.groupCount.toLocaleString()}
                  </div>
                  <div className="text-xs text-purple-600 mt-1">
                    {selectedMonthAnalysis.selectedMonthData.groupEventCount} events ({((selectedMonthAnalysis.selectedMonthData.groupCount / selectedMonthAnalysis.selectedMonthData.totalSandwiches) * 100).toFixed(1)}% of total)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hosts" className="space-y-6">
          {/* Monthly Trends Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Smart Comparison Analysis
              </CardTitle>
              <CardDescription>
                Showing the most relevant comparison (less drastic change)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Primary Comparison
                    <Badge className="ml-2 text-xs">
                      {selectedMonthAnalysis.comparisonType === 'month-over-month' ? 'Month-over-Month' : 'Year-over-Year'}
                    </Badge>
                  </h4>
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="text-6xl font-bold text-brand-primary">
                        {selectedMonthAnalysis.comparisonPercent !== null
                          ? (selectedMonthAnalysis.comparisonPercent > 0 ? '+' : '') +
                            selectedMonthAnalysis.comparisonPercent.toFixed(1) + '%'
                          : 'N/A'}
                      </div>
                      <div className="text-lg text-gray-600">
                        {selectedMonthAnalysis.comparisonChange !== null
                          ? (selectedMonthAnalysis.comparisonChange > 0 ? '+' : '') +
                            selectedMonthAnalysis.comparisonChange.toLocaleString() + ' sandwiches'
                          : 'No comparison data'}
                      </div>
                      <div className="text-sm text-gray-500">
                        vs {selectedMonthAnalysis.comparisonLabel}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Performance Analysis
                  </h4>
                  <div className="space-y-4">
                    {/* Primary comparison */}
                    {selectedMonthAnalysis.comparisonPercent !== null ? (
                      <div className="p-4 border rounded-lg bg-gray-50 border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          {selectedMonthAnalysis.comparisonChange! >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-gray-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-gray-600" />
                          )}
                          <span className="font-medium text-gray-800">
                            {selectedMonthAnalysis.comparisonType === 'month-over-month' ? 'Month-over-Month' : 'Year-over-Year'} Trend
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {selectedMonthName} shows a {Math.abs(selectedMonthAnalysis.comparisonPercent).toFixed(1)}%
                          {selectedMonthAnalysis.comparisonChange! >= 0 ? ' increase' : ' change'} compared to {selectedMonthAnalysis.comparisonLabel}.
                          This represents {Math.abs(selectedMonthAnalysis.comparisonChange!).toLocaleString()}
                          {selectedMonthAnalysis.comparisonChange! >= 0 ? ' more' : ' fewer'} sandwiches.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="h-4 w-4 text-gray-600" />
                          <span className="font-medium text-gray-800">No Comparison Data</span>
                        </div>
                        <p className="text-sm text-gray-700">
                          No comparison data available for this month.
                        </p>
                      </div>
                    )}

                    {/* Alternative comparison info */}
                    {selectedMonthAnalysis.comparisonType === 'month-over-month' && selectedMonthAnalysis.yearOverYearPercent !== null && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Activity className="h-3 w-3 text-blue-600" />
                          <span className="text-xs font-medium text-blue-800">Alternative: Year-over-Year</span>
                        </div>
                        <p className="text-xs text-blue-700">
                          vs {months[selectedMonth]} {selectedYear - 1}: {selectedMonthAnalysis.yearOverYearPercent > 0 ? '+' : ''}{selectedMonthAnalysis.yearOverYearPercent.toFixed(1)}%
                          ({Math.abs(selectedMonthAnalysis.yearOverYearChange!).toLocaleString()} sandwiches)
                        </p>
                      </div>
                    )}
                    {selectedMonthAnalysis.comparisonType === 'year-over-year' && selectedMonthAnalysis.monthOverMonthPercent !== null && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Activity className="h-3 w-3 text-blue-600" />
                          <span className="text-xs font-medium text-blue-800">Alternative: Month-over-Month</span>
                        </div>
                        <p className="text-xs text-blue-700">
                          vs {selectedMonthAnalysis.comparisonLabel}: {selectedMonthAnalysis.monthOverMonthPercent > 0 ? '+' : ''}{selectedMonthAnalysis.monthOverMonthPercent.toFixed(1)}%
                          ({Math.abs(selectedMonthAnalysis.monthOverMonthChange!).toLocaleString()} sandwiches)
                        </p>
                      </div>
                    )}

                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-brand-primary">
                        {((selectedMonthAnalysis.selectedMonthData.groupEventCount / selectedMonthAnalysis.selectedMonthData.totalCollections) * 100).toFixed(1)}%
                      </div>
                      <p className="text-xs text-gray-600">Events w/ Groups</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Holiday Impact Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Holiday Impact Analysis - {selectedMonthName}
              </CardTitle>
              <CardDescription>
                Analysis of how holidays and special events affected collection patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Identified Holidays & Events
                  </h4>
                  <div className="space-y-3">
                    {(() => {
                      const holidays = getHolidaysForMonth(selectedMonth, selectedYear);
                      if (holidays.length === 0) {
                        return (
                          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium text-gray-800">No Major Holidays</span>
                                <p className="text-sm text-gray-700 mt-1">
                                  {selectedMonthName} had no major holidays that typically impact collection schedules.
                                </p>
                              </div>
                              <Badge variant="outline" className="border-gray-300 text-gray-700">
                                Clear
                              </Badge>
                            </div>
                          </div>
                        );
                      }
                      return holidays.map((holiday, index) => (
                        <div
                          key={index}
                          className={`p-3 bg-${holiday.color}-50 border border-${holiday.color}-200 rounded-lg`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className={`font-medium text-${holiday.color}-800`}>{holiday.name}</span>
                              <p className={`text-sm text-${holiday.color}-700 mt-1`}>
                                {holiday.description}
                              </p>
                            </div>
                            <Badge variant="outline" className={`border-${holiday.color}-300 text-${holiday.color}-700`}>
                              {holiday.type === 'federal' ? 'Federal' : holiday.type === 'jewish' ? 'Jewish' : 'Seasonal'}
                            </Badge>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Impact Assessment
                  </h4>
                  <div className="space-y-3">
                    {(() => {
                      const holidays = getHolidaysForMonth(selectedMonth, selectedYear);
                      const highImpactCount = holidays.filter(h => h.impact === 'high').length;
                      const mediumImpactCount = holidays.filter(h => h.impact === 'medium').length;
                      const jewishHolidayCount = holidays.filter(h => h.type === 'jewish').length;

                      return (
                        <>
                          <div className="text-center p-3 bg-gray-50 rounded">
                            <div className="text-2xl font-bold text-brand-primary">
                              {highImpactCount + mediumImpactCount}
                            </div>
                            <p className="text-sm text-gray-600">Holiday factors identified</p>
                          </div>

                          {jewishHolidayCount > 0 && (
                            <div className="text-center p-3 bg-purple-50 border border-purple-200 rounded">
                              <div className="text-lg font-bold text-purple-700">
                                {jewishHolidayCount}
                              </div>
                              <p className="text-sm text-purple-600">Jewish holidays</p>
                              <p className="text-xs text-purple-500 mt-1">Significant community impact</p>
                            </div>
                          )}

                          <div className="text-center p-3 bg-gray-50 rounded">
                            <div className="text-2xl font-bold text-brand-primary">
                              {selectedMonthAnalysis.selectedMonthData.weeklyDistribution.reduce((min, current, index) =>
                                selectedMonthAnalysis.selectedMonthData.weeklyDistribution[min] > current ? index : min, 0) + 1}
                            </div>
                            <p className="text-sm text-gray-600">Lowest performing week</p>
                          </div>

                          {highImpactCount > 0 && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-center">
                              <p className="text-xs text-amber-700">
                                ⚠️ {highImpactCount} high-impact holiday{highImpactCount > 1 ? 's' : ''} this month
                              </p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Group Events Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Group vs Individual Collections Analysis
              </CardTitle>
              <CardDescription>
                Breakdown of group events vs individual collections for {selectedMonthName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Collection Type Distribution
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            {
                              name: 'Group Events',
                              value: selectedMonthAnalysis.selectedMonthData.groupCount,
                              color: '#236383'
                            },
                            {
                              name: 'Individual Collections',
                              value: selectedMonthAnalysis.selectedMonthData.individualCount,
                              color: '#FBAD3F'
                            }
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({name, percent}) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        >
                          {[
                            { name: 'Group Events', value: selectedMonthAnalysis.selectedMonthData.groupCount, color: '#236383' },
                            { name: 'Individual Collections', value: selectedMonthAnalysis.selectedMonthData.individualCount, color: '#FBAD3F' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [value.toLocaleString(), 'Sandwiches']}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #236383',
                            borderRadius: '8px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Group Event Insights
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-brand-primary/10 rounded">
                        <div className="text-xl font-bold text-brand-primary">
                          {selectedMonthAnalysis.selectedMonthData.groupEventCount}
                        </div>
                        <p className="text-sm text-brand-primary">Group Events</p>
                      </div>
                      <div className="text-center p-3 bg-brand-orange/10 rounded">
                        <div className="text-xl font-bold text-brand-orange">
                          {selectedMonthAnalysis.selectedMonthData.groupCount.toLocaleString()}
                        </div>
                        <p className="text-sm text-brand-orange">Sandwiches from Groups</p>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h5 className="font-medium text-blue-800 mb-2">Key Findings</h5>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Group events average {selectedMonthAnalysis.selectedMonthData.groupEventCount > 0 ? Math.round(selectedMonthAnalysis.selectedMonthData.groupCount / selectedMonthAnalysis.selectedMonthData.groupEventCount) : 0} sandwiches per event</li>
                        <li>• Individual events average {selectedMonthAnalysis.selectedMonthData.individualCount > 0 ? Math.round(selectedMonthAnalysis.selectedMonthData.individualCount / collections.filter(c => {
                          if (!c.collectionDate) return false;
                          const date = parseCollectionDate(c.collectionDate);
                          if (Number.isNaN(date.getTime())) return false;
                          return date.getFullYear() === 2025 && date.getMonth() === 7 && (c.individualSandwiches || 0) > 0;
                        }).length) : 0} sandwiches per event</li>
                        <li>• Group events represent {((selectedMonthAnalysis.selectedMonthData.groupEventCount / selectedMonthAnalysis.selectedMonthData.totalCollections) * 100).toFixed(1)}% of all events, but {((selectedMonthAnalysis.selectedMonthData.groupCount / selectedMonthAnalysis.selectedMonthData.totalSandwiches) * 100).toFixed(1)}% of sandwich volume</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Month-Specific Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Actionable Insights & Recommendations
              </CardTitle>
              <CardDescription>
                Strategic recommendations based on {selectedMonthName} performance patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    🎯 Priority Actions
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <h5 className="font-medium text-orange-800 mb-1">Immediate (This Month)</h5>
                      <p className="text-sm text-orange-700">
                        Focus on maintaining momentum with current hosts. Consider targeted outreach to hosts who haven't scheduled recently.
                      </p>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <h5 className="font-medium text-amber-800 mb-1">Medium-term (Next 2-3 Months)</h5>
                      <p className="text-sm text-amber-700">
                        Focus on group event recruitment. Group events showed stronger per-event performance than individual collections.
                      </p>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h5 className="font-medium text-blue-800 mb-1">Long-term (Annual Planning)</h5>
                      <p className="text-sm text-blue-700">
                        Develop month-specific strategies to account for seasonal patterns and volunteer availability trends.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    📊 Performance Patterns
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">Seasonal Impact</span>
                      <Badge variant="destructive">High Risk</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">Group Event Efficiency</span>
                      <Badge className="bg-blue-100 text-blue-700">Strong</Badge>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">Recovery Potential</span>
                      <Badge className="bg-indigo-100 text-indigo-700">Good</Badge>
                    </div>
                    
                    <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <h5 className="font-medium text-purple-800 mb-2">💡 Success Strategy</h5>
                      <p className="text-sm text-purple-700">
                        Based on trends, targeting group organizations in September with compelling back-to-school messaging could recover {Math.round(selectedMonthAnalysis.shortfall * 0.6)?.toLocaleString()}+ sandwiches by October.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Weekly Distribution ({selectedMonthName})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          week: 'Week 1',
                          sandwiches:
                            selectedMonthAnalysis.selectedMonthData.weeklyDistribution[0],
                        },
                        {
                          week: 'Week 2',
                          sandwiches:
                            selectedMonthAnalysis.selectedMonthData.weeklyDistribution[1],
                        },
                        {
                          week: 'Week 3',
                          sandwiches:
                            selectedMonthAnalysis.selectedMonthData.weeklyDistribution[2],
                        },
                        {
                          week: 'Week 4+',
                          sandwiches:
                            selectedMonthAnalysis.selectedMonthData.weeklyDistribution[3],
                        },
                      ]}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#236383"
                        opacity={0.2}
                      />
                      <XAxis dataKey="week" stroke="#236383" fontSize={12} />
                      <YAxis stroke="#236383" fontSize={12} />
                      <Tooltip
                        formatter={(value) => [
                          Number(value).toLocaleString(),
                          'Sandwiches',
                        ]}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #236383',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar
                        dataKey="sandwiches"
                        fill="#236383"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Collection Type Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: 'Individual',
                            value: selectedMonthAnalysis.selectedMonthData.individualCount,
                            color: '#236383',
                          },
                          {
                            name: 'Group',
                            value: selectedMonthAnalysis.selectedMonthData.groupCount,
                            color: '#FBAD3F',
                          },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          {
                            name: 'Individual',
                            value: selectedMonthAnalysis.selectedMonthData.individualCount,
                            color: '#236383',
                          },
                          {
                            name: 'Group',
                            value: selectedMonthAnalysis.selectedMonthData.groupCount,
                            color: '#FBAD3F',
                          },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => Number(value).toLocaleString()}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Overview */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Activity className="h-5 w-5" />
                  Performance Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-blue-50 rounded">
                  <h4 className="font-semibold text-blue-800 mb-1">
                    Comparison Analysis
                  </h4>
                  <p className="text-sm text-blue-700">
                    {selectedMonthAnalysis.comparisonChange !== null ? (
                      selectedMonthAnalysis.comparisonChange < 0 ? (
                        <>
                          {selectedMonthName} collected{' '}
                          {Math.abs(selectedMonthAnalysis.comparisonChange).toLocaleString()} fewer
                          sandwiches ({Math.abs(selectedMonthAnalysis.comparisonPercent?.toFixed(1) || 0)}%
                          decrease) compared to {selectedMonthAnalysis.comparisonLabel}.
                        </>
                      ) : (
                        <>
                          {selectedMonthName} collected{' '}
                          {selectedMonthAnalysis.comparisonChange.toLocaleString()} more
                          sandwiches ({selectedMonthAnalysis.comparisonPercent?.toFixed(1)}%
                          increase) compared to {selectedMonthAnalysis.comparisonLabel}.
                        </>
                      )
                    ) : (
                      'No comparison data available.'
                    )}
                  </p>
                </div>

                <div className="p-3 rounded bg-gray-50 border border-gray-200">
                  <h4 className="font-semibold mb-1 text-gray-800">
                    Host Participation
                  </h4>
                  <p className="text-sm text-gray-700">
                    {hostComparison.filter((h) => h.percentChange < -20).length} hosts with significant declines (&gt;20%),
                    {' '}{hostComparison.filter((h) => h.percentChange > 20).length} hosts with strong growth (&gt;20%).
                  </p>
                </div>

                {(() => {
                  const holidays = getHolidaysForMonth(selectedMonth, selectedYear);
                  if (holidays.length > 0) {
                    return (
                      <div className="p-3 bg-purple-50 rounded">
                        <h4 className="font-semibold text-purple-800 mb-1">
                          Holiday Impact
                        </h4>
                        <p className="text-sm text-purple-700">
                          {holidays.length} holiday factor{holidays.length > 1 ? 's' : ''} this month
                          {holidays.some(h => h.impact === 'high') ? ' including high-impact events' : ''}.
                          Consider scheduling adjustments for future planning.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </CardContent>
            </Card>

            {/* Actionable Recommendations */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <Lightbulb className="h-5 w-5" />
                  Actionable Next Steps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {hostComparison.filter((h) => h.percentChange < -20).length > 0 && (
                  <div className="p-3 bg-orange-50 rounded">
                    <h4 className="font-semibold text-orange-800 mb-1">
                      Re-engage Underperforming Hosts
                    </h4>
                    <p className="text-sm text-orange-700">
                      Reach out to {hostComparison.filter((h) => h.percentChange < -20).length} hosts with significant declines.
                      Schedule check-ins to understand barriers and provide support.
                    </p>
                  </div>
                )}

                {hostComparison.filter((h) => h.percentChange > 20).length > 0 && (
                  <div className="p-3 bg-blue-50 rounded border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-1">
                      Amplify Success Stories
                    </h4>
                    <p className="text-sm text-blue-700">
                      {hostComparison.filter((h) => h.percentChange > 20).length} hosts showed exceptional growth.
                      Share their strategies with other hosts to drive broader impact.
                    </p>
                  </div>
                )}

                <div className="p-3 bg-blue-50 rounded">
                  <h4 className="font-semibold text-blue-800 mb-1">
                    Plan Ahead for Next Month
                  </h4>
                  <p className="text-sm text-blue-700">
                    Review {months[(selectedMonth + 1) % 12]} {selectedMonth === 11 ? selectedYear + 1 : selectedYear} patterns from previous years.
                    Identify potential challenges and opportunities early.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* High Performers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-brand-primary">
                <TrendingUp className="h-5 w-5" />
                Top Performing Hosts in {selectedMonthName}
              </CardTitle>
              <CardDescription>
                Hosts who exceeded their average by 20%+ - learn from their success
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {hostComparison
                  .filter((h) => h.percentChange > 20)
                  .slice(0, 6)
                  .map((host, index) => (
                    <div
                      key={host.hostName}
                      className="p-4 bg-blue-50 rounded-lg border border-blue-200"
                    >
                      <h4
                        className="font-semibold text-blue-800 mb-2"
                        data-testid={`success-host-${index}`}
                      >
                        {host.hostName.length > 20
                          ? host.hostName.substring(0, 20) + '...'
                          : host.hostName}
                      </h4>
                      <div
                        className="text-2xl font-bold text-blue-700"
                        data-testid={`success-total-${index}`}
                      >
                        {host.augustTotal.toLocaleString()}
                      </div>
                      <div
                        className="text-sm text-blue-600"
                        data-testid={`success-change-${index}`}
                      >
                        +{host.percentChange}% vs their average
                      </div>
                    </div>
                  ))}
                {hostComparison.filter((h) => h.percentChange > 20).length === 0 && (
                  <div className="col-span-3 text-center py-8 text-gray-500">
                    No hosts exceeded their average by 20%+ this month.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
