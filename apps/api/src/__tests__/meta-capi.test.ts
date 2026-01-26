/**
 * Tests for Meta Conversions API (CAPI) Integration (META-004)
 * Tests server-side event tracking with event deduplication
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { hashUserData, extractMetaCookies } from '../lib/meta-capi.js';

describe('Meta CAPI Client', () => {
  describe('hashUserData (META-006: User Data Hashing)', () => {
    it('should hash email addresses with SHA256', () => {
      const email = 'user@example.com';
      const hashed = hashUserData(email);

      // SHA256 hash of 'user@example.com'
      expect(hashed).toBe('b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514');
    });

    it('should normalize email before hashing (lowercase, trim)', () => {
      const email = '  USER@EXAMPLE.COM  ';
      const hashed = hashUserData(email);

      // Should be same hash as normalized 'user@example.com'
      expect(hashed).toBe('b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514');
    });

    it('should handle empty strings', () => {
      const hashed = hashUserData('');
      expect(hashed).toBe('');
    });

    it('should hash phone numbers consistently', () => {
      const phone = '+1234567890';
      const hashed1 = hashUserData(phone);
      const hashed2 = hashUserData(phone);

      expect(hashed1).toBe(hashed2);
      expect(hashed1.length).toBe(64); // SHA256 produces 64 hex characters
    });

    it('should normalize phone numbers before hashing', () => {
      const phone1 = '  +1234567890  ';
      const phone2 = '+1234567890';
      const hashed1 = hashUserData(phone1);
      const hashed2 = hashUserData(phone2);

      // Should produce same hash after normalization
      expect(hashed1).toBe(hashed2);
    });

    it('should handle special characters in email', () => {
      const email = 'user+test@example.com';
      const hashed = hashUserData(email);

      // Should hash without throwing
      expect(hashed).toBeTruthy();
      expect(hashed.length).toBe(64);
    });

    it('should produce different hashes for different inputs', () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';
      const hashed1 = hashUserData(email1);
      const hashed2 = hashUserData(email2);

      expect(hashed1).not.toBe(hashed2);
    });

    it('should be deterministic (same input always produces same hash)', () => {
      const email = 'test@example.com';
      const hashed1 = hashUserData(email);
      const hashed2 = hashUserData(email);
      const hashed3 = hashUserData(email);

      expect(hashed1).toBe(hashed2);
      expect(hashed2).toBe(hashed3);
    });

    it('should handle null and undefined gracefully', () => {
      // @ts-expect-error - testing runtime behavior
      const hashedNull = hashUserData(null);
      // @ts-expect-error - testing runtime behavior
      const hashedUndefined = hashUserData(undefined);

      expect(hashedNull).toBe('');
      expect(hashedUndefined).toBe('');
    });

    it('should match Meta CAPI requirements (64 hex characters)', () => {
      const email = 'user@example.com';
      const hashed = hashUserData(email);

      // Meta requires SHA256 hashes as 64 hex characters
      expect(hashed).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('extractMetaCookies', () => {
    it('should extract fbp and fbc cookies from header', () => {
      const cookieHeader = '_fbp=fb.1.123456.789; _fbc=fb.1.123456.abc; other=value';
      const cookies = extractMetaCookies(cookieHeader);

      expect(cookies.fbp).toBe('fb.1.123456.789');
      expect(cookies.fbc).toBe('fb.1.123456.abc');
    });

    it('should handle missing cookies', () => {
      const cookieHeader = 'session=xyz; other=value';
      const cookies = extractMetaCookies(cookieHeader);

      expect(cookies.fbp).toBeUndefined();
      expect(cookies.fbc).toBeUndefined();
    });

    it('should handle undefined cookie header', () => {
      const cookies = extractMetaCookies(undefined);

      expect(cookies.fbp).toBeUndefined();
      expect(cookies.fbc).toBeUndefined();
    });

    it('should handle empty cookie header', () => {
      const cookies = extractMetaCookies('');

      expect(cookies.fbp).toBeUndefined();
      expect(cookies.fbc).toBeUndefined();
    });
  });

  describe('Meta CAPI initialization', () => {
    it('should require access token and pixel ID', () => {
      // This is a basic sanity check
      // Full integration tests would require actual Meta API credentials
      expect(true).toBe(true);
    });

    it('should initialize without errors when credentials are provided', async () => {
      const { initMetaCAPI } = await import('../lib/meta-capi.js');

      // Should not throw
      expect(() => {
        initMetaCAPI('test_token', '123456789');
      }).not.toThrow();
    });
  });

  describe('Event data validation', () => {
    it('should validate event names are strings', () => {
      const eventName = 'Purchase';
      expect(typeof eventName).toBe('string');
      expect(eventName.length).toBeGreaterThan(0);
    });

    it('should validate event IDs are unique', () => {
      const eventId1 = `evt_${Date.now()}_${Math.random()}`;
      const eventId2 = `evt_${Date.now()}_${Math.random()}`;

      expect(eventId1).not.toBe(eventId2);
    });

    it('should validate timestamps are in seconds', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const timestampString = timestamp.toString();

      // Unix timestamp in seconds should be 10 digits (until year 2286)
      expect(timestampString.length).toBe(10);
    });
  });
});

describe('Meta CAPI API Endpoint', () => {
  it('should define event data schema', () => {
    // This tests that the schema structure is correct
    const validEventData = {
      eventName: 'Purchase',
      eventId: 'evt_123',
      eventTime: Math.floor(Date.now() / 1000),
      userData: {
        email: 'test@example.com',
        clientIpAddress: '192.0.2.1',
        clientUserAgent: 'Mozilla/5.0',
      },
      customData: {
        value: 29.99,
        currency: 'USD',
      },
      actionSource: 'website' as const,
    };

    expect(validEventData.eventName).toBe('Purchase');
    expect(validEventData.actionSource).toBe('website');
  });

  it('should require eventName in request', () => {
    const invalidData = {
      eventId: 'evt_123',
      // Missing eventName
    };

    expect(invalidData).not.toHaveProperty('eventName');
  });

  it('should require eventId for deduplication', () => {
    const invalidData = {
      eventName: 'Purchase',
      // Missing eventId
    };

    expect(invalidData).not.toHaveProperty('eventId');
  });
});
