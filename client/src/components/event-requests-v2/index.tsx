import React from 'react';
import { EventRequestProvider, useEventRequestContext } from './context/EventRequestContext';
import { NewRequestsTab } from './tabs/NewRequestsTab';
import { InProcessTab } from './tabs/InProcessTab';
import { ScheduledTab } from './tabs/ScheduledTab';
import { CompletedTab } from './tabs/CompletedTab';
import { DeclinedTab } from './tabs/DeclinedTab';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';

// Import existing components that we'll reuse
import RequestFilters from '@/components/event-requests/RequestFilters';
import EventSchedulingForm from '@/components/event-requests/EventSchedulingForm';
import EventCollectionLog from '@/components/event-requests/EventCollectionLog';
import ToolkitSentDialog from '@/components/event-requests/ToolkitSentDialog';
import FollowUpDialog from '@/components/event-requests/FollowUpDialog';
import { ScheduleCallDialog } from '@/components/event-requests/ScheduleCallDialog';
import ContactOrganizerDialog from '@/components/ContactOrganizerDialog';
import SandwichForecastWidget from '@/components/sandwich-forecast-widget';
import StaffingForecastWidget from '@/components/staffing-forecast-widget';
import { HelpCircle } from 'lucide-react';

// Import mutations hook
import { useEventMutations } from './hooks/useEventMutations';
import { useToast } from '@/hooks/use-toast';

// Import the TSP Contact Assignment Dialog
import { TspContactAssignmentDialog } from './dialogs/TspContactAssignmentDialog';
import { AssignmentDialog } from './dialogs/AssignmentDialog';

