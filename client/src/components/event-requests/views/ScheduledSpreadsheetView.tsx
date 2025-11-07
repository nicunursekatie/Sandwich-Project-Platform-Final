import React, { useState, useMemo, useEffect } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventMutations } from '../hooks/useEventMutations';
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
} from 'lucide-react';
import { format } from 'date-fns';
import type { EventRequest } from '@shared/schema';
import { parseSandwichTypes } from '@/lib/sandwich-utils';

interface Column {
  id: string;
  label: string;
  width?: string;
  sortable?: boolean;
  render?: (event: EventRequest) => React.ReactNode;
}

type SortField = 'eventDate' | 'groupName' | 'eventStartTime' | 'pickupTime' | 'estimatedSandwiches';
type SortDirection = 'asc' | 'desc';

export const ScheduledSpreadsheetView: React.FC = () => {
  const {
    eventRequests,
    editingScheduledId,
    setEditingScheduledId,
    editingField,
    setEditingField,
    editingValue,
    setEditingValue,
  } = useEventRequestContext();

  const { updateEventRequestMutation, updateScheduledFieldMutation } = useEventMutations();

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
      
      const eventDateObj = new Date(eventDate);
      eventDateObj.setHours(0, 0, 0, 0);
      
      return eventDateObj >= startDate && eventDateObj <= endDate;
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
          aValue = a.scheduledEventDate ? new Date(a.scheduledEventDate).getTime() : (a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0);
          bValue = b.scheduledEventDate ? new Date(b.scheduledEventDate).getTime() : (b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0);
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
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
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
    setEditingScheduledId(eventId);
    setEditingField(field);
    setEditingValue(currentValue?.toString() || '');
  };

  const saveEdit = () => {
    if (editingScheduledId && editingField) {
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
      };

      const dbField = fieldMap[editingField] || editingField;
      
      // Handle boolean fields
      if (dbField === 'toolkitSent') {
        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: { toolkitSent: editingValue === 'Yes' || editingValue === 'true' },
        });
      } else {
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
      return format(new Date(date), 'M/d/yyyy');
    } catch {
      return '';
    }
  };

  const formatDayOfWeek = (date: string | Date | null | undefined) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'EEEE');
    } catch {
      return '';
    }
  };

  const getSandwichTypeDisplay = (event: EventRequest) => {
    const sandwichTypes = parseSandwichTypes(event.sandwichTypes);
    if (sandwichTypes && sandwichTypes.length > 0) {
      return sandwichTypes.map(st => `${st.type} (${st.quantity})`).join(', ');
    }
    if (event.estimatedSandwichCountMin && event.estimatedSandwichCountMax) {
      return `${event.estimatedSandwichCountMin}-${event.estimatedSandwichCountMax} ${event.estimatedSandwichRangeType || ''}`;
    }
    return event.estimatedSandwichCount?.toString() || '';
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

  // Define default columns
  const defaultColumns: Column[] = [
    {
      id: 'eventDate',
      label: 'Event Date',
      width: '85px',
      sortable: true,
      render: (event) => formatDate(event.scheduledEventDate || event.desiredEventDate),
    },
    {
      id: 'dayOfWeek',
      label: 'Day',
      width: '70px',
      render: (event) => {
        const day = formatDayOfWeek(event.scheduledEventDate || event.desiredEventDate);
        return day ? day.substring(0, 3) : ''; // Abbreviate to 3 letters
      },
    },
    {
      id: 'groupName',
      label: 'Group Name',
      width: '200px',
      sortable: true,
      render: (event) => event.organizationName || `${event.firstName} ${event.lastName}`.trim() || 'N/A',
    },
    {
      id: 'eventStartTime',
      label: 'Event Start Time',
      width: '140px',
      sortable: true,
      render: (event) => event.eventStartTime || '',
    },
    {
      id: 'eventEndTime',
      label: 'Event End Time',
      width: '140px',
      render: (event) => event.eventEndTime || '',
    },
    {
      id: 'pickupTime',
      label: 'Pick up Time',
      width: '140px',
      sortable: true,
      render: (event) => event.pickupTime || '',
    },
    {
      id: 'allDetails',
      label: 'ALL DETAILS',
      width: '300px',
      render: (event) => {
        const details = [];
        if (event.message) details.push(event.message);
        if (event.planningNotes) details.push(`Planning: ${event.planningNotes}`);
        if (event.schedulingNotes) details.push(`Scheduling: ${event.schedulingNotes}`);
        if (event.additionalRequirements) details.push(`Requirements: ${event.additionalRequirements}`);
        return details.join(' | ') || '';
      },
    },
    {
      id: 'socialPost',
      label: 'Social Post',
      width: '150px',
      render: (event) => {
        if (event.socialMediaPostCompleted) return '✓ Completed';
        if (event.socialMediaPostRequested) return 'Requested';
        return '';
      },
    },
    {
      id: 'volunteersNeeded',
      label: 'Volunteers/Drivers/Speakers Needed?',
      width: '200px',
      render: (event) => {
        const needs = [];
        if (event.volunteersNeeded && event.volunteersNeeded > 0) needs.push(`${event.volunteersNeeded} volunteers`);
        if (event.driversNeeded && event.driversNeeded > 0) needs.push(`${event.driversNeeded} drivers`);
        if (event.speakersNeeded && event.speakersNeeded > 0) needs.push(`${event.speakersNeeded} speakers`);
        return needs.join(', ') || 'None';
      },
    },
    {
      id: 'estimatedSandwiches',
      label: 'Estimate # sandwiches',
      width: '150px',
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
      label: 'Deli or PBJ?',
      width: '120px',
      render: (event) => getSandwichTypeDisplay(event),
    },
    {
      id: 'finalSandwiches',
      label: 'Final # sandwiches made',
      width: '150px',
      render: (event) => event.actualSandwichCount?.toString() || '',
    },
    {
      id: 'toolkitSent',
      label: 'Sent toolkit',
      width: '120px',
      render: (event) => event.toolkitSent ? 'Yes' : 'No',
    },
    {
      id: 'contact',
      label: 'Contact',
      width: '150px',
      render: (event) => `${event.firstName || ''} ${event.lastName || ''}`.trim() || 'N/A',
    },
    {
      id: 'contactName',
      label: 'Contact Name',
      width: '150px',
      render: (event) => `${event.firstName || ''} ${event.lastName || ''}`.trim() || 'N/A',
    },
    {
      id: 'email',
      label: 'Email Address',
      width: '200px',
      render: (event) => event.email || event.updatedEmail || '',
    },
    {
      id: 'phone',
      label: 'Contact Cell Number',
      width: '150px',
      render: (event) => event.phone || '',
    },
    {
      id: 'tspContact',
      label: 'TSP Contact',
      width: '150px',
      render: (event) => {
        const contacts = [];
        if (event.tspContact) contacts.push(event.tspContact);
        if (event.tspContactAssigned) contacts.push(event.tspContactAssigned);
        if (event.customTspContact) contacts.push(event.customTspContact);
        return contacts.join(', ') || '';
      },
    },
    {
      id: 'address',
      label: 'Address',
      width: '250px',
      render: (event) => event.eventAddress || '',
    },
    {
      id: 'vanBooked',
      label: 'Van Booked?',
      width: '120px',
      render: (event) => event.vanDriverNeeded ? 'Yes' : 'No',
    },
    {
      id: 'notes',
      label: 'Notes',
      width: '200px',
      render: (event) => event.planningNotes || '',
    },
    {
      id: 'additionalNotes',
      label: 'Add\'l Notes',
      width: '200px',
      render: (event) => event.schedulingNotes || '',
    },
  ];

  // Reorder columns based on saved order
  const columns: Column[] = useMemo(() => {
    // Reorder columns if saved order exists
    if (columnOrder && columnOrder.length === defaultColumns.length) {
      const columnMap = new Map(defaultColumns.map(col => [col.id, col]));
      return columnOrder.map(id => columnMap.get(id)).filter(Boolean) as Column[];
    }
    
    return defaultColumns;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnOrder]);

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
    const isEditable = ['eventStartTime', 'eventEndTime', 'pickupTime', 'estimatedSandwiches', 'toolkitSent', 'tspContact', 'address', 'notes', 'additionalNotes'].includes(column.id);
    
    if (isEditing(event.id, column.id)) {
      // Special handling for toolkitSent (boolean)
      if (column.id === 'toolkitSent') {
        return (
          <div className="flex items-center gap-0.5">
            <Select
              value={editingValue}
              onValueChange={setEditingValue}
            >
              <SelectTrigger className="h-6 text-[11px] w-16 px-1.5 py-0.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={saveEdit} className="h-5 w-5 p-0">
              <Save className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-5 w-5 p-0">
              <X className="h-3 w-3" />
            </Button>
          </div>
        );
      }
      
      return (
        <div className="flex items-center gap-0.5">
          <Input
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            className="h-6 text-[11px] px-1.5 py-0.5"
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

    const content = column.render ? column.render(event) : '';
    
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
        <span className="text-[11px] truncate flex-1 leading-tight">{content || '-'}</span>
        {isEditable && (
          <button
            onClick={() => startEditing(event.id, column.id, getRawValue())}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <Edit2 className="h-3 w-3 text-[#007E8C]" />
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
                    className={`px-1.5 py-1 text-left text-[10px] font-semibold text-white border-r border-[#236383] whitespace-nowrap cursor-move select-none group ${
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
                            className="hover:bg-[#236383] rounded p-0.5 ml-0.5"
                          >
                            {isActive ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-2.5 w-2.5 text-white" />
                              ) : (
                                <ArrowDown className="h-2.5 w-2.5 text-white" />
                              )
                            ) : (
                              <ArrowUpDown className="h-2.5 w-2.5 text-white/70" />
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
                  className={`${getRowColor(index)} border-b border-gray-200 hover:bg-[#47B3CB]/10 transition-colors h-6`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className="px-1.5 py-1 border-r border-gray-200 text-[11px] leading-tight"
                      style={{ width: column.width, minWidth: column.width }}
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

