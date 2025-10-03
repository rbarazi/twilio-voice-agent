# Twilio Voice Agent Architecture

This document explains the complete architecture of the Twilio voice integration with OpenAI Realtime API, including data flows, streaming mechanisms, and component interactions.

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Streaming Architecture](#streaming-architecture)
5. [Tool Execution Flow](#tool-execution-flow)
6. [Dependencies](#dependencies)
7. [Deployment Architecture](#deployment-architecture)

## System Overview

The system enables AI-powered phone conversations by bridging Twilio's phone network with OpenAI's Realtime API. It consists of three main components:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Phone     │────▶│  Twilio Server   │────▶│  OpenAI         │
│   Network   │◀────│  (Fastify)       │◀────│  Realtime API   │
└─────────────┘     └──────────────────┘     └─────────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │   Next.js UI     │
                    │   (Management)   │
                    └──────────────────┘
```

## Component Architecture

### 1. Twilio Server (Port 5050)

**Location**: `src/twilio/`

**Purpose**: Handles phone calls, manages WebSocket connections, and bridges audio between Twilio and OpenAI.

**Key Components**:

```
src/twilio/
├── server.ts                 # Fastify server setup
├── routes/
│   ├── outbound-call.ts      # Initiate outbound calls
│   ├── incoming-call.ts      # Handle incoming calls (TwiML)
│   ├── media-stream.ts       # WebSocket audio streaming
│   ├── end-call.ts           # Terminate calls via API
│   ├── events.ts             # Server-Sent Events for UI
│   └── audio-stream.ts       # "Listen In" audio broadcast
├── agents/
│   ├── outbound-task-agent.ts  # Dynamic agent creation
│   └── index.ts              # Agent factory
├── services/
│   ├── twilio-client.ts      # Twilio SDK wrapper
│   ├── call-manager.ts       # Call state management
│   └── env-validator.ts      # Environment validation
├── types/
│   └── index.ts              # TypeScript interfaces
└── utils/
    └── logger.ts             # Pino logger
```

### 2. Next.js Web UI (Port 3000)

**Location**: `src/app/twilio/`

**Purpose**: Manage calls, monitor conversations, and display tool executions.

**Key Files**:
- `src/app/twilio/page.tsx` - Main UI component
- `src/app/api/models/route.ts` - List available OpenAI models

### 3. OpenAI Realtime API Integration

**Dependencies**:
- `@openai/agents` - Agent framework
- `@openai/agents-extensions` - Twilio transport layer

**Key Class**: `TwilioRealtimeTransportLayer`

## Data Flow Diagrams

### Call Initiation Flow

```
┌──────────┐
│   User   │
│  (UI)    │
└────┬─────┘
     │ 1. POST /twilio/outbound-call
     │    { to, task, agentConfig }
     ▼
┌─────────────────────┐
│  Twilio Server      │
│  outbound-call.ts   │
└──────┬──────────────┘
       │ 2. twilioClient.calls.create()
       │    - to: phone number
       │    - from: TWILIO_PHONE_NUMBER
       │    - url: /twilio/incoming-call
       ▼
┌─────────────────────┐
│  Twilio API         │
│  (Phone Network)    │
└──────┬──────────────┘
       │ 3. Places call
       │ 4. Webhook: /twilio/incoming-call
       ▼
┌─────────────────────┐
│  incoming-call.ts   │
│  Returns TwiML      │
└──────┬──────────────┘
       │ 5. TwiML <Connect><Stream>
       │    - WebSocket URL
       ▼
┌─────────────────────┐
│  Twilio (establishes│
│  WebSocket)         │
└──────┬──────────────┘
       │ 6. WebSocket connection
       │    to /twilio/media-stream
       ▼
┌─────────────────────┐
│  media-stream.ts    │
│  WebSocket Handler  │
└─────────────────────┘
```

### Audio Streaming Flow

```
Phone Call ──▶ Twilio ──▶ WebSocket ──▶ media-stream.ts
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │ Browser-style   │
                                    │ WebSocket       │
                                    │ Adapter         │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ Twilio          │
                                    │ RealtimeTransport│
                                    │ Layer           │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ RealtimeSession │
                                    │ (OpenAI)        │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ OpenAI Realtime │
                                    │ API             │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    Audio Response ──▶ Back through chain
```

**Audio Codecs**:
- **Twilio → Server**: G.711 μ-law (8kHz, 8-bit)
- **OpenAI**: PCM16 (24kHz, 16-bit)
- **Conversion**: Handled by `TwilioRealtimeTransportLayer`

### Event Flow

```
┌──────────────────┐
│ RealtimeSession  │
│ (OpenAI)         │
└────────┬─────────┘
         │ Events emitted
         ▼
┌──────────────────────────────────────────────────┐
│ session.on('transport_event', (event) => {})    │
│                                                   │
│  Event Types:                                    │
│  ├─ twilio_message (start/media/stop)           │
│  ├─ conversation.item.created                    │
│  ├─ response.audio.delta                         │
│  ├─ response.audio_transcript.done               │
│  ├─ conversation.item.input_audio_transcription  │
│  └─ response.function_call_arguments.done        │
└───────────────────┬──────────────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Event Processing     │
         │ - Log transcripts    │
         │ - Track tool calls   │
         │ - Broadcast to UI    │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ broadcastEvent()     │
         │ (Server-Sent Events) │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Web UI               │
         │ - Transcript display │
         │ - Tool calls shown   │
         │ - Activity log       │
         └──────────────────────┘
```

## Streaming Architecture

### WebSocket Streaming (Twilio ↔ Server)

**Protocol**: Twilio Media Streams

**Message Format**:
```json
{
  "event": "media",
  "streamSid": "MZ...",
  "media": {
    "track": "inbound",
    "chunk": "1",
    "timestamp": "1234",
    "payload": "base64_encoded_audio"
  }
}
```

**Implementation**: `src/twilio/routes/media-stream.ts`

**Key Points**:
1. **Bidirectional**: Audio flows both directions
2. **Real-time**: Low latency streaming
3. **Codec**: G.711 μ-law (8kHz)
4. **Chunk Size**: ~20ms of audio per message

### Server-Sent Events (Server → UI)

**Endpoint**: `/twilio/events`

**Event Types**:
```typescript
{
  type: 'transcript.ai' | 'transcript.user' |
        'tool.called' | 'call.ending' | 'call.ended',
  callSid: string,
  timestamp: string,
  data: object
}
```

**Implementation**: `src/twilio/routes/events.ts`

**Active Streams**: Map of `callSid → Set<Response>`

### Audio Broadcast ("Listen In" Feature)

**Endpoint**: `/twilio/audio-stream/:callSid`

**Protocol**: WebSocket

**Data Flow**:
```
Phone User Audio ──▶ Twilio ──▶ media-stream.ts ──▶ audio-stream.ts
                                                            │
                                                            ▼
                                                    WebSocket Broadcast
                                                            │
                                                            ▼
                                                      Browser AudioContext
                                                      (Playback at 80% volume)
```

**Codec**: G.711 μ-law (user audio only, not AI audio)

## Tool Execution Flow

### End Call Tool

```
1. AI generates goodbye message
   │
   ▼
2. AI decides to call end_call tool
   │
   ▼
3. OpenAI sends: conversation.item.created
   - item.type: 'function_call'
   - item.name: 'end_call'
   - item.call_id: 'call_xxx'
   │
   ▼
4. media-stream.ts stores in functionCallMap
   - Map: call_id → function name
   │
   ▼
5. OpenAI sends: response.function_call_arguments.delta
   - Builds arguments incrementally
   │
   ▼
6. OpenAI sends: response.function_call_arguments.done
   - arguments: '{ "reason": "Task completed" }'
   │
   ▼
7. media-stream.ts handler:
   a. Parse arguments JSON
   b. Look up function name from call_id
   c. If end_call → execute endCall(callSid)
   d. Broadcast tool.called event to UI
   e. Broadcast call.ending event to UI
   │
   ▼
8. endCall() calls Twilio API
   - twilioClient.calls(callSid).update({ status: 'completed' })
   │
   ▼
9. Twilio terminates the call
   │
   ▼
10. WebSocket closes
```

**Code Location**: `src/twilio/routes/media-stream.ts:229-253`

### Tool Definition

**Location**: `src/twilio/agents/outbound-task-agent.ts`

```typescript
const endCallTool = tool({
  name: 'end_call',
  description: 'End the phone call when the task is complete',
  parameters: z.object({
    reason: z.string()
  }),
  execute: async ({ reason }) => {
    return { success: true, reason };
  }
});
```

**Note**: The `execute` function is not actually called. Tool execution is intercepted in `media-stream.ts` event handler.

## Dependencies

### Core Dependencies

```json
{
  "@openai/agents": "^0.0.23",
  "@openai/agents-extensions": "^0.0.8",
  "fastify": "^5.2.2",
  "@fastify/websocket": "^11.1.1",
  "twilio": "^5.4.0",
  "ws": "^8.18.0",
  "pino": "^9.5.0",
  "zod": "^3.23.8"
}
```

### Dependency Graph

```
Application
├── @openai/agents
│   └── OpenAI Realtime API communication
├── @openai/agents-extensions
│   └── TwilioRealtimeTransportLayer
│       └── Bridges Twilio WebSocket ↔ OpenAI
├── fastify
│   ├── HTTP server
│   └── @fastify/websocket
│       └── WebSocket support
├── twilio
│   └── Twilio API client (calls, TwiML)
├── ws
│   └── Node.js WebSocket implementation
└── zod
    └── Schema validation for tool parameters
```

### Key Adapters

**Browser-Style WebSocket Adapter** (`media-stream.ts:12-31`):

Converts Node.js `ws` WebSocket to browser-compatible interface:
```typescript
{
  send(data),
  close(),
  addEventListener(event, handler),
  removeEventListener(event, handler)
}
```

Required by `TwilioRealtimeTransportLayer` which expects browser WebSocket API.

## Deployment Architecture

### Production Setup

```
┌────────────────────────────────────────────────┐
│              Internet                          │
└─────────────┬──────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│         Cloudflare Tunnel                       │
│         (cloudflared)                           │
│                                                 │
│  Rules:                                         │
│  - /*           → localhost:3000 (Next.js)     │
│  - /twilio/*    → localhost:5050 (Twilio)      │
└─────────────┬──────────┬────────────────────────┘
              │          │
              │          └─────────────────┐
              │                            │
              ▼                            ▼
┌──────────────────────┐      ┌─────────────────────┐
│   Next.js Server     │      │   Twilio Server     │
│   Port 3000          │      │   Port 5050         │
│                      │      │                     │
│   - UI Management    │      │   - Call handling   │
│   - Model listing    │      │   - WebSocket       │
│                      │      │   - Audio streaming │
└──────────────────────┘      └──────┬──────────────┘
                                     │
                                     ▼
                              ┌──────────────────┐
                              │  Twilio API      │
                              │  (External)      │
                              └──────────────────┘
                                     │
                                     ▼
                              ┌──────────────────┐
                              │  OpenAI Realtime │
                              │  API (External)  │
                              └──────────────────┘
```

### Environment Variables

**Required**:
```bash
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_PHONE_NUMBER=+1234567890
PUBLIC_DOMAIN=your-domain.com
```

**Optional**:
```bash
PORT=5050  # Twilio server port
LOG_LEVEL=info
```

### Docker Setup

**Ports**:
- `3000`: Next.js UI
- `5050`: Twilio server
- `7070`: Cloudflare Tunnel metrics

**Volumes**:
- Cloudflare credentials
- Environment variables

## Call State Management

### Call Manager

**Location**: `src/twilio/services/call-manager.ts`

**Data Structure**:
```typescript
Map<string, CallMetadata>
// callSid → metadata

interface CallMetadata {
  callSid: string
  to: string
  task: OutboundTask
  agentConfig?: AgentConfig
  startedAt: Date
  status: 'initiated' | 'in-progress' | 'completed' | 'failed'
}
```

### Status Transitions

```
initiated ──▶ in-progress ──▶ completed
                │
                └──▶ failed
```

## Agent Configuration

### Dynamic Agent Creation

**Pattern**: Agent is created per call based on task configuration

**Factory Function**: `getAgentForTask(task, config)`

**Agent Properties**:
```typescript
{
  name: 'outbound-task-agent',
  voice: config?.voice || 'verse',
  instructions: string,  // Generated from task
  tools: [endCallTool],
  handoffs: []  // No handoffs in Twilio mode
}
```

### Instruction Generation

**Base Instructions**:
- Identify as AI assistant
- State call purpose
- Complete task efficiently
- Confirm understanding
- Handle human transfer requests
- Call end_call tool after goodbye

**Task-Specific Instructions**:
- `appointment_reminder`: Date/time confirmation
- `survey`: Question flow
- `notification`: Information delivery
- `custom`: User-defined prompt

## Error Handling

### Error Logging Strategy

**Levels**:
- `info`: Normal operations (calls, transcripts, tools)
- `warn`: Recoverable issues
- `error`: Critical failures

**Enhanced Error Logging**:
```typescript
{
  callSid,
  error: error.message,
  stack: error.stack,
  errorType: typeof error,
  errorKeys: Object.keys(error),
  errorJSON: JSON.stringify(error)
}
```

### Recovery Mechanisms

1. **WebSocket Disconnection**: Clean up resources, log event
2. **Twilio API Errors**: Return 500, log details
3. **OpenAI Session Errors**: Log full error, call continues if recoverable

## Performance Considerations

### Audio Latency

**Target**: <200ms end-to-end

**Factors**:
- Network latency (phone → Twilio)
- WebSocket latency (Twilio → Server)
- OpenAI API latency (processing)
- Audio codec conversion overhead

### Concurrent Calls

**Limits**: No artificial limits imposed

**Scalability**:
- Each call = 1 WebSocket connection
- Memory per call: ~10MB
- CPU: Minimal (mostly I/O bound)

### State Management

**In-Memory**: `callManager` uses Map
**No Persistence**: State lost on restart
**Future**: Consider Redis for multi-instance deployments

## Testing Strategy

### Local Testing

```bash
# Terminal 1: Twilio server
npm run twilio:dev

# Terminal 2: Next.js UI
npm run dev

# Terminal 3: Cloudflare tunnel
cloudflared tunnel run
```

### End-to-End Test

1. Open UI: `http://localhost:3000/twilio`
2. Configure task and phone number
3. Click "Initiate Call"
4. Verify:
   - Call placed
   - Transcripts appear
   - Tool calls tracked
   - Call ends properly

## Future Architecture Considerations

### Multi-Instance Deployment

**Challenges**:
- Call state sharing
- WebSocket connection affinity
- Event broadcasting

**Solutions**:
- Redis for shared state
- Sticky sessions for WebSockets
- Redis Pub/Sub for events

### Call Recording

**Storage**: S3 or similar
**Format**: MP3 or WAV
**Trigger**: Post-call webhook

### Analytics

**Metrics**:
- Call duration
- Tool usage
- Task completion rate
- Error rates

**Implementation**: ClickHouse or similar time-series DB
