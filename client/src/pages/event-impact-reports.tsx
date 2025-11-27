import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';
import { apiRequest } from '@/lib/queryClient';
import { format, parseISO } from 'date-fns';
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
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Upload,
  FileUp,
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
  AreaChart,
  Area,
} from 'recharts';

// Helper to parse date strings in local timezone (avoids UTC midnight timezone shift)
function parseLocalDate(dateInput: string | Date | null | undefined): Date | null {
  if (!dateInput) return null;
  // If it's already a Date object (check both instanceof and duck typing for cross-realm compatibility)
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'object' && dateInput !== null && typeof (dateInput as any).getTime === 'function') {
    return dateInput as Date;
  }
  // If it's not a string at this point, bail
  if (typeof dateInput !== 'string') return null;
  // If it's just a date (YYYY-MM-DD), parse in local time
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // For ISO datetime strings, use parseISO which handles timezone correctly
  return parseISO(dateInput);
}

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

// Helper to create histogram buckets for sandwich distribution
function createSandwichBuckets(events: any[]): { range: string; count: number; minVal: number }[] {
  const sandwichCounts = events
    .map((e: any) => e.actualSandwichCount || e.estimatedSandwichCount || 0)
    .filter((c: number) => c > 0);

  if (sandwichCounts.length === 0) return [];

  const max = Math.max(...sandwichCounts);

  // Determine bucket size based on data spread
  let bucketSize = 100;
  if (max > 2000) bucketSize = 500;
  else if (max > 1000) bucketSize = 250;
  else if (max > 500) bucketSize = 100;
  else if (max > 200) bucketSize = 50;
  else bucketSize = 25;

  const buckets: Map<number, number> = new Map();

  sandwichCounts.forEach((count: number) => {
    const bucketStart = Math.floor(count / bucketSize) * bucketSize;
    buckets.set(bucketStart, (buckets.get(bucketStart) || 0) + 1);
  });

  // Convert to array and sort
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([start, count]) => ({
      range: `${start}-${start + bucketSize - 1}`,
      count,
      minVal: start,
    }));
}

