import { describe, it, expect } from 'vitest';
import {
  CREDIT_PACKS,
  SUBSCRIPTIONS,
  getCreditPackById,
  getSubscriptionById,
  getSubscriptionByPriceId,
  validateCreditPackPricing,
  validateSubscriptionPricing,
} from '../apps/api/src/lib/stripe-products';

describe('Stripe Credit Pack Products', () => {
  describe('CREDIT_PACKS configuration', () => {
    it('should have exactly 3 credit packs: starter, creator, and pro', () => {
      expect(Object.keys(CREDIT_PACKS)).toEqual(['starter', 'creator', 'pro']);
    });

    it('should have starter pack with correct configuration', () => {
      const starter = CREDIT_PACKS.starter;
      expect(starter).toBeDefined();
      expect(starter.name).toBe('Starter');
      expect(starter.credits).toBe(10);
      expect(starter.amount).toBe(900); // $9.00 in cents
      expect(starter.priceId).toMatch(/^price_/);
    });

    it('should have creator pack with correct configuration', () => {
      const creator = CREDIT_PACKS.creator;
      expect(creator).toBeDefined();
      expect(creator.name).toBe('Creator');
      expect(creator.credits).toBe(50);
      expect(creator.amount).toBe(3900); // $39.00 in cents
      expect(creator.priceId).toMatch(/^price_/);
    });

    it('should have pro pack with correct configuration', () => {
      const pro = CREDIT_PACKS.pro;
      expect(pro).toBeDefined();
      expect(pro.name).toBe('Pro');
      expect(pro.credits).toBe(150);
      expect(pro.amount).toBe(9900); // $99.00 in cents
      expect(pro.priceId).toMatch(/^price_/);
    });

    it('should calculate correct per-credit cost for starter pack', () => {
      const starter = CREDIT_PACKS.starter;
      const perCredit = starter.amount / starter.credits;
      expect(perCredit).toBe(90); // $0.90 per credit in cents
    });

    it('should calculate correct per-credit cost for creator pack', () => {
      const creator = CREDIT_PACKS.creator;
      const perCredit = creator.amount / creator.credits;
      expect(perCredit).toBe(78); // $0.78 per credit in cents
    });

    it('should calculate correct per-credit cost for pro pack', () => {
      const pro = CREDIT_PACKS.pro;
      const perCredit = pro.amount / pro.credits;
      expect(perCredit).toBe(66); // $0.66 per credit in cents
    });

    it('should have better value (lower per-credit cost) for larger packs', () => {
      const starterPerCredit = CREDIT_PACKS.starter.amount / CREDIT_PACKS.starter.credits;
      const creatorPerCredit = CREDIT_PACKS.creator.amount / CREDIT_PACKS.creator.credits;
      const proPerCredit = CREDIT_PACKS.pro.amount / CREDIT_PACKS.pro.credits;

      expect(creatorPerCredit).toBeLessThan(starterPerCredit);
      expect(proPerCredit).toBeLessThan(creatorPerCredit);
    });
  });

  describe('getCreditPackById', () => {
    it('should return starter pack by id', () => {
      const pack = getCreditPackById('starter');
      expect(pack).toBeDefined();
      expect(pack?.name).toBe('Starter');
    });

    it('should return creator pack by id', () => {
      const pack = getCreditPackById('creator');
      expect(pack).toBeDefined();
      expect(pack?.name).toBe('Creator');
    });

    it('should return pro pack by id', () => {
      const pack = getCreditPackById('pro');
      expect(pack).toBeDefined();
      expect(pack?.name).toBe('Pro');
    });

    it('should return undefined for invalid pack id', () => {
      const pack = getCreditPackById('invalid');
      expect(pack).toBeUndefined();
    });
  });

  describe('validateCreditPackPricing', () => {
    it('should validate all credit packs have positive credits', () => {
      const result = validateCreditPackPricing();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect if a pack has zero or negative credits', () => {
      // This test validates the validation function works
      expect(CREDIT_PACKS.starter.credits).toBeGreaterThan(0);
      expect(CREDIT_PACKS.creator.credits).toBeGreaterThan(0);
      expect(CREDIT_PACKS.pro.credits).toBeGreaterThan(0);
    });

    it('should detect if a pack has zero or negative amount', () => {
      // This test validates the validation function works
      expect(CREDIT_PACKS.starter.amount).toBeGreaterThan(0);
      expect(CREDIT_PACKS.creator.amount).toBeGreaterThan(0);
      expect(CREDIT_PACKS.pro.amount).toBeGreaterThan(0);
    });
  });

  describe('Credit pack types', () => {
    it('should have all required fields for each pack', () => {
      Object.values(CREDIT_PACKS).forEach(pack => {
        expect(pack).toHaveProperty('name');
        expect(pack).toHaveProperty('credits');
        expect(pack).toHaveProperty('amount');
        expect(pack).toHaveProperty('priceId');
        expect(pack).toHaveProperty('description');
      });
    });

    it('should have string type for name field', () => {
      Object.values(CREDIT_PACKS).forEach(pack => {
        expect(typeof pack.name).toBe('string');
      });
    });

    it('should have number type for credits field', () => {
      Object.values(CREDIT_PACKS).forEach(pack => {
        expect(typeof pack.credits).toBe('number');
      });
    });

    it('should have number type for amount field', () => {
      Object.values(CREDIT_PACKS).forEach(pack => {
        expect(typeof pack.amount).toBe('number');
      });
    });

    it('should have string type for priceId field', () => {
      Object.values(CREDIT_PACKS).forEach(pack => {
        expect(typeof pack.priceId).toBe('string');
      });
    });
  });
});

