#!/usr/bin/env node
/**
 * reset-cloud-stocks.js
 * Truncates all stocks from Railway PostgreSQL and re-seeds with 122 curated stocks.
 * Use this to remove OTC junk or start fresh before a clean sync.
 *
 * Usage:
 *   node mexxie-api/scripts/reset-cloud-stocks.js
 *   node mexxie-api/scripts/reset-cloud-stocks.js https://your-railway-url.up.railway.app
 */

const CLOUD_API = (process.argv[2] || 'https://kubora-production.up.railway.app').replace(/\/$/, '') + '/api';

async function main() {
  console.log('=== Reset Railway Stock Universe ===');
  console.log('Target:', CLOUD_API);
  console.log('⚠️  This will DELETE all stocks and re-seed with 122 curated stocks.');
  console.log('Proceeding in 3 seconds... (Ctrl+C to cancel)');
  await new Promise(r => setTimeout(r, 3000));

  console.log('Calling reset endpoint...');
  const res = await fetch(CLOUD_API + '/stocks/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();

  if (!res.ok) {
    console.error('❌ Reset failed:', data.error || res.status);
    process.exit(1);
  }

  console.log('✅', data.message);
  console.log('   Total stocks in cloud DB:', data.total);
  console.log('');
  console.log('Now run sync-to-cloud.js to push your full QuestDB universe back:');
  console.log('  node mexxie-api/scripts/sync-to-cloud.js');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
