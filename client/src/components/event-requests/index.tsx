import React, { useEffect, useMemo } from 'react';
import {
  EventRequestProvider,
  useEventRequestContext,
} from './context/EventRequestContext';
import { NewRequestsTab } from './tabs/NewRequestsTab';
import { InProcessTab } from './tabs/InProcessTab';
import { ScheduledTab } from './tabs/ScheduledTab';
import { CompletedTab } from './tabs/CompletedTab';
import { DeclinedTab } from './tabs/DeclinedTab';
import { MyAssignmentsTab } from './tabs/MyAssignmentsTab';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Package, HelpCircle, Calendar, List } from 'lucide-react';
import { EventCalendarView } from '@/components/event-calendar-view';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent
} from '@/components/ui/tooltip';

// Import existing components that we'll reuse
import RequestFilters from '@/components/event-requests/RequestFilters';
import EventSchedulingForm from '@/components/event-requests/EventSchedulingForm';
import EventCollectionLog from '@/components/event-requests/EventCollectionLog';
import ToolkitSentDialog from '@/components/event-requests/ToolkitSentDialog';
import FollowUpDialog from '@/components/event-requests/FollowUpDialog';
import { ScheduleCallDialog } from '@/components/event-requests/ScheduleCallDialog';
import ContactOrganizerDialog from '@/components/ContactOrganizerDialog';
import LogContactAttemptDialog from '@/components/LogContactAttemptDialog';
import SandwichForecastWidget from '@/components/sandwich-forecast-widget';
import StaffingForecastWidget from '@/components/staffing-forecast-widget';

// Import hooks
import { useEventMutations } from './hooks/useEventMutations';
import { useEventQueries } from './hooks/useEventQueries';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAnalytics } from '@/hooks/useAnalytics';

// Import dialogs
import { TspContactAssignmentDialog } from './dialogs/TspContactAssignmentDialog';
import { AssignmentDialog } from './dialogs/AssignmentDialog';
import { MissingInfoSummaryDialog } from './MissingInfoSummaryDialog';
import { ToolkitSentPendingDialog } from './ToolkitSentPendingDialog';
import { AiDateSuggestionDialog } from './dialogs/AiDateSuggestionDialog';
import { AiIntakeAssistantDialog } from './dialogs/AiIntakeAssistantDialog';
import { logger } from '@/lib/logger';
import { getRoleViewDescription } from '@shared/role-view-defaults';
import { Info } from 'lucide-react';

