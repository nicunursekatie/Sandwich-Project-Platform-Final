import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from 'recharts';
import {
  Award,
  TrendingUp,
  Target,
  Users2,
  Calendar,
  Trophy,
} from 'lucide-react';
import type { SandwichCollection } from '@shared/schema';
import {
  calculateGroupSandwiches,
  calculateTotalSandwiches,
  calculateActualWeeklyAverage,
  getRecordWeek,
} from '@/lib/analytics-utils';

export default function AnalyticsDashboard() {
  const { data: collections, isLoading: collectionsLoading } = useQuery<
    SandwichCollection[]
  >({
    queryKey: ['/api/sandwich-collections/all', 'v2'], // Force cache refresh
    queryFn: async () => {
      console.log('🔄 Analytics Dashboard: Fetching all collections...');
      const response = await fetch('/api/sandwich-collections?limit=10000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      const data = await response.json();
      console.log(
        '✅ Analytics Dashboard: Got',
        data.collections?.length || 0,
        'collections'
      );
      return data.collections || [];
    },
    staleTime: 0, // Force fresh data every time
    cacheTime: 0, // Don't cache the data
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/sandwich-collections/stats'],
  });

  const { data: hostsData, isLoading: hostsLoading } = useQuery({
    queryKey: ['/api/hosts'],
    queryFn: async () => {
      const response = await fetch('/api/hosts');
      if (!response.ok) throw new Error('Failed to fetch hosts');
      return response.json();
    },
  });

  const isLoading = collectionsLoading || statsLoading || hostsLoading;

  const analyticsData = useMemo(() => {
    if (!collections?.length || !statsData || !hostsData) return null;

    const totalSandwiches = statsData.completeTotalSandwiches || 0;
    const totalHosts = 34; // Fixed count per Marcy's manual verification
    const activeHosts = 34; // Fixed count per Marcy's manual verification

    const hostStats = collections.reduce(
      (acc, c) => {
        const host = c.hostName || 'Unknown';
        const sandwiches = calculateTotalSandwiches(c);

        if (!acc[host]) {
          acc[host] = { total: 0, collections: 0 };
        }
        acc[host].total += sandwiches;
        acc[host].collections += 1;

        return acc;
      },
      {} as Record<string, { total: number; collections: number }>
    );

    const topPerformer = Object.entries(hostStats).sort(
      ([, a], [, b]) => b.total - a.total
    )[0];

    // Monthly trends for chart
    console.log(
      '🔢 Analytics Dashboard: Processing',
      collections.length,
      'collections for monthly trends'
    );
    const monthlyTrends = collections.reduce(
      (acc, c) => {
        const date = new Date(c.collectionDate || '');
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const sandwiches = calculateTotalSandwiches(c);

        if (!acc[monthKey]) {
          acc[monthKey] = { month: monthKey, sandwiches: 0 };
        }
        acc[monthKey].sandwiches += sandwiches;

        return acc;
      },
      {} as Record<string, { month: string; sandwiches: number }>
    );

    console.log(
      '📊 Analytics Dashboard: Monthly trends calculated:',
      monthlyTrends
    );

    const trendData = Object.values(monthlyTrends)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12) // Last 12 months
      .map((m) => {
        const date = new Date(m.month + '-01');
        const monthName = date.toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        });
        return {
          month: monthName,
          sandwiches: m.sandwiches,
        };
      });

    console.log(
      '📈 Analytics Dashboard: Final trend data for chart:',
      trendData
    );

    // Top performing hosts
    const topHosts = Object.entries(hostStats)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 10)
      .map(([name, stats]) => ({
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        total: stats.total,
        collections: stats.collections,
      }));

    return {
      totalSandwiches,
      totalCollections: collections.length,
      activeLocations: Object.keys(hostStats).length,
      totalHosts,
      activeHosts,
      avgWeekly: calculateActualWeeklyAverage(collections), // Calculate actual weekly average from real weekly buckets
      topPerformer: topPerformer
        ? { name: topPerformer[0], total: topPerformer[1].total }
        : null,
      recordWeek: getRecordWeek(collections), // Get actual best performing week
      trendData,
      topHosts,
    };
  }, [collections, statsData, hostsData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-3 border-brand-primary mx-auto mb-4"></div>
          <p className="text-[#646464] text-lg">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-16">
        <p className="text-[#646464] text-lg">No data available for analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-brand-primary mb-2">
          ANALYTICS DASHBOARD
        </h1>
        <p className="text-lg text-[#646464]">
          Data insights and impact visualization
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 border-2 border-brand-primary/20 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <Trophy className="h-8 w-8 text-brand-primary" />
            <Badge className="bg-brand-primary/10 text-brand-primary text-sm">
              500K Goal
            </Badge>
          </div>
          <div className="text-3xl font-bold text-brand-primary mb-2">
            {(analyticsData.totalSandwiches / 1000000).toFixed(2)}M
          </div>
          <p className="text-[#646464] font-medium">Total Impact</p>
          <p className="text-sm text-brand-primary mt-2">2025 Goal: 15K of 500K</p>
        </div>

        <div className="bg-white rounded-lg p-6 border-2 border-brand-primary/20 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="h-8 w-8 text-brand-primary" />
            <Badge className="bg-blue-100 text-blue-700 text-sm">
              Weekly Avg
            </Badge>
          </div>
          <div className="text-3xl font-bold text-brand-primary mb-2">
            {analyticsData.avgWeekly.toLocaleString()}
          </div>
          <p className="text-[#646464] font-medium">Per Week</p>
          <p className="text-sm text-green-600 mt-2">↑ vs last month</p>
        </div>

        <div className="bg-white rounded-lg p-6 border-2 border-brand-primary/20 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <Award className="h-8 w-8 text-brand-primary" />
            <Badge className="bg-brand-orange/20 text-brand-orange text-sm">
              Record
            </Badge>
          </div>
          <div className="text-3xl font-bold text-brand-primary mb-2">
            {analyticsData.recordWeek.total.toLocaleString()}
          </div>
          <p className="text-[#646464] font-medium">Best Week</p>
          <p className="text-sm text-[#646464] mt-2">11/14/2023</p>
        </div>

        <div className="bg-white rounded-lg p-6 border-2 border-brand-primary/20 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <Users2 className="h-8 w-8 text-brand-primary" />
            <Badge className="bg-teal-100 text-teal-700 text-sm">Network</Badge>
          </div>
          <div className="text-3xl font-bold text-brand-primary mb-2">
            {analyticsData.totalHosts}
          </div>
          <p className="text-[#646464] font-medium">Total Hosts</p>
        </div>
      </div>

      {/* Charts Section - Vertical Layout */}
      <div className="space-y-8">
        {/* Monthly Trends - Full Width */}
        <Card className="border-2 border-brand-primary/20">
          <div className="p-6 border-b">
            <h3 className="text-xl font-semibold text-brand-primary flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Growth Trends
            </h3>
            <p className="text-[#646464] mt-1">
              Monthly collection performance
            </p>
          </div>
          <CardContent className="p-6">
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData.trendData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--tsp-primary)"
                    opacity={0.2}
                  />
                  <XAxis dataKey="month" stroke="var(--tsp-primary)" fontSize={12} />
                  <YAxis
                    stroke="var(--tsp-primary)"
                    fontSize={12}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `${Number(value).toLocaleString()} sandwiches`,
                      'Total',
                    ]}
                    labelStyle={{ color: 'var(--tsp-primary)' }}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid var(--tsp-primary)',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sandwiches"
                    stroke="var(--tsp-primary)"
                    strokeWidth={3}
                    dot={{ fill: 'var(--tsp-primary)', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: 'var(--tsp-secondary)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Strategic Ideas - Full Width */}
        <Card className="border-2 border-brand-orange/20">
          <div className="p-6 border-b">
            <h3 className="text-xl font-semibold text-brand-primary flex items-center gap-2">
              <Target className="h-5 w-5" />
              Strategic Ideas
            </h3>
            <p className="text-[#646464] mt-1">Growth opportunities</p>
          </div>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="bg-brand-orange/10 p-4 rounded-lg border border-brand-orange/30">
                <h4 className="font-semibold text-brand-primary mb-2">
                  Host Expansion
                </h4>
                <p className="text-sm text-[#646464] mb-2">
                  {analyticsData.totalHosts} total hosts (
                  {analyticsData.activeHosts} active) - Growing network
                </p>
                <Badge className="bg-brand-orange/20 text-brand-orange">
                  Special campaign needed
                </Badge>
              </div>

              <div className="bg-brand-primary/10 p-4 rounded-lg border border-brand-primary/30">
                <h4 className="font-semibold text-brand-primary mb-2">
                  Capacity Building
                </h4>
                <p className="text-sm text-[#646464] mb-2">
                  Weekly avg: {analyticsData.avgWeekly.toLocaleString()} -
                  Support volunteer recruitment
                </p>
                <Badge className="bg-brand-primary/20 text-brand-primary">
                  → Target 10K/week
                </Badge>
              </div>

              <div className="bg-green-100 p-4 rounded-lg border border-green-300">
                <h4 className="font-semibold text-green-800 mb-2">
                  🎉 Milestone Achieved!
                </h4>
                <p className="text-sm text-green-700 mb-2">
                  {(analyticsData.totalSandwiches - 2000000).toLocaleString()}{' '}
                  sandwiches BEYOND 2M goal!
                </p>
                <Badge className="bg-green-200 text-green-800">
                  2M+ Goal Exceeded!
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
