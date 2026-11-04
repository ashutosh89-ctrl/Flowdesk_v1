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
      },
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

        // If user_settings row for ownerId is missing or has no payment details, check storage or recent rows
        let storagePaymentSettings: any = null;
        if (ownerId) {
          try {
            const { data: fileBlob, error: fileErr } = await supabaseAdmin.storage
              .from('documents')
              .download(`settings/${ownerId}/payment_settings.txt`);
            if (!fileErr && fileBlob) {
              const text = await fileBlob.text();
              storagePaymentSettings = JSON.parse(text);
            }
          } catch {
            // non-critical
          }
        }

        if (!storagePaymentSettings) {
          try {
            const { data: list } = await supabaseAdmin.storage.from('documents').list('settings');
            if (list && list.length > 0) {
              for (const item of list) {
                if (item.name && item.name.length > 10) {
                  const { data: fb } = await supabaseAdmin.storage
                    .from('documents')
                    .download(`settings/${item.name}/payment_settings.txt`);
                  if (fb) {
                    const txt = await fb.text();
                    storagePaymentSettings = JSON.parse(txt);
                    if (storagePaymentSettings?.bankDetails || storagePaymentSettings?.upiId) break;
                  }
                }
              }
            }
          } catch {
            // non-critical
          }
        }

        if (storagePaymentSettings) {
          userSettingsData = {
            ...(userSettingsData || {}),
            payment_settings: {
              ...(userSettingsData?.payment_settings || {}),
              ...storagePaymentSettings,
            },
            upi_id: storagePaymentSettings.upiId || userSettingsData?.upi_id,
            upi_qr_code_url: storagePaymentSettings.upiQrCodeUrl || userSettingsData?.upi_qr_code_url,
            bank_name: storagePaymentSettings.bankDetails?.bankName || userSettingsData?.bank_name,
            account_holder_name: storagePaymentSettings.bankDetails?.accountHolderName || userSettingsData?.account_holder_name,
            account_number: storagePaymentSettings.bankDetails?.accountNumber || userSettingsData?.account_number,
            ifsc_code: storagePaymentSettings.bankDetails?.ifscCode || userSettingsData?.ifsc_code,
            branch_name: storagePaymentSettings.bankDetails?.branchName || userSettingsData?.branch_name,
            razorpay_payment_link: storagePaymentSettings.razorpayPaymentLink || userSettingsData?.razorpay_payment_link,
          };
        }

        if (!userSettingsData?.payment_settings?.bankDetails && !userSettingsData?.bank_name && !userSettingsData?.upi_qr_code_url) {
          try {
            const { data: latestSettings } = await supabaseAdmin
              .from('user_settings')
              .select('*')
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (latestSettings) {
              userSettingsData = { ...(userSettingsData || {}), ...latestSettings };
            }
          } catch {
            // non-critical
          }
        }

        // If profiles row for ownerId is missing, check latest profile
        if (!profData) {
          try {
            const { data: latestProf } = await supabaseAdmin
              .from('profiles')
              .select('*')
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (latestProf) {
              profData = latestProf;
            }
          } catch {
            // non-critical
          }
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
          (userSettingsData?.bank_name || userSettingsData?.account_number
            ? {
                bankName: userSettingsData.bank_name || '',
                accountHolderName: userSettingsData.account_holder_name || '',
                accountNumber: userSettingsData.account_number || '',
                ifscCode: userSettingsData.ifsc_code || '',
                branchName: userSettingsData.branch_name || '',
                upiId: effectiveUpiId,
              }
            : undefined);
        if (bankDetails) {
          branding.bankDetails = bankDetails;
          (branding as any).bankName = bankDetails.bankName;
          (branding as any).accountNumber = bankDetails.accountNumber;
          (branding as any).accountHolderName = bankDetails.accountHolderName;
          (branding as any).ifscCode = bankDetails.ifscCode;
          (branding as any).branchName = bankDetails.branchName;
        }

        const razorpayPaymentLink =
          userSettingsData?.razorpay_payment_link ||
          userSettingsData?.payment_settings?.razorpayPaymentLink ||
          '';
        if (razorpayPaymentLink) {
          branding.razorpayPaymentLink = razorpayPaymentLink;
        }

        if (userSettingsData?.payment_settings) {
          branding.paymentMethods = {
            ...userSettingsData.payment_settings,
            upiQrCodeUrl: branding.upiQrCodeUrl,
            upiId: branding.upiId,
            bankDetails: branding.bankDetails,
          };
        }
      }
    }

    // Inspect recent invoices for client/invoiceId if payment notes or instructions exist
    const invoiceId = searchParams.get('invoiceId')?.trim();
    if (!branding.upiQrCodeUrl || !branding.bankDetails || !branding.upiId) {
      try {
        let invQuery = supabaseAdmin
          .from('invoices')
          .select('id, client_id, notes, payment_instructions');

        if (invoiceId) {
          invQuery = invQuery.eq('id', invoiceId);
        } else if (clientId) {
          invQuery = invQuery.eq('client_id', clientId).order('created_at', { ascending: false }).limit(3);
        }

        const { data: invRows } = await invQuery;
        if (invRows && invRows.length > 0) {
          for (const inv of invRows) {
            if (inv.payment_instructions) {
              const text = inv.payment_instructions;
              const upiMatch = text.match(/[\w.-]+@[\w.-]+/);
              if (upiMatch && !branding.upiId) {
                branding.upiId = upiMatch[0];
              }
            }
          }
        }
      } catch {
        // non-critical
      }
    }

    // If still missing, check system store / mock data fallback
    if (!branding.upiQrCodeUrl || !branding.bankDetails) {
      try {
        const localProf = FlowDeskStore.getUserProfile() || {};
        if (!branding.upiQrCodeUrl && localProf.upiQrCodeUrl) {
          branding.upiQrCodeUrl = localProf.upiQrCodeUrl;
        }
        if (!branding.upiId && localProf.upiId) {
          branding.upiId = localProf.upiId;
        }
        if (!branding.bankDetails && ((localProf as any).bankName || (localProf as any).bankDetails)) {
          const fbBank = (localProf as any).bankDetails || {
            bankName: (localProf as any).bankName || '',
            accountHolderName: (localProf as any).accountHolderName || '',
            accountNumber: (localProf as any).accountNumber || '',
            ifscCode: (localProf as any).ifscCode || '',
            branchName: (localProf as any).branchName || '',
            upiId: branding.upiId || '',
          };
          branding.bankDetails = fbBank;
          (branding as any).bankName = fbBank.bankName;
          (branding as any).accountNumber = fbBank.accountNumber;
          (branding as any).accountHolderName = fbBank.accountHolderName;
          (branding as any).ifscCode = fbBank.ifscCode;
          (branding as any).branchName = fbBank.branchName;
        }
      } catch {
        // non-critical
      }
    }

    // Ensure paymentMethods has up-to-date toggles and fields
    branding.paymentMethods = {
      ...(branding.paymentMethods || {}),
      bankTransferEnabled: Boolean(branding.bankDetails?.accountNumber || branding.bankDetails?.bankName),
      upiEnabled: Boolean(branding.upiId || branding.upiQrCodeUrl),
      upiQrCodeUrl: branding.upiQrCodeUrl,
      upiId: branding.upiId,
      bankDetails: branding.bankDetails,
    };

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
