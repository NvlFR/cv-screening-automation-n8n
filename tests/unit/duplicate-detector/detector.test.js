'use strict';

const { DuplicateDetector } = require('../../../src/duplicate-detector/detector');

/**
 * Unit tests untuk src/duplicate-detector/detector.js
 * Memverifikasi logika pengecekan duplikat kandidat berdasarkan email dan nama+telepon.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.6
 */

// ─── Helper: buat mock db client ─────────────────────────────────────────────

/**
 * Membuat mock database client dengan Jest mock functions.
 * @param {Object} [responses] - Map query substring ke rows yang dikembalikan
 * @returns {{ query: jest.Mock }} Mock db client
 */
function createMockDb(responses = {}) {
  const query = jest.fn(async (sql, params) => {
    // Cocokkan berdasarkan substring query
    for (const [key, rows] of Object.entries(responses)) {
      if (sql.includes(key)) {
        return { rows };
      }
    }
    return { rows: [] };
  });
  return { query };
}

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('DuplicateDetector - constructor', () => {
  it('harus berhasil dibuat dengan dbClient yang valid', () => {
    const db = createMockDb();
    expect(() => new DuplicateDetector(db)).not.toThrow();
  });

  it('harus melempar error jika dbClient tidak memiliki method query', () => {
    expect(() => new DuplicateDetector({})).toThrow('DuplicateDetector: dbClient harus memiliki method query()');
  });

  it('harus melempar error jika dbClient null', () => {
    expect(() => new DuplicateDetector(null)).toThrow();
  });

  it('harus melempar error jika dbClient undefined', () => {
    expect(() => new DuplicateDetector(undefined)).toThrow();
  });
});

// ─── check() — Email ditemukan (DUPLICATE) ────────────────────────────────────

describe('DuplicateDetector.check() - email ditemukan', () => {
  it('harus mengembalikan status DUPLICATE jika email ditemukan di database', async () => {
    const existingId = 'uuid-existing-001';
    const db = createMockDb({ 'email = $1': [{ id: existingId }] });
    const detector = new DuplicateDetector(db);

    const result = await detector.check({
      email: 'john@example.com',
      name: 'John Doe',
      phone: '08123456789',
    });

    expect(result.status).toBe('DUPLICATE');
    expect(result.existingRecordId).toBe(existingId);
  });

  it('harus menyertakan existingRecordId dari record yang ditemukan', async () => {
    const existingId = 'uuid-abc-123';
    const db = createMockDb({ 'email = $1': [{ id: existingId }] });
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: 'test@test.com' });

    expect(result.existingRecordId).toBe(existingId);
  });

  it('harus menggunakan parameterized query untuk pengecekan email', async () => {
    const db = createMockDb({ 'email = $1': [{ id: 'some-id' }] });
    const detector = new DuplicateDetector(db);

    await detector.check({ email: 'john@example.com' });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE email = $1'),
      ['john@example.com']
    );
  });

  it('harus menggunakan LIMIT 1 pada query email', async () => {
    const db = createMockDb({ 'email = $1': [{ id: 'some-id' }] });
    const detector = new DuplicateDetector(db);

    await detector.check({ email: 'john@example.com' });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 1'),
      expect.any(Array)
    );
  });

  it('harus TIDAK memanggil query nama+telepon jika email sudah ditemukan', async () => {
    const db = createMockDb({ 'email = $1': [{ id: 'some-id' }] });
    const detector = new DuplicateDetector(db);

    await detector.check({ email: 'john@example.com', name: 'John', phone: '08123' });

    // Hanya satu query yang dipanggil (email check)
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query).not.toHaveBeenCalledWith(
      expect.stringContaining('name = $1'),
      expect.any(Array)
    );
  });
});

// ─── check() — Nama+Telepon ditemukan (POSSIBLE_DUPLICATE) ───────────────────

