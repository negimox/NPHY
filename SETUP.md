# Voice Scam Shield - Installation and Setup Guide

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+ (for NPHY models)
- Git

### Installation

1. **Clone and Install Dependencies**

```bash
cd mit_hackathon/project
npm install
pip install -r NPHY/requirements.txt
```

2. **Environment Configuration**

```bash
cp .env.example .env
# Edit .env with your API keys (see Configuration section)
```

3. **Run Demo Mode** (Recommended for first-time users)

```bash
npm run demo
```

4. **Access Dashboard**
   Open http://localhost:3000/dashboard in your browser

## Configuration

### Required API Keys

Add these to your `.env` file:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
WEBHOOK_BASE_URL=https://your-domain.com

# AI Services
ELEVENLABS_API_KEY=your_elevenlabs_api_key
GROQ_API_KEY=your_groq_api_key

# Phone Verification (Optional)
TRUECALLER_API_KEY=your_truecaller_api_key
NOMOROBO_API_KEY=your_nomorobo_api_key

# Security
WEBHOOK_VALIDATION=true
LOG_LEVEL=info
SECURITY_LOG_ENABLED=true
```

### Feature Configuration

```bash
# Detection Features
ENABLE_DEEPFAKE_DETECTION=true
ENABLE_SCAM_ANALYSIS=true
ENABLE_PHONE_VERIFICATION=true
ENABLE_REALTIME_ALERTS=true

# Performance Tuning
DEEPFAKE_THRESHOLD=0.4
SCAM_RISK_THRESHOLD=0.6
CONFIDENCE_THRESHOLD=0.7
MAX_CONCURRENT_CALLS=10
RESPONSE_TIMEOUT_MS=5000

# Multilingual Support
ALERT_LANGUAGES=en,es,fr
PRIMARY_LANGUAGE=en
```

## Running in Production

### 1. Standard Mode

```bash
npm start
```

### 2. Development Mode with Auto-restart

```bash
npm run dev
```

### 3. Testing Mode

```bash
npm test
```

### 4. Production Deployment

```bash
npm run build
npm run prod
```

## Twilio Integration Setup

### 1. Configure Webhooks in Twilio Console

**Incoming Call Webhook:**

- URL: `https://your-domain.com/webhook/voice`
- Method: POST

**⚠️ Important: Call Status and Recording webhooks are configured differently!**

### 2. Call Status Webhooks

**Call status webhooks are NOT configured in the Twilio Console.** They are automatically configured through TwiML when calls are processed. Our implementation already handles this in the `generateCallHandlingTwiML` method.

**What our system does automatically:**

- Sets `statusCallback` on `<Dial>` elements
- Configures `statusCallbackEvent` for: `initiated`, `ringing`, `answered`, `completed`
- Uses endpoint: `https://your-domain.com/webhook/status`

### 3. Recording Webhooks

**Recording webhooks are automatically configured when recording starts.** Our implementation sets:

- `recordingStatusCallback: https://your-domain.com/webhook/recording`
- `recordingStatusCallbackEvent: ['in-progress', 'completed']`

**No manual configuration needed in Twilio Console for status/recording webhooks!**

### 2. Phone Number Configuration

In Twilio Console, configure your phone number:

1. Go to Phone Numbers → Manage → Active Numbers
2. Click on your Twilio phone number
3. In the "Voice Configuration" section:
   - **Webhook**: Select "Webhook"
   - **URL**: `https://your-domain.com/webhook/voice`
   - **HTTP Method**: POST
4. Save the configuration

### 3. Testing Your Webhook Setup

**Test Incoming Call Webhook:**

```bash
curl -X POST https://your-domain.com/webhook/voice \
  -d "CallSid=test123&From=%2B1555123456&To=your-twilio-number&CallStatus=ringing"
```

**Test Call Status Webhook:**

```bash
curl -X POST https://your-domain.com/webhook/status \
  -d "CallSid=test123&CallStatus=completed&CallDuration=45"
```

**Test Recording Webhook:**

