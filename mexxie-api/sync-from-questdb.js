#!/usr/bin/env node
// Sync stocks from local QuestDB → Railway PostgreSQL
// Run: node mexxie-api/sync-from-questdb.js
// Override endpoints: QUESTDB_URL=http://... RAILWAY_API=https://... node ...

const QUESTDB = process.env.QUESTDB_URL || 'http://localhost:9000';
const RAILWAY  = process.env.RAILWAY_API  || 'https://kubora-production.up.railway.app/api';

const REGION_MAP = {
  'US':'US','USA':'US','United States':'US','America':'US',
  'CA':'US','CAN':'US','Canada':'US',
  'UK':'Europe','GB':'Europe','GBR':'Europe','United Kingdom':'Europe',
  'DE':'Europe','DEU':'Europe','Germany':'Europe',
  'FR':'Europe','FRA':'Europe','France':'Europe',
  'NL':'Europe','NLD':'Europe','Netherlands':'Europe',
  'CH':'Europe','CHE':'Europe','Switzerland':'Europe',
  'SE':'Europe','SWE':'Europe','Sweden':'Europe',
  'NO':'Europe','NOR':'Europe','Norway':'Europe',
  'DK':'Europe','DNK':'Europe','Denmark':'Europe',
  'IT':'Europe','ITA':'Europe','Italy':'Europe',
  'ES':'Europe','ESP':'Europe','Spain':'Europe',
  'BE':'Europe','BEL':'Europe','Belgium':'Europe',
  'AT':'Europe','AUT':'Europe','Austria':'Europe',
  'FI':'Europe','FIN':'Europe','Finland':'Europe',
  'IE':'Europe','IRL':'Europe','Ireland':'Europe',
  'PT':'Europe','PRT':'Europe','Portugal':'Europe',
  'PL':'Europe','POL':'Europe','Poland':'Europe',
  'HU':'Europe','HUN':'Europe','Hungary':'Europe',
  'CZ':'Europe','CZE':'Europe','Czech Republic':'Europe',
  'JP':'Asia','JPN':'Asia','Japan':'Asia',
  'CN':'Asia','CHN':'Asia','China':'Asia',
  'HK':'Asia','HKG':'Asia','Hong Kong':'Asia',
  'KR':'Asia','KOR':'Asia','South Korea':'Asia',
  'TW':'Asia','TWN':'Asia','Taiwan':'Asia',
  'IN':'Asia','IND':'Asia','India':'Asia',
  'SG':'Asia','SGP':'Asia','Singapore':'Asia',
  'AU':'Asia','AUS':'Asia','Australia':'Asia',
  'NZ':'Asia','NZL':'Asia','New Zealand':'Asia',
  'MY':'Asia','MYS':'Asia','Malaysia':'Asia',
  'TH':'Asia','THA':'Asia','Thailand':'Asia',
  'ID':'Asia','IDN':'Asia','Indonesia':'Asia',
  'PH':'Asia','PHL':'Asia','Philippines':'Asia',
  'VN':'Asia','VNM':'Asia','Vietnam':'Asia',
  'ZA':'Africa','ZAF':'Africa','South Africa':'Africa',
  'NG':'Africa','NGA':'Africa','Nigeria':'Africa',
  'KE':'Africa','KEN':'Africa','Kenya':'Africa',
  'GH':'Africa','GHA':'Africa','Ghana':'Africa',
  'EG':'Africa','EGY':'Africa','Egypt':'Africa',
  'MA':'Africa','MAR':'Africa','Morocco':'Africa',
  'TZ':'Africa','TZA':'Africa','Tanzania':'Africa',
  'BR':'S. America','BRA':'S. America','Brazil':'S. America',
  'MX':'S. America','MEX':'S. America','Mexico':'S. America',
  'CL':'S. America','CHL':'S. America','Chile':'S. America',
  'CO':'S. America','COL':'S. America','Colombia':'S. America',
  'PE':'S. America','PER':'S. America','Peru':'S. America',
  'AR':'S. America','ARG':'S. America','Argentina':'S. America',
  'Europe':'Europe','Asia':'Asia','Africa':'Africa','S. America':'S. America',
};

