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

// POST /api/stocks/import-etl — pull new stocks from existing ETL pipeline tables
// Safe to run repeatedly; only inserts tickers not already in prism_stock_universe
router.post('/import-etl', async (req, res) => {
  const REGION_FLAGS = {
    'US': '🇺🇸', 'Europe': '🇪🇺', 'Asia': '🌏',
    'S. America': '🇧🇷', 'Africa': '🇿🇦'
  };
  const SECTOR_MAP = {
    'Technology':'Technology','Healthcare':'Healthcare','Finance':'Finance',
    'Financial Services':'Finance','Consumer':'Consumer',
    'Consumer Discretionary':'Consumer','Consumer Staples':'Consumer',
    'Energy':'Energy','Industrial':'Industrial','Industrials':'Industrial',
    'Materials':'Materials','Utilities':'Utilities','Real Estate':'Real Estate',
    'Telecom':'Telecom','Communication Services':'Telecom','ETF':'Other'
  };
  function mapSector(raw) {
    if (!raw) return 'Other';
    return SECTOR_MAP[raw] || 'Other';
  }

  try {
    // 1. Get existing tickers
    const existingRes = await db.query(
      'SELECT ticker FROM prism_stock_universe LATEST ON ts PARTITION BY ticker'
    );
    const existingSymbols = new Set(
      existingRes.ok ? existingRes.rows.map(r => r.ticker) : []
    );

    // 2. Query ETL join
    const etlSQL = `
      SELECT s.symbol, s.name, s.sector, s.region, dp.close
      FROM (SELECT symbol, name, sector, region FROM stocks LATEST ON update_time PARTITION BY symbol) s
      JOIN (SELECT symbol, close FROM daily_prices LATEST ON timestamp PARTITION BY symbol) dp
      ON s.symbol = dp.symbol
      WHERE dp.close > 1.0
      AND s.region IN ('US', 'Europe', 'Asia', 'S. America', 'Africa')
      ORDER BY s.region, dp.close DESC
    `;
    const etlRes = await db.query(etlSQL);
    if (!etlRes.ok) return res.status(503).json({ error: 'ETL query failed: ' + etlRes.error });

    const newStocks = etlRes.rows.filter(r => !existingSymbols.has(r.symbol));
    if (newStocks.length === 0) {
      const total = existingSymbols.size;
      return res.json({ inserted: 0, skipped: etlRes.rows.length, total, message: 'Already up to date' });
    }

    // 3. Insert in batches of 100
    let inserted = 0; let errors = [];
    for (let i = 0; i < newStocks.length; i += 100) {
      const batch = newStocks.slice(i, i + 100);
      const values = batch.map(r => {
        const sector = mapSector(r.sector);
        const flag = REGION_FLAGS[r.region] || '🌍';
        const price = +(+r.close).toFixed(2);
        return `(now(),'${db.esc(r.symbol)}','${db.esc(r.name)}','${sector}','${r.region}','${flag}',${price},0,true)`;
      }).join(',');
      const sql = `INSERT INTO prism_stock_universe (ts,ticker,name,sector,region,country_flag,price,market_cap_bn,active) VALUES ${values}`;
      const result = await db.exec(sql);
      if (result.ok) inserted += batch.length;
      else errors.push(result.error);
    }

    // 4. Return counts by region
    const countRes = await db.query(
      'SELECT region, count() cnt FROM prism_stock_universe LATEST ON ts PARTITION BY ticker GROUP BY region ORDER BY count() DESC'
    );
    const breakdown = countRes.ok ? countRes.rows : [];
    const total = breakdown.reduce((s, r) => s + r.cnt, 0);

    res.json({ inserted, skipped: existingSymbols.size, total, breakdown, errors: errors.length ? errors : undefined });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
