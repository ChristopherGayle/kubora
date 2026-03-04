# Mexxie Prism — Technical Architecture & Data Flow Document
### Version 2.0 | March 2026

---

## 1. System Overview

Mexxie Prism is a multi-layer, multi-tenant stock intelligence platform combining a Progressive Web App (PWA) frontend with an optional Express.js API backend and dual database support (QuestDB locally, PostgreSQL on Railway cloud).

```
┌─────────────────────────────────────────────────────────────────┐
│                      INTERNET / PUBLIC                          │
│                                                                 │
│  ┌───────────────────┐        ┌──────────────────────────────┐  │
│  │  GitHub Pages     │        │  External Market Data APIs   │  │
│  │  (Static PWA)     │◄──────►│  • EODHD  (bulk EOD prices) │  │
│  │                   │        │  • Finnhub (real-time quotes)│  │
│  │  mexxie_prism.html│        │  • FMP    (fundamentals)     │  │
│  │  Port: 443 HTTPS  │        │  • STOOQ  (CAPE/valuation)  │  │
│  └────────┬──────────┘        └──────────────────────────────┘  │
│           │ REST API calls                                       │
│           ▼                                                      │
│  ┌───────────────────┐                                          │
│  │  Railway Cloud    │                                          │
│  │  Express API      │                                          │
│  │  Port: 8080       │                                          │
│  │  (kubora app)     │                                          │
│  └────────┬──────────┘                                          │
│           │ pg client                                            │
│           ▼                                                      │
│  ┌───────────────────┐                                          │
│  │  Railway          │                                          │
│  │  PostgreSQL       │                                          │
│  │  (persistent)     │                                          │
│  └───────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      DEVELOPER'S LAPTOP                         │
│                                                                 │
│  ┌───────────────────┐     ┌──────────────────────────────┐    │
│  │  Local Dev        │     │  QuestDB                     │    │
│  │  Express API      │────►│  Port: 9000 (HTTP/REST)      │    │
│  │  Port: 3001       │     │  Port: 8812 (Postgres wire)  │    │
│  │                   │     │  • stocks (2,209 rows)       │    │
│  └───────────────────┘     │  • daily_prices (2.7M rows)  │    │
│                            │  • factor_scores (45K rows)  │    │
│  ┌───────────────────┐     │  • prism_stock_universe      │    │
│  │  EODHD ETL        │────►│  • prism_scores              │    │
│  │  Pipeline         │     │  • prism_prior_picks         │    │
│  └───────────────────┘     │  • prism_market_valuation    │    │
│                            └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture

### 2.1 Frontend — `mexxie_prism.html`

| Aspect | Detail |
|--------|--------|
| **Type** | Single-Page Application (SPA), no framework |
| **Language** | Vanilla JavaScript (ES6 async/await) |
| **Size** | ~4,000 lines in a single HTML file |
| **Hosting** | GitHub Pages (static CDN) |
| **PWA** | Yes — `manifest.json`, `sw.js` service worker, installable |
| **Fonts** | Google Fonts: DM Sans, JetBrains Mono, Playfair Display |
| **State** | Module-level `S` object, persisted to `localStorage` |
| **Themes** | 8 built-in colour themes (defined in `THEMES` object) |

**Internal modules (all inline):**
```
mexxie_prism.html
├── THEMES          — 8 colour/typography presets
├── API_BASE        — auto-detects localhost vs Railway URL
├── Stock Data      — 122 curated fallback stocks + ETFs
├── Scoring Engine  — genSc(), comp(), nW()
├── Data Fetchers   — fetchEODHDLive(), fetchFinnhubLive(), fetchFMPLive()
├── Market Valuation— fetchMarketValuation(), fetchRegionValuation()
├── Rendering       — render(), renderScreener(), renderCard(), renderETFs()
├── Prior Picks     — renderPriorPicks(), persistPick()
├── Strategies      — renderStrategies(), renderWeights()
└── Settings        — renderSettings(), API key management
```

### 2.2 Backend API — `mexxie-api/`

```
mexxie-api/
├── server.js          Entry point: Express, CORS, routes, health endpoint
├── db.js              Router: selects QuestDB (local) or PostgreSQL (cloud)
├── db-pg.js           PostgreSQL client (node-postgres / pg)
├── migrate.js         Table creation DDL + seeding 122 curated stocks
├── seed.js            One-time bootstrapper for QuestDB tables
├── routes/
│   ├── stocks.js      GET/POST stock universe, POST reset
│   ├── scores.js      POST score snapshots, GET latest/history
│   ├── picks.js       CRUD prior picks
│   └── valuation.js   GET/POST market valuation data
└── scripts/
    ├── sync-to-cloud.js     QuestDB → Railway PostgreSQL bulk sync
    └── reset-cloud-stocks.js Truncate + re-seed Railway PostgreSQL
