/**
 * @deprecated Resend has been replaced with Brevo (brevo-client.ts).
 * This module redirects all operations to Brevo for backward compatibility.
 */
export {
  getAppBaseUrl,
  getBrevoApiKey as getResendApiKey,
  checkIsBrevoConfigured as checkIsResendConfigured,
  isBrevoConfigured as isResendConfigured,
  getDefaultSender,
  defaultSender,
} from './brevo-client';

export const getResendClient = (): any => {
  return null;
};
