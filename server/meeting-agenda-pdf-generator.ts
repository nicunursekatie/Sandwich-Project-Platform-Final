import { format } from 'date-fns';

interface Meeting {
  id: number;
  title: string;
  date: string;
  time: string;
  type: string;
  description?: string;
  location?: string;
}

interface AgendaItem {
  id: number;
  title: string;
  description?: string;
  submittedBy: string;
  type: string;
  estimatedTime?: string;
}

interface AgendaSection {
  id: number;
  title: string;
  items: AgendaItem[];
}

interface CompiledAgenda {
  id: number;
  meetingId: number;
  date: string;
  status: string;
  totalEstimatedTime?: string;
  sections?: AgendaSection[];
}

export class MeetingAgendaPDFGenerator {
  static async generatePDF(meeting: Meeting, agenda?: CompiledAgenda): Promise<Buffer> {
    // Dynamic import for ES modules
    const PDFKit = (await import("pdfkit")).default;
    const doc = new PDFKit({ margin: 50 });

    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // TSP Brand Colors
      const colors = {
        orange: '#FBAD3F',
        navy: '#236383',
        lightBlue: '#47B3CB',
        darkGray: '#333333',
        lightGray: '#666666',
        white: '#FFFFFF'
      };

      let yPosition = 50;

      // HEADER WITH TSP BRANDING
      doc.fontSize(24).fillColor(colors.navy).text('The Sandwich Project', 50, yPosition);
      doc.fontSize(18).fillColor(colors.orange).text('Meeting Agenda', 50, yPosition + 30);
      
      // Meeting details
      const meetingDate = format(new Date(meeting.date), 'EEEE, MMMM dd, yyyy');
      const meetingTime = meeting.time && meeting.time !== 'TBD' ? meeting.time : 'TBD';
      
      doc.fontSize(14).fillColor(colors.darkGray)
         .text(`${meeting.title}`, 50, yPosition + 60)
         .text(`${meetingDate} at ${meetingTime}`, 50, yPosition + 80);
      
      if (meeting.location) {
        doc.text(`Location: ${meeting.location}`, 50, yPosition + 100);
        yPosition += 20;
      }

      yPosition += 140;

      // Meeting description if available
      if (meeting.description) {
        doc.fontSize(12).fillColor(colors.darkGray).text(meeting.description, 50, yPosition, { width: 500 });
        yPosition += 40;
      }

      // If compiled agenda exists, show sections
      if (agenda && agenda.sections && agenda.sections.length > 0) {
        doc.fontSize(16).fillColor(colors.navy).text('AGENDA', 50, yPosition);
        yPosition += 30;

        // Add estimated total time if available
        if (agenda.totalEstimatedTime) {
          doc.fontSize(12).fillColor(colors.darkGray)
             .text(`Estimated Duration: ${agenda.totalEstimatedTime}`, 50, yPosition);
          yPosition += 25;
        }

        // Process each section
        agenda.sections.forEach((section, sectionIndex) => {
          // Check if we need a new page
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }

          // Section header
          doc.fontSize(14).fillColor(colors.navy).text(`${sectionIndex + 1}. ${section.title}`, 50, yPosition);
          yPosition += 25;

          // Section items
          if (section.items && section.items.length > 0) {
            section.items.forEach((item, itemIndex) => {
              // Check if we need a new page
              if (yPosition > 720) {
                doc.addPage();
                yPosition = 50;
              }

              // Item title
              doc.fontSize(12).fillColor(colors.darkGray)
                 .text(`${sectionIndex + 1}.${itemIndex + 1} ${item.title}`, 70, yPosition);
              yPosition += 18;

              // Item description
              if (item.description) {
                doc.fontSize(10).fillColor(colors.lightGray)
                   .text(item.description, 90, yPosition, { width: 450 });
                yPosition += 15;
              }

              // Item metadata
              const metadata = [];
              if (item.submittedBy) metadata.push(`Presenter: ${item.submittedBy}`);
              if (item.estimatedTime) metadata.push(`Time: ${item.estimatedTime}`);
              if (item.type) metadata.push(`Type: ${item.type.replace('_', ' ')}`);
              
              if (metadata.length > 0) {
                doc.fontSize(9).fillColor(colors.lightGray)
                   .text(metadata.join(' • '), 90, yPosition);
                yPosition += 15;
              }

              yPosition += 5; // Extra spacing between items
            });
          } else {
            doc.fontSize(10).fillColor(colors.lightGray)
               .text('No items scheduled for this section', 70, yPosition);
            yPosition += 20;
          }

          yPosition += 15; // Extra spacing between sections
        });
      } else {
        // No compiled agenda available
        doc.fontSize(16).fillColor(colors.navy).text('AGENDA', 50, yPosition);
        yPosition += 30;
        
        // Show the standard sections structure
        const standardSections = ['Old Business', 'Urgent Items', 'Housekeeping', 'New Business'];
        
        standardSections.forEach((section, index) => {
          doc.fontSize(14).fillColor(colors.navy).text(`${index + 1}. ${section}`, 50, yPosition);
          yPosition += 25;
          
          doc.fontSize(10).fillColor(colors.lightGray)
             .text('Items to be determined', 70, yPosition);
          yPosition += 30;
        });
      }

      // Footer
      const pageCount = doc.bufferedPageRange();
      for (let i = 0; i < pageCount.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor(colors.lightGray)
           .text(`The Sandwich Project • Meeting Agenda • Page ${i + 1} of ${pageCount.count}`, 
                  50, doc.page.height - 50, { align: 'center', width: doc.page.width - 100 });
      }

      doc.end();
    });
  }
}