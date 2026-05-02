/**
 * scheduler.js — automated DB refresh jobs for Mexxie API
 *
 * Requires: EODHD_KEY env var set on Railway
 * All jobs call their own API routes via localhost to reuse existing logic.
 *
 * Schedule (UTC):
 *   Daily    Mon–Fri 22:30  → price refresh (all 25 exchanges → prism_prices + prism_stock_universe)
 *   Weekly   Sun     03:00  → fundamentals refresh (top 10 exchanges → prism_fundamentals)
 *   Monthly  1st     04:00  → symbol sync (all exchanges → prism_stock_universe new listings)
 */

const cron = require('node-cron');

// All exchanges for price refresh (lightweight bulk EOD call each)
const PRICE_EXCHANGES = [
  'US','TO','LSE','XETRA','PA','AS','SW','ST','OL','CO','MI','MC','VIE',
  'T','HK','KO','BSE','NSE','SG','AU','MY',
  'JSE','NGX','EGX',
  'SA','MX','SGO'
];

// Exchanges for fundamentals (individual stock calls — prioritise high-coverage exchanges)
const FUND_EXCHANGES = ['US','LSE','XETRA','PA','T','HK','KO','BSE','JSE','SA'];

// Exchanges for monthly symbol discovery
const SYMBOL_EXCHANGES = PRICE_EXCHANGES;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(port, path, body) {
  const r = await fetch(`http://127.0.0.1:${port}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)   // 2 min per exchange call
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(`HTTP ${r.status}: ${e.error || r.statusText}`);
  }
  return r.json();
}

// ─── JOB 1: Daily price refresh ────────────────────────────────────────────
async function jobPrices(port, key) {
  console.log('[scheduler] ─── Daily price refresh started ───');
  let totalPrices = 0;
  let errors = 0;
  for (const exchange of PRICE_EXCHANGES) {
    try {
      const d = await post(port, '/eodhd/update-prices', { key, exchange });
      console.log(`[scheduler] prices ${exchange}: ${d.updated} universe / ${d.total} stored`);
      totalPrices += d.total || 0;
    } catch (e) {
      console.error(`[scheduler] prices ${exchange} failed:`, e.message);
      errors++;
    }
    await sleep(400); // stay well within EODHD 10 req/s limit
  }
  console.log(`[scheduler] ─── Daily price refresh done: ${totalPrices} prices, ${errors} errors ───`);
}

// ─── JOB 2: Weekly fundamentals refresh ────────────────────────────────────
async function jobFundamentals(port, key) {
  console.log('[scheduler] ─── Weekly fundamentals refresh started ───');
  let totalStored = 0;
  let errors = 0;
  for (const exchange of FUND_EXCHANGES) {
    let offset = 0;
    let hasMore = true;
    let pageErrors = 0;
    while (hasMore && pageErrors < 3) {
      try {
        const d = await post(port, '/eodhd/fetch-fundamentals', { key, exchange, offset, limit: 100 });
        console.log(`[scheduler] fundamentals ${exchange}: offset=${offset} stored=${d.stored}/${d.fetched} total=${d.total}`);
        totalStored += d.stored || 0;
        hasMore = d.hasMore;
        offset = d.offset;
        await sleep(1500); // fundamentals are per-stock calls — be conservative
      } catch (e) {
        console.error(`[scheduler] fundamentals ${exchange} offset=${offset} failed:`, e.message);
        pageErrors++;
        hasMore = false;
        errors++;
      }
    }
  }
  console.log(`[scheduler] ─── Weekly fundamentals done: ${totalStored} stored, ${errors} errors ───`);
}

// ─── JOB 3: Monthly symbol sync ────────────────────────────────────────────
async function jobSymbols(port, key) {
  console.log('[scheduler] ─── Monthly symbol sync started ───');
  let totalAdded = 0;
  let errors = 0;
  for (const exchange of SYMBOL_EXCHANGES) {
    try {
      const d = await post(port, '/eodhd/import-exchange', { key, exchange });
      console.log(`[scheduler] symbols ${exchange}: ${d.added} new (${d.total} total in exchange)`);
      totalAdded += d.added || 0;
    } catch (e) {
      console.error(`[scheduler] symbols ${exchange} failed:`, e.message);
      errors++;
    }
    await sleep(600);
  }
  console.log(`[scheduler] ─── Monthly symbol sync done: ${totalAdded} new symbols, ${errors} errors ───`);
}

// ─── Init ───────────────────────────────────────────────────────────────────
function init(port) {
  const key = process.env.EODHD_KEY;
  if (!key) { console.log('[scheduler] No EODHD_KEY — scheduler disabled'); return; }

  console.log('[scheduler] Starting with EODHD_KEY set. Jobs:');
  console.log('  Prices:       Mon–Fri 22:30 UTC');
  console.log('  Fundamentals: Sunday  03:00 UTC');
  console.log('  Symbols:      1st of month 04:00 UTC');

  // Daily price refresh — Mon–Fri at 22:30 UTC (after US market close + 2h buffer)
  cron.schedule('30 22 * * 1-5', () => {
    jobPrices(port, key).catch(e => console.error('[scheduler] jobPrices crash:', e.message));
  }, { timezone: 'UTC' });

  // Also refresh Saturday 08:00 UTC to catch any Friday late data + international markets
  cron.schedule('0 8 * * 6', () => {
    jobPrices(port, key).catch(e => console.error('[scheduler] jobPrices (Sat) crash:', e.message));
  }, { timezone: 'UTC' });

  // Weekly fundamentals — Sunday 03:00 UTC
  cron.schedule('0 3 * * 0', () => {
    jobFundamentals(port, key).catch(e => console.error('[scheduler] jobFundamentals crash:', e.message));
  }, { timezone: 'UTC' });

  // Monthly symbol sync — 1st of each month at 04:00 UTC
  cron.schedule('0 4 1 * *', () => {
    jobSymbols(port, key).catch(e => console.error('[scheduler] jobSymbols crash:', e.message));
  }, { timezone: 'UTC' });
}

module.exports = { init };
