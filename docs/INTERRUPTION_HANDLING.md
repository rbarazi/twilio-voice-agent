# Interruption Handling Specification

## Overview

This document specifies the implementation of sophisticated interruption handling for the Twilio voice agent system. When a user interrupts the AI while it's speaking, the system must:

1. Immediately stop audio playback on the phone
2. Inform OpenAI exactly how much of the response was heard
3. Clear buffered audio to prevent continued playback
4. Maintain accurate conversation context

## Current Implementation (Before)

```typescript
if (event.type === 'input_audio_buffer.speech_started') {
    session?.cancelResponse();  // Only cancels future generation
    // ❌ Missing: precise truncation with timing
    // ❌ Missing: Twilio buffer clearing
    // ❌ Missing: conversation history accuracy
}
```

**Problems:**
- Buffered audio continues playing for 1-2 seconds after interruption
- OpenAI doesn't know how much the user actually heard
- Less natural conversation flow
- Context tracking is imprecise

## Target Implementation (After)

### Architecture

```
User interrupts (starts speaking)
    ↓
1. Detect speech_started event
    ↓
2. Calculate elapsed time (current - responseStart)
    ↓
3. Send conversation.item.truncate to OpenAI
    ↓
4. Send 'clear' event to Twilio Media Stream
    ↓
5. Reset tracking state
    ↓
6. Broadcast interruption event to UI
```

### State Tracking Required

```typescript
interface InterruptionState {
  // Timestamp tracking
  latestMediaTimestamp: number;           // Current position in Twilio stream (ms)
  responseStartTimestampTwilio: number | null;  // When AI started speaking (ms)

  // Response tracking
  lastAssistantItem: string | null;       // Current response item_id from OpenAI

  // Optional: Mark queue for precise playback tracking
  markQueue: string[];                    // Track audio chunks in flight
}
```

### Implementation Steps

#### Step 1: Track Media Timestamps

Monitor all Twilio media events to maintain current timestamp:

```typescript
// In media-stream.ts WebSocket handler
let latestMediaTimestamp = 0;

socket.on('message', (message) => {
  const data = JSON.parse(message.toString());

  if (data.event === 'media') {
    latestMediaTimestamp = data.media.timestamp;
  }
});
```

#### Step 2: Track Response Start Time

When AI begins speaking, record the timestamp:

```typescript
session.on('transport_event', (event: any) => {
  if (event.type === 'response.audio.delta') {
    // First delta from new response
    if (!responseStartTimestampTwilio) {
      responseStartTimestampTwilio = latestMediaTimestamp;
      logger.info('AI started speaking', {
        callSid,
        timestamp: responseStartTimestampTwilio
      });
    }

    // Track which response item is currently playing
    if (event.item_id) {
      lastAssistantItem = event.item_id;
    }
  }
});
```

#### Step 3: Handle Interruption with Truncation

When user starts speaking, truncate the AI response:

```typescript
if (event.type === 'input_audio_buffer.speech_started') {
  logger.info('🎤 User interrupted AI', { callSid });

  // Only truncate if AI was actually speaking
  if (responseStartTimestampTwilio != null && lastAssistantItem) {
    // Calculate how much audio the user heard
    const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;

    logger.info('Truncating AI response', {
      callSid,
      item_id: lastAssistantItem,
      audio_heard_ms: elapsedTime
    });

    // Tell OpenAI to truncate the response in conversation history
    // This is done via the transport layer or session
    // Using the RealtimeSession API if available
    try {
      session?.cancelResponse(); // Cancel future generation

      // TODO: Check if @openai/agents supports truncation
      // If not, we may need to send raw event via transport
    } catch (error) {
      logger.error('Failed to truncate response', { callSid, error });
    }

    // Clear Twilio's audio buffer to stop playback immediately
    socket.send(JSON.stringify({
      event: 'clear',
      streamSid: streamSid
    }));

    // Reset state
    responseStartTimestampTwilio = null;
    lastAssistantItem = null;
  }

  // Broadcast to UI
  broadcastEvent({
    type: 'conversation.interrupted',
    callSid,
    data: {
      reason: 'User started speaking',
      audioHeardMs: responseStartTimestampTwilio
        ? latestMediaTimestamp - responseStartTimestampTwilio
        : 0
    }
  });
}
```

