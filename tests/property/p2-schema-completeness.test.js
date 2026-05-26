'use strict';

/**
 * Property Test P2: Candidate Record Schema Completeness
 *
 * Property: output CV_Parser selalu memiliki SEMUA field wajib schema
 * Candidate_Record, meskipun nilainya null atau [].
 * Field yang selalu wajib ada:
 *   name, email, phone, skills, experience_years, education,
 *   certifications, languages, experience_detail
 *
 * Validates: Requirements 2.1, 2.3
 */

const fc = require('fast-check');
const {
  normalizeSkills,
  cleanText,
  validateAndFillFields,
  determineParsingStatus,
  REQUIRED_FIELDS,
} = require('../../src/cv-parser/cv-parser');

describe('P2: Candidate Record Schema Completeness', () => {
  /**
   * Validates: Requirements 2.3
   *
   * Property: validateAndFillFields SELALU mengembalikan semua REQUIRED_FIELDS.
   */
  it('validateAndFillFields selalu mengembalikan semua field wajib schema', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.oneof(
            fc.constant(null),
            fc.constant(42),
            fc.constant('text'),
            fc.array(fc.string()),
            fc.boolean(),
          )
        ),
        (partialRecord) => {
          const result = validateAndFillFields(partialRecord);

          // Semua REQUIRED_FIELDS harus ada di result
          return REQUIRED_FIELDS.every(field => field in result);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Validates: Requirements 2.3
   *
   * Property: validateAndFillFields dengan input kosong ({}) tetap mengembalikan
   * semua field dengan default values.
   */
  it('input kosong tetap menghasilkan semua field dengan default values', () => {
    const result = validateAndFillFields({});

    // Semua REQUIRED_FIELDS harus ada
    const hasAllFields = REQUIRED_FIELDS.every(field => field in result);
    expect(hasAllFields).toBe(true);

    // Field dengan default [] harus array
    const arrayFields = ['skills', 'education', 'certifications', 'languages', 'experience_detail'];
    for (const field of arrayFields) {
      expect(Array.isArray(result[field])).toBe(true);
      expect(result[field].length).toBe(0);
    }

    // Field null-able
    const nullFields = ['name', 'email', 'phone', 'experience_years'];
    for (const field of nullFields) {
      expect(result[field]).toBeNull();
    }
  });

  /**
   * Validates: Requirements 2.3
   *
   * Property: field yang ada di input harus propagasi ke output.
   */
  it('field yang valid di input propagasi ke output', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          email: fc.emailAddress(),
          phone: fc.string({ minLength: 5, maxLength: 20 }),
          skills: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
        }),
        (validInput) => {
          const result = validateAndFillFields(validInput);

          // Semua field yang ada di input harus sama persis di output
          return Object.keys(validInput).every(
            key => JSON.stringify(result[key]) === JSON.stringify(validInput[key])
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 2.5
   *
   * Property: normalizeSkills selalu mengembalikan array (tidak pernah string/null/undefined).
   */
  it('normalizeSkills selalu mengembalikan array', () => {
    fc.assert(
      fc.property(
        // Generate arrays of actual strings only (no prototype-shadowing names like "constructor")
        fc.array(
          fc.string({ minLength: 1, maxLength: 30 }),
          { maxLength: 50 }
        ),
        (skills) => {
          const result = normalizeSkills(skills);
          return Array.isArray(result);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 2.5
   *
   * Property: normalizeSkills menghapus string kosong dan whitespace-only.
   */
  it('normalizeSkills tidak pernah menghasilkan string kosong atau whitespace', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 0, maxLength: 50 }),
          { maxLength: 50 }
        ),
        (skills) => {
          const result = normalizeSkills(skills);
          return result.every(skill =>
            typeof skill === 'string' && skill.trim().length > 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 2.4
   *
   * Property: determineParsingStatus selalu mengembalikan 'PARSING_INCOMPLETE'
   * jika name atau email null, atau 'PENDING' jika keduanya ada.
   */
  it('determineParsingStatus mengembalikan PARSING_INCOMPLETE jika name/email null', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 50 })),
        fc.option(fc.string({ minLength: 1, maxLength: 50 })),
        (name, email) => {
          const data = { name, email, skills: [], experience_years: 0 };
          const status = determineParsingStatus(data);

          const nameMissing = !name || name === null;
          const emailMissing = !email || email === null;
          const shouldBeIncomplete = nameMissing || emailMissing;

          return status === (shouldBeIncomplete ? 'PARSING_INCOMPLETE' : 'PENDING');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 2.5
   *
   * Property: cleanText selalu mengembalikan string (tidak pernah null/undefined).
   */
  it('cleanText selalu mengembalikan string', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.constant(''),
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(42),
          fc.constant({}),
        ),
        (text) => {
          const result = cleanText(text);
          return typeof result === 'string';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 2.5
   *
   * Property: cleanText tidak pernah menghasilkan leading/trailing whitespace.
   */
  it('cleanText tidak pernah menghasilkan leading atau trailing whitespace', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (text) => {
          const result = cleanText(text);
          return result === result.trim();
        }
      ),
      { numRuns: 100 }
    );
  });
});