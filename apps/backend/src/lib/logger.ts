type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function writeLog(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    writeLog('debug', message, context);
  },
  info(message: string, context?: Record<string, unknown>) {
    writeLog('info', message, context);
  },
  warn(message: string, context?: Record<string, unknown>) {
    writeLog('warn', message, context);
  },
  error(message: string, context?: Record<string, unknown>) {
    writeLog('error', message, context);
  },
};

export function traceWorkflowStep(step: string, context?: Record<string, unknown>) {
  logger.debug(`[workflow] ${step}`, context);
}
