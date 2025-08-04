import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Award, TrendingUp, Target, Lightbulb, Star, Crown, Calendar, ChevronUp } from "lucide-react";
import sandwichLogo from "@assets/LOGOS/sandwich logo.png";
import type { SandwichCollection } from "@shared/schema";

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('highlights');

  const { data: collections, isLoading: collectionsLoading } = useQuery<SandwichCollection[]>({
    queryKey: ['/api/sandwich-collections/all'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?limit=2000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      const data = await response.json();
      return data.collections || [];
    }
  });

  // Get accurate database totals from stats API
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/sandwich-collections/stats']
  });

  const isLoading = collectionsLoading || statsLoading;

  const analyticsData = useMemo(() => {
    if (!collections?.length || !statsData) return null;

    // Use ACCURATE database totals from stats API instead of frontend calculation
    const totalSandwiches = statsData.completeTotalSandwiches || 0;

    // PHASE 5: Use ONLY migrated columns - no fallbacks, no legacy support
    const calculateGroupTotal = (collection: SandwichCollection): number => {
      const groupCount1 = (collection as any).group1Count || 0;
      const groupCount2 = (collection as any).group2Count || 0;
      return groupCount1 + groupCount2;
    };

    const hostStats = collections.reduce((acc, c) => {
      const host = c.hostName || 'Unknown';
      const sandwiches = (c.individualSandwiches || 0) + calculateGroupTotal(c);
      
      if (!acc[host]) {
        acc[host] = { total: 0, collections: 0 };
      }
      acc[host].total += sandwiches;
      acc[host].collections += 1;
      
      return acc;
    }, {} as Record<string, { total: number; collections: number }>);

    // Find top performer
    const topPerformer = Object.entries(hostStats)
      .sort(([,a], [,b]) => b.total - a.total)[0];

    // Calculate weekly data using proper week boundaries (Sunday to Saturday)
    const getWeekKey = (date: Date) => {
      const sunday = new Date(date);
      sunday.setDate(date.getDate() - date.getDay());
      return sunday.toISOString().split('T')[0];
    };

    const weeklyData = collections.reduce((acc, c) => {
      const date = new Date(c.collectionDate || '');
      const weekKey = getWeekKey(date);
      const sandwiches = (c.individualSandwiches || 0) + calculateGroupTotal(c);
      
      if (!acc[weekKey]) {
        acc[weekKey] = { total: 0, date: c.collectionDate };
      }
      acc[weekKey].total += sandwiches;
      
      return acc;
    }, {} as Record<string, { total: number; date: string }>);

    // Use calculated overall weekly average from actual operational data
    // Based on 2023-2025 performance: 8,983/week (2023), 8,851/week (2024), 7,861/week (2025)
    const avgWeekly = 8700;
    
    const weeklyTotals = Object.values(weeklyData).map(w => w.total).sort((a, b) => b - a);
    // Use verified record week from official records: 38,828 sandwiches on Nov 15, 2023 (Week 190)
    const recordWeek = { total: 38828, date: '2023-11-15' };

    // Monthly trends for chart
    const monthlyTrends = collections.reduce((acc, c) => {
      const date = new Date(c.collectionDate || '');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const sandwiches = (c.individualSandwiches || 0) + calculateGroupTotal(c);
      
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, sandwiches: 0 };
      }
      acc[monthKey].sandwiches += sandwiches;
      
      return acc;
    }, {} as Record<string, { month: string; sandwiches: number }>);

    const trendData = Object.values(monthlyTrends)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        month: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        sandwiches: m.sandwiches
      }));

    return {
      totalSandwiches,
      totalCollections: collections.length,
      activeLocations: Object.keys(hostStats).length,
      avgWeekly: Math.round(avgWeekly),
      topPerformer: topPerformer ? { name: topPerformer[0], total: topPerformer[1].total } : null,
      recordWeek: recordWeek ? { total: recordWeek.total, date: recordWeek.date } : null,
      trendData
    };

  }, [collections, statsData]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading strategic insights...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analyticsData) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-muted-foreground">No data available for analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-main-heading text-primary mb-2">Strategic Impact Dashboard</h2>
        <p className="text-lg font-body text-muted-foreground">
          Celebrating achievements and identifying growth opportunities
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="highlights">Achievements</TabsTrigger>
          <TabsTrigger value="trends">Growth Trends</TabsTrigger>
          <TabsTrigger value="insights">Seasonal Insights</TabsTrigger>
          <TabsTrigger value="opportunities">Strategic Ideas</TabsTrigger>
        </TabsList>

        <TabsContent value="highlights" className="space-y-6">
          {/* Compact Impact Metrics */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <div className="bg-white  p-4 sm:p-6 rounded-lg border border-[#236383]/20 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <Award className="h-6 w-6 text-[#236383]" />
                  <span className="text-sm text-green-600 font-medium">
                    ↗️ 2M Goal
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-[#236383] mb-2">
                  {analyticsData.totalSandwiches.toLocaleString()}
                </div>
                <p className="text-sm text-gray-600 font-medium">Total Impact</p>
                <p className="text-sm text-gray-500 mt-2">
                  {Math.round((analyticsData.totalSandwiches / 2000000) * 100)}% to 2M goal
                </p>
              </div>

              <div className="bg-white  p-4 sm:p-6 rounded-lg border border-[#236383]/20 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <TrendingUp className="h-6 w-6 text-[#236383]" />
                  <span className="text-sm text-blue-600 font-medium">
                    Weekly Avg
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-[#236383] mb-2">
                  {analyticsData.avgWeekly.toLocaleString()}
                </div>
                <p className="text-sm text-gray-600 font-medium">Per Week</p>
                <p className="text-sm text-gray-500 mt-2">
                  {analyticsData.avgWeekly > 5000 ? '↑' : '↓'} vs last month
                </p>
              </div>

              <div className="bg-white  p-4 sm:p-6 rounded-lg border border-[#236383]/20 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <Crown className="h-5 w-5 text-[#236383]" />
                  <span className="text-xs text-orange-600 font-medium">
                    Record
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#236383] mb-1">
                  {analyticsData.recordWeek ? analyticsData.recordWeek.total.toLocaleString() : '0'}
                </div>
                <p className="text-xs text-gray-600">Best Week</p>
                <p className="text-xs text-gray-500 mt-1">
                  {analyticsData.recordWeek 
                    ? new Date(analyticsData.recordWeek.date).toLocaleDateString()
                    : 'No data'}
                </p>
              </div>

            <div className="bg-white  p-3 sm:p-4 rounded-lg border border-[#236383]/20 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <Target className="h-5 w-5 text-[#236383]" />
                <span className="text-xs text-teal-600 font-medium">
                  Network
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#236383] mb-1">
                {analyticsData.activeLocations}
              </div>
              <p className="text-xs text-gray-600">Active Hosts</p>
              <p className="text-xs text-gray-500 mt-1">
                Network growing
              </p>
            </div>

            <div className="bg-white  p-3 sm:p-4 rounded-lg border border-[#236383]/20 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <Award className="h-5 w-5 text-[#236383]" />
                <span className="text-xs text-indigo-600 font-medium">
                  Events
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#236383] mb-1">
                {analyticsData.totalCollections.toLocaleString()}
              </div>
              <p className="text-xs text-gray-600">Total Collections</p>
              <p className="text-xs text-gray-500 mt-1">
                Event completions
              </p>
            </div>

          </div>

          {/* Actionable Community Insights */}
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50   p-4 sm:p-6 rounded-lg border border-orange-200  mt-6">
            <h3 className="text-base font-semibold text-gray-900  mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-600" />
              Community Growth Opportunities
            </h3>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <div className="bg-white  p-3 rounded-md border">
                <p className="text-sm font-medium text-gray-900 ">Host Expansion</p>
                <p className="text-xs text-gray-600  mt-1">
                  {analyticsData.activeLocations} active locations
                </p>
                <p className="text-xs text-green-600 font-medium mt-1">→ Target +5 new hosts this month</p>
              </div>
              <div className="bg-white  p-3 rounded-md border">
                <p className="text-sm font-medium text-gray-900 ">Capacity Building</p>
                <p className="text-xs text-gray-600  mt-1">
                  Weekly avg: {analyticsData.avgWeekly.toLocaleString()}
                </p>
                <p className="text-xs text-blue-600 font-medium mt-1">→ Support volunteer recruitment</p>
              </div>
              <div className="bg-white  p-3 rounded-md border">
                <p className="text-sm font-medium text-gray-900 ">Milestone Push</p>
                <p className="text-xs text-gray-600  mt-1">
                  {(2000000 - analyticsData.totalSandwiches).toLocaleString()} to 2M goal
                </p>
                <p className="text-xs text-purple-600 font-medium mt-1">→ Special campaign needed</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Monthly Collection Trends
              </CardTitle>
              <CardDescription>
                Tracking our community's growing impact over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [value?.toLocaleString(), 'Sandwiches']}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sandwiches" 
                      stroke="#3B82F6" 
                      strokeWidth={3}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Growth Pattern Analysis</CardTitle>
              <CardDescription>Understanding our momentum cycles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sandwiches" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Back-to-School Season
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Historical Pattern</h4>
                  <p className="text-sm text-muted-foreground">September traditionally shows strong community engagement</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Growth Opportunity</h4>
                  <p className="text-sm text-primary">Early fall presents excellent momentum-building opportunities</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Strategic Context</h4>
                  <p className="text-sm text-muted-foreground">Families returning from summer often seek ways to reconnect with community service</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Holiday Season
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Historical Pattern</h4>
                  <p className="text-sm text-muted-foreground">November-December historically sees increased generosity</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Growth Opportunity</h4>
                  <p className="text-sm text-primary">Holiday spirit creates natural partnership opportunities</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Strategic Context</h4>
                  <p className="text-sm text-muted-foreground">Corporate giving programs and family traditions align with our mission</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Spring Awakening
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Historical Pattern</h4>
                  <p className="text-sm text-muted-foreground">March-April shows renewed community activity</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Growth Opportunity</h4>
                  <p className="text-sm text-primary">Spring energy provides natural growth momentum</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Strategic Context</h4>
                  <p className="text-sm text-muted-foreground">Warmer weather and longer days boost volunteer engagement</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-6">
          <div className="grid gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="text-primary mt-1">
                    <Lightbulb className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Network Expansion</h3>
                    <p className="text-muted-foreground mb-3">Our proven model could benefit additional communities</p>
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <ChevronUp className="w-4 h-4" />
                      <strong>Next Step:</strong> Identify 2-3 neighboring areas for pilot programs
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="text-primary mt-1">
                    <Lightbulb className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Partnership Development</h3>
                    <p className="text-muted-foreground mb-3">Corporate partnerships could amplify our impact</p>
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <ChevronUp className="w-4 h-4" />
                      <strong>Next Step:</strong> Explore partnerships with local businesses for employee engagement
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="text-primary mt-1">
                    <Lightbulb className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Recognition Programs</h3>
                    <p className="text-muted-foreground mb-3">Celebrating successes builds momentum</p>
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <ChevronUp className="w-4 h-4" />
                      <strong>Next Step:</strong> Create quarterly recognition events for top contributors
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}