const express = require('express');
const router = express.Router();
const db = require('../db');

// Safe numeric coercion — prevents non-numbers reaching SQL
function n(v) { const x = +v; return (Number.isFinite(x)) ? x : 0; }
// Ticker whitelist — alphanumerics, dot, hyphen, underscore (covers all global tickers)
function safeTicker(t) {
  if (typeof t !== 'string') return '';
  return /^[A-Z0-9._-]+$/i.test(t) ? t.toUpperCase() : '';
}
function safeIsoDate(d) {
  if (typeof d !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+\-]\d{2}:?\d{2})?)?$/.test(d) ? d : null;
}

// POST /api/scores — save batch of scored snapshots
router.post('/', async (req, res) => {
  const { dataSource, scores } = req.body;
  if (!scores || !Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: 'scores array required' });
  }
  let inserted = 0, errors = [];
  const src = db.esc(dataSource || 'Simulated');

  for (let i = 0; i < scores.length; i += 50) {
    const chunk = scores.slice(i, i + 50);
    const values = chunk.map(s => {
      const sc = s.sc || {}, g = sc.g || {}, t = sc.t || {}, m = sc.m || {}, si = sc.s || {}, p = sc.p || {}, a = sc.a || {};
      return "('" + db.esc(s.ticker) + "',NOW()," +
        n(g.ey)+','+n(g.roic)+','+n(g.evEbit)+','+
        n(t.pb)+','+n(t.dy)+','+n(t.fcf)+','+n(t.shY)+','+
        n(m.moat)+','+n(m.qual)+','+
        n(si.mom)+','+n(si.rsi)+','+n(si.shortInt)+','+
        n(p.fscore)+','+n(a.z)+','+
        n(s.comp)+','+n(s.consensus)+",'"+src+"')";
    }).join(',');

    const sql = 'INSERT INTO prism_scores ' +
      '(ticker,ts,ey,roic,ev_ebit,pb,div_yield,fcf_yield,shareholder_yield,' +
      'moat,quality,momentum,rsi,short_interest,fscore,altman_z,' +
      'composite_score,consensus_count,data_source) VALUES ' + values + ';';
    const result = await db.exec(sql);
    if (result.ok) inserted += chunk.length;
    else errors.push(result.error);
  }
  res.json({ inserted, errors: errors.length ? errors : undefined });
});

// GET /api/scores/latest
router.get('/latest', async (req, res) => {
  const safeLimit = req.query.limit ? Math.min(5000, Math.max(1, parseInt(req.query.limit) || 500)) : null;
  let sql;
  if (db.isPg) {
    sql = 'SELECT DISTINCT ON (ticker) * FROM prism_scores ORDER BY ticker, ts DESC';
    if (safeLimit) sql = 'SELECT * FROM (' + sql + ') sub LIMIT ' + safeLimit;
  } else {
    sql = 'SELECT * FROM prism_scores LATEST ON ts PARTITION BY ticker';
    if (safeLimit) sql += ' LIMIT ' + safeLimit;
    sql += ';';
  }
  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error, rows: [] });
  res.json(result.rows);
});

// GET /api/scores/history/:ticker
router.get('/history/:ticker', async (req, res) => {
  const ticker = safeTicker(req.params.ticker);
  if (!ticker) return res.status(400).json({ error: 'invalid ticker' });
  const from = safeIsoDate(req.query.from);
  const to = safeIsoDate(req.query.to);
  const safeLimit = req.query.limit ? Math.min(10000, Math.max(1, parseInt(req.query.limit) || 500)) : null;

  let sql = "SELECT ts, composite_score, ey, roic, pb, momentum, rsi, fscore, altman_z, " +
    "consensus_count, data_source FROM prism_scores WHERE ticker = '" + ticker + "'";
  if (from) sql += " AND ts >= '" + from + "'";
  if (to) sql += " AND ts <= '" + to + "'";
  sql += ' ORDER BY ts';
  if (safeLimit) sql += ' LIMIT ' + safeLimit;
  sql += ';';

  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error, rows: [] });
  res.json(result.rows);
});

// GET /api/scores/history/:ticker/sampled
router.get('/history/:ticker/sampled', async (req, res) => {
  const ticker = safeTicker(req.params.ticker);
  if (!ticker) return res.status(400).json({ error: 'invalid ticker' });
  let sql;

  if (db.isPg) {
    sql = "SELECT date_trunc('day', ts) as ts, " +
      "avg(composite_score) as composite_score, avg(ey) as ey, avg(pb) as pb, " +
      "round(avg(fscore)) as fscore, avg(momentum) as momentum " +
      "FROM prism_scores WHERE ticker = '" + ticker + "' " +
      "GROUP BY date_trunc('day', ts) ORDER BY ts;";
  } else {
    const validSamples = ['1h','6h','1d','1w','1M'];
    const sample = validSamples.includes(req.query.sampleBy) ? req.query.sampleBy : '1d';
    sql = "SELECT ts, avg(composite_score) as composite_score, avg(ey) as ey, avg(pb) as pb, " +
      "last(fscore) as fscore, last(momentum) as momentum " +
      "FROM prism_scores WHERE ticker = '" + ticker + "' SAMPLE BY " + sample + " ORDER BY ts;";
  }

  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error, rows: [] });
  res.json(result.rows);
});

module.exports = router;
