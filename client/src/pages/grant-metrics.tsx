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
        yearTotals: { 2023: 0, 2024: 0, 2025: 0 },
        peakYear: { year: 2024, total: 0 },
        peakMonth: { month: '', total: 0, year: 0 },
        longestStreak: 0,
        avgPerCollection: 0,
        topHost: { name: '', total: 0 },
        growthRate: 0,
      };
    }

    const hostData: Record<string, number> = {};
    const monthlyData: Record<string, number> = {};
    const yearTotals = { 2023: 0, 2024: 0, 2025: 0 };
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

          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + total;

          if (yearTotals[year] !== undefined) {
            yearTotals[year] += total;
          }
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

    // Find top host
    const topHostEntry = Object.entries(hostData)
      .reduce((max, [name, total]) => total > max.total ? { name, total } : max, { name: '', total: 0 });

    // Calculate growth rate (2023 to 2024)
    const growthRate = yearTotals[2023] > 0
      ? ((yearTotals[2024] - yearTotals[2023]) / yearTotals[2023]) * 100
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
      monthlyData,
    };
  };

  const metrics = calculateGrantMetrics();

  // Prepare year-over-year chart data
  const yearChartData = [
    { year: '2023', sandwiches: metrics.yearTotals[2023] },
    { year: '2024', sandwiches: metrics.yearTotals[2024] },
    { year: '2025 YTD', sandwiches: metrics.yearTotals[2025] },
  ];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-lg">
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
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0 shadow-xl">
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
              <p className="text-blue-100 text-base font-medium">
                Sandwiches distributed to community members in need
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-teal-600 to-teal-700 text-white border-0 shadow-xl">
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
              <p className="text-teal-100 text-base font-medium">
                Sandwiches in {metrics.peakYear.year} - our best year yet
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-xl">
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
              <p className="text-orange-100 text-base font-medium">
                Active host locations supporting our mission
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Achievement Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="border-2 border-yellow-400 shadow-lg">
            <CardHeader className="bg-yellow-50">
              <CardTitle className="flex items-center text-yellow-900">
                <Star className="w-5 h-5 mr-2 text-yellow-600" />
                Record-Breaking Achievements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 border-blue-500">
                <Calendar className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Peak Month</h3>
                  <p className="text-2xl font-black text-blue-600 my-1">
                    {metrics.peakMonth.total.toLocaleString()} sandwiches
                  </p>
                  <p className="text-sm text-gray-600">
                    {metrics.peakMonth.month} - our highest monthly total
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 border-purple-500">
                <Target className="w-8 h-8 text-purple-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Average Per Collection</h3>
                  <p className="text-2xl font-black text-purple-600 my-1">
                    {metrics.avgPerCollection} sandwiches
                  </p>
                  <p className="text-sm text-gray-600">
                    Consistent high-quality output per event
                  </p>
                </div>
              </div>

              {metrics.growthRate > 0 && (
                <div className="flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 border-green-500">
                  <TrendingUp className="w-8 h-8 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Year-Over-Year Growth</h3>
                    <p className="text-2xl font-black text-green-600 my-1">
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
          <Card className="border-2 border-indigo-400 shadow-lg">
            <CardHeader className="bg-indigo-50">
              <CardTitle className="flex items-center text-indigo-900">
                <Trophy className="w-5 h-5 mr-2 text-indigo-600" />
                Top Performing Partner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="text-center p-6 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl text-white">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-90" />
                <h2 className="text-3xl font-black mb-2">
                  {metrics.topHost.name}
                </h2>
                <div className="text-4xl font-black mb-2">
                  {metrics.topHost.total.toLocaleString()}
                </div>
                <p className="text-indigo-100 text-lg">
                  Total sandwiches contributed - our #1 partner
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-indigo-200">
                <h3 className="font-semibold text-gray-900 mb-3">Why This Matters</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <span>Strong partnership model driving consistent results</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <span>Proven scalability through successful host relationships</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
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

        {/* Impact Statement */}
        <Card className="bg-gradient-to-br from-brand-primary to-[#007E8C] text-white shadow-xl border-0">
          <CardContent className="p-8">
            <h2 className="text-3xl font-bold mb-4 flex items-center">
              <Heart className="w-8 h-8 mr-3" />
              Our Proven Impact Model
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div>
                <div className="text-4xl font-black mb-2">
                  {metrics.totalCollections.toLocaleString()}
                </div>
                <p className="text-white/90 font-medium">
                  Total collection events organized and executed
                </p>
              </div>
              <div>
                <div className="text-4xl font-black mb-2">
                  {metrics.uniqueHosts}
                </div>
                <p className="text-white/90 font-medium">
                  Community partners actively engaged in our mission
                </p>
              </div>
              <div>
                <div className="text-4xl font-black mb-2">
                  {metrics.avgPerCollection}
                </div>
                <p className="text-white/90 font-medium">
                  Average sandwiches per event - consistent quality delivery
                </p>
              </div>
            </div>
            <div className="mt-8 p-6 bg-white/10 rounded-lg backdrop-blur-sm">
              <p className="text-lg leading-relaxed">
                The Sandwich Project has demonstrated sustained, measurable impact in addressing food insecurity
                through our innovative community partnership model. With <strong>{metrics.totalSandwiches.toLocaleString()}
                sandwiches delivered</strong> and a proven track record of growth, we provide a scalable solution
                that engages volunteers, supports community partnerships, and directly serves those in need.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}