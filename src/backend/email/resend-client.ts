/**
 * @deprecated Resend has been replaced with Brevo (brevo-client.ts).
 * This module provides backward compatibility helpers for legacy callers and tests.
 */
import { getAppBaseUrl } from '@/shared/utils/url';
import { getBrevoApiKey, checkIsBrevoConfigured } from './brevo-client';

export { getAppBaseUrl };

export const getResendApiKey = (): string | null => {
  const key = (process.env.RESEND_API_KEY || process.env.BREVO_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  return key || null;
};

export const checkIsResendConfigured = (): boolean => {
  const key = getResendApiKey();
  return Boolean(key && (key.startsWith('re_') || key.startsWith('xkeysib-') || key.length > 20));
};

export const isResendConfigured = checkIsResendConfigured;

export const getDefaultSender = (): string => {
  const raw = process.env.EMAIL_FROM || 'FlowDesk <onboarding@resend.dev>';
  return raw.trim().replace(/^['"]|['"]$/g, '');
};

export const defaultSender = getDefaultSender();

export const getResendClient = (): any => {
  return null;
};

