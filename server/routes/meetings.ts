import { Router } from 'express';
import { isAuthenticated } from '../temp-auth';
import { storage } from '../storage-wrapper';
import logger from '../utils/logger';

const router = Router();

// Get all meetings
router.get('/', isAuthenticated, async (req: any, res) => {
  try {
    console.log('[Meetings API] Getting all meetings');
    const meetings = await storage.getAllMeetings();
    
    // Ensure we always return an array
    const meetingsArray = Array.isArray(meetings) ? meetings : [];
    
    console.log(`[Meetings API] Found ${meetingsArray.length} meetings`);
    console.log('[Meetings API] Meetings data:', JSON.stringify(meetingsArray, null, 2));
    
    // Map database field names to client field names
    const mappedMeetings = meetingsArray.map(meeting => ({
      ...meeting,
      meetingDate: meeting.date, // Map date to meetingDate for client
      startTime: meeting.time,   // Map time to startTime for client
      meetingLink: meeting.location, // Map location to meetingLink for client
      agenda: meeting.finalAgenda,   // Map finalAgenda to agenda for client
    }));
    
    console.log('[Meetings API] Mapped meetings for client:', JSON.stringify(mappedMeetings, null, 2));
    res.json(mappedMeetings);
  } catch (error) {
    logger.error('Failed to get meetings', error);
    console.error('[Meetings API] Error fetching meetings:', error);
    // Return empty array on error to prevent filter errors
    res.json([]);
  }
});

// Get meetings by type
router.get('/type/:type', isAuthenticated, async (req: any, res) => {
  try {
    const { type } = req.params;
    console.log(`[Meetings API] Getting meetings by type: ${type}`);
    
    const meetings = await storage.getMeetingsByType(type);
    
    // Ensure we always return an array
    const meetingsArray = Array.isArray(meetings) ? meetings : [];
    
    console.log(`[Meetings API] Found ${meetingsArray.length} meetings of type ${type}`);
    res.json(meetingsArray);
  } catch (error) {
    logger.error('Failed to get meetings by type', error);
    console.error('[Meetings API] Error fetching meetings by type:', error);
    // Return empty array on error
    res.json([]);
  }
});

// Get current meeting
router.get('/current', isAuthenticated, async (req: any, res) => {
  try {
    console.log('[Meetings API] Getting current meeting');
    
    const currentMeeting = await storage.getCurrentMeeting();
    
    if (!currentMeeting) {
      return res.status(404).json({ message: 'No current meeting found' });
    }
    
    console.log(`[Meetings API] Found current meeting: ${currentMeeting.title}`);
    res.json(currentMeeting);
  } catch (error) {
    logger.error('Failed to get current meeting', error);
    console.error('[Meetings API] Error fetching current meeting:', error);
    res.status(500).json({ message: 'Failed to get current meeting' });
  }
});

// Create a new meeting
router.post('/', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingData = req.body;
    console.log(`[Meetings API] Creating new meeting: ${meetingData.title}`);
    console.log('[Meetings API] Meeting data received:', JSON.stringify(meetingData, null, 2));

    // Map client field names to database field names
    const mappedMeetingData = {
      title: meetingData.title,
      type: meetingData.type || 'weekly', // Default to weekly if not specified
      date: meetingData.meetingDate || meetingData.date, // Map meetingDate to date
      time: meetingData.startTime || meetingData.time, // Map startTime to time
      location: meetingData.location || meetingData.meetingLink,
      description: meetingData.description,
      finalAgenda: meetingData.agenda,
      status: meetingData.status || 'planning', // Default to planning if not specified
    };

    console.log('[Meetings API] Mapped meeting data:', JSON.stringify(mappedMeetingData, null, 2));

    const newMeeting = await storage.createMeeting(mappedMeetingData);
    
    console.log(`[Meetings API] Created meeting with ID: ${newMeeting.id}`);
    console.log('[Meetings API] Created meeting data:', JSON.stringify(newMeeting, null, 2));
    res.status(201).json(newMeeting);
  } catch (error) {
    logger.error('Failed to create meeting', error);
    console.error('[Meetings API] Error creating meeting:', error);
    res.status(500).json({ message: 'Failed to create meeting' });
  }
});

// Update a meeting
router.patch('/:id', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingId = parseInt(req.params.id);
    const updates = req.body;
    
    console.log(`[Meetings API] Updating meeting ${meetingId}`);

    const updatedMeeting = await storage.updateMeeting(meetingId, updates);
    
    if (!updatedMeeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    console.log(`[Meetings API] Updated meeting ${meetingId}`);
    res.json(updatedMeeting);
  } catch (error) {
    logger.error('Failed to update meeting', error);
    console.error('[Meetings API] Error updating meeting:', error);
    res.status(500).json({ message: 'Failed to update meeting' });
  }
});

