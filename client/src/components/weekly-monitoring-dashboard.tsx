import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, Mail, RefreshCw, Calendar, MapPin, AlertTriangle, FileBarChart, Users, Info, MessageSquare, Smartphone, Settings, Send } from "lucide-react";
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
  const [showSMSTest, setShowSMSTest] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [showAnnouncementPanel, setShowAnnouncementPanel] = useState(false);
  
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
  
  // SMS mutations
  const sendSMSRemindersMutation = useMutation({
    mutationFn: (data: { missingLocations: string[]; appUrl?: string }) => 
      apiRequest('POST', '/api/monitoring/send-sms-reminders', data),
  });
  
  const sendSingleSMSMutation = useMutation({
    mutationFn: (data: { location: string; appUrl?: string }) => 
      apiRequest('POST', `/api/monitoring/send-sms-reminder/${encodeURIComponent(data.location)}`, { appUrl: data.appUrl }),
  });
  
  const testSMSMutation = useMutation({
    mutationFn: (data: { phoneNumber: string; appUrl?: string }) => 
      apiRequest('POST', '/api/monitoring/test-sms', data),
  });
  
  // SMS announcement mutation
  const sendAnnouncementMutation = useMutation({
    mutationFn: (data: { testMode?: boolean; testEmail?: string }) => 
      apiRequest('POST', '/api/sms-announcement/send-sms-announcement', data),
  });
  
  // Get SMS configuration status
  const { data: smsConfig } = useQuery({
    queryKey: ['/api/monitoring/sms-config'],
    queryFn: () => apiRequest('GET', '/api/monitoring/sms-config'),
  });

  // Send test email mutation
  const testEmailMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/monitoring/test-email'),
  });

  // Email reminder mutations
  const sendSingleEmailMutation = useMutation({
    mutationFn: (data: { location: string; appUrl?: string }) => 
      apiRequest('POST', `/api/monitoring/send-email-reminder/${encodeURIComponent(data.location)}`, { appUrl: data.appUrl }),
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
    <div className="max-w-6xl mx-auto p-2 sm:p-4 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-[#236383] flex-shrink-0" />
            <span className="truncate">Weekly Submission Monitoring</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Track which host locations submit their sandwich counts each week
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-2">
          <Button
            onClick={() => testEmailMutation.mutate()}
            variant="outline"
            disabled={testEmailMutation.isPending}
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 h-8 sm:h-9"
          >
            <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{testEmailMutation.isPending ? "Sending..." : "Test Email"}</span>
            <span className="sm:hidden">{testEmailMutation.isPending ? "Send..." : "Email"}</span>
          </Button>
          
          {smsConfig?.isConfigured && (
            <Button
              onClick={() => {
                const missingLocations = submissionStatus
                  .filter(s => !s.hasSubmitted)
                  .map(s => s.location);
                if (missingLocations.length > 0) {
                  sendSMSRemindersMutation.mutate({ 
                    missingLocations,
                    appUrl: window.location.origin 
                  });
                }
              }}
              variant="outline"
              disabled={sendSMSRemindersMutation.isPending || !submissionStatus.some(s => !s.hasSubmitted)}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-green-700 border-green-200 hover:bg-green-50 px-2 sm:px-3 py-1 sm:py-2 h-8 sm:h-9"
            >
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden lg:inline">{sendSMSRemindersMutation.isPending ? "Sending SMS..." : "Send SMS Reminders"}</span>
              <span className="lg:hidden">{sendSMSRemindersMutation.isPending ? "SMS..." : "SMS All"}</span>
            </Button>
          )}
          
          <Button
            onClick={() => setShowSMSTest(!showSMSTest)}
            variant="outline"
            disabled={!smsConfig?.isConfigured}
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 h-8 sm:h-9"
          >
            <Smartphone className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Test SMS</span>
            <span className="sm:hidden">Test</span>
          </Button>
          
          <Button
            onClick={() => setShowAnnouncementPanel(!showAnnouncementPanel)}
            variant="outline"
            className="hidden sm:flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 h-8 sm:h-9"
          >
            <Send className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>SMS Announcement</span>
          </Button>
          
          <Button
            onClick={() => selectedWeek === 0 ? manualCheckMutation.mutate() : checkWeekMutation.mutate(selectedWeek)}
            disabled={manualCheckMutation.isPending || checkWeekMutation.isPending}
            className="flex items-center gap-1 sm:gap-2 bg-[#236383] hover:bg-[#1d5470] text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 h-8 sm:h-9"
          >
            <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${(manualCheckMutation.isPending || checkWeekMutation.isPending) ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">{(manualCheckMutation.isPending || checkWeekMutation.isPending) ? "Checking..." : `Check ${getWeekLabel(selectedWeek)}`}</span>
            <span className="lg:hidden">{(manualCheckMutation.isPending || checkWeekMutation.isPending) ? "Check..." : "Check"}</span>
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
                <Calendar className="h-5 w-5 text-teal-600" />
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
                <Clock className="h-5 w-5 text-teal-600" />
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
      
      {/* SMS Test Panel */}
      {showSMSTest && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Test SMS Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {smsConfig?.isConfigured ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">SMS service is configured and ready</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      placeholder="Phone number (e.g., +1234567890)"
                      value={testPhoneNumber}
                      onChange={(e) => setTestPhoneNumber(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <Button
                      onClick={() => testSMSMutation.mutate({ 
                        phoneNumber: testPhoneNumber,
                        appUrl: window.location.origin 
                      })}
                      disabled={testSMSMutation.isPending || !testPhoneNumber}
                      className="flex items-center gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      {testSMSMutation.isPending ? "Sending..." : "Send Test SMS"}
                    </Button>
                  </div>
                  {testSMSMutation.isSuccess && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Test SMS sent successfully!
                      </AlertDescription>
                    </Alert>
                  )}
                  {testSMSMutation.isError && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Failed to send test SMS. Check your phone number format and Twilio configuration.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-orange-700">
                    <Settings className="h-4 w-4" />
                    <span className="text-sm">SMS service requires configuration</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Missing environment variables:</p>
                    <ul className="list-disc list-inside mt-1">
                      {smsConfig?.missingItems?.map(item => (
                        <li key={item} className="font-mono text-xs">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SMS Announcement Panel */}
      {showAnnouncementPanel && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send SMS Capability Announcement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-teal-50 p-4 rounded-lg">
                <h4 className="font-medium text-teal-900 mb-2">What this announcement does:</h4>
                <ul className="text-sm text-teal-800 space-y-1">
                  <li>• Sends an email to all registered app users</li>
                  <li>• Explains the new SMS reminder feature</li>
                  <li>• Includes a link for users to opt-in to SMS notifications</li>
                  <li>• Emphasizes that SMS is completely voluntary</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => sendAnnouncementMutation.mutate({ testMode: true })}
                  variant="outline"
                  disabled={sendAnnouncementMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  {sendAnnouncementMutation.isPending ? "Sending..." : "Send Test (to yourself)"}
                </Button>
                
                <Button
                  onClick={() => {
                    if (confirm("Send SMS announcement to ALL registered users? This cannot be undone.")) {
                      sendAnnouncementMutation.mutate({ testMode: false });
                    }
                  }}
                  disabled={sendAnnouncementMutation.isPending}
                  className="flex items-center gap-2 bg-[#236383] hover:bg-[#1d5470]"
                >
                  <Send className="h-4 w-4" />
                  {sendAnnouncementMutation.isPending ? "Sending..." : "Send to All Users"}
                </Button>
              </div>

              {sendAnnouncementMutation.isSuccess && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {sendAnnouncementMutation.data?.message}
                    {sendAnnouncementMutation.data?.smsOptInUrl && (
                      <div className="mt-2">
                        <span className="font-medium">Opt-in URL: </span>
                        <a 
                          href={sendAnnouncementMutation.data.smsOptInUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:underline"
                        >
                          {sendAnnouncementMutation.data.smsOptInUrl}
                        </a>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {sendAnnouncementMutation.isError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to send announcement. Please try again.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
              ) : statusError ? (
                <div className="text-center py-8 text-red-500">
                  Error loading submission data: {statusError.message}
                </div>
              ) : Array.isArray(submissionStatus) && submissionStatus.length > 0 ? (
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
                              Last submission: {(() => {
                                // Handle date without timezone conversion issues
                                const dateStr = status.lastSubmissionDate;
                                if (dateStr.includes('-')) {
                                  // Parse YYYY-MM-DD format directly to avoid timezone issues
                                  const [year, month, day] = dateStr.split('-').map(Number);
                                  const date = new Date(year, month - 1, day); // month is 0-indexed
                                  return date.toLocaleDateString();
                                }
                                return new Date(dateStr).toLocaleDateString();
                              })()}
                            </p>
                          )}
                          {status.submittedBy && status.submittedBy.length > 0 && (
                            <p className="text-sm text-gray-500">
                              Submitted by: {status.submittedBy.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={`${getStatusColor(status.hasSubmitted)} flex items-center gap-1`}
                        >
                          {getStatusIcon(status.hasSubmitted)}
                          {status.hasSubmitted ? "Submitted" : "Missing"}
                        </Badge>
                        
                        {!status.hasSubmitted && (
                          <div className="flex items-center gap-1">
                            {/* Email Reminder Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => sendSingleEmailMutation.mutate({ 
                                location: status.location,
                                appUrl: window.location.origin 
                              })}
                              disabled={sendSingleEmailMutation.isPending}
                              className="flex items-center gap-1 text-xs px-2 py-1 h-7 text-teal-600 border-teal-200 hover:bg-teal-50"
                            >
                              <Mail className="h-3 w-3" />
                              {sendSingleEmailMutation.isPending ? "Sending..." : "Email"}
                            </Button>
                            
                            {/* SMS Button (only if configured) */}
                            {smsConfig?.isConfigured && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendSingleSMSMutation.mutate({ 
                                  location: status.location,
                                  appUrl: window.location.origin 
                                })}
                                disabled={sendSingleSMSMutation.isPending}
                                className="flex items-center gap-1 text-xs px-2 py-1 h-7"
                              >
                                <MessageSquare className="h-3 w-3" />
                                {sendSingleSMSMutation.isPending ? "Sending..." : "SMS"}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No submission data available for this week. (Data: {JSON.stringify(submissionStatus)})
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
                          {multiWeekReport.summary.mostReliable && multiWeekReport.summary.mostReliable.map ? multiWeekReport.summary.mostReliable.map((location: string) => (
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
                          {multiWeekReport.summary.mostMissing && multiWeekReport.summary.mostMissing.map ? multiWeekReport.summary.mostMissing.map((location: string) => (
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
                      {multiWeekReport.weeks && multiWeekReport.weeks.map ? multiWeekReport.weeks.map((week: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4">
                          <h4 className="font-medium mb-3">{week.weekLabel}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {week.submissionStatus && week.submissionStatus.map ? week.submissionStatus.map((status: any) => (
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
                                     !status.dunwoodyStatus.lisaHiles && !status.dunwoodyStatus.stephanieOrMarcy ? '✗' :
                                     !status.dunwoodyStatus.lisaHiles ? 'L' : 
                                     !status.dunwoodyStatus.stephanieOrMarcy ? 'S/M' : '✗'}
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
          <CardTitle>Expected Weekly Locations</CardTitle>
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
                      ? 'bg-teal-50 border border-teal-200 text-teal-800'
                      : 'bg-gray-50'
                  }`}
                >
                  {location}
                  {location === 'Dunwoody/PTC' && (
                    <Info className="h-3 w-3 inline ml-1" />
                  )}
                </div>
              ))}
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
              <h4 className="font-medium text-teal-800 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Dunwoody/PTC Submission Process
              </h4>
              <p className="text-sm text-teal-700 mt-1">
                Dunwoody operates with two separate data sources:
              </p>
              <ul className="text-sm text-teal-700 mt-2 space-y-1">
                <li>• <strong>Lisa Hiles</strong> entry</li>
                <li>• <strong>Stephanie OR Marcy</strong> entry</li>
              </ul>
              <p className="text-xs text-teal-600 mt-2">
                Both entries are needed for complete weekly data from this location.
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

      {(manualCheckMutation.isError || testEmailMutation.isError || checkWeekMutation.isError || sendSMSRemindersMutation.isError || sendSingleSMSMutation.isError) && (
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
      
      {sendSMSRemindersMutation.isSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            {sendSMSRemindersMutation.data?.message}
          </AlertDescription>
        </Alert>
      )}
      
      {sendSingleSMSMutation.isSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            SMS reminder sent successfully!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}