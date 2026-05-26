'use strict';

/**
 * Integration Test: Notification Delivery
 *
 * Mock channels and verify notification delivery, retry logic, and fallback.
 *
 * Requirements: 7.4, 8.1, 8.5
 */

const { sendNotification } = require('../../src/notification/notification-service');
const { getTemplate } = require('../../src/notification/templates');

// Mock config
jest.mock('../../src/config', () => ({
  notification: {
    maxRetries: 3,
    retryIntervalMs: 10, // Short for testing
    channels: {
      email: { enabled: false },
      slack: { enabled: true, webhookUrl: 'https://hooks.slack.com/test' },
      discord: { enabled: true, webhookUrl: 'https://discord.com/webhook/test' },
      telegram: { enabled: false },
    },
  },
}));

jest.mock('../../src/cv-intake/audit-logger', () => ({
  logIntakeEvent: jest.fn().mockResolvedValue(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Notification Delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('sendNotification', () => {
    it('mengirim SHORTLISTED notification via Slack', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('ok') });

      const result = await sendNotification({
        eventType: 'SHORTLISTED',
        candidateId: 'test-candidate-id',
        payload: {
          candidateName: 'John Doe',
          jobTitle: 'Software Engineer',
          score: 85,
          recommendation: 'Strong Fit',
          recordId: 'test-record-id',
        },
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('retry 3x saat Slack gagal', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('error') })
        .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('error') })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('ok') });

      const result = await sendNotification({
        eventType: 'SHORTLISTED',
        candidateId: 'test-id',
        payload: {
          candidateName: 'John Doe',
          jobTitle: 'Software Engineer',
          score: 85,
          recommendation: 'Strong Fit',
        },
      });

      // Retry succeeded on 3rd attempt
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('track failed channels saat semua retry gagal', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('error') });

      const result = await sendNotification({
        eventType: 'SHORTLISTED',
        candidateId: 'test-id',
        payload: {
          candidateName: 'Test',
          jobTitle: 'Test',
          score: 80,
          recommendation: 'Strong Fit',
        },
      });

      expect(result.allFailed).toBe(true);
      expect(result.failedChannels).toContain('slack');
      expect(result.success).toBe(false);
    });
  });

  describe('getTemplate', () => {
    it('templateShortlisted mencakup semua field wajib', () => {
      const template = getTemplate('SHORTLISTED', {
        candidateName: 'John Doe',
        jobTitle: 'Software Engineer',
        score: 85,
        recommendation: 'Strong Fit',
        recordId: 'record-123',
      });

      expect(template.subject).toContain('John Doe');
      expect(template.subject).toContain('Software Engineer');
      expect(template.body).toContain('85');
      expect(template.body).toContain('Strong Fit');
      expect(template.channels).toContain('slack');
    });

    it('templatePossibleDuplicate mencakup detail kedua record', () => {
      const template = getTemplate('POSSIBLE_DUPLICATE', {
        newRecord: { name: 'John', email: 'john@example.com', phone: '08123456789' },
        existingRecordId: 'existing-123',
      });

      expect(template.subject).toContain('Duplikat');
      expect(template.body).toContain('John');
      expect(template.body).toContain('existing-123');
    });

    it('null payload tidak crash getTemplate', () => {
      const template = getTemplate('SHORTLISTED', null);
      expect(template).toHaveProperty('subject');
      expect(template).toHaveProperty('body');
    });
  });
});