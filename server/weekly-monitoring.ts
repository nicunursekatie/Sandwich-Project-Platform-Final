import { MailService } from '@sendgrid/mail';
import { db } from './db';
import { sandwichCollections, hosts } from '@shared/schema';
import { eq, sql, and, gte, lte } from 'drizzle-orm';

if (!process.env.SENDGRID_API_KEY) {
  console.error("SENDGRID_API_KEY environment variable must be set for email notifications");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

// Expected host locations that should submit weekly
const EXPECTED_HOST_LOCATIONS = [
  'East Cobb/Roswell',
  'Dunwoody/PTC', 
  'Alpharetta',
  'Sandy Springs',
  'Intown/Druid Hills',
  'Dacula',
  'Flowery Branch',
  'Collective Learning'
];

// Admin email to receive notifications
const ADMIN_EMAIL = 'katielong2316@gmail.com';
const FROM_EMAIL = 'notifications@sandwich-project.org'; // Update with your verified sender

interface WeeklySubmissionStatus {
  location: string;
  hasSubmitted: boolean;
  lastSubmissionDate?: string;
  missingSince?: string;
}

/**
 * Get the current week's date range (Wednesday to Tuesday)
 * Entries posted before Wednesday cannot count collections that happened Wednesday or after for that week's submission
 */
export function getCurrentWeekRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 3 = Wednesday
  
  // Calculate Wednesday of current week cycle
  let daysToWednesday;
  if (dayOfWeek >= 3) { // If today is Wednesday or later
    daysToWednesday = dayOfWeek - 3; // Days since this Wednesday
  } else { // If today is Sunday, Monday, or Tuesday
    daysToWednesday = dayOfWeek + 4; // Days since last Wednesday (previous week)
  }
  
  const wednesday = new Date(now);
  wednesday.setDate(now.getDate() - daysToWednesday);
  wednesday.setHours(0, 0, 0, 0);
  
  // Calculate Tuesday of current week cycle (6 days after Wednesday)
  const tuesday = new Date(wednesday);
  tuesday.setDate(wednesday.getDate() + 6);
  tuesday.setHours(23, 59, 59, 999);
  
  return { startDate: wednesday, endDate: tuesday };
}

/**
 * Check which host locations have submitted for the current week
 */
export async function checkWeeklySubmissions(): Promise<WeeklySubmissionStatus[]> {
  const { startDate, endDate } = getCurrentWeekRange();
  
  console.log(`Checking submissions for week: ${startDate.toDateString()} to ${endDate.toDateString()}`);
  
  try {
    // Get all submissions for this week
    const weeklySubmissions = await db
      .select({
        hostName: sandwichCollections.hostName,
        collectionDate: sandwichCollections.collectionDate,
      })
      .from(sandwichCollections)
      .where(
        and(
          gte(sandwichCollections.collectionDate, startDate.toISOString().split('T')[0]),
          lte(sandwichCollections.collectionDate, endDate.toISOString().split('T')[0])
        )
      );

    // Get the set of locations that have submitted this week
    const submittedLocations = new Set(
      weeklySubmissions.map(sub => sub.hostName?.toLowerCase().trim())
    );

    // Check each expected location
    const statusResults: WeeklySubmissionStatus[] = [];
    
    for (const expectedLocation of EXPECTED_HOST_LOCATIONS) {
      const normalizedExpected = expectedLocation.toLowerCase().trim();
      
      // Check if any submission matches this location (fuzzy matching)
      const hasSubmitted = Array.from(submittedLocations).some(submitted => 
        submitted && (
          submitted.includes(normalizedExpected) ||
          normalizedExpected.includes(submitted) ||
          // Handle variations like "East Cobb" vs "East Cobb/Roswell"
          submitted.replace(/[\/\-\s]/g, '').includes(normalizedExpected.replace(/[\/\-\s]/g, '')) ||
          normalizedExpected.replace(/[\/\-\s]/g, '').includes(submitted.replace(/[\/\-\s]/g, ''))
        )
      );

      statusResults.push({
        location: expectedLocation,
        hasSubmitted,
        lastSubmissionDate: hasSubmitted ? 
          weeklySubmissions.find(sub => 
            sub.hostName?.toLowerCase().includes(normalizedExpected.split('/')[0].toLowerCase())
          )?.collectionDate : undefined
      });
    }

    return statusResults;
  } catch (error) {
    console.error('Error checking weekly submissions:', error);
    throw error;
  }
}

/**
 * Send email notification for missing submissions
 */
