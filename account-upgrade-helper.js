// account-upgrade-helper.js - Guide and Tools for Twilio Account Upgrade
// Helps you upgrade your Twilio account for full scam detection testing

require("dotenv").config();

class TwilioAccountUpgradeHelper {
  constructor() {
    this.currentLimitations = {
      trial_tts_message:
        "Trial accounts play 'Upgrading to a full account' message",
      verified_numbers_only: "Can only call verified phone numbers",
      no_real_audio: "Cannot record or analyze real caller audio",
      no_status_callbacks: "Test credentials don't trigger webhooks",
      single_phone_number: "Limited to one phone number",
      geographic_restrictions: "Limited international calling",
    };

    this.upgradebenefits = {
      real_audio_recording: "Record and analyze actual caller audio",
      unlimited_verified_numbers: "Call any phone number",
      full_webhook_support: "Complete status callback functionality",
      multiple_phone_numbers: "Purchase additional numbers for testing",
      international_calling:
        "Call international numbers with proper permissions",
      production_ready: "Full production capabilities",
    };

    this.estimatedCosts = {
      account_upgrade: "Free (no upgrade fee)",
      initial_balance: "$10-20 recommended minimum",
      phone_number: "$1/month for additional numbers",
      voice_calls: "$0.0075/minute for outbound calls",
      recording: "$0.0025/minute for call recording",
      transcription: "$0.05/minute for speech-to-text",
    };
  }

  displayUpgradeInfo() {
    console.log("\n🚀 TWILIO ACCOUNT UPGRADE GUIDE");
    console.log("=".repeat(50));

    console.log("\n❌ Current Trial Limitations:");
    Object.entries(this.currentLimitations).forEach(([key, desc]) => {
      console.log(`   • ${desc}`);
    });

    console.log("\n✅ Benefits After Upgrade:");
    Object.entries(this.upgradebenefits).forEach(([key, desc]) => {
      console.log(`   • ${desc}`);
    });

    console.log("\n💰 Estimated Costs:");
    Object.entries(this.estimatedCosts).forEach(([key, desc]) => {
      console.log(`   • ${key.replace(/_/g, " ")}: ${desc}`);
    });

    console.log("\n📋 Upgrade Steps:");
    console.log("   1. Go to Twilio Console: https://console.twilio.com");
    console.log('   2. Click "Upgrade" at the top of the page');
    console.log("   3. Complete your billing profile");
    console.log("   4. Add payment method (credit card)");
    console.log("   5. Load initial balance ($10-20 recommended)");
    console.log("   6. Your existing phone number will be retained");

    console.log("\n🎯 For Voice Scam Shield Testing:");
    console.log("   • $10 balance = ~1,333 minutes of testing");
    console.log("   • $20 balance = ~2,666 minutes of testing");
    console.log("   • Each test call: ~$0.01-0.02 total cost");

    console.log("\n🔗 Direct Upgrade Link:");
    console.log(
      "   https://console.twilio.com/us1/billing/manage-billing/billing-overview"
    );
  }

  async checkCurrentAccountStatus() {
    try {
      const twilio = require("twilio");
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      console.log("\n🔍 Checking Current Account Status...\n");

      // Get account info
      const account = await client.api
        .accounts(process.env.TWILIO_ACCOUNT_SID)
        .fetch();
      console.log(`📊 Account Status: ${account.status}`);
      console.log(`🆔 Account Type: ${account.type}`);

      // Get balance
      const balance = await client.balance.fetch();
      console.log(`💰 Current Balance: ${balance.currency} ${balance.balance}`);

      // Get phone numbers
      const phoneNumbers = await client.incomingPhoneNumbers.list();
      console.log(`📞 Phone Numbers: ${phoneNumbers.length}`);
      phoneNumbers.forEach((number) => {
        console.log(
          `   • ${number.phoneNumber} (${number.capabilities.voice ? "Voice" : "No Voice"})`
        );
      });

      // Check if trial account
      if (account.type === "Trial") {
        console.log("\n⚠️  You are currently on a TRIAL account");
        console.log("   This limits real audio recording and analysis");
        console.log("   Upgrade recommended for full scam detection testing");
      } else {
        console.log("\n✅ You have a PAID account");
        console.log("   Full scam detection capabilities available");
      }

      return {
        isTrial: account.type === "Trial",
        balance: parseFloat(balance.balance),
        phoneNumberCount: phoneNumbers.length,
        status: account.status,
      };
    } catch (error) {
      console.error("❌ Error checking account status:", error.message);
      return null;
    }
  }

