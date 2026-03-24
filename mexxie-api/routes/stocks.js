const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/stocks — list stock universe
router.get('/', async (req, res) => {
  const { region, sector, limit } = req.query;
  let sql;

  if (db.isPg) {
    let where = ['active = true'];
    if (region && region !== 'Worldwide') where.push("region = '" + db.esc(region) + "'");
    if (sector && sector !== 'All') where.push("sector = '" + db.esc(sector) + "'");
    sql = 'SELECT DISTINCT ON (ticker) ticker, name, sector, region, country_flag, price, market_cap_bn, active, exchange ' +
      'FROM prism_stock_universe WHERE ' + where.join(' AND ') + ' ORDER BY ticker, ts DESC';
    if (limit) sql = 'SELECT * FROM (' + sql + ') sub LIMIT ' + Math.min(5000, Math.max(1, parseInt(limit) || 500));
  } else {
    let where = [];
    if (region && region !== 'Worldwide') where.push("region = '" + db.esc(region) + "'");
    if (sector && sector !== 'All') where.push("sector = '" + db.esc(sector) + "'");
    sql = 'SELECT ticker, name, sector, region, country_flag, price, market_cap_bn, active FROM prism_stock_universe';
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' LATEST ON ts PARTITION BY ticker';
    if (limit) sql += ' LIMIT ' + Math.min(5000, Math.max(1, parseInt(limit) || 500));
    sql += ';';
  }

  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error, rows: [] });

  const stocks = result.rows
    .filter(r => r.active !== false)
    .map(r => ({
      t: r.ticker, n: r.name, s: r.sector, p: r.price || 0,
      mc: r.market_cap_bn || 0, r: r.region, co: r.country_flag || '',
      ex: r.exchange || null
    }));
  res.json(stocks);
});

// GET /api/stocks/count
router.get('/count', async (req, res) => {
  let sql;
  if (db.isPg) {
    sql = "SELECT region, count(*) as cnt FROM (" +
      "SELECT DISTINCT ON (ticker) ticker, region FROM prism_stock_universe WHERE active = true ORDER BY ticker, ts DESC" +
      ") sub GROUP BY region ORDER BY cnt DESC";
  } else {
    sql = "SELECT region, count() cnt FROM prism_stock_universe LATEST ON ts PARTITION BY ticker GROUP BY region;";
  }
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
  let inserted = 0, errors = [];
  for (let i = 0; i < stocks.length; i += 50) {
    const chunk = stocks.slice(i, i + 50);
    const values = chunk.map(s => {
      const ex = s.ex || s.exchange || null;
      return "(NOW(),'" + db.esc(s.t) + "','" + db.esc(s.n) + "','" + db.esc(s.s) + "','" +
        db.esc(s.r) + "','" + db.esc(s.co) + "'," + (s.p || 0) + ',' + (s.mc || 0) + ',true,' +
        (ex ? "'" + db.esc(ex) + "'" : 'NULL') + ')';
    }).join(',');
    const sql = 'INSERT INTO prism_stock_universe (ts,ticker,name,sector,region,country_flag,price,market_cap_bn,active,exchange) VALUES ' + values + ';';
    const result = await db.exec(sql);
    if (result.ok) inserted += chunk.length;
    else errors.push(result.error);
  }
  res.json({ inserted, errors: errors.length ? errors : undefined });
});

