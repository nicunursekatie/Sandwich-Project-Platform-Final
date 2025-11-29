import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EventRequest, EventVolunteer } from '@shared/schema';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useAuth } from '@/hooks/useAuth';

export const useEventFilters = () => {
  const {
    eventRequests,
    debouncedSearchQuery,
    statusFilter,
    myAssignmentsStatusFilter,
    confirmationFilter,
    sortBy,
    currentPage,
    itemsPerPage,
  } = useEventRequestContext();

  const { user } = useAuth();

  // Fetch event volunteers data for all events (needed for search)
  const { data: eventVolunteers = [] } = useQuery<EventVolunteer[]>({
    queryKey: ['/api/event-requests/all-volunteers'],
    enabled: true,
  });

  // Fetch users to get TSP contact names
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    enabled: true,
  });

  // Helper function to check if current user is assigned to an event
  const isUserAssignedToEvent = (request: EventRequest): boolean => {
    if (!user?.id) return false;

    // Check TSP Contact assignment (both old and new column names)
    if (request.tspContactAssigned === user.id || request.tspContact === user.id) {
      return true;
    }

    // Also check additional TSP contacts
    if (request.additionalContact1 === user.id || request.additionalContact2 === user.id) {
      return true;
    }

    // Check driver assignment in driverDetails JSONB field
    if (request.driverDetails) {
      try {
        const driverDetails = typeof request.driverDetails === 'string'
          ? JSON.parse(request.driverDetails)
          : request.driverDetails;

        // Driver assignments are stored as keys in the driverDetails object
        // Example: {"351": {"name": "Gary Munder", "assignedBy": "admin_..."}}
        if (driverDetails && typeof driverDetails === 'object' && !Array.isArray(driverDetails)) {
          const driverKeys = Object.keys(driverDetails);
          if (driverKeys.some(key => key === user.id || key === user.id.toString())) {
            return true;
          }
        }
      } catch (e) {
        // If parsing fails, continue with other checks
      }
    }

    // Check speaker assignment in speakerDetails JSONB field
    if (request.speakerDetails) {
      try {
        const speakerDetails = typeof request.speakerDetails === 'string'
          ? JSON.parse(request.speakerDetails)
          : request.speakerDetails;

        // Speaker assignments are stored as keys in the speakerDetails object
        if (speakerDetails && typeof speakerDetails === 'object' && !Array.isArray(speakerDetails)) {
          const speakerKeys = Object.keys(speakerDetails);
          if (speakerKeys.some(key => key === user.id || key === user.id.toString())) {
            return true;
          }
        }
      } catch (e) {
        // If parsing fails, continue with other checks
      }
    }

    // Check event volunteers assignment (driver, speaker, general)
    const userVolunteerAssignment = eventVolunteers.find(volunteer =>
      volunteer.eventRequestId === request.id &&
      volunteer.volunteerUserId === user.id
    );

    if (userVolunteerAssignment) {
      return true;
    }

    return false;
  };

  // Get user's assigned events regardless of status
  const userAssignedEvents = useMemo(() => {
    return eventRequests.filter(isUserAssignedToEvent);
  }, [eventRequests, eventVolunteers, user?.id]);

  // Helper function to get TSP contact name from user ID
  const getTspContactName = (userId: string | null | undefined): string => {
    if (!userId) return '';
    const user = users.find(u => u.id === userId);
    if (!user) return '';
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || user.email || user.name || '';
  };

  // Helper function to check if event has a volunteer matching the search
  const eventHasVolunteerMatch = (request: EventRequest, searchLower: string): boolean => {
    // Get all volunteers for this event from eventVolunteers table
    const eventVolunteersList = eventVolunteers.filter(v => v.eventRequestId === request.id);

    // Check registered volunteers (with user IDs)
    for (const volunteer of eventVolunteersList) {
      if (volunteer.volunteerUserId) {
        const volunteerName = getTspContactName(volunteer.volunteerUserId);
        if (volunteerName.toLowerCase().includes(searchLower)) {
          return true;
        }
      }
      // Check non-registered volunteers
      if (volunteer.volunteerName && volunteer.volunteerName.toLowerCase().includes(searchLower)) {
        return true;
      }
      if (volunteer.volunteerEmail && volunteer.volunteerEmail.toLowerCase().includes(searchLower)) {
        return true;
      }
    }

    // Also check legacy assignedSpeakerIds array
    if (request.assignedSpeakerIds && Array.isArray(request.assignedSpeakerIds)) {
      for (const speakerId of request.assignedSpeakerIds) {
        const speakerName = getTspContactName(speakerId);
        if (speakerName.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Also check if it's a direct name string
        if (typeof speakerId === 'string' && speakerId.toLowerCase().includes(searchLower)) {
          return true;
        }
      }
    }

    // Check assignedVolunteerIds array
    if (request.assignedVolunteerIds && Array.isArray(request.assignedVolunteerIds)) {
      for (const volunteerId of request.assignedVolunteerIds) {
        const volunteerName = getTspContactName(volunteerId);
        if (volunteerName.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Also check if it's a direct name string
        if (typeof volunteerId === 'string' && volunteerId.toLowerCase().includes(searchLower)) {
          return true;
        }
      }
    }

    // Check assignedDriverIds array
    if (request.assignedDriverIds && Array.isArray(request.assignedDriverIds)) {
      for (const driverId of request.assignedDriverIds) {
        const driverName = getTspContactName(driverId);
        if (driverName.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Also check if it's a direct name string
        if (typeof driverId === 'string' && driverId.toLowerCase().includes(searchLower)) {
          return true;
        }
      }
    }

    return false;
  };

  // Helper to parse date in local timezone (avoids UTC midnight timezone shift)
  const parseLocalDate = (dateInput: string | Date | null | undefined): Date | null => {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    if (typeof dateInput !== 'string') return null;
    // If it's just a date (YYYY-MM-DD), parse in local time to avoid timezone shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [year, month, day] = dateInput.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    // For ISO datetime strings, still parse but the date portion will be correct
    const parsed = new Date(dateInput);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  // Helper function to check if a date matches the search query
  const dateMatchesSearch = (dateValue: string | Date | null | undefined, searchQuery: string): boolean => {
    if (!dateValue || !searchQuery) return false;

    try {
      const date = parseLocalDate(dateValue);
      if (!date) return false;

      const searchLower = searchQuery.toLowerCase();

      const formats = [
        date.toLocaleDateString(),
        date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`,
        `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`,
        `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`,
      ];

      return formats.some(format => format.toLowerCase().includes(searchLower));
    } catch (error) {
      return false;
    }
  };

  // Filter and sort event requests
  const filteredAndSortedRequests = useMemo(() => {
    let filtered = eventRequests.filter((request: EventRequest) => {
      // Search matching
      let matchesSearch = debouncedSearchQuery === '';

      if (!matchesSearch) {
        const searchLower = debouncedSearchQuery.toLowerCase();

        // Check TSP contacts
        const tspContactName = getTspContactName(request.tspContact || request.tspContactAssigned);
        const additionalContact1Name = getTspContactName(request.additionalContact1);
        const additionalContact2Name = getTspContactName(request.additionalContact2);
        const customTspContact = request.customTspContact || '';

        const matchesTspContact =
          tspContactName.toLowerCase().includes(searchLower) ||
          additionalContact1Name.toLowerCase().includes(searchLower) ||
          additionalContact2Name.toLowerCase().includes(searchLower) ||
          customTspContact.toLowerCase().includes(searchLower);

        // Check volunteers (drivers, speakers, general)
        const matchesVolunteer = eventHasVolunteerMatch(request, searchLower);

        matchesSearch =
          (request.organizationName && request.organizationName
            .toLowerCase()
            .includes(searchLower)) ||
          (request.department && request.department.toLowerCase().includes(searchLower)) ||
          (request.firstName && request.firstName.toLowerCase().includes(searchLower)) ||
          (request.lastName && request.lastName.toLowerCase().includes(searchLower)) ||
          (request.email && request.email.toLowerCase().includes(searchLower)) ||
          (request.eventAddress && request.eventAddress.toLowerCase().includes(searchLower)) ||
          dateMatchesSearch(request.desiredEventDate, debouncedSearchQuery) ||
          matchesTspContact ||
          matchesVolunteer;
      }

      const matchesStatus =
        statusFilter === 'all' || request.status === statusFilter;

      // Completed events are always considered confirmed
      const isEventConfirmed = request.status === 'completed' || request.isConfirmed;

      const matchesConfirmation =
        confirmationFilter === 'all' ||
        (confirmationFilter === 'confirmed' && isEventConfirmed) ||
        (confirmationFilter === 'requested' && !isEventConfirmed);

      return matchesSearch && matchesStatus && matchesConfirmation;
    });

    // Sort the filtered results
    filtered.sort((a: EventRequest, b: EventRequest) => {
      switch (sortBy) {
        case 'event_date_desc':
          // For completed events, use scheduledEventDate if available, otherwise desiredEventDate
          const newestDateA = (a.status === 'completed' && a.scheduledEventDate)
            ? new Date(a.scheduledEventDate).getTime()
            : a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
          const newestDateB = (b.status === 'completed' && b.scheduledEventDate)
            ? new Date(b.scheduledEventDate).getTime()
            : b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
          return newestDateB - newestDateA;
        case 'event_date_asc':
          // For completed events, use scheduledEventDate if available, otherwise desiredEventDate
          const oldestDateA = (a.status === 'completed' && a.scheduledEventDate)
            ? new Date(a.scheduledEventDate).getTime()
            : a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
          const oldestDateB = (b.status === 'completed' && b.scheduledEventDate)
            ? new Date(b.scheduledEventDate).getTime()
            : b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
          return oldestDateA - oldestDateB;
        case 'organization_asc':
          return (a.organizationName || '').localeCompare(b.organizationName || '');
        case 'organization_desc':
          return (b.organizationName || '').localeCompare(a.organizationName || '');
        case 'created_date_desc':
          const createdDateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdDateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return createdDateB - createdDateA;
        case 'created_date_asc':
          const oldCreatedDateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const oldCreatedDateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return oldCreatedDateA - oldCreatedDateB;
        default:
          return 0;
      }
    });

    return filtered;
  }, [eventRequests, debouncedSearchQuery, statusFilter, confirmationFilter, sortBy, eventVolunteers, users]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = filteredAndSortedRequests.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Filter by status for tab display
  const filterRequestsByStatus = (status: string) => {
    return eventRequests
      .filter((request: EventRequest) => {
        let matchesStatus: boolean;

        if (status === 'my_assignments') {
          // Special handling for my assignments - check if user is assigned
          // AND filter by selected statuses in myAssignmentsStatusFilter
          matchesStatus = isUserAssignedToEvent(request) && myAssignmentsStatusFilter.includes(request.status);
        } else {
          // Regular status filtering
          matchesStatus = request.status === status;
        }

        let matchesSearch = debouncedSearchQuery === '';

        if (!matchesSearch) {
          const searchLower = debouncedSearchQuery.toLowerCase();

          // Check TSP contacts
          const tspContactName = getTspContactName(request.tspContact || request.tspContactAssigned);
          const additionalContact1Name = getTspContactName(request.additionalContact1);
          const additionalContact2Name = getTspContactName(request.additionalContact2);
          const customTspContact = request.customTspContact || '';

          const matchesTspContact =
            tspContactName.toLowerCase().includes(searchLower) ||
            additionalContact1Name.toLowerCase().includes(searchLower) ||
            additionalContact2Name.toLowerCase().includes(searchLower) ||
            customTspContact.toLowerCase().includes(searchLower);

          // Check volunteers (drivers, speakers, general)
          const matchesVolunteer = eventHasVolunteerMatch(request, searchLower);

          matchesSearch =
            (request.organizationName && request.organizationName
              .toLowerCase()
              .includes(searchLower)) ||
            (request.department && request.department.toLowerCase().includes(searchLower)) ||
            (request.firstName && request.firstName
              .toLowerCase()
              .includes(searchLower)) ||
            (request.lastName && request.lastName
              .toLowerCase()
              .includes(searchLower)) ||
            (request.email && request.email
              .toLowerCase()
              .includes(searchLower)) ||
            (request.eventAddress && request.eventAddress.toLowerCase().includes(searchLower)) ||
            dateMatchesSearch(request.desiredEventDate, debouncedSearchQuery) ||
            matchesTspContact ||
            matchesVolunteer;
        }

        // Completed events are always considered confirmed
        const isEventConfirmed = request.status === 'completed' || request.isConfirmed;

        const matchesConfirmation =
          confirmationFilter === 'all' ||
          (confirmationFilter === 'confirmed' && isEventConfirmed) ||
          (confirmationFilter === 'requested' && !isEventConfirmed);

        return matchesStatus && matchesSearch && matchesConfirmation;
      })
      .sort((a: EventRequest, b: EventRequest) => {
        switch (sortBy) {
          case 'event_date_desc':
            // For completed events, use scheduledEventDate if available, otherwise desiredEventDate
            const dateDescA = (status === 'completed' && a.scheduledEventDate) 
              ? new Date(a.scheduledEventDate).getTime()
              : a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
            const dateDescB = (status === 'completed' && b.scheduledEventDate)
              ? new Date(b.scheduledEventDate).getTime()
              : b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
            return dateDescB - dateDescA;
          case 'event_date_asc':
            // For completed events, use scheduledEventDate if available, otherwise desiredEventDate
            const dateAscA = (status === 'completed' && a.scheduledEventDate)
              ? new Date(a.scheduledEventDate).getTime()
              : a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
            const dateAscB = (status === 'completed' && b.scheduledEventDate)
              ? new Date(b.scheduledEventDate).getTime()
              : b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
            return dateAscA - dateAscB;
          case 'organization_asc':
            return (a.organizationName || '').localeCompare(b.organizationName || '');
          case 'organization_desc':
            return (b.organizationName || '').localeCompare(a.organizationName || '');
          case 'created_date_desc':
            const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return createdB - createdA;
          case 'created_date_asc':
            const createdAscA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const createdAscB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return createdAscA - createdAscB;
          default:
            return 0;
        }
      })
      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  };

  return {
    filteredAndSortedRequests,
    paginatedRequests,
    totalPages,
    filterRequestsByStatus,
    dateMatchesSearch,
    userAssignedEvents,
    isUserAssignedToEvent,
  };
};