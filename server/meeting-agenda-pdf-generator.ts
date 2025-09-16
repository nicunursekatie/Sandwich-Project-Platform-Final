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
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 0,
      layout: 'portrait'
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (error: any) => reject(error));

    // TSP Brand Colors
    const colors = {
      navy: '#236383',
      lightBlue: '#47B3CB', 
      orange: '#FF6B35',
      green: '#4CAF50',
      red: '#F44336',
      darkGray: '#333333',
      lightGray: '#666666',
      white: '#FFFFFF',
      sectionBlue: '#E3F2FD',
      dividerGray: '#CCCCCC'
    };

    let yPosition = 0;
    const pageWidth = 595.28; // A4 width
    const pageHeight = 841.89; // A4 height
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);

    // Helper function to sanitize text for PDF rendering
    const sanitizeText = (text: string): string => {
      if (!text) return '';
      
      return text
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[\u2022\u2023\u25E6]/g, '•')
        .replace(/[\u2026]/g, '...')
        .replace(/[\u00A0]/g, ' ')
        .replace(/[^\x00-\x7F]/g, '');
    };

    // Helper function to check if we need a new page
    const ensureSpace = (requiredSpace: number) => {
      if (yPosition + requiredSpace > pageHeight - 100) {
        doc.addPage();
        yPosition = 0;
      }
    };

    // Helper function to add colored header bar
    const addHeaderBar = (color: string, height: number) => {
      doc.rect(0, yPosition, pageWidth, height)
         .fill(color);
      yPosition += height;
    };

    // Helper function to add text with proper positioning
    const addText = (text: string, x: number, y: number, options: any = {}) => {
      const sanitizedText = sanitizeText(text);
      
      // Apply font size and color before adding text
      if (options.fontSize) {
        doc.fontSize(options.fontSize);
      }
      if (options.fillColor) {
        doc.fillColor(options.fillColor);
      }
      
      doc.text(sanitizedText, x, y, options);
    };

    // Helper function to add divider line
    const addDivider = (color: string, thickness: number = 1) => {
      doc.rect(margin, yPosition, contentWidth, thickness)
         .fill(color);
      yPosition += thickness + 10;
    };

    // Main header section
    addHeaderBar(colors.navy, 80);
    
    // Add "The Sandwich Project" title
    doc.fontSize(24)
       .fillColor(colors.white)
       .text('The Sandwich Project', margin, yPosition - 60, { width: contentWidth });
    
    // Add "Meeting Agenda" in orange
    doc.fontSize(20)
       .fillColor(colors.orange)
       .text('Meeting Agenda', margin, yPosition - 35, { width: contentWidth });
    
    // Add meeting date and time
    const meetingDate = new Date(agenda.date).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    doc.fontSize(14)
       .fillColor(colors.white)
       .text(`${meetingDate} at ${agenda.startTime}`, margin, yPosition - 15, { width: contentWidth });

    yPosition = 100; // Move past header

    // Meeting Description
    if (agenda.description) {
      addText('Meeting Description:', margin, yPosition, { 
        fontSize: 12, 
        fillColor: colors.darkGray 
      });
      yPosition += 20;
      
      addText(agenda.description, margin, yPosition, { 
        fontSize: 11, 
        fillColor: colors.lightGray,
        width: contentWidth
      });
      yPosition += 30;
    }

    // Process each section
    agenda.sections.forEach((section, sectionIndex) => {
      ensureSpace(100);

      // Section header with light blue background
      addHeaderBar(colors.sectionBlue, 30);
      
      addText(`${sectionIndex + 1}. ${section.title}`, margin, yPosition - 20, {
        fontSize: 14,
        fillColor: colors.navy,
        width: contentWidth
      });

      yPosition += 20;

      // Section items
      if (section.items && section.items.length > 0) {
        section.items.forEach((item, itemIndex) => {
          ensureSpace(150);

          // Item title
          addText(`${sectionIndex + 1}.${itemIndex + 1} ${item.title}`, margin, yPosition, {
            fontSize: 12,
            fillColor: colors.darkGray
          });
          yPosition += 20;

          // Add divider line
          addDivider(colors.dividerGray);

          // If this is a project item, show detailed project information
          if (item.project) {
            const project = item.project;
            
            // Project metadata in two columns
            const leftColumn = [];
            const rightColumn = [];
            
            if (project.assigneeName) leftColumn.push(`Owner: ${project.assigneeName}`);
            if (project.status) leftColumn.push(`Status: ${project.status}`);
            if (project.supportPeople) rightColumn.push(`Support: ${project.supportPeople}`);
            if (project.priority) rightColumn.push(`Priority: ${project.priority}`);

            const maxLines = Math.max(leftColumn.length, rightColumn.length);
            for (let i = 0; i < maxLines; i++) {
              if (leftColumn[i]) {
                addText(leftColumn[i], margin, yPosition, {
                  fontSize: 10,
                  fillColor: colors.lightGray
                });
              }
              if (rightColumn[i]) {
                addText(rightColumn[i], margin + 300, yPosition, {
                  fontSize: 10,
                  fillColor: colors.lightGray
                });
              }
              yPosition += 12;
            }
            yPosition += 10;

            // Add orange divider
            addDivider(colors.orange);

            // Discussion Points
            if (project.meetingDiscussionPoints) {
              addText('What do we need to talk about?', margin, yPosition, {
                fontSize: 11,
                fillColor: colors.darkGray
              });
              yPosition += 15;
              
              addText(project.meetingDiscussionPoints, margin, yPosition, {
                fontSize: 10,
                fillColor: colors.lightGray,
                width: contentWidth
              });
              yPosition += 25;
            }

            // Add green divider
            addDivider(colors.green);

            // Decision Items
            if (project.meetingDecisionItems) {
              addText('What decisions need to be made?', margin, yPosition, {
                fontSize: 11,
                fillColor: colors.darkGray
              });
              yPosition += 15;
              
              addText(project.meetingDecisionItems, margin, yPosition, {
                fontSize: 10,
                fillColor: colors.lightGray,
                width: contentWidth
              });
              yPosition += 25;
            }

            // Add blue divider
            addDivider(colors.lightBlue);

            // Project Tasks
            if (project.tasks && project.tasks.length > 0) {
              addText('Project Tasks:', margin, yPosition, {
                fontSize: 11,
                fillColor: colors.darkGray
              });
              yPosition += 15;

              project.tasks.forEach((task: any, taskIndex: number) => {
                ensureSpace(30);
                addText(`${taskIndex + 1}. ${task.description || task.title || 'No description'}`, margin, yPosition, {
                  fontSize: 10,
                  fillColor: colors.lightGray,
                  width: contentWidth
                });
                yPosition += 15;
              });
              yPosition += 10;
            }

            // Attached Files
            if (project.attachments && project.attachments.length > 0) {
              addText('Attached Files:', margin, yPosition, {
                fontSize: 11,
                fillColor: colors.darkGray
              });
              yPosition += 15;

              project.attachments.forEach((attachment: any, fileIndex: number) => {
                addText(`${fileIndex + 1}. ${attachment.name || attachment.filename || 'Unknown file'}`, margin, yPosition, {
                  fontSize: 10,
                  fillColor: colors.lightGray
                });
                yPosition += 12;
              });
              yPosition += 10;
            }

            // Last Discussed Date
            if (project.lastDiscussed) {
              addText(`Last Discussed: ${new Date(project.lastDiscussed).toLocaleDateString()}`, margin, yPosition, {
                fontSize: 9,
                fillColor: colors.lightGray
              });
              yPosition += 15;
            }

            yPosition += 15;
          } else {
            // Regular agenda item (not a project)
            if (item.presenter) {
              addText(`Presenter: ${item.presenter} | Time: ${item.estimatedTime || '5'} mins | Type: ${item.type || 'agenda item'}`, margin, yPosition, {
                fontSize: 10,
                fillColor: colors.lightGray
              });
              yPosition += 20;
            }
          }

          yPosition += 10;
        });
      }

      yPosition += 20;
    });

    // Add footer
    const footerY = pageHeight - 50;
    doc.fontSize(10)
       .fillColor(colors.lightGray)
       .text(
         'The Sandwich Project | Meeting Agenda | Generated ' + 
         new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
         margin, 
         footerY, 
         { align: 'center', width: contentWidth }
       );

    doc.end();
  });
}