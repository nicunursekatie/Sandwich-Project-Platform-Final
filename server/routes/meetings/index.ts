import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { storage } from '../../storage-wrapper';
import { logger } from '../../middleware/logger';
import { meetingMinutesUpload } from '../../middleware/uploads';
import {
  insertMeetingMinutesSchema,
  insertAgendaItemSchema,
  insertMeetingSchema,
} from '@shared/schema';

const meetingsRouter = Router();

// Meeting Minutes
meetingsRouter.get('/minutes', async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found' });
    }
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const limit = req.query.limit
      ? parseInt(req.query.limit as string)
      : undefined;
    const minutes = limit
      ? await storage.getRecentMeetingMinutes(limit)
      : await storage.getAllMeetingMinutes();

    // Filter meeting minutes based on user role and committee membership
    if (
      user.role === 'admin' ||
      user.role === 'admin_coordinator' ||
      user.role === 'admin_viewer'
    ) {
      // Admins see all meeting minutes
      res.json(minutes);
    } else if (user.role === 'committee_member') {
      // Committee members only see minutes for their committees
      const userCommittees = await storage.getUserCommittees(userId);
      const committeeTypes = userCommittees.map(
        (membership) => membership.membership.committeeId
      );

      const filteredMinutes = minutes.filter(
        (minute) =>
          !minute.committeeType || committeeTypes.includes(minute.committeeType) // General meeting minutes (no committee assignment)
      );
      res.json(filteredMinutes);
    } else {
      // Other roles see general meeting minutes and their role-specific minutes
      const filteredMinutes = minutes.filter(
        (minute) => !minute.committeeType || minute.committeeType === user.role // General meeting minutes
      );
      res.json(filteredMinutes);
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch meeting minutes' });
  }
});

meetingsRouter.post('/minutes', async (req, res) => {
  try {
    const minutesData = insertMeetingMinutesSchema.parse(req.body);
    const minutes = await storage.createMeetingMinutes(minutesData);
    res.status(201).json(minutes);
  } catch (error) {
    res.status(400).json({ message: 'Invalid meeting minutes data' });
  }
});

meetingsRouter.delete('/minutes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deleteMeetingMinutes(id);

    if (success) {
      logger.info('Meeting minutes deleted', {
        minutesId: id,
        method: req.method,
        url: req.url,
        ip: req.ip,
      });
      res.json({
        success: true,
        message: 'Meeting minutes deleted successfully',
      });
    } else {
      res.status(404).json({ message: 'Meeting minutes not found' });
    }
  } catch (error) {
    logger.error('Failed to delete meeting minutes', error);
    res.status(500).json({ message: 'Failed to delete meeting minutes' });
  }
});

