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
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-webhook-secret'],
}));

// ── WEBHOOK_SECRET — protects expensive write endpoints from abuse ─────────
// Set WEBHOOK_SECRET=<any-random-string> on Railway. Copy the same value into
// app Settings → API Server → Webhook Secret. The browser sends it as the
// x-webhook-secret header on every write request.
// If WEBHOOK_SECRET env var is not set, the check is skipped (dev-friendly).
// Loopback calls (scheduler) are exempt — they originate from this same process.
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
function isLoopback(req) {
  // Use socket peer (not req.ip) — this can't be spoofed via X-Forwarded-For
  const ip = (req.socket && req.socket.remoteAddress) || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}
// Constant-time compare to mitigate timing-attack key recovery
const crypto = require('crypto');
function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
app.use([
  '/api/eodhd/import-exchange',
  '/api/eodhd/fetch-fundamentals',
  '/api/eodhd/update-prices',
], (req, res, next) => {
  if (!WEBHOOK_SECRET) return next();          // dev mode — secret not configured
  if (isLoopback(req)) return next();          // scheduler / internal calls
  const supplied = req.headers['x-webhook-secret'];
  if (!safeEq(String(supplied || ''), WEBHOOK_SECRET)) {
    return res.status(401).json({
      error: 'Unauthorized — enter your Webhook Secret in app Settings → API Server',
    });
  }
  next();
});

// JSON body parser — large payloads for 4000-stock score batches
app.use(express.json({ limit: '5mb' }));

// ── Simple in-memory rate limiter (no extra package needed) ──────────────────
// Tracks request timestamps per IP; limits to maxReq per windowMs
const _rlMap = new Map();
function makeRateLimit(windowMs, maxReq) {
  return function(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // Skip rate limiting for internal scheduler calls from loopback
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
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

// Config — tells the frontend which API keys are configured server-side
// Never expose the actual key values, only whether they're set
app.get('/api/config', (req, res) => {
  res.json({
    eodhd:   !!process.env.EODHD_KEY,
    finnhub: !!process.env.FINNHUB_KEY,
    fmp:     !!process.env.FMP_KEY,
    twelve:  !!process.env.TWELVE_KEY,
  });
});

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
    // Start scheduled jobs (prod only, requires EODHD_KEY env var)
    if (IS_PROD && process.env.EODHD_KEY) {
      require('./scheduler').init(PORT);
    } else if (IS_PROD) {
      console.log('[scheduler] Skipped — set EODHD_KEY env var on Railway to enable auto-refresh');
    }
  });
}

start();
