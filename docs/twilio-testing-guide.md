# Twilio Integration Testing Guide

## Prerequisites

Before testing, ensure you have:

1. ✅ Twilio account with verified phone number
2. ✅ OpenAI API key with Realtime API access
3. ✅ Cloudflare Tunnel configured and running
4. ✅ Environment variables set in `.env`:
   ```bash
   OPENAI_API_KEY=sk-...
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+1...
   PUBLIC_DOMAIN=your-domain.com
   ```

## Local Development Setup

### 1. Start All Services

```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Start Twilio server
npm run twilio:dev

# Or run both together:
npm run dev:all
```

### 2. Verify Services

**Check Next.js:**
```bash
curl http://localhost:3000
```

**Check Twilio Server:**
```bash
curl http://localhost:5050/twilio/health
```
Expected: `{"status":"ok","timestamp":"..."}`

**Check Cloudflare Tunnel:**
```bash
curl https://your-domain.com/twilio/health
```

## Unit Testing

### Health Endpoint

```bash
curl -X GET https://your-domain.com/twilio/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-02T03:00:00.000Z"
}
```

### Incoming Call Endpoint

```bash
curl -X POST https://your-domain.com/twilio/incoming-call \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=CAxxxx&From=+1234567890&To=+1234567890"
```

**Expected Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Please wait while we connect you.</Say>
    <Connect>
        <Stream url="wss://your-domain.com/twilio/media-stream" />
    </Connect>
</Response>
```

### Outbound Call API

```bash
curl -X POST https://your-domain.com/twilio/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "task": {
      "type": "custom",
      "prompt": "You are calling to test the system. Say hello and hang up.",
      "context": {}
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "callSid": "CAxxxx",
  "status": "initiated",
  "estimatedDuration": "60-120 seconds"
}
```

## Integration Testing

### Test 1: Incoming Call Flow

**Setup:**
1. Configure a Twilio phone number to use webhook URL:
   - Voice URL: `https://your-domain.com/twilio/incoming-call`
   - Method: `POST`

**Test Steps:**
1. Call your Twilio number from your phone
2. Listen for the greeting message
3. Start speaking
4. Verify the agent responds
5. Have a brief conversation
6. Hang up

**Success Criteria:**
- ✅ Call connects successfully
- ✅ Greeting plays
- ✅ Agent responds to speech
- ✅ Conversation is natural
- ✅ Audio quality is acceptable
- ✅ Call terminates cleanly

**Debug:**
```bash
# Watch Twilio server logs
DEBUG=openai-agents:extensions:twilio* npm run twilio:dev

# Check Twilio console for call logs
# https://console.twilio.com/us1/monitor/logs/calls
```

### Test 2: Outbound Call Flow

**Test Steps:**
1. Make API request to initiate call:
   ```bash
   curl -X POST https://your-domain.com/twilio/outbound-call \
     -H "Content-Type: application/json" \
     -d '{
       "to": "+1YOUR_PHONE",
       "task": {
         "type": "custom",
         "prompt": "You are calling to remind about an appointment tomorrow at 2 PM. Be brief and professional.",
         "context": {
           "customerName": "Test User",
           "appointmentDate": "2025-10-03T14:00:00Z"
         }
       }
     }'
   ```

2. Answer the incoming call on your phone
3. Listen to the agent
4. Respond appropriately
5. Let the call complete naturally

**Success Criteria:**
- ✅ API returns success with callSid
- ✅ Phone rings within 5 seconds
- ✅ Agent identifies itself as AI
- ✅ Task prompt is followed
- ✅ Context is used appropriately
- ✅ Call ends gracefully

### Test 3: WebSocket Connection

**Manual Test:**
Use a WebSocket client (e.g., `wscat`) to simulate Twilio:

```bash
npm install -g wscat

wscat -c "wss://your-domain.com/twilio/media-stream"
```

**Send Connected Event:**
```json
{"event":"connected","protocol":"Call","version":"1.0.0"}
```

