-- Migration 003: Add Shortlist Reason
-- Menambahkan kolom shortlist_reason ke tabel candidate_records

ALTER TABLE candidate_records ADD COLUMN IF NOT EXISTS shortlist_reason TEXT;
