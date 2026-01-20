/**
 * Admin User Management API Tests
 * Tests for ADMIN-003: User Management feature
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Admin User Management API', () => {
  const API_BASE = 'http://localhost:8989';
  let adminToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // TODO: Setup test admin user and get token
    // For now, we'll mock these values
    adminToken = 'mock-admin-token';
    testUserId = 'mock-user-id';
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('GET /api/v1/admin/users', () => {
    it('should list users with pagination', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users?page=1&limit=10`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.users)).toBe(true);
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
    });

    it('should filter users by search query', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users?search=test@example.com`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.users)).toBe(true);
    });

    it('should return 401 without admin token', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users`);
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users`, {
        headers: {
          'Authorization': 'Bearer non-admin-token',
        },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/users/:id', () => {
    it('should get user details', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users/${testUserId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('display_name');
      expect(data).toHaveProperty('credit_balance');
      expect(data).toHaveProperty('account_status');
      expect(data).toHaveProperty('created_at');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users/00000000-0000-0000-0000-000000000000`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/admin/users/:id/credits', () => {
    it('should adjust user credits', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users/${testUserId}/credits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 50,
          note: 'Admin credit adjustment for testing',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('new_balance');
      expect(data).toHaveProperty('transaction_id');
    });

    it('should reject invalid credit amounts', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users/${testUserId}/credits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 'invalid',
          note: 'Test',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should require a note for adjustments', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users/${testUserId}/credits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 10,
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/admin/users/:id/status', () => {
    it('should update account status to suspended', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users/${testUserId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'suspended',
          reason: 'Terms of service violation',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('account_status', 'suspended');
    });

    it('should update account status to active', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users/${testUserId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'active',
          reason: 'Reinstated after review',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.account_status).toBe('active');
    });

    it('should reject invalid status values', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users/${testUserId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'invalid_status',
          reason: 'Test',
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/admin/users/:id/activity', () => {
    it('should get user activity log', async () => {
      const response = await fetch(`${API_BASE}/api/v1/admin/users/${testUserId}/activity`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('jobs');
      expect(data).toHaveProperty('credit_transactions');
      expect(Array.isArray(data.jobs)).toBe(true);
      expect(Array.isArray(data.credit_transactions)).toBe(true);
    });
  });
});
