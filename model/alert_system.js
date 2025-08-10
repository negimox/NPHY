// alert_system.js
// Generates discreet spoken alerts via ElevenLabs Text-to-Speech API

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AlertSystem {
    constructor(elevenLabsApiKey) {
        this.apiKey = elevenLabsApiKey;
        this.ttsEndpoint = 'https://api.elevenlabs.io/v1/text-to-speech';
        
        // Available voices (you can customize these)
        this.voices = {
            // Professional, calm voices for alerts
            default: 'pNInz6obpgDQGcFmaJgB', // Adam - calm, professional
            female: '21m00Tcm4TlvDq8ikWAM', // Rachel - clear, friendly
            male: 'ErXwobaYiN019PkySvjV', // Antoni - warm, trustworthy
            whisper: 'EXAVITQu4vr4xnSDxMaL'  // Bella - soft, discreet
        };
        
        this.alertHistory = [];
        this.audioOutputDir = './audio_alerts';
        
        // Create output directory
        if (!fs.existsSync(this.audioOutputDir)) {
            fs.mkdirSync(this.audioOutputDir);
        }
        
        // Alert message templates in multiple languages
        this.alertMessages = {
            en: {
                HIGH: {
                    immediate: "Security alert: This conversation shows strong signs of a scam. Consider ending the call immediately.",
                    discreet: "You have an important notification. Please check your security dashboard.",
                    urgent: "Warning: Potential fraud detected. Exercise extreme caution."
                },
                MEDIUM: {
                    caution: "Advisory: Please be cautious. Some suspicious patterns have been detected in this conversation.",
                    discreet: "Gentle reminder to verify any requests for personal information.",
                    monitor: "Security notice: Continue with increased awareness."
                },
                LOW: {
                    awareness: "Information: Minor security patterns detected. Please remain alert.",
                    discreet: "Friendly reminder to stay vigilant during your call."
                },
                DEEPFAKE: {
                    immediate: "Critical alert: Artificial voice detected. This may not be a real person.",
                    discreet: "Technical notice: Voice authentication concerns detected."
                }
            },
            es: {
                HIGH: {
                    immediate: "Alerta de seguridad: Esta conversación muestra signos fuertes de estafa. Considere terminar la llamada inmediatamente.",
                    discreet: "Tiene una notificación importante. Por favor revise su panel de seguridad."
                },
                MEDIUM: {
                    caution: "Aviso: Por favor tenga cuidado. Se han detectado algunos patrones sospechosos en esta conversación.",
                    discreet: "Recordatorio amable para verificar cualquier solicitud de información personal."
                }
            },
            fr: {
                HIGH: {
                    immediate: "Alerte de sécurité: Cette conversation montre de forts signes d'arnaque. Considérez raccrocher immédiatement.",
                    discreet: "Vous avez une notification importante. Veuillez vérifier votre tableau de bord de sécurité."
                }
            }
        };
    }

    // Generate speech from text using ElevenLabs TTS
    async generateSpeech(text, voiceId = null, language = 'en') {
        try {
            const selectedVoice = voiceId || this.voices.default;
            
            console.log(`Generating TTS for: "${text.substring(0, 50)}..."`);

            const response = await fetch(`${this.ttsEndpoint}/${selectedVoice}`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.apiKey
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.8,
                        similarity_boost: 0.8,
                        style: 0.2,
                        use_speaker_boost: true
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`ElevenLabs TTS API error: ${response.status} - ${errorText}`);
            }

            const audioBuffer = await response.buffer();
            
            // Save audio file
            const filename = `alert_${Date.now()}.mp3`;
            const filepath = path.join(this.audioOutputDir, filename);
            fs.writeFileSync(filepath, audioBuffer);
            
            console.log(`Audio saved to: ${filepath}`);
            
            return {
                audioBuffer,
                filepath,
                filename,
                text,
                voice: selectedVoice,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('Error generating speech:', error);
            throw error;
        }
    }

    // Play audio file (cross-platform)
    async playAudio(filepath) {
        try {
            console.log(`Playing audio: ${filepath}`);
            
            // Detect platform and use appropriate audio player
            const platform = process.platform;
            let command;
            
            switch (platform) {
                case 'darwin': // macOS
                    command = `afplay "${filepath}"`;
                    break;
                case 'linux':
                    command = `aplay "${filepath}" || paplay "${filepath}" || mpg123 "${filepath}"`;
                    break;
                case 'win32': // Windows
                    command = `powershell -c "(New-Object Media.SoundPlayer '${filepath}').PlaySync();"`;
                    break;
                default:
                    console.log('Audio playback not supported on this platform');
                    return false;
            }
            
            execSync(command, { stdio: 'ignore' });
            console.log('Audio playback completed');
            return true;
            
        } catch (error) {
            console.error('Error playing audio:', error);
            return false;
        }
    }

    // Create alert based on scam analysis
    async createAlert(analysisResult, options = {}) {
        try {
            const {
                alertStyle = 'discreet', // 'immediate', 'discreet', 'urgent'
                language = 'en',
                voiceType = 'default',
                playImmediately = true
            } = options;

            const riskLevel = analysisResult.overallRisk?.level || 'SAFE';
            
            if (riskLevel === 'SAFE') {
                console.log('No alert needed - conversation appears safe');
                return null;
            }

            // Select appropriate message
            let alertText = this.selectAlertMessage(riskLevel, alertStyle, language, analysisResult);
            
            // Generate custom message if needed
            if (!alertText) {
                alertText = this.generateCustomAlert(analysisResult, language);
            }

            console.log(`Creating ${riskLevel} level alert: "${alertText}"`);

            // Select voice based on alert urgency
            let voiceId = this.voices[voiceType];
            if (riskLevel === 'HIGH') {
                voiceId = this.voices.default; // Clear, authoritative voice
            } else {
                voiceId = this.voices.whisper; // Softer, more discreet
            }

            // Generate speech
            const audioResult = await this.generateSpeech(alertText, voiceId, language);
            
            // Create alert record
            const alert = {
                id: `alert_${Date.now()}`,
                timestamp: new Date().toISOString(),
                riskLevel,
                alertText,
                audioFile: audioResult.filepath,
                language,
                voiceType,
                analysisResult,
                played: false
            };

            this.alertHistory.push(alert);

            // Play immediately if requested
            if (playImmediately) {
                const played = await this.playAudio(audioResult.filepath);
                alert.played = played;
            }

            console.log(`Alert created and ${alert.played ? 'played' : 'saved'}`);
            
            return alert;

        } catch (error) {
            console.error('Error creating alert:', error);
            return {
                error: error.message,
                timestamp: new Date().toISOString(),
                riskLevel: analysisResult.overallRisk?.level || 'ERROR'
            };
        }
    }

    // Select appropriate alert message
    selectAlertMessage(riskLevel, alertStyle, language, analysisResult) {
        const messages = this.alertMessages[language];
        if (!messages || !messages[riskLevel]) {
            return null;
        }

        // Handle deepfake detection
        if (analysisResult.deepfakeDetected) {
            return messages.DEEPFAKE?.[alertStyle] || messages.DEEPFAKE?.immediate;
        }

        return messages[riskLevel][alertStyle] || Object.values(messages[riskLevel])[0];
    }

    // Generate custom alert message based on specific scam tactics
    generateCustomAlert(analysisResult, language = 'en') {
        const tactics = analysisResult.overallRisk?.tacticsDetected || [];
        const riskLevel = analysisResult.overallRisk?.level || 'MEDIUM';
        
        if (tactics.length === 0) {
            return this.alertMessages[language]?.[riskLevel]?.discreet || 
                   "Security notice: Please remain cautious during this conversation.";
        }

        // Create specific warnings based on detected tactics
        const tacticWarnings = {
            authority: "Warning: Caller is claiming to be from an official organization.",
            urgency: "Notice: Caller is using urgency tactics to pressure you.",
            fear: "Alert: Caller is using fear tactics or threats.",
            financial_requests: "Critical: Caller is requesting financial or personal information.",
            technical_confusion: "Advisory: Caller is using technical jargon that may be confusing."
        };

        const primaryTactic = tactics[0];
        return tacticWarnings[primaryTactic] || 
               `Security alert: ${tactics.length} suspicious patterns detected. Please be cautious.`;
    }

    // Create multiple alert variants for different scenarios
    async createMultiLanguageAlerts(analysisResult) {
        const languages = ['en', 'es', 'fr'];
        const alerts = [];

        for (const language of languages) {
            try {
                const alert = await this.createAlert(analysisResult, {
                    language,
                    playImmediately: false
                });
                
                if (alert && !alert.error) {
                    alerts.push(alert);
                }
            } catch (error) {
                console.error(`Error creating ${language} alert:`, error);
            }
        }

        return alerts;
    }

    // Queue system for non-intrusive alerts
    async queueAlert(analysisResult, delay = 0) {
        setTimeout(async () => {
            await this.createAlert(analysisResult, {
                alertStyle: 'discreet',
                voiceType: 'whisper'
            });
        }, delay);
    }

    // Batch process multiple alerts
    async processBatchAlerts(analysisResults) {
        const alerts = [];
        
        for (let i = 0; i < analysisResults.length; i++) {
            const result = analysisResults[i];
            
            if (result.overallRisk?.level !== 'SAFE') {
                const alert = await this.createAlert(result, {
                    playImmediately: false,
                    alertStyle: i === 0 ? 'immediate' : 'discreet' // First alert immediate, rest discreet
                });
                
                if (alert) {
                    alerts.push(alert);
                }
                
                // Add delay between alerts to avoid overwhelming user
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        return alerts;
    }

    // Get alert statistics
    getAlertStats() {
        const stats = {
            total: this.alertHistory.length,
            byRiskLevel: {},
            played: this.alertHistory.filter(a => a.played).length,
            recent: this.alertHistory.filter(a => 
                Date.now() - new Date(a.timestamp).getTime() < 3600000 // Last hour
            ).length
        };

        this.alertHistory.forEach(alert => {
            const level = alert.riskLevel;
            stats.byRiskLevel[level] = (stats.byRiskLevel[level] || 0) + 1;
        });

        return stats;
    }

    // Clean up old audio files
    cleanupAudioFiles(olderThanHours = 24) {
        try {
            const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
            const files = fs.readdirSync(this.audioOutputDir);
            
            let deletedCount = 0;
            
            files.forEach(file => {
                const filepath = path.join(this.audioOutputDir, file);
                const stats = fs.statSync(filepath);
                
                if (stats.mtime.getTime() < cutoffTime) {
                    fs.unlinkSync(filepath);
                    deletedCount++;
                }
            });
            
            console.log(`Cleaned up ${deletedCount} old audio files`);
            
        } catch (error) {
            console.error('Error cleaning up audio files:', error);
        }
    }
}

// Demo function
async function demoAlertSystem() {
    console.log('Alert System Demo');
    console.log('====================\n');

    const apiKey = process.env.ELEVENLABS_API_KEY || 'your-elevenlabs-api-key-here';
    
    if (apiKey === 'your-elevenlabs-api-key-here') {
        console.log('Please set your ELEVENLABS_API_KEY environment variable');
        console.log('Demo will run without actual TTS generation');
        return;
    }

    const alertSystem = new AlertSystem(apiKey);

    // Mock analysis results for testing
    const testScenarios = [
        {
            overallRisk: {
                level: 'HIGH',
                confidence: 0.95,
                tacticsDetected: ['authority', 'urgency', 'financial_requests']
            },
            text: "This is Microsoft tech support. Your computer is infected.",
            deepfakeDetected: false
        },
        {
            overallRisk: {
                level: 'MEDIUM',
                confidence: 0.7,
                tacticsDetected: ['urgency']
            },
            text: "Your warranty expires today. Act now!",
            deepfakeDetected: false
        },
        {
            overallRisk: {
                level: 'HIGH',
                confidence: 0.9,
                tacticsDetected: ['authority']
            },
            text: "Hello, how are you today?",
            deepfakeDetected: true
        }
    ];

    try {
        console.log('Testing alert generation...\n');

        for (let i = 0; i < testScenarios.length; i++) {
            const scenario = testScenarios[i];
            console.log(`\n--- Test ${i + 1}: ${scenario.overallRisk.level} Risk ---`);
            
            const alert = await alertSystem.createAlert(scenario, {
                playImmediately: false, // Don't play during demo
                alertStyle: 'discreet'
            });
            
            if (alert && !alert.error) {
                console.log(`Alert created: ${alert.alertText}`);
                console.log(`Audio file: ${alert.audioFile}`);
            } else if (alert?.error) {
                console.log(`Alert creation failed: ${alert.error}`);
            }
            
            // Add delay between API calls
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Show statistics
        console.log('\nAlert Statistics:');
        const stats = alertSystem.getAlertStats();
        console.log(`Total alerts: ${stats.total}`);
        console.log(`Played alerts: ${stats.played}`);
        console.log(`By risk level:`, stats.byRiskLevel);

        console.log('\nAlert system demo completed');

    } catch (error) {
        console.error('Demo failed:', error);
    }
}

module.exports = {
    AlertSystem,
    demoAlertSystem
};

// Run demo if this file is executed directly
if (require.main === module) {
    demoAlertSystem();
}
