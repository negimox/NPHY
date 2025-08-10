// advanced-test.js - Advanced testing with audio recording and analysis
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function makeAdvancedTestCall(toNumber) {
  try {
    console.log("\n🔬 Advanced Voice Scam Shield Test");
    console.log("==================================");

    const call = await client.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toNumber,
      url: `${process.env.WEBHOOK_BASE_URL}/webhook/voice`,
      method: "POST",
      statusCallback: `${process.env.WEBHOOK_BASE_URL}/webhook/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      record: true, // Enable recording for analysis
      recordingChannels: "dual", // Record both channels
      recordingStatusCallback: `${process.env.WEBHOOK_BASE_URL}/webhook/recording`,
      recordingStatusCallbackMethod: "POST",
      timeout: 60, // Longer timeout for testing
    });

    console.log(`✅ Advanced test call initiated!`);
    console.log(`🆔 Call SID: ${call.sid}`);
    console.log(`🎙️  Recording: Enabled (dual channel)`);
    console.log(`⏱️  Timeout: 60 seconds`);
    console.log(
      `🌐 Monitor: https://console.twilio.com/us1/develop/voice/logs/${call.sid}`
    );

    return call;
  } catch (error) {
    console.error("❌ Advanced test failed:", error.message);
    throw error;
  }
}

// Usage example
if (require.main === module) {
  if (!process.argv[2]) {
    console.log("📋 Usage: node advanced-test.js <your-phone-number>");
    console.log("📋 Example: node advanced-test.js +1234567890");
    return;
  }

  makeAdvancedTestCall(process.argv[2]);
}

module.exports = { makeAdvancedTestCall };
