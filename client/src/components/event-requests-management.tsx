import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Calendar, Building, User, Mail, Phone, AlertTriangle, CheckCircle, Clock, XCircle, Upload, Download, RotateCcw, ExternalLink, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface EventRequest {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  organizationName: string;
  department?: string;
  desiredEventDate?: string;
  message?: string;
  previouslyHosted: 'yes' | 'no' | 'i_dont_know';
  status: 'new' | 'contacted' | 'in_planning' | 'scheduled' | 'completed' | 'declined';
  assignedTo?: string;
  organizationExists: boolean;
  duplicateNotes?: string;
  createdAt: string; // Submission date from Google Sheet
  updatedAt: string; 
  contactedAt?: string; // When initial contact was completed
  createdBy?: string;
}

const statusColors = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800", 
  in_planning: "bg-purple-100 text-purple-800",
  scheduled: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  declined: "bg-red-100 text-red-800"
};

const statusIcons = {
  new: Clock,
  contacted: Mail,
  in_planning: Calendar,
  scheduled: CheckCircle,
  completed: CheckCircle,
  declined: XCircle
};

const previouslyHostedOptions = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "i_dont_know", label: "I don't know" }
];

const statusOptions = [
  { value: "new", label: "New Request" },
  { value: "contacted", label: "Contacted" },
  { value: "in_planning", label: "In Planning" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" }
];

export default function EventRequestsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EventRequest | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: eventRequests = [], isLoading, error } = useQuery({
    queryKey: ["/api/event-requests"],
    queryFn: () => apiRequest("GET", "/api/event-requests"),
    refetchOnMount: true
  });

  // Remove debug logging since the API is working properly

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/event-requests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      setShowAddDialog(false);
      toast({ title: "Event request created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error creating event request", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PUT", `/api/event-requests/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      setShowEditDialog(false);
      setSelectedRequest(null);
      toast({ title: "Event request updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating event request", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/event-requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({ title: "Event request deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error deleting event request", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Google Sheets sync mutations
  const syncToSheetsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/event-requests/sync/to-sheets"),
    onSuccess: (data: any) => {
      toast({ 
        title: "Sync to Google Sheets successful", 
        description: `${data.synced || 0} event requests synced to Google Sheets`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error syncing to Google Sheets", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const syncFromSheetsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/event-requests/sync/from-sheets"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({ 
        title: "Sync from Google Sheets successful", 
        description: `${data.created || 0} created, ${data.updated || 0} updated`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error syncing from Google Sheets", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const filteredRequests = useMemo(() => {
    return eventRequests.filter((request: EventRequest) => {
      const matchesSearch = !searchTerm || 
        request.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.email.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [eventRequests, searchTerm, statusFilter]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      organizationName: formData.get("organizationName"),
      department: formData.get("department"),
      desiredEventDate: formData.get("desiredEventDate") ? new Date(formData.get("desiredEventDate") as string) : null,
      message: formData.get("message"),
      previouslyHosted: formData.get("previouslyHosted"),
      status: formData.get("status") || "new"
    };
    createMutation.mutate(data);
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRequest) return;
    
    const formData = new FormData(e.currentTarget);
    const data = {
      id: selectedRequest.id,
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      organizationName: formData.get("organizationName"),
      department: formData.get("department"),
      desiredEventDate: formData.get("desiredEventDate") ? new Date(formData.get("desiredEventDate") as string) : null,
      message: formData.get("message"),
      previouslyHosted: formData.get("previouslyHosted"),
      status: formData.get("status")
    };
    updateMutation.mutate(data);
  };

  const getStatusDisplay = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    const Icon = statusIcons[status as keyof typeof statusIcons];
    return (
      <Badge className={statusColors[status as keyof typeof statusColors]}>
        <Icon className="w-3 h-3 mr-1" />
        {option?.label || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Event Requests</h1>
        <div className="flex space-x-2">
          {/* Google Sheets Integration */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_EVENT_REQUESTS_SHEET_ID || '1GsiY_Nafzt_AYr4lXd-Nc-tKiCcSIc4_FW3lDJWX_ss'}/edit`, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Google Sheet
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => syncToSheetsMutation.mutate()}
            disabled={syncToSheetsMutation.isPending}
          >
            <Upload className="w-4 h-4 mr-2" />
            {syncToSheetsMutation.isPending ? "Syncing..." : "Sync to Sheets"}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => syncFromSheetsMutation.mutate()}
            disabled={syncFromSheetsMutation.isPending}
          >
            <Download className="w-4 h-4 mr-2" />
            {syncFromSheetsMutation.isPending ? "Syncing..." : "Sync from Sheets"}
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Event Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Event Request</DialogTitle>
              <DialogDescription>
                Create a new event request from an organization
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input name="firstName" required />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input name="lastName" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input name="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input name="phone" type="tel" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="organizationName">Organization Name</Label>
                  <Input name="organizationName" required />
                </div>
                <div>
                  <Label htmlFor="department">Department (Optional)</Label>
                  <Input name="department" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="desiredEventDate">Desired Event Date (Optional)</Label>
                  <Input name="desiredEventDate" type="date" />
                </div>
                <div>
                  <Label htmlFor="previouslyHosted">Previously Hosted With Us?</Label>
                  <Select name="previouslyHosted" defaultValue="i_dont_know">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {previouslyHostedOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="message">Additional Information</Label>
                <Textarea name="message" rows={3} />
              </div>
              <div>
                <Label htmlFor="status">Initial Status</Label>
                <Select name="status" defaultValue="new">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Event Request"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by organization, name, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {statusOptions.map(status => {
          const count = eventRequests.filter((req: EventRequest) => req.status === status.value).length;
          const Icon = statusIcons[status.value as keyof typeof statusIcons];
          return (
            <Card key={status.value}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Icon className="w-4 h-4" />
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-gray-600">{status.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Event Requests List */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-8">Loading event requests...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">Error loading event requests: {(error as Error)?.message}</div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No event requests found. 
            <br />
            <small>Total requests: {eventRequests.length}, Filtered: {filteredRequests.length}</small>
          </div>
        ) : (
          filteredRequests.map((request: EventRequest) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center space-x-3">
                      <Building className="w-5 h-5 text-blue-600" />
                      <span>{request.organizationName}</span>
                      {request.organizationExists && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Potential Duplicate
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          {request.firstName} {request.lastName}
                        </span>
                        <span className="flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          {request.email}
                        </span>
                        {request.phone && (
                          <span className="flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {request.phone}
                          </span>
                        )}
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusDisplay(request.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {request.department && (
                    <p><strong>Department:</strong> {request.department}</p>
                  )}
                  {request.desiredEventDate && (
                    <p className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      <strong>Desired Date:</strong> {format(new Date(request.desiredEventDate), "PPP")}
                    </p>
                  )}
                  <p><strong>Previously Hosted:</strong> {
                    previouslyHostedOptions.find(opt => opt.value === request.previouslyHosted)?.label
                  }</p>
                  {request.message && (
                    <div>
                      <strong>Additional Information:</strong>
                      <p className="mt-1 text-gray-600">{request.message}</p>
                    </div>
                  )}
                  {request.duplicateNotes && (
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <p className="text-orange-800"><strong>Duplicate Check Notes:</strong></p>
                      <p className="text-orange-700 text-sm mt-1">{request.duplicateNotes}</p>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t">
                    <div className="text-sm text-gray-500">
                      <div>Submitted: {format(new Date(request.createdAt), "PPp")}</div>
                      {request.status === 'new' && (
                        <div className="text-orange-600 font-medium">
                          Waiting for contact ({Math.floor((Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days ago)
                        </div>
                      )}
                      {request.contactedAt && (
                        <div className="text-green-600">
                          Initial contact: {format(new Date(request.contactedAt), "PPp")}
                          {request.desiredEventDate && (
                            <span className="ml-2">
                              ({Math.ceil((new Date(request.desiredEventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days until event)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-x-2">
                      <Button
                        variant={request.status === 'contacted' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const newStatus = request.status === 'contacted' ? 'new' : 'contacted';
                          updateMutation.mutate({
                            id: request.id,
                            status: newStatus,
                            contactedAt: newStatus === 'contacted' ? new Date().toISOString() : null
                          });
                        }}
                      >
                        {request.status === 'contacted' ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Contacted
                          </>
                        ) : (
                          <>
                            <Clock className="h-4 w-4 mr-1" />
                            Mark Initial Contact Complete
                          </>
                        )}
                      </Button>
                      
                      {/* Super admin only actions */}
                      {/* Note: For future implementation when user context is available */}
                      {/* {userPermissions?.includes('super_admin') && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this event request?")) {
                                deleteMutation.mutate(request.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </>
                      )} */}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      {selectedRequest && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Event Request</DialogTitle>
              <DialogDescription>
                Update event request information
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input name="firstName" defaultValue={selectedRequest.firstName} required />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input name="lastName" defaultValue={selectedRequest.lastName} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input name="email" type="email" defaultValue={selectedRequest.email} required />
                </div>
                <div>
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input name="phone" type="tel" defaultValue={selectedRequest.phone || ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="organizationName">Organization Name</Label>
                  <Input name="organizationName" defaultValue={selectedRequest.organizationName} required />
                </div>
                <div>
                  <Label htmlFor="department">Department (Optional)</Label>
                  <Input name="department" defaultValue={selectedRequest.department || ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="desiredEventDate">Desired Event Date (Optional)</Label>
                  <Input 
                    name="desiredEventDate" 
                    type="date" 
                    defaultValue={selectedRequest.desiredEventDate ? selectedRequest.desiredEventDate.split('T')[0] : ""} 
                  />
                </div>
                <div>
                  <Label htmlFor="previouslyHosted">Previously Hosted With Us?</Label>
                  <Select name="previouslyHosted" defaultValue={selectedRequest.previouslyHosted}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {previouslyHostedOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="message">Additional Information</Label>
                <Textarea name="message" rows={3} defaultValue={selectedRequest.message || ""} />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={selectedRequest.status}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => {
                  setShowEditDialog(false);
                  setSelectedRequest(null);
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Update Event Request"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}