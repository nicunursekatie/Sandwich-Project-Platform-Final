import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Clock, Mail, RefreshCw, Calendar, MapPin, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface WeeklySubmissionStatus {
  location: string;
  hasSubmitted: boolean;
  lastSubmissionDate?: string;
  missingSince?: string;
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
  
  // Get current monitoring status
  const { data: submissionStatus = [], isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['/api/monitoring/weekly-status'],
    queryFn: () => apiRequest('GET', '/api/monitoring/weekly-status'),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Get monitoring statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/monitoring/stats'],
    queryFn: () => apiRequest('GET', '/api/monitoring/stats'),
    refetchInterval: 5 * 60 * 1000,
  });

  // Manual check mutation
  const manualCheckMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/monitoring/check-now'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/weekly-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/stats'] });
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
      <div className="flex items-center justify-between">
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
            onClick={() => manualCheckMutation.mutate()}
            disabled={manualCheckMutation.isPending}
            className="flex items-center gap-2 bg-[#236383] hover:bg-[#1d5470]"
          >
            <RefreshCw className={`h-4 w-4 ${manualCheckMutation.isPending ? 'animate-spin' : ''}`} />
            {manualCheckMutation.isPending ? "Checking..." : "Check Now"}
          </Button>
        </div>
      </div>

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

      {/* Current Week Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Host Location Status - This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Loading submission status...</span>
            </div>
          ) : (
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
                    <div>
                      <h4 className="font-medium text-gray-900">{status.location}</h4>
                      {status.lastSubmissionDate && (
                        <p className="text-sm text-gray-600">
                          Last submission: {new Date(status.lastSubmissionDate).toLocaleDateString()}
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
          )}
        </CardContent>
      </Card>

      {/* Expected Locations */}
      <Card>
        <CardHeader>
          <CardTitle>Expected Weekly Locations</CardTitle>
        </CardHeader>
        <CardContent>
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
                className="p-2 bg-gray-50 rounded-lg text-sm text-center"
              >
                {location}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Note: Dacula is marked as "maybe" - they may not submit every week
          </p>
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

      {(manualCheckMutation.isError || testEmailMutation.isError) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Operation failed. Please try again or check system logs.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}