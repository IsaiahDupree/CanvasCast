/**
 * MOD-002: Output Content Scanning
 *
 * Checks generated scripts and image prompts for policy violations
 * before proceeding with the pipeline.
 */

import OpenAI from 'openai';
import type { PipelineContext, StepResult } from '../types';
import { createStepResult, createStepError } from '../types';
import { insertJobEvent } from '../../lib/db';

/**
 * Moderate generated output (script and image prompts)
 *
 * This step scans:
 * 1. Script content (all sections)
 * 2. Image generation prompts (from visual plan)
 *
 * If any content is flagged, the pipeline stops and the job fails.
 */
export async function moderateOutput(
  ctx: PipelineContext
): Promise<StepResult<void>> {
  try {
    // Bypass moderation in test/dev mode
    if (process.env.NODE_ENV === 'test' || process.env.MODERATION_BYPASS === 'true') {
      console.log('[MOD-002] Bypassing moderation (test/dev mode)');
      return createStepResult(undefined);
    }

    // Check for API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[MOD-002] OPENAI_API_KEY not configured');
      return createStepError('ERR_MODERATION', 'Moderation service not configured');
    }

    const openai = new OpenAI({ apiKey });
    await insertJobEvent(ctx.jobId, ctx.job.status, 'Moderating generated content...');

    // Collect all text to moderate
    const textsToModerate: Array<{ text: string; type: string; id: string }> = [];

    // 1. Moderate script sections
    if (ctx.artifacts.script) {
      for (const section of ctx.artifacts.script.sections) {
        textsToModerate.push({
          text: section.text,
          type: 'script',
          id: section.id,
        });
      }
    }

    // 2. Moderate image prompts from visual plan
    if (ctx.artifacts.visualPlan) {
      for (const scene of ctx.artifacts.visualPlan.scenes) {
        if (scene.imagePrompt) {
          textsToModerate.push({
            text: scene.imagePrompt,
            type: 'image_prompt',
            id: scene.id,
          });
        }
      }
    }

    // If no content to moderate, skip
    if (textsToModerate.length === 0) {
      console.log('[MOD-002] No content to moderate, skipping');
      return createStepResult(undefined);
    }

    console.log(`[MOD-002] Moderating ${textsToModerate.length} items`);

    // Moderate each text
    for (const item of textsToModerate) {
      try {
        const moderation = await openai.moderations.create({
          input: item.text,
          model: 'omni-moderation-latest',
        });

        const result = moderation.results[0];

        if (result.flagged) {
          // Get flagged categories
          const flaggedCategories = Object.entries(result.categories)
            .filter(([_, flagged]) => flagged)
            .map(([category]) => category);

          console.error(
            `[MOD-002] Content flagged: ${item.type} ${item.id}`,
            flaggedCategories
          );

          await insertJobEvent(
            ctx.jobId,
            ctx.job.status,
            `Content policy violation detected in ${item.type}`,
            'error'
          );

          return createStepError(
            'ERR_MODERATION',
            `Generated content violates content policy. Prohibited categories: ${flaggedCategories.join(', ')}`,
            {
              violationType: item.type,
              itemId: item.id,
              categories: flaggedCategories,
            }
          );
        }
      } catch (error: any) {
        console.error(`[MOD-002] Error moderating ${item.type} ${item.id}:`, error);

        // Fail closed in production - if we can't verify safety, reject
        if (process.env.NODE_ENV === 'production') {
          return createStepError(
            'ERR_MODERATION',
            'Unable to verify content safety. Please try again later.',
            {
              originalError: error.message,
            }
          );
        }

        // In non-production, log but continue
        console.warn('[MOD-002] Allowing content due to moderation API error (non-production)');
      }
    }

    console.log('[MOD-002] All content passed moderation');
    await insertJobEvent(ctx.jobId, ctx.job.status, 'Content moderation passed');

    return createStepResult(undefined);
  } catch (error: any) {
    console.error('[MOD-002] Unexpected error in moderation step:', error);
    return createStepError(
      'ERR_MODERATION',
      error.message || 'Unexpected error during content moderation'
    );
  }
}
