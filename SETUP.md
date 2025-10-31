# Quick Setup Guide

This guide will help you get the Twilio Voice Agent system running in minutes.

## Prerequisites Checklist

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] OpenAI API key with Realtime API access
- [ ] Twilio account (free trial works)
- [ ] Public HTTPS domain (for production) OR ngrok/cloudflared (for testing)

## Step 1: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Fastify (server)
- Next.js (UI)
- OpenAI Agents SDK
- Twilio SDK
- And more...

## Step 2: Configure Environment

```bash
cp .env.sample .env
```

Edit `.env` and add your credentials:

```bash
# Required
OPENAI_API_KEY=sk-proj-...                    # From platform.openai.com
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx         # From console.twilio.com
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx            # From console.twilio.com
TWILIO_PHONE_NUMBER=+1234567890               # Your Twilio number

# For production (required for Twilio webhooks)
PUBLIC_DOMAIN=your-domain.com                 # Your public domain

# Optional
PORT=5050                                      # Twilio server port (default: 5050)
LOG_LEVEL=info                                 # Logging level (debug, info, warn, error)
```

### Getting Twilio Credentials

1. Sign up at [twilio.com](https://www.twilio.com/try-twilio)
2. Go to Console → Account → Keys & Credentials
3. Copy Account SID and Auth Token
4. Go to Phone Numbers → Buy a number (or use trial number)

### Getting OpenAI API Key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create new secret key
3. Copy the key (starts with `sk-proj-...`)

## Step 3: Start Development Servers

```bash
npm run dev
```

This starts:
- **Next.js UI** on http://localhost:3000
- **Twilio Server** on http://localhost:5050

Or start them separately:

```bash
# Terminal 1
npm run ui:dev

# Terminal 2
npm run server:dev
```

## Step 4: Test Locally (Without Twilio)

Visit http://localhost:3000 to see the UI. You can configure calls but won't be able to make them without public access.

Check server health:
```bash
curl http://localhost:5050/twilio/health
```

## Step 5: Set Up Public Access

For Twilio to reach your server, you need HTTPS. Choose one:

### Option A: Cloudflare Tunnel (Recommended)

1. Install cloudflared (if not using devcontainer):
   ```bash
   # If using the devcontainer, cloudflared is pre-installed ✓
   # Skip to step 2!

   # Otherwise, install manually:
   # macOS
   brew install cloudflare/cloudflare/cloudflared

   # Linux
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   ```

2. Login:
   ```bash
   cloudflared tunnel login
   ```

3. Create tunnel:
   ```bash
   cloudflared tunnel create twilio-agent
   ```

4. Configure tunnel (`~/.cloudflared/config.yml`):
   ```yaml
   tunnel: <your-tunnel-id>
   credentials-file: /home/user/.cloudflared/<tunnel-id>.json

   ingress:
     - hostname: your-domain.com
       service: http://localhost:3000
       path: /*
     - hostname: your-domain.com
       service: http://localhost:5050
       path: /twilio/*
     - service: http_status:404
   ```

5. Add DNS:
   ```bash
   cloudflared tunnel route dns twilio-agent your-domain.com
   ```

6. Run tunnel:
   ```bash
   cloudflared tunnel run twilio-agent
   ```

See [docs/CLOUDFLARE_TUNNEL_SETUP.md](docs/CLOUDFLARE_TUNNEL_SETUP.md) for detailed instructions.

### Option B: ngrok (Quick Testing)

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from ngrok.com

# Start tunnel
ngrok http 5050

# Update .env with ngrok URL
PUBLIC_DOMAIN=abc123.ngrok.io
```

## Step 6: Make Your First Call

1. Update `.env` with your public domain:
   ```bash
   PUBLIC_DOMAIN=your-domain.com
   ```

2. Restart the server:
   ```bash
   npm run server:dev
   ```

3. Open http://localhost:3000

4. Configure call:
   - **Phone Number**: Your mobile number (with country code, e.g., +14168327527)
   - **Task Type**: Custom
   - **Prompt**: "You are a helpful AI assistant. Greet the caller."
   - **Voice**: verse
   - **Temperature**: 0.8
   - **Noise Reduction**: far_field
   - **Model**: gpt-realtime

5. Click **Initiate Call**

6. Answer your phone!

## Step 7: Test with CLI

Alternatively, use the command-line scripts:

```bash
# Basic call
./scripts/call.sh +14168327527

# Appointment reminder
./scripts/call-reminder.sh +14168327527

# Survey
./scripts/call-survey.sh +14168327527
```

## Troubleshooting

### "Cannot connect to Twilio"
- Check your Twilio credentials in `.env`
- Verify your Twilio phone number is correct
- Check if PUBLIC_DOMAIN is accessible from internet

### "OpenAI API Error"
- Verify OPENAI_API_KEY is correct
- Ensure you have Realtime API access (may require waitlist)
- Check API usage limits

### "Call connects but no audio"
- Check browser console for WebSocket errors
- Verify noise reduction is set to `far_field`
- Try different voice option

### "Server won't start"
- Check if port 5050 is available: `lsof -i :5050`
- Check if port 3000 is available: `lsof -i :3000`
- Review server logs for errors

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm run server:dev
```

## What's Next?

- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand the system
- Explore [docs/twilio-integration.md](docs/twilio-integration.md) for API details
- See [docs/twilio-testing-guide.md](docs/twilio-testing-guide.md) for testing procedures
- Customize agent prompts for your use case
- Add custom tools to the agent

## Production Deployment

See [README.md](README.md) for production deployment instructions including:
- Docker setup
- Environment configuration
- Cloudflare Tunnel production setup
- Monitoring and logging

## Getting Help

- Check [docs/](docs/) for detailed documentation
- Review server logs: `tail -f twilio-server.log`
- Enable debug mode: `LOG_LEVEL=debug`
- Test individual components with curl commands

## Common Use Cases

### Appointment Reminders
```bash
./scripts/call-reminder.sh +14168327527
```

### Customer Surveys
```bash
./scripts/call-survey.sh +14168327527
```

### Custom Tasks
Edit the task prompt in the UI or pass it via script:
```bash
./scripts/call.sh +14168327527 custom "Your custom instructions here"
```

## Next Steps

1. ✅ Get calls working locally
2. ✅ Test with your phone number
3. ✅ Try different voices and prompts
4. ✅ Monitor transcripts in real-time
5. ✅ Use "Listen In" feature
6. 🚀 Deploy to production
7. 🎨 Customize for your use case

Happy coding! 🎉
