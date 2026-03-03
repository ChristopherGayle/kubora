// PostgreSQL migration + initial seed for Railway deployment
// Runs automatically on server startup when DATABASE_URL is set
// Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS + row count check

const db = require('./db-pg');

// ===== 122 CURATED STOCKS =====
const STOCKS = [
  {t:"AAPL",n:"Apple Inc.",s:"Technology",p:232.5,mc:3520,r:"US",co:"🇺🇸"},
  {t:"MSFT",n:"Microsoft Corp.",s:"Technology",p:445.2,mc:3310,r:"US",co:"🇺🇸"},
  {t:"GOOGL",n:"Alphabet Inc.",s:"Technology",p:178.9,mc:2210,r:"US",co:"🇺🇸"},
  {t:"AMZN",n:"Amazon.com Inc.",s:"Technology",p:213.4,mc:2200,r:"US",co:"🇺🇸"},
  {t:"NVDA",n:"NVIDIA Corp.",s:"Technology",p:138.5,mc:3380,r:"US",co:"🇺🇸"},
  {t:"AVGO",n:"Broadcom Inc.",s:"Technology",p:224.6,mc:1050,r:"US",co:"🇺🇸"},
  {t:"JNJ",n:"Johnson & Johnson",s:"Healthcare",p:162.8,mc:392,r:"US",co:"🇺🇸"},
  {t:"UNH",n:"UnitedHealth Group",s:"Healthcare",p:534.2,mc:492,r:"US",co:"🇺🇸"},
  {t:"LLY",n:"Eli Lilly & Co.",s:"Healthcare",p:812.4,mc:770,r:"US",co:"🇺🇸"},
  {t:"JPM",n:"JPMorgan Chase",s:"Finance",p:242.1,mc:696,r:"US",co:"🇺🇸"},
  {t:"BRK.B",n:"Berkshire Hathaway",s:"Finance",p:478.3,mc:980,r:"US",co:"🇺🇸"},
  {t:"V",n:"Visa Inc.",s:"Finance",p:335.2,mc:580,r:"US",co:"🇺🇸"},
  {t:"XOM",n:"Exxon Mobil",s:"Energy",p:108.7,mc:460,r:"US",co:"🇺🇸"},
  {t:"HD",n:"Home Depot",s:"Consumer",p:412.3,mc:410,r:"US",co:"🇺🇸"},
  {t:"PG",n:"Procter & Gamble",s:"Consumer",p:168.5,mc:397,r:"US",co:"🇺🇸"},
  {t:"WMT",n:"Walmart Inc.",s:"Consumer",p:98.7,mc:790,r:"US",co:"🇺🇸"},
  {t:"CAT",n:"Caterpillar Inc.",s:"Industrial",p:362.8,mc:176,r:"US",co:"🇺🇸"},
  {t:"NEE",n:"NextEra Energy",s:"Utilities",p:76.8,mc:158,r:"US",co:"🇺🇸"},
  {t:"AMT",n:"American Tower",s:"Real Estate",p:202.4,mc:95,r:"US",co:"🇺🇸"},
  {t:"T",n:"AT&T Inc.",s:"Telecom",p:28.4,mc:203,r:"US",co:"🇺🇸"},
  {t:"META",n:"Meta Platforms",s:"Technology",p:585,mc:1480,r:"US",co:"🇺🇸"},
  {t:"TSLA",n:"Tesla Inc.",s:"Technology",p:340,mc:1090,r:"US",co:"🇺🇸"},
  {t:"MA",n:"Mastercard Inc.",s:"Finance",p:530,mc:490,r:"US",co:"🇺🇸"},
  {t:"COST",n:"Costco Wholesale",s:"Consumer",p:920,mc:410,r:"US",co:"🇺🇸"},
  {t:"NFLX",n:"Netflix Inc.",s:"Technology",p:950,mc:410,r:"US",co:"🇺🇸"},
  {t:"CRM",n:"Salesforce Inc.",s:"Technology",p:330,mc:320,r:"US",co:"🇺🇸"},
  {t:"AMD",n:"Advanced Micro Devices",s:"Technology",p:165,mc:267,r:"US",co:"🇺🇸"},
  {t:"INTC",n:"Intel Corp.",s:"Technology",p:24,mc:103,r:"US",co:"🇺🇸"},
  {t:"PEP",n:"PepsiCo Inc.",s:"Consumer",p:152,mc:209,r:"US",co:"🇺🇸"},
  {t:"KO",n:"Coca-Cola Co.",s:"Consumer",p:62,mc:268,r:"US",co:"🇺🇸"},
  {t:"MRK",n:"Merck & Co.",s:"Healthcare",p:102,mc:258,r:"US",co:"🇺🇸"},
  {t:"ABBV",n:"AbbVie Inc.",s:"Healthcare",p:192,mc:340,r:"US",co:"🇺🇸"},
  {t:"TMO",n:"Thermo Fisher Scientific",s:"Healthcare",p:580,mc:222,r:"US",co:"🇺🇸"},
  {t:"ORCL",n:"Oracle Corp.",s:"Technology",p:175,mc:485,r:"US",co:"🇺🇸"},
  {t:"CSCO",n:"Cisco Systems",s:"Technology",p:58,mc:237,r:"US",co:"🇺🇸"},
  {t:"DIS",n:"Walt Disney Co.",s:"Consumer",p:112,mc:204,r:"US",co:"🇺🇸"},
  {t:"ADBE",n:"Adobe Inc.",s:"Technology",p:470,mc:208,r:"US",co:"🇺🇸"},
  {t:"BA",n:"Boeing Co.",s:"Industrial",p:178,mc:128,r:"US",co:"🇺🇸"},
  {t:"GS",n:"Goldman Sachs",s:"Finance",p:585,mc:195,r:"US",co:"🇺🇸"},
  {t:"CVX",n:"Chevron Corp.",s:"Energy",p:158,mc:290,r:"US",co:"🇺🇸"},
  {t:"COP",n:"ConocoPhillips",s:"Energy",p:108,mc:132,r:"US",co:"🇺🇸"},
  {t:"LIN",n:"Linde plc",s:"Materials",p:465,mc:224,r:"US",co:"🇺🇸"},
  {t:"GE",n:"GE Aerospace",s:"Industrial",p:195,mc:212,r:"US",co:"🇺🇸"},
  {t:"BLK",n:"BlackRock Inc.",s:"Finance",p:950,mc:145,r:"US",co:"🇺🇸"},
  // EUROPE
  {t:"ASML",n:"ASML Holding NV",s:"Technology",p:725.4,mc:295,r:"Europe",co:"🇳🇱"},
  {t:"SAP",n:"SAP SE",s:"Technology",p:242.8,mc:298,r:"Europe",co:"🇩🇪"},
  {t:"NOVO-B",n:"Novo Nordisk A/S",s:"Healthcare",p:685.3,mc:580,r:"Europe",co:"🇩🇰"},
  {t:"ROG",n:"Roche Holding AG",s:"Healthcare",p:278.6,mc:230,r:"Europe",co:"🇨🇭"},
  {t:"AZN",n:"AstraZeneca plc",s:"Healthcare",p:128.4,mc:198,r:"Europe",co:"🇬🇧"},
  {t:"NESN",n:"Nestlé SA",s:"Consumer",p:89.5,mc:248,r:"Europe",co:"🇨🇭"},
  {t:"MC",n:"LVMH Moët Hennessy",s:"Consumer",p:712.3,mc:358,r:"Europe",co:"🇫🇷"},
  {t:"SHEL",n:"Shell plc",s:"Energy",p:32.8,mc:210,r:"Europe",co:"🇬🇧"},
  {t:"TTE",n:"TotalEnergies SE",s:"Energy",p:58.7,mc:148,r:"Europe",co:"🇫🇷"},
  {t:"SIE",n:"Siemens AG",s:"Industrial",p:198.4,mc:158,r:"Europe",co:"🇩🇪"},
  {t:"HSBA",n:"HSBC Holdings plc",s:"Finance",p:8.92,mc:168,r:"Europe",co:"🇬🇧"},
  {t:"UBS",n:"UBS Group AG",s:"Finance",p:31.2,mc:98,r:"Europe",co:"🇨🇭"},
  {t:"OR",n:"L'Oréal SA",s:"Consumer",p:378.5,mc:198,r:"Europe",co:"🇫🇷"},
  {t:"BAYN",n:"Bayer AG",s:"Healthcare",p:28.4,mc:29,r:"Europe",co:"🇩🇪"},
  {t:"DTE",n:"Deutsche Telekom AG",s:"Telecom",p:28.9,mc:144,r:"Europe",co:"🇩🇪"},
  {t:"ENEL",n:"Enel SpA",s:"Utilities",p:6.82,mc:70,r:"Europe",co:"🇮🇹"},
  {t:"ABB",n:"ABB Ltd",s:"Industrial",p:52.4,mc:98,r:"Europe",co:"🇨🇭"},
  {t:"VOW3",n:"Volkswagen AG",s:"Consumer",p:98.7,mc:52,r:"Europe",co:"🇩🇪"},
  {t:"SU.PA",n:"Schneider Electric SE",s:"Industrial",p:245,mc:142,r:"Europe",co:"🇫🇷"},
  {t:"AIR.PA",n:"Airbus SE",s:"Industrial",p:155,mc:122,r:"Europe",co:"🇫🇷"},
  {t:"RMS.PA",n:"Hermès International",s:"Consumer",p:2350,mc:248,r:"Europe",co:"🇫🇷"},
  {t:"RACE",n:"Ferrari NV",s:"Consumer",p:425,mc:108,r:"Europe",co:"🇮🇹"},
  {t:"ALV.DE",n:"Allianz SE",s:"Finance",p:295,mc:122,r:"Europe",co:"🇩🇪"},
  {t:"BNP.PA",n:"BNP Paribas SA",s:"Finance",p:68,mc:82,r:"Europe",co:"🇫🇷"},
  {t:"UL",n:"Unilever plc",s:"Consumer",p:56,mc:148,r:"Europe",co:"🇬🇧"},
  {t:"DGE.L",n:"Diageo plc",s:"Consumer",p:24,mc:58,r:"Europe",co:"🇬🇧"},
  {t:"SPOT",n:"Spotify Technology",s:"Technology",p:580,mc:115,r:"Europe",co:"🇸🇪"},
  {t:"IBE.MC",n:"Iberdrola SA",s:"Utilities",p:14,mc:90,r:"Europe",co:"🇪🇸"},
  // ASIA
  {t:"TSM",n:"Taiwan Semiconductor",s:"Technology",p:185.6,mc:960,r:"Asia",co:"🇹🇼"},
  {t:"9984",n:"SoftBank Group",s:"Technology",p:8450,mc:118,r:"Asia",co:"🇯🇵"},
  {t:"005930",n:"Samsung Electronics",s:"Technology",p:58200,mc:348,r:"Asia",co:"🇰🇷"},
  {t:"7203",n:"Toyota Motor Corp.",s:"Consumer",p:2685,mc:285,r:"Asia",co:"🇯🇵"},
  {t:"9988",n:"Alibaba Group",s:"Technology",p:108.4,mc:268,r:"Asia",co:"🇨🇳"},
  {t:"0700",n:"Tencent Holdings",s:"Technology",p:428.6,mc:412,r:"Asia",co:"🇨🇳"},
  {t:"RELIANCE",n:"Reliance Industries",s:"Energy",p:2485,mc:212,r:"Asia",co:"🇮🇳"},
  {t:"TCS",n:"Tata Consultancy",s:"Technology",p:4128,mc:152,r:"Asia",co:"🇮🇳"},
  {t:"6758",n:"Sony Group Corp.",s:"Technology",p:3245,mc:198,r:"Asia",co:"🇯🇵"},
  {t:"1398",n:"ICBC",s:"Finance",p:5.82,mc:268,r:"Asia",co:"🇨🇳"},
  {t:"7267",n:"Honda Motor Co.",s:"Consumer",p:1542,mc:82,r:"Asia",co:"🇯🇵"},
  {t:"INFY",n:"Infosys Ltd",s:"Technology",p:1845,mc:78,r:"Asia",co:"🇮🇳"},
  {t:"2317",n:"Hon Hai Precision",s:"Technology",p:178.5,mc:82,r:"Asia",co:"🇹🇼"},
  {t:"6861",n:"Keyence Corp.",s:"Industrial",p:68450,mc:165,r:"Asia",co:"🇯🇵"},
  {t:"BABA",n:"Alibaba (US ADR)",s:"Technology",p:108.4,mc:268,r:"Asia",co:"🇨🇳"},
  {t:"035420",n:"Naver Corp.",s:"Technology",p:218500,mc:36,r:"Asia",co:"🇰🇷"},
  {t:"9433",n:"KDDI Corp.",s:"Telecom",p:4825,mc:108,r:"Asia",co:"🇯🇵"},
  {t:"4503",n:"Astellas Pharma",s:"Healthcare",p:1685,mc:32,r:"Asia",co:"🇯🇵"},
  {t:"SE",n:"Sea Ltd",s:"Technology",p:118,mc:68,r:"Asia",co:"🇸🇬"},
  {t:"JD",n:"JD.com Inc.",s:"Technology",p:38,mc:60,r:"Asia",co:"🇨🇳"},
  {t:"PDD",n:"PDD Holdings",s:"Technology",p:108,mc:148,r:"Asia",co:"🇨🇳"},
  {t:"BYDDY",n:"BYD Co. Ltd",s:"Consumer",p:72,mc:108,r:"Asia",co:"🇨🇳"},
  {t:"HDB",n:"HDFC Bank Ltd",s:"Finance",p:68,mc:172,r:"Asia",co:"🇮🇳"},
  {t:"IBN",n:"ICICI Bank Ltd",s:"Finance",p:30,mc:105,r:"Asia",co:"🇮🇳"},
  {t:"3690",n:"Meituan",s:"Technology",p:168,mc:105,r:"Asia",co:"🇨🇳"},
  {t:"2454",n:"MediaTek Inc.",s:"Technology",p:42,mc:68,r:"Asia",co:"🇹🇼"},
  {t:"BHP",n:"BHP Group Ltd",s:"Materials",p:58,mc:152,r:"Asia",co:"🇦🇺"},
  {t:"CBA",n:"Commonwealth Bank",s:"Finance",p:98,mc:138,r:"Asia",co:"🇦🇺"},
  {t:"CSLLY",n:"CSL Ltd",s:"Healthcare",p:215,mc:122,r:"Asia",co:"🇦🇺"},
  // SOUTH AMERICA
  {t:"VALE",n:"Vale SA",s:"Materials",p:11.8,mc:48,r:"S. America",co:"🇧🇷"},
  {t:"PBR",n:"Petrobras SA",s:"Energy",p:14.2,mc:92,r:"S. America",co:"🇧🇷"},
  {t:"NU",n:"Nu Holdings Ltd",s:"Finance",p:14.8,mc:72,r:"S. America",co:"🇧🇷"},
  {t:"ITUB",n:"Itaú Unibanco",s:"Finance",p:6.42,mc:62,r:"S. America",co:"🇧🇷"},
  {t:"ABEV",n:"Ambev SA",s:"Consumer",p:2.48,mc:38,r:"S. America",co:"🇧🇷"},
  {t:"SQM",n:"Soc. Química y Minera",s:"Materials",p:42.8,mc:12,r:"S. America",co:"🇨🇱"},
  {t:"BSBR",n:"Banco Santander Brasil",s:"Finance",p:5.62,mc:28,r:"S. America",co:"🇧🇷"},
  {t:"EC",n:"Ecopetrol SA",s:"Energy",p:9.85,mc:20,r:"S. America",co:"🇨🇴"},
  {t:"GGAL",n:"Grupo Financiero Galicia",s:"Finance",p:58.4,mc:12,r:"S. America",co:"🇦🇷"},
  {t:"CRPG",n:"Corp. Grupo Cementos",s:"Materials",p:6.28,mc:8,r:"S. America",co:"🇲🇽"},
  {t:"MELI",n:"MercadoLibre Inc.",s:"Technology",p:1850,mc:94,r:"S. America",co:"🇦🇷"},
  // AFRICA
  {t:"NPN",n:"Naspers Ltd",s:"Technology",p:3845,mc:42,r:"Africa",co:"🇿🇦"},
  {t:"BTI",n:"British American Tobacco",s:"Consumer",p:34.8,mc:78,r:"Africa",co:"🇿🇦"},
  {t:"AGL",n:"Anglo American plc",s:"Materials",p:28.4,mc:38,r:"Africa",co:"🇿🇦"},
  {t:"SOL",n:"Sasol Ltd",s:"Energy",p:82.4,mc:8,r:"Africa",co:"🇿🇦"},
  {t:"SBK",n:"Standard Bank Group",s:"Finance",p:178.5,mc:22,r:"Africa",co:"🇿🇦"},
  {t:"FSR",n:"FirstRand Ltd",s:"Finance",p:68.2,mc:18,r:"Africa",co:"🇿🇦"},
  {t:"MTN",n:"MTN Group Ltd",s:"Telecom",p:98.4,mc:16,r:"Africa",co:"🇿🇦"},
  {t:"DANGCEM",n:"Dangote Cement plc",s:"Materials",p:285,mc:12,r:"Africa",co:"🇳🇬"},
  {t:"SBUX",n:"Safaricom plc",s:"Telecom",p:28.5,mc:11,r:"Africa",co:"🇰🇪"},
  {t:"EGH",n:"Ecobank Ghana Ltd",s:"Finance",p:8.45,mc:2,r:"Africa",co:"🇬🇭"}
];

