// comprehensive-test.js - Complete test suite for Voice Scam Shield
const axios = require("axios");

class VoiceScamShieldTester {
  constructor() {
    this.baseUrl = process.env.WEBHOOK_BASE_URL;
    this.testResults = [];
  }

  async runTest(testName, testFunction) {
    console.log(`\n🧪 Running: ${testName}`);
    console.log("─".repeat(50));

    try {
      const startTime = Date.now();
      const result = await testFunction();
      const duration = Date.now() - startTime;

      this.testResults.push({
        name: testName,
        status: "PASSED",
        duration,
        result,
      });

      console.log(`✅ ${testName} - PASSED (${duration}ms)`);
      return result;
    } catch (error) {
      this.testResults.push({
        name: testName,
        status: "FAILED",
        error: error.message,
      });

      console.log(`❌ ${testName} - FAILED: ${error.message}`);
      throw error;
    }
  }

  async testHealthEndpoint() {
    const response = await axios.get(`${this.baseUrl}/health`);
    if (response.status !== 200) throw new Error("Health check failed");
    return response.data;
  }

  async testWebhookSimulation() {
    const response = await axios.post(
      `${this.baseUrl}/webhook/voice`,
      "CallSid=TEST123&From=%2B15551234567&To=%2B12182204759&CallStatus=ringing",
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    if (response.status !== 200) throw new Error("Webhook simulation failed");
    return response.data;
  }

  async testApiEndpoints() {
    const endpoints = ["/api/calls", "/api/alerts", "/health/detailed"];

    const results = {};
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${this.baseUrl}${endpoint}`);
        results[endpoint] = { status: response.status, working: true };
      } catch (error) {
        results[endpoint] = {
          status: error.response?.status,
          working: false,
          error: error.message,
        };
      }
    }
    return results;
  }

  async runComprehensiveTest() {
    console.log("🎯 Voice Scam Shield - Comprehensive Test Suite");
    console.log("================================================");
    console.log(`🌐 Testing: ${this.baseUrl}`);

    try {
      // Test 1: Health Check
      await this.runTest("Health Endpoint", () => this.testHealthEndpoint());

      // Test 2: Webhook Simulation
      await this.runTest("Webhook Simulation", () =>
        this.testWebhookSimulation()
      );

      // Test 3: API Endpoints
      await this.runTest("API Endpoints", () => this.testApiEndpoints());

      // Final Report
      this.generateReport();
    } catch (error) {
      console.error("\n❌ Test suite failed:", error.message);
    }
  }

  generateReport() {
    console.log("\n📊 Test Results Summary");
    console.log("═".repeat(50));

    const passed = this.testResults.filter((t) => t.status === "PASSED").length;
    const failed = this.testResults.filter((t) => t.status === "FAILED").length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(
      `📈 Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`
    );

    if (failed === 0) {
      console.log(
        "\n🎉 All tests passed! Your Voice Scam Shield is ready for phone calls."
      );
      console.log("\n📞 Next Steps:");
      console.log("   1. Call +1 (218) 220-4759 from your phone");
      console.log("   2. Or run: node test-call.js +1YourPhoneNumber");
      console.log("   3. Monitor server logs for real-time detection");
    }
  }
}

// Run comprehensive test
if (require.main === module) {
  const tester = new VoiceScamShieldTester();
  tester.runComprehensiveTest();
}

module.exports = VoiceScamShieldTester;
