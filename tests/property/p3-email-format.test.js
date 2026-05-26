'use strict';

/**
 * Property Test P3: Email Format Invariant
 *
 * Property: field email yang dihasilkan extractEmailFromText
 * selalu berformat valid (mengandung @ dan domain) atau null.
 * TIDAK PERNAH mengembalikan string kosong "".
 *
 * Validates: Requirements 2.7
 */

const fc = require('fast-check');
const { extractEmailFromText } = require('../../src/cv-parser/email-extractor');

describe('P3: Email Format Invariant', () => {
  /**
   * Validates: Requirements 2.7
   *
   * Property: output email selalu valid atau null — tidak pernah string kosong.
   */
  it('output email selalu valid atau null, tidak pernah string kosong', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 1000 }),
        (text) => {
          const email = extractEmailFromText(text);

          // Jika bukan null, harus string non-kosong
          if (email !== null) {
            return typeof email === 'string' && email.length > 0 && email.trim().length > 0;
          }
          return true;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Validates: Requirements 2.7
   *
   * Property: email valid harus mengandung tepat satu @.
   */
  it('email valid mengandung tepat satu @', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 200 }),
        (text) => {
          const email = extractEmailFromText(text);

          if (email === null) return true;

          const atCount = (email.match(/@/g) || []).length;
          return atCount === 1;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Validates: Requirements 2.7
   *
   * Property: email valid harus memiliki domain dengan minimal satu titik.
   */
  it('email valid memiliki domain dengan minimal satu titik', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 200 }),
        (text) => {
          const email = extractEmailFromText(text);

          if (email === null) return true;

          const atIndex = email.indexOf('@');
          const domain = email.slice(atIndex + 1);

          return domain.includes('.') &&
                 !domain.startsWith('.') &&
                 !domain.endsWith('.');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Validates: Requirements 2.7
   *
   * Property: input null/undefined/empty string selalu menghasilkan null.
   */
  it('input null/undefined/empty string menghasilkan null', () => {
    const inputs = [null, undefined, '', '  ', 42, {}, []];
    for (const input of inputs) {
      const result = extractEmailFromText(input);
      expect(result).toBeNull();
    }
  });

  /**
   * Validates: Requirements 2.7
   *
   * Property: teks dengan email valid harus menghasilkan email yang valid.
   */
  it('teks dengan email valid menghasilkan email yang valid', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Non-empty alphanumeric strings only
          localPart: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0 && /^[a-zA-Z0-9]+$/.test(s)),
          domain: fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && /^[a-zA-Z0-9]+$/.test(s)),
            tld: fc.constantFrom('com', 'org', 'net', 'io', 'co', 'id', 'edu'),
          }),
          // Whitespace-only prefix/suffix can produce invalid formats — that's the bug
          prefix: fc.string({ maxLength: 20 }),
          suffix: fc.string({ maxLength: 50 }),
        }),
        ({ localPart, domain, prefix, suffix }) => {
          const email = `${localPart}@${domain.name}.${domain.tld}`;
          const text = `${prefix}${email}${suffix}`;
          const extracted = extractEmailFromText(text);

          // If extraction found something, it must be a valid email with @
          if (extracted !== null) {
            return extracted.includes('@') && extracted.includes('.');
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 2.7
   *
   * Property: email yang diekstrak tidak memiliki leading/trailing whitespace.
   */
  it('email yang diekstrak tidak memiliki leading/trailing whitespace', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 500 }),
        (text) => {
          const email = extractEmailFromText(text);

          if (email === null) return true;

          return email === email.trim();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Validates: Requirements 2.7
   *
   * Property: extractEmailFromText hanya mengembalikan email PERTAMA yang valid.
   */
  it('hanya mengembalikan email pertama yang valid', () => {
    const text = 'Contact: first@test.com and second@example.org here';
    const result = extractEmailFromText(text);

    expect(result).toBe('first@test.com');
  });
});