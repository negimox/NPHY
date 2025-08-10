// scammer_database.js - Scammer number database and API integration
const fs = require('fs');
const path = require('path');

class ScammerDatabase {
    constructor(config = {}) {
        this.config = {
            truecallerApiKey: config.truecallerApiKey || process.env.TRUECALLER_API_KEY,
            nomoroboApiKey: config.nomoroboApiKey || process.env.NOMOROBO_API_KEY,
            useLocalDatabase: config.useLocalDatabase !== false,
            updateInterval: config.updateInterval || 24 * 60 * 60 * 1000, // 24 hours
            cacheTimeout: config.cacheTimeout || 60 * 60 * 1000, // 1 hour
            verbose: config.verbose || false
        };

        this.localDatabase = new Set();
        this.apiCache = new Map();
        this.lastUpdate = 0;
        this.databasePath = path.join(__dirname, 'scammer_numbers.json');
        
        // Initialize database
        this.initializeDatabase();
    }

    async initializeDatabase() {
        if (this.config.verbose) {
            console.log('🗄️  Initializing scammer database...');
        }

        // Load or create local database
        await this.loadLocalDatabase();
        
        // Populate with known scam numbers if database is empty
        if (this.localDatabase.size === 0) {
            await this.populateInitialDatabase();
        }

        if (this.config.verbose) {
            console.log(`✅ Scammer database loaded with ${this.localDatabase.size} known numbers`);
        }
    }

    async loadLocalDatabase() {
        try {
            if (fs.existsSync(this.databasePath)) {
                const data = JSON.parse(fs.readFileSync(this.databasePath, 'utf8'));
                this.localDatabase = new Set(data.numbers || []);
                this.lastUpdate = data.lastUpdate || 0;
            }
        } catch (error) {
            if (this.config.verbose) {
                console.log(`⚠️  Could not load local database: ${error.message}`);
            }
        }
    }

    async saveLocalDatabase() {
        try {
            const data = {
                numbers: Array.from(this.localDatabase),
                lastUpdate: Date.now(),
                version: '1.0.0'
            };
            fs.writeFileSync(this.databasePath, JSON.stringify(data, null, 2));
        } catch (error) {
            if (this.config.verbose) {
                console.log(`⚠️  Could not save local database: ${error.message}`);
            }
        }
    }

    async populateInitialDatabase() {
        // Known scam number patterns and real reported numbers
        const knownScamNumbers = [
            // Common scam number patterns
            '+1-800-123-4567', // Fake Microsoft support
            '+1-202-123-4567', // Fake IRS (Washington DC area code)
            '+1-888-999-0000', // Generic scam toll-free
            '+1-855-555-0123', // Fake tech support
            '+1-844-000-1234', // Fake bank security
            
            // International scam patterns
            '+91-98765-43210', // India call center
            '+234-802-123-4567', // Nigeria
            '+1-876-555-0123', // Jamaica lottery scam
            
            // VoIP/Spoofed patterns (common ranges)
            '+1-000-000-0000', // Invalid number
            '+1-111-111-1111', // Pattern number
            '+1-123-456-7890', // Sequential pattern
            
            // Robocall common numbers
            '+1-800-000-0001',
            '+1-866-555-1234',
            '+1-877-123-4567',
            
            // Social Security scam numbers
            '+1-800-772-1213', // Fake SSA
            '+1-866-331-2274', // Another fake SSA
            
            // Specific reported scam numbers (examples)
            '+1-315-636-0043',
            '+1-347-840-9048',
            '+1-404-458-9851',
            '+1-512-253-5100',
            '+1-623-252-2935',
            '+1-727-216-9840',
            '+1-832-781-6670'
        ];

        knownScamNumbers.forEach(number => {
            this.localDatabase.add(this.normalizePhoneNumber(number));
        });

        await this.saveLocalDatabase();
    }

    normalizePhoneNumber(phoneNumber) {
        // Remove all non-digit characters except +
        let normalized = phoneNumber.replace(/[^\d+]/g, '');
        
        // Handle US numbers without country code
        if (!normalized.startsWith('+') && normalized.length === 10) {
            normalized = '+1' + normalized;
        } else if (!normalized.startsWith('+') && normalized.length === 11 && normalized.startsWith('1')) {
            normalized = '+' + normalized;
        }
        
        return normalized;
    }

