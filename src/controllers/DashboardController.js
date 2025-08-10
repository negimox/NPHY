// src/controllers/DashboardController.js - API controller for dashboard and monitoring

const logger = require("../utils/logger");

class DashboardController {
  constructor(voiceScamShield, config) {
    this.voiceScamShield = voiceScamShield;
    this.config = config;
  }

  // Get real-time dashboard metrics
  async getMetrics(req, res) {
    try {
      const metrics = this.voiceScamShield.getMetrics();
      const systemHealth = await this.getSystemHealth();

      res.json({
        ...metrics,
        systemHealth,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error getting metrics:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  }

  // Get active calls
  async getActiveCalls(req, res) {
    try {
      const activeCalls = Array.from(
        this.voiceScamShield.activeCalls.values()
      ).map((call) => call.getPublicData());

      res.json({
        activeCalls,
        count: activeCalls.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error getting active calls:", error);
      res.status(500).json({ error: "Failed to get active calls" });
    }
  }

  // Get call history with filtering and pagination
  async getCallHistory(req, res) {
    try {
      const {
        limit = 50,
        offset = 0,
        riskLevel = null,
        startDate = null,
        endDate = null,
        search = null,
      } = req.query;

      let callHistory = this.voiceScamShield.getCallHistory(1000); // Get more data for filtering

      // Apply filters
      if (riskLevel) {
        callHistory = callHistory.filter(
          (call) => call.riskAssessment.level === riskLevel.toUpperCase()
        );
      }

      if (startDate) {
        const start = new Date(startDate);
        callHistory = callHistory.filter(
          (call) => new Date(call.startTime) >= start
        );
      }

      if (endDate) {
        const end = new Date(endDate);
        callHistory = callHistory.filter(
          (call) => new Date(call.startTime) <= end
        );
      }

      if (search) {
        const searchLower = search.toLowerCase();
        callHistory = callHistory.filter(
          (call) =>
            call.from.includes(search) ||
            call.to.includes(search) ||
            call.callSid.toLowerCase().includes(searchLower)
        );
      }

      // Sort by start time (newest first)
      callHistory.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

      // Apply pagination
      const total = callHistory.length;
      const paginatedHistory = callHistory.slice(
        parseInt(offset),
        parseInt(offset) + parseInt(limit)
      );

      res.json({
        calls: paginatedHistory,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total,
        },
        filters: {
          riskLevel,
          startDate,
          endDate,
          search,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error getting call history:", error);
      res.status(500).json({ error: "Failed to get call history" });
    }
  }

  // Get detailed call information
  async getCallDetails(req, res) {
    try {
      const { callSid } = req.params;

      // Check active calls first
      let callSession = this.voiceScamShield.getActiveCall(callSid);

      // If not active, search call history
      if (!callSession) {
        const history = this.voiceScamShield.getCallHistory();
        const historicalCall = history.find((call) => call.callSid === callSid);

        if (!historicalCall) {
          return res.status(404).json({ error: "Call not found" });
        }

        return res.json(historicalCall);
      }

      res.json(callSession.getDetailedData());
    } catch (error) {
      logger.error("Error getting call details:", error);
      res.status(500).json({ error: "Failed to get call details" });
    }
  }

  // Render dashboard HTML page
  async renderDashboard(req, res) {
    try {
      // Read dashboard HTML file
      const path = require("path");
      const fs = require("fs").promises;

      const dashboardPath = path.join(__dirname, "../../public/dashboard.html");
      const dashboardHtml = await fs.readFile(dashboardPath, "utf8");

      res.send(dashboardHtml);
    } catch (error) {
      logger.error("Error rendering dashboard:", error);
      res.status(500).send(`
                <html>
                    <body>
                        <h1>Dashboard Error</h1>
                        <p>Failed to load dashboard: ${error.message}</p>
                    </body>
                </html>
            `);
    }
  }

  // Get comprehensive dashboard data
  async getDashboardData(req, res) {
    try {
      // Get active calls safely
      const activeCalls = Array.from(
        this.voiceScamShield.activeCalls.values()
      ).map((call) => ({
        callSid: call.callSid,
        from: call.from,
        to: call.to,
        status: call.status,
        riskLevel: call.riskAssessment?.level || "UNKNOWN",
        startTime: call.startTime,
      }));

      // Mock recent alerts for now (since getAlerts doesn't exist)
      const recentAlerts = [];

      // Calculate metrics from available data
      const metrics = {
        totalCalls: activeCalls.length,
        highRiskCalls: activeCalls.filter((call) => call.riskLevel === "HIGH")
          .length,
        mediumRiskCalls: activeCalls.filter(
          (call) => call.riskLevel === "MEDIUM"
        ).length,
        lowRiskCalls: activeCalls.filter((call) => call.riskLevel === "LOW")
          .length,
        ...(this.voiceScamShield.getMetrics
          ? this.voiceScamShield.getMetrics()
          : {}),
      };

      const dashboardData = {
        metrics,
        activeCalls,
        recentAlerts,
        activity: [],
        systemHealth: await this.getSystemHealthInternal(),
        configuration: {
          features: {
            deepfakeDetection: process.env.ENABLE_DEEPFAKE_DETECTION === "true",
            scamAnalysis: process.env.ENABLE_SCAM_ANALYSIS === "true",
            phoneVerification: process.env.ENABLE_PHONE_VERIFICATION === "true",
          },
          thresholds: {
            deepfake: parseFloat(process.env.DEEPFAKE_THRESHOLD) || 0.4,
            scamRisk: parseFloat(process.env.SCAM_RISK_THRESHOLD) || 0.6,
          },
        },
        timestamp: new Date().toISOString(),
      };

      res.json(dashboardData);
    } catch (error) {
      logger.error("Error getting dashboard data:", error);
      res.status(500).json({
        error: "Failed to get dashboard data",
        message: error.message,
      });
    }
  }

  // Get system metrics
  async getSystemHealth(req, res) {
    try {
      const health = await this.getSystemHealthInternal();

      if (res) {
        res.json({
          ...health,
          timestamp: new Date().toISOString(),
        });
      } else {
        return health;
      }
    } catch (error) {
      logger.error("Error getting system health:", error);
      if (res) {
        res.status(500).json({ error: "Failed to get system health" });
      } else {
        throw error;
      }
    }
  }

  async getSystemHealthInternal() {
    const health = {
      overall: "healthy",
      components: {},
      uptime: this.voiceScamShield.isInitialized
        ? Date.now() - (this.voiceScamShield.metrics?.uptime || Date.now())
        : 0,
    };

    try {
      // Check Voice Scam Shield initialization
      health.components.voiceScamShield = {
        status: this.voiceScamShield.isInitialized ? "healthy" : "unhealthy",
        details: {
          initialized: this.voiceScamShield.isInitialized,
          activeCalls: this.voiceScamShield.activeCalls.size,
        },
      };

      // Basic system health indicators
      health.scamAnalysis = this.voiceScamShield.isInitialized;
      health.deepfakeDetection = this.voiceScamShield.isInitialized;
      health.phoneVerification = this.voiceScamShield.isInitialized;
      health.alertSystem = this.voiceScamShield.isInitialized;
      health.twilioConnection = this.voiceScamShield.isInitialized;
      health.database = true; // Assuming it's working if we get this far
    } catch (error) {
      logger.error("Health check error:", error);
      health.overall = "unhealthy";
      health.error = error.message;
    }

    return health;
  }

  // Get configuration information
  async getConfiguration(req, res) {
    try {
      const config = {
        features: {
          deepfakeDetection: this.config.enableDeepfakeDetection,
          scamAnalysis: this.config.enableScamAnalysis,
          phoneVerification: this.config.enablePhoneVerification,
          realTimeAlerts: this.config.enableRealTimeAlerts,
        },
        thresholds: {
          deepfake: this.config.deepfakeThreshold,
          scamRisk: this.config.scamRiskThreshold,
          confidence: this.config.confidenceThreshold,
        },
        languages: {
          supported: this.config.alertLanguages,
          primary: this.config.primaryLanguage,
        },
        limits: {
          maxConcurrentCalls: this.config.maxConcurrentCalls,
          responseTimeout: this.config.responseTimeoutMs,
          maxAudioLength: this.config.maxAudioLength,
        },
      };

      res.json({
        configuration: config,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error getting configuration:", error);
      res.status(500).json({ error: "Failed to get configuration" });
    }
  }

  // Get analytics and statistics
  async getAnalytics(req, res) {
    try {
      const { period = "24h" } = req.query;

      const analytics = this.calculateAnalytics(period);

      res.json({
        analytics,
        period,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error getting analytics:", error);
      res.status(500).json({ error: "Failed to get analytics" });
    }
  }

  calculateAnalytics(period) {
    const now = new Date();
    let startTime;

    // Calculate time range
    switch (period) {
      case "1h":
        startTime = new Date(now - 60 * 60 * 1000);
        break;
      case "24h":
        startTime = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startTime = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now - 24 * 60 * 60 * 1000);
    }

    const history = this.voiceScamShield
      .getCallHistory()
      .filter((call) => new Date(call.startTime) >= startTime);

    const analytics = {
      totalCalls: history.length,
      scamCalls: history.filter((call) => call.riskAssessment.level !== "SAFE")
        .length,
      deepfakeDetections: history.filter(
        (call) => call.incident?.detection?.type === "deepfake_detection"
      ).length,
      riskDistribution: this.calculateRiskDistribution(history),
      hourlyBreakdown: this.calculateHourlyBreakdown(history),
      averageResponseTime: this.calculateAverageResponseTime(history),
      topRiskFactors: this.calculateTopRiskFactors(history),
    };

    return analytics;
  }

  calculateRiskDistribution(calls) {
    const distribution = {
      SAFE: 0,
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    calls.forEach((call) => {
      const level = call.riskAssessment.level;
      if (distribution.hasOwnProperty(level)) {
        distribution[level]++;
      }
    });

    return distribution;
  }

  calculateHourlyBreakdown(calls) {
    const breakdown = {};

    calls.forEach((call) => {
      const hour = new Date(call.startTime).getHours();
      if (!breakdown[hour]) {
        breakdown[hour] = { total: 0, scam: 0 };
      }
      breakdown[hour].total++;
      if (call.riskAssessment.level !== "SAFE") {
        breakdown[hour].scam++;
      }
    });

    return breakdown;
  }

  calculateAverageResponseTime(calls) {
    const responseTimes = calls
      .filter((call) => call.responseTime)
      .map((call) => call.responseTime);

    if (responseTimes.length === 0) return 0;

    return (
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    );
  }

  calculateTopRiskFactors(calls) {
    const factors = {};

    calls.forEach((call) => {
      if (call.incident?.detection?.factors) {
        call.incident.detection.factors.forEach((factor) => {
          if (!factors[factor.type]) {
            factors[factor.type] = 0;
          }
          factors[factor.type]++;
        });
      }
    });

    return Object.entries(factors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));
  }

  // WebSocket handler for real-time updates
  handleWebSocketConnection(socket) {
    logger.info(`Dashboard client connected: ${socket.id}`);

    // Join the dashboard room for real-time updates
    socket.join("dashboard");

    // Send initial data
    socket.emit("initialData", {
      metrics: this.voiceScamShield.getMetrics(),
      activeCalls: Array.from(this.voiceScamShield.activeCalls.values()).map(
        (call) => call.getPublicData()
      ),
      timestamp: new Date().toISOString(),
    });

    // Handle client requests
    socket.on("requestUpdate", async (type) => {
      try {
        let data;
        switch (type) {
          case "metrics":
            data = this.voiceScamShield.getMetrics();
            break;
          case "activeCalls":
            data = Array.from(this.voiceScamShield.activeCalls.values()).map(
              (call) => call.getPublicData()
            );
            break;
          case "health":
            data = await this.getSystemHealth();
            break;
          default:
            return socket.emit("error", { message: "Unknown update type" });
        }

        socket.emit("updateResponse", {
          type,
          data,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Error handling WebSocket request:", error);
        socket.emit("error", { message: "Failed to get update" });
      }
    });

    socket.on("disconnect", () => {
      logger.info(`Dashboard client disconnected: ${socket.id}`);
    });
  }
}

module.exports = DashboardController;
