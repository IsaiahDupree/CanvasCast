import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

describe('FOUND-001: Monorepo Setup', () => {
  const rootDir = resolve(__dirname, '../..');

  it('should have pnpm-workspace.yaml with correct workspaces', () => {
    const workspaceFile = resolve(rootDir, 'pnpm-workspace.yaml');
    expect(existsSync(workspaceFile)).toBe(true);

    const content = readFileSync(workspaceFile, 'utf-8');
    expect(content).toContain('apps/*');
    expect(content).toContain('packages/*');
  });

  it('should have root package.json with workspace configuration', () => {
    const packageFile = resolve(rootDir, 'package.json');
    expect(existsSync(packageFile)).toBe(true);

    const packageJson = JSON.parse(readFileSync(packageFile, 'utf-8'));

    // Check workspace configuration
    expect(packageJson.workspaces).toEqual(['apps/*', 'packages/*']);

    // Check package manager
    expect(packageJson.packageManager).toMatch(/^pnpm@/);

    // Check required scripts exist
    expect(packageJson.scripts).toHaveProperty('dev');
    expect(packageJson.scripts).toHaveProperty('dev:api');
    expect(packageJson.scripts).toHaveProperty('dev:worker');
    expect(packageJson.scripts).toHaveProperty('build');
    expect(packageJson.scripts).toHaveProperty('test');
  });

  it('should have turbo.json for build orchestration', () => {
    const turboFile = resolve(rootDir, 'turbo.json');
    expect(existsSync(turboFile)).toBe(true);

    const turboConfig = JSON.parse(readFileSync(turboFile, 'utf-8'));

    // Check it has a pipeline configuration
    expect(turboConfig).toHaveProperty('$schema');
    expect(turboConfig).toHaveProperty('pipeline');

    // Check common tasks are defined
    expect(turboConfig.pipeline).toHaveProperty('build');
    expect(turboConfig.pipeline).toHaveProperty('dev');
    expect(turboConfig.pipeline).toHaveProperty('test');
  });

  it('should have all required workspace apps', () => {
    const apps = ['web', 'api', 'worker'];

    apps.forEach(app => {
      const appDir = resolve(rootDir, 'apps', app);
      expect(existsSync(appDir)).toBe(true);

      const packageFile = resolve(appDir, 'package.json');
      expect(existsSync(packageFile)).toBe(true);
    });
  });

  it('should have all required workspace packages', () => {
    const packages = ['shared', 'remotion'];

    packages.forEach(pkg => {
      const pkgDir = resolve(rootDir, 'packages', pkg);
      expect(existsSync(pkgDir)).toBe(true);

      const packageFile = resolve(pkgDir, 'package.json');
      expect(existsSync(packageFile)).toBe(true);
    });
  });

  it('should be able to run pnpm install successfully', () => {
    // This test verifies that pnpm can resolve all workspace dependencies
    // We check if node_modules exists which indicates successful install
    const nodeModules = resolve(rootDir, 'node_modules');
    expect(existsSync(nodeModules)).toBe(true);
  });

  it('should have turbo dev script that runs all apps', () => {
    const packageFile = resolve(rootDir, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageFile, 'utf-8'));

    // Should have a dev script that can run all apps
    // Using turbo or concurrently
    const hasDevAll =
      packageJson.scripts['dev:all'] !== undefined ||
      packageJson.scripts['turbo:dev'] !== undefined;

    expect(hasDevAll).toBe(true);
  });
});