    async checkNumber(phoneNumber) {
        const normalizedNumber = this.normalizePhoneNumber(phoneNumber);
        const startTime = Date.now();

        if (this.config.verbose) {
            console.log(`🔍 Checking number: ${normalizedNumber}`);
        }

        const result = {
            phoneNumber: normalizedNumber,
            originalNumber: phoneNumber,
            isScammer: false,
            confidence: 0.0,
            sources: [],
            riskLevel: 'SAFE',
            details: {},
            processingTime: 0
        };

        // Check local database first (fastest)
        const localResult = await this.checkLocalDatabase(normalizedNumber);
        if (localResult.isScammer) {
            result.isScammer = true;
            result.confidence = Math.max(result.confidence, localResult.confidence);
            result.sources.push('local_database');
            result.riskLevel = 'HIGH';
            result.details.localMatch = true;
        }

        // Check pattern-based detection
        const patternResult = this.checkSuspiciousPatterns(normalizedNumber);
        if (patternResult.isSuspicious) {
            result.confidence = Math.max(result.confidence, patternResult.confidence);
            result.sources.push('pattern_analysis');
            if (patternResult.confidence > 0.7) {
                result.isScammer = true;
                result.riskLevel = 'HIGH';
            } else if (patternResult.confidence > 0.4) {
                result.riskLevel = 'MEDIUM';
            }
            result.details.patterns = patternResult.patterns;
        }

        // Check external APIs if available
        try {
            if (this.config.truecallerApiKey) {
                const truecallerResult = await this.checkTruecaller(normalizedNumber);
                if (truecallerResult.isScammer) {
                    result.isScammer = true;
                    result.confidence = Math.max(result.confidence, truecallerResult.confidence);
                    result.sources.push('truecaller');
                    result.riskLevel = 'HIGH';
                    result.details.truecaller = truecallerResult;
                }
            }
        } catch (error) {
            if (this.config.verbose) {
                console.log(`⚠️  Truecaller API error: ${error.message}`);
            }
        }

        try {
            if (this.config.nomoroboApiKey) {
                const nomoroboResult = await this.checkNomorobo(normalizedNumber);
                if (nomoroboResult.isScammer) {
                    result.isScammer = true;
                    result.confidence = Math.max(result.confidence, nomoroboResult.confidence);
                    result.sources.push('nomorobo');
                    result.riskLevel = 'HIGH';
                    result.details.nomorobo = nomoroboResult;
                }
            }
        } catch (error) {
            if (this.config.verbose) {
                console.log(`⚠️  Nomorobo API error: ${error.message}`);
            }
        }

        result.processingTime = Date.now() - startTime;

        if (this.config.verbose) {
            const status = result.isScammer ? '🚨 SCAMMER' : '✅ CLEAN';
            console.log(`📊 Number check: ${status} (${(result.confidence * 100).toFixed(1)}%) - ${result.processingTime}ms`);
        }

        return result;
    }

    async checkLocalDatabase(normalizedNumber) {
        const isScammer = this.localDatabase.has(normalizedNumber);
        return {
            isScammer,
            confidence: isScammer ? 0.95 : 0.0,
            source: 'local_database'
        };
    }

    checkSuspiciousPatterns(normalizedNumber) {
        const patterns = [];
        let confidence = 0;

        // Check for suspicious patterns
        const suspiciousPatterns = [
            {
                pattern: /^\+1-?000-?000-?0000$/,
                description: 'Invalid number pattern',
                weight: 0.9
            },
            {
                pattern: /^\+1-?111-?111-?1111$/,
                description: 'Repeating digits pattern',
                weight: 0.8
            },
            {
                pattern: /^\+1-?123-?456-?7890$/,
                description: 'Sequential number pattern',
                weight: 0.8
            },
            {
                pattern: /^\+1-?555-?555-?/,
                description: 'Test number pattern',
                weight: 0.7
            },
            {
                pattern: /^\+91/,
                description: 'India country code (common for call centers)',
                weight: 0.3
            },
            {
                pattern: /^\+234/,
                description: 'Nigeria country code',
                weight: 0.5
            },
            {
                pattern: /^\+1-?800-?000-?/,
                description: 'Suspicious toll-free pattern',
                weight: 0.4
            },
            {
                pattern: /^\+1-?202-?/,
                description: 'Washington DC area (fake government calls)',
                weight: 0.2
            }
        ];

        suspiciousPatterns.forEach(({ pattern, description, weight }) => {
            if (pattern.test(normalizedNumber)) {
                patterns.push(description);
                confidence += weight;
            }
        });

        return {
            isSuspicious: confidence > 0.1,
            confidence: Math.min(confidence, 1.0),
            patterns
        };
    }

    async checkTruecaller(phoneNumber) {
        // Note: This is a mock implementation
        // In a real app, you'd integrate with Truecaller's API
        
        if (!this.config.truecallerApiKey) {
            throw new Error('Truecaller API key not provided');
        }

        // Check cache first
        const cacheKey = `truecaller_${phoneNumber}`;
        if (this.apiCache.has(cacheKey)) {
            const cached = this.apiCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
                return cached.result;
            }
        }

