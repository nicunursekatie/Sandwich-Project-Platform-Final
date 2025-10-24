import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import EventCard from '../cards/EventCard';

export const PostponedTab: React.FC = () => {
  const {
    currentPage,
    itemsPerPage,
  } = useEventRequestContext();

  const { filterRequestsByStatus } = useEventFilters();

  // Get postponed events with pagination
  const postponedRequests = filterRequestsByStatus('postponed');

  return (
    <div className="space-y-4">
      {postponedRequests.length > 0 ? (
        postponedRequests.map((request) => (
          <EventCard
            key={request.id}
            request={request}
          />
        ))
      ) : (
        <div className="text-center py-12 text-[#007E8C]">
          <p className="text-lg font-medium">No postponed events</p>
          <p className="text-sm text-gray-600 mt-2">Events that have been postponed will appear here</p>
        </div>
      )}
    </div>
  );
};
