// scam_analyzer.js
// Analyzes transcripts for scam tactics using Groq's Gemma 2 9B IT model

const { Groq } = require('groq-sdk');

class ScamAnalyzer {
    constructor(groqApiKey) {
        this.groq = new Groq({
            apiKey: groqApiKey
        });
        
        this.model = "gemma2-9b-it";
        this.conversationHistory = [];
        this.maxHistoryLength = 10;
        
        // Scam detection patterns and keywords for quick filtering
        this.scamPatterns = {
            urgent_keywords: [
                'immediate', 'urgent', 'expire', 'today only', 'limited time',
                'act now', 'final notice', 'last chance', 'deadline', 'expires today'
            ],
            authority_claims: [
                'microsoft', 'apple', 'google', 'irs', 'fbi', 'police', 'amazon',
                'bank', 'government', 'official', 'agent', 'representative', 'department'
            ],
            financial_requests: [
                'bank account', 'credit card', 'social security', 'ssn', 'routing number',
                'payment', 'money', 'transfer', 'wire', 'bitcoin', 'gift card', 'paypal'
            ],
            fear_tactics: [
                'arrest', 'lawsuit', 'legal action', 'warrant', 'prison', 'jail',
                'suspended', 'frozen', 'hack', 'virus', 'breach', 'compromised'
            ],
            tech_support: [
                'computer problem', 'virus detected', 'security breach', 'malware',
                'remote access', 'download software', 'install program', 'teamviewer'
            ],
            romance_manipulation: [
                'love you', 'special connection', 'emergency', 'overseas', 'military',
                'don\'t tell', 'secret', 'trust me', 'help me'
            ]
        };
        
        // Quick risk assessment thresholds
        this.riskThresholds = {
            HIGH: 5,
            MEDIUM: 2,
            LOW: 1
        };
    }

    // Quick pattern-based scam detection for immediate red flags
    quickScamDetection(text) {
        const results = {
            riskLevel: 'SAFE',
            detectedPatterns: [],
            keywordMatches: [],
            confidence: 0.0,
            immediateFlags: []
        };

        let riskScore = 0;
        const normalizedText = text.toLowerCase();

        // Check each pattern category with different weights
        Object.entries(this.scamPatterns).forEach(([category, keywords]) => {
            const matches = keywords.filter(keyword => 
                normalizedText.includes(keyword.toLowerCase())
            );
            
            if (matches.length > 0) {
                results.detectedPatterns.push(category);
                results.keywordMatches.push(...matches);
                
                // Weight different categories based on risk severity
                switch (category) {
                    case 'financial_requests':
                        riskScore += matches.length * 3;
                        results.immediateFlags.push('FINANCIAL_INFO_REQUEST');
                        break;
                    case 'authority_claims':
                        riskScore += matches.length * 2.5;
                        results.immediateFlags.push('AUTHORITY_IMPERSONATION');
                        break;
                    case 'fear_tactics':
                        riskScore += matches.length * 2.5;
                        results.immediateFlags.push('FEAR_INTIMIDATION');
                        break;
                    case 'urgent_keywords':
                        riskScore += matches.length * 1.5;
                        results.immediateFlags.push('URGENCY_PRESSURE');
                        break;
                    case 'tech_support':
                        riskScore += matches.length * 2;
                        results.immediateFlags.push('TECH_SUPPORT_SCAM');
                        break;
                    case 'romance_manipulation':
                        riskScore += matches.length * 2;
                        results.immediateFlags.push('ROMANCE_EXPLOITATION');
                        break;
                }
            }
        });

        // Determine risk level based on score
        if (riskScore >= this.riskThresholds.HIGH) {
            results.riskLevel = 'HIGH';
            results.confidence = Math.min(0.95, 0.7 + riskScore * 0.05);
        } else if (riskScore >= this.riskThresholds.MEDIUM) {
            results.riskLevel = 'MEDIUM';
            results.confidence = Math.min(0.8, 0.5 + riskScore * 0.1);
        } else if (riskScore > 0) {
            results.riskLevel = 'LOW';
            results.confidence = Math.min(0.6, 0.3 + riskScore * 0.1);
        }

        return results;
    }

