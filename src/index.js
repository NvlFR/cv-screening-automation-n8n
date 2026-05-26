'use strict';

/**
 * CV Screening Automation — Entry Point
 * 
 * Memulai consumer loop untuk memproses CV dari antrian Redis.
 */

const { startConsumer } = require('./cv-processing/pipeline');

console.log('--- CV Screening Automation ---');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Waktu Mulai:', new Date().toISOString());

// Jalankan pipeline consumer
startConsumer().catch(err => {
  console.error('[Fatal Error] Aplikasi berhenti karena error:', err.message);
  console.error(err.stack);
  process.exit(1);
});

// Graceful shutdown handling (sudah ditangani di dalam pipeline.js, 
// tapi kita tambahkan log di sini untuk konfirmasi)
process.on('SIGTERM', () => {
  console.log('Menerima SIGTERM. Menutup aplikasi...');
});

process.on('SIGINT', () => {
  console.log('Menerima SIGINT. Menutup aplikasi...');
});
