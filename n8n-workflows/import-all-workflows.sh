#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Auto-load .env from project root (parent directory of n8n-workflows/)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  echo "Loading environment from $ENV_FILE..."
  # Export all variables from .env
  set -a
  source "$ENV_FILE"
  set +a
  echo "Environment loaded."
  echo ""
fi

N8N_API_URL=${N8N_API_URL:-"http://localhost:5678/api/v1"}
N8N_API_KEY=${N8N_API_KEY:-""}

if [ -z "$N8N_API_KEY" ]; then
  echo "Error: N8N_API_KEY is not set."
  echo ""
  echo "Please set your N8N API key:"
  echo "  1. Login to n8n dashboard"
  echo "  2. Go to Settings -> API"
  echo "  3. Create a new API key"
  echo "  4. Add it to .env file:"
  echo "     echo 'N8N_API_KEY=your_key_here' >> .env"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed."
  echo "Install with: sudo apt install jq"
  exit 1
fi

WORKFLOW_FILES=(
  "cv-intake-workflow.json"
  "cv-processing-workflow.json"
  "notification-workflow.json"
  "error-handler-workflow.json"
)

echo "Starting workflow import to $N8N_API_URL..."
echo ""

for FILE in "${WORKFLOW_FILES[@]}"; do

  FULL_PATH="$SCRIPT_DIR/$FILE"

  if [ ! -f "$FULL_PATH" ]; then
    echo "⚠️ File $FILE not found at $FULL_PATH, skipping."
    echo ""
    continue
  fi

  echo "Importing $FILE..."

  # Validate JSON
  if ! jq empty "$FULL_PATH" 2>/dev/null; then
    echo "❌ Invalid JSON: $FILE"
    echo ""
    continue
  fi

  # Extract workflow name
  NAME=$(jq -r '.name // "Unnamed Workflow"' "$FULL_PATH")

  TEMP_FILE=$(mktemp)

  # Remove read-only fields
  jq 'del(
    .id,
    .versionId,
    .createdAt,
    .updatedAt,
    .triggerCount,
    .meta,
    .pinData,
    .shared,
    .tags,
    .active,
    .isArchived
  )' "$FULL_PATH" > "$TEMP_FILE"

  # Send request
  RESPONSE=$(curl -s -X POST "$N8N_API_URL/workflows" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    --data @"$TEMP_FILE")

  rm -f "$TEMP_FILE"

  # Check result
  if echo "$RESPONSE" | grep -q '"id"'; then
    echo "✅ Successfully imported: $NAME"
  else
    echo "❌ Failed to import: $NAME"
    # Try to extract error message
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.message // .error // "Unknown error"' 2>/dev/null)
    echo "   Error: $ERROR_MSG"
  fi

  echo ""

done

echo "Import process finished."