// Main component that uses the context
const EventRequestsManagementContent: React.FC = () => {
  const {
    eventRequests,
    isLoading,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    statusCounts,

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
    showTspContactAssignmentDialog,
    setShowTspContactAssignmentDialog,
    showAssignmentDialog,
    setShowAssignmentDialog,
    showSandwichPlanningModal,
    setShowSandwichPlanningModal,
    showStaffingPlanningModal,
    setShowStaffingPlanningModal,

    // Assignment dialog state
    assignmentType,
    setAssignmentType,
    assignmentEventId,
    setAssignmentEventId,
    selectedAssignees,
    setSelectedAssignees,

    // Selected events
    selectedEventRequest,
    setSelectedEventRequest,
    isEditing,
    setIsEditing,
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

    // Other states
    scheduleCallDate,
    setScheduleCallDate,
    scheduleCallTime,
    setScheduleCallTime,
    followUpNotes,
    setFollowUpNotes,
  } = useEventRequestContext();

  const {
    markToolkitSentMutation,
    scheduleCallMutation,
    oneDayFollowUpMutation,
    oneMonthFollowUpMutation,
    updateEventRequestMutation,
  } = useEventMutations();

  const { toast } = useToast();

  // Initialize modal sandwich state when opening details
  const initializeModalSandwichState = (eventRequest: any) => {
    // This would be handled in the EventSchedulingForm component
  };

  const handleScheduleCall = () => {
    if (!selectedEventRequest || !scheduleCallDate || !scheduleCallTime) return;

    const combinedDateTime = new Date(
      `${scheduleCallDate}T${scheduleCallTime}`
    ).toISOString();

    scheduleCallMutation.mutate({
      id: selectedEventRequest.id,
      scheduledCallDate: combinedDateTime,
    });
  };

  if (isLoading) {
    return <div>Loading event requests...</div>;
  }

  // Calculate total for filters
  const totalItems = eventRequests.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Event Requests Management</h1>
            <p className="text-[#236383]">
              Manage and track event requests from organizations
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => {
                setShowScheduleCallDialog(false);
                setShowOneDayFollowUpDialog(false);
                setShowOneMonthFollowUpDialog(false);
                setShowToolkitSentDialog(false);

                setSelectedEventRequest(null);
                setIsEditing(true);
                setShowEventDetails(true);
                initializeModalSandwichState(null);
              }}
              className="text-white"
              style={{ backgroundColor: '#007E8C' }}
              data-testid="button-add-manual-event"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Manual Event Request
            </Button>
            <Button
              onClick={() => setShowSandwichPlanningModal(true)}
              variant="outline"
              className="flex items-center space-x-2"
              data-testid="button-sandwich-planning"
            >
              <span className="text-lg mr-1">🥪</span>
              <span>Sandwich Planning</span>
            </Button>
            <Button
              onClick={() => setShowStaffingPlanningModal(true)}
              variant="outline"
              className="flex items-center space-x-2"
              data-testid="button-staffing-planning"
            >
              <Users className="w-4 h-4" />
              <span>Staffing Planning</span>
            </Button>
            <Badge
              variant="secondary"
              className="bg-brand-primary text-white px-3 py-1 text-sm"
            >
              {eventRequests.length} Total Requests
            </Badge>
          </div>
        </div>

        {/* Filters and Tabs */}
        <RequestFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          currentPage={currentPage}
          onCurrentPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          statusCounts={statusCounts}
          totalItems={totalItems}
          totalPages={totalPages}
          children={{
            new: <NewRequestsTab />,
            in_process: <InProcessTab />,
            scheduled: <ScheduledTab />,
            completed: <CompletedTab />,
            declined: <DeclinedTab />,
          }}
        />

        {/* Event Details Edit Modal */}
        {showEventDetails && (selectedEventRequest || isEditing) && (
          <EventSchedulingForm
            eventRequest={selectedEventRequest}
            isOpen={showEventDetails}
            mode={selectedEventRequest ? "edit" : "create"}
            onClose={() => {
              setShowEventDetails(false);
              setSelectedEventRequest(null);
              setIsEditing(false);
            }}
            onEventScheduled={() => {
              setShowEventDetails(false);
              setSelectedEventRequest(null);
              setIsEditing(false);
            }}
          />
        )}

        {/* Event Scheduling Dialog */}
        {showSchedulingDialog && schedulingEventRequest && (
          <EventSchedulingForm
            eventRequest={schedulingEventRequest}
            isOpen={showSchedulingDialog}
            onClose={() => {
              setShowSchedulingDialog(false);
              setSchedulingEventRequest(null);
            }}
            onEventScheduled={() => {
              setShowSchedulingDialog(false);
              setSchedulingEventRequest(null);
            }}
          />
        )}

        {/* Collection Log Dialog */}
        {showCollectionLog && collectionLogEventRequest && (
          <EventCollectionLog
            eventRequest={collectionLogEventRequest}
            isOpen={showCollectionLog}
            onClose={() => {
              setShowCollectionLog(false);
              setCollectionLogEventRequest(null);
            }}
          />
        )}

        {/* Toolkit Sent Dialog */}
        {showToolkitSentDialog && toolkitEventRequest && (
          <ToolkitSentDialog
            eventRequest={toolkitEventRequest}
            isOpen={showToolkitSentDialog}
            onClose={() => {
              setShowToolkitSentDialog(false);
              setToolkitEventRequest(null);
            }}
            onToolkitSent={(details: any) => {
              if (toolkitEventRequest) {
                markToolkitSentMutation.mutate({
                  id: toolkitEventRequest.id,
                  toolkitSentDate: details.toolkitSentDate,
                });
              }
            }}
            isLoading={markToolkitSentMutation.isPending}
          />
        )}

        {/* Schedule Call Dialog */}
        <ScheduleCallDialog
          isOpen={showScheduleCallDialog}
          onClose={() => setShowScheduleCallDialog(false)}
          eventRequest={selectedEventRequest}
          onCallScheduled={handleScheduleCall}
          isLoading={scheduleCallMutation.isPending}
          scheduleCallDate={scheduleCallDate}
          setScheduleCallDate={setScheduleCallDate}
          scheduleCallTime={scheduleCallTime}
          setScheduleCallTime={setScheduleCallTime}
        />

        {/* 1-Day Follow-up Dialog */}
        <FollowUpDialog
          isOpen={showOneDayFollowUpDialog}
          onClose={() => setShowOneDayFollowUpDialog(false)}
          eventRequest={selectedEventRequest}
          onFollowUpCompleted={(notes) => {
            if (selectedEventRequest) {
              oneDayFollowUpMutation.mutate({
                id: selectedEventRequest.id,
                notes,
              });
            }
          }}
          isLoading={oneDayFollowUpMutation.isPending}
          followUpType="1-day"
          notes={followUpNotes}
          setNotes={setFollowUpNotes}
        />

        {/* 1-Month Follow-up Dialog */}
        <FollowUpDialog
          isOpen={showOneMonthFollowUpDialog}
          onClose={() => setShowOneMonthFollowUpDialog(false)}
          eventRequest={selectedEventRequest}
          onFollowUpCompleted={(notes) => {
            if (selectedEventRequest) {
              oneMonthFollowUpMutation.mutate({
                id: selectedEventRequest.id,
                notes,
              });
            }
          }}
          isLoading={oneMonthFollowUpMutation.isPending}
          followUpType="1-month"
          notes={followUpNotes}
          setNotes={setFollowUpNotes}
        />

        {/* Contact Organizer Dialog */}
        <ContactOrganizerDialog
          isOpen={showContactOrganizerDialog}
          onClose={() => {
            setShowContactOrganizerDialog(false);
            setContactEventRequest(null);
          }}
          eventRequest={contactEventRequest}
        />

        {/* TSP Contact Assignment Dialog */}
        <TspContactAssignmentDialog
          isOpen={showTspContactAssignmentDialog}
          onClose={() => {
            setShowTspContactAssignmentDialog(false);
            setTspContactEventRequest(null);
          }}
          eventRequestId={tspContactEventRequest?.id || 0}
          eventRequestTitle={tspContactEventRequest?.organizationName}
          currentTspContact={tspContactEventRequest?.tspContact}
          currentCustomTspContact={tspContactEventRequest?.customTspContact}
        />

        {/* General Assignment Dialog for Drivers/Speakers/Volunteers */}
        <AssignmentDialog
          isOpen={showAssignmentDialog}
          onClose={() => {
            setShowAssignmentDialog(false);
            setAssignmentType(null);
            setAssignmentEventId(null);
            setSelectedAssignees([]);
          }}
          assignmentType={assignmentType}
          selectedAssignees={selectedAssignees}
          setSelectedAssignees={setSelectedAssignees}
          onAssign={async (assignees: string[]) => {
            if (!assignmentEventId || !assignmentType) return;

            try {
              // Update the event with the new assignments
              const fieldMap = {
                'driver': 'assignedDriverIds',
                'speaker': 'speakerDetails',
                'volunteer': 'assignedVolunteerIds'
              };

              const field = fieldMap[assignmentType];
              await updateEventRequestMutation.mutateAsync({
                id: assignmentEventId,
                data: { [field]: assignees }
              });

              // Close the dialog
              setShowAssignmentDialog(false);
              setAssignmentType(null);
              setAssignmentEventId(null);
              setSelectedAssignees([]);

              toast({
                title: 'Success',
                description: `${assignmentType}s assigned successfully`,
              });
            } catch (error) {
              toast({
                title: 'Error',
                description: `Failed to assign ${assignmentType}s`,
                variant: 'destructive',
              });
            }
          }}
        />

        {/* Sandwich Planning Modal */}
        <Dialog open={showSandwichPlanningModal} onOpenChange={setShowSandwichPlanningModal}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-brand-primary flex items-center gap-3">
                <Package className="w-6 h-6" />
                Weekly Sandwich Planning
              </DialogTitle>
              <DialogDescription>
                Plan sandwich production based on scheduled events. Monitor trends and adjust quantities based on demand patterns.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-6">
              <SandwichForecastWidget />

              <div className="bg-[#e6f2f5] border border-[#007E8C]/30 rounded-lg p-4">
                <h4 className="font-semibold text-[#1A2332] mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Sandwich Planning Tips
                </h4>
                <ul className="text-sm text-[#236383] space-y-1">
                  <li>• Plan sandwich types based on dietary restrictions and preferences</li>
                  <li>• Factor in 10-15% extra sandwiches for unexpected attendees</li>
                  <li>• Coordinate with kitchen volunteers for preparation schedules</li>
                  <li>• Check delivery addresses for any special requirements</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t">
              <Button
                onClick={() => setShowSandwichPlanningModal(false)}
                className="text-white"
                style={{ backgroundColor: '#236383' }}
              >
                Close Sandwich Planning
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Staffing Planning Modal */}
        <Dialog open={showStaffingPlanningModal} onOpenChange={setShowStaffingPlanningModal}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-brand-primary flex items-center gap-3">
                <Users className="w-6 h-6" />
                Weekly Staffing Planning
              </DialogTitle>
              <DialogDescription>
                Coordinate drivers, speakers, and volunteers for scheduled events. Ensure all positions are filled before event dates.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-6">
              <StaffingForecastWidget />

              <div className="bg-[#e6f2f5] border border-[#007E8C]/30 rounded-lg p-4">
                <h4 className="font-semibold text-[#1A2332] mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Staffing Planning Tips
                </h4>
                <ul className="text-sm text-[#236383] space-y-1">
                  <li>• Check driver assignments early - transportation is critical</li>
                  <li>• Speaker assignments should be confirmed 1 week before events</li>
                  <li>• Van drivers are needed for large events or special delivery requirements</li>
                  <li>• Volunteers help with event setup and sandwich distribution</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t">
              <Button
                onClick={() => setShowStaffingPlanningModal(false)}
                className="text-white"
                style={{ backgroundColor: '#236383' }}
              >
                Close Staffing Planning
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

// Main component with provider wrapper
export default function EventRequestsManagementV2({
  initialTab,
  initialEventId,
}: {
  initialTab?: string | null;
  initialEventId?: number;
} = {}) {
  return (
    <EventRequestProvider initialTab={initialTab} initialEventId={initialEventId}>
      <EventRequestsManagementContent />
    </EventRequestProvider>
  );
}