/**
 * FlowDesk 30-Day Free Standard Launch Promotion Service
 *
 * Implements server-side automatic trial provisioning, lifecycle tracking,
 * reminder delivery, and seamless downgrade to Starter upon expiration.
 */

import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';
import { NotificationHelper } from '@/backend/utilities/notification-helper';
import { PlanKey, SubscriptionStatus } from '@/shared/billing';

export interface TrialPromotionState {
  isTrialActive: boolean;
  isExpired: boolean;
  daysRemaining: number;
  planKey: PlanKey;
  status: SubscriptionStatus;
  trialStart: string | null;
  trialEnd: string | null;
  promotionType: string;
  announcementSeen: boolean;
  trialClaimed: boolean;
}

const TRIAL_DURATION_DAYS = 30;
const PROMOTION_TYPE = 'launch_standard_30d';

export class LaunchPromotionService {
  /**
   * Ensures the eligible workspace has received its automatic 30-day Standard promotion.
   * If already active, verifies expiry and sends due reminders.
   * If expired, safely updates status to 'expired'.
   */
  public static async ensureLaunchPromotion(
    workspaceId: string,
    ownerUserId?: string | null
  ): Promise<TrialPromotionState> {
    const defaultState: TrialPromotionState = {
      isTrialActive: false,
      isExpired: false,
      daysRemaining: 0,
      planKey: 'starter',
      status: 'active',
      trialStart: null,
      trialEnd: null,
      promotionType: PROMOTION_TYPE,
      announcementSeen: true,
      trialClaimed: false,
    };

    if (!workspaceId) return defaultState;

    if (isDemoModeActive() || workspaceId.startsWith('demo-')) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return {
        isTrialActive: true,
        isExpired: false,
        daysRemaining: 30,
        planKey: 'standard',
        status: 'trialing',
        trialStart: now.toISOString(),
        trialEnd: trialEnd.toISOString(),
        promotionType: PROMOTION_TYPE,
        announcementSeen: false,
        trialClaimed: true,
      };
    }

    if (!supabaseAdmin) return defaultState;

