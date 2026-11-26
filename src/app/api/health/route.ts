import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const rl = checkRateLimit(`health_${clientIp}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const startTime = Date.now();
  try {
    // Quick, RLS-safe RPC probe to verify database and pool responsiveness
    const { error } = await supabase
      .rpc('get_drop_by_code', { p_code: '__health_probe__' });

    const latencyMs = Date.now() - startTime;

    if (error) {
      return NextResponse.json(
        {
          status: 'overloaded',
          healthy: false,
          latencyMs,
          message: 'Database connection pool is saturated or experiencing high load.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      healthy: true,
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json(
      {
        status: 'unavailable',
        healthy: false,
        latencyMs,
        message: err instanceof Error ? err.message : 'Storage/DB unreachable.',
      },
      { status: 503 }
    );
  }
}
