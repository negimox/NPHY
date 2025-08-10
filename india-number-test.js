// india-number-test.js - Verify and test calls to Indian numbers
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

class IndiaNumberTester {
  constructor() {
    this.mainNumber = process.env.TWILIO_PHONE_NUMBER;
    this.webhookUrl = process.env.WEBHOOK_BASE_URL;
  }

  async verifyIndianNumber(indianNumber) {
    try {
      console.log(`📞 Attempting to verify Indian number: ${indianNumber}`);

      // Check if number is already verified
      const verifiedNumbers = await client.outgoingCallerIds.list();
      const isVerified = verifiedNumbers.some(
        (num) => num.phoneNumber === indianNumber
      );

      if (isVerified) {
        console.log("✅ Number is already verified!");
        return true;
      }

      console.log(
        "🔐 Number needs verification. Starting verification process..."
      );

      // Initiate verification
      const verification = await client.validationRequests.create({
        phoneNumber: indianNumber,
        friendlyName: "India Test Number for Voice Scam Shield",
      });

      console.log("📞 Twilio will call you with a verification code");
      console.log(
        `🔢 When you receive the call, enter this validation code: ${verification.validationCode}`
      );
      console.log(`⏰ You have a few minutes to complete verification`);
      console.log(`🆔 Verification SID: ${verification.validationCode}`);

      return verification;
    } catch (error) {
      console.error("❌ Verification failed:", error.message);

      if (error.code === 21608) {
        console.log("💡 Tip: Make sure the number includes country code (+91)");
      } else if (error.code === 21210) {
        console.log("💡 Tip: This number may not be eligible for verification");
      }

      throw error;
    }
  }

  async makeCallToIndia(indianNumber) {
    try {
      console.log(`\n🌍 Making international call to India: ${indianNumber}`);
      console.log("💰 Note: This will incur international calling charges");

      const call = await client.calls.create({
        from: this.mainNumber,
        to: indianNumber,
        url: `${this.webhookUrl}/webhook/voice`,
        method: "POST",
        statusCallback: `${this.webhookUrl}/webhook/status`,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        statusCallbackMethod: "POST",
        record: true,
        timeout: 60, // Longer timeout for international calls
      });

      console.log(`✅ International call initiated!`);
      console.log(`🆔 Call SID: ${call.sid}`);
      console.log(`📊 Status: ${call.status}`);
      console.log(
        `🌐 Monitor at: https://console.twilio.com/us1/develop/voice/logs/${call.sid}`
      );
      console.log(`💰 Cost will appear in your Twilio billing`);

      return call;
    } catch (error) {
      console.error("❌ International call failed:", error.message);

      if (error.code === 21211) {
        console.log("💡 Number may need to be verified first");
        console.log(
          "🔐 Run verification: node india-number-test.js verify +91XXXXXXXXXX"
        );
      } else if (error.code === 21619) {
        console.log(
          "💡 Your account may not have international calling enabled"
        );
        console.log(
          "🌐 Enable at: https://console.twilio.com/us1/account/usage/voice-geography"
        );
      }

      throw error;
    }
  }

  async checkInternationalPermissions() {
    try {
      console.log("🌍 Checking international calling permissions...");

      // This will show what countries you can call
      const usage = await client.usage.records.list({
        category: "calls-outbound-inbound",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        limit: 10,
      });

      console.log("📊 Recent usage records found:", usage.length);

      // Check account permissions (this requires making a test call or checking console)
      console.log("🔍 To check international permissions:");
      console.log(
        "1. Visit: https://console.twilio.com/us1/account/usage/voice-geography"
      );
      console.log("2. Ensure India (+91) is enabled for outbound calls");
    } catch (error) {
      console.log("⚠️  Could not check permissions via API");
      console.log(
        "🌐 Please check manually at: https://console.twilio.com/us1/account/usage/voice-geography"
      );
    }
  }
}

// CLI interface
if (require.main === module) {
  const tester = new IndiaNumberTester();
  const command = process.argv[2];
  const phoneNumber = process.argv[3];

  console.log("🇮🇳 India Number Testing Tool");
  console.log("=============================");

  if (command === "verify" && phoneNumber) {
    console.log(`\n🔐 Verifying number: ${phoneNumber}`);
    tester.verifyIndianNumber(phoneNumber);
  } else if (command === "call" && phoneNumber) {
    console.log(`\n📞 Calling number: ${phoneNumber}`);
    tester.makeCallToIndia(phoneNumber);
  } else if (command === "permissions") {
    tester.checkInternationalPermissions();
  } else {
    console.log("\n📋 Usage:");
    console.log(
      "  Verify number:    node india-number-test.js verify +91XXXXXXXXXX"
    );
    console.log(
      "  Make call:        node india-number-test.js call +91XXXXXXXXXX"
    );
    console.log("  Check permissions: node india-number-test.js permissions");
    console.log(
      "\n💡 Replace +91XXXXXXXXXX with your actual Indian phone number"
    );
  }
}

module.exports = IndiaNumberTester;