```

| Aspect | Local | Cloud (Railway) |
|--------|-------|-----------------|
| **Runtime** | Node.js 20 | Node.js 20 (Railpack) |
| **Port** | 3001 | 8080 (injected by Railway) |
| **Database** | QuestDB at localhost:9000 | PostgreSQL (DATABASE_URL env var) |
| **CORS** | Restricted (localhost only) | Open (`origin: '*'`) |
| **SSL** | No | Yes (`rejectUnauthorized: false`) |
| **Detection** | `RAILWAY_ENVIRONMENT` env absent | `RAILWAY_ENVIRONMENT` env present |

### 2.3 Database — QuestDB (Local)

| Table | Rows (approx.) | Purpose |
|-------|---------------|---------|
| `stocks` | 2,209 | Stock universe from ETL pipeline |
| `daily_prices` | 2,734,594 | OHLCV price history |
| `factor_scores` | 45,218 | Pre-computed 11-factor scores |
| `portfolio_actions` | ~8 | Historical portfolio trades |
| `prism_stock_universe` | varies | Prism-specific stock definitions |
| `prism_scores` | grows over time | Score snapshots (time-series) |
| `prism_prior_picks` | varies | User's tracked picks |
| `prism_market_valuation` | grows over time | Regional market valuation data |

### 2.4 Database — PostgreSQL (Railway Cloud)

| Table | Purpose |
|-------|---------|
| `prism_stock_universe` | Synced from QuestDB via `sync-to-cloud.js` |
| `prism_scores` | Score snapshots persisted from browser |
| `prism_prior_picks` | User's tracked picks |
| `prism_market_valuation` | Regional market valuation data |

---

## 3. Data Flow Diagrams

### 3.1 Application Startup Sequence

```
Browser loads mexxie_prism.html
        │
        ├── 1. Read localStorage (theme, weights, API keys, Railway URL)
        │
        ├── 2. checkAPI()  ──→ GET /api/health (3s timeout)
        │        │
        │        ├── Success → API_AVAILABLE = true
        │        │       │
        │        │       ├── loadStockUniverse()  GET /api/stocks?limit=5000
        │        │       └── loadPriorPicks()     GET /api/picks
        │        │
        │        └── Fail → API_AVAILABLE = false
        │                   Use hardcoded FALLBACK_STOCKS (122 stocks)
        │                   Use localStorage prior picks
        │
        └── 3. render()  →  renderScreener() with available data
