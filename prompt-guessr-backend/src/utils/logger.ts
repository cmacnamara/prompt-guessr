/**
 * Simple logger utility with timestamps.
 * Can be upgraded to Winston, Pino, or other logging libraries later.
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/**
 * Format a log message with timestamp and level.
 */
function formatMessage(level: LogLevel, message: string, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

/**
 * Logger object with standard logging methods.
 */
export const logger = {
  /**
   * Log informational messages.
   */
  info(message: string, ...args: any[]): void {
    console.log(formatMessage('INFO', message), ...args);
  },

  /**
   * Log warning messages.
   */
  warn(message: string, ...args: any[]): void {
    console.warn(formatMessage('WARN', message), ...args);
  },

  /**
   * Log error messages.
   */
  error(message: string, ...args: any[]): void {
    console.error(formatMessage('ERROR', message), ...args);
  },

  /**
   * Log debug messages (only in development).
   */
  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage('DEBUG', message), ...args);
    }
  },
};
