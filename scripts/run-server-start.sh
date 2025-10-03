#!/bin/bash

# Load environment variables from .env
set -a
source .env 2>/dev/null || true
set +a

# Run tsx
exec tsx server/server.ts
