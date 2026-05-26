'use strict';

const { callOpenAI } = require('./openai-client');

/**
 * CV Parser — mengekstrak data terstruktur dari teks CV menggunakan OpenAI.
 * Mengimplementasikan normalisasi skill, pembersihan teks, validasi output,
 * dan penandaan PARSING_INCOMPLETE.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8
 */

/**
 * Peta normalisasi skill dari singkatan/alias ke nama standar.
 * Requirements: 2.5 — normalisasi nama skill ke format standar
 */
const SKILL_NORMALIZATION_MAP = {
  // JavaScript ecosystem
  'js': 'JavaScript',
  'javascript': 'JavaScript',
  'ts': 'TypeScript',
  'typescript': 'TypeScript',
  'node': 'Node.js',
  'nodejs': 'Node.js',
  'node.js': 'Node.js',
  'react': 'React',
  'reactjs': 'React',
  'react.js': 'React',
  'vue': 'Vue.js',
  'vuejs': 'Vue.js',
  'angular': 'Angular',
  'angularjs': 'Angular',
  'next': 'Next.js',
  'nextjs': 'Next.js',

  // Python ecosystem
  'py': 'Python',
  'python': 'Python',
  'django': 'Django',
  'flask': 'Flask',
  'fastapi': 'FastAPI',

  // AI/ML
  'ml': 'Machine Learning',
  'machine learning': 'Machine Learning',
  'dl': 'Deep Learning',
  'deep learning': 'Deep Learning',
  'ai': 'Artificial Intelligence',
  'artificial intelligence': 'Artificial Intelligence',
  'nlp': 'Natural Language Processing',
  'natural language processing': 'Natural Language Processing',
  'cv': 'Computer Vision',
  'computer vision': 'Computer Vision',
  'tf': 'TensorFlow',
  'tensorflow': 'TensorFlow',
  'pytorch': 'PyTorch',
  'sklearn': 'Scikit-learn',
  'scikit-learn': 'Scikit-learn',
  'scikit learn': 'Scikit-learn',

  // Database
  'sql': 'SQL',
  'mysql': 'MySQL',
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'mongo': 'MongoDB',
  'mongodb': 'MongoDB',
  'redis': 'Redis',
  'elastic': 'Elasticsearch',
  'elasticsearch': 'Elasticsearch',

  // Cloud & DevOps
  'aws': 'AWS',
  'amazon web services': 'AWS',
  'gcp': 'Google Cloud Platform',
  'google cloud': 'Google Cloud Platform',
  'azure': 'Microsoft Azure',
  'k8s': 'Kubernetes',
  'kubernetes': 'Kubernetes',
  'docker': 'Docker',
  'ci/cd': 'CI/CD',
  'cicd': 'CI/CD',
  'git': 'Git',
  'github': 'GitHub',
  'gitlab': 'GitLab',

  // Mobile
  'ios': 'iOS',
  'android': 'Android',
  'rn': 'React Native',
  'react native': 'React Native',
  'flutter': 'Flutter',

  // Other languages
  'java': 'Java',
  'c#': 'C#',
  'csharp': 'C#',
  'c++': 'C++',
  'cpp': 'C++',
  'go': 'Go',
  'golang': 'Go',
  'rust': 'Rust',
  'php': 'PHP',
  'ruby': 'Ruby',
  'swift': 'Swift',
  'kotlin': 'Kotlin',
  'scala': 'Scala',
  'r': 'R',

  // Data
  'bi': 'Business Intelligence',
  'business intelligence': 'Business Intelligence',
  'etl': 'ETL',
  'spark': 'Apache Spark',
  'apache spark': 'Apache Spark',
  'hadoop': 'Hadoop',
  'kafka': 'Apache Kafka',
  'apache kafka': 'Apache Kafka',
};

/**
 * Field wajib pada schema Candidate_Record.
 * Semua field ini harus ada di output (boleh null).
 * Requirements: 2.3 — output harus sesuai schema Candidate_Record
 */
