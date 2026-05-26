# Environment Variables Documentation

The following environment variables are required for the CV Screening Automation system to function correctly.

## Database (PostgreSQL)
- `DATABASE_URL`: Full PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/db`)
- `DB_HOST`: Database host (default: `localhost`)
- `DB_PORT`: Database port (default: `5432`)
- `DB_NAME`: Database name (default: `cv_screening`)
- `DB_USER`: Database user (default: `postgres`)
- `DB_PASSWORD`: Database password (default: `postgres`)

## Cache & Queue (Redis)
- `REDIS_URL`: Redis connection URL (e.g., `redis://localhost:6379`)
- `REDIS_HOST`: Redis host (default: `localhost`)
- `REDIS_PORT`: Redis port (default: `6379`)
- `REDIS_PASSWORD`: Redis password (optional)

## AI (OpenAI)
- `OPENAI_API_KEY`: Your OpenAI API Key
- `OPENAI_MODEL`: OpenAI model to use (default: `gpt-4o-mini`)

## File Storage (S3-compatible)
- `S3_ENDPOINT`: S3 endpoint URL
- `S3_REGION`: S3 region (default: `us-east-1`)
- `S3_BUCKET`: S3 bucket name
- `S3_ACCESS_KEY_ID`: S3 access key ID
- `S3_SECRET_ACCESS_KEY`: S3 secret access key
- `FILE_ENCRYPTION_KEY`: 32-character key for AES-256 encryption

## Notifications
- `EMAIL_ENABLED`: Set to `true` to enable email notifications
- `SMTP_HOST`: SMTP host for email
- `SMTP_PORT`: SMTP port (default: `587`)
- `SMTP_USER`: SMTP username
- `SMTP_PASSWORD`: SMTP password
- `SLACK_ENABLED`: Set to `true` to enable Slack notifications
- `SLACK_WEBHOOK_URL`: Slack webhook URL
- `DISCORD_ENABLED`: Set to `true` to enable Discord notifications
- `DISCORD_WEBHOOK_URL`: Discord webhook URL
- `TELEGRAM_ENABLED`: Set to `true` to enable Telegram notifications
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `TELEGRAM_CHAT_ID`: Telegram chat ID

## Application Settings
- `NODE_ENV`: Application environment (`development`, `production`, `test`)
- `MAX_CONCURRENT_CV`: Maximum concurrent CVs to process (default: `50`)
- `NOTIFICATION_WEBHOOK_URL`: Webhook URL for the Notification Workflow
