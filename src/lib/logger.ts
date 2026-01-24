/**
 * Simple logging wrapper around console.
 * Provides consistent formatting with timestamps and a single place
 * to change logging behavior later if needed.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): [string, ...unknown[]] {
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  return [`${prefix} ${message}`, ...args];
}

export const log = {
  debug(message: string, ...args: unknown[]): void {
    console.debug(...formatMessage('debug', message, ...args));
  },

  info(message: string, ...args: unknown[]): void {
    console.info(...formatMessage('info', message, ...args));
  },

  warn(message: string, ...args: unknown[]): void {
    console.warn(...formatMessage('warn', message, ...args));
  },

  error(message: string, ...args: unknown[]): void {
    console.error(...formatMessage('error', message, ...args));
  },
};

export default log;
