#!/bin/bash

# Script to import all n8n workflows into n8n instance via API
# Requirements: 11.1, 11.2

N8N_API_URL=${N8N_API_URL:-"http://localhost:5678/api/v1"}
N8N_API_KEY=${N8N_API_KEY:-""}

if [ -z "$N8N_API_KEY" ]; then
  echo "Error: N8N_API_KEY is not set."
  echo "Usage: N8N_API_KEY=your_api_key ./import-all-workflows.sh"
  exit 1
fi

WORKFLOW_FILES=(
  "cv-intake-workflow.json"
  "cv-processing-workflow.json"
  "notification-workflow.json"
  "error-handler-workflow.json"
)

echo "Starting workflow import to $N8N_API_URL..."

for FILE in "${WORKFLOW_FILES[@]}"; do
  if [ -f "n8n-workflows/$FILE" ]; then
    echo "Importing $FILE..."
    
    # Extract workflow name from JSON or use filename
    NAME=$(cat "n8n-workflows/$FILE" | grep -oP '"name":\s*"\K[^"]+' | head -1)
    
    # Send POST request to n8n API
    # Note: This assumes the API structure for creating workflows
    RESPONSE=$(curl -s -X POST "$N8N_API_URL/workflows" \
      -H "X-N8N-API-KEY: $N8N_API_KEY" \
      -H "Content-Type: application/json" \
      --data @"n8n-workflows/$FILE")
    
    if echo "$RESPONSE" | grep -q '"id":'; then
      echo "Successfully imported: $NAME"
    else
      echo "Failed to import $FILE: $RESPONSE"
    fi
  else
    echo "Warning: File n8n-workflows/$FILE not found, skipping."
  fi
done

echo "Import process finished."
