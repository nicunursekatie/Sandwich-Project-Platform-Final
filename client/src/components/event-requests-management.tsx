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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, Plus, Calendar, Building, User, Mail, Phone, AlertTriangle, CheckCircle, Clock, XCircle, Upload, Download, RotateCcw, ExternalLink, Edit, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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
  status: 'new' | 'contact_completed' | 'scheduled' | 'completed' | 'declined';
  assignedTo?: string;
  organizationExists: boolean;
  duplicateNotes?: string;
  createdAt: string; // Submission date from Google Sheet
  updatedAt: string; 
  contactedAt?: string; // When initial contact was completed
  createdBy?: string;
  // Contact completion fields
  contactCompletedAt?: string;
  completedByUserId?: string;
  communicationMethod?: string;
  eventAddress?: string;
  estimatedSandwichCount?: number;
  hasRefrigeration?: boolean;
  contactCompletionNotes?: string;
  
  // Advanced planning fields (for scheduled/in_planning status)
  tspContactAssigned?: string;
  toolkitSent?: boolean;
  toolkitSentDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  pickupTime?: string;
  additionalRequirements?: string;
  planningNotes?: string;
  
  // Event details completion fields
  toolkitStatus?: string;
  tspContact?: string;
  additionalTspContacts?: string;
  customTspContact?: string;
}

const statusColors = {
  new: "bg-blue-100 text-blue-800",
  contact_completed: "bg-emerald-100 text-emerald-800",
  scheduled: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  declined: "bg-red-100 text-red-800"
};

const statusIcons = {
  new: Clock,
  contact_completed: CheckCircle,
  scheduled: Calendar,
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
  { value: "contact_completed", label: "Contact Completed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" }
];

