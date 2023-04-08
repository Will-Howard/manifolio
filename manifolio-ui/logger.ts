export type LogLevel = "debug" | "info" | "warn" | "error";

const getTimestamp = (): string => {
  return new Date().toISOString();
};

const shouldLog = (level: LogLevel): boolean => {
  const levels = ["debug", "info", "warn", "error"];
  const envLogLevel = process.env.NEXT_PUBLIC_LOG_LEVEL || "info";
  return levels.indexOf(level) >= levels.indexOf(envLogLevel);
};

const logMessage = (level: LogLevel, ...args: unknown[]): void => {
  if (!shouldLog(level)) return;

  const timestamp = getTimestamp();
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
    .join(" ");

  const logString =
    process.env.NODE_ENV === "production"
      ? JSON.stringify({ timestamp, level, message })
      : `${timestamp} [${level}]: ${message}`;

  switch (level) {
    case "debug":
      console.debug(logString);
      break;
    case "info":
      console.info(logString);
      break;
    case "warn":
      console.warn(logString);
      break;
    case "error":
      console.error(logString);
      break;
  }
};

const logger = {
  debug: (...args: unknown[]) => logMessage("debug", ...args),
  info: (...args: unknown[]) => logMessage("info", ...args),
  warn: (...args: unknown[]) => logMessage("warn", ...args),
  error: (...args: unknown[]) => logMessage("error", ...args),
  setLevel: (level: LogLevel) => {
    process.env.NEXT_PUBLIC_LOG_LEVEL = level;
  },
};

export default logger;
