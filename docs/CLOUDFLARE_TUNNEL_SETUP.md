# Cloudflare Tunnel Configuration for Twilio Integration

## Current Setup

You're currently using the Cloudflare tunnel domain: `rida-mbp-agentify-voice.rida.me`

The tunnel is already configured to route the Next.js web UI. Now you need to add routing for the Twilio server.

## Configuration Steps

### 1. Access Cloudflare Tunnel Settings

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks** → **Tunnels**
3. Find your tunnel (the one using domain `rida-mbp-agentify-voice.rida.me`)
4. Click **Configure**

### 2. Update Ingress Rules

You need to add the Twilio server routes BEFORE the existing catch-all route. The order matters!

Update your tunnel configuration to include these ingress rules:

```yaml
ingress:
  # Twilio endpoints - MUST come before the Next.js catch-all
  - hostname: rida-mbp-agentify-voice.rida.me
    path: /twilio/*
    service: http://localhost:5050

  # Next.js web UI (existing)
  - hostname: rida-mbp-agentify-voice.rida.me
    service: http://localhost:3000

  # Fallback (required)
  - service: http_status:404
```

**Important:** The Twilio routes (`/twilio/*`) MUST be listed before the Next.js route, otherwise all requests will go to Next.js!

### 3. Via Cloudflare Dashboard (Recommended)

1. In the tunnel configuration page, go to the **Public Hostname** tab
2. Click **Add a public hostname**
3. Configure as follows:
   - **Subdomain**: (leave blank if using root domain)
   - **Domain**: rida-mbp-agentify-voice.rida.me
   - **Path**: /twilio/*
   - **Type**: HTTP
   - **URL**: localhost:5050

4. Save the configuration

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
curl https://rida-mbp-agentify-voice.rida.me/twilio/health
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
curl -X POST https://rida-mbp-agentify-voice.rida.me/twilio/incoming-call \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=TEST123&From=+1234567890&To=+1234567890"
```

Expected: TwiML XML response

### 3. Test WebSocket Endpoint

```bash
# Install wscat if you don't have it
npm install -g wscat

# Test WebSocket connection
wscat -c "wss://rida-mbp-agentify-voice.rida.me/twilio/media-stream"
```

Expected: Connection should be established without errors

## Configure Twilio Phone Number

Once the tunnel is working, configure your Twilio phone number:

1. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Select your phone number: **+16479556388**
3. Under **Voice Configuration**:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://rida-mbp-agentify-voice.rida.me/twilio/incoming-call`
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

**Problem**: `https://rida-mbp-agentify-voice.rida.me/twilio/health` returns 404

**Checklist**:
1. Is Twilio server running? Check: `curl http://localhost:5050/twilio/health`
2. Is tunnel running? Check: `cloudflared tunnel list`
3. Are ingress rules correct? Check tunnel configuration
4. Try restarting the tunnel

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