    try {
      // 1. Look up existing subscription row
      const { data: subData } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = new Date();
      const nowTime = now.getTime();

      // Case A: Subscription record exists
      if (subData) {
        const status = (subData.status as SubscriptionStatus) || 'active';
        const planKey = (subData.plan_key as PlanKey) || 'starter';
        const trialEndIso = subData.trial_end || subData.current_period_end;
        const trialStartIso = subData.trial_start || subData.current_period_start;
        const announcementSeen = Boolean(subData.announcement_seen);
        const trialClaimed = Boolean(subData.trial_claimed);

        // If paying subscriber or paid plan active
        if (status === 'active' && (planKey === 'standard' || planKey === 'studio') && !subData.trial_claimed) {
          return {
            isTrialActive: false,
            isExpired: false,
            daysRemaining: 0,
            planKey,
            status,
            trialStart: null,
            trialEnd: null,
            promotionType: PROMOTION_TYPE,
            announcementSeen: true,
            trialClaimed: false,
          };
        }

        // Check if trialing
        if (status === 'trialing' || subData.trial_status === 'active') {
          if (!trialEndIso) {
            // Missing end timestamp: compute 30 days from created_at
            const start = trialStartIso ? new Date(trialStartIso) : new Date(subData.created_at || nowTime);
            const calculatedEnd = new Date(start.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
            return this.evaluateTrialWindow(
              workspaceId,
              subData.id,
              start.toISOString(),
              calculatedEnd.toISOString(),
              announcementSeen,
              subData.trial_reminders_sent,
              ownerUserId
            );
          }

          return this.evaluateTrialWindow(
            workspaceId,
            subData.id,
            trialStartIso || now.toISOString(),
            trialEndIso,
            announcementSeen,
            subData.trial_reminders_sent,
            ownerUserId
          );
        }

        // Status is expired or canceled
        if (status === 'expired' || status === 'canceled') {
          return {
            isTrialActive: false,
            isExpired: true,
            daysRemaining: 0,
            planKey: 'starter',
            status: 'expired',
            trialStart: trialStartIso,
            trialEnd: trialEndIso,
            promotionType: PROMOTION_TYPE,
            announcementSeen: true,
            trialClaimed: true,
          };
        }

        // Otherwise Starter/Free
        return {
          isTrialActive: false,
          isExpired: false,
          daysRemaining: 0,
          planKey: 'starter',
          status,
          trialStart: null,
          trialEnd: null,
          promotionType: PROMOTION_TYPE,
          announcementSeen: true,
          trialClaimed,
        };
      }

      // Case B: No subscription row exists yet for this workspace
      // Prevent repeated claims if user already claimed trial on another workspace
      if (ownerUserId) {
        const { data: userWorkspaces } = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .eq('owner_id', ownerUserId);

        const wsIds = (userWorkspaces || []).map((w: any) => w.id).filter(Boolean);
        if (wsIds.length > 0) {
          const { data: previousTrials } = await supabaseAdmin
            .from('subscriptions')
            .select('id, trial_claimed')
            .in('workspace_id', wsIds)
            .eq('trial_claimed', true)
            .limit(1);

          if (previousTrials && previousTrials.length > 0) {
            // User has already claimed the launch promotion on another workspace
            await supabaseAdmin.from('subscriptions').insert({
              workspace_id: workspaceId,
              plan_key: 'starter',
              status: 'active',
              trial_claimed: true,
              announcement_seen: true,
            });

            return {
              isTrialActive: false,
              isExpired: false,
              daysRemaining: 0,
              planKey: 'starter',
              status: 'active',
              trialStart: null,
              trialEnd: null,
              promotionType: PROMOTION_TYPE,
              announcementSeen: true,
              trialClaimed: true,
            };
          }
        }
      }

      // Automatically provision the 30-day Standard promotion
      const trialStart = now.toISOString();
      const trialEndDate = new Date(nowTime + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
      const trialEnd = trialEndDate.toISOString();

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          workspace_id: workspaceId,
          plan_key: 'standard',
          status: 'trialing',
          current_period_start: trialStart,
          current_period_end: trialEnd,
          trial_start: trialStart,
          trial_end: trialEnd,
          promotion_type: PROMOTION_TYPE,
          trial_status: 'active',
          trial_claimed: true,
          announcement_seen: false,
          trial_reminders_sent: [],
        })
        .select()
        .single();

      if (insertErr) {
        logger.warn('Could not auto-provision launch trial (unique constraint race)', { error: insertErr.message });
        return defaultState;
      }

      // Send initial welcome notification in-app
      try {
        await NotificationHelper.notifyFreelancer({
          workspaceId,
          userId: ownerUserId || undefined,
          title: '🎉 30-Day Standard Access Activated',
          message:
            "Welcome to FlowDesk! You've received 30 days of Standard plan features completely free to celebrate our launch.",
          category: 'subscription',
          link: '/settings?tab=billing',
        });
      } catch {
        // non-blocking
      }

      return {
        isTrialActive: true,
        isExpired: false,
        daysRemaining: TRIAL_DURATION_DAYS,
        planKey: 'standard',
        status: 'trialing',
        trialStart,
        trialEnd,
        promotionType: PROMOTION_TYPE,
        announcementSeen: false,
        trialClaimed: true,
      };
    } catch (err: any) {
      logger.error('Error in ensureLaunchPromotion', err, { workspaceId });
      return defaultState;
    }
  }

  /**
   * Evaluates the trial window against current time.
   * If expired, transitions state to 'expired' and sends expiry notification.
   * If active, checks and sends reminder notifications for 7d, 3d, 1d milestones.
   */
  private static async evaluateTrialWindow(
    workspaceId: string,
    subscriptionId: string,
    trialStartIso: string,
    trialEndIso: string,
    announcementSeen: boolean,
    remindersSentJson: any,
    ownerUserId?: string | null
  ): Promise<TrialPromotionState> {
    const nowTime = Date.now();
    const endTime = new Date(trialEndIso).getTime();
    const diffMs = endTime - nowTime;

    // Has trial expired?
    if (diffMs <= 0) {
      if (supabaseAdmin) {
        try {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'expired',
              trial_status: 'expired',
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscriptionId);

          // Deliver trial expired in-app notification if not already sent
          await NotificationHelper.notifyFreelancer({
            workspaceId,
            userId: ownerUserId || undefined,
            title: 'Your free Standard period has ended',
            message:
              'Your 30-day FlowDesk launch benefit has expired. Your workspace is now on Starter. Upgrade to continue using Standard features, custom branding, automated reminders and higher workspace limits.',
            category: 'subscription',
            link: '/settings?tab=billing',
          });
        } catch {
          // ignore
        }
      }

      return {
        isTrialActive: false,
        isExpired: true,
        daysRemaining: 0,
        planKey: 'starter',
        status: 'expired',
        trialStart: trialStartIso,
        trialEnd: trialEndIso,
        promotionType: PROMOTION_TYPE,
        announcementSeen: true,
        trialClaimed: true,
      };
    }

    // Trial is currently active
    const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const remindersSent: string[] = Array.isArray(remindersSentJson) ? remindersSentJson : [];

    // Send reminders at 7 days, 3 days, 1 day remaining
    if (daysRemaining <= 7 && !remindersSent.includes('7d')) {
      await this.sendTrialReminder(
        workspaceId,
        subscriptionId,
        ownerUserId,
        '7d',
        '7 days remaining in your free Standard access',
        'Your 30-day launch benefit has 7 days remaining. Explore custom branding and automated reminders before your workspace moves to Starter.',
        remindersSent
      );
    } else if (daysRemaining <= 3 && !remindersSent.includes('3d')) {
      await this.sendTrialReminder(
        workspaceId,
        subscriptionId,
        ownerUserId,
        '3d',
        '3 days remaining in your free Standard access',
        'Only 3 days left in your Standard promotional period. Upgrade now to keep custom branding and unlimited invoicing.',
        remindersSent
      );
    } else if (daysRemaining <= 1 && !remindersSent.includes('1d')) {
      await this.sendTrialReminder(
        workspaceId,
        subscriptionId,
        ownerUserId,
        '1d',
        'Final day of your free Standard access',
        'Your 30-day Standard promotion expires today. Your workspace will move to Starter with 2 clients and 3 projects tomorrow unless you upgrade.',
        remindersSent
      );
    }

    return {
      isTrialActive: true,
      isExpired: false,
      daysRemaining,
      planKey: 'standard',
      status: 'trialing',
      trialStart: trialStartIso,
      trialEnd: trialEndIso,
      promotionType: PROMOTION_TYPE,
      announcementSeen,
      trialClaimed: true,
    };
  }

  private static async sendTrialReminder(
    workspaceId: string,
    subscriptionId: string,
    ownerUserId: string | null | undefined,
    milestone: string,
    title: string,
    message: string,
    existingReminders: string[]
  ): Promise<void> {
    try {
      await NotificationHelper.notifyFreelancer({
        workspaceId,
        userId: ownerUserId || undefined,
        title,
        message,
        category: 'subscription',
        link: '/settings?tab=billing',
      });

      if (supabaseAdmin) {
        const updated = [...existingReminders, milestone];
        await supabaseAdmin
          .from('subscriptions')
          .update({
            trial_reminders_sent: updated,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscriptionId);
      }
    } catch {
      // non-critical
    }
  }

  /**
   * Marks the welcome launch announcement as seen so it is never shown again.
   */
  public static async dismissAnnouncement(workspaceId: string): Promise<boolean> {
    if (!workspaceId) return false;
    if (isDemoModeActive() || workspaceId.startsWith('demo-')) return true;
    if (!supabaseAdmin) return true;

    try {
      const { error } = await supabaseAdmin
        .from('subscriptions')
        .update({
          announcement_seen: true,
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId);

      return !error;
    } catch {
      return false;
    }
  }
}
