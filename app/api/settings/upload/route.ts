import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { resolveApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { validateUploadFile } from '@/backend/storage/upload-validator';
import { sanitizeFileName } from '@/backend/storage/storage-helper';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting: 30 requests per minute
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'branding_upload',
    maxRequests: 30,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many upload attempts. Please try again shortly.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Caller Identity Resolution
  const caller = await resolveApiCaller();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as 'logo' | 'signature' | 'qr' | null;
    const requestedWsId = formData.get('workspaceId') as string | null;
    const requestedUserId = formData.get('userId') as string | null;

    if (!file || !type || (type !== 'logo' && type !== 'signature' && type !== 'qr')) {
      return NextResponse.json(
        { error: 'Valid file and type ("logo", "signature", or "qr") are required.' },
        { status: 400 }
      );
    }

    const bucketName = type === 'signature' ? 'signatures' : 'logos';

    // 3. Strict File Validation (Magic Bytes & MIME types)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);

    const validation = validateUploadFile(
      {
        name: file.name,
        size: file.size,
        type: file.type,
        bytes,
      },
      bucketName
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || `Invalid file format or size for ${type}.` },
        { status: 400 }
      );
    }

    const mimeType = validation.sniffedMime || file.type || 'image/png';
    const targetUserId = caller.userId || requestedUserId || null;
    const targetWsId = caller.workspaceId || requestedWsId || targetUserId || 'branding';

    // 4. Handle Demo Mode (Return Safe Data URL)
    if (isDemoModeActive()) {
      const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
      return NextResponse.json({
        success: true,
        url: base64,
        type,
      });
    }

    // 5. Ensure Bucket Exists
    try {
      const { data: bucketData } = await supabaseAdmin.storage.getBucket(bucketName);
      if (!bucketData) {
        await supabaseAdmin.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
        });
      }
    } catch {
      // Non-fatal if bucket already exists
    }

    // 6. Build Canonical Path: workspaces/{workspaceId}/branding/{uuid}_{sanitizedName}
    const cleanFileName = sanitizeFileName(file.name);
    const uniqueId = crypto.randomUUID();
    const filePath = `workspaces/${targetWsId}/branding/${uniqueId}_${cleanFileName}`;

    // 7. Upload to Supabase Storage with supabaseAdmin (service role bypasses RLS)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`[Upload API] Storage upload error for ${bucketName}/${filePath}:`, uploadError);
      return NextResponse.json(
        { error: uploadError.message || 'Storage upload failed.' },
        { status: 500 }
      );
    }

    // 8. Retrieve Public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(uploadData?.path || filePath);

    const publicUrl = urlData.publicUrl;

    // 9. Sync URL to Database Records
    const column = type === 'logo' ? 'logo_url' : type === 'signature' ? 'signature_url' : 'upi_qr_code_url';

    if (targetUserId) {
      try {
        await supabaseAdmin
          .from('profiles')
          .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', targetUserId);
      } catch (dbErr) {
        console.warn('[Upload API] Profile branding update notice:', dbErr);
      }

      if (type === 'qr') {
        try {
          // Fetch existing user_settings to merge payment_settings JSONB
          const { data: existingSettings } = await supabaseAdmin
            .from('user_settings')
            .select('payment_settings')
            .eq('id', targetUserId)
            .maybeSingle();

          const existingPayment = (existingSettings?.payment_settings as any) || {};
          const updatedPayment = {
            ...existingPayment,
            upiQrCodeUrl: publicUrl,
            upiEnabled: true,
          };

          // Try upserting both top-level column upi_qr_code_url and payment_settings JSONB
          const { error: upsertErr } = await supabaseAdmin
            .from('user_settings')
            .upsert({
              id: targetUserId,
              upi_qr_code_url: publicUrl,
              payment_settings: updatedPayment,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });

          if (upsertErr) {
            // Fall back to just updating payment_settings JSONB if upi_qr_code_url column does not exist
            await supabaseAdmin
              .from('user_settings')
              .upsert({
                id: targetUserId,
                payment_settings: updatedPayment,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'id' });
          }
        } catch (usErr) {
          console.warn('[Upload API] User settings QR update notice:', usErr);
        }
      }
    }

    if (targetWsId && targetWsId !== 'branding' && targetWsId !== targetUserId && type !== 'qr') {
      try {
        await supabaseAdmin
          .from('workspaces')
          .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', targetWsId);
      } catch (wsErr) {
        console.warn('[Upload API] Workspace branding update notice:', wsErr);
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      type,
    });
  } catch (err: any) {
    console.error('[Upload API] Uncaught exception:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error processing upload.' },
      { status: 500 }
    );
  }
}
