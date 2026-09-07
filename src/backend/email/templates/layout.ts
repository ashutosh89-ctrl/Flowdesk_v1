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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
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
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${escapeHtml(previewText)}
  </div>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="${logoUrl}" alt="FlowDesk" class="header-logo" />
      </div>
      <div class="content">
        <h1>${escapeHtml(title)}</h1>
        ${contentHtml}
        ${
          ctaText && ctaUrl
            ? `<div class="btn-container">
                <a href="${escapeHtml(ctaUrl)}" class="btn" target="_blank">${escapeHtml(ctaText)}</a>
              </div>`
            : ''
        }
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px 0;">${escapeHtml(footerNote)}</p>
        <p style="margin: 0;">FlowDesk · Freelancer Operating System</p>
      </div>
    </div>
  </div>
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

