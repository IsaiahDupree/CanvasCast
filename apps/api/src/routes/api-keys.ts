/**
 * API Key Management Routes
 * Feature: RATE-004
 *
 * CRUD operations for API keys
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  createApiKeySchema,
  updateApiKeySchema,
  type CreateApiKeyInput,
  type UpdateApiKeyInput,
} from '@canvascast/shared';
import { generateApiKey, maskApiKey } from '../middleware/api-key-limit.js';

const router = Router();

// Auth middleware type
interface AuthenticatedRequest extends Request {
  user?: { id: string; email?: string };
}

/**
 * GET /api/v1/api-keys
 * List all API keys for the authenticated user
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API_KEYS] Error listing keys:', error);
      return res.status(500).json({ error: 'Failed to list API keys' });
    }

    // Mask the keys
    const maskedKeys = data.map((key) => ({
      ...key,
      key: undefined,
      key_preview: maskApiKey(key.key),
    }));

    return res.json({ api_keys: maskedKeys });
  } catch (error) {
    console.error('[API_KEYS] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/api-keys
 * Create a new API key
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate input
    const validation = createApiKeySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const input: CreateApiKeyInput = validation.data;

    // Generate API key
    const apiKey = generateApiKey('live');

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    // Create in database
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        key: apiKey,
        name: input.name,
        description: input.description || null,
        rate_limit_requests: input.rate_limit_requests,
        rate_limit_window: input.rate_limit_window,
        expires_at: input.expires_at || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[API_KEYS] Error creating key:', error);
      return res.status(500).json({ error: 'Failed to create API key' });
    }

    // Return the full key ONLY on creation
    return res.status(201).json({
      api_key: data,
      warning: 'Save this key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('[API_KEYS] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/api-keys/:id
 * Get a single API key (masked)
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Mask the key
    const maskedKey = {
      ...data,
      key: undefined,
      key_preview: maskApiKey(data.key),
    };

    return res.json({ api_key: maskedKey });
  } catch (error) {
    console.error('[API_KEYS] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/v1/api-keys/:id
 * Update an API key
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Validate input
    const validation = updateApiKeySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const input: UpdateApiKeyInput = validation.data;

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    // Update in database
    const { data, error } = await supabase
      .from('api_keys')
      .update(input)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Mask the key
    const maskedKey = {
      ...data,
      key: undefined,
      key_preview: maskApiKey(data.key),
    };

    return res.json({ api_key: maskedKey });
  } catch (error) {
    console.error('[API_KEYS] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/v1/api-keys/:id
 * Delete an API key
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[API_KEYS] Error deleting key:', error);
      return res.status(500).json({ error: 'Failed to delete API key' });
    }

    return res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    console.error('[API_KEYS] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/api-keys/:id/regenerate
 * Regenerate an API key (creates new key, invalidates old one)
 */
router.post('/:id/regenerate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Generate new API key
    const newApiKey = generateApiKey('live');

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    // Update with new key
    const { data, error } = await supabase
      .from('api_keys')
      .update({ key: newApiKey })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Return the full key ONLY on regeneration
    return res.json({
      api_key: data,
      warning: 'Save this key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('[API_KEYS] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
