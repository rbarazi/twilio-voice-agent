# Cloudflare Tunnel Configuration for Twilio Integration

This guide explains how to configure a Cloudflare Tunnel to provide public HTTPS access to your Twilio voice agent application.

## Configuration Steps

### 1. Access Cloudflare Tunnel Settings

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks** → **Tunnels**
3. Find your tunnel or create a new one
4. Click **Configure**

### 2. Configure Ingress Rules

Configure path-based routing where Twilio API routes come BEFORE the Next.js catch-all. The order matters!

```yaml
ingress:
  # Twilio endpoints - MUST come before the Next.js catch-all
  - hostname: your-tunnel-domain.com
    path: /twilio/*
    service: http://app:5050

  # Next.js web UI - catch-all for everything else
  - hostname: your-tunnel-domain.com
    service: http://app:3000

  # Fallback (required)
  - service: http_status:404
```

**Important:**
- The Twilio routes (`/twilio/*`) MUST be listed before the Next.js route, otherwise all requests will go to Next.js!
- Replace `your-tunnel-domain.com` with your actual tunnel hostname
- Use `http://app:5050` and `http://app:3000` if running in Docker Compose (as in devcontainer)
- Use `http://localhost:5050` and `http://localhost:3000` if running services directly on host

### 3. Via Cloudflare Dashboard (Recommended)

1. In the tunnel configuration page, go to the **Public Hostname** tab
2. Add TWO public hostnames in this order:

   **First hostname (Twilio API):**
   - **Subdomain**: (your subdomain or leave blank)
   - **Domain**: your-domain.com
   - **Path**: /twilio/*
   - **Type**: HTTP
   - **URL**: app:5050 (or localhost:5050 if not using Docker)

   **Second hostname (Next.js UI):**
   - **Subdomain**: (same as above)
   - **Domain**: your-domain.com
   - **Path**: (leave blank for catch-all)
   - **Type**: HTTP
   - **URL**: app:3000 (or localhost:3000 if not using Docker)

3. Save the configuration

### 4. Via CLI (Alternative)

If you prefer using the CLI:

```bash
# Edit your tunnel config file (usually ~/.cloudflared/config.yml or in your tunnel directory)
nano ~/.cloudflared/config.yml
```

Add the ingress rules shown above, then restart the tunnel:

```bash
cloudflared tunnel restart
```

## Testing the Configuration

Once the tunnel is configured, test the endpoints:

### 1. Test Health Endpoint

```bash
curl https://your-tunnel-domain.com/twilio/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-02T..."
}
```

### 2. Test Incoming Call Endpoint

```bash
curl -X POST https://your-tunnel-domain.com/twilio/incoming-call \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=TEST123&From=+1234567890&To=+1234567890"
```

Expected: TwiML XML response

### 3. Test WebSocket Endpoint

```bash
# Install wscat if you don't have it
npm install -g wscat

# Test WebSocket connection
wscat -c "wss://your-tunnel-domain.com/twilio/media-stream"
```

Expected: Connection should be established without errors

### 4. Test UI

```bash
# Should load Next.js application
curl https://your-tunnel-domain.com/
```

## Configure Twilio Phone Number

Once the tunnel is working, configure your Twilio phone number:

1. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Select your phone number
3. Under **Voice Configuration**:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://your-tunnel-domain.com/twilio/incoming-call`
   - **HTTP**: POST
4. Click **Save**

## Running Both Servers

### Option 1: Run Separately

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Twilio Server
npm run twilio:dev
```

### Option 2: Run Together

```bash
npm run dev:all
```

This will run both servers concurrently.

## Troubleshooting

### Tunnel Not Routing Correctly

**Problem**: Requests to `/twilio/*` go to Next.js instead of Twilio server

**Solution**: Make sure the `/twilio/*` route is listed BEFORE the catch-all Next.js route in your ingress rules.

### WebSocket Connection Fails

**Problem**: WebSocket connections fail with 502 or timeout errors

**Solution**:
1. Ensure Twilio server is running on port 5050
2. Check tunnel logs: `cloudflared tunnel logs`
3. Verify WebSocket upgrade is working: Check for `101 Switching Protocols` response

### 404 on Health Check

**Problem**: `https://your-tunnel-domain.com/twilio/health` returns 404

**Checklist**:
1. Is Twilio server running? Check: `npm run server:dev`
2. Is tunnel running? Check: `docker ps | grep cloudflared` or `cloudflared tunnel list`
3. Are ingress rules correct? Verify `/twilio/*` route comes BEFORE catch-all
4. Check service URLs match your setup (`app:5050` for Docker, `localhost:5050` for host)
5. Try restarting the tunnel

## Next Steps

After configuring the tunnel:

1. ✅ Test the health endpoint
2. ✅ Configure Twilio phone number webhook
3. ✅ Make a test call to your Twilio number
4. ✅ Test outbound call API
5. ✅ Monitor logs for any issues

## Additional Resources

- [Cloudflare Tunnel Ingress Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/routing-to-tunnel/)
- [Twilio Media Streams Documentation](https://www.twilio.com/docs/voice/media-streams)
- [Testing Guide](./features/twilio-testing-guide.md)
