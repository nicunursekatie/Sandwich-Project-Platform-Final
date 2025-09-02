import { useState, useMemo, useEffect } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Plus, Calendar, Building, User, Mail, Phone, AlertTriangle, CheckCircle, Clock, XCircle, Upload, Download, RotateCcw, ExternalLink, Edit, Trash2, ChevronDown, ChevronUp, UserCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
// Removed formatDateForDisplay import as we now use toLocaleDateString directly
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { DriverSelection } from "./driver-selection";
import EventVolunteerSignup from "./event-volunteer-signup";
import { EventEmailComposer } from "./event-email-composer";

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
    if (!dateString) return { text: 'No date provided', className: 'text-gray-500' };
    
    // Parse the date string safely - handle database timestamps, YYYY-MM-DD, and ISO dates
    let date: Date;
    if (dateString && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      // Database timestamp format: "2025-09-03 00:00:00"
      // Extract just the date part and create at noon to avoid timezone issues
      const dateOnly = dateString.split(' ')[0];
      date = new Date(dateOnly + 'T12:00:00');
    } else if (dateString && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)) {
      // ISO format with midnight time (e.g., "2025-09-03T00:00:00.000Z")
      // Extract just the date part and create at noon to avoid timezone issues
      const dateOnly = dateString.split('T')[0];
      date = new Date(dateOnly + 'T12:00:00');
    } else if (dateString.includes('T') || dateString.includes('Z')) {
      date = new Date(dateString);
    } else if (dateString && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // For YYYY-MM-DD format, add noon to prevent timezone shift
      date = new Date(dateString + 'T12:00:00');
    } else {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) return { text: 'Invalid date', className: '' };
    
    const dayOfWeek = date.getDay();
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dateFormatted = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const isWedOrThu = dayOfWeek === 3 || dayOfWeek === 4;
    let className = "";
    if (dayOfWeek === 2) {
      className = "text-gray-700 font-medium";
    } else if (isWedOrThu) {
      className = "text-orange-700 font-medium";
    } else {
      className = "text-[#236383] font-bold";
    }
    
    return {
      text: dateFormatted,
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
  additionalContact1?: string;
  additionalContact2?: string;
  customTspContact?: string;
}

const statusColors = {
  new: "bg-gradient-to-r from-teal-50 to-cyan-100 text-teal-800 border border-teal-200",
  contact_completed: "bg-gradient-to-r from-orange-50 to-amber-100 text-orange-800 border border-orange-200",
  scheduled: "bg-gradient-to-r from-yellow-50 to-orange-100 text-yellow-800 border border-yellow-200",
  completed: "bg-gradient-to-r from-gray-50 to-slate-100 text-gray-700 border border-gray-200",
  declined: "bg-gradient-to-r text-white border-2 font-bold shadow-lg"
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
  { value: "declined", label: "🚫 EVENT POSTPONED" }
];

