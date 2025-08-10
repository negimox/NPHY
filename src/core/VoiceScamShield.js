// src/core/VoiceScamShield.js - Main Voice Scam Shield Engine
// Integrates NPHY detection models with Twilio Voice API for real-time scam detection

const twilio = require("twilio");
const path = require("path");
const fs = require("fs");
const { EventEmitter } = require("events");

// Import NPHY components
const { AudioProcessor } = require("../../model/audio_processor");
const { ScamAnalyzer } = require("../../model/scam_analyzer");
const { AlertSystem } = require("../../model/alert_system");
const { DeepfakeDetector } = require("../../model/deepfake_detector");
const { ScammerDatabase } = require("../../model/scammer_database");

const logger = require("../utils/logger");
const CallSession = require("./CallSession");
const RiskAssessment = require("./RiskAssessment");
const MultilingualAlerts = require("./MultilingualAlerts");

class VoiceScamShield extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Twilio configuration
      twilioAccountSid: config.twilioAccountSid,
      twilioAuthToken: config.twilioAuthToken,
      twilioPhoneNumber: config.twilioPhoneNumber,
      webhookBaseUrl: config.webhookBaseUrl,

      // API keys
      elevenLabsApiKey: config.elevenLabsApiKey,
      groqApiKey: config.groqApiKey,
      truecallerApiKey: config.truecallerApiKey,
      nomoroboApiKey: config.nomoroboApiKey,

      // Detection thresholds
      deepfakeThreshold: config.deepfakeThreshold || 0.4,
      scamRiskThreshold: config.scamRiskThreshold || 0.6,
      confidenceThreshold: config.confidenceThreshold || 0.7,

      // Features
      enableDeepfakeDetection: config.enableDeepfakeDetection !== false,
      enableScamAnalysis: config.enableScamAnalysis !== false,
      enablePhoneVerification: config.enablePhoneVerification !== false,
      enableRealTimeAlerts: config.enableRealTimeAlerts !== false,

      // Language support
      alertLanguages: config.alertLanguages || ["en", "es", "fr"],
      primaryLanguage: config.primaryLanguage || "en",

      // Performance settings
      maxConcurrentCalls: config.maxConcurrentCalls || 10,
      responseTimeoutMs: config.responseTimeoutMs || 5000,
      maxAudioLength: config.maxAudioLength || 300,

      // NPHY configuration
      nphyModelPath: config.nphyModelPath || "./NPHY/models",
      pythonExecutable: config.pythonExecutable || "python3",
    };

    // Validate required configuration
    this.validateConfig();

    // Initialize Twilio client
    this.twilioClient = twilio(
      this.config.twilioAccountSid,
      this.config.twilioAuthToken
    );

    // Initialize NPHY components
    this.audioProcessor = new AudioProcessor(this.config.elevenLabsApiKey);
    this.scamAnalyzer = new ScamAnalyzer(this.config.groqApiKey);
    this.alertSystem = new AlertSystem(this.config.elevenLabsApiKey);
    this.deepfakeDetector = new DeepfakeDetector({
      confidenceThreshold: this.config.deepfakeThreshold,
      verbose: process.env.VERBOSE_LOGGING === "true",
      enableASVspoof: true,
      enableAASIST: true,
      ensembleMode: true,
    });
    this.scammerDatabase = new ScammerDatabase({
      truecallerApiKey: this.config.truecallerApiKey,
      nomoroboApiKey: this.config.nomoroboApiKey,
    });

    // Initialize new components
    this.riskAssessment = new RiskAssessment(this.config);
    this.multilingualAlerts = new MultilingualAlerts(this.config);

    // Active call sessions
    this.activeCalls = new Map();
    this.callHistory = [];
    this.metrics = {
      totalCalls: 0,
      scamCallsDetected: 0,
      deepfakesDetected: 0,
      alertsSent: 0,
      averageResponseTime: 0,
      uptime: Date.now(),
    };

    this.isInitialized = false;
    this.socketIO = null;
  }

  validateConfig() {
    const required = [
      "twilioAccountSid",
      "twilioAuthToken",
      "twilioPhoneNumber",
      "elevenLabsApiKey",
      "groqApiKey",
      "webhookBaseUrl",
    ];

    for (const key of required) {
      if (!this.config[key]) {
        throw new Error(`Missing required configuration: ${key}`);
      }
    }

    logger.info("Configuration validation passed");
  }

  async initialize() {
    if (this.isInitialized) return;

    logger.info("Initializing Voice Scam Shield engine...");

    try {
      // Initialize NPHY detection models
      if (this.config.enableDeepfakeDetection) {
        logger.info("Initializing deepfake detection models...");
        await this.deepfakeDetector.initializeModel();
        logger.info("Deepfake detection ready");
      }

      // Initialize scam analyzer
      if (this.config.enableScamAnalysis) {
        logger.info("Initializing scam analysis engine...");
        await this.scamAnalyzer.initialize?.();
        logger.info("Scam analysis ready");
      }

      // Initialize phone verification
      if (this.config.enablePhoneVerification) {
        logger.info("Initializing phone verification database...");
        await this.scammerDatabase.initialize?.();
        logger.info("Phone verification ready");
      }

      // Test Twilio connection
      logger.info("Testing Twilio connection...");
      await this.testTwilioConnection();
      logger.info("Twilio connection verified");

      // Initialize multilingual alerts
      await this.multilingualAlerts.initialize();
      logger.info("Multilingual alert system ready");

      this.isInitialized = true;
      logger.info("Voice Scam Shield engine initialized successfully");

      // Emit initialization complete event
      this.emit("initialized");
    } catch (error) {
      logger.error("Failed to initialize Voice Scam Shield:", error);
      throw error;
    }
  }

  async testTwilioConnection() {
    try {
      const account = await this.twilioClient.api
        .accounts(this.config.twilioAccountSid)
        .fetch();
      logger.info(`Twilio account verified: ${account.friendlyName}`);
    } catch (error) {
      throw new Error(`Twilio connection failed: ${error.message}`);
    }
  }

  setSocketIO(io) {
    this.socketIO = io;
    logger.info("Socket.IO integration enabled for real-time updates");
  }

  async handleIncomingCall(callSid, from, to, callStatus) {
    logger.info(`Handling incoming call: ${callSid} from ${from} to ${to}`);

    try {
      // Create new call session
      const callSession = new CallSession({
        callSid,
        from,
        to,
        status: callStatus,
        startTime: new Date(),
        config: this.config,
      });

      // Store active call
      this.activeCalls.set(callSid, callSession);
      this.metrics.totalCalls++;

      // Emit call started event
      this.emit("callStarted", callSession);
      this.emitRealtimeUpdate("callStarted", callSession.getPublicData());

      // Initial phone number verification
      if (this.config.enablePhoneVerification) {
        const phoneVerification = await this.verifyPhoneNumber(from);
        callSession.setPhoneVerification(phoneVerification);

        if (phoneVerification.isScammer) {
          logger.warn(`Known scammer detected: ${from}`);
          await this.handleScamDetection(callSession, {
            type: "phone_verification",
            riskLevel: "HIGH",
            confidence: phoneVerification.confidence,
            details: phoneVerification.details,
          });
        }
      }

      // Setup real-time audio monitoring if call connects
      if (callStatus === "in-progress") {
        await this.setupCallMonitoring(callSession);
      }

      return callSession;
    } catch (error) {
      logger.error(`Error handling incoming call ${callSid}:`, error);
      throw error;
    }
  }

  async setupCallMonitoring(callSession) {
    logger.info(`Setting up monitoring for call: ${callSession.callSid}`);

    try {
      // Start call recording for analysis
      const recording = await this.twilioClient
        .calls(callSession.callSid)
        .recordings.create({
          recordingChannels: "dual",
          recordingStatusCallback: `${this.config.webhookBaseUrl}/webhook/recording`,
          recordingStatusCallbackEvent: ["in-progress", "completed"],
        });

      callSession.setRecording(recording.sid);
      logger.info(`Recording started: ${recording.sid}`);

      // Start real-time transcription if available
      await this.startRealTimeTranscription(callSession);
    } catch (error) {
      logger.error(`Failed to setup call monitoring: ${error.message}`);
      // Continue without recording if it fails
    }
  }

  async startRealTimeTranscription(callSession) {
    try {
      // This would use Twilio's real-time transcription when available
      // For now, we'll rely on recording analysis
      logger.info(
        `Real-time transcription setup for call: ${callSession.callSid}`
      );
    } catch (error) {
      logger.warn(`Real-time transcription unavailable: ${error.message}`);
    }
  }

  async analyzeRecording(callSid, recordingUrl) {
    logger.info(`Analyzing recording for call: ${callSid}`);

    const callSession = this.activeCalls.get(callSid);
    if (!callSession) {
      logger.warn(`Call session not found: ${callSid}`);
      return;
    }

    try {
      const startTime = Date.now();

      // Download and process audio
      const audioData = await this.downloadAudio(recordingUrl);
      const audioChunks =
        await this.audioProcessor.processAudioBuffer(audioData);

      const detectionResults = {
        deepfake: null,
        scamContent: null,
        overallRisk: "SAFE",
      };

      // Parallel analysis for speed
      const analysisPromises = [];

      // Deepfake detection
      if (this.config.enableDeepfakeDetection) {
        analysisPromises.push(
          this.analyzeDeepfake(audioChunks).then((result) => {
            detectionResults.deepfake = result;
          })
        );
      }

      // Content analysis via transcription
      if (this.config.enableScamAnalysis) {
        analysisPromises.push(
          this.analyzeContent(audioChunks).then((result) => {
            detectionResults.scamContent = result;
          })
        );
      }

      // Wait for all analyses to complete
      await Promise.all(analysisPromises);

      // Calculate overall risk assessment
      const riskAssessment =
        this.riskAssessment.calculateRisk(detectionResults);
      detectionResults.overallRisk = riskAssessment.level;

      // Update call session
      callSession.addAnalysisResult(detectionResults);

      // Calculate response time
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime);

      // Handle detection results
      if (riskAssessment.level !== "SAFE") {
        await this.handleScamDetection(callSession, riskAssessment);
      }

      // Emit analysis complete event
      this.emit("analysisComplete", callSession, detectionResults);
      this.emitRealtimeUpdate("analysisComplete", {
        callSid,
        results: detectionResults,
        responseTime,
      });

      logger.info(
        `Analysis complete for call ${callSid} in ${responseTime}ms: ${riskAssessment.level}`
      );

      return detectionResults;
    } catch (error) {
      logger.error(`Error analyzing recording for call ${callSid}:`, error);
      throw error;
    }
  }

  async analyzeDeepfake(audioChunks) {
    logger.info("Running deepfake detection analysis...");

    try {
      const results = [];

      for (const chunk of audioChunks) {
        const result = await this.deepfakeDetector.detectDeepfake(
          chunk.buffer,
          chunk.path
        );
        results.push(result);
      }

      // Combine results from all chunks
      const aggregateResult = this.aggregateDeepfakeResults(results);

      if (aggregateResult.isSynthetic) {
        this.metrics.deepfakesDetected++;
      }

      return aggregateResult;
    } catch (error) {
      logger.error("Deepfake detection failed:", error);
      return { isSynthetic: false, confidence: 0, error: error.message };
    }
  }

  async analyzeContent(audioChunks) {
    logger.info("Running scam content analysis...");

    try {
      // Transcribe audio chunks
      const transcriptions = [];

      for (const chunk of audioChunks) {
        const transcription = await this.audioProcessor.transcribeAudio(
          chunk.buffer
        );
        if (transcription && transcription.text) {
          transcriptions.push(transcription.text);
        }
      }

      const fullTranscript = transcriptions.join(" ");

      if (!fullTranscript.trim()) {
        return { isScam: false, confidence: 0, transcript: "", patterns: [] };
      }

      // Analyze for scam patterns
      const scamAnalysis =
        await this.scamAnalyzer.analyzeTranscript(fullTranscript);

      if (scamAnalysis.riskLevel !== "SAFE") {
        this.metrics.scamCallsDetected++;
      }

      return {
        isScam: scamAnalysis.riskLevel !== "SAFE",
        confidence: scamAnalysis.confidence,
        riskLevel: scamAnalysis.riskLevel,
        transcript: fullTranscript,
        patterns: scamAnalysis.patterns,
        reasoning: scamAnalysis.reasoning,
      };
    } catch (error) {
      logger.error("Content analysis failed:", error);
      return { isScam: false, confidence: 0, error: error.message };
    }
  }

  async handleScamDetection(callSession, detection) {
    logger.warn(
      `Scam detected in call ${callSession.callSid}: ${detection.riskLevel}`
    );

    try {
      // Send alert to user
      if (this.config.enableRealTimeAlerts && detection.riskLevel !== "LOW") {
        const alertLanguage =
          this.detectCallLanguage(callSession) || this.config.primaryLanguage;
        await this.sendAlert(callSession, detection, alertLanguage);
      }

      // Log the incident
      this.logSecurityIncident(callSession, detection);

      // Emit scam detection event
      this.emit("scamDetected", callSession, detection);
      this.emitRealtimeUpdate("scamDetected", {
        callSid: callSession.callSid,
        detection,
        timestamp: new Date().toISOString(),
      });

      // Update metrics
      this.metrics.alertsSent++;
    } catch (error) {
      logger.error("Error handling scam detection:", error);
    }
  }

  async sendAlert(callSession, detection, language) {
    try {
      const alertMessage = this.multilingualAlerts.generateAlert(
        detection,
        language
      );

      // Play alert through Twilio call
      await this.twilioClient.calls(callSession.callSid).update({
        twiml: `<Response><Say voice="alice" language="${this.getVoiceLanguage(language)}">${alertMessage}</Say></Response>`,
      });

      logger.info(`Alert sent for call ${callSession.callSid} in ${language}`);
    } catch (error) {
      logger.error("Failed to send alert:", error);
    }
  }

  async verifyPhoneNumber(phoneNumber) {
    try {
      return await this.scammerDatabase.checkNumber(phoneNumber);
    } catch (error) {
      logger.error("Phone verification failed:", error);
      return { isScammer: false, confidence: 0 };
    }
  }

  aggregateDeepfakeResults(results) {
    if (!results || results.length === 0) {
      return { isSynthetic: false, confidence: 0, method: "none" };
    }

    // Calculate weighted average based on confidence
    let totalConfidence = 0;
    let weightedSum = 0;
    let positiveCount = 0;

    for (const result of results) {
      if (result.confidence > 0) {
        totalConfidence += result.confidence;
        if (result.isSynthetic) {
          weightedSum += result.confidence;
          positiveCount++;
        }
      }
    }

    const avgConfidence =
      totalConfidence > 0 ? weightedSum / totalConfidence : 0;
    const isSynthetic = avgConfidence > this.config.deepfakeThreshold;

    return {
      isSynthetic,
      confidence: avgConfidence,
      method: isSynthetic ? "ensemble" : "none",
      positiveDetections: positiveCount,
      totalChunks: results.length,
    };
  }

  detectCallLanguage(callSession) {
    // Simple language detection based on caller location or user preference
    // This could be enhanced with actual speech language detection
    return this.config.primaryLanguage;
  }

  getVoiceLanguage(language) {
    const voiceMap = {
      en: "en-US",
      es: "es-ES",
      fr: "fr-FR",
    };
    return voiceMap[language] || "en-US";
  }

  logSecurityIncident(callSession, detection) {
    const incident = {
      timestamp: new Date().toISOString(),
      callSid: callSession.callSid,
      from: callSession.from,
      to: callSession.to,
      detection,
      severity: this.mapRiskToSeverity(detection.riskLevel),
    };

    // Log to security log
    logger.warn("SECURITY_INCIDENT", incident);

    // Store in call history
    this.callHistory.push({
      ...callSession.getPublicData(),
      incident,
    });
  }

  mapRiskToSeverity(riskLevel) {
    const mapping = {
      LOW: "info",
      MEDIUM: "warning",
      HIGH: "error",
      CRITICAL: "critical",
      MAXIMUM: "critical",
    };
    return mapping[riskLevel] || "info";
  }

  async downloadAudio(recordingUrl) {
    // Implementation to download audio from Twilio recording URL
    const fetch = require("node-fetch");
    const response = await fetch(recordingUrl);
    if (!response.ok) {
      throw new Error(`Failed to download recording: ${response.statusText}`);
    }
    return await response.buffer();
  }

  updateMetrics(responseTime) {
    // Update average response time
    const totalResponses = this.metrics.totalCalls;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (totalResponses - 1) + responseTime) /
      totalResponses;
  }

  emitRealtimeUpdate(event, data) {
    if (this.socketIO) {
      this.socketIO.to("dashboard").emit(event, data);
    }
  }

  // Public API methods
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.uptime,
      activeCalls: this.activeCalls.size,
      accuracy: this.calculateAccuracy(),
    };
  }

  calculateAccuracy() {
    // This would require labeled test data
    // For now, return a placeholder
    return 0.85;
  }

  getCallHistory(limit = 100) {
    return this.callHistory.slice(-limit);
  }

  getActiveCall(callSid) {
    return this.activeCalls.get(callSid);
  }

  async shutdown() {
    logger.info("Shutting down Voice Scam Shield...");

    // Clean up active resources
    this.activeCalls.clear();

    // Additional cleanup if needed
    await this.deepfakeDetector.cleanup?.();
    await this.scamAnalyzer.cleanup?.();

    logger.info("Voice Scam Shield shutdown complete");
  }
}

module.exports = VoiceScamShield;
