const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/valuation
router.get('/', async (req, res) => {
  const region = db.esc(req.query.region || 'Worldwide');
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
  const region = db.esc(req.query.region || 'Worldwide');
  const from = req.query.from;
  let sql = "SELECT ts, cape, earnings_yield, erp, buffett_indicator, consensus " +
    "FROM prism_market_valuation WHERE region = '" + region + "'";
  if (from) sql += " AND ts >= '" + db.esc(from) + "'";
  sql += " ORDER BY ts;";
  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error, rows: [] });
  res.json(result.rows);
});

// POST /api/valuation
router.post('/', async (req, res) => {
  const v = req.body;
  if (!v || !v.region) return res.status(400).json({ error: 'region required' });
  const signals = v.signals || {};
  const sql = "INSERT INTO prism_market_valuation " +
    "(ts, region, cape, earnings_yield, risk_free_rate, erp, buffett_indicator, " +
    "etf_price, etf_symbol, consensus, cape_signal, buffett_signal, erp_signal) VALUES " +
    "(NOW(), '" + db.esc(v.region) + "', " +
    (v.cape||0) + ", " + (v.ey||0) + ", " + (v.riskFree||0) + ", " +
    (v.erp||0) + ", " + (v.buffett||0) + ", " + (v.etfPrice||0) + ", '" +
    db.esc(v.etf||'') + "', '" + db.esc(v.consensus||'neutral') + "', '" +
    db.esc(signals.cape||'neutral') + "', '" + db.esc(signals.buffett||'neutral') + "', '" +
    db.esc(signals.erp||'neutral') + "');";
  const result = await db.exec(sql);
  if (!result.ok) return res.status(503).json({ error: result.error });
  res.json({ ok: true });
});

module.exports = router;