```

### 3.2 Live Refresh (EODHD Path)

```
User clicks ⚡ Live Refresh
        │
        ├── Validate API key exists in localStorage
        │
        ├── Group ALL_STOCKS by region (US, Europe, Asia, S.America, Africa)
        │
        ├── EODHD Bulk Fetch (parallel per region):
        │     GET https://eodhd.com/api/eod-bulk-last-day/US?api_token=XXX
        │     GET https://eodhd.com/api/eod-bulk-last-day/LSE?...  (Europe)
        │     GET https://eodhd.com/api/eod-bulk-last-day/TSE?...  (Asia)
        │     GET https://eodhd.com/api/eod-bulk-last-day/SA?...   (S.America)
        │     GET https://eodhd.com/api/eod-bulk-last-day/JSE?...  (Africa)
        │
        ├── For each stock: enrich with EODHD data
        │     - close price, volume, EMA50, EMA200
        │     - momentum (% above/below EMA200)
        │     - 52-week range position
        │     - beta, P/E, P/B, dividend yield, FCF yield
        │
        ├── fetchMarketValuation()  (parallel with stock fetch)
        │     - STOOQ/Yahoo Finance: 10Y Treasury yield (risk-free rate)
        │     - STOOQ/Yahoo Finance: S&P 500 CAPE proxy
        │     - EODHD: VTI, VEA, VWO, EZA, EWZ ETF prices
        │     - Compute: ERP, Buffett Indicator proxy, Consensus
        │
        ├── render()  →  updated scores based on live data
        │
        └── persistScores()  →  POST /api/scores (live stocks only)
```

### 3.3 Score Calculation Flow

```
For each stock:
        │
        ├── genSc(idx)  →  generate base factors using deterministic seed
        │     - Seed: S.dataSeed (changes each Simulate/Refresh)
        │     - Uses Math.sin() hash for reproducible pseudo-random values
        │     - Returns: {g: greenblatt, t: tweedy, m: munger, s: simons, p: piotroski, a: altman}
        │
        ├── If stock.live exists (real API data):
        │     - Override: P/B, dividend yield, ROE→ROIC, P/E→EY
        │     - Override: momentum from EODHD EMA200 divergence
        │     - Override: RSI proxy from 52-week range position
        │
        ├── comp(sc, normalizedWeights)
        │     - Greenblatt score: EY/25*35 + ROIC/48*35 + Rank*20 + EV/EBIT*10
        │     - Tweedy score:     P/B*20 + InsiderBuy*20 + DivY*20 + FCF*20 + ShY*20
        │     - Munger score:     Moat*35 + Quality*30 + Mgmt*20 + RevQ*15
        │     - Simons score:     Momentum*30 + MeanRev*20 + Sentiment*20 + RSI*30
        │     - Piotroski:        F-Score/9
        │     - Altman Z:         (Z-1.0)/4.0, capped at 0.2 if distress
        │     - Druckenmiller:    RevGrowth*30 + Momentum*25 + Quality*25 + Entry*15 + Beta*5
        │     - Weighted average by strategy weights → 0–100
        │
        ├── Consensus bonus: count factors passing threshold
        │     - Each category: +1 if threshold met
        │     - Bonus: (count-2) * 1.5, capped at 100
        │
        └── Apply sector diversity penalty (top-N selection)
```

### 3.4 Data Sync Flow (QuestDB → Railway)

```
Developer laptop:
        │
        ├── node mexxie-api/scripts/sync-to-cloud.js
        │
        ├── Query QuestDB:
        │     SELECT s.symbol, s.name, s.sector, s.region, dp.close
        │     FROM stocks JOIN daily_prices
        │     WHERE close > 0.5 AND region IN (US, Europe, Asia...)
        │     LIMIT 25,000
        │
        ├── Transform: normalize regions, map sectors, compute flag emoji
        │
        ├── POST to Railway in batches of 200:
        │     POST https://kubora-production.up.railway.app/api/stocks
        │     Body: { stocks: [{t, n, s, r, co, p, mc}, ...] }
        │
        └── Verify: GET /api/stocks/count → breakdown by region
