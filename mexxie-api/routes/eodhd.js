const express = require('express');
const router = express.Router();
const db = require('../db');

const EODHD_BASE = 'https://eodhd.com/api';

// Country → region / flag (used by import-exchange)
const COUNTRY_REGION = {
  'USA':'US','US':'US','United States':'US',
  'CAN':'US','CA':'US','Canada':'US',
  'GBR':'Europe','GB':'Europe','United Kingdom':'Europe',
  'DEU':'Europe','DE':'Europe','Germany':'Europe',
  'FRA':'Europe','FR':'Europe','France':'Europe',
  'NLD':'Europe','NL':'Europe','Netherlands':'Europe',
  'CHE':'Europe','CH':'Europe','Switzerland':'Europe',
  'SWE':'Europe','SE':'Europe','Sweden':'Europe',
  'NOR':'Europe','NO':'Europe','Norway':'Europe',
  'DNK':'Europe','DK':'Europe','Denmark':'Europe',
  'ITA':'Europe','IT':'Europe','Italy':'Europe',
  'ESP':'Europe','ES':'Europe','Spain':'Europe',
  'BEL':'Europe','BE':'Europe','Belgium':'Europe',
  'AUT':'Europe','AT':'Europe','Austria':'Europe',
  'FIN':'Europe','FI':'Europe','Finland':'Europe',
  'IRL':'Europe','IE':'Europe','Ireland':'Europe',
  'PRT':'Europe','PT':'Europe','Portugal':'Europe',
  'POL':'Europe','PL':'Europe','Poland':'Europe',
  'JPN':'Asia','JP':'Asia','Japan':'Asia',
  'CHN':'Asia','CN':'Asia','China':'Asia',
  'HKG':'Asia','HK':'Asia','Hong Kong':'Asia',
  'KOR':'Asia','KR':'Asia','South Korea':'Asia',
  'TWN':'Asia','TW':'Asia','Taiwan':'Asia',
  'IND':'Asia','IN':'Asia','India':'Asia',
  'SGP':'Asia','SG':'Asia','Singapore':'Asia',
  'AUS':'Asia','AU':'Asia','Australia':'Asia',
  'NZL':'Asia','NZ':'Asia','New Zealand':'Asia',
  'MYS':'Asia','MY':'Asia','Malaysia':'Asia',
  'THA':'Asia','TH':'Asia','Thailand':'Asia',
  'IDN':'Asia','ID':'Asia','Indonesia':'Asia',
  'PHL':'Asia','PH':'Asia','Philippines':'Asia',
  'ZAF':'Africa','ZA':'Africa','South Africa':'Africa',
  'NGA':'Africa','NG':'Africa','Nigeria':'Africa',
  'KEN':'Africa','KE':'Africa','Kenya':'Africa',
  'GHA':'Africa','GH':'Africa','Ghana':'Africa',
  'EGY':'Africa','EG':'Africa','Egypt':'Africa',
  'MAR':'Africa','MA':'Africa','Morocco':'Africa',
  'BRA':'S. America','BR':'S. America','Brazil':'S. America',
  'MEX':'S. America','MX':'S. America','Mexico':'S. America',
  'CHL':'S. America','CL':'S. America','Chile':'S. America',
  'COL':'S. America','CO':'S. America','Colombia':'S. America',
  'PER':'S. America','PE':'S. America','Peru':'S. America',
  'ARG':'S. America','AR':'S. America','Argentina':'S. America',
};

const COUNTRY_FLAG = {
  'USA':'🇺🇸','CAN':'🇨🇦','GBR':'🇬🇧','DEU':'🇩🇪','FRA':'🇫🇷','NLD':'🇳🇱',
  'CHE':'🇨🇭','SWE':'🇸🇪','NOR':'🇳🇴','DNK':'🇩🇰','ITA':'🇮🇹','ESP':'🇪🇸',
  'BEL':'🇧🇪','AUT':'🇦🇹','FIN':'🇫🇮','IRL':'🇮🇪','PRT':'🇵🇹','POL':'🇵🇱',
  'JPN':'🇯🇵','CHN':'🇨🇳','HKG':'🇭🇰','KOR':'🇰🇷','TWN':'🇹🇼','IND':'🇮🇳',
  'SGP':'🇸🇬','AUS':'🇦🇺','NZL':'🇳🇿','MYS':'🇲🇾','THA':'🇹🇭','IDN':'🇮🇩',
  'PHL':'🇵🇭','ZAF':'🇿🇦','NGA':'🇳🇬','KEN':'🇰🇪','GHA':'🇬🇭','EGY':'🇪🇬',
  'MAR':'🇲🇦','BRA':'🇧🇷','MEX':'🇲🇽','CHL':'🇨🇱','COL':'🇨🇴','ARG':'🇦🇷',
  'US':'🇺🇸','GB':'🇬🇧','DE':'🇩🇪','FR':'🇫🇷','JP':'🇯🇵','CN':'🇨🇳',
  'HK':'🇭🇰','KR':'🇰🇷','TW':'🇹🇼','IN':'🇮🇳','SG':'🇸🇬','AU':'🇦🇺',
  'ZA':'🇿🇦','NG':'🇳🇬','BR':'🇧🇷','MX':'🇲🇽','CA':'🇨🇦',
};

