# Voice Scam Shield - Twilio Integration MVP

A real-time multilingual AI system for detecting and preventing voice scams during phone calls using Twilio Voice API integration with advanced deepfake detection and scam pattern analysis.

## 🎯 Project Overview

This solution integrates the existing NPHY voice detection system with Twilio Voice API to create a comprehensive real-time scam detection platform that monitors phone calls for:

- **Synthetic Voice Detection** (AASIST + ASVspoof patterns)
- **Scam Content Analysis** (LLM-powered pattern recognition)
- **Real-time Multilingual Alerts** (English, Spanish, French)
- **Caller Verification** against scammer databases

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Incoming      │    │    Twilio        │    │   Voice Scam    │
│   Phone Call    │───▶│   Voice API      │───▶│   Shield MVP    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                    ┌──────────────────┐    ┌─────────────────┐
                    │   Real-time      │    │   NPHY Engine   │
                    │   Audio Stream   │───▶│   (Existing)    │
                    └──────────────────┘    └─────────────────┘
                                                    │
                                                    ▼
                    ┌──────────────────────────────────────────┐
                    │           Detection Pipeline             │
                    │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
                    │  │ AASIST  │ │ASVspoof │ │ Content │    │
                    │  │ Neural  │ │ Pattern │ │Analysis │    │
                    │  │Detection│ │Analysis │ │ (LLM)  │    │
                    │  └─────────┘ └─────────┘ └─────────┘    │
                    └──────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────────────┐
                    │        Risk Assessment Engine           │
                    │   (Real-time scoring & alert system)    │
                    └──────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────────────┐
                    │    Multilingual Alert System            │
                    │   (Discreet on-call voice warnings)     │
                    └──────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

1. **Twilio Account** with Voice API access
2. **Node.js** (v14.0.0+)
3. **API Keys**:
   - Twilio Account SID & Auth Token
   - ElevenLabs API Key (for TTS alerts)
   - Groq API Key (for LLM scam analysis)

### Installation

```bash
# Clone and setup
git clone <repository>
cd voice-scam-shield
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### Environment Configuration

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number

# NPHY Engine APIs
XI_API_KEY=your_elevenlabs_key
GROQ_API_KEY=your_groq_key

# Server Configuration
PORT=3000
WEBHOOK_BASE_URL=https://your-domain.ngrok.io

# Detection Settings
DEEPFAKE_THRESHOLD=0.4
SCAM_RISK_THRESHOLD=0.6
ALERT_LANGUAGES=en,es,fr
```

## 📱 Supported Languages

- **English** (Primary)
- **Spanish** (Español)
- **French** (Français)
- _Extensible for additional languages_

## 🛡️ Detection Capabilities

### Real-time Analysis

- **≤2 seconds** alert latency requirement
- **≥80%** scam detection accuracy target
- **≤10%** Equal Error Rate for synthetic voice detection

### Detection Methods

1. **AASIST Neural Network** - Synthetic speech detection
2. **ASVspoof Pattern Analysis** - Known attack pattern matching
3. **LLM Content Analysis** - Social engineering detection
4. **Caller ID Verification** - Scammer database lookup

### Risk Levels

- 🟢 **SAFE** - No risk detected
- 🟡 **LOW** - Minor suspicious indicators
- 🟠 **MEDIUM** - Multiple risk factors
- 🔴 **HIGH** - Clear scam indicators
- ⚫ **CRITICAL** - Confirmed synthetic voice
- 🚨 **MAXIMUM** - Multiple attack vectors detected

## 🔧 API Endpoints

### Twilio Webhooks

- `POST /webhook/voice` - Handle incoming calls
- `POST /webhook/status` - Call status updates
- `POST /webhook/recording` - Recording status updates

### Monitoring Dashboard

- `GET /dashboard` - Real-time monitoring interface
- `GET /api/calls` - Call history and analytics
- `GET /api/alerts` - Alert history

### Health Checks

- `GET /health` - System health status
- `GET /health/models` - AI model status

## 🎮 Usage Examples

### Basic Call Monitoring

```javascript
// Automatic monitoring for incoming calls
// No user intervention required - system monitors automatically

// Manual API call for testing
const response = await fetch("/api/analyze-call", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    callSid: "CA1234567890...",
    audioUrl: "https://api.twilio.com/recordings/...",
  }),
});
```

### Dashboard Integration

```html
<!-- Real-time monitoring dashboard -->
<div id="scam-shield-dashboard">
  <div class="call-status">
    <span class="risk-level">MONITORING</span>
    <span class="caller-info">+1-555-0123</span>
  </div>
  <div class="detection-results">
    <!-- Real-time updates via WebSocket -->
  </div>
</div>
```

## 🔒 Security & Privacy

- **No audio storage** - Real-time processing only
- **Encrypted data transmission** - All API calls secured
- **Minimal data retention** - Call metadata only
- **GDPR compliant** - Privacy by design

## 🧪 Testing

```bash
# Run test suite
npm test

# Test individual components
npm run test:deepfake
npm run test:scam-analysis
npm run test:twilio-integration

# Demo mode (simulated calls)
npm run demo:scam-call
npm run demo:legitimate-call
```

## 📊 Performance Metrics

### Evaluation Criteria Compliance

✅ **Coverage**: Phone calls with multilingual support (EN/ES/FR)
✅ **Detection Accuracy**: ≥80% correct classification target
✅ **Anti-Spoofing**: ≤10% Equal Error Rate target
✅ **Latency**: ≤2 seconds alert timing
✅ **User Experience**: Discreet, non-disruptive alerts

### Monitoring Dashboard

- Real-time call analysis status
- Detection accuracy metrics
- Response time monitoring
- Alert effectiveness tracking

## 🌐 Deployment

### Production Deployment

```bash
# Build for production
npm run build

# Deploy to cloud platform
npm run deploy

# Configure Twilio webhooks to point to your domain
```

### Scaling Considerations

- **Horizontal scaling** for multiple concurrent calls
- **Load balancing** for high-volume scenarios
- **Regional deployment** for global coverage
- **Real-time monitoring** and alerting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🆘 Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](./issues)
- **Discord**: [Community Support](./discord)

---

**Built for MIT Hackathon 2025** - Protecting users from AI-driven voice scams in real-time.
