"use client";

import Link from "next/link";
import { Check, Zap, Crown, Rocket } from "lucide-react";

interface PricingTier {
  id: string;
  name: string;
  price: number;
  credits: number;
  description: string;
  popular?: boolean;
  features: string[];
}

interface PricingCardProps {
  tier: PricingTier;
}

const TIER_ICONS = {
  starter: Zap,
  pro: Crown,
  creator_plus: Rocket,
} as const;

export function PricingCard({ tier }: PricingCardProps) {
  const isPopular = "popular" in tier && tier.popular;
  const TierIcon = TIER_ICONS[tier.id as keyof typeof TIER_ICONS] || Zap;

  return (
    <div
      className={`relative rounded-2xl p-8 ${
        isPopular
          ? "bg-brand-500/10 border-2 border-brand-500"
          : "bg-white/5 border border-white/10"
      }`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-brand-500 rounded-full text-sm font-medium">
          Most Popular
        </div>
      )}

      <div className="mb-6">
        <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center mb-4">
          <TierIcon className="w-6 h-6 text-brand-400" />
        </div>
        <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
        <p className="text-gray-400 text-sm mb-3">{tier.description}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">${tier.price}</span>
          <span className="text-gray-400">/ {tier.credits} credits</span>
        </div>
      </div>

      <ul className="space-y-3 mb-8">
        {tier.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
            <span className="text-gray-300">{feature}</span>
          </li>
        ))}
      </ul>

      <Link href="/signup">
        <button
          className={`w-full py-3 rounded-lg font-semibold text-center transition ${
            isPopular
              ? "bg-brand-600 hover:bg-brand-500 text-white"
              : "bg-white/10 hover:bg-white/20 text-white"
          }`}
        >
          Get Started
        </button>
      </Link>
    </div>
  );
}
