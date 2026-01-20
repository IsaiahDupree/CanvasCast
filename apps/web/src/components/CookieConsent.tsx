'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Settings } from 'lucide-react';

export interface CookiePreferences {
  analytics: boolean;
  timestamp: string;
}

const COOKIE_CONSENT_KEY = 'cookie-consent';

/**
 * GDPR-compliant cookie consent banner
 * Shows on first visit and saves user preferences
 */
export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  useEffect(() => {
    // Check if user has already made a choice
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) {
      setShowBanner(true);
    }
  }, []);

  const savePreferences = (analytics: boolean) => {
    const preferences: CookiePreferences = {
      analytics,
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(preferences));
    setShowBanner(false);
    setShowCustomize(false);

    // If user opts out, we need to notify analytics
    if (!analytics) {
      // Disable PostHog tracking
      if (typeof window !== 'undefined' && (window as any).posthog) {
        (window as any).posthog.opt_out_capturing();
      }
    }
  };

  const handleAccept = () => {
    savePreferences(true);
  };

  const handleReject = () => {
    savePreferences(false);
  };

  const handleCustomize = () => {
    setShowCustomize(true);
  };

  const handleSaveCustom = () => {
    savePreferences(analyticsEnabled);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 bg-gradient-to-t from-black/90 to-black/60 backdrop-blur-sm"
    >
      <div className="max-w-6xl mx-auto">
        {!showCustomize ? (
          // Main banner
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-6 sm:p-8 border border-gray-200 dark:border-gray-800">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🍪</span>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    We value your privacy
                  </h2>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  We use cookies to improve your experience and analyze site traffic.
                  You can choose which cookies to accept. Essential cookies are always enabled.{' '}
                  <Link
                    href="/privacy"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Read our Privacy Policy
                  </Link>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  onClick={handleCustomize}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                  aria-label="Customize cookie preferences"
                >
                  <Settings size={16} />
                  Customize
                </button>
                <button
                  onClick={handleReject}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Reject all cookies"
                >
                  Reject
                </button>
                <button
                  onClick={handleAccept}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  aria-label="Accept all cookies"
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Customization panel
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-6 sm:p-8 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Cookie Preferences
              </h2>
              <button
                onClick={() => setShowCustomize(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close customization"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Essential cookies - always on */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Essential Cookies
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Required for the website to function properly. Cannot be disabled.
                  </p>
                </div>
                <div className="ml-4">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="w-4 h-4 rounded text-blue-600 opacity-50 cursor-not-allowed"
                    aria-label="Essential cookies (required)"
                  />
                </div>
              </div>

              {/* Analytics cookies */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Analytics Cookies
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Help us understand how visitors use our website and improve user experience.
                  </p>
                </div>
                <div className="ml-4">
                  <input
                    type="checkbox"
                    checked={analyticsEnabled}
                    onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    aria-label="Analytics cookies toggle"
                    id="analytics-toggle"
                  />
                  <label htmlFor="analytics-toggle" className="sr-only">
                    Analytics
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={() => setShowCustomize(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustom}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Get current cookie preferences
 */
export function getCookiePreferences(): CookiePreferences | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Check if analytics is enabled
 */
export function isAnalyticsEnabled(): boolean {
  const preferences = getCookiePreferences();

  // If no preference set, default to false (opt-in approach)
  if (!preferences) {
    return false;
  }

  return preferences.analytics;
}