// Default country for each exchange code (when EODHD omits Country field)
const EXCHANGE_COUNTRY = {
  'US':'USA','NYSE':'USA','NASDAQ':'USA','AMEX':'USA',
  'LSE':'GBR','XETRA':'DEU','PA':'FRA','AS':'NLD',
  'SW':'CHE','ST':'SWE','OL':'NOR','CO':'DNK',
  'MI':'ITA','MC':'ESP','LIS':'PRT','VIE':'AUT','HE':'FIN','IR':'IRL','WAR':'POL',
  'TO':'CAN','V':'CAN',
  'T':'JPN','HK':'HKG','KO':'KOR','TWO':'TWN','TW':'TWN',
  'BSE':'IND','NSE':'IND','SG':'SGP','AU':'AUS','NZ':'NZL',
  'MY':'MYS','BK':'THA','JK':'IDN','PSE':'PHL',
  'JSE':'ZAF','NGX':'NGA','NSE_AF':'KEN','GSE':'GHA','EGX':'EGY','CSE':'MAR',
  'SA':'BRA','MX':'MEX','SGO':'CHL','BVC':'COL','BVL':'PER','BCBA':'ARG',
};

// Helper: proxy fetch to EODHD with timeout and sanitised errors
async function eodhdFetch(path, apiKey) {
  const sep = path.includes('?') ? '&' : '?';
  const url = EODHD_BASE + path + sep + 'api_token=' + apiKey + '&fmt=json';
  let resp;
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (e) {
    // Network / timeout error — don't expose internal details
    throw new Error(e.name === 'TimeoutError' ? 'EODHD request timed out' : 'EODHD network error');
  }
  if (!resp.ok) {
    // Log the real error server-side; return a safe message to the client
    console.error('[eodhd] upstream error', resp.status, path.split('?')[0]);
    const status = resp.status;
    if (status === 401 || status === 403) throw new Error('EODHD: invalid or expired API key');
    if (status === 429) throw new Error('EODHD: rate limit exceeded — try again later');
    throw new Error('EODHD: upstream error ' + status);
  }
  return resp.json();
}

