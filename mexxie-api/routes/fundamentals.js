const express = require('express');
const router = express.Router();
const db = require('../db');

// Maps Mexxie app tickers → Finnhub/FMP US-listed symbols
const TICKER_MAP = {
  // European ADRs
  'NOVO-B': 'NVO',    'ROG':    'RHHBY',  'NESN':   'NSRGY',  'MC':     'LVMHF',
  'SIE':    'SIEGY',  'OR':     'LRLCY',  'BAYN':   'BAYRY',  'DTE':    'DTEGY',
  'ENEL':   'ENLAY',  'VOW3':   'VWAGY',  'SU.PA':  'SBGSY',  'AIR.PA': 'EADSY',
  'RMS.PA': 'HESAY',  'ALV.DE': 'ALIZY',  'BNP.PA': 'BNPQY',  'DGE.L':  'DEO',
  'IBE.MC': 'IBDRY',
  // Asian ADRs / numeric codes
  '9984':   'SFTBY',  '005930': 'SSNLF',  '7203':   'TM',     '9988':   'BABA',
  '0700':   'TCEHY',  '6758':   'SONY',   '1398':   'IDCBY',  '7267':   'HMC',
  '2317':   'HNHPF',  '6861':   'KYCCF',  '035420': 'NPSNY',  '9433':   'KDDIY',
  '4503':   'ALPMY',  '3690':   'MPNGY',  '2454':   'MDTKF',  'CBA':    'CMWAY',
  'RELIANCE': 'RELIANCE.NS',
  // African ADRs
  'NPN':    'NPSNY',  'AGL':    'AAUKF',  'SOL':    'SSL',     'SBK':    'SGBLY',
  'FSR':    'FSRZY',  'MTN':    'MTNOY',  'DANGCEM':'DANGF',   'SBUX':   'SFRPF',
  'EGH':    'EGHGF',
  // Latin America / EM
  'CRPG':   'CMPQF',
};

function toFinnhub(ticker) {
  return TICKER_MAP[ticker] || ticker;
}

function safeNum(v) {
  if (v == null || isNaN(Number(v))) return null;
  const n = Number(v);
  return n === 0 ? 0 : +n.toFixed(2);
}