const REQUIRED_FIELDS = [
  'name',
  'email',
  'phone',
  'skills',
  'experience_years',
  'education',
  'certifications',
  'languages',
  'experience_detail',
];

/**
 * Default values untuk field wajib jika tidak ada di output OpenAI.
 */
const FIELD_DEFAULTS = {
  name: null,
  email: null,
  phone: null,
  location: null,
  skills: [],
  experience_years: null,
  education: [],
  certifications: [],
  languages: [],
  experience_detail: [],
};

/**
 * System prompt untuk CV parsing.
 */
const CV_PARSING_SYSTEM_PROMPT = `Kamu adalah CV parser yang ahli. Ekstrak informasi terstruktur dari teks CV berikut.
Kembalikan HANYA JSON valid tanpa markdown code block.
Normalisasi nama skill ke format standar (contoh: "JS" → "JavaScript", "ML" → "Machine Learning").
Untuk field yang tidak ditemukan, gunakan null (bukan string kosong).`;

/**
 * Membuat user prompt untuk CV parsing.
 * @param {string} cvText - Teks CV yang akan di-parse
 * @returns {string} User prompt lengkap
 */
function buildCVParsingPrompt(cvText) {
  return `Ekstrak informasi dari CV berikut dan kembalikan dalam format JSON:

${cvText}

Format output yang diharapkan:
{
  "name": "string atau null",
  "email": "string atau null",
  "phone": "string atau null",
  "location": "string atau null",
  "skills": ["skill1", "skill2"],
  "experience_years": number atau null,
  "experience_detail": [
    {"company": "string", "title": "string", "duration_months": number, "industry": "string"}
  ],
  "education": [
    {"degree": "string", "institution": "string", "year": number atau null}
  ],
  "certifications": [
    {"name": "string", "issuer": "string", "year": number atau null}
  ],
  "languages": [
    {"language": "string", "proficiency": "Native|Fluent|Intermediate|Basic"}
  ]
}`;
}

/**
 * Membersihkan teks CV dari spasi berlebih dan karakter khusus tidak relevan.
 * Requirements: 2.5 — hapus duplikasi formatting sebelum menyimpan data
 *
 * @param {string} text - Teks yang akan dibersihkan
 * @returns {string} Teks yang sudah dibersihkan
 *
 * @example
 * cleanText("  Hello   World  \n\n\n  Test  ")
 * // => "Hello World\n\nTest"
 */
function cleanText(text) {
  if (typeof text !== 'string') {
    return '';
  }

  return text
    // Hapus karakter null dan control characters (kecuali newline dan tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Ganti multiple spasi/tab berturut-turut dengan satu spasi
    .replace(/[ \t]+/g, ' ')
    // Ganti lebih dari 2 newline berturut-turut dengan 2 newline
    .replace(/\n{3,}/g, '\n\n')
    // Hapus spasi di awal dan akhir setiap baris
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Trim keseluruhan teks
    .trim();
}

/**
 * Menormalisasi daftar skill ke nama standar.
 * Requirements: 2.5 — normalisasi nama skill (contoh: "JS" → "JavaScript")
 *
 * @param {string[]} skills - Array skill yang akan dinormalisasi
 * @returns {string[]} Array skill yang sudah dinormalisasi, tanpa duplikat
 *
 * @example
 * normalizeSkills(['JS', 'ML', 'Python', 'nodejs'])
 * // => ['JavaScript', 'Machine Learning', 'Python', 'Node.js']
 */
