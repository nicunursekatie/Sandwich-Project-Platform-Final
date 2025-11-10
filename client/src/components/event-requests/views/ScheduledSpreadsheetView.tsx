import React, { useState, useMemo, useEffect } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  Save,
  X,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Users,
  Package,
  Clock,
  Car,
  Megaphone,
  UserPlus,
  FileText,
  GripVertical,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import type { EventRequest } from '@shared/schema';
import { parseSandwichTypes } from '@/lib/sandwich-utils';

interface Column {
  id: string;
  label: string;
  width?: string;
  sortable?: boolean;
  hideOnMobile?: boolean;
  render?: (event: EventRequest) => React.ReactNode | string | { fullText: string; hasContent: boolean };
}

type SortField = 'eventDate' | 'groupName' | 'eventStartTime' | 'pickupTime' | 'estimatedSandwiches';
type SortDirection = 'asc' | 'desc';

interface ScheduledSpreadsheetViewProps {
  onEventDateClick?: (event: EventRequest) => void;
}

export const ScheduledSpreadsheetView: React.FC<ScheduledSpreadsheetViewProps> = ({ onEventDateClick }) => {
  const {
    eventRequests,
    editingScheduledId,
    setEditingScheduledId,
    editingField,
    setEditingField,
    editingValue,
    setEditingValue,
    setSelectedEventRequest,
    setActiveTab,
  } = useEventRequestContext();

  const { updateEventRequestMutation, updateScheduledFieldMutation } = useEventMutations();
  const { resolveUserName } = useEventAssignments();
  const { trackEvent, trackButtonClick } = useAnalytics();
  const isMobile = useIsMobile();

  const [sortField, setSortField] = useState<SortField>('eventDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'thisWeek' | 'nextWeek' | 'next2Weeks' | 'nextMonth' | 'all'>('next2Weeks');
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    // Load saved column order from localStorage
    const saved = localStorage.getItem('scheduledSpreadsheetColumnOrder');
    return saved ? JSON.parse(saved) : null;
  });

  // Track spreadsheet feature usage
  useEffect(() => {
    trackEvent('spreadsheet_view_loaded', {
      total_events: scheduledEvents.length,
      default_date_range: dateRange,
      has_custom_column_order: !!columnOrder,
      timestamp: new Date().toISOString(),
    });
  }, [trackEvent, scheduledEvents.length, dateRange, columnOrder]);

  // Track search usage
  useEffect(() => {
    if (searchQuery) {
      const timer = setTimeout(() => {
        trackEvent('spreadsheet_searched', {
          query_length: searchQuery.length,
          results_count: filteredEvents.length,
          timestamp: new Date().toISOString(),
        });
      }, 500); // Debounce search tracking
      return () => clearTimeout(timer);
    }
  }, [searchQuery, trackEvent, filteredEvents.length]);

  // Track date filter changes
  useEffect(() => {
    if (dateRange !== 'next2Weeks') { // Only track when changed from default
      trackEvent('spreadsheet_date_filter_changed', {
        filter: dateRange,
        events_shown: dateFilteredEvents.length,
        timestamp: new Date().toISOString(),
      });
      trackButtonClick(`filter_by_${dateRange}`, 'spreadsheet_view');
    }
  }, [dateRange, trackEvent, trackButtonClick, dateFilteredEvents.length]);

  // Filter to scheduled events only
  const scheduledEvents = useMemo(() => {
    return eventRequests.filter(req => req.status === 'scheduled');
  }, [eventRequests]);

  // Filter by date range
  const dateFilteredEvents = useMemo(() => {
    if (dateRange === 'all') return scheduledEvents;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate = new Date(today);
    let endDate = new Date(today);
    
    switch (dateRange) {
      case 'thisWeek':
        // Start of this week (Sunday)
        const dayOfWeek = today.getDay();
        startDate.setDate(today.getDate() - dayOfWeek);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'nextWeek':
        // Next week (Sunday to Saturday)
        const nextWeekStart = new Date(today);
        const daysUntilNextSunday = 7 - today.getDay();
        nextWeekStart.setDate(today.getDate() + daysUntilNextSunday);
        startDate = nextWeekStart;
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'next2Weeks':
        // Next 2 weeks from today
        startDate = new Date(today);
        endDate = new Date(today);
        endDate.setDate(today.getDate() + 14);
        break;
      case 'nextMonth':
        // Next 30 days
        startDate = new Date(today);
        endDate = new Date(today);
        endDate.setDate(today.getDate() + 30);
        break;
    }
    
    endDate.setHours(23, 59, 59, 999);
    
    return scheduledEvents.filter(event => {
      const eventDate = event.scheduledEventDate || event.desiredEventDate;
      if (!eventDate) return false;
      
      // Use timezone-safe date parsing
      let eventDateObj: Date;
      const dateStr = typeof eventDate === 'string' ? eventDate : eventDate.toISOString();
      
      if (dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        const dateOnly = dateStr.split(' ')[0];
        eventDateObj = new Date(dateOnly + 'T12:00:00');
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)) {
        const dateOnly = dateStr.split('T')[0];
        eventDateObj = new Date(dateOnly + 'T12:00:00');
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        eventDateObj = new Date(dateStr + 'T12:00:00');
      } else {
        const tempDate = new Date(dateStr);
        if (isNaN(tempDate.getTime())) return false;
        const year = tempDate.getUTCFullYear();
        const month = String(tempDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(tempDate.getUTCDate()).padStart(2, '0');
        eventDateObj = new Date(`${year}-${month}-${day}T12:00:00`);
      }
      
      // Normalize comparison dates to noon as well
      const compareStart = new Date(startDate);
      compareStart.setHours(12, 0, 0, 0);
      const compareEnd = new Date(endDate);
      compareEnd.setHours(12, 0, 0, 0);
      
      return eventDateObj >= compareStart && eventDateObj <= compareEnd;
    });
  }, [scheduledEvents, dateRange]);

  // Filter by search query
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return dateFilteredEvents;
    const query = searchQuery.toLowerCase();
    return dateFilteredEvents.filter(event => 
      event.organizationName?.toLowerCase().includes(query) ||
      event.firstName?.toLowerCase().includes(query) ||
      event.lastName?.toLowerCase().includes(query) ||
      event.email?.toLowerCase().includes(query) ||
      event.phone?.toLowerCase().includes(query) ||
      event.eventAddress?.toLowerCase().includes(query)
    );
  }, [dateFilteredEvents, searchQuery]);

  // Sort events
  const sortedEvents = useMemo(() => {
    const sorted = [...filteredEvents];
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'eventDate':
          // Use timezone-safe date parsing for sorting
          const parseDateSafe = (date: string | Date | null | undefined): number => {
            if (!date) return 0;
            const dateStr = typeof date === 'string' ? date : date.toISOString();
            let dateObj: Date;
            
            if (dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
              const dateOnly = dateStr.split(' ')[0];
              dateObj = new Date(dateOnly + 'T12:00:00');
            } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)) {
              const dateOnly = dateStr.split('T')[0];
              dateObj = new Date(dateOnly + 'T12:00:00');
            } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              dateObj = new Date(dateStr + 'T12:00:00');
            } else {
              const tempDate = new Date(dateStr);
              if (isNaN(tempDate.getTime())) return 0;
              const year = tempDate.getUTCFullYear();
              const month = String(tempDate.getUTCMonth() + 1).padStart(2, '0');
              const day = String(tempDate.getUTCDate()).padStart(2, '0');
              dateObj = new Date(`${year}-${month}-${day}T12:00:00`);
            }
            return dateObj.getTime();
          };
          aValue = parseDateSafe(a.scheduledEventDate || a.desiredEventDate);
          bValue = parseDateSafe(b.scheduledEventDate || b.desiredEventDate);
          break;
        case 'groupName':
          aValue = a.organizationName || `${a.firstName} ${a.lastName}`.trim() || '';
          bValue = b.organizationName || `${b.firstName} ${b.lastName}`.trim() || '';
          break;
        case 'eventStartTime':
          aValue = a.eventStartTime || '';
          bValue = b.eventStartTime || '';
          break;
        case 'pickupTime':
          aValue = a.pickupTime || '';
          bValue = b.pickupTime || '';
          break;
        case 'estimatedSandwiches':
          aValue = a.estimatedSandwichCount || 0;
          bValue = b.estimatedSandwichCount || 0;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortDirection === 'asc' 
        ? (aValue > bValue ? 1 : -1)
        : (aValue < bValue ? 1 : -1);
    });
    return sorted;
  }, [filteredEvents, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    const newDirection = sortField === field ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';

    // Track sorting action
    trackEvent('spreadsheet_column_sorted', {
      field,
      direction: newDirection,
      previous_field: sortField,
      previous_direction: sortDirection,
      timestamp: new Date().toISOString(),
    });
    trackButtonClick(`sort_by_${field}_${newDirection}`, 'spreadsheet_view');

    if (sortField === field) {
      setSortDirection(newDirection);
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortFieldForColumn = (columnId: string): SortField | null => {
    const sortMap: Record<string, SortField> = {
      'eventDate': 'eventDate',
      'groupName': 'groupName',
      'eventStartTime': 'eventStartTime',
      'pickupTime': 'pickupTime',
      'estimatedSandwiches': 'estimatedSandwiches',
    };
    return sortMap[columnId] || null;
  };

  const startEditing = (eventId: number, field: string, currentValue: any) => {
    // Track inline editing start
    trackEvent('spreadsheet_inline_edit_started', {
      field,
      event_id: eventId,
      timestamp: new Date().toISOString(),
    });

    setEditingScheduledId(eventId);
    setEditingField(field);

    // Special handling for sandwich types
    if (field === 'sandwichType') {
      const event = eventRequests.find(e => e.id === eventId);
      if (event) {
        setEditingValue(getSandwichTypeEditValue(event));
        return;
      }
    }

    setEditingValue(currentValue?.toString() || '');
  };

  const saveEdit = () => {
    if (editingScheduledId && editingField) {
      // Track inline edit save
      trackEvent('spreadsheet_inline_edit_saved', {
        field: editingField,
        event_id: editingScheduledId,
        timestamp: new Date().toISOString(),
      });
      trackButtonClick(`save_inline_edit_${editingField}`, 'spreadsheet_view');

      // Map spreadsheet column IDs to actual database field names
      const fieldMap: Record<string, string> = {
        'eventStartTime': 'eventStartTime',
        'eventEndTime': 'eventEndTime',
        'pickupTime': 'pickupTime',
        'estimatedSandwiches': 'estimatedSandwichCount',
        'toolkitSent': 'toolkitSent',
        'tspContact': 'tspContact',
        'address': 'eventAddress',
        'notes': 'planningNotes',
        'additionalNotes': 'schedulingNotes',
        'sandwichType': 'sandwichTypes',
      };

      const dbField = fieldMap[editingField] || editingField;

      // Handle boolean fields
      if (dbField === 'toolkitSent') {
        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: { toolkitSent: editingValue === 'Yes' || editingValue === 'true' },
        });
      }
      // Handle sandwich types
      else if (dbField === 'sandwichTypes') {
        const parsedTypes = parseSandwichTypeEditValue(editingValue);
        updateScheduledFieldMutation.mutate({
          id: editingScheduledId,
          field: dbField,
          value: parsedTypes,
        });
      }
      else {
        updateScheduledFieldMutation.mutate({
          id: editingScheduledId,
          field: dbField,
          value: editingValue,
        });
      }
      cancelEdit();
    }
  };

  const cancelEdit = () => {
    setEditingScheduledId(null);
    setEditingField(null);
    setEditingValue('');
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '';
    try {
      // Handle timezone issues by parsing date-only strings at noon
      let dateObj: Date;
      const dateStr = typeof date === 'string' ? date : date.toISOString();
      
      // Check if it's a date-only format or midnight UTC timestamp
      if (dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        // Database timestamp format: "2025-09-03 00:00:00"
        const dateOnly = dateStr.split(' ')[0];
        dateObj = new Date(dateOnly + 'T12:00:00');
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)) {
        // ISO format with midnight time (e.g., "2025-09-03T00:00:00.000Z")
        const dateOnly = dateStr.split('T')[0];
        dateObj = new Date(dateOnly + 'T12:00:00');
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // YYYY-MM-DD format
        dateObj = new Date(dateStr + 'T12:00:00');
      } else {
        // For other formats, try to extract date components
        const tempDate = new Date(dateStr);
        if (isNaN(tempDate.getTime())) return '';
        const year = tempDate.getUTCFullYear();
        const month = String(tempDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(tempDate.getUTCDate()).padStart(2, '0');
        dateObj = new Date(`${year}-${month}-${day}T12:00:00`);
      }
      
      return format(dateObj, 'M/d/yyyy');
    } catch {
      return '';
    }
  };

  const formatDayOfWeek = (date: string | Date | null | undefined) => {
    if (!date) return '';
    try {
      // Handle timezone issues by parsing date-only strings at noon
      let dateObj: Date;
      const dateStr = typeof date === 'string' ? date : date.toISOString();
      
      // Check if it's a date-only format or midnight UTC timestamp
      if (dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        // Database timestamp format: "2025-09-03 00:00:00"
        const dateOnly = dateStr.split(' ')[0];
        dateObj = new Date(dateOnly + 'T12:00:00');
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)) {
        // ISO format with midnight time (e.g., "2025-09-03T00:00:00.000Z")
        const dateOnly = dateStr.split('T')[0];
        dateObj = new Date(dateOnly + 'T12:00:00');
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // YYYY-MM-DD format
        dateObj = new Date(dateStr + 'T12:00:00');
      } else {
        // For other formats, try to extract date components
        const tempDate = new Date(dateStr);
        if (isNaN(tempDate.getTime())) return '';
        const year = tempDate.getUTCFullYear();
        const month = String(tempDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(tempDate.getUTCDate()).padStart(2, '0');
        dateObj = new Date(`${year}-${month}-${day}T12:00:00`);
      }
      
      return format(dateObj, 'EEEE');
    } catch {
      return '';
    }
  };

  const getSandwichTypeDisplay = (event: EventRequest) => {
    const sandwichTypes = parseSandwichTypes(event.sandwichTypes);
    if (sandwichTypes && sandwichTypes.length > 0) {
      // Only show types, not counts - this is the TYPE column
      return sandwichTypes.map(st => `${st.type} (${st.quantity})`).join(', ');
    }
    // If no sandwich types specified, return empty string (don't show counts here)
    return '';
  };

  const getSandwichTypeEditValue = (event: EventRequest): string => {
    const sandwichTypes = parseSandwichTypes(event.sandwichTypes);
    if (sandwichTypes && sandwichTypes.length > 0) {
      // Format for editing: "deli: 200, pbj: 100"
      return sandwichTypes.map(st => `${st.type}: ${st.quantity}`).join(', ');
    }
    return '';
  };

  const parseSandwichTypeEditValue = (value: string): any => {
    if (!value || !value.trim()) return null;
    
    try {
      // Parse format like "deli: 200, pbj: 100" or "deli (200), pbj (100)"
      const parts = value.split(',').map(p => p.trim());
      const types = parts.map(part => {
        // Handle both "type: quantity" and "type (quantity)" formats
        const colonMatch = part.match(/^(\w+):\s*(\d+)$/);
        const parenMatch = part.match(/^(\w+)\s*\((\d+)\)$/);
        
        if (colonMatch) {
          return { type: colonMatch[1].trim(), quantity: parseInt(colonMatch[2], 10) };
        } else if (parenMatch) {
          return { type: parenMatch[1].trim(), quantity: parseInt(parenMatch[2], 10) };
        }
        return null;
      }).filter(Boolean);
      
      return types.length > 0 ? types : null;
    } catch {
      return null;
    }
  };

  const formatTime = (timeString: string | null | undefined): string => {
    if (!timeString) return '';
    
    // If already formatted (contains AM/PM), return as-is
    if (timeString.includes('AM') || timeString.includes('PM') || timeString.includes('am') || timeString.includes('pm')) {
      return timeString;
    }
    
    // Parse HH:MM or HH:MM:SS format
    const match = timeString.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return timeString; // Return as-is if format not recognized
    
    const hours24 = parseInt(match[1], 10);
    const minutes = match[2];
    
    if (hours24 < 0 || hours24 > 23) return timeString;
    
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    
    return `${hours12}:${minutes} ${period}`;
  };

  const getRowColor = (index: number) => {
    // Use brand colors with light opacity for alternating rows
    const colors = [
      'bg-white',
      'bg-[#47B3CB]/5', // Light teal
      'bg-[#FBAD3F]/5', // Light orange
    ];
    return colors[index % 3];
  };

  // Handle clicking on event date to navigate to card view
  const handleEventDateClick = (event: EventRequest) => {
    if (onEventDateClick) {
      onEventDateClick(event);
    } else {
      // Fallback if no callback provided
      setSelectedEventRequest(event);
      setActiveTab('scheduled');
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  };

  // Define default columns - ordered by workflow priority
  // Note: resolveUserName is used in the render functions, so columns must be defined after resolveUserName is available
  // Note: handleEventDateClick is used in renderCell, but we define it outside useMemo since it's stable
  const defaultColumns: Column[] = useMemo(() => [
    // 1. Event date
    {
      id: 'eventDate',
      label: 'Event Date',
      width: '85px',
      sortable: true,
      render: (event) => formatDate(event.scheduledEventDate || event.desiredEventDate),
    },
    // 2. Day of week
    {
      id: 'dayOfWeek',
      label: 'Day',
      width: '70px',
      render: (event) => {
        const day = formatDayOfWeek(event.scheduledEventDate || event.desiredEventDate);
        return day ? day.substring(0, 3) : ''; // Abbreviate to 3 letters
      },
    },
    // 3. Group/department
    {
      id: 'groupName',
      label: 'Group/Dept',
      width: '180px',
      sortable: true,
      render: (event) => {
        const org = event.organizationName || `${event.firstName} ${event.lastName}`.trim() || 'N/A';
        const dept = event.department ? ` (${event.department})` : '';
        return org + dept;
      },
    },
    // 4. Location (with Google map link)
    {
      id: 'address',
      label: 'Location',
      width: '200px',
      render: (event) => {
        const address = event.eventAddress || '';
        if (!address) return '';
        return (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#007E8C] hover:underline flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{address}</span>
          </a>
        );
      },
    },
    // 5. Times - start, end, pickup
    {
      id: 'eventStartTime',
      label: 'Start Time',
      width: '100px',
      sortable: true,
      render: (event) => formatTime(event.eventStartTime),
    },
    {
      id: 'eventEndTime',
      label: 'End Time',
      width: '100px',
      hideOnMobile: true,
      render: (event) => formatTime(event.eventEndTime),
    },
    {
      id: 'pickupTime',
      label: 'Pickup Time',
      width: '100px',
      sortable: true,
      hideOnMobile: true,
      render: (event) => formatTime(event.pickupTime),
    },
    // 6. Sandwiches # and type
    {
      id: 'estimatedSandwiches',
      label: '# Sandwiches',
      width: '100px',
      sortable: true,
      render: (event) => {
        const count = event.estimatedSandwichCount;
        const min = event.estimatedSandwichCountMin;
        const max = event.estimatedSandwichCountMax;
        if (min && max) return `${min}-${max}`;
        return count?.toString() || '';
      },
    },
    {
      id: 'sandwichType',
      label: 'Type',
      width: '100px',
      hideOnMobile: true,
      render: (event) => getSandwichTypeDisplay(event),
    },
    // 7. Assigned staff (TSP Contact)
    {
      id: 'tspContact',
      label: 'TSP Contact',
      width: '140px',
      hideOnMobile: true,
      render: (event) => {
        const contacts = [];
        if (event.tspContact) contacts.push(resolveUserName(event.tspContact));
        if (event.tspContactAssigned) contacts.push(resolveUserName(event.tspContactAssigned));
        if (event.customTspContact) contacts.push(event.customTspContact); // Custom is already text
        return contacts.filter(c => c && c !== 'Not assigned').join(', ') || '';
      },
    },
    // 8. Driver/speaker/volunteer need
    {
      id: 'volunteersNeeded',
      label: 'Staff Needed',
      width: '140px',
      hideOnMobile: true,
      render: (event) => {
        const needs = [];
        if (event.volunteersNeeded && event.volunteersNeeded > 0) needs.push(`${event.volunteersNeeded} vol`);
        if (event.driversNeeded && event.driversNeeded > 0) needs.push(`${event.driversNeeded} driver`);
        if (event.speakersNeeded && event.speakersNeeded > 0) needs.push(`${event.speakersNeeded} speaker`);
        return needs.join(', ') || 'None';
      },
    },
    // 9. Assigned Staff (who is actually assigned)
    {
      id: 'assignedStaff',
      label: 'Assigned Staff',
      width: '180px',
      hideOnMobile: true,
      render: (event) => {
        const assigned = [];
        
        // Van driver
        if (event.assignedVanDriverId) {
          assigned.push(`🚐 ${resolveUserName(event.assignedVanDriverId)}`);
        }
        
        // Drivers
        if (event.assignedDriverIds && event.assignedDriverIds.length > 0) {
          const driverNames = event.assignedDriverIds
            .map(id => resolveUserName(id))
            .filter(name => name && name !== 'Not assigned');
          if (driverNames.length > 0) {
            assigned.push(`🚗 ${driverNames.join(', ')}`);
          }
        }
        
        // Speakers
        if (event.assignedSpeakerIds && event.assignedSpeakerIds.length > 0) {
          const speakerNames = event.assignedSpeakerIds
            .map(id => resolveUserName(id))
            .filter(name => name && name !== 'Not assigned');
          if (speakerNames.length > 0) {
            assigned.push(`🎤 ${speakerNames.join(', ')}`);
          }
        }
        
        // Volunteers
        if (event.assignedVolunteerIds && event.assignedVolunteerIds.length > 0) {
          const volunteerNames = event.assignedVolunteerIds
            .map(id => resolveUserName(id))
            .filter(name => name && name !== 'Not assigned');
          if (volunteerNames.length > 0) {
            assigned.push(`👥 ${volunteerNames.join(', ')}`);
          }
        }
        
        return assigned.length > 0 ? assigned.join(' | ') : '';
      },
    },
    // 10. Van booked
    {
      id: 'vanBooked',
      label: 'Van Booked?',
      width: '100px',
      hideOnMobile: true,
      render: (event) => event.vanDriverNeeded ? 'Yes' : 'No',
    },
    // 11. Contact name, #, and email for organization
    {
      id: 'contactName',
      label: 'Contact Name',
      width: '140px',
      hideOnMobile: true,
      render: (event) => `${event.firstName || ''} ${event.lastName || ''}`.trim() || 'N/A',
    },
    {
      id: 'phone',
      label: 'Contact #',
      width: '120px',
      hideOnMobile: true,
      render: (event) => event.phone || '',
    },
    {
      id: 'email',
      label: 'Email',
      width: '180px',
      hideOnMobile: true,
      render: (event) => event.email || event.updatedEmail || '',
    },
    // 12. The rest (all details, etc.)
    {
      id: 'allDetails',
      label: 'ALL DETAILS',
      width: '150px',
      hideOnMobile: true,
      render: (event) => {
        const details = [];
        if (event.message) details.push(event.message);
        if (event.planningNotes) details.push(`Planning: ${event.planningNotes}`);
        if (event.schedulingNotes) details.push(`Scheduling: ${event.schedulingNotes}`);
        if (event.additionalRequirements) details.push(`Requirements: ${event.additionalRequirements}`);
        const fullText = details.join(' | ') || '';
        return { fullText, hasContent: fullText.length > 0 };
      },
    },
    {
      id: 'toolkitSent',
      label: 'Toolkit Sent',
      width: '100px',
      hideOnMobile: true,
      render: (event) => event.toolkitSent ? 'Yes' : 'No',
    },
    {
      id: 'finalSandwiches',
      label: 'Final # Made',
      width: '100px',
      hideOnMobile: true,
      render: (event) => event.actualSandwichCount?.toString() || '',
    },
    {
      id: 'notes',
      label: 'Notes',
      width: '150px',
      hideOnMobile: true,
      render: (event) => event.planningNotes || '',
    },
    {
      id: 'additionalNotes',
      label: 'Add\'l Notes',
      width: '150px',
      hideOnMobile: true,
      render: (event) => event.schedulingNotes || '',
    },
    {
      id: 'socialPost',
      label: 'Social Post',
      width: '100px',
      hideOnMobile: true,
      render: (event) => {
        if (event.socialMediaPostCompleted) return '✓ Done';
        if (event.socialMediaPostRequested) return 'Req';
        return '';
      },
    },
  ], [resolveUserName]);

  // Reorder columns based on saved order
  const columns: Column[] = useMemo(() => {
    // First, filter columns based on mobile vs desktop
    const visibleColumns = isMobile
      ? defaultColumns.filter(col => !col.hideOnMobile)
      : defaultColumns;

    // Reorder columns if saved order exists and matches current column count
    if (columnOrder && columnOrder.length === visibleColumns.length) {
      const columnMap = new Map(visibleColumns.map(col => [col.id, col]));
      const orderedColumns = columnOrder.map(id => columnMap.get(id)).filter(Boolean) as Column[];
      // If all columns are present, return ordered columns
      if (orderedColumns.length === visibleColumns.length) {
        return orderedColumns;
      }
    }

    // If saved order is outdated or doesn't exist, use default order
    // Clear outdated saved order
    if (columnOrder && columnOrder.length !== visibleColumns.length) {
      localStorage.removeItem('scheduledSpreadsheetColumnOrder');
      setColumnOrder(null);
    }

    return visibleColumns;
  }, [columnOrder, defaultColumns, isMobile]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColumnIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedColumnIndex === null || draggedColumnIndex === dropIndex) {
      setDraggedColumnIndex(null);
      return;
    }

    // Get current column order (either from state or default)
    const currentOrder = columnOrder || defaultColumns.map(col => col.id);
    const newOrder = [...currentOrder];
    const [removed] = newOrder.splice(draggedColumnIndex, 1);
    newOrder.splice(dropIndex, 0, removed);

    // Track column reordering
    trackEvent('spreadsheet_column_reordered', {
      from_index: draggedColumnIndex,
      to_index: dropIndex,
      column_moved: removed,
      is_custom_order: !!columnOrder,
      timestamp: new Date().toISOString(),
    });
    trackButtonClick('reorder_columns', 'spreadsheet_view');

    setColumnOrder(newOrder);
    localStorage.setItem('scheduledSpreadsheetColumnOrder', JSON.stringify(newOrder));
    setDraggedColumnIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedColumnIndex(null);
  };

  const isEditing = (eventId: number, field: string) => {
    return editingScheduledId === eventId && editingField === field;
  };

  const renderCell = (event: EventRequest, column: Column) => {
    const isEditable = ['eventStartTime', 'eventEndTime', 'pickupTime', 'estimatedSandwiches', 'sandwichType', 'toolkitSent', 'tspContact', 'address', 'notes', 'additionalNotes'].includes(column.id);
    
    if (isEditing(event.id, column.id)) {
      // Special handling for toolkitSent (boolean)
      if (column.id === 'toolkitSent') {
        return (
          <div className="flex items-center gap-0.5">
            <Select
              value={editingValue}
              onValueChange={setEditingValue}
            >
              <SelectTrigger className="h-7 text-sm w-16 px-1.5 py-0.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={saveEdit} className="h-11 w-11 md:h-5 md:w-5 p-2 md:p-0 touch-manipulation" title="Save changes">
              <Save className="h-6 w-6 md:h-3 md:w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-11 w-11 md:h-5 md:w-5 p-2 md:p-0 touch-manipulation" title="Cancel editing">
              <X className="h-6 w-6 md:h-3 md:w-3" />
            </Button>
          </div>
        );
      }
      
      // Special handling for time fields
      if (['eventStartTime', 'eventEndTime', 'pickupTime'].includes(column.id)) {
        return (
          <div className="flex items-center gap-0.5">
            <Input
              type="time"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              className="h-7 text-sm px-1.5 py-0.5 w-24"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
            <Button size="sm" variant="ghost" onClick={saveEdit} className="h-11 w-11 md:h-5 md:w-5 p-2 md:p-0 touch-manipulation" title="Save changes">
              <Save className="h-6 w-6 md:h-3 md:w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-11 w-11 md:h-5 md:w-5 p-2 md:p-0 touch-manipulation" title="Cancel editing">
              <X className="h-6 w-6 md:h-3 md:w-3" />
            </Button>
          </div>
        );
      }
      
      return (
        <div className="flex items-center gap-0.5">
          <Input
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            className="h-7 text-sm px-1.5 py-0.5"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <Button size="sm" variant="ghost" onClick={saveEdit} className="h-5 w-5 p-0">
            <Save className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-5 w-5 p-0">
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    const renderedContent = column.render ? column.render(event) : '';
    
    // Special handling for eventDate column (make it clickable)
    if (column.id === 'eventDate') {
      const dateText = typeof renderedContent === 'string' ? renderedContent : String(renderedContent);
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEventDateClick(event);
          }}
          className="text-sm text-[#007E8C] hover:text-[#236383] hover:underline cursor-pointer w-full text-left"
          title="Click to view event details in card view"
        >
          {dateText}
        </button>
      );
    }
    
    // Special handling for address column (returns JSX with link)
    if (column.id === 'address') {
      if (React.isValidElement(renderedContent)) {
        return (
          <div className="flex items-center gap-0.5 min-h-[20px] overflow-hidden">
            {renderedContent}
          </div>
        );
      }
      // Fallback if no address
      return <span className="text-sm text-gray-400">-</span>;
    }
    
    // Special handling for allDetails column
    if (column.id === 'allDetails') {
      const detailsData = renderedContent as { fullText: string; hasContent: boolean };
      if (!detailsData.hasContent || !detailsData) {
        return <span className="text-sm text-gray-400">-</span>;
      }
      
      // Check if text is truncated (will be truncated if longer than ~80 characters in a 150px column)
      const isTruncated = detailsData.fullText.length > 80;
      
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button 
              className="w-full text-left hover:bg-[#47B3CB]/5 rounded px-1 py-0.5 transition-colors group cursor-pointer"
              onClick={(e) => e.stopPropagation()} // Prevent double-click editing
            >
              <div className="flex items-center gap-1 min-w-0 w-full">
                <span 
                  className="text-sm leading-tight block overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0" 
                  title={detailsData.fullText}
                >
                  {detailsData.fullText}
                </span>
                {isTruncated && (
                  <Eye className="h-3 w-3 text-[#007E8C] opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Click to view full details" />
                )}
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-96 max-h-96 overflow-y-auto"
            side="right"
            align="start"
            onClick={(e) => e.stopPropagation()} // Prevent event bubbling
          >
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-[#236383] mb-2">All Details</h4>
              <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                {detailsData.fullText || 'No details available'}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      );
    }
    
    const content = typeof renderedContent === 'string' ? renderedContent : String(renderedContent);
    
    // Get the raw value for editing (not the formatted display)
    const getRawValue = () => {
      switch (column.id) {
        case 'eventStartTime':
          return event.eventStartTime || '';
        case 'eventEndTime':
          return event.eventEndTime || '';
        case 'pickupTime':
          return event.pickupTime || '';
        case 'estimatedSandwiches':
          return event.estimatedSandwichCount?.toString() || '';
        case 'toolkitSent':
          return event.toolkitSent ? 'Yes' : 'No';
        case 'tspContact':
          return event.tspContact || event.tspContactAssigned || '';
        case 'address':
          return event.eventAddress || '';
        case 'notes':
          return event.planningNotes || '';
        case 'additionalNotes':
          return event.schedulingNotes || '';
        default:
          return content;
      }
    };
    
    return (
      <div 
        className="flex items-center gap-0.5 group min-h-[20px]"
        onDoubleClick={() => isEditable && startEditing(event.id, column.id, getRawValue())}
      >
        <span className="text-sm truncate flex-1 leading-tight">{content || '-'}</span>
        {isEditable && (
          <button
            onClick={() => startEditing(event.id, column.id, getRawValue())}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 h-11 w-11 md:h-auto md:w-auto flex items-center justify-center touch-manipulation"
            title="Edit this field"
          >
            <Edit2 className="h-6 w-6 md:h-3 md:w-3 text-[#007E8C]" />
          </button>
        )}
      </div>
    );
  };

  if (scheduledEvents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No scheduled events
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Search and Controls */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <div className="text-sm text-gray-600">
            {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        {/* Date Range Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 font-medium">Show:</span>
          <Button
            variant={dateRange === 'thisWeek' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('thisWeek')}
            className={dateRange === 'thisWeek' ? 'bg-[#007E8C] hover:bg-[#236383] text-white' : 'border-[#007E8C] text-[#007E8C] hover:bg-[#007E8C]/10'}
          >
            This Week
          </Button>
          <Button
            variant={dateRange === 'nextWeek' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('nextWeek')}
            className={dateRange === 'nextWeek' ? 'bg-[#007E8C] hover:bg-[#236383] text-white' : 'border-[#007E8C] text-[#007E8C] hover:bg-[#007E8C]/10'}
          >
            Next Week
          </Button>
          <Button
            variant={dateRange === 'next2Weeks' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('next2Weeks')}
            className={dateRange === 'next2Weeks' ? 'bg-[#007E8C] hover:bg-[#236383] text-white' : 'border-[#007E8C] text-[#007E8C] hover:bg-[#007E8C]/10'}
          >
            Next 2 Weeks
          </Button>
          <Button
            variant={dateRange === 'nextMonth' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('nextMonth')}
            className={dateRange === 'nextMonth' ? 'bg-[#007E8C] hover:bg-[#236383] text-white' : 'border-[#007E8C] text-[#007E8C] hover:bg-[#007E8C]/10'}
          >
            Next Month
          </Button>
          <Button
            variant={dateRange === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('all')}
            className={dateRange === 'all' ? 'bg-[#007E8C] hover:bg-[#236383] text-white' : 'border-[#007E8C] text-[#007E8C] hover:bg-[#007E8C]/10'}
          >
            All Events
          </Button>
        </div>
      </div>

      {/* Table Container with Horizontal and Vertical Scroll */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
          <table className="w-full border-collapse">
            <thead className="bg-[#007E8C] border-b-2 border-[#236383] sticky top-0 z-10">
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={column.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`px-1.5 py-1 text-left text-xs font-semibold text-white border-r border-[#236383] whitespace-nowrap cursor-move select-none group ${
                      draggedColumnIndex === index ? 'opacity-50' : 'hover:bg-[#236383]'
                    }`}
                    style={{ width: column.width, minWidth: column.width }}
                    title="Drag to reorder columns"
                  >
                    <div className="flex items-center gap-1">
                      <GripVertical className="h-3 w-3 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      <span className="flex-1">{column.label}</span>
                      {column.sortable && (() => {
                        const columnSortField = getSortFieldForColumn(column.id);
                        const isActive = columnSortField && sortField === columnSortField;
                        return (
                          <button
                            onClick={() => {
                              if (columnSortField) {
                                handleSort(columnSortField);
                              }
                            }}
                            className="hover:bg-[#236383] rounded p-1 md:p-0.5 ml-0.5 touch-manipulation"
                            title={`Sort by ${column.label}`}
                          >
                            {isActive ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-5 w-5 md:h-2.5 md:w-2.5 text-white" />
                              ) : (
                                <ArrowDown className="h-5 w-5 md:h-2.5 md:w-2.5 text-white" />
                              )
                            ) : (
                              <ArrowUpDown className="h-5 w-5 md:h-2.5 md:w-2.5 text-white/70" />
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map((event, index) => (
                <tr
                  key={event.id}
                  className={`${getRowColor(index)} border-b border-gray-200 hover:bg-[#47B3CB]/10 transition-colors h-8`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className="px-1.5 py-1 border-r border-gray-200 text-sm leading-tight overflow-hidden"
                      style={{ width: column.width, minWidth: column.width, maxWidth: column.width }}
                    >
                      {renderCell(event, column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-xs text-gray-500 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span>Double-click any editable cell to edit. Press Enter to save, Escape to cancel.</span>
        </div>
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4" />
          <span>Drag column headers to reorder columns. Your preference will be saved.</span>
        </div>
      </div>
    </div>
  );
};


