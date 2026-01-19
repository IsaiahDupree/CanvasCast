import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

const workflowsDir = path.join(__dirname, '../.github/workflows');

describe('GitHub Actions Workflows', () => {
  describe('CI Workflow', () => {
    const ciWorkflowPath = path.join(workflowsDir, 'ci.yml');

    it('should have a ci.yml file', () => {
      expect(fs.existsSync(ciWorkflowPath)).toBe(true);
    });

    it('should have valid YAML syntax', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      expect(() => yaml.parse(content)).not.toThrow();
    });

    it('should run on pull requests', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      expect(workflow.on).toHaveProperty('pull_request');
    });

    it('should run on push to main branch', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      expect(workflow.on.push?.branches).toContain('main');
    });

    it('should have a build job', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      expect(workflow.jobs).toHaveProperty('build');
    });

    it('should have a test job', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      expect(workflow.jobs).toHaveProperty('test');
    });

    it('should have a typecheck job', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      expect(workflow.jobs).toHaveProperty('typecheck');
    });

    it('should have a lint job', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      expect(workflow.jobs).toHaveProperty('lint');
    });

    it('should checkout code in build job', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const buildSteps = workflow.jobs.build.steps;
      expect(buildSteps.some((step: any) => step.uses?.includes('checkout'))).toBe(true);
    });

    it('should setup Node.js in build job', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const buildSteps = workflow.jobs.build.steps;
      expect(buildSteps.some((step: any) => step.uses?.includes('setup-node'))).toBe(true);
    });

    it('should setup pnpm in build job', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const buildSteps = workflow.jobs.build.steps;
      expect(buildSteps.some((step: any) => step.uses?.includes('pnpm/action-setup'))).toBe(true);
    });

    it('should install dependencies in build job', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const buildSteps = workflow.jobs.build.steps;
      expect(buildSteps.some((step: any) => step.run?.includes('pnpm install'))).toBe(true);
    });

    it('should run build command in build job', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const buildSteps = workflow.jobs.build.steps;
      expect(buildSteps.some((step: any) => step.run?.includes('pnpm build'))).toBe(true);
    });

    it('should run tests in test job', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const testSteps = workflow.jobs.test.steps;
      expect(testSteps.some((step: any) => step.run?.includes('pnpm test:ci'))).toBe(true);
    });

    it('should run typecheck in typecheck job', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const typecheckSteps = workflow.jobs.typecheck.steps;
      expect(typecheckSteps.some((step: any) => step.run?.includes('tsc --noEmit'))).toBe(true);
    });

    it('should run lint in lint job', () => {
      const content = fs.readFileSync(ciWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const lintSteps = workflow.jobs.lint.steps;
      expect(lintSteps.some((step: any) => step.run?.includes('pnpm lint'))).toBe(true);
    });
  });

  describe('Deploy Workflow', () => {
    const deployWorkflowPath = path.join(workflowsDir, 'deploy.yml');

    it('should have a deploy.yml file', () => {
      expect(fs.existsSync(deployWorkflowPath)).toBe(true);
    });

    it('should have valid YAML syntax', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf8');
      expect(() => yaml.parse(content)).not.toThrow();
    });

    it('should run on push to main branch', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      expect(workflow.on.push?.branches).toContain('main');
    });

    it('should have a deploy job', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      expect(workflow.jobs).toHaveProperty('deploy');
    });

    it('should checkout code in deploy job', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const deploySteps = workflow.jobs.deploy.steps;
      expect(deploySteps.some((step: any) => step.uses?.includes('checkout'))).toBe(true);
    });

    it('should setup Node.js in deploy job', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const deploySteps = workflow.jobs.deploy.steps;
      expect(deploySteps.some((step: any) => step.uses?.includes('setup-node'))).toBe(true);
    });

    it('should setup pnpm in deploy job', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const deploySteps = workflow.jobs.deploy.steps;
      expect(deploySteps.some((step: any) => step.uses?.includes('pnpm/action-setup'))).toBe(true);
    });

    it('should install dependencies in deploy job', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const deploySteps = workflow.jobs.deploy.steps;
      expect(deploySteps.some((step: any) => step.run?.includes('pnpm install'))).toBe(true);
    });

    it('should build in deploy job', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const deploySteps = workflow.jobs.deploy.steps;
      expect(deploySteps.some((step: any) => step.run?.includes('pnpm build'))).toBe(true);
    });

    it('should include Docker build step', () => {
      const content = fs.readFileSync(deployWorkflowPath, 'utf8');
      const workflow = yaml.parse(content);
      const deploySteps = workflow.jobs.deploy.steps;
      expect(deploySteps.some((step: any) =>
        step.name?.toLowerCase().includes('docker') ||
        step.run?.includes('docker build')
      )).toBe(true);
    });
  });
});