    // Advanced scam analysis using Groq's Gemma 2 9B IT
    async deepScamAnalysis(text, conversationHistory) {
        try {
            // Prepare conversation context
            const contextText = conversationHistory
                .slice(-5) // Last 5 exchanges for context
                .map(entry => `${entry.speaker}: ${entry.text}`)
                .join('\n');
            
            const prompt = `You are an expert fraud detection system. Analyze this conversation for scam tactics and social engineering.

CONVERSATION CONTEXT:
${contextText}

CURRENT MESSAGE: "${text}"

Analyze for these scam patterns:
1. AUTHORITY IMPERSONATION: Claiming to be from legitimate organizations (Microsoft, IRS, banks, etc.)
2. URGENCY TACTICS: Creating false deadlines, "act now" pressure
3. FEAR TACTICS: Threats of arrest, legal action, account closure
4. FINANCIAL PHISHING: Requesting bank info, SSN, credit cards, gift cards
5. TECH SUPPORT SCAMS: Claiming computer problems, requesting remote access
6. ROMANCE SCAMS: Building emotional connection then requesting money
7. SOCIAL ENGINEERING: Building trust, creating false emergencies

RESPOND WITH ONLY VALID JSON:
{
  "scam_probability": 0.0-1.0,
  "primary_scam_type": "tech_support|government_impersonation|financial_phishing|warranty_scam|lottery_scam|romance_scam|normal_conversation",
  "tactics_detected": ["authority", "urgency", "fear", "financial_requests", "technical_confusion", "trust_building"],
  "confidence": 0.0-1.0,
  "risk_factors": ["specific risk factors found"],
  "red_flags": ["immediate warning signs"],
  "social_engineering_score": 0.0-1.0,
  "explanation": "brief explanation of findings"
}

CRITICAL: Output ONLY the JSON object, nothing else.`;

            const completion = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                model: this.model,
                temperature: 0.1, // Low temperature for consistent analysis
                max_tokens: 512,
                top_p: 0.9
            });

            const responseText = completion.choices[0].message.content.trim();
            
            // Clean and parse JSON response
            let cleanResponse = responseText;
            if (cleanResponse.includes('```json')) {
                cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            }
            
            const analysis = JSON.parse(cleanResponse);
            
