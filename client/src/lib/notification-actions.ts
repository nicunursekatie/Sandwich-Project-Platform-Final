/** Resolve actionable buttons for in-app notifications (panel + full page). */

export interface ResolvedNotificationAction {
  type: string;
  text: string;
  url?: string;
  /** Preformatted text for clipboard / Web Share API */
  shareText?: string;
}

type NotificationLike = {
  type?: string;
  title?: string;
  message?: string;
  actionText?: string | null;
  actionUrl?: string | null;
  action_text?: string | null;
  action_url?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function normalizeNotificationFields<T extends NotificationLike>(
  notification: T,
): T & { actionText?: string; actionUrl?: string } {
  return {
    ...notification,
    actionText: notification.actionText ?? notification.action_text ?? undefined,
    actionUrl: notification.actionUrl ?? notification.action_url ?? undefined,
  };
}

export function isMilestoneNotification(notification: NotificationLike): boolean {
  return (
    notification.type === 'milestone' ||
    (notification.title?.includes('Milestone') ?? false)
  );
}

export function getMilestoneShareText(notification: NotificationLike): string {
  const fromMetadata = notification.metadata?.shareText;
  if (typeof fromMetadata === 'string' && fromMetadata.trim()) {
    return fromMetadata.trim();
  }
  const title = notification.title?.trim() || 'Milestone reached!';
  const message = notification.message?.trim();
  return message ? `${title}\n\n${message}` : title;
}

export function getNotificationActions(
  notification: NotificationLike,
): ResolvedNotificationAction[] {
  const normalized = normalizeNotificationFields(notification);

  if (isMilestoneNotification(normalized)) {
    return [
      {
        type: 'view_analytics',
        text: 'View Analytics',
        url: '/dashboard?section=analytics',
      },
      {
        type: 'share_milestone',
        text: 'Share this',
        shareText: getMilestoneShareText(normalized),
      },
    ];
  }

  if (normalized.actionText) {
    return [
      {
        type: normalized.actionText.toLowerCase().replace(/\s+/g, '_'),
        text: normalized.actionText,
        url: normalized.actionUrl || undefined,
      },
    ];
  }

  if (normalized.actionUrl) {
    return [
      {
        type: 'view_details',
        text: 'View Details',
        url: normalized.actionUrl,
      },
    ];
  }

  return [];
}
