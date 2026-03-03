const express = require('express');
const router = express.Router();

const EODHD_BASE = 'https://eodhd.com/api';

// Helper: proxy fetch to EODHD
async function eodhdFetch(path, apiKey) {
  const sep = path.includes('?') ? '&' : '?';
  const url = EODHD_BASE + path + sep + 'api_token=' + apiKey + '&fmt=json';
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('EODHD ' + resp.status + ': ' + text.substring(0, 200));
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
