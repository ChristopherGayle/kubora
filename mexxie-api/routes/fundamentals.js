const express = require('express');
const router = express.Router();

// Maps Mexxie app tickers → Finnhub/FMP US-listed symbols
// Non-US stocks are mapped to their ADR equivalents (same as FMP_TICKERS in frontend)
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
// Finnhub already returns PE, margins, ROE, ROA as real numbers / percentages
function mapMetrics(m) {
  if (!m) return null;
  return {
    pe:  safeNum(m.peTTM),
    pb:  safeNum(m.pb || m.pbQuarterly),
    dy:  safeNum(m.currentDividendYieldTTM),             // already in % (e.g. 0.40 = 0.40%)
    roe: safeNum(m.roeRfy),                              // already in %
    roa: safeNum(m.roaRfy),                              // already in %
    gm:  safeNum(m.grossMarginAnnual || m.grossMargin5Y), // already in %
    om:  safeNum(m.operatingMarginTTM),                  // already in %
    nm:  safeNum(m.netProfitMarginAnnual || m.netProfitMarginTTM), // already in %
    de:  safeNum(m['longTermDebt/equityAnnual']),         // ratio
    cr:  safeNum(m.currentRatioAnnual),                  // ratio
    eg:  safeNum(m.epsGrowthQuarterlyYoy),               // already in %
    sg:  safeNum(m.revenueGrowth5Y),                     // already in %
    io:  null,  // not available in free Finnhub tier
    si:  null,  // not available in free Finnhub tier
    _src: 'finnhub',
  };
}

// POST /api/fundamentals
// Body: { tickers: ["AAPL","NPN",...], token: "finnhub_api_key" }
// Returns: { count, total, results: { AAPL: {...}, NPN: {...} } }
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
  const BATCH = 5; // concurrent requests per wave
  let rateLimited = false;

  // Fetch one ticker from Finnhub, with one retry on transient failure
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
          // Single retry after 500ms for transient errors
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
    if (rateLimited) break; // Stop early if Finnhub is rate-limiting us
    const batch = tickers.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(t => fetchOne(t)));

    // Courtesy delay between batches (Finnhub free tier = 60 calls/min)
    if (i + BATCH < tickers.length) {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  const count = Object.values(results).filter(Boolean).length;
  // Surface rate-limit status so frontend can show appropriate message
  res.json({ count, total: tickers.length, results, rateLimited });
});

module.exports = router;