#### Step 4: Reset State on Response Completion

```typescript
if (event.type === 'response.audio_transcript.done') {
  // AI finished speaking naturally (no interruption)
  responseStartTimestampTwilio = null;
  lastAssistantItem = null;

  logger.info('AI finished speaking', { callSid });
}
```

### Optional: Mark Queue Implementation

For even more precise tracking, implement mark queue to track audio chunks:

```typescript
let markQueue: string[] = [];

// When sending audio deltas (if we intercept them)
function sendAudioDelta(delta: string) {
  socket.send(JSON.stringify({
    event: 'media',
    streamSid: streamSid,
    media: { payload: delta }
  }));

  // Send mark to track this chunk
  socket.send(JSON.stringify({
    event: 'mark',
    streamSid: streamSid,
    mark: { name: 'responsePart' }
  }));

  markQueue.push('responsePart');
}

// Handle mark acknowledgment from Twilio
socket.on('message', (message) => {
  const data = JSON.parse(message.toString());

  if (data.event === 'mark') {
    // This chunk was played
    if (markQueue.length > 0) {
      markQueue.shift();
    }
  }
});

// Only truncate if there are unplayed chunks
if (event.type === 'input_audio_buffer.speech_started') {
  if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
    // Proceed with truncation...
  }
}
```

**Note:** Mark queue may not be necessary with `@openai/agents-extensions` since the `TwilioRealtimeTransportLayer` handles audio transmission. We need to investigate if we have access to intercept audio deltas.

## Technical Considerations

### 1. Working with TwilioRealtimeTransportLayer

The `@openai/agents-extensions` package abstracts away direct WebSocket handling. We need to:

- Check if `RealtimeSession` supports `truncate()` method
- Determine if we need to access the underlying transport
- Verify if we can send raw Twilio events through the transport

### 2. Conversation.item.truncate Event Format

OpenAI Realtime API format:
```json
{
  "type": "conversation.item.truncate",
  "item_id": "item_abc123",
  "content_index": 0,
  "audio_end_ms": 1247
}
```

### 3. Twilio Clear Event Format

Twilio Media Streams format:
```json
{
  "event": "clear",
  "streamSid": "MZ..."
}
```

## Testing Plan

### Unit Tests
- Test timestamp tracking accuracy
- Test truncation calculation logic
- Test state reset after completion

### Integration Tests
1. **Interruption During Short Response** (<1 second)
   - User interrupts AI after 500ms
   - Verify audio stops immediately
   - Verify context preserved

2. **Interruption During Long Response** (>3 seconds)
   - User interrupts AI after 2 seconds
   - Verify OpenAI receives correct truncation timing
   - Verify conversation continues naturally

3. **Multiple Interruptions**
   - User interrupts, AI responds, user interrupts again
   - Verify state resets correctly between interruptions

4. **No Interruption (Baseline)**
   - AI completes response naturally
   - Verify no truncation sent
   - Verify state resets properly

### Manual Testing
1. Call the agent and interrupt mid-sentence
2. Observe if audio stops immediately (< 200ms)
3. Check logs for truncation events
4. Verify next AI response acknowledges interruption context

## Success Criteria

✅ Audio stops within 200ms of user starting to speak
✅ OpenAI receives accurate `audio_end_ms` timing
✅ Conversation context remains accurate after interruptions
✅ No "AI talking over user" scenarios
✅ UI shows interruption events in real-time
✅ Works reliably across multiple interruptions per call

## References

- [OpenAI Realtime API - Interruptions](https://platform.openai.com/docs/guides/realtime)
- [Twilio Media Streams - Clear Event](https://www.twilio.com/docs/voice/media-streams/websocket-messages#clear)
- [Twilio Sample Implementation](https://github.com/twilio-samples/speech-assistant-openai-realtime-api-node/blob/main/index.js#L128-L155)

## Implementation Notes

- **Priority**: High - Significantly improves user experience
- **Complexity**: Medium - Requires careful state management
- **Risk**: Low - Graceful degradation if truncation fails (falls back to cancelResponse)
- **Dependencies**: May require updates to `@openai/agents` if truncation API not exposed
