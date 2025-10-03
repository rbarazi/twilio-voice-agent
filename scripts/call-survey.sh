#!/bin/bash

# Quick CLI shortcut for survey calls
# Usage: ./scripts/twilio-call-survey.sh <phone-number> [survey-prompt]

set -e

if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

PHONE_NUMBER="${1}"
SURVEY="${2:-How would you rate your recent experience with our service on a scale of 1 to 10?}"

if [ -z "$PHONE_NUMBER" ]; then
  echo "Usage: $0 <phone-number> [survey-prompt]"
  echo ""
  echo "Example:"
  echo "  $0 +1234567890 'What did you think of our new product?'"
  exit 1
fi

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
    "type": "survey",
    "prompt": "$SURVEY"
  }
}
EOF

echo ""
