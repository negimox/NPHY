// src/core/CallSession.js - Manages individual call session data and state

const logger = require("../utils/logger");

class CallSession {
  constructor(options = {}) {
    this.callSid = options.callSid;
    this.from = options.from;
    this.to = options.to;
    this.status = options.status || "initiated";
    this.startTime = options.startTime || new Date();
    this.endTime = null;
    this.duration = null;

    // Call metadata
    this.recording = {
      sid: null,
      url: null,
      duration: null,
    };

    // Detection results
    this.phoneVerification = null;
    this.analysisResults = [];
    this.riskAssessment = {
      level: "UNKNOWN",
      confidence: 0,
      factors: [],
    };

    // Real-time updates
    this.transcription = "";
    this.language = null;
    this.alerts = [];

    // Metrics
    this.responseTime = null;
    this.processingTime = [];

    this.config = options.config || {};
  }

  setStatus(status) {
    this.status = status;
    logger.debug(`Call ${this.callSid} status updated to: ${status}`);

    if (
      status === "completed" ||
      status === "failed" ||
      status === "canceled"
    ) {
      this.endTime = new Date();
      this.duration = this.endTime - this.startTime;
    }
  }

  setRecording(recordingSid, recordingUrl = null) {
    this.recording.sid = recordingSid;
    this.recording.url = recordingUrl;
    logger.debug(`Recording set for call ${this.callSid}: ${recordingSid}`);
  }

  setPhoneVerification(verification) {
    this.phoneVerification = verification;
    logger.debug(`Phone verification set for ${this.from}:`, verification);
  }

  addAnalysisResult(result) {
    const analysisEntry = {
      timestamp: new Date(),
      ...result,
    };

    this.analysisResults.push(analysisEntry);

    // Update overall risk assessment
    this.updateRiskAssessment(result);

    logger.debug(`Analysis result added for call ${this.callSid}:`, result);
  }

  updateRiskAssessment(result) {
    const factors = [];
    let maxRiskLevel = "SAFE";
    let maxConfidence = 0;

    // Phone verification risk
    if (this.phoneVerification && this.phoneVerification.isScammer) {
      factors.push({
        type: "phone_verification",
        risk: "HIGH",
        confidence: this.phoneVerification.confidence,
        details: this.phoneVerification.details,
      });
      maxRiskLevel = this.compareRiskLevels(maxRiskLevel, "HIGH");
      maxConfidence = Math.max(
        maxConfidence,
        this.phoneVerification.confidence
      );
    }

    // Deepfake detection risk
    if (result.deepfake && result.deepfake.isSynthetic) {
      const riskLevel = result.deepfake.confidence > 0.8 ? "HIGH" : "MEDIUM";
      factors.push({
        type: "deepfake_detection",
        risk: riskLevel,
        confidence: result.deepfake.confidence,
        method: result.deepfake.method,
      });
      maxRiskLevel = this.compareRiskLevels(maxRiskLevel, riskLevel);
      maxConfidence = Math.max(maxConfidence, result.deepfake.confidence);
    }

    // Content analysis risk
    if (result.scamContent && result.scamContent.isScam) {
      factors.push({
        type: "content_analysis",
        risk: result.scamContent.riskLevel,
        confidence: result.scamContent.confidence,
        patterns: result.scamContent.patterns,
      });
      maxRiskLevel = this.compareRiskLevels(
        maxRiskLevel,
        result.scamContent.riskLevel
      );
      maxConfidence = Math.max(maxConfidence, result.scamContent.confidence);
    }

    this.riskAssessment = {
      level: maxRiskLevel,
      confidence: maxConfidence,
      factors: factors,
      lastUpdated: new Date(),
    };
  }

  compareRiskLevels(level1, level2) {
    const riskOrder = ["SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL", "MAXIMUM"];
    const index1 = riskOrder.indexOf(level1);
    const index2 = riskOrder.indexOf(level2);
    return index2 > index1 ? level2 : level1;
  }

  addAlert(alert) {
    const alertEntry = {
      timestamp: new Date(),
      language: alert.language,
      message: alert.message,
      type: alert.type,
      delivered: alert.delivered || false,
    };

    this.alerts.push(alertEntry);
    logger.info(`Alert added for call ${this.callSid}:`, alertEntry);
  }

  updateTranscription(text, language = null) {
    this.transcription += (this.transcription ? " " : "") + text;
    if (language) {
      this.language = language;
    }
  }

  addProcessingTime(operation, duration) {
    this.processingTime.push({
      operation,
      duration,
      timestamp: new Date(),
    });
  }

  getPublicData() {
    return {
      callSid: this.callSid,
      from: this.from,
      to: this.to,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      riskAssessment: this.riskAssessment,
      phoneVerification: this.phoneVerification
        ? {
            isScammer: this.phoneVerification.isScammer,
            confidence: this.phoneVerification.confidence,
            source: this.phoneVerification.source,
          }
        : null,
      alertCount: this.alerts.length,
      hasRecording: !!this.recording.sid,
      language: this.language,
      responseTime: this.responseTime,
    };
  }

  getDetailedData() {
    return {
      ...this.getPublicData(),
      recording: this.recording,
      analysisResults: this.analysisResults,
      alerts: this.alerts,
      transcription: this.transcription,
      processingTime: this.processingTime,
    };
  }

  getSummary() {
    const latestAnalysis =
      this.analysisResults[this.analysisResults.length - 1];

    return {
      callSid: this.callSid,
      from: this.from,
      duration: this.duration,
      riskLevel: this.riskAssessment.level,
      confidence: this.riskAssessment.confidence,
      hasDeepfake: latestAnalysis?.deepfake?.isSynthetic || false,
      hasScamContent: latestAnalysis?.scamContent?.isScam || false,
      alertsSent: this.alerts.length,
      responseTime: this.responseTime,
      timestamp: this.startTime,
    };
  }

  isComplete() {
    return ["completed", "failed", "canceled"].includes(this.status);
  }

  isActive() {
    return ["ringing", "in-progress"].includes(this.status);
  }

  getElapsedTime() {
    const endTime = this.endTime || new Date();
    return endTime - this.startTime;
  }

  hasRisk() {
    return (
      this.riskAssessment.level !== "SAFE" &&
      this.riskAssessment.level !== "UNKNOWN"
    );
  }

  getAverageProcessingTime() {
    if (this.processingTime.length === 0) return 0;

    const total = this.processingTime.reduce(
      (sum, entry) => sum + entry.duration,
      0
    );
    return total / this.processingTime.length;
  }

  toJSON() {
    return this.getDetailedData();
  }
}

module.exports = CallSession;
