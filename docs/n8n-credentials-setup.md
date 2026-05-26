# n8n Credentials Setup Guide

This guide describes how to set up the necessary credentials in your n8n instance for the CV Screening Automation pipeline.

## 1. OpenAI API
- **Type:** OpenAI API
- **Credentials needed:** API Key
- **Usage:** CV Parsing, JD Matching, Summary Generation

## 2. PostgreSQL
- **Type:** PostgreSQL
- **Credentials needed:** Host, Database, User, Password, Port (default 5432)
- **Usage:** Storing candidate records, job descriptions, audit logs, and notifications

## 3. Redis
- **Type:** Redis
- **Credentials needed:** Host, Port (default 6379), Password (optional)
- **Usage:** Queue management for CV processing jobs and JD caching

## 4. Gmail (Optional - for Intake)
- **Type:** Gmail OAuth2
- **Credentials needed:** Client ID, Client Secret
- **Usage:** Monitoring inbox for CV attachments

## 5. Slack (Optional - for Notifications)
- **Type:** Slack API
- **Credentials needed:** Bot Token
- **Usage:** Sending notifications to recruiters

## 6. AWS S3 (Optional - for Storage)
- **Type:** AWS Credentials
- **Credentials needed:** Access Key ID, Secret Access Key, Region, Endpoint (if using S3-compatible)
- **Usage:** Storing encrypted CV files

## 7. Discord (Optional - for Notifications)
- **Type:** Webhook URL
- **Usage:** Sending notifications to Discord channels

## 8. Telegram (Optional - for Notifications)
- **Type:** Telegram API
- **Credentials needed:** Bot Token
- **Usage:** Sending notifications via Telegram Bot
