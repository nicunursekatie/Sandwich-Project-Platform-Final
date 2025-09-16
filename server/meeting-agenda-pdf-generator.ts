import PDFDocument from 'pdfkit';

interface AgendaItem {
  id: string;
  title: string;
  presenter?: string;
  estimatedTime?: number;
  type?: string;
  project?: any;
}

interface AgendaSection {
  title: string;
  items: AgendaItem[];
}

interface MeetingAgenda {
  title: string;
  date: string;
  startTime: string;
  location: string;
  description?: string;
  totalEstimatedTime?: string;
  sections: AgendaSection[];
}

export async function generateMeetingAgendaPDF(agenda: MeetingAgenda): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (error: any) => reject(error));

    // TSP Brand Colors
    const colors = {
      navy: '#236383',
      lightBlue: '#47B3CB',
      darkGray: '#333333',
      lightGray: '#666666',
      white: '#FFFFFF',
    };

    let yPosition = 50;

    // Helper function to sanitize text for PDF rendering
    const sanitizeText = (text: string): string => {
      if (!text) return '';
      
      return text
        // Smart quotes to regular quotes
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        // En/em dashes to regular dashes
        .replace(/[\u2013\u2014]/g, '-')
        // Bullet points
        .replace(/[\u2022\u2023\u25E6]/g, '•')
        // Other common problematic characters
        .replace(/[\u2026]/g, '...')
        .replace(/[\u00A0]/g, ' ')
        // Remove any remaining non-ASCII characters
        .replace(/[^\x00-\x7F]/g, '');
    };

    // Helper function to check if we need a new page
    const ensureSpace = (requiredSpace: number) => {
      if (yPosition + requiredSpace > 720) {
        addFooter();
        doc.addPage();
        yPosition = 50;
      }
    };

    // Helper function to add footer
    const addFooter = () => {
      doc
        .fontSize(10)
        .fillColor(colors.lightGray)
        .text(
          sanitizeText('The Sandwich Project | Meeting Agenda | Generated ') + 
          new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          50, 
          750, 
          { align: 'center', width: doc.page.width - 100 }
        );
    };

    // Header
    doc
      .fontSize(20)
      .fillColor(colors.navy)
      .text(sanitizeText('The Sandwich Project'), 50, yPosition);
    yPosition += 30;

    doc
      .fontSize(16)
      .fillColor(colors.darkGray)
      .text(sanitizeText('Meeting Agenda'), 50, yPosition);
    yPosition += 40;

    // Meeting details
    doc
      .fontSize(14)
      .fillColor(colors.darkGray)
      .text(sanitizeText(agenda.title), 50, yPosition);
    yPosition += 20;

    doc
      .fontSize(12)
      .fillColor(colors.lightGray)
      .text(sanitizeText(`${agenda.date} at ${agenda.startTime}`), 50, yPosition);
    yPosition += 15;

    doc
      .fontSize(12)
      .fillColor(colors.lightGray)
      .text(sanitizeText(`Location: ${agenda.location}`), 50, yPosition);
    yPosition += 30;

    // Meeting description
    if (agenda.description) {
      doc
        .fontSize(12)
        .fillColor(colors.darkGray)
        .text(sanitizeText('Meeting Description:'), 50, yPosition);
      yPosition += 20;

      doc
        .fontSize(11)
        .fillColor(colors.lightGray)
        .text(sanitizeText(` ${agenda.description}`), 50, yPosition);
      yPosition += 40;
    }

    // Process each section
    agenda.sections.forEach((section, sectionIndex) => {
      ensureSpace(60);

      // Section header
      doc
        .fontSize(16)
        .fillColor(colors.darkGray)
        .text(sanitizeText(`${sectionIndex + 1}. ${section.title}`), 50, yPosition);
      yPosition += 40;

      // Section items
      if (section.items && section.items.length > 0) {
        section.items.forEach((item, itemIndex) => {
          ensureSpace(100);

          // Item title
          doc
            .fontSize(12)
            .fillColor(colors.darkGray)
            .text(sanitizeText(`${sectionIndex + 1}.${itemIndex + 1} ${item.title}`), 50, yPosition);
          yPosition += 20;

          // If this is a project item, show detailed project information
          if (item.project) {
            const project = item.project;
            
            // Project metadata on multiple lines
            const leftColumn = [];
            const rightColumn = [];
            
            if (project.assigneeName) leftColumn.push(`Owner:       ${project.assigneeName}`);
            if (project.supportPeople) rightColumn.push(`Support:       ${project.supportPeople}`);
            if (project.status) leftColumn.push(`Status:      ${project.status}`);
            if (project.priority) rightColumn.push(`Priority:      ${project.priority}`);

            const maxLines = Math.max(leftColumn.length, rightColumn.length);
            for (let i = 0; i < maxLines; i++) {
              if (leftColumn[i]) {
                doc
                  .fontSize(10)
                  .fillColor(colors.lightGray)
                  .text(sanitizeText(`  ${leftColumn[i]}`), 50, yPosition);
              }
              if (rightColumn[i]) {
                doc
                  .fontSize(10)
                  .fillColor(colors.lightGray)
                  .text(sanitizeText(`${rightColumn[i]}`), 350, yPosition);
              }
              yPosition += 12;
            }
            yPosition += 10;

            // Project Description
            if (project.description) {
              doc
                .fontSize(11)
                .fillColor(colors.darkGray)
                .text(sanitizeText('Description:'), 50, yPosition);
              yPosition += 15;
              
              doc
                .fontSize(10)
                .fillColor(colors.lightGray)
                .text(sanitizeText(`   ${project.description}`), 50, yPosition, { width: 500 });
              yPosition += 25;
            }

            // Discussion Points
            if (project.meetingDiscussionPoints) {
              ensureSpace(40);
              doc
                .fontSize(11)
                .fillColor(colors.darkGray)
                .text(sanitizeText('   What do we need to talk about?'), 50, yPosition);
              yPosition += 20;
              
              doc
                .fontSize(10)
                .fillColor(colors.lightGray)
                .text(sanitizeText(`      ${project.meetingDiscussionPoints}`), 50, yPosition, { width: 500 });
              yPosition += 25;
            }

            // Decision Items
            if (project.meetingDecisionItems) {
              ensureSpace(40);
              doc
                .fontSize(11)
                .fillColor(colors.darkGray)
                .text(sanitizeText('   What decisions need to be made?'), 50, yPosition);
              yPosition += 20;
              
              doc
                .fontSize(10)
                .fillColor(colors.lightGray)
                .text(sanitizeText(`      ${project.meetingDecisionItems}`), 50, yPosition, { width: 500 });
              yPosition += 25;
            }

            // Project Tasks
            if (project.tasks && project.tasks.length > 0) {
              ensureSpace(40);
              doc
                .fontSize(11)
                .fillColor(colors.darkGray)
                .text(sanitizeText('   Project Tasks:'), 50, yPosition);
              yPosition += 20;

              project.tasks.forEach((task: any, taskIndex: number) => {
                ensureSpace(40);
                doc
                  .fontSize(10)
                  .fillColor(colors.lightGray)
                  .text(sanitizeText(`      ${taskIndex + 1}. ${task.description || task.title || 'No description'}`), 50, yPosition, { width: 500 });
                yPosition += 15;

                if (task.priority) {
                  doc
                    .fontSize(9)
                    .fillColor(colors.lightGray)
                    .text(sanitizeText(`           Priority: ${task.priority}`), 50, yPosition);
                  yPosition += 15;
                }
                yPosition += 10;
              });
            }

            yPosition += 15;
          } else {
            // Regular agenda item (not a project)
            if (item.presenter) {
              doc
                .fontSize(10)
                .fillColor(colors.lightGray)
                .text(sanitizeText(`    Presenter: ${item.presenter} | Time: ${item.estimatedTime || '5'} mins | Type: ${item.type || 'agenda item'}`), 50, yPosition);
              yPosition += 20;
            }
          }

          yPosition += 15;
        });
      }

      yPosition += 10;
    });

    // Add final footer
    addFooter();
    doc.end();
  });
}