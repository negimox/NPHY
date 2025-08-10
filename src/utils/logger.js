// src/utils/logger.js - Centralized logging utility

const winston = require("winston");
const path = require("path");

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const logColors = {
  error: "red",
  warn: "yellow",
  info: "green",
  debug: "blue",
};

winston.addColors(logColors);

// Create log directory if it doesn't exist
const logDir = path.join(process.cwd(), "logs");
require("fs").mkdirSync(logDir, { recursive: true });

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = "";
    if (Object.keys(meta).length > 0) {
      metaStr = "\n" + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create transports array
const transports = [
  // Console transport for development
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || "info",
    format: consoleFormat,
    handleExceptions: true,
  }),

  // File transport for all logs
  new winston.transports.File({
    filename: path.join(logDir, "voice-scam-shield.log"),
    level: "debug",
    format: logFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    handleExceptions: true,
  }),

  // Error-only file transport
  new winston.transports.File({
    filename: path.join(logDir, "error.log"),
    level: "error",
    format: logFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    handleExceptions: true,
  }),
];

// Security log transport for incidents
if (process.env.SECURITY_LOG_ENABLED === "true") {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, "security.log"),
      level: "warn",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          // Only log security-related events
          if (message === "SECURITY_INCIDENT" || level === "error") {
            return JSON.stringify({ timestamp, level, message, ...meta });
          }
          return null;
        })
      ),
      maxsize: 10485760,
      maxFiles: 10,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  levels: logLevels,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Handle uncaught exceptions and rejections
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logDir, "exceptions.log"),
    format: logFormat,
  })
);

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Custom methods for structured logging
logger.security = (message, meta = {}) => {
  logger.warn("SECURITY_INCIDENT", {
    type: "security",
    event: message,
    ...meta,
  });
};

logger.performance = (operation, duration, meta = {}) => {
  logger.info("PERFORMANCE_METRIC", {
    type: "performance",
    operation,
    duration,
    ...meta,
  });
};

logger.audit = (action, userId, meta = {}) => {
  logger.info("AUDIT_EVENT", {
    type: "audit",
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...meta,
  });
};

// Request logging middleware
logger.requestMiddleware = (req, res, next) => {
  const start = Date.now();
  const { method, url, ip, headers } = req;

  // Log request
  logger.info("HTTP_REQUEST", {
    method,
    url,
    ip,
    userAgent: headers["user-agent"],
    contentType: headers["content-type"],
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - start;
    const { statusCode } = res;

    logger.info("HTTP_RESPONSE", {
      method,
      url,
      statusCode,
      duration,
      responseSize: body ? body.length : 0,
    });

    return originalSend.call(this, body);
  };

  next();
};

// Stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;