// Helper to extract region from address (simplified - uses city or first part)
function extractRegion(address: string | null | undefined): string {
  if (!address) return 'Unknown';

  // Try to extract city from address
  // Common formats: "123 Main St, Atlanta, GA 30301" or "Atlanta, GA"
  const parts = address.split(',').map(p => p.trim());

  if (parts.length >= 2) {
    // Usually city is second to last (before state/zip)
    const cityPart = parts[parts.length - 2] || parts[0];
    // Remove numbers (zip codes that might be in wrong position)
    const city = cityPart.replace(/\d+/g, '').trim();
    if (city && city.length > 1) return city;
  }

  return parts[0] || 'Unknown';
}

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user && hasPermission(user, PERMISSIONS.ADMIN_PANEL_ACCESS);

  const [timePreset, setTimePreset] = useState('this-year');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [showCategorizationTool, setShowCategorizationTool] = useState(false);
  const [categorizationProgress, setCategorizationProgress] = useState<{
    running: boolean;
    total: number;
    processed: number;
    patternMatched: number;
    aiCategorized: number;
    errors: number;
  } | null>(null);

  // Import dialog state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importCsvData, setImportCsvData] = useState('');
  const [importAnalysis, setImportAnalysis] = useState<{
    headers: string[];
    sampleRows: Record<string, string>[];
    suggestedMappings: Record<string, string | null>;
    confidence: string;
    notes: string;
    totalRows: number;
  } | null>(null);
  const [importMappings, setImportMappings] = useState<Record<string, string | null>>({});
  const [importResults, setImportResults] = useState<{
    processed: number;
    updated: number;
    notFound: number;
    errors: number;
    details: Array<{ row: number; status: string; message: string }>;
  } | null>(null);

  // Calculate actual date range
  const dateRange = useMemo(() => {
    if (timePreset === 'custom' && customStartDate && customEndDate) {
      const start = parseLocalDate(customStartDate) || new Date();
      const end = parseLocalDate(customEndDate) || new Date();
      // Set end date to end of day for inclusive filtering
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    return getDateRange(timePreset);
  }, [timePreset, customStartDate, customEndDate]);

  // Fetch event requests
  const { data: eventRequests = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['/api/event-requests'],
  });

  // Fetch group collections not linked to event requests
  const { data: unlinkedCollections = [], isLoading: collectionsLoading } = useQuery({
    queryKey: ['/api/sandwich-collections/unlinked-groups'],
  });

  const isLoading = eventsLoading || collectionsLoading;

  const { toast } = useToast();

  // Mutation for generating AI impact report PDF
  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/impact-reports/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
          reportType: 'custom',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate report');
      }

      // Get the PDF blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TSP_Impact_Report_${dateRange.start.toISOString().split('T')[0]}_to_${dateRange.end.toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: 'Report Generated',
        description: 'Your AI-powered impact report has been downloaded.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Report Generation Failed',
        description: error.message || 'Failed to generate the impact report. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Mutation for analyzing CSV data
  const analyzeSheetMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const response = await fetch('/api/impact-reports/analyze-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ csvData }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to analyze sheet');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setImportAnalysis(data);
      setImportMappings(data.suggestedMappings);
      toast({
        title: 'Sheet Analyzed',
        description: `Found ${data.totalRows} rows. AI confidence: ${data.confidence}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Analysis Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation for importing sandwich type data
  const importDataMutation = useMutation({
    mutationFn: async ({ csvData, mappings }: { csvData: string; mappings: Record<string, string | null> }) => {
      const response = await fetch('/api/impact-reports/backfill-sandwich-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ csvData, mappings }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import data');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setImportResults(data);
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
      toast({
        title: 'Import Complete',
        description: `Updated ${data.updated} events. ${data.notFound} not found, ${data.errors} errors.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Process and filter events
  const processedData = useMemo(() => {
    if (!Array.isArray(eventRequests)) return null;

    // Map unlinked collections to match event request shape
    const mappedCollections = Array.isArray(unlinkedCollections)
      ? unlinkedCollections.map((c: any) => ({
          ...c,
          // Ensure dates are properly formatted
          scheduledEventDate: c.scheduledEventDate || c.collectionDate,
          desiredEventDate: c.collectionDate,
          // organizationCategory is unknown for collections
          organizationCategory: 'other',
        }))
      : [];

    // Combine event requests with unlinked collections
    const allEvents = [...eventRequests, ...mappedCollections];

    // Filter events in the date range
    let filteredEvents = allEvents.filter((event: any) => {
      const eventDate = parseLocalDate(event.scheduledEventDate)
        || parseLocalDate(event.desiredEventDate);
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
          const dateA = parseLocalDate(a.scheduledEventDate || a.desiredEventDate) || new Date(0);
          const dateB = parseLocalDate(b.scheduledEventDate || b.desiredEventDate) || new Date(0);
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

      // Attendance - use actual data for completed events, planned data otherwise
      if (event.status === 'completed') {
        // For completed events, prefer actual attendance if available
        totalAdults += event.attendanceAdults || event.adultCount || 0;
        totalChildren += event.attendanceKids || event.childrenCount || 0;
        // Teens tracked separately in actual attendance
        const teens = event.attendanceTeens || 0;
        totalAdults += teens; // Include teens with adults for total count
      } else {
        // For planned events, use expected counts
        totalAdults += event.adultCount || 0;
        totalChildren += event.childrenCount || 0;
      }
      // volunteerCount is always the number of participants/volunteers expected
      totalVolunteers += event.volunteerCount || 0;

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
      const eventDate = parseLocalDate(event.scheduledEventDate || event.desiredEventDate) || new Date();
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

    // ENHANCED: Weekday data with sandwich counts (not just event counts)
    const weekdaySandwichData: Record<string, number> = {
      Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0,
    };
    filteredEvents.forEach((event: any) => {
      const eventDate = parseLocalDate(event.scheduledEventDate || event.desiredEventDate) || new Date();
      const weekday = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
      const sandwichCount = event.actualSandwichCount || event.estimatedSandwichCount || 0;
      weekdaySandwichData[weekday] = (weekdaySandwichData[weekday] || 0) + sandwichCount;
    });

    const weekdayChartData = Object.entries(weekdayData).map(([day, eventCount]) => ({
      day,
      events: eventCount,
      sandwiches: weekdaySandwichData[day] || 0,
      avgPerEvent: eventCount > 0 ? Math.round((weekdaySandwichData[day] || 0) / eventCount) : 0,
    }));

    // NEW: Sandwich distribution histogram
    const sandwichDistribution = createSandwichBuckets(filteredEvents);

    // NEW: Average sandwiches by org type with min/max/event count
    const categoryStats = new Map<string, { counts: number[]; total: number; eventCount: number }>();
    filteredEvents.forEach((event: any) => {
      const category = event.organizationCategory || 'other';
      const sandwichCount = event.actualSandwichCount || event.estimatedSandwichCount || 0;
      if (sandwichCount > 0) {
        const existing = categoryStats.get(category) || { counts: [], total: 0, eventCount: 0 };
        existing.counts.push(sandwichCount);
        existing.total += sandwichCount;
        existing.eventCount += 1;
        categoryStats.set(category, existing);
      }
    });

    const avgSandwichesByCategory = Array.from(categoryStats.entries())
      .map(([category, stats]) => ({
        category: CATEGORY_LABELS[category] || category,
        rawCategory: category,
        avgSandwiches: stats.eventCount > 0 ? Math.round(stats.total / stats.eventCount) : 0,
        minSandwiches: stats.counts.length > 0 ? Math.min(...stats.counts) : 0,
        maxSandwiches: stats.counts.length > 0 ? Math.max(...stats.counts) : 0,
        eventCount: stats.eventCount,
        totalSandwiches: stats.total,
      }))
      .sort((a, b) => b.avgSandwiches - a.avgSandwiches);

    // NEW: Category trends over time (monthly breakdown by category)
    const categoryTrendsMap = new Map<string, Map<string, { events: number; sandwiches: number }>>();
    filteredEvents.forEach((event: any) => {
      const category = event.organizationCategory || 'other';
      const eventDate = parseLocalDate(event.scheduledEventDate || event.desiredEventDate) || new Date();
      const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
      const sandwichCount = event.actualSandwichCount || event.estimatedSandwichCount || 0;

      if (!categoryTrendsMap.has(monthKey)) {
        categoryTrendsMap.set(monthKey, new Map());
      }
      const monthData = categoryTrendsMap.get(monthKey)!;
      const existing = monthData.get(category) || { events: 0, sandwiches: 0 };
      monthData.set(category, {
        events: existing.events + 1,
        sandwiches: existing.sandwiches + sandwichCount,
      });
    });

    // Get all unique categories for trend chart
    const allCategories = Array.from(new Set(filteredEvents.map((e: any) => e.organizationCategory || 'other')));

    const categoryTrendsData = Array.from(categoryTrendsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, categoryData]) => {
        const date = parseLocalDate(monthKey + '-01') || new Date();
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        const row: Record<string, any> = { month: monthLabel, monthKey };

        allCategories.forEach((cat) => {
          const data = categoryData.get(cat);
          row[`${cat}_events`] = data?.events || 0;
          row[`${cat}_sandwiches`] = data?.sandwiches || 0;
        });

        return row;
      });

    // NEW: Regional data
    const regionData = new Map<string, { events: number; sandwiches: number }>();
    filteredEvents.forEach((event: any) => {
      const region = extractRegion(event.eventAddress);
      const sandwichCount = event.actualSandwichCount || event.estimatedSandwichCount || 0;
      const existing = regionData.get(region) || { events: 0, sandwiches: 0 };
      regionData.set(region, {
        events: existing.events + 1,
        sandwiches: existing.sandwiches + sandwichCount,
      });
    });

    const regionalChartData = Array.from(regionData.entries())
      .map(([region, data]) => ({
        region,
        events: data.events,
        sandwiches: data.sandwiches,
        avgPerEvent: data.events > 0 ? Math.round(data.sandwiches / data.events) : 0,
      }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 15); // Top 15 regions

    // NEW: Top organizations with more details (for enhanced leaderboard)
    const orgEventCounts = new Map<string, {
      count: number;
      sandwiches: number;
      category: string;
      lastEventDate: Date | null;
      firstEventDate: Date | null;
    }>();
    filteredEvents.forEach((event: any) => {
      if (event.organizationName) {
        const eventDate = parseLocalDate(event.scheduledEventDate || event.desiredEventDate) || new Date();
        const existing = orgEventCounts.get(event.organizationName) || {
          count: 0,
          sandwiches: 0,
          category: event.organizationCategory,
          lastEventDate: null,
          firstEventDate: null,
        };
        orgEventCounts.set(event.organizationName, {
          count: existing.count + 1,
          sandwiches: existing.sandwiches + (event.actualSandwichCount || event.estimatedSandwichCount || 0),
          category: event.organizationCategory,
          lastEventDate: !existing.lastEventDate || eventDate > existing.lastEventDate ? eventDate : existing.lastEventDate,
          firstEventDate: !existing.firstEventDate || eventDate < existing.firstEventDate ? eventDate : existing.firstEventDate,
        });
      }
    });

    const topOrganizations = Array.from(orgEventCounts.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        avgPerEvent: data.count > 0 ? Math.round(data.sandwiches / data.count) : 0,
      }))
      .sort((a, b) => b.sandwiches - a.sandwiches); // Sort by total sandwiches

    // NEW: Repeat organization analysis (retention tiers)
    const repeatAnalysis = {
      oneTime: 0,
      returning: 0, // 2-4 events
      regulars: 0,  // 5-9 events
      powerPartners: 0, // 10+ events
    };

    orgEventCounts.forEach((data) => {
      if (data.count === 1) repeatAnalysis.oneTime += 1;
      else if (data.count >= 2 && data.count <= 4) repeatAnalysis.returning += 1;
      else if (data.count >= 5 && data.count <= 9) repeatAnalysis.regulars += 1;
      else if (data.count >= 10) repeatAnalysis.powerPartners += 1;
    });

    const repeatAnalysisData = [
      { tier: '1 event (One-timers)', count: repeatAnalysis.oneTime, color: '#6B7280' },
      { tier: '2-4 events (Returning)', count: repeatAnalysis.returning, color: '#47B3CB' },
      { tier: '5-9 events (Regulars)', count: repeatAnalysis.regulars, color: '#FBAD3F' },
      { tier: '10+ events (Power Partners)', count: repeatAnalysis.powerPartners, color: '#236383' },
    ];

    // NEW: Data quality metrics
    const dataQuality = {
      totalEvents: filteredEvents.length,
      missingSandwichCount: filteredEvents.filter((e: any) => !e.actualSandwichCount && !e.estimatedSandwichCount).length,
      missingCategory: filteredEvents.filter((e: any) => !e.organizationCategory).length,
      missingAddress: filteredEvents.filter((e: any) => !e.eventAddress).length,
      missingOrgName: filteredEvents.filter((e: any) => !e.organizationName).length,
    };

    dataQuality.missingSandwichPct = filteredEvents.length > 0 ? Math.round((dataQuality.missingSandwichCount / filteredEvents.length) * 100) : 0;
    dataQuality.missingCategoryPct = filteredEvents.length > 0 ? Math.round((dataQuality.missingCategory / filteredEvents.length) * 100) : 0;
    dataQuality.missingAddressPct = filteredEvents.length > 0 ? Math.round((dataQuality.missingAddress / filteredEvents.length) * 100) : 0;

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
      // NEW data
      sandwichDistribution,
      avgSandwichesByCategory,
      categoryTrendsData,
      allCategories,
      regionalChartData,
      repeatAnalysisData,
      dataQuality,
    };
  }, [eventRequests, unlinkedCollections, dateRange, statusFilter, categoryFilter, sortField, sortDirection]);

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
        (parseLocalDate(e.scheduledEventDate || e.desiredEventDate) || new Date()).toLocaleDateString(),
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
    const parsedDate = parseLocalDate(date);
    if (!parsedDate) return 'TBD';
    return parsedDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-brand-primary-lighter to-brand-primary-light min-h-screen p-6 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading event data...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-brand-primary-lighter to-brand-primary-light min-h-screen p-6">
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

        {/* Prominent Date Range Selector */}
        <Card className="mb-4 print:hidden border-2 border-[#236383]/20">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              {/* Quick Presets */}
              <div className="flex-1">
                <Label className="text-sm font-medium mb-2 block">Quick Select</Label>
                <div className="flex flex-wrap gap-2">
                  {TIME_PRESETS.slice(0, 6).map(preset => (
                    <Button
                      key={preset.value}
                      variant={timePreset === preset.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTimePreset(preset.value)}
                      className={timePreset === preset.value ? 'bg-[#236383] hover:bg-[#236383]/90' : ''}
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <Button
                    variant={timePreset === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimePreset('custom')}
                    className={timePreset === 'custom' ? 'bg-[#236383] hover:bg-[#236383]/90' : ''}
                  >
                    Custom Range
                  </Button>
                </div>
              </div>

              {/* Calendar Date Pickers */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">From</Label>
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full sm:w-[160px] justify-start text-left font-normal"
                      >
                        <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{format(dateRange.start, 'MMM d, yyyy')}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateRange.start}
                        onSelect={(date) => {
                          if (date) {
                            setCustomStartDate(format(date, 'yyyy-MM-dd'));
                            // Auto-fill end date if not set
                            if (!customEndDate) {
                              setCustomEndDate(format(dateRange.end, 'yyyy-MM-dd'));
                            }
                            setTimePreset('custom');
                            setStartDateOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">To</Label>
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full sm:w-[160px] justify-start text-left font-normal"
                      >
                        <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{format(dateRange.end, 'MMM d, yyyy')}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateRange.end}
                        onSelect={(date) => {
                          if (date) {
                            setCustomEndDate(format(date, 'yyyy-MM-dd'));
                            // Auto-fill start date if not set
                            if (!customStartDate) {
                              setCustomStartDate(format(dateRange.start, 'yyyy-MM-dd'));
                            }
                            setTimePreset('custom');
                            setEndDateOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <Button variant="outline" onClick={exportToCSV} className="flex-1 sm:flex-none">
                    <FileSpreadsheet className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </Button>

                  <Button
                    variant="default"
                    onClick={() => generateReportMutation.mutate()}
                    disabled={generateReportMutation.isPending}
                    className="flex-1 sm:flex-none bg-brand-primary hover:bg-brand-primary/90"
                  >
                    {generateReportMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                        <span className="hidden sm:inline">Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">AI Report</span>
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    onClick={() => {
                      setImportCsvData('');
                      setImportAnalysis(null);
                      setImportMappings({});
                      setImportResults(null);
                      setShowImportDialog(true);
                    }}
                  >
                    <FileUp className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Import Data</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Results Summary Bar */}
            <div className="mt-4 p-3 bg-gradient-to-r from-[#236383]/10 to-[#47B3CB]/10 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-gray-700">
                <Calendar className="w-4 h-4 inline mr-2 text-[#236383]" />
                <strong>{processedData?.totalEvents || 0}</strong> events from{' '}
                <strong>{format(dateRange.start, 'MMM d, yyyy')}</strong> to{' '}
                <strong>{format(dateRange.end, 'MMM d, yyyy')}</strong>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="text-gray-600"
                >
                  <Filter className="w-4 h-4 mr-1" />
                  Filters
                  {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCategorizationTool(!showCategorizationTool)}
                    className="text-brand-teal"
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    AI Categorize
                  </Button>
                )}
              </div>
            </div>

            {/* Collapsible Additional Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setStatusFilter('all');
                      setCategoryFilter('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin AI Categorization Tool */}
        {isAdmin && showCategorizationTool && (
          <Card className="mb-4 print:hidden border-2 border-brand-teal/30 bg-brand-teal-light/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-brand-navy">
                <Sparkles className="w-5 h-5" />
                AI Organization Categorization Tool
              </CardTitle>
              <CardDescription>
                Use AI to automatically categorize events/organizations currently marked as "Other"
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Show count of "Other" organizations */}
              <div className="mb-4 p-3 bg-white rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      Organizations needing categorization
                    </p>
                    <p className="text-sm text-gray-500">
                      Events/organizations currently categorized as "Other" or uncategorized
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {processedData?.categoryChartData?.find(c => c.rawCategory === 'other')?.events || 0} events
                  </Badge>
                </div>
              </div>

              {/* Progress display */}
              {categorizationProgress && (
                <div className="mb-4 p-4 bg-white rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    {categorizationProgress.running ? (
                      <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                    <span className="font-medium">
                      {categorizationProgress.running ? 'Processing...' : 'Complete'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Processed:</span>{' '}
                      <strong>{categorizationProgress.processed}/{categorizationProgress.total}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Pattern Matched:</span>{' '}
                      <strong className="text-blue-600">{categorizationProgress.patternMatched}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">AI Categorized:</span>{' '}
                      <strong className="text-brand-teal">{categorizationProgress.aiCategorized}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Errors:</span>{' '}
                      <strong className={categorizationProgress.errors > 0 ? 'text-red-600' : 'text-gray-400'}>
                        {categorizationProgress.errors}
                      </strong>
                    </div>
                  </div>
                  {categorizationProgress.running && (
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-brand-teal h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(categorizationProgress.processed / categorizationProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={async () => {
                    setCategorizationProgress({
                      running: true,
                      total: 0,
                      processed: 0,
                      patternMatched: 0,
                      aiCategorized: 0,
                      errors: 0,
                    });

                    try {
                      const response = await fetch('/api/admin/ai-categorize-organizations', {
                        method: 'POST',
                        credentials: 'include',
                      });
                      const result = await response.json();

                      setCategorizationProgress({
                        running: false,
                        total: result.results?.total || 0,
                        processed: result.results?.total || 0,
                        patternMatched: result.results?.patternMatched || 0,
                        aiCategorized: result.results?.aiCategorized || 0,
                        errors: result.results?.errors || 0,
                      });

                      // Refresh data
                      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
                    } catch (error) {
                      setCategorizationProgress((prev) =>
                        prev ? { ...prev, running: false, errors: prev.errors + 1 } : null
                      );
                    }
                  }}
                  disabled={categorizationProgress?.running}
                  className="bg-brand-teal hover:bg-brand-teal-dark"
                >
                  {categorizationProgress?.running ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Run AI Categorization
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCategorizationTool(false)}
                >
                  Close
                </Button>
              </div>

              <p className="mt-3 text-xs text-gray-500">
                <AlertCircle className="w-3 h-3 inline mr-1" />
                This uses pattern matching first, then AI for remaining items. Results are saved automatically.
              </p>
            </CardContent>
          </Card>
        )}

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

          {/* NOTE: Ensure 'brand-burgundy-dark' is defined in tailwind.config.ts as '#8B1535' */}
          <Card className="bg-gradient-to-r from-brand-burgundy to-brand-burgundy-dark text-white">
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
          <TabsList className="print:hidden grid grid-cols-3 lg:grid-cols-6 h-auto gap-1">
            <TabsTrigger value="events" className="flex items-center gap-1 text-xs sm:text-sm py-2">
              <ListFilter className="w-4 h-4" />
              <span className="hidden sm:inline">Event List</span>
              <span className="sm:hidden">Events</span>
            </TabsTrigger>
            <TabsTrigger value="sandwiches" className="flex items-center gap-1 text-xs sm:text-sm py-2">
              <Sandwich className="w-4 h-4" />
              <span className="hidden sm:inline">Sandwich Analysis</span>
              <span className="sm:hidden">Sandwiches</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-1 text-xs sm:text-sm py-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">By Category</span>
              <span className="sm:hidden">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="geographic" className="flex items-center gap-1 text-xs sm:text-sm py-2">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Geographic</span>
              <span className="sm:hidden">Regions</span>
            </TabsTrigger>
            <TabsTrigger value="organizations" className="flex items-center gap-1 text-xs sm:text-sm py-2">
              <Building className="w-4 h-4" />
              <span className="hidden sm:inline">Organizations</span>
              <span className="sm:hidden">Orgs</span>
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-1 text-xs sm:text-sm py-2">
              <TrendingUp className="w-4 h-4" />
              Trends
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

          {/* Sandwich Analysis Tab - NEW */}
          <TabsContent value="sandwiches">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sandwich Distribution Histogram */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sandwich className="w-5 h-5" />
                    Sandwiches per Event Distribution
                  </CardTitle>
                  <CardDescription>
                    How many sandwiches do your events typically make? This histogram shows the distribution.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.sandwichDistribution && processedData.sandwichDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={processedData.sandwichDistribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="range" angle={-45} textAnchor="end" height={80} fontSize={12} />
                        <YAxis label={{ value: 'Number of Events', angle: -90, position: 'insideLeft' }} />
                        <Tooltip
                          formatter={(value: number) => [`${value} events`, 'Events']}
                          labelFormatter={(label) => `${label} sandwiches`}
                        />
                        <Bar dataKey="count" fill="#236383" name="Events">
                          {processedData.sandwichDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[350px] flex items-center justify-center text-gray-500">
                      No sandwich distribution data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Average Sandwiches by Organization Type */}
              <Card>
                <CardHeader>
                  <CardTitle>Average Sandwiches by Organization Type</CardTitle>
                  <CardDescription>
                    Which organization types produce the most sandwiches per event?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.avgSandwichesByCategory && processedData.avgSandwichesByCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={processedData.avgSandwichesByCategory} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="category" type="category" width={120} fontSize={11} />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            if (name === 'avgSandwiches') return [`${value.toLocaleString()}`, 'Avg per Event'];
                            return [value, name];
                          }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border rounded shadow-lg text-sm">
                                  <p className="font-bold">{data.category}</p>
                                  <p>Avg: <span className="font-semibold">{data.avgSandwiches.toLocaleString()}</span> sandwiches</p>
                                  <p className="text-gray-500">Range: {data.minSandwiches.toLocaleString()} - {data.maxSandwiches.toLocaleString()}</p>
                                  <p className="text-gray-500">Based on {data.eventCount} events</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="avgSandwiches" fill="#FBAD3F" name="Avg Sandwiches" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[350px] flex items-center justify-center text-gray-500">
                      No category data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Category Stats Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Category Statistics</CardTitle>
                  <CardDescription>Event counts and sandwich ranges by organization type</CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.avgSandwichesByCategory && processedData.avgSandwichesByCategory.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Events</TableHead>
                          <TableHead className="text-right">Avg</TableHead>
                          <TableHead className="text-right">Min</TableHead>
                          <TableHead className="text-right">Max</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData.avgSandwichesByCategory.map((cat) => (
                          <TableRow key={cat.rawCategory}>
                            <TableCell className="font-medium">{cat.category}</TableCell>
                            <TableCell className="text-right">{cat.eventCount}</TableCell>
                            <TableCell className="text-right font-semibold text-[#FBAD3F]">{cat.avgSandwiches.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-gray-500">{cat.minSandwiches.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-gray-500">{cat.maxSandwiches.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{cat.totalSandwiches.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No data available</div>
                  )}
                </CardContent>
              </Card>
            </div>
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

              {/* Category Trends Over Time - NEW */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Category Mix Over Time</CardTitle>
                  <CardDescription>
                    How has your organization mix shifted? Track which categories are growing or declining.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.categoryTrendsData && processedData.categoryTrendsData.length > 0 && processedData.allCategories ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={processedData.categoryTrendsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {processedData.allCategories.slice(0, 8).map((cat: string, index: number) => (
                          <Area
                            key={cat}
                            type="monotone"
                            dataKey={`${cat}_events`}
                            stackId="1"
                            stroke={COLORS[index % COLORS.length]}
                            fill={COLORS[index % COLORS.length]}
                            name={CATEGORY_LABELS[cat] || cat}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-gray-500">
                      Not enough data to show trends
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Geographic Tab - NEW */}
          <TabsContent value="geographic">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Regional Breakdown Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Events & Sandwiches by Region
                  </CardTitle>
                  <CardDescription>
                    Where are your events happening? Identify active regions vs underserved areas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.regionalChartData && processedData.regionalChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={processedData.regionalChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="region" angle={-45} textAnchor="end" height={100} fontSize={11} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border rounded shadow-lg text-sm">
                                  <p className="font-bold">{data.region}</p>
                                  <p className="text-[#236383]">Events: <span className="font-semibold">{data.events}</span></p>
                                  <p className="text-[#FBAD3F]">Sandwiches: <span className="font-semibold">{data.sandwiches.toLocaleString()}</span></p>
                                  <p className="text-gray-500">Avg per event: {data.avgPerEvent.toLocaleString()}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="events" fill="#236383" name="Events" />
                        <Bar yAxisId="right" dataKey="sandwiches" fill="#FBAD3F" name="Sandwiches" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-gray-500">
                      No regional data available (address data may be missing)
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Regional Stats Table */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Regional Statistics</CardTitle>
                  <CardDescription>Detailed breakdown by location</CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.regionalChartData && processedData.regionalChartData.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Region</TableHead>
                          <TableHead className="text-right">Events</TableHead>
                          <TableHead className="text-right">Sandwiches</TableHead>
                          <TableHead className="text-right">Avg/Event</TableHead>
                          <TableHead className="text-right">% of Events</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData.regionalChartData.map((region) => (
                          <TableRow key={region.region}>
                            <TableCell className="font-medium">{region.region}</TableCell>
                            <TableCell className="text-right">{region.events}</TableCell>
                            <TableCell className="text-right">{region.sandwiches.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{region.avgPerEvent.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-gray-500">
                              {processedData.totalEvents > 0
                                ? `${Math.round((region.events / processedData.totalEvents) * 100)}%`
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No regional data available</div>
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

              {/* Weekday Distribution - ENHANCED */}
              <Card>
                <CardHeader>
                  <CardTitle>Events & Sandwiches by Day of Week</CardTitle>
                  <CardDescription>
                    Which days are most productive? Compare event counts vs sandwich output.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.weekdayChartData ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={processedData.weekdayChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border rounded shadow-lg text-sm">
                                  <p className="font-bold">{data.day}</p>
                                  <p className="text-[#236383]">Events: <span className="font-semibold">{data.events}</span></p>
                                  <p className="text-[#FBAD3F]">Sandwiches: <span className="font-semibold">{data.sandwiches?.toLocaleString() || 0}</span></p>
                                  <p className="text-gray-500">Avg per event: {data.avgPerEvent?.toLocaleString() || 0}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="events" fill="#236383" name="Events" label={{ position: 'top', fontSize: 10 }} />
                        <Bar yAxisId="right" dataKey="sandwiches" fill="#FBAD3F" name="Sandwiches" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[350px] flex items-center justify-center text-gray-500">
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

          {/* Organizations Tab - ENHANCED */}
          <TabsContent value="organizations">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Repeat Organization Analysis */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Organization Retention
                  </CardTitle>
                  <CardDescription>
                    How many organizations return for multiple events?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.repeatAnalysisData ? (
                    <div className="space-y-3">
                      {processedData.repeatAnalysisData.map((tier) => (
                        <div key={tier.tier} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tier.color }}
                            />
                            <span className="text-sm font-medium">{tier.tier}</span>
                          </div>
                          <span className="text-lg font-bold">{tier.count}</span>
                        </div>
                      ))}
                      <div className="pt-3 border-t mt-3">
                        <div className="text-sm text-gray-600">
                          <strong>Retention Rate:</strong>{' '}
                          {processedData.uniqueOrganizations > 0
                            ? `${Math.round(((processedData.repeatAnalysisData[1].count + processedData.repeatAnalysisData[2].count + processedData.repeatAnalysisData[3].count) / processedData.uniqueOrganizations) * 100)}%`
                            : '0%'} of orgs return
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No data available</div>
                  )}
                </CardContent>
              </Card>

              {/* Retention Visualization */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Retention Distribution</CardTitle>
                  <CardDescription>Visual breakdown of organization engagement levels</CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.repeatAnalysisData ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={processedData.repeatAnalysisData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="tier" type="category" width={180} fontSize={11} />
                        <Tooltip />
                        <Bar dataKey="count" name="Organizations">
                          {processedData.repeatAnalysisData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-gray-500">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Enhanced Top Organizations Leaderboard */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Organization Leaderboard</CardTitle>
                  <CardDescription>
                    Top organizations by total sandwiches. Click column headers to sort.
                    Organizations with recent events are MVPs; those inactive may need re-engagement.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {processedData?.topOrganizations && processedData.topOrganizations.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Organization</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Total Sandwiches</TableHead>
                            <TableHead className="text-right">Events</TableHead>
                            <TableHead className="text-right">Avg/Event</TableHead>
                            <TableHead className="text-right">Last Event</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {processedData.topOrganizations.slice(0, 25).map((org, index) => {
                            const lastEventParsed = org.lastEventDate ? parseLocalDate(org.lastEventDate) : null;
                            const daysSinceLastEvent = lastEventParsed
                              ? Math.floor((new Date().getTime() - lastEventParsed.getTime()) / (1000 * 60 * 60 * 24))
                              : null;
                            const isInactive = daysSinceLastEvent !== null && daysSinceLastEvent > 365;

                            return (
                              <TableRow key={org.name} className={isInactive ? 'bg-amber-50' : ''}>
                                <TableCell className="font-bold text-gray-400">{index + 1}</TableCell>
                                <TableCell>
                                  <div className="font-medium">{org.name}</div>
                                  {isInactive && (
                                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 mt-1">
                                      Re-engage?
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {CATEGORY_LABELS[org.category] || org.category || 'Other'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-bold text-[#FBAD3F]">
                                  {org.sandwiches.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-[#236383]">
                                  {org.count}
                                </TableCell>
                                <TableCell className="text-right text-gray-600">
                                  {org.avgPerEvent?.toLocaleString() || '-'}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {lastEventParsed
                                    ? lastEventParsed.toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: '2-digit',
                                      })
                                    : '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No organization data available for the selected period</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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

        {/* Data Quality Notes - at bottom */}
        {processedData?.dataQuality && (processedData.dataQuality.missingSandwichPct > 0 || processedData.dataQuality.missingCategoryPct > 0) && (
          <Card className="mt-8 border-amber-200 bg-amber-50 print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-800 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Data Quality Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-amber-700">Missing Sandwich Counts</span>
                  <span className="font-bold text-amber-900">{processedData.dataQuality.missingSandwichCount} ({processedData.dataQuality.missingSandwichPct}%)</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-amber-700">Missing Org Category</span>
                  <span className="font-bold text-amber-900">{processedData.dataQuality.missingCategory} ({processedData.dataQuality.missingCategoryPct}%)</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-amber-700">Missing Address</span>
                  <span className="font-bold text-amber-900">{processedData.dataQuality.missingAddress} ({processedData.dataQuality.missingAddressPct}%)</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-amber-700">Missing Org Name</span>
                  <span className="font-bold text-amber-900">{processedData.dataQuality.missingOrgName}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Import Sandwich Type Data Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="w-5 h-5" />
              Import Sandwich Type Data
            </DialogTitle>
            <DialogDescription>
              Paste CSV data from your Google Sheet to backfill sandwich type information for historical events.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Step 1: Paste CSV Data */}
            {!importAnalysis && !importResults && (
              <div className="space-y-4">
                <div>
                  <Label>Paste your CSV data from Google Sheets</Label>
                  <p className="text-sm text-gray-500 mb-2">
                    Copy from Google Sheets: Select cells → Ctrl/Cmd+C → Paste here
                  </p>
                  <Textarea
                    value={importCsvData}
                    onChange={(e) => setImportCsvData(e.target.value)}
                    placeholder="Date,Organization,Deli,Turkey,Ham,PBJ
1/15/2025,Local Church,50,30,20,40
1/20/2025,Community Center,100,60,40,80"
                    className="font-mono text-sm h-48"
                  />
                </div>
                <Button
                  onClick={() => analyzeSheetMutation.mutate(importCsvData)}
                  disabled={!importCsvData.trim() || analyzeSheetMutation.isPending}
                >
                  {analyzeSheetMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analyze Columns
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Step 2: Review and Adjust Mappings */}
            {importAnalysis && !importResults && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>AI Confidence: {importAnalysis.confidence}</strong>
                    {importAnalysis.notes && ` - ${importAnalysis.notes}`}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Found {importAnalysis.totalRows} rows to process
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date Column *</Label>
                    <Select
                      value={importMappings.date || ''}
                      onValueChange={(v) => setImportMappings({ ...importMappings, date: v || null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {importAnalysis.headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Organization Column *</Label>
                    <Select
                      value={importMappings.organizationName || ''}
                      onValueChange={(v) => setImportMappings({ ...importMappings, organizationName: v || null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {importAnalysis.headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Deli Count</Label>
                    <Select
                      value={importMappings.deli || ''}
                      onValueChange={(v) => setImportMappings({ ...importMappings, deli: v || null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {importAnalysis.headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Turkey Count</Label>
                    <Select
                      value={importMappings.turkey || ''}
                      onValueChange={(v) => setImportMappings({ ...importMappings, turkey: v || null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {importAnalysis.headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ham Count</Label>
                    <Select
                      value={importMappings.ham || ''}
                      onValueChange={(v) => setImportMappings({ ...importMappings, ham: v || null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {importAnalysis.headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>PB&J Count</Label>
                    <Select
                      value={importMappings.pbj || ''}
                      onValueChange={(v) => setImportMappings({ ...importMappings, pbj: v || null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {importAnalysis.headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Sample Data Preview</Label>
                  <div className="mt-2 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {importAnalysis.headers.map((h) => (
                            <TableHead key={h} className="text-xs">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importAnalysis.sampleRows.slice(0, 3).map((row, i) => (
                          <TableRow key={i}>
                            {importAnalysis.headers.map((h) => (
                              <TableCell key={h} className="text-xs">{row[h]}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportAnalysis(null);
                      setImportMappings({});
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => importDataMutation.mutate({ csvData: importCsvData, mappings: importMappings })}
                    disabled={!importMappings.date || !importMappings.organizationName || importDataMutation.isPending}
                  >
                    {importDataMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Import {importAnalysis.totalRows} Rows
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Results */}
            {importResults && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-2xl font-bold">{importResults.processed}</p>
                    <p className="text-xs text-gray-600">Processed</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">{importResults.updated}</p>
                    <p className="text-xs text-green-700">Updated</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-amber-600">{importResults.notFound}</p>
                    <p className="text-xs text-amber-700">Not Found</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-600">{importResults.errors}</p>
                    <p className="text-xs text-red-700">Errors</p>
                  </div>
                </div>

                {importResults.details.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead className="w-24">Status</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResults.details.map((d, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{d.row}</TableCell>
                            <TableCell>
                              <Badge
                                variant={d.status === 'updated' ? 'default' : d.status === 'not_found' ? 'secondary' : 'destructive'}
                                className="text-xs"
                              >
                                {d.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{d.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <Button onClick={() => setShowImportDialog(false)}>
                  Done
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
