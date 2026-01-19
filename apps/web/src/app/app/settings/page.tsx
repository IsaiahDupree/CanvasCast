"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Mail, Loader2, CheckCircle, User, CreditCard } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

type NotificationPrefs = {
  email_job_started: boolean;
  email_job_completed: boolean;
  email_job_failed: boolean;
  email_credits_low: boolean;
  email_account_status: boolean;
  marketing_opt_in: boolean;
};

type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Subscription = {
  id: string;
  plan: string;
  status: string;
  credits_per_month: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

const defaultPrefs: NotificationPrefs = {
  email_job_started: false,
  email_job_completed: true,
  email_job_failed: true,
  email_credits_low: true,
  email_account_status: true,
  marketing_opt_in: false,
};

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch notification preferences
      const { data: prefsData } = await supabase
        .from("user_notification_prefs")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (prefsData) {
        setPrefs({
          email_job_started: prefsData.email_job_started,
          email_job_completed: prefsData.email_job_completed,
          email_job_failed: prefsData.email_job_failed,
          email_credits_low: prefsData.email_credits_low,
          email_account_status: prefsData.email_account_status,
          marketing_opt_in: prefsData.marketing_opt_in,
        });
      }

      // Fetch subscription
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (subData) {
        setSubscription(subData);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Save profile if it exists
      if (profile) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            display_name: profile.display_name,
            email: profile.email,
            avatar_url: profile.avatar_url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (profileError) throw profileError;
      }

      // Save notification preferences
      const { error: prefsError } = await supabase
        .from("user_notification_prefs")
        .upsert({
          user_id: user.id,
          ...prefs,
          updated_at: new Date().toISOString(),
        });

      if (prefsError) throw prefsError;

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelSubscription() {
    if (!subscription) return;

    try {
      const response = await fetch("/api/v1/subscriptions/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to cancel subscription");

      // Refresh data
      await fetchData();
    } catch (err) {
      console.error("Failed to cancel subscription:", err);
    }
  }

  function togglePref(key: keyof NotificationPrefs) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400">Manage your profile, notifications, and subscription</p>
      </div>

      {/* Profile Settings */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Profile
        </h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium mb-2">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={profile?.display_name || ""}
              onChange={(e) =>
                setProfile((prev) =>
                  prev ? { ...prev, display_name: e.target.value } : null
                )
              }
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-brand-400"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={profile?.email || ""}
              onChange={(e) =>
                setProfile((prev) =>
                  prev ? { ...prev, email: e.target.value } : null
                )
              }
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-brand-400"
            />
          </div>
        </div>
      </div>

      {/* Email Notifications */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Email Notifications
        </h2>

        <div className="space-y-4">
          <ToggleItem
            label="Job Started"
            description="Get notified when your video starts generating"
            checked={prefs.email_job_started}
            onChange={() => togglePref("email_job_started")}
          />
          <ToggleItem
            label="Job Completed"
            description="Get notified when your video is ready to download"
            checked={prefs.email_job_completed}
            onChange={() => togglePref("email_job_completed")}
          />
          <ToggleItem
            label="Job Failed"
            description="Get notified if something goes wrong during generation"
            checked={prefs.email_job_failed}
            onChange={() => togglePref("email_job_failed")}
          />
          <ToggleItem
            label="Credits Low"
            description="Get notified when your credits are running low"
            checked={prefs.email_credits_low}
            onChange={() => togglePref("email_credits_low")}
          />
          <ToggleItem
            label="Account Updates"
            description="Important updates about your account"
            checked={prefs.email_account_status}
            onChange={() => togglePref("email_account_status")}
          />
        </div>
      </div>

      {/* Marketing */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Marketing & Updates
        </h2>

        <ToggleItem
          label="Product Updates & Promotions"
          description="New features, template packs, and special offers"
          checked={prefs.marketing_opt_in}
          onChange={() => togglePref("marketing_opt_in")}
        />
      </div>

      {/* Subscription Management */}
      {subscription && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Subscription
          </h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium capitalize">{subscription.plan} Plan</div>
                <div className="text-sm text-gray-400">
                  {subscription.credits_per_month} credits per month
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm ${
                subscription.status === "active"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}>
                {subscription.status}
              </div>
            </div>

            {subscription.current_period_end && (
              <div className="text-sm text-gray-400">
                {subscription.cancel_at_period_end
                  ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  : `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`}
              </div>
            )}

            {!subscription.cancel_at_period_end && (
              <button
                onClick={handleCancelSubscription}
                className="w-full py-2 px-4 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 transition font-medium"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition font-semibold flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving...
          </>
        ) : saved ? (
          <>
            <CheckCircle className="w-5 h-5" />
            Saved!
          </>
        ) : (
          "Save Settings"
        )}
      </button>
    </div>
  );
}

function ToggleItem({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
      <button
        onClick={onChange}
        className={`relative w-12 h-6 rounded-full transition ${
          checked ? "bg-brand-500" : "bg-gray-600"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition ${
            checked ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
