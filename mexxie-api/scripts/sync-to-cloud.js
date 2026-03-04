#!/usr/bin/env node
/**
 * sync-to-cloud.js
 * Reads all stocks from local QuestDB and bulk-inserts them into Railway PostgreSQL.
 *
 * Usage:
 *   node mexxie-api/scripts/sync-to-cloud.js
 *   node mexxie-api/scripts/sync-to-cloud.js https://your-custom-railway-url.up.railway.app
 *
 * Requirements: Local QuestDB must be running on port 9000.
 */

const QUESTDB_URL = process.env.QUESTDB_URL || 'http://localhost:9000';
const CLOUD_API   = (process.argv[2] || 'https://kubora-production.up.railway.app').replace(/\/$/, '') + '/api';
const BATCH_SIZE  = 200;

const REGION_FLAGS = { US:'🇺🇸', Europe:'🇪🇺', Asia:'🌏', 'S. America':'🇧🇷', Africa:'🇿🇦', OTCQX:'🇺🇸' };
// OTCQX is US-traded OTC (The Best Market) — maps to US region for display
const REGION_NORMALIZE = { OTCQX:'US' };
const SECTOR_MAP = {
  'Technology':'Technology','Healthcare':'Healthcare','Finance':'Finance',
  'Financial Services':'Finance','Consumer':'Consumer',
  'Consumer Discretionary':'Consumer','Consumer Staples':'Consumer',
  'Energy':'Energy','Industrial':'Industrial','Industrials':'Industrial',
  'Materials':'Materials','Utilities':'Utilities','Real Estate':'Real Estate',
  'Telecom':'Telecom','Communication Services':'Telecom','ETF':'Other'
};

async function queryQuestDB(sql) {
  const url = QUESTDB_URL + '/exec?query=' + encodeURIComponent(sql) + '&limit=25000';
  const res = await fetch(url);
  if (!res.ok) throw new Error('QuestDB HTTP error: ' + res.status);
  const data = await res.json();
  if (data.error) throw new Error('QuestDB query error: ' + data.error);
  // Convert columnar response to row objects
  const cols = data.columns.map(c => c.name);
  return (data.dataset || []).map(row => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  });
}

async function postToCloud(stocks) {
  const res = await fetch(CLOUD_API + '/stocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stocks })
  });
  if (!res.ok) throw new Error('Cloud API error: ' + res.status + ' ' + await res.text());
  return res.json();
}

async function main() {
  console.log('=== Mexxie Stock Universe Sync ===');
  console.log('Source: QuestDB at', QUESTDB_URL);
  console.log('Target: Railway API at', CLOUD_API);
  console.log('');

  // 1. Fetch all stocks from local QuestDB
  console.log('Querying local QuestDB...');
  const sql = `
    SELECT s.symbol, s.name, s.sector, s.region, dp.close
    FROM (SELECT symbol, name, sector, region FROM stocks LATEST ON update_time PARTITION BY symbol) s
    JOIN (SELECT symbol, close FROM daily_prices LATEST ON timestamp PARTITION BY symbol) dp
    ON s.symbol = dp.symbol
    WHERE dp.close > 0.5
    AND s.region IN ('US', 'Europe', 'Asia', 'S. America', 'Africa', 'OTCQX')
    ORDER BY s.region, dp.close DESC
  `;

  let rows;
  try {
    rows = await queryQuestDB(sql);
  } catch (e) {
    console.error('❌ Could not connect to local QuestDB:', e.message);
    console.error('   Make sure QuestDB is running: http://localhost:9000');
    process.exit(1);
  }

  console.log('✅ Found', rows.length, 'stocks in local QuestDB');

  // 2. Transform to API format
  const stocks = rows.map(r => {
    const region = REGION_NORMALIZE[r.region] || r.region;
    return {
      t: r.symbol,
      n: r.name || r.symbol,
      s: SECTOR_MAP[r.sector] || r.sector || 'Other',
      r: region,
      co: REGION_FLAGS[r.region] || '🌍',
      p: +(+r.close).toFixed(2),
      mc: 0
    };
  });

  // 3. Push to Railway in batches
  console.log('Pushing to Railway in batches of', BATCH_SIZE, '...');
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
    const batch = stocks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(stocks.length / BATCH_SIZE);
    process.stdout.write('  Batch ' + batchNum + '/' + totalBatches + ' (' + batch.length + ' stocks)... ');

    try {
      const result = await postToCloud(batch);
      totalInserted += result.inserted || 0;
      console.log('✅ ' + (result.inserted || 0) + ' inserted');
    } catch (e) {
      totalErrors += batch.length;
      console.log('❌ Error:', e.message.substring(0, 80));
    }
  }

  // 4. Verify cloud count
  console.log('');
  console.log('=== Sync Complete ===');
  console.log('Inserted:', totalInserted, '| Errors:', totalErrors);

  try {
    const countRes = await fetch(CLOUD_API + '/stocks/count');
    const counts = await countRes.json();
    const total = counts.reduce((s, r) => s + parseInt(r.cnt || r.count || 0), 0);
    console.log('Cloud DB now has', total, 'stocks:');
    counts.forEach(r => console.log(' ', r.region, ':', r.cnt || r.count));
  } catch (e) {
    console.log('(Could not verify cloud count:', e.message + ')');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