// Update meeting agenda
router.patch('/:id/agenda', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingId = parseInt(req.params.id);
    const { agenda } = req.body;
    
    console.log(`[Meetings API] Updating agenda for meeting ${meetingId}`);

    const updatedMeeting = await storage.updateMeetingAgenda(meetingId, agenda);
    
    if (!updatedMeeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    console.log(`[Meetings API] Updated agenda for meeting ${meetingId}`);
    res.json(updatedMeeting);
  } catch (error) {
    logger.error('Failed to update meeting agenda', error);
    console.error('[Meetings API] Error updating meeting agenda:', error);
    res.status(500).json({ message: 'Failed to update meeting agenda' });
  }
});

// Delete a meeting
router.delete('/:id', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingId = parseInt(req.params.id);
    console.log(`[Meetings API] Deleting meeting ${meetingId}`);

    const success = await storage.deleteMeeting(meetingId);
    
    if (!success) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    console.log(`[Meetings API] Deleted meeting ${meetingId}`);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete meeting', error);
    console.error('[Meetings API] Error deleting meeting:', error);
    res.status(500).json({ message: 'Failed to delete meeting' });
  }
});

// Agenda Items endpoints
// Get agenda items for a meeting
router.get('/agenda-items', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { meetingId } = req.query;
    console.log(`[Meetings API] Getting agenda items for meeting: ${meetingId}`);

    // Get agenda items from storage
    const agendaItems = await storage.getAllAgendaItems();
    
    // Filter by meeting ID if provided
    const filteredItems = meetingId 
      ? agendaItems.filter(item => item.meetingId === parseInt(meetingId))
      : agendaItems;
    
    console.log(`[Meetings API] Found ${filteredItems.length} agenda items`);
    res.json(filteredItems);
  } catch (error) {
    logger.error('Failed to get agenda items', error);
    console.error('[Meetings API] Error fetching agenda items:', error);
    res.json([]);
  }
});

// Create agenda item
router.post('/agenda-items', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const agendaItemData = req.body;
    console.log(`[Meetings API] Creating agenda item: ${agendaItemData.title}`);
    console.log('[Meetings API] Agenda item data received:', JSON.stringify(agendaItemData, null, 2));

    // Create agenda item using storage
    const newAgendaItem = await storage.createAgendaItem({
      ...agendaItemData,
      submittedBy: user.id,
      submittedAt: new Date(),
      status: 'pending'
    });
    
    console.log(`[Meetings API] Created agenda item with ID: ${newAgendaItem.id}`);
    res.status(201).json(newAgendaItem);
  } catch (error) {
    logger.error('Failed to create agenda item', error);
    console.error('[Meetings API] Error creating agenda item:', error);
    res.status(500).json({ message: 'Failed to create agenda item' });
  }
});

// Update agenda item
router.patch('/agenda-items/:id', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const agendaItemId = parseInt(req.params.id);
    const updates = req.body;
    
    console.log(`[Meetings API] Updating agenda item ${agendaItemId}`);

    // Update agenda item using storage
    const updatedAgendaItem = await storage.updateAgendaItem(agendaItemId, updates);
    
    if (!updatedAgendaItem) {
      return res.status(404).json({ message: 'Agenda item not found' });
    }
    
    console.log(`[Meetings API] Updated agenda item ${agendaItemId}`);
    res.json(updatedAgendaItem);
  } catch (error) {
    logger.error('Failed to update agenda item', error);
    console.error('[Meetings API] Error updating agenda item:', error);
    res.status(500).json({ message: 'Failed to update agenda item' });
  }
});

// Delete agenda item
router.delete('/agenda-items/:id', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const agendaItemId = parseInt(req.params.id);
    console.log(`[Meetings API] Deleting agenda item ${agendaItemId}`);

    // Delete agenda item using storage
    const success = await storage.deleteAgendaItem(agendaItemId);
    
    if (!success) {
      return res.status(404).json({ message: 'Agenda item not found' });
    }
    
    console.log(`[Meetings API] Deleted agenda item ${agendaItemId}`);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete agenda item', error);
    console.error('[Meetings API] Error deleting agenda item:', error);
    res.status(500).json({ message: 'Failed to delete agenda item' });
  }
});

export default router;
