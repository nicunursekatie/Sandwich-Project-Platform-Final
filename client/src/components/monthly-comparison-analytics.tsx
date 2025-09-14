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
  const [selectedTab, setSelectedTab] = useState<
    'overview' | 'hosts' | 'patterns' | 'insights'
  >('overview');
  const [compareYear, setCompareYear] = useState<number>(2025);

  // Fetch all collections data
  const { data: collectionsData, isLoading } = useQuery<{
    collections: SandwichCollection[];
  }>({
    queryKey: ['/api/sandwich-collections/all'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?limit=5000');
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

  // Process data for analytics
  const monthlyAnalytics = useMemo(() => {
    if (!collections?.length) return null;

    const monthlyStats: Record<string, MonthlyStats> = {};

    collections.forEach((collection) => {
      if (!collection.collectionDate) return;

      const date = new Date(collection.collectionDate);
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

  // August 2025 analysis
  const augustAnalysis = useMemo(() => {
    if (!monthlyAnalytics) return null;

    const august2025 = monthlyAnalytics['2025-08'];
    if (!august2025) return null;

    // Find top performing months for comparison
    const allMonths = Object.values(monthlyAnalytics)
      .filter((m) => m.year >= 2024) // Focus on recent data
      .sort((a, b) => b.totalSandwiches - a.totalSandwiches);

    const topMonths = allMonths.slice(0, 5);
    const avgTopMonth =
      topMonths.reduce((sum, m) => sum + m.totalSandwiches, 0) /
      topMonths.length;

    // Compare August 2024 vs 2025
    const august2024 = monthlyAnalytics['2024-08'];

    return {
      august2025,
      august2024,
      topMonths,
      avgTopMonth,
      shortfall: avgTopMonth - august2025.totalSandwiches,
      shortfallPercent:
        ((avgTopMonth - august2025.totalSandwiches) / avgTopMonth) * 100,
      yearOverYearChange: august2024
        ? august2025.totalSandwiches - august2024.totalSandwiches
        : null,
      yearOverYearPercent: august2024
        ? ((august2025.totalSandwiches - august2024.totalSandwiches) /
            august2024.totalSandwiches) *
          100
        : null,
    };
  }, [monthlyAnalytics]);

  // Host comparison analysis
  const hostComparison = useMemo((): HostComparison[] => {
    if (!monthlyAnalytics || !augustAnalysis?.august2025) return [];

    const augustStats = augustAnalysis.august2025;
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

      const augustTotal = augustStats.hostParticipation[hostName] || 0;

      // Calculate average for this host across all months (excluding August 2025)
      const otherMonths = Object.values(monthlyAnalytics).filter(
        (m) => !(m.year === 2025 && m.month.includes('August'))
      );

      const monthlyTotals = otherMonths
        .map((m) => m.hostParticipation[hostName] || 0)
        .filter((total) => total > 0);

      if (monthlyTotals.length === 0) return;

      const avgMonthlyTotal =
        monthlyTotals.reduce((sum, total) => sum + total, 0) /
        monthlyTotals.length;
      const difference = augustTotal - avgMonthlyTotal;
      const percentChange =
        avgMonthlyTotal > 0 ? (difference / avgMonthlyTotal) * 100 : 0;

      // Count collections
      const augustCollections = collections.filter(
        (c) =>
          c.hostName === hostName &&
          c.collectionDate &&
          new Date(c.collectionDate).getFullYear() === 2025 &&
          new Date(c.collectionDate).getMonth() === 7 // August is month 7 (0-indexed)
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
        augustTotal,
        avgMonthlyTotal: Math.round(avgMonthlyTotal),
        difference: Math.round(difference),
        percentChange: Math.round(percentChange),
        augustCollections,
        avgMonthlyCollections: Math.round(avgMonthlyCollections),
      });
    });

    return comparisons
      .filter((c) => c.avgMonthlyTotal > 100) // Focus on significant hosts
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  }, [monthlyAnalytics, augustAnalysis, collections]);

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

  if (!augustAnalysis) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-brand-primary mb-2">
          No August 2025 Data
        </h3>
        <p className="text-[#646464]">
          Unable to find August 2025 collection data for analysis.
        </p>
      </div>
    );
  }

  const colors = [
    '#236383',
    '#FBAD3F',
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
  ];

  return (
    <div className="space-y-6">
      {/* Header with Key Metrics */}
      <div className="bg-gradient-to-r from-brand-primary/10 to-brand-orange/10 p-6 rounded-lg border border-brand-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-brand-primary mb-2">
              August 2025 Performance Analysis
            </h2>
            <p className="text-[#646464]">
              Comprehensive analysis of August's lower collection performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-8 w-8 text-red-500" />
            <Badge variant="destructive" className="text-lg px-3 py-1">
              {augustAnalysis.shortfall?.toLocaleString()} Short
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-brand-primary/20">
            <div className="text-2xl font-bold text-brand-primary">
              {augustAnalysis.august2025.totalSandwiches.toLocaleString()}
            </div>
            <p className="text-sm text-[#646464]">August 2025 Total</p>
            <div className="text-sm text-red-600 mt-1">
              -{augustAnalysis.shortfallPercent?.toFixed(1)}% vs avg top month
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-brand-primary/20">
            <div className="text-2xl font-bold text-brand-primary">
              {Math.round(augustAnalysis.avgTopMonth).toLocaleString()}
            </div>
            <p className="text-sm text-[#646464]">Avg Top 5 Months</p>
            <div className="text-sm text-green-600 mt-1">Benchmark target</div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-brand-primary/20">
            <div className="text-2xl font-bold text-brand-primary">
              {augustAnalysis.august2025.totalCollections}
            </div>
            <p className="text-sm text-[#646464]">Collections Count</p>
            <div className="text-sm text-[#646464] mt-1">
              {augustAnalysis.august2025.uniqueHosts} hosts active
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-brand-primary/20">
            <div className="text-2xl font-bold text-brand-primary">
              {augustAnalysis.yearOverYearChange !== null
                ? (augustAnalysis.yearOverYearChange > 0 ? '+' : '') +
                  augustAnalysis.yearOverYearChange?.toLocaleString()
                : 'N/A'}
            </div>
            <p className="text-sm text-[#646464]">vs August 2024</p>
            <div
              className={`text-sm mt-1 ${
                augustAnalysis.yearOverYearPercent &&
                augustAnalysis.yearOverYearPercent > 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {augustAnalysis.yearOverYearPercent !== null
                ? (augustAnalysis.yearOverYearPercent > 0 ? '+' : '') +
                  augustAnalysis.yearOverYearPercent?.toFixed(1) +
                  '%'
                : 'First year'}
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
            <Users className="h-4 w-4" />
            Host Analysis
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
                August 2025 performance compared to recent months
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

          {/* Top vs August Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                August vs Top Performing Months
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Top 5 Months (2024-2025)
                  </h4>
                  <div className="space-y-2">
                    {augustAnalysis.topMonths
                      .slice(0, 5)
                      .map((month, index) => (
                        <div
                          key={month.month}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <span className="text-sm font-medium">
                            {month.month}
                          </span>
                          <span className="text-sm font-bold text-brand-primary">
                            {month.totalSandwiches.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Performance Breakdown
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Individual Collections</span>
                      <span className="font-medium">
                        {augustAnalysis.august2025.individualCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Group Collections</span>
                      <span className="font-medium">
                        {augustAnalysis.august2025.groupCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Average per Collection</span>
                      <span className="font-medium">
                        {augustAnalysis.august2025.avgPerCollection}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Active Hosts</span>
                      <span className="font-medium">
                        {augustAnalysis.august2025.uniqueHosts}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hosts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Host Performance Comparison
              </CardTitle>
              <CardDescription>
                August 2025 vs average monthly performance by host
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-primary/20">
                      <th className="text-left p-2 font-semibold text-brand-primary">
                        Host
                      </th>
                      <th className="text-right p-2 font-semibold text-brand-primary">
                        Aug 2025
                      </th>
                      <th className="text-right p-2 font-semibold text-brand-primary">
                        Monthly Avg
                      </th>
                      <th className="text-right p-2 font-semibold text-brand-primary">
                        Difference
                      </th>
                      <th className="text-right p-2 font-semibold text-brand-primary">
                        % Change
                      </th>
                      <th className="text-center p-2 font-semibold text-brand-primary">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {hostComparison.slice(0, 15).map((host, index) => (
                      <tr
                        key={host.hostName}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td
                          className="p-2 font-medium"
                          data-testid={`host-name-${index}`}
                        >
                          {host.hostName.length > 25
                            ? host.hostName.substring(0, 25) + '...'
                            : host.hostName}
                        </td>
                        <td
                          className="p-2 text-right font-medium"
                          data-testid={`host-august-${index}`}
                        >
                          {host.augustTotal.toLocaleString()}
                        </td>
                        <td
                          className="p-2 text-right"
                          data-testid={`host-average-${index}`}
                        >
                          {host.avgMonthlyTotal.toLocaleString()}
                        </td>
                        <td
                          className={`p-2 text-right font-medium ${
                            host.difference >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                          data-testid={`host-difference-${index}`}
                        >
                          {host.difference >= 0 ? '+' : ''}
                          {host.difference.toLocaleString()}
                        </td>
                        <td
                          className={`p-2 text-right ${
                            host.percentChange >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                          data-testid={`host-percent-${index}`}
                        >
                          {host.percentChange >= 0 ? '+' : ''}
                          {host.percentChange}%
                        </td>
                        <td
                          className="p-2 text-center"
                          data-testid={`host-status-${index}`}
                        >
                          {host.percentChange >= 10 ? (
                            <Badge className="bg-green-100 text-green-700">
                              Above Avg
                            </Badge>
                          ) : host.percentChange <= -20 ? (
                            <Badge variant="destructive">Below Avg</Badge>
                          ) : (
                            <Badge variant="secondary">Normal</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  Weekly Distribution (August 2025)
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
                            augustAnalysis.august2025.weeklyDistribution[0],
                        },
                        {
                          week: 'Week 2',
                          sandwiches:
                            augustAnalysis.august2025.weeklyDistribution[1],
                        },
                        {
                          week: 'Week 3',
                          sandwiches:
                            augustAnalysis.august2025.weeklyDistribution[2],
                        },
                        {
                          week: 'Week 4+',
                          sandwiches:
                            augustAnalysis.august2025.weeklyDistribution[3],
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
                            value: augustAnalysis.august2025.individualCount,
                            color: '#236383',
                          },
                          {
                            name: 'Group',
                            value: augustAnalysis.august2025.groupCount,
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
                            value: augustAnalysis.august2025.individualCount,
                            color: '#236383',
                          },
                          {
                            name: 'Group',
                            value: augustAnalysis.august2025.groupCount,
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
            <Card className="border-l-4 border-l-red-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Key Issues Identified
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-red-50 rounded">
                  <h4 className="font-semibold text-red-800 mb-1">
                    Performance Gap
                  </h4>
                  <p className="text-sm text-red-700">
                    August 2025 collected{' '}
                    {augustAnalysis.shortfall?.toLocaleString()} fewer
                    sandwiches ({augustAnalysis.shortfallPercent?.toFixed(1)}%
                    below) compared to top performing months.
                  </p>
                </div>

                <div className="p-3 bg-amber-50 rounded">
                  <h4 className="font-semibold text-amber-800 mb-1">
                    Host Participation
                  </h4>
                  <p className="text-sm text-amber-700">
                    {hostComparison.filter((h) => h.percentChange < -20).length}{' '}
                    hosts performed significantly below their monthly average
                    (&gt;20% decrease).
                  </p>
                </div>

                <div className="p-3 bg-blue-50 rounded">
                  <h4 className="font-semibold text-blue-800 mb-1">
                    Seasonal Pattern
                  </h4>
                  <p className="text-sm text-blue-700">
                    August consistently shows lower performance, suggesting
                    seasonal factors (summer vacation, school schedules) impact
                    collections.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <Lightbulb className="h-5 w-5" />
                  Recommended Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-green-50 rounded">
                  <h4 className="font-semibold text-green-800 mb-1">
                    August Planning
                  </h4>
                  <p className="text-sm text-green-700">
                    Implement August-specific campaigns and host engagement
                    programs to offset seasonal decline by June planning.
                  </p>
                </div>

                <div className="p-3 bg-purple-50 rounded">
                  <h4 className="font-semibold text-purple-800 mb-1">
                    Host Support
                  </h4>
                  <p className="text-sm text-purple-700">
                    Focus on supporting hosts who showed significant declines.
                    Consider summer vacation scheduling and backup host
                    arrangements.
                  </p>
                </div>

                <div className="p-3 bg-indigo-50 rounded">
                  <h4 className="font-semibold text-indigo-800 mb-1">
                    Target Setting
                  </h4>
                  <p className="text-sm text-indigo-700">
                    Set realistic August targets based on historical data while
                    implementing specific strategies to minimize seasonal
                    impact.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Success Stories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <TrendingUp className="h-5 w-5" />
                Success Stories - Hosts Who Excelled in August
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {hostComparison
                  .filter((h) => h.percentChange > 20)
                  .slice(0, 6)
                  .map((host, index) => (
                    <div
                      key={host.hostName}
                      className="p-4 bg-green-50 rounded-lg border border-green-200"
                    >
                      <h4
                        className="font-semibold text-green-800 mb-2"
                        data-testid={`success-host-${index}`}
                      >
                        {host.hostName.length > 20
                          ? host.hostName.substring(0, 20) + '...'
                          : host.hostName}
                      </h4>
                      <div
                        className="text-2xl font-bold text-green-700"
                        data-testid={`success-total-${index}`}
                      >
                        {host.augustTotal.toLocaleString()}
                      </div>
                      <div
                        className="text-sm text-green-600"
                        data-testid={`success-change-${index}`}
                      >
                        +{host.percentChange}% vs average
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
