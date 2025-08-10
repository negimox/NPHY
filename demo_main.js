// demo_main.js - UPDATED with ASVspoof 2021 Pattern Analysis Integration
// Complete end-to-end scam detection demo with enhanced deepfake detection (Version 3.2)
// Features: Scam Detection + Enhanced Deepfake Detection (AASIST + ASVspoof) + Scammer Database + Real Audio Support

const fs = require('fs');
const path = require('path');
const { AudioProcessor } = require('./audio_processor');
const { ScamAnalyzer } = require('./scam_analyzer');
const { AlertSystem } = require('./alert_system');
const { DeepfakeDetector } = require('./deepfake_detector'); // Enhanced with ASVspoof
const { ScammerDatabase } = require('./scammer_database');

class ScamDetectionDemo {
    constructor(config = {}) {
        this.config = {
            elevenLabsApiKey: config.elevenLabsApiKey || process.env.XI_API_KEY,
            groqApiKey: config.groqApiKey || process.env.GROQ_API_KEY,
            truecallerApiKey: config.truecallerApiKey || process.env.TRUECALLER_API_KEY,
            nomoroboApiKey: config.nomoroboApiKey || process.env.NOMOROBO_API_KEY,
            playAudioAlerts: config.playAudioAlerts !== false,
            enableDeepfakeDetection: config.enableDeepfakeDetection !== false,
            enablePhoneCheck: config.enablePhoneCheck !== false,
            enableRealAudio: config.enableRealAudio !== false,
            logLevel: config.logLevel || 'INFO',
            outputDir: config.outputDir || './demo_output',
            // NEW: ASVspoof configuration
            enableASVspoof: config.enableASVspoof !== false,
            enableAASIST: config.enableAASIST !== false,
            asvspoof: {
                datasetPath: config.asvspoof?.datasetPath || './datasets',
                confidenceThreshold: config.asvspoof?.confidenceThreshold || 0.6,
                ensembleMode: config.asvspoof?.ensembleMode !== false
            }
        };

        // Initialize components
        this.audioProcessor = new AudioProcessor(this.config.elevenLabsApiKey);
        this.scamAnalyzer = new ScamAnalyzer(this.config.groqApiKey);
        this.alertSystem = new AlertSystem(this.config.elevenLabsApiKey);
        
        // Enhanced DeepfakeDetector with ASVspoof integration
        this.deepfakeDetector = new DeepfakeDetector({
            confidenceThreshold: 0.4,
            verbose: this.config.logLevel === 'DEBUG',
            enableASVspoof: this.config.enableASVspoof,
            enableAASIST: this.config.enableAASIST,
            ensembleMode: this.config.asvspoof.ensembleMode,
            asvspoof: {
                datasetPath: this.config.asvspoof.datasetPath,
                confidenceThreshold: this.config.asvspoof.confidenceThreshold
            }
        });
        
        this.scammerDatabase = new ScammerDatabase({
            truecallerApiKey: this.config.truecallerApiKey,
            nomoroboApiKey: this.config.nomoroboApiKey,
            verbose: this.config.logLevel === 'DEBUG'
        });

        // Demo state
        this.demoResults = [];
        this.isRunning = false;

        // Create output directory
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }

        // Create audio samples directory
        this.audioSamplesDir = path.join(__dirname, 'audio_samples');
        if (!fs.existsSync(this.audioSamplesDir)) {
            fs.mkdirSync(this.audioSamplesDir, { recursive: true });
        }

