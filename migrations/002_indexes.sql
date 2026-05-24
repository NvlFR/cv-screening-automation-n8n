-- Migration 002: Indexes
-- CV Screening Automation - Index untuk query performance

-- ============================================================
-- Indexes untuk tabel: candidate_records
-- ============================================================

-- Index untuk pencarian berdasarkan email (duplicate detection)
CREATE INDEX IF NOT EXISTS idx_candidate_email
    ON candidate_records(email);

-- Index untuk pencarian berdasarkan job_id (filter per posisi)
CREATE INDEX IF NOT EXISTS idx_candidate_job_id
    ON candidate_records(job_id);

-- Index untuk filter berdasarkan status pipeline
CREATE INDEX IF NOT EXISTS idx_candidate_status
    ON candidate_records(status);

-- Index untuk sorting dan filter berdasarkan skor
CREATE INDEX IF NOT EXISTS idx_candidate_score
    ON candidate_records(score);

-- GIN index untuk pencarian skills (JSONB array containment)
CREATE INDEX IF NOT EXISTS idx_candidate_skills
    ON candidate_records USING GIN(skills);

-- Composite index untuk duplicate detection berdasarkan nama + telepon
CREATE INDEX IF NOT EXISTS idx_candidate_name_phone
    ON candidate_records(name, phone);

-- ============================================================
-- Indexes untuk tabel: audit_logs
-- ============================================================

-- Composite index untuk query audit berdasarkan entity
CREATE INDEX IF NOT EXISTS idx_audit_entity
    ON audit_logs(entity_type, entity_id);

-- Index untuk filter berdasarkan jenis aksi
CREATE INDEX IF NOT EXISTS idx_audit_action
    ON audit_logs(action);

-- Index untuk query berdasarkan waktu (time-range queries)
CREATE INDEX IF NOT EXISTS idx_audit_created
    ON audit_logs(created_at);
