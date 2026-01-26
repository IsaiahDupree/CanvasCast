/**
 * Test: Meta Pixel Custom Audiences Setup (META-007)
 *
 * Tests for custom audience segmentation based on user behavior
 * This enables better retargeting in Meta Ads Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  identifyUserForAudience,
  trackUserSegment,
  getUserSegments,
  AudienceSegment,
  updateUserProperties,
} from '../src/lib/custom-audiences';

describe('META-007: Custom Audiences Setup', () => {
  beforeEach(() => {
    // Reset window.fbq mock before each test
    global.window = { fbq: vi.fn() } as any;
  });

  describe('User Segmentation', () => {
    it('should identify free trial users', () => {
      const segment = getUserSegments({
        hasTrialCredits: true,
        hasPurchased: false,
        totalSpent: 0,
      });

      expect(segment).toContain(AudienceSegment.FREE_TRIAL_USER);
      expect(segment).not.toContain(AudienceSegment.PAYING_CUSTOMER);
    });

    it('should identify paying customers', () => {
      const segment = getUserSegments({
        hasTrialCredits: false,
        hasPurchased: true,
        totalSpent: 2999,
      });

      expect(segment).toContain(AudienceSegment.PAYING_CUSTOMER);
      expect(segment).not.toContain(AudienceSegment.FREE_TRIAL_USER);
    });

    it('should identify high-value customers', () => {
      const segment = getUserSegments({
        hasTrialCredits: false,
        hasPurchased: true,
        totalSpent: 10000, // $100+
      });

      expect(segment).toContain(AudienceSegment.HIGH_VALUE_CUSTOMER);
    });

    it('should identify activated users who generated videos', () => {
      const segment = getUserSegments({
        hasTrialCredits: true,
        hasPurchased: false,
        totalSpent: 0,
        videosGenerated: 3,
      });

      expect(segment).toContain(AudienceSegment.ACTIVATED_USER);
    });

    it('should identify churned users', () => {
      const segment = getUserSegments({
        hasTrialCredits: false,
        hasPurchased: true,
        totalSpent: 2999,
        daysSinceLastActive: 35, // 30+ days
      });

      expect(segment).toContain(AudienceSegment.CHURNED_USER);
    });

    it('should identify power users with subscriptions', () => {
      const segment = getUserSegments({
        hasTrialCredits: false,
        hasPurchased: true,
        totalSpent: 20000,
        videosGenerated: 50,
        hasSubscription: true,
      });

      expect(segment).toContain(AudienceSegment.POWER_USER);
      expect(segment).toContain(AudienceSegment.SUBSCRIBER);
    });
  });

  describe('Meta Pixel Integration', () => {
    it('should send user properties to Meta Pixel on identification', async () => {
      const mockFbq = vi.fn();
      global.window.fbq = mockFbq;

      await identifyUserForAudience('user_123', {
        email: 'test@example.com',
        plan: 'creator',
        ltv: 150,
        segments: [AudienceSegment.PAYING_CUSTOMER, AudienceSegment.ACTIVATED_USER],
      });

      expect(mockFbq).toHaveBeenCalledWith('init', expect.any(String), {
        external_id: 'user_123',
        em: expect.any(String), // hashed email
      });
    });

    it('should track segment changes as custom events', () => {
      const mockFbq = vi.fn();
      global.window.fbq = mockFbq;

      trackUserSegment('user_456', AudienceSegment.HIGH_VALUE_CUSTOMER, {
        totalSpent: 15000,
        videosGenerated: 30,
      });

      expect(mockFbq).toHaveBeenCalledWith('trackCustom', 'UserSegmentUpdate', {
        segment: 'high_value_customer',
        user_id: 'user_456',
        total_spent: 150, // in dollars
        videos_generated: 30,
      });
    });

    it('should update user properties without triggering events', () => {
      const mockFbq = vi.fn();
      global.window.fbq = mockFbq;

      updateUserProperties('user_789', {
        totalVideos: 10,
        creditsRemaining: 50,
        lastActive: new Date().toISOString(),
      });

      // Should not call fbq.track, only store properties for future events
      expect(mockFbq).not.toHaveBeenCalledWith('track', expect.anything());
    });
  });

  describe('Value-Based Audiences', () => {
    it('should classify users by lifetime value tiers', () => {
      const lowValue = getUserSegments({ totalSpent: 1000 }); // $10
      const mediumValue = getUserSegments({ totalSpent: 5000 }); // $50
      const highValue = getUserSegments({ totalSpent: 15000 }); // $150

      expect(lowValue).not.toContain(AudienceSegment.HIGH_VALUE_CUSTOMER);
      expect(mediumValue).not.toContain(AudienceSegment.HIGH_VALUE_CUSTOMER);
      expect(highValue).toContain(AudienceSegment.HIGH_VALUE_CUSTOMER);
    });

    it('should identify subscription vs one-time buyers', () => {
      const oneTime = getUserSegments({
        hasPurchased: true,
        hasSubscription: false,
        totalSpent: 2999,
      });

      const subscriber = getUserSegments({
        hasPurchased: true,
        hasSubscription: true,
        totalSpent: 4900,
      });

      expect(oneTime).not.toContain(AudienceSegment.SUBSCRIBER);
      expect(subscriber).toContain(AudienceSegment.SUBSCRIBER);
    });
  });

  describe('Engagement-Based Audiences', () => {
    it('should identify engaged users by video generation frequency', () => {
      const engaged = getUserSegments({
        videosGenerated: 10,
        daysSinceLastActive: 2,
      });

      expect(engaged).toContain(AudienceSegment.ACTIVATED_USER);
    });

    it('should identify users at risk of churn', () => {
      const atRisk = getUserSegments({
        hasSubscription: true,
        daysSinceLastActive: 20,
        videosGenerated: 2,
      });

      // Not quite churned (30+ days), but getting close
      expect(atRisk).not.toContain(AudienceSegment.CHURNED_USER);
    });
  });

  describe('Audience Segment Enum', () => {
    it('should have all required segments defined', () => {
      expect(AudienceSegment.FREE_TRIAL_USER).toBeDefined();
      expect(AudienceSegment.PAYING_CUSTOMER).toBeDefined();
      expect(AudienceSegment.HIGH_VALUE_CUSTOMER).toBeDefined();
      expect(AudienceSegment.ACTIVATED_USER).toBeDefined();
      expect(AudienceSegment.CHURNED_USER).toBeDefined();
      expect(AudienceSegment.POWER_USER).toBeDefined();
      expect(AudienceSegment.SUBSCRIBER).toBeDefined();
    });
  });
});