// Main component that uses the context
const EventRequestsManagementContent: React.FC = () => {
  const {
    eventRequests,
    isLoading,
    viewMode,
    setViewMode,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    confirmationFilter,
    setConfirmationFilter,
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
    showLogContactDialog,
    setShowLogContactDialog,
    showAiDateSuggestionDialog,
    setShowAiDateSuggestionDialog,
    showAiIntakeAssistantDialog,
    setShowAiIntakeAssistantDialog,

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
    logContactEventRequest,
    setLogContactEventRequest,
    aiSuggestionEventRequest,
    setAiSuggestionEventRequest,
    aiIntakeAssistantEventRequest,
    setAiIntakeAssistantEventRequest,

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
    assignRecipientsMutation,
    oneMonthFollowUpMutation,
    updateEventRequestMutation,
  } = useEventMutations();

  const { users, drivers, hostsWithContacts } = useEventQueries();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { trackButtonClick, trackFormSubmit } = useAnalytics();

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Memoize tab children to prevent recreation on every render
  const tabChildren = useMemo(() => ({
    new: <NewRequestsTab />,
    in_process: <InProcessTab />,
    scheduled: <ScheduledTab />,
    completed: <CompletedTab />,
    declined: <DeclinedTab />,
    my_assignments: <MyAssignmentsTab />,
  }), []);

  const handleScheduleCall = () => {
    if (!selectedEventRequest || !scheduleCallDate || !scheduleCallTime) return;

    const combinedDateTime = new Date(
      `${scheduleCallDate}T${scheduleCallTime}`
    ).toISOString();

    trackButtonClick('schedule_call', 'event_requests');
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
      <div className="space-y-4 premium-gradient-subtle min-h-screen p-4">
        {/* Header */}
        <div className="premium-card p-6">
          <div className={`${isMobile ? 'flex flex-col space-y-4' : 'flex items-center justify-between'}`}>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`premium-text-h1 ${isMobile ? '' : ''}`}>Event Requests Management</h1>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-teal-600 hover:text-teal-800 transition-colors">
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs premium-tooltip">
                    <p className="font-semibold mb-1">Event Requests Help</p>
                    <p className="text-sm">Track and manage all event requests from organizations. Use tabs to filter by status, assign TSP contacts, schedule events, and plan sandwich deliveries.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="premium-text-body text-brand-primary">
                {isMobile ? 'Manage event requests' : 'Manage and track event requests from organizations'}
              </p>
            </div>
            <div className={`${isMobile ? 'flex flex-col space-y-2 w-full' : 'flex items-center gap-2 flex-wrap'}`}>
              <button
                onClick={() => {
                  setShowScheduleCallDialog(false);
                  setShowOneDayFollowUpDialog(false);
                  setShowOneMonthFollowUpDialog(false);
                  setShowToolkitSentDialog(false);
                  setSelectedEventRequest(null);
                  setIsEditing(true);
                  setShowEventDetails(true);
                }}
                className="premium-btn-outline"
                data-testid="button-add-manual-event"
              >
                <Plus className="w-4 h-4" />
                {isMobile ? 'Add Event' : 'Add Manual Event Request'}
              </button>
              <button
                onClick={() => setShowSandwichPlanningModal(true)}
                className="premium-btn-outline"
                data-testid="button-sandwich-planning"
              >
                <span className="text-lg">🥪</span>
                <span className={isMobile ? 'hidden' : ''}>Sandwich Planning</span>
              </button>
              <button
                onClick={() => setShowStaffingPlanningModal(true)}
                className="premium-btn-outline"
                data-testid="button-staffing-planning"
              >
                <Users className="w-4 h-4" />
                <span className={isMobile ? 'hidden' : ''}>Staffing Planning</span>
              </button>
              <MissingInfoSummaryDialog />
              <ToolkitSentPendingDialog />
            </div>
          </div>
        </div>

        {/* Role-customized view indicator */}
        {user?.role && user.role !== 'super_admin' && user.role !== 'admin' && (
          <div className="premium-card-flat p-3 border-l-4" style={{
            backgroundColor: 'rgba(0, 126, 140, 0.08)',
            borderLeftColor: '#007E8C'
          }}>
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#007E8C' }} />
              <p className="text-sm" style={{ color: '#236383' }}>
                {getRoleViewDescription(user.role, 'events')}
              </p>
            </div>
          </div>
        )}

        {/* View Mode Toggle - Separate Row */}
        <div className="flex items-center justify-center">
          <div className="premium-card-flat flex items-center gap-1 p-1">
            <button
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'premium-btn-primary premium-btn-sm' : 'premium-btn-ghost premium-btn-sm'}
            >
              <List className="w-4 h-4" />
              {!isMobile && 'List View'}
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={viewMode === 'calendar' ? 'premium-btn-primary premium-btn-sm' : 'premium-btn-ghost premium-btn-sm'}
            >
              <Calendar className="w-4 h-4" />
              {!isMobile && 'Calendar View'}
            </button>
          </div>
        </div>

        {/* View Content: Calendar or List */}
        {viewMode === 'calendar' ? (
          <EventCalendarView
            onEventClick={(event) => {
              setSelectedEventRequest(event);
              setShowEventDetails(true);
              setIsEditing(false);
            }}
          />
        ) : (
          /* Filters and Tabs */
          <RequestFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            confirmationFilter={confirmationFilter}
            onConfirmationFilterChange={setConfirmationFilter}
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
            children={tabChildren}
          />
        )}

        {/* Event Details Edit Modal */}
        {showEventDetails && (selectedEventRequest || isEditing) && (
          <EventSchedulingForm
            eventRequest={selectedEventRequest}
            isOpen={showEventDetails}
            mode={selectedEventRequest ? 'edit' : 'create'}
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
        {/* Collection Log Dialog */}
        {showCollectionLog && collectionLogEventRequest && (
          <EventCollectionLog
            eventRequest={collectionLogEventRequest}
            isVisible={showCollectionLog}
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
                trackButtonClick('mark_toolkit_sent', 'event_requests');
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
              trackButtonClick('1day_followup', 'event_requests');
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
              trackButtonClick('1month_followup', 'event_requests');
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

        {/* Log Contact Attempt Dialog */}
        <LogContactAttemptDialog
          isOpen={showLogContactDialog}
          onClose={() => {
            setShowLogContactDialog(false);
            setLogContactEventRequest(null);
          }}
          eventRequest={logContactEventRequest}
          onLogContact={async (data) => {
            if (!logContactEventRequest) return;
            await updateEventRequestMutation.mutateAsync({
              id: logContactEventRequest.id,
              data,
            });
          }}
        />

        {/* AI Date Suggestion Dialog */}
        {aiSuggestionEventRequest && (
          <AiDateSuggestionDialog
            open={showAiDateSuggestionDialog}
            onClose={() => {
              setShowAiDateSuggestionDialog(false);
              setAiSuggestionEventRequest(null);
            }}
            eventRequest={aiSuggestionEventRequest}
            onSelectDate={(date) => {
              // Automatically open scheduling dialog with the recommended date
              setSchedulingEventRequest(aiSuggestionEventRequest);
              setShowSchedulingDialog(true);
              setShowAiDateSuggestionDialog(false);
              setAiSuggestionEventRequest(null);
            }}
          />
        )}

        {/* AI Intake Assistant Dialog */}
        {aiIntakeAssistantEventRequest && (
          <AiIntakeAssistantDialog
            open={showAiIntakeAssistantDialog}
            onClose={() => {
              setShowAiIntakeAssistantDialog(false);
              setAiIntakeAssistantEventRequest(null);
            }}
            eventRequest={aiIntakeAssistantEventRequest}
          />
        )}

        {/* TSP Contact Assignment Dialog */}
        <TspContactAssignmentDialog
          isOpen={showTspContactAssignmentDialog}
          onClose={() => {
            setShowTspContactAssignmentDialog(false);
            setTspContactEventRequest(null);
          }}
          eventRequestId={tspContactEventRequest?.id || 0}
          eventRequestTitle={tspContactEventRequest?.organizationName}
          currentTspContact={tspContactEventRequest?.tspContact || undefined}
          currentCustomTspContact={tspContactEventRequest?.customTspContact || undefined}
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

            logger.log('=== ASSIGNMENT SUBMIT ===');
            logger.log('Event ID:', assignmentEventId);
            logger.log('Assignment Type:', assignmentType);
            logger.log('Selected Assignees:', assignees);
            logger.log('Available drivers:', (drivers as any[]).map((d: any) => ({ id: d.id, name: d.name })));
            logger.log('Available users:', (users as any[]).map((u: any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })));

            // Get the current event to preserve existing assignments
            const currentEvent = eventRequests.find(e => e.id === assignmentEventId);
            if (!currentEvent) {
              toast({
                title: 'Error',
                description: 'Event not found',
                variant: 'destructive',
              });
              return;
            }

            // Build the update data based on assignment type
            let updateData: any = {};

            if (assignmentType === 'driver') {
              // Get existing drivers and merge with new ones
              const existingDrivers = currentEvent.assignedDriverIds || [];
              const existingDriverDetails = currentEvent.driverDetails || {};

              // Merge new drivers with existing ones (avoiding duplicates)
              const allDriverIds = [...new Set([...existingDrivers, ...assignees])];
              updateData.assignedDriverIds = allDriverIds;

              // Build driver details object, preserving existing details
              const driverDetails: any = { ...existingDriverDetails };
              allDriverIds.forEach(driverId => {
                // Only add new details if they don't exist yet
                if (!driverDetails[driverId]) {
                // Check if it's a numeric driver ID
                const isNumericId = /^\d+$/.test(driverId);

                let driverName = driverId; // fallback to ID if name not found

                if (isNumericId) {
                  // It's a traditional driver ID - look it up in the drivers array
                  const driver = (drivers as any[]).find((d: any) => d.id.toString() === driverId || d.id === parseInt(driverId));
                  if (driver) {
                    driverName = driver.name;
                    logger.log(`Found driver: ID=${driverId}, Name=${driver.name}`);
                  } else {
                    logger.warn(`Driver not found in loaded drivers: ID=${driverId}`);
                    // Keep the ID as-is, it will show as "Driver #350" in the UI
                  }
                } else {
                  // It's a user ID - look it up in the users array
                  const foundUser = (users as any[]).find((u: any) => u.id === driverId);
                  if (foundUser) {
                    driverName = `${foundUser.firstName} ${foundUser.lastName}`.trim();
                  }
                }

                  driverDetails[driverId] = {
                    name: driverName,
                    assignedAt: new Date().toISOString(),
                    assignedBy: user?.id || 'system'
                  };
                }
              });
              updateData.driverDetails = driverDetails;

            } else if (assignmentType === 'speaker') {
              // Get existing speakers and merge with new ones
              const existingSpeakers = currentEvent.assignedSpeakerIds || [];
              const existingSpeakerDetails = currentEvent.speakerDetails || {};

              // Merge new speakers with existing ones (avoiding duplicates)
              const allSpeakerIds = [...new Set([...existingSpeakers, ...assignees])];
              updateData.assignedSpeakerIds = allSpeakerIds;

              // Build speaker details object, preserving existing details
              const speakerDetails: any = { ...existingSpeakerDetails };
              const speakerAssignments: string[] = [];

              // Add details for all speakers (existing + new)
              allSpeakerIds.forEach(speakerId => {
                // Only add new details if they don't exist yet
                if (!speakerDetails[speakerId]) {
                  let name = speakerId; // Default fallback
                  
                  // Handle custom IDs (e.g., "custom-1762134226512-David")
                  if (speakerId.startsWith('custom-')) {
                    const parts = speakerId.split('-');
                    if (parts.length >= 3) {
                      const nameParts = parts.slice(2);
                      name = nameParts.join('-').replace(/-/g, ' ').trim() || 'Custom Speaker';
                    } else {
                      name = 'Custom Speaker';
                    }
                  }
                  // Handle host-contact IDs (e.g., "host-contact-4")
                  else if (speakerId.startsWith('host-contact-')) {
                    const contactId = parseInt(speakerId.replace('host-contact-', ''));
                    // Try to find in hostsWithContacts
                    let found = false;
                    if (hostsWithContacts && hostsWithContacts.length > 0) {
                      for (const host of hostsWithContacts) {
                        const contact = host.contacts?.find((c: any) => c.id === contactId);
                        if (contact) {
                          name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.name || contact.email || `Contact #${contactId}`;
                          found = true;
                          break;
                        }
                      }
                    }
                    if (!found) {
                      name = `Contact #${contactId}`;
                    }
                  }
                  // Handle regular user IDs
                  else {
                    const foundUser = (users as any[]).find((u: any) => u.id === speakerId);
                    if (foundUser) {
                      name = `${foundUser.firstName} ${foundUser.lastName}`.trim() || foundUser.displayName || speakerId;
                    }
                  }

                  speakerDetails[speakerId] = {
                    name: name,
                    assignedAt: new Date().toISOString(),
                    assignedBy: user?.id || 'system'
                  };
                }
                speakerAssignments.push(speakerDetails[speakerId].name || speakerId);
              });

              updateData.speakerDetails = speakerDetails;
              updateData.speakerAssignments = speakerAssignments;

            } else if (assignmentType === 'volunteer') {
              // Get existing volunteers and merge with new ones
              const existingVolunteers = currentEvent.assignedVolunteerIds || [];
              const existingVolunteerDetails = currentEvent.volunteerDetails || {};

              // Merge new volunteers with existing ones (avoiding duplicates)
              const allVolunteerIds = [...new Set([...existingVolunteers, ...assignees])];
              updateData.assignedVolunteerIds = allVolunteerIds;

              // Build volunteer details object, preserving existing details
              const volunteerDetails: any = { ...existingVolunteerDetails };
              const volunteerAssignments: string[] = [];

              // Add details for all volunteers (existing + new)
              allVolunteerIds.forEach(volunteerId => {
                // Only add new details if they don't exist yet
                if (!volunteerDetails[volunteerId]) {
                  let name = volunteerId; // Default fallback
                  
                  // Handle custom IDs (e.g., "custom-1762134226512-David")
                  if (volunteerId.startsWith('custom-')) {
                    const parts = volunteerId.split('-');
                    if (parts.length >= 3) {
                      const nameParts = parts.slice(2);
                      name = nameParts.join('-').replace(/-/g, ' ').trim() || 'Custom Volunteer';
                    } else {
                      name = 'Custom Volunteer';
                    }
                  }
                  // Handle host-contact IDs (e.g., "host-contact-4")
                  else if (volunteerId.startsWith('host-contact-')) {
                    const contactId = parseInt(volunteerId.replace('host-contact-', ''));
                    // Try to find in hostsWithContacts
                    let found = false;
                    if (hostsWithContacts && hostsWithContacts.length > 0) {
                      for (const host of hostsWithContacts) {
                        const contact = host.contacts?.find((c: any) => c.id === contactId);
                        if (contact) {
                          name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.name || contact.email || `Contact #${contactId}`;
                          found = true;
                          break;
                        }
                      }
                    }
                    if (!found) {
                      name = `Contact #${contactId}`;
                    }
                  }
                  // Handle regular user IDs
                  else {
                    const foundUser = (users as any[]).find((u: any) => u.id === volunteerId);
                    if (foundUser) {
                      name = `${foundUser.firstName} ${foundUser.lastName}`.trim() || foundUser.displayName || volunteerId;
                    }
                  }

                  volunteerDetails[volunteerId] = {
                    name: name,
                    assignedAt: new Date().toISOString(),
                    assignedBy: user?.id || 'system'
                  };
                }
                volunteerAssignments.push(volunteerDetails[volunteerId].name || volunteerId);
              });

              updateData.volunteerDetails = volunteerDetails;
              updateData.volunteerAssignments = volunteerAssignments;
            }

            try {
              logger.log('Update data:', updateData);

              const result = await updateEventRequestMutation.mutateAsync({
                id: assignmentEventId,
                data: updateData,
              });

              logger.log('Update result:', result);

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
              logger.error('Assignment error:', error);
              toast({
                title: 'Error',
                description: `Failed to assign ${assignmentType}s`,
                variant: 'destructive',
              });
            }
          }}
        />

        {/* Sandwich Planning Modal */}
        <Dialog
          open={showSandwichPlanningModal}
          onOpenChange={setShowSandwichPlanningModal}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-brand-primary flex items-center gap-3">
                <Package className="w-6 h-6" />
                Weekly Sandwich Planning
              </DialogTitle>
              <DialogDescription>
                Plan sandwich production based on scheduled events. Monitor
                trends and adjust quantities based on demand patterns.
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
                  <li>
                    • Plan sandwich types based on dietary restrictions and
                    preferences
                  </li>
                  <li>
                    • Factor in 10-15% extra sandwiches for unexpected attendees
                  </li>
                  <li>
                    • Coordinate with kitchen volunteers for preparation
                    schedules
                  </li>
                  <li>
                    • Check delivery addresses for any special requirements
                  </li>
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
        <Dialog
          open={showStaffingPlanningModal}
          onOpenChange={setShowStaffingPlanningModal}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-brand-primary flex items-center gap-3">
                <Users className="w-6 h-6" />
                Weekly Staffing Planning
              </DialogTitle>
              <DialogDescription>
                Coordinate drivers, speakers, and volunteers for scheduled
                events. Ensure all positions are filled before event dates.
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
                  <li>
                    • Check driver assignments early - transportation is
                    critical
                  </li>
                  <li>
                    • Speaker assignments should be confirmed 1 week before
                    events
                  </li>
                  <li>
                    • Van drivers are needed for large events or special
                    delivery requirements
                  </li>
                  <li>
                    • Volunteers help with event setup and sandwich distribution
                  </li>
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
    <EventRequestProvider
      initialTab={initialTab}
      initialEventId={initialEventId}
    >
      <EventRequestsManagementContent />
    </EventRequestProvider>
  );
}