```

---

## 4. API Endpoints Reference

### 4.1 Express API (`mexxie-api/server.js`)

**Base URL (local):** `http://localhost:3001/api`
**Base URL (cloud):** `https://kubora-production.up.railway.app/api`

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|-------------|
| GET | `/health` | DB connectivity + version | — |
| GET | `/stocks` | List stock universe | `region`, `sector`, `limit` |
| POST | `/stocks` | Add/update stocks | Body: `{stocks: [...]}` |
| GET | `/stocks/count` | Count by region | — |
| POST | `/stocks/reset` | Truncate + re-seed (PostgreSQL only) | — |
| POST | `/scores` | Save score snapshots | Body: `{scores: [...], dataSource}` |
| GET | `/scores/latest` | Latest scores per ticker | `region`, `sector`, `limit` |
| GET | `/scores/history/:ticker` | Score time-series | `days` (default: 90) |
| GET | `/picks` | List prior picks | — |
| POST | `/picks` | Add a pick | Body: pick object |
| PUT | `/picks/:ticker` | Update pick action/price | Body: `{action, curr}` |
| DELETE | `/picks/:ticker` | Remove a pick | — |
| GET | `/valuation` | Latest market valuation | `region` |
| POST | `/valuation` | Save valuation snapshot | Body: valuation object |

### 4.2 External APIs Used

| Provider | Used For | Rate Limit (Free) | Key Storage |
|----------|----------|-------------------|-------------|
| **EODHD** | Bulk EOD prices, EMA, fundamentals | 20 calls/day | localStorage |
| **Finnhub** | Real-time quotes, P/E, P/B, beta | 60 calls/min | localStorage |
| **FMP** | Fundamentals fallback (P/E, FCF) | 250 calls/day | localStorage |
| **STOOQ** | CAPE ratio proxy data | None (public) | None |
| **Yahoo Finance** | TLT price (risk-free rate proxy) | None (public) | None |

---

## 5. Database Schema

### 5.1 `prism_stock_universe`
```sql
CREATE TABLE prism_stock_universe (
  ticker        SYMBOL   capacity 8192,
  name          STRING,
  sector        SYMBOL   capacity 64,
  region        SYMBOL   capacity 16,
  country_flag  STRING,
  price         DOUBLE,
  market_cap_bn DOUBLE,
  active        BOOLEAN,
  ts            TIMESTAMP
) timestamp(ts) PARTITION BY MONTH;
```

### 5.2 `prism_scores`
```sql
CREATE TABLE prism_scores (
  ticker             SYMBOL   capacity 8192,
  ts                 TIMESTAMP,
  ey                 DOUBLE,   -- Earnings Yield %
  roic               DOUBLE,   -- Return on Invested Capital %
  ev_ebit            DOUBLE,   -- EV/EBIT multiple
  pb                 DOUBLE,   -- Price-to-Book ratio
  div_yield          DOUBLE,   -- Dividend Yield %
  fcf_yield          DOUBLE,   -- Free Cash Flow Yield %
  shareholder_yield  DOUBLE,   -- Total Shareholder Yield %
  moat               INT,      -- Economic moat 1-5
  quality            DOUBLE,   -- Business quality 0-100
  momentum           DOUBLE,   -- Price momentum 0-100
  rsi                DOUBLE,   -- RSI 0-100
  short_interest     DOUBLE,   -- Short interest % of float
  fscore             INT,      -- Piotroski F-Score 0-9
  altman_z           DOUBLE,   -- Altman Z-Score
  composite_score    DOUBLE,   -- Weighted composite 0-100
  consensus_count    INT,      -- Strategies where threshold met
  data_source        STRING    -- 'EODHD'/'Finnhub'/'Simulated'
) timestamp(ts) PARTITION BY MONTH;
```

### 5.3 `prism_prior_picks`
```sql
CREATE TABLE prism_prior_picks (
  ts            TIMESTAMP,
  ticker        SYMBOL   capacity 1024,
  name          STRING,
  country_flag  STRING,
  entry_date    STRING,
  entry_price   DOUBLE,
  current_price DOUBLE,
  action        STRING,   -- 'Hold'/'Buy'/'Sell'/'Watch'
  removed       BOOLEAN
) timestamp(ts) PARTITION BY MONTH;
```

### 5.4 `prism_market_valuation`
```sql
CREATE TABLE prism_market_valuation (
  ts                TIMESTAMP,
  region            SYMBOL  capacity 16,
  cape              DOUBLE,
  earnings_yield    DOUBLE,
  risk_free_rate    DOUBLE,
  erp               DOUBLE,   -- Equity Risk Premium
  buffett_indicator DOUBLE,
  etf_price         DOUBLE,
  consensus         STRING    -- 'Undervalued'/'Neutral'/'Overvalued'
) timestamp(ts) PARTITION BY MONTH;
```

