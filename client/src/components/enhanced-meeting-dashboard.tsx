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
      <div className="bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 p-6 rounded-lg border border-teal-200 dark:border-teal-700">
        <h1 className="text-2xl font-bold text-teal-900 dark:text-teal-100 mb-2">
          Comprehensive Meeting Management
        </h1>
        <p className="text-teal-700 dark:text-teal-300">
          Integrated agenda planning, project tracking, and Google Sheets export with real-time synchronization
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
        {meetings.map((meeting: Meeting) => (
          <Card key={meeting.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{meeting.title}</CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" />
                      {meeting.date}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {meeting.time}
                    </div>
                  </div>
                </div>
                <Badge variant={meeting.status === 'completed' ? 'default' : 'secondary'}>
                  {meeting.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {meeting.location && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
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
                  className="w-full justify-start"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Agenda Details
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleCompileAgenda(meeting)}
                    disabled={isCompiling}
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {isCompiling ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Cog className="w-4 h-4" />
                    )}
                    Compile
                  </Button>

                  <Button
                    onClick={() => handleExportToSheets(meeting)}
                    disabled={isExporting}
                    size="sm"
                    variant="outline"
                  >
                    {isExporting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600"></div>
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Meeting Details Dialog */}
      <Dialog open={!!selectedMeeting} onOpenChange={() => setSelectedMeeting(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedMeeting?.title} - Compiled Agenda
            </DialogTitle>
          </DialogHeader>

          {agendaLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : compiledAgenda ? (
            <div className="space-y-6">
              {/* Agenda Header */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Date:</span> {compiledAgenda.date}
                  </div>
                  <div>
                    <span className="font-medium">Time:</span> {selectedMeeting?.time}
                  </div>
                  <div>
                    <span className="font-medium">Estimated Duration:</span> {compiledAgenda.totalEstimatedTime || 'TBD'}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>
                    <Badge className="ml-2" variant={compiledAgenda.status === 'finalized' ? 'default' : 'secondary'}>
                      {compiledAgenda.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Agenda Sections */}
              <div className="space-y-4">
                {compiledAgenda.sections?.map((section: AgendaSection, index: number) => (
                  <Card key={section.id} className="border-l-4 border-l-teal-500">
                    <CardHeader className="pb-3">
                      <CardTitle className={`flex items-center gap-2 text-lg ${getSectionColor(section.title)}`}>
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
                                  <h4 className="font-medium">{item.title}</h4>
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
              <div className="flex gap-4 pt-4 border-t">
                <Button
                  onClick={() => selectedMeeting && handleExportToSheets(selectedMeeting)}
                  disabled={isExporting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isExporting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Export to Google Sheets
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No compiled agenda found for this meeting.</p>
              <Button
                onClick={() => selectedMeeting && handleCompileAgenda(selectedMeeting)}
                disabled={isCompiling}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {isCompiling ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Cog className="w-4 h-4 mr-2" />
                )}
                Compile Agenda Now
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}