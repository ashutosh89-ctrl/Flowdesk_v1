export { getAppBaseUrl } from '@/shared/utils/url';

export interface BrevoSender {
  id?: number;
  name?: string;
  email: string;
  active?: boolean;
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
  suppressed?: boolean;
}

export interface BrevoAccountStatus {
  configured: boolean;
  authenticated: boolean;
  relayEnabled: boolean;
  sendingPlatformActive: boolean;
  killSwitchActive: boolean;
  accountEmail?: string;
  companyName?: string;
  planType?: string;
  credits?: number;
  verifiedSenders: BrevoSender[];
  status:
    | 'ready'
    | 'suspended_or_disabled'
    | 'unauthorized'
    | 'unconfigured'
    | 'kill_switch_active'
    | 'error';
  blockerReason?: string;
}

/**
 * Returns the sanitized Brevo API Key from the server-side environment.
 * Never accessible in browser client runtimes.
 */
export const getBrevoApiKey = (): string => {
  if (typeof window !== 'undefined') return '';
  let key = process.env.BREVO_API_KEY || process.env.SIB_API_V3_KEY || '';
  if (!key || key.trim().length === 0) {
    try {
      // Dynamic fallback for server runtime if .env.local was updated during execution
      const fs = require('fs');
      const path = require('path');
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/BREVO_API_KEY=["']?([^"'\r\n]+)["']?/);
        if (match && match[1]) {
          key = match[1].trim();
          process.env.BREVO_API_KEY = key;
        }
      }
    } catch {
      // Non-critical if filesystem read is restricted
    }
  }
  return key.trim().replace(/^['"]|['"]$/g, '');
};

/**
 * Checks if the administrative email kill switch is engaged.
 */
export const checkEmailKillSwitch = (): boolean => {
  const switchVal = (process.env.EMAIL_KILL_SWITCH || '').trim().toLowerCase();
  const dispatchVal = (process.env.ENABLE_EMAIL_DISPATCH || '').trim().toLowerCase();
  return switchVal === 'true' || dispatchVal === 'false';
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
  const fallbackEmail = process.env.BREVO_SENDER_EMAIL?.trim() || 'mysreio26@gmail.com';
  const fallbackName = process.env.BREVO_SENDER_NAME?.trim() || 'Flowdesk';

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

// In-memory cache for Brevo account status (2 minute TTL)
let cachedAccountStatus: { status: BrevoAccountStatus; timestamp: number } | null = null;

export function clearBrevoAccountStatusCache(): void {
  cachedAccountStatus = null;
}

/**
 * Inspects server-side Brevo account status and sending platform authorization.
 * Accurately detects suspensions and platform-level disablements.
 */
export async function getBrevoAccountStatus(forceRefresh = false): Promise<BrevoAccountStatus> {
  if (typeof window !== 'undefined') {
    return {
      configured: false,
      authenticated: false,
      relayEnabled: false,
      sendingPlatformActive: false,
      killSwitchActive: false,
      verifiedSenders: [],
      status: 'unconfigured',
      blockerReason: 'Brevo status can only be checked on the server runtime.',
    };
  }

  const killSwitchActive = checkEmailKillSwitch();
  if (killSwitchActive) {
    return {
      configured: checkIsBrevoConfigured(),
      authenticated: false,
      relayEnabled: false,
      sendingPlatformActive: false,
      killSwitchActive: true,
      verifiedSenders: [],
      status: 'kill_switch_active',
      blockerReason: 'All outgoing email dispatches are disabled by administrative kill switch (EMAIL_KILL_SWITCH=true).',
    };
  }

  const apiKey = getBrevoApiKey();
  if (!apiKey || !checkIsBrevoConfigured()) {
    return {
      configured: false,
      authenticated: false,
      relayEnabled: false,
      sendingPlatformActive: false,
      killSwitchActive: false,
      verifiedSenders: [],
      status: 'unconfigured',
      blockerReason: 'BREVO_API_KEY is not configured on the server environment.',
    };
  }

  const now = Date.now();
  if (!forceRefresh && cachedAccountStatus && (now - cachedAccountStatus.timestamp) < 2 * 60 * 1000) {
    return cachedAccountStatus.status;
  }

  try {
    const [accRes, sendersRes] = await Promise.all([
      fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': apiKey, 'accept': 'application/json' },
      }),
      fetch('https://api.brevo.com/v3/senders', {
        headers: { 'api-key': apiKey, 'accept': 'application/json' },
      }),
    ]);

    if (accRes.status === 401 || accRes.status === 403) {
      const errData = await accRes.json().catch(() => ({}));
      const blockerReason = (errData && errData.message)
        ? `Brevo authorization rejected: ${errData.message}`
        : 'Brevo API key was rejected by the provider (HTTP 401 Unauthorized). Verify your API key.';
      const result: BrevoAccountStatus = {
        configured: true,
        authenticated: false,
        relayEnabled: false,
        sendingPlatformActive: false,
        killSwitchActive: false,
        verifiedSenders: [],
        status: 'unauthorized',
        blockerReason,
      };
      cachedAccountStatus = null; // Do not cache unauthorized states so new key updates apply immediately
      return result;
    }

    if (!accRes.ok) {
      const errData = await accRes.json().catch(() => ({}));
      const result: BrevoAccountStatus = {
        configured: true,
        authenticated: false,
        relayEnabled: false,
        sendingPlatformActive: false,
        killSwitchActive: false,
        verifiedSenders: [],
        status: 'error',
        blockerReason: errData.message || `Brevo API HTTP ${accRes.status} Error`,
      };
      cachedAccountStatus = null; // Do not cache transient HTTP errors
      return result;
    }

    const accData = await accRes.json();
    let senders: BrevoSender[] = [];
    if (sendersRes.ok) {
      const sendersData = await sendersRes.json().catch(() => ({}));
      if (Array.isArray(sendersData.senders)) {
        senders = sendersData.senders.map((s: any) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          active: Boolean(s.active),
        }));
      }
    }

    const relayEnabled = Boolean(accData.relay && accData.relay.enabled === true);

    let status: BrevoAccountStatus['status'] = 'ready';
    let blockerReason: string | undefined = undefined;

    if (!relayEnabled) {
      status = 'suspended_or_disabled';
      blockerReason =
        'Your Brevo transactional sending platform is currently disabled (relay.enabled: false). ' +
        'This occurs when Brevo compliance suspends transactional sending or requires manual activation. ' +
        'The account owner must resolve this through Brevo Official Support/Compliance before email delivery can proceed.';
    }

    const planObj = Array.isArray(accData.plan) ? accData.plan[0] : undefined;

    const result: BrevoAccountStatus = {
      configured: true,
      authenticated: true,
      relayEnabled,
      sendingPlatformActive: relayEnabled,
      killSwitchActive: false,
      accountEmail: accData.email,
      companyName: accData.companyName,
      planType: planObj?.type,
      credits: planObj?.credits,
      verifiedSenders: senders,
      status,
      blockerReason,
    };

    cachedAccountStatus = { status: result, timestamp: now };
    return result;
  } catch (err: any) {
    return {
      configured: true,
      authenticated: false,
      relayEnabled: false,
      sendingPlatformActive: false,
      killSwitchActive: false,
      verifiedSenders: [],
      status: 'error',
      blockerReason: err?.message || 'Network error communicating with Brevo API.',
    };
  }
}

