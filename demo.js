// demo.js - Complete demo script showcasing Voice Scam Shield capabilities

const VoiceScamShield = require("./src/core/VoiceScamShield");
const logger = require("./src/utils/logger");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

// Load configuration
require("dotenv").config();

class VoiceScamShieldDemo {
  constructor() {
    this.config = {
      // Twilio configuration (use test credentials for demo)
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "demo_account_sid",
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "demo_auth_token",
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "+1234567890",
      webhookBaseUrl: process.env.WEBHOOK_BASE_URL || "http://localhost:3000",

      // API keys (use demo keys for testing)
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "demo_elevenlabs_key",
      groqApiKey: process.env.GROQ_API_KEY || "demo_groq_key",
      truecallerApiKey: process.env.TRUECALLER_API_KEY || "demo_truecaller_key",
      nomoroboApiKey: process.env.NOMOROBO_API_KEY || "demo_nomorobo_key",

      // Detection thresholds optimized for demo
      deepfakeThreshold: 0.4,
      scamRiskThreshold: 0.6,
      confidenceThreshold: 0.7,

      // Enable all features for demo
      enableDeepfakeDetection: true,
      enableScamAnalysis: true,
      enablePhoneVerification: true,
      enableRealTimeAlerts: true,

      // Multilingual support
      alertLanguages: ["en", "es", "fr"],
      primaryLanguage: "en",

      // Demo-specific settings
      demoMode: true,
      generateMockCalls: true,
      mockCallInterval: 30000, // 30 seconds
      maxConcurrentCalls: 5,
    };

    this.demoData = {
      scamScenarios: [
        {
          from: "+1555123456",
          scenario: "IRS Tax Scam",
          transcript:
            "This is the Internal Revenue Service. Your tax return has been flagged for fraudulent activity. You must call back immediately or face arrest.",
          riskLevel: "HIGH",
          detectionType: "content_analysis",
        },
        {
          from: "+1555987654",
          scenario: "Tech Support Scam",
          transcript:
            "Hello, this is Microsoft technical support. We have detected a virus on your computer and need remote access to fix it.",
          riskLevel: "MEDIUM",
          detectionType: "content_analysis",
        },
        {
          from: "+1555555555",
          scenario: "Deepfake Voice",
          transcript:
            "Hi, this is your grandson. I'm in trouble and need money urgently.",
          riskLevel: "CRITICAL",
          detectionType: "deepfake_detection",
        },
        {
          from: "+1555666777",
          scenario: "Banking Fraud",
          transcript:
            "This is your bank security department. We need to verify your account information due to suspicious activity.",
          riskLevel: "HIGH",
          detectionType: "content_analysis",
        },
        {
          from: "+1555111222",
          scenario: "Prize Scam",
          transcript:
            "Congratulations! You have won $10,000 in our lottery. To claim your prize, please provide your social security number.",
          riskLevel: "MEDIUM",
          detectionType: "content_analysis",
        },
      ],
      legitimateCalls: [
        {
          from: "+1555888999",
          scenario: "Legitimate Business",
          transcript:
            "Hello, this is Sarah from ABC Marketing. I wanted to follow up on your recent inquiry about our services.",
          riskLevel: "SAFE",
          detectionType: "none",
        },
        {
          from: "+1555444333",
          scenario: "Doctor's Office",
          transcript:
            "This is Dr. Smith's office calling to confirm your appointment tomorrow at 2 PM.",
          riskLevel: "SAFE",
          detectionType: "none",
        },
      ],
    };

    this.mockCallCounter = 0;
    this.isRunning = false;
  }

  async startDemo() {
    logger.info("🚀 Starting Voice Scam Shield Demo...");

    try {
      // Initialize Voice Scam Shield
      this.voiceScamShield = new VoiceScamShield(this.config);

      // Override methods for demo mode
      this.setupDemoOverrides();

      await this.voiceScamShield.initialize();
      logger.info("✅ Voice Scam Shield initialized successfully");

      // Start web server for dashboard
      await this.startWebServer();

      // Start mock call generation
      if (this.config.generateMockCalls) {
        this.startMockCallGeneration();
      }

      logger.info("🎯 Demo is now running!");
      logger.info("📊 Dashboard: http://localhost:3000/dashboard");
      logger.info("🔗 API Health: http://localhost:3000/health");
      logger.info(
        "📱 Webhook Endpoint: http://localhost:3000/webhook/incoming-call"
      );
    } catch (error) {
      logger.error("❌ Demo startup failed:", error);
      process.exit(1);
    }
  }