export async function sendMissingSubmissionsEmail(missingSubmissions: WeeklySubmissionStatus[], isTest = false): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('SendGrid not configured - would send email about missing submissions:', 
      missingSubmissions.map(s => s.location));
    return false;
  }

  const { startDate } = getCurrentWeekRange();
  const weekOf = startDate.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const missingLocations = missingSubmissions
    .filter(s => !s.hasSubmitted)
    .map(s => s.location);

  // For test emails, always send even if no missing locations
  if (missingLocations.length === 0 && !isTest) {
    console.log('All locations have submitted - no email needed');
    return true;
  }

  const emailContent = {
    to: ADMIN_EMAIL,
    from: FROM_EMAIL,
    subject: isTest ? `🧪 TEST EMAIL - Missing Sandwich Collection Numbers - Week of ${weekOf}` : `⚠️ Missing Sandwich Collection Numbers - Week of ${weekOf}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${isTest ? `
          <div style="background: #e3f2fd; border: 2px solid #1976d2; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <h3 style="color: #1976d2; margin: 0;">🧪 TEST EMAIL</h3>
            <p style="color: #1976d2; margin: 5px 0 0 0; font-weight: bold;">This is a test of the weekly monitoring email system with sample data</p>
          </div>
        ` : ''}
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #236383; margin: 0; display: flex; align-items: center;">
            🥪 The Sandwich Project - Weekly Numbers Alert
          </h2>
          <p style="color: #666; margin: 10px 0 0 0;">Week of ${weekOf}</p>
        </div>

        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #856404; margin: 0 0 10px 0;">⚠️ Missing Submissions</h3>
          <p style="color: #856404; margin: 0;">
            The following host locations haven't submitted their numbers yet:
          </p>
        </div>

        <ul style="background: white; border: 1px solid #ddd; border-radius: 6px; padding: 20px; margin: 20px 0;">
          ${missingLocations.map(location => 
            `<li style="margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
              <strong>${location}</strong>
            </li>`
          ).join('')}
        </ul>

        <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 15px; margin: 20px 0;">
          <h4 style="color: #155724; margin: 0 0 10px 0;">✅ Locations That Have Submitted</h4>
          ${missingSubmissions.filter(s => s.hasSubmitted).length > 0 ? 
            `<ul style="margin: 0; padding-left: 20px;">
              ${missingSubmissions.filter(s => s.hasSubmitted).map(s => 
                `<li style="color: #155724;">${s.location}</li>`
              ).join('')}
            </ul>` :
            '<p style="color: #155724; margin: 0;">None yet this week</p>'
          }
        </div>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; margin-top: 20px;">
          <p style="color: #666; margin: 0; font-size: 14px;">
            This automated alert is sent Thursday evenings and Friday mornings.<br>
            Check the Collections Log in the platform for real-time updates.
          </p>
        </div>
      </div>
    `,
    text: `${isTest ? '🧪 TEST EMAIL - This is a test of the weekly monitoring email system with sample data\n\n' : ''}The Sandwich Project - Weekly Numbers Alert
Week of ${weekOf}

MISSING SUBMISSIONS:
${missingLocations.map(location => `- ${location}`).join('\n')}

SUBMITTED THIS WEEK:
${missingSubmissions.filter(s => s.hasSubmitted).map(s => `- ${s.location}`).join('\n')}

This automated alert is sent Thursday evenings and Friday mornings.
Check the Collections Log in the platform for real-time updates.
    `
  };

  try {
    await mailService.send(emailContent);
    console.log(`Missing submissions email sent successfully to ${ADMIN_EMAIL}`);
    return true;
  } catch (error) {
    console.error('Failed to send missing submissions email:', error);
    return false;
  }
}

/**
 * Main function to check submissions and send alerts if needed
 */
export async function runWeeklyMonitoring(): Promise<void> {
  console.log('Running weekly sandwich submission monitoring...');
  
  try {
    const submissionStatus = await checkWeeklySubmissions();
    
    console.log('Weekly submission status:');
    submissionStatus.forEach(status => {
      console.log(`- ${status.location}: ${status.hasSubmitted ? '✅ Submitted' : '❌ Missing'}`);
    });

    const missingSubmissions = submissionStatus.filter(s => !s.hasSubmitted);
    
    if (missingSubmissions.length > 0) {
      await sendMissingSubmissionsEmail(submissionStatus);
    } else {
      console.log('🎉 All host locations have submitted their numbers!');
    }
    
  } catch (error) {
    console.error('Error in weekly monitoring:', error);
    
    // Send error notification email
    if (process.env.SENDGRID_API_KEY) {
      try {
        await mailService.send({
          to: ADMIN_EMAIL,
          from: FROM_EMAIL,
          subject: '🚨 Sandwich Monitoring System Error',
          text: `The weekly sandwich submission monitoring system encountered an error:\n\n${error}\n\nPlease check the system logs.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 15px;">
                <h3 style="color: #721c24;">🚨 Monitoring System Error</h3>
                <p>The weekly sandwich submission monitoring system encountered an error:</p>
                <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto;">${error}</pre>
                <p>Please check the system logs and ensure the monitoring system is functioning properly.</p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Failed to send error notification email:', emailError);
      }
    }
  }
}

/**
 * Schedule the monitoring to run at specific times
 * Call this function to set up the weekly monitoring schedule
 */
export function scheduleWeeklyMonitoring(): NodeJS.Timeout[] {
  const intervals: NodeJS.Timeout[] = [];
  
  // Function to check if it's the right time to run monitoring
  const checkAndRun = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 4 = Thursday, 5 = Friday
    const hour = now.getHours();
    
    // Thursday evening (7 PM) or Friday morning (8 AM)
    const shouldRun = (day === 4 && hour === 19) || (day === 5 && hour === 8);
    
    if (shouldRun) {
      runWeeklyMonitoring();
    }
  };
  
  // Check every hour
  const hourlyCheck = setInterval(checkAndRun, 60 * 60 * 1000);
  intervals.push(hourlyCheck);
  
  console.log('Weekly monitoring scheduled for Thursday 7 PM and Friday 8 AM');
  
  return intervals;
}