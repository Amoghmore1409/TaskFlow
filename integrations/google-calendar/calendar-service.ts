import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
}

interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
}

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;
  private calendar: any;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Set access token for the OAuth2 client
   */
  setAccessToken(accessToken: string, refreshToken?: string) {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken || null,
    });
  }

  /**
   * Generate OAuth2 authorization URL
   */
  generateAuthUrl(scopes: string[] = ['https://www.googleapis.com/auth/calendar']): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  /**
   * Create a calendar event for approved leave request
   */
  async createLeaveEvent(leaveRequest: LeaveRequest, calendarId: string = 'primary'): Promise<string> {
    try {
      const event: CalendarEvent = {
        summary: `${leaveRequest.employeeName} - ${leaveRequest.leaveType} Leave`,
        description: `Leave request ID: ${leaveRequest.id}\nStatus: ${leaveRequest.status}`,
        start: {
          date: leaveRequest.startDate,
          timeZone: 'America/New_York', // Configure based on organization timezone
        },
        end: {
          date: this.getNextDay(leaveRequest.endDate), // Google Calendar end date is exclusive
          timeZone: 'America/New_York',
        },
        attendees: [
          {
            email: leaveRequest.employeeEmail,
            displayName: leaveRequest.employeeName,
          },
        ],
      };

      const response = await this.calendar.events.insert({
        calendarId,
        resource: event,
        sendUpdates: 'all',
      });

      return response.data.id;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Update existing calendar event
   */
  async updateLeaveEvent(
    eventId: string,
    leaveRequest: LeaveRequest,
    calendarId: string = 'primary'
  ): Promise<void> {
    try {
      const event: CalendarEvent = {
        summary: `${leaveRequest.employeeName} - ${leaveRequest.leaveType} Leave`,
        description: `Leave request ID: ${leaveRequest.id}\nStatus: ${leaveRequest.status}`,
        start: {
          date: leaveRequest.startDate,
          timeZone: 'America/New_York',
        },
        end: {
          date: this.getNextDay(leaveRequest.endDate),
          timeZone: 'America/New_York',
        },
      };

      await this.calendar.events.update({
        calendarId,
        eventId,
        resource: event,
        sendUpdates: 'all',
      });
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Delete calendar event
   */
  async deleteLeaveEvent(eventId: string, calendarId: string = 'primary'): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: 'all',
      });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  /**
   * Get events for a specific date range
   */
  async getEvents(
    startDate: string,
    endDate: string,
    calendarId: string = 'primary'
  ): Promise<any[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin: new Date(startDate).toISOString(),
        timeMax: new Date(endDate).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw new Error('Failed to fetch calendar events');
    }
  }

  /**
   * Create a team meeting event
   */
  async createMeetingEvent(
    title: string,
    description: string,
    startDateTime: string,
    endDateTime: string,
    attendeeEmails: string[],
    calendarId: string = 'primary'
  ): Promise<string> {
    try {
      const event: CalendarEvent = {
        summary: title,
        description,
        start: {
          dateTime: startDateTime,
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'America/New_York',
        },
        attendees: attendeeEmails.map(email => ({ email })),
      };

      const response = await this.calendar.events.insert({
        calendarId,
        resource: event,
        sendUpdates: 'all',
      });

      return response.data.id;
    } catch (error) {
      console.error('Error creating meeting event:', error);
      throw new Error('Failed to create meeting event');
    }
  }

  /**
   * Check for conflicts with existing events
   */
  async checkForConflicts(
    startDate: string,
    endDate: string,
    attendeeEmails: string[]
  ): Promise<boolean> {
    try {
      // Check each attendee's calendar for conflicts
      for (const email of attendeeEmails) {
        const events = await this.getEvents(startDate, endDate, email);
        if (events.length > 0) {
          return true; // Conflict found
        }
      }
      return false; // No conflicts
    } catch (error) {
      console.error('Error checking for conflicts:', error);
      return false; // Assume no conflicts if unable to check
    }
  }

  /**
   * Utility function to get the next day (for Google Calendar exclusive end date)
   */
  private getNextDay(dateString: string): string {
    const date = new Date(dateString);
    date.setDate(date.getDate() + 1);
    const isoString = date.toISOString();
    return isoString.split('T')[0]!;
  }
}

// Example usage and Lambda function for AWS integration
export const handleLeaveApproval = async (event: any) => {
  const { leaveRequest, googleCredentials } = event;
  
  const calendarService = new GoogleCalendarService(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );

  calendarService.setAccessToken(
    googleCredentials.accessToken,
    googleCredentials.refreshToken
  );

  try {
    if (leaveRequest.status === 'approved') {
      // Create calendar event for approved leave
      const eventId = await calendarService.createLeaveEvent(leaveRequest);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Calendar event created successfully',
          eventId,
        }),
      };
    } else if (leaveRequest.status === 'rejected') {
      // If there was a previously created event, delete it
      if (leaveRequest.calendarEventId) {
        await calendarService.deleteLeaveEvent(leaveRequest.calendarEventId);
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Calendar event deleted due to rejection',
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'No calendar action required',
      }),
    };
  } catch (error) {
    console.error('Error handling leave approval:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to handle calendar integration',
      }),
    };
  }
};
