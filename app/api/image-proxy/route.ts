import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Image proxy endpoint to fetch remote assets (Supabase public storage, avatars, logos)
 * server-side and stream them with open CORS headers to prevent canvas tainting in html2canvas.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing image url parameter' }, { status: 400 });
  }

  // Allow only HTTP/HTTPS protocols
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'Only HTTP/HTTPS URLs allowed' }, { status: 400 });
  }

  try {
    const upstreamRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'FlowDesk-Image-Proxy/1.0',
      },
      next: { revalidate: 3600 },
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream image fetch failed: ${upstreamRes.statusText}` },
        { status: upstreamRes.status }
      );
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/png';
    const buffer = await upstreamRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err: any) {
    console.warn('[ImageProxy] Failed to proxy image:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch image upstream' },
      { status: 500 }
    );
  }
}
