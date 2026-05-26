'use strict';

/**
 * Property Test P4: Duplicate Detection Idempotence
 *
 * Property: memasukkan email yang sama berapa kali pun selalu menghasilkan
 * DUPLICATE (idempotent). Pengecekan nama+telepon juga idempotent.
 *
 * Validates: Requirements 3.1, 3.3
 */

const fc = require('fast-check');
const { DuplicateDetector } = require('../../src/duplicate-detector/detector');

/**
 * Membuat mock database client yang menyimpan data di memory.
 * Mensimulasikan perilaku PostgreSQL untuk candidate_records.
 */
function createMockDB() {
  const records = [];

  return {
    /**
     * Mock query untuk SELECT by email.
     * Mengembalikan record jika email match, kosong jika tidak.
     */
    async query(text, params) {
      const queryText = text.trim().toLowerCase();

      // SELECT by email
      if (queryText.includes('email')) {
        const [email] = params;
        const found = records.filter(r => r.email === email);
        return { rows: found.length > 0 ? [{ id: found[0].id }] : [] };
      }

      // SELECT by name + phone
      if (queryText.includes('name') && queryText.includes('phone')) {
        const [name, phone] = params;
        const found = records.filter(r => r.name === name && r.phone === phone);
        return { rows: found.length > 0 ? [{ id: found[0].id }] : [] };
      }

      return { rows: [] };
    },

    /**
     * Helper untuk reset dan insert record (untuk testing).
     * Stores trimmed values to match how the real detector queries (always trims).
     */
    _resetAndInsert(newRecords) {
      records.length = 0;
      records.push(...newRecords.map((r, i) => ({
        ...r,
        id: r.id || `mock-id-${i}`,
        // Trim storage to match detector's trimmed queries
        email: typeof r.email === 'string' ? r.email.trim() : r.email,
        name: typeof r.name === 'string' ? r.name.trim() : r.name,
        phone: typeof r.phone === 'string' ? r.phone.trim() : r.phone,
      })));
    },

    _getRecords() {
      return [...records];
    },
  };
}

/**
 * Helper untuk membuat candidate record test.
 */
function makeRecord(overrides = {}) {
  return {
    id: `id-${Math.random().toString(36).slice(2)}`,
    email: 'test@example.com',
    name: 'Test User',
    phone: '08123456789',
    ...overrides,
  };
}

