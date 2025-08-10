// src/utils/configValidator.js - Configuration validation utility

const logger = require("./logger");

// Required environment variables for basic functionality
const REQUIRED_CONFIG = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "XI_API_KEY",
  "GROQ_API_KEY",
  "WEBHOOK_BASE_URL",
];

// Optional but recommended environment variables
const RECOMMENDED_CONFIG = [
  "TRUECALLER_API_KEY",
  "NOMOROBO_API_KEY",
  "JWT_SECRET",
  "SESSION_SECRET",
];

// Configuration with default values
const DEFAULT_CONFIG = {
  NODE_ENV: "development",
  PORT: "3000",
  HOST: "localhost",
  LOG_LEVEL: "info",
  DEEPFAKE_THRESHOLD: "0.4",
  SCAM_RISK_THRESHOLD: "0.6",
  CONFIDENCE_THRESHOLD: "0.7",
  ALERT_LANGUAGES: "en,es,fr",
  MAX_CONCURRENT_CALLS: "10",
  RESPONSE_TIMEOUT_MS: "5000",
  ENABLE_DEEPFAKE_DETECTION: "true",
  ENABLE_SCAM_ANALYSIS: "true",
  ENABLE_PHONE_VERIFICATION: "true",
  ENABLE_REAL_TIME_ALERTS: "true",
  ENABLE_DASHBOARD: "true",
  ENABLE_CALL_RECORDING: "false",
  RATE_LIMIT_WINDOW_MS: "900000",
  RATE_LIMIT_MAX_REQUESTS: "100",
  CORS_ORIGIN: "*",
  VALIDATE_WEBHOOK_SIGNATURES: "true",
};

function validateConfig() {
  logger.info("Validating configuration...");

  const errors = [];
  const warnings = [];
  const info = [];

  // Check required configuration
  for (const configKey of REQUIRED_CONFIG) {
    if (!process.env[configKey]) {
      errors.push(`Missing required environment variable: ${configKey}`);
    } else if (
      process.env[configKey].includes("your_") ||
      process.env[configKey].includes("_here")
    ) {
      warnings.push(`${configKey} appears to contain placeholder value`);
    }
  }

  // Check recommended configuration
  for (const configKey of RECOMMENDED_CONFIG) {
    if (!process.env[configKey]) {
      warnings.push(`Missing recommended environment variable: ${configKey}`);
    } else if (
      process.env[configKey].includes("your_") ||
      process.env[configKey].includes("_here")
    ) {
      warnings.push(`${configKey} appears to contain placeholder value`);
    }
  }

  // Set default values for missing optional config
  for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
      info.push(`Set default value for ${key}: ${defaultValue}`);
    }
  }

  // Validate specific configuration values
  validateSpecificConfig(errors, warnings);

  // Log results
  if (errors.length > 0) {
    logger.error("Configuration validation failed:");
    errors.forEach((error) => logger.error(`  - ${error}`));
    throw new Error(`Configuration validation failed: ${errors.join(", ")}`);
  }

  if (warnings.length > 0) {
    logger.warn("Configuration warnings:");
    warnings.forEach((warning) => logger.warn(`  - ${warning}`));
  }

  if (info.length > 0) {
    logger.info("Configuration info:");
    info.forEach((infoMsg) => logger.info(`  - ${infoMsg}`));
  }

  logger.info("Configuration validation completed successfully");
}