// POST /api/stocks/reset — truncate universe and re-seed with 122 curated stocks (PostgreSQL only)
router.post('/reset', async (req, res) => {
  if (!db.isPg) return res.status(400).json({ error: 'Reset only available on PostgreSQL (Railway)' });
  try {
    await db.exec('TRUNCATE TABLE prism_stock_universe');
    // Re-seed via migrate
    const migrate = require('../migrate');
    await migrate();
    const countRes = await db.query(
      "SELECT COUNT(*) as cnt FROM (SELECT DISTINCT ON (ticker) ticker FROM prism_stock_universe WHERE active = true ORDER BY ticker, ts DESC) sub"
    );
    const total = countRes.ok ? parseInt(countRes.rows[0].cnt) : 0;
    res.json({ ok: true, message: 'Universe reset to curated stocks', total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/stocks/import-etl — pull from QuestDB ETL tables (local dev only)
router.post('/import-etl', async (req, res) => {
  if (db.isPg) {
    // ETL tables only exist in local QuestDB — return current cloud count
    const countRes = await db.query(
      "SELECT COUNT(*) as cnt FROM (SELECT DISTINCT ON (ticker) ticker FROM prism_stock_universe WHERE active = true ORDER BY ticker, ts DESC) sub"
    );
    const total = countRes.ok ? parseInt(countRes.rows[0].cnt) : 0;
    return res.json({
      inserted: 0, skipped: total, total,
      message: 'ETL import requires local QuestDB. Cloud has ' + total + ' curated stocks.'
    });
  }

  // QuestDB path
  const REGION_FLAGS = { 'US':'🇺🇸','Europe':'🇪🇺','Asia':'🌏','S. America':'🇧🇷','Africa':'🇿🇦' };
  const SECTOR_MAP = {
    'Technology':'Technology','Healthcare':'Healthcare','Finance':'Finance',
    'Financial Services':'Finance','Consumer':'Consumer',
    'Consumer Discretionary':'Consumer','Consumer Staples':'Consumer',
    'Energy':'Energy','Industrial':'Industrial','Industrials':'Industrial',
    'Materials':'Materials','Utilities':'Utilities','Real Estate':'Real Estate',
    'Telecom':'Telecom','Communication Services':'Telecom','ETF':'Other'
  };
  function mapSector(raw) { return SECTOR_MAP[raw] || 'Other'; }

  try {
    const existingRes = await db.query('SELECT ticker FROM prism_stock_universe LATEST ON ts PARTITION BY ticker');
    const existingSymbols = new Set(existingRes.ok ? existingRes.rows.map(r => r.ticker) : []);

    const etlSQL = `
      SELECT s.symbol, s.name, s.sector, s.region, dp.close, s.market_cap_bn
      FROM (SELECT symbol, name, sector, region, market_cap_bn FROM stocks LATEST ON update_time PARTITION BY symbol) s
      JOIN (SELECT symbol, close FROM daily_prices LATEST ON timestamp PARTITION BY symbol) dp
      ON s.symbol = dp.symbol
      WHERE dp.close > 1.0 AND s.region IN ('US', 'Europe', 'Asia', 'S. America', 'Africa')
      ORDER BY s.region, COALESCE(s.market_cap_bn, 0) DESC, dp.close DESC
    `;
    const etlRes = await db.query(etlSQL);
    if (!etlRes.ok) return res.status(503).json({ error: 'ETL query failed: ' + etlRes.error });

    const newStocks = etlRes.rows.filter(r => !existingSymbols.has(r.symbol));
    if (newStocks.length === 0) {
      return res.json({ inserted: 0, skipped: etlRes.rows.length, total: existingSymbols.size, message: 'Already up to date' });
    }

    let inserted = 0, errors = [];
    for (let i = 0; i < newStocks.length; i += 100) {
      const batch = newStocks.slice(i, i + 100);
      const values = batch.map(r => {
        const price = +(+r.close).toFixed(2);
        const marketCapBn = Number.isFinite(+r.market_cap_bn) ? +(+r.market_cap_bn).toFixed(3) : 0;
        return `(now(),'${db.esc(r.symbol)}','${db.esc(r.name)}','${mapSector(r.sector)}','${r.region}','${REGION_FLAGS[r.region]||'🌍'}',${price},${marketCapBn},true)`;
      }).join(',');
      const result = await db.exec(`INSERT INTO prism_stock_universe (ts,ticker,name,sector,region,country_flag,price,market_cap_bn,active) VALUES ${values}`);
      if (result.ok) inserted += batch.length;
      else errors.push(result.error);
    }

    const countRes = await db.query('SELECT region, count() cnt FROM prism_stock_universe LATEST ON ts PARTITION BY ticker GROUP BY region ORDER BY count() DESC');
    const breakdown = countRes.ok ? countRes.rows : [];
    res.json({ inserted, skipped: existingSymbols.size, total: breakdown.reduce((s,r)=>s+r.cnt,0), breakdown, errors: errors.length ? errors : undefined });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