**Send Start Event:**
```json
{
  "event": "start",
  "sequenceNumber": "1",
  "start": {
    "streamSid": "MZtest",
    "accountSid": "ACtest",
    "callSid": "CAtest",
    "mediaFormat": {
      "encoding": "audio/x-mulaw",
      "sampleRate": 8000,
      "channels": 1
    }
  }
}
```

**Success Criteria:**
- ✅ Connection accepted
- ✅ No errors in server logs
- ✅ Session created successfully

### Test 4: Error Handling

**Invalid Phone Number:**
```bash
curl -X POST https://your-domain.com/twilio/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "to": "invalid",
    "task": {"type": "custom", "prompt": "test"}
  }'
```

**Expected:**
```json
{
  "success": false,
  "error": "Invalid phone number format",
  "code": "INVALID_PHONE"
}
```

**Missing Required Fields:**
```bash
curl -X POST https://your-domain.com/twilio/outbound-call \
  -H "Content-Type: application/json" \
  -d '{"to": "+1234567890"}'
```

**Expected:**
```json
{
  "success": false,
  "error": "Missing required field: task",
  "code": "VALIDATION_ERROR"
}
```

## Performance Testing

### Concurrent Calls

Test multiple simultaneous calls:

```bash
# Create 5 concurrent calls
for i in {1..5}; do
  curl -X POST https://your-domain.com/twilio/outbound-call \
    -H "Content-Type: application/json" \
    -d '{
      "to": "+1234567890",
      "task": {
        "type": "custom",
        "prompt": "Say hello and hang up. This is call number '$i'."
      }
    }' &
done
```

**Monitor:**
- Server CPU/memory usage
- Response times
- Call quality degradation
- Error rates

**Success Criteria:**
- ✅ All calls initiate successfully
- ✅ No crashes or errors
- ✅ Response time < 500ms
- ✅ Audio quality remains consistent

### Long-Running Calls

Test call duration limits and stability:

1. Initiate call with long conversation task
2. Keep call active for 5+ minutes
3. Monitor memory usage
4. Verify cleanup after call ends

## Task Type Testing

### Appointment Reminder

```bash
curl -X POST https://your-domain.com/twilio/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "task": {
      "type": "appointment_reminder",
      "prompt": "Remind about dentist appointment tomorrow at 10 AM",
      "context": {
        "appointmentType": "Dentist",
        "appointmentDate": "2025-10-03T10:00:00Z",
        "location": "123 Main St"
      }
    }
  }'
```

**Validation:**
- Agent mentions appointment type
- Agent states correct date/time
- Agent asks for confirmation
- Agent ends call appropriately

### Survey

```bash
curl -X POST https://your-domain.com/twilio/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "task": {
      "type": "survey",
      "prompt": "Conduct a 3-question customer satisfaction survey",
      "context": {
        "questions": [
          "How satisfied are you with our service?",
          "Would you recommend us?",
          "Any suggestions for improvement?"
        ]
      }
    }
  }'
```

**Validation:**
- All questions asked
- Responses collected
- Natural conversation flow
- Survey completes successfully

### Notification

```bash
curl -X POST https://your-domain.com/twilio/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "task": {
      "type": "notification",
      "prompt": "Notify about a delivery arriving today between 2-4 PM",
      "context": {
        "orderNumber": "12345",
        "deliveryWindow": "2-4 PM today"
      }
    }
  }'
```

**Validation:**
- Message delivered clearly
- Key details mentioned
- Confirmation requested
- Quick call completion

## Debugging Guide

### Common Issues

#### Issue: WebSocket Connection Fails

**Symptoms:**
- Incoming calls don't connect
- Silent calls
- "Stream failed" in Twilio logs

**Debug Steps:**
1. Check Cloudflare Tunnel logs:
   ```bash
   docker logs <cloudflared-container>
   ```

2. Verify WebSocket route:
   ```bash
   curl -i -N \
     -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test" \
     https://your-domain.com/twilio/media-stream
   ```
   Expected: `101 Switching Protocols`

3. Check Twilio server logs:
   ```bash
   DEBUG=* npm run twilio:dev
   ```

#### Issue: No Audio from Agent

**Symptoms:**
- Call connects
- Can hear user
- Agent doesn't respond

