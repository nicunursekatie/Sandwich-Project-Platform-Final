/**
 * Canonical catalog of user-facing alert types.
 *
 * Every alert the user can toggle in the Alert Preferences screen is listed
 * here. Backend senders look up a user's row in `notification_preferences`
 * keyed by `type` to decide whether to send and over which channels.
 *
 * Shared between client and server so the UI, the API, and the senders can
 * never disagree about what a given type means.
 */

export const ALERT_TYPES = {
  TSP_CONTACT_ASSIGNED: 'tsp_contact_assigned',
  TEAM_BOARD_ASSIGNMENT: 'team_board_assignment',
  WEEKLY_COLLECTION_REMINDER: 'weekly_collection_reminder',
  VOLUNTEER_EVENT_REMINDER: 'volunteer_event_reminder',
  CHAT_MENTION: 'chat_mention',
  TEAM_BOARD_MENTION: 'team_board_mention',
} as const;

export type AlertType = typeof ALERT_TYPES[keyof typeof ALERT_TYPES];

export type AlertCategory = 'event' | 'communication' | 'task' | 'collection';

export interface AlertDefinition {
  type: AlertType;
  name: string;
  description: string;
  category: AlertCategory;
  /** Channels the user can choose from. */
  availableChannels: Array<'email' | 'sms' | 'in_app'>;
  /** Whether a working backend sender exists for this alert. False = listed in UI as "coming soon". */
  implemented: boolean;
  /** Default channel state when the user has no saved preference yet. */
  defaults: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    inAppEnabled: boolean;
  };
}

/**
 * Single source of truth for all alerts.
 *
 * To add a new alert: add an entry here, then (a) build a sender that calls
 * `shouldSendOverChannel(userId, ALERT_TYPES.YOUR_TYPE, 'email'|'sms')` from
 * the backend, and (b) flip `implemented: true`.
 */
export const ALERT_CATALOG: AlertDefinition[] = [
  {
    type: ALERT_TYPES.TSP_CONTACT_ASSIGNED,
    name: 'TSP Contact Assignment',
    description:
      "You're notified when you're assigned as the TSP contact for an event. Fires in real time on assignment.",
    category: 'event',
    availableChannels: ['email', 'sms'],
    implemented: true,
    defaults: { emailEnabled: true, smsEnabled: true, inAppEnabled: true },
  },
  {
    type: ALERT_TYPES.TEAM_BOARD_ASSIGNMENT,
    name: 'Team Board Assignment',
    description:
      "You're notified when someone assigns you to a task, note, idea, or reminder on the team board.",
    category: 'task',
    availableChannels: ['email', 'sms'],
    implemented: true,
    defaults: { emailEnabled: true, smsEnabled: false, inAppEnabled: true },
  },
  {
    type: ALERT_TYPES.WEEKLY_COLLECTION_REMINDER,
    name: 'Weekly Collection Reminder',
    description:
      "Reminder when a weekly sandwich count hasn't been logged for a location you're responsible for.",
    category: 'collection',
    availableChannels: ['email', 'sms'],
    implemented: true,
    defaults: { emailEnabled: true, smsEnabled: true, inAppEnabled: true },
  },
  {
    type: ALERT_TYPES.VOLUNTEER_EVENT_REMINDER,
    name: 'Volunteer Event Reminder',
    description:
      "Reminder before an event you've signed up to volunteer, drive, or speak at.",
    category: 'event',
    availableChannels: ['email', 'sms'],
    implemented: false,
    defaults: { emailEnabled: true, smsEnabled: true, inAppEnabled: true },
  },
  {
    type: ALERT_TYPES.CHAT_MENTION,
    name: 'Chat Room Mention',
    description:
      'Get notified when someone @mentions you in a chat room.',
    category: 'communication',
    availableChannels: ['email', 'sms'],
    implemented: false,
    defaults: { emailEnabled: true, smsEnabled: false, inAppEnabled: true },
  },
  {
    type: ALERT_TYPES.TEAM_BOARD_MENTION,
    name: 'Team Board Mention',
    description:
      'Get notified when someone mentions you in a team board item or comment.',
    category: 'communication',
    availableChannels: ['email', 'sms'],
    implemented: false,
    defaults: { emailEnabled: true, smsEnabled: false, inAppEnabled: true },
  },
];

const ALERT_TYPE_VALUES = new Set<string>(Object.values(ALERT_TYPES));

export function isAlertType(value: string): value is AlertType {
  return ALERT_TYPE_VALUES.has(value);
}

export function getAlertDefinition(type: AlertType): AlertDefinition | undefined {
  return ALERT_CATALOG.find((a) => a.type === type);
}

/**
 * Map alert type → the `category` column value we store in
 * `notification_preferences`.
 */
export function getAlertCategory(type: AlertType): AlertCategory {
  return getAlertDefinition(type)?.category ?? 'event';
}
