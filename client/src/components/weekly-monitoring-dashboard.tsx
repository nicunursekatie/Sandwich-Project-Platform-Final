import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, Mail, RefreshCw, Calendar, MapPin, AlertTriangle, FileBarChart, Users, Crown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface WeeklySubmissionStatus {
  location: string;
  hasSubmitted: boolean;
  lastSubmissionDate?: string;
  missingSince?: string;
  submittedBy?: string[];
  dunwoodyStatus?: {
    lisaHiles: boolean;
    stephanieOrMarcy: boolean;
    complete: boolean;
  };
}

interface MultiWeekReport {
  weekRange: { startDate: Date; endDate: Date };
  weekLabel: string;
  submissionStatus: WeeklySubmissionStatus[];
}

interface ComprehensiveReport {
  reportPeriod: string;
  weeks: MultiWeekReport[];
  summary: {
    totalWeeks: number;
    locationsTracked: string[];
    mostMissing: string[];
    mostReliable: string[];
    overallStats: {
      [location: string]: {
        submitted: number;
        missed: number;
        percentage: number;
      };
    };
  };
}

interface MonitoringStats {
  currentWeek: string;
  totalExpectedLocations: number;
  submittedLocations: number;
  missingLocations: number;
  lastCheckTime: string;
  nextScheduledCheck: string;
}

