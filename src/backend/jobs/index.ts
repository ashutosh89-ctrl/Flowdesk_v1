/**
 * FlowDesk Background Jobs Subsystem
 */

import { jobRegistry } from './registry';
import { generateRecurringInvoiceHandler } from './handlers/generate-recurring-invoice';
import { sendInvoiceHandler } from './handlers/send-invoice';
import { sendInvoiceReminderHandler } from './handlers/send-invoice-reminder';

// Register standard job handlers
jobRegistry.register('generate_recurring_invoice', generateRecurringInvoiceHandler);
jobRegistry.register('send_invoice', sendInvoiceHandler);
jobRegistry.register('send_invoice_reminder', sendInvoiceReminderHandler);

export * from './types';
export * from './registry';
export * from './queue';
export * from './sweeper';
export * from './runner';
