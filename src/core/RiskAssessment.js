// src/core/RiskAssessment.js - Advanced risk calculation engine

const logger = require("../utils/logger");

class RiskAssessment {
  constructor(config = {}) {
    this.config = {
      // Risk weights for different detection methods
      phoneVerificationWeight: config.phoneVerificationWeight || 0.3,
      deepfakeWeight: config.deepfakeWeight || 0.4,
      contentAnalysisWeight: config.contentAnalysisWeight || 0.3,

      // Confidence thresholds for different risk levels
      lowRiskThreshold: config.lowRiskThreshold || 0.3,
      mediumRiskThreshold: config.mediumRiskThreshold || 0.5,
      highRiskThreshold: config.highRiskThreshold || 0.7,
      criticalRiskThreshold: config.criticalRiskThreshold || 0.85,

      // Time-based risk factors
      enableTimeBasedRisk: config.enableTimeBasedRisk !== false,
      suspiciousHours: config.suspiciousHours || [22, 23, 0, 1, 2, 3, 4, 5, 6], // Late night/early morning

      // Behavioral patterns
      enableBehavioralAnalysis: config.enableBehavioralAnalysis !== false,
      rapidCallPatternThreshold: config.rapidCallPatternThreshold || 5, // calls per hour
    };

    this.callHistory = new Map(); // Track call patterns
    this.knownScamPatterns = this.loadScamPatterns();
  }

  calculateRisk(detectionResults, callSession = null) {
    logger.debug("Calculating risk assessment for detection results");

    const riskFactors = [];
    let totalRisk = 0;
    let totalWeight = 0;

    // Phone verification risk
    if (detectionResults.phoneVerification) {
      const phoneRisk = this.assessPhoneVerificationRisk(
        detectionResults.phoneVerification
      );
      riskFactors.push(phoneRisk);
      totalRisk += phoneRisk.score * this.config.phoneVerificationWeight;
      totalWeight += this.config.phoneVerificationWeight;
    }

    // Deepfake detection risk
    if (detectionResults.deepfake) {
      const deepfakeRisk = this.assessDeepfakeRisk(detectionResults.deepfake);
      riskFactors.push(deepfakeRisk);
      totalRisk += deepfakeRisk.score * this.config.deepfakeWeight;
      totalWeight += this.config.deepfakeWeight;
    }

    // Content analysis risk
    if (detectionResults.scamContent) {
      const contentRisk = this.assessContentRisk(detectionResults.scamContent);
      riskFactors.push(contentRisk);
      totalRisk += contentRisk.score * this.config.contentAnalysisWeight;
      totalWeight += this.config.contentAnalysisWeight;
    }

    // Calculate weighted average
    const finalScore = totalWeight > 0 ? totalRisk / totalWeight : 0;

    // Additional contextual factors
    const contextualFactors = this.assessContextualFactors(callSession);
    riskFactors.push(...contextualFactors);

    // Apply contextual modifiers
    const modifiedScore = this.applyContextualModifiers(
      finalScore,
      contextualFactors
    );

    // Determine risk level
    const riskLevel = this.scoreToRiskLevel(modifiedScore);

    const assessment = {
      level: riskLevel,
      score: modifiedScore,
      confidence: this.calculateConfidence(riskFactors),
      factors: riskFactors,
      breakdown: {
        phoneVerification: detectionResults.phoneVerification
          ? this.assessPhoneVerificationRisk(detectionResults.phoneVerification)
              .score
          : 0,
        deepfake: detectionResults.deepfake
          ? this.assessDeepfakeRisk(detectionResults.deepfake).score
          : 0,
        content: detectionResults.scamContent
          ? this.assessContentRisk(detectionResults.scamContent).score
          : 0,
        contextual: this.calculateContextualScore(contextualFactors),
      },
      timestamp: new Date(),
    };

    logger.debug(
      `Risk assessment complete: ${riskLevel} (${modifiedScore.toFixed(2)})`
    );
    return assessment;
  }

  assessPhoneVerificationRisk(phoneVerification) {
    let score = 0;
    let reasoning = [];

    if (phoneVerification.isScammer) {
      score = Math.min(phoneVerification.confidence, 1.0);
      reasoning.push(
        `Known scammer number (confidence: ${(phoneVerification.confidence * 100).toFixed(1)}%)`
      );

      if (phoneVerification.reportCount) {
        score = Math.min(score + phoneVerification.reportCount * 0.1, 1.0);
        reasoning.push(`${phoneVerification.reportCount} previous reports`);
      }
    }

    if (phoneVerification.isRobo) {
      score = Math.max(score, 0.6);
      reasoning.push("Identified as robocaller");
    }

    if (phoneVerification.isSpoofed) {
      score = Math.max(score, 0.5);
      reasoning.push("Potentially spoofed number");
    }

    return {
      type: "phone_verification",
      score,
      level: this.scoreToRiskLevel(score),
      reasoning: reasoning.join(", "),
      details: phoneVerification,
    };
  }

