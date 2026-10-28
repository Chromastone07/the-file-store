import { NextResponse } from 'next/server';
import { executeCleanup } from '@/lib/cleanup';

// Force dynamic execution since cron jobs are not static
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // CRON_SECRET for security if using Vercel Cron or external triggers
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET && 
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
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
