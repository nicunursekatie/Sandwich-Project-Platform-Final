import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Calendar, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import type { EventRequest } from '@shared/schema';

interface DateAnalysis {
  date: string;
  weekStarting: string;
  totalScheduledSandwiches: number;
  eventCount: number;
  isOptimal: boolean;
}

interface AiSuggestion {
  recommendedDate: string;
  reasoning: string;
  dateAnalysis: DateAnalysis[];
  confidence: 'high' | 'medium' | 'low';
}

interface AiDateSuggestionDialogProps {
  open: boolean;
  onClose: () => void;
  eventRequest: EventRequest;
  onSelectDate?: (date: string) => void;
}

export function AiDateSuggestionDialog({ 
  open, 
  onClose, 
  eventRequest,
  onSelectDate 
}: AiDateSuggestionDialogProps) {
  const { toast } = useToast();
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);

  const generateSuggestionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<AiSuggestion>(
        `/api/event-requests/${eventRequest.id}/ai-suggest-dates`,
        'POST'
      );
    },
    onSuccess: (data) => {
      setSuggestion(data);
    },
    onError: (error: Error) => {
      toast({
        title: 'AI Analysis Failed',
        description: error.message || 'Failed to generate date suggestions',
        variant: 'destructive',
      });
    },
  });

  const handleClose = () => {
    setSuggestion(null);
    onClose();
  };

  const handleSelectDate = (date: string) => {
    if (onSelectDate) {
      onSelectDate(date);
    }
    handleClose();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatWeek = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    };

    const labels = {
      high: 'High Confidence',
      medium: 'Medium Confidence',
      low: 'Low Confidence',
    };

    return (
      <Badge className={colors[confidence]}>
        {labels[confidence]}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#236383]" />
            <DialogTitle>AI Scheduling Assistant</DialogTitle>
          </div>
          <DialogDescription>
            Let AI analyze available dates and suggest the optimal time based on your current schedule
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Event Info */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h3 className="font-semibold text-sm mb-2">Event Details</h3>
            <p className="text-sm">
              <span className="font-medium">{eventRequest.organizationName}</span>
              {eventRequest.estimatedSandwichCount && (
                <span className="text-gray-600 dark:text-gray-400">
                  {' '}• ~{eventRequest.estimatedSandwichCount.toLocaleString()} sandwiches
                </span>
              )}
            </p>
          </div>

          {/* Generate or Show Suggestions */}
          {!suggestion && !generateSuggestionMutation.isPending && (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 text-[#236383] mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Analyze the available dates and get AI-powered scheduling recommendations
              </p>
              <Button
                onClick={() => generateSuggestionMutation.mutate()}
                className="bg-[#236383] hover:bg-[#1a4d66]"
                data-testid="button-generate-ai-suggestion"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Suggestions
              </Button>
            </div>
          )}

          {generateSuggestionMutation.isPending && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#236383] mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">
                Analyzing dates and current schedule...
              </p>
            </div>
          )}

          {suggestion && (
            <div className="space-y-6">
              {/* Confidence Badge */}
              <div className="flex justify-center">
                {getConfidenceBadge(suggestion.confidence)}
              </div>

              {/* AI Recommendation */}
              <div className="bg-gradient-to-br from-[#236383]/10 to-[#47B3CB]/10 dark:from-[#236383]/20 dark:to-[#47B3CB]/20 p-6 rounded-lg border border-[#236383]/20">
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-[#236383] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Recommended Date</h3>
                    <p className="text-2xl font-bold text-[#236383] mb-3">
                      {formatDate(suggestion.recommendedDate)}
                    </p>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {suggestion.reasoning}
                      </p>
                    </div>
                  </div>
                </div>

                {onSelectDate && (
                  <Button
                    onClick={() => handleSelectDate(suggestion.recommendedDate)}
                    className="w-full bg-[#236383] hover:bg-[#1a4d66] mt-4"
                    data-testid="button-select-recommended-date"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Use This Date for Scheduling
                  </Button>
                )}
              </div>

              {/* Date Analysis Details */}
              <div>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Date Analysis
                </h3>
                <div className="space-y-3">
                  {suggestion.dateAnalysis.map((analysis, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border ${
                        analysis.isOptimal
                          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                          : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-medium">{formatDate(analysis.date)}</p>
                            {analysis.isOptimal && (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Good Balance
                              </Badge>
                            )}
                            {!analysis.isOptimal && analysis.eventCount > 3 && (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                Busy Week
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            <p>Week of {formatWeek(analysis.weekStarting)}</p>
                            <div className="flex gap-4">
                              <span>
                                📅 {analysis.eventCount} {analysis.eventCount === 1 ? 'event' : 'events'} scheduled
                              </span>
                              <span>
                                🥪 {analysis.totalScheduledSandwiches.toLocaleString()} sandwiches
                              </span>
                            </div>
                          </div>
                        </div>
                        {analysis.date === suggestion.recommendedDate && (
                          <CheckCircle2 className="h-6 w-6 text-[#236383] flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              data-testid="button-close-ai-dialog"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
