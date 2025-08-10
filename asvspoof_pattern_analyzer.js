
// asvspoof_pattern_analyzer.js
// ASVspoof 2021 Pattern Analysis using Metadata (No model files required)
// Analyzes attack patterns, speaker characteristics, and text-to-speech indicators

const fs = require('fs');
const path = require('path');

class ASVspoofPatternAnalyzer {
    constructor(config = {}) {
        this.config = {
            datasetPath: config.datasetPath || './datasets',
            confidenceThreshold: config.confidenceThreshold || 0.7,
            verbose: config.verbose || false,
            enabledTracks: config.enabledTracks || ['LA', 'DF'], // LA, PA, DF
            cacheResults: config.cacheResults !== false
        };

        this.isInitialized = false;
        this.metadata = {};
        this.patterns = {};
        this.statistics = {};
        this.suspiciousPatterns = new Set();
        
        // Known attack patterns from ASVspoof research
        this.knownAttackPatterns = {
            tts_keywords: [
                'microsoft', 'technical support', 'computer virus', 'security breach',
                'immediate action', 'download software', 'remote access', 'team viewer',
                'suspicious activity', 'irs', 'tax return', 'arrest warrant',
                'back taxes', 'gift card', 'payment', 'credit card', 'bank transfer'
            ],
            suspicious_phrases: [
                'this is urgent', 'act now', 'limited time', 'verify immediately',
                'suspicious activity detected', 'your account has been', 'call back immediately',
                'legal action', 'arrest warrant', 'final notice'
            ],
            voice_conversion_indicators: [
                'robotic speech patterns', 'unnatural prosody', 'inconsistent voice quality',
                'mechanical rhythm', 'synthetic intonation'
            ]
        };
    }

    async initialize() {
        if (this.isInitialized) return;

        console.log('Initializing ASVspoof Pattern Analyzer...');
        
        try {
            // Load all metadata files
            await this.loadAllMetadata();
            
            // Analyze patterns from metadata
            this.analyzeAttackPatterns();
            
            // Build pattern detection rules
            this.buildDetectionRules();
            
            // Generate statistics
            this.generateStatistics();
            
            this.isInitialized = true;
            console.log('ASVspoof Pattern Analyzer initialized successfully');
            this.printInitializationSummary();
            
        } catch (error) {
            console.error('Failed to initialize ASVspoof analyzer:', error.message);
            throw error;
        }
    }

    async loadAllMetadata() {
        console.log('Loading ASVspoof 2021 metadata files...');
        
        const metadataFiles = {
            LA: 'ASVspoof2021_LA_VCTK_MetaInfo.tsv',
            PA: 'ASVspoof2021_PA_VCTK_MetaInfo.tsv', 
            DF_VCTK: 'ASVspoof2021_DF_VCTK_MetaInfo.tsv',
            DF_VCC: 'ASVspoof2021_DF_VCC_MetaInfo.tsv'
        };

        for (const [track, filename] of Object.entries(metadataFiles)) {
            const filePath = path.join(this.config.datasetPath, filename);
            
            if (fs.existsSync(filePath)) {
                try {
                    this.metadata[track] = await this.loadTSVFile(filePath, track);
                    console.log(`   Loaded ${track}: ${Object.keys(this.metadata[track]).length} entries`);
                } catch (error) {
                    console.warn(`   Warning: Failed to load ${track}: ${error.message}`);
                    this.metadata[track] = {};
                }
            } else {
                console.warn(`   Warning: File not found: ${filename}`);
                this.metadata[track] = {};
            }
        }
    }

