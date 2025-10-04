# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AI-powered voice agent system using Twilio and OpenAI Realtime API for phone-based conversations. Two-server architecture: Fastify server (port 5050) for Twilio integration and Next.js UI (port 3000) for management.

## Development Commands

```bash
# Development
npm run dev              # Start both UI and server concurrently
npm run ui:dev           # Start Next.js UI only (port 3000)
npm run server:dev       # Start Twilio server only (port 5050)

# Production
npm run build            # Build UI for production
npm run start            # Start both servers in production
npm run ui:start         # Start UI in production
npm run server:start     # Start Twilio server in production

# Testing
npm run call             # Test outbound call script
npm run call:reminder    # Test appointment reminder
npm run call:survey      # Test survey call
```

## Required Environment Variables

Create `.env` from `.env.sample`:
- `OPENAI_API_KEY` - OpenAI API key with Realtime API access
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Twilio phone number (E.164 format)
- `PUBLIC_DOMAIN` - Public HTTPS domain for Twilio webhooks
- `PORT` - Twilio server port (default: 5050)
- `LOG_LEVEL` - Logging level (debug, info, warn, error)

## Architecture

### Two-Server System

1. **Twilio Server** (`server/`, port 5050)
   - Fastify-based WebSocket server
   - Handles Twilio media streams (G.711 μ-law ↔ PCM16 conversion)
   - Manages OpenAI Realtime API connections
   - Provides Server-Sent Events for UI updates
   - Broadcasts live call audio for "Listen In" feature

2. **Next.js UI** (`ui/`, port 3000)
   - Call initiation and configuration
   - Real-time transcript viewing
   - Tool call tracking
   - Live audio streaming ("Listen In")

### Key Data Flows

```
Phone ↔ Twilio ↔ [WebSocket] ↔ Twilio Server ↔ [WebSocket] ↔ OpenAI Realtime API
                                      ↓
                              [SSE/WebSocket]
                                      ↓
                                  Next.js UI
```

### Audio Pipeline

- **Twilio → OpenAI**: G.711 μ-law (8kHz) → Base64 decode → PCM16 (24kHz upsample)
- **OpenAI → Twilio**: PCM16 (24kHz) → PCM16 (8kHz downsample) → G.711 μ-law encode
- **Live Broadcast**: G.711 μ-law → Base64 → WebSocket → Browser (decoded via Web Audio API)

## Core Components

### Server Structure

- `server/server.ts` - Fastify setup, plugin registration, route registration
- `server/routes/` - API endpoints and WebSocket handlers
  - `media-stream.ts` - Main WebSocket handler for Twilio ↔ OpenAI streaming
  - `outbound-call.ts` - Initiates outbound calls via Twilio API
  - `incoming-call.ts` - Returns TwiML for incoming calls
  - `events.ts` - Server-Sent Events for UI updates
  - `audio-stream.ts` - Live audio broadcast WebSocket
  - `end-call.ts` - Terminates calls programmatically
  - `health.ts` - Health check endpoint
- `server/agents/` - Agent configurations
  - `outbound-task-agent.ts` - Creates RealtimeAgent with task-specific instructions
- `server/services/` - Core services
  - `twilio-client.ts` - Twilio SDK wrapper
  - `call-manager.ts` - In-memory call state management (Map-based)
- `server/types/index.ts` - TypeScript interfaces (OutboundTask, AgentConfig, CallMetadata)
- `server/utils/` - Logger and environment validation

### Agent Creation

Agents are created **per-call** with task-specific instructions:

```typescript
// From server/agents/outbound-task-agent.ts
createOutboundTaskAgent(task: OutboundTask, config?: AgentConfig): RealtimeAgent
```

Task types: `appointment_reminder`, `survey`, `notification`, `custom`

Each agent includes:
- Task-specific system instructions
- Voice configuration (alloy, ash, ballad, coral, echo, sage, verse)
- `end_call` tool for AI-initiated call termination
- Temperature and noise reduction settings

### Call State Management

- **In-memory only** - `callManager` (Map-based singleton)
- No persistence - state lost on server restart
- Multi-instance deployments require Redis (see FUTURE_IMPROVEMENTS.md)

