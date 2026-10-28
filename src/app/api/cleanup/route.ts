import { NextResponse } from 'next/server';
import { executeCleanup } from '@/lib/cleanup';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Verify cleanup secret if configured
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CLEANUP_SECRET || process.env.CRON_SECRET;
  
  if (secret && authHeader !== `Bearer ${secret}`) {
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
