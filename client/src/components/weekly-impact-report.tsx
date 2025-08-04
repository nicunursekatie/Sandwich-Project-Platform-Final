import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CalendarDays,
  Download,
  FileText,
  TrendingUp,
  Users,
  MapPin,
  Award,
  AlertTriangle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Calendar,
  Target,
  Clock,
  Star
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface WeeklyReportData {
  report_date: string;
  collection_week: {
    start: string;
    end: string;
  };
  summary: {
    total_sandwiches: number;
    active_locations: number;
    total_locations: number;
    participation_rate: number;
    week_over_week_change: number;
    monthly_progress: {
      current: number;
      goal: number;
      percentage: number;
    };
  };
  metrics_table: {
    total_sandwiches: { this_week: number; last_week: number; change: number; four_week_avg: number };
    locations_participating: { this_week: number; last_week: number; change: number; four_week_avg: number };
    avg_per_location: { this_week: number; last_week: number; change: number; four_week_avg: number };
    group_collections: { this_week: number; last_week: number; change: number; four_week_avg: number };
  };
  locations: Array<{
    name: string;
    individual: number;
    group: number;
    total: number;
    trend: 'up' | 'down' | 'stable';
    status: 'high_performer' | 'needs_attention' | 'steady_contributor';
    issues?: string[];
  }>;
  trends_insights: {
    patterns: string[];
    seasonal_impacts: string[];
    special_events: string[];
    month_over_month_chart_data: Array<{ month: string; total: number }>;
  };
  next_week_prep: {
    host_confirmations: {
      confirmed: number;
      total: number;
      percentage: number;
    };
    pending_actions: string[];
    known_events: string[];
    weather_forecast: string;
    volunteer_status: string;
  };
  success_celebration: {
    milestones: string[];
    volunteer_spotlight?: {
      name: string;
      contribution: string;
    };
    impact_story?: {
      quote: string;
      attribution: string;
    };
  };
}