// GET /api/eodhd/bulk?symbols=AAPL,MSFT&exchange=US&key=xxx
router.get('/bulk', async (req, res) => {
  const key = req.query.key || process.env.EODHD_KEY;
  if (!key) return res.status(400).json({ error: 'key required — set EODHD_KEY env var or pass ?key=' });

  const exchange = req.query.exchange || 'US';
  const symbols = req.query.symbols || '';

  try {
    let path = '/eod-bulk-last-day/' + encodeURIComponent(exchange) + '?filter=extended';
    if (symbols) path += '&symbols=' + encodeURIComponent(symbols);
    const data = await eodhdFetch(path, key);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// GET /api/eodhd/eod/:symbol?from=YYYY-MM-DD&to=YYYY-MM-DD&key=xxx
router.get('/eod/:symbol', async (req, res) => {
  const key = req.query.key || process.env.EODHD_KEY;
  if (!key) return res.status(400).json({ error: 'key required — set EODHD_KEY env var or pass ?key=' });

  const symbol = req.params.symbol; // e.g. AAPL.US
  let path = '/eod/' + encodeURIComponent(symbol) + '?';
  if (req.query.from) path += 'from=' + req.query.from + '&';
  if (req.query.to) path += 'to=' + req.query.to + '&';
  if (req.query.period) path += 'period=' + req.query.period + '&';

  try {
    const data = await eodhdFetch(path, key);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// GET /api/eodhd/div/:symbol?from=YYYY-MM-DD&key=xxx
router.get('/div/:symbol', async (req, res) => {
  const key = req.query.key || process.env.EODHD_KEY;
  if (!key) return res.status(400).json({ error: 'key required — set EODHD_KEY env var or pass ?key=' });

  const symbol = req.params.symbol;
  let path = '/div/' + encodeURIComponent(symbol) + '?';
  if (req.query.from) path += 'from=' + req.query.from + '&';

  try {
    const data = await eodhdFetch(path, key);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// GET /api/eodhd/test?key=xxx — quick connection test
router.get('/test', async (req, res) => {
  const key = req.query.key || process.env.EODHD_KEY;
  if (!key) return res.status(400).json({ error: 'key required — set EODHD_KEY env var or pass ?key=' });

  try {
    const data = await eodhdFetch('/eod/AAPL.US?filter=last_close', key);
    res.json({ ok: true, lastClose: data });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// GET /api/eodhd/exchanges — list of supported exchanges
router.get('/exchanges', (req, res) => {
  res.json([
    { code:'US',    name:'US (NYSE + NASDAQ)',          region:'US',         flag:'🇺🇸' },
    { code:'TO',    name:'Toronto Stock Exchange',      region:'US',         flag:'🇨🇦' },
    { code:'LSE',   name:'London Stock Exchange',       region:'Europe',     flag:'🇬🇧' },
    { code:'XETRA', name:'XETRA (Germany)',              region:'Europe',     flag:'🇩🇪' },
    { code:'PA',    name:'Euronext Paris',               region:'Europe',     flag:'🇫🇷' },
    { code:'AS',    name:'Euronext Amsterdam',           region:'Europe',     flag:'🇳🇱' },
    { code:'SW',    name:'Swiss Exchange (SIX)',         region:'Europe',     flag:'🇨🇭' },
    { code:'ST',    name:'Nasdaq Nordic (Stockholm)',    region:'Europe',     flag:'🇸🇪' },
    { code:'OL',    name:'Oslo Børs',                   region:'Europe',     flag:'🇳🇴' },
    { code:'CO',    name:'Nasdaq Copenhagen',            region:'Europe',     flag:'🇩🇰' },
    { code:'MI',    name:'Borsa Italiana',               region:'Europe',     flag:'🇮🇹' },
    { code:'MC',    name:'Bolsa de Madrid',              region:'Europe',     flag:'🇪🇸' },
    { code:'VIE',   name:'Wiener Börse (Vienna)',        region:'Europe',     flag:'🇦🇹' },
    { code:'T',     name:'Tokyo Stock Exchange',         region:'Asia',       flag:'🇯🇵' },
    { code:'HK',    name:'Hong Kong Exchange',           region:'Asia',       flag:'🇭🇰' },
    { code:'KO',    name:'Korea Exchange (KOSPI)',       region:'Asia',       flag:'🇰🇷' },
    { code:'BSE',   name:'Bombay Stock Exchange',        region:'Asia',       flag:'🇮🇳' },
    { code:'NSE',   name:'NSE India',                    region:'Asia',       flag:'🇮🇳' },
    { code:'SG',    name:'Singapore Exchange',           region:'Asia',       flag:'🇸🇬' },
    { code:'AU',    name:'Australian Securities Exchange',region:'Asia',      flag:'🇦🇺' },
    { code:'MY',    name:'Bursa Malaysia',               region:'Asia',       flag:'🇲🇾' },
    { code:'JSE',   name:'Johannesburg SE (South Africa)',region:'Africa',    flag:'🇿🇦' },
    { code:'NGX',   name:'Nigerian Exchange Group',      region:'Africa',     flag:'🇳🇬' },
    { code:'EGX',   name:'Egyptian Exchange',            region:'Africa',     flag:'🇪🇬' },
    { code:'SA',    name:'B3 Brazil',                    region:'S. America', flag:'🇧🇷' },
    { code:'MX',    name:'Mexican Stock Exchange (BMV)', region:'S. America', flag:'🇲🇽' },
    { code:'SGO',   name:'Santiago Stock Exchange',      region:'S. America', flag:'🇨🇱' },
  ]);
});

// POST /api/eodhd/import-exchange
// Body: { exchange: "LSE", key: "your_eodhd_key" }
// Fetches all common stocks from the exchange and upserts into prism_stock_universe
router.post('/import-exchange', async (req, res) => {
  if (!db.isPg) return res.status(400).json({ error: 'PostgreSQL required' });

  const { exchange, key: _key3 } = req.body;
  const key = _key3 || process.env.EODHD_KEY;
  if (!exchange || !key) return res.status(400).json({ error: 'exchange required — set EODHD_KEY env var or pass key in body' });

  let rawData;
  try {
    rawData = await eodhdFetch(`/exchange-symbol-list/${encodeURIComponent(exchange)}?type=common_stock`, key);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }

  if (!Array.isArray(rawData)) {
    return res.status(502).json({ error: 'Unexpected EODHD response format' });
  }

  // Resolve default country for this exchange
  const defaultCountry = EXCHANGE_COUNTRY[exchange.toUpperCase()] || 'USA';
  const defaultRegion  = COUNTRY_REGION[defaultCountry] || 'US';
  const defaultFlag    = COUNTRY_FLAG[defaultCountry] || '🌐';
  const regionDefaults = { 'US':'🇺🇸','Europe':'🇪🇺','Asia':'🌏','Africa':'🌍','S. America':'🇧🇷' };

  // Map EODHD items → our stock format, filter to Common Stock only
  const stocks = rawData
    .filter(s => s.Code && s.Name && s.Type === 'Common Stock')
    .map(s => {
      const c  = s.Country || defaultCountry;
      const r  = COUNTRY_REGION[c] || COUNTRY_REGION[defaultCountry] || defaultRegion;
      const co = COUNTRY_FLAG[c] || COUNTRY_FLAG[defaultCountry] || regionDefaults[r] || defaultFlag;
      return { t: String(s.Code).trim(), n: String(s.Name).trim(), s: 'Other', r, co, p: 0, mc: 0 };
    })
    .filter(s => s.t.length > 0 && s.t.length <= 20);

  if (!stocks.length) {
    return res.json({ added: 0, total: rawData.length, exchange });
  }

  // Batch upsert — insert new rows (DISTINCT ON ts gives latest per ticker)
  const BATCH = 200;
  let added = 0;
  let errors = 0;

  for (let i = 0; i < stocks.length; i += BATCH) {
    const batch = stocks.slice(i, i + BATCH);
    const params = [];
    const rows = [];

    for (const s of batch) {
      const start = params.length + 1;
      params.push(s.t, s.n, s.s, s.r, s.co, s.p, s.mc, true, exchange.toUpperCase());
      rows.push(`($${start},$${start+1},$${start+2},$${start+3},$${start+4},$${start+5},$${start+6},$${start+7},$${start+8},NOW())`);
    }

    const sql = `
      INSERT INTO prism_stock_universe
        (ticker,name,sector,region,country_flag,price,market_cap_bn,active,exchange,ts)
      VALUES ${rows.join(',')}
    `;

    const result = await db.exec(sql, params);
    if (result.ok) added += batch.length;
    else { errors += batch.length; console.error('[eodhd] insert error:', result.error?.substring(0, 200)); }
  }

  console.log(`[eodhd] import-exchange ${exchange}: ${added} inserted, ${errors} errors, ${rawData.length} raw`);
  res.json({ added, total: rawData.length, exchange });
});

// ── EODHD Fundamentals → SECTOR MAP ──────────────────────────────────────────
const SECTOR_MAP = {
  'Technology':'Technology','Consumer Cyclical':'Consumer','Consumer Defensive':'Consumer',
  'Consumer Discretionary':'Consumer','Consumer Staples':'Consumer',
  'Healthcare':'Healthcare','Health Care':'Healthcare',
  'Financial Services':'Finance','Financials':'Finance','Finance':'Finance',
  'Energy':'Energy','Basic Materials':'Materials','Materials':'Materials',
  'Industrials':'Industrial','Industrial':'Industrial',
  'Communication Services':'Telecom','Telecom':'Telecom',
  'Utilities':'Utilities','Real Estate':'Real Estate',
};
function mapSector(raw) { return SECTOR_MAP[raw] || (raw ? raw.trim() : 'Other'); }

// Map EODHD fundamentals response → prism_fundamentals format
function mapEodhdFundamentals(data) {
  if (!data) return null;
  const H = data.Highlights     || {};
  const V = data.Valuation      || {};
  const G = data.General        || {};
  const SS = data.ShareStatistics || {};
  function safeN(v) { if (v == null || v === '' || isNaN(+v)) return null; const n = +v; return n === 0 ? 0 : +n.toFixed(2); }
  // EODHD returns ratios as decimals (0.15 = 15%) — multiply by 100
  const dy  = safeN(H.DividendYield != null ? H.DividendYield * 100 : null);
  const roe = safeN(H.ReturnOnEquityTTM != null ? H.ReturnOnEquityTTM * 100 : null);
  const roa = safeN(H.ReturnOnAssetsTTM != null ? H.ReturnOnAssetsTTM * 100 : null);
  const om  = safeN(H.OperatingMarginTTM != null ? H.OperatingMarginTTM * 100 : null);
  const nm  = safeN(H.ProfitMargin != null ? H.ProfitMargin * 100 : null);
  const eg  = safeN(H.QuarterlyEarningsGrowthYOY != null ? H.QuarterlyEarningsGrowthYOY * 100 : null);
  const sg  = safeN(H.QuarterlyRevenueGrowthYOY != null ? H.QuarterlyRevenueGrowthYOY * 100 : null);
  const ev  = safeN(V.EnterpriseValue != null ? V.EnterpriseValue / 1e9 : null);
  const mc  = safeN(H.MarketCapitalization != null ? H.MarketCapitalization / 1e9 : null);
  // Gross margin: derive from GrossProfitTTM / RevenueTTM if possible
  let gm = null;
  if (H.GrossProfitTTM && H.RevenueTTM && +H.RevenueTTM > 0) gm = safeN((+H.GrossProfitTTM / +H.RevenueTTM) * 100);
  // Short interest: ShortPercentOfFloat is already a fraction (0.05 = 5%) — multiply by 100
  const si = safeN(SS.ShortPercentOfFloat != null ? SS.ShortPercentOfFloat * 100 : null);
  const fd = {
    pe: safeN(H.PERatio || V.TrailingPE),
    pb: safeN(H.PriceBookMRQ || V.PriceBookMRQ),
    dy, roe, roa, om, nm, eg, sg, gm, si,
    enterpriseValue: ev,
    marketCap: mc,
    _src: 'eodhd',
    _sector: G.Sector ? mapSector(G.Sector) : null,
    _mc: mc,
  };
  // Require at least 3 non-null values
  const vals = [fd.pe, fd.pb, fd.dy, fd.roe, fd.roa, fd.om, fd.nm, fd.eg, fd.sg];
  if (vals.filter(v => v != null).length < 3) return null;
  return fd;
}

// Shared upsert for EODHD-sourced fundamentals (mirrors routes/fundamentals.js logic)
const FUND_COLS = ['pe','pb','dy','roe','roa','de','cr','gm','om','nm','eg','sg','eqg','io','si','fcf','ev_ebit','enterprise_value','ebit_per_share'];
async function storeEodhdFundamentals(map) {
  if (!db.isPg || !Object.keys(map).length) return 0;
  const UPSERT_SET = FUND_COLS.map(c => `${c}=COALESCE(EXCLUDED.${c},prism_fundamentals.${c})`).join(',');
  const BATCH = 50;
  let stored = 0;
  const tickers = Object.keys(map).filter(tk => map[tk]);
  for (let i = 0; i < tickers.length; i += BATCH) {
    const batch = tickers.slice(i, i + BATCH);
    const params = []; const rows = [];
    for (const tk of batch) {
      const fd = map[tk];
      const vals = [tk,
        fd.pe??null, fd.pb??null, fd.dy??null, fd.roe??null, fd.roa??null,
        null, null, // de, cr — not in Highlights
        fd.gm??null, fd.om??null, fd.nm??null,
        fd.eg??null, fd.sg??null,
        null, null, fd.si??null, null, // eqg, io, si, fcf
        null, // ev_ebit
        fd.enterpriseValue??null,
        null, // ebit_per_share
        'eodhd'
      ];
      const start = params.length + 1;
      params.push(...vals);
      rows.push(`(${vals.map((_,j) => '$'+(start+j)).join(',')},NOW())`);
    }
    const sql = `INSERT INTO prism_fundamentals (ticker,${FUND_COLS.join(',')},provider,updated_at) VALUES ${rows.join(',')}
      ON CONFLICT (ticker) DO UPDATE SET ${UPSERT_SET},provider=COALESCE(EXCLUDED.provider,prism_fundamentals.provider),updated_at=NOW()`;
    const r = await db.exec(sql, params);
    if (r.ok) stored += batch.length;
    else console.error('[eodhd] fundamentals upsert error:', r.error?.substring(0, 200));
  }
  return stored;
}

// POST /api/eodhd/fetch-fundamentals
// Body: { key, exchange, offset, limit }
// Fetches fundamentals from EODHD for stocks from a given exchange, stores to DB
// Returns { fetched, stored, total, offset, hasMore }
router.post('/fetch-fundamentals', async (req, res) => {
  if (!db.isPg) return res.status(400).json({ error: 'PostgreSQL required' });
  const { key: _key, exchange, offset = 0, limit = 100 } = req.body;
  const key = _key || process.env.EODHD_KEY;
  if (!key || !exchange) return res.status(400).json({ error: 'exchange required — set EODHD_KEY env var or pass key in body' });

  const safeExch = db.esc(exchange.toUpperCase());
  const safeLimit = Math.min(200, Math.max(1, parseInt(limit) || 100));
  const safeOffset = Math.max(0, parseInt(offset) || 0);

  // Get tickers for this exchange from DB
  const qRes = await db.query(
    `SELECT DISTINCT ON (ticker) ticker FROM prism_stock_universe WHERE active=true AND exchange='${safeExch}' ORDER BY ticker, ts DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`
  );
  if (!qRes.ok) return res.status(503).json({ error: qRes.error });

  const tickers = qRes.rows.map(r => r.ticker);
  if (!tickers.length) return res.json({ fetched: 0, stored: 0, total: 0, offset: safeOffset, hasMore: false });

  // Get total count for progress
  const cntRes = await db.query(
    `SELECT COUNT(DISTINCT ticker) as cnt FROM prism_stock_universe WHERE active=true AND exchange='${safeExch}'`
  );
  const total = cntRes.ok ? parseInt(cntRes.rows[0].cnt) : 0;

  // Fetch fundamentals from EODHD in parallel batches of 10
  const PARA = 10;
  const fundMap = {};
  const sectorUpdates = [];

  async function fetchOne(ticker) {
    const symbol = `${ticker}.${exchange.toUpperCase()}`;
    try {
      const data = await eodhdFetch(`/fundamentals/${encodeURIComponent(symbol)}?filter=Highlights,Valuation,General,ShareStatistics`, key);
      const fd = mapEodhdFundamentals(data);
      if (fd) {
        fundMap[ticker] = fd;
        if (fd._sector && fd._sector !== 'Other') {
          sectorUpdates.push({ ticker, sector: fd._sector, mc: fd._mc });
        }
      }
    } catch (e) {
      // Non-fatal: stock may not be in EODHD or key exhausted
    }
  }

  for (let i = 0; i < tickers.length; i += PARA) {
    await Promise.allSettled(tickers.slice(i, i + PARA).map(fetchOne));
    if (i + PARA < tickers.length) await new Promise(r => setTimeout(r, 200));
  }

  // Store fundamentals
  const stored = await storeEodhdFundamentals(fundMap);

  // Update sector + market cap in universe for stocks where we got real data
  if (sectorUpdates.length && db.isPg) {
    for (const { ticker, sector, mc } of sectorUpdates) {
      const mcVal = mc != null ? mc : 0;
      await db.exec(
        `INSERT INTO prism_stock_universe (ts,ticker,name,sector,region,country_flag,price,market_cap_bn,active,exchange)
         SELECT NOW(),'${db.esc(ticker)}',name,
           '${db.esc(sector)}',region,country_flag,price,
           ${mcVal > 0 ? mcVal : 'market_cap_bn'},
           active,'${safeExch}'
         FROM (SELECT DISTINCT ON (ticker) * FROM prism_stock_universe WHERE ticker='${db.esc(ticker)}' ORDER BY ticker,ts DESC) sub`
      );
    }
  }

  const hasMore = (safeOffset + tickers.length) < total;
  console.log(`[eodhd] fetch-fundamentals ${exchange}: offset=${safeOffset} fetched=${tickers.length} stored=${stored} total=${total}`);
  res.json({ fetched: tickers.length, stored, total, offset: safeOffset + tickers.length, hasMore, exchange });
});

// POST /api/eodhd/update-prices
// Body: { key, exchange }
// Fetches bulk EOD data for an exchange and updates prices + market cap in DB
router.post('/update-prices', async (req, res) => {
  if (!db.isPg) return res.status(400).json({ error: 'PostgreSQL required' });
  const { key: _key2, exchange } = req.body;
  const key = _key2 || process.env.EODHD_KEY;
  if (!key || !exchange) return res.status(400).json({ error: 'exchange required — set EODHD_KEY env var or pass key in body' });

  let rawData;
  try {
    rawData = await eodhdFetch(`/eod-bulk-last-day/${encodeURIComponent(exchange)}?filter=extended`, key);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }

  if (!Array.isArray(rawData)) return res.status(502).json({ error: 'Unexpected EODHD response' });

  // Build price/mc map with full live metrics from EODHD extended bulk
  // Coerce to finite number or null — never NaN, otherwise it becomes the literal string "NaN" in SQL and breaks the batch.
  const finiteOrNull = v => { const n = +v; return Number.isFinite(n) ? n : null; };
  const priceMap = {};
  for (const row of rawData) {
    if (row.code && row.close != null) {
      const closeN = finiteOrNull(row.close);
      if (closeN == null) continue;       // skip rows with non-numeric close
      const mcN = finiteOrNull(row.market_capitalization);
      priceMap[row.code.toUpperCase()] = {
        price: closeN,
        mc: mcN != null ? +(mcN / 1e9).toFixed(3) : null,
        change_p: finiteOrNull(row.change_p),
        ema200: finiteOrNull(row.ema_200d),
        hi52: finiteOrNull(row.hi_250d),
        lo52: finiteOrNull(row.lo_250d),
        beta: finiteOrNull(row.Beta),
        volume: (() => { const v = finiteOrNull(row.volume); return v == null ? null : Math.round(v); })()
      };
    }
  }

  // Batch-update stocks in DB
  const tickers = Object.keys(priceMap);
  let updated = 0;
  const safeExch = db.esc(exchange.toUpperCase());
  const BATCH = 100;

  for (let i = 0; i < tickers.length; i += BATCH) {
    const batch = tickers.slice(i, i + BATCH);
    for (const ticker of batch) {
      const { price, mc } = priceMap[ticker];
      const mcClause = mc != null ? mc : 'sub.market_cap_bn';
      const r = await db.exec(
        `INSERT INTO prism_stock_universe (ts,ticker,name,sector,region,country_flag,price,market_cap_bn,active,exchange)
         SELECT NOW(),'${db.esc(ticker)}',name,sector,region,country_flag,
           ${price},${mcClause},active,'${safeExch}'
         FROM (SELECT DISTINCT ON (ticker) * FROM prism_stock_universe WHERE ticker='${db.esc(ticker)}' ORDER BY ticker,ts DESC) sub
         WHERE sub.ticker IS NOT NULL`
      );
      if (r.ok) updated++;
    }
  }

  // Upsert ALL returned tickers (including ETFs) to prism_prices for browser DB reads
  const allTickers = Object.keys(priceMap);
  for (let i = 0; i < allTickers.length; i += BATCH) {
    const batch = allTickers.slice(i, i + BATCH);
    const vals = batch.map(ticker => {
      const p = priceMap[ticker];
      // Numeric-or-NULL renderer: rejects NaN (would become "NaN" string in SQL) and non-finite values.
      const sn = v => (v != null && Number.isFinite(+v)) ? (+v) : 'NULL';
      return `('${db.esc(ticker)}',${sn(p.price)},${sn(p.change_p)},${sn(p.mc)},${sn(p.ema200)},${sn(p.hi52)},${sn(p.lo52)},${sn(p.beta)},${sn(p.volume)},NOW())`;
    }).join(',');
    await db.exec(
      `INSERT INTO prism_prices (ticker,price,change_p,mc,ema200,hi52,lo52,beta,volume,updated_at) VALUES ${vals}
       ON CONFLICT (ticker) DO UPDATE SET
         price=EXCLUDED.price, change_p=EXCLUDED.change_p, mc=EXCLUDED.mc,
         ema200=EXCLUDED.ema200, hi52=EXCLUDED.hi52, lo52=EXCLUDED.lo52,
         beta=EXCLUDED.beta, volume=EXCLUDED.volume, updated_at=EXCLUDED.updated_at`
    );
  }

  console.log(`[eodhd] update-prices ${exchange}: ${updated} stocks, ${allTickers.length} prices stored`);
  res.json({ updated, total: rawData.length, exchange });
});

module.exports = router;
