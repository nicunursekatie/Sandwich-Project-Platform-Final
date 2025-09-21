import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EventRequest } from '@shared/schema';

interface EventRequestContextType {
  // Event requests data
  eventRequests: EventRequest[];
  isLoading: boolean;

  // View state
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  sortBy: 'event_date_desc' | 'event_date_asc' | 'organization_asc' | 'organization_desc' | 'created_date_desc' | 'created_date_asc';
  setSortBy: (sort: any) => void;

  // Pagination
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (items: number) => void;

  // Selected event and editing
  selectedEventRequest: EventRequest | null;
  setSelectedEventRequest: (event: EventRequest | null) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;

  // Dialog visibility states
  showEventDetails: boolean;
  setShowEventDetails: (show: boolean) => void;
  showSchedulingDialog: boolean;
  setShowSchedulingDialog: (show: boolean) => void;
  showToolkitSentDialog: boolean;
  setShowToolkitSentDialog: (show: boolean) => void;
  showScheduleCallDialog: boolean;
  setShowScheduleCallDialog: (show: boolean) => void;
  showOneDayFollowUpDialog: boolean;
  setShowOneDayFollowUpDialog: (show: boolean) => void;
  showOneMonthFollowUpDialog: boolean;
  setShowOneMonthFollowUpDialog: (show: boolean) => void;
  showContactOrganizerDialog: boolean;
  setShowContactOrganizerDialog: (show: boolean) => void;
  showCollectionLog: boolean;
  setShowCollectionLog: (show: boolean) => void;
  showAssignmentDialog: boolean;
  setShowAssignmentDialog: (show: boolean) => void;
  showTspContactAssignmentDialog: boolean;
  setShowTspContactAssignmentDialog: (show: boolean) => void;
  showSandwichPlanningModal: boolean;
  setShowSandwichPlanningModal: (show: boolean) => void;
  showStaffingPlanningModal: boolean;
  setShowStaffingPlanningModal: (show: boolean) => void;

  // Event being acted upon
  schedulingEventRequest: EventRequest | null;
  setSchedulingEventRequest: (event: EventRequest | null) => void;
  toolkitEventRequest: EventRequest | null;
  setToolkitEventRequest: (event: EventRequest | null) => void;
  collectionLogEventRequest: EventRequest | null;
  setCollectionLogEventRequest: (event: EventRequest | null) => void;
  contactEventRequest: EventRequest | null;
  setContactEventRequest: (event: EventRequest | null) => void;
  tspContactEventRequest: EventRequest | null;
  setTspContactEventRequest: (event: EventRequest | null) => void;

  // Assignment state
  assignmentType: 'driver' | 'speaker' | 'volunteer' | null;
  setAssignmentType: (type: 'driver' | 'speaker' | 'volunteer' | null) => void;
  assignmentEventId: number | null;
  setAssignmentEventId: (id: number | null) => void;
  selectedAssignees: string[];
  setSelectedAssignees: (assignees: string[]) => void;
  isEditingAssignment: boolean;
  setIsEditingAssignment: (editing: boolean) => void;
  editingAssignmentPersonId: string | null;
  setEditingAssignmentPersonId: (id: string | null) => void;

  // Schedule call state
  scheduleCallDate: string;
  setScheduleCallDate: (date: string) => void;
  scheduleCallTime: string;
  setScheduleCallTime: (time: string) => void;

  // Follow-up notes
  followUpNotes: string;
  setFollowUpNotes: (notes: string) => void;

  // Inline editing state for scheduled events
  editingScheduledId: number | null;
  setEditingScheduledId: (id: number | null) => void;
  editingField: string | null;
  setEditingField: (field: string | null) => void;
  editingValue: string;
  setEditingValue: (value: string) => void;

  // Inline sandwich editing states
  inlineSandwichMode: 'total' | 'types';
  setInlineSandwichMode: (mode: 'total' | 'types') => void;
  inlineTotalCount: number;
  setInlineTotalCount: (count: number) => void;
  inlineSandwichTypes: Array<{type: string, quantity: number}>;
  setInlineSandwichTypes: (types: Array<{type: string, quantity: number}>) => void;

  // Modal sandwich editing states
  modalSandwichMode: 'total' | 'types';
  setModalSandwichMode: (mode: 'total' | 'types') => void;
  modalTotalCount: number;
  setModalTotalCount: (count: number) => void;
  modalSandwichTypes: Array<{type: string, quantity: number}>;
  setModalSandwichTypes: (types: Array<{type: string, quantity: number}>) => void;

  // Completed event inline editing
  editingCompletedId: number | null;
  setEditingCompletedId: (id: number | null) => void;
  completedEdit: any;
  setCompletedEdit: (edit: any) => void;

