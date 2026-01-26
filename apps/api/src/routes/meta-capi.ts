/**
 * Meta Conversions API (CAPI) Route (META-004)
 * Endpoint for tracking server-side events to Meta/Facebook
 *
 * POST /api/meta-capi
 * Body: {
 *   eventName: string,
 *   eventId: string,
 *   eventTime?: number,
 *   userData: { email, clientIp, clientUserAgent, fbp, fbc },
 *   customData?: { value, currency, contentIds, ... },
 *   actionSource: 'website' | 'email' | 'app'
 * }
 */

import express from 'express';
import { z } from 'zod';
import {
  trackServerSideEvent,
  extractMetaCookies,
  type MetaEventData,
} from '../lib/meta-capi.js';

const router = express.Router();

/**
 * Validation schema for Meta CAPI event requests
 */
const metaEventSchema = z.object({
  eventName: z.string().min(1),
  eventId: z.string().min(1),
  eventTime: z.number().int().optional(),
  eventSourceUrl: z.string().url().optional(),
  userData: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().optional(),
      clientIpAddress: z.string().optional(),
      clientUserAgent: z.string().optional(),
      fbp: z.string().optional(),
      fbc: z.string().optional(),
    })
    .optional(),
  customData: z
    .object({
      value: z.number().optional(),
      currency: z.string().optional(),
      contentIds: z.array(z.string()).optional(),
      contentType: z.string().optional(),
      contentName: z.string().optional(),
      numItems: z.number().int().optional(),
      status: z.string().optional(),
      predictedLtv: z.number().optional(),
    })
    .optional(),
  actionSource: z.enum(['website', 'email', 'app']),
});

/**
 * POST /api/meta-capi
 * Track a server-side event to Meta Conversions API
 */
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const validationResult = metaEventSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid event data',
        details: validationResult.error.issues,
      });
    }

    const eventData = validationResult.data;

    // Extract Meta cookies from request if not provided
    const metaCookies = extractMetaCookies(req.headers.cookie);

    // Prepare event data with defaults
    const capiEventData: MetaEventData = {
      eventName: eventData.eventName,
      eventId: eventData.eventId,
      eventTime: eventData.eventTime || Math.floor(Date.now() / 1000),
      eventSourceUrl:
        eventData.eventSourceUrl || req.headers.referer || req.headers.origin,
      userData: {
        email: eventData.userData?.email,
        phone: eventData.userData?.phone,
        clientIpAddress:
          eventData.userData?.clientIpAddress ||
          req.ip ||
          req.socket.remoteAddress,
        clientUserAgent:
          eventData.userData?.clientUserAgent || req.headers['user-agent'],
        fbp: eventData.userData?.fbp || metaCookies.fbp,
        fbc: eventData.userData?.fbc || metaCookies.fbc,
      },
      customData: eventData.customData,
      actionSource: eventData.actionSource,
    };

    // Track the event
    const result = await trackServerSideEvent(capiEventData);

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to track event',
        details: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      eventsReceived: result.eventsReceived,
      messages: result.messages,
    });
  } catch (error) {
    console.error('Error in Meta CAPI endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/meta-capi/health
 * Health check for Meta CAPI integration
 */
router.get('/health', (req, res) => {
  const hasAccessToken = !!process.env.META_ACCESS_TOKEN;
  const hasPixelId = !!process.env.META_PIXEL_ID;

  return res.json({
    status: hasAccessToken && hasPixelId ? 'healthy' : 'not_configured',
    configured: {
      accessToken: hasAccessToken,
      pixelId: hasPixelId,
    },
  });
});

export default router;
