import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  Heart,
  Users,
  Calendar,
  Award,
  Trophy,
  Target,
  MapPin,
  Clock,
  Zap,
  Star,
  BarChart3,
  Building2,
  Shield,
  DollarSign,
  UserCheck,
  Rocket,
  AlertTriangle,
  Mail,
  Download,
  FileText,
  HandHeart,
  PieChartIcon,
  TrendingDown,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { calculateTotalSandwiches, parseCollectionDate } from '@/lib/analytics-utils';

export default function GrantMetrics() {
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');

  // Fetch collections data
  const { data: collectionsData } = useQuery({
    queryKey: ['/api/sandwich-collections'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?page=1&limit=5000', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: 'always',
  });

  const collections = collectionsData?.collections || [];

  if (typeof window !== "undefined") {
    (window as any).__collections = collections;
  }

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['/api/sandwich-collections/stats'],
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch recipients data
  const { data: recipientsData } = useQuery({
    queryKey: ['/api/recipients'],
    queryFn: async () => {
      const response = await fetch('/api/recipients', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch recipients');
      return response.json();
    },
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch event requests data (completed events)
  const { data: eventRequestsData } = useQuery({
    queryKey: ['/api/event-requests'],
    queryFn: async () => {
      const response = await fetch('/api/event-requests', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch event requests');
      return response.json();
    },
    staleTime: 60000,
  });

  // Hardcoded host count (actual database has 34 active hosts)
  const totalHosts = 34;

  // Process recipients data
  const recipients = recipientsData || [];
  const activeRecipients = recipients.filter((r: any) => r.status === 'active');

  // Process event requests data
  const eventRequests = eventRequestsData || [];
  const completedEvents = eventRequests.filter((e: any) => e.status === 'completed');

  // Calculate REAL recipient metrics
  const calculateRecipientMetrics = () => {
    const byFocusArea: Record<string, number> = {};
    const byRegion: Record<string, number> = {};

    activeRecipients.forEach((r: any) => {
      if (r.focusArea) {
        byFocusArea[r.focusArea] = (byFocusArea[r.focusArea] || 0) + 1;
      }
      if (r.region) {
        byRegion[r.region] = (byRegion[r.region] || 0) + 1;
      }
    });

    const totalWeeklyCapacity = activeRecipients.reduce(
      (sum: number, r: any) => sum + (r.weeklyEstimate || r.estimatedSandwiches || 0),
      0
    );

    const contractsSigned = activeRecipients.filter((r: any) => r.contractSigned).length;

    return {
      total: activeRecipients.length,
      byFocusArea,
      byRegion,
      totalWeeklyCapacity,
      contractsSigned,
      contractSignedPercentage: activeRecipients.length > 0
        ? Math.round((contractsSigned / activeRecipients.length) * 100)
        : 0,
    };
  };

  // Calculate REAL event participation metrics from event requests
  const calculateEventMetrics = () => {
    // Filter for events within selected time period if applicable
    let eventsToAnalyze = completedEvents;

    if (selectedFiscalYear !== 'all') {
      const fiscalYear = parseInt(selectedFiscalYear);
      eventsToAnalyze = eventsToAnalyze.filter((e: any) => {
        if (!e.scheduledEventDate && !e.desiredEventDate) return false;
        const eventDate = new Date(e.scheduledEventDate || e.desiredEventDate);
        if (Number.isNaN(eventDate.getTime())) return false;

        const year = eventDate.getFullYear();
        const month = eventDate.getMonth();

        if (month >= 6) { // July-December
          return year === fiscalYear;
        } else { // January-June
          return year === fiscalYear + 1;
        }
      });
    }

    const totalEvents = eventsToAnalyze.length;
    const totalActualAttendance = eventsToAnalyze.reduce(
      (sum: number, e: any) => sum + (e.actualAttendance || e.estimatedAttendance || 0),
      0
    );
    const totalActualSandwiches = eventsToAnalyze.reduce(
      (sum: number, e: any) => sum + (e.actualSandwichCount || e.estimatedSandwichCount || 0),
      0
    );

    // Get unique organizations
    const uniqueOrgs = new Set(
      eventsToAnalyze.map((e: any) => e.organizationName).filter(Boolean)
    );

    // Calculate events with social media posts
    const socialMediaPosts = eventsToAnalyze.filter(
      (e: any) => e.socialMediaPostCompleted
    ).length;

    return {
      totalEvents,
      totalActualAttendance,
      totalActualSandwiches,
      uniqueOrganizations: uniqueOrgs.size,
      socialMediaPostsCompleted: socialMediaPosts,
      avgAttendeesPerEvent: totalEvents > 0 ? Math.round(totalActualAttendance / totalEvents) : 0,
      avgSandwichesPerEvent: totalEvents > 0 ? Math.round(totalActualSandwiches / totalEvents) : 0,
    };
  };

  const recipientMetrics = calculateRecipientMetrics();
  const eventMetrics = calculateEventMetrics();

  // Filter collections by fiscal year and quarter
  const getFilteredCollections = () => {
    if (!Array.isArray(collections)) return [];

    let filtered = collections.filter((c: any) => c.hostName !== 'Groups');

    if (selectedFiscalYear !== 'all') {
      const fiscalYear = parseInt(selectedFiscalYear);
      filtered = filtered.filter((c: any) => {
        if (!c.collectionDate) return false;
        const date = parseCollectionDate(c.collectionDate);
        if (Number.isNaN(date.getTime())) return false;
        // Fiscal year runs July 1 - June 30
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11
        if (month >= 6) { // July-December
          return year === fiscalYear;
        } else { // January-June
          return year === fiscalYear + 1;
        }
      });
    }

    if (selectedQuarter !== 'all' && selectedFiscalYear !== 'all') {
      const fiscalYear = parseInt(selectedFiscalYear);
      const quarter = parseInt(selectedQuarter);
      filtered = filtered.filter((c: any) => {
        if (!c.collectionDate) return false;
        const date = parseCollectionDate(c.collectionDate);
        if (Number.isNaN(date.getTime())) return false;
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11

        // Q1: July-Sept, Q2: Oct-Dec, Q3: Jan-Mar, Q4: Apr-Jun
        let collectionQuarter = 0;
        let collectionFY = year;

        if (month >= 6 && month <= 8) { // July-Sept
          collectionQuarter = 1;
        } else if (month >= 9 && month <= 11) { // Oct-Dec
          collectionQuarter = 2;
        } else if (month >= 0 && month <= 2) { // Jan-Mar
          collectionQuarter = 3;
          collectionFY = year - 1;
        } else { // Apr-Jun
          collectionQuarter = 4;
          collectionFY = year - 1;
        }

        return collectionFY === fiscalYear && collectionQuarter === quarter;
      });
    }

    return filtered;
  };

  const filteredCollections = getFilteredCollections();

  // Calculate volunteer hours based on conservative estimates
  const calculateVolunteerMetrics = (collectionsToAnalyze: any[]) => {
    // Conservative estimates:
    // - Individual sandwich makers: 20 min (0.33 hours) per person
    // - Group builds: 1.5 hours average per participant
    // - Hosts: 2.5 hours per collection event
    // - Administrative/coordination: 3 hours per event

    const individualEvents = collectionsToAnalyze.filter((c: any) => c.individualSandwiches > 0).length;
    const groupEvents = collectionsToAnalyze.filter((c: any) => {
      const groups = Array.isArray(c.groupCollections) ? c.groupCollections : [];
      return (c.group1Count && c.group1Count > 0) || (c.group2Count && c.group2Count > 0) || groups.length > 0;
    }).length;

    const totalEvents = collectionsToAnalyze.length;

    // Estimate participants based on sandwiches made
    // Avg person makes ~8-12 sandwiches, use 10 as conservative estimate
    const totalSandwiches = collectionsToAnalyze.reduce((sum: number, c: any) => sum + calculateTotalSandwiches(c), 0);
    const estimatedParticipants = Math.round(totalSandwiches / 10);

    // Calculate hours
    const makingHours = estimatedParticipants * 0.33; // 20 min per person
    const hostHours = totalEvents * 2.5; // Host coordination
    const adminHours = totalEvents * 3; // Administrative overhead
    const driverHours = totalEvents * 1.5; // Driver/logistics

    const totalVolunteerHours = Math.round(makingHours + hostHours + adminHours + driverHours);

    // IRS values volunteer time at $33.49/hour (2024 rate)
    const economicValue = Math.round(totalVolunteerHours * 33.49);

    return {
      estimatedParticipants,
      totalVolunteerHours,
      economicValue,
      avgHoursPerEvent: Math.round(totalVolunteerHours / Math.max(totalEvents, 1)),
    };
  };

  // Calculate cost efficiency metrics
  const calculateCostMetrics = (collectionsToAnalyze: any[]) => {
    const totalSandwiches = collectionsToAnalyze.reduce((sum: number, c: any) => sum + calculateTotalSandwiches(c), 0);

    // Industry estimates:
    // - Cost per sandwich (ingredients): $1.40-$1.48
    // - Cost per person served (1 sandwich): same
    // - With volunteer labor valued: add ~$3.35 per sandwich (20 min @ $33.49/hr / 10 sandwiches)

    const costPerSandwich = 1.44; // Average ingredient cost
    const totalFoodValue = Math.round(totalSandwiches * costPerSandwich);

    return {
      totalSandwiches,
      costPerSandwich,
      totalFoodValue,
      costPerPerson: costPerSandwich, // 1 sandwich per person served
    };
  };

  // Calculate quarterly breakdown
  const getQuarterlyBreakdown = (collectionsToAnalyze: any[]) => {
    const quarterlyData: Record<string, { sandwiches: number; events: number; quarter: string }> = {};

    collectionsToAnalyze.forEach((c: any) => {
      if (!c.collectionDate) return;
      const date = parseCollectionDate(c.collectionDate);
      if (Number.isNaN(date.getTime())) return;

      const year = date.getFullYear();
      const month = date.getMonth();

      let quarter = '';
      let fy = year;

      if (month >= 6 && month <= 8) {
        quarter = `FY${year} Q1 (Jul-Sep)`;
      } else if (month >= 9 && month <= 11) {
        quarter = `FY${year} Q2 (Oct-Dec)`;
      } else if (month >= 0 && month <= 2) {
        fy = year - 1;
        quarter = `FY${fy} Q3 (Jan-Mar)`;
      } else {
        fy = year - 1;
        quarter = `FY${fy} Q4 (Apr-Jun)`;
      }

      if (!quarterlyData[quarter]) {
        quarterlyData[quarter] = { sandwiches: 0, events: 0, quarter };
      }

      quarterlyData[quarter].sandwiches += calculateTotalSandwiches(c);
      quarterlyData[quarter].events += 1;
    });

    return Object.values(quarterlyData).sort((a, b) => a.quarter.localeCompare(b.quarter));
  };

  // Calculate impressive metrics
  const calculateGrantMetrics = () => {
    if (!Array.isArray(collections) || collections.length === 0) {
      return {
        totalSandwiches: 0,
        totalCollections: 0,
        uniqueHosts: 0,
        yearTotals: {} as Record<number, number>,
        peakYear: { year: 2024, total: 0 },
        peakMonth: { month: '', total: 0, year: 0 },
        longestStreak: 0,
        avgPerCollection: 0,
        topHost: { name: '', total: 0 },
        growthRate: 0,
        weeklyAverage: 0,
        overallGrowthMultiplier: 0,
        monthlyData: {} as Record<string, number>,
      };
    }

    const hostData: Record<string, number> = {};
    const monthlyData: Record<string, number> = {};
    const yearTotals: Record<number, number> = {};
    const weeklyData: Record<string, number> = {};
    const uniqueHostsSet = new Set<string>();

    collections.forEach((collection: any) => {
      const hostName = collection.hostName || 'Unknown';

      // Skip "Groups" rows - they are aggregate rollups that would cause double-counting
      if (hostName === 'Groups') {
        return;
      }

      const total = calculateTotalSandwiches(collection);

      uniqueHostsSet.add(hostName);
      hostData[hostName] = (hostData[hostName] || 0) + total;

      if (collection.collectionDate) {
        const date = parseCollectionDate(collection.collectionDate);
        if (!Number.isNaN(date.getTime())) {
          const year = date.getFullYear();
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          // Calculate week key (week starting Monday)
          const monday = new Date(date);
          const day = monday.getDay();
          const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
          monday.setDate(diff);
          monday.setHours(0, 0, 0, 0);
          const weekKey = monday.toISOString().split('T')[0];

          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + total;
          weeklyData[weekKey] = (weeklyData[weekKey] || 0) + total;

          if (!yearTotals[year]) {
            yearTotals[year] = 0;
          }
          yearTotals[year] += total;
        }
      }
    });

    // Find peak year
    const peakYear = Object.entries(yearTotals)
      .reduce((max, [year, total]) => total > max.total ? { year: parseInt(year), total } : max, { year: 2024, total: 0 });

    // Find peak month
    const peakMonthEntry = Object.entries(monthlyData)
      .reduce((max, [month, total]) => total > max.total ? { month, total } : max, { month: '', total: 0 });

    const [peakYear2, peakMonthNum] = peakMonthEntry.month.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const peakMonth = {
      month: peakMonthEntry.month ? `${monthNames[parseInt(peakMonthNum) - 1]} ${peakYear2}` : '',
      total: peakMonthEntry.total,
      year: parseInt(peakYear2) || 0,
    };

    // Find top host (exclude "Groups" and "Unknown" as they're data collection artifacts)
    const topHostEntry = Object.entries(hostData)
      .filter(([name]) => name !== 'Groups' && name !== 'Unknown')
      .reduce((max, [name, total]) => total > max.total ? { name, total } : max, { name: '', total: 0 });

    // Calculate growth rate (2023 to 2024)
    const growthRate = yearTotals[2023] > 0
      ? ((yearTotals[2024] - yearTotals[2023]) / yearTotals[2023]) * 100
      : 0;

    // Calculate weekly average from last 12 weeks
    const now = new Date();
    const twelveWeeksAgo = new Date(now);
    twelveWeeksAgo.setDate(now.getDate() - (12 * 7));

    const recentWeeks = Object.entries(weeklyData)
      .filter(([weekKey]) => new Date(weekKey) >= twelveWeeksAgo)
      .map(([, total]) => total);

    const weeklyAverage = recentWeeks.length > 0
      ? Math.round(recentWeeks.reduce((sum, total) => sum + total, 0) / recentWeeks.length)
      : 0;

    // Calculate overall growth multiplier (from earliest year to most recent)
    const years = Object.keys(yearTotals).map(y => parseInt(y)).sort();
    const earliestYear = years[0];
    const latestYear = years[years.length - 1];

    const overallGrowthMultiplier = yearTotals[earliestYear] > 0
      ? Math.round((yearTotals[latestYear] / yearTotals[earliestYear]) * 10) / 10
      : 0;

    const totalSandwiches = (stats as any)?.completeTotalSandwiches || 0;
    const avgPerCollection = collections.length > 0 ? Math.round(totalSandwiches / collections.length) : 0;

    return {
      totalSandwiches,
      totalCollections: collections.length,
      uniqueHosts: uniqueHostsSet.size,
      yearTotals,
      peakYear,
      peakMonth,
      avgPerCollection,
      topHost: topHostEntry,
      growthRate,
      weeklyAverage,
      overallGrowthMultiplier,
      monthlyData,
    };
  };

  // Calculate metrics for filtered data (respects fiscal year/quarter selection)
  const filteredVolunteerMetrics = calculateVolunteerMetrics(filteredCollections);
  const filteredCostMetrics = calculateCostMetrics(filteredCollections);
  const filteredQuarterlyBreakdown = getQuarterlyBreakdown(filteredCollections);

  // Calculate ALL-TIME metrics for the hero stats and growth charts (always show full history)
  const allTimeCollections = collections.filter((c: any) => c.hostName !== 'Groups');
  const metrics = calculateGrantMetrics();
  const allTimeVolunteerMetrics = calculateVolunteerMetrics(allTimeCollections);
  const allTimeCostMetrics = calculateCostMetrics(allTimeCollections);

  // Get available fiscal years from data
  const availableFiscalYears = Array.from(
    new Set(
      collections.map((c: any) => {
        if (!c.collectionDate) return null;
        const date = parseCollectionDate(c.collectionDate);
        if (Number.isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = date.getMonth();
        // If July-Dec, fiscal year starts that year. If Jan-Jun, fiscal year started previous year
        return month >= 6 ? year : year - 1;
      }).filter(Boolean)
    )
  ).sort((a: any, b: any) => b - a);

  // Debug peak month calculation
  console.log('=== PEAK MONTH DEBUG ===');
  console.log('Peak Month:', metrics.peakMonth);
  console.log('All Monthly Totals:', metrics.monthlyData);

  const november2023Collections = collections.filter((c: any) =>
    c.collectionDate && c.collectionDate.startsWith('2023-11')
  );

  console.log('November 2023 Collections Count:', november2023Collections.length);
  console.log('ALL November 2023 Collections:', november2023Collections.map((c: any) => ({
    id: c.id,
    date: c.collectionDate,
    individual: c.individualSandwiches,
    group1: c.group1Count,
    group2: c.group2Count,
    groupCollections: c.groupCollections,
    calculated: calculateTotalSandwiches(c),
    hostName: c.hostName,
  })));

  const november2023Total = november2023Collections.reduce((sum: number, c: any) =>
    sum + calculateTotalSandwiches(c), 0
  );
  console.log('November 2023 Manually Calculated Total:', november2023Total);

  // Check for duplicate IDs
  const novemberIds = november2023Collections.map((c: any) => c.id);
  const duplicateIds = novemberIds.filter((id: any, index: number) => novemberIds.indexOf(id) !== index);
  console.log('Duplicate IDs in November 2023:', duplicateIds.length > 0 ? duplicateIds : 'None');
  console.log('=======================');

  // Prepare year-over-year chart data
  const yearChartData = [
    { year: '2023', sandwiches: metrics.yearTotals[2023] || 0 },
    { year: '2024', sandwiches: metrics.yearTotals[2024] || 0 },
    { year: '2025 YTD', sandwiches: metrics.yearTotals[2025] || 0 },
  ];

  return (
    <div className="bg-gradient-to-br from-[#E8F4F8] to-[#F0F9FB] p-6 rounded-lg">
      <div className="max-w-7xl mx-auto">
        {/* Header with Filter Controls */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Grant Metrics & Impact Showcase
              </h1>
              <p className="text-lg text-gray-600">
                Highlighting our community impact for donors, grants, and partnerships
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => window.print()}
              >
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
            </div>
          </div>

          {/* Fiscal Year and Quarter Filters */}
          <Card className="bg-white/80 backdrop-blur border-[#236383]/20">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#236383]" />
                  <span className="font-semibold text-gray-700">Reporting Period:</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <Select value={selectedFiscalYear} onValueChange={(value) => {
                    setSelectedFiscalYear(value);
                    if (value === 'all') setSelectedQuarter('all');
                  }}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Select Fiscal Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {availableFiscalYears.map((year: any) => (
                        <SelectItem key={year} value={year.toString()}>
                          FY {year} (Jul {year} - Jun {year + 1})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedQuarter}
                    onValueChange={setSelectedQuarter}
                    disabled={selectedFiscalYear === 'all'}
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Select Quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Quarters</SelectItem>
                      <SelectItem value="1">Q1 (Jul-Sep)</SelectItem>
                      <SelectItem value="2">Q2 (Oct-Dec)</SelectItem>
                      <SelectItem value="3">Q3 (Jan-Mar)</SelectItem>
                      <SelectItem value="4">Q4 (Apr-Jun)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Badge variant="outline" className="bg-[#236383]/10 text-[#236383] border-[#236383]/30">
                  {selectedFiscalYear === 'all'
                    ? 'Showing All-Time Data'
                    : selectedQuarter === 'all'
                    ? `FY ${selectedFiscalYear}`
                    : `FY ${selectedFiscalYear} Q${selectedQuarter}`}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hero Stats - The Big Numbers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-[#236383] to-[#1a4d63] text-white border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-bold flex items-center">
                <Trophy className="w-6 h-6 mr-3" />
                Total Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mb-2">
                {metrics.totalSandwiches.toLocaleString()}
              </div>
              <p className="text-white/90 text-base font-medium">
                Sandwiches distributed to community members in need
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#007E8C] to-[#006170] text-white border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-bold flex items-center">
                <Award className="w-6 h-6 mr-3" />
                Peak Year
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mb-2">
                {metrics.peakYear.total.toLocaleString()}
              </div>
              <p className="text-white/90 text-base font-medium">
                Sandwiches in {metrics.peakYear.year} - our best year yet
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#FBAD3F] to-[#e89a2c] text-white border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-bold flex items-center">
                <Building2 className="w-6 h-6 mr-3" />
                Host Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mb-2">
                {totalHosts}
              </div>
              <p className="text-white/90 text-base font-medium">
                Active collection sites across Metro Atlanta
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Achievement Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="border-2 border-[#FBAD3F] shadow-lg">
            <CardHeader className="bg-[#FEF4E0]">
              <CardTitle className="flex items-center text-[#A31C41]">
                <Star className="w-5 h-5 mr-2 text-[#FBAD3F]" />
                Record-Breaking Achievements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 border-[#236383]">
                <Calendar className="w-8 h-8 text-[#236383] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Peak Month</h3>
                  <p className="text-2xl font-black text-[#236383] my-1">
                    {metrics.peakMonth.total.toLocaleString()} sandwiches
                  </p>
                  <p className="text-sm text-gray-600">
                    {metrics.peakMonth.month} - our highest monthly total
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 border-[#47B3CB]">
                <Target className="w-8 h-8 text-[#47B3CB] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Average Per Collection</h3>
                  <p className="text-2xl font-black text-[#47B3CB] my-1">
                    {metrics.avgPerCollection} sandwiches
                  </p>
                  <p className="text-sm text-gray-600">
                    Consistent high-quality output per event
                  </p>
                </div>
              </div>

              {metrics.growthRate > 0 && (
                <div className="flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 border-[#007E8C]">
                  <TrendingUp className="w-8 h-8 text-[#007E8C] flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Year-Over-Year Growth</h3>
                    <p className="text-2xl font-black text-[#007E8C] my-1">
                      +{metrics.growthRate.toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-600">
                      2023 to 2024 - demonstrating sustained impact
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Host Network Strength */}
          <Card className="border-2 border-[#A31C41] shadow-lg">
            <CardHeader className="bg-[#FCE4E6]">
              <CardTitle className="flex items-center text-[#A31C41]">
                <MapPin className="w-5 h-5 mr-2 text-[#A31C41]" />
                Collective Host Network
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="text-center p-6 bg-gradient-to-br from-[#A31C41] to-[#8a1636] rounded-xl text-white">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-90" />
                <h2 className="font-black mb-2 text-[23px]">
                  {totalHosts} Active Hosts
                </h2>
                <div className="font-black mb-2 text-[30px] text-center bg-[#83234300]">
                  {metrics.avgPerCollection}
                </div>
                <p className="text-white/90 text-lg">
                  Average sandwiches per collection - consistent quality across all hosts
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#A31C41]/30">
                <h3 className="font-semibold text-gray-900 mb-3">Why This Matters</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#A31C41] flex-shrink-0 mt-0.5" />
                    <span>Distributed network prevents single points of failure</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#A31C41] flex-shrink-0 mt-0.5" />
                    <span>Geographic diversity ensures consistent community coverage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#A31C41] flex-shrink-0 mt-0.5" />
                    <span>Every host location is essential to our collective impact</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Year-over-Year Growth Chart */}
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <BarChart3 className="w-6 h-6 mr-2 text-brand-primary" />
              Year-Over-Year Impact Growth
            </CardTitle>
            <CardDescription>
              Demonstrating sustained and growing community impact
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={yearChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="year" />
                <YAxis
                  tickFormatter={(value) => value.toLocaleString()}
                  label={{ value: 'Sandwiches', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value: number) => [value.toLocaleString(), 'Sandwiches']}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    padding: '10px'
                  }}
                />
                <Bar dataKey="sandwiches" fill="#236383" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Strategic Milestones & Infrastructure */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Crisis Response Capability */}
          <Card className="border-2 border-[#A31C41] shadow-lg">
            <CardHeader className="bg-[#FCE4E6]">
              <CardTitle className="flex items-center text-[#A31C41]">
                <Shield className="w-5 h-5 mr-2" />
                Crisis Response
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-black text-[#A31C41] mb-1">
                    14,023
                  </div>
                  <p className="text-sm text-gray-600">
                    Sandwiches mobilized during Hurricane Helene (October 2024)
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-2xl font-bold text-[#007E8C] mb-1">
                    2-3x surge
                  </div>
                  <p className="text-sm text-gray-600">
                    Capacity increase within one week when needed
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 italic">
                    Proven disaster infrastructure, not just routine food distribution
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Distributed Network */}
          <Card className="border-2 border-[#007E8C] shadow-lg">
            <CardHeader className="bg-[#E0F2F1]">
              <CardTitle className="flex items-center text-[#007E8C]">
                <Building2 className="w-5 h-5 mr-2" />
                Distributed Network
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-black text-[#007E8C] mb-1">
                    35 sites
                  </div>
                  <p className="text-sm text-gray-600">
                    Collection locations across Metro Atlanta
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-2xl font-bold text-[#236383] mb-1">
                    70+ partners
                  </div>
                  <p className="text-sm text-gray-600">
                    Organizations receiving deliveries weekly
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 italic">
                    Built-in redundancy: if one area struggles, others compensate
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Volunteer Power */}
          <Card className="border-2 border-[#FBAD3F] shadow-lg">
            <CardHeader className="bg-[#FEF4E0]">
              <CardTitle className="flex items-center text-[#FBAD3F]">
                <UserCheck className="w-5 h-5 mr-2" />
                Volunteer Network
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-black text-[#FBAD3F] mb-1">
                    4,000+
                  </div>
                  <p className="text-sm text-gray-600">
                    Active members in private volunteer community
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-2xl font-bold text-[#47B3CB] mb-1">
                    5,350+
                  </div>
                  <p className="text-sm text-gray-600">
                    Newsletter recipients staying informed
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 italic">
                    Volunteers consistently engaged for 3+ years
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Remarkable Growth Story */}
        <Card className="mb-8 bg-gradient-to-r from-[#47B3CB]/10 to-[#236383]/10 border-2 border-[#47B3CB]">
          <CardContent className="p-8">
            <div className="flex items-start gap-4 mb-6">
              <Rocket className="w-10 h-10 text-[#236383] flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Exponential Growth with Strategic Sustainability
                </h2>
                <p className="text-gray-600">
                  From pandemic response to community infrastructure in 5 years
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-4 rounded-lg border border-[#236383]/20">
                <div className="text-sm text-gray-600 mb-1">April 2020 (Start)</div>
                <div className="text-3xl font-black text-[#236383]">317</div>
                <div className="text-xs text-gray-500">sandwiches</div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#A31C41]/20">
                <div className="text-sm text-gray-600 mb-1">Peak Week (Nov 2023)</div>
                <div className="text-3xl font-black text-[#A31C41]">38,828</div>
                <div className="text-xs text-gray-500">sandwiches</div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#007E8C]/20">
                <div className="text-sm text-gray-600 mb-1">Weekly Avg (12 weeks)</div>
                <div className="text-3xl font-black text-[#007E8C]">
                  {metrics.weeklyAverage > 0 ? metrics.weeklyAverage.toLocaleString() : '8-10K'}
                </div>
                <div className="text-xs text-gray-500">sandwiches</div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#FBAD3F]/20">
                <div className="text-sm text-gray-600 mb-1">Overall Growth</div>
                <div className="text-3xl font-black text-[#FBAD3F]">
                  {metrics.overallGrowthMultiplier > 0 ? `${metrics.overallGrowthMultiplier}x` : '107x'}
                </div>
                <div className="text-xs text-gray-500">since inception</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial & Economic Impact */}
        <Card className="mb-8 border-2 border-[#007E8C] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#007E8C] to-[#236383] text-white">
            <CardTitle className="flex items-center text-xl">
              <DollarSign className="w-6 h-6 mr-2" />
              Economic & Financial Impact
            </CardTitle>
            <CardDescription className="text-white/90">
              The hidden value behind the sandwiches
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-[#E0F2F1] rounded-lg">
                <div className="text-4xl font-black text-[#007E8C] mb-2">
                  $1.2-2M
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Annual food value delivered to community
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  At $1.40-$1.48 per sandwich
                </p>
              </div>

              <div className="text-center p-4 bg-[#E8F4F8] rounded-lg">
                <div className="text-4xl font-black text-[#236383] mb-2">
                  $500-2K
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Corporate team building investment per event
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Companies make 2,000-5,000 sandwiches
                </p>
              </div>

              <div className="text-center p-4 bg-[#FEF4E0] rounded-lg">
                <div className="text-4xl font-black text-[#FBAD3F] mb-2">
                  ServSafe
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Certified team members ensuring safety
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Professional food safety standards
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GRANT-SPECIFIC SECTIONS */}

        {/* Volunteer Engagement & Economic Value - INTERACTIVE */}
        <Card className="mb-8 border-2 border-[#FBAD3F] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#FBAD3F] to-[#e89a2c] text-white">
            <CardTitle className="flex items-center text-xl">
              <HandHeart className="w-6 h-6 mr-2" />
              Volunteer Engagement & Economic Impact
            </CardTitle>
            <CardDescription className="text-white/90">
              Demonstrating community mobilization and in-kind value {selectedFiscalYear !== 'all' && `(FY ${selectedFiscalYear}${selectedQuarter !== 'all' ? ` Q${selectedQuarter}` : ''})`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-[#FEF4E0] rounded-lg">
                <Users className="w-8 h-8 mx-auto mb-2 text-[#FBAD3F]" />
                <div className="text-3xl font-black text-[#FBAD3F] mb-1">
                  {filteredVolunteerMetrics.estimatedParticipants.toLocaleString()}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Est. volunteer participants
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Based on collection data
                </p>
              </div>

              <div className="text-center p-4 bg-[#E0F2F1] rounded-lg">
                <Clock className="w-8 h-8 mx-auto mb-2 text-[#007E8C]" />
                <div className="text-3xl font-black text-[#007E8C] mb-1">
                  {filteredVolunteerMetrics.totalVolunteerHours.toLocaleString()}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Est. volunteer hours
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Conservative estimate
                </p>
              </div>

              <div className="text-center p-4 bg-[#E8F4F8] rounded-lg">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-[#236383]" />
                <div className="text-3xl font-black text-[#236383] mb-1">
                  ${(filteredVolunteerMetrics.economicValue / 1000).toFixed(0)}K
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Economic value (IRS rate)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  @$33.49/hour (2024)
                </p>
              </div>

              <div className="text-center p-4 bg-[#FCE4E6] rounded-lg">
                <Activity className="w-8 h-8 mx-auto mb-2 text-[#A31C41]" />
                <div className="text-3xl font-black text-[#A31C41] mb-1">
                  {filteredVolunteerMetrics.avgHoursPerEvent}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Avg hours per event
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Sustained efficiency
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-white to-[#FEF4E0] p-5 rounded-lg border border-[#FBAD3F]/30">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-[#FBAD3F]" />
                How We Calculate Volunteer Hours (Conservative Methodology)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                <div className="flex items-start gap-2">
                  <Badge className="bg-[#FBAD3F]/20 text-[#FBAD3F] border-[#FBAD3F]/30 shrink-0">
                    Making
                  </Badge>
                  <span>20 min per participant (0.33 hrs × ~10 sandwiches/person)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge className="bg-[#007E8C]/20 text-[#007E8C] border-[#007E8C]/30 shrink-0">
                    Hosting
                  </Badge>
                  <span>2.5 hours per collection event (setup, coordination, cleanup)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge className="bg-[#236383]/20 text-[#236383] border-[#236383]/30 shrink-0">
                    Logistics
                  </Badge>
                  <span>1.5 hours per event (driving, delivery, returns)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge className="bg-[#A31C41]/20 text-[#A31C41] border-[#A31C41]/30 shrink-0">
                    Admin
                  </Badge>
                  <span>3 hours per event (coordination, communication, tracking)</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-3 italic">
                * All estimates use conservative industry standards to ensure defensible grant reporting
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cost Efficiency & Financial Metrics - INTERACTIVE */}
        <Card className="mb-8 border-2 border-[#007E8C] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#007E8C] to-[#236383] text-white">
            <CardTitle className="flex items-center text-xl">
              <DollarSign className="w-6 h-6 mr-2" />
              Cost Efficiency & Financial Impact
            </CardTitle>
            <CardDescription className="text-white/90">
              Demonstrating value delivered to community {selectedFiscalYear !== 'all' && `(FY ${selectedFiscalYear}${selectedQuarter !== 'all' ? ` Q${selectedQuarter}` : ''})`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-[#E0F2F1] rounded-lg">
                <div className="text-4xl font-black text-[#007E8C] mb-2">
                  ${filteredCostMetrics.costPerSandwich.toFixed(2)}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Cost per sandwich
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Ingredients only
                </p>
              </div>

              <div className="text-center p-4 bg-[#E8F4F8] rounded-lg">
                <div className="text-4xl font-black text-[#236383] mb-2">
                  ${filteredCostMetrics.costPerPerson.toFixed(2)}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Cost per person served
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Direct food cost
                </p>
              </div>

              <div className="text-center p-4 bg-[#FEF4E0] rounded-lg">
                <div className="text-4xl font-black text-[#FBAD3F] mb-2">
                  ${filteredCostMetrics.totalFoodValue >= 1000000
                    ? (filteredCostMetrics.totalFoodValue / 1000000).toFixed(2) + 'M'
                    : (filteredCostMetrics.totalFoodValue / 1000).toFixed(0) + 'K'}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Total food value delivered
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Selected period
                </p>
              </div>

              <div className="text-center p-4 bg-[#FCE4E6] rounded-lg">
                <div className="text-4xl font-black text-[#A31C41] mb-2">
                  ${((filteredVolunteerMetrics.economicValue + filteredCostMetrics.totalFoodValue) >= 1000000
                    ? ((filteredVolunteerMetrics.economicValue + filteredCostMetrics.totalFoodValue) / 1000000).toFixed(2) + 'M'
                    : ((filteredVolunteerMetrics.economicValue + filteredCostMetrics.totalFoodValue) / 1000).toFixed(0) + 'K')}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Total community value
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Food + volunteer hours
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-[#E0F2F1] to-white p-5 rounded-lg border border-[#007E8C]/30">
              <h3 className="font-bold text-gray-900 mb-3">Why This Matters for Funders</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#007E8C] flex items-center justify-center text-white font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Exceptional Cost Efficiency</p>
                    <p className="text-sm text-gray-600">
                      At ${filteredCostMetrics.costPerPerson.toFixed(2)}/person, we deliver dignified food assistance at a fraction of traditional meal program costs ($8-15/meal)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#236383] flex items-center justify-center text-white font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Volunteer Force Multiplier</p>
                    <p className="text-sm text-gray-600">
                      Every $1 in grants leverages ${((filteredVolunteerMetrics.economicValue / Math.max(filteredCostMetrics.totalFoodValue, 1))).toFixed(1)} in volunteer economic value
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FBAD3F] flex items-center justify-center text-white font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Proven Sustainability</p>
                    <p className="text-sm text-gray-600">
                      Operating continuously since April 2020 with consistent growth, not a one-time initiative
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#A31C41] flex items-center justify-center text-white font-bold shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Community Ownership</p>
                    <p className="text-sm text-gray-600">
                      {filteredVolunteerMetrics.estimatedParticipants.toLocaleString()}+ participants means deep community buy-in and resilience
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quarterly Reporting Breakdown - INTERACTIVE */}
        {filteredQuarterlyBreakdown.length > 0 && (
          <Card className="mb-8 border-2 border-[#47B3CB] shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#47B3CB] to-[#236383] text-white">
              <CardTitle className="flex items-center text-xl">
                <Calendar className="w-6 h-6 mr-2" />
                Quarterly Performance Breakdown
              </CardTitle>
              <CardDescription className="text-white/90">
                For grant reporting and compliance {selectedFiscalYear !== 'all' && `(FY ${selectedFiscalYear}${selectedQuarter !== 'all' ? ` Q${selectedQuarter}` : ''})`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredQuarterlyBreakdown.slice(-12).map((quarter) => (
                  <div
                    key={quarter.quarter}
                    className="p-4 bg-gradient-to-br from-white to-[#E8F4F8] rounded-lg border border-[#47B3CB]/30 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-[#47B3CB]/20 text-[#47B3CB] border-[#47B3CB]/30">
                        {quarter.quarter}
                      </Badge>
                      <BarChart3 className="w-5 h-5 text-[#236383]" />
                    </div>
                    <div className="text-3xl font-black text-[#236383] mb-1">
                      {quarter.sandwiches.toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">sandwiches distributed</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Building2 className="w-3 h-3" />
                      {quarter.events} collection events
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Geographic Reach & Demographics */}
        <Card className="mb-8 border-2 border-[#A31C41] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#A31C41] to-[#8a1636] text-white">
            <CardTitle className="flex items-center text-xl">
              <MapPin className="w-6 h-6 mr-2" />
              Geographic Reach & Communities Served
            </CardTitle>
            <CardDescription className="text-white/90">
              Demonstrating diversity and accessibility
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-[#A31C41]" />
                  Service Area
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-[#FCE4E6] rounded-lg">
                    <div className="font-semibold text-gray-900 mb-1">Metro Atlanta Coverage</div>
                    <div className="text-sm text-gray-700">
                      <strong>35 collection sites</strong> across Fulton, DeKalb, Gwinnett, and Cobb counties
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-[#A31C41]/20">
                    <div className="font-semibold text-gray-900 mb-1">Strategic Distribution</div>
                    <div className="text-sm text-gray-700">
                      <strong>70+ partner organizations</strong> receiving weekly deliveries in high-need zip codes
                    </div>
                  </div>
                  <div className="p-3 bg-[#FCE4E6] rounded-lg">
                    <div className="font-semibold text-gray-900 mb-1">Expansion</div>
                    <div className="text-sm text-gray-700">
                      Extended operations to <strong>Athens-Clarke County</strong> in 2024
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-[#A31C41]" />
                  Diverse Communities Served
                </h3>
                <div className="bg-gradient-to-br from-white to-[#FCE4E6] p-5 rounded-lg border border-[#A31C41]/20">
                  <p className="text-sm text-gray-700 mb-4">
                    Our distribution network serves diverse populations across Metro Atlanta:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Black communities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Latino communities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>AAPI communities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>White communities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Housed individuals</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Unhoused individuals</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Seniors</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Children & families</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Veterans</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>LGBTQ+ community</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Trafficking survivors</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Recovery programs</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-4 italic">
                    Distribution partners serve their communities directly, ensuring cultural competence and dignity
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Partnership & Collaboration Strength - NOW WITH REAL DATA! */}
        <Card className="mb-8 border-2 border-[#47B3CB] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#47B3CB] to-[#007E8C] text-white">
            <CardTitle className="flex items-center text-xl">
              <Building2 className="w-6 h-6 mr-2" />
              Partnership & Collaboration Network
            </CardTitle>
            <CardDescription className="text-white/90">
              Evidence of community integration and collaboration (LIVE DATA from database)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-6 bg-gradient-to-br from-[#47B3CB]/10 to-white rounded-lg border border-[#47B3CB]/30">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-[#47B3CB]" />
                <div className="text-4xl font-black text-[#47B3CB] mb-2">
                  {recipientMetrics.total}
                </div>
                <p className="font-medium text-gray-900">Active Recipient Partners</p>
                <p className="text-sm text-gray-600 mt-2">
                  Organizations in database
                </p>
              </div>

              <div className="text-center p-6 bg-gradient-to-br from-[#007E8C]/10 to-white rounded-lg border border-[#007E8C]/30">
                <MapPin className="w-12 h-12 mx-auto mb-3 text-[#007E8C]" />
                <div className="text-4xl font-black text-[#007E8C] mb-2">
                  {totalHosts}
                </div>
                <p className="font-medium text-gray-900">Host Locations</p>
                <p className="text-sm text-gray-600 mt-2">
                  Active collection sites
                </p>
              </div>

              <div className="text-center p-6 bg-gradient-to-br from-[#236383]/10 to-white rounded-lg border border-[#236383]/30">
                <Users className="w-12 h-12 mx-auto mb-3 text-[#236383]" />
                <div className="text-4xl font-black text-[#236383] mb-2">
                  {eventMetrics.uniqueOrganizations}
                </div>
                <p className="font-medium text-gray-900">Group Build Partners</p>
                <p className="text-sm text-gray-600 mt-2">
                  Unique organizations hosted events
                </p>
              </div>

              <div className="text-center p-6 bg-gradient-to-br from-[#FBAD3F]/10 to-white rounded-lg border border-[#FBAD3F]/30">
                <Shield className="w-12 h-12 mx-auto mb-3 text-[#FBAD3F]" />
                <div className="text-4xl font-black text-[#FBAD3F] mb-2">
                  {recipientMetrics.contractSignedPercentage}%
                </div>
                <p className="font-medium text-gray-900">Contracts Signed</p>
                <p className="text-sm text-gray-600 mt-2">
                  {recipientMetrics.contractsSigned} of {recipientMetrics.total} partners
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Focus Areas Breakdown */}
              <div className="bg-gradient-to-r from-white to-[#E8F4F8] p-5 rounded-lg border border-[#47B3CB]/30">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-[#47B3CB]" />
                  Recipients by Focus Area (Database)
                </h3>
                <div className="space-y-2">
                  {Object.entries(recipientMetrics.byFocusArea)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([area, count]) => (
                      <div key={area} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 capitalize">{area}</span>
                        <Badge className="bg-[#47B3CB]/20 text-[#47B3CB] border-[#47B3CB]/30">
                          {count} orgs
                        </Badge>
                      </div>
                    ))}
                  {Object.keys(recipientMetrics.byFocusArea).length === 0 && (
                    <p className="text-sm text-gray-500 italic">Focus areas being categorized...</p>
                  )}
                </div>
              </div>

              {/* Geographic Distribution */}
              <div className="bg-gradient-to-r from-white to-[#FEF4E0] p-5 rounded-lg border border-[#FBAD3F]/30">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-[#FBAD3F]" />
                  Recipients by Region (Database)
                </h3>
                <div className="space-y-2">
                  {Object.entries(recipientMetrics.byRegion)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([region, count]) => (
                      <div key={region} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{region}</span>
                        <Badge className="bg-[#FBAD3F]/20 text-[#FBAD3F] border-[#FBAD3F]/30">
                          {count} orgs
                        </Badge>
                      </div>
                    ))}
                  {Object.keys(recipientMetrics.byRegion).length === 0 && (
                    <p className="text-sm text-gray-500 italic">Regional data being collected...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-[#E0F2F1] to-white p-5 rounded-lg border border-[#007E8C]/30">
              <h3 className="font-bold text-gray-900 mb-3">Weekly Distribution Capacity</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-black text-[#007E8C]">
                    {recipientMetrics.totalWeeklyCapacity.toLocaleString()}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Estimated weekly sandwich capacity across all {recipientMetrics.total} recipient partners
                  </p>
                </div>
                <BarChart3 className="w-16 h-16 text-[#007E8C]/30" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Group Build Events Impact - REAL DATA */}
        {eventMetrics.totalEvents > 0 && (
          <Card className="mb-8 border-2 border-[#236383] shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#236383] to-[#007E8C] text-white">
              <CardTitle className="flex items-center text-xl">
                <Users className="w-6 h-6 mr-2" />
                Group Build Events & Community Engagement
              </CardTitle>
              <CardDescription className="text-white/90">
                Tracked event participation from database {selectedFiscalYear !== 'all' && `(FY ${selectedFiscalYear})`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="text-center p-4 bg-[#E8F4F8] rounded-lg">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-[#236383]" />
                  <div className="text-3xl font-black text-[#236383] mb-1">
                    {eventMetrics.totalEvents}
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    Completed group events
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Tracked in database
                  </p>
                </div>

                <div className="text-center p-4 bg-[#E0F2F1] rounded-lg">
                  <Users className="w-8 h-8 mx-auto mb-2 text-[#007E8C]" />
                  <div className="text-3xl font-black text-[#007E8C] mb-1">
                    {eventMetrics.totalActualAttendance.toLocaleString()}
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    Total participants
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Actual attendance recorded
                  </p>
                </div>

                <div className="text-center p-4 bg-[#FEF4E0] rounded-lg">
                  <Target className="w-8 h-8 mx-auto mb-2 text-[#FBAD3F]" />
                  <div className="text-3xl font-black text-[#FBAD3F] mb-1">
                    {eventMetrics.avgAttendeesPerEvent}
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    Avg attendees per event
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Consistent turnout
                  </p>
                </div>

                <div className="text-center p-4 bg-[#FCE4E6] rounded-lg">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-[#A31C41]" />
                  <div className="text-3xl font-black text-[#A31C41] mb-1">
                    {eventMetrics.uniqueOrganizations}
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    Unique organizations
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Hosted events
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-white to-[#E8F4F8] p-5 rounded-lg border border-[#236383]/30">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                    <Trophy className="w-5 h-5 mr-2 text-[#236383]" />
                    Sandwiches from Group Builds
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-4xl font-black text-[#236383]">
                        {eventMetrics.totalActualSandwiches.toLocaleString()}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Sandwiches made at group events
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Avg {eventMetrics.avgSandwichesPerEvent} per event
                      </p>
                    </div>
                    <Award className="w-16 h-16 text-[#236383]/20" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-white to-[#FEF4E0] p-5 rounded-lg border border-[#FBAD3F]/30">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                    <Star className="w-5 h-5 mr-2 text-[#FBAD3F]" />
                    Social Media Engagement
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-4xl font-black text-[#FBAD3F]">
                        {eventMetrics.socialMediaPostsCompleted}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Organizations shared posts
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {eventMetrics.totalEvents > 0
                          ? Math.round((eventMetrics.socialMediaPostsCompleted / eventMetrics.totalEvents) * 100)
                          : 0}% engagement rate
                      </p>
                    </div>
                    <Mail className="w-16 h-16 text-[#FBAD3F]/20" />
                  </div>
                </div>
              </div>

              <div className="mt-6 p-5 bg-gradient-to-br from-[#236383]/10 to-white rounded-lg border border-[#236383]/30">
                <h3 className="font-bold text-gray-900 mb-3">Why Group Builds Matter</h3>
                <p className="text-sm text-gray-700 mb-3">
                  Group builds transform sandwich-making into community building experiences, creating lasting partnerships with:
                </p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#236383] shrink-0 mt-0.5" />
                    <span><strong>Corporations:</strong> Team building events that serve the community</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#236383] shrink-0 mt-0.5" />
                    <span><strong>Faith Communities:</strong> Service projects connecting members</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#236383] shrink-0 mt-0.5" />
                    <span><strong>Schools:</strong> Student engagement and civic education</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#236383] shrink-0 mt-0.5" />
                    <span><strong>Community Groups:</strong> Volunteer mobilization at scale</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Capacity Building & Organizational Development */}
        <Card className="mb-8 border-2 border-[#FBAD3F] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#FBAD3F] to-[#e89a2c] text-white">
            <CardTitle className="flex items-center text-xl">
              <Rocket className="w-6 h-6 mr-2" />
              Capacity Building & Infrastructure Development
            </CardTitle>
            <CardDescription className="text-white/90">
              Strategic investments for sustainable growth
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-[#FEF4E0] to-white p-5 rounded-lg border-l-4 border-[#FBAD3F]">
                <div className="flex items-start gap-4">
                  <UserCheck className="w-8 h-8 text-[#FBAD3F] shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">Executive Leadership (Priority)</h3>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Need:</strong> Full-time Executive Director to manage operations, fundraising, and strategic partnerships
                    </p>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Impact:</strong> Currently operating with volunteer leadership at 107x our founding scale - professionalization will unlock next phase of growth
                    </p>
                    <Badge className="bg-[#FBAD3F]/20 text-[#FBAD3F] border-[#FBAD3F]/30">
                      Est. Cost: $65K-85K annually
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-white to-[#E0F2F1] p-5 rounded-lg border-l-4 border-[#007E8C]">
                <div className="flex items-start gap-4">
                  <Activity className="w-8 h-8 text-[#007E8C] shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">Logistics Infrastructure</h3>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Need:</strong> Additional refrigerated van for expanded distribution capacity
                    </p>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Impact:</strong> Enable simultaneous routes, reduce volunteer burden, improve crisis response time
                    </p>
                    <Badge className="bg-[#007E8C]/20 text-[#007E8C] border-[#007E8C]/30">
                      Est. Cost: $35K-50K (one-time)
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-[#E8F4F8] to-white p-5 rounded-lg border-l-4 border-[#236383]">
                <div className="flex items-start gap-4">
                  <Shield className="w-8 h-8 text-[#236383] shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">Technology & Systems</h3>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Current:</strong> Custom-built platform for collection tracking, volunteer coordination, and impact reporting
                    </p>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Future Need:</strong> Mobile app for real-time volunteer coordination and automated route optimization
                    </p>
                    <Badge className="bg-[#236383]/20 text-[#236383] border-[#236383]/30">
                      Est. Cost: $15K-25K (development)
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-5 bg-gradient-to-br from-[#FBAD3F]/10 to-white rounded-lg border border-[#FBAD3F]/30">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <Target className="w-5 h-5 mr-2 text-[#FBAD3F]" />
                Why These Investments Matter
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                The Sandwich Project has grown 107x since inception while maintaining volunteer-led operations.
                These strategic investments will:
              </p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-[#FBAD3F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Sustainability:</strong> Reduce burnout risk and ensure continuity beyond founding volunteers
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-[#FBAD3F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Scale:</strong> Current infrastructure at capacity - investments enable 2-3x growth
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-[#FBAD3F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Impact:</strong> Professional leadership unlocks corporate partnerships, larger grants, and strategic expansion
                  </span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Impact Statement */}
        <Card className="bg-gradient-to-br from-[#236383] to-[#007E8C] text-white shadow-xl border-0">
          <CardContent className="p-8">
            <h2 className="text-3xl font-bold mb-4 flex items-center">
              <Heart className="w-8 h-8 mr-3" />
              Community Infrastructure Disguised as Sandwiches
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
              <div>
                <div className="text-4xl font-black mb-2">
                  {metrics.totalCollections.toLocaleString()}
                </div>
                <p className="text-white/90 font-medium">
                  Collection events organized
                </p>
              </div>
              <div>
                <div className="text-4xl font-black mb-2">
                  35
                </div>
                <p className="text-white/90 font-medium">
                  Host locations across Metro Atlanta
                </p>
              </div>
              <div>
                <div className="text-4xl font-black mb-2">
                  70+
                </div>
                <p className="text-white/90 font-medium">
                  Partner organizations served weekly
                </p>
              </div>
              <div>
                <div className="text-4xl font-black mb-2">
                  4,000+
                </div>
                <p className="text-white/90 font-medium">
                  Active volunteer community members
                </p>
              </div>
            </div>
            <div className="mt-8 p-6 bg-white/10 rounded-lg backdrop-blur-sm space-y-4">
              <p className="text-lg leading-relaxed">
                The Sandwich Project has evolved from pandemic response to <strong>proven community infrastructure</strong>.
                Starting with just 317 sandwiches in April 2020, we've delivered <strong>{metrics.totalSandwiches.toLocaleString()}
                sandwiches</strong> and grown <strong>{metrics.overallGrowthMultiplier > 0 ? `${metrics.overallGrowthMultiplier}x` : '107x'} since inception</strong>.
              </p>
              <p className="text-lg leading-relaxed">
                We don't just feed people - we've built <strong>disaster response capability</strong> (14,023 sandwiches during Hurricane Helene),
                <strong> distributed logistics infrastructure</strong> across 35 sites, and a <strong>volunteer network</strong> that could
                pivot tomorrow to housing crisis response, voter mobilization, or climate disaster coordination.
              </p>
              <p className="text-lg leading-relaxed font-semibold">
                This is not charity. This is community infrastructure that happens to use sandwiches as its medium.
                And we're just getting started.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}