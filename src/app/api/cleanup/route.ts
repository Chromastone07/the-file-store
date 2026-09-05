import { NextResponse } from 'next/server';
import { cleanupExpired } from '@/lib/supabase';

export async function GET(request: Request) {
  // Verify cleanup secret
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CLEANUP_SECRET;
  
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await cleanupExpired();
    return NextResponse.json({
      success: true,
      cleaned: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Cleanup failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
