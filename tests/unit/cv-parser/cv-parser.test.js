'use strict';

/**
 * Unit tests untuk src/cv-parser/cv-parser.js
 * Memvalidasi parseCV, normalizeSkills, cleanText, validasi output, dan PARSING_INCOMPLETE.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8
 */

// Mock openai-client agar tidak memanggil API sungguhan
jest.mock('../../../src/cv-parser/openai-client', () => ({
  callOpenAI: jest.fn(),
}));

const {
  parseCV,
  normalizeSkills,
  cleanText,
  validateAndFillFields,
  determineParsingStatus,
  REQUIRED_FIELDS,
} = require('../../../src/cv-parser/cv-parser');

const { callOpenAI } = require('../../../src/cv-parser/openai-client');

describe('cv-parser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── cleanText ────────────────────────────────────────────────────────────

  describe('cleanText', () => {
    test('menghapus spasi berlebih di dalam baris', () => {
      expect(cleanText('Hello   World')).toBe('Hello World');
    });

    test('menghapus spasi di awal dan akhir', () => {
      expect(cleanText('  Hello World  ')).toBe('Hello World');
    });

    test('mengganti lebih dari 2 newline berturut-turut dengan 2 newline', () => {
      expect(cleanText('Line1\n\n\n\nLine2')).toBe('Line1\n\nLine2');
    });

    test('menghapus tab berlebih', () => {
      expect(cleanText('Hello\t\tWorld')).toBe('Hello World');
    });

    test('menghapus karakter control (kecuali newline)', () => {
      expect(cleanText('Hello\x00World\x07')).toBe('HelloWorld');
    });

    test('mengembalikan string kosong untuk input non-string', () => {
      expect(cleanText(null)).toBe('');
      expect(cleanText(undefined)).toBe('');
      expect(cleanText(123)).toBe('');
    });

    test('mengembalikan string kosong untuk input kosong', () => {
      expect(cleanText('')).toBe('');
    });

    test('mempertahankan newline tunggal', () => {
      expect(cleanText('Line1\nLine2')).toBe('Line1\nLine2');
    });

    test('mempertahankan dua newline berturut-turut', () => {
      expect(cleanText('Line1\n\nLine2')).toBe('Line1\n\nLine2');
    });

    test('membersihkan teks CV yang kompleks', () => {
      const input = '  Nama:   John Doe  \n\n\n\n  Email:  john@example.com  \n  Skills:  JS,  Python  ';
      const result = cleanText(input);
      expect(result).not.toContain('   '); // tidak ada 3+ spasi berturut-turut
      expect(result).not.toMatch(/\n{3,}/); // tidak ada 3+ newline berturut-turut
    });
  });

  // ─── normalizeSkills ──────────────────────────────────────────────────────

  describe('normalizeSkills', () => {
    test('menormalisasi "JS" menjadi "JavaScript"', () => {
      expect(normalizeSkills(['JS'])).toEqual(['JavaScript']);
    });

    test('menormalisasi "ML" menjadi "Machine Learning"', () => {
      expect(normalizeSkills(['ML'])).toEqual(['Machine Learning']);
    });

    test('menormalisasi "nodejs" menjadi "Node.js"', () => {
      expect(normalizeSkills(['nodejs'])).toEqual(['Node.js']);
    });

    test('menormalisasi "ts" menjadi "TypeScript"', () => {
      expect(normalizeSkills(['ts'])).toEqual(['TypeScript']);
    });

    test('menormalisasi "k8s" menjadi "Kubernetes"', () => {
      expect(normalizeSkills(['k8s'])).toEqual(['Kubernetes']);
    });

    test('menormalisasi "aws" menjadi "AWS"', () => {
      expect(normalizeSkills(['aws'])).toEqual(['AWS']);
    });

    test('case-insensitive: "JAVASCRIPT" tetap menjadi "JavaScript"', () => {
      expect(normalizeSkills(['JAVASCRIPT'])).toEqual(['JavaScript']);
    });

    test('mempertahankan skill yang tidak ada di map', () => {
      expect(normalizeSkills(['SomeUnknownSkill'])).toEqual(['SomeUnknownSkill']);
    });

    test('menghapus duplikat (case-insensitive)', () => {
      const result = normalizeSkills(['JS', 'JavaScript', 'javascript']);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('JavaScript');
    });

    test('menormalisasi array campuran', () => {
      const result = normalizeSkills(['JS', 'ML', 'Python', 'nodejs', 'Docker']);
      expect(result).toContain('JavaScript');
      expect(result).toContain('Machine Learning');
      expect(result).toContain('Python');
      expect(result).toContain('Node.js');
      expect(result).toContain('Docker');
    });

    test('mengembalikan array kosong untuk input non-array', () => {
      expect(normalizeSkills(null)).toEqual([]);
      expect(normalizeSkills(undefined)).toEqual([]);
      expect(normalizeSkills('string')).toEqual([]);
    });

    test('mengembalikan array kosong untuk array kosong', () => {
      expect(normalizeSkills([])).toEqual([]);
    });

    test('mengabaikan skill yang bukan string', () => {
      const result = normalizeSkills(['JS', null, 123, undefined, 'Python']);
      expect(result).toContain('JavaScript');
      expect(result).toContain('Python');
      expect(result).toHaveLength(2);
    });

    test('mengabaikan skill berupa string kosong', () => {
      const result = normalizeSkills(['JS', '', '  ', 'Python']);
      expect(result).toHaveLength(2);
    });
  });

  // ─── validateAndFillFields ────────────────────────────────────────────────

  describe('validateAndFillFields', () => {
    test('mengisi semua field wajib yang tidak ada dengan default', () => {
      const result = validateAndFillFields({});

      for (const field of REQUIRED_FIELDS) {
        expect(result).toHaveProperty(field);
      }
    });

    test('field array default adalah array kosong', () => {
      const result = validateAndFillFields({});
      expect(result.skills).toEqual([]);
      expect(result.education).toEqual([]);
      expect(result.certifications).toEqual([]);
      expect(result.languages).toEqual([]);
      expect(result.experience_detail).toEqual([]);
    });

    test('field scalar default adalah null', () => {
      const result = validateAndFillFields({});
      expect(result.name).toBeNull();
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
      expect(result.experience_years).toBeNull();
    });

    test('mempertahankan nilai yang ada dari parsed object', () => {
      const parsed = {
        name: 'John Doe',
        email: 'john@example.com',
        skills: ['JavaScript'],
        experience_years: 5,
      };

      const result = validateAndFillFields(parsed);
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.skills).toEqual(['JavaScript']);
      expect(result.experience_years).toBe(5);
    });

    test('mempertahankan nilai null yang eksplisit dari OpenAI', () => {
      const parsed = {
        name: 'John Doe',
        email: null,
        phone: null,
      };

      const result = validateAndFillFields(parsed);
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
    });

    test('menyertakan field location jika ada', () => {
      const parsed = { location: 'Jakarta, Indonesia' };
      const result = validateAndFillFields(parsed);
      expect(result.location).toBe('Jakarta, Indonesia');
    });
  });

  // ─── determineParsingStatus ───────────────────────────────────────────────

  describe('determineParsingStatus', () => {
    test('mengembalikan PARSING_INCOMPLETE jika name null', () => {
      expect(determineParsingStatus({ name: null, email: 'test@example.com' }))
        .toBe('PARSING_INCOMPLETE');
    });

    test('mengembalikan PARSING_INCOMPLETE jika email null', () => {
      expect(determineParsingStatus({ name: 'John Doe', email: null }))
        .toBe('PARSING_INCOMPLETE');
    });

    test('mengembalikan PARSING_INCOMPLETE jika keduanya null', () => {
      expect(determineParsingStatus({ name: null, email: null }))
        .toBe('PARSING_INCOMPLETE');
    });

    test('mengembalikan PENDING jika name dan email ada', () => {
      expect(determineParsingStatus({ name: 'John Doe', email: 'john@example.com' }))
        .toBe('PENDING');
    });

    test('mengembalikan PARSING_INCOMPLETE jika name string kosong', () => {
      expect(determineParsingStatus({ name: '', email: 'john@example.com' }))
        .toBe('PARSING_INCOMPLETE');
    });
  });

  // ─── parseCV ─────────────────────────────────────────────────────────────

  describe('parseCV', () => {
    const mockCVResponse = JSON.stringify({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+62812345678',
      location: 'Jakarta',
      skills: ['JavaScript', 'Python'],
      experience_years: 5,
      experience_detail: [
        { company: 'Tech Corp', title: 'Software Engineer', duration_months: 24, industry: 'Technology' }
      ],
      education: [
        { degree: 'S1', institution: 'Universitas Indonesia', year: 2018 }
      ],
      certifications: [
        { name: 'AWS Certified', issuer: 'Amazon', year: 2022 }
      ],
      languages: [
        { language: 'Indonesian', proficiency: 'Native' },
        { language: 'English', proficiency: 'Fluent' }
      ],
    });

    test('mengembalikan Candidate_Record dengan semua field wajib', async () => {
      callOpenAI.mockResolvedValue(mockCVResponse);

      const result = await parseCV('CV text here');

      for (const field of REQUIRED_FIELDS) {
        expect(result).toHaveProperty(field);
      }
    });

    test('mengembalikan status PENDING jika name dan email berhasil diekstrak', async () => {
      callOpenAI.mockResolvedValue(mockCVResponse);

      const result = await parseCV('CV text here');
      expect(result.status).toBe('PENDING');
    });

    test('mengembalikan status PARSING_INCOMPLETE jika name null', async () => {
      const responseWithoutName = JSON.stringify({
        name: null,
        email: 'john@example.com',
        phone: null,
        skills: [],
        experience_years: null,
        experience_detail: [],
        education: [],
        certifications: [],
        languages: [],
      });

      callOpenAI.mockResolvedValue(responseWithoutName);

      const result = await parseCV('CV text here');
      expect(result.status).toBe('PARSING_INCOMPLETE');
    });

    test('mengembalikan status PARSING_INCOMPLETE jika email null', async () => {
      const responseWithoutEmail = JSON.stringify({
        name: 'John Doe',
        email: null,
        phone: null,
        skills: [],
        experience_years: null,
        experience_detail: [],
        education: [],
        certifications: [],
        languages: [],
      });

      callOpenAI.mockResolvedValue(responseWithoutEmail);

      const result = await parseCV('CV text here');
      expect(result.status).toBe('PARSING_INCOMPLETE');
    });

    test('menormalisasi skills dari response OpenAI', async () => {
      const responseWithRawSkills = JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        skills: ['JS', 'ML', 'nodejs'],
        experience_years: 3,
        experience_detail: [],
        education: [],
        certifications: [],
        languages: [],
      });

      callOpenAI.mockResolvedValue(responseWithRawSkills);

      const result = await parseCV('CV text here');
      expect(result.skills).toContain('JavaScript');
      expect(result.skills).toContain('Machine Learning');
      expect(result.skills).toContain('Node.js');
    });

    test('menangani response OpenAI dengan markdown code block', async () => {
      const responseWithMarkdown = '```json\n' + mockCVResponse + '\n```';
      callOpenAI.mockResolvedValue(responseWithMarkdown);

      const result = await parseCV('CV text here');
      expect(result.name).toBe('John Doe');
    });

    test('melempar error jika response OpenAI bukan JSON valid', async () => {
      callOpenAI.mockResolvedValue('ini bukan JSON');

      await expect(parseCV('CV text here')).rejects.toThrow('PARSING_FAILED');
    });

    test('melempar TypeError jika cvText bukan string', async () => {
      await expect(parseCV(null)).rejects.toThrow(TypeError);
      await expect(parseCV(123)).rejects.toThrow(TypeError);
    });

    test('mengembalikan record kosong dengan PARSING_INCOMPLETE untuk teks kosong', async () => {
      const result = await parseCV('');
      expect(result.status).toBe('PARSING_INCOMPLETE');
      expect(result.name).toBeNull();
      expect(result.email).toBeNull();
      // OpenAI tidak dipanggil untuk teks kosong
      expect(callOpenAI).not.toHaveBeenCalled();
    });

    test('membersihkan teks sebelum mengirim ke OpenAI', async () => {
      callOpenAI.mockResolvedValue(mockCVResponse);

      await parseCV('  CV text   with   extra   spaces  ');

      // Verifikasi bahwa callOpenAI dipanggil dengan teks yang sudah dibersihkan
      expect(callOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          userPrompt: expect.stringContaining('CV text with extra spaces'),
        })
      );
    });

    test('meneruskan error dari OpenAI', async () => {
      callOpenAI.mockRejectedValue(new Error('OPENAI_ERROR: Semua retry gagal'));

      await expect(parseCV('CV text here')).rejects.toThrow('OPENAI_ERROR');
    });

    test('mengisi field yang tidak ada di response dengan default', async () => {
      const minimalResponse = JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        // field lain tidak ada
      });

      callOpenAI.mockResolvedValue(minimalResponse);

      const result = await parseCV('CV text here');
      expect(result.skills).toEqual([]);
      expect(result.education).toEqual([]);
      expect(result.certifications).toEqual([]);
      expect(result.languages).toEqual([]);
      expect(result.experience_detail).toEqual([]);
      expect(result.phone).toBeNull();
      expect(result.experience_years).toBeNull();
    });
  });
});
