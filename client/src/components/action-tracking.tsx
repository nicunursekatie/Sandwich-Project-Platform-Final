import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Phone
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
}

const ActionTracking = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("projects");

  // Fetch user's assigned projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects/assigned'],
  });

  // Fetch user's assigned tasks
  const { data: tasks = [] } = useQuery<ProjectTask[]>({
    queryKey: ['/api/tasks/assigned'],
  });

  // Fetch user's assigned events
  const { data: events = [] } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests/assigned'],
  });

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Action Items</h1>
            <p className="text-gray-600 mt-1">Track all your assigned projects, tasks, and events</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search assignments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64"
            />
          </div>
        </div>

        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Projects ({filteredProjects.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Tasks ({filteredTasks.length})
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Events ({filteredEvents.length})
          </TabsTrigger>
        </TabsList>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4">

        <TabsContent value="projects" className="space-y-4 m-0">
          {filteredProjects.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">No assigned projects found</p>
                  <p className="text-sm">Projects you're assigned to or supporting will appear here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredProjects.map((project) => (
                <Card key={project.id} className="hover:shadow-md transition-shadow">
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
                          <User className="w-4 h-4" />
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
                          <span>{project.progressPercentage}% complete</span>
                        </div>
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
                <Card key={task.id} className="hover:shadow-md transition-shadow">
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
          {filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">No assigned events found</p>
                  <p className="text-sm">Event requests assigned to you will appear here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredEvents.map((event) => (
                <Card key={event.id} className="hover:shadow-md transition-shadow">
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