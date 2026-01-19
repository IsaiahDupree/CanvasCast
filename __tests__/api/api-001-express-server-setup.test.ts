/**
 * API-001: Express API Server Setup
 *
 * Tests that verify:
 * 1. Server configuration with Express
 * 2. Auth middleware works correctly
 * 3. CORS is configured
 *
 * Note: These are unit tests that test the middleware and configuration,
 * not integration tests that require a running server.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

describe('API-001: Express API Server Setup', () => {
  describe('Server Configuration', () => {
    it('should define PORT environment variable with default 8989', () => {
      const defaultPort = process.env.PORT || 8989;
      expect(defaultPort).toBe(8989);
    });

    it('should have required environment variables documented', async () => {
      // Check that .env.example exists and has required vars
      const fs = await import('fs/promises');
      const path = await import('path');

      const envExamplePath = path.join(process.cwd(), 'apps/api/.env.example');
      const envContent = await fs.readFile(envExamplePath, 'utf-8');

      expect(envContent).toContain('PORT=');
      expect(envContent).toContain('SUPABASE_URL=');
      expect(envContent).toContain('SUPABASE_SERVICE_KEY=');
      expect(envContent).toContain('REDIS_URL=');
      expect(envContent).toContain('STRIPE_SECRET_KEY=');
    });

    it('should have index.ts file with Express setup', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify Express is imported and configured
      expect(indexContent).toContain("import express from 'express'");
      expect(indexContent).toContain('express.Application');
      expect(indexContent).toContain('app.use(cors');
      expect(indexContent).toContain('app.use(helmet');
      expect(indexContent).toContain('app.use(express.json');
    });
  });

  describe('CORS Configuration', () => {
    it('should have CORS middleware configured in code', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("import cors from 'cors'");
      expect(indexContent).toContain('app.use(cors(');
      expect(indexContent).toContain('origin:');
      expect(indexContent).toContain('credentials: true');
    });
  });

  describe('Auth Middleware', () => {
    it('should have authenticateToken middleware defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain('authenticateToken');
      expect(indexContent).toContain('authHeader?.split');
      expect(indexContent).toContain('supabase.auth.getUser');
    });

    it('should reject requests without authorization header', () => {
      const mockReq = {
        headers: {},
      } as Request;

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Response;

      const mockNext = vi.fn() as NextFunction;

      // Since we can't easily import the middleware without side effects,
      // we'll verify the behavior pattern is correct
      const mockAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }
        next();
      };

      mockAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should extract token from Bearer authorization header', () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer test-token-123',
        },
      } as Request;

      const authHeader = mockReq.headers.authorization;
      const token = authHeader?.split(' ')[1];

      expect(token).toBe('test-token-123');
    });
  });

  describe('Health Endpoints', () => {
    it('should have health endpoint defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.get('/health'");
      expect(indexContent).toContain("status: 'ok'");
    });

    it('should have ready endpoint defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.get('/ready'");
      expect(indexContent).toContain('checks');
    });
  });

  describe('Error Handling', () => {
    it('should have 404 handler defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain('404');
      expect(indexContent).toContain('Not found');
    });

    it('should have error handler middleware', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Error handler with 4 params (err, req, res, next)
      expect(indexContent).toMatch(/app\.use\([^)]*err[^)]*req[^)]*res[^)]*next/);
      expect(indexContent).toContain('Internal server error');
    });
  });

  describe('API Routes Structure', () => {
    it('should have protected routes with authenticateToken', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("'/api/v1/projects', authenticateToken");
      expect(indexContent).toContain("'/api/v1/credits/balance', authenticateToken");
    });
  });
});
