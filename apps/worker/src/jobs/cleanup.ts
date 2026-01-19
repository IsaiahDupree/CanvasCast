/**
 * Asset Cleanup Job (STORAGE-003)
 *
 * Scheduled job to clean up temporary files from the temp-processing bucket.
 * Removes files older than 24 hours to prevent storage bloat.
 */

import { createAdminSupabase } from "../lib/supabase";

const TEMP_BUCKET = "temp-processing";
const MAX_AGE_HOURS = 24;
const BATCH_SIZE = 1000;

export interface CleanupResult {
  deleted: number;
  scanned: number;
}

/**
 * Cleans up temporary files older than 24 hours from the temp-processing bucket.
 *
 * @returns Object containing count of deleted and scanned files
 * @throws Error if unable to list files from storage
 */
export async function cleanupTempFiles(): Promise<CleanupResult> {
  const supabase = createAdminSupabase();

  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - MAX_AGE_HOURS);

  let totalDeleted = 0;
  let totalScanned = 0;
  let offset = 0;
  let hasMore = true;

  console.log(`[Cleanup] Starting temp file cleanup (cutoff: ${cutoffTime.toISOString()})`);

  while (hasMore) {
    // List files in batches
    const { data: files, error } = await supabase.storage
      .from(TEMP_BUCKET)
      .list("jobs", {
        limit: BATCH_SIZE,
        offset,
      });

    if (error) {
      throw new Error(`Failed to list temp files: ${error.message}`);
    }

    if (!files || files.length === 0) {
      hasMore = false;
      break;
    }

    totalScanned += files.length;

    // Filter files older than cutoff
    const filesToDelete = files.filter((file) => {
      const createdAt = new Date(file.created_at);
      return createdAt < cutoffTime;
    });

    // Delete old files
    if (filesToDelete.length > 0) {
      const pathsToDelete = filesToDelete.map((file) => `jobs/${file.name}`);

      const { error: deleteError } = await supabase.storage
        .from(TEMP_BUCKET)
        .remove(pathsToDelete);

      if (deleteError) {
        console.error(`[Cleanup] Failed to delete files: ${deleteError.message}`);
      } else {
        totalDeleted += filesToDelete.length;
        console.log(`[Cleanup] Deleted ${filesToDelete.length} old files`);
      }
    }

    // Check if we need to continue
    // Continue to next batch regardless of size, stop only when empty
    offset += BATCH_SIZE;
  }

  console.log(`[Cleanup] Completed: ${totalDeleted} deleted, ${totalScanned} scanned`);

  return {
    deleted: totalDeleted,
    scanned: totalScanned,
  };
}

/**
 * Schedules the cleanup job to run on a daily interval.
 *
 * @returns NodeJS.Timeout for the scheduled interval
 */
export async function scheduleCleanupJob(): Promise<NodeJS.Timeout> {
  const intervalMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  console.log("[Cleanup] Scheduling daily cleanup job");

  // Run immediately on startup
  try {
    await cleanupTempFiles();
  } catch (error) {
    console.error("[Cleanup] Initial cleanup failed:", error);
  }

  // Schedule for daily execution
  const interval = setInterval(async () => {
    try {
      await cleanupTempFiles();
    } catch (error) {
      console.error("[Cleanup] Scheduled cleanup failed:", error);
    }
  }, intervalMs);

  return interval;
}
