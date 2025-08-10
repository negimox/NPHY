// self-test-call.js - Make calls using your existing Twilio number
const twilio = require("twilio");
require("dotenv").config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

class SelfTestCaller {
  constructor() {
    this.mainNumber = process.env.TWILIO_PHONE_NUMBER;
    this.webhookUrl = process.env.WEBHOOK_BASE_URL;
  }

  async testCallToSelf() {
    try {
      console.log("🔄 Making test call from Twilio number to itself...");
      console.log(`📞 From: ${this.mainNumber}`);
      console.log(`📱 To: ${this.mainNumber}`);

      const call = await client.calls.create({
        from: this.mainNumber,
        to: this.mainNumber, // Call to itself
        url: `${this.webhookUrl}/webhook/voice`,
        method: "POST",
        statusCallback: `${this.webhookUrl}/webhook/status`,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        statusCallbackMethod: "POST",
        record: true, // Enable recording for testing
        timeout: 30,
      });

      console.log(`✅ Self-test call initiated!`);
      console.log(`🆔 Call SID: ${call.sid}`);
      console.log(`📊 Status: ${call.status}`);
      console.log(
        `🌐 Monitor at: https://console.twilio.com/us1/develop/voice/logs/${call.sid}`
      );

      return call;
    } catch (error) {
      console.error("❌ Self-test call failed:", error.message);
      throw error;
    }
  }

  async testCallToTestNumber() {
    // Test number that usually works for testing
    const testNumbers = [
      "+15005550006", // Twilio test number that returns valid
      "+15005550007", // Another Twilio test number
    ];

    for (const testNumber of testNumbers) {
      try {
        console.log(`\n🧪 Testing call to Twilio test number: ${testNumber}`);

        const call = await client.calls.create({
          from: this.mainNumber,
          to: testNumber,
          url: `${this.webhookUrl}/webhook/voice`,
          method: "POST",
          statusCallback: `${this.webhookUrl}/webhook/status`,
          statusCallbackEvent: [
            "initiated",
            "ringing",
            "answered",
            "completed",
          ],
          statusCallbackMethod: "POST",
          timeout: 30,
        });

        console.log(`✅ Test call to ${testNumber} initiated!`);
        console.log(`🆔 Call SID: ${call.sid}`);
        console.log(`📊 Status: ${call.status}`);

        return call;
      } catch (error) {
        console.log(`❌ Failed to call ${testNumber}: ${error.message}`);
        continue;
      }
    }

    throw new Error("All test numbers failed");
  }

  async runAllTests() {
    console.log("🎯 Voice Scam Shield Self-Test Suite");
    console.log("====================================");

    try {
      // Test 1: Self call
      console.log("\n🧪 Test 1: Self-Call Test");
      await this.testCallToSelf();

      // Wait between tests
      console.log("\n⏳ Waiting 10 seconds before next test...");
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Test 2: Test numbers
      console.log("\n🧪 Test 2: Twilio Test Numbers");
      await this.testCallToTestNumber();

      console.log("\n✅ All self-tests completed successfully!");
      console.log("📊 Check your server logs and Twilio console for results");
    } catch (error) {
      console.error("\n❌ Self-test suite failed:", error.message);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new SelfTestCaller();
  tester.runAllTests();
}

module.exports = SelfTestCaller;