const PICKS = [
  {t:"MSFT",n:"Microsoft Corp.",co:"🇺🇸",date:"2025-09-15",entry:398.2,curr:445.2},
  {t:"NOVO-B",n:"Novo Nordisk A/S",co:"🇩🇰",date:"2025-08-10",entry:620.4,curr:685.3},
  {t:"TSM",n:"Taiwan Semiconductor",co:"🇹🇼",date:"2025-07-20",entry:162.8,curr:185.6},
  {t:"JPM",n:"JPMorgan Chase",co:"🇺🇸",date:"2025-08-20",entry:218.7,curr:242.1},
  {t:"VALE",n:"Vale SA",co:"🇧🇷",date:"2025-10-05",entry:13.4,curr:11.8},
  {t:"NPN",n:"Naspers Ltd",co:"🇿🇦",date:"2025-06-15",entry:3420,curr:3845}
];

async function migrate() {
  console.log('[migrate] Running PostgreSQL migrations...');

  // Create tables
  const tables = [
    `CREATE TABLE IF NOT EXISTS prism_stock_universe (
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ticker VARCHAR(20) NOT NULL,
      name VARCHAR(200),
      sector VARCHAR(50),
      region VARCHAR(50),
      country_flag VARCHAR(10),
      price DOUBLE PRECISION DEFAULT 0,
      market_cap_bn DOUBLE PRECISION DEFAULT 0,
      active BOOLEAN DEFAULT true
    )`,
    `CREATE INDEX IF NOT EXISTS idx_universe_ticker ON prism_stock_universe(ticker, ts DESC)`,

    `CREATE TABLE IF NOT EXISTS prism_scores (
      ticker VARCHAR(20) NOT NULL,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ey DOUBLE PRECISION, roic DOUBLE PRECISION, ev_ebit DOUBLE PRECISION,
      pb DOUBLE PRECISION, div_yield DOUBLE PRECISION, fcf_yield DOUBLE PRECISION,
      shareholder_yield DOUBLE PRECISION, moat DOUBLE PRECISION, quality DOUBLE PRECISION,
      momentum DOUBLE PRECISION, rsi DOUBLE PRECISION, short_interest DOUBLE PRECISION,
      fscore DOUBLE PRECISION, altman_z DOUBLE PRECISION,
      composite_score DOUBLE PRECISION, consensus_count INTEGER, data_source VARCHAR(50)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_scores_ticker ON prism_scores(ticker, ts DESC)`,

    `CREATE TABLE IF NOT EXISTS prism_prior_picks (
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ticker VARCHAR(20) NOT NULL,
      name VARCHAR(200),
      country_flag VARCHAR(10),
      entry_date VARCHAR(20),
      entry_price DOUBLE PRECISION,
      current_price DOUBLE PRECISION,
      action VARCHAR(20),
      removed BOOLEAN DEFAULT false
    )`,
    `CREATE INDEX IF NOT EXISTS idx_picks_ticker ON prism_prior_picks(ticker, ts DESC)`,

    `CREATE TABLE IF NOT EXISTS prism_market_valuation (
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      region VARCHAR(50) NOT NULL,
      cape DOUBLE PRECISION, earnings_yield DOUBLE PRECISION,
      risk_free_rate DOUBLE PRECISION, erp DOUBLE PRECISION,
      buffett_indicator DOUBLE PRECISION, etf_price DOUBLE PRECISION,
      etf_symbol VARCHAR(20), consensus VARCHAR(20),
      cape_signal VARCHAR(20), buffett_signal VARCHAR(20), erp_signal VARCHAR(20)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_valuation_region ON prism_market_valuation(region, ts DESC)`
  ];

  for (const ddl of tables) {
    const result = await db.exec(ddl);
    if (!result.ok) console.error('[migrate] DDL error:', result.error);
  }
  console.log('[migrate] Tables ready');

  // Seed stocks if empty
  const stockCount = await db.query('SELECT COUNT(*) as cnt FROM prism_stock_universe');
  if (stockCount.ok && parseInt(stockCount.rows[0].cnt) === 0) {
    console.log('[migrate] Seeding ' + STOCKS.length + ' stocks...');
    for (let i = 0; i < STOCKS.length; i += 30) {
      const chunk = STOCKS.slice(i, i + 30);
      const values = chunk.map((s, j) => {
        const base = i * 9 + j * 9;
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},true)`;
      });
      // Use simple string insert for emoji safety
      const rows = chunk.map(s =>
        `(NOW(),'${s.t.replace(/'/g,"''")}','${s.n.replace(/'/g,"''")}','${s.s}','${s.r}','${s.co}',${s.p},${s.mc},true)`
      ).join(',');
      await db.exec(
        `INSERT INTO prism_stock_universe (ts,ticker,name,sector,region,country_flag,price,market_cap_bn,active) VALUES ${rows}`
      );
    }
    console.log('[migrate] Stocks seeded');
  } else {
    console.log('[migrate] Stocks already seeded (' + (stockCount.rows[0]?.cnt || '?') + ' rows)');
  }

  // Seed picks if empty
  const pickCount = await db.query('SELECT COUNT(*) as cnt FROM prism_prior_picks');
  if (pickCount.ok && parseInt(pickCount.rows[0].cnt) === 0) {
    const rows = PICKS.map(p =>
      `(NOW(),'${p.t}','${p.n.replace(/'/g,"''")}','${p.co}','${p.date}',${p.entry},${p.curr},NULL,false)`
    ).join(',');
    await db.exec(
      `INSERT INTO prism_prior_picks (ts,ticker,name,country_flag,entry_date,entry_price,current_price,action,removed) VALUES ${rows}`
    );
    console.log('[migrate] Picks seeded');
  }

  console.log('[migrate] Done');
}

module.exports = migrate;

// Run directly: node migrate.js
if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
