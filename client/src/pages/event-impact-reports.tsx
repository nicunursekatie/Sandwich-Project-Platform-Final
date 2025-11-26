import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Users,
  Building,
  Sandwich,
  TrendingUp,
  BarChart3,
  PieChart,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

// Time period presets
const TIME_PRESETS = [
  { value: 'this-week', label: 'This Week' },
  { value: 'last-week', label: 'Last Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'last-quarter', label: 'Last Quarter' },
  { value: 'this-year', label: 'This Year' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
];

// Helper to calculate date ranges
function getDateRange(preset: string): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (preset) {
    case 'this-week': {
      const day = now.getDay();
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'last-week': {
      const day = now.getDay();
      start.setDate(now.getDate() - day - 7);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'this-month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last-month':
      start.setMonth(now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'this-quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      start.setMonth(quarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'last-quarter': {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
      const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
      start.setFullYear(year, lastQuarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(year, lastQuarter * 3 + 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'this-year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last-year':
      start.setFullYear(now.getFullYear() - 1, 0, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(now.getFullYear() - 1, 11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      start.setMonth(now.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

const COLORS = ['#236383', '#FBAD3F', '#47B3CB', '#007E8C', '#A31C41', '#6B7280'];

export default function EventImpactReports() {
  const [timePreset, setTimePreset] = useState('this-month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Calculate actual date range
  const dateRange = useMemo(() => {
    if (timePreset === 'custom' && customStartDate && customEndDate) {
      return {
        start: new Date(customStartDate),
        end: new Date(customEndDate),
      };
    }
    return getDateRange(timePreset);
  }, [timePreset, customStartDate, customEndDate]);

  // Fetch event requests
  const { data: eventRequests = [] } = useQuery({
    queryKey: ['/api/event-requests'],
  });

  // Calculate metrics from event data
  const metrics = useMemo(() => {
    if (!Array.isArray(eventRequests)) return null;

    // Filter events in the date range that are completed or scheduled
    const filteredEvents = eventRequests.filter((event: any) => {
      const eventDate = event.scheduledEventDate ? new Date(event.scheduledEventDate) : null;
      if (!eventDate) return false;
      return (
        eventDate >= dateRange.start &&
        eventDate <= dateRange.end &&
        (event.status === 'completed' || event.status === 'scheduled')
      );
    });

    const completedEvents = filteredEvents.filter((e: any) => e.status === 'completed');

    // Attendance metrics
    let totalAdults = 0;
    let totalTeens = 0;
    let totalKids = 0;
    let totalEstimatedAttendance = 0;

    // Sandwich metrics
    let totalSandwiches = 0;

    // Organization metrics
    const organizations = new Set<string>();
    const organizationTypes = new Map<string, number>();

    completedEvents.forEach((event: any) => {
      // Attendance
      totalAdults += event.attendanceAdults || 0;
      totalTeens += event.attendanceTeens || 0;
      totalKids += event.attendanceKids || 0;
      totalEstimatedAttendance += event.estimatedAttendance || 0;

      // Sandwiches - use actual or estimated
      const sandwichCount = event.actualSandwichCount || event.estimatedSandwichCount || 0;
      totalSandwiches += sandwichCount;

      // Organizations
      if (event.organizationName) {
        organizations.add(event.organizationName);
      }
      const orgType = event.organizationType || 'Other';
      organizationTypes.set(orgType, (organizationTypes.get(orgType) || 0) + 1);
    });

    const totalActualAttendance = totalAdults + totalTeens + totalKids;

    // Monthly breakdown for charts
    const monthlyData: Record<string, { month: string; events: number; sandwiches: number; attendance: number }> = {};

    completedEvents.forEach((event: any) => {
      const eventDate = new Date(event.scheduledEventDate);
      const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = eventDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthLabel, events: 0, sandwiches: 0, attendance: 0 };
      }

      monthlyData[monthKey].events += 1;
      monthlyData[monthKey].sandwiches += event.actualSandwichCount || event.estimatedSandwichCount || 0;
      monthlyData[monthKey].attendance += (event.attendanceAdults || 0) + (event.attendanceTeens || 0) + (event.attendanceKids || 0) || event.estimatedAttendance || 0;
    });

    // Convert to array and sort
    const monthlyChartData = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => data);

    // Organization type breakdown for pie chart
    const orgTypeData = Array.from(organizationTypes.entries()).map(([name, value]) => ({
      name,
      value,
    }));

    // Attendance breakdown for pie chart
    const attendanceBreakdown = [
      { name: 'Adults', value: totalAdults },
      { name: 'Teens', value: totalTeens },
      { name: 'Kids', value: totalKids },
    ].filter(d => d.value > 0);

    return {
      totalEvents: completedEvents.length,
      scheduledEvents: filteredEvents.length - completedEvents.length,
      totalSandwiches,
      totalActualAttendance,
      totalEstimatedAttendance,
      totalAdults,
      totalTeens,
      totalKids,
      uniqueOrganizations: organizations.size,
      monthlyChartData,
      orgTypeData,
      attendanceBreakdown,
      avgSandwichesPerEvent: completedEvents.length > 0 ? Math.round(totalSandwiches / completedEvents.length) : 0,
      avgAttendancePerEvent: completedEvents.length > 0 ? Math.round(totalActualAttendance / completedEvents.length) : 0,
    };
  }, [eventRequests, dateRange]);

  // Export to CSV
  const exportToCSV = () => {
    if (!metrics) return;

    const csvContent = [
      ['Event Impact Report'],
      [`Report Period: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`],
      [''],
      ['Summary Metrics'],
      ['Metric', 'Value'],
      ['Total Events Completed', metrics.totalEvents],
      ['Total Sandwiches Distributed', metrics.totalSandwiches],
      ['Total Attendance', metrics.totalActualAttendance || metrics.totalEstimatedAttendance],
      ['Adults Attended', metrics.totalAdults],
      ['Teens Attended', metrics.totalTeens],
      ['Kids Attended', metrics.totalKids],
      ['Unique Organizations', metrics.uniqueOrganizations],
      ['Avg Sandwiches per Event', metrics.avgSandwichesPerEvent],
      ['Avg Attendance per Event', metrics.avgAttendancePerEvent],
      [''],
      ['Monthly Breakdown'],
      ['Month', 'Events', 'Sandwiches', 'Attendance'],
      ...metrics.monthlyChartData.map(d => [d.month, d.events, d.sandwiches, d.attendance]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `event-impact-report-${dateRange.start.toISOString().split('T')[0]}-to-${dateRange.end.toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to printable format (opens print dialog)
  const exportToPrint = () => {
    window.print();
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 print:mb-4">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Event Impact Reports
          </h1>
          <p className="text-lg text-gray-600">
            Customizable reporting for events, attendance, and sandwich distribution
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-6 print:hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Report Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Time Period Selector */}
              <div className="space-y-2">
                <Label>Time Period</Label>
                <Select value={timePreset} onValueChange={setTimePreset}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_PRESETS.map(preset => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Date Range */}
              {timePreset === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Export Buttons */}
              <div className="space-y-2 md:col-span-1">
                <Label>Export</Label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportToCSV} className="flex-1">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Excel/CSV
                  </Button>
                  <Button variant="outline" onClick={exportToPrint} className="flex-1">
                    <FileText className="w-4 h-4 mr-2" />
                    PDF/Print
                  </Button>
                </div>
              </div>
            </div>

            {/* Current Range Display */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <Calendar className="w-4 h-4 inline mr-2" />
                Showing data from <strong>{dateRange.start.toLocaleDateString()}</strong> to <strong>{dateRange.end.toLocaleDateString()}</strong>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Print Header (only visible when printing) */}
        <div className="hidden print:block mb-4">
          <p className="text-sm text-gray-600">
            Report Period: {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
          </p>
          <p className="text-sm text-gray-600">
            Generated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-[#236383] to-[#007E8C] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Events Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {metrics?.totalEvents || 0}
              </div>
              <p className="text-white/80 text-sm">
                +{metrics?.scheduledEvents || 0} scheduled
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-[#FBAD3F] to-[#f59e0b] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Sandwich className="w-5 h-5 mr-2" />
                Sandwiches Distributed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {metrics?.totalSandwiches?.toLocaleString() || 0}
              </div>
              <p className="text-white/80 text-sm">
                ~{metrics?.avgSandwichesPerEvent || 0} per event
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-[#47B3CB] to-teal-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Total Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {(metrics?.totalActualAttendance || metrics?.totalEstimatedAttendance || 0).toLocaleString()}
              </div>
              <p className="text-white/80 text-sm">
                ~{metrics?.avgAttendancePerEvent || 0} per event
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Building className="w-5 h-5 mr-2" />
                Organizations Served
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {metrics?.uniqueOrganizations || 0}
              </div>
              <p className="text-white/80 text-sm">
                Unique organizations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="print:hidden">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Trends
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="print:block">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Events & Sandwiches */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Events & Sandwiches</CardTitle>
                  <CardDescription>Events completed and sandwiches distributed by month</CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics?.monthlyChartData && metrics.monthlyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={metrics.monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" orientation="left" stroke="#236383" />
                        <YAxis yAxisId="right" orientation="right" stroke="#FBAD3F" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="events" fill="#236383" name="Events" />
                        <Bar yAxisId="right" dataKey="sandwiches" fill="#FBAD3F" name="Sandwiches" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      No data available for selected period
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Organization Types */}
              <Card>
                <CardHeader>
                  <CardTitle>Organization Types</CardTitle>
                  <CardDescription>Breakdown of events by organization type</CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics?.orgTypeData && metrics.orgTypeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={metrics.orgTypeData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {metrics.orgTypeData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Attendance Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Attendance Breakdown</CardTitle>
                  <CardDescription>Adults, teens, and kids attendance</CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics?.attendanceBreakdown && metrics.attendanceBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={metrics.attendanceBreakdown}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                        >
                          <Cell fill="#236383" />
                          <Cell fill="#FBAD3F" />
                          <Cell fill="#47B3CB" />
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      No attendance data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Attendance Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Attendance Statistics</CardTitle>
                  <CardDescription>Detailed attendance numbers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-[#236383]/10 rounded-lg">
                      <span className="font-medium text-[#236383]">Adults</span>
                      <span className="text-2xl font-bold text-[#236383]">
                        {metrics?.totalAdults?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-[#FBAD3F]/10 rounded-lg">
                      <span className="font-medium text-[#FBAD3F]">Teens</span>
                      <span className="text-2xl font-bold text-[#FBAD3F]">
                        {metrics?.totalTeens?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-[#47B3CB]/10 rounded-lg">
                      <span className="font-medium text-[#47B3CB]">Kids</span>
                      <span className="text-2xl font-bold text-[#47B3CB]">
                        {metrics?.totalKids?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-900">Total Attendance</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {(metrics?.totalActualAttendance || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends">
            <div className="grid grid-cols-1 gap-6">
              {/* Monthly Trends Line Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Trends</CardTitle>
                  <CardDescription>Events, attendance, and sandwiches over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics?.monthlyChartData && metrics.monthlyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={metrics.monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="events"
                          stroke="#236383"
                          strokeWidth={2}
                          name="Events"
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="attendance"
                          stroke="#47B3CB"
                          strokeWidth={2}
                          name="Attendance"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="sandwiches"
                          stroke="#FBAD3F"
                          strokeWidth={2}
                          name="Sandwiches"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-gray-500">
                      No trend data available for selected period
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Print-only summary table */}
        <div className="hidden print:block mt-8">
          <h3 className="text-lg font-bold mb-4">Summary Data</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Metric</th>
                <th className="border p-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border p-2">Events Completed</td><td className="border p-2 text-right">{metrics?.totalEvents || 0}</td></tr>
              <tr><td className="border p-2">Sandwiches Distributed</td><td className="border p-2 text-right">{metrics?.totalSandwiches?.toLocaleString() || 0}</td></tr>
              <tr><td className="border p-2">Total Attendance</td><td className="border p-2 text-right">{(metrics?.totalActualAttendance || 0).toLocaleString()}</td></tr>
              <tr><td className="border p-2">Adults</td><td className="border p-2 text-right">{metrics?.totalAdults?.toLocaleString() || 0}</td></tr>
              <tr><td className="border p-2">Teens</td><td className="border p-2 text-right">{metrics?.totalTeens?.toLocaleString() || 0}</td></tr>
              <tr><td className="border p-2">Kids</td><td className="border p-2 text-right">{metrics?.totalKids?.toLocaleString() || 0}</td></tr>
              <tr><td className="border p-2">Organizations Served</td><td className="border p-2 text-right">{metrics?.uniqueOrganizations || 0}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
