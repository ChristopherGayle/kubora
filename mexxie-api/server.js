const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
// IS_PROD: true on Railway (has RAILWAY_ENVIRONMENT) or when DATABASE_URL is set
const IS_PROD = !!process.env.RAILWAY_ENVIRONMENT || !!process.env.DATABASE_URL;

// CORS — allow GitHub Pages, local dev, and direct file:// access
// Browsers set origin=null for file:// — allow it so the app works opened locally
const ALLOWED_ORIGINS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/[a-z0-9-]+\.github\.io$/,
  /^https?:\/\/[a-z0-9-]+\.up\.railway\.app$/,
];
app.use(cors({
  origin: function(origin, callback) {
    // null origin = file:// or same-origin — always allow
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.some(p => p.test(origin))) return callback(null, true);
    // In prod, also allow unknown origins (user may self-host the HTML)
    // CORS only prevents browser cross-origin reads; API keys are user-supplied,
    // so an open CORS policy doesn't expose our credentials
    callback(null, IS_PROD ? true : false);
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// JSON body parser — large payloads for 4000-stock score batches
app.use(express.json({ limit: '5mb' }));

// ── Simple in-memory rate limiter (no extra package needed) ──────────────────
// Tracks request timestamps per IP; limits to maxReq per windowMs
const _rlMap = new Map();
function makeRateLimit(windowMs, maxReq) {
  return function(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const cutoff = now - windowMs;
    const times = (_rlMap.get(ip) || []).filter(t => t > cutoff);
    if (times.length >= maxReq) {
      return res.status(429).json({ error: 'Too many requests — slow down' });
    }
    times.push(now);
    _rlMap.set(ip, times);
    next();
  };
}
// Purge stale entries every 5 minutes to avoid memory growth
setInterval(() => {
  const cutoff = Date.now() - 120000;
  for (const [ip, times] of _rlMap) {
    const fresh = times.filter(t => t > cutoff);
    if (fresh.length === 0) _rlMap.delete(ip); else _rlMap.set(ip, fresh);
  }
}, 5 * 60 * 1000).unref();

// Apply: 120 requests/minute/IP across all /api routes
app.use('/api', makeRateLimit(60 * 1000, 120));

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
app.use('/api/eodhd',        require('./routes/eodhd'));
app.use('/api/fundamentals', require('./routes/fundamentals'));

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
