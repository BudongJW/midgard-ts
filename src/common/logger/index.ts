/**
 * MidgardTS Logger
 * Inspired by rAthena's ShowMessage system
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  STATUS = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.STATUS]: 'STATUS',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: '\x1b[90m',
  [LogLevel.INFO]: '\x1b[37m',
  [LogLevel.STATUS]: '\x1b[32m',
  [LogLevel.WARN]: '\x1b[33m',
  [LogLevel.ERROR]: '\x1b[31m',
  [LogLevel.FATAL]: '\x1b[35m',
};

const RESET = '\x1b[0m';

let currentLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().slice(11, 23);
}

function log(level: LogLevel, tag: string, message: string): void {
  if (level < currentLevel) return;
  const color = LEVEL_COLORS[level];
  const label = LEVEL_LABELS[level].padEnd(6);
  console.log(`${color}[${formatTimestamp()}][${label}][${tag}]${RESET} ${message}`);
}

export function createLogger(tag: string) {
  return {
    debug: (msg: string) => log(LogLevel.DEBUG, tag, msg),
    info: (msg: string) => log(LogLevel.INFO, tag, msg),
    status: (msg: string) => log(LogLevel.STATUS, tag, msg),
    warn: (msg: string) => log(LogLevel.WARN, tag, msg),
    error: (msg: string) => log(LogLevel.ERROR, tag, msg),
    fatal: (msg: string) => log(LogLevel.FATAL, tag, msg),
  };
}
