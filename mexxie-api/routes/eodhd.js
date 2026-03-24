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
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: 'key required' });

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
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: 'key required' });

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
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: 'key required' });

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
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: 'key required' });

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

  const { exchange, key } = req.body;
  if (!exchange || !key) return res.status(400).json({ error: 'exchange and key required' });

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
      params.push(s.t, s.n, s.s, s.r, s.co, s.p, s.mc, true);
      rows.push(`($${start},$${start+1},$${start+2},$${start+3},$${start+4},$${start+5},$${start+6},$${start+7},NOW())`);
    }

    const sql = `
      INSERT INTO prism_stock_universe
        (ticker,name,sector,region,country_flag,price,market_cap_bn,active,ts)
      VALUES ${rows.join(',')}
    `;

    const result = await db.exec(sql, params);
    if (result.ok) added += batch.length;
    else { errors += batch.length; console.error('[eodhd] insert error:', result.error?.substring(0, 200)); }
  }

  console.log(`[eodhd] import-exchange ${exchange}: ${added} inserted, ${errors} errors, ${rawData.length} raw`);
  res.json({ added, total: rawData.length, exchange });
});

module.exports = router;
