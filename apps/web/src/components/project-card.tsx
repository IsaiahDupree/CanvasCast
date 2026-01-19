'use client';

import Link from 'next/link';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import type { Project, Job } from '@canvascast/shared';

interface ProjectCardProps {
  project: Project & { jobs?: Job[] };
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'ready':
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-400" />;
    case 'generating':
      return <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />;
    default:
      return <Clock className="w-5 h-5 text-gray-400" />;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'failed':
      return 'Failed';
    case 'generating':
      return 'Generating...';
    default:
      return 'Draft';
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/app/projects/${project.id}`}
      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-brand-500/50 transition flex items-center gap-4"
    >
      <div className="flex-1">
        <h3 className="font-semibold mb-1">{project.title}</h3>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="capitalize">{project.niche_preset}</span>
          <span>{project.target_minutes} min</span>
          <span>{new Date(project.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {getStatusIcon(project.status)}
        <span className="text-sm text-gray-300">{getStatusLabel(project.status)}</span>
      </div>
    </Link>
  );
}
