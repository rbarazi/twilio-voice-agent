#!/bin/bash

# Twilio Outbound Call CLI Tool
# Usage: ./scripts/twilio-call.sh <phone-number> <task-type> <prompt>

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

PHONE_NUMBER="${1}"
TASK_TYPE="${2:-custom}"
PROMPT="${3:-Hello, this is a test call from the AI agent. How are you doing today?}"

if [ -z "$PHONE_NUMBER" ]; then
  echo "Usage: $0 <phone-number> [task-type] [prompt]"
  echo ""
  echo "Examples:"
  echo "  $0 +1234567890"
  echo "  $0 +1234567890 notification 'Your appointment is tomorrow at 2pm'"
  echo "  $0 +1234567890 survey 'We would like your feedback on our service'"
  echo ""
  echo "Task types: appointment_reminder, survey, notification, custom"
  exit 1
fi

DOMAIN="${PUBLIC_DOMAIN:-localhost:5050}"
PROTOCOL="https"

if [[ "$DOMAIN" == *"localhost"* ]]; then
  PROTOCOL="http"
fi

URL="${PROTOCOL}://${DOMAIN}/twilio/outbound-call"

echo "Initiating call to: $PHONE_NUMBER"
echo "Task type: $TASK_TYPE"
echo "Prompt: $PROMPT"
echo "URL: $URL"
echo ""

curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "to": "$PHONE_NUMBER",
  "task": {
    "type": "$TASK_TYPE",
    "prompt": "$PROMPT"
  }
}
EOF

echo ""
