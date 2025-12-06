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
  approverSignature: string;
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
    const { width, height } = firstPage.getSize();

    console.log(`PDF Page dimensions: width=${width}, height=${height}`);

    // Embed fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // VOLUNTEER NAME field - positioned after "VOLUNTEER NAME:" text
    firstPage.drawText(data.volunteerName, {
      x: 258,
      y: height - 245,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Service entries table coordinates
    // The table has 6 rows and 2 main columns (left and right)
    // Each main column has: DATE | HOURS | DESCRIPTION

    // Left column X positions
    const leftColX = {
      date: 132,        // DATE column start
      hours: 190,       // HOURS column start
      description: 247  // DESCRIPTION column start
    };

    // Right column X positions
    const rightColX = {
      date: 347,        // DATE column start
      hours: 405,       // HOURS column start
      description: 462  // DESCRIPTION column start
    };

    // Starting Y position for first table row
    let currentY = height - 330;
    const rowHeight = 18.5;

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
        size: 8,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Draw hours
      firstPage.drawText(entry.hours.toString(), {
        x: colX.hours,
        y: currentY,
        size: 8,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Draw description (truncate if too long to fit in column)
      let description = entry.description;
      if (description.length > this.MAX_DESCRIPTION_LENGTH) {
        description = description.substring(0, this.TRUNCATE_AT) + '...';
      }
      firstPage.drawText(description, {
        x: colX.description,
        y: currentY,
        size: 8,
        font: font,
        color: rgb(0, 0, 0),
      });
    }

    // TOTAL COMMUNITY SERVICE HOURS COMPLETED field
    firstPage.drawText(data.totalHours.toString(), {
      x: 478,
      y: height - 445,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // Current date for TSP approval
    const currentDate = new Date().toLocaleDateString('en-US');

    // TSP Approval Section

    // Signature line (after "Signature:")
    if (data.approverSignature) {
      firstPage.drawText(data.approverSignature, {
        x: 215,
        y: height - 620,
        size: 11,
        font: font,
        color: rgb(0, 0, 0),
      });
    }

    // Print Name (after "Print Name:")
    firstPage.drawText(data.approverName, {
      x: 215,
      y: height - 645,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Date (to the right of Print Name)
    firstPage.drawText(currentDate, {
      x: 480,
      y: height - 645,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Contact # (after "Contact #:")
    firstPage.drawText(data.approverContact, {
      x: 270,
      y: height - 670,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Save the modified PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
