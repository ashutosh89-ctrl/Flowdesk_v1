import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { resolveApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
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

  // 2. Authentication
  const caller = await resolveApiCaller();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as 'logo' | 'signature' | null;
    const requestedWsId = formData.get('workspaceId') as string | null;
    const requestedUserId = formData.get('userId') as string | null;

    if (!file || !type || (type !== 'logo' && type !== 'signature')) {
      return NextResponse.json(
        { error: 'Valid file and type ("logo" or "signature") are required.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum allowed limit of 5MB.' },
        { status: 400 }
      );
    }

    const mimeType = file.type || 'image/png';
    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid file format. Please upload PNG, JPG, WebP, or SVG.' },
        { status: 400 }
      );
    }

    const targetUserId = caller.userId || requestedUserId || null;
    const targetWsId = caller.workspaceId || requestedWsId || null;

    // Handle Demo Mode
    if (isDemoModeActive()) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
      return NextResponse.json({
        success: true,
        url: base64,
        type,
      });
    }

    const bucketName = type === 'logo' ? 'logos' : 'signatures';

    // Ensure bucket exists in storage.buckets via admin client
    try {
      const { data: bucketData } = await supabaseAdmin.storage.getBucket(bucketName);
      if (!bucketData) {
        await supabaseAdmin.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: MAX_FILE_SIZE,
          allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
        });
      }
    } catch {
      // Bucket check error non-fatal if bucket already exists
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const uniqueId = crypto.randomUUID();
    const fileName = `${targetWsId || targetUserId || 'branding'}_${uniqueId}.${fileExt}`;
    const filePath = `branding/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload using Supabase Admin client (bypasses RLS completely)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[Upload API] Storage upload error:', uploadError);
      return NextResponse.json(
        { error: uploadError.message || 'Storage upload failed.' },
        { status: 500 }
      );
    }

    // Retrieve public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(uploadData?.path || filePath);

    const publicUrl = urlData.publicUrl;

    // Update database records in parallel
    const column = type === 'logo' ? 'logo_url' : 'signature_url';

    if (targetUserId) {
      try {
        await supabaseAdmin
          .from('profiles')
          .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', targetUserId);
      } catch (dbErr) {
        console.warn('[Upload API] Profile update notice:', dbErr);
      }
    }

    if (targetWsId) {
      try {
        await supabaseAdmin
          .from('workspaces')
          .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', targetWsId);
      } catch (wsErr) {
        console.warn('[Upload API] Workspace update notice:', wsErr);
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
