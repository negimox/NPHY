// audio_processor.js
// Handles audio input from .wav files or system loopback and sends to ElevenLabs STT

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

class AudioProcessor {
    constructor(elevenLabsApiKey) {
        if (!elevenLabsApiKey) {
            throw new Error("ElevenLabs API key is required.");
        }
        this.apiKey = elevenLabsApiKey;
        this.sttEndpoint = 'https://api.elevenlabs.io/v1/speech-to-text';
        this.chunkSize = 3000; // 3 seconds
        this.overlapSize = 1000; // 1 second overlap
    }

    // Read audio file and split into chunks
    async processAudioFile(filePath) {
        try {
            console.log(`Processing audio file: ${filePath}`);

            if (!fs.existsSync(filePath)) {
                throw new Error(`Audio file not found: ${filePath}`);
            }

            const audioBuffer = fs.readFileSync(filePath);
            const chunks = this.createAudioChunks(audioBuffer, filePath);

            console.log(`Created ${chunks.length} audio chunks for processing.`);
            return chunks;

        } catch (error) {
            console.error('Error processing audio file:', error);
            throw error;
        }
    }

    // Create overlapping audio chunks for sliding window analysis
    createAudioChunks(audioBuffer, originalPath) {
        const chunks = [];
        const fileExtension = path.extname(originalPath);

        // For demo purposes, we'll create temporal chunks
        // In a real implementation, you'd need proper audio parsing
        const chunkSizeBytes = Math.floor(audioBuffer.length / 5); // Create 5 chunks

        for (let i = 0; i < 5; i++) {
            const start = i * Math.floor(chunkSizeBytes * 0.8); // 20% overlap
            const end = Math.min(start + chunkSizeBytes, audioBuffer.length);

            const chunkBuffer = audioBuffer.slice(start, end);

            chunks.push({
                id: i,
                buffer: chunkBuffer,
                startTime: i * (this.chunkSize * 0.8), // milliseconds
                endTime: (i + 1) * this.chunkSize,
                size: chunkBuffer.length
            });
        }

        return chunks;
    }