// Finnhub metric → finvizData field mapping
function mapMetrics(m) {
  if (!m) return null;
  return {
    pe:  safeNum(m.peTTM),
    pb:  safeNum(m.pb || m.pbQuarterly),
    dy:  safeNum(m.currentDividendYieldTTM),
    roe: safeNum(m.roeRfy),
    roa: safeNum(m.roaRfy),
    gm:  safeNum(m.grossMarginAnnual || m.grossMargin5Y),
    om:  safeNum(m.operatingMarginTTM),
    nm:  safeNum(m.netProfitMarginAnnual || m.netProfitMarginTTM),
    de:  safeNum(m['longTermDebt/equityAnnual']),
    cr:  safeNum(m.currentRatioAnnual),
    eg:  safeNum(m.epsGrowthQuarterlyYoy),
    sg:  safeNum(m.revenueGrowth5Y),
    io:  null,
    si:  null,
    enterpriseValue: safeNum(m.enterpriseValue),
    ebitPerShare: safeNum(m.ebitPerShareTTM || m.ebitPerShareAnnual),
    marketCap: safeNum(m.marketCapitalization),
    _src: 'finnhub',
  };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

// Numeric columns stored in prism_fundamentals (order matters for fdToParams)
const FUND_COLS = [
  'pe','pb','dy','roe','roa','de','cr','gm','om','nm',
  'eg','sg','eqg','io','si','fcf',
  'ev_ebit','enterprise_value','ebit_per_share'
];

// Convert a DB row → frontend fundamentals object (camelCase where needed)
function rowToFd(row) {
  const fd = {};
  const rename = { ev_ebit: 'evEbit', enterprise_value: 'enterpriseValue', ebit_per_share: 'ebitPerShare' };
  FUND_COLS.forEach(col => {
    if (row[col] != null) fd[rename[col] || col] = row[col];
  });
  if (row.provider) fd._src = row.provider;
  return fd;
}

// Extract ordered param array for a fundamentals object
function fdToParams(ticker, fd, source) {
  return [
    ticker,
    safeNum(fd.pe),
    safeNum(fd.pb),
    safeNum(fd.dy),
    safeNum(fd.roe),
    safeNum(fd.roa),
    safeNum(fd.de),
    safeNum(fd.cr),
    safeNum(fd.gm),
    safeNum(fd.om),
    safeNum(fd.nm),
    safeNum(fd.eg),
    safeNum(fd.sg),
    safeNum(fd.eqg),
    safeNum(fd.io),
    safeNum(fd.si),
    safeNum(fd.fcf),
    safeNum(fd.evEbit != null ? fd.evEbit : fd.ev_ebit),
    safeNum(fd.enterpriseValue != null ? fd.enterpriseValue : fd.enterprise_value),
    safeNum(fd.ebitPerShare != null ? fd.ebitPerShare : fd.ebit_per_share),
    source || fd._src || 'unknown',
  ];
}

// Batch upsert fundamentals into DB (PostgreSQL only)
// Uses COALESCE so existing non-null values are kept when new value is null
async function upsertFundamentals(fundamentalsMap, source) {
  if (!db.isPg) return 0;
  const tickers = Object.keys(fundamentalsMap).filter(tk => tk && fundamentalsMap[tk]);
  if (!tickers.length) return 0;

  const ALL_COLS = ['ticker', ...FUND_COLS, 'provider'];
  const UPSERT_SET = FUND_COLS
    .map(c => `${c}=COALESCE(EXCLUDED.${c},prism_fundamentals.${c})`)
    .join(',');

  const BATCH = 50;
  let stored = 0;

  for (let i = 0; i < tickers.length; i += BATCH) {
    const batch = tickers.slice(i, i + BATCH);
    const params = [];
    const rows = [];

    for (const tk of batch) {
      const vals = fdToParams(tk, fundamentalsMap[tk], source);
      const start = params.length + 1;
      params.push(...vals);
      rows.push(`(${vals.map((_, j) => '$' + (start + j)).join(',')},NOW())`);
    }

    const sql = `
      INSERT INTO prism_fundamentals (${ALL_COLS.join(',')},updated_at)
      VALUES ${rows.join(',')}
      ON CONFLICT (ticker) DO UPDATE SET
        ${UPSERT_SET},
        provider=COALESCE(EXCLUDED.provider,prism_fundamentals.provider),
        updated_at=NOW()
    `;

    const result = await db.exec(sql, params);
    if (result.ok) stored += batch.length;
    else console.error('[fundamentals] batch upsert error:', result.error?.substring(0, 200));
  }

  return stored;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/fundamentals
// Returns all stored fundamentals from DB as { count, results: {TICKER: {...}}, ts }
// Frontend uses this to hydrate S.finvizData on startup (backend = source of truth)
router.get('/', async (req, res) => {
  if (!db.isPg) {
    return res.json({ count: 0, results: {}, ts: null });
  }
  try {
    const result = await db.query(
      `SELECT ticker, ${FUND_COLS.join(',')}, provider, updated_at
       FROM prism_fundamentals
       ORDER BY updated_at DESC`
    );
    if (!result.ok) return res.json({ count: 0, results: {}, ts: null });

    const out = {};
    let latest = null;
    for (const row of result.rows) {
      out[row.ticker] = rowToFd(row);
      const t = new Date(row.updated_at);
      if (!latest || t > latest) latest = t;
    }
    res.json({ count: result.rows.length, results: out, ts: latest ? latest.getTime() : null });
  } catch (e) {
    console.error('[fundamentals] GET error:', e.message);
    res.json({ count: 0, results: {}, ts: null });
  }
});

// POST /api/fundamentals/store
// Body: { fundamentals: { TICKER: {...}, ... }, source: "finviz"|"eodhd"|... }
// Called by frontend after Finviz CSV import or provider refresh to persist to DB
router.post('/store', async (req, res) => {
  if (!db.isPg) return res.json({ stored: 0, total: 0 });
  const { fundamentals, source } = req.body;
  if (!fundamentals || typeof fundamentals !== 'object') {
    return res.status(400).json({ error: 'fundamentals object required' });
  }
  try {
    const total = Object.keys(fundamentals).length;
    const stored = await upsertFundamentals(fundamentals, source || 'frontend');
    res.json({ stored, total });
  } catch (e) {
    console.error('[fundamentals] POST /store error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/fundamentals
// Body: { tickers: ["AAPL","NPN",...], token: "finnhub_api_key" }
// Fetches from Finnhub, saves non-null results to DB, returns results to caller
router.post('/', async (req, res) => {
  const { tickers, token } = req.body;
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return res.status(400).json({ error: 'tickers array required' });
  }
  if (!token) {
    return res.status(400).json({ error: 'token (Finnhub API key) required' });
  }

  const FINNHUB_BASE = 'https://finnhub.io/api/v1';
  const results = {};
  const BATCH = 5;
  let rateLimited = false;

  async function fetchOne(ticker, attempt = 0) {
    const sym = toFinnhub(ticker);
    const url = `${FINNHUB_BASE}/stock/metric?symbol=${encodeURIComponent(sym)}&metric=all&token=${token}`;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (resp.status === 429) {
        rateLimited = true;
        results[ticker] = null;
        return;
      }
      if (!resp.ok) {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 500));
          return fetchOne(ticker, 1);
        }
        results[ticker] = null;
        return;
      }
      const data = await resp.json();
      results[ticker] = mapMetrics(data?.metric);
    } catch (e) {
      results[ticker] = null;
    }
  }

  for (let i = 0; i < tickers.length; i += BATCH) {
    if (rateLimited) break;
    const batch = tickers.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(t => fetchOne(t)));
    if (i + BATCH < tickers.length) {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  const count = Object.values(results).filter(Boolean).length;

  // Persist non-null results to DB so all browsers benefit (fire-and-forget)
  if (count > 0) {
    const toStore = {};
    Object.keys(results).forEach(tk => { if (results[tk]) toStore[tk] = results[tk]; });
    upsertFundamentals(toStore, 'finnhub').catch(e =>
      console.error('[fundamentals] DB save error:', e.message)
    );
  }

  res.json({ count, total: tickers.length, results, rateLimited });
});

module.exports = router;
