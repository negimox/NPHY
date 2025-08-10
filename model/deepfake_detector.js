// deepfake_detector.js (Enhanced with ASVspoof Pattern Analysis)
// Combined AASIST + ASVspoof Pattern Analysis for comprehensive synthetic voice detection

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ASVspoofPatternAnalyzer } = require('./asvspoof_pattern_analyzer');

class DeepfakeDetector {
    constructor(config = {}) {
        this.config = {
            confidenceThreshold: config.confidenceThreshold || 0.4,
            verbose: config.verbose || false,
            pythonExecutable: config.pythonExecutable || 'python3',
            aasistModelPath: config.aasistModelPath || './models/aasist',
            enableASVspoof: config.enableASVspoof !== false,
            enableAASIST: config.enableAASIST !== false,
            ensembleMode: config.ensembleMode !== false, // Combine both methods
            asvspoof: {
                datasetPath: config.asvspoof?.datasetPath || './datasets',
                confidenceThreshold: config.asvspoof?.confidenceThreshold || 0.6
            }
        };

        this.isInitialized = false;
        this.aasistReady = false;
        this.avspoofAnalyzer = null;
        
        // Initialize ASVspoof analyzer if enabled
        if (this.config.enableASVspoof) {
            this.avspoofAnalyzer = new ASVspoofPatternAnalyzer({
                datasetPath: this.config.asvspoof.datasetPath,
                confidenceThreshold: this.config.asvspoof.confidenceThreshold,
                verbose: this.config.verbose
            });
        }
    }

    async initializeModel() {
        if (this.isInitialized) return;

        console.log('Initializing Enhanced Deepfake Detection System...');
        
        try {
            // Initialize ASVspoof Pattern Analyzer first (faster)
            if (this.config.enableASVspoof && this.avspoofAnalyzer) {
                console.log('Initializing ASVspoof pattern analysis...');
                await this.avspoofAnalyzer.initialize();
                console.log('ASVspoof pattern analyzer ready');
            }

            // Initialize AASIST model (slower)
            if (this.config.enableAASIST) {
                console.log('Initializing AASIST model...');
                await this.initializeAASIST();
                console.log('AASIST model ready');
            }

            this.isInitialized = true;
            
            const methods = [];
            if (this.config.enableASVspoof) methods.push('ASVspoof Pattern Analysis');
            if (this.config.enableAASIST) methods.push('AASIST Neural Network');
            
            console.log(`Enhanced deepfake detector initialized with: ${methods.join(' + ')}`);

        } catch (error) {
            console.error('Failed to initialize deepfake detector:', error.message);
            throw error;
        }
    }

    async initializeAASIST() {
        // Check if AASIST bridge is available
        const aasistBridgePath = path.join(__dirname, 'aasist_bridge.py');
        
        if (!fs.existsSync(aasistBridgePath)) {
            console.warn('AASIST bridge not found, skipping AASIST initialization');
            this.config.enableAASIST = false;
            return;
        }

        // Test AASIST bridge
        return new Promise((resolve, reject) => {
            const python = spawn(this.config.pythonExecutable, [aasistBridgePath, '--test']);
            
            let output = '';
            python.stdout.on('data', (data) => output += data.toString());
            python.stderr.on('data', (data) => output += data.toString());
            
            python.on('close', (code) => {
                if (code === 0) {
                    this.aasistReady = true;
                    resolve();
                } else {
                    console.warn('AASIST test failed, disabling AASIST detection');
                    this.config.enableAASIST = false;
                    resolve(); // Don't fail entire initialization
                }
            });
        });
    }

