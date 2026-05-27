'use strict';

require('dotenv').config({ override: true });

/**
 * CV Processing Pipeline — mengintegrasikan semua komponen pemrosesan CV.
 *
 * Alur pipeline:
 *   Queue Consumer (BRPOP)
 *     → CV_Parser
 *     → Duplicate_Detector
 *       ├─ DUPLICATE       → simpan record, kirim notifikasi, selesai
 *       ├─ POSSIBLE_DUPLICATE → simpan record, kirim notifikasi review manual, selesai
 *       └─ NONE            → lanjut
 *     → JD_Matcher
 *       └─ NO_JD_AVAILABLE → simpan record dengan status NO_JD_AVAILABLE, selesai
 *     → Scoring_Engine
 *     → Summary_Generator
 *     → Shortlisting_Engine
 *       ├─ Shortlisted     → simpan record, kirim notifikasi recruiter
 *       └─ Not Shortlisted → simpan record
 *
 * Requirements: 2.4, 3.3, 3.4, 3.5, 4.5, 5.4, 6.4
 */

const redis = require('../cache/redis-client');
const db = require('../db/client');
const config = require('../config');

const { parseCV } = require('../cv-parser/cv-parser');
const { DuplicateDetector } = require('../duplicate-detector/detector');
const { sendNotification: sendNotificationService } = require('../notification/notification-service');
const { getActiveJD } = require('../jd-matcher/jd-fetcher');
const { matchCandidateToJD } = require('../jd-matcher/jd-matcher');
const { JDCache } = require('../jd-cache/redis-cache');
const { calculateScore } = require('../scoring-engine/calculator');
const { calculateEducationScore } = require('../scoring-engine/education-scorer');
const { calculateCertificationScore } = require('../scoring-engine/certification-scorer');
const { generateSummary } = require('../summary-generator/summary-generator');
const { evaluateShortlist } = require('../shortlisting-engine/evaluator');
const { logIntakeEvent } = require('../cv-intake/audit-logger');
const { decryptFile } = require('../cv-intake/encryptor');
const { extractText } = require('../cv-parser/text-extractor');

// ─── Konstanta ────────────────────────────────────────────────────────────────

const QUEUE_KEY = config.queue.cvProcessingKey;
const BRPOP_TIMEOUT = 30; // detik

// ─── Helper: Simpan Candidate_Record ke database ──────────────────────────────

/**
 * Menyimpan Candidate_Record baru ke tabel candidate_records.
 * Melakukan retry maksimal 3x jika gagal (Req 9.5).
 *
 * @param {Object} record - Data kandidat yang akan disimpan
 * @returns {Promise<string>} UUID record yang baru dibuat
 */
async function saveCandidateRecord(record) {
  const sql = `
    INSERT INTO candidate_records (
      name, email, phone, location,
      skills, experience_years, education, certifications,
      languages, experience_detail,
      score, dimension_scores, recommendation, summary,
      job_id, mandatory_skills_status, jd_match_details,
      shortlist_reason,
      cv_url, status, duplicate_of, source,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4,
      $5::jsonb, $6, $7::jsonb, $8::jsonb,
      $9::jsonb, $10::jsonb,
      $11, $12::jsonb, $13, $14,
      $15, $16::jsonb, $17::jsonb,
      $18,
      $19, $20, $21, $22,
      NOW(), NOW()
    )
    RETURNING id
  `;

  const params = [
    record.name || null,
    record.email || null,
    record.phone || null,
    record.location || null,
    JSON.stringify(record.skills || []),
    record.experience_years || null,
    JSON.stringify(record.education || []),
    JSON.stringify(record.certifications || []),
    JSON.stringify(record.languages || []),
    JSON.stringify(record.experience_detail || []),
    record.score !== undefined ? record.score : null,
    record.dimension_scores ? JSON.stringify(record.dimension_scores) : null,
    record.recommendation || null,
    record.summary || null,
    record.job_id || null,
    record.mandatory_skills_status ? JSON.stringify(record.mandatory_skills_status) : null,
    record.jd_match_details ? JSON.stringify(record.jd_match_details) : null,
    record.shortlist_reason || null,
    record.cv_url || null,
    record.status || 'PENDING',
    record.duplicate_of || null,
    record.source || null,
  ];

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await db.query(sql, params);
      return result.rows[0].id;
    } catch (err) {
      lastError = err;
      console.error(`[Pipeline] Gagal menyimpan record (attempt ${attempt}/3):`, err.message);
      if (attempt < 3) {
        await sleep(5000 * attempt); // 5s, 10s
      }
    }
  }

  throw lastError;
}

