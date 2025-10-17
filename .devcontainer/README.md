# Dev Container Setup

This devcontainer provides a consistent development environment for the Twilio Voice Agent project with Cloudflare Tunnel support for public HTTPS access (required for Twilio webhooks).

## Features

- **Node.js 20** with TypeScript support
- **Cloudflare Tunnel** (cloudflared) for secure public HTTPS access
- **Pre-installed VS Code Extensions**:
  - ESLint for code linting
  - Prettier for code formatting
  - Tailwind CSS IntelliSense
  - TypeScript tooling
- **Automatic dependency installation** on container creation
- **Cloudflare Tunnel routing**:
  - All public access through tunnel (no port forwarding required)
  - **Next.js UI**: `https://your-tunnel-domain.com/`
  - **Twilio Server**: `https://your-tunnel-domain.com/twilio/*`
- **Environment variables** from `.env` and `.devcontainer/cloudflared.env`

## Prerequisites

- [VS Code](https://code.visualstudio.com/) or [Cursor](https://cursor.sh/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- [Cloudflare account](https://dash.cloudflare.com/) (for tunnel setup)
- [Twilio account](https://www.twilio.com/try-twilio) (free trial works)
- [OpenAI API key](https://platform.openai.com/api-keys) with Realtime API access

## Setup

### 1. Configure Environment Variables

The project uses two environment files:

#### `.env` (Project Root) - API Credentials

Create from the sample:
```bash
cp .env.sample .env
```

Add your credentials:
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-actual-api-key-here

# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# Public Domain (for Twilio webhooks)
PUBLIC_DOMAIN=your-tunnel-domain.com

# Optional
PORT=5050
LOG_LEVEL=info
```

**Getting credentials:**

1. **OpenAI**: Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. **Twilio**:
   - Sign up at [twilio.com](https://www.twilio.com/try-twilio)
   - Console → Account → Keys & Credentials
   - Phone Numbers → Buy a number

#### `.devcontainer/cloudflared.env` - Cloudflare Tunnel

Create from the sample:
```bash
cp .devcontainer/cloudflared.env.sample .devcontainer/cloudflared.env
```

Add your tunnel token:

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks** > **Tunnels**
3. Click **Create a tunnel**
4. Choose **Cloudflared** and give it a name (e.g., "twilio-agent")
5. Copy the tunnel token
6. Add it to `.devcontainer/cloudflared.env`:
   ```bash
   TUNNEL_TOKEN=eyJhIjoixxxxx...your-actual-token-here
   ```

7. Configure tunnel ingress rules in Cloudflare dashboard:
   ```yaml
   ingress:
     # Twilio API endpoints - MUST come first
     - hostname: your-tunnel-domain.com
       path: /twilio/*
       service: http://app:5050

     # Next.js UI - catch-all for everything else
     - hostname: your-tunnel-domain.com
       service: http://app:3000

     # Fallback (required)
     - service: http_status:404
   ```

   **Important**: The Twilio route (`/twilio/*`) MUST be listed before the Next.js catch-all route!

   Replace `your-tunnel-domain.com` with your actual tunnel hostname from Cloudflare.

8. Update `PUBLIC_DOMAIN` in `.env` to match your tunnel hostname

### 2. Start the Dev Container

1. Open this project in VS Code/Cursor
2. Press `F1` and select **Dev Containers: Reopen in Container**
3. Wait for the containers to build and dependencies to install
4. Start development:
   ```bash
   npm run dev
   ```

### 3. Access Your Application

All access is through the Cloudflare Tunnel (no local port access needed):

- **UI**: https://your-tunnel-domain.com/
- **Twilio API**: https://your-tunnel-domain.com/twilio/*
- **Health Check**: https://your-tunnel-domain.com/twilio/health

Note: Ports are not exposed on the host. All traffic routes through the tunnel.

### 4. Test the Setup

```bash
# Health check (via tunnel)
curl https://your-tunnel-domain.com/twilio/health

# Make a test call
./scripts/call.sh +1234567890
```

## Architecture

The devcontainer uses Docker Compose with two services:

### 1. **app** - Node.js Development Environment
- Node.js 20 with TypeScript
- Loads environment from `.env`
- Mounts workspace at `/workspaces/twilio-voice-agent`
- Runs both Next.js UI (port 3000) and Twilio server (port 5050)
- Ports accessible only via Cloudflare Tunnel (not exposed to host)

### 2. **cloudflared** - Cloudflare Tunnel
- Provides public HTTPS access (only way to access the application)
- Loads credentials from `.devcontainer/cloudflared.env`
- Routes traffic:
  - `/twilio/*` → app:5050 (Twilio server)
  - `/*` → app:3000 (Next.js UI)
- Required for Twilio webhooks and all access

## Configuration Files

- `.devcontainer/devcontainer.json` - VS Code devcontainer configuration
- `.devcontainer/docker-compose.yml` - Multi-container setup
- `.devcontainer/cloudflared.env` - Cloudflare tunnel token (not committed)
- `.devcontainer/cloudflared.env.sample` - Template for cloudflared.env
- `.env` - API credentials in project root (not committed)
- `.env.sample` - Template for .env

## Development Workflow

### Starting Servers

```bash
# Start both servers (UI + Twilio)
npm run dev

# Or start separately:
# Terminal 1: UI
npm run ui:dev

# Terminal 2: Twilio Server
npm run server:dev
```

### Making Calls

```bash
# Via UI
open https://your-tunnel-domain.com/

# Via CLI
./scripts/call.sh +1234567890

# Appointment reminder
./scripts/call-reminder.sh +1234567890

# Survey
./scripts/call-survey.sh +1234567890
```

### Monitoring

- **UI**: https://your-tunnel-domain.com/ - Live transcripts and tool calls
- **Logs**: Server logs display in terminal
- **Debug Mode**: `LOG_LEVEL=debug npm run server:dev`

## Customization

To modify the devcontainer:

1. Edit `.devcontainer/devcontainer.json` or `.devcontainer/docker-compose.yml`
2. Rebuild the container: `F1` → **Dev Containers: Rebuild Container**

### Adding VS Code Extensions

Add to `.devcontainer/devcontainer.json`:
```json
"customizations": {
  "vscode": {
    "extensions": [
      "your.extension-id"
    ]
  }
}
```

### Changing Ports

If you need to change the application ports (3000 or 5050):
1. Update `.env` - `PORT` variable for Twilio server
2. Update Cloudflare tunnel ingress rules to match new ports
3. Update application configuration files

Note: Ports are not exposed to host, so no docker-compose changes needed

## Troubleshooting

### Cloudflare Tunnel not working

- Verify `.devcontainer/cloudflared.env` has your tunnel token
- Check tunnel status in Cloudflare dashboard
- View tunnel logs: `docker logs <cloudflared-container-id>`
- Restart container: `F1` → **Dev Containers: Rebuild Container**
- Verify ingress rules in Cloudflare dashboard

### API Keys not found

- Verify `.env` exists in project root with all required keys
- Rebuild container to reload environment variables
- Check values in container:
  ```bash
  echo $OPENAI_API_KEY
  echo $TWILIO_ACCOUNT_SID
  ```

### Application not accessible

- Ensure servers are running: `npm run dev`
- Check Docker containers: `docker ps`
- Verify Cloudflare tunnel is running: `docker ps | grep cloudflared`
- Test tunnel: `curl https://your-tunnel-domain.com/twilio/health`
- Check tunnel ingress rules in Cloudflare dashboard

### Twilio Webhooks Failing

- Verify `PUBLIC_DOMAIN` in `.env` matches your Cloudflare tunnel domain
- Check Cloudflare tunnel is running: `docker ps | grep cloudflared`
- Test public URL: `curl https://your-domain.com/twilio/health`
- Verify ingress rules route `/twilio/*` to `localhost:5050`
- Check Twilio webhook logs in Twilio Console

### Calls Not Connecting

- Verify all Twilio credentials in `.env`
- Check Twilio phone number is correct
- Ensure PUBLIC_DOMAIN is publicly accessible
- Review server logs for errors
- Enable debug logging: `LOG_LEVEL=debug`

### Audio Issues

- Check WebSocket connections in browser console
- Verify noise reduction is set to `far_field`
- Test different voice options
- Check for network latency issues

## Security Notes

- **Never commit** `.env` or `.devcontainer/cloudflared.env`
- Both files are in `.gitignore`
- Use `.env.sample` and `cloudflared.env.sample` as templates
- Rotate credentials if accidentally committed

## Additional Resources

- [Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Cloudflare Tunnel Setup Guide](../docs/CLOUDFLARE_TUNNEL_SETUP.md)
- [Twilio Integration Guide](../docs/twilio-integration.md)
- [Architecture Documentation](../docs/ARCHITECTURE.md)
- [Setup Guide](../SETUP.md)

## Support

For issues:
- Check [SETUP.md](../SETUP.md) for common problems
- Review [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for system details
- Enable debug logging: `LOG_LEVEL=debug npm run server:dev`
- Check Docker logs: `docker-compose logs`
