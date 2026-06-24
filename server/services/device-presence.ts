/**
 * Per-device online presence tracking.
 *
 * The existing online-users system tracks just `lastActiveAt` per user, which
 * answers "is this person online" but not "where". This module layers a small
 * in-memory map on top of the heartbeat: each heartbeat records the device
 * type the user is hitting from (phone vs laptop, sniffed from User-Agent),
 * so the /api/users/online endpoint can surface BOTH devices when someone has
 * the app open on phone and laptop at the same time.
 *
 * Design:
 *   - In-memory only (Map). Same scope as the existing in-memory heartbeat map
 *     used elsewhere in storage. Survives a process — not a deploy. That's
 *     fine because the persistent fallback (lastActiveAt from DB) still keeps
 *     the user-level "online" state correct after a restart; we just lose the
 *     per-device split until the next heartbeat from each device arrives
 *     (matter of minutes).
 *   - Per (userId, deviceType) entry with its own lastSeen timestamp so the
 *     phone going dormant doesn't drag the laptop entry down, and vice versa.
 *   - Cheap O(n) sweep on read for expired entries — n is bounded by users *
 *     2 device types, so this is fine at the scale this app operates at.
 */

export type DeviceType = 'mobile' | 'desktop';

interface DevicePresenceEntry {
  userId: string;
  device: DeviceType;
  lastSeen: number; // epoch ms
}

const presence = new Map<string, DevicePresenceEntry>(); // key: `${userId}:${device}`

const TTL_MINUTES = 15;

/**
 * Classify a User-Agent string into 'mobile' or 'desktop'. Tablets are
 * treated as 'desktop' since the app's mobile UI is designed for phones —
 * tablets typically render the desktop layout. iOS Safari with the desktop
 * site flag set will also be classified as desktop, which matches what the
 * user actually sees.
 */
export function classifyDevice(userAgent: string | null | undefined): DeviceType {
  if (!userAgent) return 'desktop';
  const ua = userAgent.toLowerCase();

  // Tablet detection takes precedence so an iPad doesn't trip the iPhone branch
  // below (iPad UA used to contain "iPhone" in some setups). Treat as desktop.
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'desktop';

  // Phone-class user agents.
  // Catches iPhone, Android Phones (Mobile + Android), Windows Phone, Mobile
  // Safari standalone (when added to home screen), Opera Mini, etc.
  if (
    /iphone|ipod|android.*mobile|mobile.*android|windows phone|blackberry|opera mini|iemobile/.test(
      ua,
    )
  ) {
    return 'mobile';
  }

  // Safety net: a UA that literally identifies as "Mobile" with no other tablet
  // markers is a phone.
  if (/mobile/.test(ua) && !/ipad|tablet/.test(ua)) return 'mobile';

  return 'desktop';
}

/** Record a heartbeat from a specific device for a user. */
export function recordHeartbeat(userId: string, userAgent: string | null | undefined): DeviceType {
  const device = classifyDevice(userAgent);
  const key = `${userId}:${device}`;
  presence.set(key, {
    userId,
    device,
    lastSeen: Date.now(),
  });
  return device;
}

/**
 * Get the set of devices a user is currently active on. Returns an empty
 * array if no fresh heartbeat from any device has come in within TTL.
 */
export function getDevicesForUser(userId: string, ttlMinutes: number = TTL_MINUTES): DeviceType[] {
  const cutoff = Date.now() - ttlMinutes * 60 * 1000;
  const devices: DeviceType[] = [];
  for (const key of ['mobile', 'desktop'] as DeviceType[]) {
    const entry = presence.get(`${userId}:${key}`);
    if (entry && entry.lastSeen >= cutoff) {
      devices.push(key);
    }
  }
  return devices;
}

/**
 * Build a userId → devices[] map for the whole presence table. Used by the
 * online-users endpoint to merge device info into its response in O(1) per
 * user. Performs a fresh expiry sweep so callers don't need to filter.
 */
export function getDevicesByUserId(ttlMinutes: number = TTL_MINUTES): Map<string, DeviceType[]> {
  const cutoff = Date.now() - ttlMinutes * 60 * 1000;
  const result = new Map<string, DeviceType[]>();
  for (const entry of presence.values()) {
    if (entry.lastSeen < cutoff) continue;
    const existing = result.get(entry.userId) || [];
    if (!existing.includes(entry.device)) existing.push(entry.device);
    result.set(entry.userId, existing);
  }
  return result;
}

/** Drop expired entries to keep the map from growing unbounded. */
export function sweepExpired(ttlMinutes: number = TTL_MINUTES): void {
  const cutoff = Date.now() - ttlMinutes * 60 * 1000;
  for (const [key, entry] of presence) {
    if (entry.lastSeen < cutoff) presence.delete(key);
  }
}

// Periodic sweep to prevent the map from holding stale entries forever. Cheap
// (linear scan of a small map) so a 5-minute cadence is fine.
setInterval(() => sweepExpired(), 5 * 60 * 1000).unref?.();