  setupDemoOverrides() {
    // Override Twilio client methods for demo
    this.voiceScamShield.twilioClient = {
      api: {
        accounts: () => ({
          fetch: async () => ({
            friendlyName: "Voice Scam Shield Demo Account",
          }),
        }),
      },
      calls: (callSid) => ({
        recordings: {
          create: async (options) => ({
            sid: `demo_recording_${Date.now()}`,
          }),
        },
        update: async (options) => {
          logger.info(`📢 Alert sent to call ${callSid}: ${options.twiml}`);
          return { status: "completed" };
        },
      }),
    };

    // Override audio download for demo
    this.voiceScamShield.downloadAudio = async (url) => {
      logger.info(`🎵 Simulating audio download from: ${url}`);
      return Buffer.from("demo_audio_data");
    };

    // Override audio processing for demo
    this.voiceScamShield.audioProcessor.processAudioBuffer = async (buffer) => {
      return [
        {
          buffer: buffer,
          path: "demo_audio.wav",
          duration: 30000,
        },
      ];
    };

    this.voiceScamShield.audioProcessor.transcribeAudio = async (buffer) => {
      // Return demo transcript based on current scenario
      const scenario = this.getCurrentScenario();
      return { text: scenario.transcript };
    };
  }

  async startWebServer() {
    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server);

    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static("src/public"));

    // Set up Socket.IO for real-time updates
    this.voiceScamShield.setSocketIO(io);

    // Import and setup controllers
    const TwilioController = require("./src/controllers/TwilioController");
    const DashboardController = require("./src/controllers/DashboardController");
    const createApiRoutes = require("./src/routes/api");

    const twilioController = new TwilioController(
      this.voiceScamShield,
      this.config
    );
    const dashboardController = new DashboardController(
      this.voiceScamShield,
      this.config
    );

    // Setup routes
    app.use(
      createApiRoutes(
        this.voiceScamShield,
        twilioController,
        dashboardController
      )
    );

    // Dashboard route
    app.get("/dashboard", (req, res) => {
      res.sendFile(path.join(__dirname, "src/public/dashboard.html"));
    });

    // Socket.IO connection handling
    io.on("connection", (socket) => {
      dashboardController.handleWebSocketConnection(socket);
    });

    // Start server
    const PORT = process.env.PORT || 3000;
    await new Promise((resolve) => {
      server.listen(PORT, () => {
        logger.info(`🌐 Web server started on port ${PORT}`);
        resolve();
      });
    });

    this.server = server;
    this.io = io;
  }

  startMockCallGeneration() {
    logger.info("🎭 Starting mock call generation...");

    this.mockCallTimer = setInterval(() => {
      this.generateMockCall();
    }, this.config.mockCallInterval);

    // Generate initial call immediately
    setTimeout(() => this.generateMockCall(), 2000);
  }

  async generateMockCall() {
    if (
      this.voiceScamShield.activeCalls.size >= this.config.maxConcurrentCalls
    ) {
      logger.debug(
        "Skipping mock call generation - max concurrent calls reached"
      );
      return;
    }

    const callSid = `demo_call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const scenario = this.getRandomScenario();

    logger.info(`📞 Generating mock call: ${scenario.scenario}`);

    try {
      // Simulate incoming call
      const callSession = await this.voiceScamShield.handleIncomingCall(
        callSid,
        scenario.from,
        "+1555000000", // Demo destination
        "in-progress"
      );

      // Simulate phone verification
      const phoneVerification = this.generatePhoneVerification(scenario);
      callSession.setPhoneVerification(phoneVerification);

      // Simulate recording after a short delay
      setTimeout(async () => {
        const recordingUrl = `https://demo.twilio.com/recordings/${callSid}.mp3`;
        await this.simulateRecordingAnalysis(callSid, recordingUrl, scenario);
      }, 3000);

      // Simulate call completion after analysis
      setTimeout(() => {
        callSession.setStatus("completed");
        this.voiceScamShield.activeCalls.delete(callSid);
        this.voiceScamShield.emit("callCompleted", callSession);
        this.voiceScamShield.emitRealtimeUpdate(
          "callCompleted",
          callSession.getPublicData()
        );
      }, 8000);
    } catch (error) {
      logger.error("Error generating mock call:", error);
    }
  }

  async simulateRecordingAnalysis(callSid, recordingUrl, scenario) {
    logger.info(`🔍 Analyzing mock recording for call: ${callSid}`);

    // Create mock detection results based on scenario
    const detectionResults = {
      deepfake: this.generateDeepfakeResult(scenario),
      scamContent: this.generateContentResult(scenario),
      phoneVerification: this.generatePhoneVerification(scenario),
    };

    // Process through the actual analysis pipeline
    const callSession = this.voiceScamShield.getActiveCall(callSid);
    if (callSession) {
      callSession.addAnalysisResult(detectionResults);

      // Calculate risk assessment
      const riskAssessment = this.voiceScamShield.riskAssessment.calculateRisk(
        detectionResults,
        callSession
      );

      if (riskAssessment.level !== "SAFE") {
        await this.voiceScamShield.handleScamDetection(
          callSession,
          riskAssessment
        );
      }

      this.voiceScamShield.emit(
        "analysisComplete",
        callSession,
        detectionResults
      );
      this.voiceScamShield.emitRealtimeUpdate("analysisComplete", {
        callSid,
        results: detectionResults,
        responseTime: 1500, // Simulated response time
      });
    }
  }

  getRandomScenario() {
    const allScenarios = [
      ...this.demoData.scamScenarios,
      ...this.demoData.legitimateCalls,
    ];

    // Weight towards scam scenarios for demo purposes (70% scam, 30% legitimate)
    const random = Math.random();
    if (random < 0.7 && this.demoData.scamScenarios.length > 0) {
      return this.demoData.scamScenarios[
        Math.floor(Math.random() * this.demoData.scamScenarios.length)
      ];
    } else {
      return this.demoData.legitimateCalls[
        Math.floor(Math.random() * this.demoData.legitimateCalls.length)
      ];
    }
  }

  getCurrentScenario() {
    // Return the last generated scenario for audio processing
    return this.lastScenario || this.demoData.scamScenarios[0];
  }

  generateDeepfakeResult(scenario) {
    const isDeepfake = scenario.detectionType === "deepfake_detection";
    return {
      isSynthetic: isDeepfake,
      confidence: isDeepfake ? 0.85 + Math.random() * 0.1 : Math.random() * 0.3,
      method: isDeepfake ? "AASIST" : "none",
      positiveDetections: isDeepfake ? 3 : 0,
      totalChunks: 4,
    };
  }

  generateContentResult(scenario) {
    const isScam = scenario.detectionType === "content_analysis";
    return {
      isScam: isScam,
      confidence: isScam ? 0.8 + Math.random() * 0.15 : Math.random() * 0.4,
      riskLevel: scenario.riskLevel,
      transcript: scenario.transcript,
      patterns: isScam ? ["urgency", "personal_info_request"] : [],
      reasoning: isScam
        ? "Multiple scam indicators detected in transcript"
        : "No significant risk indicators found",
    };
  }

  generatePhoneVerification(scenario) {
    const isKnownScammer = scenario.riskLevel !== "SAFE" && Math.random() > 0.5;
    return {
      isScammer: isKnownScammer,
      confidence: isKnownScammer
        ? 0.7 + Math.random() * 0.25
        : Math.random() * 0.3,
      source: isKnownScammer ? "truecaller" : "none",
      reportCount: isKnownScammer ? Math.floor(Math.random() * 50) + 5 : 0,
      details: isKnownScammer
        ? "Reported for fraudulent activity"
        : "No reports found",
    };
  }

  async simulateDemoScenarios() {
    logger.info("🎬 Running demo scenarios...");

    for (const scenario of this.demoData.scamScenarios) {
      logger.info(`📋 Demo Scenario: ${scenario.scenario}`);

      // Generate call for this specific scenario
      this.lastScenario = scenario;
      await this.generateMockCall();

      // Wait between scenarios
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    logger.info("✨ Demo scenarios completed");
  }

  printDemoInstructions() {
    console.log("\n" + "=".repeat(60));
    console.log("🛡️  VOICE SCAM SHIELD - DEMO MODE");
    console.log("=".repeat(60));
    console.log("");
    console.log("📊 Real-time Dashboard: http://localhost:3000/dashboard");
    console.log("🔗 API Documentation: http://localhost:3000/health");
    console.log("");
    console.log("🎭 Demo Features:");
    console.log("  • Automatic mock call generation every 30 seconds");
    console.log("  • Simulated scam detection scenarios");
    console.log("  • Real-time dashboard updates");
    console.log("  • Multilingual alert system");
    console.log("  • Performance metrics tracking");
    console.log("");
    console.log("🔧 Demo Commands:");
    console.log("  • Press Ctrl+C to stop the demo");
    console.log("  • Check console for real-time detection logs");
    console.log("  • Monitor dashboard for visual analytics");
    console.log("");
    console.log("📱 Test Webhook (simulate Twilio):");
    console.log(
      "  curl -X POST http://localhost:3000/webhook/incoming-call \\"
    );
    console.log(
      '    -d "CallSid=test123&From=%2B1555123456&To=%2B1555000000&CallStatus=ringing"'
    );
    console.log("");
    console.log("=".repeat(60));
    console.log("");
  }

  async stopDemo() {
    logger.info("🛑 Stopping Voice Scam Shield Demo...");

    this.isRunning = false;

    if (this.mockCallTimer) {
      clearInterval(this.mockCallTimer);
    }

    if (this.voiceScamShield) {
      await this.voiceScamShield.shutdown();
    }

    if (this.server) {
      this.server.close();
    }

    logger.info("✅ Demo stopped successfully");
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  const demo = new VoiceScamShieldDemo();

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down demo...");
    await demo.stopDemo();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await demo.stopDemo();
    process.exit(0);
  });

  // Start the demo
  demo.startDemo().then(() => {
    demo.printDemoInstructions();

    // Run specific demo scenarios after 5 seconds
    setTimeout(() => {
      demo.simulateDemoScenarios();
    }, 5000);
  });
}

module.exports = VoiceScamShieldDemo;
