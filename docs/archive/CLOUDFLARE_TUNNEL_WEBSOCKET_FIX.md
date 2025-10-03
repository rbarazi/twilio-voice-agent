# Cloudflare Tunnel WebSocket Fix - Option 2: Config-Only Tunnel

## Current Issue
The existing tunnel is dashboard-managed and doesn't support WebSocket upgrades for the `/twilio/*` path, resulting in 502 errors for WebSocket connections.

## Solution: Convert to Config-Only Tunnel

### Step 1: Delete Dashboard Routes (Keep Tunnel)

1. Go to https://one.dash.cloudflare.com/
2. Navigate to **Networks → Tunnels**
3. Find tunnel: `rida-mbp-agentify-voice` (ID: `5053a46d-6573-4a0a-b5f3-f7a8cf0c05e8`)
4. Click **Configure** → **Public Hostname** tab
5. **Delete ALL public hostname routes** (but don't delete the tunnel itself)
   - Delete route: `rida-mbp-agentify-voice.rida.me` with path `/twilio/*`
   - Delete route: `rida-mbp-agentify-voice.rida.me` catch-all

### Step 2: Add DNS Record (If Not Present)

1. In Cloudflare dashboard, go to **DNS → Records** for `rida.me`
2. Check if `rida-mbp-agentify-voice` subdomain exists
3. If NOT present, add a CNAME record:
   - **Type**: CNAME
   - **Name**: `rida-mbp-agentify-voice`
   - **Target**: `5053a46d-6573-4a0a-b5f3-f7a8cf0c05e8.cfargotunnel.com`
   - **Proxy status**: Proxied (orange cloud)
   - **TTL**: Auto

### Step 3: Verify Config File

The config file is already correct at `.devcontainer/cloudflared-config.yml`:

```yaml
tunnel: 5053a46d-6573-4a0a-b5f3-f7a8cf0c05e8
credentials-file: /etc/cloudflared/credentials.json

ingress:
  # Twilio WebSocket route - MUST come first
  - hostname: rida-mbp-agentify-voice.rida.me
    path: /twilio/*
    service: http://localhost:5050
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s

  # Next.js web UI - catch all other requests
  - hostname: rida-mbp-agentify-voice.rida.me
    service: http://localhost:3000
    originRequest:
      noTLSVerify: true

  # Required fallback
  - service: http_status:404
```

### Step 4: Restart Dev Container

The tunnel needs to restart to pick up the config-only mode:

```bash
# Exit and rebuild the dev container in VS Code:
# 1. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
# 2. Run: "Dev Containers: Rebuild Container"
```

### Step 5: Verify Tunnel is Running

After container rebuild:

```bash
# Check if servers are running
curl http://localhost:5050/twilio/health
curl http://localhost:3000

# Both should respond successfully
```

### Step 6: Test Through Cloudflare Tunnel

```bash
# Test health endpoint
curl https://rida-mbp-agentify-voice.rida.me/twilio/health
# Expected: {"status":"ok","timestamp":"..."}

# Test WebSocket upgrade
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://rida-mbp-agentify-voice.rida.me/twilio/media-stream

# Expected: HTTP 101 Switching Protocols (not 502)
```

## Why This Works

**Dashboard-Managed Tunnels** (Current):
- Routes configured in dashboard UI
- Dashboard routes override config file ingress rules
- Limited WebSocket support in dashboard UI

**Config-Only Tunnels** (After Fix):
- No routes in dashboard (only DNS record)
- All routing controlled by config file
- Config file supports full WebSocket configuration via `originRequest` settings
- The `noTLSVerify: true` and `connectTimeout: 30s` enable proper WebSocket handling

## Troubleshooting

### If tunnel doesn't start after container rebuild:
```bash
# Check cloudflared logs (from outside container)
docker compose -f .devcontainer/docker-compose.yml logs cloudflared

# Should see: "Registered tunnel connection" with tunnel ID
```

### If DNS doesn't resolve:
```bash
# Check DNS propagation
dig rida-mbp-agentify-voice.rida.me

# Should show CNAME to *.cfargotunnel.com
```

### If 502 persists:
1. Verify dashboard routes are completely deleted
2. Verify DNS CNAME is correct
3. Check that both services (3000 and 5050) are running locally
4. Check cloudflared container logs for errors

## Alternative: Option 3 (Separate Subdomain)

If config-only approach doesn't work, use a dedicated subdomain:

1. Keep existing tunnel for Next.js UI
2. Create new dashboard route:
   - Subdomain: `twilio.rida.me`
   - Service: `http://localhost:5050`
   - Enable WebSocket in dashboard (if available)
3. Update `.env`: `PUBLIC_DOMAIN=twilio.rida.me`
4. Update Twilio webhooks to use `twilio.rida.me`
