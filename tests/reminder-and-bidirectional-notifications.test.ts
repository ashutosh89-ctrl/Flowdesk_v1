import test from 'node:test';
import assert from 'node:assert/strict';
import { NotificationHelper } from '../src/backend/utilities/notification-helper';

test('FLOWDESK BIDIRECTIONAL AUDIT: NOTIFICATIONS & REMINDER SYSTEM SUITE', async (suite) => {
  await suite.test('NotificationHelper: notifyFreelancer handles missing workspaceId gracefully', async () => {
    // Should not throw even in non-auth test runtime
    await assert.doesNotReject(async () => {
      await NotificationHelper.notifyFreelancer({
        title: 'Test Notification',
        message: 'Unit test message',
        category: 'test',
      });
    });
  });

  await suite.test('NotificationHelper: notifyClient handles missing workspaceId gracefully', async () => {
    await assert.doesNotReject(async () => {
      await NotificationHelper.notifyClient({
        clientId: '00000000-0000-0000-0000-000000000001',
        title: 'Test Client Notification',
        message: 'Client test message',
        category: 'test',
      });
    });
  });

  await suite.test('NotificationHelper: Convenience methods execute cleanly', async () => {
    await assert.doesNotReject(async () => {
      await NotificationHelper.deliverableSubmitted('Design System Mockup', '00000000-0000-0000-0000-000000000001');
      await NotificationHelper.deliverableApproved('Design System Mockup', '00000000-0000-0000-0000-000000000001');
      await NotificationHelper.revisionRequested('Design System Mockup', '00000000-0000-0000-0000-000000000001');
      await NotificationHelper.paymentSubmitted('INV-2026-0001', 'Acme Corp', 'UTR987654321', '00000000-0000-0000-0000-000000000001');
      await NotificationHelper.invoiceReminderSent('INV-2026-0001', 2, '$ 1,500', '00000000-0000-0000-0000-000000000001');
    });
  });
});
