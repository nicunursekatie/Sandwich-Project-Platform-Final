import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ProjectAssigneeSelector } from '@/components/project-assignee-selector';
import { TaskAssigneeSelector } from '@/components/task-assignee-selector';
import { ObjectUploader } from '@/components/ObjectUploader';
import { ProjectTasksView } from '../sections/ProjectTasksView';
import { AddProjectDialog } from '../dialogs/AddProjectDialog';
import { getCategoryIcon } from '../utils/categories';
import { formatStatusText, getStatusBadgeProps } from '../utils/status';
import { formatDateForDisplay } from '@/lib/date-utils';
import { formatSectionName } from '../utils/date';
import { useNotes, type CreateNoteData } from '../hooks/useNotes';
import {
  Plus,
  ExternalLink,
  CheckCircle2,
  Download,
  RotateCcw,
  FileText,
  Target,
  X,
  AlertCircle,
  UserCog,
  UserPlus,
  Edit3,
  Trash2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { UseMutationResult, QueryClient } from '@tanstack/react-query';
import type { ToastActionElement } from '@/components/ui/toast';

// Import types from hooks instead of re-declaring them
import type { Meeting } from '../hooks/useMeetings';
import type { Project, NewProjectData } from '../hooks/useProjects';
import type { AgendaItem } from '../hooks/useAgenda';

// Toast function type based on the useToast hook
type ToastFunction = (props: {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  action?: ToastActionElement;
}) => void;

interface AgendaPlanningTabProps {
  // State
  selectedMeeting: Meeting | null;
  meetings: Meeting[];
  selectedProjectIds: number[];
  setSelectedProjectIds: (ids: number[]) => void;
  projectAgendaStatus: Record<number, 'none' | 'agenda' | 'tabled'>;
  setProjectAgendaStatus: (status: Record<number, 'none' | 'agenda' | 'tabled'>) => void;
  minimizedProjects: Set<number>;
  setMinimizedProjects: (projects: Set<number>) => void;
  localProjectText: Record<number, { discussionPoints?: string; decisionItems?: string }>;
  showResetConfirmDialog: boolean;
  setShowResetConfirmDialog: (show: boolean) => void;
  showAddProjectDialog: boolean;
  setShowAddProjectDialog: (show: boolean) => void;
  newProjectData: NewProjectData;
  setNewProjectData: (data: NewProjectData) => void;
  offAgendaTitle: string;
  setOffAgendaTitle: (title: string) => void;
  offAgendaSection: string;
  setOffAgendaSection: (section: string) => void;
  isGeneratingPDF: boolean;
  isCompiling: boolean;
  setIsCompiling: (compiling: boolean) => void;
  showEditPeopleDialog: boolean;
  setShowEditPeopleDialog: (show: boolean) => void;
  showEditOwnerDialog: boolean;
  setShowEditOwnerDialog: (show: boolean) => void;
  showAddTaskDialog: boolean;
  setShowAddTaskDialog: (show: boolean) => void;
  editingProject: number | null;
  setEditingProject: (projectId: number | null) => void;
  editSupportPeople: string;
  setEditSupportPeople: (people: string) => void;
  editProjectOwner: string;
  setEditProjectOwner: (owner: string) => void;
  newTaskTitle: string;
  setNewTaskTitle: (title: string) => void;
  newTaskDescription: string;
  setNewTaskDescription: (description: string) => void;
  uploadedFiles: Record<number, { url: string; name: string }[]>;
  setUploadedFiles: (files: Record<number, { url: string; name: string }[]>) => void;
  
  // Data
  allProjects: Project[];
  agendaItems: AgendaItem[];
  agendaSummary: {
    agendaCount: number;
    tabledCount: number;
    undecidedCount: number;
  };
  
  // Handlers
  handleTextChange: (projectId: number, field: 'discussionPoints' | 'decisionItems', value: string) => void;
  getTextValue: (projectId: number, field: 'discussionPoints' | 'decisionItems', fallback: string) => string;
  handleSendToAgenda: (projectId: number) => void;
  handleTableProject: (projectId: number) => void;
  handleExpandProject: (projectId: number) => void;
  handleFinalizeAgenda: () => Promise<void>;
  handleAddOffAgendaItem: () => void;
  handleCreateProject: () => void;
  
  // Mutations - properly typed based on the hooks
  updateProjectDiscussionMutation: UseMutationResult<unknown, Error, { projectId: number; updates: { meetingDiscussionPoints?: string; meetingDecisionItems?: string; reviewInNextMeeting?: boolean; priority?: string; supportPeople?: string; assigneeName?: string } }, unknown>;
  updateProjectPriorityMutation: UseMutationResult<unknown, Error, { projectId: number; priority: string }, unknown>;
  createTasksFromNotesMutation: UseMutationResult<unknown, Error, void, unknown>;
  resetAgendaPlanningMutation: UseMutationResult<{ notesProcessed: number; notesCleared: number }, Error, void, unknown>;
  createOffAgendaItemMutation: UseMutationResult<unknown, Error, { title: string; section: string; meetingId: number }, unknown>;
  deleteAgendaItemMutation: UseMutationResult<unknown, Error, number, unknown>;
  createProjectMutation: UseMutationResult<unknown, Error, NewProjectData, unknown>;
  
  // Additional dependencies
  queryClient: QueryClient;
  apiRequest: <T = unknown>(method: string, url: string, body?: unknown) => Promise<T>;
  toast: ToastFunction;
}

export function AgendaPlanningTab({
  selectedMeeting,
  meetings,
  selectedProjectIds,
  setSelectedProjectIds,
  projectAgendaStatus,
  setProjectAgendaStatus,
  minimizedProjects,
  setMinimizedProjects,
  localProjectText,
  showResetConfirmDialog,
  setShowResetConfirmDialog,
  showAddProjectDialog,
  setShowAddProjectDialog,
  newProjectData,
  setNewProjectData,
  offAgendaTitle,
  setOffAgendaTitle,
  offAgendaSection,
  setOffAgendaSection,
  isGeneratingPDF,
  isCompiling,
  setIsCompiling,
  showEditPeopleDialog,
  setShowEditPeopleDialog,
  showEditOwnerDialog,
  setShowEditOwnerDialog,
  showAddTaskDialog,
  setShowAddTaskDialog,
  editingProject,
  setEditingProject,
  editSupportPeople,
  setEditSupportPeople,
  editProjectOwner,
  setEditProjectOwner,
  newTaskTitle,
  setNewTaskTitle,
  newTaskDescription,
  setNewTaskDescription,
  uploadedFiles,
  setUploadedFiles,
  allProjects,
  agendaItems,
  agendaSummary,
  handleTextChange,
  getTextValue,
  handleSendToAgenda,
  handleTableProject,
  handleExpandProject,
  handleFinalizeAgenda,
  handleAddOffAgendaItem,
  handleCreateProject,
  updateProjectDiscussionMutation,
  updateProjectPriorityMutation,
  createTasksFromNotesMutation,
  resetAgendaPlanningMutation,
  createOffAgendaItemMutation,
  deleteAgendaItemMutation,
  createProjectMutation,
  queryClient,
  apiRequest,
  toast,
}: AgendaPlanningTabProps) {
  // Add notes functionality
  const { createNoteMutation } = useNotes();

  // Function to create individual note items from agenda planning text boxes
  // This should only be called at the end of the meeting to finalize notes
  const handleFinalizeMeetingNotes = async () => {
    if (!selectedMeeting) {
      toast({
        title: 'No Meeting Selected',
        description: 'Please select a meeting before finalizing notes.',
        variant: 'destructive',
      });
      return;
    }

    let notesCreated = 0;
    const errors: string[] = [];

    // Process each project that has text content
    for (const project of allProjects) {
      const discussionPoints = getTextValue(project.id, 'discussionPoints', '');
      const decisionItems = getTextValue(project.id, 'decisionItems', '');

      // Create note for discussion points if there's content
      if (discussionPoints && discussionPoints.trim()) {
        try {
          await createNoteMutation.mutateAsync({
            projectId: project.id,
            meetingId: selectedMeeting.id,
            type: 'discussion',
            content: discussionPoints.trim(),
            status: 'active',
          });
          notesCreated++;
        } catch (error) {
          errors.push(`Failed to save discussion points for ${project.title}`);
        }
      }

      // Create note for decision items if there's content
      if (decisionItems && decisionItems.trim()) {
        try {
          await createNoteMutation.mutateAsync({
            projectId: project.id,
            meetingId: selectedMeeting.id,
            type: 'meeting',
            content: decisionItems.trim(),
            status: 'active',
          });
          notesCreated++;
        } catch (error) {
          errors.push(`Failed to save decision items for ${project.title}`);
        }
      }
    }

    // Show success/error message
    if (notesCreated > 0) {
      toast({
        title: 'Meeting Notes Finalized',
        description: `Created ${notesCreated} individual note item(s) from this meeting's discussion. These are now available in the Notes tab.`,
      });
    } else {
      toast({
        title: 'No Notes to Finalize',
        description: 'No text content found in discussion points or decision items.',
        variant: 'destructive',
      });
    }

    if (errors.length > 0) {
      toast({
        title: 'Some Notes Failed to Save',
        description: errors.join(', '),
        variant: 'destructive',
      });
    }
  };

  return (
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
            onClick={() => setShowAddProjectDialog(true)}
            data-testid="button-add-project"
            className="border-teal-300 text-teal-700 hover:bg-teal-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Project
          </Button>
          
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
            data-testid="button-sync-sheets"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {isCompiling ? 'Syncing...' : 'Sync Google Sheets'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResetConfirmDialog(true)}
            disabled={resetAgendaPlanningMutation.isPending}
            data-testid="button-reset-agenda"
            style={{ borderColor: '#FBAD3F', color: '#FBAD3F' }}
            onMouseEnter={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.backgroundColor = '#fef7e6';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget as HTMLButtonElement;
              target.style.backgroundColor = 'transparent';
            }}
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
              data-testid="button-finalize-agenda"
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
                data-testid="button-download-agenda-pdf"
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
                            data-testid={`card-project-${project.id}`}
                            className={`border-2 transition-all mb-2 shadow-sm hover:shadow-md ${
                              agendaStatus === 'agenda'
                                ? 'border-[#007E8C] bg-gradient-to-r from-[#47B3CB]/10 to-[#007E8C]/10'
                                : agendaStatus === 'tabled'
                                  ? 'border-[#FBAD3F] bg-gradient-to-r from-[#FBAD3F]/10 to-[#FBAD3F]/20'
                                  : needsDiscussion
                                    ? 'border-[#236383] bg-gradient-to-r from-[#236383]/10 to-[#47B3CB]/10'
                                    : index % 2 === 0
                                      ? 'border-[#D1D3D4] bg-gradient-to-r from-[#D1D3D4]/20 to-[#646464]/10'
                                      : 'border-[#A31C41] bg-gradient-to-r from-[#A31C41]/10 to-[#A31C41]/20'
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
                                      className={`text-xs font-medium shadow-sm ${
                                        agendaStatus === 'agenda'
                                          ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-300 shadow-green-200'
                                          : agendaStatus === 'tabled'
                                            ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border-orange-300 shadow-orange-200'
                                            : needsDiscussion
                                              ? 'bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-800 border-teal-300 shadow-teal-200'
                                              : 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 border-gray-300 shadow-gray-200'
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
                                          <strong className="text-gray-700">
                                            Discussion:
                                          </strong>{' '}
                                          {project.meetingDiscussionPoints}
                                        </div>
                                      )}
                                      {project.meetingDecisionItems && (
                                        <div>
                                          <strong className="text-gray-700">
                                            Decisions:
                                          </strong>{' '}
                                          {project.meetingDecisionItems}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleExpandProject(project.id)}
                                  data-testid={`button-expand-${project.id}`}
                                  className="text-gray-600"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    }

                    // Expanded view
                    return (
                      <div key={`wrapper-${project.id}`}>
                        {sectionHeader}
                        <Card
                          data-testid={`card-project-expanded-${project.id}`}
                          className={`border-2 transition-all shadow-lg hover:shadow-xl ${
                            agendaStatus === 'agenda'
                              ? 'border-green-400 bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 shadow-green-200'
                              : agendaStatus === 'tabled'
                                ? 'border-orange-400 bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 shadow-orange-200'
                                : needsDiscussion
                                  ? 'border-teal-400 bg-gradient-to-br from-teal-50 via-cyan-50 to-teal-100 shadow-teal-200'
                                  : index % 2 === 0
                                    ? 'border-blue-300 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 shadow-blue-200'
                                    : 'border-purple-300 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 shadow-purple-200'
                          }`}
                        >
                          <CardHeader className="pb-4">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-0">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {project.title}
                                  </h3>
                                  {needsDiscussion && (
                                    <Badge
                                      variant="outline"
                                      className="bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-800 border-teal-400 shadow-teal-200 shadow-sm"
                                    >
                                      📝 Has Notes
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
                                  <div className="flex items-center gap-2">
                                    <UserCog className="w-4 h-4 text-gray-500" />
                                    <span className="font-medium text-gray-700">
                                      Owner:
                                    </span>
                                    <span className="text-gray-600">
                                      {project.assigneeName || 'Unassigned'}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingProject(project.id);
                                        setEditProjectOwner(
                                          project.assigneeName || ''
                                        );
                                        setShowEditOwnerDialog(true);
                                      }}
                                      data-testid={`button-edit-owner-${project.id}`}
                                      className="h-6 px-2 text-primary hover:text-primary/80"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </Button>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <UserPlus className="w-4 h-4 text-gray-500" />
                                    <span className="font-medium text-gray-700">
                                      Support:
                                    </span>
                                    <span className="text-gray-600">
                                      {project.supportPeople || 'None assigned'}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingProject(project.id);
                                        setEditSupportPeople(
                                          project.supportPeople || ''
                                        );
                                        setShowEditPeopleDialog(true);
                                      }}
                                      data-testid={`button-edit-support-${project.id}`}
                                      className="h-6 px-2 text-primary hover:text-primary/80"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </Button>
                                  </div>

                                  {project.priority && (
                                    <Select
                                      value={project.priority}
                                      onValueChange={(value) => {
                                        updateProjectPriorityMutation.mutate({
                                          projectId: project.id,
                                          priority: value,
                                        });
                                      }}
                                    >
                                      <SelectTrigger
                                        data-testid={`select-priority-${project.id}`}
                                        className="w-32 h-7 text-xs"
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">
                                          Medium
                                        </SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">
                                          Critical
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}

                                  <Badge
                                    variant={
                                      project.status === 'waiting'
                                        ? 'secondary'
                                        : project.status === 'in_progress'
                                          ? 'default'
                                          : 'outline'
                                    }
                                  >
                                    {formatStatusText(project.status)}
                                  </Badge>

                                  <span className="text-xs text-gray-500">
                                    Last discussed: {lastDiscussed}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setMinimizedProjects(
                                      new Set([
                                        ...Array.from(minimizedProjects),
                                        project.id,
                                      ])
                                    );
                                  }}
                                  data-testid={`button-minimize-${project.id}`}
                                  className="text-gray-600"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>

                          <Separator />

                          <CardContent className="pt-4 space-y-4">
                            {/* Discussion Notes */}
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label
                                  htmlFor={`discussion-${project.id}`}
                                  className="text-sm font-medium text-gray-700"
                                >
                                  Discussion Points & Questions
                                </Label>
                                <Textarea
                                  id={`discussion-${project.id}`}
                                  data-testid={`textarea-discussion-${project.id}`}
                                  placeholder="What aspects of this project need to be discussed in the meeting?"
                                  className="min-h-[80px] resize-none"
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
                                />
                              </div>

                              <div className="space-y-2">
                                <Label
                                  htmlFor={`decisions-${project.id}`}
                                  className="text-sm font-medium text-gray-700"
                                >
                                  Notes from Meeting
                                </Label>
                                <Textarea
                                  id={`decisions-${project.id}`}
                                  data-testid={`textarea-decisions-${project.id}`}
                                  placeholder="Notes and outcomes from the meeting discussion"
                                  className="min-h-[80px] resize-none"
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
                                />
                              </div>
                            </div>

                            {/* Agenda Actions */}
                            <div className="pt-4 space-y-4">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant={
                                    agendaStatus === 'agenda'
                                      ? 'default'
                                      : 'outline'
                                  }
                                  onClick={() => handleSendToAgenda(project.id)}
                                  disabled={agendaStatus === 'agenda'}
                                  data-testid={`button-send-to-agenda-${project.id}`}
                                  className={
                                    agendaStatus === 'agenda'
                                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-green-300 shadow-md'
                                      : 'border-green-400 text-green-700 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 shadow-green-200 shadow-sm'
                                  }
                                >
                                  {agendaStatus === 'agenda' ? (
                                    <>
                                      <Check className="w-4 h-4 mr-2" />
                                      On Agenda
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-4 h-4 mr-2" />
                                      Add to Agenda
                                    </>
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  variant={
                                    agendaStatus === 'tabled'
                                      ? 'default'
                                      : 'outline'
                                  }
                                  onClick={() => handleTableProject(project.id)}
                                  disabled={agendaStatus === 'tabled'}
                                  data-testid={`button-table-project-${project.id}`}
                                  className={
                                    agendaStatus === 'tabled'
                                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-orange-300 shadow-md'
                                      : 'border-orange-400 text-orange-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 shadow-orange-200 shadow-sm'
                                  }
                                >
                                  {agendaStatus === 'tabled' ? (
                                    <>
                                      <Check className="w-4 h-4 mr-2" />
                                      Tabled
                                    </>
                                  ) : (
                                    <>
                                      <X className="w-4 h-4 mr-2" />
                                      Table for Later
                                    </>
                                  )}
                                </Button>

                                {(agendaStatus === 'agenda' ||
                                  agendaStatus === 'tabled') && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setProjectAgendaStatus((prev) => {
                                        const newStatus = { ...prev };
                                        delete newStatus[project.id];
                                        return newStatus;
                                      });
                                    }}
                                    data-testid={`button-remove-from-agenda-${project.id}`}
                                    className="text-gray-600 hover:text-gray-800"
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>

                              {/* Project Tasks View */}
                              <ProjectTasksView
                                projectId={project.id}
                                onAddTask={() => {
                                  setEditingProject(project.id);
                                  setShowAddTaskDialog(true);
                                }}
                              />
                            </div>

                            {/* File Attachments */}
                            <div className="border-t pt-4">
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-sm font-medium text-gray-700">
                                  Attachments
                                </Label>
                                <ObjectUploader
                                  onUpload={(files) => {
                                    setUploadedFiles((prev) => ({
                                      ...prev,
                                      [project.id]: [
                                        ...(prev[project.id] || []),
                                        ...files,
                                      ],
                                    }));
                                  }}
                                  multiple={true}
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                  maxSize={10 * 1024 * 1024} // 10MB
                                >
                                  <Button size="sm" variant="outline">
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add File
                                  </Button>
                                </ObjectUploader>
                              </div>
                              {uploadedFiles[project.id]?.length > 0 ? (
                                <div className="space-y-2">
                                  {uploadedFiles[project.id].map(
                                    (file, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                                      >
                                        <span className="text-sm text-gray-700">
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
              data-testid="input-off-agenda-title"
            />
            <Select
              value={offAgendaSection}
              onValueChange={setOffAgendaSection}
            >
              <SelectTrigger data-testid="select-off-agenda-section">
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
              data-testid="button-add-off-agenda"
              style={{ backgroundColor: '#FBAD3F' }}
              onMouseEnter={(e) =>
                !createOffAgendaItemMutation.isPending &&
                ((e.target as HTMLElement).style.backgroundColor = '#e09d36')
              }
              onMouseLeave={(e) =>
                !createOffAgendaItemMutation.isPending &&
                ((e.target as HTMLElement).style.backgroundColor = '#FBAD3F')
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
                  data-testid={`agenda-item-${item.id}`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:shadow-sm transition-shadow"
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
                        {formatSectionName(item.section)}
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
                      data-testid={`button-delete-agenda-item-${item.id}`}
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
              data-testid="button-floating-generate-pdf"
              className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 transition-all"
            >
              <Download className="w-4 h-4 mr-2" />
              Generate PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveNotesFromAgenda}
              disabled={createNoteMutation.isPending}
              data-testid="button-floating-create-tasks"
              className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              {createNoteMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  Saving Notes...
                </div>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save Notes
                </>
              )}
            </Button>
          </div>
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
                  } catch (error: any) {
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
                  } catch (error: any) {
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
                ((e.target as HTMLElement).style.backgroundColor = '#e09d36')
              }
              onMouseLeave={(e) =>
                !resetAgendaPlanningMutation.isPending &&
                ((e.target as HTMLElement).style.backgroundColor = '#FBAD3F')
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