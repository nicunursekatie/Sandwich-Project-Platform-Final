import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  User,
  Building,
  FileText,
  Mail,
  Phone,
  Car,
  Mic,
  UserCheck,
  Bell
} from "lucide-react";
import { format, isValid } from "date-fns";

interface Project {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  category: string;
  assigneeIds: string[];
  supportPeopleIds: string[];
  dueDate?: string;
  progressPercentage: number;
  createdAt: string;
  updatedAt: string;
}

interface ProjectTask {
  id: number;
  projectId: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeIds: string[];
  dueDate?: string;
  createdAt: string;
  project?: {
    title: string;
    category: string;
  };
}

interface EventRequest {
  id: number;
  firstName: string;
  lastName: string;
  organizationName: string;
  status: string;
  assignedTo?: string;
  desiredEventDate?: string;
  createdAt: string;
  communicationMethod?: string;
  contactedAt?: string;
  assignmentType?: string[];
  followUpNeeded?: boolean;
  followUpReason?: string;
  driverDetails?: string;
  speakerDetails?: string;
  tspContact?: string;
  tspContactAssigned?: string;
  additionalTspContacts?: string;
  customTspContact?: string;
  eventAddress?: string;
  estimatedSandwichCount?: number;
  eventStartTime?: string;
  eventEndTime?: string;
  pickupTime?: string;
  sandwichTypes?: string;
}

