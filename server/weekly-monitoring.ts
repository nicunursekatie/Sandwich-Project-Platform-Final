import { MailService } from '@sendgrid/mail';
import { db } from './db';
import { sandwichCollections, hosts } from '@shared/schema';
import { eq, sql, and, gte, lte, like, or } from 'drizzle-orm';

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
  submittedBy?: string[];
  dunwoodyStatus?: {
    lisaHiles: boolean;
    stephanieOrMarcy: boolean;
    complete: boolean;
  };
}

interface MultiWeekReport {
  weekRange: { startDate: Date; endDate: Date };
  weekLabel: string;
  submissionStatus: WeeklySubmissionStatus[];
}

interface ComprehensiveReport {
  reportPeriod: string;
  weeks: MultiWeekReport[];
  summary: {
    totalWeeks: number;
    locationsTracked: string[];
    mostMissing: string[];
    mostReliable: string[];
    overallStats: {
      [location: string]: {
        submitted: number;
        missed: number;
        percentage: number;
      };
    };
  };
}

/**
 * Get the week's date range for a given offset (Wednesday to Tuesday)
 * Entries posted before Wednesday cannot count collections that happened Wednesday or after for that week's submission
 * @param weeksAgo - Number of weeks to go back (0 = current week, 1 = last week, etc.)
 */
export function getWeekRange(weeksAgo: number = 0): { startDate: Date; endDate: Date } {
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
  wednesday.setDate(now.getDate() - daysToWednesday - (weeksAgo * 7));
  wednesday.setHours(0, 0, 0, 0);
  
  // Calculate Tuesday of current week cycle (6 days after Wednesday)
  const tuesday = new Date(wednesday);
  tuesday.setDate(wednesday.getDate() + 6);
  tuesday.setHours(23, 59, 59, 999);
  
  return { startDate: wednesday, endDate: tuesday };
}

/**
 * Get the current week's date range (Wednesday to Tuesday) - backwards compatibility
 */
export function getCurrentWeekRange(): { startDate: Date; endDate: Date } {
  return getWeekRange(0);
}

/**
 * Check Dunwoody special requirements: need both Lisa Hiles AND either Stephanie or Marcy
 */
function checkDunwoodyStatus(submissions: any[], location: string): any {
  const dunwoodySubmissions = submissions.filter(sub => 
    sub.hostName?.toLowerCase().includes('dunwoody')
  );
  
  if (dunwoodySubmissions.length === 0) {
    return {
      lisaHiles: false,
      stephanieOrMarcy: false,
      complete: false
    };
  }
  
  // Check for Lisa Hiles
  const lisaSubmission = dunwoodySubmissions.some(sub => 
    sub.submittedBy?.toLowerCase().includes('lisa') && 
    sub.submittedBy?.toLowerCase().includes('hiles')
  );
  
  // Check for Stephanie or Marcy
  const stephanieOrMarcySubmission = dunwoodySubmissions.some(sub => {
    const submitter = sub.submittedBy?.toLowerCase() || '';
    return submitter.includes('stephanie') || submitter.includes('marcy');
  });
  
  return {
    lisaHiles: lisaSubmission,
    stephanieOrMarcy: stephanieOrMarcySubmission,
    complete: lisaSubmission && stephanieOrMarcySubmission
  };
}

/**
 * Check which host locations have submitted for a specific week
 * @param weeksAgo - Number of weeks to go back (0 = current week, 1 = last week, etc.)
 */
