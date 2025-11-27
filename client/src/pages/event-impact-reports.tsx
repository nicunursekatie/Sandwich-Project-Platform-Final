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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  Clock,
  MapPin,
  Filter,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  ListFilter,
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

// Organization category labels for display
const CATEGORY_LABELS: Record<string, string> = {
  corp: 'Corporate',
  small_medium_corp: 'Small/Medium Business',
  large_corp: 'Large Corporation',
  school: 'School',
  nonprofit: 'Non-Profit',
  church_faith: 'Church/Faith',
  religious: 'Religious Organization',
  hospital: 'Hospital/Healthcare',
  political: 'Political Organization',
  neighborhood: 'Neighborhood Group',
  club: 'Club',
  greek_life: 'Greek Life',
  cultural: 'Cultural Organization',
  government: 'Government',
  other: 'Other',
};

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
  { value: 'all-time', label: 'All Time' },
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
    case 'all-time':
      start.setFullYear(2000, 0, 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      start.setMonth(now.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

const COLORS = ['#236383', '#FBAD3F', '#47B3CB', '#007E8C', '#A31C41', '#6B7280', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B'];

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  in_process: 'bg-yellow-100 text-yellow-800',
  new: 'bg-gray-100 text-gray-800',
  declined: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  postponed: 'bg-orange-100 text-orange-800',
};

export default function EventImpactReports() {
  const [timePreset, setTimePreset] = useState('this-year');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);

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
  const { data: eventRequests = [], isLoading } = useQuery({
    queryKey: ['/api/event-requests'],
  });

  // Process and filter events
  const processedData = useMemo(() => {
    if (!Array.isArray(eventRequests)) return null;

    // Filter events in the date range
    let filteredEvents = eventRequests.filter((event: any) => {
      const eventDate = event.scheduledEventDate
        ? new Date(event.scheduledEventDate)
        : event.desiredEventDate
          ? new Date(event.desiredEventDate)
          : null;
      if (!eventDate) return false;

      const inRange = eventDate >= dateRange.start && eventDate <= dateRange.end;

      // Status filter
      const matchesStatus = statusFilter === 'all' || event.status === statusFilter;

      // Category filter
      const matchesCategory = categoryFilter === 'all' || event.organizationCategory === categoryFilter;

      return inRange && matchesStatus && matchesCategory;
    });

    // Sort events
    filteredEvents = [...filteredEvents].sort((a: any, b: any) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          const dateA = new Date(a.scheduledEventDate || a.desiredEventDate || 0);
          const dateB = new Date(b.scheduledEventDate || b.desiredEventDate || 0);
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case 'organization':
          comparison = (a.organizationName || '').localeCompare(b.organizationName || '');
          break;
        case 'sandwiches':
          const sandwichesA = a.actualSandwichCount || a.estimatedSandwichCount || 0;
          const sandwichesB = b.actualSandwichCount || b.estimatedSandwichCount || 0;
          comparison = sandwichesA - sandwichesB;
          break;
        case 'category':
          comparison = (a.organizationCategory || '').localeCompare(b.organizationCategory || '');
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    const completedEvents = filteredEvents.filter((e: any) => e.status === 'completed');
    const scheduledEvents = filteredEvents.filter((e: any) => e.status === 'scheduled');

    // Calculate totals
    let totalSandwiches = 0;
    let totalEstimatedSandwiches = 0;
    let totalActualSandwiches = 0;
    let totalVolunteers = 0;
    let totalAdults = 0;
    let totalChildren = 0;

    const organizations = new Set<string>();
    const categoryBreakdown = new Map<string, { count: number; sandwiches: number }>();
    const monthlyData: Record<string, { month: string; events: number; sandwiches: number; completed: number; scheduled: number }> = {};
    const weekdayData: Record<string, number> = {
      Sunday: 0,
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
    };

    filteredEvents.forEach((event: any) => {
      // Sandwiches
      const actualSandwiches = event.actualSandwichCount || 0;
      const estimatedSandwiches = event.estimatedSandwichCount || 0;
      const sandwichCount = actualSandwiches || estimatedSandwiches;

      totalSandwiches += sandwichCount;
      totalActualSandwiches += actualSandwiches;
      totalEstimatedSandwiches += estimatedSandwiches;

      // Attendance - support both new and legacy field names
      // Legacy fields: attendanceAdults, attendanceTeens, attendanceKids
      // New fields: volunteerCount (total participants), adultCount, childrenCount
      totalVolunteers += (event.volunteerCount ?? event.attendanceAdults ?? 0);
      totalAdults += (event.adultCount ?? event.attendanceTeens ?? 0);
      totalChildren += (event.childrenCount ?? event.attendanceKids ?? 0);

      // Organizations
      if (event.organizationName) {
        organizations.add(event.organizationName);
      }

      // Category breakdown
      const category = event.organizationCategory || 'other';
      const existing = categoryBreakdown.get(category) || { count: 0, sandwiches: 0 };
      categoryBreakdown.set(category, {
        count: existing.count + 1,
        sandwiches: existing.sandwiches + sandwichCount,
      });

      // Monthly data
      const eventDate = new Date(event.scheduledEventDate || event.desiredEventDate);
      const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = eventDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthLabel, events: 0, sandwiches: 0, completed: 0, scheduled: 0 };
      }
      monthlyData[monthKey].events += 1;
      monthlyData[monthKey].sandwiches += sandwichCount;
      if (event.status === 'completed') {
        monthlyData[monthKey].completed += 1;
      } else if (event.status === 'scheduled') {
        monthlyData[monthKey].scheduled += 1;
      }

      // Weekday distribution
      const weekday = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
      weekdayData[weekday] = (weekdayData[weekday] || 0) + 1;
    });

    // Convert to arrays for charts
    const monthlyChartData = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => data);

    const categoryChartData = Array.from(categoryBreakdown.entries())
      .map(([category, data]) => ({
        name: CATEGORY_LABELS[category] || category,
        rawCategory: category,
        events: data.count,
        sandwiches: data.sandwiches,
        avgSandwiches: data.count > 0 ? Math.round(data.sandwiches / data.count) : 0,
      }))
      .sort((a, b) => b.events - a.events);

    const weekdayChartData = Object.entries(weekdayData).map(([day, count]) => ({
      day,
      events: count,
    }));

    // Top organizations by events
    const orgEventCounts = new Map<string, { count: number; sandwiches: number; category: string }>();
    filteredEvents.forEach((event: any) => {
      if (event.organizationName) {
        const existing = orgEventCounts.get(event.organizationName) || { count: 0, sandwiches: 0, category: event.organizationCategory };
        orgEventCounts.set(event.organizationName, {
          count: existing.count + 1,
          sandwiches: existing.sandwiches + (event.actualSandwichCount || event.estimatedSandwichCount || 0),
          category: event.organizationCategory,
        });
      }
    });

    const topOrganizations = Array.from(orgEventCounts.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      filteredEvents,
      completedEvents,
      scheduledEvents,
      totalEvents: filteredEvents.length,
      totalCompleted: completedEvents.length,
      totalScheduled: scheduledEvents.length,
      totalSandwiches,
      totalActualSandwiches,
      totalEstimatedSandwiches,
      totalVolunteers,
      totalAdults,
      totalChildren,
      uniqueOrganizations: organizations.size,
      avgSandwichesPerEvent: filteredEvents.length > 0 ? Math.round(totalSandwiches / filteredEvents.length) : 0,
      monthlyChartData,
      categoryChartData,
      weekdayChartData,
      topOrganizations,
    };
  }, [eventRequests, dateRange, statusFilter, categoryFilter, sortField, sortDirection]);

  // Get unique categories for filter
  const availableCategories = useMemo(() => {
    if (!Array.isArray(eventRequests)) return [];
    const categories = new Set<string>();
    eventRequests.forEach((event: any) => {
      if (event.organizationCategory) {
        categories.add(event.organizationCategory);
      }
    });
    return Array.from(categories).sort();
  }, [eventRequests]);

  // Export to CSV
  const exportToCSV = () => {
    if (!processedData) return;

    const csvRows = [
      ['Event Impact Report'],
      [`Report Period: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`],
      ['Generated: ' + new Date().toLocaleString()],
      [''],
      ['SUMMARY METRICS'],
      ['Metric', 'Value'],
      ['Total Events', processedData.totalEvents],
      ['Completed Events', processedData.totalCompleted],
      ['Scheduled Events', processedData.totalScheduled],
      ['Total Sandwiches', processedData.totalSandwiches],
      ['Average Sandwiches per Event', processedData.avgSandwichesPerEvent],
      ['Unique Organizations', processedData.uniqueOrganizations],
      ['Total Volunteers', processedData.totalVolunteers],
      [''],
      ['CATEGORY BREAKDOWN'],
      ['Category', 'Events', 'Sandwiches', 'Avg per Event'],
      ...processedData.categoryChartData.map(c => [c.name, c.events, c.sandwiches, c.avgSandwiches]),
      [''],
      ['TOP ORGANIZATIONS'],
      ['Organization', 'Events', 'Sandwiches', 'Category'],
      ...processedData.topOrganizations.map(o => [o.name, o.count, o.sandwiches, CATEGORY_LABELS[o.category] || o.category]),
      [''],
      ['EVENT DETAILS'],
      ['Date', 'Organization', 'Category', 'Status', 'Sandwiches (Est)', 'Sandwiches (Actual)', 'Event Time', 'Address'],
      ...processedData.filteredEvents.map((e: any) => [
        new Date(e.scheduledEventDate || e.desiredEventDate).toLocaleDateString(),
        e.organizationName || 'N/A',
        CATEGORY_LABELS[e.organizationCategory] || e.organizationCategory || 'N/A',
        e.status || 'N/A',
        e.estimatedSandwichCount || '',
        e.actualSandwichCount || '',
        e.eventStartTime || '',
        e.eventAddress || '',
      ]),
    ];

    // Escape CSV cell values: convert to string, escape quotes by doubling them
    const escapeCell = (cell: any) => {
      const str = String(cell ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };
    const csvContent = csvRows.map(row => row.map(escapeCell).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `event-impact-report-${dateRange.start.toISOString().split('T')[0]}-to-${dateRange.end.toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Helper for keyboard navigation on sortable headers
  const handleSortKeyDown = (field: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSort(field);
    }
  };

  // Helper for toggle expansion with keyboard support
  const toggleEventExpansion = (eventId: number) => {
    setExpandedEvent(expandedEvent === eventId ? null : eventId);
  };

  const handleExpandKeyDown = (eventId: number) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleEventExpansion(eventId);
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const formatEventDate = (date: string | null) => {
    if (!date) return 'TBD';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen p-6 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading event data...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 print:mb-4">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Group Event Impact Report
          </h1>
          <p className="text-lg text-gray-600">
            Comprehensive data on sandwich-making events, organizations, and impact
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-6 print:hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Event Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_process">In Process</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="postponed">Postponed</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <Label>Organization Type</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {availableCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat] || cat}
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

              {/* Export Button */}
              <div className="space-y-2">
                <Label>Export Data</Label>
                <Button variant="outline" onClick={exportToCSV} className="w-full">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Current Range Display */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
              <p className="text-sm text-blue-700">
                <Calendar className="w-4 h-4 inline mr-2" />
                Showing data from <strong>{dateRange.start.toLocaleDateString()}</strong> to <strong>{dateRange.end.toLocaleDateString()}</strong>
              </p>
              <p className="text-sm text-blue-600">
                {processedData?.totalEvents || 0} events found
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-[#236383] to-[#007E8C] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <CalendarDays className="w-5 h-5 mr-2" />
                Total Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {processedData?.totalEvents || 0}
              </div>
              <div className="flex gap-2 mt-2 text-sm text-white/80">
                <span className="bg-green-500/30 px-2 py-0.5 rounded">
                  {processedData?.totalCompleted || 0} completed
                </span>
                <span className="bg-blue-500/30 px-2 py-0.5 rounded">
                  {processedData?.totalScheduled || 0} scheduled
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-[#FBAD3F] to-[#f59e0b] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Sandwich className="w-5 h-5 mr-2" />
                Total Sandwiches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {processedData?.totalSandwiches?.toLocaleString() || 0}
              </div>
              <p className="text-white/80 text-sm mt-1">
                ~{processedData?.avgSandwichesPerEvent || 0} avg per event
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-[#47B3CB] to-teal-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Building className="w-5 h-5 mr-2" />
                Organizations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {processedData?.uniqueOrganizations || 0}
              </div>
              <p className="text-white/80 text-sm mt-1">
                Unique organizations served
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Volunteers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {processedData?.totalVolunteers?.toLocaleString() || 0}
              </div>
              <p className="text-white/80 text-sm mt-1">
                Total volunteers engaged
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="events" className="space-y-6">
          <TabsList className="print:hidden">
            <TabsTrigger value="events" className="flex items-center gap-2">
              <ListFilter className="w-4 h-4" />
              Event List
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              By Category
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="organizations" className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              Top Organizations
            </TabsTrigger>
          </TabsList>

          {/* Events List Tab */}
          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
                <CardDescription>
                  All events in the selected time period with detailed information
                </CardDescription>
              </CardHeader>
              <CardContent>
                {processedData?.filteredEvents && processedData.filteredEvents.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            className="cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('date')}
                            tabIndex={0}
                            role="columnheader"
                            aria-sort={sortField === 'date' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                            onKeyDown={handleSortKeyDown('date')}
                          >
                            <div className="flex items-center gap-1">
                              Date <SortIcon field="date" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('organization')}
                            tabIndex={0}
                            role="columnheader"
                            aria-sort={sortField === 'organization' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                            onKeyDown={handleSortKeyDown('organization')}
                          >
                            <div className="flex items-center gap-1">
                              Organization <SortIcon field="organization" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('category')}
                            tabIndex={0}
                            role="columnheader"
                            aria-sort={sortField === 'category' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                            onKeyDown={handleSortKeyDown('category')}
                          >
                            <div className="flex items-center gap-1">
                              Category <SortIcon field="category" />
                            </div>
                          </TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-gray-100 text-right"
                            onClick={() => handleSort('sandwiches')}
                            tabIndex={0}
                            role="columnheader"
                            aria-sort={sortField === 'sandwiches' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                            onKeyDown={handleSortKeyDown('sandwiches')}
                          >
                            <div className="flex items-center gap-1 justify-end">
                              Sandwiches <SortIcon field="sandwiches" />
                            </div>
                          </TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData.filteredEvents.map((event: any) => (
                          <>
                            <TableRow
                              key={event.id}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => toggleEventExpansion(event.id)}
                              tabIndex={0}
                              aria-expanded={expandedEvent === event.id}
                              onKeyDown={handleExpandKeyDown(event.id)}
                            >
                              <TableCell className="font-medium">
                                {formatEventDate(event.scheduledEventDate || event.desiredEventDate)}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{event.organizationName || 'N/A'}</div>
                                {event.department && (
                                  <div className="text-sm text-gray-500">{event.department}</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {CATEGORY_LABELS[event.organizationCategory] || event.organizationCategory || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={STATUS_COLORS[event.status] || 'bg-gray-100 text-gray-800'}>
                                  {event.status || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div>
                                  {event.actualSandwichCount ? (
                                    <span className="font-bold text-green-600">
                                      {event.actualSandwichCount.toLocaleString()}
                                    </span>
                                  ) : event.estimatedSandwichCount ? (
                                    <span className="text-gray-600">
                                      ~{event.estimatedSandwichCount.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {event.eventStartTime && (
                                  <div className="flex items-center gap-1 text-sm">
                                    <Clock className="w-3 h-3" />
                                    {event.eventStartTime}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                            {expandedEvent === event.id && (
                              <TableRow className="bg-gray-50">
                                <TableCell colSpan={6}>
                                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {event.eventAddress && (
                                      <div>
                                        <div className="flex items-center gap-1 text-sm font-medium text-gray-500 mb-1">
                                          <MapPin className="w-3 h-3" />
                                          Location
                                        </div>
                                        <div className="text-sm">{event.eventAddress}</div>
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-sm font-medium text-gray-500 mb-1">Contact</div>
                                      <div className="text-sm">
                                        {event.firstName} {event.lastName}
                                        {event.email && <div className="text-gray-500">{event.email}</div>}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-500 mb-1">Sandwich Details</div>
                                      <div className="text-sm">
                                        {event.estimatedSandwichCount && (
                                          <div>Estimated: {event.estimatedSandwichCount.toLocaleString()}</div>
                                        )}
                                        {event.actualSandwichCount && (
                                          <div className="text-green-600 font-medium">
                                            Actual: {event.actualSandwichCount.toLocaleString()}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {event.volunteerCount && (
                                      <div>
                                        <div className="text-sm font-medium text-gray-500 mb-1">Volunteers</div>
                                        <div className="text-sm">{event.volunteerCount} expected</div>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No events found for the selected filters</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Events by Organization Type</CardTitle>
                  <CardDescription>Distribution of events across different organization categories</CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.categoryChartData && processedData.categoryChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <RechartsPieChart>
                        <Pie
                          data={processedData.categoryChartData}
                          dataKey="events"
                          nameKey="name"
                          cx="50%"
                          cy="40%"
                          outerRadius={80}
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        >
                          {processedData.categoryChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number, name: string) => [`${value} events`, name]} />
                        <Legend 
                          layout="horizontal" 
                          verticalAlign="bottom" 
                          align="center"
                          wrapperStyle={{ paddingTop: '20px' }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      No category data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Category Details Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Category Statistics</CardTitle>
                  <CardDescription>Detailed breakdown by organization type</CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.categoryChartData && processedData.categoryChartData.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Events</TableHead>
                          <TableHead className="text-right">Sandwiches</TableHead>
                          <TableHead className="text-right">Avg/Event</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData.categoryChartData.map((cat, index) => (
                          <TableRow key={cat.rawCategory}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                {cat.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{cat.events}</TableCell>
                            <TableCell className="text-right">{cat.sandwiches.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-gray-500">{cat.avgSandwiches}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No data available</div>
                  )}
                </CardContent>
              </Card>

              {/* Sandwiches by Category */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Sandwiches by Category</CardTitle>
                  <CardDescription>Total sandwiches distributed by organization type</CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.categoryChartData && processedData.categoryChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={processedData.categoryChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={150} />
                        <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Sandwiches']} />
                        <Bar dataKey="sandwiches" fill="#236383" />
                      </BarChart>
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

          {/* Trends Tab */}
          <TabsContent value="trends">
            <div className="grid grid-cols-1 gap-6">
              {/* Monthly Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Event Trends</CardTitle>
                  <CardDescription>Events and sandwiches over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.monthlyChartData && processedData.monthlyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={processedData.monthlyChartData}>
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
                          name="Total Events"
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
                      No trend data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Weekday Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Events by Day of Week</CardTitle>
                  <CardDescription>When do most events occur?</CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.weekdayChartData ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={processedData.weekdayChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="events" fill="#47B3CB" name="Events" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completed vs Scheduled by Month */}
              <Card>
                <CardHeader>
                  <CardTitle>Completed vs Scheduled Events</CardTitle>
                  <CardDescription>Event completion status by month</CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.monthlyChartData && processedData.monthlyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={processedData.monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="completed" stackId="a" fill="#10B981" name="Completed" />
                        <Bar dataKey="scheduled" stackId="a" fill="#3B82F6" name="Scheduled" />
                      </BarChart>
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

          {/* Top Organizations Tab */}
          <TabsContent value="organizations">
            <Card>
              <CardHeader>
                <CardTitle>Top Organizations</CardTitle>
                <CardDescription>Organizations with the most events in the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                {processedData?.topOrganizations && processedData.topOrganizations.length > 0 ? (
                  <div className="space-y-4">
                    {processedData.topOrganizations.map((org, index) => (
                      <div
                        key={org.name}
                        className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-shrink-0 w-8 h-8 bg-[#236383] text-white rounded-full flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-grow">
                          <div className="font-medium">{org.name}</div>
                          <div className="text-sm text-gray-500">
                            <Badge variant="outline" className="mr-2">
                              {CATEGORY_LABELS[org.category] || org.category || 'Other'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-6 text-right">
                          <div>
                            <div className="text-2xl font-bold text-[#236383]">{org.count}</div>
                            <div className="text-sm text-gray-500">events</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-[#FBAD3F]">{org.sandwiches.toLocaleString()}</div>
                            <div className="text-sm text-gray-500">sandwiches</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No organization data available for the selected period</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Print-only summary */}
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
              <tr><td className="border p-2">Total Events</td><td className="border p-2 text-right">{processedData?.totalEvents || 0}</td></tr>
              <tr><td className="border p-2">Completed Events</td><td className="border p-2 text-right">{processedData?.totalCompleted || 0}</td></tr>
              <tr><td className="border p-2">Scheduled Events</td><td className="border p-2 text-right">{processedData?.totalScheduled || 0}</td></tr>
              <tr><td className="border p-2">Total Sandwiches</td><td className="border p-2 text-right">{processedData?.totalSandwiches?.toLocaleString() || 0}</td></tr>
              <tr><td className="border p-2">Average Sandwiches/Event</td><td className="border p-2 text-right">{processedData?.avgSandwichesPerEvent || 0}</td></tr>
              <tr><td className="border p-2">Unique Organizations</td><td className="border p-2 text-right">{processedData?.uniqueOrganizations || 0}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
