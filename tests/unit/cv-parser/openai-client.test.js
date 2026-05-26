'use strict';

/**
 * Unit tests untuk src/cv-parser/openai-client.js
 * Memvalidasi retry logic dan exponential backoff.
 * Requirements: 2.2 — OpenAI API dengan retry 3x, exponential backoff
 */

// Mock openai module sebelum require
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

// Mock config
jest.mock('../../../src/config', () => ({
  openai: {
    apiKey: 'test-api-key',
    model: 'gpt-4o-mini',
    maxRetries: 3,
    retryDelays: [100, 200, 400], // Gunakan delay kecil untuk testing
    timeoutMs: 60000,
  },
}));

const { callOpenAI, sleep } = require('../../../src/cv-parser/openai-client');
const { OpenAI } = require('openai');

describe('openai-client', () => {
  let mockCreate;

  beforeEach(() => {
    jest.clearAllMocks();
    // Ambil mock create dari instance OpenAI
    const mockInstance = { chat: { completions: { create: jest.fn() } } };
    OpenAI.mockImplementation(() => mockInstance);
    mockCreate = mockInstance.chat.completions.create;
  });

  // ─── sleep helper ─────────────────────────────────────────────────────────

  describe('sleep', () => {
    test('menunggu selama durasi yang ditentukan', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40); // toleransi 10ms
    });
  });

  // ─── callOpenAI: sukses ───────────────────────────────────────────────────

  describe('callOpenAI — sukses', () => {
    test('mengembalikan content dari response OpenAI', async () => {
      const mockResponse = {
        choices: [{ message: { content: '{"name": "John Doe"}' } }],
      };

      const mockInstance = { chat: { completions: { create: jest.fn().mockResolvedValue(mockResponse) } } };
      OpenAI.mockImplementation(() => mockInstance);

      const result = await callOpenAI({
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt',
      });

      expect(result).toBe('{"name": "John Doe"}');
    });

    test('menggunakan model default dari config jika tidak dispesifikasi', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'response' } }],
      };

      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      const mockInstance = { chat: { completions: { create: mockCreate } } };
      OpenAI.mockImplementation(() => mockInstance);

      await callOpenAI({
        systemPrompt: 'System',
        userPrompt: 'User',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o-mini' })
      );
    });

    test('menggunakan model yang dispesifikasi jika ada', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'response' } }],
      };

      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      const mockInstance = { chat: { completions: { create: mockCreate } } };
      OpenAI.mockImplementation(() => mockInstance);

      await callOpenAI({
        systemPrompt: 'System',
        userPrompt: 'User',
        model: 'gpt-4o',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o' })
      );
    });

    test('mengirim system dan user message dengan benar', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'response' } }],
      };

      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      const mockInstance = { chat: { completions: { create: mockCreate } } };
      OpenAI.mockImplementation(() => mockInstance);

      await callOpenAI({
        systemPrompt: 'Kamu adalah CV parser',
        userPrompt: 'Ekstrak dari CV ini',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'Kamu adalah CV parser' },
            { role: 'user', content: 'Ekstrak dari CV ini' },
          ],
        })
      );
    });
  });

  // ─── callOpenAI: retry logic ──────────────────────────────────────────────

  describe('callOpenAI — retry logic', () => {
    test('retry setelah error dan berhasil pada attempt ke-2', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'berhasil' } }],
      };

      const mockCreate = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse);

      const mockInstance = { chat: { completions: { create: mockCreate } } };
      OpenAI.mockImplementation(() => mockInstance);

      const result = await callOpenAI({
        systemPrompt: 'System',
        userPrompt: 'User',
      });

      expect(result).toBe('berhasil');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    test('retry setelah error dan berhasil pada attempt ke-3', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'berhasil di attempt 3' } }],
      };

      const mockCreate = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce(mockResponse);

      const mockInstance = { chat: { completions: { create: mockCreate } } };
      OpenAI.mockImplementation(() => mockInstance);

      const result = await callOpenAI({
        systemPrompt: 'System',
        userPrompt: 'User',
      });

      expect(result).toBe('berhasil di attempt 3');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    test('melempar OPENAI_ERROR setelah semua 3 retry gagal', async () => {
      const mockCreate = jest.fn()
        .mockRejectedValue(new Error('Persistent error'));

      const mockInstance = { chat: { completions: { create: mockCreate } } };
      OpenAI.mockImplementation(() => mockInstance);

      await expect(callOpenAI({
        systemPrompt: 'System',
        userPrompt: 'User',
      })).rejects.toThrow('OPENAI_ERROR');

      // 1 attempt awal + 3 retry = 4 total calls
      expect(mockCreate).toHaveBeenCalledTimes(4);
    });

    test('error message mencakup pesan error terakhir', async () => {
      const mockCreate = jest.fn()
        .mockRejectedValue(new Error('Rate limit exceeded'));

      const mockInstance = { chat: { completions: { create: mockCreate } } };
      OpenAI.mockImplementation(() => mockInstance);

      await expect(callOpenAI({
        systemPrompt: 'System',
        userPrompt: 'User',
      })).rejects.toThrow('Rate limit exceeded');
    });
  });

  // ─── callOpenAI: validasi input ───────────────────────────────────────────

  describe('callOpenAI — validasi', () => {
    test('melempar error jika OPENAI_API_KEY tidak dikonfigurasi', async () => {
      // Override config untuk test ini
      jest.resetModules();
      jest.mock('../../../src/config', () => ({
        openai: {
          apiKey: '', // kosong
          model: 'gpt-4o-mini',
          maxRetries: 3,
          retryDelays: [100, 200, 400],
          timeoutMs: 60000,
        },
      }));

      const { callOpenAI: callOpenAIFresh } = require('../../../src/cv-parser/openai-client');

      await expect(callOpenAIFresh({
        systemPrompt: 'System',
        userPrompt: 'User',
      })).rejects.toThrow('OPENAI_API_KEY tidak dikonfigurasi');
    });

    test('melempar error jika response choices kosong', async () => {
      const mockResponse = { choices: [] };

      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      const mockInstance = { chat: { completions: { create: mockCreate } } };
      OpenAI.mockImplementation(() => mockInstance);

      // Setelah semua retry gagal karena response kosong
      await expect(callOpenAI({
        systemPrompt: 'System',
        userPrompt: 'User',
      })).rejects.toThrow('OPENAI_ERROR');
    });
  });
});
