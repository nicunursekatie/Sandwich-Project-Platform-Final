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

// Simple One-Off Agenda Items - Fresh Implementation
// GET agenda items for a meeting
router.get('/agenda-items', isAuthenticated, async (req: any, res) => {
  try {
    console.log('🟢 Simple Agenda API - GET request:', req.query);
    const { meetingId } = req.query;
    
    if (!meetingId) {
      return res.json([]);
    }
    
    const items = await storage.getAllAgendaItems();
    const filteredItems = items.filter(item => item.meetingId === parseInt(meetingId));
    
    console.log('✅ Simple Agenda API - Returning', filteredItems.length, 'items for meeting', meetingId);
    res.json(filteredItems);
  } catch (error) {
    console.error('❌ Simple Agenda API - Error:', error);
    res.status(500).json({ message: 'Failed to fetch agenda items' });
  }
});

// POST create agenda item
router.post('/agenda-items', isAuthenticated, async (req: any, res) => {
  try {
    console.log('🟢 Simple Agenda API - POST request:', req.body);
    
    const { title, description, meetingId } = req.body;
    
    if (!title || !meetingId) {
      return res.status(400).json({ message: 'Title and meetingId are required' });
    }
    
    const newItem = await storage.createAgendaItem({
      title,
      description: description || '',
      meetingId: parseInt(meetingId),
      submittedBy: req.user?.email || 'unknown',
      status: 'pending'
    });
    
    console.log('✅ Simple Agenda API - Created item:', newItem.id);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('❌ Simple Agenda API - Error:', error);
    res.status(500).json({ message: 'Failed to create agenda item' });
  }
});

// POST /api/meetings/finalize-agenda-pdf - Generate and download agenda PDF
router.post('/finalize-agenda-pdf', isAuthenticated, async (req: any, res) => {
  try {
    console.log('📄 Generating agenda PDF...');
    
    const agendaData = req.body;
    console.log('Agenda data received:', JSON.stringify(agendaData, null, 2));
    
    // Import the PDF generator
    const { generateMeetingAgendaPDF } = await import('../meeting-agenda-pdf-generator.js');
    
    // Transform agenda data to meeting format for PDF generator
    const meetingData = {
      id: 1,
      title: `Meeting Agenda`,
      date: agendaData.meetingDate || new Date().toISOString().split('T')[0],
      time: '13:30',
      type: 'core_team',
      description: 'Weekly agenda planning',
      location: 'Meeting location'
    };
    
    // Transform agenda projects to sections for PDF
    const agendaSections = [];
    
    // Add regular agenda projects
    if (agendaData.agendaProjects && agendaData.agendaProjects.length > 0) {
      agendaSections.push({
        id: 1,
        title: 'Needs Discussion',
        items: agendaData.agendaProjects.map((project: any, index: number) => ({
          id: index + 1,
          title: project.title,
          description: project.discussionPoints || project.decisionItems || '',
          submittedBy: project.owner || 'Unknown',
          type: 'project',
          estimatedTime: '10 mins',
          project: {
            id: project.id || index + 1,
            title: project.title,
            status: project.status || 'pending',
            priority: project.priority || 'medium',
            description: project.description || '',
            reviewInNextMeeting: true,
            meetingDiscussionPoints: project.discussionPoints || '',
            meetingDecisionItems: project.decisionItems || '',
            supportPeople: project.supportPeople || '',
            assigneeName: project.owner || 'Unknown',
            tasks: project.tasks || [],
            attachments: project.attachments || []
          }
        }))
      });
    }
    
    // Add tabled projects if they exist
    if (agendaData.tabledProjects && agendaData.tabledProjects.length > 0) {
      agendaSections.push({
        id: agendaSections.length + 1,
        title: 'Tabled Items',
        items: agendaData.tabledProjects.map((project: any, index: number) => ({
          id: index + 1,
          title: project.title,
          description: project.reason || 'No reason specified',
          submittedBy: project.owner || 'Unknown',
          type: 'tabled_project',
          estimatedTime: '5 mins',
          project: {
            id: project.id || index + 1000,
            title: project.title,
            status: 'tabled',
            priority: 'low',
            description: project.reason || 'No reason specified',
            reviewInNextMeeting: false,
            meetingDiscussionPoints: project.reason || '',
            meetingDecisionItems: '',
            supportPeople: project.supportPeople || '',
            assigneeName: project.owner || 'Unknown',
            tasks: [],
            attachments: []
          }
        }))
      });
    }
    
    // Add off-agenda items (fetch from database)
    try {
      const agendaItems = await storage.getAllAgendaItems();
      const currentMeetingItems = agendaItems.filter(item => 
        item.meetingId === 17 && item.status === 'pending'
      );
      
      if (currentMeetingItems.length > 0) {
        // Group by section
        const itemsBySection = currentMeetingItems.reduce((acc, item) => {
          const section = item.section || 'other_business';
          if (!acc[section]) acc[section] = [];
          acc[section].push(item);
          return acc;
        }, {} as any);
        
        // Add each section
        Object.entries(itemsBySection).forEach(([sectionName, items]: [string, any]) => {
          const sectionTitle = sectionName.replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
          
          agendaSections.push({
            id: agendaSections.length + 1,
            title: sectionTitle,
            items: items.map((item: any, index: number) => ({
              id: index + 1,
              title: item.title,
              description: item.description || '',
              submittedBy: item.submittedBy || 'Unknown',
              type: 'agenda_item',
              estimatedTime: '5 mins'
            }))
          });
        });
      }
    } catch (error) {
      console.error('Error fetching agenda items:', error);
    }
    
    const compiledAgenda = {
      id: 1,
      meetingId: 1,
      date: agendaData.meetingDate || new Date().toISOString().split('T')[0],
      status: 'draft',
      sections: agendaSections
    };
    
    // Create the agenda object for PDF generation
    const agenda = {
      title: `Meeting Agenda`,
      date: agendaData.meetingDate || new Date().toISOString().split('T')[0],
      startTime: '13:30',
      location: 'Meeting location',
      description: 'Weekly agenda planning',
      sections: agendaSections
    };
    
    const pdfBuffer = await generateMeetingAgendaPDF(agenda);
    
    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="agenda.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send the PDF
    res.send(pdfBuffer);
    console.log('✅ Agenda PDF generated and sent successfully');
    
  } catch (error) {
    console.error('Error generating agenda PDF:', error);
    res.status(500).json({ error: 'Failed to generate agenda PDF' });
  }
});

// GET /api/meetings/:id/download-pdf - Download existing meeting PDF
router.get('/:id/download-pdf', isAuthenticated, async (req: any, res) => {
  try {
    const meetingId = req.params.id;
    console.log('📄 Downloading PDF for meeting:', meetingId);
    
    // For now, return a simple text response indicating the feature is not yet implemented
    // TODO: Implement actual PDF download functionality
    res.status(501).json({ 
      error: 'PDF download not yet implemented',
      message: 'The PDF download feature is under development. Please use the export to Google Sheets functionality for now.'
    });
    
  } catch (error) {
    console.error('Error downloading meeting PDF:', error);
    res.status(500).json({ error: 'Failed to download meeting PDF' });
  }
});

export default router;