function normalizeSkills(skills) {
  if (!Array.isArray(skills)) {
    return [];
  }

  const normalized = skills
    .filter(skill => typeof skill === 'string' && skill.trim() !== '')
    .map(skill => {
      const trimmed = skill.trim();
      const lower = trimmed.toLowerCase();
      // Cari di normalization map (case-insensitive)
      return SKILL_NORMALIZATION_MAP[lower] || trimmed;
    });

  // Hapus duplikat (case-insensitive)
  const seen = new Set();
  return normalized.filter(skill => {
    if (typeof skill !== 'string') return false;
    const lower = skill.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

/**
 * Memvalidasi dan melengkapi output dari OpenAI agar semua field wajib ada.
 * Requirements: 2.3 — output harus sesuai schema Candidate_Record
 *
 * @param {Object} parsed - Object hasil parse JSON dari OpenAI
 * @returns {Object} Object dengan semua field wajib (boleh null)
 */
function validateAndFillFields(parsed) {
  const result = { ...FIELD_DEFAULTS };

  for (const field of REQUIRED_FIELDS) {
    if (field in parsed && parsed[field] !== undefined) {
      result[field] = parsed[field];
    }
    // Jika field tidak ada, tetap gunakan default (null atau [])
  }

  // Salin field opsional jika ada
  if ('location' in parsed) {
    result.location = parsed.location;
  }

  return result;
}

/**
 * Menentukan status parsing berdasarkan field name dan email.
 * Requirements: 2.4 — tandai PARSING_INCOMPLETE jika name atau email tidak berhasil diekstrak
 *
 * @param {Object} candidateData - Data kandidat hasil parsing
 * @returns {string} Status: 'PARSING_INCOMPLETE' atau 'PENDING'
 */
function determineParsingStatus(candidateData) {
  const nameIsMissing = !candidateData.name || candidateData.name === null;
  const emailIsMissing = !candidateData.email || candidateData.email === null;

  if (nameIsMissing || emailIsMissing) {
    return 'PARSING_INCOMPLETE';
  }

  return 'PENDING';
}

/**
 * Mem-parse teks CV menggunakan OpenAI dan mengembalikan data terstruktur.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8
 *
 * @param {string} cvText - Teks CV yang sudah diekstrak dari file
 * @returns {Promise<Object>} Candidate_Record dengan semua field wajib dan status parsing
 * @throws {Error} Jika OpenAI gagal setelah semua retry
 *
 * @example
 * const record = await parseCV("John Doe\njohn@example.com\nSkills: JS, ML...");
 * // => { name: 'John Doe', email: 'john@example.com', skills: ['JavaScript', 'Machine Learning'], ..., status: 'PENDING' }
 */
async function parseCV(cvText) {
  if (typeof cvText !== 'string') {
    throw new TypeError('parseCV: cvText harus berupa string');
  }

  // Bersihkan teks sebelum dikirim ke OpenAI
  const cleanedText = cleanText(cvText);

  if (!cleanedText) {
    // Teks kosong — kembalikan record kosong dengan PARSING_INCOMPLETE
    const emptyRecord = { ...FIELD_DEFAULTS, status: 'PARSING_INCOMPLETE' };
    return emptyRecord;
  }

  // Panggil OpenAI
  const rawResponse = await callOpenAI({
    systemPrompt: CV_PARSING_SYSTEM_PROMPT,
    userPrompt: buildCVParsingPrompt(cleanedText),
  });

  // Parse JSON response
  let parsed;
  try {
    // Bersihkan markdown code block jika ada (defensive)
    const jsonStr = rawResponse
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    throw new Error(`PARSING_FAILED: Response OpenAI bukan JSON valid: ${parseError.message}`);
  }

  // Validasi dan lengkapi semua field wajib
  const candidateData = validateAndFillFields(parsed);

  // Normalisasi skills
  candidateData.skills = normalizeSkills(candidateData.skills);

  // Tentukan status parsing
  const status = determineParsingStatus(candidateData);

  return {
    ...candidateData,
    status,
  };
}

module.exports = {
  parseCV,
  normalizeSkills,
  cleanText,
  validateAndFillFields,
  determineParsingStatus,
  buildCVParsingPrompt,
  REQUIRED_FIELDS,
  SKILL_NORMALIZATION_MAP,
};
