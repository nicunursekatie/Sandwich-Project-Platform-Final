import React, { useState, useCallback, useRef } from 'react';
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

interface ProjectTask {
  id: number;
  title: string;
  description?: string;
  status: string;
  assigneeName?: string;
  dueDate?: string;
  priority: string;
}

// Helper function to format status text
const formatStatusText = (status: string) => {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to get status badge color and style
const getStatusBadgeProps = (status: string) => {
  switch (status) {
    case 'completed':
      return {
        variant: 'default' as const,
        className: 'bg-teal-100 text-teal-800 border-teal-200',
      };
    case 'in_progress':
      return {
        variant: 'secondary' as const,
        className: 'text-black border-2',
        style: { backgroundColor: '#FBAD3F', borderColor: '#FBAD3F' },
      };
    case 'pending':
      return {
        variant: 'secondary' as const,
        className: 'bg-gray-100 text-gray-800 border-gray-200',
      };
    case 'on_hold':
      return {
        variant: 'outline' as const,
        className: 'bg-red-50 text-red-700 border-red-200',
      };
    default:
      return {
        variant: 'secondary' as const,
        className: 'bg-gray-100 text-gray-800 border-gray-200',
      };
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'technology':
      return '💻';
    case 'events':
      return '📅';
    case 'grants':
      return '💰';
    case 'outreach':
      return '🤝';
    case 'marketing':
      return '📢';
    case 'operations':
      return '⚙️';
    case 'community':
      return '👥';
    case 'fundraising':
      return '💵';
    case 'event':
      return '🎉';
    default:
      return '📁';
  }
};

// Project Tasks Component
function ProjectTasksView({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: tasks = [], isLoading } = useQuery<ProjectTask[]>({
    queryKey: [`/api/projects/${projectId}/tasks`],
  });

  // Mutation for marking tasks as complete
  const markTaskCompleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest('POST', `/api/tasks/${taskId}/complete`, {
        notes: 'Task marked complete during agenda planning',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Task Completed',
        description: 'Task has been marked as complete',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Complete Task',
        description: error?.message || 'Failed to mark task as complete',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading tasks...</div>;
  }

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-3">
        No tasks yet. Add tasks to track project progress.
      </div>
    );
  }

  return (
    <div>
      <Label className="text-sm font-medium text-gray-700 mb-2 block">
        Project Tasks ({Array.isArray(tasks) ? tasks.length : 0})
      </Label>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {Array.isArray(tasks) &&
          tasks.map((task: ProjectTask) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge
                    {...getStatusBadgeProps(task.status)}
                    className={`text-xs ${
                      getStatusBadgeProps(task.status).className
                    }`}
                    style={getStatusBadgeProps(task.status).style}
                  >
                    {formatStatusText(task.status)}
                  </Badge>
                  <span className="font-medium">{task.title}</span>
                </div>
                {task.assigneeName && (
                  <div className="text-gray-600 mt-1">
                    Assigned: {task.assigneeName}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {task.dueDate && (
                  <div className="text-gray-500 text-xs">
                    Due: {formatDateForDisplay(task.dueDate)}
                  </div>
                )}
                {task.status !== 'completed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={() => markTaskCompleteMutation.mutate(task.id)}
                    disabled={markTaskCompleteMutation.isPending}
                    data-testid={`button-complete-task-${task.id}`}
                  >
                    {markTaskCompleteMutation.isPending ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
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

  // Fetch meetings
  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<
    Meeting[]
  >({
    queryKey: ['/api/meetings'],
  });

  // Ensure meetings is always an array to prevent filter errors
  const safeMeetings: Meeting[] = Array.isArray(meetings) ? meetings : [];

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

  // Fetch agenda items for selected meeting
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

  // Create off-agenda item mutation
  const createOffAgendaItemMutation = useMutation({
    mutationFn: async (itemData: {
      title: string;
      section: string;
      meetingId: number;
    }) => {
      return await apiRequest('POST', '/api/agenda-items', {
        title: itemData.title,
        description: `Section: ${itemData.section}`,
        meetingId: itemData.meetingId,
        submittedBy: user?.email || 'unknown',
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
            errorJson.error ||
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

  // Helper function to format dates in a user-friendly way - TIMEZONE SAFE
  const formatMeetingDate = (dateString: string) => {
    // Use timezone-safe parsing by adding noon time
    const date = new Date(dateString + 'T12:00:00');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Create local date comparisons to avoid timezone issues
    const meetingDateOnly = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const todayOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const tomorrowOnly = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate()
    );

    if (meetingDateOnly.getTime() === todayOnly.getTime()) {
      return 'Today';
    } else if (meetingDateOnly.getTime() === tomorrowOnly.getTime()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year:
          date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  // Helper function to format time in a user-friendly way - using utility
  const formatMeetingTime = (timeString: string) => {
    return formatTimeForDisplay(timeString);
  };

  // Helper function to determine if meeting is in the past - using utility
  const isPastMeeting = (dateString: string, timeString: string) => {
    return isDateInPast(dateString, timeString);
  };

  // Helper function to get current date range for breadcrumbs
  const getCurrentDateRange = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday

    return {
      week: `${startOfWeek.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} - ${endOfWeek.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`,
      month: now.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    };
  };

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
        throw new Error(`Failed to download PDF: ${response.statusText}`);
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
                  The following projects are marked for review in the next
                  meeting and will be automatically included in compiled
                  agendas:
                </p>
                <div className="space-y-2">
                  {projectsForReview.slice(0, 3).map((project: Project) => (
                    <div
                      key={project.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Badge
                        variant="outline"
                        className="border-orange-300 text-orange-700"
                      >
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
              className="flex items-center justify-center gap-2 text-white px-3 md:px-4 py-3 md:py-2.5 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 w-full sm:w-auto text-sm"
              style={{ backgroundColor: '#FBAD3F' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e09d36';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FBAD3F';
              }}
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Meeting</span>
            </button>
          </div>

          {/* Upcoming Meetings Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-teal-900">
                Upcoming Meetings
              </h2>
              <Badge className="bg-teal-100 text-teal-800">
                {upcomingMeetings.length} scheduled
              </Badge>
            </div>

            {upcomingMeetings.length === 0 ? (
              <Card className="border-gray-200 bg-gray-50">
                <CardContent className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Upcoming Meetings
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Schedule your next team meeting to get started.
                  </p>
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
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {upcomingMeetings.map((meeting: Meeting) => (
                  <Card
                    key={meeting.id}
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
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-teal-200 text-teal-700 hover:bg-teal-50 hover:border-teal-300 rounded-lg font-medium transition-all duration-200 text-sm"
                        >
                          <FileText className="w-4 h-4" />
                          View Agenda Details
                        </button>

                        <button
                          onClick={() => handleCompileAgenda(meeting)}
                          disabled={isCompiling}
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
          <Dialog
            open={!!selectedMeeting}
            onOpenChange={() => setSelectedMeeting(null)}
          >
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {selectedMeeting?.title} -{' '}
                  {selectedMeeting &&
                  isPastMeeting(selectedMeeting.date, selectedMeeting.time)
                    ? 'Meeting Documentation'
                    : 'Agenda Review'}
                </DialogTitle>
              </DialogHeader>

              {selectedMeeting &&
              isPastMeeting(selectedMeeting.date, selectedMeeting.time) ? (
                // Past Meeting - Show PDF preview and download
                <div className="space-y-6">
                  <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-teal-900">Date:</span>
                        <span className="ml-2 text-teal-800">
                          {formatMeetingDate(selectedMeeting.date)}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-teal-900">Time:</span>
                        <span className="ml-2 text-teal-800">
                          {formatMeetingTime(selectedMeeting.time)}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-teal-900">
                          Status:
                        </span>
                        <Badge className="ml-2 bg-gray-200 text-gray-700">
                          Completed
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* PDF Preview Area */}
                  <div className="border-2 border-dashed border-teal-300 rounded-lg p-8 text-center bg-teal-50/50">
                    <FileText className="w-16 h-16 text-teal-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-teal-900 mb-2">
                      Meeting Agenda PDF
                    </h3>
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
                        Meeting notes and action items would be displayed here
                        once available.
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
                        <span className="ml-2 text-teal-800">
                          {formatMeetingDate(selectedMeeting?.date || '')}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-teal-900">Time:</span>
                        <span className="ml-2 text-teal-800">
                          {formatMeetingTime(selectedMeeting?.time || '')}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-teal-900">
                          Duration:
                        </span>
                        <span className="ml-2 text-teal-800">
                          {compiledAgenda.totalEstimatedTime || '1 hour'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-teal-900">
                          Status:
                        </span>
                        <Badge
                          className="ml-2"
                          variant={
                            compiledAgenda.status === 'finalized'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {compiledAgenda.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Agenda Sections */}
                  <div className="space-y-4">
                    {compiledAgenda.sections?.map(
                      (section: AgendaSection, index: number) => (
                        <Card
                          key={section.id}
                          className="border-l-4 border-l-teal-500"
                        >
                          <CardHeader className="pb-3">
                            <CardTitle
                              className={`flex items-center gap-2 text-lg ${getSectionColor(
                                section.title
                              )} bg-white px-3 py-2 rounded`}
                            >
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
                                {section.items.map(
                                  (item: AgendaItem, itemIndex: number) => (
                                    <div
                                      key={itemIndex}
                                      className="p-3 bg-gray-50 rounded border"
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <h4 className="font-medium text-gray-900">
                                            {item.title}
                                          </h4>
                                          {item.description && (
                                            <p className="text-sm text-gray-600 mt-1">
                                              {item.description}
                                            </p>
                                          )}
                                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                            <span>
                                              Presenter: {item.submittedBy}
                                            </span>
                                            <span>
                                              Time:{' '}
                                              {item.estimatedTime || '5 min'}
                                            </span>
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              {item.type.replace('_', ' ')}
                                            </Badge>
                                          </div>
                                        </div>
                                        {item.status && (
                                          <Badge
                                            variant={
                                              item.status === 'approved'
                                                ? 'default'
                                                : 'secondary'
                                            }
                                          >
                                            {item.status}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-500 italic">
                                No items in this section
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      )
                    )}
                  </div>

                  {/* Export Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() =>
                        selectedMeeting && handleExportToSheets(selectedMeeting)
                      }
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
                  <h3 className="text-lg font-medium text-teal-900 mb-2">
                    Ready to Compile Weekly Agenda
                  </h3>
                  <p className="text-teal-700 mb-6">
                    Compile the agenda from your Google Sheet projects and
                    submitted agenda items
                  </p>
                  <button
                    onClick={() =>
                      selectedMeeting && handleCompileAgenda(selectedMeeting)
                    }
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

          {/* New Meeting Dialog */}
          <Dialog
            open={showNewMeetingDialog}
            onOpenChange={setShowNewMeetingDialog}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-teal-600" />
                  Schedule New Meeting
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Meeting Title *</Label>
                  <Input
                    id="title"
                    value={newMeetingData.title}
                    onChange={(e) =>
                      setNewMeetingData({
                        ...newMeetingData,
                        title: e.target.value,
                      })
                    }
                    placeholder="Core Team Meeting"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newMeetingData.date}
                      onChange={(e) =>
                        setNewMeetingData({
                          ...newMeetingData,
                          date: normalizeDate(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newMeetingData.time}
                      onChange={(e) =>
                        setNewMeetingData({
                          ...newMeetingData,
                          time: e.target.value,
                        })
                      }
                      placeholder="TBD"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Meeting Type</Label>
                  <Select
                    value={newMeetingData.type}
                    onValueChange={(value) =>
                      setNewMeetingData({ ...newMeetingData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="core_team">
                        Core Team Meeting
                      </SelectItem>
                      <SelectItem value="committee">
                        Committee Meeting
                      </SelectItem>
                      <SelectItem value="board">Board Meeting</SelectItem>
                      <SelectItem value="planning">Planning Session</SelectItem>
                      <SelectItem value="training">Training Session</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={newMeetingData.location}
                    onChange={(e) =>
                      setNewMeetingData({
                        ...newMeetingData,
                        location: e.target.value,
                      })
                    }
                    placeholder="Conference room, Zoom link, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newMeetingData.description}
                    onChange={(e) =>
                      setNewMeetingData({
                        ...newMeetingData,
                        description: e.target.value,
                      })
                    }
                    placeholder="Brief description of the meeting purpose..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowNewMeetingDialog(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateMeeting}
                    disabled={createMeetingMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed"
                  >
                    {createMeetingMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <CalendarDays className="w-4 h-4" />
                    )}
                    Schedule Meeting
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Meeting Dialog */}
          <Dialog
            open={showEditMeetingDialog}
            onOpenChange={setShowEditMeetingDialog}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-orange-600" />
                  Edit Meeting Details
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Meeting Title *</Label>
                  <Input
                    id="edit-title"
                    value={editMeetingData.title}
                    onChange={(e) =>
                      setEditMeetingData({
                        ...editMeetingData,
                        title: e.target.value,
                      })
                    }
                    placeholder="Core Team Meeting"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="edit-date">Date *</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editMeetingData.date}
                      onChange={(e) =>
                        setEditMeetingData({
                          ...editMeetingData,
                          date: normalizeDate(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-time">Time</Label>
                    <Input
                      id="edit-time"
                      type="time"
                      value={editMeetingData.time}
                      onChange={(e) =>
                        setEditMeetingData({
                          ...editMeetingData,
                          time: e.target.value,
                        })
                      }
                      placeholder="TBD"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-type">Meeting Type</Label>
                  <Select
                    value={editMeetingData.type}
                    onValueChange={(value) =>
                      setEditMeetingData({ ...editMeetingData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="core_team">
                        Core Team Meeting
                      </SelectItem>
                      <SelectItem value="committee">
                        Committee Meeting
                      </SelectItem>
                      <SelectItem value="board">Board Meeting</SelectItem>
                      <SelectItem value="planning">Planning Session</SelectItem>
                      <SelectItem value="training">Training Session</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-location">Location</Label>
                  <Input
                    id="edit-location"
                    value={editMeetingData.location}
                    onChange={(e) =>
                      setEditMeetingData({
                        ...editMeetingData,
                        location: e.target.value,
                      })
                    }
                    placeholder="Conference room, Zoom link, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editMeetingData.description}
                    onChange={(e) =>
                      setEditMeetingData({
                        ...editMeetingData,
                        description: e.target.value,
                      })
                    }
                    placeholder="Brief description of the meeting purpose..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowEditMeetingDialog(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteMeeting}
                    disabled={deleteMeetingMutation.isPending}
                    className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleteMeetingMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={handleUpdateMeeting}
                    disabled={updateMeetingMutation.isPending}
                    style={{ backgroundColor: '#FBAD3F' }}
                    onMouseEnter={(e) =>
                      !updateMeetingMutation.isPending &&
                      (e.target.style.backgroundColor = '#e09d36')
                    }
                    onMouseLeave={(e) =>
                      !updateMeetingMutation.isPending &&
                      (e.target.style.backgroundColor = '#FBAD3F')
                    }
                    className="flex-1 flex items-center justify-center gap-2 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed"
                  >
                    {updateMeetingMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Update Meeting
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Agenda Planning Tab */}
      {activeTab === 'agenda' && (
        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Weekly Agenda Planning
              </h2>
              <p className="text-gray-600">
                Select projects and topics for this week's meeting
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    setIsCompiling(true);
                    const response = await apiRequest(
                      'POST',
                      '/api/google-sheets/projects/sync/from-sheets'
                    );
                    toast({
                      title: 'Sync Complete',
                      description:
                        response.message ||
                        'Successfully synced projects from Google Sheets',
                    });
                    // Refresh the projects data
                    queryClient.invalidateQueries({
                      queryKey: ['/api/projects'],
                    });
                  } catch (error: any) {
                    toast({
                      title: 'Sync Failed',
                      description:
                        error?.message || 'Failed to sync from Google Sheets',
                      variant: 'destructive',
                    });
                  } finally {
                    setIsCompiling(false);
                  }
                }}
                disabled={isCompiling}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {isCompiling ? 'Syncing...' : 'Sync Google Sheets'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetConfirmDialog(true)}
                disabled={resetAgendaPlanningMutation.isPending}
                style={{ borderColor: '#FBAD3F', color: '#FBAD3F' }}
                onMouseEnter={(e) =>
                  (e.target.style.backgroundColor = '#fef7e6')
                }
                onMouseLeave={(e) =>
                  (e.target.style.backgroundColor = 'transparent')
                }
                className=""
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset for Next Week
              </Button>

              {(agendaSummary.agendaCount > 0 ||
                agendaSummary.tabledCount > 0) && (
                <Button
                  size="sm"
                  onClick={handleFinalizeAgenda}
                  disabled={isGeneratingPDF}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isGeneratingPDF ? 'Generating...' : 'Finalize Agenda PDF'}
                </Button>
              )}
            </div>
          </div>

          {/* Agenda Summary */}
          {(agendaSummary.agendaCount > 0 || agendaSummary.tabledCount > 0) && (
            <Card className="bg-gradient-to-r from-teal-50 to-accent/10 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-primary">Agenda Status</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-teal-700">
                        📅 {agendaSummary.agendaCount} for agenda
                      </span>
                      <span className="text-sm text-orange-700">
                        ⏳ {agendaSummary.tabledCount} tabled
                      </span>
                      {agendaSummary.undecidedCount > 0 && (
                        <span className="text-sm text-gray-600">
                          ❓ {agendaSummary.undecidedCount} undecided
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleFinalizeAgenda}
                    disabled={
                      isGeneratingPDF || agendaSummary.agendaCount === 0
                    }
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {isGeneratingPDF ? 'Generating...' : 'Download Agenda PDF'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Indicator */}
          {allProjects.length > 0 && (
            <div className="sticky top-0 bg-white z-10 p-3 border-b border-gray-200 rounded-lg shadow-sm">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-gray-700">
                  Reviewing projects for meeting
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-teal-600 font-medium">
                    {agendaSummary.agendaCount + agendaSummary.tabledCount} of{' '}
                    {allProjects.filter((p) => p.status !== 'completed').length}{' '}
                    reviewed
                  </span>
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          ((agendaSummary.agendaCount +
                            agendaSummary.tabledCount) /
                            allProjects.filter((p) => p.status !== 'completed')
                              .length) *
                            100
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Projects Selection Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-teal-600" />
                Google Sheets Projects (
                {
                  allProjects.filter(
                    (project: any) => project.status !== 'completed'
                  ).length
                }
                )
              </CardTitle>
              <p className="text-gray-600">
                Select projects to discuss and specify what about each project
                needs attention
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allProjects.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>
                      No projects found. Sync with Google Sheets to load
                      projects.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allProjects
                      .filter((project: any) => project.status !== 'completed')
                      .map((project: any, index: number) => {
                        // Add section headers to break up the list
                        let sectionHeader = null;
                        const filteredProjects = allProjects.filter(
                          (p: any) => p.status !== 'completed'
                        );

                        if (index === 0) {
                          const needsDiscussionCount = filteredProjects.filter(
                            (p: any) =>
                              p.meetingDiscussionPoints ||
                              p.meetingDecisionItems
                          ).length;
                          if (needsDiscussionCount > 0) {
                            sectionHeader = (
                              <h4
                                key="needs-discussion"
                                className="text-xs font-semibold text-gray-500 my-4 uppercase tracking-wider"
                              >
                                NEEDS DISCUSSION ({needsDiscussionCount})
                              </h4>
                            );
                          }
                        } else if (
                          index === Math.floor(filteredProjects.length * 0.4)
                        ) {
                          sectionHeader = (
                            <h4
                              key="in-progress"
                              className="text-xs font-semibold text-gray-500 my-4 uppercase tracking-wider"
                            >
                              IN PROGRESS
                            </h4>
                          );
                        } else if (
                          index === Math.floor(filteredProjects.length * 0.7)
                        ) {
                          sectionHeader = (
                            <h4
                              key="other-projects"
                              className="text-xs font-semibold text-gray-500 my-4 uppercase tracking-wider"
                            >
                              OTHER PROJECTS
                            </h4>
                          );
                        }
                        // Use our date utility to avoid timezone conversion issues
                        const lastDiscussed = project.lastDiscussedDate
                          ? formatDateForDisplay(project.lastDiscussedDate)
                          : 'Never discussed';

                        const isMinimized = minimizedProjects.has(project.id);
                        const agendaStatus =
                          projectAgendaStatus[project.id] || 'none';
                        const needsDiscussion =
                          project.meetingDiscussionPoints ||
                          project.meetingDecisionItems;

                        // Minimized view
                        if (isMinimized) {
                          return (
                            <div key={`wrapper-${project.id}`}>
                              {sectionHeader}
                              <Card
                                className={`border-2 transition-all mb-2 ${
                                  agendaStatus === 'agenda'
                                    ? 'border-green-300 bg-green-50'
                                    : agendaStatus === 'tabled'
                                      ? 'border-orange-300 bg-orange-50'
                                      : index % 2 === 0
                                        ? 'border-gray-200 bg-white'
                                        : 'border-gray-200 bg-gray-50'
                                }`}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3">
                                        <h3 className="font-medium text-gray-900">
                                          {project.title}
                                        </h3>
                                        <Badge
                                          className={`text-xs font-medium ${
                                            agendaStatus === 'agenda'
                                              ? 'bg-green-100 text-green-800 border-green-200'
                                              : agendaStatus === 'tabled'
                                                ? 'bg-orange-100 text-orange-800 border-orange-200'
                                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                          }`}
                                        >
                                          {agendaStatus === 'agenda'
                                            ? '📅 On Agenda'
                                            : agendaStatus === 'tabled'
                                              ? '⏳ Tabled'
                                              : 'Not Scheduled'}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                        <span>
                                          <strong>Owner:</strong>{' '}
                                          {project.assigneeName || 'Unassigned'}
                                        </span>
                                        {project.supportPeople && (
                                          <span>
                                            <strong>Support:</strong>{' '}
                                            {project.supportPeople}
                                          </span>
                                        )}
                                      </div>
                                      {(project.meetingDiscussionPoints ||
                                        project.meetingDecisionItems) && (
                                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                          {project.meetingDiscussionPoints && (
                                            <div className="mb-1">
                                              <strong>Discussion:</strong>{' '}
                                              {project.meetingDiscussionPoints.slice(
                                                0,
                                                100
                                              )}
                                              {project.meetingDiscussionPoints
                                                .length > 100 && '...'}
                                            </div>
                                          )}
                                          {project.meetingDecisionItems && (
                                            <div>
                                              <strong>Decisions:</strong>{' '}
                                              {project.meetingDecisionItems.slice(
                                                0,
                                                100
                                              )}
                                              {project.meetingDecisionItems
                                                .length > 100 && '...'}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-2 ml-4 opacity-80 hover:opacity-100 transition-opacity">
                                      {agendaStatus === 'agenda' ? (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              handleExpandProject(project.id)
                                            }
                                            className="flex items-center gap-1"
                                          >
                                            <FolderOpen className="w-4 h-4" />
                                            Reopen Project
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              handleTableProject(project.id)
                                            }
                                            className="flex items-center gap-1 text-orange-700 hover:text-orange-800"
                                          >
                                            <X className="w-4 h-4" />
                                            Remove from Agenda
                                          </Button>
                                        </>
                                      ) : agendaStatus === 'tabled' ? (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              handleExpandProject(project.id)
                                            }
                                            className="flex items-center gap-1"
                                          >
                                            <FolderOpen className="w-4 h-4" />
                                            Reopen Project
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              handleSendToAgenda(project.id)
                                            }
                                            className="flex items-center gap-1 text-green-700 hover:text-green-800"
                                          >
                                            <CalendarDays className="w-4 h-4" />
                                            Send to Agenda
                                          </Button>
                                        </>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleExpandProject(project.id)
                                          }
                                          className="flex items-center gap-1"
                                        >
                                          <Edit3 className="w-4 h-4" />
                                          Edit
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          );
                        }

                        // Full view with alternating backgrounds for easier scanning
                        return (
                          <div key={`wrapper-full-${project.id}`}>
                            {sectionHeader}
                            <Card
                              className={`border border-gray-200 hover:border-gray-300 mb-3 ${
                                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                              }`}
                            >
                              <CardHeader className="pb-4">
                                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-lg text-gray-900">
                                      {project.title}
                                    </CardTitle>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                      <Badge
                                        {...getStatusBadgeProps(project.status)}
                                        className={`${
                                          getStatusBadgeProps(project.status)
                                            .className
                                        } whitespace-nowrap`}
                                        style={
                                          getStatusBadgeProps(project.status)
                                            .style
                                        }
                                      >
                                        {formatStatusText(project.status)}
                                      </Badge>
                                      {project.priority && (
                                        <Badge
                                          variant="outline"
                                          className="whitespace-nowrap"
                                        >
                                          {project.priority}
                                        </Badge>
                                      )}
                                      {project.category &&
                                        project.category !==
                                          project.milestone && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs bg-brand-primary text-white whitespace-nowrap"
                                          >
                                            {getCategoryIcon(project.category)}{' '}
                                            {project.category}
                                          </Badge>
                                        )}
                                      <Badge
                                        variant="outline"
                                        className="text-xs bg-teal-50 text-teal-700 whitespace-nowrap"
                                      >
                                        Last discussed: {lastDiscussed}
                                      </Badge>
                                    </div>
                                    {project.description && (
                                      <p className="text-sm text-gray-600 mt-2">
                                        {project.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleSendToAgenda(project.id)
                                      }
                                      className={`px-3 py-2 rounded font-medium transition-all text-sm whitespace-nowrap ${
                                        agendaStatus === 'agenda'
                                          ? 'bg-teal-600 text-white'
                                          : 'bg-white border-2 border-teal-600 text-teal-600 hover:bg-teal-50'
                                      }`}
                                    >
                                      {agendaStatus === 'agenda'
                                        ? '✓ On Agenda'
                                        : 'Send to Agenda'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleTableProject(project.id)
                                      }
                                      className="px-3 py-2 rounded font-medium border-2 border-orange-500 text-orange-700 hover:bg-orange-50 transition-all text-sm whitespace-nowrap"
                                    >
                                      ⏳ Table for Later
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>

                              <CardContent className="space-y-4">
                                {/* People Involved */}
                                <div>
                                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                                    People Involved
                                  </Label>
                                  <div className="flex flex-wrap gap-2">
                                    {(() => {
                                      const people = [];

                                      // Add owner/assignee
                                      if (project.assigneeName) {
                                        people.push({
                                          role: 'Owner',
                                          name: project.assigneeName,
                                        });
                                      }

                                      // Add support people from Google Sheets
                                      if (project.supportPeople) {
                                        const supportList =
                                          project.supportPeople
                                            .split(',')
                                            .map((p) => p.trim())
                                            .filter((p) => p);
                                        supportList.forEach((person) => {
                                          people.push({
                                            role: 'Support',
                                            name: person,
                                          });
                                        });
                                      }

                                      // Creator is hidden from meeting project lists

                                      if (people.length === 0) {
                                        return (
                                          <span className="text-gray-500 text-sm">
                                            Not assigned
                                          </span>
                                        );
                                      }

                                      return people.map((person, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded"
                                        >
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            {person.role}
                                          </Badge>
                                          <span className="text-sm">
                                            {person.name}
                                          </span>
                                        </div>
                                      ));
                                    })()}
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-7"
                                        onClick={() => {
                                          setEditingProject(project.id);
                                          setEditProjectOwner(
                                            project.assigneeName || ''
                                          );
                                          setShowEditOwnerDialog(true);
                                        }}
                                      >
                                        <UserCog className="w-3 h-3 mr-1" />
                                        Edit Owner
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-7"
                                        onClick={() => {
                                          setEditingProject(project.id);
                                          setEditSupportPeople(
                                            project.supportPeople || ''
                                          );
                                          setShowEditPeopleDialog(true);
                                        }}
                                      >
                                        <Users className="w-3 h-3 mr-1" />
                                        Edit Support
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                                {/* Project Tasks */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                      Project Tasks
                                    </Label>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs h-7"
                                      onClick={() => {
                                        setEditingProject(project.id);
                                        setShowAddTaskDialog(true);
                                      }}
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Add Task
                                    </Button>
                                  </div>
                                  <ProjectTasksView projectId={project.id} />
                                </div>

                                {/* Meeting Discussion Interface - Redesigned for clarity */}
                                <div className="space-y-6 bg-teal-50 p-4 rounded-lg border border-teal-200">
                                  <div className="text-center">
                                    <h4 className="font-medium text-primary mb-1">
                                      Meeting Discussion Prep
                                    </h4>
                                    <p className="text-sm text-teal-700">
                                      Only fill out if this project needs team
                                      discussion this week
                                    </p>
                                  </div>

                                  <div className="space-y-4">
                                    <div>
                                      <Label className="text-sm font-semibold text-primary mb-2 block">
                                        💬 What do we need to talk about?
                                      </Label>
                                      <p className="text-xs text-teal-700 mb-2">
                                        Examples: "Blocked on X", "Need feedback
                                        on approach", "Budget concerns",
                                        "Timeline slipping"
                                      </p>
                                      <Textarea
                                        value={getTextValue(
                                          project.id,
                                          'discussionPoints',
                                          project.meetingDiscussionPoints || ''
                                        )}
                                        onChange={(e) =>
                                          handleTextChange(
                                            project.id,
                                            'discussionPoints',
                                            e.target.value
                                          )
                                        }
                                        placeholder="What issue, update, or concern needs the team's input?"
                                        rows={3}
                                        className="text-sm"
                                      />
                                      <p className="text-xs text-gray-500 mt-1">
                                        Auto-saves as you type
                                      </p>
                                    </div>

                                    <div>
                                      <Label className="text-sm font-semibold text-primary mb-2 block">
                                        ✅ What decisions need to be made?
                                      </Label>
                                      <p className="text-xs text-teal-700 mb-2">
                                        Examples: "Approve budget of $X",
                                        "Choose between option A/B", "Assign
                                        person Y to task Z"
                                      </p>
                                      <Textarea
                                        value={getTextValue(
                                          project.id,
                                          'decisionItems',
                                          project.meetingDecisionItems || ''
                                        )}
                                        onChange={(e) =>
                                          handleTextChange(
                                            project.id,
                                            'decisionItems',
                                            e.target.value
                                          )
                                        }
                                        placeholder="What specific choices or approvals does the team need to make?"
                                        rows={3}
                                        className="text-sm"
                                      />
                                      <p className="text-xs text-gray-500 mt-1">
                                        Auto-saves as you type
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* File Attachments */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                      Project Files
                                    </Label>
                                    <ObjectUploader
                                      onComplete={(files) => {
                                        setUploadedFiles((prev) => ({
                                          ...prev,
                                          [project.id]: [
                                            ...(prev[project.id] || []),
                                            ...files,
                                          ],
                                        }));
                                        toast({
                                          title: 'Files uploaded',
                                          description: `${files.length} file(s) uploaded successfully for ${project.title}`,
                                        });
                                      }}
                                    >
                                      <FileText className="w-3 h-3 mr-1" />
                                      Upload File
                                    </ObjectUploader>
                                  </div>

                                  {uploadedFiles[project.id] &&
                                  uploadedFiles[project.id].length > 0 ? (
                                    <div className="space-y-2">
                                      {uploadedFiles[project.id].map(
                                        (file, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-center gap-2 p-2 bg-teal-50 rounded text-sm border border-teal-200"
                                          >
                                            <FileText className="w-4 h-4 text-primary" />
                                            <span className="flex-1 text-primary">
                                              {file.name}
                                            </span>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-6 px-2 text-primary hover:text-primary/80"
                                              onClick={() =>
                                                window.open(file.url, '_blank')
                                              }
                                            >
                                              View
                                            </Button>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500 italic">
                                      No files attached yet
                                    </p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Add One-off Items */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add One-off Agenda Item
              </CardTitle>
              <p className="text-sm text-gray-600">
                For items not related to existing projects
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  placeholder="Item title"
                  className="md:col-span-2"
                  value={offAgendaTitle}
                  onChange={(e) => setOffAgendaTitle(e.target.value)}
                />
                <Select
                  value={offAgendaSection}
                  onValueChange={setOffAgendaSection}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="old_business">Old Business</SelectItem>
                    <SelectItem value="urgent_items">Urgent Items</SelectItem>
                    <SelectItem value="housekeeping">Housekeeping</SelectItem>
                    <SelectItem value="new_business">New Business</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddOffAgendaItem}
                  disabled={createOffAgendaItemMutation.isPending}
                  style={{ backgroundColor: '#FBAD3F' }}
                  onMouseEnter={(e) =>
                    !createOffAgendaItemMutation.isPending &&
                    (e.target.style.backgroundColor = '#e09d36')
                  }
                  onMouseLeave={(e) =>
                    !createOffAgendaItemMutation.isPending &&
                    (e.target.style.backgroundColor = '#FBAD3F')
                  }
                >
                  {createOffAgendaItemMutation.isPending
                    ? 'Adding...'
                    : 'Add Item'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Display One-off Agenda Items */}
          {console.log('[Frontend] Rendering agenda items:', agendaItems)}
          {agendaItems.length > 0 && (
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-gray-700">One-off Agenda Items</span>
                  <Badge variant="secondary" className="text-xs">
                    {agendaItems.length}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Items added for this meeting
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {agendaItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {item.title}
                        </h4>
                        {item.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {item.section || 'General'}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            Added {new Date(item.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete "${item.title}"?`)) {
                              deleteAgendaItemMutation.mutate(item.id);
                            }
                          }}
                          disabled={deleteAgendaItemMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {selectedProjectIds.length > 0 && (
            <Card className="border-teal-200 bg-teal-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-teal-900">
                      {selectedProjectIds.length} project
                      {selectedProjectIds.length !== 1 ? 's' : ''} selected for
                      discussion
                    </h3>
                    <p className="text-sm text-teal-700">
                      These will be added to the next compiled agenda
                    </p>
                  </div>
                  <Button className="bg-teal-600 hover:bg-teal-700">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirm Selection
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Floating Action Bar */}
          {(agendaSummary.agendaCount > 0 || agendaSummary.tabledCount > 0) && (
            <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border border-gray-200 z-50">
              <div className="text-sm text-gray-600 mb-2 font-medium">
                {agendaSummary.agendaCount + agendaSummary.tabledCount} projects
                reviewed
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleFinalizeAgenda}
                  disabled={isGeneratingPDF || agendaSummary.agendaCount === 0}
                  className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 transition-all"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Generate PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => createTasksFromNotesMutation.mutate()}
                  disabled={createTasksFromNotesMutation.isPending}
                  className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  {createTasksFromNotesMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                      Creating Tasks...
                    </div>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Create Tasks from Notes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
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
    </div>
  );
}