            // Validate and normalize the response
            return {
                scam_probability: Math.max(0, Math.min(1, analysis.scam_probability || 0)),
                primary_scam_type: analysis.primary_scam_type || 'unknown',
                tactics_detected: Array.isArray(analysis.tactics_detected) ? analysis.tactics_detected : [],
                confidence: Math.max(0, Math.min(1, analysis.confidence || 0)),
                risk_factors: Array.isArray(analysis.risk_factors) ? analysis.risk_factors : [],
                red_flags: Array.isArray(analysis.red_flags) ? analysis.red_flags : [],
                social_engineering_score: Math.max(0, Math.min(1, analysis.social_engineering_score || 0)),
                explanation: analysis.explanation || 'Analysis completed',
                model_used: this.model,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('Error in Groq analysis:', error);
            
            // Fallback to pattern-based analysis
            const fallbackAnalysis = this.quickScamDetection(text);
            
            return {
                scam_probability: fallbackAnalysis.riskLevel === 'HIGH' ? 0.8 : 
                                 fallbackAnalysis.riskLevel === 'MEDIUM' ? 0.5 : 0.2,
                primary_scam_type: 'unknown',
                tactics_detected: fallbackAnalysis.detectedPatterns,
                confidence: fallbackAnalysis.confidence,
                risk_factors: fallbackAnalysis.immediateFlags,
                red_flags: fallbackAnalysis.keywordMatches,
                social_engineering_score: 0.0,
                explanation: `Groq analysis failed, using fallback: ${error.message}`,
                model_used: 'fallback_patterns',
                timestamp: Date.now(),
                error: error.message
            };
        }
    }

    // Detect specific social engineering tactics with Groq
    async detectSocialEngineering(text, conversationHistory) {
        try {
            const prompt = `Analyze this text for social engineering tactics. Rate each tactic from 0.0 to 1.0:

TEXT: "${text}"

CONTEXT: ${conversationHistory.slice(-3).map(h => h.text).join(' ')}

Return ONLY this JSON structure with no additional text:
{
  "authority_manipulation": 0.0,
  "urgency_creation": 0.0,
  "fear_induction": 0.0,
  "trust_building": 0.0,
  "information_gathering": 0.0,
  "technical_confusion": 0.0,
  "emotional_manipulation": 0.0,
  "isolation_tactics": 0.0
}`;

            const completion = await this.groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: this.model,
                temperature: 0.1,
                max_tokens: 256
            });

            const responseText = completion.choices[0].message.content.trim();
            
            // More aggressive JSON cleaning
            let cleanResponse = responseText;
            
            // Remove markdown code blocks
            cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // Remove any text before the first { and after the last }
            const firstBrace = cleanResponse.indexOf('{');
            const lastBrace = cleanResponse.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1);
            }
            
            // Remove any comments or extra text
            cleanResponse = cleanResponse.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
            
            return JSON.parse(cleanResponse);

        } catch (error) {
            console.error('Social engineering detection failed:', error);
            // Return default safe values instead of erroring
            return {
                authority_manipulation: 0.0,
                urgency_creation: 0.0,
                fear_induction: 0.0,
                trust_building: 0.0,
                information_gathering: 0.0,
                technical_confusion: 0.0,
                emotional_manipulation: 0.0,
                isolation_tactics: 0.0,
                error: error.message
            };
        }
    }

    // Main analysis function combining all methods
    async analyzeText(text, speaker = 'unknown') {
        try {
            console.log(`Analyzing text from ${speaker}: "${text.substring(0, 100)}..."`);

            // Update conversation history
            this.updateConversationHistory(text, speaker);

            // Step 1: Quick pattern detection for immediate flags
            const quickResult = this.quickScamDetection(text);
            
            // Step 2: If high risk detected immediately, can skip deep analysis for speed
            if (quickResult.riskLevel === 'HIGH' && quickResult.confidence > 0.9) {
                console.log(`Immediate HIGH risk detected, confidence: ${quickResult.confidence.toFixed(2)}`);
                
                return {
                    timestamp: Date.now(),
                    speaker,
                    text,
                    quickDetection: quickResult,
                    deepAnalysis: null,
                    socialEngineering: null,
                    overallRisk: {
                        level: 'HIGH',
                        confidence: quickResult.confidence,
                        score: 5,
                        tacticsDetected: quickResult.detectedPatterns,
                        immediateFlags: quickResult.immediateFlags
                    },
                    recommendation: 'END_CALL_IMMEDIATELY',
                    processingTime: 'immediate'
                };
            }

            // Step 3: Deep analysis with Groq Gemma 2 9B IT
            const startTime = Date.now();
            
            const [deepResult, socialEngResult] = await Promise.all([
                this.deepScamAnalysis(text, this.conversationHistory),
                this.detectSocialEngineering(text, this.conversationHistory)
            ]);
            
            const processingTime = Date.now() - startTime;

            // Step 4: Combine all results for final assessment
            const overallRisk = this.calculateOverallRisk(quickResult, deepResult, socialEngResult);

            const analysis = {
                timestamp: Date.now(),
                speaker,
                text,
                quickDetection: quickResult,
                deepAnalysis: deepResult,
                socialEngineering: socialEngResult,
                overallRisk,
                recommendation: this.generateRecommendation(overallRisk),
                processingTime: `${processingTime}ms`,
                model: this.model
            };

            console.log(`Analysis complete - Risk: ${overallRisk.level} (${overallRisk.confidence.toFixed(2)}) - Time: ${processingTime}ms`);

            return analysis;

        } catch (error) {
            console.error('Error in text analysis:', error);
            return {
                timestamp: Date.now(),
                speaker,
                text,
                error: error.message,
                overallRisk: { level: 'ERROR', confidence: 0 },
                recommendation: 'TECHNICAL_ERROR',
                processingTime: 'error'
            };
        }
    }

    // Update conversation history for context
    updateConversationHistory(text, speaker) {
        this.conversationHistory.push({
            text,
            speaker,
            timestamp: Date.now()
        });

        // Keep only recent history to maintain performance
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }
    }

    // Calculate overall risk from multiple analysis methods
    calculateOverallRisk(quickResult, deepResult, socialEngResult) {
        let riskScore = 0;
        let confidence = 0;
        const tacticsDetected = new Set();

        // Weight from quick detection (30%)
        switch (quickResult.riskLevel) {
            case 'HIGH':
                riskScore += 3;
                break;
            case 'MEDIUM':
                riskScore += 2;
                break;
            case 'LOW':
                riskScore += 1;
                break;
        }
        confidence += quickResult.confidence * 0.3;
        quickResult.detectedPatterns.forEach(pattern => tacticsDetected.add(pattern));

        // Weight from deep analysis (50%)
        if (deepResult && !deepResult.error) {
            riskScore += deepResult.scam_probability * 4; // Scale to 0-4
            confidence += deepResult.confidence * 0.5;
            deepResult.tactics_detected.forEach(tactic => tacticsDetected.add(tactic));
        }

        // Weight from social engineering analysis (20%)
        if (socialEngResult && !socialEngResult.error) {
            const seAverage = Object.values(socialEngResult)
                .filter(val => typeof val === 'number')
                .reduce((sum, val) => sum + val, 0) / 8; // Average of 8 tactics
            
            riskScore += seAverage * 2; // Scale to 0-2
            confidence += seAverage * 0.2;
            
            // Add high-scoring social engineering tactics
            Object.entries(socialEngResult).forEach(([tactic, score]) => {
                if (typeof score === 'number' && score > 0.6) {
                    tacticsDetected.add(tactic);
                }
            });
        }

        // Normalize confidence
        confidence = Math.min(confidence, 1.0);

        // Determine final risk level
        let level = 'SAFE';
        if (riskScore >= 4.5) {
            level = 'HIGH';
        } else if (riskScore >= 2.5) {
            level = 'MEDIUM';
        } else if (riskScore >= 1) {
            level = 'LOW';
        }

        return {
            level,
            confidence,
            score: riskScore,
            tacticsDetected: Array.from(tacticsDetected),
            scamProbability: deepResult?.scam_probability || 0,
            primaryScamType: deepResult?.primary_scam_type || 'unknown',
            riskFactors: deepResult?.risk_factors || [],
            redFlags: [...new Set([
                ...quickResult.keywordMatches,
                ...(deepResult?.red_flags || [])
            ])]
        };
    }

    // Generate recommendation based on risk level
    generateRecommendation(overallRisk) {
        const { level, scamProbability, primaryScamType } = overallRisk;
        
        switch (level) {
            case 'HIGH':
                if (primaryScamType === 'tech_support' || scamProbability > 0.9) {
                    return 'END_CALL_IMMEDIATELY';
                }
                return 'HIGH_CAUTION_ADVISED';
            case 'MEDIUM':
                return 'BE_VERY_CAUTIOUS';
            case 'LOW':
                return 'MONITOR_CLOSELY';
            case 'SAFE':
                return 'CONTINUE_NORMALLY';
            default:
                return 'UNKNOWN';
        }
    }

    // Get conversation summary with risk timeline
    getConversationSummary() {
        const riskTimeline = this.conversationHistory.map(entry => ({
            timestamp: entry.timestamp,
            speaker: entry.speaker,
            textPreview: entry.text.substring(0, 50) + '...'
        }));

        return {
            totalExchanges: this.conversationHistory.length,
            recentHistory: this.conversationHistory.slice(-5),
            participants: [...new Set(this.conversationHistory.map(entry => entry.speaker))],
            riskTimeline,
            conversationDuration: this.conversationHistory.length > 0 ? 
                Date.now() - this.conversationHistory[0].timestamp : 0
        };
    }

    // Reset conversation context
    resetConversation() {
        this.conversationHistory = [];
        console.log('Conversation context reset');
    }

    // Batch analyze multiple texts efficiently
    async batchAnalyze(texts) {
        const results = [];
        const batchSize = 3; // Process 3 at a time to avoid rate limits
        
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchPromises = batch.map(text => 
                this.analyzeText(text.content, text.speaker || 'unknown')
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Small delay between batches
            if (i + batchSize < texts.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        return results;
    }
}

// Demo function
async function demoScamAnalysis() {
    console.log('Groq Gemma 2 9B IT Scam Analysis Demo');
    console.log('======================================\n');

    const apiKey = process.env.GROQ_API_KEY || 'your-groq-api-key-here';
    
    if (apiKey === 'your-groq-api-key-here') {
        console.log('Please set your GROQ_API_KEY environment variable');
        console.log('Get your key from: [https://console.groq.com/](https://console.groq.com/)');
        console.log('For demo purposes, using local pattern matching only');
    }

    const analyzer = new ScamAnalyzer(apiKey);

    // Test scenarios with expected outcomes
    const testScenarios = [
        {
            speaker: 'caller',
            text: "Hello, this is John from Microsoft technical support. We've detected suspicious activity on your computer that requires immediate attention.",
            expected: 'HIGH'
        },
        {
            speaker: 'user',
            text: "Really? What kind of suspicious activity? I haven't noticed anything wrong."
        },
        {
            speaker: 'caller',
            text: "Your computer has been infected with a dangerous virus. You need to download TeamViewer right now so I can help you remove it before your files are stolen.",
            expected: 'HIGH'
        },
        {
            speaker: 'caller',
            text: "This is Agent Johnson from the IRS. You owe $5,000 in back taxes and we need immediate payment to avoid legal action and arrest.",
            expected: 'HIGH'
        },
        {
            speaker: 'caller',
            text: "This is your final notice about your car's extended warranty. It expires today and this is your last chance to renew coverage.",
            expected: 'MEDIUM'
        },
        {
            speaker: 'user',
            text: "Hi Sarah, thanks for joining today's quarterly review meeting. How are the marketing numbers looking?",
            expected: 'SAFE'
        },
        {
            speaker: 'caller',
            text: "I love you so much and I'm stuck overseas in an emergency. Could you wire me $2,000? Don't tell anyone about this.",
            expected: 'HIGH'
        }
    ];

    try {
        console.log('Testing Groq-powered scam detection...\n');

        let correctPredictions = 0;
        const results = [];

        for (let i = 0; i < testScenarios.length; i++) {
            const scenario = testScenarios[i];
            console.log(`\n--- Test ${i + 1}: ${scenario.speaker} ---`);
            console.log(`Text: "${scenario.text}"`);

            const startTime = Date.now();
            const analysis = await analyzer.analyzeText(scenario.text, scenario.speaker);
            const analysisTime = Date.now() - startTime;

            console.log(`Result: ${analysis.overallRisk.level}`);
            console.log(`Confidence: ${(analysis.overallRisk.confidence * 100).toFixed(1)}%`);
            console.log(`Processing Time: ${analysisTime}ms`);
            
            if (analysis.overallRisk.tacticsDetected?.length > 0) {
                console.log(`Tactics: ${analysis.overallRisk.tacticsDetected.join(', ')}`);
            }
            
            if (analysis.overallRisk.primaryScamType && analysis.overallRisk.primaryScamType !== 'unknown') {
                console.log(`Scam Type: ${analysis.overallRisk.primaryScamType}`);
            }

            if (scenario.expected) {
                const correct = analysis.overallRisk.level === scenario.expected ||
                              (scenario.expected === 'SAFE' && analysis.overallRisk.level === 'SAFE');
                console.log(`${correct ? 'Correct' : 'Incorrect'} Expected: ${scenario.expected}, Got: ${analysis.overallRisk.level}`);
                
                if (correct) correctPredictions++;
            }

            results.push(analysis);
            
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('\nDemo Results Summary:');
        console.log(`Accuracy: ${correctPredictions}/${testScenarios.filter(s => s.expected).length} (${((correctPredictions / testScenarios.filter(s => s.expected).length) * 100).toFixed(1)}%)`);
        
        const avgProcessingTime = results
            .filter(r => r.processingTime !== 'immediate' && r.processingTime !== 'error')
            .map(r => parseInt(r.processingTime))
            .reduce((sum, time) => sum + time, 0) / results.length;
        
        console.log(`Average Processing Time: ${avgProcessingTime.toFixed(0)}ms`);

        console.log('\nConversation Summary:');
        const summary = analyzer.getConversationSummary();
        console.log(`Total exchanges: ${summary.totalExchanges}`);
        console.log(`Participants: ${summary.participants.join(', ')}`);
        console.log(`Duration: ${summary.conversationDuration}ms`);

        console.log('\nGroq Gemma 2 9B IT demo completed successfully!');

        return results;

    } catch (error) {
        console.error('Demo failed:', error);
        return [];
    }
}

module.exports = {
    ScamAnalyzer,
    demoScamAnalysis
};

// Run demo if this file is executed directly
if (require.main === module) {
    demoScamAnalysis();
}