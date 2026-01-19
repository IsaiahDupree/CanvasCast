/**
 * Test to verify Jest can import and test shared package schemas
 */

import { z } from 'zod';

// Simple schema to test Zod validation
const TestSchema = z.object({
  name: z.string(),
  age: z.number().min(0),
  email: z.string().email(),
});

describe('Shared Package Schema Tests', () => {
  it('should validate valid data', () => {
    const validData = {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com',
    };

    const result = TestSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const invalidData = {
      name: 'John Doe',
      age: 30,
      email: 'not-an-email',
    };

    const result = TestSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject negative age', () => {
    const invalidData = {
      name: 'John Doe',
      age: -5,
      email: 'john@example.com',
    };

    const result = TestSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should handle missing required fields', () => {
    const invalidData = {
      name: 'John Doe',
    };

    const result = TestSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