  generateTestPlan(accountInfo) {
    console.log("\n📋 RECOMMENDED TESTING PLAN");
    console.log("=".repeat(40));

    if (accountInfo?.isTrial) {
      console.log("\n🔄 Phase 1: Trial Account Testing (Current)");
      console.log("   • Use scam-audio-simulator.js for comprehensive testing");
      console.log(
        "   • Test all scam detection algorithms with synthetic audio"
      );
      console.log("   • Validate webhook functionality with self-calls");
      console.log("   • Estimated completion: 1-2 hours");

      console.log("\n🚀 Phase 2: Upgrade Account Testing (Recommended)");
      console.log("   • Upgrade account with $10-20 initial balance");
      console.log("   • Test with real phone calls and audio recording");
      console.log("   • Validate end-to-end scam detection pipeline");
      console.log("   • Test international calling scenarios");
      console.log("   • Estimated cost: $10-20 for comprehensive testing");
    } else {
      console.log("\n✅ Full Testing Available (Paid Account)");
      console.log("   • Run real phone call tests immediately");
      console.log("   • Record and analyze actual caller audio");
      console.log("   • Test all webhook functionality");
      console.log("   • Validate production readiness");
    }

    console.log("\n🎯 Testing Priorities:");
    console.log("   1. Synthetic scam scenarios (free)");
    console.log("   2. Real call recording tests ($0.01/call)");
    console.log("   3. International caller tests ($0.02/call)");
    console.log("   4. High-volume stress testing ($1-5)");
  }

  async createUpgradeScript() {
    const upgradeScript = `
# Twilio Account Upgrade Script
# Follow these steps to upgrade your account for full testing

echo "🚀 Twilio Account Upgrade Process"
echo "================================="

echo "Step 1: Open Twilio Console"
echo "URL: https://console.twilio.com"
echo ""

echo "Step 2: Click 'Upgrade' button (top right)"
echo "This will start the upgrade process"
echo ""

echo "Step 3: Complete Billing Profile"
echo "- Enter your business/personal information"
echo "- Verify your address"
echo ""

echo "Step 4: Add Payment Method"
echo "- Add credit card or bank account"
echo "- Payment will only be charged for usage"
echo ""

echo "Step 5: Load Initial Balance"
echo "- Recommended: $10-20 for testing"
echo "- This covers ~1,000-2,000 minutes of testing"
echo ""

echo "Step 6: Verify Upgrade"
echo "- Account type should change from 'Trial' to 'Full'"
echo "- You can now make calls to any number"
echo ""

echo "✅ After upgrade, run:"
echo "node real-call-tester.js"
echo ""

echo "💰 Estimated Testing Costs:"
echo "- Basic testing: $5-10"
echo "- Comprehensive testing: $10-20"
echo "- Production validation: $20-50"
`;

    console.log(upgradeScript);
  }
}

// CLI Interface
async function main() {
  const helper = new TwilioAccountUpgradeHelper();

  const args = process.argv.slice(2);

  if (args.includes("--status")) {
    const accountInfo = await helper.checkCurrentAccountStatus();
    if (accountInfo) {
      helper.generateTestPlan(accountInfo);
    }
  } else if (args.includes("--script")) {
    await helper.createUpgradeScript();
  } else {
    helper.displayUpgradeInfo();

    // Check account status
    const accountInfo = await helper.checkCurrentAccountStatus();
    if (accountInfo) {
      helper.generateTestPlan(accountInfo);
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}

module.exports = TwilioAccountUpgradeHelper;
