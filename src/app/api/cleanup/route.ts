import { NextResponse } from 'next/server';
import { executeCleanup } from '@/lib/cleanup';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { verifyBearerSecret } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const rl = checkRateLimit(`cleanup_${clientIp}`, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const authHeader = request.headers.get('authorization');
  const secret = process.env.CLEANUP_SECRET || process.env.CRON_SECRET;

  if (!verifyBearerSecret(authHeader, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await executeCleanup();
    return NextResponse.json({
      success: true,
      cleaned: result,
      timestamp: result.timestamp,
    });
  } catch (error: unknown) {
    console.error('Manual cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
