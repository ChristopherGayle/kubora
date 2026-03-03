const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS — allow Prism frontend
app.use(cors({
  origin: [
    'http://localhost:8080', 'http://127.0.0.1:8080',
    'http://localhost:3000', 'http://127.0.0.1:3000'
  ]
}));

// JSON body parser — large payloads for 4000-stock score batches
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', async (req, res) => {
  const dbOk = await db.healthCheck();
  res.json({ status: dbOk ? 'ok' : 'degraded', db: dbOk, timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/stocks', require('./routes/stocks'));
app.use('/api/scores', require('./routes/scores'));
app.use('/api/picks', require('./routes/picks'));
app.use('/api/valuation', require('./routes/valuation'));
app.use('/api/eodhd', require('./routes/eodhd'));

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log('Mexxie API running on http://localhost:' + PORT);
  console.log('QuestDB endpoint: ' + db.QUESTDB_URL);
  // Verify DB connection on startup
  db.healthCheck().then(ok => {
    if (ok) console.log('QuestDB connection: OK');
    else console.warn('QuestDB connection: FAILED — API will return errors for DB operations');
  });
});
