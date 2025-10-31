# API Credentials Guide

Quick reference for obtaining all required API credentials for the Twilio Voice Agent.

## Required Credentials Checklist

- [ ] OpenAI API Key
- [ ] Twilio Account SID
- [ ] Twilio Auth Token
- [ ] Twilio Phone Number
- [ ] Public HTTPS Domain

---

## OpenAI API Key

### What you need
- OpenAI account with Realtime API access (currently in beta)
- Valid payment method on file

### Steps

1. **Create OpenAI Account** (if you don't have one)
   - Go to: https://platform.openai.com/signup
   - Sign up with email or Google/Microsoft account
   - Verify your email

2. **Add Payment Method**
   - Go to: https://platform.openai.com/account/billing/overview
   - Click "Add payment method"
   - Add credit card
   - Recommended: Set up billing limits to avoid surprises

3. **Request Realtime API Access**
   - Go to: https://openai.com/waitlist/realtime-api
   - Fill out the form
   - Wait for approval email (usually 1-3 days)

4. **Create API Key**
   - Go to: https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Name it (e.g., "Twilio Voice Agent")
   - **Important**: Copy the key immediately (starts with `sk-proj-` or `sk-`)
   - Store it securely - you won't see it again

### Format
```
sk-proj-...  (modern project keys)
sk-...       (legacy keys)
```

### Testing Your Key
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY_HERE"
```

Should return a list of available models.

### Cost
- Realtime API: ~$0.06/min input, ~$0.24/min output
- Average 5-minute call: ~$1.50

### Billing Alerts
Set up usage notifications:
1. Go to: https://platform.openai.com/account/billing/limits
2. Set "Email notifications" threshold
3. Set hard limit if desired

---

## Twilio Credentials

### What you need
- Phone number for verification
- Email address
- Credit card (for paid tier) or use free trial

### Step 1: Create Twilio Account

1. **Sign Up**
   - Go to: https://www.twilio.com/try-twilio
   - Fill in your details
   - Verify your email
   - Verify your phone number

2. **Free Trial**
   - New accounts get $15 free credit
   - Trial limitations:
     - Can only call/SMS verified numbers
     - Calls include trial message
     - Upgrade to remove restrictions

### Step 2: Get Account SID and Auth Token

1. **Access Console**
   - Go to: https://console.twilio.com/
   - You'll land on the dashboard

2. **Find Credentials**
   - Look for "Account Info" section
   - **Account SID**: Visible (starts with `AC`)
   - **Auth Token**: Hidden - click eye icon to reveal
   - Click copy icons to copy values

### Format
```
Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  (34 characters)
Auth Token:  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     (32 characters)
```

### Step 3: Get Phone Number

1. **Buy a Number**
   - Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/search
   - Choose your country
   - Select a number with **Voice** capability (required)
   - Optional: Filter by area code, contains digits, etc.
   - Click "Buy" button

2. **Configure Number**
   - After purchase, go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
   - Click on your number
   - Note the number in E.164 format (shown at top)

### Format
```
E.164 Format: +[country code][number]
Examples:
  US:  +14155551234
  UK:  +442071234567
  CA:  +14165551234
```

### Cost
- Phone number: ~$1.00/month (varies by country)
- Outbound calls: ~$0.013/minute (US)
- Free trial: $15 credit included

### Testing Your Credentials

#### Via cURL
```bash
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID.json" \
  -u "YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN"
```

Should return your account details.

#### Via Node.js
```javascript
const twilio = require('twilio');
const client = twilio('YOUR_ACCOUNT_SID', 'YOUR_AUTH_TOKEN');

client.api.accounts('YOUR_ACCOUNT_SID')
  .fetch()
  .then(account => console.log('Account:', account.friendlyName))
  .catch(error => console.error('Error:', error));
```

---

## Public Domain

### What you need
- HTTPS domain accessible from the internet
- Twilio requires HTTPS for webhooks (HTTP not supported)

### Options

#### Option 1: Use Deployment Platform Domain (Easiest)

Most platforms provide HTTPS automatically:

- **Render**: `https://your-app-name.onrender.com`
- **Railway**: `https://your-app-name.up.railway.app`
- **Heroku**: `https://your-app-name.herokuapp.com`

No configuration needed - just use this URL as `PUBLIC_DOMAIN`

#### Option 2: Custom Domain

If you want your own domain (e.g., `voice.yourdomain.com`):

1. **Buy domain** (if needed)
   - Namecheap, Google Domains, etc.

2. **Configure DNS** (varies by platform)
   - See your deployment platform docs
   - Usually: Add CNAME record pointing to platform URL

3. **Enable HTTPS**
   - Most platforms auto-provision SSL certificates
   - Uses Let's Encrypt

#### Option 3: Cloudflare Tunnel (For Self-Hosted)

See [CLOUDFLARE_TUNNEL_SETUP.md](./CLOUDFLARE_TUNNEL_SETUP.md)

---

## Environment Variables Summary

Once you have all credentials, you'll set these environment variables:

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-...

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+14155551234

# Domain
PUBLIC_DOMAIN=https://your-app.onrender.com

# Optional
LOG_LEVEL=info
NODE_ENV=production
TWILIO_SERVER_PORT=5050
```

---

## Security Best Practices

### ✅ DO:
- Store credentials in environment variables
- Use separate API keys for dev/staging/production
- Set up billing alerts
- Rotate credentials periodically
- Use `.env` files (never commit them!)
- Enable 2FA on Twilio and OpenAI accounts

### ❌ DON'T:
- Commit credentials to Git
- Share credentials in public channels
- Use production keys in development
- Store credentials in code
- Share screenshots with visible credentials

---

## Validation Checklist

Before deploying, verify:

- [ ] OpenAI API key starts with `sk-`
- [ ] Twilio Account SID starts with `AC`
- [ ] Twilio Auth Token is 32 characters
- [ ] Phone number is in E.164 format (`+1...`)
- [ ] Phone number has Voice capability
- [ ] Public domain is HTTPS
- [ ] Public domain is accessible from internet
- [ ] Tested API credentials (see testing sections above)
- [ ] Set up billing alerts on both platforms

---

## Quick Reference Links

| Service | Link | Purpose |
|---------|------|---------|
| OpenAI Platform | https://platform.openai.com/ | Account dashboard |
| OpenAI API Keys | https://platform.openai.com/api-keys | Create/manage keys |
| OpenAI Billing | https://platform.openai.com/account/billing/overview | Add payment, view usage |
| Realtime API Waitlist | https://openai.com/waitlist/realtime-api | Request beta access |
| Twilio Console | https://console.twilio.com/ | Account dashboard |
| Twilio Phone Numbers | https://console.twilio.com/us1/develop/phone-numbers/manage/search | Buy numbers |
| Twilio Logs | https://console.twilio.com/us1/monitor/logs/debugger | Debug webhook issues |

---

## Troubleshooting

### "Invalid OpenAI API key"
- Ensure key starts with `sk-`
- Check for extra spaces or newlines
- Verify account has payment method
- Test with cURL command above

### "Twilio authentication failed"
- Verify Account SID starts with `AC`
- Check Auth Token is correct (click eye icon to reveal)
- Ensure no spaces in credentials
- Test with cURL command above

### "Phone number not found"
- Verify number is in E.164 format
- Check number exists in your Twilio account
- Ensure number has Voice capability
- Try number without spaces or dashes

### "Realtime API not available"
- Request access via waitlist
- Check approval email
- May take 1-3 days for approval
- Contact OpenAI support if delayed

---

**Ready to deploy?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for platform-specific instructions.
