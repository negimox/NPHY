// src/controllers/TwilioController.js - Handles Twilio webhook events and call management

const logger = require("../utils/logger");
const twilio = require("twilio");

class TwilioController {
  constructor(voiceScamShield, config) {
    this.voiceScamShield = voiceScamShield;
    this.config = config;
    this.twilioClient = twilio(config.twilioAccountSid, config.twilioAuthToken);
  }

  // Webhook handler for incoming calls
  async handleIncomingCall(req, res) {
    logger.info("Received incoming call webhook");

    try {
      // Validate webhook signature for security
      const isValid = this.validateWebhookSignature(req);
      if (!isValid) {
        logger.error("Invalid webhook signature detected");
        return res.status(403).send("Forbidden");
      }

      const { CallSid, From, To, CallStatus, Direction } = req.body;

      logger.info(
        `Call ${CallSid}: ${From} -> ${To} (${CallStatus}, ${Direction})`
      );

      // Handle the call with our scam detection system
      const callSession = await this.voiceScamShield.handleIncomingCall(
        CallSid,
        From,
        To,
        CallStatus
      );

      // Generate TwiML response based on call status and risk
      const twiml = this.generateCallHandlingTwiML(callSession);

      res.type("text/xml");
      res.send(twiml.toString());
    } catch (error) {
      logger.error("Error handling incoming call:", error);

      // Return safe TwiML to continue the call
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say("Thank you for calling. Please hold while we connect you.");

      res.type("text/xml");
      res.send(twiml.toString());
    }
  }

