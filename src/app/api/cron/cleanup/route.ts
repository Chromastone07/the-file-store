import { NextResponse } from 'next/server';
import { executeCleanup } from '@/lib/cleanup';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { verifyBearerSecret } from '@/lib/security';

// Force dynamic execution since cron jobs are not static
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const rl = checkRateLimit(`cron_cleanup_${clientIp}`, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET || process.env.CLEANUP_SECRET;

  if (!verifyBearerSecret(authHeader, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await executeCleanup();
    return NextResponse.json({
      success: true,
      filesDeleted: result.dropsDeleted,
      textsDeleted: result.textsDeleted,
      timestamp: result.timestamp,
    });
  } catch (error: unknown) {
    console.error('Cron cleanup error:', error);
    const message = error instanceof Error ? error.message : 'Internal cleanup failure';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
