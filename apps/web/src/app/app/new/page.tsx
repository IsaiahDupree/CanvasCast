"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Sparkles, Mic, AlertCircle, FileText } from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const NICHE_PRESETS = [
  { id: "motivation", label: "Motivation", emoji: "💪" },
  { id: "explainer", label: "Explainer", emoji: "📚" },
  { id: "facts", label: "Facts & Trivia", emoji: "🧠" },
  { id: "documentary", label: "Documentary", emoji: "🎬" },
  { id: "finance", label: "Finance", emoji: "💰" },
  { id: "tech", label: "Tech", emoji: "⚡" },
  { id: "history", label: "History", emoji: "📜" },
  { id: "science", label: "Science", emoji: "🔬" },
];

const LENGTH_OPTIONS = [
  { value: 5, label: "5 min" },
  { value: 8, label: "8 min" },
  { value: 10, label: "10 min" },
  { value: 12, label: "12 min" },
];

// Transcript mode options per PRD
const TRANSCRIPT_MODES = [
  { id: "auto", label: "Auto-generate from prompt", description: "AI will write your script" },
  { id: "manual", label: "Paste my transcript", description: "Use your own script" },
];

interface VoiceProfile {
  id: string;
  name: string;
  status: string;
}

export default function NewProjectPage() {
  const [title, setTitle] = useState("");
  const [niche, setNiche] = useState("");
  const [length, setLength] = useState(10);
  const [content, setContent] = useState("");
  const [transcriptMode, setTranscriptMode] = useState("auto");
  const [transcript, setTranscript] = useState("");
  const [voiceProfileId, setVoiceProfileId] = useState<string | null>(null);
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficientCredits, setInsufficientCredits] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load draft prompt if available
  useEffect(() => {
    async function loadDraft() {
      if (!draftId) return;
      
      setLoadingDraft(true);
      try {
        const res = await fetch("/api/draft");
        const data = await res.json();
        
        if (data.draft) {
          setContent(data.draft.promptText);
          setHasDraft(true);
          // Try to extract a title from the prompt
          const firstSentence = data.draft.promptText.split(/[.!?]/)[0];
          if (firstSentence && firstSentence.length < 80) {
            setTitle(firstSentence.trim());
          }
        }
      } catch (err) {
        console.error("Failed to load draft:", err);
      } finally {
        setLoadingDraft(false);
      }
    }
    loadDraft();
  }, [draftId]);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch credit balance
      const { data: balance } = await supabase.rpc("get_credit_balance", {
        p_user_id: user.id,
      });
      setCredits(balance ?? 0);

      // Fetch voice profiles
      const { data: profiles } = await supabase
        .from("voice_profiles")
        .select("id, name, status")
        .eq("user_id", user.id)
        .eq("status", "approved");
      
      setVoiceProfiles(profiles ?? []);
    }
    fetchData();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !niche) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError(null);
    setInsufficientCredits(false);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          niche_preset: niche,
          target_minutes: length,
          prompt_text: content || undefined,
          transcript_mode: transcriptMode,
          transcript_text: transcriptMode === "manual" ? transcript : undefined,
          voice_profile_id: voiceProfileId || undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 402) {
        setInsufficientCredits(true);
        setError(`Insufficient credits. You need ${data.required} credits but have ${data.available}.`);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      // Redirect to job status page per PRD flow
      router.push(`/app/jobs/${data.job.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Project</h1>
        <p className="text-gray-400">
          Set up your video project and we&apos;ll generate everything for you
        </p>
      </div>

      {/* Draft Restored Banner */}
      {hasDraft && (
        <div className="p-4 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center gap-3 mb-6">
          <Sparkles className="w-5 h-5 text-brand-400 flex-shrink-0" />
          <div>
            <p className="text-brand-400 font-medium">Your prompt has been restored!</p>
            <p className="text-sm text-gray-400">Edit below and complete your video setup.</p>
          </div>
        </div>
      )}

      {loadingDraft && (
        <div className="p-4 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3 mb-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="text-gray-400">Loading your saved prompt...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Credit Balance Display */}
        {credits !== null && (
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
            <span className="text-gray-400">Your credits:</span>
            <span className={`text-xl font-bold ${credits < length ? 'text-red-400' : 'text-brand-400'}`}>
              {credits} minutes
            </span>
          </div>
        )}

        {error && (
          <div className={`p-4 rounded-lg border text-sm flex items-start gap-3 ${
            insufficientCredits 
              ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {insufficientCredits && (
                <Link 
                  href="/app/credits" 
                  className="inline-block mt-2 text-brand-400 hover:text-brand-300 font-medium"
                >
                  Buy more credits →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">
            Video Title <span className="text-red-400">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Why Most People Fail at Starting YouTube"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition"
          />
        </div>

        {/* Niche Preset */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Choose Your Niche <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {NICHE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setNiche(preset.id)}
                className={`p-4 rounded-lg border text-left transition ${
                  niche === preset.id
                    ? "bg-brand-500/20 border-brand-500 text-white"
                    : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
                }`}
              >
                <span className="text-2xl mb-2 block">{preset.emoji}</span>
                <span className="font-medium">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Length */}
        <div>
          <label className="block text-sm font-medium mb-3">Video Length</label>
          <div className="flex gap-3">
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLength(opt.value)}
                className={`px-6 py-3 rounded-lg border font-medium transition ${
                  length === opt.value
                    ? "bg-brand-500/20 border-brand-500 text-white"
                    : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            This will cost approximately {length} credits
          </p>
        </div>

        {/* Voice Selection */}
        <div>
          <label className="block text-sm font-medium mb-3">
            <Mic className="w-4 h-4 inline mr-2" />
            Voice
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setVoiceProfileId(null)}
              className={`px-4 py-2 rounded-lg border font-medium transition ${
                voiceProfileId === null
                  ? "bg-brand-500/20 border-brand-500 text-white"
                  : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
              }`}
            >
              Default AI Voice
            </button>
            {voiceProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setVoiceProfileId(profile.id)}
                className={`px-4 py-2 rounded-lg border font-medium transition ${
                  voiceProfileId === profile.id
                    ? "bg-brand-500/20 border-brand-500 text-white"
                    : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
                }`}
              >
                {profile.name}
              </button>
            ))}
          </div>
          {voiceProfiles.length === 0 && (
            <p className="text-xs text-gray-500 mt-2">
              <Link href="/app/settings" className="text-brand-400 hover:underline">
                Upload your voice samples
              </Link>{" "}
              to use your own voice
            </p>
          )}
        </div>

        {/* Transcript Mode Selection - Per PRD */}
        <div>
          <label className="block text-sm font-medium mb-3">
            <FileText className="w-4 h-4 inline mr-2" />
            Script / Transcript
          </label>
          <div className="flex gap-3 mb-4">
            {TRANSCRIPT_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTranscriptMode(mode.id)}
                className={`flex-1 p-4 rounded-lg border text-left transition ${
                  transcriptMode === mode.id
                    ? "bg-brand-500/20 border-brand-500 text-white"
                    : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
                }`}
              >
                <span className="font-medium block mb-1">{mode.label}</span>
                <span className="text-xs text-gray-400">{mode.description}</span>
              </button>
            ))}
          </div>

          {/* Prompt/Content Input (for auto mode) */}
          {transcriptMode === "auto" && (
            <div>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe what your video should cover... e.g., 'Create a motivational video about overcoming fear and taking action. Include powerful quotes and inspiring imagery.'"
                rows={5}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                AI will generate a professional script based on your description
              </p>
            </div>
          )}

          {/* Manual Transcript Input */}
          {transcriptMode === "manual" && (
            <div>
              <textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your complete script/transcript here. This will be used as the narration for your video..."
                rows={8}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                Your script will be used as-is for narration. We&apos;ll generate visuals to match.
              </p>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading || !title || !niche}
            className="w-full py-4 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Create Project
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
