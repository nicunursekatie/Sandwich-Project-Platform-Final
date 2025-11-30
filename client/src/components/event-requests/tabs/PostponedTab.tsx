import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { PostponedCard } from '../cards/PostponedCard';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportEventRequestsToExcel } from '@/lib/excel-export';

export const PostponedTab: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation } = useEventMutations();
  const { handleStatusChange, resolveUserName } = useEventAssignments();

  const {
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
    setShowContactOrganizerDialog,
    setContactEventRequest,
    setShowLogContactDialog,
    setLogContactEventRequest,
  } = useEventRequestContext();

  const postponedRequests = filterRequestsByStatus('postponed');

  const handleExport = async () => {
    if (postponedRequests.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no postponed events to export.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await exportEventRequestsToExcel(postponedRequests, 'postponed');
      toast({
        title: 'Export complete',
        description: `Exported ${postponedRequests.length} postponed event${postponedRequests.length !== 1 ? 's' : ''} to Excel.`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export events. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCall = (request: any) => {
    const phoneNumber = request.phone;

    if (isMobile) {
      window.location.href = `tel:${phoneNumber}`;
    } else {
      navigator.clipboard.writeText(phoneNumber || '').then(() => {
        toast({
          title: 'Phone number copied!',
          description: `${phoneNumber} has been copied to your clipboard.`,
        });
      }).catch(() => {
        toast({
          title: 'Failed to copy',
          description: 'Please copy manually: ' + phoneNumber,
          variant: 'destructive',
        });
      });
    }
  };

  return (
    <>
      {/* Header with count and export button */}
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="text-sm text-gray-600">
          {postponedRequests.length} postponed event{postponedRequests.length !== 1 ? 's' : ''}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={postponedRequests.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <div className="space-y-4">
        {postponedRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No postponed events
          </div>
        ) : (
          postponedRequests.map((request) => (
          <PostponedCard
            key={request.id}
            request={request}
            resolveUserName={resolveUserName}
            onView={() => {
              setSelectedEventRequest(request);
              setIsEditing(false);
              setShowEventDetails(true);
            }}
            onDelete={() => {
              if (window.confirm('Are you sure you want to permanently delete this postponed event?')) {
                deleteEventRequestMutation.mutate(request.id);
              }
            }}
            onContact={() => {
              setContactEventRequest(request);
              setShowContactOrganizerDialog(true);
            }}
            onCall={() => handleCall(request)}
            onReactivate={() => {
              if (window.confirm('Do you want to reactivate this event request?')) {
                handleStatusChange(request.id, 'new');
                toast({
                  title: 'Event reactivated',
                  description: 'The event request has been moved back to New Requests.',
                });
              }
            }}
            onLogContact={() => {
              setLogContactEventRequest(request);
              setShowLogContactDialog(true);
            }}
          />
          ))
        )}
      </div>
    </>
  );
};