    // Enhanced detection combining AASIST + ASVspoof patterns
    async detectDeepfake(audioData, context = {}) {
        if (!this.isInitialized) {
            await this.initializeModel();
        }

        const detection = {
            is_deepfake: false,
            confidence: 0.0,
            method: 'enhanced_ensemble',
            details: {
                aasist: null,
                asvspoof: null,
                ensemble: null
            },
            risk_factors: [],
            timestamp: Date.now()
        };

        try {
            const detectionPromises = [];

            // Run AASIST detection
            if (this.config.enableAASIST && this.aasistReady) {
                detectionPromises.push(this.runAASISTDetection(audioData, context));
            }

            // Run ASVspoof pattern analysis
            if (this.config.enableASVspoof && this.avspoofAnalyzer) {
                detectionPromises.push(this.runASVspoofAnalysis(audioData, context));
            }

            // Execute detections in parallel
            const results = await Promise.allSettled(detectionPromises);
            
            // Process AASIST results
            if (results[0] && results[0].status === 'fulfilled') {
                detection.details.aasist = results[0].value;
            } else if (this.config.enableAASIST) {
                detection.details.aasist = { error: 'AASIST detection failed' };
            }

            // Process ASVspoof results
            const avspoofIndex = this.config.enableAASIST ? 1 : 0;
            if (results[avspoofIndex] && results[avspoofIndex].status === 'fulfilled') {
                detection.details.asvspoof = results[avspoofIndex].value;
            } else if (this.config.enableASVspoof) {
                detection.details.asvspoof = { error: 'ASVspoof analysis failed' };
            }

            // Combine results using ensemble method
            if (this.config.ensembleMode) {
                detection.details.ensemble = this.combineDetectionResults(
                    detection.details.aasist,
                    detection.details.asvspoof
                );
                
                detection.is_deepfake = detection.details.ensemble.is_deepfake;
                detection.confidence = detection.details.ensemble.confidence;
                detection.risk_factors = detection.details.ensemble.risk_factors;
            } else {
                // Use the highest confidence detection
                const validDetections = [
                    detection.details.aasist,
                    detection.details.asvspoof
                ].filter(d => d && !d.error);

                if (validDetections.length > 0) {
                    const bestDetection = validDetections.reduce((best, current) => 
                        (current.confidence || 0) > (best.confidence || 0) ? current : best
                    );
                    
                    detection.is_deepfake = bestDetection.is_deepfake || false;
                    detection.confidence = bestDetection.confidence || 0.0;
                    detection.risk_factors = bestDetection.risk_factors || [];
                }
            }

            if (this.config.verbose) {
                console.log(`Enhanced deepfake detection: ${detection.is_deepfake ? 'SYNTHETIC' : 'GENUINE'} (${(detection.confidence * 100).toFixed(1)}%)`);
                if (detection.details.aasist) {
                    console.log(`   AASIST: ${detection.details.aasist.is_deepfake ? 'SYNTHETIC' : 'GENUINE'} (${((detection.details.aasist.confidence || 0) * 100).toFixed(1)}%)`);
                }
                if (detection.details.asvspoof) {
                    console.log(`   ASVspoof: ${detection.details.asvspoof.asvspoof_risk} (${((detection.details.asvspoof.confidence || 0) * 100).toFixed(1)}%)`);
                }
            }

        } catch (error) {
            console.error('Enhanced deepfake detection error:', error);
            detection.error = error.message;
        }

        return detection;
    }

    async runAASISTDetection(audioData, context) {
        // Existing AASIST detection logic (placeholder for your current implementation)
        try {
            // This would use your existing aasist_bridge.py
            const aasistResult = await this.callAASISTBridge(audioData, context);
            
            return {
                is_deepfake: aasistResult.is_deepfake || false,
                confidence: aasistResult.confidence || 0.0,
                method: 'aasist',
                processing_time: aasistResult.processing_time || 0,
                model_version: aasistResult.model_version || 'unknown'
            };
        } catch (error) {
            throw new Error(`AASIST detection failed: ${error.message}`);
        }
    }

    async runASVspoofAnalysis(audioData, context) {
        try {
            // Prepare content for ASVspoof analysis
            const analysisContent = {
                text: context.text || '',
                audioFeatures: {
                    duration: audioData.duration || 0,
                    sampleRate: audioData.sampleRate || 16000,
                    channels: audioData.channels || 1
                }
            };

            // Prepare metadata
            const analysisMetadata = {
                speaker: context.speaker || 'unknown',
                target_speaker: context.target_speaker,
                source_speaker: context.source_speaker,
                scenario: context.scenario
            };

            // Run ASVspoof pattern analysis
            const avspoofResult = await this.avspoofAnalyzer.analyzeContent(analysisContent, analysisMetadata);
            
            return {
                asvspoof_risk: avspoofResult.asvspoof_risk,
                confidence: avspoofResult.confidence,
                is_deepfake: avspoofResult.asvspoof_risk !== 'SAFE',
                detected_patterns: avspoofResult.detected_patterns,
                risk_factors: avspoofResult.risk_factors,
                pattern_matches: avspoofResult.pattern_matches,
                metadata_intelligence: avspoofResult.metadata_intelligence,
                method: 'asvspoof_patterns'
            };
        } catch (error) {
            throw new Error(`ASVspoof analysis failed: ${error.message}`);
        }
    }

