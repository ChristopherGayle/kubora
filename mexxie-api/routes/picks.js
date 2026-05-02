const express = require('express');
const router = express.Router();
const db = require('../db');

// Strict numeric coercion — prevents non-number strings reaching SQL
function n(v) { const x = +v; return (Number.isFinite(x)) ? x : 0; }
// Ticker whitelist — only allow alphanumeric, dot, hyphen, underscore
function safeTicker(t) {
  if (typeof t !== 'string') return '';
  return /^[A-Z0-9._-]+$/i.test(t) ? t.toUpperCase() : '';
}

// GET /api/picks
router.get('/', async (req, res) => {
  let sql;
  if (db.isPg) {
    sql = "SELECT DISTINCT ON (ticker) ticker, name, country_flag, entry_date, entry_price, current_price, action, removed " +
      "FROM prism_prior_picks ORDER BY ticker, ts DESC";
  } else {
    sql = "SELECT ticker, name, country_flag, entry_date, entry_price, current_price, action, removed " +
      "FROM prism_prior_picks LATEST ON ts PARTITION BY ticker;";
  }
  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error, rows: [] });

  const picks = result.rows
    .filter(r => !r.removed)
    .map(r => ({
      t: r.ticker, n: r.name, co: r.country_flag,
      date: r.entry_date, entry: r.entry_price,
      curr: r.current_price, act: r.action || null
    }));
  res.json(picks);
});

// POST /api/picks — add a new pick
router.post('/', async (req, res) => {
  const { t, n: name, co, date, entry, curr } = req.body;
  const safeT = safeTicker(t);
  if (!safeT) return res.status(400).json({ error: 'valid ticker (t) required' });

  const sql = "INSERT INTO prism_prior_picks (ts, ticker, name, country_flag, entry_date, entry_price, current_price, action, removed) " +
    "VALUES (NOW(), '" + safeT + "', '" + db.esc(name) + "', '" + db.esc(co) + "', '" +
    db.esc(date) + "', " + n(entry) + ", " + n(curr) + ", null, false);";

  const result = await db.exec(sql);
  if (!result.ok) return res.status(503).json({ error: result.error });
  res.json({ ok: true, ticker: safeT });
});

// PUT /api/picks/:ticker — update a pick
router.put('/:ticker', async (req, res) => {
  const ticker = safeTicker(req.params.ticker);
  if (!ticker) return res.status(400).json({ error: 'invalid ticker' });
  const { action, curr } = req.body;

  let getSql;
  if (db.isPg) {
    getSql = "SELECT DISTINCT ON (ticker) * FROM prism_prior_picks WHERE ticker = '" + ticker + "' ORDER BY ticker, ts DESC";
  } else {
    getSql = "SELECT * FROM prism_prior_picks WHERE ticker = '" + ticker + "' LATEST ON ts PARTITION BY ticker;";
  }
  const current = await db.query(getSql);
  if (!current.ok || current.rows.length === 0) return res.status(404).json({ error: 'Pick not found' });
  const pk = current.rows[0];

  const newCurr = (curr != null) ? n(curr) : n(pk.current_price);
  const actionSql = (action !== undefined)
    ? (action === null ? 'null' : "'" + db.esc(action) + "'")
    : (pk.action ? "'" + db.esc(pk.action) + "'" : 'null');
  const sql = "INSERT INTO prism_prior_picks (ts, ticker, name, country_flag, entry_date, entry_price, current_price, action, removed) " +
    "VALUES (NOW(), '" + ticker + "', '" + db.esc(pk.name) + "', '" + db.esc(pk.country_flag) + "', '" +
    db.esc(pk.entry_date) + "', " + n(pk.entry_price) + ", " + newCurr +
    ", " + actionSql + ", false);";

  const result = await db.exec(sql);
  if (!result.ok) return res.status(503).json({ error: result.error });
  res.json({ ok: true, ticker });
});

// DELETE /api/picks/:ticker — soft-delete
router.delete('/:ticker', async (req, res) => {
  const ticker = safeTicker(req.params.ticker);
  if (!ticker) return res.status(400).json({ error: 'invalid ticker' });

  let getSql;
  if (db.isPg) {
    getSql = "SELECT DISTINCT ON (ticker) * FROM prism_prior_picks WHERE ticker = '" + ticker + "' ORDER BY ticker, ts DESC";
  } else {
    getSql = "SELECT * FROM prism_prior_picks WHERE ticker = '" + ticker + "' LATEST ON ts PARTITION BY ticker;";
  }
  const current = await db.query(getSql);
  if (!current.ok || current.rows.length === 0) return res.status(404).json({ error: 'Pick not found' });
  const pk = current.rows[0];

  const sql = "INSERT INTO prism_prior_picks (ts, ticker, name, country_flag, entry_date, entry_price, current_price, action, removed) " +
    "VALUES (NOW(), '" + ticker + "', '" + db.esc(pk.name) + "', '" + db.esc(pk.country_flag) + "', '" +
    db.esc(pk.entry_date) + "', " + n(pk.entry_price) + ", " + n(pk.current_price) + ", null, true);";

  const result = await db.exec(sql);
  if (!result.ok) return res.status(503).json({ error: result.error });
  res.json({ ok: true, ticker });
});

module.exports = router;