describe('DuplicateDetector.check() - nama+telepon ditemukan', () => {
  it('harus mengembalikan status POSSIBLE_DUPLICATE jika nama+telepon ditemukan', async () => {
    const existingId = 'uuid-existing-002';
    // Email tidak ditemukan, nama+telepon ditemukan
    const db = createMockDb({ 'name = $1': [{ id: existingId }] });
    const detector = new DuplicateDetector(db);

    const result = await detector.check({
      email: 'newemail@example.com',
      name: 'John Doe',
      phone: '08123456789',
    });

    expect(result.status).toBe('POSSIBLE_DUPLICATE');
    expect(result.existingRecordId).toBe(existingId);
  });

  it('harus menggunakan parameterized query untuk pengecekan nama+telepon', async () => {
    const db = createMockDb({ 'name = $1': [{ id: 'some-id' }] });
    const detector = new DuplicateDetector(db);

    await detector.check({ email: null, name: 'John Doe', phone: '08123456789' });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE name = $1 AND phone = $2'),
      ['John Doe', '08123456789']
    );
  });

  it('harus menggunakan LIMIT 1 pada query nama+telepon', async () => {
    const db = createMockDb({ 'name = $1': [{ id: 'some-id' }] });
    const detector = new DuplicateDetector(db);

    await detector.check({ name: 'John Doe', phone: '08123456789' });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 1'),
      expect.any(Array)
    );
  });

  it('harus memeriksa nama+telepon jika email tidak tersedia (null)', async () => {
    const existingId = 'uuid-003';
    const db = createMockDb({ 'name = $1': [{ id: existingId }] });
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: null, name: 'Jane Doe', phone: '08987654321' });

    expect(result.status).toBe('POSSIBLE_DUPLICATE');
    expect(result.existingRecordId).toBe(existingId);
  });

  it('harus memeriksa nama+telepon jika email tidak tersedia (undefined)', async () => {
    const existingId = 'uuid-004';
    const db = createMockDb({ 'name = $1': [{ id: existingId }] });
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: undefined, name: 'Jane Doe', phone: '08987654321' });

    expect(result.status).toBe('POSSIBLE_DUPLICATE');
    expect(result.existingRecordId).toBe(existingId);
  });

  it('harus memeriksa nama+telepon jika email string kosong', async () => {
    const existingId = 'uuid-005';
    const db = createMockDb({ 'name = $1': [{ id: existingId }] });
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: '', name: 'Jane Doe', phone: '08987654321' });

    expect(result.status).toBe('POSSIBLE_DUPLICATE');
    expect(result.existingRecordId).toBe(existingId);
  });
});

// ─── check() — Tidak ada duplikat (NONE) ─────────────────────────────────────

describe('DuplicateDetector.check() - tidak ada duplikat', () => {
  it('harus mengembalikan status NONE jika tidak ada yang cocok', async () => {
    const db = createMockDb(); // semua query return rows kosong
    const detector = new DuplicateDetector(db);

    const result = await detector.check({
      email: 'new@example.com',
      name: 'New Person',
      phone: '08000000000',
    });

    expect(result.status).toBe('NONE');
    expect(result.existingRecordId).toBeUndefined();
  });

  it('harus mengembalikan NONE tanpa existingRecordId', async () => {
    const db = createMockDb();
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: 'nobody@example.com' });

    expect(result).toEqual({ status: 'NONE' });
  });

  it('harus mengembalikan NONE jika email tidak ditemukan dan nama+telepon tidak tersedia', async () => {
    const db = createMockDb();
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: 'nobody@example.com', name: null, phone: null });

    expect(result.status).toBe('NONE');
    // Hanya satu query (email check)
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});

// ─── check() — Edge cases: nama atau telepon null/undefined ──────────────────

