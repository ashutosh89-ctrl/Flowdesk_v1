export { getAppBaseUrl } from '@/shared/utils/url';

/**
 * Returns the sanitized Resend API Key from the server-side environment.
 */
export const getResendApiKey = (): string => {
  if (typeof window !== 'undefined') return '';
  const key = process.env.RESEND_API_KEY || '';
  return key.trim().replace(/^['"]|['"]$/g, '');
};

/**
 * Validates whether a valid Resend API key is configured on the server.
 */
export const checkIsResendConfigured = (): boolean => {
  const key = getResendApiKey();
  return Boolean(key && key.startsWith('re_'));
};

/**
 * Dynamic getter for isResendConfigured to support backward compatibility.
 */
export const isResendConfigured = {
  valueOf: () => checkIsResendConfigured(),
  toString: () => String(checkIsResendConfigured()),
  [Symbol.toPrimitive]: () => checkIsResendConfigured(),
};

/**
 * Returns the configured default sender address, falling back to Resend's default testing sender.
 */
export const getDefaultSender = (): string => {
  const custom = process.env.EMAIL_FROM?.trim().replace(/^['"]|['"]$/g, '');
  if (custom && custom.length > 0) {
    return custom;
  }
  return 'FlowDesk <onboarding@resend.dev>';
};

export const defaultSender = getDefaultSender();

let _resendInstance: any = null;
let _cachedApiKey: string = '';

/**
 * Returns the initialized Resend client singleton on the server.
 * Instantiates or re-instantiates dynamically if the environment API key updates.
 */
export const getResendClient = (): any => {
  if (typeof window !== 'undefined') {
    return null;
  }

  const apiKey = getResendApiKey();
  if (!apiKey || !apiKey.startsWith('re_')) {
    _resendInstance = null;
    _cachedApiKey = '';
    return null;
  }

  if (!_resendInstance || _cachedApiKey !== apiKey) {
    try {
      const { Resend } = require('resend');
      _resendInstance = new Resend(apiKey);
      _cachedApiKey = apiKey;
    } catch (e) {
      console.warn('[ResendClient] Resend client initialization notice:', e);
      _resendInstance = null;
      _cachedApiKey = '';
    }
  }

  return _resendInstance;
};