export default function EventRequestsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EventRequest | null>(null);
  const [currentEditingStatus, setCurrentEditingStatus] = useState<string>("");
  const [showCompleteContactDialog, setShowCompleteContactDialog] = useState(false);
  const [completingRequest, setCompletingRequest] = useState<EventRequest | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEventDetailsDialog, setShowEventDetailsDialog] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<EventRequest | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: eventRequests = [], isLoading, error } = useQuery({
    queryKey: ["/api/event-requests"],
    queryFn: () => apiRequest("GET", "/api/event-requests"),
    refetchOnMount: true
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users"),
    staleTime: 5 * 60 * 1000 // 5 minutes
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

  const completeContactMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/event-requests/${id}/complete-contact`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      setShowCompleteContactDialog(false);
      setCompletingRequest(null);
      toast({ title: "Contact completion recorded successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error recording contact completion", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const completeEventDetailsMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/event-requests/${id}/details`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      setShowEventDetailsDialog(false);
      setDetailsRequest(null);
      toast({ title: "Event details saved successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error saving event details", 
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
      status: formData.get("status"),
      // Advanced planning fields (optional)
      tspContactAssigned: formData.get("tspContactAssigned") || undefined,
      toolkitSent: formData.get("toolkitSent") === "yes",
      eventStartTime: formData.get("eventStartTime") || undefined,
      eventEndTime: formData.get("eventEndTime") || undefined,
      pickupTime: formData.get("pickupTime") || undefined,
      additionalRequirements: formData.get("additionalRequirements") || undefined,
      planningNotes: formData.get("planningNotes") || undefined
    };
    updateMutation.mutate(data);
  };

  const handleCompleteEventDetails = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!detailsRequest) return;
    
    const formData = new FormData(e.currentTarget);
    const data = {
      id: detailsRequest.id,
      toolkitStatus: formData.get("toolkitStatus"),
      eventStartTime: formData.get("eventStartTime") || undefined,
      eventEndTime: formData.get("eventEndTime") || undefined,
      pickupTime: formData.get("pickupTime") || undefined,
      eventAddress: formData.get("eventAddress") || undefined,
      estimatedSandwichCount: formData.get("estimatedSandwichCount") ? parseInt(formData.get("estimatedSandwichCount") as string) : undefined,
      hasRefrigeration: formData.get("hasRefrigeration") ? formData.get("hasRefrigeration") === "yes" : undefined,
      planningNotes: formData.get("planningNotes") || undefined,
      tspContact: formData.get("tspContact") || undefined,
      customTspContact: formData.get("customTspContact") || undefined
    };
    console.log("🔥 FORM DATA TO SUBMIT:", JSON.stringify(data, null, 2));
    completeEventDetailsMutation.mutate(data);
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

  const toggleCardExpansion = (requestId: number) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const hasAdvancedDetails = (request: EventRequest) => {
    return !!(
      (request as any).toolkitStatus ||
      (request as any).eventStartTime ||
      (request as any).eventEndTime ||
      (request as any).pickupTime ||
      (request as any).tspContact ||
      (request as any).customTspContact ||
      (request as any).planningNotes
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Event Requests</h1>
        <div className="flex flex-wrap gap-2">
          {/* Google Sheets Integration - Compact on mobile */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_EVENT_REQUESTS_SHEET_ID || '1GsiY_Nafzt_AYr4lXd-Nc-tKiCcSIc4_FW3lDJWX_ss'}/edit`, '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline sm:ml-2">Open Google Sheet</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => syncToSheetsMutation.mutate()}
            disabled={syncToSheetsMutation.isPending}
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline sm:ml-2">
              {syncToSheetsMutation.isPending ? "Syncing..." : "Sync to Sheets"}
            </span>
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => syncFromSheetsMutation.mutate()}
            disabled={syncFromSheetsMutation.isPending}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline sm:ml-2">
              {syncFromSheetsMutation.isPending ? "Syncing..." : "Sync from Sheets"}
            </span>
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
            <Card key={request.id} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-[#236383]">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center space-x-3 text-xl mb-3">
                      <Building className="w-6 h-6" style={{ color: '#236383' }} />
                      <span className="text-gray-900">{request.organizationName}</span>
                      {request.organizationExists && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Potential Duplicate
                        </Badge>
                      )}
                    </CardTitle>
                    
                    {/* Contact Information - Prominent Display */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <User className="w-5 h-5" style={{ color: '#236383' }} />
                        <span className="text-lg font-semibold" style={{ color: '#236383' }}>
                          {request.firstName} {request.lastName}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Mail className="w-5 h-5" style={{ color: '#236383' }} />
                        <span className="text-base font-medium" style={{ color: '#236383' }}>
                          {request.email}
                        </span>
                      </div>
                      
                      {request.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="w-5 h-5" style={{ color: '#236383' }} />
                          <span className="text-base font-medium" style={{ color: '#236383' }}>
                            {request.phone}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {getStatusDisplay(request.status)}
                    
                    {/* Admin actions - small subtle buttons */}
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setCurrentEditingStatus(request.status);
                          setShowEditDialog(true);
                        }}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this event request?")) {
                            deleteMutation.mutate(request.id);
                          }
                        }}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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
                      <strong>Desired Date: </strong>
                      {(() => {
                        try {
                          const date = new Date(request.desiredEventDate);
                          return isNaN(date.getTime()) ? 'Invalid date' : format(date, "PPP");
                        } catch (error) {
                          return 'Invalid date';
                        }
                      })()}
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
                      <div>Submitted: {(() => {
                        try {
                          const date = new Date(request.createdAt);
                          return isNaN(date.getTime()) ? 'Invalid date' : format(date, "PPp");
                        } catch (error) {
                          return 'Invalid date';
                        }
                      })()}</div>
                      {request.status === 'new' && !request.contactCompletedAt && (
                        <div className="font-medium" style={{ color: '#e67e22' }}>
                          Action needed: {(() => {
                            try {
                              const submissionDate = new Date(request.createdAt);
                              const targetDate = new Date(submissionDate.getTime() + (3 * 24 * 60 * 60 * 1000)); // 3 days after submission
                              const daysUntilTarget = Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                              if (daysUntilTarget > 0) {
                                return `Contact within ${daysUntilTarget} day${daysUntilTarget === 1 ? '' : 's'}`;
                              } else {
                                const daysOverdue = Math.abs(daysUntilTarget);
                                return `Contact overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}`;
                              }
                            } catch (error) {
                              return 'Contact needed';
                            }
                          })()}
                        </div>
                      )}
                      {request.contactCompletedAt && (
                        <div className="text-green-600 space-y-1">
                          <div>Contact completed: {format(new Date(request.contactCompletedAt), "PPp")}</div>
                          {request.communicationMethod && (
                            <div className="text-sm">Method: {request.communicationMethod}</div>
                          )}
                          {request.eventAddress && (
                            <div className="text-sm">Event location: {request.eventAddress}</div>
                          )}
                          {request.estimatedSandwichCount && (
                            <div className="text-sm">Estimated sandwiches: {request.estimatedSandwichCount}</div>
                          )}
                          {typeof request.hasRefrigeration === 'boolean' && (
                            <div className="text-sm">Refrigeration: {request.hasRefrigeration ? 'Available' : 'Not available'}</div>
                          )}
                        </div>
                      )}
                      
                      {/* Advanced Event Details - Collapsible */}
                      {hasAdvancedDetails(request) && (
                        <div className="mt-2">
                          <Collapsible 
                            open={expandedCards.has(request.id)} 
                            onOpenChange={() => toggleCardExpansion(request.id)}
                          >
                            <CollapsibleTrigger className="flex items-center w-full p-3 border-l-4 border-teal-500 bg-teal-50 rounded hover:bg-teal-100 transition-colors">
                              <div className="flex-1 text-left">
                                <div className="font-semibold text-teal-800 text-sm flex items-center">
                                  📋 Advanced Event Details
                                  {(request as any).toolkitStatus && (
                                    <span className="ml-2 text-xs">
                                      | Toolkit: {(() => {
                                        const status = (request as any).toolkitStatus;
                                        switch (status) {
                                          case 'not_sent': return '⏳ Pending';
                                          case 'sent': return '✓ Sent';
                                          case 'received_confirmed': return '✓✓ Confirmed';
                                          case 'not_needed': return 'N/A';
                                          default: return status;
                                        }
                                      })()}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-teal-600 mt-1">Click to {expandedCards.has(request.id) ? 'collapse' : 'expand'} details</div>
                              </div>
                              {expandedCards.has(request.id) ? 
                                <ChevronUp className="w-4 h-4 text-teal-600" /> : 
                                <ChevronDown className="w-4 h-4 text-teal-600" />
                              }
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="p-3 border-l-4 border-teal-300 bg-teal-25 rounded-b space-y-2">
                                {(request as any).toolkitStatus && (
                                  <div className="text-sm">
                                    <strong className="text-teal-800">Toolkit Status:</strong> {(() => {
                                      const status = (request as any).toolkitStatus;
                                      switch (status) {
                                        case 'not_sent': return '⏳ Not Yet Sent';
                                        case 'sent': return '✓ Sent';
                                        case 'received_confirmed': return '✓✓ Received & Confirmed';
                                        case 'not_needed': return 'N/A - Not Needed';
                                        default: return status;
                                      }
                                    })()}
                                  </div>
                                )}
                                {((request as any).eventStartTime || (request as any).eventEndTime) && (
                                  <div className="text-sm">
                                    <strong className="text-teal-800">Event Time:</strong> {(request as any).eventStartTime}
                                    {(request as any).eventEndTime && ` - ${(request as any).eventEndTime}`}
                                  </div>
                                )}
                                {(request as any).pickupTime && (
                                  <div className="text-sm">
                                    <strong className="text-teal-800">Pickup Time:</strong> {(request as any).pickupTime}
                                  </div>
                                )}
                                {(request as any).tspContact && (
                                  <div className="text-sm">
                                    <strong className="text-teal-800">TSP Contact:</strong> {(() => {
                                      const contact = users.find((user: any) => user.id === (request as any).tspContact);
                                      return contact 
                                        ? (contact.firstName && contact.lastName 
                                            ? `${contact.firstName} ${contact.lastName}` 
                                            : contact.displayName || contact.email)
                                        : (request as any).tspContact;
                                    })()}
                                  </div>
                                )}
                                {(request as any).customTspContact && (
                                  <div className="text-sm">
                                    <strong className="text-teal-800">Additional Contact Info:</strong> {(request as any).customTspContact}
                                  </div>
                                )}
                                {(request as any).planningNotes && (
                                  <div className="text-sm">
                                    <strong className="text-teal-800">Planning Notes:</strong> {(request as any).planningNotes}
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      )}
                    </div>
                    <div className="space-x-2">
                      {request.status === 'new' && !request.contactCompletedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCompletingRequest(request);
                            setShowCompleteContactDialog(true);
                          }}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Complete Primary Contact
                        </Button>
                      )}
                      
                      {request.contactCompletedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setCurrentEditingStatus(request.status);
                            setShowEditDialog(true);
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Event Data
                        </Button>
                      )}

                      {/* Event Details Button - Show based on whether advanced details exist */}
                      {request.status !== 'new' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setDetailsRequest(request);
                            setShowEventDetailsDialog(true);
                          }}
                          className="bg-teal-600 hover:bg-teal-700 text-white"
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          {hasAdvancedDetails(request) ? 'Update Event Details' : 'Complete Event Details'}
                        </Button>
                      )}
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
                <Select 
                  name="status" 
                  defaultValue={selectedRequest.status}
                  onValueChange={(value) => setCurrentEditingStatus(value)}
                >
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

              {/* Advanced Planning Fields - Show for all statuses beyond "new" */}
              {['contact_completed', 'scheduled', 'completed', 'declined'].includes(currentEditingStatus || selectedRequest.status) && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Event Planning</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tspContactAssigned">TSP Contact Assigned</Label>
                      <Input 
                        name="tspContactAssigned" 
                        placeholder="Team member name"
                        defaultValue={selectedRequest.tspContactAssigned || ""} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="toolkitSent">Toolkit Sent?</Label>
                      <Select name="toolkitSent" defaultValue={selectedRequest.toolkitSent ? "yes" : "no"}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="eventStartTime">Event Start Time</Label>
                      <Input 
                        name="eventStartTime" 
                        type="time"
                        defaultValue={selectedRequest.eventStartTime || ""} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="eventEndTime">Event End Time</Label>
                      <Input 
                        name="eventEndTime" 
                        type="time"
                        defaultValue={selectedRequest.eventEndTime || ""} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="pickupTime">Driver Pickup Time</Label>
                      <Input 
                        name="pickupTime" 
                        type="time"
                        defaultValue={selectedRequest.pickupTime || ""} 
                        placeholder="When to pickup sandwiches"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="additionalRequirements">Special Requirements</Label>
                    <Textarea 
                      name="additionalRequirements" 
                      rows={3}
                      placeholder="Any special dietary requirements, setup needs, etc."
                      defaultValue={selectedRequest.additionalRequirements || ""} 
                    />
                  </div>

                  <div>
                    <Label htmlFor="planningNotes">Planning Notes</Label>
                    <Textarea 
                      name="planningNotes" 
                      rows={3}
                      placeholder="General notes about event planning..."
                      defaultValue={selectedRequest.planningNotes || ""} 
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => {
                  setShowEditDialog(false);
                  setSelectedRequest(null);
                  setCurrentEditingStatus("");
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

      {/* Contact Completion Dialog */}
      {completingRequest && (
        <Dialog open={showCompleteContactDialog} onOpenChange={setShowCompleteContactDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Complete Primary Contact</DialogTitle>
              <DialogDescription>
                Record details from your contact with {completingRequest.organizationName}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              completeContactMutation.mutate({
                id: completingRequest.id,
                communicationMethod: formData.get("communicationMethod"),
                eventAddress: formData.get("eventAddress") || undefined,
                estimatedSandwichCount: formData.get("estimatedSandwichCount") ? 
                  parseInt(formData.get("estimatedSandwichCount") as string) : undefined,
                hasRefrigeration: formData.get("hasRefrigeration") === "yes" ? true : 
                  formData.get("hasRefrigeration") === "no" ? false : undefined,
                notes: formData.get("notes") || undefined
              });
            }} className="space-y-4">
              <div>
                <Label htmlFor="communicationMethod">How did you contact them? *</Label>
                <Select name="communicationMethod" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select communication method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="text">Text message</SelectItem>
                    <SelectItem value="in_person">In person</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="eventAddress">Event Address (if confirmed)</Label>
                <Textarea 
                  name="eventAddress" 
                  rows={2}
                  placeholder="Street address, city, state where the event will be held..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="estimatedSandwichCount">Estimated Sandwich Count</Label>
                  <Input 
                    name="estimatedSandwichCount" 
                    type="number"
                    min="1"
                    placeholder="e.g. 50"
                  />
                </div>
                <div>
                  <Label htmlFor="hasRefrigeration">Refrigeration Available?</Label>
                  <Select name="hasRefrigeration">
                    <SelectTrigger>
                      <SelectValue placeholder="Select if known" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes - has refrigeration</SelectItem>
                      <SelectItem value="no">No refrigeration</SelectItem>
                      <SelectItem value="unknown">Unknown/Not discussed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea 
                  name="notes" 
                  rows={3}
                  placeholder="Any important details from your conversation, next steps, concerns, etc."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => {
                  setShowCompleteContactDialog(false);
                  setCompletingRequest(null);
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={completeContactMutation.isPending}>
                  {completeContactMutation.isPending ? "Recording..." : "Record Contact Completion"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Complete Event Details Dialog */}
      {detailsRequest && (
        <Dialog open={showEventDetailsDialog} onOpenChange={setShowEventDetailsDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">Complete Event Details</DialogTitle>
              <DialogDescription>
                Fill in the comprehensive event planning details for {detailsRequest.organizationName}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCompleteEventDetails} className="space-y-6">
              
              {/* Toolkit Status - Most Important */}
              <div className="border-l-4 border-teal-500 pl-4 bg-teal-50 p-4 rounded">
                <Label htmlFor="toolkitStatus" className="text-lg font-semibold text-teal-800">
                  Toolkit Status (REQUIRED) *
                </Label>
                <Select name="toolkitStatus" required defaultValue={detailsRequest.toolkitStatus || "not_sent"}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select toolkit status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_sent">Not Yet Sent</SelectItem>
                    <SelectItem value="sent">Toolkit Sent ✓</SelectItem>
                    <SelectItem value="received_confirmed">Received & Confirmed ✓✓</SelectItem>
                    <SelectItem value="not_needed">Not Needed for This Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Event Timing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="eventStartTime">Event Start Time</Label>
                  <Input 
                    name="eventStartTime" 
                    type="time"
                    defaultValue={detailsRequest.eventStartTime}
                  />
                </div>
                <div>
                  <Label htmlFor="eventEndTime">Event End Time</Label>
                  <Input 
                    name="eventEndTime" 
                    type="time"
                    defaultValue={detailsRequest.eventEndTime}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="pickupTime">Pickup Time</Label>
                <Input 
                  name="pickupTime" 
                  type="time"
                  defaultValue={detailsRequest.pickupTime}
                  placeholder="When TSP should pick up sandwiches"
                />
              </div>

              {/* Event Location */}
              <div>
                <Label htmlFor="eventAddress">Event Address</Label>
                <Textarea 
                  name="eventAddress" 
                  rows={3}
                  defaultValue={detailsRequest.eventAddress}
                  placeholder="Full address where the event will take place"
                />
              </div>

              {/* Sandwich Estimate */}
              <div>
                <Label htmlFor="estimatedSandwichCount">Estimated # of Sandwiches</Label>
                <Input 
                  name="estimatedSandwichCount" 
                  type="number"
                  min="1"
                  defaultValue={detailsRequest.estimatedSandwichCount}
                  placeholder="Estimated number of sandwiches needed"
                />
              </div>

              {/* Refrigeration */}
              <div>
                <Label htmlFor="hasRefrigeration">Refrigeration Available?</Label>
                <Select name="hasRefrigeration" defaultValue={detailsRequest.hasRefrigeration ? detailsRequest.hasRefrigeration.toString() : "none"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select refrigeration status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="yes">Yes - Refrigeration Available</SelectItem>
                    <SelectItem value="no">No - No Refrigeration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* TSP Contact Assignment */}
              <div className="space-y-3">
                <Label>TSP Contact Assignment</Label>
                <div>
                  <Label htmlFor="tspContact" className="text-sm">Primary TSP Contact</Label>
                  <Select name="tspContact" defaultValue={detailsRequest.tspContact || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary TSP contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user.displayName || user.email}
                          {user.role && user.role !== 'volunteer' && (
                            <span className="text-xs text-gray-500 ml-2">({user.role})</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-600 mt-1">Primary TSP team member for this event</p>
                </div>

                <div>
                  <Label htmlFor="additionalTspContacts" className="text-sm">Additional TSP Contacts</Label>
                  <Select name="additionalTspContacts" defaultValue={detailsRequest.additionalTspContacts || "none"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Add secondary contact (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {users.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user.displayName || user.email}
                          {user.role && user.role !== 'volunteer' && (
                            <span className="text-xs text-gray-500 ml-2">({user.role})</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-600 mt-1">Optional secondary TSP contact</p>
                </div>
                
                <div>
                  <Label htmlFor="customTspContact" className="text-sm">
                    Custom Contact Information
                  </Label>
                  <Textarea 
                    name="customTspContact" 
                    rows={3}
                    defaultValue={detailsRequest.customTspContact}
                    placeholder="Add any additional contact details, phone numbers, or special instructions for this event..."
                  />
                  <p className="text-xs text-gray-600 mt-1">Free text for contact details not covered above</p>
                </div>
              </div>

              {/* Planning Notes */}
              <div>
                <Label htmlFor="planningNotes">Planning Notes & Other Important Info</Label>
                <Textarea 
                  name="planningNotes" 
                  rows={4}
                  defaultValue={detailsRequest.planningNotes}
                  placeholder="Special requirements, logistics notes, follow-up tasks, or any other pertinent information for this event"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowEventDetailsDialog(false);
                    setDetailsRequest(null);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={completeEventDetailsMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {completeEventDetailsMutation.isPending ? "Saving..." : "Save Event Details"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}