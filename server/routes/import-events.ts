import { Router } from "express";
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { isAuthenticated } from "../temp-auth";
import { storage } from "../storage";
import { isValid, parseISO } from 'date-fns';

const router = Router();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import past events that are already completed
router.post("/import-past-events", isAuthenticated, async (req, res) => {
  try {
    console.log('Starting past events import...');
    
    // Parse events data from request body
    const { events: eventData } = req.body;
    
    if (!eventData || !Array.isArray(eventData)) {
      return res.status(400).json({ error: 'No event data provided' });
    }
    
    const events = [];
    
    for (const eventInfo of eventData) {
      // Parse the date
      let parsedDate = null;
      if (eventInfo.date) {
        try {
          parsedDate = new Date(eventInfo.date);
          if (isNaN(parsedDate.getTime())) {
            parsedDate = null;
          }
        } catch (e) {
          console.warn(`Could not parse date "${eventInfo.date}"`);
          parsedDate = null;
        }
      }
      
      // Split contact name into first and last name
      let firstName = '';
      let lastName = '';
      if (eventInfo.contactName) {
        const nameParts = eventInfo.contactName.toString().trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
      
      if (firstName && eventInfo.organizationName && eventInfo.email) {
        events.push({
          firstName: firstName,
          lastName: lastName || '',
          email: eventInfo.email,
          phone: eventInfo.phone || null,
          organizationName: eventInfo.organizationName,
          desiredEventDate: parsedDate,
          status: 'completed', // These are past events
          contactedAt: parsedDate, // Use event date as contacted date
          previouslyHosted: 'i_dont_know',
          message: 'Imported past event',
          createdBy: req.user?.id,
          eventStartTime: eventInfo.eventStartTime || null,
          eventEndTime: eventInfo.eventEndTime || null,
          pickupTime: eventInfo.pickupTime || null,
          eventAddress: eventInfo.eventAddress || null,
          estimatedSandwichCount: eventInfo.estimatedSandwichCount || null,
          toolkitSent: eventInfo.toolkitSent || false,
          toolkitStatus: eventInfo.toolkitSent ? 'sent' : 'not_sent',
          additionalRequirements: eventInfo.notes || null,
          planningNotes: eventInfo.tspContact || null,
          tspContactAssigned: eventInfo.tspContact || null
        });
      }
    }
    
    // Import the events
    const importedEvents = [];
    const skippedDuplicates = [];
    
    for (const event of events) {
      try {
        // Check if event already exists
        const existingEvents = await storage.getAllEventRequests();
        const isDuplicate = existingEvents.some(existing => 
          existing.email.toLowerCase() === event.email.toLowerCase() && 
          existing.organizationName.toLowerCase() === event.organizationName.toLowerCase()
        );
        
        if (isDuplicate) {
          console.log(`⚠️  Skipping duplicate: ${event.firstName} ${event.lastName} - ${event.organizationName}`);
          skippedDuplicates.push(event);
          continue;
        }
        
        const result = await storage.createEventRequest(event);
        importedEvents.push(result);
        console.log(`✅ Imported past event: ${event.firstName} ${event.lastName} - ${event.organizationName}`);
      } catch (error) {
        console.error(`❌ Failed to import: ${event.firstName} ${event.lastName} - ${event.organizationName}`, error);
      }
    }
    
    console.log(`✅ Successfully imported ${importedEvents.length} past events!`);
    
    res.json({
      success: true,
      message: `Successfully imported ${importedEvents.length} past events`,
      imported: importedEvents.length,
      total: events.length,
      skipped: skippedDuplicates.length
    });
    
  } catch (error) {
    console.error('❌ Error importing past events:', error);
    res.status(500).json({ 
      error: 'Failed to import past events', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Import historical 2024 events from attached Excel/CSV file
router.post("/import-historical", isAuthenticated, async (req, res) => {
  try {
    console.log('Starting historical 2024 event import...');
    
    // Read the 2024 historical data file
    const filePath = path.join(__dirname, '..', '..', 'attached_assets', '2024 Groups_1756753446666.xlsx');
    console.log('Reading historical file:', filePath);
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with proper headers
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    console.log('Historical headers:', data[0]);
    console.log(`Total historical rows: ${data.length}`);
    
    // Skip header row and process data
    const events = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows or rows without meaningful data
      if (!row || row.length === 0) continue;
      
      // Skip header row and rows that look like headers
      const possibleGroupName = row[3];
      if (!possibleGroupName || possibleGroupName.toString().toLowerCase().includes('group name')) continue;
      
      // Map 2024 data structure:
      // 0: (empty or date), 1: Time, 2: Social Post, 3: Group Name, 4: Estimate/Final # sandwiches made,
      // 5: Day of Week, 6: Sent toolkit, 7: Email Address, 8: Contact Name,
      // 9: Contact Cell Number, 10: TSP Contact, 11: TSP Volunteer speaking/picking up,
      // 12: volunteer picking up or delivering, 13: Where are sandwiches going?, 14: Notes
      const eventDateStr = row[0] || row[1]; // Date could be in column 0 or 1
      const groupName = row[3]; // Group Name
      const sandwichCount = row[4]; // Estimate/Final # sandwiches made
      const toolkitSent = row[6]; // Sent toolkit
      const email = row[7]; // Email Address
      const contactName = row[8]; // Contact Name
      const phone = row[9]; // Contact Cell Number
      const tspContact = row[10]; // TSP Contact
      const deliveryLocation = row[13]; // Where are sandwiches going?
      const notes = row[14]; // Notes
      
      // Parse MM/DD/YYYY date format
      let parsedDate = null;
      if (eventDateStr) {
        try {
          if (typeof eventDateStr === 'number') {
            // Excel numeric date
            const excelEpoch = new Date(1899, 11, 30);
            parsedDate = new Date(excelEpoch.getTime() + eventDateStr * 24 * 60 * 60 * 1000);
          } else {
            // Handle MM/DD/YYYY string format
            const dateStr = eventDateStr.toString().trim();
            const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (dateMatch) {
              const [, month, day, year] = dateMatch;
              parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
              parsedDate = new Date(dateStr);
            }
          }
          
          if (isNaN(parsedDate.getTime())) {
            parsedDate = null;
          }
        } catch (e) {
          console.warn(`Could not parse historical date "${eventDateStr}" for row ${i + 1}`);
          parsedDate = null;
        }
      }
      
      // Split contact name into first and last name
      let firstName = '';
      let lastName = '';
      if (contactName) {
        const nameParts = contactName.toString().trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
      
      // Parse toolkit sent status
      const toolkitSentStatus = toolkitSent && toolkitSent.toString().toLowerCase() === 'yes';
      
      // Parse estimated sandwich count
      let parsedSandwichCount = null;
      if (sandwichCount) {
        const countStr = sandwichCount.toString().replace(/[^\d]/g, ''); // Remove non-digits
        if (countStr && !isNaN(parseInt(countStr))) {
          parsedSandwichCount = parseInt(countStr);
        }
      }
      
      // Only add if we have required fields
      if (firstName && groupName && email) {
        events.push({
          firstName: firstName,
          lastName: lastName || '',
          email: email.toString(),
          phone: phone ? phone.toString() : null,
          organizationName: groupName.toString(),
          desiredEventDate: parsedDate,
          status: 'completed', // Historical events are completed
          contactedAt: parsedDate, // Use event date as contacted date
          previouslyHosted: 'yes', // These are past hosts
          message: 'Imported historical 2024 event',
          createdBy: req.user?.id,
          estimatedSandwichCount: parsedSandwichCount,
          toolkitSent: toolkitSentStatus,
          toolkitStatus: toolkitSentStatus ? 'sent' : 'not_sent',
          planningNotes: notes ? notes.toString() : null,
          tspContactAssigned: tspContact ? tspContact.toString() : null,
          additionalRequirements: deliveryLocation ? `Delivery location: ${deliveryLocation}` : null
        });
        
        console.log(`✅ Prepared historical event: ${firstName} ${lastName} from ${groupName}`);
      } else {
        console.log(`⚠️  Skipping historical row ${i + 1} - missing required fields:`, {
          firstName: !!firstName,
          groupName: !!groupName,
          email: !!email
        });
      }
    }
    
    console.log(`\nPrepared ${events.length} historical events for import`);
    
    if (events.length === 0) {
      return res.status(400).json({ error: 'No valid historical events found to import' });
    }
    
    // Import with duplicate checking
    const importedEvents = [];
    const skippedDuplicates = [];
    
    for (const event of events) {
      try {
        // Check if event already exists (by email and organization)
        const existingEvents = await storage.getAllEventRequests();
        const isDuplicate = existingEvents.some(existing => 
          existing.email.toLowerCase() === event.email.toLowerCase() && 
          existing.organizationName.toLowerCase() === event.organizationName.toLowerCase()
        );
        
        if (isDuplicate) {
          console.log(`⚠️  Skipping historical duplicate: ${event.firstName} ${event.lastName} - ${event.organizationName}`);
          skippedDuplicates.push(event);
          continue;
        }
        
        const result = await storage.createEventRequest(event);
        importedEvents.push(result);
        console.log(`✅ Imported historical: ${event.firstName} ${event.lastName} - ${event.organizationName}`);
      } catch (error) {
        console.error(`❌ Failed to import historical: ${event.firstName} ${event.lastName} - ${event.organizationName}`, error);
      }
    }
    
    console.log(`✅ Successfully imported ${importedEvents.length} historical events!`);
    if (skippedDuplicates.length > 0) {
      console.log(`⚠️  Skipped ${skippedDuplicates.length} historical duplicates`);
    }
    
    res.json({
      success: true,
      message: `Successfully imported ${importedEvents.length} historical events from 2024`,
      imported: importedEvents.length,
      total: events.length,
      skipped: skippedDuplicates.length,
      events: importedEvents.map(e => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        organization: e.organizationName,
        email: e.email
      }))
    });
    
  } catch (error) {
    console.error('❌ Error importing historical events:', error);
    res.status(500).json({ 
      error: 'Failed to import historical events', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post("/import-excel", isAuthenticated, async (req, res) => {
  try {
    console.log('Starting Excel event import...');
    
    // Read the Excel file
    const filePath = path.join(__dirname, '..', '..', 'attached_assets', 'Events January - May_1756610094691.xlsx');
    console.log('Reading file:', filePath);
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Get first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with proper headers
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    console.log('Headers:', data[0]);
    console.log(`Total rows: ${data.length}`);
    
    // Skip header row and process data
    const events = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows
      if (!row || row.length === 0 || !row[0]) continue;
      
      // Map the data based on the April-June Excel column structure:
      // 0: Date, 1: Event Start time Optional, 2: Event end time Optional, 3: Pick up time
      // 4: ALL DETAILS, 5: Social Post, 6: Call Made, 7: Group Name, 8: Estimate/Final # sandwiches made
      // 9: Day of Week, 10: Sent toolkit, 11: Email Address, 12: Contact Name
      // 13: Contact Cell Number, 14: TSP Contact, 15: Address, 16: Notes
      const eventDate = row[0];
      const eventStartTime = row[1]; // Event Start time Optional
      const eventEndTime = row[2]; // Event end time Optional
      const pickupTime = row[3]; // Pick up time
      const allDetails = row[4]; // ALL DETAILS
      const organization = row[7]; // Group Name
      const estimatedSandwichCount = row[8]; // Estimate/Final # sandwiches made
      const toolkitSent = row[10]; // Sent toolkit
      const email = row[11]; // Email Address
      const contactName = row[12]; // Contact Name
      const phone = row[13]; // Contact Cell Number
      const tspContact = row[14]; // TSP Contact
      const eventAddress = row[15]; // Address
      const notes = row[16]; // Notes
      
      // Split contact name into first and last name
      let firstName = '';
      let lastName = '';
      if (contactName) {
        const nameParts = contactName.toString().trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
      
      // Helper function to convert Excel time decimal to time string
      const parseExcelTime = (timeValue: any): string | null => {
        if (!timeValue) return null;
        
        if (typeof timeValue === 'number') {
          // Excel time is stored as fraction of day (0.5 = 12:00 PM)
          const totalMinutes = Math.round(timeValue * 24 * 60);
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        // If it's already a string, return as-is
        return timeValue.toString();
      };

      // Parse date
      let parsedDate = null;
      if (eventDate) {
        try {
          // Handle Excel date formats
          if (typeof eventDate === 'number') {
            // Excel numeric date
            const excelEpoch = new Date(1899, 11, 30);
            parsedDate = new Date(excelEpoch.getTime() + eventDate * 24 * 60 * 60 * 1000);
          } else {
            // String date
            parsedDate = new Date(eventDate);
          }
          
          // Validate date
          if (isNaN(parsedDate.getTime())) {
            parsedDate = null;
          }
        } catch (e) {
          console.warn(`Could not parse date "${eventDate}" for row ${i + 1}`);
          parsedDate = null;
        }
      }
      
      // Parse toolkit sent status
      const toolkitSentStatus = toolkitSent && toolkitSent.toString().toLowerCase() === 'yes';
      
      // Parse estimated sandwich count
      let parsedSandwichCount = null;
      if (estimatedSandwichCount && !isNaN(parseInt(estimatedSandwichCount.toString()))) {
        parsedSandwichCount = parseInt(estimatedSandwichCount.toString());
      }
      
      // Only add if we have required fields
      if (firstName && organization && email) {
        events.push({
          firstName: firstName,
          lastName: lastName || '',
          email: email,
          phone: phone ? phone.toString() : null,
          organizationName: organization,
          desiredEventDate: parsedDate,
          status: 'contact_completed',
          contactedAt: new Date(), // Mark as contacted since these are scheduled events
          previouslyHosted: 'i_dont_know',
          message: 'Imported from Excel file',
          createdBy: req.user?.id, // Mark who imported this
          // Map all Excel fields to database fields with proper time parsing
          eventStartTime: parseExcelTime(eventStartTime),
          eventEndTime: parseExcelTime(eventEndTime),
          pickupTime: parseExcelTime(pickupTime),
          eventAddress: eventAddress ? eventAddress.toString() : null,
          estimatedSandwichCount: parsedSandwichCount,
          toolkitSent: toolkitSentStatus,
          toolkitStatus: toolkitSentStatus ? 'sent' : 'not_sent',
          additionalRequirements: allDetails ? allDetails.toString() : null,
          planningNotes: notes ? notes.toString() : null,
          tspContactAssigned: tspContact ? tspContact.toString() : null
        });
        
        console.log(`✅ Prepared event: ${firstName} ${lastName} from ${organization}`);
      } else {
        console.log(`⚠️  Skipping row ${i + 1} - missing required fields:`, {
          firstName: !!firstName,
          organization: !!organization,
          email: !!email
        });
      }
    }
    
    console.log(`\nPrepared ${events.length} events for import`);
    
    if (events.length === 0) {
      return res.status(400).json({ error: 'No valid events found to import' });
    }
    
    // Check for existing events to prevent duplicates
    const importedEvents = [];
    const skippedDuplicates = [];
    
    for (const event of events) {
      try {
        // Check if event already exists (by email and organization)
        const existingEvents = await storage.getAllEventRequests();
        const isDuplicate = existingEvents.some(existing => 
          existing.email.toLowerCase() === event.email.toLowerCase() && 
          existing.organizationName.toLowerCase() === event.organizationName.toLowerCase()
        );
        
        if (isDuplicate) {
          console.log(`⚠️  Skipping duplicate: ${event.firstName} ${event.lastName} - ${event.organizationName}`);
          skippedDuplicates.push(event);
          continue;
        }
        
        const result = await storage.createEventRequest(event);
        importedEvents.push(result);
        console.log(`✅ Imported: ${event.firstName} ${event.lastName} - ${event.organizationName}`);
      } catch (error) {
        console.error(`❌ Failed to import: ${event.firstName} ${event.lastName} - ${event.organizationName}`, error);
      }
    }
    
    console.log(`✅ Successfully imported ${importedEvents.length} events!`);
    if (skippedDuplicates.length > 0) {
      console.log(`⚠️  Skipped ${skippedDuplicates.length} duplicates`);
    }
    
    const message = skippedDuplicates.length > 0 
      ? `Successfully imported ${importedEvents.length} events, skipped ${skippedDuplicates.length} duplicates`
      : `Successfully imported ${importedEvents.length} events out of ${events.length} parsed`;
    
    res.json({
      success: true,
      message,
      imported: importedEvents.length,
      total: events.length,
      skipped: skippedDuplicates.length,
      events: importedEvents.map(e => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        organization: e.organizationName,
        email: e.email
      }))
    });
    
  } catch (error) {
    console.error('❌ Error importing events:', error);
    res.status(500).json({ 
      error: 'Failed to import events', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;