const FLAG_MAP = {
  'US':'🇺🇸','USA':'🇺🇸','United States':'🇺🇸',
  'CA':'🇨🇦','CAN':'🇨🇦','Canada':'🇨🇦',
  'GB':'🇬🇧','GBR':'🇬🇧','United Kingdom':'🇬🇧',
  'DE':'🇩🇪','DEU':'🇩🇪','Germany':'🇩🇪',
  'FR':'🇫🇷','FRA':'🇫🇷','France':'🇫🇷',
  'NL':'🇳🇱','NLD':'🇳🇱','Netherlands':'🇳🇱',
  'CH':'🇨🇭','CHE':'🇨🇭','Switzerland':'🇨🇭',
  'SE':'🇸🇪','SWE':'🇸🇪','Sweden':'🇸🇪',
  'NO':'🇳🇴','NOR':'🇳🇴','Norway':'🇳🇴',
  'DK':'🇩🇰','DNK':'🇩🇰','Denmark':'🇩🇰',
  'IT':'🇮🇹','ITA':'🇮🇹','Italy':'🇮🇹',
  'ES':'🇪🇸','ESP':'🇪🇸','Spain':'🇪🇸',
  'BE':'🇧🇪','BEL':'🇧🇪','Belgium':'🇧🇪',
  'AT':'🇦🇹','AUT':'🇦🇹','Austria':'🇦🇹',
  'FI':'🇫🇮','FIN':'🇫🇮','Finland':'🇫🇮',
  'IE':'🇮🇪','IRL':'🇮🇪','Ireland':'🇮🇪',
  'PT':'🇵🇹','PRT':'🇵🇹','Portugal':'🇵🇹',
  'PL':'🇵🇱','POL':'🇵🇱','Poland':'🇵🇱',
  'JP':'🇯🇵','JPN':'🇯🇵','Japan':'🇯🇵',
  'CN':'🇨🇳','CHN':'🇨🇳','China':'🇨🇳',
  'HK':'🇭🇰','HKG':'🇭🇰','Hong Kong':'🇭🇰',
  'KR':'🇰🇷','KOR':'🇰🇷','South Korea':'🇰🇷',
  'TW':'🇹🇼','TWN':'🇹🇼','Taiwan':'🇹🇼',
  'IN':'🇮🇳','IND':'🇮🇳','India':'🇮🇳',
  'SG':'🇸🇬','SGP':'🇸🇬','Singapore':'🇸🇬',
  'AU':'🇦🇺','AUS':'🇦🇺','Australia':'🇦🇺',
  'NZ':'🇳🇿','NZL':'🇳🇿','New Zealand':'🇳🇿',
  'MY':'🇲🇾','MYS':'🇲🇾','Malaysia':'🇲🇾',
  'ZA':'🇿🇦','ZAF':'🇿🇦','South Africa':'🇿🇦',
  'NG':'🇳🇬','NGA':'🇳🇬','Nigeria':'🇳🇬',
  'KE':'🇰🇪','KEN':'🇰🇪','Kenya':'🇰🇪',
  'GH':'🇬🇭','GHA':'🇬🇭','Ghana':'🇬🇭',
  'EG':'🇪🇬','EGY':'🇪🇬','Egypt':'🇪🇬',
  'MA':'🇲🇦','MAR':'🇲🇦','Morocco':'🇲🇦',
  'BR':'🇧🇷','BRA':'🇧🇷','Brazil':'🇧🇷',
  'MX':'🇲🇽','MEX':'🇲🇽','Mexico':'🇲🇽',
  'CL':'🇨🇱','CHL':'🇨🇱','Chile':'🇨🇱',
  'CO':'🇨🇴','COL':'🇨🇴','Colombia':'🇨🇴',
  'AR':'🇦🇷','ARG':'🇦🇷','Argentina':'🇦🇷',
};

function mapRegion(region, country) {
  for (const v of [region, country]) {
    if (!v) continue;
    const r = REGION_MAP[v] || REGION_MAP[String(v).trim()];
    if (r) return r;
  }
  return 'US';
}

function mapFlag(country, region) {
  for (const v of [country]) {
    if (!v) continue;
    const f = FLAG_MAP[v] || FLAG_MAP[String(v).trim()];
    if (f) return f;
  }
  const regionDefault = { 'US':'🇺🇸','Europe':'🇪🇺','Asia':'🌏','Africa':'🌍','S. America':'🇧🇷' };
  return regionDefault[region] || '🌐';
}

