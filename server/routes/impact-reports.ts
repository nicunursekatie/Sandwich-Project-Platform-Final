import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { impactReports } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../middleware/logger';
import { generateImpactReport, saveImpactReport } from '../services/ai-impact-reports';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

export const impactReportsRouter = Router();

// GET /api/impact-reports - List all impact reports
impactReportsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const reports = await db.query.impactReports.findMany({
      orderBy: [desc(impactReports.startDate)],
    });

    res.json(reports);
  } catch (error) {
    logger.error('Error fetching impact reports', { error });
    res.status(500).json({ error: 'Failed to fetch impact reports' });
  }
});

// POST /api/impact-reports/generate - Generate a new impact report
impactReportsRouter.post('/generate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { startDate, endDate, reportType } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const allowedReportTypes = ['monthly', 'quarterly', 'annual', 'custom'];
    if (reportType && !allowedReportTypes.includes(reportType)) {
      return res.status(400).json({ error: `Invalid reportType. Must be one of: ${allowedReportTypes.join(', ')}` });
    }

    logger.info('Generating impact report', {
      userId: req.user.id,
      startDate,
      endDate,
      reportType,
    });

    const start = new Date(startDate);
    const end = new Date(endDate);

    const report = await generateImpactReport(start, end, reportType || 'custom');
    const reportId = await saveImpactReport(report, start, end, reportType || 'custom', req.user.id);

    const savedReport = await db.query.impactReports.findFirst({
      where: eq(impactReports.id, reportId),
    });

    res.json(savedReport);
  } catch (error) {
    logger.error('Error generating impact report', { error });
    res.status(500).json({
      error: 'Failed to generate impact report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/impact-reports/:id - Get a specific impact report
impactReportsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const reportId = parseInt(req.params.id);
    const report = await db.query.impactReports.findFirst({
      where: eq(impactReports.id, reportId),
    });

    if (!report) {
      return res.status(404).json({ error: 'Impact report not found' });
    }

    res.json(report);
  } catch (error) {
    logger.error('Error fetching impact report', { error });
    res.status(500).json({ error: 'Failed to fetch impact report' });
  }
});

// PATCH /api/impact-reports/:id/publish - Publish an impact report
impactReportsRouter.patch('/:id/publish', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const reportId = parseInt(req.params.id);

    await db.update(impactReports)
      .set({
        status: 'published',
        publishedAt: new Date(),
        publishedBy: req.user.id,
      })
      .where(eq(impactReports.id, reportId));

    const report = await db.query.impactReports.findFirst({
      where: eq(impactReports.id, reportId),
    });

    logger.info('Impact report published', { reportId, userId: req.user.id });
    res.json(report);
  } catch (error) {
    logger.error('Error publishing impact report', { error });
    res.status(500).json({ error: 'Failed to publish impact report' });
  }
});
