/**
 * Schema Validation Tests
 * Tests for all Zod schemas in packages/shared/src/schemas
 */

import {
  projectSchema,
  projectUpdateSchema,
  jobSchema,
  jobUpdateSchema,
} from '../src/schemas';
import { NICHE_PRESETS, JOB_STATUSES } from '../src/types';

describe('Project Schema', () => {
  describe('projectSchema - Valid inputs', () => {
    it('should validate a valid project with all required fields', () => {
      const validProject = {
        title: 'My Test Project',
        niche_preset: 'explainer',
        target_minutes: 5,
      };

      const result = projectSchema.safeParse(validProject);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validProject);
      }
    });

    it('should validate a project with optional prompt', () => {
      const projectWithPrompt = {
        title: 'My Test Project',
        niche_preset: 'motivation',
        target_minutes: 3,
        prompt: 'Create a motivational video about success',
      };

      const result = projectSchema.safeParse(projectWithPrompt);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prompt).toBe('Create a motivational video about success');
      }
    });

    it('should validate all valid niche presets', () => {
      const nichePresets = NICHE_PRESETS.map(p => p.id);

      nichePresets.forEach(niche => {
        const project = {
          title: 'Test',
          niche_preset: niche,
          target_minutes: 5,
        };

        const result = projectSchema.safeParse(project);
        expect(result.success).toBe(true);
      });
    });

    it('should validate minimum target_minutes (1)', () => {
      const project = {
        title: 'Short Video',
        niche_preset: 'facts',
        target_minutes: 1,
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(true);
    });

    it('should validate maximum target_minutes (10)', () => {
      const project = {
        title: 'Long Video',
        niche_preset: 'documentary',
        target_minutes: 10,
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(true);
    });

    it('should validate title at maximum length (200 chars)', () => {
      const longTitle = 'a'.repeat(200);
      const project = {
        title: longTitle,
        niche_preset: 'tech',
        target_minutes: 5,
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(true);
    });
  });

  describe('projectSchema - Invalid inputs', () => {
    it('should reject missing title', () => {
      const project = {
        niche_preset: 'explainer',
        target_minutes: 5,
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('title');
      }
    });

    it('should reject empty title', () => {
      const project = {
        title: '',
        niche_preset: 'explainer',
        target_minutes: 5,
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Title is required');
      }
    });

    it('should reject title longer than 200 characters', () => {
      const project = {
        title: 'a'.repeat(201),
        niche_preset: 'explainer',
        target_minutes: 5,
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('less than 200 characters');
      }
    });

    it('should reject invalid niche_preset', () => {
      const project = {
        title: 'Test Project',
        niche_preset: 'invalid_niche',
        target_minutes: 5,
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid niche preset');
      }
    });

    it('should reject missing niche_preset', () => {
      const project = {
        title: 'Test Project',
        target_minutes: 5,
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('niche_preset');
      }
    });

    it('should reject target_minutes less than 1', () => {
      const project = {
        title: 'Test Project',
        niche_preset: 'explainer',
        target_minutes: 0,
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 1 minute');
      }
    });

    it('should reject target_minutes greater than 10', () => {
      const project = {
        title: 'Test Project',
        niche_preset: 'explainer',
        target_minutes: 11,
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at most 10 minutes');
      }
    });

    it('should reject non-integer target_minutes', () => {
      const project = {
        title: 'Test Project',
        niche_preset: 'explainer',
        target_minutes: 5.5,
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('whole number');
      }
    });

    it('should reject missing target_minutes', () => {
      const project = {
        title: 'Test Project',
        niche_preset: 'explainer',
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('target_minutes');
      }
    });

    it('should reject negative target_minutes', () => {
      const project = {
        title: 'Test Project',
        niche_preset: 'explainer',
        target_minutes: -5,
      };

      const result = projectSchema.safeParse(project);
      expect(result.success).toBe(false);
    });
  });

  describe('projectUpdateSchema', () => {
    it('should allow partial updates with any single field', () => {
      const updates = [
        { title: 'New Title' },
        { niche_preset: 'tech' },
        { target_minutes: 7 },
        { prompt: 'New prompt' },
      ];

      updates.forEach(update => {
        const result = projectUpdateSchema.safeParse(update);
        expect(result.success).toBe(true);
      });
    });

    it('should allow empty object for updates', () => {
      const result = projectUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should still validate constraints on provided fields', () => {
      const invalidUpdate = {
        target_minutes: 15, // exceeds max
      };

      const result = projectUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should validate multiple fields at once', () => {
      const update = {
        title: 'Updated Title',
        target_minutes: 8,
      };

      const result = projectUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });
  });
});

