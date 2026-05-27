'use strict';

/**
 * Script untuk mengisi tabel job_descriptions dengan data contoh.
 * Digunakan untuk testing pipeline matching dan scoring.
 */

const db = require('../src/db/client');

const SAMPLE_JDS = [
  {
    id: 'software-engineer-backend',
    title: 'Senior Backend Engineer (Node.js)',
    department: 'Engineering',
    seniority_level: 'Senior',
    mandatory_skills: ['Node.js', 'PostgreSQL', 'Redis', 'Unit Testing'],
    preferred_skills: ['Docker', 'Kubernetes', 'AWS', 'Microservices'],
    min_experience_years: 5,
    industry: 'Technology / Fintech',
    keywords: ['Backend', 'API', 'Scalability', 'Performance'],
    raw_jd_text: 'Membangun API yang scalable menggunakan Node.js dan PostgreSQL. Berpengalaman dengan Redis untuk caching.',
    is_active: true
  },
  {
    id: 'frontend-developer-react',
    title: 'Frontend Developer (React)',
    department: 'Engineering',
    seniority_level: 'Mid',
    mandatory_skills: ['React', 'JavaScript', 'CSS', 'HTML'],
    preferred_skills: ['TypeScript', 'Redux', 'Tailwind CSS'],
    min_experience_years: 3,
    industry: 'Technology',
    keywords: ['Frontend', 'UI/UX', 'Web'],
    raw_jd_text: 'Mengembangkan antarmuka pengguna yang responsif menggunakan React dan modern CSS frameworks.',
    is_active: true
  },
  {
    id: 'data-scientist',
    title: 'Data Scientist',
    department: 'Data',
    seniority_level: 'Mid',
    mandatory_skills: ['Python', 'SQL', 'Machine Learning', 'Statistics'],
    preferred_skills: ['PyTorch', 'TensorFlow', 'Spark'],
    min_experience_years: 3,
    industry: 'Analytics',
    keywords: ['Data Science', 'AI', 'Analytics'],
    raw_jd_text: 'Menganalisis data besar untuk memberikan insight bisnis dan membangun model machine learning.',
    is_active: true
  }
];

async function seedJobDescriptions() {
  console.log('[Seed] Memulai seeding job descriptions...');

  try {
    for (const jd of SAMPLE_JDS) {
      const sql = `
        INSERT INTO job_descriptions (
          id, title, department, seniority_level, 
          mandatory_skills, preferred_skills, min_experience_years, 
          industry, keywords, raw_jd_text, is_active
        ) VALUES (
          $1, $2, $3, $4, 
          $5::jsonb, $6::jsonb, $7, 
          $8, $9::jsonb, $10, $11
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          department = EXCLUDED.department,
          seniority_level = EXCLUDED.seniority_level,
          mandatory_skills = EXCLUDED.mandatory_skills,
          preferred_skills = EXCLUDED.preferred_skills,
          min_experience_years = EXCLUDED.min_experience_years,
          industry = EXCLUDED.industry,
          keywords = EXCLUDED.keywords,
          raw_jd_text = EXCLUDED.raw_jd_text,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      `;

      await db.query(sql, [
        jd.id, jd.title, jd.department, jd.seniority_level,
        JSON.stringify(jd.mandatory_skills), JSON.stringify(jd.preferred_skills),
        jd.min_experience_years, jd.industry, JSON.stringify(jd.keywords),
        jd.raw_jd_text, jd.is_active
      ]);

      console.log(`[Seed] Berhasil seed/update: ${jd.id}`);
    }

    console.log('[Seed] Seeding selesai!');
  } catch (err) {
    console.error('[Seed] ERROR:', err.message);
    process.exit(1);
  } finally {
    await db.closePool();
  }
}

if (require.main === module) {
  seedJobDescriptions();
}

module.exports = { seedJobDescriptions };