### Transport Layer

Uses `TwilioRealtimeTransportLayer` from `@openai/agents-extensions`:
- Handles G.711 μ-law ↔ PCM16 conversion
- Manages bidirectional streaming between Twilio and OpenAI
- Buffers audio for optimal packet sizes
- Automatically handles noise reduction configuration

## Development Workflow

### Running Locally

1. Install dependencies: `npm install`
2. Configure `.env` from `.env.sample`
3. Start development servers: `npm run dev`
4. Access UI at http://localhost:3000
5. For actual calls, configure public HTTPS access (Cloudflare Tunnel or ngrok)

### Making Test Calls

Using UI:
- Configure phone number, task type, voice, temperature, model
- Click "Initiate Call"
- Monitor transcript and tool calls in real-time

Using CLI:
```bash
./scripts/call.sh +14165551234
./scripts/call-reminder.sh +14165551234
./scripts/call-survey.sh +14165551234
```

### Debugging

- Enable debug logging: `LOG_LEVEL=debug npm run server:dev`
- Check server logs: `tail -f twilio-server.log`
- Browser console for WebSocket connection issues
- Use `/twilio/health` endpoint to verify server status

## Important Implementation Notes

### TypeScript Execution

- Server uses `tsx` for TypeScript execution (not `ts-node`)
- Scripts in `scripts/` use bash to call `tsx` with server files
- UI uses Next.js built-in TypeScript support

### WebSocket Adapter Pattern

The server adapts Node.js `ws` WebSocket to browser-style API for OpenAI SDK compatibility:
```typescript
// From server/routes/media-stream.ts
createBrowserStyleWebSocket(nodeSocket: WebSocket)
```

### Tool Execution

The `end_call` tool is special-cased:
- Defined in agent configuration
- Intercepted in session event handler
- Triggers Twilio API call to terminate the call
- Broadcasts event to UI

### Event Broadcasting

Server-Sent Events (SSE) stream events to UI:
- Transcript updates (user speech, AI responses)
- Tool calls
- Call status changes
- Connection events

### Audio Broadcasting ("Listen In")

Separate WebSocket per call for live audio:
- Endpoint: `/twilio/audio-stream/:callSid`
- Only broadcasts when listeners connected (performance optimization)
- G.711 μ-law format (8kHz)
- Browser decodes using Web Audio API

## Testing & Production

### Local Testing Without Calls

1. Start servers: `npm run dev`
2. Check health: `curl http://localhost:5050/twilio/health`
3. Verify UI loads: http://localhost:3000

### Production Requirements

- Public HTTPS domain (Twilio requires HTTPS for webhooks)
- Cloudflare Tunnel or similar for secure ingress
- Tunnel configuration routes:
  - `/*` → localhost:3000 (Next.js UI)
  - `/twilio/*` → localhost:5050 (Twilio Server)
- See `docs/CLOUDFLARE_TUNNEL_SETUP.md` for detailed setup

### Common Issues

- **No audio**: Check noise reduction setting (use `far_field` for phone calls)
- **Transcript not appearing**: Verify SSE connection in browser console
- **Call fails to connect**: Check PUBLIC_DOMAIN accessibility and Twilio credentials
- **WebSocket errors**: Ensure Cloudflare Tunnel routes both ports correctly

## File Locations

- Environment config: `.env` (never commit), `.env.sample` (template)
- Server entry: `server/server.ts`
- UI entry: `ui/app/page.tsx`
- Agent definitions: `server/agents/outbound-task-agent.ts`
- Type definitions: `server/types/index.ts`
- Scripts: `scripts/*.sh`
- Documentation: `docs/*.md`

## Documentation References

- `docs/ARCHITECTURE.md` - Detailed architecture diagrams and flows
- `docs/twilio-integration.md` - Complete API documentation
- `docs/twilio-testing-guide.md` - Testing procedures and debugging
- `docs/CLOUDFLARE_TUNNEL_SETUP.md` - Production deployment guide
- `docs/FUTURE_IMPROVEMENTS.md` - Planned enhancements
