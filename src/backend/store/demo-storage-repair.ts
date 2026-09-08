import { isDemoModeActive } from '@/backend/utilities/supabase';

const DEMO_STORAGE_KEYS = [
  'flowdesk_clients',
  'flowdesk_projects',
  'flowdesk_deliverables',
  'flowdesk_documents',
  'flowdesk_invoices',
  'flowdesk_activities',
  'flowdesk_comments',
  'flowdesk_portals',
  'flowdesk_recent_searches',
  'flowdesk_user_profile',
  'flowdesk_notifications',
  'flowdesk_pinned_items',
  'flowdesk_recent_items',
  'flowdesk_widget_config',
];

/**
 * Demo mode uses seeded local data. Previous production/demo sessions can leave
 * empty JSON collections in localStorage, which otherwise override the seeded
 * defaults when FlowDeskStore initializes. Remove only empty values so the
 * existing mock dataset can be loaded again. Real non-empty demo edits remain.
 */
export function repairDemoStorage(): void {
  if (!isDemoModeActive() || typeof window === 'undefined') return;

  for (const key of DEMO_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const isEmptyArray = Array.isArray(parsed) && parsed.length === 0;
      const isEmptyObject =
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        Object.keys(parsed).length === 0;

      if (isEmptyArray || isEmptyObject) {
        localStorage.removeItem(key);
      }
    } catch {
      // Invalid demo storage is safe to remove and will be replaced by defaults.
      localStorage.removeItem(key);
    }
  }
}
