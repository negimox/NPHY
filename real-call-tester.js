// real-call-tester.js - Real Phone Call Testing for Upgraded Accounts
// Tests Voice Scam Shield with actual recorded phone calls

const twilio = require("twilio");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

class RealCallTester {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.webhookBaseUrl = process.env.WEBHOOK_BASE_URL;

    this.testScenarios = [
      {
        id: "scam_simulation_1",
        name: "IRS Scam Simulation",
        description: "Simulated IRS scam call with recording",
        twimlUrl: `${this.webhookBaseUrl}/test/scam-simulation-1`,
        expectedRisk: "HIGH",
        duration: 60, // seconds
      },
      {
        id: "scam_simulation_2",
        name: "Tech Support Scam",
        description: "Simulated tech support scam",
        twimlUrl: `${this.webhookBaseUrl}/test/scam-simulation-2`,
        expectedRisk: "HIGH",
        duration: 45,
      },
      {
        id: "legitimate_call",
        name: "Legitimate Business Call",
        description: "Normal business call for comparison",
        twimlUrl: `${this.webhookBaseUrl}/test/legitimate-call`,
        expectedRisk: "LOW",
        duration: 30,
      },
    ];
  }

  async checkAccountStatus() {
    try {
      const account = await this.client.api
        .accounts(process.env.TWILIO_ACCOUNT_SID)
        .fetch();
      const balance = await this.client.balance.fetch();

      if (account.type === "Trial") {
        throw new Error(
          "Account upgrade required. Run: node account-upgrade-helper.js"
        );
      }

      if (parseFloat(balance.balance) < 5.0) {
        console.warn(`⚠️  Low balance: ${balance.currency} ${balance.balance}`);
        console.warn("   Consider adding funds for comprehensive testing");
      }

      console.log(`✅ Account Status: ${account.type}`);
      console.log(`💰 Balance: ${balance.currency} ${balance.balance}`);

      return true;
    } catch (error) {
      console.error(`❌ Account check failed: ${error.message}`);
      return false;
    }
  }

  async setupTestTwiMLEndpoints() {
    console.log("\n🔧 Setting up test TwiML endpoints...\n");

    // Create TwiML responses for different test scenarios
    const twimlResponses = {
      "scam-simulation-1": `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="man" language="en-US">
        Hello, this is Agent Johnson from the I R S. We have detected suspicious activity on your tax return.
        You owe three thousand two hundred forty seven dollars in back taxes and penalties.
        If you don't pay immediately through gift cards, we will issue a warrant for your arrest within twenty four hours.
        Please stay on the line and provide your Social Security number for verification.
    </Say>
    <Record
        timeout="60"
        transcribe="true"
        transcribeCallback="${this.webhookBaseUrl}/webhook/transcription"
        recordingStatusCallback="${this.webhookBaseUrl}/webhook/recording"
        maxLength="120"
    />
    <Say>Thank you for calling. Goodbye.</Say>
</Response>`,

      "scam-simulation-2": `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="woman" language="en-US">
        This is Microsoft technical support calling about your Windows computer.
        We have detected malicious software and viruses on your system.
        Your computer is sending out spam emails and may be compromised.
        Please allow me remote access to fix this immediately or your data will be lost.
        Do you have your computer available right now?
    </Say>
    <Record
        timeout="45"
        transcribe="true"
        transcribeCallback="${this.webhookBaseUrl}/webhook/transcription"
        recordingStatusCallback="${this.webhookBaseUrl}/webhook/recording"
        maxLength="90"
    />
    <Say>We will call you back to complete the repair. Goodbye.</Say>
</Response>`,

      "legitimate-call": `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="woman" language="en-US">
        Hello, this is Jennifer from A B C Marketing.
        I'm calling to follow up on the brochure you requested about our landscaping services.
        We have some great spring promotions available.
        Would you be interested in scheduling a free consultation?
        Please let me know what works best for your schedule.
    </Say>
    <Record
        timeout="30"
        transcribe="true"
        transcribeCallback="${this.webhookBaseUrl}/webhook/transcription"
        recordingStatusCallback="${this.webhookBaseUrl}/webhook/recording"
        maxLength="60"
    />
    <Say>Thank you for your time. Have a great day.</Say>
</Response>`,
    };

    // Save TwiML files for serving
    const twimlDir = path.join(__dirname, "test-twiml");
    if (!fs.existsSync(twimlDir)) {
      fs.mkdirSync(twimlDir, { recursive: true });
    }

    Object.entries(twimlResponses).forEach(([scenario, twiml]) => {
      const filePath = path.join(twimlDir, `${scenario}.xml`);
      fs.writeFileSync(filePath, twiml);
      console.log(`📄 Created TwiML: ${scenario}.xml`);
    });

    console.log("\n✅ TwiML endpoints ready");
    console.log(`📍 Serve from: ${twimlDir}`);
    console.log(`🌐 Base URL: ${this.webhookBaseUrl}/test/`);
  }

  async makeTestCall(toNumber, scenario) {
    try {
      console.log(`\n📞 Making test call: ${scenario.name}`);
      console.log(`   From: ${this.fromNumber}`);
      console.log(`   To: ${toNumber}`);
      console.log(`   Scenario: ${scenario.description}`);

      const call = await this.client.calls.create({
        from: this.fromNumber,
        to: toNumber,
        url: scenario.twimlUrl,
        record: true,
        recordingStatusCallback: `${this.webhookBaseUrl}/webhook/recording`,
        statusCallback: `${this.webhookBaseUrl}/webhook/status`,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        timeout: 30,
        // Add machine detection to avoid answering machines
        machineDetection: "DetectMessageEnd",
        machineDetectionTimeout: 10,
        machineDetectionSpeechThreshold: 2400,
        machineDetectionSpeechEndThreshold: 1200,
        machineDetectionSilenceTimeout: 5000,
      });

      console.log(`✅ Call initiated: ${call.sid}`);
      console.log(`📊 Status: ${call.status}`);
      console.log(`🕐 Expected duration: ${scenario.duration} seconds`);

      // Monitor call progress
      await this.monitorCall(call.sid, scenario.duration + 30);

      return call;
    } catch (error) {
      console.error(`❌ Call failed: ${error.message}`);
      throw error;
    }
  }

  async monitorCall(callSid, maxWaitTime = 120) {
    console.log(`\n👁️  Monitoring call ${callSid}...`);

    const startTime = Date.now();
    let lastStatus = "";

    while (Date.now() - startTime < maxWaitTime * 1000) {
      try {
        const call = await this.client.calls(callSid).fetch();

        if (call.status !== lastStatus) {
          console.log(`📊 Status update: ${call.status}`);
          lastStatus = call.status;

          if (
            call.status === "completed" ||
            call.status === "failed" ||
            call.status === "busy" ||
            call.status === "no-answer"
          ) {
            console.log(`🏁 Call ended: ${call.status}`);

            if (call.duration) {
              console.log(`⏱️  Duration: ${call.duration} seconds`);
              console.log(
                `💰 Cost: $${(parseFloat(call.price) || 0).toFixed(4)}`
              );
            }

            // Wait a bit for recording to be processed
            if (call.status === "completed") {
              console.log("⏳ Waiting for recording processing...");
              await new Promise((resolve) => setTimeout(resolve, 10000));
              await this.getCallRecordings(callSid);
            }

            break;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
      } catch (error) {
        console.error(`❌ Error monitoring call: ${error.message}`);
        break;
      }
    }
  }

  async getCallRecordings(callSid) {
    try {
      console.log(`🎵 Fetching recordings for call ${callSid}...`);

      const recordings = await this.client.recordings.list({
        callSid: callSid,
        limit: 10,
      });

      if (recordings.length === 0) {
        console.log(
          "⚠️  No recordings found yet. They may still be processing."
        );
        return [];
      }

      recordings.forEach((recording, index) => {
        console.log(`\n🎵 Recording ${index + 1}:`);
        console.log(`   SID: ${recording.sid}`);
        console.log(`   Duration: ${recording.duration} seconds`);
        console.log(`   Status: ${recording.status}`);
        console.log(
          `   URL: https://api.twilio.com${recording.uri.replace(".json", ".mp3")}`
        );
      });

      return recordings;
    } catch (error) {
      console.error(`❌ Error fetching recordings: ${error.message}`);
      return [];
    }
  }

  async runFullTestSuite(testPhoneNumber) {
    console.log("\n🚀 VOICE SCAM SHIELD - REAL CALL TESTING");
    console.log("=".repeat(50));

    // Check account status
    const accountReady = await this.checkAccountStatus();
    if (!accountReady) {
      return false;
    }

    // Setup TwiML endpoints
    await this.setupTestTwiMLEndpoints();

    console.log(`\n📞 Test phone number: ${testPhoneNumber}`);
    console.log("⚠️  Make sure your phone is ready to answer calls!\n");

    const results = [];

    for (const scenario of this.testScenarios) {
      try {
        console.log(`\n${"=".repeat(40)}`);
        console.log(
          `🎯 Test ${this.testScenarios.indexOf(scenario) + 1}/${this.testScenarios.length}: ${scenario.name}`
        );
        console.log(`${"=".repeat(40)}`);

        // Ask user to confirm before each call
        console.log(
          `⏳ Preparing to call ${testPhoneNumber} for: ${scenario.description}`
        );
        console.log("📱 Make sure your phone is ready...");

        // Wait for user confirmation (or auto-proceed after 10 seconds)
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 10000);
          process.stdout.write(
            "Press Enter to start call (auto-start in 10s): "
          );
          process.stdin.once("data", () => {
            clearTimeout(timeout);
            resolve();
          });
        });

        const call = await this.makeTestCall(testPhoneNumber, scenario);

        results.push({
          scenario: scenario.name,
          callSid: call.sid,
          status: "initiated",
          expectedRisk: scenario.expectedRisk,
        });

        // Wait between calls
        if (
          this.testScenarios.indexOf(scenario) <
          this.testScenarios.length - 1
        ) {
          console.log("\n⏳ Waiting 30 seconds before next call...");
          await new Promise((resolve) => setTimeout(resolve, 30000));
        }
      } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        results.push({
          scenario: scenario.name,
          status: "failed",
          error: error.message,
        });
      }
    }

    this.displayTestResults(results);
    return results;
  }

  displayTestResults(results) {
    console.log("\n" + "=".repeat(50));
    console.log("🏆 REAL CALL TEST RESULTS");
    console.log("=".repeat(50));

    results.forEach((result, index) => {
      console.log(`\n📞 Test ${index + 1}: ${result.scenario}`);
      console.log(`   Status: ${result.status}`);
      if (result.callSid) {
        console.log(`   Call SID: ${result.callSid}`);
        console.log(`   Expected Risk: ${result.expectedRisk}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log("\n📊 Next Steps:");
    console.log("   1. Check your server logs for webhook processing");
    console.log("   2. Review call recordings in Twilio Console");
    console.log("   3. Verify scam detection results in your dashboard");
    console.log("   4. Check generated alerts and notifications");

    console.log("\n🔗 Useful Links:");
    console.log(
      `   • Twilio Console: https://console.twilio.com/us1/develop/voice/logs`
    );
    console.log(
      `   • Your Dashboard: ${process.env.WEBHOOK_BASE_URL}/dashboard`
    );
    console.log(`   • Call Logs: ${process.env.WEBHOOK_BASE_URL}/api/calls`);
  }

  async testSingleCall(phoneNumber, scenarioId) {
    const scenario = this.testScenarios.find((s) => s.id === scenarioId);
    if (!scenario) {
      throw new Error(`Scenario '${scenarioId}' not found`);
    }

    console.log(`\n🎯 Single Call Test: ${scenario.name}\n`);

    const accountReady = await this.checkAccountStatus();
    if (!accountReady) {
      return false;
    }

    await this.setupTestTwiMLEndpoints();
    const call = await this.makeTestCall(phoneNumber, scenario);

    return call;
  }
}

// CLI Interface
async function main() {
  const tester = new RealCallTester();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("\nUsage:");
    console.log(
      "  node real-call-tester.js --phone <number>           # Full test suite"
    );
    console.log(
      "  node real-call-tester.js --phone <number> --scenario <id>  # Single test"
    );
    console.log(
      "  node real-call-tester.js --setup                    # Setup TwiML only"
    );
    console.log(
      "  node real-call-tester.js --list                     # List scenarios"
    );
    console.log("\nExample:");
    console.log("  node real-call-tester.js --phone +1234567890");
    return;
  }

  if (args.includes("--setup")) {
    await tester.setupTestTwiMLEndpoints();
    return;
  }

  if (args.includes("--list")) {
    console.log("\n📋 Available Test Scenarios:\n");
    tester.testScenarios.forEach((scenario) => {
      console.log(`🎯 ${scenario.id}`);
      console.log(`   Name: ${scenario.name}`);
      console.log(`   Description: ${scenario.description}`);
      console.log(`   Expected Risk: ${scenario.expectedRisk}`);
      console.log(`   Duration: ${scenario.duration}s`);
      console.log();
    });
    return;
  }

  const phoneIndex = args.indexOf("--phone");
  if (phoneIndex === -1 || !args[phoneIndex + 1]) {
    console.error("❌ Phone number required. Use --phone <number>");
    return;
  }

  const phoneNumber = args[phoneIndex + 1];

  const scenarioIndex = args.indexOf("--scenario");
  if (scenarioIndex !== -1 && args[scenarioIndex + 1]) {
    // Single scenario test
    const scenarioId = args[scenarioIndex + 1];
    await tester.testSingleCall(phoneNumber, scenarioId);
  } else {
    // Full test suite
    await tester.runFullTestSuite(phoneNumber);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Tester error:", error);
    process.exit(1);
  });
}

module.exports = RealCallTester;