export default function WeeklyImpactReport() {
  const { toast } = useToast();
  const [weekEndingDate, setWeekEndingDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null);

  // Generate weekly impact report
  const generateReportMutation = useMutation({
    mutationFn: async (weekEnding: string) => {
      return apiRequest("POST", "/api/reports/weekly-impact", { weekEndingDate: weekEnding });
    },
    onSuccess: (data) => {
      setReportData(data.data);
      toast({
        title: "Report Generated",
        description: "Weekly impact report has been successfully generated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate weekly impact report.",
        variant: "destructive",
      });
    },
  });

  // Download PDF
  const downloadPdfMutation = useMutation({
    mutationFn: async (weekEnding: string) => {
      const response = await fetch(`/api/reports/weekly-impact/download/${weekEnding}`);
      if (!response.ok) throw new Error('Failed to download PDF');
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weekly-impact-report-${weekEnding}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Download Started",
        description: "Weekly impact report PDF download has started.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download PDF report.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateReport = () => {
    generateReportMutation.mutate(weekEndingDate);
  };

  const handleDownloadPdf = () => {
    if (reportData) {
      downloadPdfMutation.mutate(weekEndingDate);
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'down': return <ArrowDown className="h-4 w-4 text-red-600" />;
      case 'stable': return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'high_performer':
        return <Badge className="bg-green-100 text-green-800 border-green-200">High Performer</Badge>;
      case 'needs_attention':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Needs Attention</Badge>;
      case 'steady_contributor':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Steady Contributor</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatPercentage = (num: number) => {
    return (num * 100).toFixed(1) + '%';
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#236383]">Weekly Impact Report</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Comprehensive weekly collection analysis and operational insights</p>
        </div>
      </div>

      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#FBAD3F]" />
            Generate Report
          </CardTitle>
          <CardDescription>
            Generate a comprehensive weekly impact report for operational analysis and board communications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <Label htmlFor="weekEnding">Week Ending Date</Label>
              <Input
                id="weekEnding"
                type="date"
                value={weekEndingDate}
                onChange={(e) => setWeekEndingDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleGenerateReport}
                disabled={generateReportMutation.isPending}
                className="bg-[#236383] hover:bg-[#1a4d66] text-white w-full sm:w-auto"
              >
                {generateReportMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
              {reportData && (
                <Button
                  onClick={handleDownloadPdf}
                  disabled={downloadPdfMutation.isPending}
                  variant="outline"
                  className="border-[#FBAD3F] text-[#FBAD3F] hover:bg-[#FBAD3F] hover:text-white w-full sm:w-auto"
                >
                  {downloadPdfMutation.isPending ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Display */}
      {reportData && (
        <div className="space-y-6">
          {/* Executive Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl text-[#236383]">Executive Summary</CardTitle>
              <CardDescription>
                Collection Week: {new Date(reportData.collection_week.start).toLocaleDateString()} - {new Date(reportData.collection_week.end).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl md:text-3xl font-bold text-[#236383]">
                    {formatNumber(reportData.summary.total_sandwiches)}
                  </div>
                  <div className="text-sm text-gray-600">Total Collected</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl md:text-3xl font-bold text-[#FBAD3F]">
                    {reportData.summary.active_locations}/{reportData.summary.total_locations}
                  </div>
                  <div className="text-sm text-gray-600">Active Locations</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatPercentage(reportData.summary.participation_rate)} participation
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className={`text-2xl md:text-3xl font-bold ${reportData.summary.week_over_week_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {reportData.summary.week_over_week_change >= 0 ? '+' : ''}{formatPercentage(reportData.summary.week_over_week_change)}
                  </div>
                  <div className="text-sm text-gray-600">Week-over-Week</div>
                </div>
                <div className="text-center p-4 bg-teal-50 rounded-lg">
                  <div className="text-xl md:text-2xl font-bold text-[#47B3CB]">
                    {formatNumber(reportData.summary.monthly_progress.current)}
                  </div>
                  <div className="text-sm text-gray-600">Monthly Progress</div>
                  <Progress 
                    value={reportData.summary.monthly_progress.percentage * 100} 
                    className="mt-2 h-2"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {formatPercentage(reportData.summary.monthly_progress.percentage)} of {formatNumber(reportData.summary.monthly_progress.goal)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Tabs */}
          <Tabs defaultValue="metrics" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5 h-auto">
              <TabsTrigger value="metrics" className="text-xs md:text-sm">Key Metrics</TabsTrigger>
              <TabsTrigger value="locations" className="text-xs md:text-sm">Locations</TabsTrigger>
              <TabsTrigger value="insights" className="text-xs md:text-sm">Insights</TabsTrigger>
              <TabsTrigger value="preparation" className="text-xs md:text-sm">Next Week</TabsTrigger>
              <TabsTrigger value="celebration" className="text-xs md:text-sm">Success</TabsTrigger>
            </TabsList>

            {/* Key Metrics Table */}
            <TabsContent value="metrics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-[#47B3CB]" />
                    Key Metrics Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[600px]">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 md:p-3 font-semibold text-sm md:text-base">Metric</th>
                          <th className="text-center p-2 md:p-3 font-semibold text-sm md:text-base">This Week</th>
                          <th className="text-center p-2 md:p-3 font-semibold text-sm md:text-base">Last Week</th>
                          <th className="text-center p-2 md:p-3 font-semibold text-sm md:text-base">Change</th>
                          <th className="text-center p-2 md:p-3 font-semibold text-sm md:text-base">4-Week Avg</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2 md:p-3 font-medium text-sm md:text-base">Total Sandwiches</td>
                          <td className="text-center p-2 md:p-3 text-sm md:text-base">{formatNumber(reportData.metrics_table.total_sandwiches.this_week)}</td>
                          <td className="text-center p-2 md:p-3 text-sm md:text-base">{formatNumber(reportData.metrics_table.total_sandwiches.last_week)}</td>
                          <td className={`text-center p-2 md:p-3 font-medium text-sm md:text-base ${reportData.metrics_table.total_sandwiches.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {reportData.metrics_table.total_sandwiches.change >= 0 ? '+' : ''}{formatNumber(reportData.metrics_table.total_sandwiches.change)}
                          </td>
                          <td className="text-center p-2 md:p-3 text-sm md:text-base">{formatNumber(reportData.metrics_table.total_sandwiches.four_week_avg)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Locations Participating</td>
                          <td className="text-center p-3">{reportData.metrics_table.locations_participating.this_week}</td>
                          <td className="text-center p-3">{reportData.metrics_table.locations_participating.last_week}</td>
                          <td className={`text-center p-3 font-medium ${reportData.metrics_table.locations_participating.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {reportData.metrics_table.locations_participating.change >= 0 ? '+' : ''}{reportData.metrics_table.locations_participating.change}
                          </td>
                          <td className="text-center p-3">{reportData.metrics_table.locations_participating.four_week_avg}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3 font-medium">Avg per Location</td>
                          <td className="text-center p-3">{Math.round(reportData.metrics_table.avg_per_location.this_week)}</td>
                          <td className="text-center p-3">{Math.round(reportData.metrics_table.avg_per_location.last_week)}</td>
                          <td className={`text-center p-3 font-medium ${reportData.metrics_table.avg_per_location.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {reportData.metrics_table.avg_per_location.change >= 0 ? '+' : ''}{Math.round(reportData.metrics_table.avg_per_location.change)}
                          </td>
                          <td className="text-center p-3">{Math.round(reportData.metrics_table.avg_per_location.four_week_avg)}</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium">Group Collections</td>
                          <td className="text-center p-3">{formatNumber(reportData.metrics_table.group_collections.this_week)}</td>
                          <td className="text-center p-3">{formatNumber(reportData.metrics_table.group_collections.last_week)}</td>
                          <td className={`text-center p-3 font-medium ${reportData.metrics_table.group_collections.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {reportData.metrics_table.group_collections.change >= 0 ? '+' : ''}{formatNumber(reportData.metrics_table.group_collections.change)}
                          </td>
                          <td className="text-center p-3">{formatNumber(reportData.metrics_table.group_collections.four_week_avg)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Location Performance */}
            <TabsContent value="locations" className="space-y-4">
              <div className="grid gap-4">
                {/* High Performers */}
                {reportData.locations.filter(l => l.status === 'high_performer').length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <Award className="h-5 w-5" />
                        High Performers (&gt;800 sandwiches)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {reportData.locations.filter(l => l.status === 'high_performer').map((location, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                            <div className="flex items-center gap-3">
                              <MapPin className="h-4 w-4 text-green-600" />
                              <span className="font-medium">{location.name}</span>
                              {getTrendIcon(location.trend)}
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-700">{formatNumber(location.total)}</div>
                              <div className="text-sm text-gray-600">
                                {formatNumber(location.individual)} individual + {formatNumber(location.group)} group
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Needs Attention */}
                {reportData.locations.filter(l => l.status === 'needs_attention').length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-5 w-5" />
                        Needs Attention
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {reportData.locations.filter(l => l.status === 'needs_attention').map((location, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <MapPin className="h-4 w-4 text-red-600" />
                                <span className="font-medium">{location.name}</span>
                                <span className="text-sm text-red-600 font-medium">Action Required</span>
                              </div>
                              {location.issues && location.issues.length > 0 && (
                                <div className="ml-7">
                                  {location.issues.map((issue, issueIndex) => (
                                    <div key={issueIndex} className="text-sm text-gray-600">• {issue}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-red-700">{formatNumber(location.total)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Steady Contributors */}
                {reportData.locations.filter(l => l.status === 'steady_contributor').length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-[#47B3CB] text-lg">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm md:text-lg">Steady Contributors ({reportData.locations.filter(l => l.status === 'steady_contributor').length} locations)</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {reportData.locations.filter(l => l.status === 'steady_contributor').slice(0, 12).map((location, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded border">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <MapPin className="h-3 w-3 text-[#47B3CB] flex-shrink-0" />
                              <span className="text-sm font-medium truncate">{location.name}</span>
                              {getTrendIcon(location.trend)}
                            </div>
                            <span className="text-sm font-semibold text-[#47B3CB] ml-2">{formatNumber(location.total)}</span>
                          </div>
                        ))}
                        {reportData.locations.filter(l => l.status === 'steady_contributor').length > 12 && (
                          <div className="col-span-full text-center text-gray-500 text-sm">
                            ... and {reportData.locations.filter(l => l.status === 'steady_contributor').length - 12} more locations
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Trends & Insights */}
            <TabsContent value="insights" className="space-y-4">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg md:text-xl">Identified Patterns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {reportData.trends_insights.patterns.map((pattern, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <TrendingUp className="h-4 w-4 mt-1 text-[#47B3CB] flex-shrink-0" />
                          <span className="text-sm md:text-base">{pattern}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Seasonal Impacts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {reportData.trends_insights.seasonal_impacts.map((impact, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 mt-0.5 text-[#FBAD3F]" />
                          <span>{impact}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Special Events</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {reportData.trends_insights.special_events.map((event, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Star className="h-4 w-4 mt-0.5 text-[#236383]" />
                          <span>{event}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Next Week Preparation */}
            <TabsContent value="preparation" className="space-y-4">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                      <Users className="h-5 w-5 text-[#236383]" />
                      Host Confirmations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="text-2xl md:text-3xl font-bold text-[#236383] text-center sm:text-left">
                        {reportData.next_week_prep.host_confirmations.confirmed}/{reportData.next_week_prep.host_confirmations.total}
                      </div>
                      <div className="flex-1">
                        <Progress value={reportData.next_week_prep.host_confirmations.percentage * 100} className="h-3" />
                        <div className="text-sm text-gray-600 mt-1 text-center sm:text-left">
                          {formatPercentage(reportData.next_week_prep.host_confirmations.percentage)} confirmed
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Pending Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {reportData.next_week_prep.pending_actions.map((action, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Clock className="h-4 w-4 mt-0.5 text-[#FBAD3F]" />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg md:text-xl">Weather Forecast</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm md:text-base">{reportData.next_week_prep.weather_forecast}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg md:text-xl">Volunteer Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm md:text-base">{reportData.next_week_prep.volunteer_status}</p>
                    </CardContent>
                  </Card>
                </div>

                {reportData.next_week_prep.known_events.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Known Events</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {reportData.next_week_prep.known_events.map((event, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 mt-0.5 text-[#47B3CB]" />
                            <span>{event}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Success Celebration */}
            <TabsContent value="celebration" className="space-y-4">
              <div className="grid gap-4">
                {reportData.success_celebration.milestones.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-[#FBAD3F]">
                        <Award className="h-5 w-5" />
                        Milestones Reached
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {reportData.success_celebration.milestones.map((milestone, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <Star className="h-4 w-4 mt-0.5 text-[#FBAD3F]" />
                            <span className="font-medium">{milestone}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {reportData.success_celebration.volunteer_spotlight && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-[#236383]">
                        <Users className="h-5 w-5" />
                        Volunteer Spotlight
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#236383]">
                        <div className="font-semibold text-[#236383] mb-2">
                          {reportData.success_celebration.volunteer_spotlight.name}
                        </div>
                        <div className="text-gray-700">
                          {reportData.success_celebration.volunteer_spotlight.contribution}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {reportData.success_celebration.impact_story && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-[#47B3CB]">
                        <Star className="h-5 w-5" />
                        Impact Story
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-4 bg-teal-50 rounded-lg border-l-4 border-[#47B3CB]">
                        <blockquote className="text-lg italic text-gray-700 mb-3">
                          "{reportData.success_celebration.impact_story.quote}"
                        </blockquote>
                        <cite className="text-sm font-medium text-[#47B3CB]">
                          — {reportData.success_celebration.impact_story.attribution}
                        </cite>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}