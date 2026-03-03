// Auto-select database implementation based on environment:
//   DATABASE_URL set  → PostgreSQL via pg (Railway / cloud)
//   QUESTDB_URL / default → QuestDB HTTP API (local development)

if (process.env.DATABASE_URL) {
  console.log('[db] Using PostgreSQL (DATABASE_URL detected)');
  module.exports = require('./db-pg');
} else {
  console.log('[db] Using QuestDB (QUESTDB_URL: ' + (process.env.QUESTDB_URL || 'http://localhost:9000') + ')');
  module.exports = require('./db-questdb');
}
