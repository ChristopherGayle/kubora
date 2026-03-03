// Seed script: creates QuestDB tables and inserts initial data
// Run with: node seed.js

const db = require('./db');

// ===== ALL 122 STOCKS FROM MEXXIE PRISM =====
const ALL_STOCKS = [
  {t:"AAPL",n:"Apple Inc.",s:"Technology",p:232.5,mc:3520,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"MSFT",n:"Microsoft Corp.",s:"Technology",p:445.2,mc:3310,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"GOOGL",n:"Alphabet Inc.",s:"Technology",p:178.9,mc:2210,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"AMZN",n:"Amazon.com Inc.",s:"Technology",p:213.4,mc:2200,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"NVDA",n:"NVIDIA Corp.",s:"Technology",p:138.5,mc:3380,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"AVGO",n:"Broadcom Inc.",s:"Technology",p:224.6,mc:1050,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"JNJ",n:"Johnson & Johnson",s:"Healthcare",p:162.8,mc:392,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"UNH",n:"UnitedHealth Group",s:"Healthcare",p:534.2,mc:492,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"LLY",n:"Eli Lilly & Co.",s:"Healthcare",p:812.4,mc:770,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"JPM",n:"JPMorgan Chase",s:"Finance",p:242.1,mc:696,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"BRK.B",n:"Berkshire Hathaway",s:"Finance",p:478.3,mc:980,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"V",n:"Visa Inc.",s:"Finance",p:335.2,mc:580,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"XOM",n:"Exxon Mobil",s:"Energy",p:108.7,mc:460,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"HD",n:"Home Depot",s:"Consumer",p:412.3,mc:410,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"PG",n:"Procter & Gamble",s:"Consumer",p:168.5,mc:397,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"WMT",n:"Walmart Inc.",s:"Consumer",p:98.7,mc:790,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"CAT",n:"Caterpillar Inc.",s:"Industrial",p:362.8,mc:176,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"NEE",n:"NextEra Energy",s:"Utilities",p:76.8,mc:158,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"AMT",n:"American Tower",s:"Real Estate",p:202.4,mc:95,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"T",n:"AT&T Inc.",s:"Telecom",p:28.4,mc:203,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"META",n:"Meta Platforms",s:"Technology",p:585,mc:1480,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"TSLA",n:"Tesla Inc.",s:"Technology",p:340,mc:1090,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"MA",n:"Mastercard Inc.",s:"Finance",p:530,mc:490,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"COST",n:"Costco Wholesale",s:"Consumer",p:920,mc:410,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"NFLX",n:"Netflix Inc.",s:"Technology",p:950,mc:410,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"CRM",n:"Salesforce Inc.",s:"Technology",p:330,mc:320,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"AMD",n:"Advanced Micro Devices",s:"Technology",p:165,mc:267,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"INTC",n:"Intel Corp.",s:"Technology",p:24,mc:103,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"PEP",n:"PepsiCo Inc.",s:"Consumer",p:152,mc:209,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"KO",n:"Coca-Cola Co.",s:"Consumer",p:62,mc:268,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"MRK",n:"Merck & Co.",s:"Healthcare",p:102,mc:258,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"ABBV",n:"AbbVie Inc.",s:"Healthcare",p:192,mc:340,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"TMO",n:"Thermo Fisher Scientific",s:"Healthcare",p:580,mc:222,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"ORCL",n:"Oracle Corp.",s:"Technology",p:175,mc:485,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"CSCO",n:"Cisco Systems",s:"Technology",p:58,mc:237,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"DIS",n:"Walt Disney Co.",s:"Consumer",p:112,mc:204,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"ADBE",n:"Adobe Inc.",s:"Technology",p:470,mc:208,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"BA",n:"Boeing Co.",s:"Industrial",p:178,mc:128,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"GS",n:"Goldman Sachs",s:"Finance",p:585,mc:195,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"CVX",n:"Chevron Corp.",s:"Energy",p:158,mc:290,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"COP",n:"ConocoPhillips",s:"Energy",p:108,mc:132,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"LIN",n:"Linde plc",s:"Materials",p:465,mc:224,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"GE",n:"GE Aerospace",s:"Industrial",p:195,mc:212,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  {t:"BLK",n:"BlackRock Inc.",s:"Finance",p:950,mc:145,r:"US",co:"\ud83c\uddfa\ud83c\uddf8"},
  // EUROPE
  {t:"ASML",n:"ASML Holding NV",s:"Technology",p:725.4,mc:295,r:"Europe",co:"\ud83c\uddf3\ud83c\uddf1"},
  {t:"SAP",n:"SAP SE",s:"Technology",p:242.8,mc:298,r:"Europe",co:"\ud83c\udde9\ud83c\uddea"},
  {t:"NOVO-B",n:"Novo Nordisk A/S",s:"Healthcare",p:685.3,mc:580,r:"Europe",co:"\ud83c\udde9\ud83c\uddf0"},
  {t:"ROG",n:"Roche Holding AG",s:"Healthcare",p:278.6,mc:230,r:"Europe",co:"\ud83c\udde8\ud83c\udded"},
  {t:"AZN",n:"AstraZeneca plc",s:"Healthcare",p:128.4,mc:198,r:"Europe",co:"\ud83c\uddec\ud83c\udde7"},
  {t:"NESN",n:"Nestl\u00e9 SA",s:"Consumer",p:89.5,mc:248,r:"Europe",co:"\ud83c\udde8\ud83c\udded"},
  {t:"MC",n:"LVMH Mo\u00ebt Hennessy",s:"Consumer",p:712.3,mc:358,r:"Europe",co:"\ud83c\uddeb\ud83c\uddf7"},
  {t:"SHEL",n:"Shell plc",s:"Energy",p:32.8,mc:210,r:"Europe",co:"\ud83c\uddec\ud83c\udde7"},
  {t:"TTE",n:"TotalEnergies SE",s:"Energy",p:58.7,mc:148,r:"Europe",co:"\ud83c\uddeb\ud83c\uddf7"},
  {t:"SIE",n:"Siemens AG",s:"Industrial",p:198.4,mc:158,r:"Europe",co:"\ud83c\udde9\ud83c\uddea"},
  {t:"HSBA",n:"HSBC Holdings plc",s:"Finance",p:8.92,mc:168,r:"Europe",co:"\ud83c\uddec\ud83c\udde7"},
  {t:"UBS",n:"UBS Group AG",s:"Finance",p:31.2,mc:98,r:"Europe",co:"\ud83c\udde8\ud83c\udded"},
  {t:"OR",n:"L'Or\u00e9al SA",s:"Consumer",p:378.5,mc:198,r:"Europe",co:"\ud83c\uddeb\ud83c\uddf7"},
  {t:"BAYN",n:"Bayer AG",s:"Healthcare",p:28.4,mc:29,r:"Europe",co:"\ud83c\udde9\ud83c\uddea"},
  {t:"DTE",n:"Deutsche Telekom AG",s:"Telecom",p:28.9,mc:144,r:"Europe",co:"\ud83c\udde9\ud83c\uddea"},
  {t:"ENEL",n:"Enel SpA",s:"Utilities",p:6.82,mc:70,r:"Europe",co:"\ud83c\uddee\ud83c\uddf9"},
  {t:"ABB",n:"ABB Ltd",s:"Industrial",p:52.4,mc:98,r:"Europe",co:"\ud83c\udde8\ud83c\udded"},
  {t:"VOW3",n:"Volkswagen AG",s:"Consumer",p:98.7,mc:52,r:"Europe",co:"\ud83c\udde9\ud83c\uddea"},
  {t:"SU.PA",n:"Schneider Electric SE",s:"Industrial",p:245,mc:142,r:"Europe",co:"\ud83c\uddeb\ud83c\uddf7"},
  {t:"AIR.PA",n:"Airbus SE",s:"Industrial",p:155,mc:122,r:"Europe",co:"\ud83c\uddeb\ud83c\uddf7"},
  {t:"RMS.PA",n:"Herm\u00e8s International",s:"Consumer",p:2350,mc:248,r:"Europe",co:"\ud83c\uddeb\ud83c\uddf7"},
  {t:"RACE",n:"Ferrari NV",s:"Consumer",p:425,mc:108,r:"Europe",co:"\ud83c\uddee\ud83c\uddf9"},
  {t:"ALV.DE",n:"Allianz SE",s:"Finance",p:295,mc:122,r:"Europe",co:"\ud83c\udde9\ud83c\uddea"},
  {t:"BNP.PA",n:"BNP Paribas SA",s:"Finance",p:68,mc:82,r:"Europe",co:"\ud83c\uddeb\ud83c\uddf7"},
  {t:"UL",n:"Unilever plc",s:"Consumer",p:56,mc:148,r:"Europe",co:"\ud83c\uddec\ud83c\udde7"},
  {t:"DGE.L",n:"Diageo plc",s:"Consumer",p:24,mc:58,r:"Europe",co:"\ud83c\uddec\ud83c\udde7"},
  {t:"SPOT",n:"Spotify Technology",s:"Technology",p:580,mc:115,r:"Europe",co:"\ud83c\uddf8\ud83c\uddea"},
  {t:"IBE.MC",n:"Iberdrola SA",s:"Utilities",p:14,mc:90,r:"Europe",co:"\ud83c\uddea\ud83c\uddf8"},
  // ASIA
  {t:"TSM",n:"Taiwan Semiconductor",s:"Technology",p:185.6,mc:960,r:"Asia",co:"\ud83c\uddf9\ud83c\uddfc"},
  {t:"9984",n:"SoftBank Group",s:"Technology",p:8450,mc:118,r:"Asia",co:"\ud83c\uddef\ud83c\uddf5"},
  {t:"005930",n:"Samsung Electronics",s:"Technology",p:58200,mc:348,r:"Asia",co:"\ud83c\uddf0\ud83c\uddf7"},
  {t:"7203",n:"Toyota Motor Corp.",s:"Consumer",p:2685,mc:285,r:"Asia",co:"\ud83c\uddef\ud83c\uddf5"},
  {t:"9988",n:"Alibaba Group",s:"Technology",p:108.4,mc:268,r:"Asia",co:"\ud83c\udde8\ud83c\uddf3"},
  {t:"0700",n:"Tencent Holdings",s:"Technology",p:428.6,mc:412,r:"Asia",co:"\ud83c\udde8\ud83c\uddf3"},
  {t:"RELIANCE",n:"Reliance Industries",s:"Energy",p:2485,mc:212,r:"Asia",co:"\ud83c\uddee\ud83c\uddf3"},
  {t:"TCS",n:"Tata Consultancy",s:"Technology",p:4128,mc:152,r:"Asia",co:"\ud83c\uddee\ud83c\uddf3"},
  {t:"6758",n:"Sony Group Corp.",s:"Technology",p:3245,mc:198,r:"Asia",co:"\ud83c\uddef\ud83c\uddf5"},
  {t:"1398",n:"ICBC",s:"Finance",p:5.82,mc:268,r:"Asia",co:"\ud83c\udde8\ud83c\uddf3"},
  {t:"7267",n:"Honda Motor Co.",s:"Consumer",p:1542,mc:82,r:"Asia",co:"\ud83c\uddef\ud83c\uddf5"},
  {t:"INFY",n:"Infosys Ltd",s:"Technology",p:1845,mc:78,r:"Asia",co:"\ud83c\uddee\ud83c\uddf3"},
  {t:"2317",n:"Hon Hai Precision",s:"Technology",p:178.5,mc:82,r:"Asia",co:"\ud83c\uddf9\ud83c\uddfc"},
  {t:"6861",n:"Keyence Corp.",s:"Industrial",p:68450,mc:165,r:"Asia",co:"\ud83c\uddef\ud83c\uddf5"},
  {t:"BABA",n:"Alibaba (US ADR)",s:"Technology",p:108.4,mc:268,r:"Asia",co:"\ud83c\udde8\ud83c\uddf3"},
  {t:"035420",n:"Naver Corp.",s:"Technology",p:218500,mc:36,r:"Asia",co:"\ud83c\uddf0\ud83c\uddf7"},
  {t:"9433",n:"KDDI Corp.",s:"Telecom",p:4825,mc:108,r:"Asia",co:"\ud83c\uddef\ud83c\uddf5"},
  {t:"4503",n:"Astellas Pharma",s:"Healthcare",p:1685,mc:32,r:"Asia",co:"\ud83c\uddef\ud83c\uddf5"},
  {t:"SE",n:"Sea Ltd",s:"Technology",p:118,mc:68,r:"Asia",co:"\ud83c\uddf8\ud83c\uddec"},
  {t:"JD",n:"JD.com Inc.",s:"Technology",p:38,mc:60,r:"Asia",co:"\ud83c\udde8\ud83c\uddf3"},
  {t:"PDD",n:"PDD Holdings",s:"Technology",p:108,mc:148,r:"Asia",co:"\ud83c\udde8\ud83c\uddf3"},
  {t:"BYDDY",n:"BYD Co. Ltd",s:"Consumer",p:72,mc:108,r:"Asia",co:"\ud83c\udde8\ud83c\uddf3"},
  {t:"HDB",n:"HDFC Bank Ltd",s:"Finance",p:68,mc:172,r:"Asia",co:"\ud83c\uddee\ud83c\uddf3"},
  {t:"IBN",n:"ICICI Bank Ltd",s:"Finance",p:30,mc:105,r:"Asia",co:"\ud83c\uddee\ud83c\uddf3"},
  {t:"3690",n:"Meituan",s:"Technology",p:168,mc:105,r:"Asia",co:"\ud83c\udde8\ud83c\uddf3"},
  {t:"2454",n:"MediaTek Inc.",s:"Technology",p:42,mc:68,r:"Asia",co:"\ud83c\uddf9\ud83c\uddfc"},
  {t:"BHP",n:"BHP Group Ltd",s:"Materials",p:58,mc:152,r:"Asia",co:"\ud83c\udde6\ud83c\uddfa"},
  {t:"CBA",n:"Commonwealth Bank",s:"Finance",p:98,mc:138,r:"Asia",co:"\ud83c\udde6\ud83c\uddfa"},
  {t:"CSLLY",n:"CSL Ltd",s:"Healthcare",p:215,mc:122,r:"Asia",co:"\ud83c\udde6\ud83c\uddfa"},
  // SOUTH AMERICA
  {t:"VALE",n:"Vale SA",s:"Materials",p:11.8,mc:48,r:"S. America",co:"\ud83c\udde7\ud83c\uddf7"},
  {t:"PBR",n:"Petrobras SA",s:"Energy",p:14.2,mc:92,r:"S. America",co:"\ud83c\udde7\ud83c\uddf7"},
  {t:"NU",n:"Nu Holdings Ltd",s:"Finance",p:14.8,mc:72,r:"S. America",co:"\ud83c\udde7\ud83c\uddf7"},
  {t:"ITUB",n:"Ita\u00fa Unibanco",s:"Finance",p:6.42,mc:62,r:"S. America",co:"\ud83c\udde7\ud83c\uddf7"},
  {t:"ABEV",n:"Ambev SA",s:"Consumer",p:2.48,mc:38,r:"S. America",co:"\ud83c\udde7\ud83c\uddf7"},
  {t:"SQM",n:"Soc. Qu\u00edmica y Minera",s:"Materials",p:42.8,mc:12,r:"S. America",co:"\ud83c\udde8\ud83c\uddf1"},
  {t:"BSBR",n:"Banco Santander Brasil",s:"Finance",p:5.62,mc:28,r:"S. America",co:"\ud83c\udde7\ud83c\uddf7"},
  {t:"EC",n:"Ecopetrol SA",s:"Energy",p:9.85,mc:20,r:"S. America",co:"\ud83c\udde8\ud83c\uddf4"},
  {t:"GGAL",n:"Grupo Financiero Galicia",s:"Finance",p:58.4,mc:12,r:"S. America",co:"\ud83c\udde6\ud83c\uddf7"},
  {t:"CRPG",n:"Corp. Grupo Cementos",s:"Materials",p:6.28,mc:8,r:"S. America",co:"\ud83c\uddf2\ud83c\uddfd"},
  {t:"MELI",n:"MercadoLibre Inc.",s:"Technology",p:1850,mc:94,r:"S. America",co:"\ud83c\udde6\ud83c\uddf7"},
  // AFRICA
  {t:"NPN",n:"Naspers Ltd",s:"Technology",p:3845,mc:42,r:"Africa",co:"\ud83c\uddff\ud83c\udde6"},
  {t:"BTI",n:"British American Tobacco",s:"Consumer",p:34.8,mc:78,r:"Africa",co:"\ud83c\uddff\ud83c\udde6"},
  {t:"AGL",n:"Anglo American plc",s:"Materials",p:28.4,mc:38,r:"Africa",co:"\ud83c\uddff\ud83c\udde6"},
  {t:"SOL",n:"Sasol Ltd",s:"Energy",p:82.4,mc:8,r:"Africa",co:"\ud83c\uddff\ud83c\udde6"},
  {t:"SBK",n:"Standard Bank Group",s:"Finance",p:178.5,mc:22,r:"Africa",co:"\ud83c\uddff\ud83c\udde6"},
  {t:"FSR",n:"FirstRand Ltd",s:"Finance",p:68.2,mc:18,r:"Africa",co:"\ud83c\uddff\ud83c\udde6"},
  {t:"MTN",n:"MTN Group Ltd",s:"Telecom",p:98.4,mc:16,r:"Africa",co:"\ud83c\uddff\ud83c\udde6"},
  {t:"DANGCEM",n:"Dangote Cement plc",s:"Materials",p:285,mc:12,r:"Africa",co:"\ud83c\uddf3\ud83c\uddec"},
  {t:"SBUX",n:"Safaricom plc",s:"Telecom",p:28.5,mc:11,r:"Africa",co:"\ud83c\uddf0\ud83c\uddea"},
  {t:"EGH",n:"Ecobank Ghana Ltd",s:"Finance",p:8.45,mc:2,r:"Africa",co:"\ud83c\uddec\ud83c\udded"}
];

const PRIOR_PICKS = [
  {t:"MSFT",n:"Microsoft Corp.",co:"\ud83c\uddfa\ud83c\uddf8",date:"2025-09-15",entry:398.2,curr:445.2},
  {t:"NOVO-B",n:"Novo Nordisk A/S",co:"\ud83c\udde9\ud83c\uddf0",date:"2025-08-10",entry:620.4,curr:685.3},
  {t:"TSM",n:"Taiwan Semiconductor",co:"\ud83c\uddf9\ud83c\uddfc",date:"2025-07-20",entry:162.8,curr:185.6},
  {t:"JPM",n:"JPMorgan Chase",co:"\ud83c\uddfa\ud83c\uddf8",date:"2025-08-20",entry:218.7,curr:242.1},
  {t:"VALE",n:"Vale SA",co:"\ud83c\udde7\ud83c\uddf7",date:"2025-10-05",entry:13.4,curr:11.8},
  {t:"NPN",n:"Naspers Ltd",co:"\ud83c\uddff\ud83c\udde6",date:"2025-06-15",entry:3420,curr:3845}
];

async function seed() {
  console.log('Checking QuestDB connection...');
  const ok = await db.healthCheck();
  if (!ok) {
    console.error('Cannot connect to QuestDB at ' + db.QUESTDB_URL);
    console.error('Make sure QuestDB is running: docker start questdb');
    process.exit(1);
  }
  console.log('QuestDB connected.\n');

  // ===== CREATE TABLES =====
  console.log('Creating tables...');

  const tables = [
    `CREATE TABLE IF NOT EXISTS prism_stock_universe (
      ticker SYMBOL capacity 8192, name STRING, sector SYMBOL capacity 64,
      region SYMBOL capacity 16, country_flag STRING, price DOUBLE,
      market_cap_bn DOUBLE, active BOOLEAN, ts TIMESTAMP
    ) timestamp(ts) PARTITION BY MONTH`,

    `CREATE TABLE IF NOT EXISTS prism_scores (
      ticker SYMBOL capacity 8192, ts TIMESTAMP,
      ey DOUBLE, roic DOUBLE, ev_ebit DOUBLE, pb DOUBLE, div_yield DOUBLE,
      fcf_yield DOUBLE, shareholder_yield DOUBLE, moat INT, quality DOUBLE,
      momentum DOUBLE, rsi DOUBLE, short_interest DOUBLE, fscore INT,
      altman_z DOUBLE, composite_score DOUBLE, consensus_count INT,
      data_source STRING
    ) timestamp(ts) PARTITION BY MONTH`,

    `CREATE TABLE IF NOT EXISTS prism_prior_picks (
      ts TIMESTAMP, ticker SYMBOL capacity 1024, name STRING,
      country_flag STRING, entry_date STRING, entry_price DOUBLE,
      current_price DOUBLE, action STRING, removed BOOLEAN
    ) timestamp(ts) PARTITION BY MONTH`,

    `CREATE TABLE IF NOT EXISTS prism_market_valuation (
      ts TIMESTAMP, region SYMBOL capacity 16, cape DOUBLE,
      earnings_yield DOUBLE, risk_free_rate DOUBLE, erp DOUBLE,
      buffett_indicator DOUBLE, etf_price DOUBLE, etf_symbol STRING,
      consensus STRING, cape_signal STRING, buffett_signal STRING,
      erp_signal STRING
    ) timestamp(ts) PARTITION BY MONTH`
  ];

  for (const ddl of tables) {
    const tName = ddl.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
    const result = await db.exec(ddl);
    if (result.ok) console.log('  \u2713 ' + tName);
    else console.log('  \u2717 ' + tName + ': ' + result.error);
  }

  // ===== SEED STOCKS =====
  console.log('\nSeeding ' + ALL_STOCKS.length + ' stocks...');

  // Check if already seeded
  const check = await db.query('SELECT count() cnt FROM prism_stock_universe;');
  if (check.ok && check.rows.length > 0 && check.rows[0].cnt > 0) {
    console.log('  Stock universe already has ' + check.rows[0].cnt + ' rows. Skipping stock seed.');
  } else {
    // Insert in chunks of 30
    let inserted = 0;
    for (let i = 0; i < ALL_STOCKS.length; i += 30) {
      const chunk = ALL_STOCKS.slice(i, i + 30);
      const values = chunk.map(s =>
        "('" + db.esc(s.t) + "','" + db.esc(s.n) + "','" + db.esc(s.s) + "','" +
        db.esc(s.r) + "','" + db.esc(s.co) + "'," + s.p + ',' + s.mc + ",true,now())"
      ).join(',');
      const sql = 'INSERT INTO prism_stock_universe ' +
        '(ticker,name,sector,region,country_flag,price,market_cap_bn,active,ts) VALUES ' + values + ';';
      const result = await db.exec(sql);
      if (result.ok) inserted += chunk.length;
      else console.error('  Insert error:', result.error);
    }
    console.log('  \u2713 Inserted ' + inserted + ' stocks');
  }

  // ===== SEED PRIOR PICKS =====
  console.log('\nSeeding ' + PRIOR_PICKS.length + ' prior picks...');

  const pickCheck = await db.query('SELECT count() cnt FROM prism_prior_picks;');
  if (pickCheck.ok && pickCheck.rows.length > 0 && pickCheck.rows[0].cnt > 0) {
    console.log('  Prior picks already has ' + pickCheck.rows[0].cnt + ' rows. Skipping.');
  } else {
    const pickValues = PRIOR_PICKS.map(p =>
      "(now(),'" + db.esc(p.t) + "','" + db.esc(p.n) + "','" + db.esc(p.co) + "','" +
      db.esc(p.date) + "'," + p.entry + "," + p.curr + ",null,false)"
    ).join(',');
    const sql = 'INSERT INTO prism_prior_picks ' +
      '(ts,ticker,name,country_flag,entry_date,entry_price,current_price,action,removed) VALUES ' +
      pickValues + ';';
    const result = await db.exec(sql);
    if (result.ok) console.log('  \u2713 Inserted ' + PRIOR_PICKS.length + ' picks');
    else console.error('  Insert error:', result.error);
  }

  // ===== SUMMARY =====
  console.log('\n===== Seed Complete =====');
  const counts = [
    { table: 'prism_stock_universe', sql: 'SELECT count() cnt FROM prism_stock_universe;' },
    { table: 'prism_scores', sql: 'SELECT count() cnt FROM prism_scores;' },
    { table: 'prism_prior_picks', sql: 'SELECT count() cnt FROM prism_prior_picks;' },
    { table: 'prism_market_valuation', sql: 'SELECT count() cnt FROM prism_market_valuation;' }
  ];
  for (const c of counts) {
    const r = await db.query(c.sql);
    const cnt = (r.ok && r.rows.length > 0) ? r.rows[0].cnt : 'error';
    console.log('  ' + c.table + ': ' + cnt + ' rows');
  }
  console.log('\nAPI server can be started with: node server.js');
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