// Meeting minutes file upload endpoint
meetingsRouter.post(
  '/minutes/upload',
  meetingMinutesUpload.single('file'),
  async (req, res) => {
    try {
      const { meetingId, title, date, summary, googleDocsUrl } = req.body;

      if (!meetingId || !title || !date) {
        return res.status(400).json({
          message: 'Missing required fields: meetingId, title, date',
        });
      }

      let finalSummary = summary;
      let documentContent = '';

      // Handle file upload and store file
      if (req.file) {
        logger.info('Meeting minutes file uploaded', {
          filename: req.file.filename,
          originalname: req.file.originalname,
          size: req.file.size,
          meetingId: meetingId,
        });

        try {
          // Create permanent storage path with consistent filename
          const uploadsDir = path.join(
            process.cwd(),
            'uploads',
            'meeting-minutes'
          );
          await fs.mkdir(uploadsDir, { recursive: true });

          // Generate a consistent filename using the multer-generated filename
          const permanentFilename = req.file.filename;
          const permanentPath = path.join(uploadsDir, permanentFilename);
          await fs.copyFile(req.file.path, permanentPath);

          // Determine file type
          let fileType = 'unknown';
          if (req.file.mimetype === 'application/pdf') {
            fileType = 'pdf';
            finalSummary = `PDF document: ${req.file.originalname}`;
          } else if (
            req.file.mimetype ===
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            req.file.originalname.toLowerCase().endsWith('.docx')
          ) {
            fileType = 'docx';
            finalSummary = `DOCX document: ${req.file.originalname}`;
          } else if (
            req.file.mimetype === 'application/msword' ||
            req.file.originalname.toLowerCase().endsWith('.doc')
          ) {
            fileType = 'doc';
            finalSummary = `DOC document: ${req.file.originalname}`;
          } else {
            finalSummary = `Document: ${req.file.originalname}`;
          }

          // Store file metadata for later retrieval
          req.fileMetadata = {
            fileName: req.file.originalname,
            filePath: permanentPath,
            fileType: fileType,
            mimeType: req.file.mimetype,
          };

          // Clean up temporary file
          await fs.unlink(req.file.path);
        } catch (fileError) {
          logger.error('Failed to store document file', fileError);
          finalSummary = `Document uploaded: ${req.file.originalname} (storage failed)`;
          // Clean up uploaded file even if storage failed
          try {
            await fs.unlink(req.file.path);
          } catch (unlinkError) {
            logger.error('Failed to clean up uploaded file', unlinkError);
          }
        }
      }

      // Handle Google Docs URL
      if (googleDocsUrl) {
        finalSummary = `Google Docs link: ${googleDocsUrl}`;
      }

      if (!finalSummary) {
        return res
          .status(400)
          .json({ message: 'Must provide either a file or Google Docs URL' });
      }

      // Create meeting minutes record
      const minutesData = {
        title,
        date,
        summary: finalSummary,
        fileName: req.fileMetadata?.fileName || null,
        filePath: req.fileMetadata?.filePath || null,
        fileType:
          req.fileMetadata?.fileType ||
          (googleDocsUrl ? 'google_docs' : 'text'),
        mimeType: req.fileMetadata?.mimeType || null,
      };

      const minutes = await storage.createMeetingMinutes(minutesData);

      logger.info('Meeting minutes created successfully', {
        minutesId: minutes.id,
        meetingId: meetingId,
        method: req.method,
        url: req.url,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        message: 'Meeting minutes uploaded successfully',
        minutes: minutes,
        filename: req.file?.originalname,
        extractedContent: documentContent ? true : false,
      });
    } catch (error) {
      logger.error('Failed to upload meeting minutes', error);
      res.status(500).json({
        message: 'Failed to upload meeting minutes',
        error: error.message,
      });
    }
  }
);

