-- Migration 001: Initial Schema
-- CV Screening Automation - Tabel utama

-- Enable UUID extension jika belum ada
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Tabel: candidate_records
-- Menyimpan data kandidat hasil parsing CV dan scoring
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255),                    -- nullable, encrypted at rest
    phone           VARCHAR(50),                     -- nullable, encrypted at rest
    location        VARCHAR(255),
    skills          JSONB NOT NULL DEFAULT '[]',     -- array of skill strings
    experience_years INTEGER,
    education       JSONB DEFAULT '[]',              -- [{degree, institution, year}]
    certifications  JSONB DEFAULT '[]',              -- [{name, issuer, year}]
    languages       JSONB DEFAULT '[]',              -- [{language, proficiency}]
    experience_detail JSONB DEFAULT '[]',            -- [{company, title, duration_months, industry}]

    -- Scoring fields
    score           INTEGER CHECK (score >= 0 AND score <= 100),
    dimension_scores JSONB,                          -- {skill_match, experience, education, industry, certification}
    recommendation  VARCHAR(20) CHECK (recommendation IN ('Strong Fit', 'Moderate Fit', 'Weak Fit')),
    summary         TEXT,

    -- JD Matching fields
    job_id          VARCHAR(100),
    mandatory_skills_status JSONB DEFAULT '{}',      -- {skill_name: 'matched'|'missing'}
    jd_match_details JSONB,                          -- detail per dimensi

    -- Status & metadata
    cv_url          VARCHAR(500),                    -- S3 key (encrypted)
    status          VARCHAR(50) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN (
                        'PENDING', 'PARSING', 'PARSING_INCOMPLETE',
                        'DUPLICATE', 'POSSIBLE_DUPLICATE',
                        'SCORING', 'SCORED', 'NO_JD_AVAILABLE',
                        'Shortlisted', 'Not Shortlisted'
                    )),
    duplicate_of    UUID REFERENCES candidate_records(id),
    source          VARCHAR(50),                     -- gmail, webhook, google_drive, google_form

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Tabel: job_descriptions
-- Menyimpan Job Description yang aktif untuk matching
-- ============================================================
CREATE TABLE IF NOT EXISTS job_descriptions (
    id              VARCHAR(100) PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    department      VARCHAR(100),
    seniority_level VARCHAR(20) CHECK (seniority_level IN ('Junior', 'Mid', 'Senior', 'Lead')),
    mandatory_skills JSONB NOT NULL DEFAULT '[]',   -- array of skill strings
    preferred_skills JSONB DEFAULT '[]',
    min_experience_years INTEGER DEFAULT 0,
    industry        VARCHAR(100),
    keywords        JSONB DEFAULT '[]',
    raw_jd_text     TEXT,
    parsed_jd       JSONB,                          -- cached parsed JD structure
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Tabel: audit_logs
-- Mencatat semua aktivitas sistem untuk observabilitas dan compliance
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR(100),                   -- null untuk system actions
    action          VARCHAR(100) NOT NULL,          -- e.g. CV_RECEIVED, DUPLICATE_DETECTED, SHORTLISTED
    entity_type     VARCHAR(50),                    -- candidate_record, job_description, notification
    entity_id       UUID,
    details         JSONB,                          -- additional context
    error_code      VARCHAR(50),                    -- INVALID_FORMAT, FILE_TOO_LARGE, etc.
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Tabel: notifications
-- Mencatat semua notifikasi yang dikirim ke recruiter
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    UUID REFERENCES candidate_records(id),
    event_type      VARCHAR(50) NOT NULL,           -- SHORTLISTED, POSSIBLE_DUPLICATE, PARSING_INCOMPLETE
    channel         VARCHAR(20) NOT NULL,           -- email, slack, discord, telegram
    recipient       VARCHAR(255) NOT NULL,
    payload         JSONB NOT NULL,
    status          VARCHAR(20) DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'RETRY')),
    retry_count     INTEGER DEFAULT 0,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Trigger: auto-update updated_at pada candidate_records
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_candidate_records_updated_at
    BEFORE UPDATE ON candidate_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_descriptions_updated_at
    BEFORE UPDATE ON job_descriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
