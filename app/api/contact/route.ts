import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody, ContactSubmissionSchema } from '@/shared/validation';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { resolveApiCaller } from '@/backend/utilities/api-auth';
import { EmailService } from '@/backend/email/email-service';
import { siteConfig } from '@/shared/config/site-config';
import { isDemoModeActive } from '@/backend/utilities/supabase';

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHeader(str: string): string {
  return String(str || '').replace(/[\r\n]+/g, ' ').trim();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. IP Rate Limiting (5 requests per 60 seconds per IP)
  const ipRateLimit = await checkRateLimit(ip, {
    prefix: 'contact_ip',
    maxRequests: 5,
    windowSeconds: 60,
  });

  if (!ipRateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many contact submissions from your network. Please wait a moment before trying again.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Body Parsing & Zod Validation
  const bodyValidation = await parseJsonBody(request, ContactSubmissionSchema, {
    maxBytes: 25 * 1024, // 25 KB limit
  });

  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const payload = bodyValidation.data;

  // 3. Honeypot Spam Protection
  if (payload.hp_website && payload.hp_website.trim().length > 0) {
    logger.security('CONTACT_HONEYPOT_TRIGGERED', {
      status: 'BLOCKED',
      reason: 'Honeypot field was populated',
      ip,
      requestId,
      email: payload.email,
    });
    // Return standard success to spam bots without processing
    return NextResponse.json(
      { success: true, referenceId: `TKT-${new Date().getFullYear()}-SPAM00` },
      { headers: { 'X-Request-Id': requestId } }
    );
  }

  // 4. Email-level Rate Limiting (3 submissions per 60 seconds per email)
  const emailRateLimit = await checkRateLimit(payload.email.toLowerCase(), {
    prefix: 'contact_email',
    maxRequests: 3,
    windowSeconds: 60,
  });

  if (!emailRateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many messages sent with this email. Please wait a moment before resubmitting.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 5. Derive Authenticated Identity (Never trust client-supplied user IDs)
  const caller = await resolveApiCaller();
  const authenticatedUserId = caller?.userId || null;
  const authenticatedWorkspaceId = caller?.workspaceId || null;

  // 6. Generate Unique Reference ID
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const referenceId = `TKT-${new Date().getFullYear()}-${randomSuffix}`;

  // 7. Send Email via Configured Provider (Brevo) or Log in Demo/Test
  try {
    const isConfigured = EmailService.isConfigured();
    const isDemo = isDemoModeActive();

    const safeSubject = sanitizeHeader(payload.subject);
    const emailSubject = `[${referenceId}] ${payload.category}: ${safeSubject}`;
    const emailBodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #18181b;">
        <h2 style="color: #0047AB; border-bottom: 2px solid #0047AB; padding-bottom: 8px;">FlowDesk Support Request</h2>
        <p><strong>Reference ID:</strong> ${escapeHtml(referenceId)}</p>
        <p><strong>Category:</strong> ${escapeHtml(payload.category)}</p>
        <p><strong>Sender:</strong> ${escapeHtml(payload.name)} (&lt;${escapeHtml(payload.email)}&gt;)</p>
        ${payload.orderOrPaymentId ? `<p><strong>Order / Payment ID:</strong> ${escapeHtml(payload.orderOrPaymentId)}</p>` : ''}
        ${authenticatedUserId ? `<p><strong>Authenticated User ID:</strong> ${escapeHtml(authenticatedUserId)}</p>` : ''}
        ${authenticatedWorkspaceId ? `<p><strong>Workspace ID:</strong> ${escapeHtml(authenticatedWorkspaceId)}</p>` : ''}
        <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 16px 0;" />
        <h3 style="margin-top: 0;">Message:</h3>
        <div style="background-color: #f4f4f5; padding: 14px; border-radius: 8px; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${escapeHtml(payload.message)}</div>
        <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
        <p style="font-size: 12px; color: #71717a;">Received via FlowDesk Contact Portal &bull; Request ID: ${escapeHtml(requestId)}</p>
      </div>
    `;

    if (isConfigured && !isDemo) {
      // Dispatch notification to support email
      await EmailService.send({
        to: siteConfig.supportEmail,
        subject: emailSubject,
        html: emailBodyHtml,
        text: `Support Request ${referenceId}\nCategory: ${payload.category}\nFrom: ${payload.name} <${payload.email}>\n\n${payload.message}`,
        eventType: 'support_ticket_created',
        referenceType: 'ticket',
        referenceId,
        workspaceId: authenticatedWorkspaceId || undefined,
        userId: authenticatedUserId || undefined,
      });

      // Send auto-acknowledgement to sender
      const ackHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #18181b;">
          <h2 style="color: #0047AB; margin-bottom: 8px;">We received your support request</h2>
          <p>Hi ${payload.name},</p>
          <p>Thank you for reaching out to FlowDesk. We have logged your request under Reference ID <strong>${referenceId}</strong>.</p>
          <p><strong>Category:</strong> ${payload.category}</p>
          <p><strong>Response Target:</strong> ${
            payload.category === 'Payment Failure' || payload.category === 'Refund Request' || payload.category === 'Account and Login'
              ? 'Within 1 business day'
              : payload.category === 'Privacy and Data Deletion'
              ? 'Acknowledged within 2 business days'
              : 'Within 2 business days'
          }</p>
          <p>Our team will investigate and reply directly to this email address.</p>
          <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
          <p style="font-size: 12px; color: #71717a;">FlowDesk Support Team &bull; ${siteConfig.brandName}</p>
        </div>
      `;

      await EmailService.send({
        to: payload.email,
        subject: `[Received] ${emailSubject}`,
        html: ackHtml,
        text: `We received your request (${referenceId}). Our team will respond shortly.`,
        eventType: 'support_ticket_acknowledged',
        referenceType: 'ticket',
        referenceId,
      });
    } else {
      // In local dev, test, or demo mode, log the ticket safely
      logger.info('CONTACT_TICKET_CAPTURED_LOCAL', {
        referenceId,
        category: payload.category,
        name: payload.name,
        email: payload.email,
        authenticatedUserId,
        requestId,
      });
    }

    logger.security('CONTACT_SUBMISSION_SUCCESS', {
      status: 'SUCCESS',
      referenceId,
      category: payload.category,
      senderEmail: payload.email,
      requestId,
    });

    return NextResponse.json(
      {
        success: true,
        referenceId,
        message: 'Your message has been received. Our team will follow up within the specified response target.',
      },
      {
        status: 200,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    logger.error('CONTACT_SUBMISSION_FAILED', {
      error: err?.message,
      requestId,
      email: payload.email,
    });

    return createApiErrorResponse({
      message: `Failed to deliver support message. Please email support directly at ${siteConfig.supportEmail}.`,
      code: 'DELIVERY_FAILED',
      status: 500,
      requestId,
    });
  }
}
