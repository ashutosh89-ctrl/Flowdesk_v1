import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { StorageHelper } from '@/backend/storage/storage-helper';
import { DEMO_WORKSPACE } from '@/backend/utilities/workspace';
import { FlowDeskStore } from '@/backend/store/storage-store';
import { InvoiceBranding } from '@/shared/types';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';

export const runtime = 'nodejs';

/**
 * Public/Client-accessible branding resolver for a workspace or client.
 * Bypasses RLS using supabaseAdmin to guarantee that logos, signatures,
 * and business details are reliably available to the Client Portal.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'portal_branding',
    maxRequests: 120,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again shortly.' },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId')?.trim();
  const workspaceId = searchParams.get('workspaceId')?.trim();

  // Demo Mode Handler
  if (isDemoModeActive()) {
    const localProf = FlowDeskStore.getUserProfile() || {};
    const demoBranding: InvoiceBranding = {
      businessName: (DEMO_WORKSPACE.name && DEMO_WORKSPACE.name !== 'My Workspace')
        ? DEMO_WORKSPACE.name
        : (localProf.companyName || localProf.name || 'FlowDesk Freelance Studio'),
      freelancerName: localProf.name || 'Studio Lead',
      email: localProf.email || 'billing@flowdesk.app',
      phone: localProf.phone || '',
      logoUrl: DEMO_WORKSPACE.logoUrl || localProf.logoUrl || '/branding/flowdesk-symbol.png',
      signatureUrl: DEMO_WORKSPACE.signatureUrl || localProf.signatureUrl || '',
    };
    return NextResponse.json({ success: true, branding: demoBranding });
  }

  try {
    let targetWsId = workspaceId || null;

    // 1. Resolve workspace ID from client record if clientId provided
    if (!targetWsId && clientId) {
      const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
      let cQuery = supabaseAdmin.from('clients').select('workspace_id, id');
      if (UUID_PATTERN.test(clientId)) {
        cQuery = cQuery.or(`id.eq.${clientId},user_id.eq.${clientId}`);
      } else if (clientId.includes('@')) {
        cQuery = cQuery.eq('email', clientId.toLowerCase());
      } else {
        cQuery = cQuery.eq('portal_token', clientId);
      }

      const { data: cRow } = await cQuery.maybeSingle();
      if (cRow?.workspace_id) {
        targetWsId = cRow.workspace_id;
      }
    }

    // 2. Resolve workspace ID from client_connections table
    if (!targetWsId && clientId) {
      try {
        const { data: connRow } = await supabaseAdmin
          .from('client_connections')
          .select('workspace_id')
          .or(`client_user_id.eq.${clientId},client_id.eq.${clientId}`)
          .order('connected_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (connRow?.workspace_id) {
          targetWsId = connRow.workspace_id;
        }
      } catch {
        // non-critical
      }
    }

    // 3. Resolve workspace ID from recent client invoices
    if (!targetWsId && clientId) {
      try {
        const { data: invRow } = await supabaseAdmin
          .from('invoices')
          .select('workspace_id')
          .eq('client_id', clientId)
          .not('workspace_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (invRow?.workspace_id) {
          targetWsId = invRow.workspace_id;
        }
      } catch {
        // non-critical
      }
    }

    // 4. Fallback: select most active workspace with branding
    if (!targetWsId) {
      try {
        const { data: fallbackWs } = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .not('logo_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fallbackWs?.id) {
          targetWsId = fallbackWs.id;
        } else {
          const { data: anyWs } = await supabaseAdmin
            .from('workspaces')
            .select('id')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (anyWs?.id) {
            targetWsId = anyWs.id;
          }
        }
      } catch {
        // non-critical
      }
    }

    const branding: InvoiceBranding = {
      businessName: 'FlowDesk Freelance Studio',
      freelancerName: 'Studio Lead',
      email: '',
      phone: '',
      logoUrl: '/branding/flowdesk-symbol.png',
      signatureUrl: '',
    };

    if (targetWsId) {
      const { data: wsData } = await supabaseAdmin
        .from('workspaces')
        .select('name, logo_url, signature_url, owner_id')
        .eq('id', targetWsId)
        .maybeSingle();

      if (wsData) {
        if (wsData.name && wsData.name !== 'My Workspace') {
          branding.businessName = wsData.name;
        }

        if (wsData.logo_url) {
          branding.logoUrl = wsData.logo_url.startsWith('http') || wsData.logo_url.startsWith('/') || wsData.logo_url.startsWith('data:')
            ? wsData.logo_url
            : StorageHelper.getPublicUrl('logos', wsData.logo_url);
        }

        if (wsData.signature_url) {
          branding.signatureUrl = wsData.signature_url.startsWith('http') || wsData.signature_url.startsWith('/') || wsData.signature_url.startsWith('data:')
            ? wsData.signature_url
            : StorageHelper.getPublicUrl('signatures', wsData.signature_url);
        }

        const ownerId = wsData.owner_id;
        if (ownerId) {
          const [profRes, settingsRes] = await Promise.all([
            supabaseAdmin
              .from('profiles')
              .select('id, full_name, business_name, company_name, email, phone, logo_url, signature_url, country, upi_id, upi_qr_code_url')
              .eq('id', ownerId)
              .maybeSingle(),
            supabaseAdmin
              .from('user_settings')
              .select('*')
              .eq('id', ownerId)
              .maybeSingle(),
          ]);

          const profData = profRes.data;
          const userSettingsData = settingsRes.data;

          if (profData) {
            if (profData.full_name) branding.freelancerName = profData.full_name;
            if (profData.business_name || profData.company_name) {
              branding.businessName = profData.business_name || profData.company_name || branding.businessName;
            }
            if (profData.email) branding.email = profData.email;
            if (profData.phone) branding.phone = profData.phone;
            if (profData.country) (branding as any).country = profData.country;

            if (profData.logo_url && (!branding.logoUrl || branding.logoUrl === '/branding/flowdesk-symbol.png')) {
              branding.logoUrl = profData.logo_url.startsWith('http') || profData.logo_url.startsWith('/') || profData.logo_url.startsWith('data:')
                ? profData.logo_url
                : StorageHelper.getPublicUrl('logos', profData.logo_url);
            }
            if (profData.signature_url && !branding.signatureUrl) {
              branding.signatureUrl = profData.signature_url.startsWith('http') || profData.signature_url.startsWith('/') || profData.signature_url.startsWith('data:')
                ? profData.signature_url
                : StorageHelper.getPublicUrl('signatures', profData.signature_url);
            }
          }

          // Populate UPI QR code, UPI ID, Bank Transfer Details, and Payment Methods
          const effectiveUpiQrCodeUrl =
            userSettingsData?.upi_qr_code_url ||
            userSettingsData?.payment_settings?.upiQrCodeUrl ||
            profData?.upi_qr_code_url ||
            '';
          if (effectiveUpiQrCodeUrl) {
            branding.upiQrCodeUrl =
              effectiveUpiQrCodeUrl.startsWith('http') ||
              effectiveUpiQrCodeUrl.startsWith('/') ||
              effectiveUpiQrCodeUrl.startsWith('data:')
                ? effectiveUpiQrCodeUrl
                : StorageHelper.getPublicUrl('logos', effectiveUpiQrCodeUrl);
          }

          const effectiveUpiId =
            userSettingsData?.upi_id ||
            userSettingsData?.payment_settings?.upiId ||
            profData?.upi_id ||
            '';
          if (effectiveUpiId) {
            branding.upiId = effectiveUpiId;
          }

          const bankDetails =
            userSettingsData?.payment_settings?.bankDetails ||
            (userSettingsData?.bank_name
              ? {
                  bankName: userSettingsData.bank_name,
                  accountHolderName: userSettingsData.account_holder_name || '',
                  accountNumber: userSettingsData.account_number || '',
                  ifscCode: userSettingsData.ifsc_code || '',
                  branchName: userSettingsData.branch_name || '',
                  upiId: effectiveUpiId,
                }
              : undefined);
          if (bankDetails) {
            branding.bankDetails = bankDetails;
          }

          const razorpayPaymentLink =
            userSettingsData?.razorpay_payment_link ||
            userSettingsData?.payment_settings?.razorpayPaymentLink ||
            '';
          if (razorpayPaymentLink) {
            branding.razorpayPaymentLink = razorpayPaymentLink;
          }

          if (userSettingsData?.payment_settings) {
            branding.paymentMethods = userSettingsData.payment_settings;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      branding,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      },
    });
  } catch (err: any) {
    console.warn('[Branding API] Error resolving portal branding:', err);
    return NextResponse.json({
      success: false,
      error: err?.message || 'Failed to resolve portal branding.',
    }, { status: 500 });
  }
}
