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

interface ProjectTask {
  id: number;
  title: string;
  description?: string;
  status: string;
  assigneeName?: string;
  dueDate?: string;
  priority: string;
}

interface Project {
  id: number;
  title: string;
  status: string;
  priority?: string;
  description?: string;
  reviewInNextMeeting: boolean;
  meetingDiscussionPoints?: string;
  meetingDecisionItems?: string;
  supportPeople?: string;
  assigneeName?: string;
  tasks?: ProjectTask[];
  attachments?: string[];
}

interface AgendaItem {
  id: number;
  title: string;
  description?: string;
  submittedBy: string;
  type: string;
  estimatedTime?: string;
  project?: Project;
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
  static async generatePDF(
    meeting: Meeting,
    agenda?: CompiledAgenda
  ): Promise<Buffer> {
    const PDFKit = (await import('pdfkit')).default;
    const doc = new PDFKit({ 
      margin: 50,
      size: 'A4',
      layout: 'portrait'
    });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (error) => reject(error));


        // TSP Brand Colors
        const colors = {
          orange: '#FBAD3F',
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
          // Replace smart quotes
          .replace(/[""]/g, '"')
          .replace(/['']/g, "'")
          // Replace dashes
          .replace(/[–—]/g, '-')
          // Replace bullet point
          .replace(/•/g, '-')
          // Replace ellipsis
          .replace(/…/g, '...')
          // Replace non-breaking space
          .replace(/\u00A0/g, ' ')
          // Replace degree symbol
          .replace(/°/g, ' deg')
          // Replace trademark/registered/copyright
          .replace(/™/g, '(TM)')
          .replace(/®/g, '(R)')
          .replace(/©/g, '(C)')
          // Strip any remaining non-ASCII characters (including emojis)
          .replace(/[^\x00-\x7F]/g, '');
      };

        // Helper function to add footer to current page
        const addFooter = () => {
          doc
            .fontSize(8)
            .fillColor(colors.lightGray)
            .text(
              `The Sandwich Project • Meeting Agenda • Generated ${format(new Date(), 'MMM dd, yyyy')}`,
              50,
              doc.page.height - 30,
              { align: 'center', width: doc.page.width - 100 }
            );
        };

