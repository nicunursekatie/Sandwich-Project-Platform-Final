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

router.post("/import-excel", isAuthenticated, async (req, res) => {
  try {
    console.log('Starting Excel event import...');
    
    // Read the Excel file
    const filePath = path.join(__dirname, '..', '..', 'attached_assets', 'Events for Import (1)_1756516126221.xlsx');
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
      
      // Map the data based on the specific column structure:
      // 0: Date, 1: Group Name, 12: Email Address, 13: Contact Name, 14: Contact Cell Number
      const eventDate = row[0];
      const organization = row[1]; // Group Name
      const email = row[12]; // Email Address
      const contactName = row[13]; // Contact Name
      const phone = row[14]; // Contact Cell Number
      
      // Split contact name into first and last name
      let firstName = '';
      let lastName = '';
      if (contactName) {
        const nameParts = contactName.toString().trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
      
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
      
      // Only add if we have required fields
      if (firstName && organization && email) {
        events.push({
          firstName: firstName,
          lastName: lastName || '',
          email: email,
          phone: phone ? phone.toString() : null,
          organizationName: organization,
          desiredEventDate: parsedDate,
          status: 'new',
          previouslyHosted: 'i_dont_know',
          message: 'Imported from Excel file',
          createdBy: req.user?.id // Mark who imported this
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
    
    // Import into database using the storage interface
    const importedEvents = [];
    for (const event of events) {
      try {
        const result = await storage.createEventRequest(event);
        importedEvents.push(result);
        console.log(`✅ Imported: ${event.firstName} ${event.lastName} - ${event.organizationName}`);
      } catch (error) {
        console.error(`❌ Failed to import: ${event.firstName} ${event.lastName} - ${event.organizationName}`, error);
      }
    }
    
    console.log(`✅ Successfully imported ${importedEvents.length} events!`);
    
    res.json({
      success: true,
      message: `Successfully imported ${importedEvents.length} events out of ${events.length} parsed`,
      imported: importedEvents.length,
      total: events.length,
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