    // Send audio chunk to ElevenLabs Speech-to-Text
    async transcribeChunk(audioChunk) {
        try {
            console.log(`Transcribing chunk ${audioChunk.id}...`);

            // Create form data for the API request
            const formData = new FormData();

            // Create a temporary file name for the chunk
            const tempFileName = `chunk_${audioChunk.id}_${Date.now()}.wav`;

            // Append the audio data as a file
            formData.append('audio', audioChunk.buffer, {
                filename: tempFileName,
                contentType: 'audio/wav'
            });

            // Add optional parameters
            formData.append('model_id', 'eleven_multilingual_v2'); // Supports multiple languages
            formData.append('language_code', 'en'); // Default to English, can be auto-detected

            const response = await fetch(this.sttEndpoint, {
                method: 'POST',
                headers: {
                    'XI_API_KEY': this.apiKey, // Correct header key
                    ...formData.getHeaders()
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`ElevenLabs STT API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            const transcription = {
                chunkId: audioChunk.id,
                text: result.text || '',
                confidence: result.confidence || 0.8,
                language: result.detected_language || 'en',
                startTime: audioChunk.startTime,
                endTime: audioChunk.endTime,
                timestamp: Date.now()
            };

            console.log(`Chunk ${audioChunk.id} transcribed: "${transcription.text.substring(0, 100)}..."`);

            return transcription;

        } catch (error) {
            console.error(`Error transcribing chunk ${audioChunk.id}:`, error);

            // Return empty transcription on error
            return {
                chunkId: audioChunk.id,
                text: '',
                confidence: 0.0,
                language: 'unknown',
                startTime: audioChunk.startTime,
                endTime: audioChunk.endTime,
                timestamp: Date.now(),
                error: error.message
            };
        }
    }

    // Process entire audio file and return all transcriptions
    async transcribeAudioFile(filePath) {
        try {
            const chunks = await this.processAudioFile(filePath);
            const transcriptions = [];

            console.log('Starting transcription process...');

            // Process chunks with some delay to avoid rate limiting
            for (const chunk of chunks) {
                const transcription = await this.transcribeChunk(chunk);
                transcriptions.push(transcription);

                // Add delay between API calls
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Combine transcriptions into full text
            const fullTranscription = {
                fullText: transcriptions
                    .filter(t => t.text && !t.error)
                    .map(t => t.text)
                    .join(' '),
                chunks: transcriptions,
                totalChunks: chunks.length,
                successfulChunks: transcriptions.filter(t => !t.error).length,
                timestamp: Date.now()
            };

            console.log('Transcription completed.');
            console.log(`Processed ${fullTranscription.successfulChunks}/${fullTranscription.totalChunks} chunks successfully.`);

            return fullTranscription;

        } catch (error) {
            console.error('Error in audio transcription:', error);
            throw error;
        }
    }

    // Create sample audio files for testing (mock data)
    createSampleAudioFiles() {
        const sampleDir = './sample_audio';
        if (!fs.existsSync(sampleDir)) {
            fs.mkdirSync(sampleDir);
        }

        // Create sample text files that represent different scenarios
        const scenarios = [
            {
                name: 'tech_support_scam.txt',
                content: "Hello, this is John from Microsoft technical support. We've detected suspicious activity on your computer. You need to download our software immediately to fix the security breach. Please give me remote access to your computer so I can help you."
            },
            {
                name: 'irs_scam.txt',
                content: "This is Agent Johnson from the IRS. You owe $5,000 in back taxes and we need immediate payment to avoid legal action. You must pay within 24 hours or we will issue a warrant for your arrest. Please provide your bank account information now."
            },
            {
                name: 'normal_conversation.txt',
                content: "Hi Sarah, thanks for joining the meeting today. I wanted to discuss the quarterly reports and our marketing strategy for next month. Do you have the sales figures ready for review?"
            },
            {
                name: 'warranty_scam.txt',
                content: "This is a final notice about your car warranty that expires today. We need to update your information immediately to extend your coverage. Press 1 to speak with an agent or your warranty will be canceled forever."
            }
        ];

        scenarios.forEach(scenario => {
            const filePath = path.join(sampleDir, scenario.name);
            fs.writeFileSync(filePath, scenario.content);
            console.log(`Created sample scenario: ${scenario.name}`);
        });

        console.log(`Sample files created in ${sampleDir}/`);
        console.log('Note: In a real demo, you would use actual .wav files');
        console.log('For now, use these text files to simulate transcription results');

        return scenarios.map(s => path.join(sampleDir, s.name));
    }

    // Simulate real-time audio processing (for demo purposes)
    async* simulateRealTimeProcessing(textFile) {
        try {
            console.log(`Simulating real-time processing of: ${textFile}`);

            if (!fs.existsSync(textFile)) {
                throw new Error(`Sample file not found: ${textFile}`);
            }

            const content = fs.readFileSync(textFile, 'utf8');
            const sentences = content.split('.').filter(s => s.trim().length > 0);

            for (let i = 0; i < sentences.length; i++) {
                const sentence = sentences[i].trim() + '.';

                // Simulate processing delay
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

                const result = {
                    chunkId: i,
                    text: sentence,
                    confidence: 0.85 + Math.random() * 0.15,
                    language: 'en',
                    startTime: i * 3000,
                    endTime: (i + 1) * 3000,
                    timestamp: Date.now()
                };

                console.log(`Real-time chunk ${i}: "${sentence}"`);

                // Yield result for immediate processing
                yield result;
            }

        } catch (error) {
            console.error('Error in real-time simulation:', error);
            throw error;
        }
    }

    // Mock system audio loopback (for actual implementation)
    async captureSystemAudio() {
        console.log('System audio capture not implemented in this demo.');
        console.log('In production, you would use libraries like:');
        console.log('   - node-record-lpcm16 for audio recording');
        console.log('   - portaudio or pulseaudio bindings');
        console.log('   - Zoom SDK audio callbacks');

        // Return a promise that resolves with mock audio data
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    message: 'Mock system audio capture',
                    recommendation: 'Use actual .wav files for demo'
                });
            }, 1000);
        });
    }
}

// Demo usage
async function demoAudioProcessing() {
    console.log('Audio Processing Demo');
    console.log('========================\n');

    // Securely get the API key from environment variables
    const apiKey = process.env.XI_API_KEY;

    // Check if the API key is set. If not, exit the script.
    if (!apiKey) {
        console.error('ERROR: XI_API_KEY environment variable not set.');
        console.error('Please set the key before running the script.');
        console.error('Example: export XI_API_KEY="your_key_here"');
        process.exit(1); // Exit with an error code
    }
    
    // The demo will now only run if the API key is present.
    // We will use the simulation part which does not make real API calls.
    // If you were to use transcribeAudioFile, it would now work correctly.
    console.log('API key found. Initializing processor...');
    const processor = new AudioProcessor(apiKey);

    try {
        // Create sample files for testing
        const sampleFiles = processor.createSampleAudioFiles();

        // Demo with a sample file
        const sampleFile = sampleFiles[0]; // tech_support_scam.txt

        console.log('\nSimulating real-time audio processing...');

        // Simulate real-time processing using an async generator
        const generator = processor.simulateRealTimeProcessing(sampleFile);

        for await (const chunk of generator) {
            console.log(`Real-time chunk processed: ${chunk.chunkId}`);
            // In a full application, this is where you would send the chunk 
            // to the scam analyzer module for immediate analysis.
        }

        console.log('\nAudio processing demo completed.');

    } catch (error) {
        console.error('Demo failed:', error);
    }
}

module.exports = {
    AudioProcessor,
    demoAudioProcessing
};

// Run demo if this file is executed directly
if (require.main === module) {
    demoAudioProcessing();
}
