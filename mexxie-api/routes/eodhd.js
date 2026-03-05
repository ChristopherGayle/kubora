const express = require('express');
const router = express.Router();

const EODHD_BASE = 'https://eodhd.com/api';

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

module.exports = router;
