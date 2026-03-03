const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
// IS_PROD: true on Railway (has RAILWAY_ENVIRONMENT) or when DATABASE_URL is set
const IS_PROD = !!process.env.RAILWAY_ENVIRONMENT || !!process.env.DATABASE_URL;

// CORS — always open on Railway so GitHub Pages can reach the API
app.use(cors(IS_PROD
  ? { origin: '*' }
  : { origin: ['http://localhost:8080','http://127.0.0.1:8080','http://localhost:3000','http://127.0.0.1:3000'] }
));

// JSON body parser — large payloads for 4000-stock score batches
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', async (req, res) => {
  const dbOk = await db.healthCheck();
  res.json({ status: dbOk ? 'ok' : 'degraded', db: dbOk, timestamp: new Date().toISOString(), env: IS_PROD ? 'cloud' : 'local' });
});

// Mount routes
app.use('/api/stocks',    require('./routes/stocks'));
app.use('/api/scores',    require('./routes/scores'));
app.use('/api/picks',     require('./routes/picks'));
app.use('/api/valuation', require('./routes/valuation'));
app.use('/api/eodhd',     require('./routes/eodhd'));

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err.message);
  res.status(500).json({ error: err.message });
});

async function start() {
  // Run PostgreSQL migrations on startup (Railway only)
  if (IS_PROD) {
    try {
      await require('./migrate')();
    } catch (e) {
      console.error('[startup] Migration error:', e.message);
    }
  }

  app.listen(PORT, () => {
    console.log('Mexxie API running on port ' + PORT);
    console.log('Mode: ' + (IS_PROD ? 'Cloud (PostgreSQL)' : 'Local (QuestDB)'));
    db.healthCheck().then(ok => {
      console.log('DB connection: ' + (ok ? 'OK' : 'FAILED'));
    });
  });
}

start();
