export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(event: string, context?: Record<string, unknown>): void;
  info(event: string, context?: Record<string, unknown>): void;
  warn(event: string, context?: Record<string, unknown>): void;
  error(event: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
  entries(): LogEntry[];
}

const ranks: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const secretKey = /authorization|cookie|password|secret|token/i;
const tokenValue = /(X-Plex-Token=)[^&\s]+/gi;
const bearerValue = /(Bearer\s+)[A-Za-z0-9._~+/-]+/gi;

function safeValue(value: unknown, key = '', seen = new WeakSet<object>()): unknown {
  if (secretKey.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return value.replace(tokenValue, '$1[REDACTED]').replace(bearerValue, '$1[REDACTED]');
  if (value instanceof Error)
    return safeValue(
      { name: value.name, message: value.message, code: (value as Error & { code?: string }).code, stack: value.stack },
      key,
      seen,
    );
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => safeValue(item, key, seen));
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 100)
      .map(([childKey, childValue]) => [childKey, safeValue(childValue, childKey, seen)]),
  );
}

export function createLogger(
  options: {
    level?: string;
    capacity?: number;
    sink?: (entry: LogEntry) => void;
    base?: Record<string, unknown>;
    sharedEntries?: LogEntry[];
  } = {},
): Logger {
  const configuredLevel = (options.level || 'info').toLowerCase() as LogLevel;
  const minimum = ranks[configuredLevel] ?? ranks.info;
  const capacity = Math.max(50, options.capacity || 500);
  const history = options.sharedEntries || [];
  const base = options.base || {};
  const sink =
    options.sink ||
    ((entry: LogEntry) => {
      const output = JSON.stringify(entry);
      if (entry.level === 'error') console.error(output);
      else if (entry.level === 'warn') console.warn(output);
      else console.log(output);
    });

  function write(level: LogLevel, event: string, context: Record<string, unknown> = {}) {
    if (ranks[level] < minimum) return;
    const entry = safeValue({ timestamp: new Date().toISOString(), level, event, ...base, ...context }, '') as LogEntry;
    history.push(entry);
    if (history.length > capacity) history.splice(0, history.length - capacity);
    sink(entry);
  }

  return {
    debug: (event, context) => write('debug', event, context),
    info: (event, context) => write('info', event, context),
    warn: (event, context) => write('warn', event, context),
    error: (event, context) => write('error', event, context),
    child: (context) =>
      createLogger({
        ...options,
        level: configuredLevel,
        capacity,
        base: { ...base, ...context },
        sharedEntries: history,
        sink,
      }),
    entries: () => history.map((entry) => ({ ...entry })),
  };
}
