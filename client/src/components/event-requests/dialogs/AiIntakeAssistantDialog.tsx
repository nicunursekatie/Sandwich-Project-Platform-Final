import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ListChecks,
  Calendar,
  MapPin,
  Sandwich as SandwichIcon,
  Users
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import type { EventRequest } from '@shared/schema';

type ValidationSeverity = 'critical' | 'warning' | 'suggestion';
type ValidationCategory = 'scheduling' | 'logistics' | 'sandwiches' | 'contact' | 'verification' | 'general';

interface ValidationIssue {
  category: ValidationCategory;
  severity: ValidationSeverity;
  field: string;
  title: string;
  message: string;
  suggestion?: string;
  action?: string;
}

interface AiIntakeAssistance {
  overallStatus: 'complete' | 'needs_attention' | 'critical_missing';
  completionPercentage: number;
  criticalIssues: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationIssue[];
  aiRecommendations?: string;
  nextSteps: string[];
}

interface AiIntakeAssistantDialogProps {
  open: boolean;
  onClose: () => void;
  eventRequest: EventRequest;
}

export function AiIntakeAssistantDialog({
  open,
  onClose,
  eventRequest
}: AiIntakeAssistantDialogProps) {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<AiIntakeAssistance | null>(null);

  const analyzeEventMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<AiIntakeAssistance>(
        'POST',
        `/api/event-requests/${eventRequest.id}/ai-intake-assist`
      );
    },
    onSuccess: (data) => {
      setAnalysis(data);
    },
    onError: (error: Error) => {
      toast({
        title: 'AI Analysis Failed',
        description: error.message || 'Failed to generate intake assistance',
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    setAnalysis(null);
    onClose();
  };

  const getCategoryIcon = (category: ValidationCategory) => {
    const icons = {
      scheduling: Calendar,
      logistics: MapPin,
      sandwiches: SandwichIcon,
      contact: Users,
      verification: CheckCircle2,
      general: ListChecks,
    };
    return icons[category] || ListChecks;
  };

  const getSeverityColor = (severity: ValidationSeverity) => {
    const colors = {
      critical: 'text-red-600 dark:text-red-400',
      warning: 'text-amber-600 dark:text-amber-400',
      suggestion: 'text-blue-600 dark:text-blue-400',
    };
    return colors[severity];
  };

  const getSeverityBadge = (severity: ValidationSeverity) => {
    const styles = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      suggestion: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    };

    const labels = {
      critical: 'Critical',
      warning: 'Warning',
      suggestion: 'Suggestion',
    };

    return (
      <Badge className={`${styles[severity]} text-xs`}>
        {labels[severity]}
      </Badge>
    );
  };

  const getOverallStatusBadge = (status: 'complete' | 'needs_attention' | 'critical_missing') => {
    const styles = {
      complete: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800',
      needs_attention: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800',
      critical_missing: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800',
    };

    const labels = {
      complete: 'Complete',
      needs_attention: 'Needs Attention',
      critical_missing: 'Critical Information Missing',
    };

    const icons = {
      complete: CheckCircle2,
      needs_attention: AlertTriangle,
      critical_missing: AlertCircle,
    };

    const Icon = icons[status];

    return (
      <Badge className={`${styles[status]} text-sm font-semibold px-3 py-1.5 border`}>
        <Icon className="w-4 h-4 mr-1.5" />
        {labels[status]}
      </Badge>
    );
  };

  const IssueCard = ({ issue }: { issue: ValidationIssue }) => {
    const Icon = getCategoryIcon(issue.category);
    const severityColor = getSeverityColor(issue.severity);

    return (
      <div className="border rounded-lg p-4 space-y-3 bg-white dark:bg-gray-950">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${severityColor}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-semibold text-sm">{issue.title}</h4>
                {getSeverityBadge(issue.severity)}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {issue.message}
              </p>
              {issue.suggestion && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3 mt-2">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-900 dark:text-blue-100">
                      {issue.suggestion}
                    </p>
                  </div>
                </div>
              )}
              {issue.action && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    <span className="text-[#236383]">→</span> {issue.action}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-[#236383]" />
            <DialogTitle className="text-lg sm:text-xl">AI Intake Assistant</DialogTitle>
          </div>
          <DialogDescription className="text-sm sm:text-base">
            Get comprehensive analysis and reminders to ensure all necessary event details are collected
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 mt-4">
          {/* Event Info */}
          <div className="bg-gray-50 dark:bg-gray-900 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-xs sm:text-sm mb-2 text-gray-700 dark:text-gray-300">Event Request</h3>
            <p className="text-sm sm:text-base">
              <span className="font-medium">{eventRequest.organizationName || 'Unnamed Organization'}</span>
              {eventRequest.estimatedSandwichCount && (
                <span className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                  {' '}• ~{eventRequest.estimatedSandwichCount.toLocaleString()} sandwiches
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Status: <span className="capitalize">{eventRequest.status?.replace('_', ' ')}</span>
            </p>
          </div>

          {/* Generate or Show Analysis */}
          {!analysis && !analyzeEventMutation.isPending && (
            <div className="text-center py-6 sm:py-8 px-4">
              <div className="bg-gradient-to-br from-[#236383]/5 to-[#47B3CB]/5 dark:from-[#236383]/10 dark:to-[#47B3CB]/10 p-6 sm:p-8 rounded-xl border border-[#236383]/20">
                <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 text-[#236383] mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 text-sm sm:text-base px-2">
                  Analyze this event request for missing information and get AI-powered suggestions
                </p>
                <Button
                  onClick={() => analyzeEventMutation.mutate()}
                  className="bg-[#236383] hover:bg-[#1a4d66] text-white font-semibold px-6 py-2 sm:px-8 sm:py-3 text-sm sm:text-base shadow-md hover:shadow-lg transition-all"
                >
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Analyze Event Request
                </Button>
              </div>
            </div>
          )}

          {analyzeEventMutation.isPending && (
            <div className="text-center py-8 sm:py-12 px-4">
              <div className="bg-gradient-to-br from-[#236383]/5 to-[#47B3CB]/5 dark:from-[#236383]/10 dark:to-[#47B3CB]/10 p-6 sm:p-8 rounded-xl border border-[#236383]/20">
                <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-2 border-[#236383] mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 font-medium text-sm sm:text-base">
                  Analyzing event request...
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-xs sm:text-sm mt-2">
                  Checking for missing information and scheduling conflicts
                </p>
              </div>
            </div>
          )}

          {analysis && (
            <div className="space-y-4 sm:space-y-6">
              {/* Overall Status */}
              <div className="bg-gradient-to-br from-[#236383] to-[#47B3CB] p-1 rounded-xl shadow-lg">
                <div className="bg-white dark:bg-gray-950 p-4 sm:p-6 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-bold text-lg mb-2">Overall Status</h3>
                      {getOverallStatusBadge(analysis.overallStatus)}
                    </div>
                    <div className="text-right">
                      <p className="text-3xl sm:text-4xl font-bold text-[#236383] mb-1">
                        {analysis.completionPercentage}%
                      </p>
                      <p className="text-xs text-gray-500">Complete</p>
                    </div>
                  </div>
                  <Progress value={analysis.completionPercentage} className="h-2 mb-4" />

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center text-xs sm:text-sm">
                    <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-2 sm:p-3">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {analysis.criticalIssues.length}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">Critical</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-2 sm:p-3">
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {analysis.warnings.length}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">Warnings</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-2 sm:p-3">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {analysis.suggestions.length}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">Suggestions</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Recommendations */}
              {analysis.aiRecommendations && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-[#236383]" />
                    <h3 className="font-semibold text-base">AI Recommendations</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    To complete the intake for {eventRequest.organizationName}, please take the following actions:
                  </p>
                  <div className="space-y-3">
                    {analysis.aiRecommendations.split(/\d+\.\s+\*\*/).filter(Boolean).map((recommendation, idx) => {
                      // Parse title and content
                      const titleMatch = recommendation.match(/^(.+?)\*\*/);
                      const title = titleMatch ? titleMatch[1].trim() : '';
                      const content = recommendation.replace(/^.+?\*\*\s*-?\s*/, '').trim();
                      
                      if (!title) return null;
                      
                      // Determine icon and color based on title keywords
                      let icon = ListChecks;
                      let iconColor = 'text-[#236383]';
                      let bgColor = 'bg-blue-50 dark:bg-blue-950';
                      let borderColor = 'border-blue-200 dark:border-blue-800';
                      
                      if (title.toLowerCase().includes('contact') || title.toLowerCase().includes('reach out')) {
                        icon = Users;
                      } else if (title.toLowerCase().includes('document') || title.toLowerCase().includes('busy')) {
                        icon = AlertTriangle;
                        iconColor = 'text-amber-600 dark:text-amber-400';
                        bgColor = 'bg-amber-50 dark:bg-amber-950';
                        borderColor = 'border-amber-200 dark:border-amber-800';
                      } else if (title.toLowerCase().includes('reminder') || title.toLowerCase().includes('follow')) {
                        icon = Calendar;
                      } else if (title.toLowerCase().includes('confirm') || title.toLowerCase().includes('verify')) {
                        icon = CheckCircle2;
                        iconColor = 'text-green-600 dark:text-green-400';
                        bgColor = 'bg-green-50 dark:bg-green-950';
                        borderColor = 'border-green-200 dark:border-green-800';
                      }
                      
                      const IconComponent = icon;
                      
                      return (
                        <div key={idx} className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
                          <div className="flex items-start gap-3">
                            <div className={`${iconColor} mt-0.5 flex-shrink-0`}>
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-base mb-2 text-gray-900 dark:text-gray-100">
                                {title}
                              </h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                {content}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              {analysis.nextSteps.length > 0 && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ListChecks className="h-5 w-5 text-[#236383]" />
                    <h3 className="font-semibold text-sm">Next Steps</h3>
                  </div>
                  <ol className="space-y-2">
                    {analysis.nextSteps.map((step, idx) => (
                      <li key={idx} className="flex gap-3 text-sm">
                        <span className="font-semibold text-[#236383] flex-shrink-0">{idx + 1}.</span>
                        <span className="text-gray-700 dark:text-gray-300">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Critical Issues */}
              {analysis.criticalIssues.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <h3 className="font-semibold text-base">Critical Issues</h3>
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                      {analysis.criticalIssues.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {analysis.criticalIssues.map((issue, idx) => (
                      <IssueCard key={idx} issue={issue} />
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {analysis.warnings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="font-semibold text-base">Warnings</h3>
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      {analysis.warnings.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {analysis.warnings.map((issue, idx) => (
                      <IssueCard key={idx} issue={issue} />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {analysis.suggestions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-base">Suggestions</h3>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {analysis.suggestions.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {analysis.suggestions.map((issue, idx) => (
                      <IssueCard key={idx} issue={issue} />
                    ))}
                  </div>
                </div>
              )}

              {/* All Good Message */}
              {analysis.criticalIssues.length === 0 &&
               analysis.warnings.length === 0 &&
               analysis.suggestions.length === 0 && (
                <div className="text-center py-8 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-lg text-green-900 dark:text-green-100 mb-2">
                    All Set!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    All critical information has been collected for this event request.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 sm:pt-6 border-t mt-4 sm:mt-6">
            <Button
              variant="outline"
              onClick={handleClose}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
