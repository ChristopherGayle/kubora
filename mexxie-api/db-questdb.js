// QuestDB HTTP client helper
// Communicates with QuestDB REST API at /exec endpoint

const QUESTDB_URL = process.env.QUESTDB_URL || 'http://localhost:9000';

async function query(sql) {
  try {
    const url = QUESTDB_URL + '/exec?query=' + encodeURIComponent(sql);
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: 'HTTP ' + res.status + ': ' + text };
    }
    const data = await res.json();
    if (data.error) return { ok: false, error: data.error };
    // Transform QuestDB response into friendly format
    const columns = (data.columns || []).map(c => c.name);
    const rows = (data.dataset || []).map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
    return { ok: true, columns, rows, count: data.count || rows.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function exec(sql) {
  try {
    const url = QUESTDB_URL + '/exec?query=' + encodeURIComponent(sql);
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: 'HTTP ' + res.status + ': ' + text };
    }
    const data = await res.json();
    if (data.error) return { ok: false, error: data.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function healthCheck() {
  try {
    const url = QUESTDB_URL + '/exec?query=' + encodeURIComponent('SELECT 1;');
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Escape single quotes in SQL strings
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/'/g, "''");
}

// Format a JS Date or ISO string to QuestDB timestamp format
function toTs(d) {
  if (!d) return "now()";
  const dt = typeof d === 'string' ? new Date(d) : d;
  return "'" + dt.toISOString().replace('T', ' ').replace('Z', '') + "'";
}

module.exports = { query, exec, healthCheck, esc, toTs, QUESTDB_URL };
