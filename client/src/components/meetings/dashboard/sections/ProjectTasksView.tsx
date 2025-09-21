import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatDateForDisplay } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';

interface ProjectTask {
  id: number;
  title: string;
  description?: string;
  status: string;
  assigneeName?: string;
  dueDate?: string;
  priority: string;
}

interface ProjectTasksViewProps {
  projectId: number;
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

export function ProjectTasksView({ projectId }: ProjectTasksViewProps) {
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