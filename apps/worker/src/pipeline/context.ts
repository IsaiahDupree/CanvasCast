/**
 * Pipeline Context Creation and Management
 *
 * This module provides utilities for creating and managing pipeline context,
 * which is passed between all pipeline steps and accumulates artifacts.
 */

import type { JobRow, ProjectRow, PipelineContext, PipelineArtifacts } from "./types";
import { createBasePath, createOutputPath } from "./types";

/**
 * Creates a new pipeline context from job and project data
 *
 * @param job - The job row from the database
 * @param project - The project row from the database
 * @returns A new PipelineContext with initialized artifacts
 */
export function createPipelineContext(
  job: JobRow,
  project: ProjectRow
): PipelineContext {
  return {
    job,
    project,
    jobId: job.id,
    projectId: job.project_id,
    userId: job.user_id,
    basePath: createBasePath(job.user_id, job.project_id, job.id),
    outputPath: createOutputPath(job.user_id, job.project_id, job.id),
    artifacts: {},
  };
}

/**
 * Adds an artifact to the pipeline context
 *
 * Artifacts are accumulated as the pipeline progresses through steps.
 * Each step can add its outputs to the artifacts object.
 *
 * @param ctx - The pipeline context
 * @param key - The artifact key
 * @param value - The artifact value
 */
export function addArtifact<K extends keyof PipelineArtifacts>(
  ctx: PipelineContext,
  key: K,
  value: PipelineArtifacts[K]
): void {
  ctx.artifacts[key] = value;
}

/**
 * Retrieves an artifact from the pipeline context
 *
 * @param ctx - The pipeline context
 * @param key - The artifact key
 * @returns The artifact value, or undefined if not found
 */
export function getArtifact<K extends keyof PipelineArtifacts>(
  ctx: PipelineContext,
  key: K
): PipelineArtifacts[K] | undefined {
  return ctx.artifacts[key];
}

/**
 * Checks if an artifact exists in the context
 *
 * @param ctx - The pipeline context
 * @param key - The artifact key
 * @returns True if the artifact exists
 */
export function hasArtifact(
  ctx: PipelineContext,
  key: keyof PipelineArtifacts
): boolean {
  return key in ctx.artifacts && ctx.artifacts[key] !== undefined;
}

/**
 * Removes an artifact from the context
 *
 * @param ctx - The pipeline context
 * @param key - The artifact key
 */
export function removeArtifact(
  ctx: PipelineContext,
  key: keyof PipelineArtifacts
): void {
  delete ctx.artifacts[key];
}

/**
 * Clears all artifacts from the context
 *
 * @param ctx - The pipeline context
 */
export function clearArtifacts(ctx: PipelineContext): void {
  ctx.artifacts = {};
}