export default function EventRequestsManagement() {
  const [activeTab, setActiveTab] = useState("requests");
  const [searchTerm, setSearchTerm] = useState("");
  const [globalSearch, setGlobalSearch] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EventRequest | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<number | null>(null);
  const [currentEditingStatus, setCurrentEditingStatus] = useState<string>("");
  const [showCompleteContactDialog, setShowCompleteContactDialog] = useState(false);
  const [completingRequest, setCompletingRequest] = useState<EventRequest | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEventDetailsDialog, setShowEventDetailsDialog] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<EventRequest | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [pastEventsSortOrder, setPastEventsSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailComposerRequest, setEmailComposerRequest] = useState<EventRequest | null>(null);
  const [pastEventsPage, setPastEventsPage] = useState(1);
  const [pastEventsPerPage] = useState(10);
  // Sorting state for all tabs
  const [requestsSortBy, setRequestsSortBy] = useState<'date' | 'organization'>('date');
  const [requestsSortOrder, setRequestsSortOrder] = useState<'asc' | 'desc'>('asc');
  const [scheduledSortBy, setScheduledSortBy] = useState<'date' | 'organization'>('date');
  const [scheduledSortOrder, setScheduledSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pastSortBy, setPastSortBy] = useState<'date' | 'organization'>('date');
  // Enhanced inline editing state for safer editing
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [tempValues, setTempValues] = useState<any>({});
  const [pendingChanges, setPendingChanges] = useState<{[eventId: number]: {[field: string]: any}}>({});
  const [undoTimeouts, setUndoTimeouts] = useState<{[key: string]: NodeJS.Timeout}>({});
  // TSP Contact Assignment state
  const [showTspContactDialog, setShowTspContactDialog] = useState(false);
  const [assigningContactRequest, setAssigningContactRequest] = useState<EventRequest | null>(null);
  const [selectedTspContacts, setSelectedTspContacts] = useState<string[]>([]);
  const [customTspContacts, setCustomTspContacts] = useState<string[]>(['']);
  
  // Get current user for permission checking
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle URL parameters for tab and event highlighting
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const eventIdParam = urlParams.get('eventId');
    
    // Set the active tab based on URL parameter
    if (tabParam) {
      setActiveTab(tabParam);
    }
    
    // Highlight specific event if provided
    if (eventIdParam) {
      const eventId = parseInt(eventIdParam);
      setHighlightedEventId(eventId);
      
      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightedEventId(null);
      }, 3000);
    }
  }, []);

  // Reset pagination when search term changes
  useEffect(() => {
    setPastEventsPage(1);
  }, [searchTerm]);

  const { data: eventRequests = [], isLoading, error } = useQuery({
    queryKey: ["/api/event-requests"],
    queryFn: () => apiRequest("GET", "/api/event-requests"),
    refetchOnMount: true
  });


  const { data: users = [] } = useQuery({
    queryKey: ["/api/users/for-assignments"],
    queryFn: () => apiRequest("GET", "/api/users/for-assignments"),
    staleTime: 5 * 60 * 1000
  });

  // Query for organization event counts (completed events only)
  const { data: organizationCounts = {}, error: countsError, isLoading: countsLoading } = useQuery({
    queryKey: ["/api/event-requests/organization-counts"],
    queryFn: () => apiRequest("GET", "/api/event-requests/organization-counts"),
    staleTime: 2 * 60 * 1000 // Cache for 2 minutes
  });

  // Organization counts debug logging (removed for production)

  // Helper function to get user display name
  const getUserDisplayName = (userId: string | null | undefined) => {
    if (!userId) return "Not specified";
    
    // First try to find by user ID
    const user = users.find((u: any) => u.id === userId);
    if (user) {
      return user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.displayName || user.email;
    }
    
    // If not found by ID, check if it's already a display name (plain text)
    // This handles legacy data where names were stored directly
    if (userId.includes('@') || userId.includes('_')) {
      // Looks like a user ID that wasn't found
      return "User not found";
    } else {
      // Assume it's a plain text name (legacy data)
      return userId;
    }
  };

  // Helper function to get organization event count
  const getOrganizationEventCount = (organizationName: string) => {
    const trimmedName = organizationName.trim();
    const count = organizationCounts[trimmedName] || 0;
    
    // Debug logging removed for production
    
    return count;
  };

  // Get current user for fallback when users array is restricted
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
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
    onMutate: async ({ id, ...updatedData }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/event-requests"] });
      
      // Snapshot previous value
      const previousEvents = queryClient.getQueryData(["/api/event-requests"]);
      
      // Optimistically update to new value
      queryClient.setQueryData(["/api/event-requests"], (old: any) => {
        if (!old) return old;
        return old.map((event: any) => 
          event.id === id ? { ...event, ...updatedData } : event
        );
      });
      
      return { previousEvents };
    },
    onSuccess: () => {
      setShowEditDialog(false);
      setSelectedRequest(null);
      toast({ title: "Event request updated successfully" });
    },
    onError: (error: any, variables, context: any) => {
      // Rollback on error
      queryClient.setQueryData(["/api/event-requests"], context?.previousEvents);
      toast({ 
        title: "Error updating event request", 
        description: error.message,
        variant: "destructive" 
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
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
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/event-requests"] });
      const previousEvents = queryClient.getQueryData(["/api/event-requests"]);
      
      // Optimistically update the event status
      queryClient.setQueryData(["/api/event-requests"], (old: any) => {
        if (!old) return old;
        return old.map((event: any) => 
          event.id === data.id ? { ...event, status: 'contact_completed' } : event
        );
      });
      
      return { previousEvents };
    },
    onSuccess: () => {
      setShowCompleteContactDialog(false);
      setCompletingRequest(null);
      toast({ title: "Contact completion recorded successfully" });
    },
    onError: (error: any, variables, context: any) => {
      queryClient.setQueryData(["/api/event-requests"], context?.previousEvents);
      toast({ 
        title: "Error recording contact completion", 
        description: error.message,
        variant: "destructive" 
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
    }
  });

  const completeEventDetailsMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/event-requests/complete-event-details", data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/event-requests"] });
      const previousEvents = queryClient.getQueryData(["/api/event-requests"]);
      
      // Optimistically update the event with new details
      queryClient.setQueryData(["/api/event-requests"], (old: any) => {
        if (!old) return old;
        return old.map((event: any) => 
          event.id === data.eventId ? { 
            ...event, 
            status: 'completed',
            actualEventDate: data.actualEventDate,
            actualAttendeeCount: data.actualAttendeeCount,
            notes: data.notes
          } : event
        );
      });
      
      return { previousEvents };
    },
    onSuccess: () => {
      setShowEventDetailsDialog(false);
      setDetailsRequest(null);
      toast({ title: "Event details saved successfully" });
    },
    onError: (error: any, variables, context: any) => {
      queryClient.setQueryData(["/api/event-requests"], context?.previousEvents);
      toast({ 
        title: "Error saving event details", 
        description: error.message,
        variant: "destructive" 
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
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

  const importHistoricalMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/import/import-historical"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-requests"] });
      toast({ 
        title: "Historical import successful", 
        description: `Successfully imported ${data.imported} historical events from 2024`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error importing historical events", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Filter events by tab
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today for accurate comparison
  
  const requestsEvents = eventRequests.filter((req: EventRequest) => {
    // Include new requests AND any future events not handled by other tabs
    if (!req.desiredEventDate) {
      // No date specified - only include new requests or unknown status
      return req.status === 'new' || !req.status;
    }
    
    // Use the same timezone-safe parsing as formatEventDate function
    let eventDate: Date;
    const dateString = req.desiredEventDate;
    if (dateString && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      const dateOnly = dateString.split(' ')[0];
      eventDate = new Date(dateOnly + 'T12:00:00');
    } else if (dateString && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)) {
      const dateOnly = dateString.split('T')[0];
      eventDate = new Date(dateOnly + 'T12:00:00');
    } else {
      eventDate = new Date(dateString);
    }
    eventDate.setHours(0, 0, 0, 0);
    
    // Show future events that are 'new' OR don't have a recognized status
    if (eventDate >= today) {
      return req.status === 'new' || 
             !req.status || 
             (req.status !== 'contact_completed' && 
              req.status !== 'scheduled' && 
              req.status !== 'completed' && 
              req.status !== 'declined');
    }
    
    // Also show past events with 'new' status so they can be processed
    return req.status === 'new';
  });
  
  const scheduledEvents = eventRequests.filter((req: EventRequest) => {
    if (!req.desiredEventDate) return req.status === 'contact_completed' || req.status === 'scheduled';
    // Use the same timezone-safe parsing as formatEventDate function
    let eventDate: Date;
    const dateString = req.desiredEventDate;
    if (dateString && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      const dateOnly = dateString.split(' ')[0];
      eventDate = new Date(dateOnly + 'T12:00:00');
    } else if (dateString && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)) {
      const dateOnly = dateString.split('T')[0];
      eventDate = new Date(dateOnly + 'T12:00:00');
    } else {
      eventDate = new Date(dateString);
    }
    eventDate.setHours(0, 0, 0, 0);
    return eventDate >= today && (req.status === 'contact_completed' || req.status === 'scheduled');
  });
  
  const pastEvents = eventRequests.filter((req: EventRequest) => {
    // DATE is the primary filter - only show events with past dates
    if (!req.desiredEventDate) {
      // No date specified - only include if status suggests it's truly done
      return req.status === 'completed' || req.status === 'declined';
    }
    
    // Parse the event date using timezone-safe logic
    let eventDate: Date;
    const dateString = req.desiredEventDate;
    if (dateString && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      const dateOnly = dateString.split(' ')[0];
      eventDate = new Date(dateOnly + 'T12:00:00');
    } else if (dateString && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)) {
      const dateOnly = dateString.split('T')[0];
      eventDate = new Date(dateOnly + 'T12:00:00');
    } else {
      eventDate = new Date(dateString);
    }
    eventDate.setHours(0, 0, 0, 0);
    
    // PRIMARY FILTER: Event date must be in the past
    if (eventDate >= today) return false;
    
    // SECONDARY FILTER: Must have a relevant status
    return req.status === 'completed' || req.status === 'contact_completed' || req.status === 'declined';
  });

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
    // If global search is enabled and there's a search term, search all events
    const currentEvents = globalSearch && searchTerm ? eventRequests : getCurrentEvents();
    const filtered = currentEvents.filter((request: EventRequest) => {
      const matchesSearch = !searchTerm || 
        request.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (request.desiredEventDate && typeof request.desiredEventDate === 'string' && request.desiredEventDate.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.desiredEventDate && formatEventDate(request.desiredEventDate).text.toLowerCase().includes(searchTerm.toLowerCase()));
        
      return matchesSearch;
    });

    // Sorting function for safe date parsing
    const getEventDate = (req: EventRequest) => {
      if (!req.desiredEventDate) return new Date(0); // Fallback date for events without dates
      
      const dateString = req.desiredEventDate;
      if (dateString && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        const dateOnly = dateString.split(' ')[0];
        return new Date(dateOnly + 'T12:00:00');
      } else if (dateString && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)) {
        const dateOnly = dateString.split('T')[0];
        return new Date(dateOnly + 'T12:00:00');
      }
      return new Date(dateString);
    };
    
    // Sort requests events
    if (activeTab === 'requests') {
      return filtered.sort((a: any, b: any) => {
        if (requestsSortBy === 'organization') {
          const orgA = a.organizationName.toLowerCase();
          const orgB = b.organizationName.toLowerCase();
          const comparison = orgA.localeCompare(orgB);
          return requestsSortOrder === 'desc' ? -comparison : comparison;
        } else {
          // Sort by date
          const dateA = getEventDate(a);
          const dateB = getEventDate(b);
          return requestsSortOrder === 'desc' 
            ? dateB.getTime() - dateA.getTime()
            : dateA.getTime() - dateB.getTime();
        }
      });
    }
    
    // Sort scheduled events
    if (activeTab === 'scheduled') {
      return filtered.sort((a: any, b: any) => {
        if (scheduledSortBy === 'organization') {
          const orgA = a.organizationName.toLowerCase();
          const orgB = b.organizationName.toLowerCase();
          const comparison = orgA.localeCompare(orgB);
          return scheduledSortOrder === 'desc' ? -comparison : comparison;
        } else {
          // Sort by date
          const dateA = getEventDate(a);
          const dateB = getEventDate(b);
          return scheduledSortOrder === 'desc' 
            ? dateB.getTime() - dateA.getTime()
            : dateA.getTime() - dateB.getTime();
        }
      });
    }
    
    // Sort past events
    if (activeTab === 'past') {
      return filtered.sort((a: any, b: any) => {
        if (pastSortBy === 'organization') {
          const orgA = a.organizationName.toLowerCase();
          const orgB = b.organizationName.toLowerCase();
          const comparison = orgA.localeCompare(orgB);
          return pastEventsSortOrder === 'desc' ? -comparison : comparison;
        } else {
          // Sort by date
          const dateA = getEventDate(a);
          const dateB = getEventDate(b);
          return pastEventsSortOrder === 'desc' 
            ? dateB.getTime() - dateA.getTime()
            : dateA.getTime() - dateB.getTime();
        }
      });
    }
    
    return filtered;
  }, [eventRequests, searchTerm, activeTab, globalSearch, pastEventsSortOrder, requestsSortBy, requestsSortOrder, scheduledSortBy, scheduledSortOrder, pastSortBy]);

  // Paginated past events for display
  const paginatedPastEvents = useMemo(() => {
    if (activeTab !== 'past') return filteredRequests;
    
    const startIndex = (pastEventsPage - 1) * pastEventsPerPage;
    const endIndex = startIndex + pastEventsPerPage;
    return filteredRequests.slice(startIndex, endIndex);
  }, [filteredRequests, activeTab, pastEventsPage, pastEventsPerPage]);

  // Pagination calculations for past events
  const pastEventsPagination = useMemo(() => {
    if (activeTab !== 'past') return { totalPages: 1, currentPage: 1, totalItems: 0 };
    
    const totalItems = filteredRequests.length;
    const totalPages = Math.ceil(totalItems / pastEventsPerPage);
    return {
      totalPages,
      currentPage: pastEventsPage,
      totalItems,
      startItem: totalItems === 0 ? 0 : (pastEventsPage - 1) * pastEventsPerPage + 1,
      endItem: Math.min(pastEventsPage * pastEventsPerPage, totalItems)
    };
  }, [filteredRequests, activeTab, pastEventsPage, pastEventsPerPage]);

  // Status explanations for tooltips
  const statusExplanations = {
    'new': 'A new event request that hasn\'t been contacted yet',
    'contact_completed': 'Initial contact has been made with the organization',
    'scheduled': 'Event is confirmed and scheduled with details finalized',
    'completed': 'Event has been successfully completed',
    'declined': 'Request was declined or event was cancelled',
    'past': 'Past event that is archived'
  };

  const getStatusDisplay = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    const Icon = statusIcons[status as keyof typeof statusIcons];
    const explanation = statusExplanations[status as keyof typeof statusExplanations] || 'Status information';
    
    const badge = (
      <Badge className={status === 'declined' ? "text-white border-2 font-bold shadow-lg" : statusColors[status as keyof typeof statusColors]} style={status === 'declined' ? {background: 'linear-gradient(135deg, #A31C41 0%, #8B1538 100%)', borderColor: '#A31C41'} : {}}>
        <Icon className="w-3 h-3 mr-1" />
        {option?.label || status}
      </Badge>
    );
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{explanation}</p>
        </TooltipContent>
      </Tooltip>
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

  // Permission checking functions
  const canEditEventRequest = () => {
    if (!user) return false;
    return hasPermission(user, PERMISSIONS.MANAGE_EVENT_REQUESTS) || 
           hasPermission(user, PERMISSIONS.MANAGE_USERS) || 
           user.role === 'super_admin';
  };

  const canEditField = (field: string) => {
    if (!user) return false;
    
    // Lightweight fields that volunteers can edit
    const lightweightFields = ['phone', 'email', 'planningNotes'];
    
    // Critical fields that require admin permissions
    const criticalFields = ['eventDate', 'eventStartTime', 'eventEndTime', 'eventAddress', 'estimatedSandwichCount', 'contact', 'hasRefrigeration'];
    
    if (lightweightFields.includes(field)) {
      return hasPermission(user, PERMISSIONS.MANAGE_EVENT_REQUESTS);
    }
    
    if (criticalFields.includes(field)) {
      return hasPermission(user, PERMISSIONS.MANAGE_USERS) || user.role === 'super_admin';
    }
    
    return false;
  };

  // Track pending changes without saving immediately
  const handleTrackChange = (eventId: number, field: string, value: any) => {
    if (!canEditEventRequest()) {
      toast({ title: "Access denied", description: "You don't have permission to edit event requests", variant: "destructive" });
      return;
    }

    setPendingChanges(prev => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        [field]: value
      }
    }));
  };

  // Enhanced autosave with undo functionality
  const handleAutosave = async (eventId: number, field: string, value: any) => {
    const originalValue = eventRequests.find(r => r.id === eventId)?.[field as keyof EventRequest];
    
    try {
      await updateMutation.mutateAsync({
        id: eventId,
        [field]: value
      });

      // Show success toast with undo option
      const undoKey = `${eventId}-${field}`;
      
      // Clear any existing undo timeout for this field
      if (undoTimeouts[undoKey]) {
        clearTimeout(undoTimeouts[undoKey]);
      }

      // Create undo functionality
      const undoTimeout = setTimeout(() => {
        setUndoTimeouts(prev => {
          const newTimeouts = { ...prev };
          delete newTimeouts[undoKey];
          return newTimeouts;
        });
      }, 8000); // 8 seconds to undo

      setUndoTimeouts(prev => ({
        ...prev,
        [undoKey]: undoTimeout
      }));

      toast({
        title: `${field.charAt(0).toUpperCase() + field.slice(1)} updated`,
        description: (
          <div className="flex items-center justify-between">
            <span>Changed to: {value}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                // Undo the change
                await updateMutation.mutateAsync({
                  id: eventId,
                  [field]: originalValue
                });
                clearTimeout(undoTimeout);
                setUndoTimeouts(prev => {
                  const newTimeouts = { ...prev };
                  delete newTimeouts[undoKey];
                  return newTimeouts;
                });
                toast({ title: "Change undone" });
              }}
            >
              Undo
            </Button>
          </div>
        ),
        duration: 8000,
      });

      // Log audit trail
      console.log(`[AUDIT] User ${user?.email} changed ${field} from "${originalValue}" to "${value}" for event ${eventId}`);
      
    } catch (error) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  // Handle inline editing with confirmation
  const handleFieldSave = (eventId: number, field: string, value: any) => {
    handleAutosave(eventId, field, value);
    setEditingField(null);
    setEditingEventId(null);
    setTempValues({});
  };

  // Cancel editing without saving
  const handleFieldCancel = () => {
    setEditingField(null);
    setEditingEventId(null);
    setTempValues({});
  };

  // Check if event has pending changes
  const hasPendingChanges = (eventId: number) => {
    return pendingChanges[eventId] && Object.keys(pendingChanges[eventId]).length > 0;
  };

  // Get display value (pending change or original value)
  const getDisplayValue = (request: EventRequest, field: string) => {
    if (pendingChanges[request.id] && pendingChanges[request.id][field] !== undefined) {
      return pendingChanges[request.id][field];
    }
    return request[field as keyof EventRequest];
  };

  // Save all pending changes for an event
  const handleSaveAllChanges = async (eventId: number) => {
    const changes = pendingChanges[eventId];
    if (!changes) return;

    try {
      await updateMutation.mutateAsync({
        id: eventId,
        ...changes
      });

      // Clear pending changes
      setPendingChanges(prev => {
        const newPending = { ...prev };
        delete newPending[eventId];
        return newPending;
      });

      toast({
        title: "All changes saved",
        description: `Updated ${Object.keys(changes).length} field(s)`,
      });

      // Log audit trail for bulk save
      console.log(`[AUDIT] User ${user?.email} saved bulk changes for event ${eventId}:`, changes);
    } catch (error) {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  // Handle TSP contact assignment
  const handleAssignTspContact = () => {
    if (!assigningContactRequest) return;
    
    const contactData: any = {};
    
    // Assign selected team members to contact fields
    if (selectedTspContacts.length > 0) {
      contactData.tspContact = selectedTspContacts[0] || null;
      contactData.tspContactAssigned = selectedTspContacts[1] || null;
      contactData.additionalContact1 = selectedTspContacts[2] || null;
      contactData.additionalContact2 = selectedTspContacts[3] || null;
    }
    
    // Combine custom contacts into one field
    const nonEmptyCustomContacts = customTspContacts.filter(contact => contact.trim());
    if (nonEmptyCustomContacts.length > 0) {
      contactData.customTspContact = nonEmptyCustomContacts.join('; ');
    }

    updateMutation.mutate({
      id: assigningContactRequest.id,
      ...contactData
    });

    // Reset state
    setShowTspContactDialog(false);
    setAssigningContactRequest(null);
    setSelectedTspContacts([]);
    setCustomTspContacts(['']);

    toast({ title: "TSP contacts assigned successfully" });
  };

  // Function to render enhanced scheduled event cards with inline editing
  const renderScheduledEventCard = (request: EventRequest) => {

    const getDriverStatus = () => {
      const driverIds = (request as any).assignedDriverIds || [];
      const driversNeeded = (request as any).driversNeeded || 0;
      if (driversNeeded === 0) return { badge: 'N/A', color: 'bg-gray-100 text-gray-600' };
      if (driverIds.length >= driversNeeded) return { badge: '✓ Arranged', color: 'bg-green-100 text-green-700' };
      return { badge: '⚠️ Needed', color: 'bg-orange-100 text-orange-700' };
    };

    const getToolkitStatus = () => {
      const status = (request as any).toolkitStatus || 'not_sent';
      switch (status) {
        case 'sent': return { badge: '✓ Delivered', color: 'bg-green-100 text-green-700' };
        case 'received_confirmed': return { badge: '✓ Confirmed', color: 'bg-green-100 text-green-700' };
        case 'not_needed': return { badge: 'N/A', color: 'bg-gray-100 text-gray-600' };
        default: return { badge: '⚠️ Pending', color: 'bg-orange-100 text-orange-700' };
      }
    };

    const getRefrigerationStatus = () => {
      if (request.hasRefrigeration === true) return { badge: '✓ Available', color: 'bg-green-100 text-green-700' };
      if (request.hasRefrigeration === false) return { badge: '❌ None', color: 'bg-red-100 text-red-700' };
      return { badge: '❓ Unknown', color: 'bg-yellow-100 text-yellow-700' };
    };

    return (
      <Card key={request.id} className={`hover:shadow-xl transition-all duration-300 border-l-4 border-l-teal-500 bg-gradient-to-br from-white to-teal-50 ${highlightedEventId === request.id ? 'ring-4 ring-yellow-400 bg-gradient-to-br from-yellow-100 to-orange-100' : ''} ${hasPendingChanges(request.id) ? 'ring-2 ring-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50' : ''}`}>
        {/* Header Row: Bold headline with org name and date */}
        <CardHeader className="pb-3">
          <div className="space-y-3">
            {/* Main headline */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 leading-tight">
                  {request.organizationName}
                </h3>
                {request.department && (
                  <p className="text-gray-600 font-medium text-base mt-1">{request.department}</p>
                )}
                {/* Event Date - Prominent in headline */}
                {request.desiredEventDate && (
                  <div className="flex items-center mt-2 text-lg font-semibold" style={{ color: '#FBAD3F' }}>
                    <Calendar className="w-5 h-5 mr-2" />
                    <span>
                      {(() => {
                        const dateInfo = formatEventDate(request.desiredEventDate);
                        return dateInfo.text;
                      })()} 
                    </span>
                  </div>
                )}
              </div>
              {getStatusDisplay(request.status)}
            </div>
            
            {/* Consolidated Status Bar */}
            <div className="bg-gray-50 p-3 rounded-md border">
              <div className="text-sm text-gray-700 flex items-center flex-wrap gap-1">
                {(() => {
                  const driver = getDriverStatus();
                  const toolkit = getToolkitStatus();
                  const refrigeration = getRefrigerationStatus();
                  
                  return (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">Toolkit: <span className="font-medium">{toolkit.badge.replace(/[✓⚠️]/g, '').trim()}</span></span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">Information packet sent to organization with event planning materials</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-gray-400 mx-1">·</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">Driver: <span className="font-medium">{driver.badge.replace(/[✓⚠️]/g, '').trim()}</span></span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">Volunteer drivers assigned to transport sandwiches to the event</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-gray-400 mx-1">·</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">Refrigeration: <span className="font-medium">{refrigeration.badge.replace(/[✓❌❓]/g, '').trim()}</span></span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">Whether the event location has refrigeration available for sandwich storage</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  );
                })()} 
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Body: Inline editable contact info, address, sandwich count */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact Information - Secondary visual weight */}
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700 text-sm">Contact Information</h4>
                
                {/* Contact Name */}
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-gray-500" />
                  {editingField === 'contact' && editingEventId === request.id ? (
                    <div className="flex space-x-2 flex-1 items-center">
                      <input
                        className="text-sm border rounded px-2 py-1 flex-1"
                        value={tempValues.contact || `${request.firstName} ${request.lastName}`}
                        onChange={(e) => setTempValues(prev => ({ ...prev, contact: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const [firstName, ...lastNameParts] = (tempValues.contact || e.target.value).split(' ');
                            handleTrackChange(request.id, 'firstName', firstName);
                            handleTrackChange(request.id, 'lastName', lastNameParts.join(' '));
                            setEditingField(null);
                            setEditingEventId(null);
                            setTempValues({});
                          }
                          if (e.key === 'Escape') handleFieldCancel();
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          const [firstName, ...lastNameParts] = tempValues.contact.split(' ');
                          handleTrackChange(request.id, 'firstName', firstName);
                          handleTrackChange(request.id, 'lastName', lastNameParts.join(' '));
                          setEditingField(null);
                          setEditingEventId(null);
                          setTempValues({});
                        }}
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={handleFieldCancel}
                      >
                        ✗
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="text-sm text-gray-600 flex-1">
                        {getDisplayValue(request, 'firstName')} {getDisplayValue(request, 'lastName')}
                      </span>
                      {canEditField('contact') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditingField('contact');
                            setEditingEventId(request.id);
                            setTempValues({ contact: `${getDisplayValue(request, 'firstName')} ${getDisplayValue(request, 'lastName')}` });
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Email */}
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  {editingField === 'email' && editingEventId === request.id ? (
                    <div className="flex space-x-2 flex-1 items-center">
                      <input
                        className="text-sm border rounded px-2 py-1 flex-1"
                        value={tempValues.email || request.email}
                        onChange={(e) => setTempValues(prev => ({ ...prev, email: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleTrackChange(request.id, 'email', tempValues.email || e.target.value);
                            setEditingField(null);
                            setEditingEventId(null);
                            setTempValues({});
                          }
                          if (e.key === 'Escape') handleFieldCancel();
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          handleTrackChange(request.id, 'email', tempValues.email);
                          setEditingField(null);
                          setEditingEventId(null);
                          setTempValues({});
                        }}
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={handleFieldCancel}
                      >
                        ✗
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="text-sm text-gray-600 flex-1">
                        {getDisplayValue(request, 'email')}
                      </span>
                      {canEditField('email') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditingField('email');
                            setEditingEventId(request.id);
                            setTempValues({ email: getDisplayValue(request, 'email') });
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Phone */}
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  {editingField === 'phone' && editingEventId === request.id ? (
                    <div className="flex space-x-2 flex-1 items-center">
                      <input
                        className="text-sm border rounded px-2 py-1 flex-1"
                        value={tempValues.phone || request.phone || ''}
                        onChange={(e) => setTempValues(prev => ({ ...prev, phone: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleTrackChange(request.id, 'phone', tempValues.phone || e.target.value);
                            setEditingField(null);
                            setEditingEventId(null);
                            setTempValues({});
                          }
                          if (e.key === 'Escape') handleFieldCancel();
                        }}
                        placeholder="Enter phone number"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          handleTrackChange(request.id, 'phone', tempValues.phone);
                          setEditingField(null);
                          setEditingEventId(null);
                          setTempValues({});
                        }}
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={handleFieldCancel}
                      >
                        ✗
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="text-sm text-gray-500 flex-1">
                        {getDisplayValue(request, 'phone') || 'No phone number'}
                      </span>
                      {canEditField('phone') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditingField('phone');
                            setEditingEventId(request.id);
                            setTempValues({ phone: getDisplayValue(request, 'phone') || '' });
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Event Details - Inline Editable */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800 text-sm">Event Details</h4>
                
                {/* Address */}
                <div className="flex items-center space-x-2">
                  <Building className="w-4 h-4 text-teal-600" />
                  {editingField === 'address' && editingEventId === request.id ? (
                    <div className="flex space-x-2 flex-1 items-center">
                      <input
                        className="text-sm border rounded px-2 py-1 flex-1"
                        value={tempValues.address || request.eventAddress || ''}
                        onChange={(e) => setTempValues(prev => ({ ...prev, address: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleTrackChange(request.id, 'eventAddress', tempValues.address || e.target.value);
                            setEditingField(null);
                            setEditingEventId(null);
                            setTempValues({});
                          }
                          if (e.key === 'Escape') handleFieldCancel();
                        }}
                        placeholder="Enter event address"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          handleTrackChange(request.id, 'eventAddress', tempValues.address);
                          setEditingField(null);
                          setEditingEventId(null);
                          setTempValues({});
                        }}
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={handleFieldCancel}
                      >
                        ✗
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="text-sm flex-1">
                        {getDisplayValue(request, 'eventAddress') || 'No address provided'}
                      </span>
                      {canEditField('eventAddress') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditingField('address');
                            setEditingEventId(request.id);
                            setTempValues({ address: getDisplayValue(request, 'eventAddress') || '' });
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Sandwich Count */}
                <div className="flex items-center space-x-2">
                  <span className="text-teal-600 text-sm">🥪</span>
                  {editingField === 'sandwichCount' && editingEventId === request.id ? (
                    <div className="flex space-x-2 items-center">
                      <input
                        type="number"
                        className="text-sm border rounded px-2 py-1 w-24"
                        value={tempValues.sandwichCount || request.estimatedSandwichCount || ''}
                        onChange={(e) => setTempValues(prev => ({ ...prev, sandwichCount: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleTrackChange(request.id, 'estimatedSandwichCount', parseInt(tempValues.sandwichCount || e.target.value) || null);
                            setEditingField(null);
                            setEditingEventId(null);
                            setTempValues({});
                          }
                          if (e.key === 'Escape') handleFieldCancel();
                        }}
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-500">sandwiches</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          handleTrackChange(request.id, 'estimatedSandwichCount', parseInt(tempValues.sandwichCount) || null);
                          setEditingField(null);
                          setEditingEventId(null);
                          setTempValues({});
                        }}
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={handleFieldCancel}
                      >
                        ✗
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">
                        {getDisplayValue(request, 'estimatedSandwichCount') || 'No count'} sandwiches
                      </span>
                      {canEditField('estimatedSandwichCount') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditingField('sandwichCount');
                            setEditingEventId(request.id);
                            setTempValues({ sandwichCount: getDisplayValue(request, 'estimatedSandwichCount') || '' });
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Refrigeration Status */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Refrigeration:</span>
                  {editingField === 'refrigeration' && editingEventId === request.id ? (
                    <div className="flex space-x-2 items-center">
                      <div className="flex space-x-1">
                        <button
                          className={`px-2 py-1 text-xs rounded ${tempValues.refrigeration === true ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-green-50'}`}
                          onClick={() => setTempValues(prev => ({ ...prev, refrigeration: true }))}
                        >
                          ✓ Available
                        </button>
                        <button
                          className={`px-2 py-1 text-xs rounded ${tempValues.refrigeration === false ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-red-50'}`}
                          onClick={() => setTempValues(prev => ({ ...prev, refrigeration: false }))}
                        >
                          ❌ None
                        </button>
                        <button
                          className={`px-2 py-1 text-xs rounded ${tempValues.refrigeration === null || tempValues.refrigeration === undefined ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600 hover:bg-yellow-50'}`}
                          onClick={() => setTempValues(prev => ({ ...prev, refrigeration: null }))}
                        >
                          ❓ Unknown
                        </button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          handleTrackChange(request.id, 'hasRefrigeration', tempValues.refrigeration);
                          setEditingField(null);
                          setEditingEventId(null);
                          setTempValues({});
                        }}
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={handleFieldCancel}
                      >
                        ✗
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {getDisplayValue(request, 'hasRefrigeration') === true ? '✓ Available' : 
                         getDisplayValue(request, 'hasRefrigeration') === false ? '❌ None' : 
                         '❓ Unknown'}
                      </span>
                      {canEditField('hasRefrigeration') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                          onClick={() => {
                            setEditingField('refrigeration');
                            setEditingEventId(request.id);
                            setTempValues({ refrigeration: getDisplayValue(request, 'hasRefrigeration') });
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Assignments Section */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700 text-sm">Assignments</h4>
              
              {/* Driver Assignment Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Drivers ({(request as any).assignedDriverIds?.length || 0}/{(request as any).driversNeeded || 0})</span>
                  <button 
                    className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200"
                    onClick={() => {
                      // TODO: Add driver assignment functionality
                      toast({ title: "Driver assignment coming soon" });
                    }}
                  >
                    + Assign Driver
                  </button>
                </div>
                {(request as any).assignedDriverIds?.map((driverId: string, index: number) => (
                  <div key={index} className="inline-flex items-center bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-200 mr-1">
                    {getUserDisplayName(driverId)}
                    <button 
                      className="ml-1 hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center"
                      onClick={() => {
                        // TODO: Remove driver assignment
                        toast({ title: "Driver removal coming soon" });
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Speaker Assignment Chips */}
              {(request as any).speakersNeeded > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Speakers (0/{(request as any).speakersNeeded || 0})</span>
                    <button 
                      className="text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 px-2 py-1 rounded border border-purple-200"
                      onClick={() => {
                        // TODO: Add speaker assignment functionality
                        toast({ title: "Speaker assignment coming soon" });
                      }}
                    >
                      + Assign Speaker
                    </button>
                  </div>
                </div>
              )}
              
              {/* TSP Contact Assignment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">TSP Contact</span>
                  <button 
                    className="text-xs bg-teal-50 text-teal-700 hover:bg-teal-100 px-2 py-1 rounded border border-teal-200"
                    onClick={() => {
                      setAssigningContactRequest(request);
                      setShowTspContactDialog(true);
                      // Initialize with current contacts
                      const currentContacts = [
                        (request as any).tspContact,
                        (request as any).tspContactAssigned,
                        (request as any).additionalContact1,
                        (request as any).additionalContact2
                      ].filter(Boolean);
                      setSelectedTspContacts(currentContacts);
                      // Parse custom contacts if they exist
                      const customContacts = (request as any).customTspContact 
                        ? (request as any).customTspContact.split(';').map((c: string) => c.trim()).filter(Boolean)
                        : [];
                      setCustomTspContacts(customContacts.length > 0 ? customContacts : ['']);
                    }}
                  >
                    {(request as any).tspContact || (request as any).tspContactAssigned || (request as any).additionalContact1 || (request as any).additionalContact2 || (request as any).customTspContact ? 'Manage Contacts' : '+ Assign Contact'}
                  </button>
                </div>
                
                {/* Display assigned contacts */}
                <div className="flex flex-wrap gap-1">
                  {(request as any).tspContact && (
                    <div className="inline-flex items-center bg-teal-50 text-teal-700 px-2 py-1 rounded text-xs border border-teal-200">
                      Primary: {getUserDisplayName((request as any).tspContact)}
                    </div>
                  )}
                  {(request as any).tspContactAssigned && (
                    <div className="inline-flex items-center bg-teal-50 text-teal-700 px-2 py-1 rounded text-xs border border-teal-200">
                      Secondary: {getUserDisplayName((request as any).tspContactAssigned)}
                    </div>
                  )}
                  {(request as any).additionalContact1 && (
                    <div className="inline-flex items-center bg-teal-50 text-teal-700 px-2 py-1 rounded text-xs border border-teal-200">
                      Third: {getUserDisplayName((request as any).additionalContact1)}
                    </div>
                  )}
                  {(request as any).additionalContact2 && (
                    <div className="inline-flex items-center bg-teal-50 text-teal-700 px-2 py-1 rounded text-xs border border-teal-200">
                      Fourth: {getUserDisplayName((request as any).additionalContact2)}
                    </div>
                  )}
                  {(request as any).customTspContact && (
                    <div className="inline-flex items-center bg-orange-50 text-orange-700 px-2 py-1 rounded text-xs border border-orange-200">
                      Custom: {(request as any).customTspContact}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
          </div>
        </CardContent>
        
        {/* Footer Actions */}
        <div className="px-6 pb-4">
          <div className="flex justify-between items-center pt-3 border-t">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedRequest(request);
                  setCurrentEditingStatus(request.status);
                  setShowEditDialog(true);
                }}
                className="text-teal-600 hover:text-teal-800 border-teal-200 hover:bg-teal-50"
              >
                <Edit className="h-4 w-4 mr-1" />
                Update Details
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmailComposerRequest(request);
                  setShowEmailComposer(true);
                }}
                className="text-teal-600 hover:text-teal-800 border-teal-200 hover:bg-teal-50"
              >
                <Mail className="h-4 w-4 mr-1" />
                Email Contact
              </Button>
            </div>
            
            {/* Check-in Buttons */}
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="text-orange-600 hover:text-orange-800 border-orange-200 hover:bg-orange-50"
              >
                1 Week Check-in
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-amber-600 hover:text-amber-800 border-amber-200 hover:bg-amber-50"
              >
                1 Day Check-in
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };


  // Function to render standard event cards (for requests and past events)
  const renderStandardEventCard = (request: EventRequest) => (
    <Card key={request.id} className={`hover:shadow-xl transition-all duration-300 border-l-4 border-l-[#236383] bg-gradient-to-br from-white to-orange-50 ${highlightedEventId === request.id ? 'ring-4 ring-yellow-400 bg-gradient-to-br from-yellow-100 to-orange-100' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="flex items-center space-x-3 text-xl mb-3">
              <Building className="w-6 h-6" style={{ color: '#236383' }} />
              <span className="text-gray-900">
                {request.organizationName}
                {request.department && <span className="text-sm text-gray-600 ml-2">- {request.department}</span>}
              </span>
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
                  // Parse timestamp safely to preserve the original time
                  let date: Date;
                  if (request.createdAt.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                    // Database timestamp format: "2025-08-27 06:26:14"
                    // Treat as-is without timezone conversion
                    const [datePart, timePart] = request.createdAt.split(' ');
                    date = new Date(datePart + 'T' + timePart);
                  } else {
                    date = new Date(request.createdAt);
                  }
                  return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                } catch (error) {
                  return 'Invalid date';
                }
              })()}</div>
              {request.status === 'new' && !request.contactCompletedAt && (
                <div className="font-medium" style={{ color: '#FBAD3F' }}>
                  Action needed: {(() => {
                    try {
                      // Parse timestamp safely to preserve the original time
                      let submissionDate: Date;
                      if (request.createdAt.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                        const [datePart, timePart] = request.createdAt.split(' ');
                        submissionDate = new Date(datePart + 'T' + timePart);
                      } else {
                        submissionDate = new Date(request.createdAt);
                      }
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmailComposerRequest(request);
                  setShowEmailComposer(true);
                }}
                className="text-teal-600 hover:text-teal-800 bg-gradient-to-r from-teal-50 to-cyan-100 hover:from-teal-100 hover:to-cyan-200"
              >
                <Mail className="h-4 w-4 mr-1" />
                Email Contact
              </Button>
              
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
          
          {/* Save All Changes Button - only show if there are pending changes */}
          {hasPendingChanges(request.id) && (
            <div className="pt-4 border-t bg-yellow-50 -mx-6 -mb-6 px-6 pb-6 rounded-b-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm text-amber-700 font-medium">
                  ⚠️ You have unsaved changes
                </div>
                <Button
                  onClick={() => handleSaveAllChanges(request.id)}
                  disabled={updateMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  size="sm"
                >
                  {updateMutation.isPending ? "Saving..." : "Save All Changes"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Function to render comprehensive past event cards with all details
  const renderPastEventCard = (request: EventRequest) => (
    <Card key={request.id} className={`hover:shadow-xl transition-all duration-300 border-l-4 border-l-gray-500 bg-gradient-to-br from-white to-gray-50 ${highlightedEventId === request.id ? 'ring-4 ring-yellow-400 bg-gradient-to-br from-yellow-100 to-orange-100' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {/* Organization Name and Event Date */}
            <CardTitle className="flex items-center space-x-3 text-xl mb-2">
              <CheckCircle className="w-6 h-6 text-gray-600" />
              <span className="text-gray-900">
                {request.organizationName}
                {request.department && <span className="text-sm text-gray-600 ml-2">- {request.department}</span>}
              </span>
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
            {/* Edit button for admins */}
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmailComposerRequest(request);
                  setShowEmailComposer(true);
                }}
                className="text-teal-600 hover:text-teal-800 bg-gradient-to-r from-teal-50 to-cyan-100 hover:from-teal-100 hover:to-cyan-200"
              >
                <Mail className="h-4 w-4 mr-1" />
                Email Contact
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedRequest(request);
                  setShowEditDialog(true);
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit Event
              </Button>
            </div>
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
          {((request as any).tspContact || (request as any).customTspContact || (request as any).tspContactAssigned || (request as any).additionalTspContacts || (request as any).additionalContact1 || (request as any).additionalContact2) && (
            <div className="bg-teal-50 p-3 rounded-lg border border-teal-200">
              <h4 className="font-semibold text-teal-800 mb-2 flex items-center">
                <UserCheck className="w-4 h-4 mr-2" />
                TSP Team Assignment
              </h4>
              <div className="space-y-1 text-sm text-teal-700">
                {/* Primary Contact */}
                {(request as any).tspContact && (
                  <div>
                    <strong>Primary Contact:</strong> {getUserDisplayName((request as any).tspContact)}
                  </div>
                )}
                
                {/* Secondary Contact */}
                {(request as any).tspContactAssigned && (
                  <div>
                    <strong>Secondary Contact:</strong> {getUserDisplayName((request as any).tspContactAssigned)}
                  </div>
                )}
                
                {/* Third Contact */}
                {(request as any).additionalContact1 && (
                  <div>
                    <strong>Third Contact:</strong> {getUserDisplayName((request as any).additionalContact1)}
                  </div>
                )}
                
                {/* Fourth Contact */}
                {(request as any).additionalContact2 && (
                  <div>
                    <strong>Fourth Contact:</strong> {getUserDisplayName((request as any).additionalContact2)}
                  </div>
                )}
                
                {/* Legacy Additional Contacts */}
                {(request as any).additionalTspContacts && (
                  <div>
                    <strong>Additional Contacts:</strong> {(request as any).additionalTspContacts}
                  </div>
                )}
                
                {/* Custom TSP Contact */}
                {(request as any).customTspContact && (
                  <div>
                    <strong>Custom Contact:</strong> {(request as any).customTspContact}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Organization Contact Information */}
          <div className="bg-teal-50 p-3 rounded-lg border border-teal-200">
            <h4 className="font-semibold text-teal-800 mb-2 flex items-center">
              <User className="w-4 h-4 mr-2" />
              Organization Contact
            </h4>
            <div className="space-y-1 text-sm text-teal-700">
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
          <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
            <h4 className="font-semibold text-orange-800 mb-2">Event Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-orange-700">
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
              <div><strong>Refrigeration:</strong> {
                request.hasRefrigeration === true ? 'Available' : 
                request.hasRefrigeration === false ? 'Not available' : 
                'Not specified'
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
              {request.message === 'Imported from Excel file' ? 'Imported' : 'Submitted'}: {(() => {
                try {
                  // Parse timestamp safely to preserve the original time
                  let date: Date;
                  if (request.createdAt.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                    // Database timestamp format: "2025-08-27 06:26:14"
                    // Treat as-is without timezone conversion
                    const [datePart, timePart] = request.createdAt.split(' ');
                    date = new Date(datePart + 'T' + timePart);
                  } else {
                    date = new Date(request.createdAt);
                  }
                  return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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
      desiredEventDate: formData.get("desiredEventDate") ? (() => {
        const dateStr = formData.get("desiredEventDate") as string;
        // Timezone-safe date parsing for form data
        return new Date(dateStr + 'T12:00:00');
      })() : null,
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
      desiredEventDate: formData.get("desiredEventDate") ? (() => {
        const dateStr = formData.get("desiredEventDate") as string;
        // Timezone-safe date parsing for form data
        return new Date(dateStr + 'T12:00:00');
      })() : null,
      message: formData.get("message"),
      previouslyHosted: formData.get("previouslyHosted"),
      status: formData.get("status"),
      duplicateNotes: formData.get("duplicateNotes"),
      // Event planning fields
      eventStartTime: formData.get("eventStartTime") || null,
      eventEndTime: formData.get("eventEndTime") || null,
      pickupTime: formData.get("pickupTime") || null,
      sandwichTypes: formData.get("sandwichTypes") || null,
      // Driver and speaker requirements
      driversNeeded: formData.get("driversNeeded") ? parseInt(formData.get("driversNeeded") as string) : 0,
      speakersNeeded: formData.get("speakersNeeded") ? parseInt(formData.get("speakersNeeded") as string) : 0,
      volunteerNotes: formData.get("volunteerNotes") || null,
      additionalRequirements: formData.get("additionalRequirements") || null,
      // TSP Contact fields
      tspContact: formData.get("tspContact") === "none" ? null : formData.get("tspContact") || null,
      tspContactAssigned: formData.get("tspContactAssigned") === "none" ? null : formData.get("tspContactAssigned") || null,
      additionalContact1: formData.get("additionalContact1") === "none" ? null : formData.get("additionalContact1") || null,
      additionalContact2: formData.get("additionalContact2") === "none" ? null : formData.get("additionalContact2") || null,
      customTspContact: formData.get("customTspContact") || null
    };
    editMutation.mutate(data);
  };

  const handleCompleteContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!completingRequest) return;

    const formData = new FormData(e.currentTarget);
    const data = {
      id: completingRequest.id,
      communicationMethod: formData.get("communicationMethod") || null,
      eventAddress: formData.get("eventAddress") || null,
      estimatedSandwichCount: formData.get("estimatedSandwichCount") ? parseInt(formData.get("estimatedSandwichCount") as string) : null,
      hasRefrigeration: formData.get("hasRefrigeration") === "none" ? null : formData.get("hasRefrigeration") === "true",
      status: formData.get("status") || "contact_completed",
      toolkitStatus: formData.get("toolkitStatus") || null,
      eventStartTime: formData.get("eventStartTime") || null,
      eventEndTime: formData.get("eventEndTime") || null,
      pickupTime: formData.get("pickupTime") || null,
      tspContact: formData.get("tspContact") || null,
      customTspContact: formData.get("customTspContact") || null,
      sandwichTypes: formData.get("sandwichTypes") || null,
      driversNeeded: formData.get("driversNeeded") ? parseInt(formData.get("driversNeeded") as string) : 0,
      speakersNeeded: formData.get("speakersNeeded") ? parseInt(formData.get("speakersNeeded") as string) : 0,
      volunteerNotes: formData.get("volunteerNotes") || null,
      planningNotes: formData.get("planningNotes") || null
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
      driversNeeded: formData.get("driversNeeded") ? parseInt(formData.get("driversNeeded") as string) : 0,
      speakersNeeded: formData.get("speakersNeeded") ? parseInt(formData.get("speakersNeeded") as string) : 0,
      volunteerNotes: formData.get("volunteerNotes") || null
    };

    completeEventDetailsMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Event Planning</h1>
        <div className="text-center py-8">
          <p>Loading event requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Event Planning</h1>
        <div className="text-center py-8 text-red-600">
          <p>Error loading event requests: {(error as any)?.message || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
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
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => importHistoricalMutation.mutate()}
            disabled={importHistoricalMutation.isPending}
            title="Import historical 2024 events"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline sm:ml-2">
              {importHistoricalMutation.isPending ? "Importing..." : "Import 2024 Data"}
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
        <TabsList className="w-full h-auto p-1 flex flex-row justify-start overflow-x-auto md:grid md:grid-cols-3">
          <TabsTrigger value="requests" className="relative whitespace-nowrap flex-shrink-0 min-w-fit px-3 py-2">
            Event Requests
            <Badge variant="secondary" className="ml-2">
              {requestsEvents.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="relative whitespace-nowrap flex-shrink-0 min-w-fit px-3 py-2">
            Scheduled Events
            <Badge variant="secondary" className="ml-2">
              {scheduledEvents.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="past" className="relative whitespace-nowrap flex-shrink-0 min-w-fit px-3 py-2">
            Past Events
            <Badge variant="secondary" className="ml-2">
              {pastEvents.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {/* Search Bar */}
          <div className="mb-6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder={globalSearch ? "Search across all events..." : "Search within current tab..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="globalSearch"
                checked={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.checked)}
                className="rounded border-gray-300 focus:ring-teal-500"
              />
              <label htmlFor="globalSearch" className="text-sm text-gray-600 cursor-pointer">
                Search across all events (not just current tab)
              </label>
            </div>
            {globalSearch && searchTerm && (
              <div className="text-sm text-teal-600 bg-teal-50 p-2 rounded">
                Global search active - showing results from all events regardless of tab
              </div>
            )}
          </div>

          {/* Tab Content */}
          <TabsContent value="requests" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                {globalSearch && searchTerm ? (
                  `Showing ${filteredRequests.length} event${filteredRequests.length !== 1 ? 's' : ''} from global search`
                ) : (
                  `Showing ${filteredRequests.length} new event request${filteredRequests.length !== 1 ? 's' : ''} needing contact`
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRequestsSortBy(requestsSortBy === 'date' ? 'organization' : 'date')}
                  className="flex items-center gap-2"
                >
                  {requestsSortBy === 'date' ? (
                    <>
                      <Calendar className="h-4 w-4" />
                      Date
                    </>
                  ) : (
                    <>
                      <Building className="h-4 w-4" />
                      Organization
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRequestsSortOrder(requestsSortOrder === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-2"
                >
                  {requestsSortOrder === 'desc' ? (
                    <>
                      Newest First
                      <ChevronDown className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Oldest First
                      <ChevronUp className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
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
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                {globalSearch && searchTerm ? (
                  `Showing ${filteredRequests.length} event${filteredRequests.length !== 1 ? 's' : ''} from global search`
                ) : (
                  `Showing ${filteredRequests.length} scheduled event${filteredRequests.length !== 1 ? 's' : ''}`
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScheduledSortBy(scheduledSortBy === 'date' ? 'organization' : 'date')}
                  className="flex items-center gap-2"
                >
                  {scheduledSortBy === 'date' ? (
                    <>
                      <Calendar className="h-4 w-4" />
                      Date
                    </>
                  ) : (
                    <>
                      <Building className="h-4 w-4" />
                      Organization
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScheduledSortOrder(scheduledSortOrder === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-2"
                >
                  {scheduledSortOrder === 'desc' ? (
                    <>
                      Newest First
                      <ChevronDown className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Oldest First
                      <ChevronUp className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
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
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                {globalSearch && searchTerm ? (
                  `Showing ${filteredRequests.length} event${filteredRequests.length !== 1 ? 's' : ''} from global search`
                ) : pastEventsPagination.totalItems > 0 ? (
                  <>
                    Showing {pastEventsPagination.startItem}-{pastEventsPagination.endItem} of {pastEventsPagination.totalItems} past event{pastEventsPagination.totalItems !== 1 ? 's' : ''}
                  </>
                ) : (
                  'No past events found'
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPastSortBy(pastSortBy === 'date' ? 'organization' : 'date')}
                  className="flex items-center gap-2"
                >
                  {pastSortBy === 'date' ? (
                    <>
                      <Calendar className="h-4 w-4" />
                      Date
                    </>
                  ) : (
                    <>
                      <Building className="h-4 w-4" />
                      Organization
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPastEventsSortOrder(pastEventsSortOrder === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-2"
                >
                  {pastEventsSortOrder === 'desc' ? (
                    <>
                      Newest First
                      <ChevronDown className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Oldest First
                      <ChevronUp className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {paginatedPastEvents.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">No past events found.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedPastEvents.map((request: EventRequest) => renderPastEventCard(request))}
                </div>
                
                {/* Pagination Controls */}
                {pastEventsPagination.totalPages > 1 && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    {/* Mobile-first design with responsive layout */}
                    <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                      {/* Previous button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPastEventsPage(Math.max(1, pastEventsPage - 1))}
                        disabled={pastEventsPage === 1}
                        className="flex items-center justify-center gap-2 w-full sm:w-auto"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      
                      {/* Page info - responsive layout */}
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-sm text-gray-600 hidden sm:inline">Page</span>
                        
                        {/* Smart pagination - show fewer numbers on mobile */}
                        <div className="flex space-x-1">
                          {(() => {
                            const currentPage = pastEventsPage;
                            const totalPages = pastEventsPagination.totalPages;
                            const isMobile = window.innerWidth < 640; // Tailwind's sm breakpoint
                            const maxVisible = isMobile ? 3 : 5; // Show fewer on mobile
                            
                            if (totalPages <= maxVisible) {
                              // Show all pages if we have few enough
                              return Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                <Button
                                  key={pageNum}
                                  variant={pageNum === currentPage ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setPastEventsPage(pageNum)}
                                  className="w-8 h-8 p-0 text-xs"
                                >
                                  {pageNum}
                                </Button>
                              ));
                            } else {
                              // Smart truncation for many pages
                              const pages = [];
                              const showEllipsis = totalPages > maxVisible;
                              
                              if (currentPage <= 3) {
                                // Near beginning
                                for (let i = 1; i <= Math.min(maxVisible - 1, totalPages); i++) {
                                  pages.push(
                                    <Button
                                      key={i}
                                      variant={i === currentPage ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setPastEventsPage(i)}
                                      className="w-8 h-8 p-0 text-xs"
                                    >
                                      {i}
                                    </Button>
                                  );
                                }
                                if (showEllipsis && totalPages > maxVisible) {
                                  pages.push(<span key="ellipsis1" className="text-gray-400 text-xs">...</span>);
                                  pages.push(
                                    <Button
                                      key={totalPages}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setPastEventsPage(totalPages)}
                                      className="w-8 h-8 p-0 text-xs"
                                    >
                                      {totalPages}
                                    </Button>
                                  );
                                }
                              } else if (currentPage >= totalPages - 2) {
                                // Near end
                                pages.push(
                                  <Button
                                    key={1}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPastEventsPage(1)}
                                    className="w-8 h-8 p-0 text-xs"
                                  >
                                    1
                                  </Button>
                                );
                                if (showEllipsis) {
                                  pages.push(<span key="ellipsis2" className="text-gray-400 text-xs">...</span>);
                                }
                                for (let i = Math.max(totalPages - maxVisible + 2, 2); i <= totalPages; i++) {
                                  pages.push(
                                    <Button
                                      key={i}
                                      variant={i === currentPage ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setPastEventsPage(i)}
                                      className="w-8 h-8 p-0 text-xs"
                                    >
                                      {i}
                                    </Button>
                                  );
                                }
                              } else {
                                // In middle
                                pages.push(
                                  <Button
                                    key={1}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPastEventsPage(1)}
                                    className="w-8 h-8 p-0 text-xs"
                                  >
                                    1
                                  </Button>
                                );
                                if (currentPage > 3) {
                                  pages.push(<span key="ellipsis3" className="text-gray-400 text-xs">...</span>);
                                }
                                
                                const start = Math.max(2, currentPage - 1);
                                const end = Math.min(totalPages - 1, currentPage + 1);
                                for (let i = start; i <= end; i++) {
                                  pages.push(
                                    <Button
                                      key={i}
                                      variant={i === currentPage ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setPastEventsPage(i)}
                                      className="w-8 h-8 p-0 text-xs"
                                    >
                                      {i}
                                    </Button>
                                  );
                                }
                                
                                if (currentPage < totalPages - 2) {
                                  pages.push(<span key="ellipsis4" className="text-gray-400 text-xs">...</span>);
                                }
                                pages.push(
                                  <Button
                                    key={totalPages}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPastEventsPage(totalPages)}
                                    className="w-8 h-8 p-0 text-xs"
                                  >
                                    {totalPages}
                                  </Button>
                                );
                              }
                              return pages;
                            }
                          })()}
                        </div>
                        
                        <span className="text-sm text-gray-600">
                          <span className="hidden sm:inline">of {pastEventsPagination.totalPages}</span>
                          <span className="sm:hidden">{pastEventsPage}/{pastEventsPagination.totalPages}</span>
                        </span>
                      </div>
                      
                      {/* Next button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPastEventsPage(Math.min(pastEventsPagination.totalPages, pastEventsPage + 1))}
                        disabled={pastEventsPage === pastEventsPagination.totalPages}
                        className="flex items-center justify-center gap-2 w-full sm:w-auto"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
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
                  <select 
                    name="previouslyHosted" 
                    defaultValue={selectedRequest.previouslyHosted}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {previouslyHostedOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <select 
                  name="status" 
                  defaultValue={currentEditingStatus}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="eventAddress">Event Address</Label>
                <Input name="eventAddress" defaultValue={(selectedRequest as any).eventAddress || ""} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="estimatedSandwichCount">Number of Sandwiches</Label>
                  <Input 
                    name="estimatedSandwichCount" 
                    type="number" 
                    defaultValue={selectedRequest.estimatedSandwichCount || ""} 
                  />
                </div>
                <div>
                  <Label htmlFor="hasRefrigeration">Refrigeration Available?</Label>
                  <select 
                    name="hasRefrigeration" 
                    defaultValue={selectedRequest.hasRefrigeration?.toString() || ""}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select option</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="eventStartTime">Event Start Time</Label>
                  <Input 
                    name="eventStartTime" 
                    type="time" 
                    defaultValue={(selectedRequest as any).eventStartTime || ""} 
                  />
                </div>
                <div>
                  <Label htmlFor="eventEndTime">Event End Time</Label>
                  <Input 
                    name="eventEndTime" 
                    type="time" 
                    defaultValue={(selectedRequest as any).eventEndTime || ""} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pickupTime">Pickup Time</Label>
                  <Input 
                    name="pickupTime" 
                    type="time" 
                    defaultValue={(selectedRequest as any).pickupTime || ""} 
                  />
                </div>
                <div>
                  <Label htmlFor="sandwichTypes">Sandwich Types</Label>
                  <Input name="sandwichTypes" defaultValue={(selectedRequest as any).sandwichTypes || ""} />
                </div>
              </div>
              {/* Drivers Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Drivers</h3>
                <div>
                  <Label htmlFor="driversNeeded">How Many Drivers Needed?</Label>
                  <Input 
                    name="driversNeeded" 
                    type="number"
                    min="0"
                    defaultValue={(selectedRequest as any).driversNeeded || 0}
                    placeholder="Number of drivers needed"
                  />
                </div>
              </div>

              {/* Speakers Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Speakers</h3>
                <div>
                  <Label htmlFor="speakersNeeded">How Many Speakers Needed?</Label>
                  <Input 
                    name="speakersNeeded" 
                    type="number"
                    min="0"
                    defaultValue={(selectedRequest as any).speakersNeeded || 0}
                    placeholder="Number of speakers needed"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="additionalRequirements">Special Requirements</Label>
                <Textarea name="additionalRequirements" rows={2} defaultValue={(selectedRequest as any).additionalRequirements || ""} />
              </div>
              
              {/* TSP Contact Assignment */}
              <div>
                <Label className="text-base font-semibold">TSP Contact Assignments</Label>
                <p className="text-sm text-gray-600 mb-3">Assign one or more TSP team members to this event. Selected users will see this event in their "My Actions" page.</p>
                
                {/* Primary TSP Contact */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="tspContact">Primary TSP Contact</Label>
                    <select 
                      name="tspContact" 
                      defaultValue={(selectedRequest as any).tspContact || "none"}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="none">No primary contact</option>
                      {users.filter((user: any) => user.role !== 'recipient').map((user: any) => (
                        <option key={user.id} value={user.id}>
                          {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="tspContactAssigned">Secondary Contact</Label>
                    <select 
                      name="tspContactAssigned" 
                      defaultValue={(selectedRequest as any).tspContactAssigned || "none"}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="none">No secondary contact</option>
                      {users.filter((user: any) => user.role !== 'recipient').map((user: any) => (
                        <option key={user.id} value={user.id}>
                          {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Additional TSP Contacts */}
                <div className="space-y-3">
                  <Label htmlFor="additionalTspContacts">Additional TSP Contacts</Label>
                  <p className="text-xs text-gray-500">Select additional team members for this event</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="additionalContact1">Third Contact</Label>
                      <select 
                        name="additionalContact1" 
                        defaultValue={(selectedRequest as any).additionalContact1 || "none"}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="none">No third contact</option>
                        {users.filter((user: any) => user.role !== 'recipient').map((user: any) => (
                          <option key={user.id} value={user.id}>
                            {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="additionalContact2">Fourth Contact</Label>
                      <select 
                        name="additionalContact2" 
                        defaultValue={(selectedRequest as any).additionalContact2 || "none"}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="none">No fourth contact</option>
                        {users.filter((user: any) => user.role !== 'recipient').map((user: any) => (
                          <option key={user.id} value={user.id}>
                            {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Custom Contact Info */}
                <div className="mt-4">
                  <Label htmlFor="customTspContact">Custom Contact Information</Label>
                  <p className="text-xs text-gray-500">Enter external contact details or special instructions</p>
                  <Input 
                    name="customTspContact" 
                    placeholder="External contact name or special instructions"
                    defaultValue={(selectedRequest as any).customTspContact || ""} 
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="message">Event Details</Label>
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
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Complete Contact & Event Details</DialogTitle>
              <DialogDescription>
                Record contact details and comprehensive event planning information for {completingRequest.organizationName}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCompleteContact} className="space-y-6">
              {/* Communication Method */}
              <div>
                <Label htmlFor="communicationMethod">Communication Method</Label>
                <Select name="communicationMethod" defaultValue="">
                  <SelectTrigger>
                    <SelectValue placeholder="How did you contact them? (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_specified">Not specified</SelectItem>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="in_person">In Person</SelectItem>
                    <SelectItem value="text">Text Message</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Basic Event Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="eventAddress">Event Location/Address (optional)</Label>
                  <Input name="eventAddress" placeholder="Where will the event take place?" />
                </div>
                <div>
                  <Label htmlFor="estimatedSandwichCount">Estimated Sandwich Count (optional)</Label>
                  <Input name="estimatedSandwichCount" type="number" min="0" placeholder="How many sandwiches needed?" />
                </div>
              </div>

              {/* Event Status and Toolkit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Event Status (optional)</Label>
                  <Select name="status" defaultValue="contact_completed">
                    <SelectTrigger>
                      <SelectValue placeholder="Set event status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contact_completed">Contact Completed</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="toolkitStatus">Toolkit Status (optional)</Label>
                  <Select name="toolkitStatus" defaultValue="">
                    <SelectTrigger>
                      <SelectValue placeholder="Select toolkit status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_set">Not Set</SelectItem>
                      <SelectItem value="not_sent">Not Yet Sent</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="received_confirmed">Received & Confirmed</SelectItem>
                      <SelectItem value="not_needed">Not Needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Event Times */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="eventStartTime">Event Start Time (optional)</Label>
                  <Input name="eventStartTime" type="time" />
                </div>
                <div>
                  <Label htmlFor="eventEndTime">Event End Time (optional)</Label>
                  <Input name="eventEndTime" type="time" />
                </div>
                <div>
                  <Label htmlFor="pickupTime">Pickup Time (optional)</Label>
                  <Input name="pickupTime" type="time" />
                </div>
              </div>

              {/* Food Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sandwichTypes">Sandwich Types/Preferences (optional)</Label>
                  <Input name="sandwichTypes" placeholder="Any specific sandwich preferences?" />
                </div>
                <div>
                  <Label htmlFor="hasRefrigeration">Refrigeration Available? (optional)</Label>
                  <Select name="hasRefrigeration" defaultValue="none">
                    <SelectTrigger>
                      <SelectValue placeholder="Is refrigeration available?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unknown</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* TSP Contact Assignment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tspContact">TSP Team Contact (optional)</Label>
                  <Select name="tspContact" defaultValue="">
                    <SelectTrigger>
                      <SelectValue placeholder="Assign team member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_assignment">No assignment</SelectItem>
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
                <div>
                  <Label htmlFor="customTspContact">Custom Contact (optional)</Label>
                  <Input name="customTspContact" placeholder="External contact name or special instructions" />
                </div>
              </div>

              {/* Drivers and Speakers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="driversNeeded">Drivers Needed (optional)</Label>
                  <Input 
                    name="driversNeeded" 
                    type="number"
                    min="0"
                    defaultValue="0"
                    placeholder="Number of drivers needed"
                  />
                </div>
                <div>
                  <Label htmlFor="speakersNeeded">Speakers Needed (optional)</Label>
                  <Input 
                    name="speakersNeeded" 
                    type="number"
                    min="0"
                    defaultValue="0"
                    placeholder="Number of speakers needed"
                  />
                </div>
              </div>

              {/* Additional Details */}
              <div>
                <Label htmlFor="driverDetails">Driver Details/Notes (optional)</Label>
                <Textarea name="driverDetails" rows={2} placeholder="Driver arrangements, pickup instructions, or notes" />
              </div>

              <div>
                <Label htmlFor="speakerDetails">Speaker Details/Notes (optional)</Label>
                <Textarea name="speakerDetails" rows={2} placeholder="Speaker requirements or details" />
              </div>

              <div>
                <Label htmlFor="sandwichTypes">Sandwich Types (optional)</Label>
                <Select name="sandwichTypes" defaultValue="">
                  <SelectTrigger>
                    <SelectValue placeholder="Select sandwich types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_specified">Not specified</SelectItem>
                    <SelectItem value="deli">Deli</SelectItem>
                    <SelectItem value="turkey">Turkey</SelectItem>
                    <SelectItem value="ham">Ham</SelectItem>
                    <SelectItem value="pbj">PB&J</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="planningNotes">Additional Planning Notes (optional)</Label>
                <Textarea name="planningNotes" rows={3} placeholder="Any additional planning notes or requirements" />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowCompleteContactDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={completeContactMutation.isPending}>
                  {completeContactMutation.isPending ? "Saving..." : "Complete Contact & Event Details"}
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
                  <select 
                    name="toolkitStatus" 
                    defaultValue={detailsRequest.toolkitStatus || ""}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select toolkit status</option>
                    <option value="not_sent">Not Yet Sent</option>
                    <option value="sent">Sent</option>
                    <option value="received_confirmed">Received & Confirmed</option>
                    <option value="not_needed">Not Needed</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="tspContact">TSP Team Contact</Label>
                  <select 
                    name="tspContact" 
                    defaultValue={detailsRequest.tspContact || ""}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select team member</option>
                    <option value="none">No assignment</option>
                    {users.map((user: any) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}` 
                          : user.displayName || user.email}
                      </option>
                    ))}
                  </select>
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
                <select 
                  name="sandwichTypes" 
                  defaultValue={(detailsRequest as any).sandwichTypes || ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select sandwich types</option>
                  <option value="deli">Deli</option>
                  <option value="turkey">Turkey</option>
                  <option value="ham">Ham</option>
                  <option value="pb&j">PB&J</option>
                  <option value="pb&j+deli">PB&J + Deli</option>
                </select>
              </div>

              {/* Drivers Section - Enhanced with Database Integration */}
              <DriverSelection
                eventId={detailsRequest.id}
                currentDrivers={(detailsRequest as any).assignedDriverIds || []}
                currentDriverDetails={(detailsRequest as any).driverDetails}
                currentDriversArranged={(detailsRequest as any).driversArranged}
                currentDriverPickupTime={(detailsRequest as any).driverPickupTime}
                currentDriverNotes={(detailsRequest as any).driverNotes}
                onDriversUpdate={() => {
                  // Refresh the event requests data to show updated information
                  queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
                }}
              />

              {/* Speakers Section */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="speakersNeeded">How Many Speakers Needed?</Label>
                  <Input 
                    name="speakersNeeded" 
                    type="number"
                    min="0"
                    defaultValue={(detailsRequest as any).speakersNeeded || 0}
                    placeholder="Number of speakers needed"
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

              {/* Volunteer Signup Section */}
              <div className="border-t pt-6">
                <EventVolunteerSignup 
                  eventId={detailsRequest.id}
                  eventTitle={detailsRequest.organizationName}
                  driversNeeded={(detailsRequest as any).driversNeeded || 0}
                  speakersNeeded={(detailsRequest as any).speakersNeeded || 0}
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

      {/* TSP Contact Assignment Dialog */}
      {showTspContactDialog && assigningContactRequest && (
        <Dialog open={showTspContactDialog} onOpenChange={setShowTspContactDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign TSP Contacts</DialogTitle>
              <p className="text-sm text-gray-600">
                Assign team members and add custom contact information for {assigningContactRequest.organizationName}
              </p>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Team Member Selection */}
              <div>
                <Label className="text-base font-medium">Team Members (up to 4)</Label>
                <p className="text-xs text-gray-500 mb-3">Select team members to assign as contacts for this event</p>
                
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <span className="text-sm font-medium min-w-0 w-20">
                        {index === 0 ? 'Primary:' : index === 1 ? 'Secondary:' : index === 2 ? 'Third:' : 'Fourth:'}
                      </span>
                      <select
                        value={selectedTspContacts[index] || ''}
                        onChange={(e) => {
                          const newContacts = [...selectedTspContacts];
                          if (e.target.value === '') {
                            newContacts.splice(index, 1);
                          } else {
                            newContacts[index] = e.target.value;
                          }
                          setSelectedTspContacts(newContacts);
                        }}
                        className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Select team member</option>
                        {users?.map((user: any) => (
                          <option key={user.id} value={user.id}>
                            {user.firstName && user.lastName 
                              ? `${user.firstName} ${user.lastName}` 
                              : user.displayName || user.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Contact Information */}
              <div>
                <Label className="text-base font-medium">Custom Contact Information</Label>
                <p className="text-xs text-gray-500 mb-3">Add external contacts or special instructions</p>
                
                <div className="space-y-2">
                  {customTspContacts.map((contact, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={contact}
                        onChange={(e) => {
                          const newContacts = [...customTspContacts];
                          newContacts[index] = e.target.value;
                          setCustomTspContacts(newContacts);
                        }}
                        placeholder="Enter contact name, phone, or instructions"
                        className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      {customTspContacts.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newContacts = customTspContacts.filter((_, i) => i !== index);
                            setCustomTspContacts(newContacts);
                          }}
                          className="h-10 w-10 p-0"
                        >
                          ✗
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomTspContacts([...customTspContacts, ''])}
                    className="mt-2"
                  >
                    + Add Another Contact
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowTspContactDialog(false);
                  setAssigningContactRequest(null);
                  setSelectedTspContacts([]);
                  setCustomTspContacts(['']);
                }}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={handleAssignTspContact}
                disabled={updateMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {updateMutation.isPending ? "Assigning..." : "Assign Contacts"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Email Composer Dialog */}
      {showEmailComposer && emailComposerRequest && (
        <EventEmailComposer
          eventRequest={emailComposerRequest}
          isOpen={showEmailComposer}
          onClose={() => {
            setShowEmailComposer(false);
            setEmailComposerRequest(null);
          }}
        />
      )}
      </div>
    </TooltipProvider>
  );
}