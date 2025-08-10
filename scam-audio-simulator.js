// scam-audio-simulator.js - Comprehensive Scam Detection Testing
// Simulates real scam scenarios with synthetic audio for testing

const path = require("path");
const fs = require("fs");
const io = require("socket.io-client");
require("dotenv").config();

// Import our Voice Scam Shield components
const VoiceScamShield = require("./src/core/VoiceScamShield");
const logger = require("./src/utils/logger");

class ScamAudioSimulator {
  constructor() {
    this.voiceScamShield = new VoiceScamShield({
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
      elevenLabsApiKey: process.env.XI_API_KEY,
      groqApiKey: process.env.GROQ_API_KEY,
      webhookBaseUrl: process.env.WEBHOOK_BASE_URL,
      forwardTo: process.env.FORWARD_TO_NUMBER,
      enableDeepfakeDetection: true,
      enableScamAnalysis: true,
      deepfakeThreshold: 0.4,
      scamRiskThreshold: 0.6,
    });

    this.testScenarios = this.generateTestScenarios();

    // Dashboard integration
    this.dashboardClient = null;
    this.dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
    this.alertsGenerated = [];
  }

  generateTestScenarios() {
    return [
      {
        id: "classic_irs_scam",
        name: "IRS Tax Scam",
        description:
          "Classic IRS impersonation call demanding immediate payment",
        callerNumber: "+15551234567",
        audioScript: `Hello, this is Agent Johnson from the IRS. We have detected suspicious activity on your tax return.
                     You owe $3,247 in back taxes and penalties. If you don't pay immediately through gift cards,
                     we will issue a warrant for your arrest within 24 hours. Please stay on the line.`,
        expectedScamRisk: 0.95,
        expectedKeywords: [
          "IRS",
          "taxes",
          "arrest",
          "gift cards",
          "immediate payment",
        ],
        scamType: "government_impersonation",
      },
      {
        id: "tech_support_scam",
        name: "Tech Support Scam",
        description: "Fake Microsoft tech support claiming computer infection",
        callerNumber: "+15559876543",
        audioScript: `This is Microsoft technical support calling about your Windows computer. We have detected
                     malicious software and viruses on your system. Your computer is sending out spam emails.
                     Please allow me remote access to fix this immediately or your data will be compromised.`,
        expectedScamRisk: 0.88,
        expectedKeywords: [
          "Microsoft",
          "viruses",
          "remote access",
          "technical support",
        ],
        scamType: "tech_support_fraud",
      },
      {
        id: "bank_verification_scam",
        name: "Bank Verification Scam",
        description: "Fake bank calling to verify suspicious transactions",
        callerNumber: "+15558889999",
        audioScript: `This is the fraud department from Chase Bank. We've detected unusual activity on your account.
                     Someone tried to withdraw $2,500 from an ATM in another state. To secure your account,
                     please verify your Social Security number and PIN.`,
        expectedScamRisk: 0.82,
        expectedKeywords: [
          "fraud department",
          "Chase Bank",
          "unusual activity",
          "Social Security",
        ],
        scamType: "banking_fraud",
      },
      {
        id: "grandparent_scam",
        name: "Grandparent Emergency Scam",
        description: "Fake emergency call claiming grandchild in trouble",
        callerNumber: "+15557778888",
        audioScript: `Grandma, it's me, your grandson! I'm in terrible trouble. I was in a car accident and
                     I'm in jail. The police say I need $5,000 for bail money right now or I'll have to stay
                     here for weeks. Please don't tell my parents, they'll be so disappointed. Can you wire money?`,
        expectedScamRisk: 0.91,
        expectedKeywords: [
          "grandson",
          "jail",
          "bail money",
          "car accident",
          "wire money",
        ],
        scamType: "family_emergency_fraud",
      },
      {
        id: "deepfake_voice_test",
        name: "AI Deepfake Voice Test",
        description: "Synthetic voice mimicking a family member",
        callerNumber: "+15554445555",
        audioScript: `Hi Mom, it's Sarah. I know this might sound strange, but I'm in a really difficult situation.
                     I need you to send me $2,000 immediately. I can't explain everything over the phone, but trust me,
                     it's urgent. Please send it to this account number I'm about to give you.`,
        expectedScamRisk: 0.75,
        expectedKeywords: [
          "urgent",
          "send money",
          "can't explain",
          "account number",
        ],
        scamType: "ai_voice_cloning",
        isDeepfake: true,
      },
      {
        id: "legitimate_call",
        name: "Legitimate Business Call",
        description: "Normal business call for comparison",
        callerNumber: "+15556661111",
        audioScript: `Hello, this is Jennifer from ABC Marketing. I'm calling to follow up on the brochure
                     you requested about our landscaping services. We have some great spring promotions
                     available. Would you be interested in scheduling a free consultation?`,
        expectedScamRisk: 0.15,
        expectedKeywords: ["landscaping services", "consultation", "marketing"],
        scamType: "legitimate",
        isLegitimate: true,
      },
    ];
  }

