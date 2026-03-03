const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/picks — get current prior picks
router.get('/', async (req, res) => {
  const sql = "SELECT ticker, name, country_flag, entry_date, entry_price, current_price, action, removed " +
    "FROM prism_prior_picks LATEST ON ts PARTITION BY ticker;";

  const result = await db.query(sql);
  if (!result.ok) return res.status(503).json({ error: result.error, rows: [] });

  // Filter out removed picks and map to Prism's S.prior format
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
  const { t, n, co, date, entry, curr } = req.body;
  if (!t) return res.status(400).json({ error: 'ticker (t) required' });

  const sql = "INSERT INTO prism_prior_picks (ts, ticker, name, country_flag, entry_date, entry_price, current_price, action, removed) " +
    "VALUES (now(), '" + db.esc(t) + "', '" + db.esc(n) + "', '" + db.esc(co) + "', '" +
    db.esc(date) + "', " + (entry || 0) + ", " + (curr || 0) + ", null, false);";

  const result = await db.exec(sql);
  if (!result.ok) return res.status(503).json({ error: result.error });
  res.json({ ok: true, ticker: t });
});

// PUT /api/picks/:ticker — update a pick (action or current price)
router.put('/:ticker', async (req, res) => {
  const ticker = db.esc(req.params.ticker);
  const { action, curr } = req.body;

  // First get the current state of this pick
  const getSql = "SELECT * FROM prism_prior_picks WHERE ticker = '" + ticker + "' LATEST ON ts PARTITION BY ticker;";
  const current = await db.query(getSql);
  if (!current.ok || current.rows.length === 0) {
    return res.status(404).json({ error: 'Pick not found' });
  }
  const pk = current.rows[0];

  // Append a new row with updated fields (QuestDB append-only pattern)
  const sql = "INSERT INTO prism_prior_picks (ts, ticker, name, country_flag, entry_date, entry_price, current_price, action, removed) " +
    "VALUES (now(), '" + ticker + "', '" + db.esc(pk.name) + "', '" + db.esc(pk.country_flag) + "', '" +
    db.esc(pk.entry_date) + "', " + pk.entry_price + ", " + (curr != null ? curr : pk.current_price) +
    ", " + (action !== undefined ? "'" + db.esc(action) + "'" : (pk.action ? "'" + db.esc(pk.action) + "'" : 'null')) +
    ", false);";

  const result = await db.exec(sql);
  if (!result.ok) return res.status(503).json({ error: result.error });
  res.json({ ok: true, ticker: req.params.ticker });
});

// DELETE /api/picks/:ticker — soft-delete a pick (mark removed)
router.delete('/:ticker', async (req, res) => {
  const ticker = db.esc(req.params.ticker);

  // Get current state
  const getSql = "SELECT * FROM prism_prior_picks WHERE ticker = '" + ticker + "' LATEST ON ts PARTITION BY ticker;";
  const current = await db.query(getSql);
  if (!current.ok || current.rows.length === 0) {
    return res.status(404).json({ error: 'Pick not found' });
  }
  const pk = current.rows[0];

  // Append row with removed=true
  const sql = "INSERT INTO prism_prior_picks (ts, ticker, name, country_flag, entry_date, entry_price, current_price, action, removed) " +
    "VALUES (now(), '" + ticker + "', '" + db.esc(pk.name) + "', '" + db.esc(pk.country_flag) + "', '" +
    db.esc(pk.entry_date) + "', " + pk.entry_price + ", " + pk.current_price + ", null, true);";

  const result = await db.exec(sql);
  if (!result.ok) return res.status(503).json({ error: result.error });
  res.json({ ok: true, ticker: req.params.ticker });
});

module.exports = router;
