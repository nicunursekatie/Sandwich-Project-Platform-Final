import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

interface ServiceEntry {
  date: string;
  hours: string;
  description: string;
}

interface ServiceHoursData {
  volunteerName: string;
  serviceEntries: ServiceEntry[];
  approverName: string;
  approverContact: string;
  totalHours: number;
}

export class ServiceHoursPDFGenerator {
  private static readonly MAX_DESCRIPTION_LENGTH = 28;
  private static readonly TRUNCATE_AT = 25;

  static async generatePDF(data: ServiceHoursData): Promise<Buffer> {
    // Load the existing PDF template
    const templatePath = path.join(
      process.cwd(),
      'attached_assets',
      'TSP COMMUNITY SERVICE HOURS (1) (1) (1).pdf'
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error(`PDF template file not found at path: ${templatePath}. Please ensure the template exists.`);
    }

    const existingPdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Get the first page
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { height } = firstPage.getSize();

    // Embed fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Volunteer name
    firstPage.drawText(data.volunteerName, {
      x: 135,
      y: height - 158,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Service entries - Table starts around y=495 from top (305 from bottom)
    // Left column entries (DATE | HOURS | DESCRIPTION)
    const leftColX = { date: 42, hours: 72, description: 95 };
    // Right column entries
    const rightColX = { date: 150, hours: 180, description: 203 };

    // Starting Y position for first row (from bottom of page)
    let currentY = height - 218;
    const rowHeight = 12.5;

    // Format date helper
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    // Draw service entries (2 columns)
    for (let i = 0; i < data.serviceEntries.length; i++) {
      const entry = data.serviceEntries[i];
      const isLeftColumn = i % 2 === 0;
      const colX = isLeftColumn ? leftColX : rightColX;

      // Move Y down only when starting a new row (after both columns are filled)
      if (i > 0 && i % 2 === 0) {
        currentY -= rowHeight;
      }

      // Stop if we run out of space (12 entries maximum: 6 rows × 2 columns)
      if (i >= 12) break;

      // Draw date
      firstPage.drawText(formatDate(entry.date), {
        x: colX.date,
        y: currentY,
        size: 9,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Draw hours
      firstPage.drawText(entry.hours, {
        x: colX.hours,
        y: currentY,
        size: 9,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Draw description (truncate if too long)
      let description = entry.description;
      if (description.length > this.MAX_DESCRIPTION_LENGTH) {
        description = description.substring(0, this.TRUNCATE_AT) + '...';
      }
      firstPage.drawText(description, {
        x: colX.description,
        y: currentY,
        size: 9,
        font: font,
        color: rgb(0, 0, 0),
      });
    }

    // Total hours
    firstPage.drawText(data.totalHours.toString(), {
      x: 265,
      y: height - 310,
      size: 11,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // Current date for volunteer signature
    const currentDate = new Date().toLocaleDateString('en-US');

    // TSP Approval - Print Name
    firstPage.drawText(data.approverName, {
      x: 90,
      y: height - 387,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    // TSP Approval - Date
    firstPage.drawText(currentDate, {
      x: 305,
      y: height - 387,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    // TSP Approval - Contact
    firstPage.drawText(data.approverContact, {
      x: 90,
      y: height - 403,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Save the modified PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
