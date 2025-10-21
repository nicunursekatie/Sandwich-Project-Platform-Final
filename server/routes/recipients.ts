import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { storage } from '../storage-wrapper';
import { insertRecipientSchema } from '@shared/schema';
import { PERMISSIONS } from '@shared/auth-utils';
import { requirePermission } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/recipients - Get all recipients
router.get(
  '/',
  requirePermission(PERMISSIONS.RECIPIENTS_VIEW),
  async (req, res) => {
    try {
      const recipients = await storage.getAllRecipients();
      res.json(recipients);
    } catch (error) {
      console.error('Error fetching recipients:', error);
      res.status(500).json({ error: 'Failed to fetch recipients' });
    }
  }
);

// GET /api/recipients/export-csv - Export recipients as CSV (MUST come before /:id route)
router.get(
  '/export-csv',
  requirePermission(PERMISSIONS.RECIPIENTS_VIEW),
  async (req, res) => {
    try {
      console.log('[RECIPIENTS EXPORT] Export route hit!');
      const recipients = await storage.getAllRecipients();

      // CSV headers - all relevant fields
      const headers = [
        'ID',
        'Name',
        'Phone',
        'Email',
        'Website',
        'Instagram Handle',
        'Address',
        'Region',
        'Status',
        'Contact Person Name',
        'Contact Person Phone',
        'Contact Person Email',
        'Contact Person Role',
        'Second Contact Person Name',
        'Second Contact Person Phone',
        'Second Contact Person Email',
        'Second Contact Person Role',
        'Reporting Group',
        'Estimated Sandwiches',
        'Sandwich Type',
        'Focus Area',
        'TSP Contact',
        'Contract Signed',
        'Contract Signed Date',
        'Collection Day',
        'Collection Time',
        'Feeding Day',
        'Feeding Time',
        'Has Shared Post',
        'Shared Post Date',
        'Created At',
      ];

      // Convert recipients to CSV rows
      const rows = recipients.map((recipient: any) => [
        recipient.id || '',
        recipient.name || '',
        recipient.phone || '',
        recipient.email || '',
        recipient.website || '',
        recipient.instagramHandle || '',
        recipient.address || '',
        recipient.region || '',
        recipient.status || '',
        recipient.contactPersonName || '',
        recipient.contactPersonPhone || '',
        recipient.contactPersonEmail || '',
        recipient.contactPersonRole || '',
        recipient.secondContactPersonName || '',
        recipient.secondContactPersonPhone || '',
        recipient.secondContactPersonEmail || '',
        recipient.secondContactPersonRole || '',
        recipient.reportingGroup || '',
        recipient.estimatedSandwiches || '',
        recipient.sandwichType || '',
        recipient.focusArea || '',
        recipient.tspContact || '',
        recipient.contractSigned ? 'Yes' : 'No',
        recipient.contractSignedDate
          ? new Date(recipient.contractSignedDate).toISOString().split('T')[0]
          : '',
        recipient.collectionDay || '',
        recipient.collectionTime || '',
        recipient.feedingDay || '',
        recipient.feedingTime || '',
        recipient.hasSharedPost ? 'Yes' : 'No',
        recipient.sharedPostDate
          ? new Date(recipient.sharedPostDate).toISOString().split('T')[0]
          : '',
        recipient.createdAt
          ? new Date(recipient.createdAt).toISOString().split('T')[0]
          : '',
      ]);

      // Create CSV content with proper escaping
      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row
            .map((cell) => {
              const cellStr = String(cell).replace(/"/g, '""');
              return cellStr.includes(',') ||
                cellStr.includes('"') ||
                cellStr.includes('\n')
                ? `"${cellStr}"`
                : cellStr;
            })
            .join(',')
        ),
      ].join('\n');

      // Set response headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="recipients-${new Date().toISOString().split('T')[0]}.csv"`
      );
      res.send(csvContent);
    } catch (error) {
      console.error('Failed to export recipients', error);
      res.status(500).json({ error: 'Failed to export recipients' });
    }
  }
);

