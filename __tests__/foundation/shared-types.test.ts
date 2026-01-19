import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('FOUND-002: Shared Types Package', () => {
  const rootDir = resolve(__dirname, '../..');
  const sharedDir = resolve(rootDir, 'packages/shared');

  it('should have shared package with correct structure', () => {
    expect(existsSync(sharedDir)).toBe(true);

    const packageFile = resolve(sharedDir, 'package.json');
    expect(existsSync(packageFile)).toBe(true);

    const packageJson = JSON.parse(readFileSync(packageFile, 'utf-8'));
    expect(packageJson.name).toBe('@canvascast/shared');
    expect(packageJson.main).toBeDefined();
    expect(packageJson.types).toBeDefined();
  });

  it('should export core types from index', () => {
    const indexFile = resolve(sharedDir, 'src/index.ts');
    expect(existsSync(indexFile)).toBe(true);

    const content = readFileSync(indexFile, 'utf-8');
    // Should export all core modules
    expect(content).toMatch(/export.*from.*types/);
  });

  it('should have types.ts with core type definitions', () => {
    const typesFile = resolve(sharedDir, 'src/types.ts');
    expect(existsSync(typesFile)).toBe(true);

    const content = readFileSync(typesFile, 'utf-8');

    // Check for core type exports
    expect(content).toContain('JobStatus');
    expect(content).toContain('ProjectStatus');
    expect(content).toContain('AssetType');

    // Check for core interfaces
    expect(content).toContain('interface Project');
    expect(content).toContain('interface Job');
    expect(content).toContain('interface Asset');
  });

  it('should be importable from other packages', async () => {
    // Try to import the package
    const { JOB_STATUSES, NICHE_PRESETS, PRICING_TIERS } = await import('@canvascast/shared');

    // Constants should be available at runtime
    // TypeScript types/interfaces won't exist at runtime, but the import should work
    expect(JOB_STATUSES).toBeDefined();
    expect(NICHE_PRESETS).toBeDefined();
    expect(PRICING_TIERS).toBeDefined();
    expect(Array.isArray(JOB_STATUSES)).toBe(true);
    expect(JOB_STATUSES.length).toBeGreaterThan(0);
  });

  it('should have all required database types', () => {
    const typesFile = resolve(sharedDir, 'src/types.ts');
    const content = readFileSync(typesFile, 'utf-8');

    // Required database-related types
    const requiredTypes = [
      'ProjectStatus',
      'JobStatus',
      'AssetType',
      'LedgerType',
      'Project',
      'Job',
      'Asset',
      'CreditLedgerEntry',
    ];

    requiredTypes.forEach(type => {
      expect(content).toContain(type);
    });
  });

  it('should have niche presets defined', () => {
    const typesFile = resolve(sharedDir, 'src/types.ts');
    const content = readFileSync(typesFile, 'utf-8');

    expect(content).toContain('NICHE_PRESETS');
    expect(content).toContain('NichePresetId');
  });

  it('should have pricing and credits constants', () => {
    const typesFile = resolve(sharedDir, 'src/types.ts');
    const content = readFileSync(typesFile, 'utf-8');

    expect(content).toContain('PRICING_TIERS');
    expect(content).toContain('CREDIT_PACKS');
  });

  it('should have timeline types', () => {
    const timelineFile = resolve(sharedDir, 'src/timeline.ts');
    expect(existsSync(timelineFile)).toBe(true);

    const content = readFileSync(timelineFile, 'utf-8');
    // Timeline should have core types for video composition
    expect(content.length).toBeGreaterThan(0);
  });

  it('should have TypeScript configuration', () => {
    const tsconfigFile = resolve(sharedDir, 'tsconfig.json');
    expect(existsSync(tsconfigFile)).toBe(true);
  });

  it('should have Zod as dependency for schemas', () => {
    const packageFile = resolve(sharedDir, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageFile, 'utf-8'));

    expect(packageJson.dependencies).toHaveProperty('zod');
  });
});

describe('FOUND-002: Type Imports from Apps', () => {
  it('should be importable by web app', async () => {
    // This test verifies the workspace linking works
    const webPackageFile = resolve(__dirname, '../../apps/web/package.json');

    if (existsSync(webPackageFile)) {
      const webPackage = JSON.parse(readFileSync(webPackageFile, 'utf-8'));

      // Check if @canvascast/shared is listed as a dependency
      const hasDependency =
        webPackage.dependencies?.['@canvascast/shared'] !== undefined ||
        webPackage.devDependencies?.['@canvascast/shared'] !== undefined;

      // It's okay if it's not explicitly listed - workspaces handle it
      // But if it is listed, it should be workspace:*
      if (hasDependency) {
        const version = webPackage.dependencies?.['@canvascast/shared'] ||
                       webPackage.devDependencies?.['@canvascast/shared'];
        expect(version).toMatch(/workspace:|^\*/);
      }
    }
  });

  it('should be importable by api app', async () => {
    const apiPackageFile = resolve(__dirname, '../../apps/api/package.json');

    if (existsSync(apiPackageFile)) {
      const apiPackage = JSON.parse(readFileSync(apiPackageFile, 'utf-8'));

      const hasDependency =
        apiPackage.dependencies?.['@canvascast/shared'] !== undefined ||
        apiPackage.devDependencies?.['@canvascast/shared'] !== undefined;

      if (hasDependency) {
        const version = apiPackage.dependencies?.['@canvascast/shared'] ||
                       apiPackage.devDependencies?.['@canvascast/shared'];
        expect(version).toMatch(/workspace:|^\*/);
      }
    }
  });

  it('should be importable by worker app', async () => {
    const workerPackageFile = resolve(__dirname, '../../apps/worker/package.json');

    if (existsSync(workerPackageFile)) {
      const workerPackage = JSON.parse(readFileSync(workerPackageFile, 'utf-8'));

      const hasDependency =
        workerPackage.dependencies?.['@canvascast/shared'] !== undefined ||
        workerPackage.devDependencies?.['@canvascast/shared'] !== undefined;

      if (hasDependency) {
        const version = workerPackage.dependencies?.['@canvascast/shared'] ||
                       workerPackage.devDependencies?.['@canvascast/shared'];
        expect(version).toMatch(/workspace:|^\*/);
      }
    }
  });
});
