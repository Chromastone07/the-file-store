"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { hashString } from '@/lib/crypto';
import { Eye } from 'lucide-react';

export default function LiveViewCount({ sessionCode, type }: { sessionCode: string; type: 'drop' | 'text' }) {
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    let active = true;
    let dbCode = '';
    const table = type === 'drop' ? 'drops' : 'secure_texts';

    const fetchViews = async () => {
      try {
        const dbLookupCode = await hashString(sessionCode);
        dbCode = dbLookupCode;
        if (!active) return;
        
        let query = supabase.from(table).select('view_count');
        if (type === 'drop') {
          query = query.or(`session_code.eq.${dbLookupCode},group_code.eq.${dbLookupCode}`);
        } else {
          query = query.eq('session_code', dbLookupCode);
        }

        const { data } = await query;
        if (data) {
          const totalViews = data.reduce((sum, row) => sum + (row.view_count || 0), 0);
          setViewCount(totalViews);
        }
      } catch (e) {}
    };

    fetchViews();
    
    // Fallback polling (slow)
    const interval = setInterval(fetchViews, 10000);

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
      <span className="text-[var(--phantom-muted)] text-xs font-semibold uppercase tracking-wider mb-0.5">Views / Downloads</span>
      <span className="flex items-center gap-1.5 font-mono text-sm font-medium">
        <Eye className="w-3.5 h-3.5 text-[var(--phantom-glow)]" /> 
        {viewCount}
      </span>
    </div>
  );
}
