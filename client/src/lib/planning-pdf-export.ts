/**
 * PDF Export Utilities for Planning Widgets
 * Generates stylized, easy-to-read PDFs for sandwich planning and staffing planning
 */

import type { EventRequest } from '@shared/schema';

// Brand colors
const COLORS = {
  primary: '#236383',
  primaryLight: '#F0FBFC',
  orange: '#FBAD3F',
  teal: '#007E8C',
  red: '#A31C41',
  green: '#22C55E',
  gray: '#646464',
  lightGray: '#F3F4F6',
  white: '#FFFFFF',
};

interface SandwichWeekData {
  weekKey: string;
  weekStartDate: string;
  weekEndDate: string;
  distributionDate?: string;
  events: EventRequest[];
  totalEstimated: number;
}

interface StaffingWeekData {
  weekKey: string;
  weekStartDate: string;
  weekEndDate: string;
  distributionDate: string;
  events: EventRequest[];
  totalDriversNeeded: number;
  totalSpeakersNeeded: number;
  totalVolunteersNeeded: number;
  totalVanDriversNeeded: number;
  driversAssigned: number;
  speakersAssigned: number;
  volunteersAssigned: number;
  vanDriversAssigned: number;
  unfulfilled: {
    drivers: number;
    speakers: number;
    volunteers: number;
    vanDrivers: number;
  };
}

// Helper to format dates consistently
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'TBD';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'TBD';
  }
};

const formatTime = (timeStr: string | null | undefined): string => {
  if (!timeStr) return '';
  try {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  } catch {
    return timeStr;
  }
};

// Helper to get assignment count from PostgreSQL array format
const getAssignmentCount = (assignments: any): number => {
  if (!assignments) return 0;
  if (Array.isArray(assignments)) return assignments.length;
  if (typeof assignments === 'string') {
    if (assignments === '{}' || assignments === '') return 0;
    let cleaned = assignments.replace(/^{|}$/g, '');
    if (!cleaned) return 0;
    if (cleaned.includes('"')) {
      const matches = cleaned.match(/"[^"]*"|[^",]+/g);
      return matches ? matches.filter(item => item.trim()).length : 0;
    } else {
      return cleaned.split(',').filter(item => item.trim()).length;
    }
  }
  return 0;
};

// Get sandwich count for an event
const getSandwichCount = (event: EventRequest): number => {
  return event.status === 'completed' && event.actualSandwichCount
    ? event.actualSandwichCount
    : event.estimatedSandwichCount || 0;
};

// Generate styled HTML for PDF
const generatePDFStyles = () => `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #333;
      line-height: 1.5;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid ${COLORS.primary};
    }

    .header h1 {
      color: ${COLORS.primary};
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .header .subtitle {
      color: ${COLORS.gray};
      font-size: 14px;
    }

    .week-info {
      background: ${COLORS.primaryLight};
      border: 2px solid ${COLORS.primary};
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      text-align: center;
    }

    .week-info .week-title {
      font-size: 22px;
      font-weight: 700;
      color: ${COLORS.primary};
      margin-bottom: 4px;
    }

    .week-info .week-dates {
      font-size: 14px;
      color: ${COLORS.gray};
    }

    .summary-box {
      background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.teal} 100%);
      color: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      text-align: center;
    }

    .summary-box .big-number {
      font-size: 48px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .summary-box .label {
      font-size: 16px;
      opacity: 0.9;
    }

    .staffing-summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .staffing-card {
      background: white;
      border: 2px solid ${COLORS.lightGray};
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .staffing-card.fulfilled {
      border-color: ${COLORS.green};
      background: #F0FDF4;
    }

    .staffing-card.unfulfilled {
      border-color: ${COLORS.red};
      background: #FEF2F2;
    }

    .staffing-card .role-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .staffing-card .role-name {
      font-size: 12px;
      font-weight: 600;
      color: ${COLORS.gray};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .staffing-card .role-count {
      font-size: 24px;
      font-weight: 700;
    }

    .staffing-card .role-status {
      font-size: 11px;
      margin-top: 4px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: ${COLORS.primary};
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid ${COLORS.lightGray};
    }

    .events-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .event-card {
      background: white;
      border: 1px solid ${COLORS.lightGray};
      border-radius: 8px;
      padding: 16px;
      page-break-inside: avoid;
    }

    .event-card .event-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }

    .event-card .org-name {
      font-size: 16px;
      font-weight: 600;
      color: ${COLORS.primary};
    }

    .event-card .sandwich-count {
      font-size: 18px;
      font-weight: 700;
      color: ${COLORS.teal};
    }

    .event-card .event-details {
      font-size: 13px;
      color: ${COLORS.gray};
    }

    .event-card .event-details span {
      margin-right: 16px;
    }

    .event-card .badges {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }

    .badge-driver {
      background: #DCFCE7;
      color: #166534;
    }

    .badge-driver.needed {
      background: #FEE2E2;
      color: #991B1B;
    }

    .badge-speaker {
      background: #FEF3C7;
      color: #92400E;
    }

    .badge-speaker.needed {
      background: #FEE2E2;
      color: #991B1B;
    }

    .badge-volunteer {
      background: ${COLORS.primaryLight};
      color: ${COLORS.primary};
    }

    .badge-volunteer.needed {
      background: #FEE2E2;
      color: #991B1B;
    }

    .badge-van {
      background: #F3E8FF;
      color: #7C3AED;
    }

    .badge-van.needed {
      background: #FEE2E2;
      color: #991B1B;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid ${COLORS.lightGray};
      text-align: center;
      color: ${COLORS.gray};
      font-size: 12px;
    }

    .no-events {
      text-align: center;
      padding: 40px;
      color: ${COLORS.gray};
    }

    .sandwich-types {
      font-size: 12px;
      color: ${COLORS.gray};
      margin-top: 4px;
    }

    @media print {
      body {
        padding: 20px;
      }
      .event-card {
        page-break-inside: avoid;
      }
    }
  </style>
`;

