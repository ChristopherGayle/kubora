const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/stocks — list stock universe
router.get('/', async (req, res) => {
  const { region, sector, limit } = req.query;
  let where = [];
  if (region && region !== 'Worldwide') where.push("region = '" + db.esc(region) + "'");
  if (sector && sector !== 'All') where.push("sector = '" + db.esc(sector) + "'");

  let sql = 'SELECT ticker, name, sector, region, country_flag, price, market_cap_bn, active ' +
    'FROM prism_stock_universe';
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' LATEST ON ts PARTITION BY ticker';
  if (limit) sql += ' LIMIT ' + parseInt(limit);
  sql += ';';

  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error, rows: [] });

  // Filter out inactive stocks and map to Prism format
  const stocks = result.rows
    .filter(r => r.active !== false)
    .map(r => ({
      t: r.ticker, n: r.name, s: r.sector, p: r.price || 0,
      mc: r.market_cap_bn || 0, r: r.region, co: r.country_flag || ''
    }));
  res.json(stocks);
});

// GET /api/stocks/count — stock counts by region/sector
router.get('/count', async (req, res) => {
  const sql = "SELECT region, count() cnt FROM prism_stock_universe LATEST ON ts PARTITION BY ticker GROUP BY region;";
  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error });
  res.json(result.rows);
});

// POST /api/stocks — add or update stocks
router.post('/', async (req, res) => {
  const { stocks } = req.body;
  if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
    return res.status(400).json({ error: 'stocks array required' });
  }

  let inserted = 0;
  let errors = [];

  // Batch insert in chunks of 50
  for (let i = 0; i < stocks.length; i += 50) {
    const chunk = stocks.slice(i, i + 50);
    const values = chunk.map(s =>
      "('" + db.esc(s.t) + "','" + db.esc(s.n) + "','" + db.esc(s.s) + "','" +
      db.esc(s.r) + "','" + db.esc(s.co) + "'," + (s.p || 0) + ',' +
      (s.mc || 0) + ',true,now())'
    ).join(',');

    const sql = 'INSERT INTO prism_stock_universe ' +
      '(ticker, name, sector, region, country_flag, price, market_cap_bn, active, ts) VALUES ' +
      values + ';';
    const result = await db.exec(sql);
    if (result.ok) inserted += chunk.length;
    else errors.push(result.error);
  }

  res.json({ inserted, errors: errors.length ? errors : undefined });
});

module.exports = router;
