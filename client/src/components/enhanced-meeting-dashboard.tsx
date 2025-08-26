import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient as baseQueryClient } from '@/lib/queryClient';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  CalendarDays, Clock, Users, FileText, ExternalLink, 
  CheckCircle2, Settings, Download, Cog, Plus,
  FolderOpen, UserCheck, Zap, Home, ChevronRight,
  Calendar, RotateCcw, ArrowLeft, ArrowRight, Grid3X3,
  AlertCircle, BookOpen, Lightbulb, Target
} from 'lucide-react';

interface Meeting {
  id: number;
  title: string;
  date: string;
  time: string;
  type: string;
  status: string;
  location?: string;
  description?: string;
  finalAgenda?: string;
}

interface AgendaItem {
  id: number;
  title: string;
  description?: string;
  submittedBy: string;
  type: string;
  status?: string;
  estimatedTime?: string;
  meetingId?: number;
}

interface AgendaSection {
  id: number;
  title: string;
  items: AgendaItem[];
}

interface CompiledAgenda {
  id: number;
  meetingId: number;
  date: string;
  status: string;
  totalEstimatedTime?: string;
  sections?: AgendaSection[];
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
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [showNewMeetingDialog, setShowNewMeetingDialog] = useState(false);

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
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Helper function to format time in a user-friendly way
  const formatMeetingTime = (timeString: string) => {
    if (!timeString || timeString === 'TBD') return 'TBD';
    
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
    try {
      // Handle "TBD" time or missing time by using end of day
      let effectiveTime = timeString;
      if (!timeString || timeString === 'TBD' || timeString === '') {
        effectiveTime = '23:59'; // End of day - be conservative
      }
      
      // Ensure time is in HH:MM format
      if (!effectiveTime.includes(':')) {
        effectiveTime = '12:00'; // Default to noon if no colon
      }
      
      // Parse the date and time explicitly
      const [year, month, day] = dateString.split('-').map(Number);
      const [hours, minutes] = effectiveTime.split(':').map(Number);
      
      const meetingDate = new Date(year, month - 1, day, hours, minutes); // month is 0-indexed
      const now = new Date();
      return meetingDate < now;
    } catch (error) {
      console.error('Error parsing meeting date:', error, { dateString, timeString });
      // If parsing fails, check if the date is clearly in the past
      const now = new Date();
      const meetingDate = new Date(dateString);
      return meetingDate < now;
    }
  };

  // Helper function to get current date range for breadcrumbs
  const getCurrentDateRange = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
    
