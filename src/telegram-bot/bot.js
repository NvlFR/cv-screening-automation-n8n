'use strict';

require('dotenv').config({ override: true });
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const redis = require('../cache/redis-client');
const config = require('../config');
const { encryptFile } = require('../cv-intake/encryptor');
const { validateFile } = require('../cv-intake/validator');

/**
 * Telegram Bot Interface for CV Screening Automation.
 * Allows users to upload CVs and get processing results.
 */

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const TARGET_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Command: /start
bot.start((ctx) => {
  ctx.reply('👋 Halo! Saya adalah AI CV Screening Bot.\n\nSilakan kirimkan file CV (PDF, DOCX, atau TXT) untuk mulai proses screening otomatis.');
});

// Command: /help
bot.help((ctx) => {
  ctx.reply('Cara penggunaan:\n1. Kirim file CV Anda (Format: PDF, DOCX, TXT).\n2. Tunggu proses parsing dan scoring oleh AI.\n3. Saya akan mengabari jika kandidat masuk kriteria shortlist!');
});

// Handle Documents (CV Upload)
bot.on('document', async (ctx) => {
  const doc = ctx.message.document;
  const fileName = doc.file_name;
  const extension = fileName.split('.').pop().toLowerCase();
  const fileSize = doc.file_size;

  console.log(`[TelegramBot] Menerima file: ${fileName} (${fileSize} bytes)`);

  // 1. Validasi Format & Ukuran
  const validation = validateFile({ extension, sizeBytes: fileSize });
  if (!validation.valid) {
    return ctx.reply(`❌ File ditolak: ${validation.errorCode === 'INVALID_FORMAT' ? 'Format tidak didukung (Gunakan PDF/DOCX/TXT)' : 'Ukuran file terlalu besar (Max 10MB)'}`);
  }

  try {
    await ctx.reply('⏳ Sedang menerima CV dan menyiapkan antrean...');

    // 2. Download file dari Telegram
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    const fileBuffer = Buffer.from(response.data);

    // 3. Enkripsi
    console.log(`[TelegramBot] Mengenkripsi file ${fileName}...`);
    const encryptedContent = encryptFile(fileBuffer);

    // 4. Push ke Redis Queue
    const jobId = `tg-${Date.now()}`;
    const job = {
      jobId,
      filename: fileName,
      mimeType: getMimeType(extension),
      source: 'telegram',
      positionId: 'software-engineer-backend', // Default position
      encryptedContent: encryptedContent,
      enqueuedAt: new Date().toISOString(),
      telegramChatId: ctx.chat.id // Simpan chat ID buat notifikasi balik
    };

    await redis.getClient().lpush(config.queue.cvProcessingKey, JSON.stringify(job));
    
    console.log(`[TelegramBot] Job ${jobId} berhasil di-push ke Redis.`);
    await ctx.reply(`✅ CV "${fileName}" berhasil masuk antrean!\n\nAI sedang menganalisis... Saya akan mengabari Anda setelah selesai.`);

  } catch (err) {
    console.error('[TelegramBot] Error:', err.message);
    ctx.reply('❌ Maaf, terjadi kesalahan saat memproses file Anda. Silakan coba lagi nanti.');
  }
});

/**
 * Helper: Mapping ekstensi ke MIME type
 */
function getMimeType(ext) {
  const map = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain'
  };
  return map[ext] || 'application/octet-stream';
}

// Global error handler
bot.catch((err, ctx) => {
  console.error(`[TelegramBot] Error for ${ctx.updateType}:`, err.message);
});

// Launch Bot
async function startBot() {
  console.log('[TelegramBot] Bot sedang berjalan...');
  await bot.launch();
}

if (require.main === module) {
  startBot().catch(err => {
    console.error('[TelegramBot] Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { bot, startBot };
