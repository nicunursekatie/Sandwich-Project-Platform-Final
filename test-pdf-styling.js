// Test the PDF styling directly
import { generateMeetingAgendaPDF } from './server/meeting-agenda-pdf-generator.ts';
import fs from 'fs';

const testAgenda = {
  title: "Test Meeting Agenda",
  date: "2024-09-16",
  startTime: "13:30",
  location: "Test Location",
  description: "Weekly agenda planning",
  sections: [
    {
      title: "Needs Discussion",
      items: [
        {
          id: "1",
          title: "Updating TSP website",
          project: {
            id: 1,
            title: "Updating TSP website",
            status: "in_progress",
            priority: "high",
            description: "Website update project",
            assigneeName: "Marcy Louza",
            supportPeople: "Catchafire, James Satterfield, Katie Long",
            meetingDiscussionPoints: "Still working to fix",
            meetingDecisionItems: "Get Donate button more visible on mobile, incorporate UGA",
            tasks: [
              { description: "Working on identifying a candidate on Catchafire to do an overhaul" }
            ],
            attachments: [],
            lastDiscussed: "2024-09-10"
          }
        }
      ]
    }
  ]
};

try {
  console.log('Testing PDF styling...');
  const pdfBuffer = await generateMeetingAgendaPDF(testAgenda);
  console.log('PDF generated, size:', pdfBuffer.length, 'bytes');
  
  fs.writeFileSync('styled-test.pdf', pdfBuffer);
  console.log('Styled PDF saved as styled-test.pdf');
} catch (error) {
  console.error('Error:', error);
}
