/**
 * Asset Retention Cleanup Job (GDPR-001)
 *
 * Scheduled job to clean up old job assets after a configurable retention period.
 * This helps comply with GDPR data retention policies and prevents storage bloat.
 */

import { createAdminSupabase } from "../lib/supabase";
import { emailQueue } from "../queues/email";

const DEFAULT_RETENTION_DAYS = 90;
const BATCH_SIZE = 100;

export interface CleanupResult {
  deleted: number;
  scanned: number;
}

/**
 * Cleans up assets older than the specified retention period.
 *
 * @param retentionDays - Number of days to retain assets (default: 90)
 * @param notifyUsers - Whether to send notification emails to users (default: false)
 * @returns Object containing count of deleted and scanned assets
 * @throws Error if unable to fetch assets from database
 */
export async function cleanupOldAssets(
  retentionDays: number = DEFAULT_RETENTION_DAYS,
  notifyUsers: boolean = false
): Promise<CleanupResult> {
  const supabase = createAdminSupabase();

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  console.log(`[Asset Cleanup] Starting cleanup (cutoff: ${cutoffDate.toISOString()}, retention: ${retentionDays} days)`);

  // Fetch old assets from database
  const { data: oldAssets, error } = await supabase
    .from("assets")
    .select("*")
    .lt("created_at", cutoffDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch old assets: ${error.message}`);
  }

  if (!oldAssets || oldAssets.length === 0) {
    console.log("[Asset Cleanup] No old assets found");
    return {
      deleted: 0,
      scanned: 0,
    };
  }

  console.log(`[Asset Cleanup] Found ${oldAssets.length} old assets to clean up`);

  let totalDeleted = 0;
  const totalScanned = oldAssets.length;

  // Group assets by user for notifications
  const assetsByUser = new Map<string, typeof oldAssets>();
  for (const asset of oldAssets) {
    const userId = asset.user_id;
    if (!assetsByUser.has(userId)) {
      assetsByUser.set(userId, []);
    }
    assetsByUser.get(userId)!.push(asset);
  }

  // Send notifications to users before deletion
  if (notifyUsers) {
    for (const [userId, userAssets] of assetsByUser.entries()) {
      try {
        // Fetch user email from profiles
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .single();

        if (profileError || !profile) {
          console.error(`[Asset Cleanup] Failed to fetch user profile: ${userId}`);
          continue;
        }

        // Queue notification email
        await emailQueue.add("asset-retention-notice", {
          to: profile.email,
          userId,
          assetCount: userAssets.length,
          retentionDays,
        });

        console.log(`[Asset Cleanup] Queued notification for user ${userId} (${userAssets.length} assets)`);
      } catch (err) {
        console.error(`[Asset Cleanup] Failed to send notification to user ${userId}:`, err);
      }
    }
  }

  // Delete assets in batches
  for (let i = 0; i < oldAssets.length; i += BATCH_SIZE) {
    const batch = oldAssets.slice(i, i + BATCH_SIZE);
    const assetIds = batch.map((a) => a.id);
    const storagePaths = batch
      .filter((a) => a.storage_path)
      .map((a) => a.storage_path);

    // Delete from storage bucket
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("generated-assets")
        .remove(storagePaths);

      if (storageError) {
        console.error(`[Asset Cleanup] Failed to delete files from storage: ${storageError.message}`);
      } else {
        console.log(`[Asset Cleanup] Deleted ${storagePaths.length} files from storage`);
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("assets")
      .delete()
      .in("id", assetIds);

    if (deleteError) {
      console.error(`[Asset Cleanup] Failed to delete assets from database: ${deleteError.message}`);
    } else {
      totalDeleted += batch.length;
      console.log(`[Asset Cleanup] Deleted ${batch.length} asset records from database`);
    }
  }

  console.log(`[Asset Cleanup] Completed: ${totalDeleted} deleted, ${totalScanned} scanned`);

  return {
    deleted: totalDeleted,
    scanned: totalScanned,
  };
}

/**
 * Schedules the asset cleanup job to run on a daily interval.
 *
 * @returns NodeJS.Timeout for the scheduled interval
 */
export function scheduleAssetCleanupJob(): NodeJS.Timeout {
  const intervalMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  console.log("[Asset Cleanup] Scheduling daily asset cleanup job");

  // Run immediately on startup
  (async () => {
    try {
      await cleanupOldAssets(DEFAULT_RETENTION_DAYS, true);
    } catch (error) {
      console.error("[Asset Cleanup] Initial cleanup failed:", error);
    }
  })();

  // Schedule for daily execution
  const interval = setInterval(async () => {
    try {
      await cleanupOldAssets(DEFAULT_RETENTION_DAYS, true);
    } catch (error) {
      console.error("[Asset Cleanup] Scheduled cleanup failed:", error);
    }
  }, intervalMs);

  return interval;
}