      // Helper function to wrap text
      const wrapText = (text: string, maxWidth: number, fontSize: number = 10) => {
        const sanitizedText = sanitizeText(text);
        const words = sanitizedText.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const testWidth = doc.widthOfString(testLine);
          
          if (testWidth <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              lines.push(word);
            }
          }
        }
        
        if (currentLine) {
          lines.push(currentLine);
        }
        
        return lines;
      };

      // Helper function to get status color
      const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
          case 'completed': return colors.success;
          case 'in progress': return colors.warning;
          case 'pending': return colors.lightGray;
          case 'blocked': return colors.danger;
          default: return colors.lightGray;
        }
      };

      // Helper function to get priority color
      const getPriorityColor = (priority: string) => {
        switch (priority?.toLowerCase()) {
          case 'high': return colors.danger;
          case 'medium': return colors.warning;
          case 'low': return colors.success;
          default: return colors.lightGray;
        }
      };

      // Helper function to add footer to current page
      const addFooter = () => {
        const currentPage = doc.page;
        
        // Footer background
        addColoredBox(0, currentPage.height - 40, currentPage.width, 40, colors.veryLightGray);
        
        doc
          .fontSize(8)
          .fillColor(colors.lightGray)
          .text(
            sanitizeText(`The Sandwich Project | Meeting Agenda | Generated ${format(new Date(), 'MMM dd, yyyy')}`),
            50,
            currentPage.height - 25,
            { align: 'center', width: currentPage.width - 100 }
          );
      };

      // HEADER WITH TSP BRANDING
      addColoredBox(0, 0, doc.page.width, 120, colors.navy);
      
      doc
        .fontSize(28)
        .fillColor(colors.white)
        .text(sanitizeText('The Sandwich Project'), 50, 30, { align: 'left' });
      
      doc
        .fontSize(20)
        .fillColor(colors.orange)
        .text(sanitizeText('Meeting Agenda'), 50, 65, { align: 'left' });

      // Meeting details in header
      const meetingDate = format(new Date(meeting.date), 'EEEE, MMMM dd, yyyy');
      const meetingTime = meeting.time && meeting.time !== 'TBD' ? meeting.time : 'TBD';

      doc
        .fontSize(14)
        .fillColor(colors.white)
        .text(sanitizeText(meeting.title), 50, 90)
        .text(sanitizeText(`${meetingDate} at ${meetingTime}`), 50, 110);

      if (meeting.location) {
        doc.text(sanitizeText(`Location: ${meeting.location}`), 50, 130);
      }

      yPosition = 160;

      // Meeting description if available
      if (meeting.description) {
        doc
          .fontSize(12)
          .fillColor(colors.darkGray)
          .text(sanitizeText('Meeting Description:'), 50, yPosition);
        yPosition += 25;
        
        const descriptionLines = wrapText(meeting.description, 500, 12);
        descriptionLines.forEach(line => {
          doc.text(sanitizeText(`  ${line}`), 50, yPosition);
          yPosition += 15;
        });
        yPosition += 20;
      }

        // Meeting details
        const meetingDate = format(new Date(meeting.date), 'EEEE, MMMM dd, yyyy');
        const meetingTime = meeting.time && meeting.time !== 'TBD' ? meeting.time : 'TBD';

        doc
          .fontSize(14)
          .fillColor(colors.darkGray)
          .text(`${meeting.title}`, 50, yPosition + 60)
          .text(`${meetingDate} at ${meetingTime}`, 50, yPosition + 80);

        if (meeting.location) {
          doc.text(`Location: ${meeting.location}`, 50, yPosition + 100);
          yPosition += 20;
        }

        yPosition += 140;

        // Meeting description if available
        if (meeting.description) {
          doc
            .fontSize(12)
            .fillColor(colors.darkGray)
            .text(sanitizeText(`Estimated Duration: ${agenda.totalEstimatedTime}`), 60, yPosition);
          yPosition += 40;
        }

        // Process each section
        agenda.sections.forEach((section, sectionIndex) => {
          // Check if we need a new page (leave more room at bottom)
          if (yPosition > 750) {
            addFooter(); // Add footer to current page before creating new one
            doc.addPage();
            yPosition = 50;
          }

          // Section header with colored background
          addColoredBox(40, yPosition - 5, doc.page.width - 80, 35, colors.lightBlue);
          doc
            .fontSize(16)
            .fillColor(colors.white)
            .text(sanitizeText(`${sectionIndex + 1}. ${section.title}`), 50, yPosition);
          yPosition += 45;

          // Section items
          if (section.items && section.items.length > 0) {
            section.items.forEach((item, itemIndex) => {
              // Estimate space needed for this item (minimum ~100 points)
              const estimatedItemHeight = item.project ? 150 : 80;
              
              // Check if we need a new page - only break if we don't have enough space
              if (yPosition + estimatedItemHeight > 750) {
                addFooter(); // Add footer to current page before creating new one
                doc.addPage();
                yPosition = 50;
              }

              // Project card background
              addColoredBox(50, yPosition - 5, doc.page.width - 100, 1, colors.lightGray);
              yPosition += 10;

              // Item title with project icon
              doc
                .fontSize(14)
                .fillColor(colors.navy)
                .text(sanitizeText(`${sectionIndex + 1}.${itemIndex + 1} ${item.title}`), 60, yPosition);
              yPosition += 25;

              // If this is a project item, show detailed project information
              if (item.project) {
                const project = item.project;
                
                // Project metadata in a grid
                const leftColumn = 70;
                const rightColumn = 300;
                let metadataY = yPosition;

                // Owner
                if (project.assigneeName) {
                  doc
                    .fontSize(10)
                    .fillColor(colors.darkGray)
                    .text(sanitizeText('Owner:'), leftColumn, metadataY);
                  doc
                    .fontSize(10)
                    .fillColor(colors.navy)
                    .text(sanitizeText(project.assigneeName), leftColumn + 60, metadataY);
                }

                // Support People
                if (project.supportPeople) {
                  doc
                    .fontSize(10)
                    .fillColor(colors.darkGray)
                    .text(sanitizeText('Support:'), rightColumn, metadataY);
                  const supportLines = wrapText(project.supportPeople, 200, 10);
                  supportLines.forEach((line, idx) => {
                    doc
                      .fontSize(10)
                      .fillColor(colors.navy)
                      .text(sanitizeText(line), rightColumn + 60, metadataY + (idx * 12));
                  });
                  metadataY += Math.max(supportLines.length * 12, 15);
                } else {
                  metadataY += 15;
                }

                // Status and Priority
                if (project.status) {
                  doc
                    .fontSize(10)
                    .fillColor(colors.darkGray)
                    .text('Status:', leftColumn, metadataY);
                  doc
                    .fontSize(10)
                    .fillColor(getStatusColor(project.status))
                    .text(project.status, leftColumn + 60, metadataY);
                }

                if (project.priority) {
                  doc
                    .fontSize(10)
                    .fillColor(colors.darkGray)
                    .text('Priority:', rightColumn, metadataY);
                  doc
                    .fontSize(10)
                    .fillColor(getPriorityColor(project.priority))
                    .text(sanitizeText(project.priority), rightColumn + 60, metadataY);
                }

                yPosition = metadataY + 25;

                // Project Description
                if (project.description) {
                  doc
                    .fontSize(11)
                    .fillColor(colors.darkGray)
                    .text('Description:', 70, yPosition);
                  yPosition += 20;
                  
                  const descLines = wrapText(project.description, 450, 11);
                  descLines.forEach(line => {
                    doc
                      .fontSize(10)
                      .fillColor(colors.lightGray)
                      .text(sanitizeText(`  ${line}`), 80, yPosition);
                    yPosition += 12;
                  });
                  yPosition += 10;
                }

                // Discussion Points
                if (project.meetingDiscussionPoints) {
                  addColoredBox(70, yPosition - 5, doc.page.width - 140, 1, colors.orange);
                  doc
                    .fontSize(11)
                    .fillColor(colors.darkGray)
                    .text('What do we need to talk about?', 80, yPosition);
                  yPosition += 20;
                  
                  const discussionLines = wrapText(project.meetingDiscussionPoints, 430, 11);
                  discussionLines.forEach(line => {
                    doc
                      .fontSize(10)
                      .fillColor(colors.darkGray)
                      .text(sanitizeText(`  ${line}`), 90, yPosition);
                    yPosition += 12;
                  });
                  yPosition += 15;
                }

                // Decision Items
                if (project.meetingDecisionItems) {
                  addColoredBox(70, yPosition - 5, doc.page.width - 140, 1, colors.success);
                  doc
                    .fontSize(11)
                    .fillColor(colors.darkGray)
                    .text('What decisions need to be made?', 80, yPosition);
                  yPosition += 20;
                  
                  const decisionLines = wrapText(project.meetingDecisionItems, 430, 11);
                  decisionLines.forEach(line => {
                    doc
                      .fontSize(10)
                      .fillColor(colors.darkGray)
                      .text(sanitizeText(`  ${line}`), 90, yPosition);
                    yPosition += 12;
                  });
                  yPosition += 15;
                }

                // Project Tasks
                if (project.tasks && project.tasks.length > 0) {
                  addColoredBox(70, yPosition - 5, doc.page.width - 140, 1, colors.lightBlue);
                  doc
                    .fontSize(11)
                    .fillColor(colors.darkGray)
                    .text(sanitizeText('Project Tasks:'), 80, yPosition);
                  yPosition += 20;
                  
                  project.tasks.forEach((task, taskIndex) => {
                    doc
                      .fontSize(10)
                      .fillColor(colors.navy)
                      .text(sanitizeText(`  ${taskIndex + 1}. ${task.title}`), 90, yPosition);
                    yPosition += 15;
                    
                    if (task.description) {
                      const taskDescLines = wrapText(task.description, 400, 10);
                      taskDescLines.forEach(line => {
                        doc
                          .fontSize(9)
                          .fillColor(colors.lightGray)
                          .text(sanitizeText(`     ${line}`), 100, yPosition);
                        yPosition += 11;
                      });
                    }
                    
                    // Task metadata
                    const taskMeta = [];
                    if (task.assigneeName) taskMeta.push(`Assignee: ${task.assigneeName}`);
                    if (task.dueDate) taskMeta.push(`Due: ${task.dueDate}`);
                    if (task.priority) taskMeta.push(`Priority: ${task.priority}`);
                    
                    if (taskMeta.length > 0) {
                      doc
                        .fontSize(9)
                        .fillColor(colors.lightGray)
                        .text(sanitizeText(`     ${taskMeta.join(' | ')}`), 100, yPosition);
                      yPosition += 12;
                    }
                    
                    yPosition += 8;
                  });
                  yPosition += 10;
                }

                // Project Attachments
                if (project.attachments && project.attachments.length > 0) {
                  doc
                    .fontSize(11)
                    .fillColor(colors.darkGray)
                    .text(sanitizeText('Attachments:'), 80, yPosition);
                  yPosition += 20;
                  
                  project.attachments.forEach(attachment => {
                    doc
                      .fontSize(10)
                      .fillColor(colors.lightBlue)
                      .text(sanitizeText(`  - ${attachment}`), 90, yPosition);
                    yPosition += 15;
                  });
                  yPosition += 10;
                }

              } else {
                // Regular agenda item (not a project)
                if (item.description) {
                  const descLines = wrapText(item.description, 450, 10);
                  descLines.forEach(line => {
                    doc
                      .fontSize(10)
                      .fillColor(colors.lightGray)
                      .text(sanitizeText(`  ${line}`), 80, yPosition);
                    yPosition += 12;
                  });
                  yPosition += 10;
                }

                // Item metadata
                const metadata = [];
                if (item.submittedBy) metadata.push(`Presenter: ${item.submittedBy}`);
                if (item.estimatedTime) metadata.push(`Time: ${item.estimatedTime}`);
                if (item.type) metadata.push(`Type: ${item.type.replace('_', ' ')}`);

                if (metadata.length > 0) {
                  doc
                    .fontSize(9)
                    .fillColor(colors.lightGray)
                    .text(sanitizeText(`  ${metadata.join(' | ')}`), 80, yPosition);
                  yPosition += 15;
                }
              }

              yPosition += 20; // Extra spacing between items
            });
          } else {
            // Empty section
            doc
              .fontSize(10)
              .fillColor(colors.lightGray)
              .text(sanitizeText('  Items to be determined'), 70, yPosition);
            yPosition += 30;
          }
        });
      } else {
        // No compiled agenda - show standard sections
        doc
          .fontSize(16)
          .fillColor(colors.navy)
          .text(sanitizeText('AGENDA'), 50, yPosition);
        yPosition += 35;

        const standardSections = [
          'Old Business',
          'Urgent Items', 
          'Housekeeping',
          'New Business',
        ];

        standardSections.forEach((section, index) => {
          doc
            .fontSize(14)
            .fillColor(colors.navy)
            .text(sanitizeText(`${index + 1}. ${section}`), 50, yPosition);
          yPosition += 25;

          doc
            .fontSize(10)
            .fillColor(colors.lightGray)
            .text(sanitizeText('  Items to be determined'), 70, yPosition);
          yPosition += 30;

      // Add footer to the final page
      addFooter();
            // Section header
            doc
              .fontSize(14)
              .fillColor(colors.navy)
              .text(`${sectionIndex + 1}. ${section.title}`, 50, yPosition);
            yPosition += 35;

            // Section items
            if (section.items && section.items.length > 0) {
              section.items.forEach((item, itemIndex) => {
                // Check if we need a new page
                if (yPosition > 720) {
                  addFooter();
                  doc.addPage();
                  yPosition = 50;
                }

                // Item title
                doc
                  .fontSize(12)
                  .fillColor(colors.darkGray)
                  .text(`${sectionIndex + 1}.${itemIndex + 1} ${item.title}`, 70, yPosition);
                yPosition += 22;

                // If this is a project item, show detailed project information
                if (item.project) {
                  const project = item.project;
                  
                  // Project metadata
                  const metadata = [];
                  if (project.assigneeName) metadata.push(`Owner: ${project.assigneeName}`);
                  if (project.supportPeople) metadata.push(`Support: ${project.supportPeople}`);
                  if (project.status) metadata.push(`Status: ${project.status}`);
                  if (project.priority) metadata.push(`Priority: ${project.priority}`);

                  if (metadata.length > 0) {
                    doc
                      .fontSize(10)
                      .fillColor(colors.lightGray)
                      .text(`  ${metadata.join(' • ')}`, 90, yPosition);
                    yPosition += 18;
                  }

                  // Project Description
                  if (project.description) {
                    doc
                      .fontSize(11)
                      .fillColor(colors.darkGray)
                      .text('Description:', 90, yPosition);
                    yPosition += 20;
                    
                    doc
                      .fontSize(10)
                      .fillColor(colors.lightGray)
                      .text(project.description, 100, yPosition, { width: 450 });
                    yPosition += 30;
                  }

                  // Discussion Points
                  if (project.meetingDiscussionPoints) {
                    doc
                      .fontSize(11)
                      .fillColor(colors.darkGray)
                      .text('What do we need to talk about?', 90, yPosition);
                    yPosition += 20;
                    
                    doc
                      .fontSize(10)
                      .fillColor(colors.darkGray)
                      .text(project.meetingDiscussionPoints, 100, yPosition, { width: 430 });
                    yPosition += 30;
                  }

                  // Decision Items
                  if (project.meetingDecisionItems) {
                    doc
                      .fontSize(11)
                      .fillColor(colors.darkGray)
                      .text('What decisions need to be made?', 90, yPosition);
                    yPosition += 20;
                    
                    doc
                      .fontSize(10)
                      .fillColor(colors.darkGray)
                      .text(project.meetingDecisionItems, 100, yPosition, { width: 430 });
                    yPosition += 30;
                  }

                  // Project Tasks
                  if (project.tasks && project.tasks.length > 0) {
                    doc
                      .fontSize(11)
                      .fillColor(colors.darkGray)
                      .text('Project Tasks:', 90, yPosition);
                    yPosition += 20;
                    
                    project.tasks.forEach((task, taskIndex) => {
                      doc
                        .fontSize(10)
                        .fillColor(colors.navy)
                        .text(`  ${taskIndex + 1}. ${task.title}`, 100, yPosition);
                      yPosition += 15;
                      
                      if (task.description) {
                        doc
                          .fontSize(9)
                          .fillColor(colors.lightGray)
                          .text(`     ${task.description}`, 110, yPosition, { width: 400 });
                        yPosition += 20;
                      }
                      
                      // Task metadata
                      const taskMeta = [];
                      if (task.assigneeName) taskMeta.push(`Assignee: ${task.assigneeName}`);
                      if (task.dueDate) taskMeta.push(`Due: ${task.dueDate}`);
                      if (task.priority) taskMeta.push(`Priority: ${task.priority}`);
                      
                      if (taskMeta.length > 0) {
                        doc
                          .fontSize(9)
                          .fillColor(colors.lightGray)
                          .text(`     ${taskMeta.join(' • ')}`, 110, yPosition);
                        yPosition += 15;
                      }
                      
                      yPosition += 10;
                    });
                    yPosition += 10;
                  }

                  // Project Attachments
                  if (project.attachments && project.attachments.length > 0) {
                    doc
                      .fontSize(11)
                      .fillColor(colors.darkGray)
                      .text('Attachments:', 90, yPosition);
                    yPosition += 20;
                    
                    project.attachments.forEach(attachment => {
                      doc
                        .fontSize(10)
                        .fillColor(colors.lightBlue)
                        .text(`  • ${attachment}`, 100, yPosition);
                      yPosition += 15;
                    });
                    yPosition += 10;
                  } else {
                    doc
                      .fontSize(10)
                      .fillColor(colors.lightGray)
                      .text('  No attachments', 90, yPosition);
                    yPosition += 20;
                  }

                } else {
                  // Regular agenda item (not a project)
                  if (item.description) {
                    doc
                      .fontSize(10)
                      .fillColor(colors.lightGray)
                      .text(item.description, 90, yPosition, { width: 450 });
                    yPosition += 20;
                  }

                  // Item metadata
                  const metadata = [];
                  if (item.submittedBy) metadata.push(`Presenter: ${item.submittedBy}`);
                  if (item.estimatedTime) metadata.push(`Time: ${item.estimatedTime}`);
                  if (item.type) metadata.push(`Type: ${item.type.replace('_', ' ')}`);

                  if (metadata.length > 0) {
                    doc
                      .fontSize(9)
                      .fillColor(colors.lightGray)
                      .text(`  ${metadata.join(' • ')}`, 90, yPosition);
                    yPosition += 18;
                  }
                }

                yPosition += 20; // Extra spacing between items
              });
            } else {
              doc
                .fontSize(10)
                .fillColor(colors.lightGray)
                .text('  No items scheduled for this section', 70, yPosition);
              yPosition += 25;
            }

            yPosition += 25; // Extra spacing between sections
          });
        } else {
          // No compiled agenda available
          doc.fontSize(16).fillColor(colors.navy).text('AGENDA', 50, yPosition);
          yPosition += 30;

          // Show the standard sections structure
          const standardSections = [
            'Old Business',
            'Urgent Items',
            'Housekeeping',
            'New Business',
          ];

          standardSections.forEach((section, index) => {
            doc
              .fontSize(14)
              .fillColor(colors.navy)
              .text(`${index + 1}. ${section}`, 50, yPosition);
            yPosition += 25;

            doc
              .fontSize(10)
              .fillColor(colors.lightGray)
              .text('  Items to be determined', 70, yPosition);
            yPosition += 30;
          });
        }

        // Add footer to final page
        addFooter();

        doc.end();
      });
    } catch (error) {
      console.error('PDF Generation Error:', error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }
}