/**
 * import_etl_stocks.js
 * Imports stocks from the existing ETL pipeline tables (stocks + daily_prices)
 * into prism_stock_universe. Safe to re-run — uses append-only WAL pattern
 * and skips symbols already in the universe from today.
 *
 * Run: node mexxie-api/scripts/import_etl_stocks.js
 */

const db = require('../db');

// Country flag emoji by region
const REGION_FLAGS = {
  'US': '🇺🇸', 'Europe': '🇪🇺', 'Asia': '🌏',
  'S. America': '🇧🇷', 'Africa': '🇿🇦'
};

// Sector normalization — map ETL sector names to Prism sectors
const SECTOR_MAP = {
  'Technology': 'Technology', 'Healthcare': 'Healthcare',
  'Finance': 'Finance', 'Financial Services': 'Finance',
  'Consumer': 'Consumer', 'Consumer Discretionary': 'Consumer',
  'Consumer Staples': 'Consumer', 'Energy': 'Energy',
  'Industrial': 'Industrial', 'Industrials': 'Industrial',
  'Materials': 'Materials', 'Utilities': 'Utilities',
  'Real Estate': 'Real Estate', 'Telecom': 'Telecom',
  'Communication Services': 'Telecom', 'ETF': 'Other'
};

function mapSector(raw) {
  if (!raw) return 'Other';
  const mapped = SECTOR_MAP[raw];
  if (mapped) return mapped;
  if (raw === 'Unknown' || raw.includes('Cumulative') || raw.includes('Series')) return 'Other';
  return 'Other';
}

function batchArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/'/g, "''");
}

async function main() {
  console.log('=== Mexxie Prism: ETL Stock Import ===\n');

  // Check DB connection
  const healthy = await db.healthCheck();
  if (!healthy) { console.error('QuestDB not reachable at localhost:9000'); process.exit(1); }
  console.log('✓ QuestDB connected\n');

  // Step 1: Get existing prism symbols to avoid full re-insert
  console.log('Checking existing prism_stock_universe...');
  const existingRes = await db.query(
    'SELECT ticker FROM prism_stock_universe LATEST ON ts PARTITION BY ticker'
  );
  const existingSymbols = new Set(
    existingRes.ok ? existingRes.rows.map(r => r.ticker) : []
  );
  console.log(`  Existing symbols in prism: ${existingSymbols.size}`);

  // Step 2: Query stocks + daily_prices with join
  console.log('\nQuerying ETL stocks + daily_prices...');
  const etlSQLWithCap = `
    SELECT s.symbol, s.name, s.sector, s.region, dp.close,
           COALESCE(s.market_cap_bn, dp.market_cap_bn, s.market_cap/1e9, dp.market_cap/1e9, 0) AS market_cap_bn
    FROM (SELECT symbol, name, sector, region, market_cap_bn, market_cap FROM stocks LATEST ON update_time PARTITION BY symbol) s
    JOIN (SELECT symbol, close, market_cap_bn, market_cap FROM daily_prices LATEST ON timestamp PARTITION BY symbol) dp
    ON s.symbol = dp.symbol
    WHERE dp.close > 1.0
    AND s.region IN ('US', 'Europe', 'Asia', 'S. America', 'Africa')
    ORDER BY s.region, dp.close DESC
  `;
  const etlSQLFallback = `
    SELECT s.symbol, s.name, s.sector, s.region, dp.close
    FROM (SELECT symbol, name, sector, region FROM stocks LATEST ON update_time PARTITION BY symbol) s
    JOIN (SELECT symbol, close FROM daily_prices LATEST ON timestamp PARTITION BY symbol) dp
    ON s.symbol = dp.symbol
    WHERE dp.close > 1.0
    AND s.region IN ('US', 'Europe', 'Asia', 'S. America', 'Africa')
    ORDER BY s.region, dp.close DESC
  `;
  let etlRes = await db.query(etlSQLWithCap);
  if (!etlRes.ok) {
    console.warn('⚠️ market_cap columns not available in ETL tables, using fallback query');
    etlRes = await db.query(etlSQLFallback);
  }
  if (!etlRes.ok) { console.error('ETL query failed:', etlRes.error); process.exit(1); }

  const allStocks = etlRes.rows;
  console.log(`  Found ${allStocks.length} stocks from ETL (price > $1, valid region)\n`);

  // Step 3: Filter to new stocks only
  const newStocks = allStocks.filter(r => !existingSymbols.has(r.symbol));
  console.log(`  ${newStocks.length} new stocks to import (${existingSymbols.size} already exist)\n`);

  if (newStocks.length === 0) {
    console.log('✓ All stocks already imported. Nothing to do.');
    await printSummary();
    return;
  }

  // Step 4: Insert in batches of 100
  const batches = batchArray(newStocks, 100);
  let inserted = 0; let errors = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const values = batch.map(r => {
      const sector = mapSector(r.sector);
      const flag = REGION_FLAGS[r.region] || '🌍';
      const price = +(+r.close).toFixed(2);
      const mc = Math.max(0, +(+r.market_cap_bn || 0).toFixed(3));
      return `(now(),'${esc(r.symbol)}','${esc(r.name)}','${sector}','${r.region}','${flag}',${price},${mc},true)`;
    }).join(',');

    const sql = `INSERT INTO prism_stock_universe (ts,ticker,name,sector,region,country_flag,price,market_cap_bn,active) VALUES ${values}`;
    const result = await db.exec(sql);

    if (result.ok) {
      inserted += batch.length;
    } else {
      errors += batch.length;
      console.warn(`  Batch ${i+1}/${batches.length} failed:`, result.error);
    }

    if ((i + 1) % 10 === 0 || i === batches.length - 1) {
      process.stdout.write(`\r  Progress: ${i+1}/${batches.length} batches | ${inserted} inserted | ${errors} errors`);
    }
  }

  console.log('\n\n✓ Import complete!');
  await printSummary();
}

async function printSummary() {
  console.log('\n=== prism_stock_universe Summary ===');
  const countRes = await db.query(
    'SELECT region, count() FROM prism_stock_universe LATEST ON ts PARTITION BY ticker GROUP BY region ORDER BY count() DESC'
  );
  if (countRes.ok) {
    let total = 0;
    countRes.rows.forEach(r => {
      console.log(`  ${(r.region + ':').padEnd(14)} ${r['count()']}`);
      total += r['count()'];
    });
    console.log(`  ${'TOTAL:'.padEnd(14)} ${total}`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