export default function WeeklyMonitoringDashboard() {
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState(0); // 0 = current week, 1 = last week, etc.
  const [reportWeeks, setReportWeeks] = useState(4); // Number of weeks for multi-week report
  
  // Get monitoring status for selected week
  const { data: submissionStatus = [], isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['/api/monitoring/weekly-status', selectedWeek],
    queryFn: () => apiRequest('GET', `/api/monitoring/weekly-status/${selectedWeek}`),
    refetchInterval: selectedWeek === 0 ? 5 * 60 * 1000 : undefined, // Only auto-refresh for current week
  });
  
  // Get multi-week report
  const { data: multiWeekReport, isLoading: reportLoading } = useQuery({
    queryKey: ['/api/monitoring/multi-week-report', reportWeeks],
    queryFn: () => apiRequest('GET', `/api/monitoring/multi-week-report/${reportWeeks}`),
    enabled: reportWeeks > 0,
  });

  // Get monitoring statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/monitoring/stats'],
    queryFn: () => apiRequest('GET', '/api/monitoring/stats'),
    refetchInterval: 5 * 60 * 1000,
  });

  // Manual check mutation for current week
  const manualCheckMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/monitoring/check-now'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/weekly-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/stats'] });
    },
  });
  
  // Check specific week mutation
  const checkWeekMutation = useMutation({
    mutationFn: (weeksAgo: number) => apiRequest('POST', `/api/monitoring/check-week/${weeksAgo}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/weekly-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/multi-week-report'] });
    },
  });

  // Send test email mutation
  const testEmailMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/monitoring/test-email'),
  });

  const getStatusColor = (hasSubmitted: boolean) => {
    return hasSubmitted 
      ? "bg-green-100 text-green-800 border-green-200" 
      : "bg-red-100 text-red-800 border-red-200";
  };

  const getStatusIcon = (hasSubmitted: boolean) => {
    return hasSubmitted 
      ? <CheckCircle className="h-4 w-4" />
      : <XCircle className="h-4 w-4" />;
  };
  
  const getWeekLabel = (weeksAgo: number) => {
    if (weeksAgo === 0) return "This Week";
    if (weeksAgo === 1) return "Last Week";
    return `${weeksAgo} Weeks Ago`;
  };
  
  const getDunwoodyBadge = (status: WeeklySubmissionStatus) => {
    if (status.location !== 'Dunwoody/PTC' || !status.dunwoodyStatus) return null;
    
    const { lisaHiles, stephanieOrMarcy, complete } = status.dunwoodyStatus;
    
    if (complete) {
      return <Badge className="bg-green-100 text-green-800 text-xs ml-2">Both Required ✓</Badge>;
    }
    
    const missing = [];
    if (!lisaHiles) missing.push('Lisa Hiles');
    if (!stephanieOrMarcy) missing.push('Stephanie/Marcy');
    
    return (
      <Badge className="bg-orange-100 text-orange-800 text-xs ml-2">
        Missing: {missing.join(', ')}
      </Badge>
    );
  };

  if (statusError) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load monitoring data. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-[#236383]" />
            Weekly Submission Monitoring
          </h1>
          <p className="text-gray-600 mt-1">
            Track which host locations submit their sandwich counts each week
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => testEmailMutation.mutate()}
            variant="outline"
            disabled={testEmailMutation.isPending}
            className="flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            {testEmailMutation.isPending ? "Sending..." : "Send Test Email"}
          </Button>
          <Button
            onClick={() => selectedWeek === 0 ? manualCheckMutation.mutate() : checkWeekMutation.mutate(selectedWeek)}
            disabled={manualCheckMutation.isPending || checkWeekMutation.isPending}
            className="flex items-center gap-2 bg-[#236383] hover:bg-[#1d5470]"
          >
            <RefreshCw className={`h-4 w-4 ${(manualCheckMutation.isPending || checkWeekMutation.isPending) ? 'animate-spin' : ''}`} />
            {(manualCheckMutation.isPending || checkWeekMutation.isPending) ? "Checking..." : `Check ${getWeekLabel(selectedWeek)}`}
          </Button>
        </div>
      </div>
      
      {/* Week Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select Week to Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Week:</label>
              <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">This Week (Current)</SelectItem>
                  <SelectItem value="1">Last Week</SelectItem>
                  <SelectItem value="2">2 Weeks Ago</SelectItem>
                  <SelectItem value="3">3 Weeks Ago</SelectItem>
                  <SelectItem value="4">4 Weeks Ago</SelectItem>
                  <SelectItem value="5">5 Weeks Ago</SelectItem>
                  <SelectItem value="6">6 Weeks Ago</SelectItem>
                  <SelectItem value="7">7 Weeks Ago</SelectItem>
                  <SelectItem value="8">8 Weeks Ago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-gray-600">
              Currently viewing: <strong>{getWeekLabel(selectedWeek)}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Current Week</p>
                  <p className="text-lg font-semibold">{stats.currentWeek}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Submitted</p>
                  <p className="text-lg font-semibold">
                    {stats.submittedLocations}/{stats.totalExpectedLocations}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600">Missing</p>
                  <p className="text-lg font-semibold">{stats.missingLocations}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Next Check</p>
                  <p className="text-sm font-semibold">{stats.nextScheduledCheck}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monitoring Schedule Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Automated Monitoring Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Email Alerts Sent:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Thursday evenings at 7:00 PM</li>
                <li>• Friday mornings at 8:00 AM</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Alert Details:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Shows missing locations</li>
                <li>• Lists locations that have submitted</li>
                <li>• Sent to: katielong2316@gmail.com</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Tabs for different views */}
      <Tabs defaultValue="weekly" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="weekly" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Weekly Status
          </TabsTrigger>
          <TabsTrigger value="report" className="flex items-center gap-2">
            <FileBarChart className="w-4 h-4" />
            Multi-Week Report
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="weekly" className="mt-6">
          {/* Current Week Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Host Location Status - {getWeekLabel(selectedWeek)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-600">Loading submission status...</span>
                </div>
              ) : submissionStatus && submissionStatus.length > 0 ? (
                <div className="grid gap-3">
                  {submissionStatus.map((status: WeeklySubmissionStatus) => (
                    <div
                      key={status.location}
                      className="flex items-center justify-between p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          status.hasSubmitted ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {getStatusIcon(status.hasSubmitted)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center">
                            <h4 className="font-medium text-gray-900">{status.location}</h4>
                            {getDunwoodyBadge(status)}
                          </div>
                          {status.lastSubmissionDate && (
                            <p className="text-sm text-gray-600">
                              Last submission: {new Date(status.lastSubmissionDate).toLocaleDateString()}
                            </p>
                          )}
                          {status.submittedBy && status.submittedBy.length > 0 && (
                            <p className="text-sm text-gray-500">
                              Submitted by: {status.submittedBy.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <Badge 
                        className={`${getStatusColor(status.hasSubmitted)} flex items-center gap-1`}
                      >
                        {getStatusIcon(status.hasSubmitted)}
                        {status.hasSubmitted ? "Submitted" : "Missing"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No submission data available for this week.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="report" className="mt-6">
          {/* Multi-Week Report */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileBarChart className="h-5 w-5" />
                  Multi-Week Report Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Number of weeks to analyze:</label>
                    <Select value={reportWeeks.toString()} onValueChange={(value) => setReportWeeks(parseInt(value))}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 weeks</SelectItem>
                        <SelectItem value="3">3 weeks</SelectItem>
                        <SelectItem value="4">4 weeks</SelectItem>
                        <SelectItem value="6">6 weeks</SelectItem>
                        <SelectItem value="8">8 weeks</SelectItem>
                        <SelectItem value="12">12 weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {reportLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-600">Loading multi-week report...</span>
              </div>
            ) : multiWeekReport && multiWeekReport.weeks && multiWeekReport.summary ? (
              <>
                {/* Summary Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Summary Statistics ({multiWeekReport.reportPeriod})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium text-green-700">Most Reliable (≥75%)</h4>
                        <div className="space-y-1">
                          {multiWeekReport.summary.mostReliable && multiWeekReport.summary.mostReliable.map ? multiWeekReport.summary.mostReliable.map(location => (
                            <div key={location} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span>{location}</span>
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                {multiWeekReport.summary.overallStats[location]?.percentage}%
                              </Badge>
                            </div>
                          )) : <div className="text-sm text-gray-500">No data available</div>}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium text-red-700">Most Missing</h4>
                        <div className="space-y-1">
                          {multiWeekReport.summary.mostMissing && multiWeekReport.summary.mostMissing.map ? multiWeekReport.summary.mostMissing.map(location => (
                            <div key={location} className="flex items-center gap-2 text-sm">
                              <XCircle className="h-4 w-4 text-red-600" />
                              <span>{location}</span>
                              <Badge className="bg-red-100 text-red-800 text-xs">
                                {multiWeekReport.summary.overallStats[location]?.missed} missed
                              </Badge>
                            </div>
                          )) : <div className="text-sm text-gray-500">No data available</div>}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-700">Overall Stats</h4>
                        <div className="text-sm space-y-1">
                          <p>Total weeks analyzed: {multiWeekReport.summary.totalWeeks || 0}</p>
                          <p>Locations tracked: {multiWeekReport.summary.locationsTracked?.length || 0}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Week-by-Week Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Week-by-Week Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {multiWeekReport.weeks && multiWeekReport.weeks.map ? multiWeekReport.weeks.map((week, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <h4 className="font-medium mb-3">{week.weekLabel}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {week.submissionStatus && week.submissionStatus.map ? week.submissionStatus.map((status) => (
                              <div
                                key={status.location}
                                className={`p-2 rounded text-sm flex items-center gap-2 ${
                                  status.hasSubmitted 
                                    ? 'bg-green-50 text-green-800 border border-green-200' 
                                    : 'bg-red-50 text-red-800 border border-red-200'
                                }`}
                              >
                                {getStatusIcon(status.hasSubmitted)}
                                <span className="truncate">{status.location}</span>
                                {status.location === 'Dunwoody/PTC' && status.dunwoodyStatus && (
                                  <div className="text-xs">
                                    {status.dunwoodyStatus.complete ? '✓✓' : 
                                     status.dunwoodyStatus.lisaHiles ? 'L' : 
                                     status.dunwoodyStatus.stephanieOrMarcy ? 'S/M' : '✗'}
                                  </div>
                                )}
                              </div>
                            )) : <div className="text-sm text-gray-500">No submission data for this week</div>}
                          </div>
                        </div>
                      )) : <div className="text-center py-8 text-gray-500">No weekly data available</div>}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No multi-week report data available.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Expected Locations */}
      <Card>
        <CardHeader>
          <CardTitle>Expected Weekly Locations & Special Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                'East Cobb/Roswell',
                'Dunwoody/PTC', 
                'Alpharetta',
                'Sandy Springs',
                'Intown/Druid Hills',
                'Dacula',
                'Flowery Branch',
                'Collective Learning'
              ].map((location) => (
                <div
                  key={location}
                  className={`p-2 rounded-lg text-sm text-center ${
                    location === 'Dunwoody/PTC' 
                      ? 'bg-purple-50 border border-purple-200 text-purple-800'
                      : 'bg-gray-50'
                  }`}
                >
                  {location}
                  {location === 'Dunwoody/PTC' && (
                    <Crown className="h-3 w-3 inline ml-1" />
                  )}
                </div>
              ))}
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <h4 className="font-medium text-purple-800 flex items-center gap-2">
                <Crown className="h-4 w-4" />
                Special Requirements - Dunwoody/PTC
              </h4>
              <p className="text-sm text-purple-700 mt-1">
                Dunwoody requires TWO separate entries to be considered complete:
              </p>
              <ul className="text-sm text-purple-700 mt-2 space-y-1">
                <li>• <strong>Lisa Hiles</strong> entry (required)</li>
                <li>• <strong>Stephanie OR Marcy</strong> entry (required)</li>
              </ul>
              <p className="text-xs text-purple-600 mt-2">
                Both entries must be submitted for Dunwoody to show as "Submitted" in the monitoring system.
              </p>
            </div>
            <p className="text-sm text-gray-600">
              Note: Dacula is marked as "maybe" - they may not submit every week
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Success/Error Messages */}
      {manualCheckMutation.isSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Manual check completed successfully! Status updated.
          </AlertDescription>
        </Alert>
      )}

      {testEmailMutation.isSuccess && (
        <Alert>
          <Mail className="h-4 w-4" />
          <AlertDescription>
            Test email sent successfully to katielong2316@gmail.com
          </AlertDescription>
        </Alert>
      )}

      {(manualCheckMutation.isError || testEmailMutation.isError || checkWeekMutation.isError) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Operation failed. Please try again or check system logs.
          </AlertDescription>
        </Alert>
      )}
      
      {checkWeekMutation.isSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Week check completed! {checkWeekMutation.data?.missingCount || 0} locations missing.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}