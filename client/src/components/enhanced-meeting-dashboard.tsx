import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient as baseQueryClient } from '@/lib/queryClient';
import {
  formatDateForInput,
  formatDateForDisplay,
  normalizeDate,
  isDateInPast,
  getTodayString,
  formatTimeForDisplay,
} from '@/lib/date-utils';

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
import MeetingOverviewTab from './meetings/dashboard/tabs/MeetingOverviewTab';
import AgendaPlanningTab from './meetings/dashboard/tabs/AgendaPlanningTab';
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
  meetingDiscussionPoints?: string;
  meetingDecisionItems?: string;
  supportPeople?: string;
  assigneeName?: string;
}


export default function EnhancedMeetingDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [activeTab, setActiveTab] = useState<'overview' | 'agenda'>('overview');
  const [showNewMeetingDialog, setShowNewMeetingDialog] = useState(false);
  const [newMeetingData, setNewMeetingData] = useState({
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
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<number, { url: string; name: string }[]>
  >({});

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
  const [editMeetingData, setEditMeetingData] = useState({
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
  const [newProjectData, setNewProjectData] = useState({
    title: '',
    description: '',
    assigneeName: '',
    supportPeople: '',
    dueDate: '',
    priority: 'medium',
    category: 'technology',
    status: 'waiting'
  });

  // Fetch meetings
  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<
    Meeting[]
  >({
    queryKey: ['/api/meetings'],
  });

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

  // Fetch projects for review
  const { data: projectsForReview = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects/for-review'],
  });

  // Fetch all projects for agenda planning
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch compiled agenda for selected meeting
  const { data: compiledAgenda, isLoading: agendaLoading } =
    useQuery<CompiledAgenda>({
      queryKey: ['/api/meetings', selectedMeeting?.id, 'compiled-agenda'],
      enabled: !!selectedMeeting,
    });

  // Fetch agenda items for selected meeting - FIXED VERSION
  const { data: agendaItems = [], isLoading: agendaItemsLoading } = useQuery<any[]>({
    queryKey: ['agenda-items', selectedMeeting?.id],
    queryFn: async () => {
      console.log('[Frontend] Fetching agenda items from /api/agenda-items for meeting:', selectedMeeting?.id);
      const response = await apiRequest('GET', `/api/agenda-items?meetingId=${selectedMeeting?.id || ''}`);
      console.log('[Frontend] Agenda items response:', response);
      return response || [];
    },
    enabled: !!selectedMeeting,
  });

  // Update project discussion mutation
  const updateProjectDiscussionMutation = useMutation({
    mutationFn: async ({
      projectId,
      updates,
    }: {
      projectId: number;
      updates: {
        meetingDiscussionPoints?: string;
        meetingDecisionItems?: string;
        reviewInNextMeeting?: boolean;
      };
    }) => {
      return await apiRequest('PATCH', `/api/projects/${projectId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects/for-review'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description:
          error.message || 'Failed to update project discussion notes.',
        variant: 'destructive',
      });
    },
  });

  // Update project priority mutation
  const updateProjectPriorityMutation = useMutation({
    mutationFn: async ({
      projectId,
      priority,
    }: {
      projectId: number;
      priority: string;
    }) => {
      return await apiRequest('PATCH', `/api/projects/${projectId}`, { priority });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects/for-review'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Priority Updated',
        description: 'Project priority has been successfully updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description:
          error.message || 'Failed to update project priority.',
        variant: 'destructive',
      });
    },
  });

  // Convert meeting notes to tasks mutation
  const createTasksFromNotesMutation = useMutation({
    mutationFn: async () => {
      const projectsWithNotes = allProjects.filter(
        (project: any) =>
          (project.meetingDiscussionPoints?.trim() ||
            project.meetingDecisionItems?.trim()) &&
          (projectAgendaStatus[project.id] === 'agenda' ||
            projectAgendaStatus[project.id] === 'tabled')
      );

      const taskPromises = projectsWithNotes.map(async (project: any) => {
        const tasks = [];

        // Create task from discussion points
        if (project.meetingDiscussionPoints?.trim()) {
          tasks.push({
            title: project.meetingDiscussionPoints.trim(),
            description: `Project: ${project.title}`,
            assigneeName: project.assigneeName || 'Unassigned',
            priority: 'medium',
            status: 'pending',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0], // 7 days from now
          });
        }

        // Create task from decision items
        if (project.meetingDecisionItems?.trim()) {
          tasks.push({
            title: `Action item: ${project.title}`,
            description: `Meeting Decisions to Implement: ${project.meetingDecisionItems.trim()}`,
            assigneeName: project.assigneeName || 'Unassigned',
            priority: 'high',
            status: 'pending',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0], // 3 days for decisions
          });
        }

        // Create tasks for this project
        const taskResults = await Promise.all(
          tasks.map((task) =>
            apiRequest('POST', `/api/projects/${project.id}/tasks`, task)
          )
        );

        return {
          projectTitle: project.title,
          tasksCreated: taskResults.length,
        };
      });

      return Promise.all(taskPromises);
    },
    onSuccess: (results) => {
      const totalTasks = results.reduce(
        (sum, result) => sum + result.tasksCreated,
        0
      );
      const projectCount = results.length;

      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });

      toast({
        title: 'Tasks Created Successfully!',
        description: `Created ${totalTasks} task${
          totalTasks !== 1 ? 's' : ''
        } from meeting notes across ${projectCount} project${
          projectCount !== 1 ? 's' : ''
        }`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      console.error('Failed to create tasks from notes:', error);
      toast({
        title: 'Error Creating Tasks',
        description:
          error?.message || 'Failed to convert meeting notes into tasks',
        variant: 'destructive',
      });
    },
  });

  // Comprehensive reset for next week's agenda planning
  const resetAgendaPlanningMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Create tasks from any remaining notes
      const projectsWithNotes = allProjects.filter(
        (project: any) =>
          (project.meetingDiscussionPoints?.trim() ||
            project.meetingDecisionItems?.trim()) &&
          (projectAgendaStatus[project.id] === 'agenda' ||
            projectAgendaStatus[project.id] === 'tabled')
      );

      if (projectsWithNotes.length > 0) {
        const taskPromises = projectsWithNotes.map(async (project: any) => {
          const tasks = [];

          // Create task from discussion points
          if (project.meetingDiscussionPoints?.trim()) {
            tasks.push({
              title: `Follow up on: ${project.title}`,
              description: `Meeting Discussion Notes: ${project.meetingDiscussionPoints.trim()}`,
              assigneeName: project.assigneeName || 'Unassigned',
              priority: 'medium',
              status: 'pending',
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0], // 7 days from now
            });
          }

          // Create task from decision items
          if (project.meetingDecisionItems?.trim()) {
            tasks.push({
              title: `Action item: ${project.title}`,
              description: `Meeting Decisions to Implement: ${project.meetingDecisionItems.trim()}`,
              assigneeName: project.assigneeName || 'Unassigned',
              priority: 'high',
              status: 'pending',
              dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0], // 3 days for decisions
            });
          }

          // Create tasks for this project
          if (tasks.length > 0) {
            const taskResults = await Promise.all(
              tasks.map((task) =>
                apiRequest('POST', `/api/projects/${project.id}/tasks`, task)
              )
            );
            return {
              projectTitle: project.title,
              tasksCreated: taskResults.length,
            };
          }
          return { projectTitle: project.title, tasksCreated: 0 };
        });

        await Promise.all(taskPromises);
      }

      // Step 2: Clear all meeting discussion points and decision items
      const clearNotesPromises = allProjects
        .filter(
          (project: any) =>
            project.meetingDiscussionPoints?.trim() ||
            project.meetingDecisionItems?.trim()
        )
        .map(async (project: any) => {
          return apiRequest('PATCH', `/api/projects/${project.id}`, {
            meetingDiscussionPoints: '',
            meetingDecisionItems: '',
            reviewInNextMeeting: false,
          });
        });

      if (clearNotesPromises.length > 0) {
        await Promise.all(clearNotesPromises);
      }

      // Step 3: Refresh projects from Google Sheets to get any updates made during the week
      await apiRequest('POST', '/api/google-sheets/projects/sync/from-sheets');

      return {
        notesProcessed: projectsWithNotes.length,
        notesCleared: clearNotesPromises.length,
      };
    },
    onSuccess: (results) => {
      // Step 4: Reset all local states
      setProjectAgendaStatus({});
      setMinimizedProjects(new Set());
      setLocalProjectText({});

      // Refresh projects data
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });

      toast({
        title: 'Agenda Planning Reset Complete!',
        description: `✓ ${results.notesProcessed} projects converted to tasks\n✓ ${results.notesCleared} project notes cleared\n✓ Projects refreshed from Google Sheets\n✓ Ready for next week's planning`,
        duration: 8000,
      });

      setShowResetConfirmDialog(false);
    },
    onError: (error: any) => {
      console.error('Failed to reset agenda planning:', error);
      toast({
        title: 'Reset Failed',
        description:
          error?.message || 'Failed to complete agenda planning reset',
        variant: 'destructive',
      });
      setShowResetConfirmDialog(false);
    },
  });

  // Create off-agenda item mutation - SIMPLE VERSION
  const createOffAgendaItemMutation = useMutation({
    mutationFn: async (itemData: {
      title: string;
      section: string;
      meetingId: number;
    }) => {
      console.log('[Frontend] Creating agenda item via /api/meetings/agenda-items:', itemData);
      return await apiRequest('POST', '/api/meetings/agenda-items', {
        title: itemData.title,
        description: '', // Clear description since section is separate now
        section: itemData.section, // Send section as proper field
        meetingId: itemData.meetingId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-items'] });
      toast({
        title: 'Agenda Item Added',
        description:
          'Off-agenda item has been successfully added to the meeting',
      });
      // Reset form
      setOffAgendaTitle('');
      setOffAgendaSection('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Add Item',
        description: error.message || 'Failed to add off-agenda item',
        variant: 'destructive',
      });
    },
  });

  // Delete agenda item mutation
  const deleteAgendaItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return await apiRequest('DELETE', `/api/agenda-items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-items'] });
      toast({
        title: 'Agenda Item Deleted',
        description: 'The agenda item has been successfully removed',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete agenda item',
        variant: 'destructive',
      });
    },
  });

  // Create new project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (projectData: typeof newProjectData) => {
      return await apiRequest('POST', '/api/projects', projectData);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/for-review'] });
      
      // Automatically sync the new project to Google Sheets
      try {
        await apiRequest('POST', '/api/google-sheets/projects/sync/to-sheets');
        toast({
          title: 'Project Created & Synced',
          description: 'New project has been created and synced to Google Sheets',
        });
      } catch (syncError) {
        console.warn('Project created but sync to Google Sheets failed:', syncError);
        toast({
          title: 'Project Created',
          description: 'New project has been created. Note: Sync to Google Sheets failed - you can sync manually later.',
          variant: 'destructive',
        });
      }
      
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
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Create Project',
        description: error?.message || 'Failed to create the new project',
        variant: 'destructive',
      });
    },
  });

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
  };

  // Handler for adding off-agenda items
  const handleAddOffAgendaItem = () => {
    if (!offAgendaTitle.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please enter a title for the agenda item',
        variant: 'destructive',
      });
      return;
    }

    if (!offAgendaSection) {
      toast({
        title: 'Section Required',
        description: 'Please select a section for the agenda item',
        variant: 'destructive',
      });
      return;
    }

    // Debug logging for meeting selection
    console.log('🔍 Meeting Auto-Selection Debug:', {
      selectedMeeting: selectedMeeting?.id,
      totalMeetings: meetings.length,
      meetings: meetings.map(m => ({ id: m.id, title: m.title, date: m.date, status: m.status })),
      timestamp: new Date().toISOString(),
    });

    // Auto-select the most appropriate meeting if none is selected
    let targetMeeting = selectedMeeting;
    
    if (!targetMeeting && meetings.length > 0) {
      try {
        // Separate meetings by past/future using proper date utilities
        const upcomingMeetings: Meeting[] = [];
        const pastMeetings: Meeting[] = [];
        
        meetings.forEach((meeting) => {
          try {
            if (isDateInPast(meeting.date, meeting.time)) {
              pastMeetings.push(meeting);
            } else {
              upcomingMeetings.push(meeting);
            }
          } catch (error) {
            console.warn('Date parsing issue for meeting:', meeting.id, meeting.date, error);
            // If date parsing fails, default to upcoming to be safe
            upcomingMeetings.push(meeting);
          }
        });

        console.log('🗓️ Meeting Classification:', {
          upcoming: upcomingMeetings.map(m => ({ id: m.id, date: m.date })),
          past: pastMeetings.map(m => ({ id: m.id, date: m.date })),
        });

        // Priority 1: Most recent upcoming meeting
        if (upcomingMeetings.length > 0) {
          // Sort by date ascending (earliest first) for upcoming meetings
          targetMeeting = upcomingMeetings.sort((a, b) => {
            try {
              const dateA = new Date(normalizeDate(a.date) + 'T12:00:00');
              const dateB = new Date(normalizeDate(b.date) + 'T12:00:00');
              return dateA.getTime() - dateB.getTime();
            } catch (error) {
              console.warn('Date sorting error:', error);
              return 0; // Keep original order if sorting fails
            }
          })[0];
          console.log('✅ Selected upcoming meeting:', targetMeeting.id, targetMeeting.date);
        }
        
        // Priority 2: Most recent past meeting
        else if (pastMeetings.length > 0) {
          // Sort by date descending (most recent first) for past meetings
          targetMeeting = pastMeetings.sort((a, b) => {
            try {
              const dateA = new Date(normalizeDate(a.date) + 'T12:00:00');
              const dateB = new Date(normalizeDate(b.date) + 'T12:00:00');
              return dateB.getTime() - dateA.getTime();
            } catch (error) {
              console.warn('Date sorting error:', error);
              return 0; // Keep original order if sorting fails
            }
          })[0];
          console.log('✅ Selected past meeting:', targetMeeting.id, targetMeeting.date);
        }
        
        // Priority 3: Fallback - just pick the first available meeting
        else {
          targetMeeting = meetings[0];
          console.log('⚠️ Using fallback meeting selection:', targetMeeting.id);
        }

      } catch (error) {
        console.error('Error in meeting selection logic:', error);
        // Ultimate fallback - just pick any available meeting
        if (meetings.length > 0) {
          targetMeeting = meetings[0];
          console.log('🚨 Emergency fallback meeting selection:', targetMeeting.id);
        }
      }
    }

    // Final validation
    if (!targetMeeting) {
      console.error('❌ No target meeting found despite', meetings.length, 'meetings available');
      toast({
        title: 'No Meetings Available',
        description: `Unable to find a suitable meeting from ${meetings.length} available meetings. Please select a meeting manually or create a new one.`,
        variant: 'destructive',
      });
      return;
    }

    console.log('🎯 Final target meeting selected:', {
      id: targetMeeting.id,
      title: targetMeeting.title,
      date: targetMeeting.date,
      time: targetMeeting.time,
    });

    createOffAgendaItemMutation.mutate({
      title: offAgendaTitle,
      section: offAgendaSection,
      meetingId: targetMeeting.id,
    });
  };

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

      // Get agenda projects and tabled projects (excluding completed ones)
      const activeProjects = Array.isArray(allProjects)
        ? allProjects.filter((p: Project) => p.status !== 'completed')
        : [];
      const agendaProjects = activeProjects.filter(
        (p: Project) => projectAgendaStatus[p.id] === 'agenda'
      );
      const tabledProjects = activeProjects.filter(
        (p: Project) => projectAgendaStatus[p.id] === 'tabled'
      );

      // Validate that we have agenda items to generate
      if (agendaProjects.length === 0 && tabledProjects.length === 0) {
        toast({
          title: 'No Agenda Items',
          description:
            'Please add at least one project to the agenda or table some items before generating PDF.',
          variant: 'destructive',
        });
        return;
      }

      // Fetch tasks for each agenda project
      const projectsWithTasks = await Promise.all(
        agendaProjects.map(async (project: Project) => {
          try {
            const tasksResponse = await fetch(
              `/api/projects/${project.id}/tasks`,
              {
                credentials: 'include',
              }
            );
            const tasks = tasksResponse.ok ? await tasksResponse.json() : [];

            return {
              title: project.title,
              owner: project.assigneeName || 'Unassigned',
              supportPeople: project.supportPeople || '',
              discussionPoints: project.meetingDiscussionPoints || '',
              decisionItems: project.meetingDecisionItems || '',
              status: project.status,
              priority: project.priority,
              tasks: tasks
                .filter((task: any) => task.status !== 'completed')
                .map((task: any) => ({
                  title: task.title,
                  status: task.status,
                  priority: task.priority,
                  description: task.description,
                  assignee: task.assigneeName || task.assignee || 'Unassigned',
                })),
            };
          } catch (error) {
            // If task fetching fails, continue without tasks
            return {
              title: project.title,
              owner: project.assigneeName || 'Unassigned',
              supportPeople: project.supportPeople || '',
              discussionPoints: project.meetingDiscussionPoints || '',
              decisionItems: project.meetingDecisionItems || '',
              status: project.status,
              priority: project.priority,
              tasks: [],
            };
          }
        })
      );

      // Create agenda data structure
      const agendaData = {
        meetingDate: getTodayString(),
        agendaProjects: projectsWithTasks,
        tabledProjects: tabledProjects.map((p: Project) => ({
          title: p.title,
          owner: p.assigneeName || 'Unassigned',
          reason: p.meetingDiscussionPoints || 'No reason specified',
        })),
      };

      // Call API to generate PDF using fetch directly (for binary response)
      const response = await fetch('/api/meetings/finalize-agenda-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agendaData),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage =
            errorJson.message || errorJson.error ||
            `HTTP ${response.status}: ${response.statusText}`;
        } catch {
          errorMessage =
            errorText || `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meeting-agenda-${getTodayString()}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Agenda Finalized',
        description: `PDF agenda downloaded with ${agendaProjects.length} projects and ${tabledProjects.length} tabled items`,
      });
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
  }, [allProjects, projectAgendaStatus, toast]);

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

  // Compile agenda mutation
  const compileAgendaMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      return await apiRequest(
        'POST',
        `/api/meetings/${meetingId}/compile-agenda`
      );
    },
    onSuccess: () => {
      toast({
        title: 'Agenda Compiled Successfully',
        description:
          'The meeting agenda has been compiled from Google Sheet projects and submitted items.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      if (selectedMeeting) {
        queryClient.invalidateQueries({
          queryKey: ['/api/meetings', selectedMeeting.id, 'compiled-agenda'],
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Compilation Failed',
        description:
          error.message || 'Failed to compile agenda. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Export to sheets mutation
  const exportToSheetsMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      return await apiRequest(
        'POST',
        `/api/meetings/${meetingId}/export-to-sheets`
      );
    },
    onSuccess: () => {
      toast({
        title: 'Export Successful',
        description: 'Meeting agenda has been exported to Google Sheets.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Export Failed',
        description:
          error.message ||
          'Failed to export to Google Sheets. Please try again.',
        variant: 'destructive',
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
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || `Failed to download PDF: ${response.statusText}`;
        } catch {
          errorMessage = `Failed to download PDF: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${meeting.title.replace(/[^a-zA-Z0-9\s]/g, '_')}_${
        meeting.date
      }.pdf`;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'PDF Downloaded',
        description: 'Meeting agenda PDF has been downloaded successfully.',
      });
    } catch (error) {
      console.error('PDF download error:', error);
      toast({
        title: 'Download Failed',
        description:
          'Failed to download the meeting agenda PDF. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Create new meeting mutation
  const createMeetingMutation = useMutation({
    mutationFn: async (meetingData: typeof newMeetingData) => {
      return await apiRequest('POST', '/api/meetings', meetingData);
    },
    onSuccess: () => {
      toast({
        title: 'Meeting Scheduled',
        description: 'Your new meeting has been scheduled successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      setShowNewMeetingDialog(false);
      setNewMeetingData({
        title: '',
        date: '',
        time: '',
        type: 'core_team',
        location: '',
        description: '',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Schedule Meeting',
        description:
          error.message || 'Failed to schedule the meeting. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Update meeting mutation
  const updateMeetingMutation = useMutation({
    mutationFn: async (
      meetingData: { id: number } & typeof editMeetingData
    ) => {
      return await apiRequest(
        'PATCH',
        `/api/meetings/${meetingData.id}`,
        meetingData
      );
    },
    onSuccess: () => {
      toast({
        title: 'Meeting Updated',
        description: 'Meeting details have been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      setShowEditMeetingDialog(false);
      setEditingMeeting(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Update Meeting',
        description:
          error.message || 'Failed to update the meeting. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Delete meeting mutation
  const deleteMeetingMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      return await apiRequest('DELETE', `/api/meetings/${meetingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      toast({
        title: 'Meeting Deleted',
        description: 'The meeting has been successfully deleted.',
      });
      setShowEditMeetingDialog(false);
      setEditingMeeting(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete meeting',
        variant: 'destructive',
      });
    },
  });

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
    }
  };

  const handleDeleteMeeting = () => {
    if (!editingMeeting) return;
    
    if (window.confirm(`Are you sure you want to delete "${editingMeeting.title}"? This action cannot be undone.`)) {
      deleteMeetingMutation.mutate(editingMeeting.id);
    }
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
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <MeetingOverviewTab
          meetings={safeMeetings}
          projectsForReview={projectsForReview}
          selectedMeeting={selectedMeeting}
          compiledAgenda={compiledAgenda}
          viewMode={viewMode}
          meetingsLoading={meetingsLoading}
          agendaLoading={agendaLoading}
          setSelectedMeeting={setSelectedMeeting}
          setViewMode={setViewMode}
          setShowNewMeetingDialog={setShowNewMeetingDialog}
          setShowMeetingDetailsDialog={setShowMeetingDetailsDialog}
          setShowEditMeetingDialog={setShowEditMeetingDialog}
          setEditingMeeting={setEditingMeeting}
          setEditMeetingData={setEditMeetingData}
          newMeetingData={newMeetingData}
          setNewMeetingData={setNewMeetingData}
          showNewMeetingDialog={showNewMeetingDialog}
          showEditMeetingDialog={showEditMeetingDialog}
          showMeetingDetailsDialog={showMeetingDetailsDialog}
          editingMeeting={editingMeeting}
          editMeetingData={editMeetingData}
          handleCompileAgenda={handleCompileAgenda}
          handleExportToSheets={handleExportToSheets}
          handleDownloadPDF={handleDownloadPDF}
          handleEditMeeting={handleEditMeeting}
          isCompiling={isCompiling}
          isExporting={isExporting}
          formatDateForInput={formatDateForInput}
          createMeetingMutation={createMeetingMutation}
          updateMeetingMutation={updateMeetingMutation}
          deleteMeetingMutation={deleteMeetingMutation}
          handleCreateMeeting={handleCreateMeeting}
          handleUpdateMeeting={handleUpdateMeeting}
          handleDeleteMeeting={handleDeleteMeeting}
        />
      )}
      {activeTab === 'agenda' && (
        <AgendaPlanningTab
          allProjects={allProjects}
          selectedMeeting={selectedMeeting}
          projectAgendaStatus={projectAgendaStatus}
          setProjectAgendaStatus={setProjectAgendaStatus}
          minimizedProjects={minimizedProjects}
          setMinimizedProjects={setMinimizedProjects}
          localProjectText={localProjectText}
          setLocalProjectText={setLocalProjectText}
          agendaItems={agendaItems}
          offAgendaTitle={offAgendaTitle}
          setOffAgendaTitle={setOffAgendaTitle}
          offAgendaSection={offAgendaSection}
          setOffAgendaSection={setOffAgendaSection}
          showResetConfirmDialog={showResetConfirmDialog}
          setShowResetConfirmDialog={setShowResetConfirmDialog}
          showAddProjectDialog={showAddProjectDialog}
          setShowAddProjectDialog={setShowAddProjectDialog}
          newProjectData={newProjectData}
          setNewProjectData={setNewProjectData}
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
          meetings={safeMeetings}
          handleTextChange={handleTextChange}
          handleSendToAgenda={handleSendToAgenda}
          handleTableProject={handleTableProject}
          handleExpandProject={handleExpandProject}
          handleFinalizeAgenda={handleFinalizeAgenda}
          handleAddOffAgendaItem={handleAddOffAgendaItem}
          handleCreateProject={handleCreateProject}
          isGeneratingPDF={isGeneratingPDF}
          updateProjectDiscussionMutation={updateProjectDiscussionMutation}
          updateProjectPriorityMutation={updateProjectPriorityMutation}
          createTasksFromNotesMutation={createTasksFromNotesMutation}
          resetAgendaPlanningMutation={resetAgendaPlanningMutation}
          createOffAgendaItemMutation={createOffAgendaItemMutation}
          deleteAgendaItemMutation={deleteAgendaItemMutation}
          createProjectMutation={createProjectMutation}
          agendaSummary={agendaSummary}
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
            }}
            label="Support People"
            placeholder="Select or enter support people"
            multiple={true}
          />
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowEditPeopleDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (editingProject) {
                  try {
                    console.log('=== SUPPORT PEOPLE UPDATE DEBUG ===');
                    console.log('Project ID:', editingProject);
                    console.log('Support People Value:', editSupportPeople);
                    console.log(
                      'Support People Length:',
                      editSupportPeople?.length
                    );

                    const response = await apiRequest(
                      'PATCH',
                      `/api/projects/${editingProject}`,
                      {
                        supportPeople: editSupportPeople,
                      }
                    );

                    console.log('API Response:', response);
                    queryClient.invalidateQueries({
                      queryKey: ['/api/projects'],
                    });

                    toast({
                      title: 'Success',
                      description: 'Support people updated successfully',
                    });
                    setShowEditPeopleDialog(false);
                  } catch (error) {
                    console.error('=== SUPPORT PEOPLE ERROR ===');
                    console.error('Error details:', error);
                    console.error('Error message:', error?.message);
                    console.error('Error response:', error?.response);

                    toast({
                      title: 'Error',
                      description: `Failed to update support people: ${
                        error?.message || 'Unknown error'
                      }`,
                      variant: 'destructive',
                    });
                  }
                }
              }}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Project Owner Dialog */}
      <Dialog open={showEditOwnerDialog} onOpenChange={setShowEditOwnerDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Project Owner</DialogTitle>
            <DialogDescription>
              Assign a single project owner from the system or enter a custom
              name
            </DialogDescription>
          </DialogHeader>
          <ProjectAssigneeSelector
            value={editProjectOwner}
            onChange={(value) => {
              setEditProjectOwner(value);
            }}
            label="Project Owner"
            placeholder="Select or enter project owner"
            multiple={false}
          />
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowEditOwnerDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (editingProject) {
                  try {
                    console.log('=== PROJECT OWNER UPDATE DEBUG ===');
                    console.log('Project ID:', editingProject);
                    console.log('Project Owner Value:', editProjectOwner);

                    const response = await apiRequest(
                      'PATCH',
                      `/api/projects/${editingProject}`,
                      {
                        assigneeName: editProjectOwner,
                      }
                    );

                    console.log('API Response:', response);
                    queryClient.invalidateQueries({
                      queryKey: ['/api/projects'],
                    });

                    toast({
                      title: 'Success',
                      description: 'Project owner updated successfully',
                    });
                    setShowEditOwnerDialog(false);
                  } catch (error) {
                    console.error('=== PROJECT OWNER ERROR ===');
                    console.error('Error details:', error);
                    console.error('Error message:', error?.message);
                    console.error('Error response:', error?.response);

                    toast({
                      title: 'Error',
                      description: `Failed to update project owner: ${
                        error?.message || 'Unknown error'
                      }`,
                      variant: 'destructive',
                    });
                  }
                }
              }}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Task Title</Label>
              <Input
                id="task-title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Enter task title"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="task-description">Description (optional)</Label>
              <Textarea
                id="task-description"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Enter task description"
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddTaskDialog(false);
                  setNewTaskTitle('');
                  setNewTaskDescription('');
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!newTaskTitle.trim()}
                onClick={async () => {
                  if (editingProject && newTaskTitle.trim()) {
                    try {
                      await apiRequest(
                        'POST',
                        `/api/projects/${editingProject}/tasks`,
                        {
                          title: newTaskTitle.trim(),
                          description: newTaskDescription.trim() || null,
                          status: 'pending',
                          priority: 'medium',
                        }
                      );
                      queryClient.invalidateQueries({
                        queryKey: [`/api/projects/${editingProject}/tasks`],
                      });
                      toast({
                        title: 'Success',
                        description: 'Task added successfully',
                      });
                      setShowAddTaskDialog(false);
                      setNewTaskTitle('');
                      setNewTaskDescription('');
                    } catch (error) {
                      toast({
                        title: 'Error',
                        description: 'Failed to add task',
                        variant: 'destructive',
                      });
                    }
                  }
                }}
              >
                Add Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog
        open={showResetConfirmDialog}
        onOpenChange={setShowResetConfirmDialog}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="w-5 h-5" />
              Reset Agenda Planning for Next Week?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p className="text-gray-700">
                  <strong>This action will permanently:</strong>
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-orange-800">
                      <strong>
                        Convert all discussion and decision notes to tasks
                      </strong>{' '}
                      (if they haven't been already)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <X className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-orange-800">
                      <strong>Clear all text boxes</strong> in discussion points
                      and decision items
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <RotateCcw className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-orange-800">
                      <strong>Reset all project selections</strong>{' '}
                      (agenda/tabled status)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ExternalLink className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-orange-800">
                      <strong>Refresh projects list</strong> from Google Sheets
                      with any updates made during the week
                    </span>
                  </div>
                </div>
                <p className="text-gray-600 text-sm">
                  This prepares the agenda planning interface for next week's
                  meeting.
                  <strong>
                    {' '}
                    Make sure you've finalized this week's agenda first!
                  </strong>
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowResetConfirmDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => resetAgendaPlanningMutation.mutate()}
              disabled={resetAgendaPlanningMutation.isPending}
              style={{ backgroundColor: '#FBAD3F' }}
              onMouseEnter={(e) =>
                !resetAgendaPlanningMutation.isPending &&
                (e.target.style.backgroundColor = '#e09d36')
              }
              onMouseLeave={(e) =>
                !resetAgendaPlanningMutation.isPending &&
                (e.target.style.backgroundColor = '#FBAD3F')
              }
              className="flex-1 text-white"
            >
              {resetAgendaPlanningMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Resetting...
                </div>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Yes, Reset for Next Week
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Project Dialog */}
      <AddProjectDialog
        open={showAddProjectDialog}
        onOpenChange={setShowAddProjectDialog}
        newProjectData={newProjectData}
        setNewProjectData={setNewProjectData}
        handleCreateProject={handleCreateProject}
        isCreating={createProjectMutation.isPending}
      />
    </div>
  );
}
