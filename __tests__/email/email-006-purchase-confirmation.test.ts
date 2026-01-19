/**
 * EMAIL-006: Purchase Confirmation Email Template
 *
 * Tests that verify:
 * 1. Template file exists
 * 2. Shows credits added
 * 3. Shows receipt info (amount paid, pack name)
 * 4. Renders correctly with valid props
 * 5. Has proper structure and styling
 * 6. Includes dashboard link
 *
 * Acceptance Criteria (from feature_list.json):
 * - Shows credits added
 * - Receipt info
 *
 * PRD: docs/prds/11-email-notifications.md
 * PRD: docs/prds/10-credits-billing.md
 */

import { describe, it, expect } from 'vitest';

describe('EMAIL-006: Purchase Confirmation Email Template', () => {
  describe('Template File Existence', () => {
    it('should have purchase-confirmation.tsx template file', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );

      await expect(fs.access(templatePath)).resolves.toBeUndefined();
    });
  });

  describe('Template Structure', () => {
    it('should export PurchaseConfirmationEmail component', async () => {
      const path = await import('path');
      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );

      const module = await import(templatePath);
      expect(module.PurchaseConfirmationEmail).toBeDefined();
      expect(typeof module.PurchaseConfirmationEmail).toBe('function');
    });

    it('should export PurchaseConfirmationEmailProps interface', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      expect(content).toContain('export interface PurchaseConfirmationEmailProps');
    });

    it('should have default export', async () => {
      const path = await import('path');
      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );

      const module = await import(templatePath);
      expect(module.default).toBeDefined();
    });
  });

  describe('Props Interface', () => {
    it('should accept name, credits, amount, packName, and dashboardUrl props', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Check that interface includes required fields
      expect(content).toMatch(/name\s*:\s*string/);
      expect(content).toMatch(/credits\s*:\s*number/);
      expect(content).toMatch(/amount\s*:\s*number/);
      expect(content).toMatch(/packName\s*:\s*string/);
      expect(content).toMatch(/dashboardUrl\s*:\s*string/);
    });

    it('should have default values for all props', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Check for default destructuring pattern
      expect(content).toMatch(/=\s*\{[^}]*\}/s);
    });
  });

  describe('Acceptance Criteria: Shows Credits Added', () => {
    it('should display credits added in the template', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should reference credits prop in the content
      expect(content).toMatch(/\{credits\}/);
    });

    it('should show credits in a prominent way', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should use strong/bold for credits
      expect(content).toMatch(/<strong>.*\{credits\}.*<\/strong>/s);
    });
  });

  describe('Acceptance Criteria: Receipt Info', () => {
    it('should display amount paid', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should reference amount prop (either directly or via formattedAmount)
      expect(content).toMatch(/\{(formatted)?[Aa]mount\}/);
    });

    it('should display pack name', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should reference packName prop
      expect(content).toMatch(/\{packName\}/);
    });

    it('should have a receipt section or box', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should have a receipt-related section (receiptBox, statsBox, or similar)
      expect(content).toMatch(/(receiptBox|statsBox|purchaseDetails)/);
    });
  });

  describe('Email Components', () => {
    it('should use @react-email/components', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should import from @react-email/components
      expect(content).toContain("from '@react-email/components'");
      expect(content).toContain('Html');
      expect(content).toContain('Head');
      expect(content).toContain('Preview');
      expect(content).toContain('Body');
      expect(content).toContain('Container');
    });

    it('should include standard email structure', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should have Html, Head, Preview, Body structure
      expect(content).toMatch(/<Html>/);
      expect(content).toMatch(/<Head/);
      expect(content).toMatch(/<Preview>/);
      expect(content).toMatch(/<Body/);
      expect(content).toMatch(/<Container/);
    });

    it('should include CanvasCast logo', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should have logo image
      expect(content).toMatch(/canvascast\.ai\/logo\.png/i);
      expect(content).toMatch(/<Img/);
    });

    it('should include heading for purchase confirmation', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should have a Heading component
      expect(content).toMatch(/<Heading/);
    });

    it('should include CTA button to dashboard', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should have Button component with dashboardUrl
      expect(content).toMatch(/<Button/);
      expect(content).toMatch(/\{dashboardUrl\}/);
    });

    it('should include footer with copyright and preferences link', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should have footer section
      expect(content).toMatch(/<Hr/);
      expect(content).toMatch(/CanvasCast\. All rights reserved/i);
      expect(content).toMatch(/unsubscribe/i);
    });
  });

  describe('Styling', () => {
    it('should define consistent styles matching other templates', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templatePath = path.join(
        process.cwd(),
        'apps/worker/src/templates/purchase-confirmation.tsx'
      );
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should have style objects
      expect(content).toMatch(/const main\s*=/);
      expect(content).toMatch(/const container\s*=/);
      expect(content).toMatch(/const button\s*=/);
      expect(content).toMatch(/backgroundColor.*#7c3aed/);
    });
  });

  describe('Feature Flag in feature_list.json', () => {
    it('should have EMAIL-006 feature defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const featureListPath = path.join(process.cwd(), 'feature_list.json');
      const content = await fs.readFile(featureListPath, 'utf-8');
      const featureList = JSON.parse(content);

      const feature = featureList.features.find((f: any) => f.id === 'EMAIL-006');
      expect(feature).toBeDefined();
      expect(feature.name).toBe('Purchase Confirmation Email');
    });
  });
});