export async function checkWeeklySubmissions(weeksAgo: number = 0): Promise<WeeklySubmissionStatus[]> {
  const { startDate, endDate } = getWeekRange(weeksAgo);
  
  console.log(`Checking submissions for week: ${startDate.toDateString()} to ${endDate.toDateString()}`);
  
  try {
    // Get all submissions for this week
    const weeklySubmissions = await db
      .select({
        hostName: sandwichCollections.hostName,
        collectionDate: sandwichCollections.collectionDate,
        submittedBy: sandwichCollections.createdByName,
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
      
      // Get submissions for this location
      const locationSubmissions = weeklySubmissions.filter(sub => {
        const hostName = sub.hostName?.toLowerCase().trim() || '';
        return hostName && (
          hostName.includes(normalizedExpected) ||
          normalizedExpected.includes(hostName) ||
          // Handle variations like "East Cobb" vs "East Cobb/Roswell"
          hostName.replace(/[\/\-\s]/g, '').includes(normalizedExpected.replace(/[\/\-\s]/g, '')) ||
          normalizedExpected.replace(/[\/\-\s]/g, '').includes(hostName.replace(/[\/\-\s]/g, ''))
        );
      });
      
      let hasSubmitted = locationSubmissions.length > 0;
      let dunwoodyStatus = undefined;
      
      // Special handling for Dunwoody
      if (expectedLocation === 'Dunwoody/PTC') {
        dunwoodyStatus = checkDunwoodyStatus(locationSubmissions, expectedLocation);
        hasSubmitted = dunwoodyStatus.complete; // Only mark as submitted if both requirements met
      }
      
      const submittedBy = locationSubmissions
        .map(sub => sub.submittedBy)
        .filter(Boolean)
        .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

      statusResults.push({
        location: expectedLocation,
        hasSubmitted,
        lastSubmissionDate: locationSubmissions.length > 0 ? 
          locationSubmissions[locationSubmissions.length - 1]?.collectionDate : undefined,
        submittedBy,
        dunwoodyStatus
      });
    }

    return statusResults;
  } catch (error) {
    console.error('Error checking weekly submissions:', error);
    throw error;
  }
}

/**
 * Generate a comprehensive multi-week report
 */
export async function generateMultiWeekReport(numberOfWeeks: number = 4): Promise<ComprehensiveReport> {
  const weeks: MultiWeekReport[] = [];
  
  // Generate reports for each week
  for (let i = 0; i < numberOfWeeks; i++) {
    const { startDate, endDate } = getWeekRange(i);
    const submissionStatus = await checkWeeklySubmissions(i);
    
    weeks.push({
      weekRange: { startDate, endDate },
      weekLabel: `Week of ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      submissionStatus
    });
  }
  
  // Calculate summary statistics
  const locationsTracked = EXPECTED_HOST_LOCATIONS;
  const overallStats: { [location: string]: { submitted: number; missed: number; percentage: number } } = {};
  
  // Initialize stats for each location
  locationsTracked.forEach(location => {
    overallStats[location] = { submitted: 0, missed: 0, percentage: 0 };
  });
  
  // Calculate statistics across all weeks
  weeks.forEach(week => {
    week.submissionStatus.forEach(status => {
      if (status.hasSubmitted) {
        overallStats[status.location].submitted++;
      } else {
        overallStats[status.location].missed++;
      }
    });
  });
  
  // Calculate percentages
  Object.keys(overallStats).forEach(location => {
    const stats = overallStats[location];
    const total = stats.submitted + stats.missed;
    stats.percentage = total > 0 ? Math.round((stats.submitted / total) * 100) : 0;
  });
  
  // Find most missing and most reliable
  const mostMissing = Object.entries(overallStats)
    .filter(([location, stats]) => stats.missed > 0)
    .sort(([, a], [, b]) => b.missed - a.missed)
    .slice(0, 3)
    .map(([location]) => location);
    
  const mostReliable = Object.entries(overallStats)
    .filter(([location, stats]) => stats.percentage >= 75)
    .sort(([, a], [, b]) => b.percentage - a.percentage)
    .slice(0, 3)
    .map(([location]) => location);
  
  const startDate = weeks[weeks.length - 1]?.weekRange.startDate;
  const endDate = weeks[0]?.weekRange.endDate;
  const reportPeriod = `${startDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${endDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  
  return {
    reportPeriod,
    weeks: weeks.reverse(), // Most recent first
    summary: {
      totalWeeks: numberOfWeeks,
      locationsTracked,
      mostMissing,
      mostReliable,
      overallStats
    }
  };
}

/**
 * Send email notification for missing submissions
 */
export async function sendMissingSubmissionsEmail(missingSubmissions: WeeklySubmissionStatus[], isTest = false, weekLabel?: string): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('SendGrid not configured - would send email about missing submissions:', 
      missingSubmissions.map(s => s.location));
    return false;
  }

  const { startDate } = getCurrentWeekRange();
  const weekOf = weekLabel || startDate.toLocaleDateString('en-US', { 
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
          ${missingLocations.map(location => {
            const status = missingSubmissions.find(s => s.location === location);
            let specialNote = '';
            
            if (status?.dunwoodyStatus && location === 'Dunwoody/PTC') {
              const { lisaHiles, stephanieOrMarcy } = status.dunwoodyStatus;
              if (!lisaHiles && !stephanieOrMarcy) {
                specialNote = ' (Missing both Lisa Hiles AND Stephanie/Marcy entries)';
              } else if (!lisaHiles) {
                specialNote = ' (Missing Lisa Hiles entry)';
              } else if (!stephanieOrMarcy) {
                specialNote = ' (Missing Stephanie/Marcy entry)';
              }
            }
            
            return `<li style="margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
              <strong>${location}</strong>${specialNote}
            </li>`;
          }).join('')}
        </ul>

        <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 15px; margin: 20px 0;">
          <h4 style="color: #155724; margin: 0 0 10px 0;">✅ Locations That Have Submitted</h4>
          ${missingSubmissions.filter(s => s.hasSubmitted).length > 0 ? 
            `<ul style="margin: 0; padding-left: 20px;">
              ${missingSubmissions.filter(s => s.hasSubmitted).map(s => {
                let submitterInfo = '';
                if (s.submittedBy && s.submittedBy.length > 0) {
                  submitterInfo = ` (by: ${s.submittedBy.join(', ')})`;
                }
                
                let specialNote = '';
                if (s.dunwoodyStatus && s.location === 'Dunwoody/PTC') {
                  specialNote = ' ✓ Both required entries received';
                }
                
                return `<li style="color: #155724;">${s.location}${submitterInfo}${specialNote}</li>`;
              }).join('')}
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