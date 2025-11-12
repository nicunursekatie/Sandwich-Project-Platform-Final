import { Router } from 'express';
import { ServiceHoursPDFGenerator } from '../services/service-hours-pdf-generator';
import { authenticateUser } from '../middleware/auth';
import { hasPermission } from '../middleware/permissions';
import { PERMISSIONS } from '@shared/auth-utils';
import { z } from 'zod';
import { logger } from '../logger';

const router = Router();

const serviceEntrySchema = z.object({
  date: z.string(),
  hours: z.string(),
  description: z.string(),
});

const serviceHoursRequestSchema = z.object({
  volunteerName: z.string().min(1, 'Volunteer name is required'),
  serviceEntries: z.array(serviceEntrySchema).min(1, 'At least one service entry is required'),
  approverName: z.string().default('Katie Long'),
  approverContact: z.string().default(''),
  totalHours: z.number().min(0),
});

router.post(
  '/generate-service-hours-pdf',
  authenticateUser,
  hasPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
  async (req, res) => {
    try {
      // Validate request body
      const validatedData = serviceHoursRequestSchema.parse(req.body);

      logger.info('Generating service hours PDF', {
        userId: req.user?.id,
        volunteerName: validatedData.volunteerName,
        entries: validatedData.serviceEntries.length,
      });

      // Generate PDF
      const pdfBuffer = await ServiceHoursPDFGenerator.generatePDF(validatedData);

      // Convert to base64 for JSON response
      const pdfBase64 = pdfBuffer.toString('base64');

      res.json({
        success: true,
        pdf: pdfBase64,
      });
    } catch (error: any) {
      logger.error('Error generating service hours PDF:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }

      res.status(500).json({
        error: 'Failed to generate PDF',
        message: error.message,
      });
    }
  }
);

export default router;
