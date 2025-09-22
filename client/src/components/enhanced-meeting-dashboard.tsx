import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { queryClient as baseQueryClient, apiRequest } from '@/lib/queryClient';
import {
  formatDateForInput,
  formatDateForDisplay,
  normalizeDate,
  isDateInPast,
  getTodayString,
  formatTimeForDisplay,
} from '@/lib/date-utils';

// Import centralized hooks
import { useMeetings } from './meetings/dashboard/hooks/useMeetings';
import { useProjects } from './meetings/dashboard/hooks/useProjects';
import { useAgenda } from './meetings/dashboard/hooks/useAgenda';
import { useFiles } from './meetings/dashboard/hooks/useFiles';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ObjectUploader } from '@/components/ObjectUploader';
import { ProjectAssigneeSelector } from '@/components/project-assignee-selector';
import { TaskAssigneeSelector } from '@/components/task-assignee-selector';
import { ProjectTasksView } from './meetings/dashboard/sections/ProjectTasksView';
import { NewMeetingDialog } from './meetings/dashboard/dialogs/NewMeetingDialog';
import { EditMeetingDialog } from './meetings/dashboard/dialogs/EditMeetingDialog';
import { AddProjectDialog } from './meetings/dashboard/dialogs/AddProjectDialog';
import { MeetingDetailsDialog } from './meetings/dashboard/dialogs/MeetingDetailsDialog';
import { MeetingOverviewTab } from './meetings/dashboard/tabs/MeetingOverviewTab';
import { AgendaPlanningTab } from './meetings/dashboard/tabs/AgendaPlanningTab';
import { NotesTab } from './meetings/dashboard/tabs/NotesTab';
import { getCategoryIcon } from './meetings/dashboard/utils/categories';
import { formatStatusText, getStatusBadgeProps } from './meetings/dashboard/utils/status';
import { formatMeetingDate, formatMeetingTime, isPastMeeting, getCurrentDateRange, formatSectionName } from './meetings/dashboard/utils/date';
import {
  CalendarDays,
  Clock,
  Users,
  FileText,
  ExternalLink,
  CheckCircle2,
  Settings,
  Download,
  Cog,
  Plus,
  FolderOpen,
  UserCheck,
  Zap,
  Home,
  ChevronRight,
  Calendar,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Grid3X3,
  AlertCircle,
  BookOpen,
  Lightbulb,
  Target,
  Filter,
  Check,
  Play,
  MapPin,
  X,
  UserPlus,
  Edit3,
  UserCog,
  Trash2,
} from 'lucide-react';

// Import types from the hooks
import type { Meeting, MeetingFormData } from './meetings/dashboard/hooks/useMeetings';
import type { Project, NewProjectData } from './meetings/dashboard/hooks/useProjects';
import type { AgendaItem, OffAgendaItemData } from './meetings/dashboard/hooks/useAgenda';

