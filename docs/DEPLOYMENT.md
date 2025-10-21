# Deployment Guide

This guide covers deploying the Twilio Voice Agent to various cloud platforms. Choose the platform that best fits your needs.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting API Credentials](#getting-api-credentials)
- [Platform-Specific Guides](#platform-specific-guides)
  - [Render (Recommended)](#render-recommended)
  - [Railway](#railway)
  - [Heroku](#heroku)
  - [Self-Hosted](#self-hosted)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, you'll need:

1. **GitHub Account** - Fork this repository to your GitHub account
2. **OpenAI API Key** - With access to Realtime API (currently in beta)
3. **Twilio Account** - With at least one phone number
4. **Public HTTPS Domain** - For Twilio webhooks (provided by deployment platform)

---

## Getting API Credentials

### OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to [API Keys](https://platform.openai.com/api-keys)
4. Click "Create new secret key"
5. **Important**: Copy and save the key immediately (you won't see it again)
6. Your key should start with `sk-proj-` or `sk-`

**Requirements:**
- Access to Realtime API (currently in beta - [request access](https://openai.com/waitlist/realtime-api))
- Sufficient credits in your OpenAI account

### Twilio Credentials

#### Step 1: Create a Twilio Account

1. Go to [Twilio Sign Up](https://www.twilio.com/try-twilio)
2. Create a free trial account (includes $15 credit)
3. Verify your email and phone number

#### Step 2: Get Your Account SID and Auth Token

1. Go to [Twilio Console](https://console.twilio.com/)
2. Find your **Account SID** and **Auth Token** on the dashboard
3. Click the eye icon to reveal the Auth Token
4. Copy both values

**Format:**
- Account SID: Starts with `AC` (e.g., `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
- Auth Token: 32-character string

#### Step 3: Purchase a Phone Number

1. Go to [Phone Numbers → Buy a Number](https://console.twilio.com/us1/develop/phone-numbers/manage/search)
2. Select your country
3. Choose a number with **Voice** capability
4. Click "Buy" (free with trial credit)
5. Copy your number in E.164 format (e.g., `+14155551234`)

**Note**: Trial accounts can only call verified numbers. Upgrade to call any number.

---

## Platform-Specific Guides

### Render (Recommended)

**Pros:** Free tier, automatic HTTPS, easy GitHub integration, good for production
**Cons:** Cold starts on free tier

#### Quick Deploy

1. Click the button below:

   [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/rbarazi/twilio-voice-agent)

2. Connect your GitHub account if prompted

3. Configure the deployment:
   - **Repository**: Select your forked repository
   - **Branch**: `main` or your preferred branch
   - **Region**: Choose closest to your users

4. Set environment variables:
   ```
   OPENAI_API_KEY=sk-proj-...
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+14155551234
   PUBLIC_DOMAIN=https://your-app-name.onrender.com
   LOG_LEVEL=info
   ```

5. Click "Create Web Service"

6. Wait for deployment (5-10 minutes first time)

7. **Important**: Update `PUBLIC_DOMAIN` to your actual Render URL after first deploy

#### Manual Render Setup

If the button doesn't work:

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Select the `render.yaml` file
5. Follow steps 4-7 above

#### Setting Up Custom Domain (Optional)

1. In Render dashboard, go to your service
2. Click "Settings" → "Custom Domain"
3. Add your domain and follow DNS instructions
4. Update `PUBLIC_DOMAIN` environment variable to your custom domain

---

### Railway

**Pros:** Excellent DX, generous free tier, automatic HTTPS
**Cons:** Less mature than other platforms

#### Quick Deploy

1. Click the button below:

   [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/twilio-voice-agent)

2. Sign in with GitHub

3. Click "Deploy Now"

4. Configure environment variables:
   ```
   OPENAI_API_KEY=sk-proj-...
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+14155551234
   PUBLIC_DOMAIN=https://your-app-name.up.railway.app
   LOG_LEVEL=info
   NODE_ENV=production
   TWILIO_SERVER_PORT=5050
   ```

5. Click "Deploy"

6. Once deployed, get your Railway URL and update `PUBLIC_DOMAIN`

#### Manual Railway Setup

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Link project: `railway link`
5. Set variables: `railway variables set OPENAI_API_KEY=sk-...`
6. Deploy: `railway up`

---

### Heroku

**Pros:** Mature platform, extensive documentation
**Cons:** No free tier (minimum $5/month)

#### Quick Deploy

1. Click the button below:

   [![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/rbarazi/twilio-voice-agent)

2. Sign in to Heroku

3. Choose an app name

4. Fill in environment variables (see form descriptions)

5. Click "Deploy app"

6. Once deployed, go to "Settings" → "Reveal Config Vars"

7. Update `PUBLIC_DOMAIN` to `https://your-app-name.herokuapp.com`

8. Restart the app

#### Manual Heroku Setup

```bash
# Install Heroku CLI
brew install heroku/brew/heroku  # macOS
# or download from https://devcenter.heroku.com/articles/heroku-cli

# Login
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set OPENAI_API_KEY=sk-proj-...
heroku config:set TWILIO_ACCOUNT_SID=AC...
heroku config:set TWILIO_AUTH_TOKEN=your_token
heroku config:set TWILIO_PHONE_NUMBER=+14155551234
heroku config:set PUBLIC_DOMAIN=https://your-app-name.herokuapp.com
heroku config:set LOG_LEVEL=info
heroku config:set NODE_ENV=production
heroku config:set TWILIO_SERVER_PORT=5050

# Deploy
git push heroku main

# Open app
heroku open
```

---

### Self-Hosted

**Pros:** Full control, best security, no vendor lock-in
**Cons:** Requires infrastructure management

#### Requirements

- Node.js 18+ installed
- Public HTTPS domain (required for Twilio webhooks)
- Reverse proxy (nginx, Caddy, or Cloudflare Tunnel)

#### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/rbarazi/twilio-voice-agent.git
   cd twilio-voice-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env` file**
   ```bash
   cp .env.sample .env
   ```

4. **Edit `.env` with your credentials**
   ```env
   OPENAI_API_KEY=sk-proj-...
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+14155551234
   PUBLIC_DOMAIN=https://your-domain.com
   TWILIO_SERVER_PORT=5050
   LOG_LEVEL=info
   ```

5. **Build and start**
   ```bash
   npm run build
   npm run start
   ```

6. **Set up reverse proxy** (see [Cloudflare Tunnel Guide](./CLOUDFLARE_TUNNEL_SETUP.md))

7. **Set up process manager** (recommended: PM2)
   ```bash
   npm install -g pm2
   pm2 start npm --name "voice-agent-ui" -- run ui:start
   pm2 start npm --name "voice-agent-server" -- run server:start
   pm2 save
   pm2 startup  # Follow instructions
   ```

---

## Post-Deployment Configuration

### Verify Deployment

1. **Check UI is accessible**
   - Visit your deployment URL
   - You should see the Voice Agent Monitor interface

2. **Check server health**
   - Visit `https://your-domain.com/twilio/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

3. **Test the models endpoint**
   - Visit `https://your-domain.com/api/models`
   - Should return available OpenAI models

### Configure Cloudflare Tunnel (if needed)

Many deployment platforms provide a single URL. Since this app has two servers (UI on port 3000, Twilio server on port 5050), you may need to configure routing:

See [CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md) for detailed instructions.

**Quick config:**
```yaml
ingress:
  - hostname: your-domain.com
    path: /twilio/*
    service: http://localhost:5050
  - hostname: your-domain.com
    service: http://localhost:3000
  - service: http_status:404
```

### Update Twilio Webhooks (if using incoming calls)

If you want to handle incoming calls:

1. Go to [Twilio Console → Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click on your phone number
3. Under "Voice Configuration":
   - **A Call Comes In**: Webhook
   - **URL**: `https://your-domain.com/twilio/incoming-call`
   - **HTTP Method**: POST
4. Save

---

## Troubleshooting

### Common Issues

#### 1. "OPENAI_API_KEY is not set"

**Problem**: Environment variables not loaded

**Solution:**
- Double-check variable names (no typos)
- Restart the application after setting variables
- For Render/Railway/Heroku: Check dashboard "Environment Variables" section
- For self-hosted: Ensure `.env` file exists and has correct format

---

#### 2. Call fails immediately

**Problem**: Twilio can't reach your webhooks

**Solutions:**
- Verify `PUBLIC_DOMAIN` is set to your actual public URL
- Check URL is HTTPS (Twilio requires HTTPS)
- Test health endpoint: `curl https://your-domain.com/twilio/health`
- Check Twilio webhook logs: [Twilio Console → Monitor → Logs](https://console.twilio.com/us1/monitor/logs/debugger)

---

#### 3. No audio on call

**Problem**: Noise reduction or audio format issue

**Solutions:**
- Set `noiseReduction` to `far_field` in UI
- Check browser console for WebSocket errors
- Verify OpenAI Realtime API access (beta required)

---

#### 4. "Models could not be loaded"

**Problem**: OpenAI API key invalid or no Realtime access

**Solutions:**
- Verify API key is correct
- Check you have Realtime API access
- Test key: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

---

#### 5. Deployment succeeds but app won't start

**Problem**: Build or runtime error

**Solutions:**
- Check deployment logs in platform dashboard
- Verify Node.js version (should be 18+)
- Check `package.json` scripts are correct
- Ensure all dependencies installed: `npm install`

---

#### 6. Cold starts on free tier

**Problem**: Render/Railway free tier spins down after inactivity

**Solutions:**
- Upgrade to paid tier for always-on
- Use uptime monitor (e.g., UptimeRobot) to ping every 5 minutes
- Accept 30-60 second cold start delay

---

### Getting Help

If you encounter issues not covered here:

1. **Check the logs**
   - Render: Dashboard → Logs
   - Railway: Dashboard → Deployments → View Logs
   - Heroku: `heroku logs --tail`
   - Self-hosted: `tail -f twilio-server.log`

2. **Check existing issues**
   - [GitHub Issues](https://github.com/rbarazi/twilio-voice-agent/issues)

3. **Create a new issue**
   - Include deployment platform
   - Include error messages and logs
   - Include steps to reproduce

---

## Security Best Practices

1. **Never commit `.env` files** (already in `.gitignore`)
2. **Rotate credentials regularly**
3. **Use environment variables for all secrets**
4. **Enable HTTPS only** (Twilio requires it)
5. **Monitor API usage** to avoid unexpected charges
6. **Set up billing alerts** on OpenAI and Twilio
7. **Restrict API key permissions** if possible

---

## Cost Estimation

### Free Tier Limits

**Render (Free)**
- 750 hours/month
- Spins down after 15 minutes inactivity
- Cold start: ~30-60 seconds

**Railway (Free)**
- $5 credit/month
- ~500 hours with basic app
- No cold starts

**Heroku (No free tier)**
- Minimum: $7/month (Eco dyno)
- No cold starts on paid tier

### API Costs

**OpenAI Realtime API**
- Audio input: ~$0.06/minute
- Audio output: ~$0.24/minute
- Average 5-minute call: ~$1.50

**Twilio**
- Outbound calls: ~$0.013/minute
- Phone number: ~$1/month
- Average 5-minute call: ~$0.07

**Total per 5-minute call: ~$1.57**

---

## Next Steps

After successful deployment:

1. ✅ Test with a call to your own phone
2. ✅ Configure custom prompts for your use case
3. ✅ Set up monitoring and alerts
4. ✅ Review [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system
5. ✅ Check [FUTURE_IMPROVEMENTS.md](./FUTURE_IMPROVEMENTS.md) for enhancement ideas

---

**Need help?** Open an issue on [GitHub](https://github.com/rbarazi/twilio-voice-agent/issues)
