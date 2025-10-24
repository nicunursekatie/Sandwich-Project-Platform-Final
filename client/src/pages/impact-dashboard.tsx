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
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Heart,
  Users,
  Calendar,
  MapPin,
  Award,
  Target,
  Clock,
  DollarSign,
  PieChart,
  BarChart3,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  Pie,
} from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import { useState, useEffect } from 'react';
import MonthlyComparisonAnalytics from '@/components/monthly-comparison-analytics';
import ActionCenter from '@/components/action-center';
import PredictiveForecasts from '@/components/predictive-forecasts';
import { calculateTotalSandwiches, parseCollectionDate } from '@/lib/analytics-utils';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { logger } from '@/lib/logger';

export default function ImpactDashboard() {
  const { trackView, trackClick } = useActivityTracker();
  const [chartView, setChartView] = useState<'daily' | 'weekly' | 'monthly'>(
    'monthly'
  );

  useEffect(() => {
    trackView(
      'Analytics',
      'Analytics',
      'Impact Dashboard',
      'User accessed impact dashboard'
    );
  }, [trackView]);
  const [dateRange, setDateRange] = useState<'3months' | '6months' | '1year' | 'all'>('1year');
  const [trendsView, setTrendsView] = useState<'recent' | 'seasonal' | 'historical'>('recent');
  
  // Weekly Planning Chart Controls
  const [weeklyRange, setWeeklyRange] = useState<'8weeks' | '16weeks' | '24weeks' | '52weeks'>('16weeks');
  const [showCollections, setShowCollections] = useState(false);

  // Fetch sandwich collections data
  const { data: collectionsData } = useQuery({
    queryKey: ['/api/sandwich-collections'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?page=1&limit=5000', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - balance freshness with performance
    refetchOnMount: true,
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    keepPreviousData: true, // Prevent UI thrash during updates
  });

  const collections = collectionsData?.collections || [];

  // Fetch collection stats
  const { data: stats } = useQuery({
    queryKey: ['/api/sandwich-collections/stats'],
    staleTime: 30 * 1000, // 30 seconds for stats - more frequent updates
    refetchOnMount: true,
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes
    keepPreviousData: true,
  });

  // Fetch hosts data
  const { data: hosts = [] } = useQuery({
    queryKey: ['/api/hosts'],
    staleTime: 5 * 60 * 1000, // 5 minutes - hosts change less frequently
    refetchOnMount: true,
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    keepPreviousData: true,
  });

  // Process data for visualizations
  const processCollectionData = () => {
    // Return empty array if no collections data available
    if (!Array.isArray(collections) || collections.length === 0) {
      return [];
    }

    // Calculate date cutoff based on selected range
    const now = new Date();
    let cutoffDate: Date | null = null;

    switch (dateRange) {
      case '3months':
        cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case '6months':
        cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        break;
      case '1year':
        cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      case 'all':
        cutoffDate = null; // No filter
        break;
    }

    // Filter collections by date range
    const filteredCollections = cutoffDate
      ? collections.filter((collection: any) => {
          if (!collection.collectionDate) return false;
          const date = parseCollectionDate(collection.collectionDate);
          return !Number.isNaN(date.getTime()) && date >= cutoffDate;
        })
      : collections;

    const timeData: Record<
      string,
      {
        period: string;
        sandwiches: number;
        collections: number;
        hosts: Set<string>;
      }
    > = {};

    filteredCollections.forEach((collection: any) => {
      const collectionDate = collection.collectionDate;
      if (collectionDate) {
        const date = parseCollectionDate(collectionDate);
        if (Number.isNaN(date.getTime())) {
          return;
        }
        let periodKey: string;

        if (chartView === 'weekly') {
          // Group by week (starting Monday)
          const weekStart = new Date(date);
          const day = weekStart.getDay();
          const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
          weekStart.setDate(diff);
          periodKey = `Week of ${weekStart.getFullYear()}-${String(
            weekStart.getMonth() + 1
          ).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        } else {
          // Group by month
          periodKey = `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, '0')}`;
        }

        if (!timeData[periodKey]) {
          timeData[periodKey] = {
            period: periodKey,
            sandwiches: 0,
            collections: 0,
            hosts: new Set(),
          };
        }

        // Use standardized total calculation
        const totalSandwiches = calculateTotalSandwiches(collection);

        timeData[periodKey].sandwiches += totalSandwiches;
        timeData[periodKey].collections += 1;
        const hostName = collection.hostName;
        if (hostName) {
          timeData[periodKey].hosts.add(hostName);
        }
      }
    });

    const processedData = Object.values(timeData)
      .map((item) => ({
        [chartView === 'weekly' ? 'week' : 'month']: item.period,
        sandwiches: item.sandwiches,
        collections: item.collections,
        hosts: item.hosts.size,
      }))
      .sort((a, b) =>
        a[chartView === 'weekly' ? 'week' : 'month'].localeCompare(
          b[chartView === 'weekly' ? 'week' : 'month']
        )
      );

    logger.log('Processed chart data:', processedData);
    return processedData;
  };

  const processHostPerformance = () => {
    // Return empty array if no collections data available
    if (!Array.isArray(collections) || collections.length === 0) {
      return [];
    }

    const hostData: Record<
      string,
      {
        name: string;
        totalSandwiches: number;
        totalCollections: number;
        avgPerCollection: number;
      }
    > = {};

    collections.forEach((collection: any) => {
      const hostName = collection.hostName || 'Unknown';

      if (!hostData[hostName]) {
        hostData[hostName] = {
          name: hostName,
          totalSandwiches: 0,
          totalCollections: 0,
          avgPerCollection: 0,
        };
      }

      // Use standardized total calculation
      const totalSandwiches = calculateTotalSandwiches(collection);

      hostData[hostName].totalSandwiches += totalSandwiches;
      hostData[hostName].totalCollections += 1;
    });

    return Object.values(hostData)
      .map((host) => ({
        ...host,
        avgPerCollection:
          host.totalCollections > 0
            ? Math.round(host.totalSandwiches / host.totalCollections)
            : 0,
      }))
      .sort((a, b) => b.totalSandwiches - a.totalSandwiches)
      .slice(0, 10);
  };

  // Calculate dynamic trend analysis from real data
  const calculateTrendAnalysis = () => {
    if (!Array.isArray(collections) || collections.length === 0) {
      return {
        recentTrend: { status: 'Loading...', percentage: 0, description: 'Analyzing data...' },
        seasonalContext: { status: 'Loading...', percentage: 0, description: 'Calculating patterns...' }
      };
    }

    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - (4 * 7 * 24 * 60 * 60 * 1000));
    const eightWeeksAgo = new Date(now.getTime() - (8 * 7 * 24 * 60 * 60 * 1000));

    // Recent trend (last 4 weeks vs previous 4 weeks)
    const recentCollections = collections.filter(c => {
      if (!c.collectionDate) {
        return false;
      }
      const date = parseCollectionDate(c.collectionDate);
      const time = date.getTime();
      return time >= fourWeeksAgo.getTime() && time <= now.getTime();
    });

    const previousCollections = collections.filter(c => {
      if (!c.collectionDate) {
        return false;
      }
      const date = parseCollectionDate(c.collectionDate);
      const time = date.getTime();
      return time >= eightWeeksAgo.getTime() && time < fourWeeksAgo.getTime();
    });

    const recentTotal = recentCollections.reduce((sum, c) => sum + calculateTotalSandwiches(c), 0);
    const previousTotal = previousCollections.reduce((sum, c) => sum + calculateTotalSandwiches(c), 0);

    const trendChange = previousTotal > 0 ? ((recentTotal - previousTotal) / previousTotal) * 100 : 0;
    
    let trendStatus = 'Steady';
    let trendPercentage = 75; // Default baseline
    let trendDescription = 'Consistent weekly collection performance';

    // Clamp trend change for calculations
    const clampedTrendChange = Math.max(-100, Math.min(100, trendChange));
    
    if (trendChange > 15) {
      trendStatus = 'Growing';
      trendPercentage = Math.min(85, 75 + (clampedTrendChange * 0.2));
      trendDescription = 'Strong upward collection trend';
    } else if (trendChange < -15) {
      trendStatus = 'Declining';
      trendPercentage = Math.max(60, 75 + (clampedTrendChange * 0.2));
      trendDescription = 'Collections below recent average';
    } else if (Math.abs(trendChange) <= 5) {
      trendStatus = 'Steady';
      trendPercentage = 75;
      trendDescription = 'Consistent weekly collection performance';
    }
    
    // Ensure percentage stays within bounds
    trendPercentage = Math.max(0, Math.min(100, trendPercentage));

    // Seasonal context (current month vs same month average) - Fixed calculation
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const currentMonthCollections = collections.filter(c => {
      if (!c.collectionDate) {
        return false;
      }
      const date = parseCollectionDate(c.collectionDate);
      return (
        date.getMonth() === currentMonth && date.getFullYear() === currentYear
      );
    });

    // Group by year for the current month, compute per-year totals, then average
    const monthlyTotalsByYear: Record<number, number> = {};
    
    collections.forEach(c => {
      if (!c.collectionDate) {
        return;
      }
      const date = parseCollectionDate(c.collectionDate);
      if (date.getMonth() === currentMonth && date.getFullYear() < currentYear) {
        const year = date.getFullYear();
        if (!monthlyTotalsByYear[year]) {
          monthlyTotalsByYear[year] = 0;
        }
        monthlyTotalsByYear[year] += calculateTotalSandwiches(c);
      }
    });

    const currentMonthTotal = currentMonthCollections.reduce((sum, c) => sum + calculateTotalSandwiches(c), 0);
    const yearlyTotals = Object.values(monthlyTotalsByYear);
    const avgSameMonth = yearlyTotals.length > 0 ? 
      yearlyTotals.reduce((sum, total) => sum + total, 0) / yearlyTotals.length : 0;

    const monthNames = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'];
    const seasonName = monthNames[currentMonth];
    
    let seasonalPercentage = 70;
    let seasonalDescription = `Tracking ${seasonName.toLowerCase()} collection patterns`;

    if (avgSameMonth > 0) {
      const seasonalChange = ((currentMonthTotal - avgSameMonth) / avgSameMonth) * 100;
      // Clamp seasonal change for display
      const clampedChange = Math.max(-100, Math.min(100, seasonalChange));
      
      if (seasonalChange > 10) {
        seasonalPercentage = Math.min(85, 70 + (clampedChange * 0.3));
        seasonalDescription = `Strong ${seasonName.toLowerCase()} performance vs historical average`;
      } else if (seasonalChange < -10) {
        seasonalPercentage = Math.max(55, 70 + (clampedChange * 0.3));
        seasonalDescription = `Below average for ${seasonName.toLowerCase()} season`;
      }
      
      // Ensure percentage stays within bounds
      seasonalPercentage = Math.max(0, Math.min(100, seasonalPercentage));
    }
    
    // Final clamp to ensure seasonalPercentage is always valid
    seasonalPercentage = Math.max(0, Math.min(100, seasonalPercentage));

    return {
      recentTrend: { 
        status: trendStatus, 
        percentage: trendPercentage, 
        description: trendDescription,
        change: trendChange
      },
      seasonalContext: { 
        status: `${seasonName} Activity`, 
        percentage: seasonalPercentage, 
        description: seasonalDescription 
      }
    };
  };

  const calculateImpactMetrics = () => {
    // Use the stats API for total sandwiches since it's calculated server-side
    const totalSandwiches = (stats as any)?.completeTotalSandwiches || 0;
    const totalCollections = collections?.length || 0;
    const uniqueHosts = 34; // Override to show correct active hosts count

    // Calculate current month totals
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let currentMonthTotal = 0;
    let currentMonthCollections = 0;

    // Calculate year totals from actual collections data
    const yearTotals = {
      2023: 0,
      2024: 0,
      2025: 0,
    };

    if (Array.isArray(collections)) {
      collections.forEach((collection: any) => {
        if (collection.collectionDate) {
          const date = parseCollectionDate(collection.collectionDate);
          if (Number.isNaN(date.getTime())) {
            return;
          }
          const year = date.getFullYear();
          const month = date.getMonth();

          // Calculate total sandwiches for this collection
          const individualSandwiches = collection.individualSandwiches || 0;
          let groupSandwiches = 0;

          // Handle groupCollections properly
          if (
            collection.groupCollections &&
            Array.isArray(collection.groupCollections) &&
            collection.groupCollections.length > 0
          ) {
            groupSandwiches = collection.groupCollections.reduce(
              (sum, group) => {
                const count = group.count || group.sandwichCount || 0;
                return sum + count;
              },
              0
            );
          } else if (
            collection.groupCollections &&
            typeof collection.groupCollections === 'string' &&
            collection.groupCollections !== '' &&
            collection.groupCollections !== '[]'
          ) {
            try {
              const groupData = JSON.parse(collection.groupCollections);
              if (Array.isArray(groupData)) {
                groupSandwiches = groupData.reduce(
                  (sum, group) =>
                    sum + (group.count || group.sandwichCount || 0),
                  0
                );
              }
            } catch (e) {
              logger.log('Error parsing groupCollections JSON:', e);
              groupSandwiches = 0;
            }
          }

          const collectionTotal = individualSandwiches + groupSandwiches;

          // Add to year totals
          if (yearTotals[year] !== undefined) {
            yearTotals[year] += collectionTotal;
          }

          // Add to current month totals
          if (year === currentYear && month === currentMonth) {
            currentMonthTotal += collectionTotal;
            currentMonthCollections += 1;
          }
        }
      });
    }

    return {
      totalSandwiches,
      year2023Total: yearTotals[2023],
      year2024Total: yearTotals[2024],
      year2025YTD: yearTotals[2025],
      totalCollections,
      uniqueHosts,
      currentMonthTotal,
      currentMonthCollections,
    };
  };

  const chartData = processCollectionData();
  const hostPerformance = processHostPerformance();
  const impactMetrics = calculateImpactMetrics();
  const trendAnalysis = calculateTrendAnalysis();

  // Debug logging for final data
  logger.log('=== IMPACT DASHBOARD DEBUG ===');
  logger.log('Final chartData:', chartData);
  logger.log('Final chartData length:', chartData?.length);
  logger.log('Chart view:', chartView);
  logger.log('Collections data from API:', collectionsData);
  logger.log('Stats data from API:', stats);
  logger.log('=== END DEBUG ===');

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-lg">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Impact Dashboard
          </h1>
          <p className="text-lg text-gray-600">
            Visualizing our community impact through sandwich collections
          </p>
        </div>

        {/* Key Impact Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-[#236383] to-[#007E8C] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Heart className="w-5 h-5 mr-2" />
                Verified Sandwiches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {impactMetrics.totalSandwiches?.toLocaleString()}
              </div>
              <p className="text-white/90 text-sm">
                From collections log database
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-[#236383] to-[#007E8C] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Active Hosts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {impactMetrics.uniqueHosts}
              </div>
              <p className="text-white/90 text-sm">Collection locations</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-teal-500 to-teal-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {impactMetrics.currentMonthTotal?.toLocaleString() || '0'}
              </div>
              <p className="text-teal-100 text-sm">
                {impactMetrics.currentMonthCollections || 0} collection{impactMetrics.currentMonthCollections !== 1 ? 's' : ''} so far
              </p>
            </CardContent>
          </Card>

          <Card 
            className="text-white"
            style={{
              background: 'linear-gradient(135deg, #FBAD3F 0%, #f59e0b 50%, #d97706 100%)'
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                2025 Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {impactMetrics.year2025YTD?.toLocaleString()}
              </div>
              <p className="text-white/90 text-sm">Year-to-date total</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Visualizations */}
        <Tabs defaultValue="actions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="actions" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Action Center
            </TabsTrigger>
            <TabsTrigger value="forecasts" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Forecasts
            </TabsTrigger>
            <TabsTrigger value="weekly" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Weekly Planning
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Collection Trends
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              Monthly Analysis
            </TabsTrigger>
            <TabsTrigger value="impact" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Team Impact
            </TabsTrigger>
          </TabsList>

          {/* Action Center Tab - NEW! */}
          <TabsContent value="actions">
            <ActionCenter />
          </TabsContent>

          {/* Predictive Forecasts Tab - NEW! */}
          <TabsContent value="forecasts">
            <PredictiveForecasts />
          </TabsContent>

          {/* Weekly Planning Tab */}
          <TabsContent value="weekly">
            <div className="space-y-6">
              {/* Weekly Chart Controls */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Weekly Collection Planning
                      </CardTitle>
                      <CardDescription>
                        Interactive weekly breakdown for operational planning and capacity management
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Date Range Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Show:</span>
                        <select
                          value={weeklyRange}
                          onChange={(e) => setWeeklyRange(e.target.value as any)}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary-muted"
                        >
                          <option value="8weeks">Last 8 weeks</option>
                          <option value="16weeks">Last 16 weeks</option>
                          <option value="24weeks">Last 24 weeks</option>
                          <option value="52weeks">Last 52 weeks</option>
                        </select>
                      </div>
                      
                      {/* Toggle Collections Count */}
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={showCollections}
                          onChange={(e) => setShowCollections(e.target.checked)}
                          className="rounded border-gray-300 text-brand-primary-muted focus:ring-brand-primary-muted"
                        />
                        Show collection counts
                      </label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={(() => {
                        // Calculate weekly data based on selected range
                        const weeksToShow = parseInt(weeklyRange.replace('weeks', ''));
                        const weeklyData: Record<string, { sandwiches: number; collections: number }> = {};
                        const now = new Date();
                        const startDate = new Date(now);
                        startDate.setDate(now.getDate() - (weeksToShow * 7));

                        collections.forEach((collection: any) => {
                          if (!collection.collectionDate) return;

                          const date = parseCollectionDate(collection.collectionDate);
                          if (Number.isNaN(date.getTime()) || date < startDate) return;

                          // Calculate week starting Monday
                          const monday = new Date(date);
                          const day = monday.getDay();
                          const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
                          monday.setDate(diff);
                          monday.setHours(0, 0, 0, 0);
                          const weekKey = monday.toISOString().split('T')[0];

                          if (!weeklyData[weekKey]) {
                            weeklyData[weekKey] = { sandwiches: 0, collections: 0 };
                          }

                          weeklyData[weekKey].sandwiches += calculateTotalSandwiches(collection);
                          weeklyData[weekKey].collections += 1;
                        });

                        return Object.entries(weeklyData)
                          .map(([week, data]) => ({
                            week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            sandwiches: data.sandwiches,
                            collections: data.collections,
                            weekStart: week,
                          }))
                          .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());
                      })()}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Sandwiches', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string, props: any) => {
                          if (name === 'sandwiches') return [value.toLocaleString(), 'Sandwiches'];
                          if (name === 'collections') return [value, 'Collections'];
                          return [value, name];
                        }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0]) {
                            const weekStart = payload[0].payload.weekStart;
                            const weekEnd = new Date(weekStart);
                            weekEnd.setDate(weekEnd.getDate() + 6);
                            return `Week of ${weekStart} - ${weekEnd.toISOString().split('T')[0]}`;
                          }
                          return label;
                        }}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #ccc',
                          borderRadius: '8px',
                          padding: '12px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Bar 
                        dataKey="sandwiches" 
                        fill="#236383" 
                        radius={[4, 4, 0, 0]}
                        name="Sandwiches"
                      />
                      {showCollections && (
                        <Bar 
                          dataKey="collections" 
                          fill="#FBAD3F" 
                          radius={[4, 4, 0, 0]}
                          name="Collections"
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                  
                  <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                    <p>Showing last {weeklyRange.replace('weeks', '')} weeks of collection activity • Week starting Monday</p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-[#236383] rounded"></div>
                        <span>Sandwiches</span>
                      </div>
                      {showCollections && (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-[#FBAD3F] rounded"></div>
                          <span>Collections</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Insights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[#236383]">
                        {(() => {
                          const weeksToShow = parseInt(weeklyRange.replace('weeks', ''));
                          const recentData = collections
                            .filter((c: any) => {
                              const date = parseCollectionDate(c.collectionDate);
                              const cutoff = new Date();
                              cutoff.setDate(cutoff.getDate() - (weeksToShow * 7));
                              return date >= cutoff;
                            });
                          const total = recentData.reduce((sum: number, c: any) => sum + calculateTotalSandwiches(c), 0);
                          return Math.round(total / weeksToShow).toLocaleString();
                        })()}
                      </div>
                      <p className="text-sm text-gray-600">Avg per week ({weeklyRange.replace('weeks', '')} weeks)</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[#FBAD3F]">
                        {(() => {
                          const weeksToShow = parseInt(weeklyRange.replace('weeks', ''));
                          const weeklyData: Record<string, number> = {};
                          const cutoff = new Date();
                          cutoff.setDate(cutoff.getDate() - (weeksToShow * 7));
                          
                          collections.forEach((c: any) => {
                            const date = parseCollectionDate(c.collectionDate);
                            if (date >= cutoff) {
                              const monday = new Date(date);
                              const day = monday.getDay();
                              const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
                              monday.setDate(diff);
                              const weekKey = monday.toISOString().split('T')[0];
                              weeklyData[weekKey] = (weeklyData[weekKey] || 0) + calculateTotalSandwiches(c);
                            }
                          });
                          
                          const values = Object.values(weeklyData);
                          return values.length > 0 ? Math.max(...values).toLocaleString() : '0';
                        })()}
                      </div>
                      <p className="text-sm text-gray-600">Peak week ({weeklyRange.replace('weeks', '')} weeks)</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {(() => {
                          const weeksToShow = parseInt(weeklyRange.replace('weeks', ''));
                          const recentData = collections
                            .filter((c: any) => {
                              const date = parseCollectionDate(c.collectionDate);
                              const cutoff = new Date();
                              cutoff.setDate(cutoff.getDate() - (weeksToShow * 7));
                              return date >= cutoff;
                            });
                          return recentData.length;
                        })()}
                      </div>
                      <p className="text-sm text-gray-600">Total collections ({weeklyRange.replace('weeks', '')} weeks)</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends">
            {/* View Selection */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Collection Trends Views</CardTitle>
                <CardDescription>Choose the right view for your analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant={trendsView === 'recent' ? 'default' : 'outline'}
                    className="h-auto min-h-[100px] w-full py-4 px-4 flex flex-col items-start justify-start"
                    onClick={() => {
                      setTrendsView('recent');
                      setDateRange('3months');
                      setChartView('weekly');
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                      <Clock className="w-5 h-5 flex-shrink-0" />
                      <span className="font-semibold whitespace-nowrap">Recent Trends</span>
                    </div>
                    <span className="text-left opacity-80 whitespace-normal break-words w-full text-[16px]">
                      3 months of weekly data - see recent performance patterns
                    </span>
                  </Button>

                  <Button
                    variant={trendsView === 'seasonal' ? 'default' : 'outline'}
                    className="h-auto min-h-[100px] w-full py-4 px-4 flex flex-col items-start justify-start"
                    onClick={() => {
                      setTrendsView('seasonal');
                      setDateRange('1year');
                      setChartView('monthly');
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                      <Activity className="w-5 h-5 flex-shrink-0" />
                      <span className="font-semibold whitespace-nowrap">Seasonal Patterns</span>
                    </div>
                    <span className="text-left opacity-80 whitespace-normal break-words w-full text-[16px]">
                      1 year of monthly data - identify seasonal trends
                    </span>
                  </Button>

                  <Button
                    variant={trendsView === 'historical' ? 'default' : 'outline'}
                    className="h-auto min-h-[100px] w-full py-4 px-4 flex flex-col items-start justify-start"
                    onClick={() => {
                      setTrendsView('historical');
                      setDateRange('all');
                      setChartView('monthly');
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                      <TrendingUp className="w-5 h-5 flex-shrink-0" />
                      <span className="font-semibold whitespace-nowrap">Historical Growth</span>
                    </div>
                    <span className="text-left opacity-80 whitespace-normal break-words w-full text-[16px]">
                      All-time monthly totals - track long-term growth
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="flex items-center mb-2">
                        <BarChart3 className="w-5 h-5 mr-2" />
                        {trendsView === 'recent' && 'Recent Collection Trends'}
                        {trendsView === 'seasonal' && 'Seasonal Collection Patterns'}
                        {trendsView === 'historical' && 'Historical Collection Growth'}
                      </CardTitle>
                      <CardDescription>
                        {trendsView === 'recent' && 'Weekly collections over the last 3 months'}
                        {trendsView === 'seasonal' && 'Monthly collections showing seasonal patterns'}
                        {trendsView === 'historical' && 'All-time monthly collection totals'}
                      </CardDescription>
                    </div>

                    {/* Date Range Controls */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={dateRange === '3months' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateRange('3months')}
                      >
                        3 Months
                      </Button>
                      <Button
                        variant={dateRange === '6months' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateRange('6months')}
                      >
                        6 Months
                      </Button>
                      <Button
                        variant={dateRange === '1year' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateRange('1year')}
                      >
                        1 Year
                      </Button>
                      <Button
                        variant={dateRange === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateRange('all')}
                      >
                        All Time
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {chartData && chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorSandwiches" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#236383" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#236383" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis
                          dataKey={chartView === 'weekly' ? 'week' : 'month'}
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tickFormatter={(value) => {
                            if (chartView === 'weekly') {
                              return value.includes('Week of')
                                ? value.replace('Week of ', '').slice(5)
                                : value;
                            }
                            const parts = (value || '').split('-');
                            return parts.length >= 2
                              ? parts[1] + '/' + parts[0].slice(2)
                              : value;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          label={{ value: 'Sandwiches', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #ccc',
                            borderRadius: '8px',
                            padding: '10px'
                          }}
                          labelFormatter={(value) =>
                            `${chartView === 'weekly' ? 'Week' : 'Month'}: ${value}`
                          }
                          formatter={(value: any, name: string) => [
                            typeof value === 'number' ? value.toLocaleString() : value,
                            name === 'sandwiches' ? 'Sandwiches' : name === 'collections' ? 'Collections' : 'Hosts',
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="sandwiches"
                          stroke="#236383"
                          strokeWidth={2}
                          fill="url(#colorSandwiches)"
                          fillOpacity={1}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-gray-500">
                      <div className="text-center">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">
                          No collection data available for this time period
                        </p>
                        <p className="text-sm">
                          Try selecting a different date range
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Period Summary
                  </CardTitle>
                  <CardDescription>
                    Key metrics for the selected time range
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {chartData && chartData.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-brand-primary-lighter p-4 rounded-lg">
                          <div className="text-2xl font-bold text-brand-primary">
                            {chartData.reduce((sum, item) => sum + item.sandwiches, 0).toLocaleString()}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Total Sandwiches</p>
                        </div>

                        <div className="bg-teal-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-teal-700">
                            {chartData.reduce((sum, item) => sum + item.collections, 0).toLocaleString()}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Total Collections</p>
                        </div>
                      </div>

                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-purple-700">
                          {Math.round(
                            chartData.reduce((sum, item) => sum + item.sandwiches, 0) /
                            chartData.reduce((sum, item) => sum + item.collections, 0)
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Average Sandwiches per Collection</p>
                      </div>

                      <div className="pt-4 border-t">
                        <h4 className="font-medium text-gray-900 mb-2">Data Range</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>• {chartData.length} {chartView === 'weekly' ? 'weeks' : 'months'} of data</p>
                          <p>• {dateRange === '3months' ? 'Last 3 months' : dateRange === '6months' ? 'Last 6 months' : dateRange === '1year' ? 'Last 12 months' : 'All-time history'}</p>
                          <p>• Peak: {Math.max(...chartData.map(d => d.sandwiches)).toLocaleString()} sandwiches</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No data available for the selected period</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Weekly Breakdown for Planning */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Weekly Breakdown
                  </CardTitle>
                  <CardDescription>
                    Week-by-week collection totals for operational planning
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={(() => {
                        // Calculate weekly data for last 16 weeks
                        const weeklyData: Record<string, { sandwiches: number; collections: number }> = {};
                        const now = new Date();
                        const sixteenWeeksAgo = new Date(now);
                        sixteenWeeksAgo.setDate(now.getDate() - (16 * 7));

                        collections.forEach((collection: any) => {
                          if (!collection.collectionDate) return;

                          const date = parseCollectionDate(collection.collectionDate);
                          if (Number.isNaN(date.getTime()) || date < sixteenWeeksAgo) return;

                          // Calculate week starting Monday
                          const monday = new Date(date);
                          const day = monday.getDay();
                          const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
                          monday.setDate(diff);
                          monday.setHours(0, 0, 0, 0);
                          const weekKey = monday.toISOString().split('T')[0];

                          if (!weeklyData[weekKey]) {
                            weeklyData[weekKey] = { sandwiches: 0, collections: 0 };
                          }

                          weeklyData[weekKey].sandwiches += calculateTotalSandwiches(collection);
                          weeklyData[weekKey].collections += 1;
                        });

                        return Object.entries(weeklyData)
                          .map(([week, data]) => ({
                            week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            sandwiches: data.sandwiches,
                            collections: data.collections,
                          }))
                          .sort((a, b) => {
                            const dateA = new Date(a.week);
                            const dateB = new Date(b.week);
                            return dateA.getTime() - dateB.getTime();
                          });
                      })()}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Sandwiches', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'sandwiches') return [value.toLocaleString(), 'Sandwiches'];
                          if (name === 'collections') return [value, 'Collections'];
                          return [value, name];
                        }}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #ccc',
                          borderRadius: '8px',
                          padding: '10px'
                        }}
                      />
                      <Bar dataKey="sandwiches" fill="#236383" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-sm text-gray-600">
                    <p>Showing last 16 weeks of collection activity • Week starting Monday</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Monthly Comparison Analytics Tab */}
          <TabsContent value="analysis">
            <MonthlyComparisonAnalytics />
          </TabsContent>

          {/* Impact Analysis Tab */}
          <TabsContent value="impact">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Collection Trends & Context
                  </CardTitle>
                  <CardDescription>
                    Weekly performance and external benchmarks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">
                        Recent Trend (Last 4 weeks)
                      </span>
                      <span className="font-bold text-brand-primary">{trendAnalysis.recentTrend.status}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-brand-primary h-2 rounded-full"
                        style={{ width: `${trendAnalysis.recentTrend.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {trendAnalysis.recentTrend.description}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Seasonal Context</span>
                      <span className="font-bold">{trendAnalysis.seasonalContext.status}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${trendAnalysis.seasonalContext.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {trendAnalysis.seasonalContext.description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">
                      Atlanta Hunger Context
                    </h4>
                    <div className="space-y-1">
                      <a
                        href="https://www.atlantaregionalfoodbank.org/impact/"
                        target="_blank"
                        className="text-brand-primary text-sm hover:underline block"
                      >
                        → Atlanta Regional Food Bank Data
                      </a>
                      <a
                        href="https://hungerandhealth.feedingamerica.org/understand-food-insecurity/hunger-facts/"
                        target="_blank"
                        className="text-brand-primary text-sm hover:underline block"
                      >
                        → Georgia Food Insecurity Stats
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Impact Highlights</CardTitle>
                  <CardDescription>
                    Key achievements and milestones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                      <Heart className="w-5 h-5 text-green-600 mt-1" />
                      <div>
                        <p className="font-medium text-green-900">
                          Sandwiches Provided
                        </p>
                        <p className="text-sm text-green-700">
                          {impactMetrics.totalSandwiches?.toLocaleString()}{' '}
                          sandwiches delivered to community members in need
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 bg-brand-primary-lighter rounded-lg">
                      <Users className="w-5 h-5 text-brand-primary mt-1" />
                      <div>
                        <p className="font-medium text-brand-primary-darker">
                          Community Engagement
                        </p>
                        <p className="text-sm text-brand-primary">
                          {impactMetrics.uniqueHosts} active host locations
                          contributing to the cause
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 bg-teal-50 rounded-lg">
                      <Calendar className="w-5 h-5 text-teal-600 mt-1" />
                      <div>
                        <p className="font-medium text-teal-900">
                          Collection Records
                        </p>
                        <p className="text-sm text-teal-700">
                          {impactMetrics.totalCollections?.toLocaleString()}{' '}
                          collection events documented
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-orange-600 mt-1" />
                      <div>
                        <p className="font-medium text-orange-900">
                          2025 Progress
                        </p>
                        <p className="text-sm text-orange-700">
                          {impactMetrics.year2025YTD?.toLocaleString()}{' '}
                          sandwiches collected year-to-date
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
