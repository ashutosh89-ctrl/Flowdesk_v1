import { getAppBaseUrl } from '@/shared/utils/url';

export interface EmailLayoutProps {
  title: string;
  previewText?: string;
  contentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  recipientEmail?: string;
  footerNote?: string;
}

export function renderEmailLayout({
  title,
  previewText = '',
  contentHtml,
  ctaText,
  ctaUrl,
  footerNote = 'This is an automated transactional notification from FlowDesk.',
}: EmailLayoutProps): string {
  const baseUrl = getAppBaseUrl();
  const logoUrl = `${baseUrl}/branding/flowdesk-logo.png`;

  const cleanTitle = sanitizeHeader(title, 200);
  const cleanPreview = sanitizeHeader(previewText, 500);
  const safeCtaUrl = sanitizeUrl(ctaUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(cleanTitle)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #070708;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e4e4e7;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #070708;
      padding: 40px 16px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #121215;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .header {
      padding: 24px 32px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background-color: #09090b;
      display: flex;
      align-items: center;
    }
    .header-logo {
      height: 28px;
      width: auto;
      max-width: 120px;
      display: block;
      border: 0;
      outline: none;
      text-decoration: none;
    }
    .content {
      padding: 32px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.4px;
      color: #ffffff;
      margin: 0 0 16px 0;
      line-height: 1.3;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #a1a1aa;
      margin: 0 0 16px 0;
    }
    .info-box {
      background-color: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px;
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #71717a;
      font-weight: 500;
    }
    .info-value {
      color: #f4f4f5;
      font-weight: 600;
      text-align: right;
    }
    .btn-container {
      margin: 28px 0 12px;
      text-align: center;
    }
    .btn {
      display: inline-block;
      background-color: #ffffff;
      color: #09090b !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 28px;
      border-radius: 12px;
      box-shadow: 0 4px 14px rgba(255, 255, 255, 0.2);
    }
    .footer {
      padding: 24px 32px;
      background-color: #0e0e11;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      text-align: center;
      font-size: 12px;
      color: #52525b;
      line-height: 1.5;
    }
    .footer a {
      color: #71717a;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0;">
    ${escapeHtml(cleanPreview)}
  </div>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#090a0f" style="width: 100%; background-color: #090a0f; margin: 0; padding: 32px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%; background-color: #12131a; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="padding: 24px 32px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background-color: #0d0e14;">
              <span style="font-size: 18px; font-weight: 700; color: #43D6B0; letter-spacing: -0.5px;">FlowDesk</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px; color: #e4e4e7; font-size: 14px; line-height: 1.6;">
              <h1 style="font-size: 20px; font-weight: 700; letter-spacing: -0.4px; color: #ffffff; margin: 0 0 16px 0; line-height: 1.3;">${escapeHtml(cleanTitle)}</h1>
              ${contentHtml}
              ${
                ctaText && safeCtaUrl !== '#'
                  ? `<table border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 12px; width: 100%;">
                      <tr>
                        <td align="center">
                          <a href="${escapeHtml(safeCtaUrl)}" target="_blank" style="display: inline-block; background-color: #43D6B0; color: #09090b !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 10px; mso-padding-alt: 0;">${escapeHtml(truncateText(ctaText, 200))}</a>
                        </td>
                      </tr>
                    </table>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #0b0c12; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center; font-size: 12px; color: #71717a; line-height: 1.5;">
              <p style="margin: 0 0 6px 0;">${escapeHtml(truncateText(footerNote, 500))}</p>
              <p style="margin: 0; color: #52525b;">FlowDesk · Freelancer Operating System</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Strips Carriage Return and Line Feed control characters to protect against
 * email header injection and response splitting.
 */
export function sanitizeHeader(str: string | undefined | null, maxLength = 200): string {
  if (!str) return '';
  return String(str)
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates that an href target uses http or https scheme.
 * Prevents javascript:, data:, and relative redirection exploitation.
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '#';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return '#';
}

/**
 * Limits maximum string length to prevent resource exhaustion / email bloat.
 */
export function truncateText(str: string | undefined | null, maxLength = 2000): string {
  if (!str) return '';
  const trimmed = String(str).trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength);
}