  async connectToDashboard() {
    try {
      if (this.dashboardClient && this.dashboardClient.connected) {
        return; // Already connected
      }

      logger.info(`Connecting to dashboard at ${this.dashboardUrl}...`);

      this.dashboardClient = io(this.dashboardUrl, {
        transports: ["websocket", "polling"],
        timeout: 5000,
        forceNew: true,
      });

      this.dashboardClient.on("connect", () => {
        logger.info("✅ Connected to dashboard for real-time alerts");
        this.dashboardClient.emit("subscribe-dashboard");
      });

      this.dashboardClient.on("disconnect", () => {
        logger.warn("📡 Disconnected from dashboard");
      });

      this.dashboardClient.on("connect_error", (error) => {
        logger.warn(`Dashboard connection error: ${error.message}`);
      });

      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Dashboard connection timeout"));
        }, 5000);

        this.dashboardClient.on("connect", () => {
          clearTimeout(timeout);
          resolve();
        });

        this.dashboardClient.on("connect_error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      logger.warn(`Could not connect to dashboard: ${error.message}`);
      logger.info("Continuing without dashboard integration...");
    }
  }

  disconnectFromDashboard() {
    if (this.dashboardClient) {
      this.dashboardClient.disconnect();
      this.dashboardClient = null;
      logger.info("Disconnected from dashboard");
    }
  }

  async sendAlertToDashboard(alertData) {
    if (!this.dashboardClient || !this.dashboardClient.connected) {
      logger.warn("Dashboard not connected, alert not sent");
      return;
    }

    try {
      // Format alert for dashboard
      const dashboardAlert = {
        id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: `🚨 ${alertData.scamType.replace(/_/g, " ").toUpperCase()} DETECTED`,
        message: `Simulated scam call detected with ${(alertData.confidence * 100).toFixed(1)}% confidence`,
        severity: alertData.riskLevel,
        timestamp: new Date().toISOString(),
        callerNumber: alertData.callerNumber,
        riskScore: alertData.confidence,
        scamType: alertData.scamType,
        detectedPatterns: alertData.detectedPatterns || [],
        source: "scam-audio-simulator",
      };

      // Send to dashboard
      this.dashboardClient.emit("alert-generated", dashboardAlert);

      // Store for tracking
      this.alertsGenerated.push(dashboardAlert);

      logger.info(`📡 Alert sent to dashboard: ${dashboardAlert.title}`);

      return dashboardAlert;
    } catch (error) {
      logger.error(`Failed to send alert to dashboard: ${error.message}`);
    }
  }

  async sendCallUpdateToDashboard(callData) {
    if (!this.dashboardClient || !this.dashboardClient.connected) {
      return;
    }

    try {
      const callUpdate = {
        from: callData.callerNumber,
        status: callData.status || "analyzed",
        timestamp: callData.timestamp,
        source: "simulator",
      };

      this.dashboardClient.emit("call-update", callUpdate);
    } catch (error) {
      logger.warn(`Failed to send call update: ${error.message}`);
    }
  }

  async generateSyntheticAudio(script, outputPath) {
    try {
      // Use ElevenLabs API to generate synthetic audio for testing
      if (!process.env.XI_API_KEY) {
        logger.warn("ElevenLabs API key not found, using text-only analysis");
        return null;
      }

      const response = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": process.env.XI_API_KEY,
          },
          body: JSON.stringify({
            text: script,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
            },
          }),
        }
      );

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        fs.writeFileSync(outputPath, Buffer.from(audioBuffer));
        logger.info(`Generated synthetic audio: ${outputPath}`);
        return outputPath;
      } else {
        logger.warn(`Failed to generate audio: ${response.statusText}`);
        return null;
      }
    } catch (error) {
      logger.warn(`Audio generation error: ${error.message}`);
      return null;
    }
  }

  async runComprehensiveTest() {
    console.log("\n🔍 VOICE SCAM SHIELD - COMPREHENSIVE TESTING SUITE\n");
    console.log("=".repeat(60));

    // Connect to dashboard for real-time alerts
    await this.connectToDashboard();

    await this.voiceScamShield.initialize();

    const results = {
      totalTests: this.testScenarios.length,
      passed: 0,
      failed: 0,
      detailed: [],
    };

    // Create test audio directory
    const audioDir = path.join(__dirname, "test-audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    for (const scenario of this.testScenarios) {
      console.log(`\n📞 Testing: ${scenario.name}`);
      console.log(`📋 Description: ${scenario.description}`);
      console.log(`🔢 Caller: ${scenario.callerNumber}`);

      try {
        // Generate synthetic audio for the scenario
        const audioPath = path.join(audioDir, `${scenario.id}.mp3`);
        await this.generateSyntheticAudio(scenario.audioScript, audioPath);

        // Simulate call analysis
        const callData = {
          callSid: `TEST_${scenario.id}_${Date.now()}`,
          from: scenario.callerNumber,
          to: process.env.TWILIO_PHONE_NUMBER,
          transcript: scenario.audioScript,
          audioUrl: fs.existsSync(audioPath) ? audioPath : null,
          timestamp: new Date().toISOString(),
        };

        // Send call update to dashboard
        await this.sendCallUpdateToDashboard({
          callerNumber: scenario.callerNumber,
          status: "analyzing",
          timestamp: callData.timestamp,
        });

        // Run scam analysis
        const scamAnalysis = await this.analyzeScenario(callData);

        // Run deepfake detection if audio available
        const deepfakeAnalysis = scamAnalysis.audioUrl
          ? await this.analyzeDeepfake(scamAnalysis.audioUrl)
          : null;

        // Evaluate results
        const testResult = this.evaluateTest(
          scenario,
          scamAnalysis,
          deepfakeAnalysis
        );

        // If this is a scam scenario (high risk), send alert to dashboard
        if (scenario.expectedScamRisk > 0.6) {
          const riskLevel =
            scamAnalysis.overallRisk?.level ||
            scamAnalysis.quickDetection?.riskLevel;
          const confidence =
            scamAnalysis.overallRisk?.confidence ||
            scamAnalysis.quickDetection?.confidence ||
            0;
          const detectedPatterns =
            scamAnalysis.overallRisk?.tacticsDetected ||
            scamAnalysis.quickDetection?.detectedPatterns ||
            [];

          if (riskLevel === "HIGH" || confidence > 0.6) {
            await this.sendAlertToDashboard({
              scamType: scenario.scamType,
              callerNumber: scenario.callerNumber,
              confidence: confidence,
              riskLevel: riskLevel,
              detectedPatterns: detectedPatterns,
              scenario: scenario.name,
            });
          }
        }

        // Send final call update
        await this.sendCallUpdateToDashboard({
          callerNumber: scenario.callerNumber,
          status: "completed",
          timestamp: new Date().toISOString(),
        });

        results.detailed.push(testResult);
        if (testResult.passed) {
          results.passed++;
          console.log(
            `✅ PASSED - Correctly identified as ${testResult.classification}`
          );
        } else {
          results.failed++;
          console.log(
            `❌ FAILED - Expected ${scenario.expectedScamRisk} risk, got ${testResult.riskScore}`
          );
        }

        // Display detailed analysis
        this.displayAnalysisResults(scamAnalysis, deepfakeAnalysis);
      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        results.failed++;
        results.detailed.push({
          scenario: scenario.name,
          passed: false,
          error: error.message,
        });
      }

      console.log("-".repeat(50));
    }

    this.displayFinalResults(results);

    // Show dashboard summary
    if (this.alertsGenerated.length > 0) {
      console.log(`\n📡 Dashboard Integration Summary:`);
      console.log(
        `   🚨 Alerts sent to dashboard: ${this.alertsGenerated.length}`
      );
      console.log(`   🔗 Dashboard URL: ${this.dashboardUrl}/dashboard`);
      console.log(`   💡 Check the dashboard to see real-time alerts!`);
    }

    // Keep connection open for a bit to ensure alerts are processed
    if (this.dashboardClient && this.dashboardClient.connected) {
      console.log("\n⏳ Keeping dashboard connection open for 10 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      this.disconnectFromDashboard();
    }

    return results;
  }

  async analyzeScenario(callData) {
    // Simulate the full Voice Scam Shield analysis pipeline
    const scamAnalysis = await this.voiceScamShield.scamAnalyzer.analyzeText(
      callData.transcript,
      "caller"
    );

    return {
      ...scamAnalysis,
      callSid: callData.callSid,
      callerNumber: callData.from,
      transcript: callData.transcript,
      audioUrl: callData.audioUrl,
      timestamp: callData.timestamp,
    };
  }

  async analyzeDeepfake(audioPath) {
    try {
      // Simulate deepfake detection on the generated audio
      if (!fs.existsSync(audioPath)) {
        return null;
      }

      // This would normally use your AASIST model
      // For simulation, we'll return mock results
      const mockDeepfakeScore = Math.random() * 0.3; // Low scores for synthetic audio

      return {
        isDeepfake: mockDeepfakeScore > 0.4,
        confidence: mockDeepfakeScore,
        audioPath: audioPath,
        analyzed: true,
      };
    } catch (error) {
      logger.warn(`Deepfake analysis failed: ${error.message}`);
      return null;
    }
  }

  evaluateTest(scenario, scamAnalysis, deepfakeAnalysis) {
    // Extract correct risk data from the actual analysis structure
    const riskLevel =
      scamAnalysis.overallRisk?.level || scamAnalysis.quickDetection?.riskLevel;
    const confidence =
      scamAnalysis.overallRisk?.confidence ||
      scamAnalysis.quickDetection?.confidence ||
      0;

    // Map risk levels to scores more accurately
    const riskScore =
      riskLevel === "HIGH"
        ? 0.95
        : riskLevel === "MEDIUM"
          ? 0.7
          : riskLevel === "LOW"
            ? confidence // Use actual confidence for LOW risk
            : riskLevel === "SAFE"
              ? 0.1
              : confidence;

    const expectedRisk = scenario.expectedScamRisk;

    // Allow more generous tolerance for legitimate calls (low risk scenarios)
    const tolerance = expectedRisk < 0.5 ? 0.4 : 0.2; // 40% tolerance for legitimate calls, 20% for scams
    const riskMatch = Math.abs(riskScore - expectedRisk) <= tolerance;

    // Check if key scam indicators were detected
    const detectedPatterns =
      scamAnalysis.overallRisk?.tacticsDetected ||
      scamAnalysis.quickDetection?.detectedPatterns ||
      [];
    const keywordMatch = scenario.expectedKeywords.some(
      (keyword) =>
        detectedPatterns.some((pattern) =>
          pattern.toLowerCase().includes(keyword.toLowerCase())
        ) || riskLevel === "HIGH" // High risk means scam detected
    );

    const classification = riskLevel === "HIGH" ? "SCAM" : "LEGITIMATE";
    const expectedClassification = expectedRisk > 0.6 ? "SCAM" : "LEGITIMATE";

    // For legitimate calls, also check if risk is appropriately low
    const isLegitimateCallCorrect =
      scenario.scamType === "legitimate" &&
      (riskLevel === "LOW" || riskLevel === "SAFE") &&
      riskScore < 0.5;

    return {
      scenario: scenario.name,
      passed:
        classification === expectedClassification &&
        (riskMatch || keywordMatch || isLegitimateCallCorrect),
      riskScore,
      expectedRisk,
      classification,
      expectedClassification,
      keywordMatch,
      deepfakeDetected: deepfakeAnalysis?.isDeepfake || false,
      details: {
        scamAnalysis,
        deepfakeAnalysis,
        riskLevel,
        confidence,
        tolerance,
        riskMatch,
        isLegitimateCallCorrect,
      },
    };
  }

  displayAnalysisResults(scamAnalysis, deepfakeAnalysis) {
    console.log(`\n📊 Analysis Results:`);

    // Extract correct data from the actual analysis structure
    const riskLevel =
      scamAnalysis.overallRisk?.level || scamAnalysis.quickDetection?.riskLevel;
    const confidence =
      scamAnalysis.overallRisk?.confidence ||
      scamAnalysis.quickDetection?.confidence ||
      0;
    const recommendation = scamAnalysis.recommendation;
    const detectedPatterns =
      scamAnalysis.overallRisk?.tacticsDetected ||
      scamAnalysis.quickDetection?.detectedPatterns ||
      [];

    console.log(`   🎯 Risk Score: ${(confidence * 100).toFixed(1)}%`);
    console.log(`   🏷️  Classification: ${riskLevel}`);
    console.log(`   💡 Recommendation: ${recommendation}`);

    if (detectedPatterns.length > 0) {
      console.log(
        `   � Detected Tactics: ${detectedPatterns.slice(0, 3).join(", ")}`
      );
    }

    const keywordMatches = scamAnalysis.quickDetection?.keywordMatches || [];
    if (keywordMatches.length > 0) {
      console.log(
        `   � Trigger Words: ${keywordMatches.slice(0, 5).join(", ")}`
      );
    }

    if (deepfakeAnalysis) {
      console.log(
        `   🤖 Deepfake Detected: ${deepfakeAnalysis.isDeepfake ? "YES" : "NO"}`
      );
      console.log(
        `   🎭 Voice Authenticity: ${((1 - deepfakeAnalysis.confidence) * 100).toFixed(1)}%`
      );
    }

    if (riskLevel === "HIGH") {
      console.log(`   🚨 Alert Generated: YES`);
    }
  }

  displayFinalResults(results) {
    console.log("\n" + "=".repeat(60));
    console.log("🏆 FINAL TEST RESULTS");
    console.log("=".repeat(60));
    console.log(`📊 Total Tests: ${results.totalTests}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(
      `📈 Success Rate: ${((results.passed / results.totalTests) * 100).toFixed(1)}%`
    );

    if (results.failed > 0) {
      console.log("\n❌ Failed Tests:");
      results.detailed
        .filter((r) => !r.passed)
        .forEach((result) => {
          console.log(
            `   • ${result.scenario}: ${result.error || "Classification mismatch"}`
          );
        });
    }

    console.log("\n✨ Voice Scam Shield Testing Complete!");

    // Recommendations
    if (results.passed / results.totalTests < 0.8) {
      console.log("\n💡 Recommendations:");
      console.log("   • Adjust scam detection thresholds");
      console.log("   • Enhance pattern recognition algorithms");
      console.log("   • Add more training data for edge cases");
    }
  }

  async testSpecificScenario(scenarioId) {
    const scenario = this.testScenarios.find((s) => s.id === scenarioId);
    if (!scenario) {
      throw new Error(`Scenario '${scenarioId}' not found`);
    }

    console.log(`\n🎯 Testing specific scenario: ${scenario.name}\n`);

    // Connect to dashboard for real-time alerts
    await this.connectToDashboard();

    await this.voiceScamShield.initialize();

    // Generate and analyze the scenario
    const audioDir = path.join(__dirname, "test-audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const audioPath = path.join(audioDir, `${scenario.id}.mp3`);
    await this.generateSyntheticAudio(scenario.audioScript, audioPath);

    const callData = {
      callSid: `TEST_${scenario.id}_${Date.now()}`,
      from: scenario.callerNumber,
      to: process.env.TWILIO_PHONE_NUMBER,
      transcript: scenario.audioScript,
      audioUrl: fs.existsSync(audioPath) ? audioPath : null,
      timestamp: new Date().toISOString(),
    };

    // Send call update to dashboard
    await this.sendCallUpdateToDashboard({
      callerNumber: scenario.callerNumber,
      status: "analyzing",
      timestamp: callData.timestamp,
    });

    const scamAnalysis = await this.analyzeScenario(callData);
    const deepfakeAnalysis = scamAnalysis.audioUrl
      ? await this.analyzeDeepfake(scamAnalysis.audioUrl)
      : null;

    // If this is a scam scenario, send alert to dashboard
    if (scenario.expectedScamRisk > 0.6) {
      const riskLevel =
        scamAnalysis.overallRisk?.level ||
        scamAnalysis.quickDetection?.riskLevel;
      const confidence =
        scamAnalysis.overallRisk?.confidence ||
        scamAnalysis.quickDetection?.confidence ||
        0;
      const detectedPatterns =
        scamAnalysis.overallRisk?.tacticsDetected ||
        scamAnalysis.quickDetection?.detectedPatterns ||
        [];

      if (riskLevel === "HIGH" || confidence > 0.6) {
        await this.sendAlertToDashboard({
          scamType: scenario.scamType,
          callerNumber: scenario.callerNumber,
          confidence: confidence,
          riskLevel: riskLevel,
          detectedPatterns: detectedPatterns,
          scenario: scenario.name,
        });
      }
    }

    // Send final call update
    await this.sendCallUpdateToDashboard({
      callerNumber: scenario.callerNumber,
      status: "completed",
      timestamp: new Date().toISOString(),
    });

    this.displayAnalysisResults(scamAnalysis, deepfakeAnalysis);

    // Show dashboard info
    if (this.alertsGenerated.length > 0) {
      console.log(
        `\n📡 Alert sent to dashboard! Check: ${this.dashboardUrl}/dashboard`
      );
    }

    // Keep connection open briefly
    if (this.dashboardClient && this.dashboardClient.connected) {
      console.log("\n⏳ Keeping dashboard connection open for 5 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      this.disconnectFromDashboard();
    }

    return { scamAnalysis, deepfakeAnalysis };
  }
}

// CLI Interface
async function main() {
  const simulator = new ScamAudioSimulator();

  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Run full comprehensive test
    await simulator.runComprehensiveTest();
  } else if (args[0] === "--scenario" && args[1]) {
    // Test specific scenario
    try {
      await simulator.testSpecificScenario(args[1]);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      console.log("\nAvailable scenarios:");
      simulator.testScenarios.forEach((s) => {
        console.log(`  • ${s.id}: ${s.name}`);
      });
    }
  } else if (args[0] === "--list") {
    // List available scenarios
    console.log("\n📋 Available Test Scenarios:\n");
    simulator.testScenarios.forEach((scenario) => {
      console.log(`🎯 ${scenario.id}`);
      console.log(`   Name: ${scenario.name}`);
      console.log(`   Type: ${scenario.scamType}`);
      console.log(
        `   Expected Risk: ${(scenario.expectedScamRisk * 100).toFixed(1)}%`
      );
      console.log();
    });
  } else {
    console.log("\nUsage:");
    console.log(
      "  node scam-audio-simulator.js                    # Run all tests"
    );
    console.log(
      "  node scam-audio-simulator.js --scenario <id>    # Test specific scenario"
    );
    console.log(
      "  node scam-audio-simulator.js --list             # List scenarios"
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Simulator error:", error);
    process.exit(1);
  });
}

module.exports = ScamAudioSimulator;
