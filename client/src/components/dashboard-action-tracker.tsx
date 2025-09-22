import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Calendar, 
  Clock, 
  FileText, 
  MessageCircle, 
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Mail
} from 'lucide-react';
import { format, isValid } from 'date-fns';

// Helper function to properly format status text
const formatStatusText = (status: string): string => {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

interface DashboardItem {
  id: number;
  title: string;
  status: string;
  linkPath: string;
  count?: number;
  priority?: string;
  dueDate?: string;
  createdAt?: string;
  assignmentType?: string[];
  organizationName?: string;
}

interface DashboardData {
  projects: DashboardItem[];
  tasks: DashboardItem[];
  events: DashboardItem[];
  messages: DashboardItem[];
  counts: {
    projects: number;
    tasks: number;
    events: number;
    messages: number;
  };
}

interface DashboardActionTrackerProps {
  onNavigate: (path: string) => void;
}

const DashboardActionTracker = ({ onNavigate }: DashboardActionTrackerProps) => {
  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['/api/me/dashboard'],
    staleTime: 0, // Always fetch fresh data for action items
    refetchOnWindowFocus: true,
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return isValid(date) ? format(date, 'MMM d') : '';
    } catch {
      return '';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800';
      case 'new':
        return 'bg-gray-100 text-gray-800';
      case 'unread':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleNavigation = (linkPath: string) => {
    // Honor full linkPath for deep-linking to detail views
    // Extract the path and query parameters
    if (linkPath.startsWith('/dashboard?')) {
      // Remove the '/dashboard?' prefix and pass the full query string to maintain all parameters
      const queryString = linkPath.substring('/dashboard?'.length);
      const urlParams = new URLSearchParams(queryString);
      
      // If we have specific item parameters (id, eventId, etc.), navigate with full context
      if (urlParams.get('id') || urlParams.get('eventId') || urlParams.get('view') || urlParams.get('tab')) {
        // Pass the full query string to enable deep-linking
        onNavigate(queryString);
      } else {
        // Fallback to just section if no specific parameters
        const section = urlParams.get('section') || 'dashboard';
        onNavigate(section);
      }
    } else {
      // For non-dashboard paths, extract section as before
      const urlParams = new URLSearchParams(linkPath.split('?')[1] || '');
      const section = urlParams.get('section') || 'dashboard';
      onNavigate(section);
    }
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );

  // Item component for displaying individual items
  const ItemComponent = ({ item, type }: { item: DashboardItem; type: 'project' | 'task' | 'event' | 'message' }) => (
    <div 
      className="p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
      onClick={() => handleNavigation(item.linkPath)}
      data-testid={`item-${type}-${item.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate" title={item.title}>
            {item.title}
          </p>
          {item.organizationName && (
            <p className="text-xs text-gray-600 truncate" title={item.organizationName}>
              {item.organizationName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.priority && (
            <Badge variant="outline" className={`text-xs ${getPriorityColor(item.priority)}`}>
              {item.priority}
            </Badge>
          )}
          <Badge variant="outline" className={`text-[14px] ${getStatusColor(item.status)}`}>
            {formatStatusText(item.status)}
          </Badge>
        </div>
      </div>
      {item.dueDate && (
        <div className="flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-500">
            {type === 'event' ? 'Event' : 'Due'} {formatDate(item.dueDate)}
          </span>
        </div>
      )}
    </div>
  );

  // Zero state component
  const ZeroState = ({ type, icon: Icon, message }: { type: string; icon: any; message: string }) => (
    <div className="text-center py-6" data-testid={`zero-state-${type}`}>
      <Icon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );

  if (error) {
    return (
      <Card className="border-red-200" data-testid="dashboard-tracker-error">
        <CardContent className="flex items-center justify-center py-12 text-red-600">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4" />
            <p className="text-lg font-medium">Failed to load action items</p>
            <p className="text-sm">Please try refreshing the page</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-action-tracker">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">My Action Tracker</h2>
        <p className="text-gray-600">Stay on top of your assigned work and communications</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Projects Card */}
        <Card className="hover:shadow-md transition-shadow" data-testid="projects-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="text-base">Projects</span>
              </div>
              <Badge variant="secondary" data-testid="projects-count">
                {isLoading ? <Skeleton className="h-4 w-6" /> : dashboardData?.counts.projects || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <LoadingSkeleton />
            ) : !dashboardData?.projects || dashboardData.projects.length === 0 ? (
              <ZeroState 
                type="projects"
                icon={FileText} 
                message="No assigned projects found. Projects you're assigned to will appear here." 
              />
            ) : (
              <div className="space-y-1">
                {dashboardData.projects.map((project) => (
                  <ItemComponent key={project.id} item={project} type="project" />
                ))}
                {dashboardData.counts.projects > 3 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 text-blue-600 hover:text-blue-800" 
                    onClick={() => onNavigate('projects')}
                    data-testid="projects-view-all"
                  >
                    View all {dashboardData.counts.projects} projects <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks Card */}
        <Card className="hover:shadow-md transition-shadow" data-testid="tasks-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-base">Tasks</span>
              </div>
              <Badge variant="secondary" data-testid="tasks-count">
                {isLoading ? <Skeleton className="h-4 w-6" /> : dashboardData?.counts.tasks || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <LoadingSkeleton />
            ) : !dashboardData?.tasks || dashboardData.tasks.length === 0 ? (
              <ZeroState 
                type="tasks"
                icon={CheckCircle} 
                message="No pending tasks found. Tasks assigned to you will appear here." 
              />
            ) : (
              <div className="space-y-1">
                {dashboardData.tasks.map((task) => (
                  <ItemComponent key={task.id} item={task} type="task" />
                ))}
                {dashboardData.counts.tasks > 3 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 text-green-600 hover:text-green-800" 
                    onClick={() => onNavigate('action-tracking')}
                    data-testid="tasks-view-all"
                  >
                    View all {dashboardData.counts.tasks} tasks <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Events Card */}
        <Card className="hover:shadow-md transition-shadow" data-testid="events-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <span className="text-base">Events</span>
              </div>
              <Badge variant="secondary" data-testid="events-count">
                {isLoading ? <Skeleton className="h-4 w-6" /> : dashboardData?.counts.events || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <LoadingSkeleton />
            ) : !dashboardData?.events || dashboardData.events.length === 0 ? (
              <ZeroState 
                type="events"
                icon={Calendar} 
                message="No assigned events found. Event requests assigned to you will appear here." 
              />
            ) : (
              <div className="space-y-1">
                {dashboardData.events.map((event) => (
                  <ItemComponent key={event.id} item={event} type="event" />
                ))}
                {dashboardData.counts.events > 3 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 text-purple-600 hover:text-purple-800" 
                    onClick={() => onNavigate('event-requests')}
                    data-testid="events-view-all"
                  >
                    View all {dashboardData.counts.events} events <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages Card */}
        <Card className="hover:shadow-md transition-shadow" data-testid="messages-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-orange-600" />
                <span className="text-base">Messages</span>
              </div>
              <Badge variant="secondary" data-testid="messages-count">
                {isLoading ? <Skeleton className="h-4 w-6" /> : dashboardData?.counts.messages || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <LoadingSkeleton />
            ) : !dashboardData?.messages || dashboardData.messages.length === 0 ? (
              <ZeroState 
                type="messages"
                icon={Mail} 
                message="No unread messages found. New messages will appear here." 
              />
            ) : (
              <div className="space-y-1">
                {dashboardData.messages.map((message) => (
                  <ItemComponent key={message.id} item={message} type="message" />
                ))}
                {dashboardData.counts.messages > 3 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 text-orange-600 hover:text-orange-800" 
                    onClick={() => onNavigate('messages')}
                    data-testid="messages-view-all"
                  >
                    View all {dashboardData.counts.messages} messages <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Buttons */}
      {!isLoading && dashboardData && (
        <div className="flex flex-wrap justify-center gap-4 pt-4 border-t border-gray-200">
          <Button 
            variant="outline" 
            onClick={() => onNavigate('action-tracking')}
            data-testid="view-all-actions"
          >
            View Full Action Board
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onNavigate('projects')}
            data-testid="manage-projects"
          >
            Manage Projects
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onNavigate('messages')}
            data-testid="check-messages"
          >
            Check Messages
          </Button>
        </div>
      )}
    </div>
  );
};

export default DashboardActionTracker;