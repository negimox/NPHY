// test-call.js - Script to make test calls to your Twilio number
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

async function makeTestCall(toNumber, testType = "legitimate") {
  try {
    console.log(`\n🔄 Making ${testType} test call...`);
    console.log(`📞 From: ${fromNumber}`);
    console.log(`📱 To: ${toNumber}`);

    const call = await client.calls.create({
      from: fromNumber,
      to: toNumber,
      // This will make the call go to your webhook
      url: `${process.env.WEBHOOK_BASE_URL}/webhook/voice`,
      method: "POST",
      statusCallback: `${process.env.WEBHOOK_BASE_URL}/webhook/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      record: false, // Set to true if you want recording
      timeout: 30,
    });

    console.log(`✅ Call initiated successfully!`);
    console.log(`🆔 Call SID: ${call.sid}`);
    console.log(`📊 Status: ${call.status}`);
    console.log(
      `🌐 Monitor at: https://console.twilio.com/us1/develop/voice/logs/${call.sid}`
    );

    return call;
  } catch (error) {
    console.error("❌ Failed to make test call:", error.message);
    throw error;
  }
}

async function runTests() {
  console.log("🎯 Voice Scam Shield - Test Call Suite");
  console.log("======================================");

  if (!process.argv[2]) {
    console.log("📋 Usage: node test-call.js <your-phone-number>");
    console.log("📋 Example: node test-call.js +1234567890");
    console.log(
      "\n📞 This will make a test call from your Twilio number to your personal phone"
    );
    return;
  }

  const testPhoneNumber = process.argv[2];

  try {
    // Test 1: Basic call routing
    console.log("\n🧪 Test 1: Basic Call Routing");
    const call1 = await makeTestCall(testPhoneNumber, "basic");

    // Wait a moment between tests
    console.log("\n⏳ Waiting 5 seconds before next test...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Test 2: Known scammer number (if you have one in your database)
    console.log("\n🧪 Test 2: Potential Scam Detection");
    const call2 = await makeTestCall(testPhoneNumber, "scam-test");

    console.log("\n✅ All tests completed!");
    console.log("📊 Check your server logs and Twilio console for results");
  } catch (error) {
    console.error("❌ Test suite failed:", error);
  }
}

// Run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { makeTestCall };
