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
    res.json(meetingsArray);
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

    const newMeeting = await storage.createMeeting(meetingData);
    
    console.log(`[Meetings API] Created meeting with ID: ${newMeeting.id}`);
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

export default router;
