import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  try {
    // Quick, non-locking probe query to verify database and pool responsiveness
    const { error } = await supabase
      .from('active_drops')
      .select('count', { count: 'exact', head: true });

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
