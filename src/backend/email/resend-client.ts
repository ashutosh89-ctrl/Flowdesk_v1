const resendApiKey = process.env.RESEND_API_KEY || '';

export const isResendConfigured = Boolean(resendApiKey && resendApiKey.startsWith('re_'));

export const defaultSender = process.env.EMAIL_FROM || 'FlowDesk <onboarding@resend.dev>';

export const getAppBaseUrl = (): string => {
  // Browser: use the canonical origin.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  // Server: canonical base URL from explicit configuration, in priority order.
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  // Deployment-provided URL (e.g. Vercel preview/production).
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, '');
  if (process.env.NEXT_PUBLIC_VERCEL_URL) return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`.replace(/\/+$/, '');
  // Explicit development fallback. Production deployments MUST set APP_URL or
  // NEXT_PUBLIC_APP_URL; this fallback makes misconfiguration visible rather
  // than silently emitting localhost links.
  return 'http://localhost:3000';
};

let _resendInstance: any = null;

export const getResendClient = (): any => {
  if (typeof window !== 'undefined') {
    return null;
  }
  if (!_resendInstance && isResendConfigured) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Resend } = require('resend');
      _resendInstance = new Resend(resendApiKey);
    } catch (e) {
      console.warn('Resend client initialization notice:', e);
      _resendInstance = null;
    }
  }
  return _resendInstance;
};

export const resend = typeof window === 'undefined' && isResendConfigured ? getResendClient() : null;
