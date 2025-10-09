import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EventRequest, EventVolunteer } from '@shared/schema';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useAuth } from '@/hooks/useAuth';

export const useEventFilters = () => {
  const {
    eventRequests,
    searchQuery,
    statusFilter,
    sortBy,
    currentPage,
    itemsPerPage,
  } = useEventRequestContext();

  const { user } = useAuth();

  // Fetch event volunteers data
  const { data: eventVolunteers = [] } = useQuery<EventVolunteer[]>({
    queryKey: ['/api/event-requests/my-volunteers'],
    enabled: !!user?.id,
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
        
        // Check various possible structures in driverDetails
        if (driverDetails?.userId === user.id || 
            driverDetails?.driverId === user.id ||
            driverDetails?.assignedUserId === user.id ||
            (Array.isArray(driverDetails) && driverDetails.some(d => d.userId === user.id || d.driverId === user.id))) {
          return true;
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

  // Helper function to check if a date matches the search query
  const dateMatchesSearch = (dateValue: string | Date | null | undefined, searchQuery: string): boolean => {
    if (!dateValue || !searchQuery) return false;

    try {
      const dateStr = dateValue instanceof Date ? dateValue.toISOString() : dateValue.toString();
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return false;

      const searchLower = searchQuery.toLowerCase();

      const formats = [
        dateStr.toLowerCase(),
        date.toLocaleDateString(),
        date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        date.toISOString().split('T')[0],
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
      const matchesSearch =
        searchQuery === '' ||
        request.organizationName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (request.department && request.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        request.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (request.email && request.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (request.eventAddress && request.eventAddress.toLowerCase().includes(searchQuery.toLowerCase())) ||
        dateMatchesSearch(request.desiredEventDate, searchQuery);

      const matchesStatus =
        statusFilter === 'all' || request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort the filtered results
    filtered.sort((a: EventRequest, b: EventRequest) => {
      switch (sortBy) {
        case 'event_date_desc':
          const newestDateA = a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
          const newestDateB = b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
          return newestDateB - newestDateA;
        case 'event_date_asc':
          const oldestDateA = a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
          const oldestDateB = b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
          return oldestDateA - oldestDateB;
        case 'organization_asc':
          return a.organizationName.localeCompare(b.organizationName);
        case 'organization_desc':
          return b.organizationName.localeCompare(a.organizationName);
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
  }, [eventRequests, searchQuery, statusFilter, sortBy]);

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
          // AND exclude completed and declined events as they're not actionable
          matchesStatus = isUserAssignedToEvent(request) && request.status !== 'completed' && request.status !== 'declined';
        } else {
          // Regular status filtering
          matchesStatus = request.status === status;
        }
        
        const matchesSearch =
          searchQuery === '' ||
          request.organizationName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (request.department && request.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
          request.firstName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          request.lastName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (request.email && request.email
            .toLowerCase()
            .includes(searchQuery.toLowerCase())) ||
          (request.eventAddress && request.eventAddress.toLowerCase().includes(searchQuery.toLowerCase())) ||
          dateMatchesSearch(request.desiredEventDate, searchQuery);

        return matchesStatus && matchesSearch;
      })
      .sort((a: EventRequest, b: EventRequest) => {
        switch (sortBy) {
          case 'event_date_desc':
            const dateDescA = a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
            const dateDescB = b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
            return dateDescB - dateDescA;
          case 'event_date_asc':
            const dateAscA = a.desiredEventDate ? new Date(a.desiredEventDate).getTime() : 0;
            const dateAscB = b.desiredEventDate ? new Date(b.desiredEventDate).getTime() : 0;
            return dateAscA - dateAscB;
          case 'organization_asc':
            return a.organizationName.localeCompare(b.organizationName);
          case 'organization_desc':
            return b.organizationName.localeCompare(a.organizationName);
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