// POST /api/recipients/import - Import recipients from CSV/XLSX
router.post(
  '/import',
  requirePermission(PERMISSIONS.RECIPIENTS_ADD),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let records: any[] = [];
      const fileExt = req.file.originalname.split('.').pop()?.toLowerCase();

      // Parse based on file type
      if (fileExt === 'csv') {
        records = parse(req.file.buffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } else if (fileExt === 'xlsx' || fileExt === 'xls') {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        records = XLSX.utils.sheet_to_json(worksheet);
      } else {
        return res
          .status(400)
          .json({ error: 'Invalid file type. Use CSV or XLSX' });
      }

      let imported = 0;
      let skipped = 0;

      // Process each record
      for (const record of records) {
        try {
          // Map CSV columns to schema fields (case-insensitive)
          const recipientData: any = {
            name: record.Name || record.name,
            phone: record.Phone || record.phone,
            email: record.Email || record.email || '',
            website: record.Website || record.website || '',
            instagramHandle: record['Instagram Handle'] || record.instagramHandle || '',
            address: record.Address || record.address || '',
            region: record.Region || record.region || '',
            status: record.Status || record.status || 'active',
            contactPersonName: record['Contact Person Name'] || record.contactPersonName || '',
            contactPersonPhone: record['Contact Person Phone'] || record.contactPersonPhone || '',
            contactPersonEmail: record['Contact Person Email'] || record.contactPersonEmail || '',
            contactPersonRole: record['Contact Person Role'] || record.contactPersonRole || '',
            secondContactPersonName: record['Second Contact Person Name'] || record.secondContactPersonName || '',
            secondContactPersonPhone: record['Second Contact Person Phone'] || record.secondContactPersonPhone || '',
            secondContactPersonEmail: record['Second Contact Person Email'] || record.secondContactPersonEmail || '',
            secondContactPersonRole: record['Second Contact Person Role'] || record.secondContactPersonRole || '',
            reportingGroup: record['Reporting Group'] || record.reportingGroup || '',
            estimatedSandwiches: record['Estimated Sandwiches'] || record.estimatedSandwiches || null,
            sandwichType: record['Sandwich Type'] || record.sandwichType || '',
            focusArea: record['Focus Area'] || record.focusArea || '',
            tspContact: record['TSP Contact'] || record.tspContact || '',
            contractSigned: (record['Contract Signed'] || record.contractSigned || '').toString().toLowerCase() === 'yes',
            contractSignedDate: record['Contract Signed Date'] || record.contractSignedDate || null,
            collectionDay: record['Collection Day'] || record.collectionDay || '',
            collectionTime: record['Collection Time'] || record.collectionTime || '',
            feedingDay: record['Feeding Day'] || record.feedingDay || '',
            feedingTime: record['Feeding Time'] || record.feedingTime || '',
            hasSharedPost: (record['Has Shared Post'] || record.hasSharedPost || '').toString().toLowerCase() === 'yes',
            sharedPostDate: record['Shared Post Date'] || record.sharedPostDate || null,
          };

          // Skip if missing required fields
          if (!recipientData.name || !recipientData.phone) {
            skipped++;
            continue;
          }

          // Convert estimated sandwiches to number
          if (recipientData.estimatedSandwiches) {
            recipientData.estimatedSandwiches = parseInt(recipientData.estimatedSandwiches, 10);
          }

          // Validate and create recipient
          const validatedData = insertRecipientSchema.parse(recipientData);
          await storage.createRecipient(validatedData);
          imported++;
        } catch (error) {
          console.error('Error importing recipient record:', error);
          skipped++;
        }
      }

      res.json({ imported, skipped });
    } catch (error) {
      console.error('Failed to import recipients', error);
      res.status(500).json({ error: 'Failed to import recipients' });
    }
  }
);

// GET /api/recipients/:id - Get single recipient
router.get(
  '/:id',
  requirePermission(PERMISSIONS.RECIPIENTS_VIEW),
  async (req, res) => {
    try {
      console.log('[RECIPIENTS GET BY ID] Route hit with id:', req.params.id);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        console.log('[RECIPIENTS GET BY ID] Invalid ID - returning 400');
        return res.status(400).json({ error: 'Invalid recipient ID' });
      }

      const recipient = await storage.getRecipient(id);
      if (!recipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      res.json(recipient);
    } catch (error) {
      console.error('Error fetching recipient:', error);
      res.status(500).json({ error: 'Failed to fetch recipient' });
    }
  }
);

// POST /api/recipients - Create new recipient
router.post(
  '/',
  requirePermission(PERMISSIONS.RECIPIENTS_ADD),
  async (req, res) => {
    try {
      const validatedData = insertRecipientSchema.parse(req.body);

      const recipient = await storage.createRecipient(validatedData);
      res.status(201).json(recipient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid data',
          details: error.errors,
        });
      }

      console.error('Error creating recipient:', error);
      res.status(500).json({ error: 'Failed to create recipient' });
    }
  }
);

// PUT /api/recipients/:id - Update recipient
router.put(
  '/:id',
  requirePermission(PERMISSIONS.RECIPIENTS_EDIT),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid recipient ID' });
      }

      // Check if recipient exists
      const existingRecipient = await storage.getRecipient(id);
      if (!existingRecipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      // Validate the update data (partial)
      const updateSchema = insertRecipientSchema.partial();
      const validatedData = updateSchema.parse(req.body);

      const updatedRecipient = await storage.updateRecipient(id, validatedData);
      if (!updatedRecipient) {
        return res
          .status(404)
          .json({ error: 'Recipient not found after update' });
      }

      res.json(updatedRecipient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid data',
          details: error.errors,
        });
      }

      console.error('Error updating recipient:', error);
      res.status(500).json({ error: 'Failed to update recipient' });
    }
  }
);

// DELETE /api/recipients/:id - Delete recipient
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.RECIPIENTS_DELETE),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid recipient ID' });
      }

      const success = await storage.deleteRecipient(id);
      if (!success) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      res.json({ success: true, message: 'Recipient deleted successfully' });
    } catch (error) {
      console.error('Error deleting recipient:', error);
      res.status(500).json({ error: 'Failed to delete recipient' });
    }
  }
);

// PATCH /api/recipients/:id/status - Update recipient status
router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.RECIPIENTS_EDIT),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid recipient ID' });
      }

      const { status } = req.body;
      if (!status || !['active', 'inactive'].includes(status)) {
        return res
          .status(400)
          .json({ error: "Status must be 'active' or 'inactive'" });
      }

      const updatedRecipient = await storage.updateRecipient(id, { status });
      if (!updatedRecipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      res.json(updatedRecipient);
    } catch (error) {
      console.error('Error updating recipient status:', error);
      res.status(500).json({ error: 'Failed to update recipient status' });
    }
  }
);

export default router;
