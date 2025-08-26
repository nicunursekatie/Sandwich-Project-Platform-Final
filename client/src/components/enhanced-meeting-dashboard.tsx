import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  CalendarDays, Clock, Users, FileText, ExternalLink, 
  CheckCircle2, Settings, Download, Cog, 
  FolderOpen, UserCheck, Zap, Home, Plus 
} from 'lucide-react';

interface CompiledAgenda {
  id: number;
  meetingId: number;
  title: string;
  date: string;
  status: string;
  sections: AgendaSection[];
  totalEstimatedTime?: string;
  compiledAt: string;
  compiledBy: string;
}

interface AgendaSection {
  id: number;
  title: string;
  orderIndex: number;
  items: AgendaItem[];
}

interface AgendaItem {
  id?: number;
  title: string;
  description?: string;
  submittedBy: string;
  type: 'agenda_item' | 'project_review' | 'deferred_item';
  status?: string;
  projectId?: number;
  estimatedTime?: string;
}

interface Meeting {
  id: number;
  title: string;
  type: string;
  date: string;
  time: string;
  location?: string;
  status: string;
}

interface Project {
  id: number;
  title: string;
  status: string;
  priority?: string;
  description?: string;
  reviewInNextMeeting: boolean;
}

export default function EnhancedMeetingDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch meetings
  const { data: meetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ['/api/meetings'],
  });

  // Fetch projects for review
  const { data: projectsForReview = [] } = useQuery({
    queryKey: ['/api/projects/for-review'],
  });

  // Fetch compiled agenda for selected meeting
  const { data: compiledAgenda, isLoading: agendaLoading } = useQuery({
    queryKey: ['/api/meetings', selectedMeeting?.id, 'compiled-agenda'],
    enabled: !!selectedMeeting,
  });

  // Helper function to format dates in a user-friendly way
  const formatMeetingDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // Helper function to format time in a user-friendly way
  const formatMeetingTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Helper function to determine if meeting is in the past
  const isPastMeeting = (dateString: string, timeString: string) => {
    const meetingDateTime = new Date(`${dateString}T${timeString}`);
    return meetingDateTime < new Date();
  };

  // Compile agenda mutation
  const compileAgendaMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      const response = await fetch(`/api/meetings/${meetingId}/compile-agenda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to compile agenda');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      toast({ title: 'Agenda compiled successfully with all required sections!' });
      setIsCompiling(false);
    },
    onError: () => {
      toast({ title: 'Failed to compile agenda', variant: 'destructive' });
      setIsCompiling(false);
    },
  });

  // Export to Google Sheets mutation
  const exportToSheetsMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      const response = await fetch(`/api/meetings/${meetingId}/export-to-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to export to Google Sheets');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Successfully exported to Google Sheets!',
        description: `View at: ${data.sheetUrl}`
      });
      setIsExporting(false);
    },
    onError: () => {
      toast({ title: 'Failed to export to Google Sheets', variant: 'destructive' });
      setIsExporting(false);
    },
  });

  const handleCompileAgenda = (meeting: Meeting) => {
    setIsCompiling(true);
    compileAgendaMutation.mutate(meeting.id);
  };

  const handleExportToSheets = (meeting: Meeting) => {
    setIsExporting(true);
    exportToSheetsMutation.mutate(meeting.id);
  };

  const getSectionIcon = (title: string) => {
    switch (title) {
      case 'Old Business': return <FolderOpen className="w-4 h-4" />;
      case 'Urgent Items': return <Zap className="w-4 h-4" />;
      case 'Housekeeping': return <Home className="w-4 h-4" />;
      case 'New Business': return <Plus className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getSectionColor = (title: string) => {
    switch (title) {
      case 'Old Business': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Urgent Items': return 'bg-red-100 text-red-800 border-red-200';
      case 'Housekeeping': return 'bg-green-100 text-green-800 border-green-200';
      case 'New Business': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (meetingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-lg border border-blue-200 dark:border-blue-700">
        <h1 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-2">
          Meeting Management
        </h1>
        <p className="text-blue-800 dark:text-blue-200">
          Weekly agenda compilation from Google Sheet projects and meeting documentation
        </p>
      </div>

      {/* Projects for Review Alert */}
      {projectsForReview.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-orange-800 dark:text-orange-200 flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              {projectsForReview.length} Projects Marked for Meeting Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {projectsForReview.slice(0, 3).map((project: Project) => (
                <div key={project.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {project.priority || 'Medium'}
                    </Badge>
                    <span className="font-medium">{project.title}</span>
                  </div>
                  <Badge variant="secondary">{project.status}</Badge>
                </div>
              ))}
              {projectsForReview.length > 3 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  +{projectsForReview.length - 3} more projects
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meetings Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {meetings.map((meeting: Meeting) => {
          const isOldMeeting = isPastMeeting(meeting.date, meeting.time);
          
          return (
            <Card key={meeting.id} className={`hover:shadow-md transition-shadow ${isOldMeeting ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className={`text-lg ${isOldMeeting ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      {meeting.title}
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <div className="flex items-center gap-1">
                        <CalendarDays className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-900 dark:text-gray-100 font-medium">
                          {formatMeetingDate(meeting.date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-900 dark:text-gray-100 font-medium">
                          {formatMeetingTime(meeting.time)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={isOldMeeting ? 'secondary' : 'default'} className={isOldMeeting ? 'bg-gray-200 text-gray-700' : ''}>
                    {isOldMeeting ? 'Past' : 'Upcoming'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {meeting.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <Users className="w-4 h-4" />
                    {meeting.location}
                  </div>
                )}

                <Separator />

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    onClick={() => setSelectedMeeting(meeting)}
                    variant="outline"
                    className="w-full justify-start bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Agenda Details
                  </Button>

                  {/* Only show compile button for upcoming meetings */}
                  {!isOldMeeting && (
                    <Button
                      onClick={() => handleCompileAgenda(meeting)}
                      disabled={isCompiling}
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isCompiling ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Cog className="w-4 h-4 mr-2" />
                      )}
                      Compile Weekly Agenda
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Meeting Details Dialog */}
      <Dialog open={!!selectedMeeting} onOpenChange={() => setSelectedMeeting(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedMeeting?.title} - {selectedMeeting && isPastMeeting(selectedMeeting.date, selectedMeeting.time) ? 'Meeting Documentation' : 'Agenda Review'}
            </DialogTitle>
          </DialogHeader>

          {selectedMeeting && isPastMeeting(selectedMeeting.date, selectedMeeting.time) ? (
            // Past Meeting - Show PDF preview and download
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-900 dark:text-blue-100">Date:</span> 
                    <span className="ml-2 text-blue-800 dark:text-blue-200">{formatMeetingDate(selectedMeeting.date)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-900 dark:text-blue-100">Time:</span> 
                    <span className="ml-2 text-blue-800 dark:text-blue-200">{formatMeetingTime(selectedMeeting.time)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-900 dark:text-blue-100">Status:</span>
                    <Badge className="ml-2 bg-gray-200 text-gray-700">Completed</Badge>
                  </div>
                </div>
              </div>

              {/* PDF Preview Area */}
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Meeting Agenda PDF</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  View the compiled agenda that was used during this meeting
                </p>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  Download Agenda PDF
                </Button>
              </div>

              {/* Meeting Notes Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Meeting Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-400 italic">
                    Meeting notes and action items would be displayed here once available.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : agendaLoading ? (
            // Loading state for upcoming meetings
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : compiledAgenda ? (
            // Upcoming Meeting - Show compiled agenda with export options
            <div className="space-y-6">
              {/* Agenda Header */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-900 dark:text-blue-100">Date:</span> 
                    <span className="ml-2 text-blue-800 dark:text-blue-200">{formatMeetingDate(selectedMeeting?.date || '')}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-900 dark:text-blue-100">Time:</span> 
                    <span className="ml-2 text-blue-800 dark:text-blue-200">{formatMeetingTime(selectedMeeting?.time || '')}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-900 dark:text-blue-100">Duration:</span> 
                    <span className="ml-2 text-blue-800 dark:text-blue-200">{compiledAgenda.totalEstimatedTime || '1 hour'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-900 dark:text-blue-100">Status:</span>
                    <Badge className="ml-2" variant={compiledAgenda.status === 'finalized' ? 'default' : 'secondary'}>
                      {compiledAgenda.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Agenda Sections */}
              <div className="space-y-4">
                {compiledAgenda.sections?.map((section: AgendaSection, index: number) => (
                  <Card key={section.id} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <CardTitle className={`flex items-center gap-2 text-lg ${getSectionColor(section.title)} bg-white dark:bg-gray-800 px-3 py-2 rounded`}>
                        {getSectionIcon(section.title)}
                        {section.title}
                        <Badge variant="outline" className="ml-auto">
                          {section.items?.length || 0} items
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {section.items && section.items.length > 0 ? (
                        <div className="space-y-3">
                          {section.items.map((item: AgendaItem, itemIndex: number) => (
                            <div key={itemIndex} className="p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900 dark:text-gray-100">{item.title}</h4>
                                  {item.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                      {item.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    <span>Presenter: {item.submittedBy}</span>
                                    <span>Time: {item.estimatedTime || '5 min'}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {item.type.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                </div>
                                {item.status && (
                                  <Badge variant={item.status === 'approved' ? 'default' : 'secondary'}>
                                    {item.status}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No items in this section</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Export Actions */}
              <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={() => selectedMeeting && handleExportToSheets(selectedMeeting)}
                  disabled={isExporting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isExporting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Export to Google Sheets
                </Button>
                <Button
                  disabled={isExporting}
                  variant="outline"
                  className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export as PDF
                </Button>
              </div>
            </div>
          ) : (
            // No agenda compiled yet for upcoming meeting
            <div className="text-center py-8">
              <Cog className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Ready to Compile Weekly Agenda</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Compile the agenda from your Google Sheet projects and submitted agenda items
              </p>
              <Button
                onClick={() => selectedMeeting && handleCompileAgenda(selectedMeeting)}
                disabled={isCompiling}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isCompiling ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Cog className="w-4 h-4 mr-2" />
                )}
                Compile Weekly Agenda
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}