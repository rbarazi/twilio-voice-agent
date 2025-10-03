# Twilio Voice Agent

AI-powered voice agent system using Twilio and OpenAI Realtime API. This system enables phone-based conversations with AI agents that can handle tasks like appointment reminders, surveys, notifications, and custom interactions.

## Architecture

The system consists of two main components:

1. **Twilio Server** (Port 5050) - Fastify-based WebSocket server that handles:
   - Outbound and incoming phone calls
   - Real-time audio streaming between Twilio and OpenAI
   - Call state management
   - Server-Sent Events for UI updates

2. **Next.js UI** (Port 3000) - Web interface for:
   - Initiating and monitoring calls
   - Viewing live transcripts
   - Tracking tool calls
   - "Listen In" feature for live call audio

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key with Realtime API access
- Twilio account with:
  - Account SID
  - Auth Token
  - Phone number
- Public domain with HTTPS (for Twilio webhooks)

### Installation

1. Clone this repository:
```bash
git clone <your-repo-url>
cd twilio-voice-agent
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.sample .env
```

Edit `.env` and add your credentials:
```
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_PHONE_NUMBER=+1234567890
PUBLIC_DOMAIN=your-domain.com
```

4. Start both servers:
```bash
npm run dev
```

Or start them separately:
```bash
# Terminal 1: UI
npm run ui:dev

# Terminal 2: Twilio Server
npm run server:dev
```

### Cloudflare Tunnel Setup

For production deployment with public HTTPS access:

1. Install Cloudflare Tunnel (cloudflared)
2. Configure tunnel with ingress rules:
   - `/*` → `localhost:3000` (Next.js UI)
   - `/twilio/*` → `localhost:5050` (Twilio Server)

See [docs/CLOUDFLARE_TUNNEL_SETUP.md](docs/CLOUDFLARE_TUNNEL_SETUP.md) for detailed setup.

## Usage

### Making Calls

1. Open the UI at `http://localhost:3000`
2. Configure call settings:
   - Phone number
   - Task type (custom, appointment reminder, survey, notification)
   - Voice (alloy, ash, ballad, coral, echo, sage, verse)
   - Temperature (0.0-1.0)
   - Noise reduction (far_field, near_field, off)
   - OpenAI model
   - Task prompt
3. Click "Initiate Call"
4. Monitor the live transcript and tool calls
5. Optionally click "🎧 Listen In" to hear the call audio

### Quick Presets

The UI includes pre-configured presets:
- 🚐 Transit Booking (Caregiver)
- 📅 Appointment Reminder
- 📊 Quick Survey

### API Endpoints

**Twilio Server (Port 5050)**

- `POST /twilio/outbound-call` - Initiate outbound call
- `POST /twilio/incoming-call` - Handle incoming calls (TwiML)
- `WS /twilio/media-stream` - WebSocket audio streaming
- `POST /twilio/end-call/:callSid` - End active call
- `WS /twilio/events` - Server-Sent Events for UI
- `WS /twilio/audio-stream/:callSid` - Live audio broadcast
- `GET /twilio/health` - Health check

**Next.js Server (Port 3000)**

- `GET /api/models` - List available OpenAI Realtime models

See [docs/twilio-integration.md](docs/twilio-integration.md) for full API documentation.

## Features

### Dynamic Agent Creation

Agents are created per-call with task-specific instructions:

```typescript
{
  to: "+1234567890",
  task: {
    type: "custom",
    prompt: "Your custom instructions here",
    context: {}
  },
  agentConfig: {
    voice: "verse",
    temperature: 0.8,
    noiseReduction: "far_field",
    model: "gpt-realtime"
  }
}
```

### Tool Execution

Built-in `end_call` tool allows AI to terminate calls:

```typescript
// AI can call this when task is complete
end_call({ reason: "Task completed successfully" })
```

### Noise Reduction

Configure audio noise reduction for phone environments:
- `far_field` - Recommended for phone calls (default)
- `near_field` - For close microphones
- `off` - Disable noise reduction

### Listen In Feature

Monitor live call audio in your browser via WebSocket streaming with real-time G.711 μ-law decoding and playback.

## Project Structure

```
twilio-voice-agent/
├── server/              # Fastify server (port 5050)
│   ├── routes/          # API endpoints and WebSocket handlers
│   ├── agents/          # Agent configurations
│   ├── services/        # Twilio client and call management
│   ├── types/           # TypeScript interfaces
│   └── utils/           # Logger and utilities
├── ui/                  # Next.js app (port 3000)
│   └── app/
│       ├── api/         # API routes
│       └── page.tsx     # Main UI component
├── docs/                # Documentation
├── scripts/             # Helper scripts
├── package.json         # Dependencies and scripts
└── README.md            # This file
```

## Development Scripts

```bash
# Development
npm run dev              # Start both UI and server
npm run ui:dev           # Start UI only
npm run server:dev       # Start server only

# Production
npm run build            # Build UI for production
npm run start            # Start both in production mode
npm run ui:start         # Start UI in production
npm run server:start     # Start server in production

# Testing
npm run call             # Test call script
npm run call:reminder    # Test appointment reminder
npm run call:survey      # Test survey call
```

## Testing

See [docs/twilio-testing-guide.md](docs/twilio-testing-guide.md) for:
- Local testing procedures
- End-to-end testing
- Debugging guides
- Performance testing
- Example curl commands

## Configuration

### Voice Options

- `alloy` - Neutral voice
- `ash` - Conversational
- `ballad` - Expressive
- `coral` - Warm
- `echo` - Male voice
- `sage` - Clear
- `verse` - Default

### Task Types

- `custom` - Free-form custom task
- `appointment_reminder` - Appointment confirmations
- `survey` - Customer surveys
- `notification` - Information delivery

### Audio Settings

- **Temperature**: 0.0 (focused) to 1.0 (creative)
- **Noise Reduction**: far_field, near_field, off
- **Codec**: G.711 μ-law (8kHz) ↔ PCM16 (24kHz)

## Troubleshooting

### Common Issues

1. **Call not connecting**
   - Check Twilio credentials in `.env`
   - Verify PUBLIC_DOMAIN is accessible
   - Check Cloudflare Tunnel is running

2. **No audio**
   - Verify WebSocket connection in browser console
   - Check microphone permissions
   - Ensure noise reduction is configured

3. **Transcript not appearing**
   - Check Server-Sent Events connection
   - Verify callSid matches active call
   - Check browser console for errors

### Debug Mode

Enable detailed logging:
```bash
LOG_LEVEL=debug npm run server:dev
```

## Performance

- **Target Latency**: <200ms end-to-end
- **Concurrent Calls**: No artificial limits
- **Memory per Call**: ~10MB
- **CPU**: Minimal (I/O bound)

## Future Enhancements

- Multi-instance deployment with Redis
- Call recording and storage
- Analytics and metrics dashboard
- Custom tool integration
- Multi-language support

See [docs/FUTURE_IMPROVEMENTS.md](docs/FUTURE_IMPROVEMENTS.md) for the roadmap.

## License

See [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Check [docs/](docs/) directory for detailed documentation
- Review [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design
- See [docs/twilio-testing-guide.md](docs/twilio-testing-guide.md) for debugging

## Contributing

This is a demonstration project. Feel free to fork and customize for your use case.
