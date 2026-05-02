const express = require('express');
const router = express.Router();
const db = require('../db');

// Strict numeric coercion — prevents non-number strings reaching SQL
function n(v) { const x = +v; return (Number.isFinite(x)) ? x : 0; }
// Region whitelist — keeps user-supplied region constrained to a known set
const ALLOWED_REGIONS = new Set(['Worldwide','US','Europe','Asia','S. America','Africa','Canada','Oceania','Middle East']);
function safeRegion(r) { return (typeof r === 'string' && ALLOWED_REGIONS.has(r)) ? r : 'Worldwide'; }
// ISO-ish date check (YYYY-MM-DD or full ISO 8601). Rejects anything else.
function safeIsoDate(d) {
  if (typeof d !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+\-]\d{2}:?\d{2})?)?$/.test(d)) return null;
  return d;
}

// GET /api/valuation
router.get('/', async (req, res) => {
  const region = safeRegion(req.query.region);
  let sql;
  if (db.isPg) {
    sql = "SELECT DISTINCT ON (region) * FROM prism_market_valuation WHERE region = '" + region + "' ORDER BY region, ts DESC";
  } else {
    sql = "SELECT * FROM prism_market_valuation WHERE region = '" + region + "' LATEST ON ts PARTITION BY region;";
  }
  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error });
  if (result.rows.length === 0) return res.json(null);

  const r = result.rows[0];
  res.json({
    ts: r.ts, region: r.region, cape: r.cape,
    ey: r.earnings_yield, riskFree: r.risk_free_rate,
    erp: r.erp, buffett: r.buffett_indicator,
    etfPrice: r.etf_price, etf: r.etf_symbol,
    consensus: r.consensus,
    signals: { cape: r.cape_signal, buffett: r.buffett_signal, erp: r.erp_signal }
  });
});

// GET /api/valuation/history
router.get('/history', async (req, res) => {
  const region = safeRegion(req.query.region);
  const from = safeIsoDate(req.query.from);
  let sql = "SELECT ts, cape, earnings_yield, erp, buffett_indicator, consensus " +
    "FROM prism_market_valuation WHERE region = '" + region + "'";
  if (from) sql += " AND ts >= '" + from + "'";
  sql += " ORDER BY ts;";
  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error, rows: [] });
  res.json(result.rows);
});

// POST /api/valuation
router.post('/', async (req, res) => {
  const v = req.body;
  if (!v || !v.region) return res.status(400).json({ error: 'region required' });
  const region = safeRegion(v.region);
  const signals = v.signals || {};
  const sql = "INSERT INTO prism_market_valuation " +
    "(ts, region, cape, earnings_yield, risk_free_rate, erp, buffett_indicator, " +
    "etf_price, etf_symbol, consensus, cape_signal, buffett_signal, erp_signal) VALUES " +
    "(NOW(), '" + region + "', " +
    n(v.cape) + ", " + n(v.ey) + ", " + n(v.riskFree) + ", " +
    n(v.erp) + ", " + n(v.buffett) + ", " + n(v.etfPrice) + ", '" +
    db.esc(v.etf||'') + "', '" + db.esc(v.consensus||'neutral') + "', '" +
    db.esc(signals.cape||'neutral') + "', '" + db.esc(signals.buffett||'neutral') + "', '" +
    db.esc(signals.erp||'neutral') + "');";
  const result = await db.exec(sql);
  if (!result.ok) return res.status(503).json({ error: result.error });
  res.json({ ok: true });
});

module.exports = router;
