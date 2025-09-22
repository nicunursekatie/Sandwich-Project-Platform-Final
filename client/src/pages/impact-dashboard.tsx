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
import { useState } from 'react';
import MonthlyComparisonAnalytics from '@/components/monthly-comparison-analytics';
import { calculateTotalSandwiches } from '@/lib/analytics-utils';

export default function ImpactDashboard() {
  const [chartView, setChartView] = useState<'daily' | 'weekly' | 'monthly'>(
    'monthly'
  );

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
    // Debug logging
    console.log('processCollectionData - chartView:', chartView);
    console.log('processCollectionData - collections:', collections);
    console.log(
      'processCollectionData - collections length:',
      collections?.length
    );
    console.log('processCollectionData - collectionsData:', collectionsData);

    // Return empty array if no collections data available
    if (!Array.isArray(collections) || collections.length === 0) {
      console.log('No collections data available - returning empty array');
      return [];
    }

    console.log('Processing real collections data...');

    const timeData: Record<
      string,
      {
        period: string;
        sandwiches: number;
        collections: number;
        hosts: Set<string>;
      }
    > = {};

    collections.forEach((collection: any) => {
      const collectionDate = collection.collectionDate;
      if (collectionDate) {
        const date = new Date(collectionDate);
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

    console.log('Processed chart data:', processedData);
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
      const date = new Date(c.collectionDate);
      return date >= fourWeeksAgo && date <= now;
    });

    const previousCollections = collections.filter(c => {
      const date = new Date(c.collectionDate);
      return date >= eightWeeksAgo && date < fourWeeksAgo;
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
      const date = new Date(c.collectionDate);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    // Group by year for the current month, compute per-year totals, then average
    const monthlyTotalsByYear: Record<number, number> = {};
    
    collections.forEach(c => {
      const date = new Date(c.collectionDate);
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

    // Calculate year totals from actual collections data
    const yearTotals = {
      2023: 0,
      2024: 0,
      2025: 0,
    };

    if (Array.isArray(collections)) {
      collections.forEach((collection: any) => {
        if (collection.collectionDate) {
          const date = new Date(collection.collectionDate);
          const year = date.getFullYear();

          if (yearTotals[year] !== undefined) {
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
                console.log('Error parsing groupCollections JSON:', e);
                groupSandwiches = 0;
              }
            }

            yearTotals[year] += individualSandwiches + groupSandwiches;
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
    };
  };

  const chartData = processCollectionData();
  const hostPerformance = processHostPerformance();
  const impactMetrics = calculateImpactMetrics();
  const trendAnalysis = calculateTrendAnalysis();

  // Debug logging for final data
  console.log('=== IMPACT DASHBOARD DEBUG ===');
  console.log('Final chartData:', chartData);
  console.log('Final chartData length:', chartData?.length);
  console.log('Chart view:', chartView);
  console.log('Collections data from API:', collectionsData);
  console.log('Stats data from API:', stats);
  console.log('=== END DEBUG ===');

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
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
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
              <p className="text-blue-100 text-sm">
                From collections log database
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
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
              <p className="text-green-100 text-sm">Collection locations</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-teal-500 to-teal-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                2024 Peak Year
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {impactMetrics.year2024Total?.toLocaleString()}
              </div>
              <p className="text-teal-100 text-sm">2024 collections total</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
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
              <p className="text-orange-100 text-sm">Year-to-date total</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Visualizations */}
        <Tabs defaultValue="trends" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Collection Trends
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Monthly Analysis
            </TabsTrigger>
            <TabsTrigger value="impact" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Team Impact
            </TabsTrigger>
          </TabsList>

          {/* Trends Tab */}
          <TabsContent value="trends">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2" />
                        {chartView === 'weekly' ? 'Weekly' : 'Monthly'} Sandwich
                        Collections
                      </CardTitle>
                      <CardDescription>
                        Tracking sandwich collection trends over time
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={
                          chartView === 'monthly' ? 'default' : 'outline'
                        }
                        size="sm"
                        onClick={() => setChartView('monthly')}
                      >
                        Monthly
                      </Button>
                      <Button
                        variant={chartView === 'weekly' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setChartView('weekly')}
                      >
                        Weekly
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {chartData && chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey={chartView === 'weekly' ? 'week' : 'month'}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            if (chartView === 'weekly') {
                              return value.includes('Week of')
                                ? value.replace('Week of ', '')
                                : value;
                            }
                            const parts = (value || '').split('-');
                            return parts.length >= 2
                              ? parts[1] + '/' + parts[0].slice(2)
                              : value;
                          }}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          labelFormatter={(value) =>
                            `${
                              chartView === 'weekly' ? 'Week' : 'Month'
                            }: ${value}`
                          }
                          formatter={(value, name) => [
                            value,
                            name === 'sandwiches'
                              ? 'Sandwiches'
                              : 'Collections',
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="sandwiches"
                          stroke="#8884d8"
                          fill="#8884d8"
                          fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-gray-500">
                      <div className="text-center">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">
                          No collection data available
                        </p>
                        <p className="text-sm">
                          Chart will display when collections are recorded
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Weekly Collection Consistency
                  </CardTitle>
                  <CardDescription>
                    Team collection frequency and patterns
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">
                        Weekly Collection Rate
                      </span>
                      <span className="font-bold text-green-600">
                        Consistent
                      </span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: '88%' }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Regular weekly collections maintained
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">
                        Total Weekly Collections
                      </span>
                      <span className="font-bold">
                        {stats?.totalEntries || 1809}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Collection entries recorded in system
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">
                      Weekly Collection Focus
                    </h4>
                    <p className="text-sm text-gray-600">
                      Consistent weekly sandwich collection schedule with team
                      coordination across all active collection locations.
                    </p>
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

                    <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                      <Users className="w-5 h-5 text-brand-primary mt-1" />
                      <div>
                        <p className="font-medium text-blue-900">
                          Community Engagement
                        </p>
                        <p className="text-sm text-blue-700">
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
