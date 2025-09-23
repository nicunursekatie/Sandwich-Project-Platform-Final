import { Router } from 'express';
import { storage } from '../storage-wrapper';

const router = Router();

// Get all meeting notes with optional filters
router.get('/', async (req, res) => {
  try {
    const { meetingId, projectId, type, status } = req.query;

    // For now, return empty array until storage methods are implemented
    const notes: any[] = [];

    // Apply filters if provided
    let filteredNotes = notes;

    if (meetingId) {
      filteredNotes = filteredNotes.filter(n => n.meetingId === Number(meetingId));
    }
    if (projectId) {
      filteredNotes = filteredNotes.filter(n => n.projectId === Number(projectId));
    }
    if (type) {
      filteredNotes = filteredNotes.filter(n => n.type === type);
    }
    if (status) {
      filteredNotes = filteredNotes.filter(n => n.status === status);
    }

    res.json(filteredNotes);
  } catch (error) {
    console.error('Error fetching meeting notes:', error);
    res.status(500).json({ error: 'Failed to fetch meeting notes' });
  }
});

// Get single meeting note by ID
router.get('/:id', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);

    // For now, return a mock note
    const note = {
      id: noteId,
      meetingId: null,
      projectId: null,
      type: 'meeting',
      content: '',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.session?.userId || null,
      createdByName: req.session?.userName || null,
    };

    res.json(note);
  } catch (error) {
    console.error('Error fetching meeting note:', error);
    res.status(500).json({ error: 'Failed to fetch meeting note' });
  }
});

// Create new meeting note
router.post('/', async (req, res) => {
  try {
    const { projectId, meetingId, type, content, status } = req.body;

    // Validate required fields
    if (!content) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    // Create the note object
    const newNote = {
      id: Date.now(), // Temporary ID generation
      projectId: projectId || null,
      meetingId: meetingId || null,
      type: type || 'meeting',
      content,
      status: status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.session?.userId || null,
      createdByName: req.session?.userName || null,
    };

    // TODO: Save to database when storage method is available
    // const savedNote = await storage.createMeetingNote(newNote);

    res.status(201).json(newNote);
  } catch (error) {
    console.error('Error creating meeting note:', error);
    res.status(500).json({ error: 'Failed to create meeting note' });
  }
});

// Update meeting note
router.patch('/:id', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const updates = req.body;

    // TODO: Update in database when storage method is available
    // const updatedNote = await storage.updateMeetingNote(noteId, updates);

    const updatedNote = {
      id: noteId,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    res.json(updatedNote);
  } catch (error) {
    console.error('Error updating meeting note:', error);
    res.status(500).json({ error: 'Failed to update meeting note' });
  }
});

// Delete meeting note
router.delete('/:id', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);

    // TODO: Delete from database when storage method is available
    // await storage.deleteMeetingNote(noteId);

    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting meeting note:', error);
    res.status(500).json({ error: 'Failed to delete meeting note' });
  }
});

export default router;