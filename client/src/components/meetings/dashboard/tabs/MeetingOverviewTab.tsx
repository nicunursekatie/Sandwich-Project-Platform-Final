import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { NewMeetingDialog } from '../dialogs/NewMeetingDialog';
import { EditMeetingDialog } from '../dialogs/EditMeetingDialog';
import { MeetingDetailsDialog } from '../dialogs/MeetingDetailsDialog';
import { formatMeetingDate, formatMeetingTime, isPastMeeting } from '../utils/date';
import {
  CalendarDays,
  Clock,
  Users,
  FileText,
  Cog,
  Plus,
  Grid3X3,
  Calendar,
  Edit3,
  Target
} from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';

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

interface CompiledAgenda {
  id: number;
  meetingId: number;
  date: string;
  status: string;
  totalEstimatedTime?: string;
  sections?: Array<{
    id: number;
    title: string;
    items: any[];
  }>;
}

interface Project {
  id: number;
  title: string;
  status: string;
  priority?: string;
  description?: string;
  reviewInNextMeeting: boolean;
  meetingDiscussionPoints?: string;
  meetingDecisionItems?: string;
  supportPeople?: string;
  assigneeName?: string;
}

interface MeetingOverviewTabProps {
  // State
  selectedMeeting: Meeting | null;
  setSelectedMeeting: (meeting: Meeting | null) => void;
  viewMode: 'grid' | 'calendar';
  setViewMode: (mode: 'grid' | 'calendar') => void;
  showNewMeetingDialog: boolean;
  setShowNewMeetingDialog: (show: boolean) => void;
  showEditMeetingDialog: boolean;
  setShowEditMeetingDialog: (show: boolean) => void;
  showMeetingDetailsDialog: boolean;
  setShowMeetingDetailsDialog: (show: boolean) => void;
  newMeetingData: {
    title: string;
    date: string;
    time: string;
    type: string;
    location: string;
    description: string;
  };
  setNewMeetingData: (data: any) => void;
  editMeetingData: {
    title: string;
    date: string;
    time: string;
    type: string;
    location: string;
    description: string;
  };
  setEditMeetingData: (data: any) => void;
  isCompiling: boolean;
  isExporting: boolean;
  
  // Data
  upcomingMeetings: Meeting[];
  pastMeetings: Meeting[];
  projectsForReview: Project[];
  compiledAgenda: CompiledAgenda | undefined;
  agendaLoading: boolean;
  
  // Handlers
  handleCreateMeeting: () => void;
  handleUpdateMeeting: () => void;
  handleDeleteMeeting: () => void;
  handleEditMeeting: (meeting: Meeting) => void;
  handleCompileAgenda: (meeting: Meeting) => void;
  handleExportToSheets: (meeting: Meeting) => void;
  handleDownloadPDF: (meeting: Meeting | null) => Promise<void>;
  getSectionIcon: (title: string) => React.ReactNode;
  getSectionColor: (title: string) => string;
  
  // Mutations
  createMeetingMutation: UseMutationResult<any, Error, any, unknown>;
  updateMeetingMutation: UseMutationResult<any, Error, any, unknown>;
  deleteMeetingMutation: UseMutationResult<any, Error, any, unknown>;
}

