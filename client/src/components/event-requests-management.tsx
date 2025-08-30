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
import { Search, Plus, Calendar, Building, User, Mail, Phone, AlertTriangle, CheckCircle, Clock, XCircle, Upload, Download, RotateCcw, ExternalLink, Edit, Trash2, ChevronDown, ChevronUp, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

// Utility function to convert 24-hour time to 12-hour format
const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';
  
  const [hours, minutes] = time24.split(':');
  const hour24 = parseInt(hours);
  
  if (hour24 === 0) return `12:${minutes} AM`;
  if (hour24 < 12) return `${hour24}:${minutes} AM`;
  if (hour24 === 12) return `12:${minutes} PM`;
  
  return `${hour24 - 12}:${minutes} PM`;
};

// Enhanced date formatting with day-of-week and color coding
const formatEventDate = (dateString: string) => {
  try {
    // Parse as local date to avoid timezone shifts
    let date: Date;
    
    if (dateString.includes('T') || dateString.includes('Z')) {
      date = new Date(dateString);
    } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) return { text: 'Invalid date', className: '' };
    
    const dayOfWeek = date.getDay();
    const dayName = format(date, "EEEE");
    const dateFormatted = format(date, "PPP");
    
    const isWedOrThu = dayOfWeek === 3 || dayOfWeek === 4;
    let className = "";
    if (dayOfWeek === 2) {
      className = "text-gray-700 font-medium";
    } else if (isWedOrThu) {
      className = "text-green-700 font-medium";
    } else {
      className = "text-[#236383] font-bold";
    }
    
    return {
      text: `${dayName}, ${dateFormatted}`,
      className,
      dayName,
      isWedOrThu
    };
  } catch (error) {
    return { text: 'Invalid date', className: '' };
  }
};

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
  createdAt: string;
  updatedAt: string;
  contactedAt?: string;
  createdBy?: string;
  contactCompletedAt?: string;
  completedByUserId?: string;
  communicationMethod?: string;
  eventAddress?: string;
  estimatedSandwichCount?: number;
  hasRefrigeration?: boolean;
  contactCompletionNotes?: string;
  tspContactAssigned?: string;
  toolkitSent?: boolean;
  toolkitSentDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  pickupTime?: string;
  additionalRequirements?: string;
  planningNotes?: string;
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
  { value: "i_dont_know", label: "Unknown" }
];

const statusOptions = [
  { value: "new", label: "New Request" },
  { value: "contact_completed", label: "Contact Completed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" }
];

