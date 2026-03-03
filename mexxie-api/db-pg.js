// PostgreSQL client for Railway/cloud deployment
// Used when DATABASE_URL environment variable is set

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function query(sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    return { ok: true, rows: result.rows, count: result.rowCount };
  } catch (e) {
    console.error('PG query error:', e.message.substring(0, 300));
    return { ok: false, error: e.message };
  }
}

async function exec(sql, params = []) {
  try {
    await pool.query(sql, params);
    return { ok: true };
  } catch (e) {
    console.error('PG exec error:', e.message.substring(0, 300));
    return { ok: false, error: e.message };
  }
}

async function healthCheck() {
  try { await pool.query('SELECT 1'); return true; } catch (e) { return false; }
}

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/'/g, "''");
}

module.exports = { query, exec, healthCheck, esc, pool, isPg: true };
