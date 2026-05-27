'use strict';

const fs = require('fs');
const path = require('path');
const redis = require('../src/cache/redis-client');
const config = require('../src/config');
const { encryptFile } = require('../src/cv-intake/encryptor');

async function pushCV() {
  try {
    // Path ke CV
    const filePath = path.join(__dirname, '../cv/CV.Noval-Faturrahman-PT.pdf');
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ File tidak ditemukan di:', filePath);
      process.exit(1);
    }

    console.log('📄 Membaca file:', path.basename(filePath));
    const fileBuffer = fs.readFileSync(filePath);
    
    console.log('🔐 Mengenkripsi file...');
    const encryptedContent = encryptFile(fileBuffer);
    
    const jobId = 'noval-' + Date.now();
    const job = {
      jobId,
      filename: path.basename(filePath),
      mimeType: 'application/pdf',
      source: 'manual-script',
      positionId: 'software-engineer-backend',
      encryptedContent: encryptedContent,
      enqueuedAt: new Date().toISOString()
    };

    console.log('🚀 Mengirim ke Redis queue:', config.queue.cvProcessingKey);
    await redis.getClient().lpush(config.queue.cvProcessingKey, JSON.stringify(job));
    
    console.log('✅ BERHASIL! Job ID:', jobId);
    console.log('Cek terminal pipeline lu sekarang.');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    process.exit(1);
  }
}

pushCV();