describe('Job Schema', () => {
  describe('jobSchema - Valid inputs', () => {
    it('should validate a valid job with all required fields', () => {
      const validJob = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'QUEUED',
        progress: 0,
        cost_credits_reserved: 5,
        cost_credits_final: 0,
      };

      const result = jobSchema.safeParse(validJob);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.progress).toBe(0);
      }
    });

    it('should apply default values for progress and credits', () => {
      const minimalJob = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'QUEUED',
      };

      const result = jobSchema.safeParse(minimalJob);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.progress).toBe(0);
        expect(result.data.cost_credits_reserved).toBe(0);
        expect(result.data.cost_credits_final).toBe(0);
      }
    });

    it('should validate all valid job statuses', () => {
      JOB_STATUSES.forEach(status => {
        const job = {
          project_id: '123e4567-e89b-12d3-a456-426614174000',
          user_id: '123e4567-e89b-12d3-a456-426614174001',
          status,
        };

        const result = jobSchema.safeParse(job);
        expect(result.success).toBe(true);
      });
    });

    it('should validate job with optional error fields', () => {
      const jobWithError = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'FAILED',
        error_code: 'ERR_SCRIPT_GEN',
        error_message: 'Failed to generate script',
      };

      const result = jobSchema.safeParse(jobWithError);
      expect(result.success).toBe(true);
    });

    it('should validate progress at minimum (0)', () => {
      const job = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'QUEUED',
        progress: 0,
      };

      const result = jobSchema.safeParse(job);
      expect(result.success).toBe(true);
    });

    it('should validate progress at maximum (100)', () => {
      const job = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'READY',
        progress: 100,
      };

      const result = jobSchema.safeParse(job);
      expect(result.success).toBe(true);
    });

    it('should validate job with null error fields', () => {
      const job = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'RENDERING',
        error_code: null,
        error_message: null,
      };

      const result = jobSchema.safeParse(job);
      expect(result.success).toBe(true);
    });
  });

  describe('jobSchema - Invalid inputs', () => {
    it('should reject invalid project_id (not a UUID)', () => {
      const job = {
        project_id: 'not-a-uuid',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'QUEUED',
      };

      const result = jobSchema.safeParse(job);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('valid UUID');
      }
    });

    it('should reject invalid user_id (not a UUID)', () => {
      const job = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: 'invalid-uuid',
        status: 'QUEUED',
      };

      const result = jobSchema.safeParse(job);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('valid UUID');
      }
    });

    it('should reject invalid job status', () => {
      const job = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'INVALID_STATUS',
      };

      const result = jobSchema.safeParse(job);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid job status');
      }
    });

    it('should reject progress less than 0', () => {
      const job = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'QUEUED',
        progress: -1,
      };

      const result = jobSchema.safeParse(job);
      expect(result.success).toBe(false);
    });

    it('should reject progress greater than 100', () => {
      const job = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'RENDERING',
        progress: 101,
      };

      const result = jobSchema.safeParse(job);
      expect(result.success).toBe(false);
    });

    it('should reject negative cost_credits_reserved', () => {
      const job = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'QUEUED',
        cost_credits_reserved: -5,
      };

      const result = jobSchema.safeParse(job);
      expect(result.success).toBe(false);
    });

    it('should reject negative cost_credits_final', () => {
      const job = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'READY',
        cost_credits_final: -3,
      };

      const result = jobSchema.safeParse(job);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const incompleteJob = {
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        // missing user_id and status
      };

      const result = jobSchema.safeParse(incompleteJob);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('jobUpdateSchema', () => {
    it('should allow partial updates with any single field', () => {
      const updates = [
        { status: 'RENDERING' },
        { progress: 50 },
        { error_code: 'ERR_RENDER' },
        { error_message: 'Rendering failed' },
      ];

      updates.forEach(update => {
        const result = jobUpdateSchema.safeParse(update);
        expect(result.success).toBe(true);
      });
    });

    it('should allow empty object for updates', () => {
      const result = jobUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate datetime fields', () => {
      const update = {
        claimed_at: '2024-01-15T10:30:00Z',
        started_at: '2024-01-15T10:31:00Z',
        finished_at: '2024-01-15T10:45:00Z',
      };

      const result = jobUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should allow null datetime fields', () => {
      const update = {
        claimed_at: null,
        started_at: null,
        finished_at: null,
      };

      const result = jobUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should validate claimed_by field', () => {
      const update = {
        claimed_by: 'worker-1',
      };

      const result = jobUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should still validate constraints on provided fields', () => {
      const invalidUpdate = {
        progress: 150, // exceeds max
      };

      const result = jobUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should validate status changes', () => {
      const statusUpdate = {
        status: 'FAILED',
        error_code: 'ERR_IMAGE_GEN',
        error_message: 'Failed to generate images',
      };

      const result = jobUpdateSchema.safeParse(statusUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate cost_credits_final update', () => {
      const update = {
        cost_credits_final: 4.5,
      };

      const result = jobUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should reject invalid datetime format', () => {
      const update = {
        started_at: 'not-a-valid-datetime',
      };

      const result = jobUpdateSchema.safeParse(update);
      expect(result.success).toBe(false);
    });

    it('should reject negative cost_credits_final in update', () => {
      const update = {
        cost_credits_final: -2,
      };

      const result = jobUpdateSchema.safeParse(update);
      expect(result.success).toBe(false);
    });
  });
});

