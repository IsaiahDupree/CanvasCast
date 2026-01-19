import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Docker Configuration', () => {
  const rootDir = join(__dirname, '..');

  describe('Dockerfiles', () => {
    it('should have a Dockerfile for apps/web', () => {
      const dockerfilePath = join(rootDir, 'apps/web/Dockerfile');
      expect(existsSync(dockerfilePath)).toBe(true);

      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toContain('FROM node:');
      expect(content).toContain('WORKDIR');
      expect(content).toContain('COPY');
      expect(content).toContain('RUN pnpm install');
      expect(content).toContain('EXPOSE 3838');
      expect(content).toContain('CMD');
    });

    it('should have a Dockerfile for apps/api', () => {
      const dockerfilePath = join(rootDir, 'apps/api/Dockerfile');
      expect(existsSync(dockerfilePath)).toBe(true);

      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toContain('FROM node:');
      expect(content).toContain('WORKDIR');
      expect(content).toContain('COPY');
      expect(content).toContain('RUN pnpm install');
      expect(content).toContain('EXPOSE 8989');
      expect(content).toContain('CMD');
    });

    it('should have a Dockerfile for apps/worker', () => {
      const dockerfilePath = join(rootDir, 'apps/worker/Dockerfile');
      expect(existsSync(dockerfilePath)).toBe(true);

      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toContain('FROM node:');
      expect(content).toContain('WORKDIR');
      expect(content).toContain('COPY');
      expect(content).toContain('RUN pnpm install');
      expect(content).toContain('CMD');
    });
  });

  describe('docker-compose.yml', () => {
    it('should exist in the root directory', () => {
      const composePath = join(rootDir, 'docker-compose.yml');
      expect(existsSync(composePath)).toBe(true);
    });

    it('should define all required services', () => {
      const composePath = join(rootDir, 'docker-compose.yml');
      const content = readFileSync(composePath, 'utf-8');

      // Check for required services
      expect(content).toContain('services:');
      expect(content).toContain('web:');
      expect(content).toContain('api:');
      expect(content).toContain('worker:');
      expect(content).toContain('redis:');
      expect(content).toContain('postgres:');
    });

    it('should expose correct ports', () => {
      const composePath = join(rootDir, 'docker-compose.yml');
      const content = readFileSync(composePath, 'utf-8');

      // Check port mappings (allowing for environment variable substitution)
      expect(content).toMatch(/3838/); // web port
      expect(content).toMatch(/8989/); // api port
      expect(content).toMatch(/6379/); // redis port
      expect(content).toMatch(/5432/); // postgres port
    });

    it('should define volumes for persistent data', () => {
      const composePath = join(rootDir, 'docker-compose.yml');
      const content = readFileSync(composePath, 'utf-8');

      expect(content).toContain('volumes:');
    });

    it('should define networks', () => {
      const composePath = join(rootDir, 'docker-compose.yml');
      const content = readFileSync(composePath, 'utf-8');

      expect(content).toContain('networks:');
    });
  });

  describe('Dockerfile optimization', () => {
    it('web Dockerfile should use multi-stage build', () => {
      const dockerfilePath = join(rootDir, 'apps/web/Dockerfile');
      const content = readFileSync(dockerfilePath, 'utf-8');

      // Check for multi-stage build patterns
      expect(content).toMatch(/FROM .* AS .*/);
      expect(content.match(/FROM/g)?.length).toBeGreaterThan(1);
    });

    it('api Dockerfile should use multi-stage build', () => {
      const dockerfilePath = join(rootDir, 'apps/api/Dockerfile');
      const content = readFileSync(dockerfilePath, 'utf-8');

      // Check for multi-stage build patterns
      expect(content).toMatch(/FROM .* AS .*/);
    });

    it('worker Dockerfile should use multi-stage build', () => {
      const dockerfilePath = join(rootDir, 'apps/worker/Dockerfile');
      const content = readFileSync(dockerfilePath, 'utf-8');

      // Check for multi-stage build patterns
      expect(content).toMatch(/FROM .* AS .*/);
    });
  });
});