    combineDetectionResults(aasistResult, avspoofResult) {
        const ensemble = {
            is_deepfake: false,
            confidence: 0.0,
            risk_factors: [],
            combination_method: 'weighted_ensemble',
            individual_results: {
                aasist: aasistResult,
                asvspoof: avspoofResult
            }
        };

        try {
            let aasistWeight = 0.6;  // AASIST gets higher weight for audio analysis
            let avspoofWeight = 0.4; // ASVspoof gets weight for pattern analysis

            // Adjust weights based on confidence
            if (aasistResult && !aasistResult.error) {
                const aasistConfidence = aasistResult.confidence || 0;
                const aasistDetection = aasistResult.is_deepfake;
                
                if (avspoofResult && !avspoofResult.error) {
                    const avspoofConfidence = avspoofResult.confidence || 0;
                    const avspoofDetection = avspoofResult.is_deepfake;
                    
                    // Both methods available - use weighted ensemble
                    if (aasistDetection === avspoofDetection) {
                        // Both agree - high confidence
                        ensemble.is_deepfake = aasistDetection;
                        ensemble.confidence = (aasistConfidence * aasistWeight + avspoofConfidence * avspoofWeight);
                        ensemble.risk_factors.push('consensus_detection');
                    } else {
                        // Disagreement - use the more confident one but lower overall confidence
                        if (aasistConfidence > avspoofConfidence) {
                            ensemble.is_deepfake = aasistDetection;
                            ensemble.confidence = aasistConfidence * 0.7; // Reduce confidence due to disagreement
                            ensemble.risk_factors.push('aasist_dominant');
                        } else {
                            ensemble.is_deepfake = avspoofDetection;
                            ensemble.confidence = avspoofConfidence * 0.7;
                            ensemble.risk_factors.push('asvspoof_dominant');
                        }
                        ensemble.risk_factors.push('detection_disagreement');
                    }
                    
                    // Add risk factors from both methods
                    if (aasistResult.risk_factors) {
                        ensemble.risk_factors.push(...aasistResult.risk_factors.map(rf => `aasist_${rf}`));
                    }
                    if (avspoofResult.risk_factors) {
                        ensemble.risk_factors.push(...avspoofResult.risk_factors.map(rf => rf.factor || rf));
                    }
                    
                } else {
                    // Only AASIST available
                    ensemble.is_deepfake = aasistDetection;
                    ensemble.confidence = aasistConfidence;
                    ensemble.risk_factors.push('aasist_only');
                    if (aasistResult.risk_factors) {
                        ensemble.risk_factors.push(...aasistResult.risk_factors);
                    }
                }
            } else if (avspoofResult && !avspoofResult.error) {
                // Only ASVspoof available
                ensemble.is_deepfake = avspoofResult.is_deepfake;
                ensemble.confidence = avspoofResult.confidence;
                ensemble.risk_factors.push('asvspoof_only');
                if (avspoofResult.risk_factors) {
                    ensemble.risk_factors.push(...avspoofResult.risk_factors.map(rf => rf.factor || rf));
                }
            } else {
                // Both failed
                ensemble.confidence = 0.0;
                ensemble.risk_factors.push('detection_failed');
            }

            // Apply confidence threshold
            if (ensemble.confidence < this.config.confidenceThreshold) {
                ensemble.is_deepfake = false;
                ensemble.risk_factors.push('below_confidence_threshold');
            }

        } catch (error) {
            console.error('Ensemble combination error:', error);
            ensemble.error = error.message;
        }

        return ensemble;
    }