  assessDeepfakeRisk(deepfakeResult) {
    let score = 0;
    let reasoning = [];

    if (deepfakeResult.isSynthetic) {
      score = deepfakeResult.confidence;
      reasoning.push(
        `Synthetic voice detected (confidence: ${(deepfakeResult.confidence * 100).toFixed(1)}%)`
      );

      if (deepfakeResult.method) {
        reasoning.push(`Detection method: ${deepfakeResult.method}`);
      }

      // Higher risk for very convincing deepfakes
      if (deepfakeResult.confidence > 0.8) {
        score = Math.min(score + 0.1, 1.0);
        reasoning.push("High-quality synthetic voice");
      }
    }

    return {
      type: "deepfake_detection",
      score,
      level: this.scoreToRiskLevel(score),
      reasoning: reasoning.join(", "),
      details: deepfakeResult,
    };
  }

  assessContentRisk(contentResult) {
    let score = 0;
    let reasoning = [];

    if (contentResult.isScam) {
      score = contentResult.confidence;
      reasoning.push(
        `Scam content detected (confidence: ${(contentResult.confidence * 100).toFixed(1)}%)`
      );

      if (contentResult.patterns && contentResult.patterns.length > 0) {
        reasoning.push(`Patterns: ${contentResult.patterns.join(", ")}`);

        // Higher risk for multiple scam patterns
        const patternBonus = Math.min(contentResult.patterns.length * 0.1, 0.3);
        score = Math.min(score + patternBonus, 1.0);
      }

      // Risk level mapping
      const riskLevelScores = {
        LOW: 0.3,
        MEDIUM: 0.5,
        HIGH: 0.7,
        CRITICAL: 0.85,
        MAXIMUM: 0.95,
      };

      if (contentResult.riskLevel && riskLevelScores[contentResult.riskLevel]) {
        score = Math.max(score, riskLevelScores[contentResult.riskLevel]);
      }
    }

    return {
      type: "content_analysis",
      score,
      level: this.scoreToRiskLevel(score),
      reasoning: reasoning.join(", "),
      details: contentResult,
    };
  }

  assessContextualFactors(callSession) {
    const factors = [];

    if (!callSession) return factors;

    // Time-based risk assessment
    if (this.config.enableTimeBasedRisk) {
      const timeRisk = this.assessTimeBasedRisk(callSession.startTime);
      if (timeRisk.score > 0) {
        factors.push(timeRisk);
      }
    }

    // Call pattern analysis
    if (this.config.enableBehavioralAnalysis) {
      const patternRisk = this.assessCallPatterns(callSession.from);
      if (patternRisk.score > 0) {
        factors.push(patternRisk);
      }
    }

    // Duration analysis
    const durationRisk = this.assessCallDuration(callSession);
    if (durationRisk.score > 0) {
      factors.push(durationRisk);
    }

    return factors;
  }

  assessTimeBasedRisk(callTime) {
    const hour = callTime.getHours();
    const isWeekend = callTime.getDay() === 0 || callTime.getDay() === 6;

    let score = 0;
    let reasoning = [];

    // Suspicious hours (late night/early morning)
    if (this.config.suspiciousHours.includes(hour)) {
      score += 0.2;
      reasoning.push(`Unusual call time: ${hour}:00`);
    }

    // Weekend calls can be more suspicious for certain scam types
    if (isWeekend && (hour < 8 || hour > 21)) {
      score += 0.1;
      reasoning.push("Weekend off-hours call");
    }

    return {
      type: "time_based",
      score,
      level: this.scoreToRiskLevel(score),
      reasoning: reasoning.join(", "),
    };
  }

