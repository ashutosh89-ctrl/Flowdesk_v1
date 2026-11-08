import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { StorageHelper } from '@/backend/storage/storage-helper';
import { DEMO_WORKSPACE } from '@/backend/utilities/workspace';
import { FlowDeskStore } from '@/backend/store/storage-store';
import { InvoiceBranding } from '@/shared/types';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { serverPaymentSettingsCache } from '@/backend/utilities/payment-cache';

export const runtime = 'nodejs';

/**
 * Validates whether a payment settings candidate contains non-empty UPI or bank data
 */
function hasValidPaymentData(p: any): boolean {
  if (!p || typeof p !== 'object') return false;
  if (p.upiId && typeof p.upiId === 'string' && p.upiId.trim().length > 0) return true;
  if (p.upi_id && typeof p.upi_id === 'string' && p.upi_id.trim().length > 0) return true;
  if (p.upiQrCodeUrl && typeof p.upiQrCodeUrl === 'string' && p.upiQrCodeUrl.trim().length > 0) return true;
  if (p.upi_qr_code_url && typeof p.upi_qr_code_url === 'string' && p.upi_qr_code_url.trim().length > 0) return true;
  const bd = p.bankDetails || p.payment_settings?.bankDetails || p;
  if (bd && typeof bd === 'object') {
    if (bd.accountNumber && String(bd.accountNumber).trim().length > 0) return true;
    if (bd.account_number && String(bd.account_number).trim().length > 0) return true;
    if (bd.bankName && String(bd.bankName).trim().length > 0) return true;
    if (bd.bank_name && String(bd.bank_name).trim().length > 0) return true;
    if (bd.accountHolderName && String(bd.accountHolderName).trim().length > 0) return true;
    if (bd.account_holder_name && String(bd.account_holder_name).trim().length > 0) return true;
    if (bd.ifscCode && String(bd.ifscCode).trim().length > 0) return true;
    if (bd.ifsc_code && String(bd.ifsc_code).trim().length > 0) return true;
    if (bd.upiId && String(bd.upiId).trim().length > 0) return true;
  }
  return false;
}

/**
 * Extracts and cleans payment details from any raw configuration object
 */
