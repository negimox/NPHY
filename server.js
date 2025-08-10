// server.js - Main Voice Scam Shield MVP Server
// Twilio Voice API integration with NPHY detection engine

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

// Import components
const TwilioController = require("./src/controllers/TwilioController");
const VoiceScamShield = require("./src/core/VoiceScamShield");
const DashboardController = require("./src/controllers/DashboardController");
const HealthController = require("./src/controllers/HealthController");
const logger = require("./src/utils/logger");
const { validateConfig } = require("./src/utils/configValidator");

class VoiceScamShieldServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
      },
    });

    this.port = process.env.PORT || 3000;
    this.isInitialized = false;

    // Initialize core components
    this.voiceScamShield = new VoiceScamShield({
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
      elevenLabsApiKey: process.env.XI_API_KEY,
      groqApiKey: process.env.GROQ_API_KEY,
      webhookBaseUrl: process.env.WEBHOOK_BASE_URL,
      forwardTo: process.env.FORWARD_TO_NUMBER,
      maxRecordingLength: parseInt(process.env.MAX_RECORDING_LENGTH) || 300,
      enableCallRecording: process.env.ENABLE_CALL_RECORDING === "true",
      deepfakeThreshold: parseFloat(process.env.DEEPFAKE_THRESHOLD) || 0.4,
      scamRiskThreshold: parseFloat(process.env.SCAM_RISK_THRESHOLD) || 0.6,
      alertLanguages: (process.env.ALERT_LANGUAGES || "en,es,fr").split(","),
      enableDeepfakeDetection: process.env.ENABLE_DEEPFAKE_DETECTION === "true",
      enableScamAnalysis: process.env.ENABLE_SCAM_ANALYSIS === "true",
      enablePhoneVerification: process.env.ENABLE_PHONE_VERIFICATION === "true",
      maxConcurrentCalls: parseInt(process.env.MAX_CONCURRENT_CALLS) || 10,
    });

    this.twilioController = new TwilioController(this.voiceScamShield, this.io);
    this.dashboardController = new DashboardController(
      this.voiceScamShield,
      this.io
    );
    this.healthController = new HealthController(this.voiceScamShield);
  }

  async initialize() {
    try {
      logger.info("Initializing Voice Scam Shield MVP Server...");

      // Validate configuration
      validateConfig();

      // Initialize middleware
      this.setupMiddleware();

      // Initialize routes
      this.setupRoutes();

      // Initialize Socket.IO
      this.setupSocketIO();

      // Initialize Voice Scam Shield core
      await this.voiceScamShield.initialize();

      // Setup error handling
      this.setupErrorHandling();

      this.isInitialized = true;
      logger.info("Voice Scam Shield MVP Server initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize server:", error);
      throw error;
    }
  }

  setupMiddleware() {
    // Trust proxy for rate limiting with ngrok/reverse proxies
    this.app.set(
      "trust proxy",
      process.env.NODE_ENV === "production" ? 1 : true
    );

    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN || "*",
        credentials: true,
      })
    );

    // Compression
    this.app.use(compression());

    // Request logging
    this.app.use(
      morgan("combined", {
        stream: { write: (message) => logger.info(message.trim()) },
      })
    );

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      message: "Too many requests from this IP, please try again later.",
      // Skip rate limiting for development with ngrok
      skip: (req) =>
        process.env.NODE_ENV === "development" &&
        req.get("User-Agent")?.includes("PowerShell"),
      // Use a more permissive key generator for development
      keyGenerator: (req) => {
        if (process.env.NODE_ENV === "development") {
          return req.ip || req.connection.remoteAddress || "unknown";
        }
        return req.ip;
      },
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Static files for dashboard
    this.app.use("/static", express.static(path.join(__dirname, "public")));
  }

  setupRoutes() {
    logger.info("Setting up routes...");

    // Debug controller initialization
    console.log("Controllers status:", {
      twilioController: !!this.twilioController,
      healthController: !!this.healthController,
      dashboardController: !!this.dashboardController,
      healthControllerType: typeof this.healthController,
      healthCheckMethod: this.healthController
        ? typeof this.healthController.checkHealth
        : "N/A",
    });

    // Health check routes
    this.app.get(
      "/health",
      this.healthController.checkHealth.bind(this.healthController)
    );
    this.app.get(
      "/health/models",
      this.healthController.checkModels.bind(this.healthController)
    );
    this.app.get(
      "/health/detailed",
      this.healthController.detailedHealth.bind(this.healthController)
    );

    // Twilio webhook routes
    this.app.post(
      "/webhook/voice",
      this.twilioController.handleIncomingCall.bind(this.twilioController)
    );
    this.app.post(
      "/webhook/status",
      this.twilioController.handleCallStatus.bind(this.twilioController)
    );
    this.app.post(
      "/webhook/recording",
      this.twilioController.handleRecording.bind(this.twilioController)
    );
    this.app.post(
      "/webhook/transcription",
      this.twilioController.handleTranscription.bind(this.twilioController)
    );

    // API routes for manual analysis
    this.app.post(
      "/api/analyze-call",
      this.twilioController.analyzeCall.bind(this.twilioController)
    );
    this.app.post(
      "/api/analyze-audio",
      this.twilioController.analyzeAudio.bind(this.twilioController)
    );
    this.app.get(
      "/api/calls",
      this.twilioController.getCallHistory.bind(this.twilioController)
    );
    this.app.get(
      "/api/calls/:callSid",
      this.twilioController.getCallDetails.bind(this.twilioController)
    );
    this.app.get(
      "/api/alerts",
      this.twilioController.getAlerts.bind(this.twilioController)
    );

    // Dashboard routes
    if (process.env.ENABLE_DASHBOARD === "true") {
      this.app.get(
        "/dashboard",
        this.dashboardController.renderDashboard.bind(this.dashboardController)
      );
      this.app.get(
        "/dashboard/data",
        this.dashboardController.getDashboardData.bind(this.dashboardController)
      );
      this.app.get(
        "/dashboard/metrics",
        this.dashboardController.getMetrics.bind(this.dashboardController)
      );
    }

    // Demo routes for testing
    if (
      process.env.NODE_ENV === "development" ||
      process.env.DEMO_MODE === "true"
    ) {
      this.app.post(
        "/demo/scam-call",
        this.twilioController.demoScamCall.bind(this.twilioController)
      );
      this.app.post(
        "/demo/legitimate-call",
        this.twilioController.demoLegitimateCall.bind(this.twilioController)
      );
    }

    // Root route
    this.app.get("/", (req, res) => {
      res.json({
        name: "Voice Scam Shield MVP",
        version: "1.0.0",
        status: "active",
        endpoints: {
          health: "/health",
          dashboard: "/dashboard",
          webhooks: {
            voice: "/webhook/voice",
            status: "/webhook/status",
            recording: "/webhook/recording",
          },
          api: {
            analyzeCall: "/api/analyze-call",
            callHistory: "/api/calls",
            alerts: "/api/alerts",
          },
        },
        documentation: "https://github.com/your-org/voice-scam-shield-mvp",
        timestamp: new Date().toISOString(),
      });
    });

    logger.info("Routes configured successfully");
  }

  setupSocketIO() {
    logger.info("Setting up Socket.IO for real-time updates...");

    this.io.on("connection", (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Handle dashboard subscription
      socket.on("subscribe-dashboard", () => {
        socket.join("dashboard");
        logger.info(`Client ${socket.id} subscribed to dashboard updates`);
      });

      // Handle call monitoring subscription
      socket.on("subscribe-call", (callSid) => {
        socket.join(`call-${callSid}`);
        logger.info(`Client ${socket.id} subscribed to call ${callSid}`);
      });

      // Handle alerts from scam-audio-simulator
      socket.on("alert-generated", (alertData) => {
        logger.info(`Alert received from ${socket.id}: ${alertData.title}`);
        // Broadcast to all dashboard clients
        this.io.to("dashboard").emit("alert-generated", alertData);
        // Also broadcast dashboard update
        this.io.to("dashboard").emit("dashboard-update", {
          type: "alert",
          data: alertData,
          timestamp: new Date().toISOString(),
        });
      });

      // Handle call updates
      socket.on("call-update", (callData) => {
        logger.info(
          `Call update from ${socket.id}: ${callData.from} - ${callData.status}`
        );
        // Broadcast to dashboard clients
        this.io.to("dashboard").emit("call-update", callData);
      });

      socket.on("disconnect", () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });

    // Expose io for other components
    this.voiceScamShield.setSocketIO(this.io);
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: "Endpoint not found",
        message: `The endpoint ${req.method} ${req.path} does not exist.`,
        timestamp: new Date().toISOString(),
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error("Unhandled error:", error);

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === "development";

      res.status(error.status || 500).json({
        error: isDevelopment ? error.message : "Internal server error",
        ...(isDevelopment && { stack: error.stack }),
        timestamp: new Date().toISOString(),
      });
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      this.shutdown(1);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
      this.shutdown(1);
    });

    // Graceful shutdown
    process.on("SIGTERM", () => this.shutdown(0));
    process.on("SIGINT", () => this.shutdown(0));
  }

  async start() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      this.server.listen(this.port, () => {
        logger.info(
          `Voice Scam Shield MVP Server running on port ${this.port}`
        );
        logger.info(
          `Dashboard available at: http://localhost:${this.port}/dashboard`
        );
        logger.info(`Health check at: http://localhost:${this.port}/health`);
        logger.info(`Webhook base URL: ${process.env.WEBHOOK_BASE_URL}`);

        // Log configuration status
        logger.info("Configuration:");
        logger.info(
          `- Deepfake Detection: ${process.env.ENABLE_DEEPFAKE_DETECTION === "true" ? "ON" : "OFF"}`
        );
        logger.info(
          `- Scam Analysis: ${process.env.ENABLE_SCAM_ANALYSIS === "true" ? "ON" : "OFF"}`
        );
        logger.info(
          `- Phone Verification: ${process.env.ENABLE_PHONE_VERIFICATION === "true" ? "ON" : "OFF"}`
        );
        logger.info(
          `- Alert Languages: ${process.env.ALERT_LANGUAGES || "en,es,fr"}`
        );
        logger.info(
          `- Max Concurrent Calls: ${process.env.MAX_CONCURRENT_CALLS || 10}`
        );
      });
    } catch (error) {
      logger.error("Failed to start server:", error);
      process.exit(1);
    }
  }

  async shutdown(exitCode = 0) {
    logger.info("Shutting down Voice Scam Shield MVP Server...");

    try {
      // Close server
      this.server.close(() => {
        logger.info("HTTP server closed");
      });

      // Shutdown Voice Scam Shield
      if (this.voiceScamShield) {
        await this.voiceScamShield.shutdown();
      }

      logger.info("Shutdown complete");
      process.exit(exitCode);
    } catch (error) {
      logger.error("Error during shutdown:", error);
      process.exit(1);
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new VoiceScamShieldServer();
  server.start().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}

module.exports = VoiceScamShieldServer;
