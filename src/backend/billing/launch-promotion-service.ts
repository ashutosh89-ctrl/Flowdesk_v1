/**
 * FlowDesk 30-Day Free Standard Launch Promotion Service
 *
 * Implements server-side automatic trial provisioning, lifecycle tracking,
 * reminder delivery, and seamless downgrade to Starter upon expiration
 * for BOTH new registrations and all existing customers.
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
   * Helper to safely persist promotion state into entitlement_overrides without requiring a unique constraint.
   */
  private static async upsertPromoOverride(
    workspaceId: string,
    value: Record<string, any>,
    reason: string
  ): Promise<void> {
    if (!supabaseAdmin || !workspaceId) return;
    try {
      const { data: existing } = await supabaseAdmin
        .from('entitlement_overrides')
        .select('id, value')
        .eq('workspace_id', workspaceId)
        .eq('feature', 'launch_promotion_state')
        .maybeSingle();

      const cur = existing?.value && typeof existing.value === 'object' ? existing.value : {};
      const merged = { ...cur, ...value };

      if (existing) {
        await supabaseAdmin
          .from('entitlement_overrides')
          .update({ value: merged })
          .eq('id', existing.id);
      } else {
        await supabaseAdmin.from('entitlement_overrides').insert({
          workspace_id: workspaceId,
          feature: 'launch_promotion_state',
          value: merged,
          reason,
        });
      }
    } catch (err: any) {
      logger.warn('Failed to upsert promo override', { error: err?.message, workspaceId });
    }
  }

  /**
   * Ensures the eligible workspace has received its automatic 30-day Standard promotion.
   * If an existing customer has not received it, grants it immediately.
   * If already active, verifies expiry and sends milestone reminders.
   * If expired, safely updates status to 'expired' and downgrades to Starter.
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
      // 1. Fetch promo state from entitlement_overrides (resilient cross-table store)
      let promoOverride: any = null;
      try {
        const { data: overrideRow } = await supabaseAdmin
          .from('entitlement_overrides')
          .select('value')
          .eq('workspace_id', workspaceId)
          .eq('feature', 'launch_promotion_state')
          .maybeSingle();

        if (overrideRow?.value && typeof overrideRow.value === 'object') {
          promoOverride = overrideRow.value;
        }
      } catch {
        // non-blocking
      }

      // 2. Look up existing subscription row
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
        const trialEndIso = subData.trial_end || subData.current_period_end || promoOverride?.trial_end;
        const trialStartIso = subData.trial_start || subData.current_period_start || promoOverride?.trial_start;
        const announcementSeen = Boolean(subData.announcement_seen || promoOverride?.announcement_seen);
        const trialClaimed = Boolean(
          subData.trial_claimed ||
          promoOverride?.trial_claimed ||
          subData.provider === 'launch_standard_30d' ||
          status === 'trialing'
        );

        // If active paid subscriber with Razorpay subscription ID
        if (
          status === 'active' &&
          (planKey === 'standard' || planKey === 'studio') &&
          subData.razorpay_subscription_id
        ) {
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

        // Active Trialing state
        if (status === 'trialing' || subData.trial_status === 'active' || subData.provider === 'launch_standard_30d') {
          if (!trialEndIso) {
            const start = trialStartIso ? new Date(trialStartIso) : new Date(subData.created_at || nowTime);
            const calculatedEnd = new Date(start.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
            return this.evaluateTrialWindow(
              workspaceId,
              subData.id,
              start.toISOString(),
              calculatedEnd.toISOString(),
              announcementSeen,
              subData.trial_reminders_sent || promoOverride?.trial_reminders_sent,
              ownerUserId
            );
          }

          return this.evaluateTrialWindow(
            workspaceId,
            subData.id,
            trialStartIso || now.toISOString(),
            trialEndIso,
            announcementSeen,
            subData.trial_reminders_sent || promoOverride?.trial_reminders_sent,
            ownerUserId
          );
        }

        // Status is expired or canceled
        if (status === 'expired' || status === 'canceled' || promoOverride?.trial_expired) {
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

        // Case A.4: Existing user currently on Starter/Free who has NOT claimed the launch promotion yet!
        // Automatically grant them the 1-month Free Standard Pack promotion now.
        if (!trialClaimed) {
          const trialStart = now.toISOString();
          const trialEndDate = new Date(nowTime + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
          const trialEnd = trialEndDate.toISOString();

          // 1. Update existing subscriptions row
          try {
            await supabaseAdmin
              .from('subscriptions')
              .update({
                plan_key: 'standard',
                status: 'trialing',
                current_period_start: trialStart,
                current_period_end: trialEnd,
                provider: 'launch_standard_30d',
                provider_subscription_id: 'trial_standard_30d',
                updated_at: new Date().toISOString(),
              })
              .eq('id', subData.id);
          } catch (err: any) {
            logger.warn('Notice updating subscription record for existing user promotion', { error: err?.message });
          }

          // Optional update if schema columns exist
          try {
            await supabaseAdmin
              .from('subscriptions')
              .update({
                trial_start: trialStart,
                trial_end: trialEnd,
                promotion_type: PROMOTION_TYPE,
                trial_status: 'active',
                trial_claimed: true,
                announcement_seen: false,
                trial_reminders_sent: [],
              })
              .eq('id', subData.id);
          } catch {
            // non-blocking
          }

          // 2. Persist in entitlement_overrides
          await this.upsertPromoOverride(
            workspaceId,
            {
              trial_claimed: true,
              announcement_seen: false, // Ensures pop-up modal is displayed
              promotion_type: PROMOTION_TYPE,
              trial_start: trialStart,
              trial_end: trialEnd,
              is_existing_user: true,
              trial_reminders_sent: [],
            },
            'Automatic 30-Day Free Standard Launch Promotion for existing customer'
          );

          // 3. Send in-app notification to the existing user
          try {
            await NotificationHelper.notifyFreelancer({
              workspaceId,
              userId: ownerUserId || undefined,
              title: '🎉 1 Month Free Standard Pack Activated!',
              message:
                "As an existing customer, you've received 1 month of the Standard pack free of charge to celebrate our new launch! Enjoy custom branding, 15 clients, 25 projects, and automated reminders.",
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
        }

        // Fallback for claimed starter
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
          trialClaimed: true,
        };
      }

      // Case B: No subscription row exists yet for this workspace (New Registration)
      // Check if user already claimed trial on another workspace to prevent abuse
      if (ownerUserId) {
        const { data: userWorkspaces } = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .eq('owner_id', ownerUserId);

        const wsIds = (userWorkspaces || []).map((w: any) => w.id).filter(Boolean);
        if (wsIds.length > 0) {
          const { data: previousTrials } = await supabaseAdmin
            .from('subscriptions')
            .select('id, trial_claimed, provider')
            .in('workspace_id', wsIds)
            .or('trial_claimed.eq.true,provider.eq.launch_standard_30d')
            .limit(1);

          if (previousTrials && previousTrials.length > 0) {
            // User already claimed on another workspace
            await supabaseAdmin.from('subscriptions').insert({
              workspace_id: workspaceId,
              plan_key: 'starter',
              status: 'active',
              billing_interval: 'monthly',
              provider: 'razorpay',
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

      // Automatically provision the 30-day Standard launch promotion
      const trialStart = now.toISOString();
      const trialEndDate = new Date(nowTime + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
      const trialEnd = trialEndDate.toISOString();

      try {
        await supabaseAdmin.from('subscriptions').insert({
          workspace_id: workspaceId,
          plan_key: 'standard',
          status: 'trialing',
          current_period_start: trialStart,
          current_period_end: trialEnd,
          billing_interval: 'monthly',
          provider: 'launch_standard_30d',
          provider_subscription_id: 'trial_standard_30d',
        });
      } catch (insertErr: any) {
        logger.warn('Could not insert subscriptions row for new workspace trial', { error: insertErr?.message });
      }

      // Optional insert for custom columns if available
      try {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            trial_start: trialStart,
            trial_end: trialEnd,
            promotion_type: PROMOTION_TYPE,
            trial_status: 'active',
            trial_claimed: true,
            announcement_seen: false,
            trial_reminders_sent: [],
          })
          .eq('workspace_id', workspaceId);
      } catch {
        // non-blocking
      }

      // Save in entitlement_overrides
      await this.upsertPromoOverride(
        workspaceId,
        {
          trial_claimed: true,
          announcement_seen: false,
          promotion_type: PROMOTION_TYPE,
          trial_start: trialStart,
          trial_end: trialEnd,
          is_existing_user: false,
          trial_reminders_sent: [],
        },
        'Automatic 30-Day Free Standard Launch Promotion for new customer'
      );

      // Send initial welcome notification in-app
      try {
        await NotificationHelper.notifyFreelancer({
          workspaceId,
          userId: ownerUserId || undefined,
          title: '🎉 1 Month Free Standard Pack Activated',
          message:
            "Welcome to FlowDesk! You've received 1 month of the Standard pack free of charge to celebrate our official launch.",
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
   * If expired, transitions state to 'expired', downgrades to Starter, and delivers expiry notification.
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

    // Has trial expired? (Concluded 1-month period)
    if (diffMs <= 0) {
      if (supabaseAdmin) {
        try {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              plan_key: 'starter',
              status: 'expired',
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscriptionId);

          try {
            await supabaseAdmin
              .from('subscriptions')
              .update({ trial_status: 'expired' })
              .eq('id', subscriptionId);
          } catch {}

          // Update override state
          await this.upsertPromoOverride(
            workspaceId,
            {
              trial_claimed: true,
              announcement_seen: true,
              trial_expired: true,
              expired_at: new Date().toISOString(),
            },
            '30-Day Standard launch promotion expired, downgraded to Starter'
          );

          // Deliver trial expired in-app notification if not already sent
          await NotificationHelper.notifyFreelancer({
            workspaceId,
            userId: ownerUserId || undefined,
            title: 'Your free Standard period has ended',
            message:
              'Your 1-month FlowDesk launch benefit has concluded. Your workspace has automatically moved to the free Starter pack. Upgrade to Standard to restore elevated limits, custom branding, and automated reminders.',
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
        'Your 1-month launch benefit has 7 days remaining. Explore custom branding and automated reminders before your workspace moves to Starter.',
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
        'Your 1-month Standard promotion expires today. Your workspace will move to Starter with 2 clients and 3 projects tomorrow unless you purchase Standard.',
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

      const updated = [...existingReminders, milestone];

      if (supabaseAdmin) {
        try {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              trial_reminders_sent: updated,
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscriptionId);
        } catch {}

        await this.upsertPromoOverride(
          workspaceId,
          { trial_reminders_sent: updated },
          'Trial reminder milestone tracked'
        );
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
      // 1. Try updating subscriptions table if column exists
      try {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            announcement_seen: true,
            updated_at: new Date().toISOString(),
          })
          .eq('workspace_id', workspaceId);
      } catch {
        // column may not exist yet
      }

      // 2. Persist in entitlement_overrides as guaranteed storage
      await this.upsertPromoOverride(
        workspaceId,
        {
          announcement_seen: true,
          dismissed_at: new Date().toISOString(),
        },
        '30-day Standard launch promotion announcement dismissed'
      );

      return true;
    } catch {
      return true;
    }
  }
}