```bash
curl -X POST https://your-domain.com/webhook/recording \
  -d "CallSid=test123&RecordingSid=rec123&RecordingStatus=completed&RecordingUrl=https://example.com/recording.mp3"
```

### 4. Environment Configuration

Make sure these are set in your `.env` file:

```bash
# Required for call forwarding (optional)
FORWARD_TO_NUMBER=+1234567890

# Enable recording
ENABLE_CALL_RECORDING=true
MAX_RECORDING_LENGTH=300
```

## API Documentation

### Health Check

```bash
GET /health
```

### Real-time Metrics

```bash
GET /api/metrics
```

### Call Management

```bash
GET /api/calls/active          # Active calls
GET /api/calls/history         # Call history
GET /api/calls/{callSid}       # Call details
POST /api/calls/{callSid}/alert # Send manual alert
POST /api/calls/{callSid}/terminate # Terminate call
```

### Analytics

```bash
GET /api/analytics?period=24h  # Analytics data
GET /api/stats/summary         # Summary statistics
GET /api/configuration         # System configuration
```

## Dashboard Features

### Real-time Monitoring

- Live call status and metrics
- Scam detection alerts
- System health monitoring
- Performance analytics

### Interactive Controls

- Manual alert sending
- Call termination
- Real-time configuration viewing
- Historical data analysis

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Load Testing

```bash
npm run test:load
```

### Manual Testing with cURL

```bash
# Simulate incoming call
curl -X POST http://localhost:3000/webhook/incoming-call \
  -d "CallSid=test123&From=%2B1555123456&To=%2B1555000000&CallStatus=ringing"

# Check system health
curl http://localhost:3000/health

# Get metrics
curl http://localhost:3000/api/metrics
```

## Performance Optimization

### Recommended Settings for Production

```bash
# High-volume environments
MAX_CONCURRENT_CALLS=50
RESPONSE_TIMEOUT_MS=3000
DEEPFAKE_THRESHOLD=0.5

# Memory optimization
NODE_OPTIONS="--max-old-space-size=4096"

# Logging
LOG_LEVEL=warn
SECURITY_LOG_ENABLED=true
```

### Monitoring and Alerts

1. **Performance Metrics to Monitor:**
   - Average response time (target: <2 seconds)
   - Detection accuracy (target: >80%)
   - System uptime
   - Memory usage
   - Active call count

2. **Alert Thresholds:**
   - Response time > 3 seconds
   - Accuracy < 75%
   - Memory usage > 85%
   - Error rate > 5%

## Troubleshooting

### Common Issues

1. **Twilio Webhook Errors**
   - Check webhook URL is publicly accessible
   - Verify webhook signature validation
   - Check Twilio account credentials

2. **Audio Processing Issues**
   - Ensure Python dependencies are installed
   - Check NPHY model files are present
   - Verify audio format compatibility

3. **Performance Issues**
   - Monitor response times in dashboard
   - Check system resources (CPU, memory)
   - Review log files for errors

4. **Detection Accuracy Issues**
   - Adjust detection thresholds
   - Check model performance metrics
   - Verify training data quality

### Log Files

- Application logs: `logs/voice-scam-shield.log`
- Error logs: `logs/error.log`
- Security logs: `logs/security.log`

### Debug Mode

```bash
LOG_LEVEL=debug npm start
```

## Security Considerations

### Webhook Security

- Enable webhook signature validation
- Use HTTPS for all webhook URLs
- Implement rate limiting

### Data Protection

- Encrypt sensitive data at rest
- Use secure API key storage
- Implement audit logging

### Access Control

- Restrict dashboard access
- Use authentication for API endpoints
- Monitor for unusual activity

## Support and Maintenance

### Regular Updates

```bash
# Update dependencies
npm update

# Update NPHY models
python NPHY/update_models.py

# Security updates
npm audit fix
```

### Backup and Recovery

- Backup configuration files
- Export call history data
- Document custom settings

### Performance Monitoring

- Monitor system metrics
- Review detection accuracy
- Analyze call patterns

For additional support, check the logs or contact the development team.
