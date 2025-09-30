import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  });

  const collections = collectionsData?.collections || [];

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['/api/sandwich-collections/stats'],
  });

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
      const total = calculateTotalSandwiches(collection);
      const hostName = collection.hostName || 'Unknown';

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

  const metrics = calculateGrantMetrics();

  // Prepare year-over-year chart data
  const yearChartData = [
    { year: '2023', sandwiches: metrics.yearTotals[2023] || 0 },
    { year: '2024', sandwiches: metrics.yearTotals[2024] || 0 },
    { year: '2025 YTD', sandwiches: metrics.yearTotals[2025] || 0 },
  ];

  return (
    <div className="bg-gradient-to-br from-[#E8F4F8] to-[#F0F9FB] p-6 rounded-lg">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Grant Metrics & Impact Showcase
          </h1>
          <p className="text-lg text-gray-600">
            Highlighting our community impact for donors, grants, and partnerships
          </p>
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
                <Users className="w-6 h-6 mr-3" />
                Community Partners
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mb-2">
                {metrics.uniqueHosts}
              </div>
              <p className="text-white/90 text-base font-medium">
                Active host locations supporting our mission
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

          {/* Top Performer */}
          <Card className="border-2 border-[#A31C41] shadow-lg">
            <CardHeader className="bg-[#FCE4E6]">
              <CardTitle className="flex items-center text-[#A31C41]">
                <Trophy className="w-5 h-5 mr-2 text-[#A31C41]" />
                Top Performing Partner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="text-center p-6 bg-gradient-to-br from-[#A31C41] to-[#8a1636] rounded-xl text-white">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-90" />
                <h2 className="text-3xl font-black mb-2">
                  {metrics.topHost.name}
                </h2>
                <div className="text-4xl font-black mb-2">
                  {metrics.topHost.total.toLocaleString()}
                </div>
                <p className="text-white/90 text-lg">
                  Total sandwiches contributed - our #1 partner
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#A31C41]/30">
                <h3 className="font-semibold text-gray-900 mb-3">Why This Matters</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#A31C41] flex-shrink-0 mt-0.5" />
                    <span>Strong partnership model driving consistent results</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#A31C41] flex-shrink-0 mt-0.5" />
                    <span>Proven scalability through successful host relationships</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#A31C41] flex-shrink-0 mt-0.5" />
                    <span>Community engagement model with measurable outcomes</span>
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

            <div className="mt-6 p-4 bg-white/60 rounded-lg">
              <div className="flex items-start gap-3">
                <Star className="w-5 h-5 text-[#FBAD3F] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  <strong>Strategic Wisdom:</strong> In 2023, we deliberately decreased production from 464K to 426K
                  to find sustainable levels, then stabilized at ~450K annually. We chose long-term sustainability over ego-driven growth.
                </p>
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