import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventMutations } from './useEventMutations';
import { useEventQueries } from './useEventQueries';
import type { EventRequest } from '@shared/schema';

export const useEventAssignments = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { users, recipients, drivers, volunteers } = useEventQueries();
  const { updateEventRequestMutation } = useEventMutations();
  const {
    eventRequests,
    setShowAssignmentDialog,
    setAssignmentType,
    setAssignmentEventId,
    setIsEditingAssignment,
    setEditingAssignmentPersonId,
    setSelectedAssignees,
  } = useEventRequestContext();

  // Helper function to safely parse PostgreSQL arrays
  const parsePostgresArray = (assignments: any): string[] => {
    if (!assignments) return [];

    if (Array.isArray(assignments)) {
      return assignments;
    }

    if (typeof assignments === 'string') {
      if (assignments === '{}' || assignments === '') return [];

      let cleaned = assignments.replace(/^{|}$/g, '');
      if (!cleaned) return [];

      if (cleaned.includes('"')) {
        const matches = cleaned.match(/"[^"]*"|[^",]+/g);
        return matches ? matches.map(item => item.replace(/"/g, '').trim()).filter(item => item) : [];
      } else {
        return cleaned.split(',').map(item => item.trim()).filter(item => item);
      }
    }

    if (typeof assignments === 'object' && assignments.length !== undefined) {
      return Array.from(assignments);
    }

    return [];
  };

  // Helper function to resolve user ID or email to name
  const resolveUserName = (userIdOrName: string | undefined): string => {
    if (!userIdOrName) return 'Not assigned';

    // Handle user IDs (format: user_xxxx_xxxxx)
    if (userIdOrName.startsWith('user_') && userIdOrName.includes('_')) {
      const user = users.find((u) => u.id === userIdOrName);
      if (user) {
        return `${user.firstName} ${user.lastName}`.trim() || user.email;
      }
    }

    // Handle email addresses
    if (userIdOrName.includes('@')) {
      const user = users.find((u) => u.email === userIdOrName);
      if (user) {
        return `${user.firstName} ${user.lastName}`.trim() || user.email;
      }
    }

    // Handle numeric IDs (could be drivers, volunteers, or speakers)
    if (/^\d+$/.test(userIdOrName)) {
      const numericId = parseInt(userIdOrName);
      
      // First try drivers
      const driver = drivers.find((d) => d.id === numericId || d.id.toString() === userIdOrName);
      if (driver) {
        console.log(`Resolved driver: ID=${userIdOrName} => Name=${driver.name}`);
        return driver.name;
      }
      
      // Then try volunteers (speakers are volunteers)
      const volunteer = volunteers.find((v) => v.id === numericId || v.id.toString() === userIdOrName);
      if (volunteer) {
        console.log(`Resolved volunteer/speaker: ID=${userIdOrName} => Name=${volunteer.name}`);
        return volunteer.name;
      }
      
      // If not found, return a generic placeholder
      console.warn(`Person not found in resolveUserName: ID=${userIdOrName}`);
      return `Person #${userIdOrName}`;
    }

    return userIdOrName;
  };

  // Helper function to resolve recipient ID to name
  const resolveRecipientName = (recipientIdOrName: string | undefined): string => {
    if (!recipientIdOrName) return 'Not specified';

    if (/^\d+$/.test(recipientIdOrName)) {
      const recipient = recipients.find((r) => r.id.toString() === recipientIdOrName);
      return recipient ? recipient.name : recipientIdOrName;
    }

    return recipientIdOrName;
  };

  // Open assignment dialog
  const openAssignmentDialog = (
    eventId: number,
    type: 'driver' | 'speaker' | 'volunteer'
  ) => {
    setAssignmentEventId(eventId);
    setAssignmentType(type);
    setIsEditingAssignment(false);
    setEditingAssignmentPersonId(null);
    setSelectedAssignees([]);
    setShowAssignmentDialog(true);
  };

  // Open assignment dialog in edit mode
  const openEditAssignmentDialog = (
    eventId: number,
    type: 'driver' | 'speaker' | 'volunteer',
    personId: string
  ) => {
    setAssignmentEventId(eventId);
    setAssignmentType(type);
    setIsEditingAssignment(true);
    setEditingAssignmentPersonId(personId);
    setSelectedAssignees([personId]);
    setShowAssignmentDialog(true);
  };

  // Handle removing assignment
  const handleRemoveAssignment = async (
    personId: string,
    type: 'driver' | 'speaker' | 'volunteer',
    eventId: number
  ) => {
    try {
      const eventRequest = eventRequests.find(req => req.id === eventId);
      if (!eventRequest) return;

      let updateData: any = {};

      if (type === 'driver') {
        const currentDrivers = eventRequest.assignedDriverIds || [];
        updateData.assignedDriverIds = currentDrivers.filter(id => id !== personId);

        const currentDriverDetails = eventRequest.driverDetails || {};
        const newDriverDetails = { ...currentDriverDetails };
        delete newDriverDetails[personId];
        updateData.driverDetails = newDriverDetails;
      } else if (type === 'speaker') {
        const currentSpeakerDetails = eventRequest.speakerDetails || {};
        const newSpeakerDetails = { ...currentSpeakerDetails };
        delete newSpeakerDetails[personId];
        updateData.speakerDetails = newSpeakerDetails;

        const currentSpeakerAssignments = eventRequest.speakerAssignments || [];
        const speakerName = currentSpeakerDetails[personId]?.name;
        if (speakerName) {
          updateData.speakerAssignments = currentSpeakerAssignments.filter(name => name !== speakerName);
        }
      } else if (type === 'volunteer') {
        const currentVolunteers = eventRequest.assignedVolunteerIds || [];
        updateData.assignedVolunteerIds = currentVolunteers.filter(id => id !== personId);

        const currentVolunteerDetails = eventRequest.volunteerDetails || {};
        const newVolunteerDetails = { ...currentVolunteerDetails };
        delete newVolunteerDetails[personId];
        updateData.volunteerDetails = newVolunteerDetails;

        const currentVolunteerAssignments = eventRequest.volunteerAssignments || [];
        const volunteerName = currentVolunteerDetails[personId]?.name;
        if (volunteerName) {
          updateData.volunteerAssignments = currentVolunteerAssignments.filter(name => name !== volunteerName);
        }
      }

      await updateEventRequestMutation.mutateAsync({
        id: eventId,
        data: updateData,
      });

      toast({
        title: 'Assignment removed',
        description: `Person has been removed from ${type} assignments`,
      });
    } catch (error) {
      console.error('Failed to remove assignment:', error);
      toast({
        title: 'Removal failed',
        description: 'Failed to remove assignment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle self-signup
  const handleSelfSignup = async (eventId: number, type: 'driver' | 'speaker' | 'volunteer') => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to sign up for roles',
        variant: 'destructive',
      });
      return;
    }

    try {
      const eventRequest = eventRequests.find(req => req.id === eventId);
      if (!eventRequest) return;

      let updateData: any = {};

      if (type === 'driver') {
        const currentDrivers = eventRequest.assignedDriverIds || [];
        if (currentDrivers.includes(user.id)) {
          toast({
            title: 'Already signed up',
            description: 'You are already assigned as a driver for this event',
          });
          return;
        }

        const driversNeeded = eventRequest.driversNeeded;
        if (typeof driversNeeded === 'number' && currentDrivers.length >= driversNeeded) {
          toast({
            title: 'No spots available',
            description: 'All driver spots are filled for this event',
            variant: 'destructive',
          });
          return;
        }

        const newDrivers = [...currentDrivers, user.id];
        updateData.assignedDriverIds = newDrivers;

        const currentDriverDetails = eventRequest.driverDetails || {};
        updateData.driverDetails = {
          ...currentDriverDetails,
          [user.id]: {
            name: `${user.firstName} ${user.lastName}`.trim(),
            assignedAt: new Date().toISOString(),
            assignedBy: user.id,
            selfAssigned: true,
          },
        };
      } else if (type === 'speaker') {
        const currentSpeakerDetails = eventRequest.speakerDetails || {};
        if (currentSpeakerDetails[user.id]) {
          toast({
            title: 'Already signed up',
            description: 'You are already assigned as a speaker for this event',
          });
          return;
        }

        const speakersNeeded = eventRequest.speakersNeeded;
        const currentSpeakersCount = Object.keys(currentSpeakerDetails).length;
        if (typeof speakersNeeded === 'number' && currentSpeakersCount >= speakersNeeded) {
          toast({
            title: 'No spots available',
            description: 'All speaker spots are filled for this event',
            variant: 'destructive',
          });
          return;
        }

        updateData.speakerDetails = {
          ...currentSpeakerDetails,
          [user.id]: {
            name: `${user.firstName} ${user.lastName}`.trim(),
            assignedAt: new Date().toISOString(),
            assignedBy: user.id,
            selfAssigned: true,
          },
        };

        const currentSpeakerAssignments = eventRequest.speakerAssignments || [];
        const userName = `${user.firstName} ${user.lastName}`.trim();
        if (!currentSpeakerAssignments.includes(userName)) {
          updateData.speakerAssignments = [...currentSpeakerAssignments, userName];
        }
      } else if (type === 'volunteer') {
        if (!eventRequest.volunteersNeeded || eventRequest.volunteersNeeded <= 0) {
          if (eventRequest.status !== 'scheduled') {
            toast({
              title: 'Volunteers not needed',
              description: 'This event does not require volunteers',
              variant: 'destructive',
            });
            return;
          }
        }

        const currentVolunteers = eventRequest.assignedVolunteerIds || [];
        if (typeof eventRequest.volunteersNeeded === 'number' &&
            eventRequest.volunteersNeeded > 0 &&
            currentVolunteers.length >= eventRequest.volunteersNeeded) {
          toast({
            title: 'No volunteer spots available',
            description: 'All volunteer spots are filled for this event',
            variant: 'destructive',
          });
          return;
        }

        if (currentVolunteers.includes(user.id)) {
          toast({
            title: 'Already signed up',
            description: 'You are already assigned as a volunteer for this event',
          });
          return;
        }

        const newVolunteers = [...currentVolunteers, user.id];
        updateData.assignedVolunteerIds = newVolunteers;

        const currentVolunteerDetails = eventRequest.volunteerDetails || {};
        updateData.volunteerDetails = {
          ...currentVolunteerDetails,
          [user.id]: {
            name: `${user.firstName} ${user.lastName}`.trim(),
            assignedAt: new Date().toISOString(),
            assignedBy: user.id,
            selfAssigned: true,
          },
        };

        const currentVolunteerAssignments = eventRequest.volunteerAssignments || [];
        const userName = `${user.firstName} ${user.lastName}`.trim();
        if (!currentVolunteerAssignments.includes(userName)) {
          updateData.volunteerAssignments = [...currentVolunteerAssignments, userName];
        }
      }

      await updateEventRequestMutation.mutateAsync({
        id: eventId,
        data: updateData,
      });

      toast({
        title: 'Signed up successfully!',
        description: `You have been signed up as a ${type} for this event`,
      });
    } catch (error) {
      console.error('Failed to self-signup:', error);
      toast({
        title: 'Signup failed',
        description: 'Failed to sign up. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Check if user can sign up
  const canSelfSignup = (eventRequest: EventRequest, type: 'driver' | 'speaker' | 'volunteer'): boolean => {
    if (!user) return false;

    if (type === 'driver') {
      const currentDrivers = parsePostgresArray(eventRequest.assignedDriverIds);
      const driversNeeded = eventRequest.driversNeeded;
      return !currentDrivers.includes(user.id) &&
        (typeof driversNeeded !== 'number' || currentDrivers.length < driversNeeded);
    } else if (type === 'speaker') {
      const currentSpeakerDetails = eventRequest.speakerDetails || {};
      const speakersNeeded = eventRequest.speakersNeeded;
      const currentSpeakersCount = Object.keys(currentSpeakerDetails).length;
      return !currentSpeakerDetails[user.id] &&
        (typeof speakersNeeded !== 'number' || currentSpeakersCount < speakersNeeded);
    } else if (type === 'volunteer') {
      if (eventRequest.status === 'scheduled') {
        const currentVolunteers = parsePostgresArray(eventRequest.assignedVolunteerIds);
        return !currentVolunteers.includes(user.id);
      }

      if (eventRequest.volunteersNeeded && eventRequest.volunteersNeeded > 0) {
        const currentVolunteers = parsePostgresArray(eventRequest.assignedVolunteerIds);
        const hasCapacity = currentVolunteers.length < eventRequest.volunteersNeeded;
        return !currentVolunteers.includes(user.id) && hasCapacity;
      }

      return false;
    }

    return false;
  };

  // Check if user is signed up
  const isUserSignedUp = (eventRequest: EventRequest, type: 'driver' | 'speaker' | 'volunteer'): boolean => {
    if (!user) return false;

    if (type === 'driver') {
      const currentDrivers = parsePostgresArray(eventRequest.assignedDriverIds);
      return currentDrivers.includes(user.id);
    } else if (type === 'speaker') {
      const currentSpeakerDetails = eventRequest.speakerDetails || {};
      return !!currentSpeakerDetails[user.id];
    } else if (type === 'volunteer') {
      const currentVolunteers = parsePostgresArray(eventRequest.assignedVolunteerIds);
      return currentVolunteers.includes(user.id);
    }

    return false;
  };

  // Handle status change
  const handleStatusChange = (id: number, status: string) => {
    const data: any = { status };

    // When marking as scheduled, set scheduledEventDate to desiredEventDate if not already set
    if (status === 'scheduled') {
      const request = eventRequests.find(r => r.id === id);
      if (request && !request.scheduledEventDate && request.desiredEventDate) {
        data.scheduledEventDate = request.desiredEventDate;
      }
    }

    updateEventRequestMutation.mutate({
      id,
      data
    });
  };

  return {
    parsePostgresArray,
    resolveUserName,
    resolveRecipientName,
    openAssignmentDialog,
    openEditAssignmentDialog,
    handleRemoveAssignment,
    handleSelfSignup,
    canSelfSignup,
    isUserSignedUp,
    handleStatusChange,
  };
};