function extractPaymentFields(obj: any): {
  upiId?: string;
  upiQrCodeUrl?: string;
  bankDetails?: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branchName: string;
    upiId?: string;
  };
  razorpayPaymentLink?: string;
} {
  if (!obj || typeof obj !== 'object') return {};
  const upiId = (obj.upiId || obj.upi_id || obj.bankDetails?.upiId || obj.payment_settings?.upiId || '')?.trim();
  const upiQrCodeUrl = (obj.upiQrCodeUrl || obj.upi_qr_code_url || obj.payment_settings?.upiQrCodeUrl || '')?.trim();
  const razorpayPaymentLink = (obj.razorpayPaymentLink || obj.razorpay_payment_link || obj.payment_settings?.razorpayPaymentLink || '')?.trim();

  const rawBank = obj.bankDetails || obj.payment_settings?.bankDetails || (obj.bank_name || obj.account_number ? obj : null);
  let bankDetails: any = undefined;
  if (rawBank && typeof rawBank === 'object') {
    const bankName = (rawBank.bankName || rawBank.bank_name || '')?.trim();
    const accountHolderName = (rawBank.accountHolderName || rawBank.account_holder_name || '')?.trim();
    const accountNumber = (rawBank.accountNumber || rawBank.account_number || '')?.trim();
    const ifscCode = (rawBank.ifscCode || rawBank.ifsc_code || rawBank.swiftCode || rawBank.swift_code || '')?.trim();
    const branchName = (rawBank.branchName || rawBank.branch_name || '')?.trim();
    const bankUpiId = (rawBank.upiId || rawBank.upi_id || upiId || '')?.trim();

    if (bankName || accountNumber || accountHolderName || ifscCode) {
      bankDetails = {
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode,
        branchName,
        upiId: bankUpiId || upiId || undefined,
      };
    }
  }

  return {
    upiId: upiId || undefined,
    upiQrCodeUrl: upiQrCodeUrl || undefined,
    bankDetails,
    razorpayPaymentLink: razorpayPaymentLink || undefined,
  };
}

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
  const invoiceId = searchParams.get('invoiceId')?.trim();

  // Demo Mode Handler
  if (isDemoModeActive()) {
    const localProf = FlowDeskStore.getUserProfile() || {};
    const bankDetails = (localProf as any).bankDetails || {
      bankName: (localProf as any).bankName || '',
      accountHolderName: (localProf as any).accountHolderName || localProf.name || '',
      accountNumber: (localProf as any).accountNumber || '',
      ifscCode: (localProf as any).ifscCode || '',
      branchName: (localProf as any).branchName || '',
      upiId: localProf.upiId || '',
    };
    const hasBank = Boolean(bankDetails.accountNumber || bankDetails.bankName);

    const demoBranding: InvoiceBranding = {
      businessName: (DEMO_WORKSPACE.name && DEMO_WORKSPACE.name !== 'My Workspace')
        ? DEMO_WORKSPACE.name
        : (localProf.companyName || localProf.name || 'FlowDesk Freelance Studio'),
      freelancerName: localProf.name || 'Studio Lead',
      email: localProf.email || 'billing@flowdesk.app',
      phone: localProf.phone || '',
      logoUrl: DEMO_WORKSPACE.logoUrl || localProf.logoUrl || '/branding/flowdesk-symbol.png',
      signatureUrl: DEMO_WORKSPACE.signatureUrl || localProf.signatureUrl || '',
      upiQrCodeUrl: localProf.upiQrCodeUrl || (localProf as any).paymentMethods?.upiQrCodeUrl || '',
      upiId: localProf.upiId || '',
      bankDetails: hasBank ? bankDetails : undefined,
      razorpayPaymentLink: (localProf as any).razorpayPaymentLink || '',
      paymentMethods: {
        bankTransferEnabled: true,
        upiEnabled: Boolean(localProf.upiId || localProf.upiQrCodeUrl),
        razorpayLinkEnabled: Boolean((localProf as any).razorpayPaymentLink),
        upiQrCodeUrl: localProf.upiQrCodeUrl,
        upiId: localProf.upiId,
        bankDetails: hasBank ? bankDetails : undefined,
      },
    };
    return NextResponse.json(
      { success: true, branding: demoBranding },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  }

  try {
    let targetWsId = workspaceId || null;
    const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

    // 1. Resolve workspace ID from invoice record if invoiceId provided
    let invoiceRecord: any = null;
    if (invoiceId) {
      try {
        let invQuery = supabaseAdmin.from('invoices').select('*');
        if (UUID_PATTERN.test(invoiceId)) {
          invQuery = invQuery.or(`id.eq.${invoiceId},invoice_number.eq.${invoiceId}`);
        } else {
          invQuery = invQuery.eq('invoice_number', invoiceId);
        }
        const { data: invRows } = await invQuery.limit(1);
        const invRow = invRows?.[0];
        if (invRow) {
          invoiceRecord = invRow;
          if (invRow.workspace_id) {
            targetWsId = invRow.workspace_id;
          }
        }
      } catch {
        // non-critical
      }
    }

    // 2. Resolve workspace ID from client record if clientId provided
    if (!targetWsId && clientId) {
      try {
        let cQuery = supabaseAdmin.from('clients').select('workspace_id, id');
        if (UUID_PATTERN.test(clientId)) {
          cQuery = cQuery.or(`id.eq.${clientId},user_id.eq.${clientId}`);
        } else if (clientId.includes('@')) {
          cQuery = cQuery.ilike('email', clientId.toLowerCase());
        } else {
          cQuery = cQuery.eq('portal_token', clientId);
        }

        const { data: cRows } = await cQuery.limit(1);
        const cRow = cRows?.[0];
        if (cRow?.workspace_id) {
          targetWsId = cRow.workspace_id;
        }
      } catch {
        // non-critical
      }
    }

    // 3. Resolve workspace ID from client_connections table
    if (!targetWsId && clientId) {
      try {
        const { data: connRows } = await supabaseAdmin
          .from('client_connections')
          .select('workspace_id')
          .or(`client_user_id.eq.${clientId},client_id.eq.${clientId}`)
          .order('connected_at', { ascending: false })
          .limit(1);
        if (connRows?.[0]?.workspace_id) {
          targetWsId = connRows[0].workspace_id;
        }
      } catch {
        // non-critical
      }
    }

    // 4. Resolve workspace ID from recent client invoices
    if (!targetWsId && clientId) {
      try {
        const { data: invRows } = await supabaseAdmin
          .from('invoices')
          .select('workspace_id, id')
          .eq('client_id', clientId)
          .not('workspace_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1);
        if (invRows?.[0]?.workspace_id) {
          targetWsId = invRows[0].workspace_id;
          if (!invoiceRecord && invRows[0].id) invoiceRecord = invRows[0];
        }
      } catch {
        // non-critical
      }
    }

    // 5. Fallback to latest workspace if single studio deployment
    if (!targetWsId) {
      try {
        const { data: recentWs } = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recentWs?.id) {
          targetWsId = recentWs.id;
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

    if (!targetWsId) {
      // Fail closed: return neutral FlowDesk branding without cross-tenant exposure
      return NextResponse.json(
        { success: true, branding },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }

    let ownerId: string | null = null;
    let wsData: any = null;

    if (targetWsId) {
      const { data } = await supabaseAdmin
        .from('workspaces')
        .select('name, logo_url, signature_url, owner_id')
        .eq('id', targetWsId)
        .maybeSingle();
      wsData = data;

      if (wsData) {
        ownerId = wsData.owner_id;
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
      }
    }

    // Load profile and user settings for the owner
    let profData: any = null;
    let userSettingsData: any = null;

    if (ownerId) {
      const [profRes, settingsRes] = await Promise.all([
        supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', ownerId)
          .maybeSingle(),
        supabaseAdmin
          .from('user_settings')
          .select('*')
          .eq('id', ownerId)
          .maybeSingle(),
      ]);

      profData = profRes.data;
      userSettingsData = settingsRes.data;
    }

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

    // Multi-tier Payment Settings Resolution (user_settings DB -> in-memory -> owner storage -> profiles -> invoice -> store)
    let candidatePaymentSettings: any = null;

    // 0. Primary Authoritative Source: user_settings table row for workspace owner
    if (userSettingsData) {
      const uBank = userSettingsData.payment_settings?.bankDetails || {};
      const uBankName = (userSettingsData.bank_name || uBank.bankName || '')?.trim();
      const uAccHolder = (userSettingsData.account_holder_name || uBank.accountHolderName || '')?.trim();
      const uAccNum = (userSettingsData.account_number || uBank.accountNumber || '')?.trim();
      const uIfsc = (userSettingsData.ifsc_code || uBank.ifscCode || '')?.trim();
      const uBranch = (userSettingsData.branch_name || uBank.branchName || '')?.trim();
      const uUpi = (userSettingsData.upi_id || userSettingsData.payment_settings?.upiId || uBank.upiId || '')?.trim();
      const uQr = (userSettingsData.upi_qr_code_url || userSettingsData.payment_settings?.upiQrCodeUrl || '')?.trim();
      const uRzp = (userSettingsData.razorpay_payment_link || userSettingsData.payment_settings?.razorpayPaymentLink || '')?.trim();

      if (uUpi || uQr || uBankName || uAccNum || uAccHolder || uIfsc) {
        candidatePaymentSettings = {
          upiId: uUpi || undefined,
          upiQrCodeUrl: uQr || undefined,
          upiEnabled: Boolean(uUpi || uQr),
          bankDetails: {
            accountHolderName: uAccHolder,
            bankName: uBankName,
            accountNumber: uAccNum,
            ifscCode: uIfsc,
            branchName: uBranch,
            upiId: uUpi || undefined,
          },
          razorpayPaymentLink: uRzp || undefined,
          ...(userSettingsData.payment_settings || {}),
        };
      }
    }

    // 1. Check server-side memory cache for ownerId
    if (!candidatePaymentSettings && ownerId && serverPaymentSettingsCache.has(ownerId)) {
      const mem = serverPaymentSettingsCache.get(ownerId);
      if (hasValidPaymentData(mem)) {
        candidatePaymentSettings = mem;
      }
    }

    // 2. Check storage for ownerId: settings/${ownerId}/payment_settings.txt
    if (!candidatePaymentSettings && ownerId) {
      try {
        const { data: fileBlob, error: fileErr } = await supabaseAdmin.storage
          .from('documents')
          .download(`settings/${ownerId}/payment_settings.txt`);
        if (!fileErr && fileBlob) {
          const parsed = JSON.parse(await fileBlob.text());
          if (hasValidPaymentData(parsed)) {
            candidatePaymentSettings = parsed;
          }
        }
      } catch {
        // non-critical
      }
    }

    // 3. Check profiles table for ownerId
    if (!candidatePaymentSettings && profData && (profData.upi_id || profData.upi_qr_code_url)) {
      candidatePaymentSettings = {
        upiId: profData.upi_id || '',
        upiQrCodeUrl: profData.upi_qr_code_url || '',
        upiEnabled: Boolean(profData.upi_id || profData.upi_qr_code_url),
      };
    }

    // 4. Check invoice's own payment_methods / instructions / notes
    if (!candidatePaymentSettings && invoiceRecord) {
      if (invoiceRecord.payment_methods && hasValidPaymentData(invoiceRecord.payment_methods)) {
        candidatePaymentSettings = invoiceRecord.payment_methods;
      } else if (invoiceRecord.payment_instructions) {
        const text = invoiceRecord.payment_instructions;
        const upiMatch = text.match(/[\w.-]+@[\w.-]+/);
        if (upiMatch) {
          candidatePaymentSettings = { upiId: upiMatch[0], upiEnabled: true };
        }
      }
    }

    // 7. Check latest payment settings in documents storage bucket
    if (!candidatePaymentSettings) {
      try {
        const { data: fileBlob } = await supabaseAdmin.storage
          .from('documents')
          .download('settings/latest/payment_settings.txt');
        if (fileBlob) {
          const parsed = JSON.parse(await fileBlob.text());
          if (hasValidPaymentData(parsed)) {
            candidatePaymentSettings = parsed;
          }
        }
      } catch {
        // non-critical
      }
    }

    // 8. Fallback to system store
    if (!candidatePaymentSettings) {
      try {
        const localProf = FlowDeskStore.getUserProfile() || {};
        if (hasValidPaymentData(localProf)) {
          candidatePaymentSettings = localProf;
        }
      } catch {
        // non-critical
      }
    }

    // Extract structured payment details
    const extracted = extractPaymentFields(candidatePaymentSettings || {});

    // Also check profiles for direct UPI columns if not in extracted
    if (!extracted.upiId && profData?.upi_id) {
      extracted.upiId = profData.upi_id;
    }
    if (!extracted.upiQrCodeUrl && profData?.upi_qr_code_url) {
      extracted.upiQrCodeUrl = profData.upi_qr_code_url;
    }

    // Also check invoiceRecord for payment_instructions UPI
    if (!extracted.upiId && invoiceRecord?.payment_instructions) {
      const upiMatch = invoiceRecord.payment_instructions.match(/[\w.-]+@[\w.-]+/);
      if (upiMatch) extracted.upiId = upiMatch[0];
    }

    // Apply extracted details to branding object
    if (extracted.upiId) {
      branding.upiId = extracted.upiId;
    }

    if (extracted.upiQrCodeUrl) {
      branding.upiQrCodeUrl =
        extracted.upiQrCodeUrl.startsWith('http') ||
        extracted.upiQrCodeUrl.startsWith('/') ||
        extracted.upiQrCodeUrl.startsWith('data:')
          ? extracted.upiQrCodeUrl
          : StorageHelper.getPublicUrl('logos', extracted.upiQrCodeUrl);
    }

    if (extracted.bankDetails) {
      branding.bankDetails = extracted.bankDetails;
      (branding as any).bankName = extracted.bankDetails.bankName;
      (branding as any).accountHolderName = extracted.bankDetails.accountHolderName;
      (branding as any).accountNumber = extracted.bankDetails.accountNumber;
      (branding as any).ifscCode = extracted.bankDetails.ifscCode;
      (branding as any).branchName = extracted.bankDetails.branchName;
    }

    if (extracted.razorpayPaymentLink) {
      branding.razorpayPaymentLink = extracted.razorpayPaymentLink;
    }

    const hasBank = Boolean(
      branding.bankDetails?.accountNumber ||
      branding.bankDetails?.bankName ||
      branding.bankDetails?.accountHolderName ||
      branding.bankDetails?.ifscCode
    );
    const hasUpi = Boolean(branding.upiId || branding.upiQrCodeUrl);

    branding.paymentMethods = {
      bankTransferEnabled: hasBank,
      upiEnabled: hasUpi,
      razorpayLinkEnabled: Boolean(branding.razorpayPaymentLink),
      upiQrCodeUrl: branding.upiQrCodeUrl,
      upiId: branding.upiId,
      bankDetails: hasBank ? branding.bankDetails : undefined,
      razorpayPaymentLink: branding.razorpayPaymentLink,
    };

    // Preserve custom branding updated on the freelancer's side
    if (branding.logoUrl && branding.logoUrl !== '/branding/flowdesk-symbol.png') {
      (branding as any).isCustomBranded = true;
    } else if (targetWsId) {
      try {
        const { can } = await import('@/backend/billing');
        const hasCustomBranding = await can(targetWsId, 'customBranding');
        (branding as any).isCustomBranded = hasCustomBranding;
        if (!hasCustomBranding && (!branding.logoUrl || branding.logoUrl === '')) {
          branding.logoUrl = '/branding/flowdesk-symbol.png';
        }
      } catch {
        // Fallback safe
      }
    }

    return NextResponse.json(
      {
        success: true,
        branding,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (err: any) {
    console.warn('[Branding API] Error resolving portal branding:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to resolve portal branding.',
      },
      { status: 500 }
    );
  }
}
