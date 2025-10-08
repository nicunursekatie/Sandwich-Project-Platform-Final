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
    return response.data.items || [];
  }
}
