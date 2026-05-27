#!/bin/bash

# Pastikan script dijalanin dari root project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "--- CV PUSH SCRIPT ---"
node scripts/push-test-cv.js