  // Webhook handler for call status changes
  async handleCallStatus(req, res) {
    logger.info("Received call status webhook");

    try {
      const isValid = this.validateWebhookSignature(req);
      if (!isValid) {
        return res.status(403).send("Forbidden");
      }

      const { CallSid, CallStatus, CallDuration, From, To } = req.body;

      logger.info(`Call status update: ${CallSid} -> ${CallStatus}`);

      // Update call session status
      const callSession = this.voiceScamShield.getActiveCall(CallSid);
      if (callSession) {
        callSession.setStatus(CallStatus);

        if (CallDuration) {
          callSession.duration = parseInt(CallDuration) * 1000; // Convert to milliseconds
        }

        // Clean up completed calls
        if (callSession.isComplete()) {
          this.voiceScamShield.activeCalls.delete(CallSid);

          // Emit call completed event
          this.voiceScamShield.emit("callCompleted", callSession);
          this.voiceScamShield.emitRealtimeUpdate(
            "callCompleted",
            callSession.getPublicData()
          );
        }
      }

      res.status(200).send("OK");
    } catch (error) {
      logger.error("Error handling call status:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  // Webhook handler for recording events
  async handleRecording(req, res) {
    logger.info("Received recording webhook");

    try {
      const isValid = this.validateWebhookSignature(req);
      if (!isValid) {
        return res.status(403).send("Forbidden");
      }

      const {
        CallSid,
        RecordingSid,
        RecordingUrl,
        RecordingStatus,
        RecordingDuration,
      } = req.body;

      logger.info(
        `Recording ${RecordingSid} for call ${CallSid}: ${RecordingStatus}`
      );

      if (RecordingStatus === "completed" && RecordingUrl) {
        // Process the completed recording
        await this.processRecording(
          CallSid,
          RecordingSid,
          RecordingUrl,
          RecordingDuration
        );
      }

      res.status(200).send("OK");
    } catch (error) {
      logger.error("Error handling recording webhook:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  // Process completed recording for analysis
  async processRecording(callSid, recordingSid, recordingUrl, duration) {
    logger.info(`Processing recording ${recordingSid} for call ${callSid}`);

    try {
      // Update call session with recording info
      const callSession = this.voiceScamShield.getActiveCall(callSid);
      if (callSession) {
        callSession.setRecording(recordingSid, recordingUrl);
        callSession.recording.duration = parseInt(duration);
      }

      // Analyze the recording for scam detection
      const analysisResults = await this.voiceScamShield.analyzeRecording(
        callSid,
        recordingUrl
      );

      logger.info(`Recording analysis complete for call ${callSid}`);
    } catch (error) {
      logger.error(`Error processing recording ${recordingSid}:`, error);
    }
  }

  // Generate TwiML based on initial call assessment
  generateCallHandlingTwiML(callSession) {
    const twiml = new twilio.twiml.VoiceResponse();

    // Check if this is a known scammer number
    if (
      callSession.phoneVerification &&
      callSession.phoneVerification.isScammer &&
      callSession.phoneVerification.confidence > 0.8
    ) {
      // High-confidence scammer - reject the call
      logger.warn(`Rejecting call from known scammer: ${callSession.from}`);
      twiml.reject({ reason: "busy" });
      return twiml;
    }

    // For legitimate or uncertain calls, proceed with monitoring
    if (this.config.enableCallRecording) {
      // Start recording for analysis with recording status callbacks
      twiml.record({
        action: `${this.config.webhookBaseUrl}/webhook/recording`,
        method: "POST",
        recordingStatusCallback: `${this.config.webhookBaseUrl}/webhook/recording`,
        recordingStatusCallbackEvent: ["in-progress", "completed"],
        recordingChannels: "dual",
        maxLength: this.config.maxRecordingLength || 300,
      });
    }

    // Connect the call to the intended recipient with status callbacks
    if (this.config.forwardTo) {
      const dial = twiml.dial({
        action: `${this.config.webhookBaseUrl}/webhook/status`,
        method: "POST",
      });

      dial.number(
        {
          statusCallback: `${this.config.webhookBaseUrl}/webhook/status`,
          statusCallbackEvent: [
            "initiated",
            "ringing",
            "answered",
            "completed",
          ],
          statusCallbackMethod: "POST",
        },
        this.config.forwardTo
      );
    } else {
      // Default response if no forwarding is configured
      twiml.say(
        {
          voice: "alice",
          language: "en-US",
        },
        "Thank you for calling. This call is being monitored for security purposes."
      );

      // Hang up after the message
      twiml.hangup();
    }

    return twiml;
  }

  // Webhook signature validation for security
  validateWebhookSignature(req) {
    if (!this.config.webhookValidation) {
      return true; // Skip validation if disabled
    }

    try {
      const signature = req.headers["x-twilio-signature"];
      const url = `${this.config.webhookBaseUrl}${req.path}`;
      const params = req.body;

      return twilio.validateRequest(
        this.config.twilioAuthToken,
        signature,
        url,
        params
      );
    } catch (error) {
      logger.error("Webhook signature validation failed:", error);
      return false;
    }
  }

  // API endpoint to manually trigger call monitoring
  async startCallMonitoring(req, res) {
    try {
      const { callSid } = req.params;

      const callSession = this.voiceScamShield.getActiveCall(callSid);
      if (!callSession) {
        return res.status(404).json({ error: "Call session not found" });
      }

      await this.voiceScamShield.setupCallMonitoring(callSession);

      res.json({
        success: true,
        message: "Call monitoring started",
        callSid: callSid,
      });
    } catch (error) {
      logger.error("Error starting call monitoring:", error);
      res.status(500).json({ error: "Failed to start monitoring" });
    }
  }

  // API endpoint to get call details
  async getCallDetails(req, res) {
    try {
      const { callSid } = req.params;

      const callSession = this.voiceScamShield.getActiveCall(callSid);
      if (!callSession) {
        return res.status(404).json({ error: "Call session not found" });
      }

      res.json(callSession.getDetailedData());
    } catch (error) {
      logger.error("Error getting call details:", error);
      res.status(500).json({ error: "Failed to get call details" });
    }
  }

  // API endpoint to send manual alert during a call
  async sendManualAlert(req, res) {
    try {
      const { callSid } = req.params;
      const { message, language = "en" } = req.body;

      const callSession = this.voiceScamShield.getActiveCall(callSid);
      if (!callSession) {
        return res.status(404).json({ error: "Call session not found" });
      }

      if (!callSession.isActive()) {
        return res.status(400).json({ error: "Call is not active" });
      }

      // Send alert via Twilio
      await this.twilioClient.calls(callSid).update({
        twiml: `<Response><Say voice="alice" language="${this.getVoiceLanguage(language)}">${message}</Say></Response>`,
      });

      // Log the manual alert
      callSession.addAlert({
        type: "manual",
        message,
        language,
        delivered: true,
      });

      res.json({
        success: true,
        message: "Alert sent successfully",
        callSid: callSid,
      });
    } catch (error) {
      logger.error("Error sending manual alert:", error);
      res.status(500).json({ error: "Failed to send alert" });
    }
  }

  // API endpoint to terminate a call
  async terminateCall(req, res) {
    try {
      const { callSid } = req.params;
      const { reason = "security" } = req.body;

      const callSession = this.voiceScamShield.getActiveCall(callSid);
      if (!callSession) {
        return res.status(404).json({ error: "Call session not found" });
      }

      // Terminate the call via Twilio
      await this.twilioClient.calls(callSid).update({ status: "completed" });

      // Log the termination
      logger.info(`Call ${callSid} terminated manually for reason: ${reason}`);

      res.json({
        success: true,
        message: "Call terminated successfully",
        callSid: callSid,
        reason: reason,
      });
    } catch (error) {
      logger.error("Error terminating call:", error);
      res.status(500).json({ error: "Failed to terminate call" });
    }
  }

  getVoiceLanguage(language) {
    const voiceMap = {
      en: "en-US",
      es: "es-ES",
      fr: "fr-FR",
    };
    return voiceMap[language] || "en-US";
  }

  // Health check for Twilio connection
  async healthCheck(req, res) {
    try {
      // Test Twilio connection
      const account = await this.twilioClient.api
        .accounts(this.config.twilioAccountSid)
        .fetch();

      res.json({
        status: "healthy",
        service: "twilio",
        accountName: account.friendlyName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Twilio health check failed:", error);
      res.status(503).json({
        status: "unhealthy",
        service: "twilio",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Handle transcription webhook
  async handleTranscription(req, res) {
    try {
      const {
        CallSid,
        TranscriptionSid,
        TranscriptionText,
        TranscriptionStatus,
      } = req.body;

      logger.logWebhook(
        "transcription",
        `Transcription ${TranscriptionStatus} for call ${CallSid}`
      );

      if (TranscriptionStatus === "completed" && TranscriptionText) {
        // Process transcription for scam analysis
        await this.voiceScamShield.analyzeTranscription(
          CallSid,
          TranscriptionText
        );
      }

      // Respond with empty TwiML
      res.type("text/xml");
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      logger.error("Transcription webhook error:", error);
      res
        .status(500)
        .type("text/xml")
        .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  }

  // Analyze call manually via API
  async analyzeCall(req, res) {
    try {
      const { callSid } = req.body;

      if (!callSid) {
        return res.status(400).json({ error: "callSid is required" });
      }

      const analysis = await this.voiceScamShield.analyzeCall(callSid);
      res.json({ success: true, analysis });
    } catch (error) {
      logger.error("Manual call analysis error:", error);
      res.status(500).json({
        error: "Failed to analyze call",
        message: error.message,
      });
    }
  }

  // Analyze audio file via API
  async analyzeAudio(req, res) {
    try {
      const { audioUrl, phoneNumber } = req.body;

      if (!audioUrl) {
        return res.status(400).json({ error: "audioUrl is required" });
      }

      const analysis = await this.voiceScamShield.analyzeAudioFile(
        audioUrl,
        phoneNumber
      );
      res.json({ success: true, analysis });
    } catch (error) {
      logger.error("Audio analysis error:", error);
      res.status(500).json({
        error: "Failed to analyze audio",
        message: error.message,
      });
    }
  }

  // Get call history
  async getCallHistory(req, res) {
    try {
      const { limit = 50, offset = 0, status, startDate, endDate } = req.query;

      const history = await this.voiceScamShield.getCallHistory({
        limit: parseInt(limit),
        offset: parseInt(offset),
        status,
        startDate,
        endDate,
      });

      res.json({ success: true, history });
    } catch (error) {
      logger.error("Get call history error:", error);
      res.status(500).json({
        error: "Failed to get call history",
        message: error.message,
      });
    }
  }

  // Get alerts
  async getAlerts(req, res) {
    try {
      const {
        limit = 100,
        offset = 0,
        severity,
        startDate,
        endDate,
      } = req.query;

      const alerts = await this.voiceScamShield.getAlerts({
        limit: parseInt(limit),
        offset: parseInt(offset),
        severity,
        startDate,
        endDate,
      });

      res.json({ success: true, alerts });
    } catch (error) {
      logger.error("Get alerts error:", error);
      res.status(500).json({
        error: "Failed to get alerts",
        message: error.message,
      });
    }
  }

  // Demo methods for testing
  async demoScamCall(req, res) {
    try {
      const { phoneNumber } = req.body;

      // Simulate a scam call detection
      const demoResult =
        await this.voiceScamShield.simulateScamCall(phoneNumber);
      res.json({ success: true, demo: demoResult });
    } catch (error) {
      logger.error("Demo scam call error:", error);
      res.status(500).json({
        error: "Failed to run demo scam call",
        message: error.message,
      });
    }
  }

  async demoLegitimateCall(req, res) {
    try {
      const { phoneNumber } = req.body;

      // Simulate a legitimate call
      const demoResult =
        await this.voiceScamShield.simulateLegitimateCall(phoneNumber);
      res.json({ success: true, demo: demoResult });
    } catch (error) {
      logger.error("Demo legitimate call error:", error);
      res.status(500).json({
        error: "Failed to run demo legitimate call",
        message: error.message,
      });
    }
  }
}

module.exports = TwilioController;
