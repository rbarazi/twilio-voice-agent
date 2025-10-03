#!/bin/bash

# Quick CLI shortcut for appointment reminder calls
# Usage: ./scripts/twilio-call-reminder.sh <phone-number> [appointment-details]

set -e

if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

PHONE_NUMBER="${1}"
APPOINTMENT="${2:-your appointment tomorrow at 2 PM}"

if [ -z "$PHONE_NUMBER" ]; then
  echo "Usage: $0 <phone-number> [appointment-details]"
  echo ""
  echo "Example:"
  echo "  $0 +1234567890 'your dentist appointment on Friday at 3pm'"
  exit 1
fi

PROMPT="This is a reminder about ${APPOINTMENT}. Please confirm if you will be able to attend."

DOMAIN="${PUBLIC_DOMAIN:-localhost:5050}"
PROTOCOL="https"
if [[ "$DOMAIN" == *"localhost"* ]]; then
  PROTOCOL="http"
fi

curl -X POST "${PROTOCOL}://${DOMAIN}/twilio/outbound-call" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "to": "$PHONE_NUMBER",
  "task": {
    "type": "appointment_reminder",
    "prompt": "$PROMPT"
  }
}
EOF

echo ""