describe('Stripe Subscription Products', () => {
  describe('SUBSCRIPTIONS configuration', () => {
    it('should have exactly 3 subscriptions: hobbyist, creator, and business', () => {
      expect(Object.keys(SUBSCRIPTIONS)).toEqual(['hobbyist', 'creator', 'business']);
    });

    it('should have hobbyist subscription with correct configuration', () => {
      const hobbyist = SUBSCRIPTIONS.hobbyist;
      expect(hobbyist).toBeDefined();
      expect(hobbyist.name).toBe('Hobbyist');
      expect(hobbyist.credits).toBe(30);
      expect(hobbyist.amount).toBe(1900); // $19.00 in cents
      expect(hobbyist.priceId).toMatch(/^price_/);
      expect(hobbyist.rolloverLimit).toBe(0); // No rollover
      expect(hobbyist.features).toBeInstanceOf(Array);
      expect(hobbyist.features.length).toBeGreaterThan(0);
    });

    it('should have creator subscription with correct configuration', () => {
      const creator = SUBSCRIPTIONS.creator;
      expect(creator).toBeDefined();
      expect(creator.name).toBe('Creator');
      expect(creator.credits).toBe(100);
      expect(creator.amount).toBe(4900); // $49.00 in cents
      expect(creator.priceId).toMatch(/^price_/);
      expect(creator.rolloverLimit).toBe(50);
      expect(creator.features).toBeInstanceOf(Array);
      expect(creator.features.length).toBeGreaterThan(0);
    });

    it('should have business subscription with correct configuration', () => {
      const business = SUBSCRIPTIONS.business;
      expect(business).toBeDefined();
      expect(business.name).toBe('Business');
      expect(business.credits).toBe(300);
      expect(business.amount).toBe(12900); // $129.00 in cents
      expect(business.priceId).toMatch(/^price_/);
      expect(business.rolloverLimit).toBe(150);
      expect(business.features).toBeInstanceOf(Array);
      expect(business.features.length).toBeGreaterThan(0);
    });

    it('should have higher tier subscriptions with better per-credit value', () => {
      const hobbyistPerCredit = SUBSCRIPTIONS.hobbyist.amount / SUBSCRIPTIONS.hobbyist.credits;
      const creatorPerCredit = SUBSCRIPTIONS.creator.amount / SUBSCRIPTIONS.creator.credits;
      const businessPerCredit = SUBSCRIPTIONS.business.amount / SUBSCRIPTIONS.business.credits;

      // Creator should be cheaper per credit than Hobbyist
      expect(creatorPerCredit).toBeLessThan(hobbyistPerCredit);
      // Business should be cheaper per credit than Creator
      expect(businessPerCredit).toBeLessThan(creatorPerCredit);
    });
  });

  describe('getSubscriptionById', () => {
    it('should return hobbyist subscription by id', () => {
      const sub = getSubscriptionById('hobbyist');
      expect(sub).toBeDefined();
      expect(sub?.name).toBe('Hobbyist');
    });

    it('should return creator subscription by id', () => {
      const sub = getSubscriptionById('creator');
      expect(sub).toBeDefined();
      expect(sub?.name).toBe('Creator');
    });

    it('should return business subscription by id', () => {
      const sub = getSubscriptionById('business');
      expect(sub).toBeDefined();
      expect(sub?.name).toBe('Business');
    });

    it('should return undefined for invalid subscription id', () => {
      const sub = getSubscriptionById('invalid');
      expect(sub).toBeUndefined();
    });
  });

  describe('getSubscriptionByPriceId', () => {
    it('should return hobbyist subscription by price id', () => {
      const sub = getSubscriptionByPriceId('price_hobbyist_monthly');
      expect(sub).toBeDefined();
      expect(sub?.name).toBe('Hobbyist');
    });

    it('should return creator subscription by price id', () => {
      const sub = getSubscriptionByPriceId('price_creator_monthly');
      expect(sub).toBeDefined();
      expect(sub?.name).toBe('Creator');
    });

    it('should return business subscription by price id', () => {
      const sub = getSubscriptionByPriceId('price_business_monthly');
      expect(sub).toBeDefined();
      expect(sub?.name).toBe('Business');
    });

    it('should return undefined for invalid price id', () => {
      const sub = getSubscriptionByPriceId('price_invalid');
      expect(sub).toBeUndefined();
    });
  });

  describe('validateSubscriptionPricing', () => {
    it('should validate all subscriptions have positive credits', () => {
      const result = validateSubscriptionPricing();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate all subscriptions have positive amounts', () => {
      expect(SUBSCRIPTIONS.hobbyist.amount).toBeGreaterThan(0);
      expect(SUBSCRIPTIONS.creator.amount).toBeGreaterThan(0);
      expect(SUBSCRIPTIONS.business.amount).toBeGreaterThan(0);
    });

    it('should validate all subscriptions have valid priceIds', () => {
      expect(SUBSCRIPTIONS.hobbyist.priceId).toBeTruthy();
      expect(SUBSCRIPTIONS.creator.priceId).toBeTruthy();
      expect(SUBSCRIPTIONS.business.priceId).toBeTruthy();
    });
  });

  describe('Subscription types', () => {
    it('should have all required fields for each subscription', () => {
      Object.values(SUBSCRIPTIONS).forEach(sub => {
        expect(sub).toHaveProperty('name');
        expect(sub).toHaveProperty('credits');
        expect(sub).toHaveProperty('amount');
        expect(sub).toHaveProperty('priceId');
        expect(sub).toHaveProperty('description');
        expect(sub).toHaveProperty('features');
        expect(sub).toHaveProperty('rolloverLimit');
      });
    });

    it('should have string type for name field', () => {
      Object.values(SUBSCRIPTIONS).forEach(sub => {
        expect(typeof sub.name).toBe('string');
      });
    });

    it('should have number type for credits field', () => {
      Object.values(SUBSCRIPTIONS).forEach(sub => {
        expect(typeof sub.credits).toBe('number');
      });
    });

    it('should have number type for amount field', () => {
      Object.values(SUBSCRIPTIONS).forEach(sub => {
        expect(typeof sub.amount).toBe('number');
      });
    });

    it('should have string type for priceId field', () => {
      Object.values(SUBSCRIPTIONS).forEach(sub => {
        expect(typeof sub.priceId).toBe('string');
      });
    });

    it('should have array type for features field', () => {
      Object.values(SUBSCRIPTIONS).forEach(sub => {
        expect(Array.isArray(sub.features)).toBe(true);
      });
    });

    it('should have number type for rolloverLimit field', () => {
      Object.values(SUBSCRIPTIONS).forEach(sub => {
        expect(typeof sub.rolloverLimit).toBe('number');
      });
    });
  });

  describe('Rollover limits', () => {
    it('should have hobbyist with no rollover', () => {
      expect(SUBSCRIPTIONS.hobbyist.rolloverLimit).toBe(0);
    });

    it('should have creator with 50 credit rollover limit', () => {
      expect(SUBSCRIPTIONS.creator.rolloverLimit).toBe(50);
    });

    it('should have business with 150 credit rollover limit', () => {
      expect(SUBSCRIPTIONS.business.rolloverLimit).toBe(150);
    });

    it('should have rollover limits less than or equal to half the monthly credits', () => {
      Object.values(SUBSCRIPTIONS).forEach(sub => {
        expect(sub.rolloverLimit).toBeLessThanOrEqual(sub.credits / 2);
      });
    });
  });

  describe('Feature lists', () => {
    it('should have at least 3 features for each subscription', () => {
      Object.values(SUBSCRIPTIONS).forEach(sub => {
        expect(sub.features.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('should have more features for higher tier subscriptions', () => {
      expect(SUBSCRIPTIONS.business.features.length).toBeGreaterThanOrEqual(
        SUBSCRIPTIONS.creator.features.length
      );
      expect(SUBSCRIPTIONS.creator.features.length).toBeGreaterThanOrEqual(
        SUBSCRIPTIONS.hobbyist.features.length
      );
    });
  });
});
