"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

const EXAMPLE_PROMPTS = [
  {
    label: "Motivation Video",
    prompt: "Create a motivational video about overcoming fear and taking action. Include powerful quotes and inspiring imagery.",
  },
  {
    label: "Explainer Video", 
    prompt: "Explain how compound interest works and why starting to invest early is crucial for building wealth.",
  },
  {
    label: "Fun Facts Video",
    prompt: "Share 10 mind-blowing facts about the human brain that most people don't know.",
  },
  {
    label: "History Documentary",
    prompt: "Tell the story of how the internet was invented and how it changed the world forever.",
  },
];

export function PromptInput() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!prompt.trim() || prompt.length < 10) {
      setError("Please enter at least 10 characters to describe your video idea.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptText: prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.fieldErrors?.promptText?.[0] || data.error || "Failed to save prompt");
      }

      // Redirect based on auth status
      if (data.isAuthenticated) {
        router.push("/app/new?draft=" + data.draftId);
      } else {
        router.push("/signup?draft=" + data.draftId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  function handleExampleClick(examplePrompt: string) {
    setPrompt(examplePrompt);
    setError(null);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setError(null);
            }}
            placeholder="Describe your video idea... e.g., 'Create a motivational video about overcoming fear and taking action'"
            className="w-full h-32 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            disabled={loading}
          />
          <div className="absolute bottom-3 right-3 text-xs text-gray-500">
            {prompt.length}/500
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm text-left bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="w-full px-8 py-4 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition font-semibold text-lg flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Generate Free Video <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-sm text-gray-500">
          1 free video render. We&apos;ll save your prompt.
        </p>
      </form>

      {/* Example prompts */}
      <div className="mt-8">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
          <Sparkles className="w-4 h-4" />
          <span>Try an example</span>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => handleExampleClick(example.prompt)}
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition"
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