    async loadTSVFile(filePath, track) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        const metadata = {};
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            try {
                const columns = line.split('\t');
                const avspoofId = columns[0];
                
                let entry;
                if (track === 'LA' || track === 'DF_VCTK') {
                    entry = {
                        track: track,
                        vctk_id: columns[1] !== '-' ? columns[1] : null,
                        target_speaker: columns[2] !== '-' ? columns[2] : null,
                        tts_text: columns[3] !== '-' ? columns[3] : null,
                        vc_source: columns[4] !== '-' ? columns[4] : null,
                        attack_type: this.determineAttackType(columns),
                        is_bonafide: columns[1] !== '-' && columns[2] === '-'
                    };
                } else if (track === 'DF_VCC') {
                    entry = {
                        track: track,
                        vcc_id: columns[1] !== '-' ? columns[1] : null,
                        target_speaker: columns[2] !== '-' ? columns[2] : null,
                        tts_text: columns[3] !== '-' ? columns[3] : null,
                        vc_source: columns[4] !== '-' ? columns[4] : null,
                        attack_type: this.determineAttackType(columns),
                        is_bonafide: columns[1] !== '-' && columns[2] === '-'
                    };
                } else if (track === 'PA') {
                    entry = {
                        track: track,
                        vctk_id: columns[1] !== '-' ? columns[1] : null,
                        attack_type: columns[1] !== '-' ? 'bonafide' : 'replay',
                        is_bonafide: columns[1] !== '-'
                    };
                }
                
                metadata[avspoofId] = entry;
                
            } catch (error) {
                if (this.config.verbose) {
                    console.warn(`   Warning: Failed to parse line ${i + 1} in ${track}: ${error.message}`);
                }
            }
        }
        
        return metadata;
    }

    determineAttackType(columns) {
        // Determine attack type based on column content
        if (columns[1] !== '-' && columns[2] === '-' && columns[3] === '-') {
            return 'bonafide';
        } else if (columns[2] !== '-' && columns[3] !== '-' && columns[3] !== '') {
            return 'tts'; // Text-to-Speech with actual text
        } else if (columns[2] !== '-' && columns[4] !== '-') {
            return 'vc'; // Voice Conversion
        } else if (columns[2] !== '-') {
            return 'synthetic'; // Synthetic voice without specific text
        } else {
            return 'spoof'; // Generic spoof
        }
    }

    analyzeAttackPatterns() {
        console.log('Analyzing attack patterns from metadata...');
        
        this.patterns = {
            tts_texts: new Set(),
            target_speakers: new Set(),
            voice_conversion_sources: new Set(),
            attack_types: {},
            suspicious_text_patterns: [],
            speaker_mimicry_patterns: {}
        };

        // Analyze all metadata
        for (const [track, entries] of Object.entries(this.metadata)) {
            for (const [id, entry] of Object.entries(entries)) {
                // Collect TTS texts
                if (entry.tts_text) {
                    this.patterns.tts_texts.add(entry.tts_text.toLowerCase());
                    this.analyzeTTSText(entry.tts_text);
                }
                
                // Collect target speakers
                if (entry.target_speaker) {
                    this.patterns.target_speakers.add(entry.target_speaker);
                    this.analyzeTargetSpeaker(entry.target_speaker, entry);
                }
                
                // Collect voice conversion sources
                if (entry.vc_source) {
                    this.patterns.voice_conversion_sources.add(entry.vc_source);
                }
                
                // Count attack types
                const attackType = entry.attack_type;
                this.patterns.attack_types[attackType] = (this.patterns.attack_types[attackType] || 0) + 1;
            }
        }

        this.patterns.tts_texts = Array.from(this.patterns.tts_texts);
        this.patterns.target_speakers = Array.from(this.patterns.target_speakers);
        this.patterns.voice_conversion_sources = Array.from(this.patterns.voice_conversion_sources);
    }

    analyzeTTSText(text) {
        const lowercaseText = text.toLowerCase();
        
        // Check for scam-related keywords
        for (const keyword of this.knownAttackPatterns.tts_keywords) {
            if (lowercaseText.includes(keyword)) {
                this.suspiciousPatterns.add(`tts_scam_keyword: ${keyword}`);
                this.patterns.suspicious_text_patterns.push({
                    text: text,
                    keyword: keyword,
                    type: 'scam_indicator'
                });
            }
        }
        
        // Check for suspicious phrases
        for (const phrase of this.knownAttackPatterns.suspicious_phrases) {
            if (lowercaseText.includes(phrase)) {
                this.suspiciousPatterns.add(`tts_suspicious_phrase: ${phrase}`);
                this.patterns.suspicious_text_patterns.push({
                    text: text,
                    phrase: phrase,
                    type: 'urgency_indicator'
                });
            }
        }
    }

    analyzeTargetSpeaker(speaker, entry) {
        if (!this.patterns.speaker_mimicry_patterns[speaker]) {
            this.patterns.speaker_mimicry_patterns[speaker] = {
                attack_count: 0,
                attack_types: new Set(),
                sample_texts: []
            };
        }
        
        this.patterns.speaker_mimicry_patterns[speaker].attack_count++;
        this.patterns.speaker_mimicry_patterns[speaker].attack_types.add(entry.attack_type);
        
        if (entry.tts_text) {
            this.patterns.speaker_mimicry_patterns[speaker].sample_texts.push(entry.tts_text);
        }
    }

    buildDetectionRules() {
        console.log('Building pattern detection rules...');
        
        this.detectionRules = {
            text_analysis: {
                scam_keywords: this.knownAttackPatterns.tts_keywords,
                suspicious_phrases: this.knownAttackPatterns.suspicious_phrases,
                tts_patterns: this.patterns.tts_texts.slice(0, 100) // Top 100 TTS patterns
            },
            speaker_analysis: {
                frequently_mimicked: Object.entries(this.patterns.speaker_mimicry_patterns)
                    .filter(([speaker, data]) => data.attack_count > 5)
                    .map(([speaker, data]) => speaker),
                voice_conversion_sources: Array.from(this.patterns.voice_conversion_sources).slice(0, 50)
            },
            attack_type_weights: {
                'tts': 0.8,        // High weight for TTS attacks
                'vc': 0.7,         // High weight for voice conversion
                'synthetic': 0.6,   // Medium weight for synthetic
                'replay': 0.4,     // Lower weight for replay
                'bonafide': 0.0    // No weight for legitimate
            }
        };
    }

    generateStatistics() {
        this.statistics = {
            total_entries: 0,
            attack_distribution: {},
            track_distribution: {},
            suspicious_patterns_found: this.suspiciousPatterns.size,
            top_target_speakers: [],
            most_common_tts_patterns: []
        };

        // Calculate statistics
        for (const [track, entries] of Object.entries(this.metadata)) {
            const trackSize = Object.keys(entries).length;
            this.statistics.total_entries += trackSize;
            this.statistics.track_distribution[track] = trackSize;
        }

        this.statistics.attack_distribution = { ...this.patterns.attack_types };
        
        // Top target speakers
        this.statistics.top_target_speakers = Object.entries(this.patterns.speaker_mimicry_patterns)
            .sort(([,a], [,b]) => b.attack_count - a.attack_count)
            .slice(0, 10)
            .map(([speaker, data]) => ({ speaker, count: data.attack_count }));
    }

    // Main analysis function for incoming audio/text
    async analyzeContent(content, metadata = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const analysis = {
            asvspoof_risk: 'SAFE',
            confidence: 0.0,
            detected_patterns: [],
            risk_factors: [],
            pattern_matches: {},
            metadata_intelligence: {},
            timestamp: Date.now()
        };

        try {
            // Analyze text content if available
            if (content.text) {
                const textAnalysis = this.analyzeTextContent(content.text);
                analysis.pattern_matches.text = textAnalysis;
                analysis.detected_patterns.push(...textAnalysis.patterns);
            }

            // Analyze speaker characteristics if available
            if (metadata.speaker || metadata.target_speaker) {
                const speakerAnalysis = this.analyzeSpeakerCharacteristics(metadata);
                analysis.pattern_matches.speaker = speakerAnalysis;
                analysis.detected_patterns.push(...speakerAnalysis.patterns);
            }

            // Analyze audio characteristics if available
            if (content.audioFeatures) {
                const audioAnalysis = this.analyzeAudioCharacteristics(content.audioFeatures);
                analysis.pattern_matches.audio = audioAnalysis;
                analysis.detected_patterns.push(...audioAnalysis.patterns);
            }

            // Calculate overall risk
            analysis.asvspoof_risk = this.calculateOverallRisk(analysis.detected_patterns);
            analysis.confidence = this.calculateConfidence(analysis.detected_patterns);
            analysis.risk_factors = this.extractRiskFactors(analysis.detected_patterns);

            // Add metadata intelligence
            analysis.metadata_intelligence = this.getRelevantMetadataIntelligence(analysis);

            if (this.config.verbose) {
                console.log(`ASVspoof analysis: ${analysis.asvspoof_risk} (${(analysis.confidence * 100).toFixed(1)}%)`);
            }

        } catch (error) {
            console.error('ASVspoof analysis error:', error);
            analysis.error = error.message;
        }

        return analysis;
    }

    analyzeTextContent(text) {
        const textAnalysis = {
            patterns: [],
            scam_indicators: 0,
            urgency_indicators: 0,
            tts_likelihood: 0.0
        };

        const lowercaseText = text.toLowerCase();

        // Check for scam keywords
        for (const keyword of this.detectionRules.text_analysis.scam_keywords) {
            if (lowercaseText.includes(keyword)) {
                textAnalysis.patterns.push({
                    type: 'scam_keyword',
                    pattern: keyword,
                    weight: 0.8,
                    source: 'asvspoof_patterns'
                });
                textAnalysis.scam_indicators++;
            }
        }

        // Check for suspicious phrases
        for (const phrase of this.detectionRules.text_analysis.suspicious_phrases) {
            if (lowercaseText.includes(phrase)) {
                textAnalysis.patterns.push({
                    type: 'suspicious_phrase',
                    pattern: phrase,
                    weight: 0.6,
                    source: 'asvspoof_patterns'
                });
                textAnalysis.urgency_indicators++;
            }
        }

        // Check against known TTS patterns
        const ttsMatches = this.detectionRules.text_analysis.tts_patterns.filter(pattern => 
            this.calculateTextSimilarity(lowercaseText, pattern) > 0.7
        );

        if (ttsMatches.length > 0) {
            textAnalysis.patterns.push({
                type: 'tts_pattern_match',
                pattern: `${ttsMatches.length} similar TTS patterns`,
                weight: 0.7,
                source: 'asvspoof_metadata'
            });
            textAnalysis.tts_likelihood = Math.min(ttsMatches.length * 0.2, 1.0);
        }

        return textAnalysis;
    }

    analyzeSpeakerCharacteristics(metadata) {
        const speakerAnalysis = {
            patterns: [],
            mimicry_risk: 0.0,
            voice_conversion_risk: 0.0
        };

        // Check if speaker is frequently mimicked
        const speaker = metadata.speaker || metadata.target_speaker;
        if (speaker && this.detectionRules.speaker_analysis.frequently_mimicked.includes(speaker)) {
            speakerAnalysis.patterns.push({
                type: 'frequently_mimicked_speaker',
                pattern: speaker,
                weight: 0.6,
                source: 'asvspoof_metadata'
            });
            speakerAnalysis.mimicry_risk = 0.7;
        }

        // Check for voice conversion patterns
        if (metadata.source_speaker && this.detectionRules.speaker_analysis.voice_conversion_sources.includes(metadata.source_speaker)) {
            speakerAnalysis.patterns.push({
                type: 'known_vc_source',
                pattern: metadata.source_speaker,
                weight: 0.7,
                source: 'asvspoof_metadata'
            });
            speakerAnalysis.voice_conversion_risk = 0.8;
        }

        return speakerAnalysis;
    }

    analyzeAudioCharacteristics(audioFeatures) {
        const audioAnalysis = {
            patterns: [],
            synthetic_likelihood: 0.0
        };

        // Basic audio pattern analysis (can be enhanced with actual audio features)
        if (audioFeatures.duration && audioFeatures.duration < 5) {
            audioAnalysis.patterns.push({
                type: 'short_duration',
                pattern: 'unusually_short_audio',
                weight: 0.3,
                source: 'audio_characteristics'
            });
        }

        // Placeholder for more sophisticated audio analysis
        // In a real implementation, you would analyze:
        // - Spectral features
        // - Prosodic features
        // - Voice quality measures
        // - Temporal patterns

        return audioAnalysis;
    }

    calculateOverallRisk(patterns) {
        if (patterns.length === 0) return 'SAFE';

        const totalWeight = patterns.reduce((sum, pattern) => sum + (pattern.weight || 0), 0);
        const avgWeight = totalWeight / patterns.length;

        if (avgWeight >= 0.7) return 'HIGH';
        if (avgWeight >= 0.5) return 'MEDIUM';
        if (avgWeight >= 0.3) return 'LOW';
        return 'SAFE';
    }

    calculateConfidence(patterns) {
        if (patterns.length === 0) return 0.0;

        const weights = patterns.map(p => p.weight || 0);
        const maxWeight = Math.max(...weights);
        const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
        
        // Combine max and average for confidence
        return Math.min((maxWeight * 0.7 + avgWeight * 0.3), 1.0);
    }

    extractRiskFactors(patterns) {
        return patterns.map(pattern => ({
            factor: pattern.type,
            description: pattern.pattern,
            severity: pattern.weight > 0.7 ? 'HIGH' : pattern.weight > 0.4 ? 'MEDIUM' : 'LOW',
            source: pattern.source
        }));
    }

    getRelevantMetadataIntelligence(analysis) {
        return {
            database_size: this.statistics.total_entries,
            known_attack_types: Object.keys(this.patterns.attack_types),
            suspicious_patterns_in_db: this.suspiciousPatterns.size,
            detection_coverage: {
                tts_patterns: this.patterns.tts_texts.length,
                voice_conversion_patterns: this.patterns.voice_conversion_sources.length,
                target_speakers: this.patterns.target_speakers.length
            }
        };
    }

    calculateTextSimilarity(text1, text2) {
        // Simple similarity calculation (can be enhanced with more sophisticated methods)
        const words1 = text1.toLowerCase().split(/\s+/);
        const words2 = text2.toLowerCase().split(/\s+/);
        
        const commonWords = words1.filter(word => words2.includes(word));
        const totalWords = new Set([...words1, ...words2]).size;
        
        return commonWords.length / totalWords;
    }

    printInitializationSummary() {
        console.log('\nASVspoof Pattern Analyzer Summary:');
        console.log(`   Total entries analyzed: ${this.statistics.total_entries}`);
        console.log(`   Attack types found: ${Object.keys(this.patterns.attack_types).join(', ')}`);
        console.log(`   Suspicious patterns detected: ${this.suspiciousPatterns.size}`);
        console.log(`   TTS text patterns: ${this.patterns.tts_texts.length}`);
        console.log(`   Target speakers: ${this.patterns.target_speakers.length}`);
        console.log(`   Voice conversion sources: ${this.patterns.voice_conversion_sources.length}`);
        
        if (this.statistics.top_target_speakers.length > 0) {
            console.log(`   Most targeted speakers: ${this.statistics.top_target_speakers.slice(0, 3).map(s => s.speaker).join(', ')}`);
        }
    }

    // Get summary statistics for reporting
    getStatistics() {
        return {
            ...this.statistics,
            patterns_summary: {
                total_tts_patterns: this.patterns.tts_texts.length,
                total_suspicious_patterns: this.suspiciousPatterns.size,
                attack_type_distribution: this.patterns.attack_types
            }
        };
    }
}

module.exports = { ASVspoofPatternAnalyzer };