  // Custom person data for assignment
  customPersonData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    vanCapable: boolean;
  };
  setCustomPersonData: (data: any) => void;

  // Computed data
  requestsByStatus: Record<string, EventRequest[]>;
  statusCounts: {
    new: number;
    in_process: number;
    scheduled: number;
    completed: number;
    declined: number;
  };
}

const EventRequestContext = createContext<EventRequestContextType | null>(null);

export const useEventRequestContext = () => {
  const context = useContext(EventRequestContext);
  if (!context) {
    throw new Error('useEventRequestContext must be used within EventRequestProvider');
  }
  return context;
};

interface EventRequestProviderProps {
  children: ReactNode;
  initialTab?: string | null;
  initialEventId?: number;
}

export const EventRequestProvider: React.FC<EventRequestProviderProps> = ({
  children,
  initialTab,
  initialEventId
}) => {
  // Fetch event requests using the same query pattern
  const { data: eventRequests = [], isLoading } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests'],
  });

  // View state
  const [activeTab, setActiveTab] = useState(initialTab || 'new');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'event_date_desc' | 'event_date_asc' | 'organization_asc' | 'organization_desc' | 'created_date_desc' | 'created_date_asc'>('event_date_desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Selected event and editing
  const [selectedEventRequest, setSelectedEventRequest] = useState<EventRequest | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Dialog visibility states
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showSchedulingDialog, setShowSchedulingDialog] = useState(false);
  const [showToolkitSentDialog, setShowToolkitSentDialog] = useState(false);
  const [showScheduleCallDialog, setShowScheduleCallDialog] = useState(false);
  const [showOneDayFollowUpDialog, setShowOneDayFollowUpDialog] = useState(false);
  const [showOneMonthFollowUpDialog, setShowOneMonthFollowUpDialog] = useState(false);
  const [showContactOrganizerDialog, setShowContactOrganizerDialog] = useState(false);
  const [showCollectionLog, setShowCollectionLog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showTspContactAssignmentDialog, setShowTspContactAssignmentDialog] = useState(false);
  const [showSandwichPlanningModal, setShowSandwichPlanningModal] = useState(false);
  const [showStaffingPlanningModal, setShowStaffingPlanningModal] = useState(false);

  // Event being acted upon
  const [schedulingEventRequest, setSchedulingEventRequest] = useState<EventRequest | null>(null);
  const [toolkitEventRequest, setToolkitEventRequest] = useState<EventRequest | null>(null);
  const [collectionLogEventRequest, setCollectionLogEventRequest] = useState<EventRequest | null>(null);
  const [contactEventRequest, setContactEventRequest] = useState<EventRequest | null>(null);
  const [tspContactEventRequest, setTspContactEventRequest] = useState<EventRequest | null>(null);

  // Assignment state
  const [assignmentType, setAssignmentType] = useState<'driver' | 'speaker' | 'volunteer' | null>(null);
  const [assignmentEventId, setAssignmentEventId] = useState<number | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [editingAssignmentPersonId, setEditingAssignmentPersonId] = useState<string | null>(null);

  // Schedule call state
  const [scheduleCallDate, setScheduleCallDate] = useState('');
  const [scheduleCallTime, setScheduleCallTime] = useState('');

  // Follow-up notes
  const [followUpNotes, setFollowUpNotes] = useState('');

  // Inline editing state
  const [editingScheduledId, setEditingScheduledId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // Inline sandwich editing
  const [inlineSandwichMode, setInlineSandwichMode] = useState<'total' | 'types'>('total');
  const [inlineTotalCount, setInlineTotalCount] = useState(0);
  const [inlineSandwichTypes, setInlineSandwichTypes] = useState<Array<{type: string, quantity: number}>>([]);

  // Modal sandwich editing
  const [modalSandwichMode, setModalSandwichMode] = useState<'total' | 'types'>('total');
  const [modalTotalCount, setModalTotalCount] = useState(0);
  const [modalSandwichTypes, setModalSandwichTypes] = useState<Array<{type: string, quantity: number}>>([]);

  // Completed event editing
  const [editingCompletedId, setEditingCompletedId] = useState<number | null>(null);
  const [completedEdit, setCompletedEdit] = useState<any>({});

  // Custom person data
  const [customPersonData, setCustomPersonData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    vanCapable: false,
  });

  // Group requests by status
  const requestsByStatus = React.useMemo(() => {
    const groups = eventRequests.reduce((acc: any, request: EventRequest) => {
      if (!acc[request.status]) {
        acc[request.status] = [];
      }
      acc[request.status].push(request);
      return acc;
    }, {});

    // Sort each group by newest first
    Object.keys(groups).forEach((status) => {
      groups[status].sort(
        (a: EventRequest, b: EventRequest) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return groups;
  }, [eventRequests]);

  // Calculate status counts
  const statusCounts = {
    new: requestsByStatus.new?.length || 0,
    in_process: requestsByStatus.in_process?.length || 0,
    scheduled: requestsByStatus.scheduled?.length || 0,
    completed: requestsByStatus.completed?.length || 0,
    declined: requestsByStatus.declined?.length || 0,
  };

  // Synchronize statusFilter with activeTab
  useEffect(() => {
    setStatusFilter(activeTab);
  }, [activeTab]);

  // Auto-sort by appropriate default for each tab
  useEffect(() => {
    if (activeTab === 'new' && sortBy !== 'created_date_desc') {
      setSortBy('created_date_desc');
    } else if ((activeTab === 'scheduled' || activeTab === 'in_process') && sortBy !== 'event_date_asc') {
      setSortBy('event_date_asc');
    } else if (activeTab === 'completed' && sortBy !== 'event_date_desc') {
      setSortBy('event_date_desc');
    }
  }, [activeTab, sortBy]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortBy]);

  // Handle initial event ID - auto-open event details if specified
  useEffect(() => {
    if (initialTab && ['new', 'in_process', 'scheduled', 'completed', 'declined'].includes(initialTab)) {
      setActiveTab(initialTab);
    }

    if (initialEventId && eventRequests.length > 0) {
      const targetEvent = eventRequests.find(req => req.id === initialEventId);
      if (targetEvent) {
        setSelectedEventRequest(targetEvent);
        setShowEventDetails(true);
        setIsEditing(false);

        if (!initialTab) {
          if (targetEvent.status === 'completed') {
            setActiveTab('completed');
          } else if (targetEvent.status === 'scheduled') {
            setActiveTab('scheduled');
          } else if (targetEvent.status === 'in_process') {
            setActiveTab('in_process');
          } else if (targetEvent.status === 'declined') {
            setActiveTab('declined');
          } else {
            setActiveTab('new');
          }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [initialTab, initialEventId, eventRequests]);

  const value: EventRequestContextType = {
    // Data
    eventRequests,
    isLoading,
    requestsByStatus,
    statusCounts,

    // View state
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,

    // Pagination
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,

    // Selected event
    selectedEventRequest,
    setSelectedEventRequest,
    isEditing,
    setIsEditing,

    // Dialog states
    showEventDetails,
    setShowEventDetails,
    showSchedulingDialog,
    setShowSchedulingDialog,
    showToolkitSentDialog,
    setShowToolkitSentDialog,
    showScheduleCallDialog,
    setShowScheduleCallDialog,
    showOneDayFollowUpDialog,
    setShowOneDayFollowUpDialog,
    showOneMonthFollowUpDialog,
    setShowOneMonthFollowUpDialog,
    showContactOrganizerDialog,
    setShowContactOrganizerDialog,
    showCollectionLog,
    setShowCollectionLog,
    showAssignmentDialog,
    setShowAssignmentDialog,
    showTspContactAssignmentDialog,
    setShowTspContactAssignmentDialog,
    showSandwichPlanningModal,
    setShowSandwichPlanningModal,
    showStaffingPlanningModal,
    setShowStaffingPlanningModal,

    // Event references
    schedulingEventRequest,
    setSchedulingEventRequest,
    toolkitEventRequest,
    setToolkitEventRequest,
    collectionLogEventRequest,
    setCollectionLogEventRequest,
    contactEventRequest,
    setContactEventRequest,
    tspContactEventRequest,
    setTspContactEventRequest,

    // Assignment
    assignmentType,
    setAssignmentType,
    assignmentEventId,
    setAssignmentEventId,
    selectedAssignees,
    setSelectedAssignees,
    isEditingAssignment,
    setIsEditingAssignment,
    editingAssignmentPersonId,
    setEditingAssignmentPersonId,

    // Schedule call
    scheduleCallDate,
    setScheduleCallDate,
    scheduleCallTime,
    setScheduleCallTime,

    // Follow-up
    followUpNotes,
    setFollowUpNotes,

    // Inline editing
    editingScheduledId,
    setEditingScheduledId,
    editingField,
    setEditingField,
    editingValue,
    setEditingValue,

    // Sandwich editing
    inlineSandwichMode,
    setInlineSandwichMode,
    inlineTotalCount,
    setInlineTotalCount,
    inlineSandwichTypes,
    setInlineSandwichTypes,
    modalSandwichMode,
    setModalSandwichMode,
    modalTotalCount,
    setModalTotalCount,
    modalSandwichTypes,
    setModalSandwichTypes,

    // Completed editing
    editingCompletedId,
    setEditingCompletedId,
    completedEdit,
    setCompletedEdit,

    // Custom person
    customPersonData,
    setCustomPersonData,
  };

  return (
    <EventRequestContext.Provider value={value}>
      {children}
    </EventRequestContext.Provider>
  );
};