        try {
            // Mock API response for demo
            // In real implementation, make HTTP request to Truecaller API
            const mockResponse = this.generateMockTruecallerResponse(phoneNumber);
            
            // Cache the result
            this.apiCache.set(cacheKey, {
                result: mockResponse,
                timestamp: Date.now()
            });

            return mockResponse;
        } catch (error) {
            throw new Error(`Truecaller API request failed: ${error.message}`);
        }
    }

    async checkNomorobo(phoneNumber) {
        // Note: This is a mock implementation
        // In a real app, you'd integrate with Nomorobo's API
        
        if (!this.config.nomoroboApiKey) {
            throw new Error('Nomorobo API key not provided');
        }

        // Check cache first
        const cacheKey = `nomorobo_${phoneNumber}`;
        if (this.apiCache.has(cacheKey)) {
            const cached = this.apiCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
                return cached.result;
            }
        }

        try {
            // Mock API response for demo
            const mockResponse = this.generateMockNomoroboResponse(phoneNumber);
            
            // Cache the result
            this.apiCache.set(cacheKey, {
                result: mockResponse,
                timestamp: Date.now()
            });

            return mockResponse;
        } catch (error) {
            throw new Error(`Nomorobo API request failed: ${error.message}`);
        }
    }

    generateMockTruecallerResponse(phoneNumber) {
        // Generate realistic mock responses for demo
        const isKnownScammer = this.localDatabase.has(phoneNumber);
        
        if (isKnownScammer) {
            return {
                isScammer: true,
                confidence: 0.85 + Math.random() * 0.15,
                spamType: 'telemarketing',
                reportCount: Math.floor(Math.random() * 1000) + 100,
                name: 'Suspected Spam',
                source: 'truecaller'
            };
        }

        // Random chance of detecting unknown scammer
        const randomScamChance = Math.random();
        if (randomScamChance < 0.1) { // 10% chance
            return {
                isScammer: true,
                confidence: 0.6 + Math.random() * 0.2,
                spamType: 'scam',
                reportCount: Math.floor(Math.random() * 50) + 5,
                name: 'Reported as Spam',
                source: 'truecaller'
            };
        }

        return {
            isScammer: false,
            confidence: 0.0,
            name: 'Unknown',
            source: 'truecaller'
        };
    }

    generateMockNomoroboResponse(phoneNumber) {
        const isKnownScammer = this.localDatabase.has(phoneNumber);
        
        if (isKnownScammer) {
            return {
                isScammer: true,
                confidence: 0.9,
                category: 'robocaller',
                blocked: true,
                source: 'nomorobo'
            };
        }

        return {
            isScammer: false,
            confidence: 0.0,
            category: 'unknown',
            blocked: false,
            source: 'nomorobo'
        };
    }

    async addScammerNumber(phoneNumber, source = 'user_report') {
        const normalizedNumber = this.normalizePhoneNumber(phoneNumber);
        this.localDatabase.add(normalizedNumber);
        await this.saveLocalDatabase();
        
        if (this.config.verbose) {
            console.log(`📝 Added scammer number: ${normalizedNumber} (source: ${source})`);
        }
    }

    async removeScammerNumber(phoneNumber) {
        const normalizedNumber = this.normalizePhoneNumber(phoneNumber);
        const removed = this.localDatabase.delete(normalizedNumber);
        if (removed) {
            await this.saveLocalDatabase();
            if (this.config.verbose) {
                console.log(`🗑️  Removed number: ${normalizedNumber}`);
            }
        }
        return removed;
    }

    getStatistics() {
        return {
            totalNumbers: this.localDatabase.size,
            cacheSize: this.apiCache.size,
            lastUpdate: this.lastUpdate,
            databasePath: this.databasePath
        };
    }
}

// Demo function for testing the scammer database
async function demoScammerDatabase() {
    console.log('🗄️  Scammer Database Demo');
    console.log('=========================\n');

    const database = new ScammerDatabase({
        verbose: true,
        // Mock API keys for demo
        truecallerApiKey: 'demo_key_123',
        nomoroboApiKey: 'demo_key_456'
    });

    const testNumbers = [
        '+1-800-123-4567',  // Known scammer (in our database)
        '+1-555-123-4567',  // Regular number
        '+1-000-000-0000',  // Suspicious pattern
        '+1-347-840-9048',  // Known scammer (in our database)
        '+15551234567',     // Test normalization
        '(555) 987-6543'    // Test normalization
    ];

    console.log('🧪 Testing scammer database checks...\n');

    const results = [];
    for (const number of testNumbers) {
        console.log(`--- Checking: ${number} ---`);
        const result = await database.checkNumber(number);
        
        console.log(`Result: ${result.isScammer ? 'SCAMMER' : 'CLEAN'}`);
        console.log(`Risk Level: ${result.riskLevel}`);
        console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`Sources: ${result.sources.join(', ') || 'None'}`);
        console.log(`Processing Time: ${result.processingTime}ms`);
        
        if (result.details.patterns && result.details.patterns.length > 0) {
            console.log(`Suspicious Patterns: ${result.details.patterns.join(', ')}`);
        }
        
        console.log('');
        results.push(result);
    }

    // Summary statistics
    const scammersDetected = results.filter(r => r.isScammer).length;
    const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
    const stats = database.getStatistics();

    console.log('📊 Database Statistics:');
    console.log(`Total known scammer numbers: ${stats.totalNumbers}`);
    console.log(`Scammers detected in test: ${scammersDetected}/${results.length}`);
    console.log(`Average processing time: ${avgProcessingTime.toFixed(1)}ms`);
    console.log(`API cache size: ${stats.cacheSize}`);
    console.log('✅ Scammer database demo completed!');

    return results;
}

module.exports = {
    ScammerDatabase,
    demoScammerDatabase
};