describe('DuplicateDetector.check() - edge cases nama/telepon', () => {
  it('harus skip pengecekan nama+telepon jika nama null', async () => {
    const db = createMockDb();
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: null, name: null, phone: '08123456789' });

    expect(result.status).toBe('NONE');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('harus skip pengecekan nama+telepon jika telepon null', async () => {
    const db = createMockDb();
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: null, name: 'John Doe', phone: null });

    expect(result.status).toBe('NONE');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('harus skip pengecekan nama+telepon jika nama undefined', async () => {
    const db = createMockDb();
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: null, name: undefined, phone: '08123' });

    expect(result.status).toBe('NONE');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('harus skip pengecekan nama+telepon jika telepon undefined', async () => {
    const db = createMockDb();
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: null, name: 'John', phone: undefined });

    expect(result.status).toBe('NONE');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('harus skip pengecekan nama+telepon jika nama string kosong', async () => {
    const db = createMockDb();
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: null, name: '', phone: '08123456789' });

    expect(result.status).toBe('NONE');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('harus skip pengecekan nama+telepon jika telepon string kosong', async () => {
    const db = createMockDb();
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: null, name: 'John Doe', phone: '' });

    expect(result.status).toBe('NONE');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('harus mengembalikan NONE jika semua parameter null', async () => {
    const db = createMockDb();
    const detector = new DuplicateDetector(db);

    const result = await detector.check({ email: null, name: null, phone: null });

    expect(result.status).toBe('NONE');
    expect(db.query).not.toHaveBeenCalled();
  });
});

// ─── check() — Database error ─────────────────────────────────────────────────

describe('DuplicateDetector.check() - database error', () => {
  it('harus meneruskan error database ke caller saat pengecekan email', async () => {
    const db = { query: jest.fn().mockRejectedValue(new Error('Connection refused')) };
    const detector = new DuplicateDetector(db);

    await expect(
      detector.check({ email: 'test@example.com' })
    ).rejects.toThrow('Connection refused');
  });

  it('harus meneruskan error database ke caller saat pengecekan nama+telepon', async () => {
    const db = { query: jest.fn().mockRejectedValue(new Error('Query timeout')) };
    const detector = new DuplicateDetector(db);

    await expect(
      detector.check({ email: null, name: 'John Doe', phone: '08123456789' })
    ).rejects.toThrow('Query timeout');
  });

  it('harus meneruskan error database ke caller saat email tidak ditemukan lalu query nama+telepon gagal', async () => {
    let callCount = 0;
    const db = {
      query: jest.fn(async () => {
        callCount++;
        if (callCount === 1) return { rows: [] }; // email tidak ditemukan
        throw new Error('DB error on second query');
      }),
    };
    const detector = new DuplicateDetector(db);

    await expect(
      detector.check({ email: 'notfound@example.com', name: 'John Doe', phone: '08123456789' })
    ).rejects.toThrow('DB error on second query');
  });
});

// ─── check() — Verifikasi urutan pengecekan (Req 3.1, 3.2) ───────────────────

describe('DuplicateDetector.check() - urutan pengecekan', () => {
  it('harus memeriksa email sebelum nama+telepon', async () => {
    const callOrder = [];
    const db = {
      query: jest.fn(async (sql) => {
        if (sql.includes('email = $1')) callOrder.push('email');
        if (sql.includes('name = $1')) callOrder.push('name_phone');
        return { rows: [] };
      }),
    };
    const detector = new DuplicateDetector(db);

    await detector.check({ email: 'test@example.com', name: 'John', phone: '08123' });

    expect(callOrder[0]).toBe('email');
    expect(callOrder[1]).toBe('name_phone');
  });

  it('harus melakukan dua query jika email tidak ditemukan dan nama+telepon tersedia', async () => {
    const db = createMockDb(); // semua return kosong
    const detector = new DuplicateDetector(db);

    await detector.check({ email: 'notfound@example.com', name: 'John', phone: '08123' });

    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('harus melakukan satu query jika email ditemukan (short-circuit)', async () => {
    const db = createMockDb({ 'email = $1': [{ id: 'found-id' }] });
    const detector = new DuplicateDetector(db);

    await detector.check({ email: 'found@example.com', name: 'John', phone: '08123' });

    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('harus melakukan satu query jika hanya email tersedia dan tidak ditemukan', async () => {
    const db = createMockDb();
    const detector = new DuplicateDetector(db);

    await detector.check({ email: 'notfound@example.com' });

    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
