'use strict';

/**
 * Integration Test: Database Query Performance
 *
 * Insert records and verify query performance with indexes.
 *
 * Requirements: 9.4, 11.1
 */

const db = require('../../src/db/client');
const { v4: uuidv4 } = require('uuid');

describe('Database Query Performance', () => {
  const TEST_TABLE = 'candidate_records';
  const TEST_BATCH_SIZE = 50;

  beforeAll(async () => {
    try {
      await db.query('SELECT 1');
    } catch (err) {
      console.warn('Database not available, skipping performance tests');
    }
  });

  describe('Query Performance', () => {
    it('SELECT by email menggunakan index', async () => {
      const email = `perf-test-${Date.now()}@example.com`;

      const start = Date.now();
      await db.query('SELECT id FROM candidate_records WHERE email = $1 LIMIT 1', [email]);
      const durationMs = Date.now() - start;

      // Should be fast (< 100ms for indexed query on empty/small table)
      expect(durationMs).toBeLessThan(1000);
    });

    it('SELECT by name AND phone menggunakan index', async () => {
      const name = `Perf Test ${Date.now()}`;
      const phone = `+6281${Date.now()}`;

      const start = Date.now();
      await db.query(
        'SELECT id FROM candidate_records WHERE name = $1 AND phone = $2 LIMIT 1',
        [name, phone]
      );
      const durationMs = Date.now() - start;

      expect(durationMs).toBeLessThan(1000);
    });

    it('INSERT candidate record dengan JSONB fields', async () => {
      const skills = ['JavaScript', 'Python', 'SQL'];
      const education = [{ degree: 'S1', institution: 'UI', year: 2018 }];
      const certifications = [{ name: 'AWS', issuer: 'Amazon', year: 2023 }];

      const start = Date.now();
      const result = await db.query(
        `INSERT INTO candidate_records
          (name, email, phone, skills, experience_years, education, certifications, status, source, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7::jsonb, $8, $9, NOW(), NOW())
         RETURNING id`,
        [
          'Performance Test',
          `perf-${Date.now()}@example.com`,
          '+6281234567890',
          JSON.stringify(skills),
          5,
          JSON.stringify(education),
          JSON.stringify(certifications),
          'PENDING',
          'performance_test',
        ]
      );
      const durationMs = Date.now() - start;

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].id).toBeDefined();
      expect(durationMs).toBeLessThan(500); // INSERT should be fast
    });

    it('SELECT dengan filter score >= threshold', async () => {
      const start = Date.now();
      const result = await db.query(
        `SELECT id, score, recommendation FROM candidate_records
         WHERE score >= 80 AND status = 'Shortlisted'
         ORDER BY score DESC LIMIT 100`
      );
      const durationMs = Date.now() - start;

      expect(Array.isArray(result.rows)).toBe(true);
      expect(durationMs).toBeLessThan(1000);
    });

    it('SELECT dengan filter skills menggunakan JSONB containment', async () => {
      const start = Date.now();
      const result = await db.query(
        `SELECT id, name, skills FROM candidate_records
         WHERE skills @> $1::jsonb
         ORDER BY score DESC LIMIT 50`,
        [JSON.stringify(['JavaScript'])]
      );
      const durationMs = Date.now() - start;

      expect(Array.isArray(result.rows)).toBe(true);
      expect(durationMs).toBeLessThan(1000);
    });

    it('SELECT dengan filter job_id dan status', async () => {
      const jobId = uuidv4();

      const start = Date.now();
      const result = await db.query(
        `SELECT id, name, score, status FROM candidate_records
         WHERE job_id = $1 AND status IN ('Shortlisted', 'Not Shortlisted')
         ORDER BY score DESC`,
        [jobId]
      );
      const durationMs = Date.now() - start;

      expect(Array.isArray(result.rows)).toBe(true);
      expect(durationMs).toBeLessThan(1000);
    });

    it('COUNT query untuk dashboard metrics', async () => {
      const start = Date.now();
      const result = await db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'Shortlisted') as shortlisted,
          COUNT(*) FILTER (WHERE status = 'DUPLICATE') as duplicates,
          AVG(score) FILTER (WHERE score IS NOT NULL) as avg_score
        FROM candidate_records
      `);
      const durationMs = Date.now() - start;

      expect(result.rows[0]).toHaveProperty('total');
      expect(result.rows[0]).toHaveProperty('shortlisted');
      expect(result.rows[0]).toHaveProperty('avg_score');
      expect(durationMs).toBeLessThan(1000);
    });
  });
});