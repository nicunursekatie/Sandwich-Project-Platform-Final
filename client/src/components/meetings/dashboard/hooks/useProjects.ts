import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getTodayString } from '@/lib/date-utils';

// Interfaces
export interface Project {
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
  category?: string;
  dueDate?: string;
  lastDiscussedDate?: string;
}

export interface NewProjectData {
  title: string;
  description: string;
  assigneeName: string;
  supportPeople: string;
  dueDate: string;
  priority: string;
  category: string;
  status: string;
}

export interface ProjectUpdateData {
  meetingDiscussionPoints?: string;
  meetingDecisionItems?: string;
  reviewInNextMeeting?: boolean;
  priority?: string;
  supportPeople?: string;
  assigneeName?: string;
}

// Custom hook for all project-related operations
export function useProjects(projectAgendaStatus?: Record<number, 'none' | 'agenda' | 'tabled'>) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all projects
  const projectsQuery = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch projects for review
  const projectsForReviewQuery = useQuery<Project[]>({
    queryKey: ['/api/projects/for-review'],
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (projectData: NewProjectData) => {
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
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Create Project',
        description: error?.message || 'Failed to create the new project',
        variant: 'destructive',
      });
    },
  });

  // Update project discussion mutation
  const updateProjectDiscussionMutation = useMutation({
    mutationFn: async ({
      projectId,
      updates,
    }: {
      projectId: number;
      updates: ProjectUpdateData;
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
        description: error.message || 'Failed to update project discussion notes.',
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
        description: error.message || 'Failed to update project priority.',
        variant: 'destructive',
      });
    },
  });

  // Update project support people mutation
  const updateProjectSupportPeopleMutation = useMutation({
    mutationFn: async ({
      projectId,
      supportPeople,
    }: {
      projectId: number;
      supportPeople: string;
    }) => {
      return await apiRequest('PATCH', `/api/projects/${projectId}`, { supportPeople });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Support People Updated',
        description: 'Project support people have been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update support people.',
        variant: 'destructive',
      });
    },
  });

  // Update project owner mutation
  const updateProjectOwnerMutation = useMutation({
    mutationFn: async ({
      projectId,
      assigneeName,
    }: {
      projectId: number;
      assigneeName: string;
    }) => {
      return await apiRequest('PATCH', `/api/projects/${projectId}`, { assigneeName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Project Owner Updated',
        description: 'Project owner has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update project owner.',
        variant: 'destructive',
      });
    },
  });

  // Convert meeting notes to tasks mutation
  const createTasksFromNotesMutation = useMutation({
    mutationFn: async () => {
      const allProjects = projectsQuery.data || [];
      const projectsWithNotes = allProjects.filter(
        (project: Project) =>
          (project.meetingDiscussionPoints?.trim() ||
            project.meetingDecisionItems?.trim()) &&
          projectAgendaStatus &&
          (projectAgendaStatus[project.id] === 'agenda' ||
            projectAgendaStatus[project.id] === 'tabled')
      );

      const taskPromises = projectsWithNotes.map(async (project: Project) => {
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
        description: error?.message || 'Failed to convert meeting notes into tasks',
        variant: 'destructive',
      });
    },
  });

  // Comprehensive reset for next week's agenda planning
  const resetAgendaPlanningMutation = useMutation({
    mutationFn: async () => {
      const allProjects = projectsQuery.data || [];
      
      // Step 1: Create tasks from any remaining notes
      const projectsWithNotes = allProjects.filter(
        (project: Project) =>
          (project.meetingDiscussionPoints?.trim() ||
            project.meetingDecisionItems?.trim()) &&
          projectAgendaStatus &&
          (projectAgendaStatus[project.id] === 'agenda' ||
            projectAgendaStatus[project.id] === 'tabled')
      );

      if (projectsWithNotes.length > 0) {
        const taskPromises = projectsWithNotes.map(async (project: Project) => {
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
          (project: Project) =>
            project.meetingDiscussionPoints?.trim() ||
            project.meetingDecisionItems?.trim()
        )
        .map(async (project: Project) => {
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
      // Refresh projects data
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });

      toast({
        title: 'Agenda Planning Reset Complete!',
        description: `✓ ${results.notesProcessed} projects converted to tasks\n✓ ${results.notesCleared} project notes cleared\n✓ Projects refreshed from Google Sheets\n✓ Ready for next week's planning`,
        duration: 8000,
      });
    },
    onError: (error: any) => {
      console.error('Failed to reset agenda planning:', error);
      toast({
        title: 'Reset Failed',
        description: error?.message || 'Failed to complete agenda planning reset',
        variant: 'destructive',
      });
    },
  });

  // Helper function to generate agenda PDF
  const generateAgendaPDF = async (
    projectAgendaStatus: Record<number, 'none' | 'agenda' | 'tabled'>
  ) => {
    const allProjects = projectsQuery.data || [];
    const activeProjects = allProjects.filter((p: Project) => p.status !== 'completed');
    const agendaProjects = activeProjects.filter(
      (p: Project) => projectAgendaStatus[p.id] === 'agenda'
    );
    const tabledProjects = activeProjects.filter(
      (p: Project) => projectAgendaStatus[p.id] === 'tabled'
    );

    if (agendaProjects.length === 0 && tabledProjects.length === 0) {
      throw new Error('No agenda items to generate');
    }

    // Fetch tasks for each agenda project
    const projectsWithTasks = await Promise.all(
      agendaProjects.map(async (project: Project) => {
        try {
          const tasksResponse = await fetch(`/api/projects/${project.id}/tasks`, {
            credentials: 'include',
          });
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
  };

  return {
    // Queries
    projects: projectsQuery.data || [],
    projectsLoading: projectsQuery.isLoading,
    projectsError: projectsQuery.error,
    projectsForReview: projectsForReviewQuery.data || [],
    projectsForReviewLoading: projectsForReviewQuery.isLoading,
    
    // Mutations
    createProjectMutation,
    updateProjectDiscussionMutation,
    updateProjectPriorityMutation,
    updateProjectSupportPeopleMutation,
    updateProjectOwnerMutation,
    createTasksFromNotesMutation,
    resetAgendaPlanningMutation,
    
    // Helper functions
    generateAgendaPDF,
    
    // Utility to refresh queries
    refreshProjects: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/for-review'] });
    },
  };
}