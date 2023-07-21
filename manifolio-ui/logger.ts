export type LogLevel = "debug" | "info" | "warn" | "error";

let logLevel: LogLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL ||
  "info") as LogLevel;

const shouldLog = (level: LogLevel): boolean => {
  const levels = ["debug", "info", "warn", "error"];
  const shouldLog = levels.indexOf(level) >= levels.indexOf(logLevel);
  return shouldLog;
};

const logMessage = (level: LogLevel, ...args: unknown[]): void => {
  if (!shouldLog(level)) return;

  switch (level) {
    case "debug":
      console.log(...args);
      break;
    case "info":
      console.log(...args);
      break;
    case "warn":
      console.warn(...args);
      break;
    case "error":
      console.error(...args);
      break;
  }
};

const logger = {
  debug: (...args: unknown[]) => logMessage("debug", ...args),
  info: (...args: unknown[]) => logMessage("info", ...args),
  warn: (...args: unknown[]) => logMessage("warn", ...args),
  error: (...args: unknown[]) => logMessage("error", ...args),
  setLevel: (level: LogLevel) => {
    logLevel = level;
  },
};

export default logger;