    return {
      week: `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };
  };

  const dateRange = getCurrentDateRange();

  // Compile agenda mutation
  const compileAgendaMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      return await apiRequest(`/api/meetings/${meetingId}/compile-agenda`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Agenda Compiled Successfully",
        description: "The meeting agenda has been compiled from Google Sheet projects and submitted items.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      if (selectedMeeting) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/meetings', selectedMeeting.id, 'compiled-agenda'] 
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Compilation Failed",
        description: error.message || "Failed to compile agenda. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Export to sheets mutation
  const exportToSheetsMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      return await apiRequest(`/api/meetings/${meetingId}/export-to-sheets`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Export Successful",
        description: "Meeting agenda has been exported to Google Sheets.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export to Google Sheets. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCompileAgenda = (meeting: Meeting) => {
    setIsCompiling(true);
    compileAgendaMutation.mutate(meeting.id, {
      onSettled: () => setIsCompiling(false),
    });
  };

  const handleExportToSheets = (meeting: Meeting) => {
    setIsExporting(true);
    exportToSheetsMutation.mutate(meeting.id, {
      onSettled: () => setIsExporting(false),
    });
  };

  const handleDownloadPDF = async (meeting: Meeting | null) => {
    if (!meeting) return;
    
    try {
      const response = await fetch(`/api/meetings/${meeting.id}/download-pdf`, {
        method: 'GET',
        credentials: 'include', // Include session cookies
      });

      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${meeting.title.replace(/[^a-zA-Z0-9\s]/g, '_')}_${meeting.date}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: "Meeting agenda PDF has been downloaded successfully.",
      });
    } catch (error) {
      console.error('PDF download error:', error);
      toast({
        title: "Download Failed", 
        description: "Failed to download the meeting agenda PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Helper functions for agenda section icons and colors
  const getSectionIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case 'old business': return <RotateCcw className="w-4 h-4 text-blue-600" />;
      case 'urgent items': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'housekeeping': return <Home className="w-4 h-4 text-green-600" />;
      case 'new business': return <Lightbulb className="w-4 h-4 text-orange-600" />;
      default: return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getSectionColor = (title: string) => {
    switch (title.toLowerCase()) {
      case 'old business': return 'text-blue-800';
      case 'urgent items': return 'text-red-800';
      case 'housekeeping': return 'text-green-800';
      case 'new business': return 'text-orange-800';
      default: return 'text-gray-800';
    }
  };

  // Separate meetings into upcoming and past
  const upcomingMeetings = meetings.filter((meeting: Meeting) => 
    !isPastMeeting(meeting.date, meeting.time)
  );
  const pastMeetings = meetings.filter((meeting: Meeting) => 
    isPastMeeting(meeting.date, meeting.time)
  );

  if (meetingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
        <Home className="w-4 h-4" />
        <ChevronRight className="w-4 h-4" />
        <span>Planning & Coordination</span>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-teal-600">Meeting Management</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-500">{dateRange.week}</span>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-orange-50 p-6 rounded-lg border border-teal-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-teal-900 mb-2">
              Meeting Management
            </h1>
            <p className="text-teal-700">
              Weekly agenda compilation from Google Sheet projects and meeting documentation
            </p>
          </div>
          <div className="text-right text-sm text-teal-600">
            <div className="font-medium">{dateRange.month}</div>
            <div className="text-xs text-teal-500">Current Week: {dateRange.week}</div>
          </div>
        </div>
      </div>

      {/* Projects for Review Alert */}
      {projectsForReview.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Target className="w-5 h-5" />
              Projects Requiring Review ({projectsForReview.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700 mb-3">
              The following projects are marked for review in the next meeting and will be automatically included in compiled agendas:
            </p>
            <div className="space-y-2">
              {projectsForReview.slice(0, 3).map((project: Project) => (
                <div key={project.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="border-orange-300 text-orange-700">
                    {project.priority || 'Standard'}
                  </Badge>
                  <span className="text-orange-800">{project.title}</span>
                </div>
              ))}
              {projectsForReview.length > 3 && (
                <p className="text-sm text-orange-600 italic">
                  + {projectsForReview.length - 3} more projects...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'grid'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-gray-600 hover:text-teal-700'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'calendar'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-gray-600 hover:text-teal-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Calendar</span>
          </button>
        </div>
        <button
          onClick={() => setShowNewMeetingDialog(true)}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2.5 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Meeting</span>
        </button>
      </div>

      {/* Upcoming Meetings Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-teal-900">Upcoming Meetings</h2>
          <Badge className="bg-teal-100 text-teal-800">
            {upcomingMeetings.length} scheduled
          </Badge>
        </div>

        {upcomingMeetings.length === 0 ? (
          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Meetings</h3>
              <p className="text-gray-600 mb-4">Schedule your next team meeting to get started.</p>
              <button 
                onClick={() => setShowNewMeetingDialog(true)}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                Schedule First Meeting
              </button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingMeetings.map((meeting: Meeting) => (
              <Card key={meeting.id} className="hover:shadow-lg transition-all duration-200 border-teal-200 bg-gradient-to-br from-white to-teal-50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg text-teal-900">
                        {meeting.title}
                      </CardTitle>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div className="flex items-center gap-1">
                          <CalendarDays className="w-4 h-4 text-teal-600" />
                          <span className="text-teal-800 font-medium">
                            {formatMeetingDate(meeting.date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-orange-600" />
                          <span className="text-orange-800 font-medium">
                            {formatMeetingTime(meeting.time)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      Upcoming
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {meeting.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Users className="w-4 h-4 text-gray-500" />
                      {meeting.location}
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedMeeting(meeting)}
                      className="w-full flex items-center justify-start gap-3 px-4 py-2.5 border border-teal-200 text-teal-700 hover:bg-teal-50 hover:border-teal-300 rounded-lg font-medium transition-all duration-200"
                    >
                      <FileText className="w-4 h-4" />
                      View Agenda Details
                    </button>

                    <button
                      onClick={() => handleCompileAgenda(meeting)}
                      disabled={isCompiling}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2.5 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:cursor-not-allowed"
                    >
                      {isCompiling ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Cog className="w-4 h-4" />
                      )}
                      Compile Weekly Agenda
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Past Meetings Section */}
      {pastMeetings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-700">Past Meetings</h2>
            <Badge variant="secondary" className="bg-gray-100 text-gray-700">
              {pastMeetings.length} completed
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pastMeetings.slice(0, 6).map((meeting: Meeting) => (
              <Card key={meeting.id} className="bg-gray-50 border-gray-200 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg text-gray-700">
                        {meeting.title}
                      </CardTitle>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div className="flex items-center gap-1">
                          <CalendarDays className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600 font-medium">
                            {formatMeetingDate(meeting.date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600 font-medium">
                            {formatMeetingTime(meeting.time)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                      Completed
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <button
                    onClick={() => setSelectedMeeting(meeting)}
                    className="w-full flex items-center justify-start gap-3 px-4 py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400 rounded-lg font-medium transition-all duration-200"
                  >
                    <FileText className="w-4 h-4" />
                    View Meeting Documentation
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

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
              <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-teal-900">Date:</span> 
                    <span className="ml-2 text-teal-800">{formatMeetingDate(selectedMeeting.date)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-teal-900">Time:</span> 
                    <span className="ml-2 text-teal-800">{formatMeetingTime(selectedMeeting.time)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-teal-900">Status:</span>
                    <Badge className="ml-2 bg-gray-200 text-gray-700">Completed</Badge>
                  </div>
                </div>
              </div>

              {/* PDF Preview Area */}
              <div className="border-2 border-dashed border-teal-300 rounded-lg p-8 text-center bg-teal-50/50">
                <FileText className="w-16 h-16 text-teal-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-teal-900 mb-2">Meeting Agenda PDF</h3>
                <p className="text-teal-700 mb-4">
                  View the compiled agenda that was used during this meeting
                </p>
                <button 
                  onClick={() => handleDownloadPDF(selectedMeeting)}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white px-6 py-3 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                >
                  <Download className="w-4 h-4" />
                  Download Agenda PDF
                </button>
              </div>

              {/* Meeting Notes Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-teal-600" />
                    Meeting Notes & Action Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 italic">
                    Meeting notes and action items would be displayed here once available.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : agendaLoading ? (
            // Loading state for upcoming meetings
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : compiledAgenda ? (
            // Upcoming Meeting - Show compiled agenda with export options
            <div className="space-y-6">
              {/* Agenda Header */}
              <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-teal-900">Date:</span> 
                    <span className="ml-2 text-teal-800">{formatMeetingDate(selectedMeeting?.date || '')}</span>
                  </div>
                  <div>
                    <span className="font-medium text-teal-900">Time:</span> 
                    <span className="ml-2 text-teal-800">{formatMeetingTime(selectedMeeting?.time || '')}</span>
                  </div>
                  <div>
                    <span className="font-medium text-teal-900">Duration:</span> 
                    <span className="ml-2 text-teal-800">{compiledAgenda.totalEstimatedTime || '1 hour'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-teal-900">Status:</span>
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
                      <CardTitle className={`flex items-center gap-2 text-lg ${getSectionColor(section.title)} bg-white px-3 py-2 rounded`}>
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
                            <div key={itemIndex} className="p-3 bg-gray-50 rounded border">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">{item.title}</h4>
                                  {item.description && (
                                    <p className="text-sm text-gray-600 mt-1">
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
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => selectedMeeting && handleExportToSheets(selectedMeeting)}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2.5 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Export to Google Sheets
                </button>
                <button
                  onClick={() => handleDownloadPDF(selectedMeeting)}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 border border-teal-300 text-teal-600 hover:bg-teal-50 hover:border-teal-400 disabled:border-gray-300 disabled:text-gray-400 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Export as PDF
                </button>
              </div>
            </div>
          ) : (
            // No agenda compiled yet for upcoming meeting
            <div className="text-center py-8">
              <Cog className="w-16 h-16 text-teal-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-teal-900 mb-2">Ready to Compile Weekly Agenda</h3>
              <p className="text-teal-700 mb-6">
                Compile the agenda from your Google Sheet projects and submitted agenda items
              </p>
              <button
                onClick={() => selectedMeeting && handleCompileAgenda(selectedMeeting)}
                disabled={isCompiling}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isCompiling ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Cog className="w-4 h-4" />
                )}
                Compile Weekly Agenda
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}