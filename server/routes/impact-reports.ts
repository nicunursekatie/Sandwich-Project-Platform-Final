import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { impactReports, eventRequests } from '../../shared/schema';
import { eq, desc, and, gt, inArray } from 'drizzle-orm';
import { logger } from '../middleware/logger';
import { generateImpactReport, saveImpactReport } from '../services/ai-impact-reports';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

// POST /api/impact-reports/generate-pdf - Generate and download an AI impact report as PDF
impactReportsRouter.post('/generate-pdf', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { startDate, endDate, reportType } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    logger.info('Generating impact report PDF', {
      userId: req.user.id,
      startDate,
      endDate,
      reportType,
    });

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Generate the AI report
    const report = await generateImpactReport(start, end, reportType || 'custom');

    // Generate PDF
    const doc = new (jsPDF as any)();
    const primaryColor: [number, number, number] = [35, 99, 131]; // TSP brand color #236383
    const darkGray: [number, number, number] = [102, 102, 102];
    const lightGray: [number, number, number] = [248, 249, 250];

    let yPosition = 20;

    // Header with logo area
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 220, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(report.title, 20, 25);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const dateRangeStr = `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    doc.text(dateRangeStr, 20, 35);

    yPosition = 55;

    // Key Metrics Section
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Metrics', 20, yPosition);
    yPosition += 10;

    const metricsData = [
      ['Events Completed', report.metrics.eventsCompleted.toLocaleString()],
      ['Sandwiches Distributed', report.metrics.sandwichesDistributed.toLocaleString()],
      ['People Served', report.metrics.peopleServed.toLocaleString()],
      ['Organizations Served', report.metrics.organizationsServed.toLocaleString()],
      ['Volunteers Engaged', report.metrics.volunteersEngaged.toLocaleString()],
    ];

    if (report.metrics.expensesTotal) {
      metricsData.push(['Total Expenses', `$${report.metrics.expensesTotal.toLocaleString()}`]);
    }

    (doc as any).autoTable({
      startY: yPosition,
      head: [['Metric', 'Value']],
      body: metricsData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 10,
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // Sandwich Type Breakdown (if available)
    if (report.sandwichTypeBreakdown) {
      const types = report.sandwichTypeBreakdown;
      const totalTyped = types.deli + types.turkey + types.ham + types.pbj + types.generic;

      if (totalTyped > 0) {
        doc.setTextColor(...primaryColor);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Sandwich Type Breakdown', 20, yPosition);
        yPosition += 10;

        const typeData = [
          ['Deli', types.deli.toLocaleString(), `${((types.deli / totalTyped) * 100).toFixed(1)}%`],
          ['Turkey', types.turkey.toLocaleString(), `${((types.turkey / totalTyped) * 100).toFixed(1)}%`],
          ['Ham', types.ham.toLocaleString(), `${((types.ham / totalTyped) * 100).toFixed(1)}%`],
          ['PB&J', types.pbj.toLocaleString(), `${((types.pbj / totalTyped) * 100).toFixed(1)}%`],
        ];

        if (types.generic > 0) {
          typeData.push(['Other/Unspecified', types.generic.toLocaleString(), `${((types.generic / totalTyped) * 100).toFixed(1)}%`]);
        }

        (doc as any).autoTable({
          startY: yPosition,
          head: [['Type', 'Count', 'Percentage']],
          body: typeData,
          theme: 'striped',
          headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
          },
          bodyStyles: {
            fontSize: 10,
          },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 40, halign: 'right' },
            2: { cellWidth: 40, halign: 'right' },
          },
          margin: { left: 20, right: 20 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }
    }

    // Executive Summary
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', 20, yPosition);
    yPosition += 8;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Split executive summary into lines that fit the page width
    const summaryLines = doc.splitTextToSize(report.executiveSummary, 170);
    summaryLines.forEach((line: string) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, 20, yPosition);
      yPosition += 5;
    });

    yPosition += 10;

    // Highlights Section
    if (report.highlights && report.highlights.length > 0) {
      if (yPosition > 230) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Highlights', 20, yPosition);
      yPosition += 10;

      report.highlights.forEach((highlight, index) => {
        if (yPosition > 260) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFillColor(...lightGray);
        doc.roundedRect(20, yPosition - 4, 170, 20, 2, 2, 'F');

        doc.setTextColor(...primaryColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${highlight.title}`, 25, yPosition + 2);

        doc.setTextColor(...darkGray);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(highlight.description, 160);
        doc.text(descLines[0], 25, yPosition + 10);

        if (highlight.metric) {
          doc.setTextColor(...primaryColor);
          doc.setFont('helvetica', 'bold');
          doc.text(highlight.metric, 165, yPosition + 2, { align: 'right' });
        }

        yPosition += 25;
      });
    }

    // Trends Section
    if (report.trends && report.trends.length > 0) {
      if (yPosition > 230) {
        doc.addPage();
        yPosition = 20;
      }

      yPosition += 5;
      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Trends & Insights', 20, yPosition);
      yPosition += 10;

      const trendIcons: Record<string, string> = {
        growth: '📈',
        decline: '📉',
        seasonal: '🗓️',
        emerging: '🌟',
      };

      report.trends.forEach((trend) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }

        const icon = trendIcons[trend.category] || '•';
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const trendText = `${icon} ${trend.description}`;
        const trendLines = doc.splitTextToSize(trendText, 170);
        trendLines.forEach((line: string) => {
          doc.text(line, 20, yPosition);
          yPosition += 5;
        });
        yPosition += 3;
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...darkGray);
      doc.text(
        `Page ${i} of ${pageCount} • Generated by The Sandwich Project`,
        105,
        290,
        { align: 'center' }
      );
      doc.text(
        `🤖 AI-Generated Report • ${new Date().toLocaleDateString()}`,
        105,
        295,
        { align: 'center' }
      );
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Set response headers for PDF download
    const filename = `TSP_Impact_Report_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    logger.error('Error generating impact report PDF', { error });
    res.status(500).json({
      error: 'Failed to generate impact report PDF',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/impact-reports/analyze-sheet - AI-powered column detection for sheet data
impactReportsRouter.post('/analyze-sheet', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { csvData } = req.body;

    if (!csvData || typeof csvData !== 'string') {
      return res.status(400).json({ error: 'CSV data is required' });
    }

    // Parse CSV to get headers and sample rows
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have at least a header row and one data row' });
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const sampleRows = lines.slice(1, 6).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || '';
      });
      return row;
    });

    // Use OpenAI to detect column mappings
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a data analyst helping to map spreadsheet columns to a database schema.

The user has spreadsheet data about sandwich-making events. We need to identify which columns map to:
- date: The event date (required)
- organizationName: The organization or group name (required)
- deli: Count of deli sandwiches
- turkey: Count of turkey sandwiches
- ham: Count of ham sandwiches
- pbj: Count of PB&J/peanut butter sandwiches
- totalSandwiches: Total sandwich count (if types aren't broken down)

Analyze the column headers and sample data to suggest mappings. Be flexible with naming - "PB&J", "Peanut Butter", "PBJ" all map to pbj. "Event Date", "Date", "When" all map to date.

Return JSON with this structure:
{
  "mappings": {
    "date": "column name or null",
    "organizationName": "column name or null",
    "deli": "column name or null",
    "turkey": "column name or null",
    "ham": "column name or null",
    "pbj": "column name or null",
    "totalSandwiches": "column name or null"
  },
  "confidence": "high" | "medium" | "low",
  "notes": "Any observations or warnings about the data"
}`,
        },
        {
          role: 'user',
          content: `Column headers: ${JSON.stringify(headers)}

Sample data (first few rows):
${JSON.stringify(sampleRows, null, 2)}

Please analyze and suggest column mappings.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No response from AI');
    }

    const analysis = JSON.parse(responseContent);

    res.json({
      headers,
      sampleRows,
      suggestedMappings: analysis.mappings,
      confidence: analysis.confidence,
      notes: analysis.notes,
      totalRows: lines.length - 1,
    });

  } catch (error) {
    logger.error('Error analyzing sheet data', { error });
    res.status(500).json({
      error: 'Failed to analyze sheet data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/impact-reports/backfill-sandwich-types - Import sandwich type data
impactReportsRouter.post('/backfill-sandwich-types', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { csvData, mappings } = req.body;

    if (!csvData || !mappings) {
      return res.status(400).json({ error: 'CSV data and mappings are required' });
    }

    // Parse CSV
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    // Process each row
    const results = {
      processed: 0,
      updated: 0,
      notFound: 0,
      errors: 0,
      details: [] as Array<{ row: number; status: string; message: string }>,
    };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      results.processed++;

      try {
        // Extract mapped values
        const dateStr = mappings.date ? row[mappings.date] : null;
        const orgName = mappings.organizationName ? row[mappings.organizationName] : null;

        if (!dateStr || !orgName) {
          results.details.push({
            row: i + 1,
            status: 'skipped',
            message: 'Missing date or organization name',
          });
          continue;
        }

        // Parse date (handle various formats)
        let eventDate: Date;
        try {
          eventDate = new Date(dateStr);
          if (isNaN(eventDate.getTime())) {
            throw new Error('Invalid date');
          }
        } catch {
          results.details.push({
            row: i + 1,
            status: 'error',
            message: `Invalid date format: ${dateStr}`,
          });
          results.errors++;
          continue;
        }

        // Build sandwich types array
        const sandwichTypes: Array<{ type: string; quantity: number }> = [];

        if (mappings.deli && row[mappings.deli]) {
          const qty = parseInt(row[mappings.deli]) || 0;
          if (qty > 0) sandwichTypes.push({ type: 'deli', quantity: qty });
        }
        if (mappings.turkey && row[mappings.turkey]) {
          const qty = parseInt(row[mappings.turkey]) || 0;
          if (qty > 0) sandwichTypes.push({ type: 'turkey', quantity: qty });
        }
        if (mappings.ham && row[mappings.ham]) {
          const qty = parseInt(row[mappings.ham]) || 0;
          if (qty > 0) sandwichTypes.push({ type: 'ham', quantity: qty });
        }
        if (mappings.pbj && row[mappings.pbj]) {
          const qty = parseInt(row[mappings.pbj]) || 0;
          if (qty > 0) sandwichTypes.push({ type: 'pbj', quantity: qty });
        }

        // Find matching event request by date and organization name
        const { eventRequests } = await import('../../shared/schema');
        const { and, eq, gte, lt, ilike } = await import('drizzle-orm');

        // Search within a day window
        const dayStart = new Date(eventDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(eventDate);
        dayEnd.setHours(23, 59, 59, 999);

        const matchingEvents = await db.query.eventRequests.findMany({
          where: and(
            gte(eventRequests.scheduledEventDate, dayStart),
            lt(eventRequests.scheduledEventDate, dayEnd),
            ilike(eventRequests.organizationName, `%${orgName}%`)
          ),
        });

        if (matchingEvents.length === 0) {
          results.notFound++;
          results.details.push({
            row: i + 1,
            status: 'not_found',
            message: `No matching event found for ${orgName} on ${dateStr}`,
          });
          continue;
        }

        // Update the first matching event
        const eventToUpdate = matchingEvents[0];
        await db.update(eventRequests)
          .set({
            actualSandwichTypes: sandwichTypes,
          })
          .where(eq(eventRequests.id, eventToUpdate.id));

        results.updated++;
        results.details.push({
          row: i + 1,
          status: 'updated',
          message: `Updated ${eventToUpdate.organizationName} (ID: ${eventToUpdate.id})`,
        });

      } catch (rowError) {
        results.errors++;
        results.details.push({
          row: i + 1,
          status: 'error',
          message: rowError instanceof Error ? rowError.message : 'Unknown error',
        });
      }
    }

    logger.info('Sandwich type backfill completed', {
      userId: req.user.id,
      ...results,
    });

    res.json(results);

  } catch (error) {
    logger.error('Error backfilling sandwich types', { error });
    res.status(500).json({
      error: 'Failed to backfill sandwich types',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ========================================
// SMART SANDWICH TYPE BACKFILL TOOL
// ========================================

// GET /api/impact-reports/events-missing-types - Find events that have sandwich counts but no type data
impactReportsRouter.get('/events-missing-types', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Find completed events with actualSandwichCount > 0 but no actualSandwichTypes
    const events = await db.query.eventRequests.findMany({
      where: and(
        eq(eventRequests.status, 'completed'),
        gt(eventRequests.actualSandwichCount, 0)
      ),
    });

    // Filter to events missing type data
    const eventsMissingTypes = events.filter((e) => {
      if (!e.actualSandwichTypes) return true;
      if (!Array.isArray(e.actualSandwichTypes)) return true;
      if (e.actualSandwichTypes.length === 0) return true;
      // Check if all quantities are 0
      const totalTyped = (e.actualSandwichTypes as Array<{ type: string; quantity: number }>)
        .reduce((sum, t) => sum + (t.quantity || 0), 0);
      return totalTyped === 0;
    });

    // Also get events that DO have type data for pattern analysis
    const eventsWithTypes = events.filter((e) => {
      if (!e.actualSandwichTypes || !Array.isArray(e.actualSandwichTypes)) return false;
      const totalTyped = (e.actualSandwichTypes as Array<{ type: string; quantity: number }>)
        .reduce((sum, t) => sum + (t.quantity || 0), 0);
      return totalTyped > 0;
    });

    // Build pattern data by organization
    const patternsByOrg = new Map<string, {
      events: number;
      avgDeli: number;
      avgTurkey: number;
      avgHam: number;
      avgPbj: number;
      avgGeneric: number;
    }>();

    eventsWithTypes.forEach((e) => {
      const orgName = e.organizationName || 'Unknown';
      const types = e.actualSandwichTypes as Array<{ type: string; quantity: number }>;
      const total = e.actualSandwichCount || 1;

      let deli = 0, turkey = 0, ham = 0, pbj = 0, generic = 0;
      types.forEach((t) => {
        const typeLower = (t.type || '').toLowerCase();
        if (typeLower.includes('deli')) deli += t.quantity || 0;
        else if (typeLower.includes('turkey')) turkey += t.quantity || 0;
        else if (typeLower.includes('ham')) ham += t.quantity || 0;
        else if (typeLower.includes('pbj') || typeLower.includes('peanut')) pbj += t.quantity || 0;
        else generic += t.quantity || 0;
      });

      const existing = patternsByOrg.get(orgName);
      if (existing) {
        const n = existing.events;
        patternsByOrg.set(orgName, {
          events: n + 1,
          avgDeli: (existing.avgDeli * n + (deli / total) * 100) / (n + 1),
          avgTurkey: (existing.avgTurkey * n + (turkey / total) * 100) / (n + 1),
          avgHam: (existing.avgHam * n + (ham / total) * 100) / (n + 1),
          avgPbj: (existing.avgPbj * n + (pbj / total) * 100) / (n + 1),
          avgGeneric: (existing.avgGeneric * n + (generic / total) * 100) / (n + 1),
        });
      } else {
        patternsByOrg.set(orgName, {
          events: 1,
          avgDeli: (deli / total) * 100,
          avgTurkey: (turkey / total) * 100,
          avgHam: (ham / total) * 100,
          avgPbj: (pbj / total) * 100,
          avgGeneric: (generic / total) * 100,
        });
      }
    });

    res.json({
      eventsMissingTypes: eventsMissingTypes.map((e) => ({
        id: e.id,
        organizationName: e.organizationName,
        organizationCategory: e.organizationCategory,
        scheduledEventDate: e.scheduledEventDate,
        actualSandwichCount: e.actualSandwichCount,
        hasOrgPattern: patternsByOrg.has(e.organizationName || ''),
      })),
      totalMissing: eventsMissingTypes.length,
      totalWithTypes: eventsWithTypes.length,
      organizationPatterns: Object.fromEntries(patternsByOrg),
    });
  } catch (error) {
    logger.error('Error fetching events missing types', { error });
    res.status(500).json({ error: 'Failed to fetch events missing types' });
  }
});

// POST /api/impact-reports/ai-suggest-types - AI analyzes events and suggests type distributions
impactReportsRouter.post('/ai-suggest-types', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { eventIds } = req.body;
    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ error: 'eventIds array is required' });
    }

    // Limit batch size
    const batchIds = eventIds.slice(0, 50);

    // Get the events to analyze
    const eventsToAnalyze = await db.query.eventRequests.findMany({
      where: inArray(eventRequests.id, batchIds),
    });

    // Get events with type data for context
    const eventsWithTypes = await db.query.eventRequests.findMany({
      where: and(
        eq(eventRequests.status, 'completed'),
        gt(eventRequests.actualSandwichCount, 0)
      ),
    });

    // Build pattern context
    const patterns: Record<string, { deli: number; turkey: number; ham: number; pbj: number; generic: number; count: number }> = {};

    eventsWithTypes.forEach((e) => {
      if (!e.actualSandwichTypes || !Array.isArray(e.actualSandwichTypes)) return;
      const types = e.actualSandwichTypes as Array<{ type: string; quantity: number }>;
      const totalTyped = types.reduce((sum, t) => sum + (t.quantity || 0), 0);
      if (totalTyped === 0) return;

      const orgName = e.organizationName || 'Unknown';
      const total = e.actualSandwichCount || totalTyped;

      let deli = 0, turkey = 0, ham = 0, pbj = 0, generic = 0;
      types.forEach((t) => {
        const typeLower = (t.type || '').toLowerCase();
        if (typeLower.includes('deli')) deli += t.quantity || 0;
        else if (typeLower.includes('turkey')) turkey += t.quantity || 0;
        else if (typeLower.includes('ham')) ham += t.quantity || 0;
        else if (typeLower.includes('pbj') || typeLower.includes('peanut')) pbj += t.quantity || 0;
        else generic += t.quantity || 0;
      });

      if (!patterns[orgName]) {
        patterns[orgName] = { deli: 0, turkey: 0, ham: 0, pbj: 0, generic: 0, count: 0 };
      }
      patterns[orgName].deli += (deli / total);
      patterns[orgName].turkey += (turkey / total);
      patterns[orgName].ham += (ham / total);
      patterns[orgName].pbj += (pbj / total);
      patterns[orgName].generic += (generic / total);
      patterns[orgName].count += 1;
    });

    // Average the patterns
    Object.keys(patterns).forEach((org) => {
      const p = patterns[org];
      if (p.count > 0) {
        p.deli = p.deli / p.count;
        p.turkey = p.turkey / p.count;
        p.ham = p.ham / p.count;
        p.pbj = p.pbj / p.count;
        p.generic = p.generic / p.count;
      }
    });

    // Generate suggestions
    const suggestions = eventsToAnalyze.map((event) => {
      const orgName = event.organizationName || '';
      const total = event.actualSandwichCount || 0;
      const orgPattern = patterns[orgName];

      let suggestion: { deli: number; turkey: number; ham: number; pbj: number; generic: number };
      let confidence: 'high' | 'medium' | 'low';
      let reasoning: string;

      if (orgPattern && orgPattern.count >= 2) {
        // Use organization's historical pattern
        suggestion = {
          deli: Math.round(total * orgPattern.deli),
          turkey: Math.round(total * orgPattern.turkey),
          ham: Math.round(total * orgPattern.ham),
          pbj: Math.round(total * orgPattern.pbj),
          generic: Math.round(total * orgPattern.generic),
        };
        confidence = 'high';
        reasoning = `Based on ${orgPattern.count} previous events from "${orgName}"`;
      } else if (orgPattern && orgPattern.count === 1) {
        // Single historical data point
        suggestion = {
          deli: Math.round(total * orgPattern.deli),
          turkey: Math.round(total * orgPattern.turkey),
          ham: Math.round(total * orgPattern.ham),
          pbj: Math.round(total * orgPattern.pbj),
          generic: Math.round(total * orgPattern.generic),
        };
        confidence = 'medium';
        reasoning = `Based on 1 previous event from "${orgName}"`;
      } else {
        // No pattern - use category-based defaults or generic split
        const category = event.organizationCategory || 'other';

        // Category-based defaults (can be refined based on actual data)
        if (category === 'school') {
          suggestion = {
            deli: Math.round(total * 0.35),
            turkey: Math.round(total * 0.25),
            ham: Math.round(total * 0.15),
            pbj: Math.round(total * 0.25),
            generic: 0,
          };
          reasoning = 'Default school distribution (schools often have PB&J for dietary needs)';
        } else if (category === 'church_faith') {
          suggestion = {
            deli: Math.round(total * 0.40),
            turkey: Math.round(total * 0.30),
            ham: Math.round(total * 0.20),
            pbj: Math.round(total * 0.10),
            generic: 0,
          };
          reasoning = 'Default faith organization distribution';
        } else {
          // Generic default
          suggestion = {
            deli: Math.round(total * 0.40),
            turkey: Math.round(total * 0.30),
            ham: Math.round(total * 0.20),
            pbj: Math.round(total * 0.10),
            generic: 0,
          };
          reasoning = 'Generic distribution (no historical data for this organization)';
        }
        confidence = 'low';
      }

      // Adjust to make sure total matches
      const suggestionTotal = suggestion.deli + suggestion.turkey + suggestion.ham + suggestion.pbj + suggestion.generic;
      if (suggestionTotal !== total && total > 0) {
        const diff = total - suggestionTotal;
        suggestion.deli += diff; // Add difference to deli (most common)
      }

      return {
        eventId: event.id,
        organizationName: event.organizationName,
        organizationCategory: event.organizationCategory,
        scheduledEventDate: event.scheduledEventDate,
        actualSandwichCount: event.actualSandwichCount,
        suggestion,
        confidence,
        reasoning,
      };
    });

    res.json({
      suggestions,
      totalAnalyzed: suggestions.length,
      patternsUsed: Object.keys(patterns).length,
    });
  } catch (error) {
    logger.error('Error generating sandwich type suggestions', { error });
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

// POST /api/impact-reports/apply-sandwich-types - Apply approved sandwich type suggestions
impactReportsRouter.post('/apply-sandwich-types', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { approvals } = req.body;
    if (!approvals || !Array.isArray(approvals) || approvals.length === 0) {
      return res.status(400).json({ error: 'approvals array is required' });
    }

    let updated = 0;
    let errors = 0;

    for (const approval of approvals) {
      try {
        const { eventId, types } = approval;
        if (!eventId || !types) continue;

        // Build actualSandwichTypes array
        const actualSandwichTypes: Array<{ type: string; quantity: number }> = [];
        if (types.deli > 0) actualSandwichTypes.push({ type: 'Deli', quantity: types.deli });
        if (types.turkey > 0) actualSandwichTypes.push({ type: 'Turkey', quantity: types.turkey });
        if (types.ham > 0) actualSandwichTypes.push({ type: 'Ham', quantity: types.ham });
        if (types.pbj > 0) actualSandwichTypes.push({ type: 'PB&J', quantity: types.pbj });
        if (types.generic > 0) actualSandwichTypes.push({ type: 'Other', quantity: types.generic });

        await db.update(eventRequests)
          .set({
            actualSandwichTypes: actualSandwichTypes,
            updatedAt: new Date(),
          })
          .where(eq(eventRequests.id, eventId));

        updated++;
      } catch (err) {
        errors++;
        logger.error('Error applying sandwich type to event', { approval, error: err });
      }
    }

    logger.info('Sandwich types applied', { updated, errors, userId: req.user.id });

    res.json({
      success: true,
      updated,
      errors,
      message: `Updated ${updated} events${errors > 0 ? `, ${errors} errors` : ''}`,
    });
  } catch (error) {
    logger.error('Error applying sandwich types', { error });
    res.status(500).json({ error: 'Failed to apply sandwich types' });
  }
});

// GET /api/impact-reports/:id - Get a specific impact report
impactReportsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const reportId = parseInt(req.params.id);

    if (isNaN(reportId)) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

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

    if (isNaN(reportId)) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    // Check if report exists before updating
    const existingReport = await db.query.impactReports.findFirst({
      where: eq(impactReports.id, reportId),
    });

    if (!existingReport) {
      return res.status(404).json({ error: 'Impact report not found' });
    }

    // Update report status
    await db.update(impactReports)
      .set({
        status: 'published',
        publishedAt: new Date(),
        publishedBy: req.user.id,
        updatedAt: new Date(),
      })
      .where(eq(impactReports.id, reportId));

    // Fetch updated report
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
