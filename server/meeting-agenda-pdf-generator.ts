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
      purple: '#9C27B0',
      teal: '#009688',
      amber: '#FFC107',
      indigo: '#3F51B5',
      pink: '#E91E63',
      darkGray: '#333333',
      lightGray: '#666666',
      white: '#FFFFFF',
      sectionBlue: '#E3F2FD',
      dividerGray: '#CCCCCC',
      lightGreen: '#E8F5E8',
      lightOrange: '#FFF3E0',
      lightPurple: '#F3E5F5',
      lightTeal: '#E0F2F1'
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
      if (yPosition + requiredSpace > pageHeight - 150) {
        doc.addPage();
        yPosition = 80; // Start with more margin from top
      }
    };

    // Helper function to add section context on new pages
    const addSectionContext = (sectionTitle: string, sectionIndex: number) => {
      // Add a subtle background bar for context
      doc.rect(0, yPosition - 5, pageWidth, 25)
         .fill(colors.lightBlue);
      
      addText(`Continued from ${sectionIndex + 1}. ${sectionTitle}`, margin, yPosition, {
        fontSize: 10,
        fillColor: colors.navy,
        width: contentWidth
      });
      
      yPosition += 30;
    };

    // Helper function to add colored header bar
    const addHeaderBar = (color: string, height: number) => {
      doc.rect(0, yPosition, pageWidth, height)
         .fill(color);
      yPosition += height;
    };

    // Helper function to add text with proper positioning and wrapping
    const addText = (text: string, x: number, y: number, options: any = {}) => {
      const sanitizedText = sanitizeText(text);
      
      // Apply font size and color before adding text
      if (options.fontSize) {
        doc.fontSize(options.fontSize);
      }
      if (options.fillColor) {
        doc.fillColor(options.fillColor);
      }
      
      // Ensure text wraps properly within content width
      const textOptions = {
        ...options,
        width: options.width || contentWidth,
        align: options.align || 'left'
      };
      
      doc.text(sanitizedText, x, y, textOptions);
    };

    // Helper function to add divider line
    const addDivider = (color: string, thickness: number = 1) => {
      yPosition += 5; // Add space before divider
      doc.rect(margin, yPosition, contentWidth, thickness)
         .fill(color);
      yPosition += thickness + 8; // Add space after divider
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
      ensureSpace(80);

      // Add space before section
      yPosition += 10;

      // Section header with colored background
      const sectionColors = [colors.sectionBlue, colors.lightGreen, colors.lightOrange, colors.lightPurple, colors.lightTeal];
      const sectionColor = sectionColors[sectionIndex % sectionColors.length];
      
      addHeaderBar(sectionColor, 30);
      
      addText(`${sectionIndex + 1}. ${section.title}`, margin, yPosition - 20, {
        fontSize: 14,
        fillColor: colors.navy,
        width: contentWidth
      });

      yPosition += 15;

      // Section items
      if (section.items && section.items.length > 0) {
        section.items.forEach((item, itemIndex) => {
          const currentY = yPosition;
          ensureSpace(120);

          // Add section context if we're on a new page
          if (yPosition !== currentY) {
            addSectionContext(section.title, sectionIndex);
          }

          // Add space before item
          yPosition += 8;

          // Item title with colored background
          const itemColors = [colors.lightGreen, colors.lightOrange, colors.lightPurple, colors.lightTeal, colors.lightBlue];
          const itemColor = itemColors[itemIndex % itemColors.length];
          
          // Add subtle background for item
          doc.rect(margin - 5, yPosition - 2, contentWidth + 10, 20)
             .fill(itemColor);
          
          addText(`${sectionIndex + 1}.${itemIndex + 1} ${item.title}`, margin, yPosition, {
            fontSize: 12,
            fillColor: colors.darkGray,
            width: contentWidth
          });
          yPosition += 18;

          // Add colored divider line
          const dividerColors = [colors.orange, colors.green, colors.purple, colors.teal, colors.amber];
          const dividerColor = dividerColors[itemIndex % dividerColors.length];
          addDivider(dividerColor);

          // If this is a project item, show detailed project information
          if (item.project) {
            const project = item.project;
            
            // Project metadata with colored labels
            if (project.assigneeName) {
              addText(`Owner: `, margin, yPosition, {
                fontSize: 10,
                fillColor: colors.navy,
                width: 60
              });
              addText(project.assigneeName, margin + 60, yPosition, {
                fontSize: 10,
                fillColor: colors.teal,
                width: contentWidth - 60
              });
              yPosition += 12;
            }
            
            if (project.status) {
              addText(`Status: `, margin, yPosition, {
                fontSize: 10,
                fillColor: colors.navy,
                width: 60
              });
              const statusColor = project.status === 'in_progress' ? colors.amber : 
                                project.status === 'completed' ? colors.green : colors.lightGray;
              addText(project.status, margin + 60, yPosition, {
                fontSize: 10,
                fillColor: statusColor,
                width: contentWidth - 60
              });
              yPosition += 12;
            }
            
            if (project.supportPeople) {
              addText(`Support: `, margin, yPosition, {
                fontSize: 10,
                fillColor: colors.navy,
                width: 60
              });
              addText(project.supportPeople, margin + 60, yPosition, {
                fontSize: 10,
                fillColor: colors.purple,
                width: contentWidth - 60
              });
              yPosition += 12;
            }
            
            if (project.priority) {
              addText(`Priority: `, margin, yPosition, {
                fontSize: 10,
                fillColor: colors.navy,
                width: 60
              });
              const priorityColor = project.priority === 'high' ? colors.red : 
                                  project.priority === 'medium' ? colors.orange : colors.green;
              addText(project.priority, margin + 60, yPosition, {
                fontSize: 10,
                fillColor: priorityColor,
                width: contentWidth - 60
              });
              yPosition += 12;
            }
            
            yPosition += 5;

            // Add orange divider
            addDivider(colors.orange);

            // Discussion Points
            if (project.meetingDiscussionPoints) {
              // Add colored background for section
              doc.rect(margin - 5, yPosition - 2, contentWidth + 10, 15)
                 .fill(colors.lightOrange);
              
              addText('What do we need to talk about?', margin, yPosition, {
                fontSize: 11,
                fillColor: colors.orange,
                width: contentWidth
              });
              yPosition += 12;
              
              addText(project.meetingDiscussionPoints, margin + 10, yPosition, {
                fontSize: 10,
                fillColor: colors.darkGray,
                width: contentWidth - 20
              });
              yPosition += 18;
            }

            // Add green divider
            addDivider(colors.green);

            // Decision Items
            if (project.meetingDecisionItems) {
              // Add colored background for section
              doc.rect(margin - 5, yPosition - 2, contentWidth + 10, 15)
                 .fill(colors.lightGreen);
              
              addText('What decisions need to be made?', margin, yPosition, {
                fontSize: 11,
                fillColor: colors.green,
                width: contentWidth
              });
              yPosition += 12;
              
              addText(project.meetingDecisionItems, margin + 10, yPosition, {
                fontSize: 10,
                fillColor: colors.darkGray,
                width: contentWidth - 20
              });
              yPosition += 18;
            }

            // Add blue divider
            addDivider(colors.lightBlue);

            // Project Tasks
            if (project.tasks && project.tasks.length > 0) {
              // Add colored background for section
              doc.rect(margin - 5, yPosition - 2, contentWidth + 10, 15)
                 .fill(colors.lightTeal);
              
              addText('Project Tasks:', margin, yPosition, {
                fontSize: 11,
                fillColor: colors.teal,
                width: contentWidth
              });
              yPosition += 12;

              project.tasks.forEach((task: any, taskIndex: number) => {
                ensureSpace(30);
                const taskText = `${taskIndex + 1}. ${task.description || task.title || 'No description'}`;
                addText(taskText, margin + 10, yPosition, {
                  fontSize: 10,
                  fillColor: colors.darkGray,
                  width: contentWidth - 30 // Leave some margin for indentation
                });
                yPosition += 15; // Space between tasks
              });
              yPosition += 8;
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

            yPosition += 12;
          } else {
            // Regular agenda item (not a project)
            if (item.presenter) {
              addText(`Presenter: ${item.presenter} | Time: ${item.estimatedTime || '5'} mins | Type: ${item.type || 'agenda item'}`, margin, yPosition, {
                fontSize: 10,
                fillColor: colors.lightGray,
                width: contentWidth
              });
              yPosition += 15;
            }
          }

          yPosition += 12; // Space between items
        });
      }

      yPosition += 15; // Space between sections
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