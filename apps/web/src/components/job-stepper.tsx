'use client';

import { FileText, Mic, Music, Sparkles, Image, Layout, Film, Package, Check, Loader2 } from 'lucide-react';
import type { Job, JobStatus } from '@canvascast/shared';

const PIPELINE_STEPS = [
  { key: 'SCRIPTING' as JobStatus, label: 'Writing Script', icon: FileText },
  { key: 'VOICE_GEN' as JobStatus, label: 'Generating Voice', icon: Mic },
  { key: 'ALIGNMENT' as JobStatus, label: 'Syncing Audio', icon: Music },
  { key: 'VISUAL_PLAN' as JobStatus, label: 'Planning Visuals', icon: Sparkles },
  { key: 'IMAGE_GEN' as JobStatus, label: 'Creating Images', icon: Image },
  { key: 'TIMELINE_BUILD' as JobStatus, label: 'Building Timeline', icon: Layout },
  { key: 'RENDERING' as JobStatus, label: 'Rendering Video', icon: Film },
  { key: 'PACKAGING' as JobStatus, label: 'Packaging', icon: Package },
  { key: 'READY' as JobStatus, label: 'Complete', icon: Check },
];

interface JobStepperProps {
  job: Job;
}

export function JobStepper({ job }: JobStepperProps) {
  const currentStepIndex = PIPELINE_STEPS.findIndex(s => s.key === job.status);
  const activeIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  return (
    <div className="w-full py-8">
      <ol role="list" className="flex items-center justify-between gap-2">
        {PIPELINE_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isComplete = index < activeIndex || job.status === 'READY';
          const isCurrent = index === activeIndex && job.status !== 'READY';
          const isPending = index > activeIndex && job.status !== 'READY';
          const isFailed = job.status === 'FAILED';

          return (
            <li
              key={step.key}
              role="listitem"
              className="flex flex-col items-center flex-1 relative"
            >
              {/* Connector line */}
              {index < PIPELINE_STEPS.length - 1 && (
                <div
                  className={`absolute top-6 left-1/2 w-full h-0.5 -z-10 ${
                    isComplete
                      ? 'bg-brand-500'
                      : isPending
                      ? 'bg-gray-700'
                      : 'bg-brand-500/50'
                  }`}
                />
              )}

              {/* Icon circle */}
              <div
                className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                  isComplete
                    ? 'bg-brand-500 border-brand-500 text-white'
                    : isCurrent
                    ? 'bg-brand-500/20 border-brand-500 text-brand-400 animate-pulse'
                    : isFailed && index === activeIndex
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-gray-800 border-gray-700 text-gray-500'
                }`}
              >
                {isComplete && job.status !== 'READY' && index !== activeIndex ? (
                  <Check className="w-5 h-5" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>

              {/* Label */}
              <div className="mt-2 text-center">
                <p
                  className={`text-xs font-medium ${
                    isCurrent
                      ? 'text-brand-400'
                      : isComplete
                      ? 'text-gray-300'
                      : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </p>

                {/* Progress percentage for current step */}
                {isCurrent && (
                  <p className="text-xs text-brand-500 font-semibold mt-1">
                    {job.progress}%
                  </p>
                )}

                {/* Show 100% for completed job */}
                {job.status === 'READY' && step.key === 'READY' && (
                  <p className="text-xs text-brand-500 font-semibold mt-1">
                    100%
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
