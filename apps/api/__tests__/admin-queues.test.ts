/**
 * Admin Queue Health API Tests
 * ADMIN-004: Queue Health Dashboard
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Admin Queue Health API', () => {
  const API_URL = process.env.TEST_API_URL || 'http://localhost:8989';
  let adminToken: string;

  beforeAll(async () => {
    // TODO: Get admin auth token for tests
    // For now, we'll skip authentication in tests
    adminToken = 'test-admin-token';
  });

  describe('GET /api/v1/admin/queues/stats', () => {
    it('should return queue statistics', async () => {
      const response = await fetch(`${API_URL}/api/v1/admin/queues/stats`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();

      // Verify response structure
      expect(data).toHaveProperty('queues');
      expect(Array.isArray(data.queues)).toBe(true);

      // Each queue should have these properties
      if (data.queues.length > 0) {
        const queue = data.queues[0];
        expect(queue).toHaveProperty('name');
        expect(queue).toHaveProperty('waiting');
        expect(queue).toHaveProperty('active');
        expect(queue).toHaveProperty('completed');
        expect(queue).toHaveProperty('failed');
        expect(queue).toHaveProperty('delayed');
        expect(queue).toHaveProperty('isPaused');
      }
    });

    it('should identify stuck jobs (active for >30min)', async () => {
      const response = await fetch(`${API_URL}/api/v1/admin/queues/stats`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();

      // Should have stuck jobs array
      expect(data).toHaveProperty('stuckJobs');
      expect(Array.isArray(data.stuckJobs)).toBe(true);

      // Stuck jobs should have required fields
      if (data.stuckJobs.length > 0) {
        const stuckJob = data.stuckJobs[0];
        expect(stuckJob).toHaveProperty('id');
        expect(stuckJob).toHaveProperty('name');
        expect(stuckJob).toHaveProperty('timestamp');
        expect(stuckJob).toHaveProperty('duration');
      }
    });

    it('should return worker status', async () => {
      const response = await fetch(`${API_URL}/api/v1/admin/queues/stats`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data).toHaveProperty('workers');
      expect(data.workers).toHaveProperty('active');
      expect(typeof data.workers.active).toBe('number');
    });

    it('should require admin authentication', async () => {
      const response = await fetch(`${API_URL}/api/v1/admin/queues/stats`);

      expect(response.status).toBe(401);
    });

    it('should reject non-admin users', async () => {
      const response = await fetch(`${API_URL}/api/v1/admin/queues/stats`, {
        headers: {
          Authorization: 'Bearer non-admin-token',
        },
      });

      // Should be either 401 or 403
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('POST /api/v1/admin/queues/:queueName/retry/:jobId', () => {
    it('should retry a failed job', async () => {
      const queueName = 'video-generation';
      const jobId = 'test-job-123';

      const response = await fetch(
        `${API_URL}/api/v1/admin/queues/${queueName}/retry/${jobId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      // Should succeed or return 404 if job doesn't exist
      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data.success).toBe(true);
      }
    });

    it('should require admin authentication', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/admin/queues/video-generation/retry/job-123`,
        {
          method: 'POST',
        }
      );

      expect(response.status).toBe(401);
    });
  });
});