function validateSpecificConfig(errors, warnings) {
  // Validate PORT
  const port = parseInt(process.env.PORT);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push("PORT must be a valid port number (1-65535)");
  }

  // Validate thresholds (should be between 0 and 1)
  const thresholds = [
    "DEEPFAKE_THRESHOLD",
    "SCAM_RISK_THRESHOLD",
    "CONFIDENCE_THRESHOLD",
  ];
  for (const threshold of thresholds) {
    const value = parseFloat(process.env[threshold]);
    if (isNaN(value) || value < 0 || value > 1) {
      errors.push(`${threshold} must be a number between 0 and 1`);
    }
  }

  // Validate MAX_CONCURRENT_CALLS
  const maxCalls = parseInt(process.env.MAX_CONCURRENT_CALLS);
  if (isNaN(maxCalls) || maxCalls < 1) {
    errors.push("MAX_CONCURRENT_CALLS must be a positive integer");
  }

  // Validate RESPONSE_TIMEOUT_MS
  const timeout = parseInt(process.env.RESPONSE_TIMEOUT_MS);
  if (isNaN(timeout) || timeout < 1000) {
    warnings.push(
      "RESPONSE_TIMEOUT_MS should be at least 1000ms for reliable operation"
    );
  }

  // Validate ALERT_LANGUAGES
  const languages = process.env.ALERT_LANGUAGES.split(",");
  const validLanguages = ["en", "es", "fr"];
  for (const lang of languages) {
    if (!validLanguages.includes(lang.trim())) {
      warnings.push(
        `Unsupported language in ALERT_LANGUAGES: ${lang}. Supported: ${validLanguages.join(", ")}`
      );
    }
  }

  // Validate boolean environment variables
  const booleanVars = [
    "ENABLE_DEEPFAKE_DETECTION",
    "ENABLE_SCAM_ANALYSIS",
    "ENABLE_PHONE_VERIFICATION",
    "ENABLE_REAL_TIME_ALERTS",
    "ENABLE_DASHBOARD",
    "ENABLE_CALL_RECORDING",
    "VALIDATE_WEBHOOK_SIGNATURES",
  ];

  for (const boolVar of booleanVars) {
    const value = process.env[boolVar];
    if (value !== "true" && value !== "false") {
      warnings.push(`${boolVar} should be 'true' or 'false', got: ${value}`);
    }
  }

  // Validate Twilio phone number format
  if (
    process.env.TWILIO_PHONE_NUMBER &&
    !process.env.TWILIO_PHONE_NUMBER.startsWith("+")
  ) {
    warnings.push(
      "TWILIO_PHONE_NUMBER should include country code (e.g., +1234567890)"
    );
  }

  // Validate webhook URL
  if (process.env.WEBHOOK_BASE_URL) {
    try {
      new URL(process.env.WEBHOOK_BASE_URL);
      if (
        !process.env.WEBHOOK_BASE_URL.startsWith("https://") &&
        process.env.NODE_ENV === "production"
      ) {
        warnings.push("WEBHOOK_BASE_URL should use HTTPS in production");
      }
    } catch (error) {
      errors.push("WEBHOOK_BASE_URL is not a valid URL");
    }
  }

  // Check for development vs production settings
  if (process.env.NODE_ENV === "production") {
    if (process.env.LOG_LEVEL === "debug") {
      warnings.push(
        'Debug logging enabled in production - consider using "info" or "warn"'
      );
    }

    if (process.env.CORS_ORIGIN === "*") {
      warnings.push(
        "CORS is set to allow all origins in production - consider restricting"
      );
    }

    if (process.env.VALIDATE_WEBHOOK_SIGNATURES === "false") {
      warnings.push(
        "Webhook signature validation disabled in production - security risk"
      );
    }
  }
}

function getConfigSummary() {
  return {
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    features: {
      deepfakeDetection: process.env.ENABLE_DEEPFAKE_DETECTION === "true",
      scamAnalysis: process.env.ENABLE_SCAM_ANALYSIS === "true",
      phoneVerification: process.env.ENABLE_PHONE_VERIFICATION === "true",
      realTimeAlerts: process.env.ENABLE_REAL_TIME_ALERTS === "true",
      dashboard: process.env.ENABLE_DASHBOARD === "true",
      callRecording: process.env.ENABLE_CALL_RECORDING === "true",
    },
    thresholds: {
      deepfake: parseFloat(process.env.DEEPFAKE_THRESHOLD),
      scamRisk: parseFloat(process.env.SCAM_RISK_THRESHOLD),
      confidence: parseFloat(process.env.CONFIDENCE_THRESHOLD),
    },
    limits: {
      maxConcurrentCalls: parseInt(process.env.MAX_CONCURRENT_CALLS),
      responseTimeout: parseInt(process.env.RESPONSE_TIMEOUT_MS),
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS),
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS),
    },
    apis: {
      twilio: !!process.env.TWILIO_ACCOUNT_SID,
      elevenLabs: !!process.env.XI_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      truecaller: !!process.env.TRUECALLER_API_KEY,
      nomorobo: !!process.env.NOMOROBO_API_KEY,
    },
    languages: process.env.ALERT_LANGUAGES.split(","),
    webhookUrl: process.env.WEBHOOK_BASE_URL,
  };
}

module.exports = {
  validateConfig,
  getConfigSummary,
  REQUIRED_CONFIG,
  RECOMMENDED_CONFIG,
  DEFAULT_CONFIG,
};