/**
 * Memperbarui status dan field tertentu pada Candidate_Record.
 *
 * @param {string} recordId - UUID record
 * @param {Object} updates - Field yang akan diperbarui
 * @returns {Promise<void>}
 */
async function updateCandidateRecord(recordId, updates) {
  const setClauses = [];
  const params = [];
  let paramIndex = 1;

  const fieldMap = {
    status: (v) => { setClauses.push(`status = $${paramIndex++}`); params.push(v); },
    score: (v) => { setClauses.push(`score = $${paramIndex++}`); params.push(v); },
    recommendation: (v) => { setClauses.push(`recommendation = $${paramIndex++}`); params.push(v); },
    summary: (v) => { setClauses.push(`summary = $${paramIndex++}`); params.push(v); },
    dimension_scores: (v) => { setClauses.push(`dimension_scores = $${paramIndex++}::jsonb`); params.push(JSON.stringify(v)); },
    mandatory_skills_status: (v) => { setClauses.push(`mandatory_skills_status = $${paramIndex++}::jsonb`); params.push(JSON.stringify(v)); },
    jd_match_details: (v) => { setClauses.push(`jd_match_details = $${paramIndex++}::jsonb`); params.push(JSON.stringify(v)); },
    shortlist_reason: (v) => { setClauses.push(`shortlist_reason = $${paramIndex++}`); params.push(v); },
  };

  for (const [key, value] of Object.entries(updates)) {
    if (fieldMap[key] && value !== undefined) {
      fieldMap[key](value);
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push(`updated_at = NOW()`);
  params.push(recordId);

  const sql = `UPDATE candidate_records SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;
  await db.query(sql, params);
}

// ─── Helper: Kirim notifikasi via Notification_Workflow ───────────────────────

/**
 * Mengirim notifikasi ke Notification_Workflow via HTTP POST ke webhook internal.
 * Notification_Workflow berjalan sebagai workflow n8n terpisah.
 *
 * @param {Object} params
 * @param {string} params.eventType - Tipe event: SHORTLISTED, POSSIBLE_DUPLICATE, PARSING_INCOMPLETE
 * @param {string} params.candidateId - UUID Candidate_Record
 * @param {Object} params.payload - Data notifikasi
 * @returns {Promise<void>}
 */
async function sendNotification({ eventType, candidateId, payload, telegramChatId }) {
  try {
    // Gunakan service notifikasi utama yang mendukung multi-channel
    const result = await sendNotificationService({
      eventType,
      candidateId,
      payload,
      // Jika job datang dari Telegram, prioritaskan notifikasi balik ke Telegram
      channels: telegramChatId ? ['telegram'] : undefined
    });

    if (result.success) {
      console.log(`[Pipeline] Notifikasi ${eventType} berhasil dikirim via ${result.results.map(r => r.channel).join(', ')}`);
    } else {
      console.warn(`[Pipeline] Notifikasi ${eventType} gagal: ${result.reason || 'unknown'}`);
    }
  } catch (err) {
    console.error(`[Pipeline] Gagal mengirim notifikasi ${eventType}:`, err.message);
  }
}

// ─── Helper: Utilitas ─────────────────────────────────────────────────────────

/**
 * Sleep helper untuk retry delay.
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Tahap Pipeline ───────────────────────────────────────────────────────────

/**
 * Tahap 1: Parse CV dari teks yang sudah diekstrak.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6 — CV_Parser mengintegrasikan semua sub-komponen
 *
 * Alur:
 * 1. Ekstrak teks dari file (jika cvText belum tersedia di job)
 * 2. Panggil parseCV() yang melakukan:
 *    - Normalisasi skill (SKILL_NORMALIZATION_MAP)
 *    - Validasi output schema (semua field wajib ada)
 *    - Tandai PARSING_INCOMPLETE jika name/email null
 *
 * @param {Object} job - CVQueueJob dari Redis
 * @returns {Promise<Object>} Candidate_Record hasil parsing
 */
async function stageParse(job) {
  console.log(`[Pipeline] [${job.jobId}] Tahap 1: Parsing CV...`);

  // cvText bisa langsung ada di job (dari queue producer yang sudah ekstrak)
  // atau perlu diambil dari encryptedContent yang dikirim via queue
  let cvText = job.cvText || job.rawText || '';

  // Jika cvText kosong tapi ada encryptedContent, dekripsi dan ekstrak teks
  if (!cvText && job.encryptedContent) {
    console.log(`[Pipeline] [${job.jobId}] Mendekripsi konten file dari queue...`);
    try {
      const decryptedBuffer = decryptFile(job.encryptedContent);
      console.log(`[Pipeline] [${job.jobId}] Ekstraksi teks dari PDF...`);
      cvText = await extractText(decryptedBuffer, job.mimeType || 'text/plain');
      console.log(`[Pipeline] [${job.jobId}] Teks berhasil diekstrak (${cvText.length} karakter)`);
    } catch (err) {
      console.error(`[Pipeline] [${job.jobId}] Gagal dekripsi/ekstrak teks:`, err.message);
      throw new Error(`FILE_PROCESSING_FAILED: ${err.message}`);
    }
  }

  // Jika masih kosong dan ada fileKey, ini untuk integrasi S3 di masa depan
  if (!cvText && job.fileKey) {
    console.log(`[Pipeline] [${job.jobId}] (S3 Fallback - Not Implemented) fileKey: ${job.fileKey}`);
  }

  console.log(`[Pipeline] [${job.jobId}] Memanggil AI untuk parsing...`);
  const candidateData = await parseCV(cvText);
  console.log(`[Pipeline] [${job.jobId}] AI berhasil mengembalikan data.`);

  return {
    ...candidateData,
    cv_url: job.fileKey || job.filename,
    source: job.source,
    job_id: job.positionId || null,
    _rawJob: job, // simpan referensi job asli untuk debugging
  };
}

/**
 * Tahap 2: Deteksi duplikat.
 *
 * @param {Object} candidateData - Data kandidat hasil parsing
 * @returns {Promise<Object>} Hasil pengecekan duplikat
 */
async function stageDuplicateCheck(candidateData) {
  console.log(`[Pipeline] Tahap 2: Pengecekan duplikat...`);

  const detector = new DuplicateDetector(db);
  const result = await detector.check({
    email: candidateData.email,
    name: candidateData.name,
    phone: candidateData.phone,
  });

  return result;
}

/**
 * Tahap 3: JD Matching.
 *
 * @param {Object} candidateData - Data kandidat
 * @param {string|null} jobId - ID posisi pekerjaan
 * @returns {Promise<Object>} Hasil matching atau { status: 'NO_JD_AVAILABLE' }
 */
async function stageJDMatch(candidateData, jobId) {
  console.log(`[Pipeline] Tahap 3: JD Matching (jobId: ${jobId})...`);

  if (!jobId) {
    return { status: 'NO_JD_AVAILABLE', reason: 'jobId tidak tersedia' };
  }

  // Cek cache Redis terlebih dahulu
  const jdCache = new JDCache(redis.getClient());
  let jd = await jdCache.get(jobId);

  if (!jd) {
    // Ambil dari database
    jd = await getActiveJD(jobId);

    if (jd.status === 'NO_JD_AVAILABLE') {
      return jd;
    }

    // Simpan ke cache
    await jdCache.set(jobId, jd);
  }

  // Lakukan matching
  const matchResult = await matchCandidateToJD(candidateData, jd);

  return {
    ...matchResult,
    jd,
  };
}

/**
 * Tahap 4: Scoring.
 *
 * @param {Object} candidateData - Data kandidat
 * @param {Object} matchResult - Hasil JD matching
 * @returns {Object} Hasil scoring: { score, recommendation, dimension_scores }
 */
function stageScore(candidateData, matchResult) {
  console.log(`[Pipeline] Tahap 4: Scoring...`);

  const educationScore = calculateEducationScore(candidateData.education || []);
  const certScore = calculateCertificationScore(
    candidateData.certifications || [],
    matchResult.jd ? matchResult.jd.mandatory_skills : []
  );

  const { score, recommendation } = calculateScore({
    skillMatch: matchResult.skill_match.score,
    experience: matchResult.experience_relevance.score,
    education: educationScore,
    industry: matchResult.industry_relevance.score,
    certification: certScore,
  });

  const dimensionScores = {
    skill_match: matchResult.skill_match.score,
    experience: matchResult.experience_relevance.score,
    education: educationScore,
    industry: matchResult.industry_relevance.score,
    certification: certScore,
  };

  return { score, recommendation, dimension_scores: dimensionScores };
}

/**
 * Tahap 5: Generate summary.
 *
 * @param {Object} candidateData - Data kandidat
 * @param {Object} matchResult - Hasil JD matching
 * @param {Object} scoringResult - Hasil scoring
 * @returns {Promise<string>} Teks summary atau 'GENERATION_FAILED'
 */
async function stageSummary(candidateData, matchResult, scoringResult) {
  console.log(`[Pipeline] Tahap 5: Generating summary...`);

  const jobTitle = matchResult.jd ? matchResult.jd.title : 'Posisi Tidak Diketahui';

  const { summary } = await generateSummary({
    candidateName: candidateData.name || 'Kandidat',
    jobTitle,
    score: scoringResult.score,
    recommendation: scoringResult.recommendation,
    candidateProfile: candidateData,
    jdMatchDetails: matchResult,
  });

  return summary;
}

/**
 * Tahap 6: Evaluasi shortlist.
 *
 * @param {Object} candidateData - Data kandidat
 * @param {Object} matchResult - Hasil JD matching
 * @param {Object} scoringResult - Hasil scoring
 * @returns {Object} { isShortlisted, reason }
 */
function stageShortlist(candidateData, matchResult, scoringResult) {
  console.log(`[Pipeline] Tahap 6: Evaluasi shortlist...`);

  const minExperienceYears = matchResult.jd ? (matchResult.jd.min_experience_years || 0) : 0;

  return evaluateShortlist({
    score: scoringResult.score,
    mandatorySkillsStatus: matchResult.mandatory_skills_status || {},
    experienceYears: candidateData.experience_years || 0,
    minExperienceYears,
  });
}

// ─── Pemrosesan satu CV job ───────────────────────────────────────────────────

/**
 * Memproses satu CV job dari queue secara end-to-end.
 *
 * @param {Object} job - CVQueueJob yang di-dequeue dari Redis
 * @returns {Promise<void>}
 */
async function processJob(job) {
  const jobId = job.jobId || 'unknown';
  console.log(`[Pipeline] Memulai pemrosesan job: ${jobId} (file: ${job.filename})`);

  // ── Tahap 1: Parse CV ──────────────────────────────────────────────────────
  let candidateData;
  try {
    candidateData = await stageParse(job);
  } catch (err) {
    console.error(`[Pipeline] [${jobId}] Parsing gagal:`, err.message);
    await logIntakeEvent({
      action: 'CV_PARSING_FAILED',
      errorCode: 'PARSING_FAILED',
      details: { jobId, filename: job.filename, error: err.message },
    });
    return;
  }

  // ── Tangani PARSING_INCOMPLETE ─────────────────────────────────────────────
  // Req 2.4: Jika name atau email tidak berhasil diekstrak, tandai PARSING_INCOMPLETE
  if (candidateData.status === 'PARSING_INCOMPLETE') {
    console.warn(`[Pipeline] [${jobId}] PARSING_INCOMPLETE — menyimpan record dan mengirim notifikasi`);

    let recordId;
    try {
      recordId = await saveCandidateRecord({
        ...candidateData,
        status: 'PARSING_INCOMPLETE',
      });
    } catch (err) {
      console.error(`[Pipeline] [${jobId}] Gagal menyimpan PARSING_INCOMPLETE record:`, err.message);
    }

    await sendNotification({
      eventType: 'PARSING_INCOMPLETE',
      candidateId: recordId || null,
      telegramChatId: job.telegramChatId,
      payload: {
        filename: job.filename,
        source: job.source,
        missingFields: [
          !candidateData.name ? 'name' : null,
          !candidateData.email ? 'email' : null,
        ].filter(Boolean),
      },
    });

    await logIntakeEvent({
      action: 'PARSING_INCOMPLETE',
      entityId: recordId || null,
      errorCode: 'PARSING_INCOMPLETE',
      details: { jobId, filename: job.filename },
    });

    return;
  }

  // ── Tahap 2: Deteksi Duplikat ──────────────────────────────────────────────
  let duplicateResult;
  try {
    duplicateResult = await stageDuplicateCheck(candidateData);
  } catch (err) {
    console.error(`[Pipeline] [${jobId}] Duplicate check gagal:`, err.message);
    // Lanjutkan pipeline dengan asumsi NONE jika pengecekan gagal
    duplicateResult = { status: 'NONE' };
  }

  // Req 3.3: Jika DUPLICATE — simpan record dan skip ke notifikasi
  if (duplicateResult.status === 'DUPLICATE') {
    console.log(`[Pipeline] [${jobId}] DUPLICATE terdeteksi (existing: ${duplicateResult.existingRecordId})`);

    let recordId;
    try {
      recordId = await saveCandidateRecord({
        ...candidateData,
        status: 'DUPLICATE',
        duplicate_of: duplicateResult.existingRecordId,
      });
    } catch (err) {
      console.error(`[Pipeline] [${jobId}] Gagal menyimpan DUPLICATE record:`, err.message);
    }

    await logIntakeEvent({
      action: 'DUPLICATE_DETECTED',
      entityId: recordId || null,
      details: { jobId, existingRecordId: duplicateResult.existingRecordId },
    });

    return;
  }

  // Req 3.4: Jika POSSIBLE_DUPLICATE — simpan record dan kirim notifikasi review manual
  if (duplicateResult.status === 'POSSIBLE_DUPLICATE') {
    console.log(`[Pipeline] [${jobId}] POSSIBLE_DUPLICATE terdeteksi (existing: ${duplicateResult.existingRecordId})`);

    let recordId;
    try {
      recordId = await saveCandidateRecord({
        ...candidateData,
        status: 'POSSIBLE_DUPLICATE',
        duplicate_of: duplicateResult.existingRecordId,
      });
    } catch (err) {
      console.error(`[Pipeline] [${jobId}] Gagal menyimpan POSSIBLE_DUPLICATE record:`, err.message);
    }

    await sendNotification({
      eventType: 'POSSIBLE_DUPLICATE',
      candidateId: recordId || null,
      telegramChatId: job.telegramChatId,
      payload: {
        newRecord: { name: candidateData.name, email: candidateData.email, phone: candidateData.phone },
        existingRecordId: duplicateResult.existingRecordId,
      },
    });

    await logIntakeEvent({
      action: 'POSSIBLE_DUPLICATE_DETECTED',
      entityId: recordId || null,
      details: { jobId, existingRecordId: duplicateResult.existingRecordId },
    });

    return;
  }

  // ── Tahap 3: JD Matching ───────────────────────────────────────────────────
  let matchResult;
  try {
    matchResult = await stageJDMatch(candidateData, candidateData.job_id);
  } catch (err) {
    console.error(`[Pipeline] [${jobId}] JD Matching gagal:`, err.message);
    matchResult = { status: 'NO_JD_AVAILABLE', reason: err.message };
  }

  // Req 4.5: Jika NO_JD_AVAILABLE — simpan record dengan status tersebut, skip scoring
  if (matchResult.status === 'NO_JD_AVAILABLE') {
    console.log(`[Pipeline] [${jobId}] NO_JD_AVAILABLE — menyimpan record tanpa scoring`);

    try {
      await saveCandidateRecord({
        ...candidateData,
        status: 'NO_JD_AVAILABLE',
      });
    } catch (err) {
      console.error(`[Pipeline] [${jobId}] Gagal menyimpan NO_JD_AVAILABLE record:`, err.message);
    }

    return;
  }

  // ── Tahap 4: Scoring ───────────────────────────────────────────────────────
  let scoringResult;
  try {
    scoringResult = stageScore(candidateData, matchResult);
  } catch (err) {
    console.error(`[Pipeline] [${jobId}] Scoring gagal:`, err.message);
    await logIntakeEvent({
      action: 'SCORING_FAILED',
      errorCode: err.message.startsWith('INVALID_DIMENSION_SCORE') ? 'INVALID_DIMENSION_SCORE' : 'SCORING_FAILED',
      details: { jobId, error: err.message },
    });

    // Simpan record tanpa skor
    try {
      await saveCandidateRecord({
        ...candidateData,
        status: 'SCORING',
        mandatory_skills_status: matchResult.mandatory_skills_status || {},
        jd_match_details: matchResult,
      });
    } catch (saveErr) {
      console.error(`[Pipeline] [${jobId}] Gagal menyimpan record setelah scoring error:`, saveErr.message);
    }

    return;
  }

  // ── Tahap 5: Summary Generation ───────────────────────────────────────────
  let summary;
  try {
    summary = await stageSummary(candidateData, matchResult, scoringResult);
  } catch (err) {
    // Req 6.4: Jika gagal, gunakan GENERATION_FAILED — jangan hentikan pipeline
    console.error(`[Pipeline] [${jobId}] Summary generation error:`, err.message);
    summary = 'GENERATION_FAILED';
  }

  // ── Tahap 6: Shortlisting ─────────────────────────────────────────────────
  const shortlistResult = stageShortlist(candidateData, matchResult, scoringResult);

  // ── Simpan record final ───────────────────────────────────────────────────
  const finalStatus = shortlistResult.isShortlisted ? 'Shortlisted' : 'Not Shortlisted';

  let recordId;
  try {
    recordId = await saveCandidateRecord({
      ...candidateData,
      score: scoringResult.score,
      recommendation: scoringResult.recommendation,
      dimension_scores: scoringResult.dimension_scores,
      summary,
      mandatory_skills_status: matchResult.mandatory_skills_status || {},
      jd_match_details: {
        skill_match: matchResult.skill_match,
        experience_relevance: matchResult.experience_relevance,
        industry_relevance: matchResult.industry_relevance,
        seniority_fit: matchResult.seniority_fit,
        keyword_overlap: matchResult.keyword_overlap,
      },
      shortlist_reason: shortlistResult.reason,
      status: finalStatus,
    });
  } catch (err) {
    console.error(`[Pipeline] [${jobId}] Gagal menyimpan record final:`, err.message);
    return;
  }

  // Catat ke audit log
  await logIntakeEvent({
    action: shortlistResult.isShortlisted ? 'CANDIDATE_SHORTLISTED' : 'CANDIDATE_NOT_SHORTLISTED',
    entityId: recordId,
    details: {
      jobId,
      score: scoringResult.score,
      recommendation: scoringResult.recommendation,
      reason: shortlistResult.reason,
    },
  });

  // Req 7.4: Kirim notifikasi jika Shortlisted (dalam < 30 detik)
  if (shortlistResult.isShortlisted) {
    const jobTitle = matchResult.jd ? matchResult.jd.title : 'Posisi Tidak Diketahui';

    await sendNotification({
      eventType: 'SHORTLISTED',
      candidateId: recordId,
      telegramChatId: job.telegramChatId,
      payload: {
        candidateName: candidateData.name,
        jobTitle,
        score: scoringResult.score,
        recommendation: scoringResult.recommendation,
        recordId,
        reason: shortlistResult.reason,
      },
    });
  } else if (job.telegramChatId) {
    // Jika dari Telegram tapi tidak shortlisted, kasih tau juga biar nggak nunggu
    await sendNotification({
      eventType: 'CANDIDATE_NOT_SHORTLISTED',
      candidateId: recordId,
      telegramChatId: job.telegramChatId,
      payload: {
        candidateName: candidateData.name,
        score: scoringResult.score,
        recommendation: scoringResult.recommendation
      },
    });
  }

  console.log(`[Pipeline] [${jobId}] Selesai — status: ${finalStatus}, skor: ${scoringResult.score}`);
}

// ─── Queue Consumer Loop ──────────────────────────────────────────────────────

/**
 * Menjalankan consumer loop yang terus-menerus mengambil job dari Redis queue.
 * Menggunakan BRPOP dengan timeout 30 detik (blocking pop).
 *
 * Loop berjalan sampai `running` di-set ke false atau terjadi error fatal.
 *
 * @returns {Promise<void>}
 */
async function startConsumer() {
  console.log(`[Pipeline] Consumer dimulai. Mendengarkan queue: ${QUEUE_KEY}`);

  let running = true;

  // Graceful shutdown handler
  const shutdown = () => {
    console.log('[Pipeline] Menerima sinyal shutdown, menghentikan consumer...');
    running = false;
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  while (running) {
    try {
      // BRPOP dengan timeout 30 detik — blocking pop dari kanan (FIFO dengan LPUSH)
      const result = await redis.brpop(QUEUE_KEY, BRPOP_TIMEOUT);

      if (!result) {
        // Timeout — tidak ada item dalam queue, lanjutkan loop
        continue;
      }

      // result = [key, value]
      const [, rawJob] = result;

      let job;
      try {
        job = JSON.parse(rawJob);
      } catch (parseErr) {
        console.error('[Pipeline] Gagal parse job dari queue:', parseErr.message, '| Raw:', rawJob);
        continue;
      }

      // Proses job secara async — error ditangani di dalam processJob
      await processJob(job);

    } catch (err) {
      // Error koneksi Redis atau error tak terduga
      console.error('[Pipeline] Error di consumer loop:', err.message);

      if (!running) break;

      // Tunggu sebentar sebelum retry untuk menghindari tight loop
      await sleep(5000);
    }
  }

  console.log('[Pipeline] Consumer dihentikan.');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  processJob,
  startConsumer,
  saveCandidateRecord,
  updateCandidateRecord,
  sendNotification,
  // Ekspor tahap-tahap untuk testing
  stageParse,
  stageDuplicateCheck,
  stageJDMatch,
  stageScore,
  stageSummary,
  stageShortlist,
};

// ─── Entry point jika dijalankan langsung ─────────────────────────────────────
if (require.main === module) {
  startConsumer().catch(err => {
    console.error('[Pipeline] Fatal error:', err);
    process.exit(1);
  });
}