export function MeetingOverviewTab({
  selectedMeeting,
  setSelectedMeeting,
  viewMode,
  setViewMode,
  showNewMeetingDialog,
  setShowNewMeetingDialog,
  showEditMeetingDialog,
  setShowEditMeetingDialog,
  showMeetingDetailsDialog,
  setShowMeetingDetailsDialog,
  newMeetingData,
  setNewMeetingData,
  editMeetingData,
  setEditMeetingData,
  isCompiling,
  isExporting,
  upcomingMeetings,
  pastMeetings,
  projectsForReview,
  compiledAgenda,
  agendaLoading,
  handleCreateMeeting,
  handleUpdateMeeting,
  handleDeleteMeeting,
  handleEditMeeting,
  handleCompileAgenda,
  handleExportToSheets,
  handleDownloadPDF,
  getSectionIcon,
  getSectionColor,
  createMeetingMutation,
  updateMeetingMutation,
  deleteMeetingMutation
}: MeetingOverviewTabProps) {
  return (
    <>
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
              The following projects have been marked for review in your next
              meeting:
            </p>
            <ul className="space-y-2">
              {projectsForReview.slice(0, 5).map((project) => (
                <li key={project.id} className="flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5">•</span>
                  <div>
                    <span className="font-medium text-orange-900">
                      {project.title}
                    </span>
                    {project.priority && (
                      <Badge className="ml-2 text-xs" variant="outline">
                        {project.priority}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {projectsForReview.length > 5 && (
              <p className="text-sm text-orange-600 mt-3">
                +{projectsForReview.length - 5} more projects
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* View Toggle & New Meeting Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            data-testid="view-mode-grid"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === 'grid'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-gray-600 hover:text-teal-700'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            Grid
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            data-testid="view-mode-calendar"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === 'calendar'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-gray-600 hover:text-teal-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </button>
        </div>

        <Button
          onClick={() => setShowNewMeetingDialog(true)}
          data-testid="button-new-meeting"
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Meeting
        </Button>
      </div>

      {/* Upcoming Meetings Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Upcoming Meetings
        </h2>

        {upcomingMeetings.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600 mb-4">No upcoming meetings scheduled</p>
              <Button
                onClick={() => setShowNewMeetingDialog(true)}
                data-testid="button-schedule-first"
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Schedule Your First Meeting
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {upcomingMeetings.map((meeting: Meeting) => (
              <Card
                key={meeting.id}
                data-testid={`card-meeting-${meeting.id}`}
                className="hover:shadow-lg transition-all duration-200 border-teal-200 bg-gradient-to-br from-white to-teal-50"
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between space-y-3 md:space-y-0">
                    <div className="flex-1">
                      <CardTitle className="text-base md:text-lg text-teal-900 mb-2">
                        {meeting.title}
                      </CardTitle>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
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
                    <div className="flex items-center gap-2 self-start">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditMeeting(meeting)}
                        data-testid={`button-edit-${meeting.id}`}
                        className="h-8 px-3 md:h-7 md:px-2"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span className="ml-1 md:hidden">Edit</span>
                      </Button>
                      <Badge className="bg-teal-100 text-teal-800 text-xs">
                        Upcoming
                      </Badge>
                    </div>
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

                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedMeeting(meeting)}
                      data-testid={`button-view-agenda-${meeting.id}`}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-teal-200 text-teal-700 hover:bg-teal-50 hover:border-teal-300 rounded-lg font-medium transition-all duration-200 text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      View Agenda Details
                    </button>

                    <button
                      onClick={() => handleCompileAgenda(meeting)}
                      disabled={isCompiling}
                      data-testid={`button-compile-${meeting.id}`}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-3 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:cursor-not-allowed text-sm"
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
            <h2 className="text-xl font-semibold text-gray-700">
              Past Meetings
            </h2>
            <Badge
              variant="secondary"
              className="bg-gray-100 text-gray-700"
            >
              {pastMeetings.length} completed
            </Badge>
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {pastMeetings.slice(0, 6).map((meeting: Meeting) => (
              <Card
                key={meeting.id}
                data-testid={`card-past-meeting-${meeting.id}`}
                className="bg-gray-50 border-gray-200 hover:shadow-md transition-shadow"
              >
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
                    <Badge
                      variant="secondary"
                      className="bg-gray-200 text-gray-700"
                    >
                      Completed
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <button
                    onClick={() => {
                      setSelectedMeeting(meeting);
                      setShowMeetingDetailsDialog(true);
                    }}
                    data-testid={`button-view-documentation-${meeting.id}`}
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
      <MeetingDetailsDialog
        open={showMeetingDetailsDialog}
        onOpenChange={setShowMeetingDetailsDialog}
        selectedMeeting={selectedMeeting}
        isPastMeeting={isPastMeeting}
        formatMeetingDate={formatMeetingDate}
        formatMeetingTime={formatMeetingTime}
        handleDownloadPDF={handleDownloadPDF}
        compiledAgenda={compiledAgenda}
        agendaLoading={agendaLoading}
        handleExportToSheets={handleExportToSheets}
        handleCompileAgenda={handleCompileAgenda}
        isExporting={isExporting}
        isCompiling={isCompiling}
        getSectionIcon={getSectionIcon}
        getSectionColor={getSectionColor}
      />

      {/* New Meeting Dialog */}
      <NewMeetingDialog
        open={showNewMeetingDialog}
        onOpenChange={setShowNewMeetingDialog}
        newMeetingData={newMeetingData}
        setNewMeetingData={setNewMeetingData}
        handleCreateMeeting={handleCreateMeeting}
        isCreating={createMeetingMutation.isPending}
      />

      {/* Edit Meeting Dialog */}
      <EditMeetingDialog
        open={showEditMeetingDialog}
        onOpenChange={setShowEditMeetingDialog}
        editMeetingData={editMeetingData}
        setEditMeetingData={setEditMeetingData}
        handleUpdateMeeting={handleUpdateMeeting}
        handleDeleteMeeting={handleDeleteMeeting}
        isUpdating={updateMeetingMutation.isPending}
        isDeleting={deleteMeetingMutation.isPending}
      />
    </>
  );
}