**Debug Steps:**
1. Verify OpenAI API key is valid
2. Check OpenAI connection in logs
3. Verify audio format configuration
4. Check RealtimeSession events

#### Issue: High Latency

**Symptoms:**
- Long delays between speech
- Echo or feedback
- Choppy audio

**Debug Steps:**
1. Check network latency to OpenAI
2. Verify audio buffer settings
3. Monitor server CPU/memory
4. Check Twilio media region

#### Issue: Call Doesn't Terminate

**Symptoms:**
- Call continues after agent finishes
- Manual hangup required

**Debug Steps:**
1. Check agent instructions for call termination
2. Verify hangup event handling
3. Review RealtimeSession disconnect logic

### Log Analysis

**Enable Debug Logs:**
```bash
DEBUG=openai-agents:extensions:twilio*,openai-agents:realtime npm run twilio:dev
```

**Key Log Messages:**

✅ **Success Indicators:**
```
INF Registered tunnel connection
INF WebSocket connection established
INF RealtimeSession connected
INF Audio stream started
```

❌ **Error Indicators:**
```
ERR Failed to connect to OpenAI
ERR WebSocket connection closed unexpectedly
ERR Invalid audio format
ERR Tool call failed
```

### Twilio Console Monitoring

Check [Twilio Console](https://console.twilio.com):

1. **Call Logs**: Monitor call status, duration, errors
2. **Media Streams**: Check stream connections
3. **Debugger**: Real-time webhook inspection
4. **Usage**: Track API usage and costs

## Testing Checklist

Before considering implementation complete:

### Functional Tests
- [ ] Health endpoint responds
- [ ] Incoming calls connect
- [ ] WebSocket accepts connections
- [ ] Outbound calls initiate
- [ ] Agent responds appropriately
- [ ] Calls terminate gracefully
- [ ] All task types work
- [ ] Error handling works

### Performance Tests
- [ ] Single call performs well
- [ ] 5+ concurrent calls work
- [ ] Long calls (5+ min) stable
- [ ] Memory doesn't leak
- [ ] Response time < 500ms

### Edge Cases
- [ ] Invalid phone numbers rejected
- [ ] Missing fields handled
- [ ] Network disconnects handled
- [ ] API rate limits handled
- [ ] Invalid tokens rejected

### User Experience
- [ ] Audio quality is good
- [ ] Latency is acceptable
- [ ] Agent sounds natural
- [ ] Instructions are followed
- [ ] Calls feel professional

## Load Testing (Advanced)

For production readiness, test with realistic load:

```bash
# Install Artillery
npm install -g artillery

# Create load test config: artillery-config.yml
# Run load test
artillery run artillery-config.yml
```

**Example Config:**
```yaml
config:
  target: "https://your-domain.com"
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 120
      arrivalRate: 10
      name: "Sustained load"

scenarios:
  - name: "Outbound call"
    flow:
      - post:
          url: "/twilio/outbound-call"
          json:
            to: "+1234567890"
            task:
              type: "custom"
              prompt: "Quick test call"
```

## Reporting Issues

When reporting bugs, include:

1. **Environment**:
   - Node.js version
   - OS
   - Twilio phone number region

2. **Reproduction Steps**:
   - Exact curl command or code
   - Expected vs actual behavior

3. **Logs**:
   - Twilio server logs (with DEBUG=*)
   - Twilio console call logs
   - Cloudflare Tunnel logs

4. **Timing**:
   - When did issue occur?
   - How frequently?
   - Intermittent or consistent?

## Success Metrics

Track these metrics for production monitoring:

- **Call Success Rate**: Target > 95%
- **Average Call Duration**: Depends on task
- **Time to First Response**: Target < 2 seconds
- **Audio Quality Score**: Target > 4/5
- **Error Rate**: Target < 5%
- **API Latency (OpenAI)**: Target < 500ms
- **Cost per Call**: Monitor and optimize

## Next Steps After Testing

Once all tests pass:

1. Document any discovered edge cases
2. Update agent prompts based on real conversations
3. Implement additional monitoring
4. Set up alerting for failures
5. Plan gradual rollout strategy
