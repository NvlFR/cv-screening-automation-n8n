'use strict';

/**
 * Konfigurasi environment variables untuk CV Screening Automation.
 * Semua nilai dibaca dari environment variables dengan fallback ke nilai default yang aman.
 */

const config = {
  // PostgreSQL Database
  db: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cv_screening',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'cv_screening',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    // Connection pool settings
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000', 10),
    },
  },

  // Redis Cache
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    // Retry & reconnect settings
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
    connectTimeoutMs: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000', 10),
  },

  // OpenAI API
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
    // Exponential backoff delays (ms): 30s, 60s, 120s
    retryDelays: [30000, 60000, 120000],
    timeoutMs: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10),
  },

  // Anthropic API
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620',
    baseUrl: process.env.ANTHROPIC_BASE_URL || undefined,
  },

  // AI Provider Setting
  ai: {
    provider: process.env.AI_PROVIDER || 'openai', // 'openai' or 'anthropic'
  },

  // S3-compatible File Storage
  s3: {
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET || 'cv-screening-files',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    // Enkripsi AES-256 untuk file CV
    encryptionKey: process.env.FILE_ENCRYPTION_KEY || '',
  },

  // Redis Queue Keys
  queue: {
    cvProcessingKey: 'cv_processing_queue',
    rateLimitKey: 'rate_limit:cv_intake',
    rateLimitTtlSeconds: 60,
    jdCachePrefix: 'jd_parsed:',
    jdCacheTtlSeconds: 86400, // 24 jam
  },

  // Application Settings
  app: {
    env: process.env.NODE_ENV || 'development',
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['pdf', 'docx', 'txt'],
    maxConcurrentCV: parseInt(process.env.MAX_CONCURRENT_CV || '50', 10),
    maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE || '1000', 10),
  },

  // Notification Settings
  notification: {
    maxRetries: 3,
    retryIntervalMs: 60000, // 60 detik
    channels: {
      email: {
        enabled: process.env.EMAIL_ENABLED === 'true',
        from: process.env.EMAIL_FROM || 'noreply@company.com',
        smtpHost: process.env.SMTP_HOST || '',
        smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
        smtpUser: process.env.SMTP_USER || '',
        smtpPassword: process.env.SMTP_PASSWORD || '',
      },
      slack: {
        enabled: process.env.SLACK_ENABLED === 'true',
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        botToken: process.env.SLACK_BOT_TOKEN || '',
        channel: process.env.SLACK_CHANNEL || '#cv-screening',
      },
      discord: {
        enabled: process.env.DISCORD_ENABLED === 'true',
        webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
      },
      telegram: {
        enabled: process.env.TELEGRAM_ENABLED === 'true',
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
      },
    },
  },
};

module.exports = config;