/**
 * Generate Sandwich Planning PDF HTML
 */
export function generateSandwichPlanningPDF(weekData: SandwichWeekData): string {
  const events = weekData.events || [];
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = a.scheduledEventDate || a.desiredEventDate;
    const dateB = b.scheduledEventDate || b.desiredEventDate;
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  const weekTotal = sortedEvents.reduce((sum, e) => sum + getSandwichCount(e), 0);

  const eventsHTML = sortedEvents.length === 0
    ? '<div class="no-events">No events scheduled for this week.</div>'
    : sortedEvents.map(event => {
        const dateStr = event.scheduledEventDate || event.desiredEventDate;
        const count = getSandwichCount(event);
        const types = event.sandwichTypes as any[] | undefined;
        const typesStr = types && Array.isArray(types) && types.length > 0
          ? types.map((t: any) => `${t.quantity} ${t.type}`).join(', ')
          : '';

        // Calculate unfulfilled staffing
        const driversUnfulfilled = Math.max(0, (event.driversNeeded || 0) - getAssignmentCount(event.assignedDriverIds));
        const speakersUnfulfilled = Math.max(0, (event.speakersNeeded || 0) - getAssignmentCount(event.assignedSpeakerIds));

        return `
          <div class="event-card">
            <div class="event-header">
              <div>
                <div class="org-name">${event.organizationName || 'Unknown Organization'}</div>
                <div class="event-details">
                  <span>📅 ${formatDate(dateStr?.toString())}</span>
                  ${event.eventStartTime ? `<span>🕐 ${formatTime(event.eventStartTime)}</span>` : ''}
                </div>
                ${typesStr ? `<div class="sandwich-types">Types: ${typesStr}</div>` : ''}
              </div>
              <div class="sandwich-count">🥪 ${count.toLocaleString()}</div>
            </div>
            ${(driversUnfulfilled > 0 || speakersUnfulfilled > 0) ? `
              <div class="badges">
                ${driversUnfulfilled > 0 ? `<span class="badge badge-driver needed">🚗 ${driversUnfulfilled} Driver${driversUnfulfilled > 1 ? 's' : ''} Needed</span>` : ''}
                ${speakersUnfulfilled > 0 ? `<span class="badge badge-speaker needed">🎤 ${speakersUnfulfilled} Speaker${speakersUnfulfilled > 1 ? 's' : ''} Needed</span>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sandwich Planning - ${weekData.distributionDate || weekData.weekEndDate}</title>
      ${generatePDFStyles()}
    </head>
    <body>
      <div class="header">
        <h1>🥪 Sandwich Planning Report</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <div class="week-info">
        <div class="week-title">${weekData.distributionDate || 'Week Overview'}</div>
        <div class="week-dates">${weekData.weekStartDate} - ${weekData.weekEndDate}</div>
      </div>

      <div class="summary-box">
        <div class="big-number">${weekTotal.toLocaleString()}</div>
        <div class="label">Total Sandwiches This Week</div>
      </div>

      <div class="section-title">Events This Week (${sortedEvents.length} total)</div>
      <div class="events-list">
        ${eventsHTML}
      </div>

      <div class="footer">
        <p>The Sandwich Project • Weekly Planning Report</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate Staffing Planning PDF HTML
 */
export function generateStaffingPlanningPDF(weekData: StaffingWeekData): string {
  const events = weekData.events || [];
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = a.scheduledEventDate || a.desiredEventDate;
    const dateB = b.scheduledEventDate || b.desiredEventDate;
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  const totalUnfulfilled = weekData.unfulfilled.drivers + weekData.unfulfilled.speakers +
                           weekData.unfulfilled.volunteers + weekData.unfulfilled.vanDrivers;

  const getCardClass = (needed: number, fulfilled: number) =>
    needed === 0 ? '' : (fulfilled >= needed ? 'fulfilled' : 'unfulfilled');

  // Filter to only events with unmet needs for the detailed list
  const eventsWithUnmetNeeds = sortedEvents.filter(event => {
    const driversNeeded = Math.max(0, (event.driversNeeded || 0) - getAssignmentCount(event.assignedDriverIds));
    const speakersNeeded = Math.max(0, (event.speakersNeeded || 0) - getAssignmentCount(event.assignedSpeakerIds));
    const volunteersNeeded = Math.max(0, (event.volunteersNeeded || 0) - getAssignmentCount(event.assignedVolunteerIds));
    const vanDriverNeeded = Math.max(0, (event.vanDriverNeeded ? 1 : 0) - ((event.assignedVanDriverId ? 1 : 0) + (event.isDhlVan ? 1 : 0)));
    return driversNeeded + speakersNeeded + volunteersNeeded + vanDriverNeeded > 0;
  });

  const eventsHTML = eventsWithUnmetNeeds.length === 0
    ? '<div class="no-events">✅ All staffing needs have been met for this week!</div>'
    : eventsWithUnmetNeeds.map(event => {
        const dateStr = event.scheduledEventDate || event.desiredEventDate;
        const sandwichCount = getSandwichCount(event);

        const driversNeeded = Math.max(0, (event.driversNeeded || 0) - getAssignmentCount(event.assignedDriverIds));
        const speakersNeeded = Math.max(0, (event.speakersNeeded || 0) - getAssignmentCount(event.assignedSpeakerIds));
        const volunteersNeeded = Math.max(0, (event.volunteersNeeded || 0) - getAssignmentCount(event.assignedVolunteerIds));
        const vanDriverNeeded = Math.max(0, (event.vanDriverNeeded ? 1 : 0) - ((event.assignedVanDriverId ? 1 : 0) + (event.isDhlVan ? 1 : 0)));

        return `
          <div class="event-card">
            <div class="event-header">
              <div>
                <div class="org-name">${event.organizationName || 'Unknown Organization'}</div>
                <div class="event-details">
                  <span>📅 ${formatDate(dateStr?.toString())}</span>
                  ${event.eventStartTime ? `<span>🕐 ${formatTime(event.eventStartTime)}</span>` : ''}
                  ${sandwichCount > 0 ? `<span>🥪 ${sandwichCount.toLocaleString()}</span>` : ''}
                </div>
                ${event.eventAddress ? `<div class="event-details" style="margin-top: 4px;">📍 ${event.eventAddress}</div>` : ''}
              </div>
            </div>
            <div class="badges">
              ${driversNeeded > 0 ? `<span class="badge badge-driver needed">🚗 ${driversNeeded} Driver${driversNeeded > 1 ? 's' : ''} Needed</span>` : ''}
              ${speakersNeeded > 0 ? `<span class="badge badge-speaker needed">🎤 ${speakersNeeded} Speaker${speakersNeeded > 1 ? 's' : ''} Needed</span>` : ''}
              ${volunteersNeeded > 0 ? `<span class="badge badge-volunteer needed">👤 ${volunteersNeeded} Volunteer${volunteersNeeded > 1 ? 's' : ''} Needed</span>` : ''}
              ${vanDriverNeeded > 0 ? `<span class="badge badge-van needed">🚐 Van Driver Needed</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Staffing Planning - ${weekData.distributionDate}</title>
      ${generatePDFStyles()}
    </head>
    <body>
      <div class="header">
        <h1>👥 Staffing Planning Report</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <div class="week-info">
        <div class="week-title">${weekData.distributionDate}</div>
        <div class="week-dates">${weekData.weekStartDate} - ${weekData.weekEndDate}</div>
      </div>

      <div class="summary-box" style="background: ${totalUnfulfilled === 0 ? `linear-gradient(135deg, ${COLORS.green} 0%, #16A34A 100%)` : `linear-gradient(135deg, ${COLORS.orange} 0%, #EA580C 100%)`};">
        <div class="big-number">${totalUnfulfilled === 0 ? '✅' : totalUnfulfilled}</div>
        <div class="label">${totalUnfulfilled === 0 ? 'All Positions Filled!' : 'Positions Still Needed'}</div>
      </div>

      <div class="staffing-summary">
        <div class="staffing-card ${getCardClass(weekData.totalDriversNeeded, weekData.driversAssigned)}">
          <div class="role-icon">🚗</div>
          <div class="role-name">Drivers</div>
          <div class="role-count">${weekData.driversAssigned}/${weekData.totalDriversNeeded}</div>
          <div class="role-status">${weekData.unfulfilled.drivers > 0 ? `${weekData.unfulfilled.drivers} needed` : 'Filled'}</div>
        </div>
        <div class="staffing-card ${getCardClass(weekData.totalSpeakersNeeded, weekData.speakersAssigned)}">
          <div class="role-icon">🎤</div>
          <div class="role-name">Speakers</div>
          <div class="role-count">${weekData.speakersAssigned}/${weekData.totalSpeakersNeeded}</div>
          <div class="role-status">${weekData.unfulfilled.speakers > 0 ? `${weekData.unfulfilled.speakers} needed` : 'Filled'}</div>
        </div>
        <div class="staffing-card ${getCardClass(weekData.totalVolunteersNeeded, weekData.volunteersAssigned)}">
          <div class="role-icon">👤</div>
          <div class="role-name">Volunteers</div>
          <div class="role-count">${weekData.volunteersAssigned}/${weekData.totalVolunteersNeeded}</div>
          <div class="role-status">${weekData.unfulfilled.volunteers > 0 ? `${weekData.unfulfilled.volunteers} needed` : 'Filled'}</div>
        </div>
        <div class="staffing-card ${getCardClass(weekData.totalVanDriversNeeded, weekData.vanDriversAssigned)}">
          <div class="role-icon">🚐</div>
          <div class="role-name">Van Drivers</div>
          <div class="role-count">${weekData.vanDriversAssigned}/${weekData.totalVanDriversNeeded}</div>
          <div class="role-status">${weekData.unfulfilled.vanDrivers > 0 ? `${weekData.unfulfilled.vanDrivers} needed` : 'Filled'}</div>
        </div>
      </div>

      <div class="section-title">Events Needing Staffing (${eventsWithUnmetNeeds.length} of ${sortedEvents.length} total)</div>
      <div class="events-list">
        ${eventsHTML}
      </div>

      <div class="footer">
        <p>The Sandwich Project • Weekly Staffing Report</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Download HTML as PDF using browser print
 */
export function downloadPDF(htmlContent: string, filename: string): void {
  // Create a new window with the HTML content
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download the PDF');
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Wait for content to load, then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

/**
 * Export sandwich planning for current week
 */
export function exportSandwichPlanning(weekData: SandwichWeekData): void {
  const html = generateSandwichPlanningPDF(weekData);
  const dateStr = weekData.weekKey || new Date().toISOString().split('T')[0];
  downloadPDF(html, `sandwich-planning-${dateStr}.pdf`);
}

/**
 * Export staffing planning for current week
 */
export function exportStaffingPlanning(weekData: StaffingWeekData): void {
  const html = generateStaffingPlanningPDF(weekData);
  const dateStr = weekData.weekKey || new Date().toISOString().split('T')[0];
  downloadPDF(html, `staffing-planning-${dateStr}.pdf`);
}
