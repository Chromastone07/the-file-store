// Verification script for 20 rapid mixed shares
// Confirms zero premature destructions

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mereketfwahxgketfcoi.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lcmVrZXRmd2FoeGdrZXRmY29pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDk0NDMsImV4cCI6MjA4OTQ4NTQ0M30.0bP552zO3rk5snYBaN0frk13uo2DbvYQsdBhsy8DH-I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function generateCode(prefix, index) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${index}_${rand}`;
}

async function runTest() {
  console.log('--- Starting 20 Rapid Mixed Shares Verification ---');
  const items = [];
  const createdCodes = [];
  const count = 20;

  const now = new Date();

  // 1. Rapidly generate 20 mixed items
  for (let i = 0; i < count; i++) {
    const isDrop = i % 2 === 0;
    const isBurn = i % 3 === 0;
    const expiryMinutes = (i + 1) * 30; // 30m to 600m
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000).toISOString();
    const sessionCode = generateCode(isDrop ? 'TEST_DROP' : 'TEST_TEXT', i);

    createdCodes.push({ code: sessionCode, type: isDrop ? 'drop' : 'text', isBurn });

    if (isDrop) {
      items.push(
        supabase.from('drops').insert({
          session_code: sessionCode,
          storage_path: `test/${sessionCode}.bin`,
          encrypted_filename: `file_${i}.txt`,
          file_type: 'text/plain',
          file_size: 1024,
          encryption_iv: 'dGVzdF9pdl8xMjM0NTY=',
          has_password: false,
          burn_after_reading: isBurn,
          expires_at: expiresAt,
          view_count: 0,
          is_destroyed: false,
        })
      );
    } else {
      items.push(
        supabase.from('secure_texts').insert({
          session_code: sessionCode,
          encrypted_content: 'dGVzdF9lbmNyeXB0ZWRfY29udGVudA==',
          content_type: 'text',
          encryption_iv: 'dGVzdF9pdl8xMjM0NTY=',
          has_password: false,
          burn_after_reading: isBurn,
          expires_at: expiresAt,
          view_count: 0,
          is_destroyed: false,
        })
      );
    }
  }

  // Execute all 20 creations concurrently
  console.log(`Inserting ${count} mixed items concurrently...`);
  const insertResults = await Promise.all(items);
  const insertErrors = insertResults.filter(r => r.error);
  if (insertErrors.length > 0) {
    console.error('Insert errors detected:', insertErrors.map(e => e.error.message));
  } else {
    console.log(`Successfully created ${count} items.`);
  }

  // 2. Query each item immediately via RPC
  console.log('Querying all 20 items to verify survival...');
  let intactCount = 0;
  let prematurelyDestroyed = 0;

  for (const item of createdCodes) {
    if (item.type === 'drop') {
      const { data } = await supabase.rpc('get_drop_by_code', { p_code: item.code });
      const record = Array.isArray(data) ? data[0] : data;
      if (record && !record.is_destroyed) {
        intactCount++;
      } else {
        prematurelyDestroyed++;
      }
    } else {
      const { data } = await supabase.rpc('get_secure_text_by_code', { p_code: item.code });
      const record = Array.isArray(data) ? data[0] : data;
      if (record && !record.is_destroyed) {
        intactCount++;
      } else {
        prematurelyDestroyed++;
      }
    }
  }

  console.log(`Test Results:`);
  console.log(`- Total Created: ${count}`);
  console.log(`- Intact & Accessible: ${intactCount}`);
  console.log(`- Prematurely Vanished / Destroyed: ${prematurelyDestroyed}`);

  if (intactCount === count && prematurelyDestroyed === 0) {
    console.log('VERIFICATION PASSED: 0 items vanished early!');
  } else {
    console.error('VERIFICATION FAILED: Items vanished early.');
  }

  // Cleanup test items
  console.log('Cleaning up test rows...');
  for (const item of createdCodes) {
    if (item.type === 'drop') {
      await supabase.rpc('destroy_drop_by_code', { p_code: item.code });
    } else {
      await supabase.rpc('destroy_text_by_code', { p_code: item.code });
    }
  }
  console.log('Cleanup complete.');
}

runTest().catch(console.error);
