const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/scores — save a batch of scored snapshots
router.post('/', async (req, res) => {
  const { dataSeed, dataSource, scores } = req.body;
  if (!scores || !Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: 'scores array required' });
  }

  let inserted = 0;
  let errors = [];
  const src = db.esc(dataSource || 'Simulated');

  // Insert in chunks of 50
  for (let i = 0; i < scores.length; i += 50) {
    const chunk = scores.slice(i, i + 50);
    const values = chunk.map(s => {
      const sc = s.sc || {};
      const g = sc.g || {}; const t = sc.t || {}; const m = sc.m || {};
      const si = sc.s || {}; const p = sc.p || {}; const a = sc.a || {};
      return "('" + db.esc(s.ticker) + "',now()," +
        (g.ey || 0) + ',' + (g.roic || 0) + ',' + (g.evEbit || 0) + ',' +
        (t.pb || 0) + ',' + (t.dy || 0) + ',' + (t.fcf || 0) + ',' + (t.shY || 0) + ',' +
        (m.moat || 0) + ',' + (m.qual || 0) + ',' +
        (si.mom || 0) + ',' + (si.rsi || 0) + ',' + (si.shortInt || 0) + ',' +
        (p.fscore || 0) + ',' + (a.z || 0) + ',' +
        (s.comp || 0) + ',' + (s.consensus || 0) + ",'" + src + "')";
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

// GET /api/scores/latest — latest scores for all stocks
router.get('/latest', async (req, res) => {
  const { region, sector, limit } = req.query;
  // Join with universe to filter by region/sector
  let sql = 'SELECT * FROM prism_scores LATEST ON ts PARTITION BY ticker';
  if (limit) sql += ' LIMIT ' + parseInt(limit);
  sql += ';';

  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error, rows: [] });
  res.json(result.rows);
});

// GET /api/scores/history/:ticker — score time-series for a stock
router.get('/history/:ticker', async (req, res) => {
  const ticker = db.esc(req.params.ticker);
  const { from, to, limit } = req.query;

  let sql = "SELECT ts, composite_score, ey, roic, pb, momentum, rsi, fscore, altman_z, " +
    "consensus_count, data_source FROM prism_scores WHERE ticker = '" + ticker + "'";
  if (from) sql += " AND ts >= '" + db.esc(from) + "'";
  if (to) sql += " AND ts <= '" + db.esc(to) + "'";
  sql += ' ORDER BY ts';
  if (limit) sql += ' LIMIT ' + parseInt(limit);
  sql += ';';

  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error, rows: [] });
  res.json(result.rows);
});

// GET /api/scores/history/:ticker/sampled — downsampled time-series
router.get('/history/:ticker/sampled', async (req, res) => {
  const ticker = db.esc(req.params.ticker);
  const sampleBy = req.query.sampleBy || '1d';
  // Validate sampleBy to prevent injection
  const validSamples = ['1h', '6h', '1d', '1w', '1M'];
  const sample = validSamples.includes(sampleBy) ? sampleBy : '1d';

  const sql = "SELECT ts, avg(composite_score) as composite_score, " +
    "avg(ey) as ey, avg(pb) as pb, last(fscore) as fscore, last(momentum) as momentum " +
    "FROM prism_scores WHERE ticker = '" + ticker + "' " +
    "SAMPLE BY " + sample + " ORDER BY ts;";

  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error, rows: [] });
  res.json(result.rows);
});

module.exports = router;
