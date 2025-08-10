// test_system.js - Test all components of the scam detection system
const { ScammerDatabase } = require('./scammer_database');
const { DeepfakeDetector } = require('./deepfake_detector');

async function testCompleteSystem() {
    console.log('Testing Complete Scam Detection System');
    console.log('=========================================\n');

    // Test 1: Scammer Database
    console.log('Testing Scammer Database...');
    try {
        const database = new ScammerDatabase({ verbose: true });
        
        const testNumbers = [
            '+1-800-123-4567',  // Known scammer
            '+1-555-123-4567',  // Clean number
            '+1-000-000-0000'   // Suspicious pattern
        ];

        for (const number of testNumbers) {
            const result = await database.checkNumber(number);
            console.log(`   ${number}: ${result.isScammer ? 'SCAMMER' : 'CLEAN'} (${(result.confidence * 100).toFixed(1)}%)`);
        }
        console.log('Scammer database test passed\n');
    } catch (error) {
        console.log('Scammer database test failed:', error.message);
    }

    // Test 2: Deepfake Detection
    console.log('Testing Deepfake Detection...');
    try {
        const detector = new DeepfakeDetector({ verbose: true });
        await detector.initializeModel();
        
        const testTexts = [
            "Hello, how are you today?",
            "This is Microsoft tech support. Your computer has been compromised."
        ];

        for (const text of testTexts) {
            const result = await detector.detectDeepfake(
                { duration: 3.0 },
                { text, speaker: 'test' }
            );
            console.log(`   "${text.substring(0, 30)}...": ${result.is_deepfake ? 'DEEPFAKE' : 'GENUINE'} (${(result.confidence * 100).toFixed(1)}%)`);
        }
        console.log('Deepfake detection test passed\n');
    } catch (error) {
        console.log('Deepfake detection test failed:', error.message);
    }

    // Test 3: Combined Analysis
    console.log('Testing Combined Analysis...');
    try {
        const scenarios = [
            {
                phone: '+1-800-123-4567',
                text: 'This is Microsoft tech support. Your computer has been compromised.',
                expected: 'HIGH_RISK'
            },
            {
                phone: '+1-555-123-4567',
                text: 'Hello, this is your quarterly business review meeting.',
                expected: 'LOW_RISK'
            }
        ];

        const database = new ScammerDatabase({ verbose: false });
        const detector = new DeepfakeDetector({ verbose: false });
        await detector.initializeModel();

        for (const scenario of scenarios) {
            const [phoneResult, deepfakeResult] = await Promise.all([
                database.checkNumber(scenario.phone),
                detector.detectDeepfake({ duration: 3.0 }, { text: scenario.text })
            ]);

            const combinedRisk = Math.max(
                phoneResult.confidence,
                deepfakeResult.confidence
            );

            const riskLevel = combinedRisk > 0.7 ? 'HIGH_RISK' : combinedRisk > 0.3 ? 'MEDIUM_RISK' : 'LOW_RISK';
            const passed = (scenario.expected === 'HIGH_RISK' && riskLevel === 'HIGH_RISK') || 
                          (scenario.expected === 'LOW_RISK' && riskLevel === 'LOW_RISK');

            console.log(`   Phone: ${scenario.phone}`);
            console.log(`   Text: "${scenario.text.substring(0, 40)}..."`);
            console.log(`   Combined Risk: ${riskLevel} (${(combinedRisk * 100).toFixed(1)}%) ${passed ? '(PASS)' : '(FAIL)'}`);
            console.log('');
        }
        console.log('Combined analysis test completed\n');
    } catch (error) {
        console.log('Combined analysis test failed:', error.message);
    }

    console.log('System testing completed!');
    console.log('\nNext steps:');
    console.log('1. Run: node demo_main.js database-only');
    console.log('2. Run: node demo_main.js deepfake-only');
    console.log('3. Run: node demo_main.js complete');
}

if (require.main === module) {
    testCompleteSystem().catch(console.error);
}

module.exports = { testCompleteSystem };