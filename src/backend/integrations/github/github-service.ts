import crypto from 'crypto';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';

// 10-minute in-memory idempotency deduplication cache
const processedDeliveryCache = new Map<string, number>();

function cleanDeliveryCache() {
  const now = Date.now();
  for (const [deliveryId, timestamp] of processedDeliveryCache.entries()) {
    if (now - timestamp > 10 * 60 * 1000) {
      processedDeliveryCache.delete(deliveryId);
    }
  }
}

export interface GitHubWebhookPayload {
  action?: string;
  repository?: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
  };
  pull_request?: {
    id: number;
    number: number;
    title: string;
    html_url: string;
    state: string;
    merged: boolean;
    head: { ref: string; sha: string };
    base: { ref: string };
    user: { login: string };
  };
  release?: {
    id: number;
    tag_name: string;
    name: string;
    html_url: string;
    published_at: string;
    author: { login: string };
  };
  deployment_status?: {
    id: number;
    state: 'pending' | 'success' | 'failure' | 'error' | 'in_progress';
    target_url?: string;
    environment?: string;
    description?: string;
  };
  installation?: {
    id: number;
  };
}

export const GitHubService = {
  /**
   * Check if GitHub App / Webhook integration credentials exist server-side
   */
  isConfigured: (): boolean => {
    if (typeof window !== 'undefined') return false;
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    const appId = process.env.GITHUB_APP_ID;
    return Boolean(webhookSecret || appId);
  },

  /**
   * Validates GitHub HMAC-SHA256 signature securely against timing attacks
   */
  verifyWebhookSignature: (
    rawBody: string,
    signatureHeader: string | null | undefined,
    secret?: string
  ): boolean => {
    const webhookSecret = secret || process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // In development/test mode without a secret configured, fail closed unless test explicitly passes secret
      return false;
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    try {
      const signature = signatureHeader.slice(7);
      const hmac = crypto.createHmac('sha256', webhookSecret);
      const digest = hmac.update(rawBody).digest('hex');

      const sigBuffer = Buffer.from(signature, 'hex');
      const digestBuffer = Buffer.from(digest, 'hex');

      if (sigBuffer.length !== digestBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuffer, digestBuffer);
    } catch {
      return false;
    }
  },

  /**
   * Processes GitHub Webhook event idempotently and updates Deliverable technical activity
   */
  processWebhookEvent: async (
    event: string,
    deliveryId: string,
    payload: GitHubWebhookPayload
  ): Promise<{ success: boolean; actionTaken: string }> => {
    cleanDeliveryCache();

    // Idempotency check
    if (processedDeliveryCache.has(deliveryId)) {
      return { success: true, actionTaken: 'duplicate_delivery_ignored' };
    }
    processedDeliveryCache.set(deliveryId, Date.now());

    const repoUrl = payload.repository?.html_url;
    const repoFullName = payload.repository?.full_name;

    if (!repoUrl && !repoFullName) {
      return { success: true, actionTaken: 'no_repository_in_payload' };
    }

    // Demo mode: log and return
    if (isDemoModeActive()) {
      return { success: true, actionTaken: `demo_processed_${event}` };
    }

    try {
      // Find deliverables matching repositoryUrl in their nicheMetadata
      const { data: deliverables, error } = await supabaseAdmin
        .from('deliverables')
        .select('id, workspace_id, title, metadata, niche');

      if (error || !deliverables || deliverables.length === 0) {
        return { success: true, actionTaken: 'no_deliverables_found' };
      }

      const matching = deliverables.filter((d) => {
        const meta = d.metadata || {};
        const dRepo = (meta.repositoryUrl || '').toLowerCase().trim();
        const target = (repoUrl || '').toLowerCase().trim();
        return dRepo && (target.includes(dRepo) || dRepo.includes(target) || (repoFullName && dRepo.includes(repoFullName.toLowerCase())));
      });

      if (matching.length === 0) {
        return { success: true, actionTaken: 'no_matching_deliverables' };
      }

      for (const d of matching) {
        const meta = { ...(d.metadata || {}) };
        const activityItem = {
          id: `gh-${deliveryId || Date.now()}`,
          timestamp: new Date().toISOString(),
          type: event,
          message: '',
          author: '',
          url: '',
        };

        if (event === 'pull_request' && payload.pull_request) {
          const pr = payload.pull_request;
          activityItem.author = pr.user?.login || 'GitHub';
          activityItem.url = pr.html_url;

          if (pr.merged) {
            activityItem.message = `PR #${pr.number} merged: "${pr.title}"`;
            meta.technicalStatus = 'qa_testing';
          } else if (payload.action === 'opened' || payload.action === 'synchronize') {
            activityItem.message = `PR #${pr.number} updated: "${pr.title}"`;
            meta.pullRequestUrl = pr.html_url;
            meta.branchName = pr.head?.ref || meta.branchName;
            meta.technicalStatus = 'code_review';
          } else {
            activityItem.message = `PR #${pr.number} [${payload.action}]: "${pr.title}"`;
          }
        } else if (event === 'release' && payload.release) {
          const rel = payload.release;
          activityItem.author = rel.author?.login || 'GitHub';
          activityItem.url = rel.html_url;
          activityItem.message = `Release published: ${rel.tag_name} (${rel.name || 'Release'})`;
          meta.releaseVersion = rel.tag_name;
          meta.technicalStatus = 'deployed';
        } else if (event === 'deployment_status' && payload.deployment_status) {
          const ds = payload.deployment_status;
          activityItem.message = `Deployment status: ${ds.state}${ds.environment ? ` (${ds.environment})` : ''}`;
          activityItem.url = ds.target_url || '';
          if (ds.state === 'success') {
            meta.buildStatus = 'success';
            if (ds.target_url) meta.previewUrl = ds.target_url;
          } else if (ds.state === 'failure' || ds.state === 'error') {
            meta.buildStatus = 'failed';
          } else if (ds.state === 'pending' || ds.state === 'in_progress') {
            meta.buildStatus = 'pending';
          }
        } else {
          activityItem.message = `GitHub event received: ${event} [${payload.action || 'dispatched'}]`;
        }

        // Append to activity log in metadata (capped at latest 20 items)
        const currentActivity = Array.isArray(meta.githubActivity) ? meta.githubActivity : [];
        meta.githubActivity = [activityItem, ...currentActivity].slice(0, 20);

        // Update deliverable metadata in database
        // CRITICAL: We do NOT auto-approve deliverable. Approval remains client-authoritative.
        await supabaseAdmin
          .from('deliverables')
          .update({
            metadata: meta,
            updated_at: new Date().toISOString(),
          })
          .eq('id', d.id);

        logger.info(`[GitHubService] Processed ${event} for deliverable ${d.id}`);
      }

      return { success: true, actionTaken: `updated_${matching.length}_deliverables` };
    } catch (err: any) {
      logger.error('[GitHubService] Error processing webhook:', err);
      return { success: false, actionTaken: 'error' };
    }
  },
};
