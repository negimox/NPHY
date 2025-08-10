// src/controllers/HealthController.js - Health check and system monitoring controller

const logger = require("../utils/logger");

class HealthController {
  constructor(voiceScamShield) {
    this.voiceScamShield = voiceScamShield;
  }

  // Basic health check
  async checkHealth(req, res) {
    try {
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
      };

      // Check if Voice Scam Shield is initialized
      if (this.voiceScamShield && this.voiceScamShield.isInitialized) {
        health.voiceScamShield = "initialized";
      } else {
        health.voiceScamShield = "not_initialized";
        health.status = "degraded";
      }

      const statusCode = health.status === "healthy" ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error("Health check failed:", error);
      res.status(503).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Detailed health check including models
  async checkModels(req, res) {
    try {
      const modelHealth = {
        status: "checking",
        timestamp: new Date().toISOString(),
        models: {},
      };

      if (!this.voiceScamShield || !this.voiceScamShield.isInitialized) {
        return res.status(503).json({
          status: "unhealthy",
          error: "Voice Scam Shield not initialized",
          timestamp: new Date().toISOString(),
        });
      }

      // Check NPHY models
      try {
        // Check deepfake detector
        if (this.voiceScamShield.config.enableDeepfakeDetection) {
          modelHealth.models.deepfakeDetector = {
            enabled: true,
            status: this.voiceScamShield.deepfakeDetector
              ? "ready"
              : "not_loaded",
            threshold: this.voiceScamShield.config.deepfakeThreshold,
          };
        } else {
          modelHealth.models.deepfakeDetector = {
            enabled: false,
            status: "disabled",
          };
        }

        // Check scam analyzer
        if (this.voiceScamShield.config.enableScamAnalysis) {
          modelHealth.models.scamAnalyzer = {
            enabled: true,
            status: this.voiceScamShield.scamAnalyzer ? "ready" : "not_loaded",
          };
        } else {
          modelHealth.models.scamAnalyzer = {
            enabled: false,
            status: "disabled",
          };
        }

        // Check audio processor
        modelHealth.models.audioProcessor = {
          enabled: true,
          status: this.voiceScamShield.audioProcessor ? "ready" : "not_loaded",
        };

        // Check alert system
        modelHealth.models.alertSystem = {
          enabled: this.voiceScamShield.config.enableRealTimeAlerts,
          status: this.voiceScamShield.alertSystem ? "ready" : "not_loaded",
          languages: this.voiceScamShield.config.alertLanguages,
        };

        modelHealth.status = "healthy";
      } catch (error) {
        logger.error("Model health check failed:", error);
        modelHealth.status = "unhealthy";
        modelHealth.error = error.message;
      }

      const statusCode = modelHealth.status === "healthy" ? 200 : 503;
      res.status(statusCode).json(modelHealth);
    } catch (error) {
      logger.error("Model health check failed:", error);
      res.status(503).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Comprehensive health check
  async detailedHealth(req, res) {
    try {
      const detailedHealth = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version,
          platform: process.platform,
        },
        application: {
          name: "Voice Scam Shield MVP",
          version: process.env.npm_package_version || "1.0.0",
          environment: process.env.NODE_ENV || "development",
        },
        services: {},
        configuration: {},
      };

      // Check Voice Scam Shield service
      if (this.voiceScamShield) {
        detailedHealth.services.voiceScamShield = {
          initialized: this.voiceScamShield.isInitialized,
          activeCalls: this.voiceScamShield.activeCalls
            ? this.voiceScamShield.activeCalls.size
            : 0,
          metrics: this.voiceScamShield.isInitialized
            ? this.voiceScamShield.getMetrics()
            : null,
        };
      }

      // Configuration status
      detailedHealth.configuration = {
        features: {
          deepfakeDetection: process.env.ENABLE_DEEPFAKE_DETECTION === "true",
          scamAnalysis: process.env.ENABLE_SCAM_ANALYSIS === "true",
          phoneVerification: process.env.ENABLE_PHONE_VERIFICATION === "true",
          realTimeAlerts: process.env.ENABLE_REAL_TIME_ALERTS === "true",
          dashboard: process.env.ENABLE_DASHBOARD === "true",
        },
        twilio: {
          configured: !!(
            process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
          ),
          webhookBaseUrl: process.env.WEBHOOK_BASE_URL || "not_configured",
        },
        apis: {
          elevenLabs: !!process.env.XI_API_KEY,
          groq: !!process.env.GROQ_API_KEY,
          truecaller: !!process.env.TRUECALLER_API_KEY,
          nomorobo: !!process.env.NOMOROBO_API_KEY,
        },
      };

      // Determine overall status
      const hasBasicConfig =
        detailedHealth.configuration.twilio.configured &&
        detailedHealth.configuration.apis.groq &&
        detailedHealth.configuration.apis.elevenLabs;

      if (!hasBasicConfig) {
        detailedHealth.status = "degraded";
        detailedHealth.warnings = ["Missing required API configurations"];
      }

      if (!this.voiceScamShield || !this.voiceScamShield.isInitialized) {
        detailedHealth.status = "unhealthy";
        detailedHealth.errors = ["Voice Scam Shield not initialized"];
      }

      const statusCode =
        detailedHealth.status === "healthy"
          ? 200
          : detailedHealth.status === "degraded"
            ? 200
            : 503;

      res.status(statusCode).json(detailedHealth);
    } catch (error) {
      logger.error("Detailed health check failed:", error);
      res.status(503).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Health check for external dependencies
  async checkDependencies(req, res) {
    try {
      const dependencies = {
        status: "checking",
        timestamp: new Date().toISOString(),
        services: {},
      };

      // Check Twilio connection
      if (this.voiceScamShield && this.voiceScamShield.twilioClient) {
        try {
          await this.voiceScamShield.testTwilioConnection();
          dependencies.services.twilio = {
            status: "healthy",
            accountSid: process.env.TWILIO_ACCOUNT_SID
              ? process.env.TWILIO_ACCOUNT_SID.substring(0, 10) + "..."
              : "not_configured",
          };
        } catch (error) {
          dependencies.services.twilio = {
            status: "unhealthy",
            error: error.message,
          };
        }
      } else {
        dependencies.services.twilio = {
          status: "not_initialized",
        };
      }

      // Check if NPHY models are accessible
      dependencies.services.nphyModels = {
        status: "unknown",
        path: process.env.NPHY_MODEL_PATH || "./NPHY/models",
      };

      // Overall dependency status
      const serviceStatuses = Object.values(dependencies.services).map(
        (s) => s.status
      );
      if (serviceStatuses.includes("unhealthy")) {
        dependencies.status = "unhealthy";
      } else if (serviceStatuses.includes("not_initialized")) {
        dependencies.status = "degraded";
      } else {
        dependencies.status = "healthy";
      }

      const statusCode = dependencies.status === "healthy" ? 200 : 503;
      res.status(statusCode).json(dependencies);
    } catch (error) {
      logger.error("Dependency health check failed:", error);
      res.status(503).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

module.exports = HealthController;