async function questdbQuery(sql) {
  const url = `${QUESTDB}/exec?query=${encodeURIComponent(sql)}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`QuestDB HTTP ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

function colIndex(columns) {
  const idx = {};
  columns.forEach((c, i) => { idx[c.name.toLowerCase()] = i; });
  return (name) => idx[name.toLowerCase()] ?? -1;
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  QuestDB → Railway Sync                      ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log('QuestDB:', QUESTDB);
  console.log('Railway:', RAILWAY, '\n');

  // 1. Test QuestDB
  try {
    await questdbQuery('SELECT 1');
    console.log('✅ QuestDB: connected');
  } catch (e) {
    console.error('❌ Cannot reach QuestDB:', e.message);
    console.error('   Is QuestDB running at', QUESTDB, '?');
    process.exit(1);
  }

  // 2. Fetch stocks — try column name variations
  console.log('\n📋 Fetching stocks from QuestDB...');
  const result = await questdbQuery('SELECT * FROM stocks LIMIT 5000');
  const col = colIndex(result.columns);
  const colNames = result.columns.map(c => c.name);
  console.log('   Columns:', colNames.join(', '));
  console.log('   Rows:', result.dataset.length);

  // Auto-detect ticker column
  const tickerCol = colNames.find(c => /^(symbol|ticker|code|stock)$/i.test(c));
  const nameCol   = colNames.find(c => /^(name|company|company_name|full_name)$/i.test(c));
  const sectorCol = colNames.find(c => /^(sector|industry|industry_group)$/i.test(c));
  const regionCol = colNames.find(c => /^(region)$/i.test(c));
  const countryCol= colNames.find(c => /^(country|country_name|country_code)$/i.test(c));

  if (!tickerCol) {
    console.error('❌ Could not find ticker/symbol column. Columns:', colNames.join(', '));
    process.exit(1);
  }
  console.log(`   Using columns: ticker=${tickerCol}, name=${nameCol||'?'}, sector=${sectorCol||'?'}, region=${regionCol||'?'}, country=${countryCol||'?'}`);

  // 3. Fetch latest prices from daily_prices
  let priceMap = {};
  try {
    console.log('\n💰 Fetching latest prices from daily_prices...');
    const pr = await questdbQuery(
      `SELECT symbol, close FROM daily_prices LATEST ON timestamp PARTITION BY symbol LIMIT 10000`
    );
    const pc = colIndex(pr.columns);
    pr.dataset.forEach(row => {
      const sym = row[pc('symbol')];
      const cls = row[pc('close')];
      if (sym && cls) priceMap[sym] = +cls;
    });
    console.log(`   Got prices for ${Object.keys(priceMap).length} symbols`);
  } catch (e) {
    console.log('   ⚠️ Could not fetch prices:', e.message);
  }

  // 4. Map to stock format
  const seen = new Set();
  const stocks = result.dataset
    .map(row => {
      const ticker = String(row[col(tickerCol)] || '').trim().toUpperCase();
      if (!ticker || seen.has(ticker)) return null;
      seen.add(ticker);

      const name    = nameCol   ? String(row[col(nameCol)]   || '').trim() : ticker;
      const sector  = sectorCol ? String(row[col(sectorCol)] || '').trim() : 'Other';
      const region  = regionCol ? String(row[col(regionCol)] || '').trim() : '';
      const country = countryCol? String(row[col(countryCol)]|| '').trim() : '';

      const r  = mapRegion(region, country);
      const co = mapFlag(country, r);
      const p  = priceMap[ticker] || 0;

      return { t: ticker, n: name || ticker, s: sector || 'Other', r, co, p, mc: 0 };
    })
    .filter(Boolean);

  console.log(`\n✅ Mapped ${stocks.length} unique stocks`);
  console.log('   Sample:', JSON.stringify(stocks.slice(0, 3)));

  // 5. Test Railway connectivity
  try {
    const health = await fetch(`${RAILWAY}/health`, { signal: AbortSignal.timeout(10000) });
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    const hd = await health.json();
    console.log(`\n✅ Railway API: ${hd.status} (db: ${hd.db})`);
  } catch (e) {
    console.error('\n❌ Cannot reach Railway API:', e.message);
    console.error('   Check RAILWAY_API env or VPN/internet connection');
    process.exit(1);
  }

  // 6. Push in batches of 200
  console.log(`\n🚀 Pushing ${stocks.length} stocks to Railway in batches of 200...`);
  const BATCH = 200;
  let pushed = 0;
  let failed = 0;

  for (let i = 0; i < stocks.length; i += BATCH) {
    const batch = stocks.slice(i, i + BATCH);
    try {
      const resp = await fetch(`${RAILWAY}/stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(30000)
      });
      if (!resp.ok) {
        const err = await resp.text();
        console.error(`   ❌ Batch ${i+1}-${i+batch.length} failed (${resp.status}):`, err.substring(0, 200));
        failed += batch.length;
      } else {
        pushed += batch.length;
        process.stdout.write(`   ✓ ${pushed}/${stocks.length}\r`);
      }
    } catch (e) {
      console.error(`   ❌ Batch ${i+1}-${i+batch.length} error:`, e.message);
      failed += batch.length;
    }
  }

  console.log(`\n\n✅ Done! Pushed: ${pushed}  Failed: ${failed}`);

  // 7. Verify
  try {
    const check = await fetch(`${RAILWAY}/stocks/count`, { signal: AbortSignal.timeout(10000) });
    const counts = await check.json();
    console.log('\n📊 Railway universe by region:');
    Object.entries(counts).forEach(([region, count]) => {
      console.log(`   ${region.padEnd(12)}: ${count}`);
    });
  } catch (e) {
    console.log('⚠️  Could not verify count:', e.message);
  }
}

main().catch(e => {
  console.error('\n❌ Fatal error:', e.message);
  process.exit(1);
});