        // NEW: Create datasets directory for ASVspoof
        this.datasetsDir = path.join(__dirname, 'datasets');
        if (!fs.existsSync(this.datasetsDir)) {
            fs.mkdirSync(this.datasetsDir, { recursive: true });
        }
    }

    // Main demo flow with enhanced deepfake detection
    async runCompleteDemo() {
        console.log('Enhanced Scam Detection Demo v3.2 (AASIST + ASVspoof + Real Audio)');
        console.log('=======================================================================\n');

        this.isRunning = true;

        try {
            // Step 0: Initialize all detection systems with enhanced deepfake detection
            console.log('Step 0: Initializing enhanced detection systems...');
            await this.initializeEnhancedSystems();

            // Step 1: Setup and create test scenarios
            console.log('\nStep 1: Creating test scenarios with enhanced context...');
            await this.setupEnhancedTestScenarios();

            // Step 2: Process audio and transcribe
            console.log('\nStep 2: Processing audio with enhanced analysis...');
            const transcriptions = await this.processAudioScenarios();

            // Step 3: Enhanced analysis - scam + enhanced deepfake + phone check
            console.log('\nStep 3: Running enhanced threat analysis with ASVspoof patterns...');
            const analyses = await this.analyzeWithEnhancedDetection(transcriptions);

            // Step 4: Generate enhanced alerts
            console.log('\nStep 4: Generating enhanced security alerts...');
            const alerts = await this.generateEnhancedAlerts(analyses);

            // Step 5: Generate comprehensive report with ASVspoof insights
            console.log('\nStep 5: Generating comprehensive threat report with ASVspoof intelligence...');
            const report = await this.generateEnhancedReport(transcriptions, analyses, alerts);

            console.log('\nEnhanced demo v3.2 completed successfully!');
            console.log(`Results saved to: ${this.config.outputDir}`);

            return {
                success: true,
                transcriptions,
                analyses,
                alerts,
                report,
                version: '3.2'
            };

        } catch (error) {
            console.error('Enhanced demo failed:', error);
            return {
                success: false,
                error: error.message,
                version: '3.2'
            };
        } finally {
            this.isRunning = false;
        }
    }

    async initializeEnhancedSystems() {
        const initPromises = [];

        // Enhanced deepfake detection (AASIST + ASVspoof)
        if (this.config.enableDeepfakeDetection) {
            initPromises.push(this.deepfakeDetector.initializeModel());
        }

        // Phone database
        if (this.config.enablePhoneCheck) {
            initPromises.push(this.scammerDatabase.initializeDatabase());
        }

        await Promise.all(initPromises);

        // Print initialization summary
        console.log('Enhanced detection systems initialized:');
        if (this.config.enableDeepfakeDetection) {
            const detectionStats = this.deepfakeDetector.getDetectionStatistics();
            console.log(`   Deepfake Detection: ${detectionStats.methods_enabled.join(' + ')}`);
            if (detectionStats.asvspoof_stats) {
                console.log(`   ASVspoof Patterns: ${detectionStats.asvspoof_stats.total_entries} entries analyzed`);
            }
        }
        if (this.config.enablePhoneCheck) {
            console.log(`   Phone Database: Ready`);
        }
    }

    async setupEnhancedTestScenarios() {
        const scenarios = [
            {
                id: 'tech_support_scam_es', //Spanish Tech Support Scam
                name: 'Estafa de Soporte Técnico con TTS',
                description: 'Clásica estafa de soporte técnico de Microsoft utilizando texto a voz',
                phoneNumber: '+34-900-123-456',
                audioFile: path.join(this.audioSamplesDir, 'tech_support_scam_es.mp3'),
                // Enhanced context for ASVspoof analysis
                expectedAttackType: 'tts',
                targetSpeaker: 'p299', // Common VCTK speaker
                conversation: [
                    "Hola, le habla Juan del soporte técnico de Microsoft. Hemos detectado actividad sospechosa en su ordenador.",
                    "Su sistema ha sido comprometido y necesitamos acceso inmediato para solucionar la brecha de seguridad.",
                    "Por favor, descargue TeamViewer para que pueda ayudarle a eliminar el virus de su ordenador.",
                    "Si no actúa ahora, sus archivos personales y su información bancaria podrían ser robados."
                ],
                // ASVspoof pattern indicators
                asvspoof_context: {
                    likely_tts: true,
                    scam_keywords: ['microsoft', 'soporte técnico', 'virus informático', 'brecha de seguridad', 'inmediato'],
                    urgency_indicators: ['actúe ahora', 'inmediato'],
                    attack_pattern: 'suplantación_soporte_técnico'
                }
            },
            {
                id: 'irs_scam_voice_conversion',
                name: 'IRS Scam with Voice Conversion',
                description: 'Government impersonation using voice conversion',
                phoneNumber: '+1-202-123-4567',
                audioFile: path.join(this.audioSamplesDir, 'irs_scam.mp3'),
                expectedAttackType: 'vc',
                targetSpeaker: 'p230',
                sourceSpeaker: 'p277_358',
                conversation: [
                    "This is Agent Johnson from the Internal Revenue Service calling about your tax return.",
                    "You owe $5,000 in back taxes and penalties that must be paid immediately.",
                    "If payment is not received within 24 hours, we will issue a warrant for your arrest.",
                    "You can pay by credit card, bank transfer, or iTunes gift cards to resolve this matter."
                ],
                asvspoof_context: {
                    likely_vc: true,
                    scam_keywords: ['irs', 'tax return', 'back taxes', 'arrest warrant', 'payment'],
                    urgency_indicators: ['immediately', '24 hours', 'warrant'],
                    attack_pattern: 'government_impersonation'
                }
            },
            {
                id: 'normal_meeting',
                name: 'Réunion d’affaires normale', // French for "Normal Business Meeting"
                description: 'Conversation professionnelle légitime',
                phoneNumber: '+33-6-12-34-56-78',
                audioFile: path.join(this.audioSamplesDir, 'normal_meeting.mp3'),
                expectedAttackType: 'bonafide',
                conversation: [
                    "Bonjour à tous, merci de participer à la réunion trimestrielle d’aujourd’hui.",
                    "Commençons par examiner les chiffres de ventes du mois dernier.",
                    "Sarah, pourriez-vous partager votre écran et nous montrer les analyses marketing ?",
                    "Ces chiffres sont bons. Je pense que nous sommes sur la bonne voie pour atteindre nos objectifs annuels."
                ],
                asvspoof_context: {
                    likely_tts: false,
                    likely_vc: false,
                    scam_keywords: [],
                    urgency_indicators: [],
                    attack_pattern: 'legitimate_business'
                }
            },
            {
                id: 'deepfake_crypto_scam',
                name: 'Deepfake Cryptocurrency Scam',
                description: 'Advanced deepfake impersonating a CEO for crypto fraud',
                phoneNumber: '+1-555-999-8888',
                audioFile: path.join(this.audioSamplesDir, 'deepfake_crypto_scam.mp3'),
                expectedAttackType: 'deepfake',
                targetSpeaker: 'celebrity_voice',
                conversation: [
                    "Hello, this is Elon Musk. I'm announcing a special Bitcoin giveaway for my followers.",
                    "Send me any amount of Bitcoin and I'll send back double the amount within 30 minutes.",
                    "This is a limited time offer to give back to the crypto community.",
                    "You must act quickly as this offer expires in just one hour."
                ],
                asvspoof_context: {
                    likely_deepfake: true,
                    scam_keywords: ['bitcoin', 'giveaway', 'send back double', 'limited time'],
                    urgency_indicators: ['30 minutes', 'act quickly', 'expires', 'one hour'],
                    attack_pattern: 'celebrity_impersonation_crypto'
                }
            }
        ];

        // Save enhanced scenarios
        for (const scenario of scenarios) {
            const scenarioPath = path.join(this.config.outputDir, `${scenario.id}.json`);
            fs.writeFileSync(scenarioPath, JSON.stringify(scenario, null, 2));
            
            // Check for audio files and create text fallbacks
            const hasAudioFile = fs.existsSync(scenario.audioFile);
            
            if (hasAudioFile && this.config.enableRealAudio) {
                console.log(`   Found audio file: ${path.basename(scenario.audioFile)}`);
                const outputAudioPath = path.join(this.config.outputDir, `${scenario.id}.mp3`);
                fs.copyFileSync(scenario.audioFile, outputAudioPath);
            } else {
                console.log(`   Using text simulation: ${scenario.id}`);
                const textPath = path.join(this.config.outputDir, `${scenario.id}.txt`);
                fs.writeFileSync(textPath, scenario.conversation.join(' '));
            }
        }

        console.log(`Created ${scenarios.length} enhanced test scenarios with ASVspoof context`);
        this.checkASVspoofDatasets();
        
        return scenarios;
    }

    checkASVspoofDatasets() {
        console.log('\nASVspoof 2021 Dataset Check:');
        const requiredFiles = [
            'ASVspoof2021_LA_VCTK_MetaInfo.tsv',
            'ASVspoof2021_PA_VCTK_MetaInfo.tsv',
            'ASVspoof2021_DF_VCTK_MetaInfo.tsv',
            'ASVspoof2021_DF_VCC_MetaInfo.tsv'
        ];

        let foundFiles = 0;
        for (const file of requiredFiles) {
            const filePath = path.join(this.datasetsDir, file);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                console.log(`   ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
                foundFiles++;
            } else {
                console.log(`   ${file} - Not found`);
            }
        }

        if (foundFiles === 0) {
            console.log('\nTo enable ASVspoof pattern analysis:');
            console.log(`   1. Download ASVspoof 2021 metadata files`);
            console.log(`   2. Place them in: ${this.datasetsDir}`);
            console.log(`   3. Files needed: ${requiredFiles.join(', ')}`);
            console.log(`   4. The demo will use fallback pattern detection without these files`);
        } else {
            console.log(`\nASVspoof datasets: ${foundFiles}/${requiredFiles.length} files available`);
        }
    }

    // Enhanced analysis with ASVspoof pattern intelligence
    async analyzeWithEnhancedDetection(transcriptions) {
        const analyses = [];

        for (let i = 0; i < transcriptions.length; i++) {
            const transcription = transcriptions[i];
            
            if (transcription.error) {
                console.log(`Skipping failed transcription: ${transcription.scenarioId}`);
                continue;
            }

            console.log(`Enhanced analysis: ${transcription.scenarioId} (${transcription.audioSource || 'unknown'} source)`);

            try {
                // Get enhanced context for this scenario
                const scenarioContext = this.getEnhancedScenarioContext(transcription.scenarioId);
                const phoneNumber = this.getPhoneNumberForScenario(transcription.scenarioId);
                
                // Reset conversation context
                this.scamAnalyzer.resetConversation();

                // Run phone check first (fastest)
                let phoneCheck = null;
                if (this.config.enablePhoneCheck) {
                    phoneCheck = await this.checkPhoneNumber(phoneNumber);
                    this.logPhoneCheckResult(phoneCheck, phoneNumber);
                }

                // Enhanced chunk analysis with ASVspoof context
                const chunkAnalyses = [];
                for (const chunk of transcription.chunks) {
                    console.log(`   Processing chunk ${chunk.chunkId} with enhanced detection...`);
                    
                    // Parallel execution: scam analysis + enhanced deepfake detection
                    const [scamAnalysis, enhancedDeepfakeResult] = await Promise.all([
                        this.scamAnalyzer.analyzeText(chunk.text, 'speaker'),
                        this.config.enableDeepfakeDetection ? 
                            this.runEnhancedDeepfakeDetection(chunk, transcription, scenarioContext) :
                            Promise.resolve({ is_deepfake: false, confidence: 0.0, method: 'disabled' })
                    ]);

                    // Enhanced risk calculation with ASVspoof intelligence
                    const enhancedAnalysis = {
                        ...scamAnalysis,
                        enhancedDeepfakeDetection: enhancedDeepfakeResult,
                        enhancedRisk: this.calculateEnhancedRiskWithASVspoof(
                            scamAnalysis, 
                            enhancedDeepfakeResult, 
                            phoneCheck,
                            scenarioContext
                        )
                    };

                    chunkAnalyses.push(enhancedAnalysis);
                    this.logChunkAnalysisResult(chunk.chunkId, enhancedAnalysis, enhancedDeepfakeResult);
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Create overall enhanced scenario analysis
                const overallAnalysis = this.combineEnhancedAnalyses(
                    chunkAnalyses, 
                    transcription, 
                    phoneCheck, 
                    scenarioContext
                );
                analyses.push(overallAnalysis);

            } catch (error) {
                console.error(`Error in enhanced analysis ${transcription.scenarioId}:`, error);
                analyses.push({
                    scenarioId: transcription.scenarioId,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }

        console.log(`Completed enhanced analysis of ${analyses.length} scenarios`);
        return analyses;
    }

    async runEnhancedDeepfakeDetection(chunk, transcription, scenarioContext) {
        // Prepare enhanced context for deepfake detection
        const audioData = {
            duration: chunk.endTime - chunk.startTime,
            sampleRate: 16000,
            channels: 1
        };

        const detectionContext = {
            text: chunk.text,
            speaker: 'speaker',
            scenario: transcription.scenarioId,
            // ASVspoof specific context
            target_speaker: scenarioContext.targetSpeaker,
            source_speaker: scenarioContext.sourceSpeaker,
            expected_attack_type: scenarioContext.expectedAttackType,
            asvspoof_indicators: scenarioContext.asvspoof_context
        };

        return await this.deepfakeDetector.detectDeepfake(audioData, detectionContext);
    }

    getEnhancedScenarioContext(scenarioId) {
        // Load scenario context with ASVspoof information
        try {
            const scenarioPath = path.join(this.config.outputDir, `${scenarioId}.json`);
            if (fs.existsSync(scenarioPath)) {
                const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
                return {
                    targetSpeaker: scenario.targetSpeaker,
                    sourceSpeaker: scenario.sourceSpeaker,
                    expectedAttackType: scenario.expectedAttackType || 'unknown',
                    asvspoof_context: scenario.asvspoof_context || {}
                };
            }
        } catch (error) {
            console.warn(`Could not load scenario context for ${scenarioId}:`, error.message);
        }

        return {
            targetSpeaker: null,
            sourceSpeaker: null,
            expectedAttackType: 'unknown',
            asvspoof_context: {}
        };
    }

    calculateEnhancedRiskWithASVspoof(scamAnalysis, enhancedDeepfakeResult, phoneCheck, scenarioContext) {
        let riskScore = 0;
        let confidence = 0;
        const riskFactors = [];

        // Base scam risk
        const scamRisk = scamAnalysis.overallRisk;
        switch (scamRisk.level) {
            case 'HIGH': riskScore += 4; break;
            case 'MEDIUM': riskScore += 2; break;
            case 'LOW': riskScore += 1; break;
        }
        confidence += scamRisk.confidence * 0.3;

        // Enhanced deepfake risk (AASIST + ASVspoof)
        if (enhancedDeepfakeResult.is_deepfake) {
            const deepfakeConfidence = enhancedDeepfakeResult.confidence || 0;
            
            if (enhancedDeepfakeResult.method === 'enhanced_ensemble') {
                riskScore += 5; // Higher weight for ensemble detection
                confidence += deepfakeConfidence * 0.4;
                riskFactors.push('enhanced_synthetic_voice_detected');
                
                // ASVspoof specific patterns
                if (enhancedDeepfakeResult.details?.asvspoof) {
                    const avspoofResult = enhancedDeepfakeResult.details.asvspoof;
                    if (avspoofResult.detected_patterns && avspoofResult.detected_patterns.length > 0) {
                        riskScore += 2;
                        riskFactors.push('asvspoof_patterns_detected');
                        riskFactors.push(...avspoofResult.detected_patterns.map(p => `pattern_${p.type}`).slice(0, 3));
                    }
                }
                
                // AASIST neural detection
                if (enhancedDeepfakeResult.details?.aasist && enhancedDeepfakeResult.details.aasist.is_deepfake) {
                    riskScore += 2;
                    riskFactors.push('aasist_neural_detection');
                }
            } else {
                riskScore += 3; // Standard deepfake detection
                confidence += deepfakeConfidence * 0.3;
                riskFactors.push('synthetic_voice_detected');
            }
        } else {
            confidence += (1 - (enhancedDeepfakeResult.confidence || 0)) * 0.1;
        }

        // Phone number risk (highest priority)
        if (phoneCheck && phoneCheck.isScammer) {
            riskScore += 5;
            confidence += phoneCheck.confidence * 0.3;
            riskFactors.push('known_scammer_number');
            
            // Enhanced threat: Phone + Enhanced Deepfake + Scam patterns
            if (scamRisk.level === 'HIGH' && enhancedDeepfakeResult.is_deepfake) {
                riskScore += 4; // Extra bonus for triple enhanced threat
                riskFactors.push('enhanced_triple_threat_detected');
            }
        } else if (phoneCheck && phoneCheck.riskLevel === 'MEDIUM') {
            riskScore += 1;
            confidence += phoneCheck.confidence * 0.2;
            riskFactors.push('suspicious_number_pattern');
        }

        // ASVspoof context bonus
        if (scenarioContext.asvspoof_context) {
            const asvContext = scenarioContext.asvspoof_context;
            
            if (asvContext.likely_tts && enhancedDeepfakeResult.details?.asvspoof?.pattern_matches?.text) {
                riskScore += 1;
                riskFactors.push('tts_pattern_correlation');
            }
            
            if (asvContext.likely_vc && scenarioContext.targetSpeaker) {
                riskScore += 1;
                riskFactors.push('voice_conversion_correlation');
            }
            
            if (asvContext.scam_keywords && asvContext.scam_keywords.length > 0) {
                riskScore += 1;
                riskFactors.push('asvspoof_scam_keyword_match');
            }
        }

        // Determine enhanced risk level
        let level = 'SAFE';
        if (riskScore >= 15) {
            level = 'MAXIMUM'; // New highest level for enhanced detection
        } else if (riskScore >= 12) {
            level = 'CRITICAL';
        } else if (riskScore >= 8) {
            level = 'HIGH';
        } else if (riskScore >= 4) {
            level = 'MEDIUM';
        } else if (riskScore >= 1) {
            level = 'LOW';
        }

        confidence = Math.min(confidence, 1.0);

        return {
            level,
            confidence,
            score: riskScore,
            riskFactors,
            scamRisk: scamRisk.level,
            enhancedDeepfakeRisk: enhancedDeepfakeResult.is_deepfake ? 'DETECTED' : 'NOT_DETECTED',
            deepfakeMethod: enhancedDeepfakeResult.method || 'unknown',
            phoneRisk: phoneCheck ? phoneCheck.riskLevel : 'NOT_CHECKED',
            asvspoof_intelligence: enhancedDeepfakeResult.details?.asvspoof?.metadata_intelligence || null
        };
    }

    combineEnhancedAnalyses(chunkAnalyses, transcription, phoneCheck, scenarioContext) {
        const validAnalyses = chunkAnalyses.filter(a => !a.error);
        
        if (validAnalyses.length === 0) {
            return {
                scenarioId: transcription.scenarioId,
                overallRisk: { level: 'ERROR', confidence: 0 },
                error: 'No valid analyses',
                timestamp: Date.now()
            };
        }

        // Enhanced risk calculations
        const enhancedRiskScores = validAnalyses.map(a => a.enhancedRisk.score);
        const maxEnhancedScore = Math.max(...enhancedRiskScores);
        const avgEnhancedScore = enhancedRiskScores.reduce((a, b) => a + b, 0) / enhancedRiskScores.length;
        const avgConfidence = validAnalyses.reduce((sum, a) => sum + a.enhancedRisk.confidence, 0) / validAnalyses.length;

        // Determine overall enhanced risk level
        let overallEnhancedLevel = 'SAFE';
        if (maxEnhancedScore >= 15) overallEnhancedLevel = 'MAXIMUM';
        else if (maxEnhancedScore >= 12) overallEnhancedLevel = 'CRITICAL';
        else if (maxEnhancedScore >= 8) overallEnhancedLevel = 'HIGH';
        else if (maxEnhancedScore >= 4) overallEnhancedLevel = 'MEDIUM';
        else if (maxEnhancedScore >= 1) overallEnhancedLevel = 'LOW';

        // Collect enhanced deepfake detections
        const enhancedDeepfakeDetections = validAnalyses.filter(a => a.enhancedDeepfakeDetection?.is_deepfake);
        const hasEnhancedDeepfake = enhancedDeepfakeDetections.length > 0;

        // ASVspoof specific statistics
        const avspoofDetections = validAnalyses.filter(a => 
            a.enhancedDeepfakeDetection?.details?.asvspoof?.asvspoof_risk !== 'SAFE'
        );

        const aasistDetections = validAnalyses.filter(a => 
            a.enhancedDeepfakeDetection?.details?.aasist?.is_deepfake
        );

        // Collect all risk factors
        const allRiskFactors = validAnalyses.flatMap(a => a.enhancedRisk.riskFactors || []);
        const uniqueRiskFactors = [...new Set(allRiskFactors)];

        return {
            scenarioId: transcription.scenarioId,
            fullText: transcription.fullText,
            phoneNumber: phoneCheck ? phoneCheck.phoneNumber : 'Unknown',
            audioSource: transcription.audioSource,
            scenarioContext: scenarioContext,
            overallRisk: {
                level: overallEnhancedLevel,
                confidence: avgConfidence,
                score: avgEnhancedScore,
                maxScore: maxEnhancedScore,
                riskFactors: uniqueRiskFactors
            },
            phoneAnalysis: phoneCheck,
            enhancedDeepfakeAnalysis: {
                detected: hasEnhancedDeepfake,
                detectionCount: enhancedDeepfakeDetections.length,
                totalChunks: validAnalyses.length,
                averageConfidence: enhancedDeepfakeDetections.length > 0 ? 
                    enhancedDeepfakeDetections.reduce((sum, a) => sum + a.enhancedDeepfakeDetection.confidence, 0) / enhancedDeepfakeDetections.length : 0,
                methods: {
                    asvspoof_detections: avspoofDetections.length,
                    aasist_detections: aasistDetections.length,
                    ensemble_detections: enhancedDeepfakeDetections.filter(a => 
                        a.enhancedDeepfakeDetection.method === 'enhanced_ensemble'
                    ).length
                }
            },
            chunkAnalyses: validAnalyses,
            summary: {
                totalChunks: chunkAnalyses.length,
                validChunks: validAnalyses.length,
                maximumRiskChunks: validAnalyses.filter(a => a.enhancedRisk.level === 'MAXIMUM').length,
                criticalRiskChunks: validAnalyses.filter(a => a.enhancedRisk.level === 'CRITICAL').length,
                highRiskChunks: validAnalyses.filter(a => a.enhancedRisk.level === 'HIGH').length,
                enhancedDeepfakeChunks: enhancedDeepfakeDetections.length,
                avspoofDetectionChunks: avspoofDetections.length,
                aasistDetectionChunks: aasistDetections.length,
                phoneRisk: phoneCheck ? phoneCheck.riskLevel : 'NOT_CHECKED'
            },
            timestamp: Date.now()
        };
    }

    async generateEnhancedReport(transcriptions, analyses, alerts) {
        const report = {
            demoInfo: {
                timestamp: new Date().toISOString(),
                version: '3.2.0',
                featuresEnabled: {
                    scamDetection: true,
                    enhancedDeepfakeDetection: this.config.enableDeepfakeDetection,
                    aasistDetection: this.config.enableAASIST,
                    avspoofPatternAnalysis: this.config.enableASVspoof,
                    phoneNumberCheck: this.config.enablePhoneCheck,
                    realAudioProcessing: this.config.enableRealAudio,
                    groqWhisper: true,
                    audioAlerts: this.config.playAudioAlerts,
                    ensembleMode: this.config.asvspoof.ensembleMode
                }
            },
            summary: {
                totalScenarios: transcriptions.length,
                successfulTranscriptions: transcriptions.filter(t => !t.error).length,
                successfulAnalyses: analyses.filter(a => !a.error).length,
                alertsGenerated: alerts.length,
                enhancedDeepfakesDetected: analyses.filter(a => a.enhancedDeepfakeAnalysis?.detected).length,
                avspoofPatternsDetected: this.countASVspoofDetections(analyses),
                aasistDetections: this.countAASISTDetections(analyses),
                scammerNumbersDetected: analyses.filter(a => a.phoneAnalysis?.isScammer).length,
                maximumThreatScenarios: analyses.filter(a => a.overallRisk?.level === 'MAXIMUM').length,
                realAudioProcessed: transcriptions.filter(t => t.audioSource === 'groq_whisper').length
            },
            enhancedDetectionStats: {
                detectionMethods: this.getEnabledDetectionMethods(),
                asvspoof: this.getASVspoofStatistics(),
                ensemble: this.getEnsembleStatistics(analyses)
            },
            threatBreakdown: {},
            detectedThreats: {
                enhancedScamPatterns: {},
                enhancedDeepfakeVoices: 0,
                avspoofPatterns: 0,
                aasistDetections: 0,
                scammerNumbers: 0,
                enhancedCombinedThreats: 0
            },
            scenarioResults: [],
            recommendations: []
        };

        // Enhanced statistics calculations
        analyses.forEach(analysis => {
            if (!analysis.error) {
                const level = analysis.overallRisk.level;
                report.threatBreakdown[level] = (report.threatBreakdown[level] || 0) + 1;

                // Enhanced detection statistics
                if (analysis.enhancedDeepfakeAnalysis?.detected) {
                    report.detectedThreats.enhancedDeepfakeVoices++;
                    
                    if (analysis.enhancedDeepfakeAnalysis.methods.asvspoof_detections > 0) {
                        report.detectedThreats.avspoofPatterns++;
                    }
                    
                    if (analysis.enhancedDeepfakeAnalysis.methods.aasist_detections > 0) {
                        report.detectedThreats.aasistDetections++;
                    }
                }

                if (analysis.phoneAnalysis?.isScammer) {
                    report.detectedThreats.scammerNumbers++;
                }

                // Enhanced combined threats
                if (analysis.phoneAnalysis?.isScammer && 
                    analysis.enhancedDeepfakeAnalysis?.detected &&
                    analysis.overallRisk.level === 'MAXIMUM') {
                    report.detectedThreats.enhancedCombinedThreats++;
                }

                // Add enhanced scenario result
                report.scenarioResults.push({
                    scenarioId: analysis.scenarioId,
                    threatLevel: analysis.overallRisk.level,
                    confidence: analysis.overallRisk.confidence,
                    phoneRisk: analysis.phoneAnalysis?.riskLevel || 'Not checked',
                    enhancedDeepfakeDetected: analysis.enhancedDeepfakeAnalysis?.detected || false,
                    avspoofDetected: analysis.enhancedDeepfakeAnalysis?.methods?.asvspoof_detections > 0,
                    aasistDetected: analysis.enhancedDeepfakeAnalysis?.methods?.aasist_detections > 0,
                    audioSource: analysis.audioSource || 'unknown',
                    riskFactors: analysis.overallRisk.riskFactors || [],
                    expectedAttackType: analysis.scenarioContext?.expectedAttackType || 'unknown'
                });
            }
        });

        // Generate enhanced recommendations
        report.recommendations = this.generateEnhancedRecommendations(report);

        // Save enhanced report
        const reportPath = path.join(this.config.outputDir, 'enhanced_threat_report_v3.2.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(`Enhanced report v3.2 saved to: ${reportPath}`);
        this.printEnhancedReportSummary(report);

        return report;
    }

    // Helper methods for enhanced reporting
    countASVspoofDetections(analyses) {
        return analyses.filter(a => 
            a.enhancedDeepfakeAnalysis?.methods?.asvspoof_detections > 0
        ).length;
    }

    countAASISTDetections(analyses) {
        return analyses.filter(a => 
            a.enhancedDeepfakeAnalysis?.methods?.aasist_detections > 0
        ).length;
    }

    getEnabledDetectionMethods() {
        const methods = [];
        if (this.config.enableAASIST) methods.push('AASIST');
        if (this.config.enableASVspoof) methods.push('ASVspoof_Patterns');
        return methods;
    }

    getASVspoofStatistics() {
        if (this.config.enableASVspoof && this.deepfakeDetector) {
            const stats = this.deepfakeDetector.getDetectionStatistics();
            return stats.asvspoof_stats || null;
        }
        return null;
    }

    getEnsembleStatistics(analyses) {
        const ensembleStats = {
            total_ensemble_detections: 0,
            consensus_detections: 0,
            disagreement_cases: 0,
            aasist_dominant: 0,
            asvspoof_dominant: 0
        };

        analyses.forEach(analysis => {
            if (analysis.enhancedDeepfakeAnalysis?.detected) {
                ensembleStats.total_ensemble_detections++;
                
                const riskFactors = analysis.overallRisk.riskFactors || [];
                if (riskFactors.includes('consensus_detection')) {
                    ensembleStats.consensus_detections++;
                } else if (riskFactors.includes('detection_disagreement')) {
                    ensembleStats.disagreement_cases++;
                    
                    if (riskFactors.includes('aasist_dominant')) {
                        ensembleStats.aasist_dominant++;
                    } else if (riskFactors.includes('asvspoof_dominant')) {
                        ensembleStats.asvspoof_dominant++;
                    }
                }
            }
        });

        return ensembleStats;
    }

    generateEnhancedRecommendations(report) {
        const recommendations = [];

        if (report.detectedThreats.enhancedCombinedThreats > 0) {
            recommendations.push({
                priority: 'CRITICAL',
                category: 'Enhanced Multi-Vector Threat Detection',
                recommendation: 'Deploy real-time ensemble detection with automatic call termination',
                details: `Detected ${report.detectedThreats.enhancedCombinedThreats} scenarios with enhanced multi-vector threats (phone + deepfake + scam patterns)`
            });
        }

        if (report.detectedThreats.avspoofPatterns > 0) {
            recommendations.push({
                priority: 'HIGH',
                category: 'ASVspoof Pattern Intelligence',
                recommendation: 'Integrate ASVspoof pattern database for real-time TTS/VC detection',
                details: `ASVspoof patterns detected ${report.detectedThreats.avspoofPatterns} potential synthetic voice attacks`
            });
        }

        if (report.detectedThreats.aasistDetections > 0) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Neural Audio Authentication',
                recommendation: 'Deploy AASIST neural network for real-time deepfake detection',
                details: `AASIST detected ${report.detectedThreats.aasistDetections} potential neural synthetic voices`
            });
        }

        if (report.enhancedDetectionStats.ensemble?.disagreement_cases > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Ensemble Model Tuning',
                recommendation: 'Fine-tune ensemble weights and add human verification for disagreement cases',
                details: `Found ${report.enhancedDetectionStats.ensemble.disagreement_cases} cases where detection methods disagreed`
            });
        }

        return recommendations;
    }

    printEnhancedReportSummary(report) {
        console.log('\nENHANCED THREAT REPORT SUMMARY v3.2');
        console.log('=====================================');
        console.log(`Total Scenarios Analyzed: ${report.summary.totalScenarios}`);
        console.log(`Real Audio Processed: ${report.summary.realAudioProcessed}`);
        console.log(`Scammer Numbers Detected: ${report.detectedThreats.scammerNumbers}`);
        console.log(`Enhanced Deepfake Voices: ${report.detectedThreats.enhancedDeepfakeVoices}`);
        console.log(`ASVspoof Pattern Detections: ${report.detectedThreats.avspoofPatterns}`);
        console.log(`AASIST Neural Detections: ${report.detectedThreats.aasistDetections}`);
        console.log(`Enhanced Combined Threats: ${report.detectedThreats.enhancedCombinedThreats}`);
        console.log(`Maximum Threat Scenarios: ${report.summary.maximumThreatScenarios}`);
        
        if (report.enhancedDetectionStats.ensemble) {
            const ensemble = report.enhancedDetectionStats.ensemble;
            console.log(`Ensemble Consensus: ${ensemble.consensus_detections}/${ensemble.total_ensemble_detections}`);
            if (ensemble.disagreement_cases > 0) {
                console.log(`Detection Disagreements: ${ensemble.disagreement_cases}`);
            }
        }
        
        if (report.enhancedDetectionStats.asvspoof) {
            const asvspoof = report.enhancedDetectionStats.asvspoof;
            console.log(`ASVspoof Database: ${asvspoof.total_entries} entries analyzed`);
        }
        
        if (report.recommendations.length > 0) {
            console.log(`\nEnhanced Security Recommendations: ${report.recommendations.length}`);
            report.recommendations.forEach((rec, i) => {
                console.log(`   ${i + 1}. [${rec.priority}] ${rec.recommendation}`);
            });
        }
    }

    // Helper logging methods
    logPhoneCheckResult(phoneCheck, phoneNumber) {
        if (phoneCheck.isScammer) {
            console.log(`   SCAMMER NUMBER DETECTED: ${phoneNumber} (${(phoneCheck.confidence * 100).toFixed(1)}% confidence)`);
            console.log(`   Sources: ${phoneCheck.sources.join(', ')}`);
        } else {
            console.log(`   Phone number check: ${phoneCheck.riskLevel} risk`);
        }
    }

    logChunkAnalysisResult(chunkId, enhancedAnalysis, enhancedDeepfakeResult) {
        console.log(`   Chunk ${chunkId}: ${enhancedAnalysis.enhancedRisk.level} risk (${(enhancedAnalysis.enhancedRisk.confidence * 100).toFixed(1)}%)`);
        
        if (enhancedDeepfakeResult.is_deepfake) {
            console.log(`   ENHANCED DEEPFAKE DETECTED: ${(enhancedDeepfakeResult.confidence * 100).toFixed(1)}% confidence`);
            console.log(`   Method: ${enhancedDeepfakeResult.method}`);
            
            if (enhancedDeepfakeResult.details?.asvspoof?.detected_patterns) {
                console.log(`   ASVspoof patterns: ${enhancedDeepfakeResult.details.asvspoof.detected_patterns.length}`);
            }
            
            if (enhancedDeepfakeResult.details?.aasist?.is_deepfake) {
                console.log(`   AASIST detection: ${(enhancedDeepfakeResult.details.aasist.confidence * 100).toFixed(1)}%`);
            }
        }
    }

    // Keep existing methods for audio processing, phone checking, etc.
    // [Previous methods remain unchanged...]
    
    async processAudioScenarios() {
        // [Keep existing implementation from original demo_main.js]
        const transcriptions = [];
        const outputFiles = fs.readdirSync(this.config.outputDir);
        
        const audioFiles = outputFiles.filter(file => file.endsWith('.mp3'));
        const textFiles = outputFiles.filter(file => file.endsWith('.txt'));
        
        for (const file of audioFiles) {
            const filePath = path.join(this.config.outputDir, file);
            const scenarioId = path.basename(file, '.mp3');
            
            console.log(`Processing audio file: ${scenarioId}`);

            try {
                const transcription = await this.processRealAudioFile(filePath, scenarioId);
                transcriptions.push(transcription);
            } catch (error) {
                console.error(`Error processing audio ${scenarioId}:`, error);
                const textFallback = path.join(this.config.outputDir, `${scenarioId}.txt`);
                if (fs.existsSync(textFallback)) {
                    console.log(`Falling back to text processing for: ${scenarioId}`);
                    const textTranscription = await this.processTextFile(textFallback, scenarioId);
                    transcriptions.push(textTranscription);
                } else {
                    transcriptions.push({
                        scenarioId,
                        error: error.message,
                        timestamp: Date.now()
                    });
                }
            }
        }
        
        for (const file of textFiles) {
            const scenarioId = path.basename(file, '.txt');
            
            if (audioFiles.some(audioFile => audioFile.startsWith(scenarioId))) {
                continue;
            }
            
            const filePath = path.join(this.config.outputDir, file);
            console.log(`Processing text file: ${scenarioId}`);

            try {
                const transcription = await this.processTextFile(filePath, scenarioId);
                transcriptions.push(transcription);
            } catch (error) {
                console.error(`Error processing text ${scenarioId}:`, error);
                transcriptions.push({
                    scenarioId,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }

        console.log(`Completed transcription of ${transcriptions.length} scenarios`);
        return transcriptions;
    }

    async processRealAudioFile(audioFilePath, scenarioId) {
        console.log(`Processing real audio with Groq Whisper: ${audioFilePath}`);
        
        try {
            const validation = this.validateAudioFile(audioFilePath);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            const transcription = await this.transcribeWithGroqWhisper(audioFilePath, scenarioId);
            return transcription;
            
        } catch (error) {
            console.error(`Groq Whisper processing failed: ${error.message}`);
            throw error;
        }
    }

    async transcribeWithGroqWhisper(audioFilePath, scenarioId) {
        console.log('Using Groq Whisper Large v3 Turbo for transcription...');
        
        if (!this.config.groqApiKey) {
            throw new Error('Groq API key not available');
        }

        const FormData = require('form-data');
        const fetch = require('node-fetch');
        
        try {
            const form = new FormData();
            form.append('file', fs.createReadStream(audioFilePath));
            form.append('model', 'whisper-large-v3-turbo');
            form.append('language', 'en');
            form.append('response_format', 'verbose_json');
            form.append('temperature', '0');

            const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.groqApiKey}`,
                    ...form.getHeaders()
                },
                body: form
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Groq API failed (${response.status}): ${errorText}`);
            }
            
            const result = await response.json();
            
            console.log(`Groq Whisper transcription completed (${result.duration || 'unknown'}s)`);
            
            let chunks;
            if (result.segments && result.segments.length > 0) {
                chunks = result.segments.map((segment, index) => ({
                    chunkId: index + 1,
                    text: segment.text.trim(),
                    startTime: segment.start,
                    endTime: segment.end,
                    confidence: segment.avg_logprob ? Math.exp(segment.avg_logprob) : 0.8
                }));
            } else {
                chunks = this.splitIntoChunks(result.text || 'No transcription available');
            }
            
            return {
                scenarioId,
                fullText: result.text || 'No transcription available',
                chunks: chunks,
                audioSource: 'groq_whisper',
                confidence: 0.9,
                duration: result.duration,
                language: result.language,
                timestamp: Date.now()
            };
            
        } catch (error) {
            throw new Error(`Groq Whisper transcription failed: ${error.message}`);
        }
    }

    async processTextFile(filePath, scenarioId) {
        console.log(`Processing text file: ${scenarioId}`);
        
        try {
            const generator = this.audioProcessor.simulateRealTimeProcessing(filePath);
            const chunkTranscriptions = [];

            for await (const chunk of generator) {
                chunkTranscriptions.push(chunk);
                console.log(`   Chunk ${chunk.chunkId}: "${chunk.text.substring(0, 60)}..."`);
            }

            return {
                scenarioId,
                fullText: chunkTranscriptions.map(c => c.text).join(' '),
                chunks: chunkTranscriptions,
                audioSource: 'text_simulation',
                timestamp: Date.now()
            };

        } catch (error) {
            throw new Error(`Text processing failed: ${error.message}`);
        }
    }

    splitIntoChunks(text, chunkDuration = 10) {
        const words = text.split(' ');
        const chunks = [];
        const wordsPerChunk = Math.ceil(words.length / Math.ceil(words.length / 15));
        
        for (let i = 0; i < words.length; i += wordsPerChunk) {
            const chunkWords = words.slice(i, i + wordsPerChunk);
            const chunkId = Math.floor(i / wordsPerChunk) + 1;
            
            chunks.push({
                chunkId,
                text: chunkWords.join(' '),
                startTime: (chunkId - 1) * chunkDuration,
                endTime: chunkId * chunkDuration,
                confidence: 0.8
            });
        }
        
        return chunks;
    }

    validateAudioFile(filePath) {
        if (!fs.existsSync(filePath)) {
            return { valid: false, error: 'Audio file does not exist' };
        }
        
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
            return { valid: false, error: 'Audio file is empty' };
        }
        
        if (stats.size > 25 * 1024 * 1024) {
            return { valid: false, error: 'Audio file too large (max 25MB for Groq)' };
        }
        
        const ext = path.extname(filePath).toLowerCase();
        const supportedFormats = ['.mp3', '.wav', '.m4a', '.flac', '.webm'];
        
        if (!supportedFormats.includes(ext)) {
            return { 
                valid: false, 
                error: `Unsupported format: ${ext}. Supported: ${supportedFormats.join(', ')}` 
            };
        }
        
        return { valid: true };
    }

    async checkPhoneNumber(phoneNumber) {
        if (!this.config.enablePhoneCheck) {
            return {
                phoneNumber,
                isScammer: false,
                confidence: 0.0,
                sources: [],
                riskLevel: 'NOT_CHECKED'
            };
        }

        try {
            const result = await this.scammerDatabase.checkNumber(phoneNumber);
            return result;
        } catch (error) {
            console.error(`Error checking phone number: ${error.message}`);
            return {
                phoneNumber,
                isScammer: false,
                confidence: 0.0,
                sources: [],
                riskLevel: 'ERROR',
                error: error.message
            };
        }
    }

    getPhoneNumberForScenario(scenarioId) {
        const phoneNumbers = {
            'tech_support_scam_es': '+34-900-123-456',
            'irs_scam_voice_conversion': '+1-202-123-4567',
            'normal_meeting': '+33-6-12-34-56-78',
            'deepfake_crypto_scam': '+1-555-999-8888'
        };
        
        return phoneNumbers[scenarioId] || '+1-555-000-0000';
    }

    async generateEnhancedAlerts(analyses) {
        const alerts = [];

        for (const analysis of analyses) {
            if (analysis.error || analysis.overallRisk.level === 'SAFE') {
                continue;
            }

            const riskLevel = analysis.overallRisk.level;
            const hasEnhancedDeepfake = analysis.enhancedDeepfakeAnalysis?.detected || false;
            const hasScammerPhone = analysis.phoneAnalysis?.isScammer || false;
            const hasASVspoofDetection = analysis.enhancedDeepfakeAnalysis?.methods?.asvspoof_detections > 0;
            const hasAASISTDetection = analysis.enhancedDeepfakeAnalysis?.methods?.aasist_detections > 0;
            
            console.log(`Generating enhanced alert for: ${analysis.scenarioId}`);
            console.log(`   Risk Level: ${riskLevel}`);
            console.log(`   Enhanced Deepfake: ${hasEnhancedDeepfake ? 'DETECTED' : 'Not detected'}`);
            console.log(`   ASVspoof Patterns: ${hasASVspoofDetection ? 'DETECTED' : 'Not detected'}`);
            console.log(`   AASIST Detection: ${hasAASISTDetection ? 'DETECTED' : 'Not detected'}`);
            console.log(`   Phone Risk: ${analysis.phoneAnalysis?.riskLevel || 'Unknown'}`);

            try {
                let alertStyle = 'discreet';
                if (riskLevel === 'MAXIMUM' || (hasScammerPhone && hasEnhancedDeepfake)) {
                    alertStyle = 'emergency';
                } else if (riskLevel === 'CRITICAL' || hasScammerPhone) {
                    alertStyle = 'immediate';
                } else if (riskLevel === 'HIGH') {
                    alertStyle = 'urgent';
                }

                const alertContext = {
                    ...analysis,
                    alertStyle: alertStyle,
                    language: 'en',
                    enhancedDeepfakeDetected: hasEnhancedDeepfake,
                    avspoofDetected: hasASVspoofDetection,
                    aasistDetected: hasAASISTDetection,
                    scammerPhoneDetected: hasScammerPhone,
                    threatLevel: riskLevel,
                    riskFactors: analysis.overallRisk.riskFactors,
                    audioSource: analysis.audioSource
                };

                const alert = await this.alertSystem.createAlert(alertContext, {
                    playImmediately: this.config.playAudioAlerts,
                    alertStyle: alertStyle,
                    language: 'en',
                    includePhoneWarning: hasScammerPhone,
                    includeDeepfakeWarning: hasEnhancedDeepfake,
                    includeASVspoofWarning: hasASVspoofDetection,
                    includeAASISTWarning: hasAASISTDetection
                });

                if (alert && !alert.error) {
                    alerts.push(alert);
                    console.log(`   Enhanced alert created: "${alert.alertText}"`);
                } else {
                    console.log(`   Alert creation failed: ${alert?.error || 'Unknown error'}`);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`Error creating enhanced alert for ${analysis.scenarioId}:`, error);
            }
        }

        console.log(`Generated ${alerts.length} enhanced alerts`);
        return alerts;
    }

    // Quick test method for ASVspoof integration
    async runASVspoofDemo() {
        console.log('ASVspoof Pattern Analysis Demo');
        console.log('=================================\n');

        try {
            await this.deepfakeDetector.initializeModel();
            const results = await this.deepfakeDetector.testEnhancedDetection();
            
            console.log('\nASVspoof demo completed successfully!');
            console.log(`Processed ${results.length} test scenarios`);
            
            return results;
            
        } catch (error) {
            console.error('ASVspoof demo failed:', error);
            throw error;
        }
    }

    cleanup() {
        try {
            if (fs.existsSync(this.config.outputDir)) {
                const files = fs.readdirSync(this.config.outputDir);
                files.forEach(file => {
                    fs.unlinkSync(path.join(this.config.outputDir, file));
                });
                fs.rmdirSync(this.config.outputDir);
                console.log('Demo files cleaned up');
            }
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    }
}

// Updated CLI interface with ASVspoof options
async function main() {
    const args = process.argv.slice(2);
    const mode = args[0] || 'full';

    const config = {
        elevenLabsApiKey: process.env.XI_API_KEY,
        groqApiKey: process.env.GROQ_API_KEY,
        truecallerApiKey: process.env.TRUECALLER_API_KEY,
        nomoroboApiKey: process.env.NOMOROBO_API_KEY,
        playAudioAlerts: !args.includes('--no-audio'),
        enableDeepfakeDetection: !args.includes('--no-deepfake'),
        enablePhoneCheck: !args.includes('--no-phone'),
        enableRealAudio: !args.includes('--no-real-audio'),
        enableASVspoof: !args.includes('--no-asvspoof'),
        enableAASIST: !args.includes('--no-aasist'),
        logLevel: args.includes('--verbose') ? 'DEBUG' : 'INFO',
        asvspoof: {
            datasetPath: './datasets',
            confidenceThreshold: 0.6,
            ensembleMode: !args.includes('--no-ensemble')
        }
    };

    // Handle special demo modes
    if (mode === 'asvspoof-only') {
        console.log('Running ASVspoof pattern analysis test only...');
        try {
            const demo = new ScamDetectionDemo(config);
            const results = await demo.runASVspoofDemo();
            
            console.log('\nASVspoof-only demo completed successfully!');
            console.log(`Processed test scenarios with enhanced detection`);
            return;
        } catch (error) {
            console.error('ASVspoof demo failed:', error);
            process.exit(1);
        }
    }

    if (mode === 'deepfake-only') {
        console.log('Running enhanced deepfake detection test only...');
        try {
            const { demoEnhancedDeepfakeDetection } = require('./deepfake_detector');
            const results = await demoEnhancedDeepfakeDetection();
            
            console.log('\nEnhanced deepfake-only demo completed successfully!');
            console.log(`Processed ${results.length} test scenarios`);
            return;
        } catch (error) {
            console.error('Enhanced deepfake demo failed:', error);
            process.exit(1);
        }
    }

    // Check API keys for modes that need them
    let keysMissing = false;
    if (!config.groqApiKey && (mode === 'full' || mode === 'quick' || config.enableRealAudio)) {
        console.error('ERROR: GROQ_API_KEY environment variable not set.');
        console.error('   Required for Groq Whisper transcription and scam analysis.');
        keysMissing = true;
    }

    if (keysMissing) {
        console.log('\nPlease set the required environment variables to run the demo.');
        console.log('Or use one of these modes that don\'t require API keys:');
        console.log('   - node demo_main.js asvspoof-only');
        console.log('   - node demo_main.js deepfake-only');
        printEnhancedSetupInstructions();
        process.exit(1);
    }

    const demo = new ScamDetectionDemo(config);

    try {
        let results;
        
        switch (mode) {
            case 'quick':
                results = await demo.runQuickDemo();
                break;
            case 'full':
            case 'complete':
                results = await demo.runCompleteDemo();
                break;
            case 'clean':
                demo.cleanup();
                return;
            default:
                console.log('Usage: node demo_main.js [mode] [options]');
                console.log('\nModes:');
                console.log('  quick           - Fast 2-scenario test');
                console.log('  full            - Complete enhanced demo with all features');
                console.log('  complete        - Same as full (alias)');
                console.log('  asvspoof-only   - Test ASVspoof pattern analysis only');
                console.log('  deepfake-only   - Test enhanced deepfake detection only');
                console.log('  clean           - Clean up demo files');
                console.log('\nOptions:');
                console.log('  --no-audio      - Skip audio playback');
                console.log('  --no-deepfake   - Disable enhanced deepfake detection');
                console.log('  --no-asvspoof   - Disable ASVspoof pattern analysis');
                console.log('  --no-aasist     - Disable AASIST neural detection');
                console.log('  --no-ensemble   - Disable ensemble mode (use best single method)');
                console.log('  --no-phone      - Disable phone number checking');
                console.log('  --no-real-audio - Disable real audio processing (use text simulation)');
                console.log('  --verbose       - Detailed logging');
                console.log('\nExamples:');
                console.log('  node demo_main.js full --verbose');
                console.log('  node demo_main.js full --no-aasist      # ASVspoof patterns only');
                console.log('  node demo_main.js full --no-asvspoof    # AASIST neural only');
                console.log('  node demo_main.js asvspoof-only');
                return;
        }

        if (results && results.success !== false) {
            console.log('\nEnhanced demo v3.2 completed successfully!');
            console.log('Check the demo_output directory for detailed results');
            
            if (config.enableASVspoof) {
                console.log('ASVspoof pattern analysis was enabled');
            }
            
            if (config.enableAASIST) {
                console.log('AASIST neural detection was enabled');
            }
            
            if (config.asvspoof.ensembleMode) {
                console.log('Ensemble mode was enabled');
            }
        }

    } catch (error) {
        console.error('Enhanced demo failed:', error);
        process.exit(1);
    }
}

function printEnhancedSetupInstructions() {
    console.log('\nEnhanced Setup Instructions (Version 3.2 - ASVspoof + AASIST):');
    console.log('====================================================================\n');
    
    console.log('1. Install Node.js dependencies:');
    console.log('   npm install node-fetch groq-sdk form-data\n');
    
    console.log('2. Install Python dependencies:');
    console.log('   pip install torch numpy scipy librosa pandas sklearn\n');
    
    console.log('3. Create required files:');
    console.log('   - asvspoof_pattern_analyzer.js (provided)');
    console.log('   - deepfake_detector.js (enhanced)');
    console.log('   - aasist_bridge.py (existing)');
    console.log('   - scammer_database.js (existing)\n');
    
    console.log('4. Create directory structure:');
    console.log('   mkdir -p audio_samples datasets');
    console.log('   # Add your MP3 files to audio_samples/');
    console.log('   # Add ASVspoof metadata files to datasets/\n');
    
    console.log('5. Download ASVspoof 2021 metadata (recommended):');
    console.log('   Place these files in ./datasets/:');
    console.log('   - ASVspoof2021_LA_VCTK_MetaInfo.tsv');
    console.log('   - ASVspoof2021_PA_VCTK_MetaInfo.tsv'); 
    console.log('   - ASVspoof2021_DF_VCTK_MetaInfo.tsv');
    console.log('   - ASVspoof2021_DF_VCC_MetaInfo.tsv\n');
    
    console.log('6. Set environment variables:');
    console.log('   export GROQ_API_KEY="your-groq-api-key"        # Required');
    console.log('   export XI_API_KEY="your-elevenlabs-api-key"    # Optional for TTS alerts\n');
    
    console.log('7. Run enhanced demos:');
    console.log('   node demo_main.js asvspoof-only    # Test ASVspoof patterns');
    console.log('   node demo_main.js deepfake-only    # Test enhanced deepfake detection');
    console.log('   node demo_main.js full             # Complete enhanced demo\n');
    
    console.log('Enhanced Features (Version 3.2):');
    console.log('   • ASVspoof 2021 pattern analysis (TTS/VC/Deepfake detection)');
    console.log('   • AASIST neural network integration');
    console.log('   • Ensemble detection (AASIST + ASVspoof patterns)');
    console.log('   • Groq Whisper Large v3 Turbo transcription');
    console.log('   • Real MP3/WAV audio file processing');
    console.log('   • Real-time scammer number database');
    console.log('   • Enhanced scam pattern recognition');
    console.log('   • Multi-factor threat analysis with ASVspoof intelligence');
    console.log('   • Advanced risk levels (SAFE → LOW → MEDIUM → HIGH → CRITICAL → MAXIMUM)');
    console.log('   • Comprehensive threat reporting with ASVspoof insights');
    console.log('   • Quadruple threat detection (Phone + AASIST + ASVspoof + Content)');
}

module.exports = {
    ScamDetectionDemo,
    main,
    printEnhancedSetupInstructions
};

// Run if executed directly
if (require.main === module) {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        printEnhancedSetupInstructions();
    } else {
        main();
    }
}