export default function EnhancedMeetingDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = baseQueryClient;
  
  // State management
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [activeTab, setActiveTab] = useState<'overview' | 'agenda' | 'notes'>('overview');
  const [showNewMeetingDialog, setShowNewMeetingDialog] = useState(false);
  const [newMeetingData, setNewMeetingData] = useState<MeetingFormData>({
    title: '',
    date: '',
    time: '',
    type: 'core_team',
    location: '',
    description: '',
  });
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [projectDiscussionTopics, setProjectDiscussionTopics] = useState<
    Record<number, string>
  >({});

  // Enhanced project management states
  const [editingProject, setEditingProject] = useState<number | null>(null);
  const [showEditPeopleDialog, setShowEditPeopleDialog] = useState(false);
  const [showEditOwnerDialog, setShowEditOwnerDialog] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [editSupportPeople, setEditSupportPeople] = useState<string>('');
  const [editProjectOwner, setEditProjectOwner] = useState<string>('');
  const [supportPeopleList, setSupportPeopleList] = useState<
    Array<{
      id?: string;
      name: string;
      email?: string;
      type: 'user' | 'custom';
    }>
  >([]);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDescription, setNewTaskDescription] = useState<string>('');

  // Project agenda states
  const [minimizedProjects, setMinimizedProjects] = useState<Set<number>>(
    new Set()
  );
  const [projectAgendaStatus, setProjectAgendaStatus] = useState<
    Record<number, 'none' | 'agenda' | 'tabled'>
  >({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  // Local state for text inputs to ensure responsiveness
  const [localProjectText, setLocalProjectText] = useState<
    Record<number, { discussionPoints?: string; decisionItems?: string }>
  >({});

  // Reset confirmation dialog state
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false);

  // Meeting edit states
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [showEditMeetingDialog, setShowEditMeetingDialog] = useState(false);
  const [editMeetingData, setEditMeetingData] = useState<MeetingFormData>({
    title: '',
    date: '',
    time: '',
    type: '',
    location: '',
    description: '',
  });

  // Off-agenda item form states
  const [offAgendaTitle, setOffAgendaTitle] = useState('');
  const [offAgendaSection, setOffAgendaSection] = useState('');
  
  // Meeting details dialog visibility (separate from selectedMeeting)
  const [showMeetingDetailsDialog, setShowMeetingDetailsDialog] = useState(false);

  // Add new project form states
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [newProjectData, setNewProjectData] = useState<NewProjectData>({
    title: '',
    description: '',
    assigneeName: '',
    supportPeople: '',
    dueDate: '',
    priority: 'medium',
    category: 'technology',
    status: 'waiting'
  });

  // Use centralized hooks
  const {
    meetings,
    meetingsLoading,
    compiledAgenda,
    compiledAgendaLoading,
    createMeetingMutation,
    updateMeetingMutation,
    deleteMeetingMutation,
    compileAgendaMutation,
    exportToSheetsMutation,
    downloadMeetingPDF,
  } = useMeetings(selectedMeeting?.id);

  const {
    projects: allProjects,
    projectsLoading,
    projectsForReview,
    createProjectMutation,
    updateProjectDiscussionMutation,
    updateProjectPriorityMutation,
    updateProjectSupportPeopleMutation,
    updateProjectOwnerMutation,
    createTasksFromNotesMutation,
    resetAgendaPlanningMutation,
    generateAgendaPDF,
  } = useProjects(projectAgendaStatus, selectedMeeting);

  const {
    agendaItems,
    agendaItemsLoading,
    createOffAgendaItemMutation,
    deleteAgendaItemMutation,
    addOffAgendaItem,
  } = useAgenda(selectedMeeting?.id, meetings);

  const {
    uploadedFiles,
    uploadingFiles,
    uploadProgress,
    uploadFile,
    deleteFile,
    setUploadedFiles,
    triggerFileInput,
  } = useFiles();

  // Ensure meetings is always an array to prevent filter errors
  const safeMeetings: Meeting[] = Array.isArray(meetings) ? meetings : [];

  // Auto-select appropriate meeting when meetings load
  useEffect(() => {
    if (safeMeetings.length > 0 && !selectedMeeting) {
      // Priority 1: Meeting with status 'planning' (most recent one)
      const planningMeetings = safeMeetings.filter(m => m.status === 'planning');
      if (planningMeetings.length > 0) {
        // Sort by date (most recent first) and select the first one
        const sortedPlanning = planningMeetings.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        console.log('[Meeting Auto-Selection] Selected planning meeting:', sortedPlanning[0]);
        setSelectedMeeting(sortedPlanning[0]);
        return;
      }
      
      // Priority 2: Most recent meeting by date
      const sortedMeetings = safeMeetings.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      console.log('[Meeting Auto-Selection] Selected most recent meeting:', sortedMeetings[0]);
      setSelectedMeeting(sortedMeetings[0]);
    }
  }, [safeMeetings, selectedMeeting]);

  // Debounced handlers for auto-save
  const debouncedUpdateRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const handleUpdateProjectDiscussion = useCallback(
    (
      projectId: number,
      updates: {
        meetingDiscussionPoints?: string;
        meetingDecisionItems?: string;
      }
    ) => {
      // Clear existing timeout for this project
      const existingTimeout = debouncedUpdateRef.current.get(projectId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout for debounced update
      const timeout = setTimeout(() => {
        updateProjectDiscussionMutation.mutate({ projectId, updates });
        debouncedUpdateRef.current.delete(projectId);
      }, 1000); // 1 second debounce

      debouncedUpdateRef.current.set(projectId, timeout);
    },
    [updateProjectDiscussionMutation]
  );

  // Handler for local text changes (immediate UI update + debounced save)
  const handleTextChange = useCallback(
    (
      projectId: number,
      field: 'discussionPoints' | 'decisionItems',
      value: string
    ) => {
      // Update local state immediately
      setLocalProjectText((prev) => ({
        ...prev,
        [projectId]: {
          ...prev[projectId],
          [field]: value,
        },
      }));

      // Trigger debounced save
      const updates =
        field === 'discussionPoints'
          ? { meetingDiscussionPoints: value }
          : { meetingDecisionItems: value };

      handleUpdateProjectDiscussion(projectId, updates);
    },
    [handleUpdateProjectDiscussion]
  );

  // Helper function to get current text value (local state or project data)
  const getTextValue = useCallback(
    (
      projectId: number,
      field: 'discussionPoints' | 'decisionItems',
      fallback: string
    ) => {
      const localValue = localProjectText[projectId]?.[field];
      return localValue !== undefined ? localValue : fallback;
    },
    [localProjectText]
  );

  // Handler for agenda actions
  const handleSendToAgenda = useCallback(
    (projectId: number) => {
      // Debug logging for Christine's issue
      console.log('🔍 Send to Agenda Debug Info:', {
        user: user?.email,
        role: user?.role,
        permissions: Array.isArray(user?.permissions) ? user.permissions.length : 0,
        projectId,
        timestamp: new Date().toISOString(),
      });

      setProjectAgendaStatus((prev) => ({ ...prev, [projectId]: 'agenda' }));
      setMinimizedProjects((prev) => new Set([...Array.from(prev), projectId]));
      updateProjectDiscussionMutation.mutate({
        projectId,
        updates: { reviewInNextMeeting: true },
      });
      toast({
        title: 'Added to Agenda',
        description: "Project has been added to this week's meeting agenda",
      });
    },
    [updateProjectDiscussionMutation, toast, user]
  );

  const handleTableProject = useCallback(
    (projectId: number) => {
      setProjectAgendaStatus((prev) => ({ ...prev, [projectId]: 'tabled' }));
      setMinimizedProjects((prev) => new Set([...Array.from(prev), projectId]));
      updateProjectDiscussionMutation.mutate({
        projectId,
        updates: { reviewInNextMeeting: false },
      });
      toast({
        title: 'Tabled for Later',
        description: 'Project has been tabled for a future meeting',
      });
    },
    [updateProjectDiscussionMutation, toast]
  );

  const handleExpandProject = useCallback((projectId: number) => {
    setMinimizedProjects((prev) => {
      const newSet = new Set(prev);
      newSet.delete(projectId);
      return newSet;
    });
  }, []);

  // Handler for finalizing agenda and generating PDF
  const handleFinalizeAgenda = useCallback(async () => {
    try {
      setIsGeneratingPDF(true);

      // Validate that we have agenda items to generate
      const activeProjects = Array.isArray(allProjects)
        ? allProjects.filter((p: Project) => p.status !== 'completed')
        : [];
      const agendaProjects = activeProjects.filter(
        (p: Project) => projectAgendaStatus[p.id] === 'agenda'
      );
      const tabledProjects = activeProjects.filter(
        (p: Project) => projectAgendaStatus[p.id] === 'tabled'
      );

      if (agendaProjects.length === 0 && tabledProjects.length === 0) {
        toast({
          title: 'No Agenda Items',
          description:
            'Please add at least one project to the agenda or table some items before generating PDF.',
          variant: 'destructive',
        });
        return;
      }

      await generateAgendaPDF(projectAgendaStatus);
    } catch (error) {
      console.error('=== PDF GENERATION CLIENT ERROR ===');
      console.error('Error details:', error);
      console.error('User permissions:', user?.permissions);
      console.error('User email:', user?.email);
      console.error('====================================');

      let errorMessage = 'Failed to generate agenda PDF';
      const errorObj = error as { message?: string } | undefined;
      if (errorObj?.message?.includes('403')) {
        errorMessage =
          'Permission denied - please contact an administrator to ensure you have meeting management permissions';
      } else if (errorObj?.message?.includes('400')) {
        errorMessage =
          'Invalid agenda data - please ensure you have projects selected for the agenda';
      } else if (errorObj?.message) {
        errorMessage = errorObj.message;
      }

      toast({
        title: 'Export Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 8000, // Show longer for debugging
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [allProjects, projectAgendaStatus, generateAgendaPDF, toast, user]);

  // Calculate agenda summary (only for non-completed projects)
  const activeProjects = Array.isArray(allProjects)
    ? allProjects.filter((project: Project) => project.status !== 'completed')
    : [];
  const agendaSummary = {
    agendaCount: Object.entries(projectAgendaStatus).filter(
      ([projectId, status]) => {
        const project = Array.isArray(allProjects)
          ? allProjects.find((p: Project) => p.id === parseInt(projectId))
          : undefined;
        return project && project.status !== 'completed' && status === 'agenda';
      }
    ).length,
    tabledCount: Object.entries(projectAgendaStatus).filter(
      ([projectId, status]) => {
        const project = Array.isArray(allProjects)
          ? allProjects.find((p: Project) => p.id === parseInt(projectId))
          : undefined;
        return project && project.status !== 'completed' && status === 'tabled';
      }
    ).length,
    undecidedCount:
      activeProjects.length -
      Object.keys(projectAgendaStatus).filter((projectId) => {
        const project = Array.isArray(allProjects)
          ? allProjects.find((p: Project) => p.id === parseInt(projectId))
          : undefined;
        return project && project.status !== 'completed';
      }).length,
  };

  // Date utility functions are now imported from utils/date.ts
  const dateRange = getCurrentDateRange();

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
    await downloadMeetingPDF(meeting);
  };

  const handleCreateMeeting = () => {
    if (!newMeetingData.title || !newMeetingData.date) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in the meeting title and date.',
        variant: 'destructive',
      });
      return;
    }
    createMeetingMutation.mutate(newMeetingData);
    setShowNewMeetingDialog(false);
    setNewMeetingData({
      title: '',
      date: '',
      time: '',
      type: 'core_team',
      location: '',
      description: '',
    });
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setEditMeetingData({
      title: meeting.title,
      date: formatDateForInput(meeting.date), // Ensure proper date format for input
      time: meeting.time,
      type: meeting.type || 'core_team',
      location: meeting.location || '',
      description: meeting.description || '',
    });
    setShowEditMeetingDialog(true);
  };

  const handleUpdateMeeting = () => {
    if (!editMeetingData.title || !editMeetingData.date) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in the meeting title and date.',
        variant: 'destructive',
      });
      return;
    }
    if (editingMeeting) {
      updateMeetingMutation.mutate({
        id: editingMeeting.id,
        ...editMeetingData,
      });
      setShowEditMeetingDialog(false);
      setEditingMeeting(null);
    }
  };

  const handleDeleteMeeting = () => {
    if (!editingMeeting) return;
    
    if (window.confirm(`Are you sure you want to delete "${editingMeeting.title}"? This action cannot be undone.`)) {
      deleteMeetingMutation.mutate(editingMeeting.id);
      setShowEditMeetingDialog(false);
      setEditingMeeting(null);
    }
  };

  // Handler for creating a new project
  const handleCreateProject = () => {
    if (!newProjectData.title.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please enter a title for the project',
        variant: 'destructive',
      });
      return;
    }

    createProjectMutation.mutate(newProjectData);
    setShowAddProjectDialog(false);
    setNewProjectData({
      title: '',
      description: '',
      assigneeName: '',
      supportPeople: '',
      dueDate: '',
      priority: 'medium',
      category: 'technology',
      status: 'waiting'
    });
  };

  // Handler for adding off-agenda items
  const handleAddOffAgendaItem = async () => {
    await addOffAgendaItem(offAgendaTitle, offAgendaSection, selectedMeeting, safeMeetings);
    // Reset form
    setOffAgendaTitle('');
    setOffAgendaSection('');
  };

  // Helper functions for agenda section icons and colors
  const getSectionIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case 'old business':
        return <RotateCcw className="w-4 h-4 text-primary" />;
      case 'urgent items':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'housekeeping':
        return <Home className="w-4 h-4 text-teal-600" />;
      case 'new business':
        return <Lightbulb className="w-4 h-4 text-orange-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getSectionColor = (title: string) => {
    switch (title.toLowerCase()) {
      case 'old business':
        return 'text-primary';
      case 'urgent items':
        return 'text-red-800';
      case 'housekeeping':
        return 'text-teal-800';
      case 'new business':
        return 'text-orange-800';
      default:
        return 'text-gray-800';
    }
  };

  // Separate meetings into upcoming and past
  const upcomingMeetings = safeMeetings.filter(
    (meeting: Meeting) => !isPastMeeting(meeting.date, meeting.time)
  );
  const pastMeetings = safeMeetings.filter((meeting: Meeting) =>
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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-orange-50 p-4 md:p-6 rounded-lg border border-teal-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-teal-900 mb-2">
              Meeting Management
            </h1>
            <p className="text-sm md:text-base text-teal-700">
              Weekly agenda compilation from Google Sheet projects and meeting
              documentation
            </p>
          </div>
          <div className="text-left md:text-right text-sm text-teal-600">
            <div className="font-medium">{dateRange.month}</div>
            <div className="text-xs text-teal-500">
              Current Week: {dateRange.week}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-full md:w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-gray-600 hover:text-teal-700'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span className="hidden sm:inline">Meeting </span>Overview
        </button>
        <button
          onClick={() => setActiveTab('agenda')}
          className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'agenda'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-gray-600 hover:text-teal-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Agenda </span>Planning
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          data-testid="button-notes-tab"
          className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === 'notes'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-gray-600 hover:text-teal-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">Meeting </span>Notes
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <MeetingOverviewTab
          selectedMeeting={selectedMeeting}
          setSelectedMeeting={setSelectedMeeting}
          viewMode={viewMode}
          setViewMode={setViewMode}
          showNewMeetingDialog={showNewMeetingDialog}
          setShowNewMeetingDialog={setShowNewMeetingDialog}
          showEditMeetingDialog={showEditMeetingDialog}
          setShowEditMeetingDialog={setShowEditMeetingDialog}
          showMeetingDetailsDialog={showMeetingDetailsDialog}
          setShowMeetingDetailsDialog={setShowMeetingDetailsDialog}
          newMeetingData={newMeetingData}
          setNewMeetingData={setNewMeetingData}
          editMeetingData={editMeetingData}
          setEditMeetingData={setEditMeetingData}
          isCompiling={isCompiling}
          isExporting={isExporting}
          upcomingMeetings={upcomingMeetings}
          pastMeetings={pastMeetings}
          projectsForReview={projectsForReview}
          compiledAgenda={compiledAgenda}
          agendaLoading={compiledAgendaLoading}
          handleCreateMeeting={handleCreateMeeting}
          handleUpdateMeeting={handleUpdateMeeting}
          handleDeleteMeeting={handleDeleteMeeting}
          handleEditMeeting={handleEditMeeting}
          handleCompileAgenda={handleCompileAgenda}
          handleExportToSheets={handleExportToSheets}
          handleDownloadPDF={handleDownloadPDF}
          getSectionIcon={getSectionIcon}
          getSectionColor={getSectionColor}
          createMeetingMutation={createMeetingMutation}
          updateMeetingMutation={updateMeetingMutation}
          deleteMeetingMutation={deleteMeetingMutation}
        />
      )}
      {activeTab === 'agenda' && (
        <AgendaPlanningTab
          selectedMeeting={selectedMeeting}
          meetings={safeMeetings}
          selectedProjectIds={selectedProjectIds}
          setSelectedProjectIds={setSelectedProjectIds}
          projectAgendaStatus={projectAgendaStatus}
          setProjectAgendaStatus={setProjectAgendaStatus}
          minimizedProjects={minimizedProjects}
          setMinimizedProjects={setMinimizedProjects}
          localProjectText={localProjectText}
          showResetConfirmDialog={showResetConfirmDialog}
          setShowResetConfirmDialog={setShowResetConfirmDialog}
          showAddProjectDialog={showAddProjectDialog}
          setShowAddProjectDialog={setShowAddProjectDialog}
          newProjectData={newProjectData}
          setNewProjectData={setNewProjectData}
          offAgendaTitle={offAgendaTitle}
          setOffAgendaTitle={setOffAgendaTitle}
          offAgendaSection={offAgendaSection}
          setOffAgendaSection={setOffAgendaSection}
          isGeneratingPDF={isGeneratingPDF}
          isCompiling={isCompiling}
          setIsCompiling={setIsCompiling}
          showEditPeopleDialog={showEditPeopleDialog}
          setShowEditPeopleDialog={setShowEditPeopleDialog}
          showEditOwnerDialog={showEditOwnerDialog}
          setShowEditOwnerDialog={setShowEditOwnerDialog}
          showAddTaskDialog={showAddTaskDialog}
          setShowAddTaskDialog={setShowAddTaskDialog}
          editingProject={editingProject}
          setEditingProject={setEditingProject}
          editSupportPeople={editSupportPeople}
          setEditSupportPeople={setEditSupportPeople}
          editProjectOwner={editProjectOwner}
          setEditProjectOwner={setEditProjectOwner}
          newTaskTitle={newTaskTitle}
          setNewTaskTitle={setNewTaskTitle}
          newTaskDescription={newTaskDescription}
          setNewTaskDescription={setNewTaskDescription}
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
          allProjects={allProjects}
          agendaItems={agendaItems}
          agendaSummary={agendaSummary}
          handleTextChange={handleTextChange}
          getTextValue={getTextValue}
          handleSendToAgenda={handleSendToAgenda}
          handleTableProject={handleTableProject}
          handleExpandProject={handleExpandProject}
          handleFinalizeAgenda={handleFinalizeAgenda}
          handleAddOffAgendaItem={handleAddOffAgendaItem}
          handleCreateProject={handleCreateProject}
          updateProjectDiscussionMutation={updateProjectDiscussionMutation}
          updateProjectPriorityMutation={updateProjectPriorityMutation}
          createTasksFromNotesMutation={createTasksFromNotesMutation}
          resetAgendaPlanningMutation={resetAgendaPlanningMutation}
          createOffAgendaItemMutation={createOffAgendaItemMutation}
          deleteAgendaItemMutation={deleteAgendaItemMutation}
          createProjectMutation={createProjectMutation}
          queryClient={baseQueryClient}
          apiRequest={apiRequest}
          toast={toast}
        />
      )}
      {activeTab === 'notes' && (
        <NotesTab
          selectedMeeting={selectedMeeting}
          meetings={safeMeetings}
          allProjects={allProjects}
          handleSendToAgenda={handleSendToAgenda}
          queryClient={baseQueryClient}
          toast={toast}
        />
      )}

      {/* Edit Support People Dialog */}
      <Dialog
        open={showEditPeopleDialog}
        onOpenChange={setShowEditPeopleDialog}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Support People</DialogTitle>
            <DialogDescription>
              Add team members from the system or enter custom names and emails
            </DialogDescription>
          </DialogHeader>
          <ProjectAssigneeSelector
            value={editSupportPeople}
            onChange={(value) => {
              setEditSupportPeople(value);
              if (editingProject) {
                updateProjectSupportPeopleMutation.mutate({
                  projectId: editingProject,
                  supportPeople: value,
                });
              }
            }}
            multiple={true}
            placeholder="Search for users or enter custom names..."
          />
        </DialogContent>
      </Dialog>

      {/* Edit Project Owner Dialog */}
      <Dialog open={showEditOwnerDialog} onOpenChange={setShowEditOwnerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project Owner</DialogTitle>
            <DialogDescription>
              Assign a project owner from the team
            </DialogDescription>
          </DialogHeader>
          <ProjectAssigneeSelector
            value={editProjectOwner}
            onChange={(value) => {
              setEditProjectOwner(value);
              if (editingProject) {
                updateProjectOwnerMutation.mutate({
                  projectId: editingProject,
                  assigneeName: value,
                });
              }
              setShowEditOwnerDialog(false);
            }}
            multiple={false}
            placeholder="Search for a team member..."
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}