/**
 * Conversion Optimization Tests (META-008)
 *
 * Tests for Meta Pixel conversion optimization features:
 * - Value-based campaign optimization
 * - Predictive LTV calculations
 * - Conversion value helpers
 * - Campaign optimization parameters
 */

import {
  calculatePredictedLTV,
  getConversionValue,
  getOptimizationParams,
  ConversionEvent,
  OptimizationGoal,
} from '../src/lib/conversion-optimization';

describe('Conversion Optimization (META-008)', () => {
  describe('calculatePredictedLTV', () => {
    it('should calculate 6-month LTV for new subscriber', () => {
      const ltv = calculatePredictedLTV({
        currentMonthlyValue: 49.00,
        retentionMonths: 6,
      });

      expect(ltv).toBe(294.00); // $49 * 6 months
    });

    it('should apply retention rate multiplier', () => {
      const ltv = calculatePredictedLTV({
        currentMonthlyValue: 49.00,
        retentionMonths: 6,
        retentionRate: 0.8, // 80% retention
      });

      expect(ltv).toBe(235.20); // $49 * 6 * 0.8
    });

    it('should handle one-time purchases with zero monthly value', () => {
      const ltv = calculatePredictedLTV({
        currentMonthlyValue: 0,
        oneTimePurchaseValue: 99.00,
        retentionMonths: 6,
      });

      expect(ltv).toBe(99.00);
    });

    it('should combine subscription and one-time values', () => {
      const ltv = calculatePredictedLTV({
        currentMonthlyValue: 49.00,
        oneTimePurchaseValue: 99.00,
        retentionMonths: 6,
      });

      expect(ltv).toBe(393.00); // ($49 * 6) + $99
    });

    it('should apply upsell probability multiplier', () => {
      const ltv = calculatePredictedLTV({
        currentMonthlyValue: 49.00,
        retentionMonths: 6,
        upsellProbability: 0.3,
        expectedUpsellValue: 100.00,
      });

      // ($49 * 6) + (0.3 * $100) = $294 + $30 = $324
      expect(ltv).toBe(324.00);
    });

    it('should handle complex LTV with all factors', () => {
      const ltv = calculatePredictedLTV({
        currentMonthlyValue: 49.00,
        oneTimePurchaseValue: 29.00,
        retentionMonths: 12,
        retentionRate: 0.75,
        upsellProbability: 0.4,
        expectedUpsellValue: 150.00,
      });

      // Base: ($49 * 12 * 0.75) + $29 = $441 + $29 = $470
      // Upsell: 0.4 * $150 = $60
      // Total: $470 + $60 = $530
      expect(ltv).toBe(530.00);
    });

    it('should return 0 for invalid inputs', () => {
      expect(calculatePredictedLTV({ currentMonthlyValue: -10, retentionMonths: 6 })).toBe(0);
      expect(calculatePredictedLTV({ currentMonthlyValue: 49, retentionMonths: -1 })).toBe(0);
      expect(calculatePredictedLTV({ currentMonthlyValue: 0, retentionMonths: 0 })).toBe(0);
    });
  });

  describe('getConversionValue', () => {
    it('should return correct value for purchase event', () => {
      const value = getConversionValue(ConversionEvent.PURCHASE, {
        amount: 2999, // cents
        credits: 100,
      });

      expect(value).toEqual({
        value: 29.99,
        currency: 'USD',
        numItems: 100,
      });
    });

    it('should calculate predicted LTV for subscription', () => {
      const value = getConversionValue(ConversionEvent.SUBSCRIPTION, {
        amount: 4900,
        plan: 'creator',
      });

      expect(value).toEqual({
        value: 49.00,
        currency: 'USD',
        predictedLtv: 294.00, // $49 * 6 months default
      });
    });

    it('should return value for checkout initiation', () => {
      const value = getConversionValue(ConversionEvent.CHECKOUT_STARTED, {
        amount: 1999,
        credits: 50,
      });

      expect(value).toEqual({
        value: 19.99,
        currency: 'USD',
        numItems: 50,
      });
    });

    it('should handle video generation with fixed value', () => {
      const value = getConversionValue(ConversionEvent.VIDEO_GENERATED, {
        projectId: 'proj_123',
      });

      // Videos have a fixed conversion value
      expect(value).toEqual({
        value: 5.00,
        currency: 'USD',
        contentType: 'video',
      });
    });

    it('should handle signup with no monetary value', () => {
      const value = getConversionValue(ConversionEvent.SIGNUP_COMPLETED, {
        source: 'organic',
      });

      expect(value).toEqual({
        value: 0,
        currency: 'USD',
        status: 'completed',
      });
    });

    it('should handle video download with engagement value', () => {
      const value = getConversionValue(ConversionEvent.VIDEO_DOWNLOADED, {
        videoId: 'vid_123',
      });

      // Downloads indicate high intent
      expect(value).toEqual({
        value: 2.00,
        currency: 'USD',
        contentType: 'video',
      });
    });
  });

  describe('getOptimizationParams', () => {
    it('should return value optimization params for purchase goal', () => {
      const params = getOptimizationParams(OptimizationGoal.VALUE);

      expect(params).toEqual({
        optimizationGoal: 'VALUE',
        bidStrategy: 'LOWEST_COST_WITH_BID_CAP',
        conversionWindow: 7,
        attributionSetting: 'DEFAULT',
      });
    });

    it('should return conversion optimization params', () => {
      const params = getOptimizationParams(OptimizationGoal.CONVERSIONS);

      expect(params).toEqual({
        optimizationGoal: 'OFFSITE_CONVERSIONS',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        conversionWindow: 7,
        attributionSetting: 'DEFAULT',
      });
    });

    it('should return reach params for awareness campaigns', () => {
      const params = getOptimizationParams(OptimizationGoal.REACH);

      expect(params).toEqual({
        optimizationGoal: 'REACH',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        conversionWindow: 1,
        attributionSetting: 'DEFAULT',
      });
    });

    it('should support custom conversion window', () => {
      const params = getOptimizationParams(OptimizationGoal.VALUE, {
        conversionWindow: 28,
      });

      expect(params.conversionWindow).toBe(28);
    });

    it('should support custom attribution setting', () => {
      const params = getOptimizationParams(OptimizationGoal.CONVERSIONS, {
        attributionSetting: '7_DAY_CLICK_1_DAY_VIEW',
      });

      expect(params.attributionSetting).toBe('7_DAY_CLICK_1_DAY_VIEW');
    });
  });

  describe('Integration with Meta Pixel', () => {
    it('should format purchase event for value optimization', () => {
      const eventData = {
        eventName: 'Purchase',
        properties: {
          amount: 2999,
          credits: 100,
          transactionId: 'txn_123',
        },
      };

      const value = getConversionValue(ConversionEvent.PURCHASE, eventData.properties);

      // This would be passed to trackMetaEvent
      expect(value.value).toBe(29.99);
      expect(value.currency).toBe('USD');
      expect(value.numItems).toBe(100);
    });

    it('should format subscription with predicted LTV', () => {
      const eventData = {
        eventName: 'Subscribe',
        properties: {
          amount: 4900,
          plan: 'creator',
        },
      };

      const value = getConversionValue(ConversionEvent.SUBSCRIPTION, eventData.properties);

      expect(value.value).toBe(49.00);
      expect(value.predictedLtv).toBe(294.00);
    });
  });

  describe('Value Optimization Helpers', () => {
    it('should calculate conversion value for different plan tiers', () => {
      const starterValue = getConversionValue(ConversionEvent.SUBSCRIPTION, {
        amount: 1900,
        plan: 'starter',
      });

      const creatorValue = getConversionValue(ConversionEvent.SUBSCRIPTION, {
        amount: 4900,
        plan: 'creator',
      });

      const proValue = getConversionValue(ConversionEvent.SUBSCRIPTION, {
        amount: 9900,
        plan: 'pro',
      });

      expect(starterValue.value).toBe(19.00);
      expect(creatorValue.value).toBe(49.00);
      expect(proValue.value).toBe(99.00);

      // Higher plans should have higher predicted LTV
      expect(proValue.predictedLtv).toBeGreaterThan(creatorValue.predictedLtv!);
      expect(creatorValue.predictedLtv).toBeGreaterThan(starterValue.predictedLtv!);
    });

    it('should handle credit pack purchases', () => {
      const smallPack = getConversionValue(ConversionEvent.PURCHASE, {
        amount: 999,
        credits: 25,
      });

      const mediumPack = getConversionValue(ConversionEvent.PURCHASE, {
        amount: 2999,
        credits: 100,
      });

      const largePack = getConversionValue(ConversionEvent.PURCHASE, {
        amount: 9999,
        credits: 500,
      });

      expect(smallPack.value).toBe(9.99);
      expect(mediumPack.value).toBe(29.99);
      expect(largePack.value).toBe(99.99);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing amount', () => {
      const value = getConversionValue(ConversionEvent.PURCHASE, {
        credits: 100,
      });

      expect(value.value).toBe(0);
    });

    it('should handle zero amount', () => {
      const value = getConversionValue(ConversionEvent.PURCHASE, {
        amount: 0,
        credits: 10,
      });

      expect(value.value).toBe(0);
    });

    it('should handle negative amount', () => {
      const value = getConversionValue(ConversionEvent.PURCHASE, {
        amount: -1000,
        credits: 50,
      });

      expect(value.value).toBe(0);
    });

    it('should round predicted LTV to 2 decimal places', () => {
      const ltv = calculatePredictedLTV({
        currentMonthlyValue: 49.99,
        retentionMonths: 7,
        retentionRate: 0.83,
      });

      // Should be rounded to 2 decimals
      // 49.99 * 7 * 0.83 = 290.4371 -> rounds to 290.44
      expect(ltv).toBe(290.44);
    });
  });
});