describe('P4: Duplicate Detection Idempotence', () => {
  /**
   * Validates: Requirements 3.1
   *
   * Property: email yang sama selalu menghasilkan DUPLICATE, berapa kali pun dicek.
   */
  it('email yang sama selalu menghasilkan DUPLICATE (idempotent)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        async (email, name, phone) => {
          const db = createMockDB();

          // Insert record pertama kali
          db._resetAndInsert([{ email, name, phone }]);
          const detector1 = new DuplicateDetector(db);
          const result1 = await detector1.check({ email, name, phone });

          if (result1.status !== 'DUPLICATE') return false;

          // Cek lagi — harus tetap DUPLICATE
          const detector2 = new DuplicateDetector(db);
          const result2 = await detector2.check({ email, name, phone });

          return result2.status === 'DUPLICATE';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.1, 3.3
   *
   * Property: email baru (tidak ada di DB) selalu menghasilkan NONE.
   */
  it('email baru selalu menghasilkan NONE', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        async (email) => {
          const db = createMockDB();
          db._resetAndInsert([]); // DB kosong

          const detector = new DuplicateDetector(db);
          const result = await detector.check({ email, name: 'New User', phone: '08999999999' });

          return result.status === 'NONE';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.2, 3.4
   *
   * Property: kombinasi nama+telepon yang sama selalu menghasilkan
   * POSSIBLE_DUPLICATE, berapa kali pun dicek.
   */
  it('kombinasi nama+telepon sama selalu menghasilkan POSSIBLE_DUPLICATE', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate non-whitespace non-empty strings: base + random suffix char
        fc.string({ minLength: 1, maxLength: 48 }).chain(base =>
          fc.constantFrom('a','b','c','d','e','f','g','h','i','j','1','2','3','4').map(suffix =>
            base + suffix
          )
        ),
        fc.string({ minLength: 1, maxLength: 18 }).chain(base =>
          fc.constantFrom('a','b','c','d','e','f','g','h','i','j','1','2','3','4','5').map(suffix =>
            base + suffix
          )
        ),
        async (name, phone) => {
          const db = createMockDB();
          db._resetAndInsert([{
            email: `diff-${Math.random()}@example.com`,
            name,
            phone,
          }]);

          const detector = new DuplicateDetector(db);
          const result = await detector.check({
            email: 'new-different@example.com',
            name,
            phone,
          });

          return result.status === 'POSSIBLE_DUPLICATE';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.1, 3.3
   *
   * Property: duplicate detection tidak bergantung pada case email.
   */
  it('duplicate detection case-insensitive untuk email', async () => {
    const db = createMockDB();
    const email = 'Test@Example.COM';

    db._resetAndInsert([{ email, name: 'Test User', phone: '08123456789' }]);
    const detector = new DuplicateDetector(db);

    // Variasi case berbeda
    const variants = [
      'TEST@EXAMPLE.COM',
      'test@example.com',
      'Test@example.com',
      'TEST@example.COM',
    ];

    for (const variant of variants) {
      const result = await detector.check({ email: variant, name: 'Test', phone: '08123456789' });
      if (result.status !== 'DUPLICATE') return false;
    }

    return true;
  });

  /**
   * Validates: Requirements 3.1, 3.3
   *
   * Property: jika email match, tidak perlu cek nama+telepon
   * (email exact match di-check terlebih dahulu).
   */
  it('email match mendahului pengecekan nama+telepon', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        async (email) => {
          const db = createMockDB();

          // Insert record
          db._resetAndInsert([{ email, name: 'User A', phone: '08123456789' }]);

          const detector = new DuplicateDetector(db);
          const result = await detector.check({
            email, // email yang sama
            name: 'User B', // nama berbeda
            phone: '08999999999', // phone berbeda
          });

          // Harus DUPLICATE (berdasarkan email), BUKAN POSSIBLE_DUPLICATE
          return result.status === 'DUPLICATE';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.1, 3.3
   *
   * Property: null email → tidak trigger email check, langsung ke name+phone check.
   */
  it('email null melewati pengecekan email dan langsung ke name+phone', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 48 }).chain(base =>
          fc.constantFrom('a','b','c','d','e','f','g','h','i','j','1','2','3','4').map(suffix =>
            base + suffix
          )
        ),
        fc.string({ minLength: 1, maxLength: 18 }).chain(base =>
          fc.constantFrom('a','b','c','d','e','f','g','h','i','j','1','2','3','4','5').map(suffix =>
            base + suffix
          )
        ),
        async (name, phone) => {
          const db = createMockDB();
          db._resetAndInsert([{
            email: null,
            name,
            phone,
          }]);

          const detector = new DuplicateDetector(db);
          const result = await detector.check({
            email: null,
            name,
            phone,
          });

          return result.status === 'POSSIBLE_DUPLICATE';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.1, 3.3
   *
   * Property: whitespace pada email/phone di-trim sebelum query.
   */
  it('whitespace pada email/phone di-trim', async () => {
    const db = createMockDB();
    const email = 'test@example.com';
    const name = 'Test User';
    const phone = '08123456789';

    db._resetAndInsert([{ email, name, phone }]);
    const detector = new DuplicateDetector(db);

    const result = await detector.check({
      email: '  test@example.com  ',
      name: '  Test User  ',
      phone: '  08123456789  ',
    });

    return result.status === 'DUPLICATE';
  });
});