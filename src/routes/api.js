// src/routes/api.js - API route definitions

const express = require("express");
const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

function createApiRoutes(
  voiceScamShield,
  twilioController,
  dashboardController
) {
  const router = express.Router();

  // Rate limiting middleware
  const createRateLimit = (windowMs, max, message) => {
    return rateLimit({
      windowMs,
      max,
      message: { error: message },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn("Rate limit exceeded", {
          ip: req.ip,
          url: req.originalUrl,
        });
        res.status(429).json({ error: message });
      },
    });
  };

  // General API rate limit (100 requests per 15 minutes)
  const generalLimit = createRateLimit(
    15 * 60 * 1000,
    100,
    "Too many API requests"
  );

  // Webhook rate limit (more lenient for Twilio)
  const webhookLimit = createRateLimit(
    60 * 1000,
    500,
    "Too many webhook requests"
  );

  // Apply general rate limiting to all API routes
  router.use("/api", generalLimit);
  router.use("/webhook", webhookLimit);

  // Health check endpoints (no rate limit)
  router.get("/health", async (req, res) => {
    try {
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "1.0.0",
      };

      res.json(health);
    } catch (error) {
      logger.error("Health check failed:", error);
      res.status(503).json({
        status: "unhealthy",
        error: error.message,
      });
    }
  });

  router.get(
    "/health/system",
    dashboardController.getSystemHealth.bind(dashboardController)
  );
  router.get(
    "/health/twilio",
    twilioController.healthCheck.bind(twilioController)
  );

  // Twilio webhook endpoints
  router.post(
    "/webhook/incoming-call",
    twilioController.handleIncomingCall.bind(twilioController)
  );
  router.post(
    "/webhook/call-status",
    twilioController.handleCallStatus.bind(twilioController)
  );
  router.post(
    "/webhook/recording",
    twilioController.handleRecording.bind(twilioController)
  );

  // Dashboard API endpoints
  router.get(
    "/api/metrics",
    dashboardController.getMetrics.bind(dashboardController)
  );
  router.get(
    "/api/calls/active",
    dashboardController.getActiveCalls.bind(dashboardController)
  );
  router.get(
    "/api/calls/history",
    dashboardController.getCallHistory.bind(dashboardController)
  );
  router.get(
    "/api/calls/:callSid",
    dashboardController.getCallDetails.bind(dashboardController)
  );
  router.get(
    "/api/configuration",
    dashboardController.getConfiguration.bind(dashboardController)
  );
  router.get(
    "/api/analytics",
    dashboardController.getAnalytics.bind(dashboardController)
  );

  // Call management endpoints
  router.post(
    "/api/calls/:callSid/monitor",
    twilioController.startCallMonitoring.bind(twilioController)
  );
  router.post(
    "/api/calls/:callSid/alert",
    twilioController.sendManualAlert.bind(twilioController)
  );
  router.post(
    "/api/calls/:callSid/terminate",
    twilioController.terminateCall.bind(twilioController)
  );
  router.get(
    "/api/calls/:callSid/details",
    twilioController.getCallDetails.bind(twilioController)
  );

  // Voice Scam Shield management endpoints
  router.get("/api/system/status", async (req, res) => {
    try {
      const status = {
        initialized: voiceScamShield.isInitialized,
        activeCalls: voiceScamShield.activeCalls.size,
        metrics: voiceScamShield.getMetrics(),
        timestamp: new Date().toISOString(),
      };

      res.json(status);
    } catch (error) {
      logger.error("Error getting system status:", error);
      res.status(500).json({ error: "Failed to get system status" });
    }
  });

  // Configuration endpoints (read-only for security)
  router.get("/api/config/features", (req, res) => {
    try {
      const features = {
        deepfakeDetection: voiceScamShield.config.enableDeepfakeDetection,
        scamAnalysis: voiceScamShield.config.enableScamAnalysis,
        phoneVerification: voiceScamShield.config.enablePhoneVerification,
        realTimeAlerts: voiceScamShield.config.enableRealTimeAlerts,
        supportedLanguages: voiceScamShield.config.alertLanguages,
      };

      res.json({ features });
    } catch (error) {
      logger.error("Error getting features:", error);
      res.status(500).json({ error: "Failed to get features" });
    }
  });

  router.get("/api/config/thresholds", (req, res) => {
    try {
      const thresholds = {
        deepfake: voiceScamShield.config.deepfakeThreshold,
        scamRisk: voiceScamShield.config.scamRiskThreshold,
        confidence: voiceScamShield.config.confidenceThreshold,
      };

      res.json({ thresholds });
    } catch (error) {
      logger.error("Error getting thresholds:", error);
      res.status(500).json({ error: "Failed to get thresholds" });
    }
  });

  // Statistics and reporting endpoints
  router.get("/api/stats/summary", async (req, res) => {
    try {
      const { period = "24h" } = req.query;

      const summary = {
        metrics: voiceScamShield.getMetrics(),
        analytics: dashboardController.calculateAnalytics(period),
        systemHealth: await dashboardController.getSystemHealth(),
        timestamp: new Date().toISOString(),
      };

      res.json(summary);
    } catch (error) {
      logger.error("Error getting summary stats:", error);
      res.status(500).json({ error: "Failed to get summary statistics" });
    }
  });

  router.get("/api/stats/performance", (req, res) => {
    try {
      const metrics = voiceScamShield.getMetrics();

      const performance = {
        averageResponseTime: metrics.averageResponseTime,
        uptime: metrics.uptime,
        totalCalls: metrics.totalCalls,
        accuracy: metrics.accuracy,
        errorRate: 0, // Could be calculated from error logs
        throughput: metrics.totalCalls / (metrics.uptime / 1000), // calls per second
        timestamp: new Date().toISOString(),
      };

      res.json({ performance });
    } catch (error) {
      logger.error("Error getting performance stats:", error);
      res.status(500).json({ error: "Failed to get performance statistics" });
    }
  });

  // Error handling middleware
  router.use((error, req, res, next) => {
    logger.error("API error:", error);

    if (error.type === "entity.parse.failed") {
      return res.status(400).json({
        error: "Invalid JSON payload",
      });
    }

    if (error.code === "EBADCSRFTOKEN") {
      return res.status(403).json({
        error: "Invalid CSRF token",
      });
    }

    res.status(500).json({
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  });

  // 404 handler for API routes
  router.use("/api/*", (req, res) => {
    logger.warn("API endpoint not found:", req.originalUrl);
    res.status(404).json({
      error: "API endpoint not found",
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

module.exports = createApiRoutes;