export default function EventRequestsManagement() {
  const [activeTab, setActiveTab] = useState("requests");
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
    staleTime: 5 * 60 * 1000
  });

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

  const editMutation = useMutation({
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
    mutationFn: (data: any) => apiRequest("POST", "/api/event-requests/complete-contact", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      setShowCompleteContactDialog(false);
      setCompletingRequest(null);
      toast({ title: "Contact completion recorded successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error completing contact", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const completeEventDetailsMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/event-requests/complete-event-details", data),
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

  const syncToSheetsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/import/sync-to-sheets"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({ 
        title: "Sync to Google Sheets successful", 
        description: `Updated ${data.updated} rows in Google Sheets`
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
    mutationFn: () => apiRequest("POST", "/api/import/sync-from-sheets"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({ 
        title: "Sync from Google Sheets successful", 
        description: `Processed ${data.total} rows, imported ${data.imported} new events`
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

  const importExcelMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/import/import-excel"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({ 
        title: "Excel import successful", 
        description: `Successfully imported ${data.imported} events out of ${data.total} parsed`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error importing Excel file", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Filter events by tab
  const requestsEvents = eventRequests.filter((req: EventRequest) => req.status === 'new');
  const scheduledEvents = eventRequests.filter((req: EventRequest) => req.status === 'contact_completed' || req.status === 'scheduled');
  const pastEvents = eventRequests.filter((req: EventRequest) => req.status === 'completed' || req.status === 'declined');

  // Get current events based on active tab
  const getCurrentEvents = () => {
    switch (activeTab) {
      case 'requests':
        return requestsEvents;
      case 'scheduled':
        return scheduledEvents;
      case 'past':
        return pastEvents;
      default:
        return requestsEvents;
    }
  };

  const filteredRequests = useMemo(() => {
    const currentEvents = getCurrentEvents();
    return currentEvents.filter((request: EventRequest) => {
      const matchesSearch = !searchTerm || 
        request.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (request.desiredEventDate && request.desiredEventDate.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.desiredEventDate && formatEventDate(request.desiredEventDate).text.toLowerCase().includes(searchTerm.toLowerCase()));
        
      return matchesSearch;
    });
  }, [eventRequests, searchTerm, activeTab]);

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

  // Function to render enhanced scheduled event cards
  const renderScheduledEventCard = (request: EventRequest) => (
    <Card key={request.id} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-teal-500">
      <CardHeader className="pb-3">
        {/* Prominent Date Display */}
        {request.desiredEventDate && (
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-center space-x-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              <span className="text-lg font-bold text-amber-800">
                {(() => {
                  const dateInfo = formatEventDate(request.desiredEventDate);
                  return dateInfo.text;
                })()}
              </span>
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center space-x-3 text-xl mb-3">
              <Calendar className="w-6 h-6 text-teal-600" />
              <span className="text-gray-900">{request.organizationName}</span>
              {(request as any).toolkitStatus && (
                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                  Toolkit: {(() => {
                    const status = (request as any).toolkitStatus;
                    switch (status) {
                      case 'not_sent': return '⏳ Pending';
                      case 'sent': return '✓ Sent';
                      case 'received_confirmed': return '✓✓ Confirmed';
                      case 'not_needed': return 'N/A';
                      default: return status;
                    }
                  })()}
                </Badge>
              )}
            </CardTitle>
            
            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-teal-600" />
                  <span className="text-lg font-semibold text-teal-800">
                    {request.firstName} {request.lastName}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-teal-600" />
                  <span className="text-sm text-gray-600">{request.email}</span>
                </div>
                {request.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-teal-600" />
                    <span className="text-sm text-gray-600">{request.phone}</span>
                  </div>
                )}
              </div>
              
              {/* Event Details - Prominently displayed */}
              <div className="space-y-2">
                {((request as any).eventStartTime || (request as any).eventEndTime) && (
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-medium">
                      Event: {formatTime12Hour((request as any).eventStartTime)}
                      {(request as any).eventEndTime && ` - ${formatTime12Hour((request as any).eventEndTime)}`}
                    </span>
                  </div>
                )}
                {(request as any).pickupTime && (
                  <div className="flex items-center space-x-2">
                    <Trash2 className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-medium">Pickup: {formatTime12Hour((request as any).pickupTime)}</span>
                  </div>
                )}
                {request.eventAddress && (
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-medium">{request.eventAddress}</span>
                  </div>
                )}
                {request.estimatedSandwichCount && (
                  <div className="flex items-center space-x-2">
                    <span className="text-teal-600 text-sm">🥪</span>
                    <span className="text-sm font-medium">{request.estimatedSandwichCount} sandwiches</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            {getStatusDisplay(request.status)}
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
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* TSP Team Information */}
          {((request as any).tspContact || (request as any).customTspContact) && (
            <div className="bg-teal-50 p-3 rounded-lg border border-teal-200">
              <h4 className="font-semibold text-teal-800 mb-2">TSP Team Assignment</h4>
              <div className="space-y-1">
                {(request as any).tspContact && (
                  <div className="text-sm">
                    <strong>Primary Contact:</strong> {(() => {
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
                    <strong>Additional Info:</strong> {(request as any).customTspContact}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Planning Notes */}
          {(request as any).planningNotes && (
            <div className="bg-gray-50 p-3 rounded-lg border">
              <h4 className="font-semibold text-gray-800 mb-2">Planning Notes</h4>
              <p className="text-sm text-gray-700">{(request as any).planningNotes}</p>
            </div>
          )}
          
          {/* Basic Event Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {request.department && (
              <div><strong>Department:</strong> {request.department}</div>
            )}
            {typeof request.hasRefrigeration === 'boolean' && (
              <div><strong>Refrigeration:</strong> {request.hasRefrigeration ? 'Available' : 'Not available'}</div>
            )}
            <div><strong>Previously Hosted:</strong> {
              previouslyHostedOptions.find(opt => opt.value === request.previouslyHosted)?.label
            }</div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-3 border-t">
            <div className="text-xs text-gray-500">
              {request.message === 'Imported from Excel file' ? 'Imported' : 'Submitted'}: {(() => {
                try {
                  const date = new Date(request.createdAt);
                  return isNaN(date.getTime()) ? 'Invalid date' : format(date, "PPp");
                } catch (error) {
                  return 'Invalid date';
                }
              })()}
            </div>
            <div className="space-x-2">
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
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Function to render standard event cards (for requests and past events)
  const renderStandardEventCard = (request: EventRequest) => (
    <Card key={request.id} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-[#236383]">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center space-x-3 text-xl mb-3">
              <Building className="w-6 h-6" style={{ color: '#236383' }} />
              <span className="text-gray-900">{request.organizationName}</span>
              {request.organizationExists && (
                <Badge variant="outline" style={{ backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#FBAD3F' }}>
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Potential Duplicate
                </Badge>
              )}
            </CardTitle>
            
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
              <span className="ml-2">
                {(() => {
                  const dateInfo = formatEventDate(request.desiredEventDate);
                  return (
                    <span className={dateInfo.className}>
                      {dateInfo.text}
                    </span>
                  );
                })()}
              </span>
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
          
          <div className="flex justify-between items-center pt-3 border-t">
            <div className="text-sm text-gray-500">
              <div>{request.message === 'Imported from Excel file' ? 'Imported' : 'Submitted'}: {(() => {
                try {
                  const date = new Date(request.createdAt);
                  return isNaN(date.getTime()) ? 'Invalid date' : format(date, "PPp");
                } catch (error) {
                  return 'Invalid date';
                }
              })()}</div>
              {request.status === 'new' && !request.contactCompletedAt && (
                <div className="font-medium" style={{ color: '#FBAD3F' }}>
                  Action needed: {(() => {
                    try {
                      const submissionDate = new Date(request.createdAt);
                      const targetDate = new Date(submissionDate.getTime() + (3 * 24 * 60 * 60 * 1000));
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
            </div>
            <div className="space-x-2">
              {/* Show "Complete Primary Contact" only for new requests in Event Requests tab */}
              {activeTab === 'requests' && request.status === 'new' && !request.contactCompletedAt && (
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
              
              {/* Show "Update Event Details" only for past events tab */}
              {activeTab === 'past' && (
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
                  View Event Details
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Function to render comprehensive past event cards with all details
  const renderPastEventCard = (request: EventRequest) => (
    <Card key={request.id} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-gray-500">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {/* Organization Name and Event Date */}
            <CardTitle className="flex items-center space-x-3 text-xl mb-2">
              <CheckCircle className="w-6 h-6 text-gray-600" />
              <span className="text-gray-900">{request.organizationName}</span>
            </CardTitle>
            
            {/* Event Date */}
            {request.desiredEventDate && (
              <div className="text-lg font-semibold text-gray-700 mb-2">
                {(() => {
                  const dateInfo = formatEventDate(request.desiredEventDate);
                  return dateInfo.text;
                })()}
              </div>
            )}
            
            {/* Event Address (smaller, below other info) */}
            {request.eventAddress && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 mb-3">
                <Building className="w-4 h-4" />
                <span>{request.eventAddress}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end space-y-2">
            <Badge variant="secondary" className="text-xs">Event Completed</Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Prominent Sandwich Count */}
          {request.estimatedSandwichCount && (
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center justify-center space-x-3">
                <span className="text-3xl">🥪</span>
                <span className="text-2xl font-bold text-orange-800">
                  {request.estimatedSandwichCount} Sandwiches
                </span>
              </div>
            </div>
          )}
          
          {/* TSP Contact Information */}
          {((request as any).tspContact || (request as any).customTspContact || (request as any).tspContactAssigned) && (
            <div className="bg-teal-50 p-3 rounded-lg border border-teal-200">
              <h4 className="font-semibold text-teal-800 mb-2 flex items-center">
                <UserCheck className="w-4 h-4 mr-2" />
                TSP Contact
              </h4>
              <div className="text-sm text-teal-700">
                {(() => {
                  // Check tspContact field first
                  if ((request as any).tspContact) {
                    const contact = users.find((user: any) => user.id === (request as any).tspContact);
                    if (contact) {
                      return contact.firstName && contact.lastName 
                        ? `${contact.firstName} ${contact.lastName}` 
                        : contact.displayName || contact.email;
                    }
                  }
                  
                  // Check tspContactAssigned field
                  if ((request as any).tspContactAssigned) {
                    const contact = users.find((user: any) => user.id === (request as any).tspContactAssigned);
                    if (contact) {
                      return contact.firstName && contact.lastName 
                        ? `${contact.firstName} ${contact.lastName}` 
                        : contact.displayName || contact.email;
                    }
                  }
                  
                  // Fall back to custom TSP contact
                  if ((request as any).customTspContact) {
                    return (request as any).customTspContact;
                  }
                  
                  return 'Not assigned';
                })()}
              </div>
            </div>
          )}
          
          {/* Organization Contact Information */}
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
              <User className="w-4 h-4 mr-2" />
              Organization Contact
            </h4>
            <div className="space-y-1 text-sm text-blue-700">
              <div><strong>Name:</strong> {request.firstName} {request.lastName}</div>
              <div><strong>Email:</strong> {request.email}</div>
              {request.phone && (
                <div><strong>Phone:</strong> {request.phone}</div>
              )}
              {request.department && (
                <div><strong>Department:</strong> {request.department}</div>
              )}
            </div>
          </div>
          
          {/* Event Summary with all remaining details */}
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-800 mb-2">Event Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-green-700">
              {/* Event timing */}
              {((request as any).eventStartTime || (request as any).eventEndTime) && (
                <div>
                  <strong>Event Time:</strong> {formatTime12Hour((request as any).eventStartTime)}
                  {(request as any).eventEndTime && ` - ${formatTime12Hour((request as any).eventEndTime)}`}
                </div>
              )}
              {(request as any).pickupTime && (
                <div><strong>Pickup Time:</strong> {formatTime12Hour((request as any).pickupTime)}</div>
              )}
              
              {/* Sandwich details */}
              {(request as any).sandwichTypes && (
                <div><strong>Sandwich Types:</strong> {(request as any).sandwichTypes}</div>
              )}
              
              {/* Drivers section */}
              <div>
                <strong>Drivers:</strong> {(request as any).driverDetails || 'Not specified'}
              </div>
              
              {/* Speakers section */}
              <div>
                <strong>Speakers:</strong> {(request as any).speakerDetails || 'Not specified'}
              </div>
              
              {/* Other logistics */}
              {typeof request.hasRefrigeration === 'boolean' && (
                <div><strong>Refrigeration:</strong> {request.hasRefrigeration ? 'Available' : 'Not available'}</div>
              )}
              <div><strong>Previously Hosted:</strong> {
                previouslyHostedOptions.find(opt => opt.value === request.previouslyHosted)?.label
              }</div>
              {(request as any).additionalRequirements && (
                <div><strong>Special Requirements:</strong> {(request as any).additionalRequirements}</div>
              )}
              
              {/* Include original message in event summary if it exists and isn't generic */}
              {request.message && request.message !== 'Imported from Excel file' && (
                <div className="col-span-full">
                  <strong>Event Details:</strong> {request.message}
                </div>
              )}
            </div>
          </div>
          
          {/* Submission Information */}
          <div className="flex justify-between items-center pt-3 border-t text-xs text-gray-500">
            <div>
              {request.message === 'Imported from Excel file' ? 'Imported past event - duplicate organization' : 'Submitted'}: {(() => {
                try {
                  const date = new Date(request.createdAt);
                  return isNaN(date.getTime()) ? 'Invalid date' : format(date, "PPP");
                } catch (error) {
                  return 'Invalid date';
                }
              })()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
      duplicateNotes: formData.get("duplicateNotes")
    };
    editMutation.mutate(data);
  };

  const handleCompleteContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!completingRequest) return;

    const formData = new FormData(e.currentTarget);
    const data = {
      id: completingRequest.id,
      communicationMethod: formData.get("communicationMethod"),
      eventAddress: formData.get("eventAddress"),
      estimatedSandwichCount: formData.get("estimatedSandwichCount") ? parseInt(formData.get("estimatedSandwichCount") as string) : null,
      hasRefrigeration: formData.get("hasRefrigeration") === "true"
    };

    completeContactMutation.mutate(data);
  };

  const handleCompleteEventDetails = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!detailsRequest) return;

    const formData = new FormData(e.currentTarget);
    const data = {
      id: detailsRequest.id,
      toolkitStatus: formData.get("toolkitStatus"),
      eventStartTime: formData.get("eventStartTime") || null,
      eventEndTime: formData.get("eventEndTime") || null,
      pickupTime: formData.get("pickupTime") || null,
      tspContact: formData.get("tspContact") || null,
      customTspContact: formData.get("customTspContact") || null,
      planningNotes: formData.get("planningNotes") || null,
      eventAddress: formData.get("eventAddress") || null,
      estimatedSandwichCount: formData.get("estimatedSandwichCount") ? parseInt(formData.get("estimatedSandwichCount") as string) : null,
      sandwichTypes: formData.get("sandwichTypes") || null,
      driversArranged: formData.get("driversArranged") === "true",
      driverDetails: formData.get("driverDetails") || null,
      speakersNeeded: formData.get("speakersNeeded") === "true",
      speakerDetails: formData.get("speakerDetails") || null
    };

    completeEventDetailsMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Event Planning</h1>
        <div className="flex flex-wrap gap-2">
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
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => importExcelMutation.mutate()}
            disabled={importExcelMutation.isPending}
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline sm:ml-2">
              {importExcelMutation.isPending ? "Importing..." : "Import Excel"}
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
                    <Label htmlFor="desiredEventDate">Desired Event Date</Label>
                    <Input name="desiredEventDate" type="date" />
                  </div>
                  <div>
                    <Label htmlFor="previouslyHosted">Previously Hosted Event?</Label>
                    <Select name="previouslyHosted" defaultValue="no">
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
                  <Label htmlFor="message">Additional Information (Optional)</Label>
                  <Textarea name="message" rows={3} />
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

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests" className="relative">
            Event Requests
            <Badge variant="secondary" className="ml-2">
              {requestsEvents.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="relative">
            Scheduled Events
            <Badge variant="secondary" className="ml-2">
              {scheduledEvents.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="past" className="relative">
            Past Events
            <Badge variant="secondary" className="ml-2">
              {pastEvents.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by organization, name, email, or date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tab Content */}
          <TabsContent value="requests" className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Showing {filteredRequests.length} event request{filteredRequests.length !== 1 ? 's' : ''} that need contact
            </div>
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">No event requests found.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((request: EventRequest) => renderStandardEventCard(request))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Showing {filteredRequests.length} scheduled event{filteredRequests.length !== 1 ? 's' : ''}
            </div>
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">No scheduled events found.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((request: EventRequest) => renderScheduledEventCard(request))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Showing {filteredRequests.length} past event{filteredRequests.length !== 1 ? 's' : ''}
            </div>
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">No past events found.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((request: EventRequest) => renderPastEventCard(request))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Edit Dialog */}
      {showEditDialog && selectedRequest && (
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
                  <Label htmlFor="phone">Phone</Label>
                  <Input name="phone" type="tel" defaultValue={selectedRequest.phone || ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="organizationName">Organization Name</Label>
                  <Input name="organizationName" defaultValue={selectedRequest.organizationName} required />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input name="department" defaultValue={selectedRequest.department || ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="desiredEventDate">Desired Event Date</Label>
                  <Input 
                    name="desiredEventDate" 
                    type="date" 
                    defaultValue={selectedRequest.desiredEventDate ? selectedRequest.desiredEventDate.split('T')[0] : ""} 
                  />
                </div>
                <div>
                  <Label htmlFor="previouslyHosted">Previously Hosted Event?</Label>
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
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={currentEditingStatus}>
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
              <div>
                <Label htmlFor="message">Additional Information</Label>
                <Textarea name="message" rows={3} defaultValue={selectedRequest.message || ""} />
              </div>
              <div>
                <Label htmlFor="duplicateNotes">Duplicate Check Notes</Label>
                <Textarea name="duplicateNotes" rows={2} defaultValue={selectedRequest.duplicateNotes || ""} />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending ? "Updating..." : "Update Event Request"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Complete Contact Dialog */}
      {showCompleteContactDialog && completingRequest && (
        <Dialog open={showCompleteContactDialog} onOpenChange={setShowCompleteContactDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Complete Primary Contact</DialogTitle>
              <DialogDescription>
                Record the initial contact details for {completingRequest.organizationName}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCompleteContact} className="space-y-4">
              <div>
                <Label htmlFor="communicationMethod">Communication Method</Label>
                <Select name="communicationMethod" defaultValue="">
                  <SelectTrigger>
                    <SelectValue placeholder="How did you contact them?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="in_person">In Person</SelectItem>
                    <SelectItem value="text">Text Message</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="eventAddress">Event Location/Address</Label>
                <Input name="eventAddress" placeholder="Where will the event take place?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="estimatedSandwichCount">Estimated Sandwich Count</Label>
                  <Input name="estimatedSandwichCount" type="number" min="1" placeholder="How many sandwiches needed?" />
                </div>
                <div>
                  <Label htmlFor="hasRefrigeration">Refrigeration Available?</Label>
                  <Select name="hasRefrigeration" defaultValue="">
                    <SelectTrigger>
                      <SelectValue placeholder="Is refrigeration available?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowCompleteContactDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={completeContactMutation.isPending}>
                  {completeContactMutation.isPending ? "Saving..." : "Complete Contact"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Event Details Dialog */}
      {showEventDetailsDialog && detailsRequest && (
        <Dialog open={showEventDetailsDialog} onOpenChange={setShowEventDetailsDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Event Details for {detailsRequest.organizationName}</DialogTitle>
              <DialogDescription>
                Complete or update the advanced event planning details
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCompleteEventDetails} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="toolkitStatus">Toolkit Status</Label>
                  <Select name="toolkitStatus" defaultValue={detailsRequest.toolkitStatus || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select toolkit status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_sent">Not Yet Sent</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="received_confirmed">Received & Confirmed</SelectItem>
                      <SelectItem value="not_needed">Not Needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tspContact">TSP Team Contact</Label>
                  <Select name="tspContact" defaultValue={detailsRequest.tspContact || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No assignment</SelectItem>
                      {users.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user.displayName || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="eventStartTime">Event Start Time</Label>
                  <Input 
                    name="eventStartTime" 
                    type="time" 
                    defaultValue={detailsRequest.eventStartTime || ""}
                  />
                </div>
                <div>
                  <Label htmlFor="eventEndTime">Event End Time</Label>
                  <Input 
                    name="eventEndTime" 
                    type="time" 
                    defaultValue={detailsRequest.eventEndTime || ""}
                  />
                </div>
                <div>
                  <Label htmlFor="pickupTime">Pickup Time</Label>
                  <Input 
                    name="pickupTime" 
                    type="time" 
                    defaultValue={detailsRequest.pickupTime || ""}
                  />
                </div>
              </div>

              {/* Event Details Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="eventAddress">Event Address</Label>
                  <Input 
                    name="eventAddress" 
                    defaultValue={detailsRequest.eventAddress || ""}
                    placeholder="Where will the event take place?"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedSandwichCount">Estimated # of Sandwiches to be Made</Label>
                  <Input 
                    name="estimatedSandwichCount" 
                    type="number"
                    min="1"
                    defaultValue={detailsRequest.estimatedSandwichCount || ""}
                    placeholder="How many sandwiches to be made?"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="sandwichTypes">Type of Sandwiches</Label>
                <Select name="sandwichTypes" defaultValue={(detailsRequest as any).sandwichTypes || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sandwich types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deli">Deli</SelectItem>
                    <SelectItem value="turkey">Turkey</SelectItem>
                    <SelectItem value="ham">Ham</SelectItem>
                    <SelectItem value="pb&j">PB&J</SelectItem>
                    <SelectItem value="pb&j+deli">PB&J + Deli</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Drivers Section */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="driversArranged">Do we have drivers arranged?</Label>
                  <Select name="driversArranged" defaultValue={(detailsRequest as any).driversArranged ? "true" : "false"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Are drivers arranged?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="driverDetails">Driver Details (Who are they?)</Label>
                  <Textarea 
                    name="driverDetails" 
                    rows={2}
                    defaultValue={(detailsRequest as any).driverDetails || ""}
                    placeholder="Names and contact info for drivers..."
                  />
                </div>
              </div>

              {/* Speakers Section */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="speakersNeeded">Speakers necessary?</Label>
                  <Select name="speakersNeeded" defaultValue={(detailsRequest as any).speakersNeeded ? "true" : "false"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Are speakers needed?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="speakerDetails">Speaker Details (Who are they?)</Label>
                  <Textarea 
                    name="speakerDetails" 
                    rows={2}
                    defaultValue={(detailsRequest as any).speakerDetails || ""}
                    placeholder="Names and topics for speakers..."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="customTspContact">Additional TSP Contact Info</Label>
                <Textarea 
                  name="customTspContact" 
                  rows={3}
                  defaultValue={detailsRequest.customTspContact}
                  placeholder="Add any additional contact details, phone numbers, or special instructions for this event..."
                />
              </div>

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