  assessCallPatterns(phoneNumber) {
    // Track call frequency from this number
    const now = new Date();
    const oneHour = 60 * 60 * 1000;

    if (!this.callHistory.has(phoneNumber)) {
      this.callHistory.set(phoneNumber, []);
    }

    const calls = this.callHistory.get(phoneNumber);

    // Add current call
    calls.push(now);

    // Remove calls older than 1 hour
    const recentCalls = calls.filter((callTime) => now - callTime < oneHour);
    this.callHistory.set(phoneNumber, recentCalls);

    let score = 0;
    let reasoning = [];

    // Rapid call pattern detection
    if (recentCalls.length >= this.config.rapidCallPatternThreshold) {
      score = Math.min(recentCalls.length * 0.1, 0.5);
      reasoning.push(`${recentCalls.length} calls in last hour`);
    }

    return {
      type: "call_pattern",
      score,
      level: this.scoreToRiskLevel(score),
      reasoning: reasoning.join(", "),
    };
  }

  assessCallDuration(callSession) {
    const duration = callSession.getElapsedTime();
    let score = 0;
    let reasoning = [];

    // Very short calls might be robocalls or wrong numbers
    if (duration < 5000) {
      // Less than 5 seconds
      score += 0.1;
      reasoning.push("Extremely short call duration");
    }

    // Unusually long calls might be social engineering attempts
    if (duration > 30 * 60 * 1000) {
      // More than 30 minutes
      score += 0.2;
      reasoning.push("Unusually long call duration");
    }

    return {
      type: "call_duration",
      score,
      level: this.scoreToRiskLevel(score),
      reasoning: reasoning.join(", "),
    };
  }

  applyContextualModifiers(baseScore, contextualFactors) {
    let modifiedScore = baseScore;

    // Apply contextual modifiers
    for (const factor of contextualFactors) {
      if (factor.score > 0) {
        // Contextual factors add to the overall risk but with diminishing returns
        modifiedScore += factor.score * 0.5;
      }
    }

    return Math.min(modifiedScore, 1.0);
  }

  calculateContextualScore(contextualFactors) {
    return contextualFactors.reduce((total, factor) => total + factor.score, 0);
  }

  scoreToRiskLevel(score) {
    if (score < this.config.lowRiskThreshold) return "SAFE";
    if (score < this.config.mediumRiskThreshold) return "LOW";
    if (score < this.config.highRiskThreshold) return "MEDIUM";
    if (score < this.config.criticalRiskThreshold) return "HIGH";
    return "CRITICAL";
  }

  calculateConfidence(riskFactors) {
    if (riskFactors.length === 0) return 0;

    // Calculate confidence based on the number and strength of factors
    let totalConfidence = 0;
    let weights = 0;

    for (const factor of riskFactors) {
      if (factor.details && factor.details.confidence !== undefined) {
        totalConfidence += factor.details.confidence * factor.score;
        weights += factor.score;
      } else {
        totalConfidence += factor.score;
        weights += 1;
      }
    }

    return weights > 0 ? totalConfidence / weights : 0;
  }

  loadScamPatterns() {
    // Common scam patterns that increase risk
    return [
      {
        pattern: /urgent.*action.*required/i,
        weight: 0.3,
        description: "Urgency tactics",
      },
      {
        pattern: /social.*security.*suspend/i,
        weight: 0.4,
        description: "Social Security scam",
      },
      {
        pattern: /irs.*tax.*arrest/i,
        weight: 0.4,
        description: "IRS impersonation",
      },
      {
        pattern: /microsoft.*technical.*support/i,
        weight: 0.3,
        description: "Tech support scam",
      },
      {
        pattern: /verify.*bank.*account/i,
        weight: 0.3,
        description: "Banking fraud",
      },
      {
        pattern: /congratulations.*won.*prize/i,
        weight: 0.3,
        description: "Prize scam",
      },
    ];
  }

  // Public methods for dashboard and monitoring
  getConfigSummary() {
    return {
      weights: {
        phoneVerification: this.config.phoneVerificationWeight,
        deepfake: this.config.deepfakeWeight,
        contentAnalysis: this.config.contentAnalysisWeight,
      },
      thresholds: {
        low: this.config.lowRiskThreshold,
        medium: this.config.mediumRiskThreshold,
        high: this.config.highRiskThreshold,
        critical: this.config.criticalRiskThreshold,
      },
      features: {
        timeBasedRisk: this.config.enableTimeBasedRisk,
        behavioralAnalysis: this.config.enableBehavioralAnalysis,
      },
    };
  }

  getCallHistoryStats() {
    return {
      trackedNumbers: this.callHistory.size,
      totalCalls: Array.from(this.callHistory.values()).reduce(
        (sum, calls) => sum + calls.length,
        0
      ),
    };
  }
}

module.exports = RiskAssessment;
