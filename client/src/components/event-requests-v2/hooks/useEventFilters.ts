import { useMemo } from 'react';
import type { EventRequest } from '@shared/schema';
import { useEventRequestContext } from '../context/EventRequestContext';

export const useEventFilters = () => {
  const {
    eventRequests,
    searchQuery,
    statusFilter,
    sortBy,
    currentPage,
    itemsPerPage,
  } = useEventRequestContext();

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
        request.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
        const matchesStatus = request.status === status;
        const matchesSearch =
          searchQuery === '' ||
          request.organizationName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          request.firstName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          request.lastName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          request.email
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
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
  };
};