/**
 * Core transactional email dispatch via Brevo v3 SMTP REST API.
 * Endpoint: POST https://api.brevo.com/v3/smtp/email
 * 
 * Features:
 * - Server-side execution only
 * - Kill switch enforcement
 * - Pre-send platform status validation (fails closed if sending platform is disabled)
 * - Exponential backoff with bounded retries for transient errors
 * - Sender identity protection (ensures verified sender or platform sender with replyTo)
 * - No fake success responses
 */
export async function sendBrevoEmail(payload: SendBrevoEmailPayload): Promise<BrevoSendResult> {
  if (typeof window !== 'undefined') {
    return { success: false, error: 'Brevo email dispatch is server-side only.', code: 'CLIENT_RUNTIME_FORBIDDEN' };
  }

  // 1. Check Kill Switch
  if (checkEmailKillSwitch()) {
    return {
      success: false,
      error: 'Outgoing emails are disabled via administrative kill switch (EMAIL_KILL_SWITCH=true).',
      code: 'KILL_SWITCH_ACTIVE',
    };
  }

  // 2. Check API Key
  const apiKey = getBrevoApiKey();
  if (!apiKey || !checkIsBrevoConfigured()) {
    return {
      success: false,
      error: 'Brevo API key is missing or invalid. Set BREVO_API_KEY on the server.',
      code: 'PROVIDER_NOT_CONFIGURED',
    };
  }

  // 3. Verify Account Status & Platform Sending State (Anti-Suspension Guardrail)
  const accountStatus = await getBrevoAccountStatus();
  if (accountStatus.status === 'suspended_or_disabled') {
    console.warn('[BrevoClient] Sending blocked: Brevo platform is currently disabled on this account.');
    return {
      success: false,
      error: accountStatus.blockerReason || 'Brevo transactional sending platform is disabled on this account.',
      code: 'SENDING_PLATFORM_DISABLED',
    };
  }

  if (accountStatus.status === 'unauthorized') {
    return {
      success: false,
      error: 'Brevo API key was rejected by the provider. Please update BREVO_API_KEY.',
      code: 'INVALID_CREDENTIALS',
    };
  }

  // 4. Format Recipient(s)
  const recipients: { email: string; name?: string }[] = [];
  const rawToList = Array.isArray(payload.to) ? payload.to : [payload.to];

  for (const item of rawToList) {
    if (typeof item === 'string') {
      const email = item.trim().toLowerCase();
      if (email.includes('@') && !email.includes('..')) {
        recipients.push({ email });
      }
    } else if (item && typeof item === 'object' && item.email) {
      const email = item.email.trim().toLowerCase();
      if (email.includes('@') && !email.includes('..')) {
        recipients.push({
          email,
          name: item.name?.trim(),
        });
      }
    }
  }

  if (recipients.length === 0) {
    return { success: false, error: 'No valid recipient email provided.', code: 'INVALID_RECIPIENT' };
  }

  // 5. Format & Protect Sender Identity
  const defaultParsed = parseSender(getDefaultSender());
  let resolvedSender = payload.sender || defaultParsed;

  // Brevo strictly enforces that sender email must be verified on the account.
  // If sender email is not identical to default verified sender, check against verifiedSenders.
  const isCustomSender = resolvedSender.email.toLowerCase() !== defaultParsed.email.toLowerCase();
  if (isCustomSender) {
    const isVerified = accountStatus.verifiedSenders.some(
      (s) => s.email.toLowerCase() === resolvedSender.email.toLowerCase() && s.active !== false
    );
    if (!isVerified) {
      // Fall back to verified platform sender and preserve custom sender as replyTo
      const originalSender = resolvedSender;
      resolvedSender = defaultParsed;
      if (!payload.replyTo) {
        payload.replyTo = originalSender;
      }
    }
  }

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

  // 6. Exponential Backoff with Bounded Retries for Transient Errors (max 2 retries)
  const maxRetries = 2;
  let lastError: string | null = null;
  let lastCode: string | undefined = undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Backoff: 500ms, 1500ms
        const delay = attempt * 750;
        await new Promise((res) => setTimeout(res, delay));
      }

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
        lastCode = responseData.code || String(res.status);
        lastError = errMsg;

        // Permanent failures: 401 Unauthorized, 400 Bad Request (invalid params), 403 Forbidden -> do NOT retry
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          console.warn(`[BrevoClient] Permanent failure (Status ${res.status}): ${errMsg}`);
          return {
            success: false,
            error: errMsg,
            code: lastCode,
          };
        }

        // Transient failure (429 Rate Limit, 500/502/503/504) -> retry up to maxRetries
        console.warn(`[BrevoClient] Transient error on attempt ${attempt + 1}/${maxRetries + 1} (Status ${res.status}): ${errMsg}`);
        continue;
      }

      const messageId = responseData.messageId || `<brevo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}>`;
      return {
        success: true,
        messageId,
      };
    } catch (err: any) {
      lastError = err?.message || 'Network error while contacting Brevo API.';
      console.warn(`[BrevoClient] Network exception on attempt ${attempt + 1}/${maxRetries + 1}:`, err);
    }
  }

  return {
    success: false,
    error: lastError || 'Failed to dispatch email after bounded retries.',
    code: lastCode || 'TRANSIENT_PROVIDER_FAILURE',
  };
}