---

## 6. State Management

All application state lives in the `S` object (module-level JavaScript variable):

```javascript
S = {
  theme: 'obsidian',             // Current color theme
  region: 'Worldwide',           // Selected region filter
  sector: 'All',                 // Selected sector filter
  numPicks: 8,                   // TOP N to display
  capSize: 'all',                // Market cap tier filter
  valFilter: null,               // Valuation filter (null/over/neutral/under)
  tab: 'screener',               // Active tab
  dataSeed: 12345,               // Scoring seed (changes on refresh)
  lastRefresh: Date,             // Last refresh timestamp
  lastSource: 'Simulated',       // 'EODHD'/'Finnhub'/'Simulated'
  refreshCount: 0,               // Session refresh counter
  expandedStock: null,           // Which card is expanded
  prior: [],                     // Prior picks array
  weights: { ... },              // Strategy weight sliders (0-100)
  marketVal: null,               // Market valuation object
  apiKeys: { ... },              // { eodhd, finnhub, fmp }
  apiUrl: ''                     // Railway API URL
}
```

**localStorage keys used:**
| Key | Type | Purpose |
|-----|------|---------|
| `mexxie_theme` | string | Active theme name |
| `mexxie_weights` | JSON | Strategy weight sliders |
| `mexxie_prior` | JSON | Prior picks array |
| `mexxie_eodhd_key` | string | EODHD API key |
| `mexxie_finnhub_key` | string | Finnhub API key |
| `mexxie_fmp_key` | string | FMP API key |
| `mexxie_api_url` | string | Railway API base URL |
| `mexxie_cap_size` | string | Cap tier filter (all/mega/large/mid/small/micro) |
| `mexxie_data_seed` | number | Last scoring seed |
| `mexxie_last_source` | string | Last data source label |
| `mexxie_refresh_count` | number | Session refresh count |

---

## 7. Deployment Architecture

### 7.1 Current Production Setup

```
                    ┌──────────────────────┐
                    │   GitHub             │
                    │   Repository         │
                    │   christophergayle/  │
                    │   kubora             │
                    └───┬──────────────────┘
                        │
              ┌─────────┼─────────┐
              │                   │
              ▼                   ▼
  ┌───────────────────┐  ┌──────────────────────┐
  │  GitHub Pages     │  │  Railway.app          │
  │  Static Hosting   │  │  Deployment           │
  │                   │  │                       │
  │  URL: https://    │  │  mexxie-api/ folder   │
  │  christophergayle │  │  Builder: Railpack    │
  │  .github.io/      │  │  Port: 8080           │
  │  kubora/          │  │  Branch: main         │
  │  mexxie_prism.html│  └──────────┬────────────┘
  └───────────────────┘             │
                                    ▼
                         ┌──────────────────────┐
                         │  Railway PostgreSQL   │
                         │  (auto-provisioned)  │
                         │  SSL required        │
                         └──────────────────────┘
```

### 7.2 Environment Variables (Railway)

| Variable | Set By | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | Railway (Postgres reference) | PostgreSQL connection string |
| `RAILWAY_ENVIRONMENT` | Railway (automatic) | Enables production mode |
| `PORT` | Railway (automatic) | Set to 8080 by Railway |

### 7.3 Railway Build Configuration

**`railway.json`:**
```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node mexxie-api/server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

**`nixpacks.toml`:**
```toml
[phases.setup]
nixPkgs = ["nodejs_20"]

[phases.install]
cmds = ["npm --prefix mexxie-api install --production"]