const ActionTracking = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("projects");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Navigation functions
  const navigateToProject = (projectId: number) => {
    setLocation(`/dashboard?section=projects&view=detail&id=${projectId}`);
  };

  const navigateToEventPlanning = (eventId?: number) => {
    if (eventId) {
      // Find the event to determine which tab to navigate to
      const event = events.find(e => e.id === eventId);
      let tab = 'requests'; // default
      
      if (event) {
        if (event.status === 'completed') {
          tab = 'past';
        } else if (event.status === 'scheduled') {
          tab = 'scheduled';
        } else {
          tab = 'requests'; // new, contact_completed, etc.
        }
      }
      
      setLocation(`/dashboard?section=event-requests&tab=${tab}&eventId=${eventId}`);
    } else {
      setLocation(`/dashboard?section=event-requests`);
    }
  };

  // Fetch user's assigned projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects/assigned'],
  });

  // Fetch user's assigned tasks
  const { data: tasks = [] } = useQuery<ProjectTask[]>({
    queryKey: ['/api/tasks/assigned'],
  });

  // Fetch user's assigned events
  const { data: events = [], refetch: refetchEvents } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests/assigned'],
  });

  // Mutation for marking follow-ups as complete
  const followUpMutation = useMutation({
    mutationFn: async ({ eventId, followUpType, notes }: { 
      eventId: number; 
      followUpType: 'one_day' | 'one_month'; 
      notes?: string;
    }) => {
      return apiRequest(`/api/event-requests/${eventId}/follow-up`, 'PATCH', { followUpType, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests/assigned'] });
      toast({
        title: "Follow-up marked complete",
        description: "The follow-up has been successfully marked as completed.",
      });
      refetchEvents();
    },
    onError: (error) => {
      console.error("Error marking follow-up complete:", error);
      toast({
        title: "Error",
        description: "Failed to mark follow-up as complete. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleFollowUpComplete = async (eventId: number, followUpType: 'one_day' | 'one_month') => {
    followUpMutation.mutate({ eventId, followUpType });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'waiting': return 'bg-yellow-100 text-yellow-800';
      case 'available': return 'bg-purple-100 text-purple-800';
      case 'contact_completed': return 'bg-teal-100 text-teal-800';
      case 'scheduled': return 'bg-indigo-100 text-indigo-800';
      case 'new': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return isValid(date) ? format(date, 'MMM d, yyyy') : '';
    } catch {
      return '';
    }
  };

  const filteredProjects = projects.filter(project =>
    project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.project?.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEvents = events.filter(event =>
    event.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.organizationName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Separate active events from completed events
  const activeEvents = filteredEvents.filter(event => event.status !== 'completed');
  const completedEvents = filteredEvents.filter(event => event.status === 'completed');

  // Priority order for active events (follow-ups first)
  const sortedActiveEvents = [...activeEvents].sort((a, b) => {
    // Follow-ups first
    if (a.followUpNeeded && !b.followUpNeeded) return -1;
    if (!a.followUpNeeded && b.followUpNeeded) return 1;
    
    // Then by event date
    if (a.desiredEventDate && b.desiredEventDate) {
      return new Date(a.desiredEventDate).getTime() - new Date(b.desiredEventDate).getTime();
    }
    
    return 0;
  });

  // Sort completed events by event date (most recent first)
  const sortedCompletedEvents = [...completedEvents].sort((a, b) => {
    if (a.desiredEventDate && b.desiredEventDate) {
      return new Date(b.desiredEventDate).getTime() - new Date(a.desiredEventDate).getTime();
    }
    return 0;
  });

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Action Board</h2>
        <p className="text-gray-600">Track your assigned projects, tasks, and event responsibilities</p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search projects, tasks, and events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Projects ({filteredProjects.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Tasks ({filteredTasks.length})
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2 relative">
            <Calendar className="w-4 h-4" />
            Active Events ({sortedActiveEvents.length})
            {sortedActiveEvents.some(e => e.followUpNeeded) && (
              <Bell className="w-3 h-3 text-yellow-600 animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="completed-events" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Completed Events ({sortedCompletedEvents.length})
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
        <TabsContent value="projects" className="space-y-4 m-0">
          {filteredProjects.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">No assigned projects found</p>
                  <p className="text-sm">Projects assigned to you will appear here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredProjects.map((project) => (
                <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigateToProject(project.id)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold text-gray-900">
                          {project.title}
                        </CardTitle>
                        {project.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge className={getPriorityColor(project.priority)}>
                          {project.priority}
                        </Badge>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          <span>{project.category}</span>
                        </div>
                        {project.dueDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Due {formatDate(project.dueDate)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>Created {formatDate(project.createdAt)}</span>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-700">
                        {project.progressPercentage}% complete
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4 m-0">
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">No assigned tasks found</p>
                  <p className="text-sm">Tasks assigned to you will appear here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredTasks.map((task) => (
                <Card key={task.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigateToProject(task.projectId)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold text-gray-900">
                          {task.title}
                        </CardTitle>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        {task.project && (
                          <p className="text-xs text-teal-600 mt-2 font-medium">
                            Project: {task.project.title}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {task.project && (
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            <span>{task.project.category}</span>
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Due {formatDate(task.dueDate)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>Created {formatDate(task.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="events" className="space-y-4 m-0">
          {sortedActiveEvents.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">No active event requests found</p>
                  <p className="text-sm">Active events where you are assigned as contact, driver, or speaker will appear here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sortedActiveEvents.map((event) => (
                <Card key={event.id} className={`hover:shadow-md transition-shadow cursor-pointer ${event.followUpNeeded ? 'ring-2 ring-yellow-200' : ''}`} onClick={() => navigateToEventPlanning(event.id)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold text-gray-900">
                          {event.firstName} {event.lastName}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          <Building className="w-4 h-4 inline mr-1" />
                          {event.organizationName}
                        </p>
                        {event.assignmentType && event.assignmentType.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {event.assignmentType.map((type, index) => (
                              <Badge key={index} variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">
                                {type === 'TSP Contact' && <UserCheck className="w-3 h-3 mr-1" />}
                                {type === 'Driver' && <Car className="w-3 h-3 mr-1" />}
                                {type === 'Speaker' && <Mic className="w-3 h-3 mr-1" />}
                                {type === 'Direct Assignment' && <User className="w-3 h-3 mr-1" />}
                                {type}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge className={getStatusColor(event.status)}>
                          {event.status.replace('_', ' ')}
                        </Badge>
                        {event.contactedAt && (
                          <Badge className="bg-green-100 text-green-800">
                            Contacted
                          </Badge>
                        )}
                        {event.followUpNeeded && (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            <Bell className="w-3 h-3 mr-1" />
                            Follow-up Due
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {event.desiredEventDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Event {formatDate(event.desiredEventDate)}</span>
                          </div>
                        )}
                        {event.communicationMethod && (
                          <div className="flex items-center gap-1">
                            {event.communicationMethod.includes('email') ? (
                              <Mail className="w-4 h-4" />
                            ) : (
                              <Phone className="w-4 h-4" />
                            )}
                            <span>{event.communicationMethod}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>Created {formatDate(event.createdAt)}</span>
                        </div>
                      </div>
                      {event.followUpNeeded && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Bell className="w-4 h-4 text-yellow-600" />
                              <span className="text-sm font-medium text-yellow-800">
                                {event.followUpReason}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              className="bg-yellow-600 hover:bg-yellow-700 text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFollowUpComplete(event.id, event.followUpReason?.includes('1-day') ? 'one_day' : 'one_month');
                              }}
                              disabled={followUpMutation.isPending}
                            >
                              {followUpMutation.isPending ? 'Marking...' : 'Mark Complete'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed-events" className="space-y-4 m-0">
          {sortedCompletedEvents.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">No completed events found</p>
                  <p className="text-sm">Completed events where you were assigned as contact, driver, or speaker will appear here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sortedCompletedEvents.map((event) => (
                <Card key={event.id} className="hover:shadow-md transition-shadow cursor-pointer opacity-75" onClick={() => navigateToEventPlanning(event.id)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold text-gray-700">
                          {event.firstName} {event.lastName}
                        </CardTitle>
                        <p className="text-sm text-gray-500 mt-1">
                          <Building className="w-4 h-4 inline mr-1" />
                          {event.organizationName}
                        </p>
                        {event.assignmentType && event.assignmentType.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {event.assignmentType.map((type, index) => (
                              <Badge key={index} variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                                {type === 'TSP Contact' && <UserCheck className="w-3 h-3 mr-1" />}
                                {type === 'Driver' && <Car className="w-3 h-3 mr-1" />}
                                {type === 'Speaker' && <Mic className="w-3 h-3 mr-1" />}
                                {type === 'Direct Assignment' && <User className="w-3 h-3 mr-1" />}
                                {type}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge className="bg-green-100 text-green-800">
                          Completed
                        </Badge>
                        {event.contactedAt && (
                          <Badge className="bg-gray-100 text-gray-600">
                            Contacted
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {event.desiredEventDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Event {formatDate(event.desiredEventDate)}</span>
                          </div>
                        )}
                        {event.communicationMethod && (
                          <div className="flex items-center gap-1">
                            {event.communicationMethod.includes('email') ? (
                              <Mail className="w-4 h-4" />
                            ) : (
                              <Phone className="w-4 h-4" />
                            )}
                            <span>{event.communicationMethod}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>Created {formatDate(event.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default ActionTracking;