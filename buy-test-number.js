// buy-test-number.js - Purchase a second Twilio number for testing
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function buyTestNumber() {
  try {
    console.log("🔍 Searching for available phone numbers...");

    // Search for available US phone numbers
    const numbers = await client.availablePhoneNumbers("US").local.list({
      areaCode: "555", // Use 555 area code for testing
      limit: 5,
    });

    if (numbers.length === 0) {
      console.log(
        "⚠️  No numbers available with 555 area code, searching nationwide..."
      );

      // Search nationwide if no 555 numbers available
      const alternativeNumbers = await client
        .availablePhoneNumbers("US")
        .local.list({ limit: 5 });

      if (alternativeNumbers.length > 0) {
        numbers.push(...alternativeNumbers);
      }
    }

    if (numbers.length === 0) {
      throw new Error("No available phone numbers found");
    }

    console.log("📋 Available numbers:");
    numbers.forEach((number, index) => {
      console.log(
        `${index + 1}. ${number.phoneNumber} (${number.friendlyName})`
      );
    });

    // Purchase the first available number
    const selectedNumber = numbers[0];
    console.log(`\n💳 Purchasing number: ${selectedNumber.phoneNumber}`);

    const purchasedNumber = await client.incomingPhoneNumbers.create({
      phoneNumber: selectedNumber.phoneNumber,
      friendlyName: "Voice Scam Shield Test Number",
    });

    console.log("✅ Successfully purchased test number!");
    console.log(`📞 New Number: ${purchasedNumber.phoneNumber}`);
    console.log(`🆔 SID: ${purchasedNumber.sid}`);
    console.log(`💰 Cost: This will be added to your Twilio bill`);

    console.log("\n🎯 Next Steps:");
    console.log("1. Use this number to make test calls to your main number");
    console.log(`2. Test command: node test-with-second-number.js`);

    return purchasedNumber;
  } catch (error) {
    console.error("❌ Failed to purchase test number:", error.message);

    if (error.code === 21452) {
      console.log(
        "💡 Tip: Your account may need to be upgraded to purchase additional numbers"
      );
      console.log("🌐 Visit: https://console.twilio.com/us1/billing/upgrade");
    }

    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  console.log("🛒 Twilio Test Number Purchase Tool");
  console.log("==================================");
  buyTestNumber();
}

module.exports = { buyTestNumber };
