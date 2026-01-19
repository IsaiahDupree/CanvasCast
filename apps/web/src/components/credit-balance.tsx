'use client';

import Link from 'next/link';
import { Coins } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';

export function CreditBalance() {
  const { balance, isLoading } = useCredits();

  return (
    <div className="flex items-center gap-2">
      <Coins className="w-5 h-5 text-yellow-500" />
      <span className="font-semibold">
        {isLoading ? '...' : balance} credits
      </span>
      <Link href="/app/credits" data-testid="credit-link">
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium transition"
        >
          Buy More
        </button>
      </Link>
    </div>
  );
}
