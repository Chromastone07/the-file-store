"use client";

import { useEffect, useState } from 'react';
import { supabase, getDropsByLookupCode, getSecureTextByCode } from '@/lib/supabase';
import { hashString } from '@/lib/crypto';
import { Eye } from 'lucide-react';

export default function LiveViewCount({ sessionCode, type }: { sessionCode: string; type: 'drop' | 'text' }) {
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    let active = true;
    const table = type === 'drop' ? 'drops' : 'secure_texts';

    const fetchViews = async () => {
      try {
        const dbLookupCode = await hashString(sessionCode);
        if (!active) return;
        
        if (type === 'drop') {
          const { data } = await getDropsByLookupCode(dbLookupCode);
          if (data && active) {
            const totalViews = data.reduce((sum, row) => sum + (row.view_count || 0), 0);
            setViewCount(totalViews);
          }
        } else {
          const { data } = await getSecureTextByCode(dbLookupCode);
          if (data && active) {
            setViewCount(data.view_count || 0);
          }
        }
      } catch {
        // Silent fail for polling
      }
    };

    fetchViews();
    
    // Fallback polling
    const interval = setInterval(fetchViews, 8000);

    // Setup Realtime
    const channel = supabase
      .channel(`live-view-${sessionCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table },
        () => {
          fetchViews();
        }
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [sessionCode, type]);

  return (
    <div className="flex flex-col items-center">
      <span className="text-[var(--wisp-muted)] text-xs font-semibold uppercase tracking-wider mb-0.5">Views / Downloads</span>
      <span className="flex items-center gap-1.5 font-mono text-sm font-semibold text-[var(--wisp-text)]">
        <Eye className="w-3.5 h-3.5 text-[var(--wisp-glow)]" /> 
        {viewCount}
      </span>
    </div>
  );
}