    async callAASISTBridge(audioData, context) {
        // Placeholder for your existing AASIST bridge implementation
        // This should match your current aasist_bridge.py interface
        
        return new Promise((resolve, reject) => {
            try {
                // Prepare audio data for AASIST
                const tempAudioPath = this.prepareAudioForAASIST(audioData);
                
                // Call AASIST bridge
                const python = spawn(this.config.pythonExecutable, [
                    path.join(__dirname, 'aasist_bridge.py'),
                    '--audio', tempAudioPath,
                    '--format', 'json'
                ]);
                
                let output = '';
                let errorOutput = '';
                
                python.stdout.on('data', (data) => output += data.toString());
                python.stderr.on('data', (data) => errorOutput += data.toString());
                
                python.on('close', (code) => {
                    // Clean up temp file
                    if (fs.existsSync(tempAudioPath)) {
                        fs.unlinkSync(tempAudioPath);
                    }
                    
                    if (code === 0) {
                        try {
                            const result = JSON.parse(output);
                            resolve(result);
                        } catch (parseError) {
                            reject(new Error(`AASIST output parsing failed: ${parseError.message}`));
                        }
                    } else {
                        reject(new Error(`AASIST bridge failed (code ${code}): ${errorOutput}`));
                    }
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }

    prepareAudioForAASIST(audioData) {
        // Create temporary audio file for AASIST processing
        // This is a placeholder - implement based on your audio data format
        
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempPath = path.join(tempDir, `audio_${Date.now()}.wav`);
        
        // If audioData is a file path, copy it
        if (typeof audioData === 'string' && fs.existsSync(audioData)) {
            fs.copyFileSync(audioData, tempPath);
        } else if (audioData.buffer) {
            // If audioData has buffer, write it
            fs.writeFileSync(tempPath, audioData.buffer);
        } else {
            // Create a dummy file for testing
            fs.writeFileSync(tempPath, Buffer.alloc(1024));
        }
        
        return tempPath;
    }

    // Enhanced statistics including both methods
    getDetectionStatistics() {
        const stats = {
            methods_enabled: [],
            asvspoof_stats: null,
            total_detections: 0,
            ensemble_mode: this.config.ensembleMode
        };

        if (this.config.enableAASIST) {
            stats.methods_enabled.push('AASIST');
        }
        
        if (this.config.enableASVspoof && this.avspoofAnalyzer) {
            stats.methods_enabled.push('ASVspoof_Patterns');
            stats.asvspoof_stats = this.avspoofAnalyzer.getStatistics();
        }

        return stats;
    }

    // Test method for validating the enhanced detection
    async testEnhancedDetection() {
        console.log('Testing Enhanced Deepfake Detection...');
        
        const testCases = [
            {
                name: 'Scam TTS Test',
                audioData: { duration: 10, sampleRate: 16000 },
                context: {
                    text: 'This is Microsoft technical support. Your computer has a virus and needs immediate attention.',
                    speaker: 'unknown',
                    scenario: 'tech_support_scam'
                },
                expected: 'should detect synthetic patterns'
            },
            {
                name: 'Normal Speech Test',
                audioData: { duration: 8, sampleRate: 16000 },
                context: {
                    text: 'Good morning everyone, lets review the quarterly sales figures.',
                    speaker: 'legitimate',
                    scenario: 'business_meeting'
                },
                expected: 'should be low risk'
            },
            {
                name: 'Voice Conversion Test',
                audioData: { duration: 12, sampleRate: 16000 },
                context: {
                    text: 'Please send me your bank account details for verification.',
                    speaker: 'p299',
                    target_speaker: 'p299',
                    source_speaker: 'p277_358',
                    scenario: 'voice_conversion_attack'
                },
                expected: 'should detect voice conversion'
            }
        ];

        const results = [];

        for (const testCase of testCases) {
            console.log(`\n--- Testing: ${testCase.name} ---`);
            console.log(`Expected: ${testCase.expected}`);
            
            try {
                const result = await this.detectDeepfake(testCase.audioData, testCase.context);
                
                console.log(`Result: ${result.is_deepfake ? 'SYNTHETIC' : 'GENUINE'}`);
                console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
                console.log(`Method: ${result.method}`);
                
                if (result.risk_factors && result.risk_factors.length > 0) {
                    console.log(`Risk factors: ${result.risk_factors.slice(0, 3).join(', ')}`);
                }
                
                if (result.details.asvspoof && result.details.asvspoof.detected_patterns) {
                    console.log(`Patterns detected: ${result.details.asvspoof.detected_patterns.length}`);
                }
                
                results.push({
                    testCase: testCase.name,
                    result: result,
                    success: true
                });
                
            } catch (error) {
                console.error(`Test failed: ${error.message}`);
                results.push({
                    testCase: testCase.name,
                    error: error.message,
                    success: false
                });
            }
        }

        console.log('\nEnhanced Detection Test Summary:');
        const successful = results.filter(r => r.success).length;
        console.log(`Successful tests: ${successful}/${results.length}`);
        
        if (this.config.enableASVspoof && this.avspoofAnalyzer) {
            const avspoofStats = this.avspoofAnalyzer.getStatistics();
            console.log(`ASVspoof patterns loaded: ${avspoofStats.patterns_summary.total_tts_patterns}`);
        }

        return results;
    }
}

// Export for integration with demo_main.js
module.exports = { DeepfakeDetector };

// Standalone test function
async function demoEnhancedDeepfakeDetection() {
    console.log('Enhanced Deepfake Detection Demo');
    console.log('==================================\n');

    const detector = new DeepfakeDetector({
        verbose: true,
        enableASVspoof: true,
        enableAASIST: true,
        ensembleMode: true,
        asvspoof: {
            datasetPath: './datasets',
            confidenceThreshold: 0.6
        }
    });

    try {
        await detector.initializeModel();
        const results = await detector.testEnhancedDetection();
        
        console.log('\nEnhanced deepfake detection demo completed!');
        return results;
        
    } catch (error) {
        console.error('Enhanced demo failed:', error);
        throw error;
    }
}

// Export demo function
module.exports.demoEnhancedDeepfakeDetection = demoEnhancedDeepfakeDetection;