describe('Edge Cases and Type Safety', () => {
  it('should handle extra unknown fields in project schema', () => {
    const projectWithExtra = {
      title: 'Test',
      niche_preset: 'explainer',
      target_minutes: 5,
      unknownField: 'should be stripped',
    };

    const result = projectSchema.safeParse(projectWithExtra);
    expect(result.success).toBe(true);
    if (result.success) {
      // Zod strips unknown fields by default
      expect('unknownField' in result.data).toBe(false);
    }
  });

  it('should handle extra unknown fields in job schema', () => {
    const jobWithExtra = {
      project_id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      status: 'QUEUED',
      unknownField: 'should be stripped',
    };

    const result = jobSchema.safeParse(jobWithExtra);
    expect(result.success).toBe(true);
    if (result.success) {
      expect('unknownField' in result.data).toBe(false);
    }
  });

  it('should handle null vs undefined for optional fields', () => {
    const projectWithUndefined = {
      title: 'Test',
      niche_preset: 'explainer',
      target_minutes: 5,
      prompt: undefined,
    };

    const result1 = projectSchema.safeParse(projectWithUndefined);
    expect(result1.success).toBe(true);

    const projectWithoutPrompt = {
      title: 'Test',
      niche_preset: 'explainer',
      target_minutes: 5,
    };

    const result2 = projectSchema.safeParse(projectWithoutPrompt);
    expect(result2.success).toBe(true);
  });

  it('should handle type coercion properly', () => {
    const projectWithStringNumber = {
      title: 'Test',
      niche_preset: 'explainer',
      target_minutes: '5', // string instead of number
    };

    // Zod should NOT coerce types by default
    const result = projectSchema.safeParse(projectWithStringNumber);
    expect(result.success).toBe(false);
  });

  it('should validate UUID format strictly', () => {
    const validUUIDs = [
      '123e4567-e89b-12d3-a456-426614174000',
      'A987FBC9-4BED-3078-CF07-9141BA07C9F3',
      'a987fbc9-4bed-3078-cf07-9141ba07c9f3',
    ];

    validUUIDs.forEach(uuid => {
      const job = {
        project_id: uuid,
        user_id: uuid,
        status: 'QUEUED',
      };

      const result = jobSchema.safeParse(job);
      expect(result.success).toBe(true);
    });

    const invalidUUIDs = [
      '123',
      'not-a-uuid',
      '123e4567-e89b-12d3-a456',
      '123e4567-e89b-12d3-a456-426614174000-extra',
    ];

    invalidUUIDs.forEach(uuid => {
      const job = {
        project_id: uuid,
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'QUEUED',
      };

      const result = jobSchema.safeParse(job);
      expect(result.success).toBe(false);
    });
  });
});
