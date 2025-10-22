import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string;
  creator?: {
    email?: string;
    displayName?: string;
  };
  colorId?: string;
  backgroundColor?: string;
  foregroundColor?: string;
}

export class GoogleCalendarService {
  private auth!: JWT;
  private calendar: any;

  constructor(private calendarId: string) {}

  private async initializeAuth() {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      throw new Error('Missing Google service account credentials');
    }

    // Handle private key format (same as Google Sheets service)
    let cleanPrivateKey = privateKey;
    
    if (cleanPrivateKey.includes('\\n')) {
      cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
    }

    cleanPrivateKey = cleanPrivateKey
      .replace(/\\r\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    // Handle single-line key format
    if (!cleanPrivateKey.includes('\n') && cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      const beginMarker = '-----BEGIN PRIVATE KEY-----';
      const endMarker = '-----END PRIVATE KEY-----';
      const beginIndex = cleanPrivateKey.indexOf(beginMarker);
      const endIndex = cleanPrivateKey.indexOf(endMarker);

      if (beginIndex !== -1 && endIndex !== -1) {
        const keyContent = cleanPrivateKey
          .substring(beginIndex + beginMarker.length, endIndex)
          .trim();
        cleanPrivateKey = `${beginMarker}\n${keyContent}\n${endMarker}`;
      }
    }

    this.auth = new JWT({
      email: clientEmail,
      key: cleanPrivateKey,
      scopes: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events.readonly',
      ],
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  async getEvents(timeMin?: Date, timeMax?: Date): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      await this.initializeAuth();
    }

    const params: any = {
      calendarId: this.calendarId,
      singleEvents: true,
      orderBy: 'startTime',
    };

    if (timeMin) {
      params.timeMin = timeMin.toISOString();
    }

    if (timeMax) {
      params.timeMax = timeMax.toISOString();
    }

    const response = await this.calendar.events.list(params);
    const events = response.data.items || [];

    // Fetch color definitions from Google Calendar API
    const colors = await this.getColors();

    // Map events with their colors
    return events.map((event: any) => ({
      ...event,
      backgroundColor: event.colorId ? colors.event[event.colorId]?.background : colors.event['1']?.background,
      foregroundColor: event.colorId ? colors.event[event.colorId]?.foreground : colors.event['1']?.foreground,
    }));
  }

  private async getColors(): Promise<any> {
    if (!this.calendar) {
      await this.initializeAuth();
    }

    try {
      const response = await this.calendar.colors.get();
      return response.data;
    } catch (error) {
      // Return default Google Calendar colors if API call fails
      return {
        event: {
          '1': { background: '#a4bdfc', foreground: '#1d1d1d' },
          '2': { background: '#7ae7bf', foreground: '#1d1d1d' },
          '3': { background: '#dbadff', foreground: '#1d1d1d' },
          '4': { background: '#ff887c', foreground: '#1d1d1d' },
          '5': { background: '#fbd75b', foreground: '#1d1d1d' },
          '6': { background: '#ffb878', foreground: '#1d1d1d' },
          '7': { background: '#46d6db', foreground: '#1d1d1d' },
          '8': { background: '#e1e1e1', foreground: '#1d1d1d' },
          '9': { background: '#5484ed', foreground: '#1d1d1d' },
          '10': { background: '#51b749', foreground: '#1d1d1d' },
          '11': { background: '#dc2127', foreground: '#1d1d1d' },
        },
      };
    }
  }
}
