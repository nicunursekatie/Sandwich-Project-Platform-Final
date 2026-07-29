import { logger } from './utils/production-safe-logger';

/**
 * Repair/normalize a Google service-account private key so it works with
 * Node.js v20's stricter OpenSSL PEM parsing.
 *
 * Handles: escaped \n sequences, single-line keys (rebuilds 64-char lines),
 * surrounding quotes, missing PEM headers, and mixed line endings.
 *
 * This is the single source of truth for key repair — both the Sheets
 * service (initializeAuth) and the diagnostics module must use it so that
 * diagnostics test the same key the service actually uses.
 */
export function repairPrivateKey(privateKey: string, quiet = false): string {
  let cleanPrivateKey = privateKey;

  const log = (...args: any[]) => {
    if (!quiet) logger.log(...args);
  };

  // Replit often stores literal \n characters instead of actual newlines
  if (cleanPrivateKey.includes('\\n')) {
    cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
    log('🔧 Converted \\n to actual newlines (Node.js v20 fix)');
  }

  // Additional newline handling for different platforms
  cleanPrivateKey = cleanPrivateKey
    .replace(/\\r\\n/g, '\n') // Handle Windows-style escaped newlines
    .replace(/\\r/g, '\n') // Handle Mac-style escaped newlines
    .replace(/\r\n/g, '\n') // Normalize Windows newlines
    .replace(/\r/g, '\n'); // Normalize Mac newlines

  // Handle single-line key format from Replit
  if (
    !cleanPrivateKey.includes('\n') &&
    cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')
  ) {
    log('🔧 Detected single-line private key - fixing for Node.js v20...');

    const beginMarker = '-----BEGIN PRIVATE KEY-----';
    const endMarker = '-----END PRIVATE KEY-----';
    const beginIndex = cleanPrivateKey.indexOf(beginMarker);
    const endIndex = cleanPrivateKey.indexOf(endMarker);

    if (beginIndex !== -1 && endIndex !== -1) {
      const keyContent = cleanPrivateKey
        .substring(beginIndex + beginMarker.length, endIndex)
        .trim();

      // Rebuild key with proper line breaks every 64 characters
      const lines = [beginMarker];
      for (let i = 0; i < keyContent.length; i += 64) {
        lines.push(keyContent.substring(i, i + 64));
      }
      lines.push(endMarker);

      cleanPrivateKey = lines.join('\n');
      log('🔧 Rebuilt private key with proper line breaks for Node.js v20');
    }
  }

  // Remove any quotes if the entire key is wrapped in quotes
  if (
    (cleanPrivateKey.startsWith('"') && cleanPrivateKey.endsWith('"')) ||
    (cleanPrivateKey.startsWith("'") && cleanPrivateKey.endsWith("'"))
  ) {
    cleanPrivateKey = cleanPrivateKey.slice(1, -1);
    log('🔧 Removed surrounding quotes from private key');
  }

  // Ensure proper PEM format
  if (!cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    cleanPrivateKey = `-----BEGIN PRIVATE KEY-----\n${cleanPrivateKey}\n-----END PRIVATE KEY-----`;
    log('🔧 Added PEM headers to private key');
  }

  // Clean up any extra whitespace and normalize line endings
  cleanPrivateKey = cleanPrivateKey.trim().replace(/\r\n/g, '\n');

  // Ensure proper line breaks in PEM format (64-char body lines)
  const lines = cleanPrivateKey.split('\n');
  const properLines: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (
      line === '-----BEGIN PRIVATE KEY-----' ||
      line === '-----END PRIVATE KEY-----'
    ) {
      properLines.push(line);
    } else if (line.length > 0) {
      while (line.length > 64) {
        properLines.push(line.substring(0, 64));
        line = line.substring(64);
      }
      if (line.length > 0) {
        properLines.push(line);
      }
    }
  }

  return properLines.join('\n');
}
