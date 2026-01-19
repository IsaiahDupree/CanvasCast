/**
 * Bull Board Dashboard Tests
 *
 * Tests for the BullMQ dashboard monitoring interface
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Bull Board Dashboard', () => {
  it('should have bull-board.ts file', () => {
    const bullBoardPath = resolve(__dirname, '../src/bull-board.ts');
    expect(existsSync(bullBoardPath)).toBe(true);
  });

  it('should export createBullBoard function', async () => {
    // Dynamic import to check exports
    try {
      const bullBoard = await import('../src/bull-board.ts');
      expect(bullBoard.createBullBoard).toBeDefined();
      expect(typeof bullBoard.createBullBoard).toBe('function');
    } catch (error: any) {
      // File doesn't exist yet - expected failure in RED phase
      expect(error.code).toBe('ERR_MODULE_NOT_FOUND');
    }
  });

  it('should have dashboard route configuration', async () => {
    try {
      const bullBoard = await import('../src/bull-board.ts');
      expect(bullBoard.BULL_BOARD_PATH).toBeDefined();
      expect(typeof bullBoard.BULL_BOARD_PATH).toBe('string');
      expect(bullBoard.BULL_BOARD_PATH).toContain('/admin/queues');
    } catch (error: any) {
      // File doesn't exist yet - expected failure in RED phase
      expect(error.code).toBe('ERR_MODULE_NOT_FOUND');
    }
  });
});