// File serving endpoint for meeting minutes documents by ID
meetingsRouter.get('/minutes/:id/file', async (req: any, res) => {
  try {
    const minutesId = parseInt(req.params.id);
    if (isNaN(minutesId)) {
      return res.status(400).json({ message: 'Invalid meeting minutes ID' });
    }

    // Get all meeting minutes and find the specific one
    const allMinutes = await storage.getAllMeetingMinutes();
    const minutes = allMinutes.find((m: any) => m.id === minutesId);
    if (!minutes) {
      return res.status(404).json({ message: 'Meeting minutes not found' });
    }

    if (!minutes.filePath) {
      return res
        .status(404)
        .json({ message: 'No file associated with these meeting minutes' });
    }

    // Debug logging
    logger.info('Meeting minutes file debug', {
      minutesId,
      storedFilePath: minutes.filePath,
      fileName: minutes.fileName,
    });

    // Handle both absolute and relative paths
    const filePath = path.isAbsolute(minutes.filePath)
      ? minutes.filePath
      : path.join(process.cwd(), minutes.filePath);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      logger.error('File access failed', {
        filePath,
        storedPath: minutes.filePath,
        error: error.message,
      });
      return res.status(404).json({ message: 'File not found on disk' });
    }

    // Get file info
    const stats = await fs.stat(filePath);

    // Detect actual file type by reading first few bytes
    const buffer = Buffer.alloc(50);
    const fd = await fs.open(filePath, 'r');
    await fd.read(buffer, 0, 50, 0);
    await fd.close();

    let contentType = 'application/octet-stream';
    const fileHeader = buffer.toString('utf8', 0, 20);

    if (fileHeader.startsWith('%PDF')) {
      contentType = 'application/pdf';
    } else if (
      fileHeader.includes('[Content_Types].xml') ||
      fileHeader.startsWith('PK')
    ) {
      // This is a Microsoft Office document (DOCX, XLSX, etc.)
      if (minutes.fileName.toLowerCase().endsWith('.docx')) {
        contentType =
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (minutes.fileName.toLowerCase().endsWith('.xlsx')) {
        contentType =
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else {
        contentType =
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; // Default to DOCX
      }
    }

    logger.info('File type detected', {
      fileName: minutes.fileName,
      detectedType: contentType,
      fileHeader: fileHeader.substring(0, 20),
    });

    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader(
      'Content-Disposition',
      contentType === 'application/pdf'
        ? `inline; filename="${minutes.fileName}"`
        : `attachment; filename="${minutes.fileName}"`
    );

    // Stream the file
    const fileStream = createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    logger.error('Failed to serve meeting minutes file', error);
    res.status(500).json({ message: 'Failed to serve file' });
  }
});

// File serving endpoint for meeting minutes documents by filename (legacy)
meetingsRouter.get('/files/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(
      process.cwd(),
      'uploads',
      'meeting-minutes',
      filename
    );

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ message: 'File not found' });
    }

    // Get file info
    const stats = await fs.stat(filePath);
    const fileBuffer = await fs.readFile(filePath);

    // Check file signature to determine actual type (since filename may not have extension)
    let contentType = 'application/octet-stream';
    let displayName = filename;

    // Check for PDF signature (%PDF)
    if (
      fileBuffer.length > 4 &&
      fileBuffer.toString('ascii', 0, 4) === '%PDF'
    ) {
      contentType = 'application/pdf';
      // Add .pdf extension to display name if not present
      if (!filename.toLowerCase().endsWith('.pdf')) {
        displayName = filename + '.pdf';
      }
    } else {
      // Fallback to extension-based detection
      const ext = path.extname(filename).toLowerCase();
      if (ext === '.pdf') {
        contentType = 'application/pdf';
      } else if (ext === '.docx') {
        contentType =
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (ext === '.doc') {
        contentType = 'application/msword';
      }
    }

    // Set headers for inline display
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `inline; filename="${displayName}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.send(fileBuffer);
  } catch (error) {
    logger.error('Failed to serve file', error);
    res.status(500).json({ message: 'Failed to serve file' });
  }
});

// Drive Links
meetingsRouter.get('/drive-links', async (req, res) => {
  try {
    const links = await storage.getAllDriveLinks();
    res.json(links);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch drive links' });
  }
});

// Agenda Items
meetingsRouter.get('/agenda-items', async (req, res) => {
  try {
    const items = await storage.getAllAgendaItems();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch agenda items' });
  }
});

meetingsRouter.post('/agenda-items', async (req, res) => {
  try {
    const itemData = insertAgendaItemSchema.parse(req.body);
    const item = await storage.createAgendaItem(itemData);
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ message: 'Invalid agenda item data', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Failed to create agenda item' });
    }
  }
});

meetingsRouter.patch('/agenda-items/:id', async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found' });
    }
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Committee members cannot modify agenda item statuses
    if (user.role === 'committee_member') {
      return res.status(403).json({
        message: 'Committee members cannot modify agenda item statuses',
      });
    }

    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected', 'postponed'].includes(status)) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }

    const updatedItem = await storage.updateAgendaItemStatus(id, status);
    if (!updatedItem) {
      res.status(404).json({ message: 'Agenda item not found' });
      return;
    }

    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update agenda item' });
  }
});

meetingsRouter.put('/agenda-items/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description } = req.body;

    const updatedItem = await storage.updateAgendaItem(id, {
      title,
      description,
    });
    if (!updatedItem) {
      res.status(404).json({ message: 'Agenda item not found' });
      return;
    }

    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update agenda item' });
  }
});

meetingsRouter.delete('/agenda-items/:id', async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found' });
    }
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Committee members cannot delete agenda items
    if (user.role === 'committee_member') {
      return res
        .status(403)
        .json({ message: 'Committee members cannot delete agenda items' });
    }

    const id = parseInt(req.params.id);
    const success = await storage.deleteAgendaItem(id);

    if (!success) {
      res.status(404).json({ message: 'Agenda item not found' });
      return;
    }

    res.json({ message: 'Agenda item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete agenda item' });
  }
});

// Meetings
meetingsRouter.get('/current', async (req, res) => {
  try {
    const meeting = await storage.getCurrentMeeting();
    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch current meeting' });
  }
});

meetingsRouter.post('/', async (req, res) => {
  try {
    const meetingData = insertMeetingSchema.parse(req.body);
    const meeting = await storage.createMeeting(meetingData);
    res.status(201).json(meeting);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create meeting' });
  }
});

export default meetingsRouter;
