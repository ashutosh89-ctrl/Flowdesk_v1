export { getAppBaseUrl } from '@/shared/utils/url';

export interface BrevoSender {
  name?: string;
  email: string;
}

export interface BrevoRecipient {
  name?: string;
  email: string;
}

export interface SendBrevoEmailPayload {
  to: string | BrevoRecipient | (string | BrevoRecipient)[];
  subject: string;
  html: string;
  text?: string;
  sender?: BrevoSender;
  replyTo?: BrevoSender;
  tags?: string[];
  headers?: Record<string, string>;
}

export interface BrevoSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  code?: string;
}

/**
 * Returns the sanitized Brevo API Key from the server-side environment.
 * Never accessible in browser client runtimes.
 */
export const getBrevoApiKey = (): string => {
  if (typeof window !== 'undefined') return '';
  const key = process.env.BREVO_API_KEY || process.env.SIB_API_V3_KEY || '';
  return key.trim().replace(/^['"]|['"]$/g, '');
};

/**
 * Validates whether a valid Brevo API key is configured on the server.
 */
export const checkIsBrevoConfigured = (): boolean => {
  const key = getBrevoApiKey();
  return Boolean(key && (key.startsWith('xkeysib-') || key.length > 20));
};

/**
 * Dynamic getter for isBrevoConfigured to support backward compatibility.
 */
export const isBrevoConfigured = {
  valueOf: () => checkIsBrevoConfigured(),
  toString: () => String(checkIsBrevoConfigured()),
  [Symbol.toPrimitive]: () => checkIsBrevoConfigured(),
};

/**
 * Parses sender string like "Flowdesk <mysreio26@gmail.com>" or "mysreio26@gmail.com"
 * into BrevoSender object { name, email }.
 */
export function parseSender(senderStr?: string | null): BrevoSender {
  const fallbackEmail = 'mysreio26@gmail.com';
  const fallbackName = 'Flowdesk';

  if (!senderStr || !senderStr.trim()) {
    return { name: fallbackName, email: fallbackEmail };
  }

  const trimmed = senderStr.trim().replace(/^['"]|['"]$/g, '');
  const match = trimmed.match(/^(?:(.*)<(.+@.+)>|(.+@.+))$/);

  if (match) {
    if (match[1] && match[2]) {
      return {
        name: match[1].trim() || fallbackName,
        email: match[2].trim().toLowerCase(),
      };
    }
    if (match[3]) {
      return {
        name: fallbackName,
        email: match[3].trim().toLowerCase(),
      };
    }
  }

  return { name: fallbackName, email: trimmed.includes('@') ? trimmed.toLowerCase() : fallbackEmail };
}

/**
 * Returns the configured default sender address string.
 */
export const getDefaultSender = (): string => {
  const custom = process.env.EMAIL_FROM?.trim().replace(/^['"]|['"]$/g, '') || process.env.BREVO_SENDER_EMAIL?.trim();
  if (custom && custom.length > 0) {
    return custom;
  }
  return 'Flowdesk <mysreio26@gmail.com>';
};

export const defaultSender = getDefaultSender();

/**
 * Core transactional email dispatch via Brevo v3 SMTP REST API.
 * Endpoint: POST https://api.brevo.com/v3/smtp/email
 */
export async function sendBrevoEmail(payload: SendBrevoEmailPayload): Promise<BrevoSendResult> {
  if (typeof window !== 'undefined') {
    return { success: false, error: 'Brevo email dispatch is server-side only.' };
  }

  const apiKey = getBrevoApiKey();
  if (!apiKey || !checkIsBrevoConfigured()) {
    return {
      success: false,
      error: 'Brevo API key is missing or invalid. Set BREVO_API_KEY on the server.',
    };
  }

  // Format recipient(s)
  const recipients: { email: string; name?: string }[] = [];
  const rawToList = Array.isArray(payload.to) ? payload.to : [payload.to];

  for (const item of rawToList) {
    if (typeof item === 'string') {
      const email = item.trim().toLowerCase();
      if (email.includes('@')) {
        recipients.push({ email });
      }
    } else if (item && typeof item === 'object' && item.email) {
      recipients.push({
        email: item.email.trim().toLowerCase(),
        name: item.name?.trim(),
      });
    }
  }

  if (recipients.length === 0) {
    return { success: false, error: 'No valid recipient email provided.' };
  }

  // Format sender
  const resolvedSender = payload.sender || parseSender(getDefaultSender());

  const requestBody: Record<string, any> = {
    sender: resolvedSender,
    to: recipients,
    subject: payload.subject,
    htmlContent: payload.html,
  };

  if (payload.text && payload.text.trim()) {
    requestBody.textContent = payload.text.trim();
  }

  if (payload.replyTo) {
    requestBody.replyTo = payload.replyTo;
  }

  if (payload.tags && payload.tags.length > 0) {
    requestBody.tags = payload.tags;
  }

  if (payload.headers && Object.keys(payload.headers).length > 0) {
    requestBody.headers = payload.headers;
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'accept': 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = responseData.message || responseData.error || `Brevo HTTP Error ${res.status}`;
      console.warn(`[BrevoClient] Dispatch failure (Status ${res.status}):`, errMsg);
      return {
        success: false,
        error: errMsg,
        code: responseData.code,
      };
    }

    const messageId = responseData.messageId || `<brevo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}>`;
    return {
      success: true,
      messageId,
    };
  } catch (err: any) {
    console.error('[BrevoClient] Network or dispatch exception:', err);
    return {
      success: false,
      error: err?.message || 'Network error while contacting Brevo API.',
    };
  }
}