[start]
cmd = "node mexxie-api/server.js"
```

---

## 8. Security Considerations

| Area | Current State | Recommendation |
|------|--------------|----------------|
| **API Keys** | Stored in browser localStorage | Acceptable for personal use; for multi-user, move to server-side proxy |
| **API Auth** | None on Express endpoints | Add `x-api-key` header check in production for sensitive endpoints |
| **SQL Injection** | `db.esc()` used consistently | Parameterized queries preferred (PostgreSQL supports `$1` params) |
| **CORS** | `origin: '*'` in production | Restrict to known GitHub Pages domain for tighter security |
| **Rate Limiting** | None | Add express-rate-limit to prevent abuse of `/api/stocks` POST |
| **HTTPS** | GitHub Pages + Railway both HTTPS | ✅ Good |
| **Secrets in Git** | No secrets committed | ✅ Good — all keys in env vars or localStorage |

---

## 9. Performance Characteristics

| Operation | Typical Duration | Bottleneck |
|-----------|-----------------|-----------|
| App startup (cached) | < 100ms | localStorage reads |
| App startup (API) | 300–800ms | Railway cold start |
| ↻ Simulate | < 50ms | DOM render |
| ⚡ Live Refresh (EODHD, 300 stocks) | 8–30s | EODHD bulk API, 5 batches |
| ⚡ Live Refresh (Finnhub, 300 stocks) | 3–8 min | Finnhub rate limit (60/min) |
| getRanked() scoring | 15–50ms | Math.sin() * 300 iterations |
| persistScores() | 200–800ms | POST to Railway |
| sync-to-cloud.js (3,400 stocks) | 60–120s | Network, 17 batches of 200 |

---

## 10. Known Issues & Technical Debt

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | Array `indexOf()` uses reference equality — fails if stock objects are cloned | High | `getRanked()` in `mexxie_prism.html` |
| 2 | NaN propagation from failed TLT quote in risk-free rate calculation | Medium | `fetchMarketValuation()` |
| 3 | Market valuation blend weights skew when any region API call fails | Medium | `fetchMarketValuation()` blended path |
| 4 | EODHD batch progress counter overcounts (`callCount += 100 + batch.length`) | Low | `fetchEODHDLive()` |
| 5 | Loss-making stocks show simulated EY instead of 0/negative | Low | `persistScores()` live override block |
| 6 | Future-dated prior picks break tax hold duration calculations | Low | `renderPriorPicks()` daysHeld calc |
| 7 | No memoization of `genSc()` — rescored every render | Performance | `getRanked()` |
| 8 | Score consensus bonus creates ranking cliff at 96+ | Low | `getRanked()` bonus section |

---

## 11. Monitoring & Observability

**Current:** Browser console logs only.

**Log events captured:**
- `Loaded N stocks from QuestDB` — successful API stock load
- `API stock load failed, using fallback` — degraded mode active
- `Persisting scores for N/M stocks (live data)` — score persistence
- `Persisted N scores to QuestDB` — confirmation
- Railway deploy logs via Railway dashboard
- QuestDB Web Console at `http://localhost:9000`

**Recommended additions:**
- Structured JSON logging with timestamps
- Railway health check endpoint monitoring (uptime robot)
- Browser `window.onerror` handler to catch uncaught errors

---

## 12. Development Workflow

```
Local Development:
  1. Start QuestDB:   ./questdb.sh start
  2. Start API:       node mexxie-api/server.js
  3. Serve frontend:  python3 -m http.server 8080
  4. Open browser:    http://localhost:8080/mexxie_prism.html

Making Changes:
  1. Create branch:   git checkout -b claude/feature-name
  2. Develop + test
  3. Commit:          git commit -m "feat: description"
  4. Push:            git push origin claude/feature-name
  5. Open PR:         github.com/ChristopherGayle/kubora

Syncing Data:
  1. Local → Cloud:   node mexxie-api/scripts/sync-to-cloud.js
  2. Reset Cloud:     node mexxie-api/scripts/reset-cloud-stocks.js

Railway Deployment:
  - Auto-deploys from main branch on push
  - Build: Railpack (Node.js 20, npm ci)
  - Start: node mexxie-api/server.js
```

---

*Document generated March 2026 | Mexxie Prism v2.0*
