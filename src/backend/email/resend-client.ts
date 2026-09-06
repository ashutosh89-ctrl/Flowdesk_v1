export { getAppBaseUrl } from '@/shared/utils/url';

const resendApiKey = process.env.RESEND_API_KEY || '';

export const isResendConfigured = Boolean(resendApiKey && resendApiKey.startsWith('re_'));

export const defaultSender = process.env.EMAIL_FROM || 'FlowDesk <onboarding@resend.dev>';

let _resendInstance: any = null;

export const getResendClient = (): any => {
  if (typeof window !== 'undefined') {
    return null;
  }
  if (!_resendInstance && isResendConfigured) {
    try {
      const { Resend } = require('resend');
      _resendInstance = new Resend(resendApiKey);
    } catch (e) {
      console.warn('Resend client initialization notice:', e);
      _resendInstance = null;
    }
  }
  return _resendInstance;
};

