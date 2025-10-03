# Migration Guide

This repository was extracted from the original `openai-realtime-agents` repository to create a standalone Twilio voice agent system.

## What Was Extracted

This standalone repository includes:

### Server Components
- **Twilio Server** (`server/`) - Complete Fastify server from `src/twilio/`
  - WebSocket handlers for Twilio Media Streams
  - Outbound and incoming call routing
  - Real-time audio streaming
  - Call state management
  - Server-Sent Events for UI updates
  - "Listen In" audio broadcast feature

### UI Components
- **Next.js UI** (`ui/app/page.tsx`) - Management interface from `src/app/twilio/page.tsx`
  - Call configuration and initiation
  - Live transcript display
  - Tool call tracking
  - Activity logging
  - Live audio streaming ("Listen In")

- **API Routes** (`ui/app/api/models/route.ts`) - Model listing endpoint

### Documentation
- `ARCHITECTURE.md` - Complete system architecture
- `twilio-integration.md` - Integration specification
- `twilio-testing-guide.md` - Testing procedures
- `CLOUDFLARE_TUNNEL_SETUP.md` - Deployment guide

### Scripts
- `call.sh` - Generic call script (formerly `twilio-call.sh`)
- `call-reminder.sh` - Appointment reminder test
- `call-survey.sh` - Survey call test
- `run-server-dev.sh` - Server development mode
- `run-server-start.sh` - Server production mode

## What Was Left Behind

The following components from the original repository are **NOT** included:

- Next.js agent examples (`src/app/agentConfigs/`)
- WebRTC-based browser client (`src/app/hooks/`)
- Chat-supervisor pattern implementations
- Sequential handoff pattern implementations
- Customer service retail examples
- Session management for browser clients
- Guardrails implementation
- Codec utilities for browser WebRTC

## Key Differences from Original

1. **Simplified Structure**
   - `server/` instead of `src/twilio/`
   - `ui/app/page.tsx` instead of `src/app/twilio/page.tsx`
   - Root-level configuration files

2. **Updated Scripts**
   - Removed `twilio:` prefix from script names
   - `npm run dev` now starts both UI and server
   - Scripts reference new directory structure

3. **Independent Dependencies**
   - Only includes dependencies needed for Twilio integration
   - Removed React/Next.js agent framework dependencies
   - Kept `@openai/agents` and `@openai/agents-extensions` for Realtime API

4. **Standalone Documentation**
   - README focused solely on Twilio voice agent
   - All references to browser-based patterns removed

## Migration Steps (If Starting Fresh)

If you want to set up this repository from scratch:

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd twilio-voice-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.sample .env
   # Edit .env with your credentials
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```

## Maintaining Sync with Original

If you want to pull updates from the original repository:

```bash
# Add original repo as upstream
git remote add upstream <original-repo-url>

# Fetch changes
git fetch upstream

# Cherry-pick specific changes to server/
git cherry-pick <commit-hash>
```

**Note**: Manual review is required when pulling changes, as directory structures differ.

## Architecture Continuity

The core architecture remains identical to the original implementation:

- Twilio ↔ Fastify WebSocket ↔ OpenAI Realtime API
- G.711 μ-law (8kHz) ↔ PCM16 (24kHz) conversion
- Server-Sent Events for UI updates
- WebSocket audio broadcast for "Listen In"
- Dynamic agent creation per call

See `docs/ARCHITECTURE.md` for full details.

## Compatibility

- **Node.js**: 18+ (same as original)
- **OpenAI API**: Realtime API access required
- **Twilio**: Same requirements as original
- **Deployment**: Cloudflare Tunnel or equivalent HTTPS proxy

## Support

For issues specific to this standalone repository, file issues in this repo. For general Realtime API questions, refer to OpenAI documentation.
