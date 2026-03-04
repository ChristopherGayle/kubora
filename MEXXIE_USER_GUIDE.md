# Mexxie Prism — End User Guide
### A Plain-English Guide to Global Stock Intelligence

> **Disclaimer:** Mexxie Prism is an educational tool only. Nothing here is investment advice. Always consult a qualified financial advisor before making any investment decisions.

---

## What Is Mexxie Prism?

Mexxie Prism is a **stock screener** — a tool that helps you find potentially good investment candidates from thousands of companies around the world. Think of it like a filter system: instead of researching hundreds of companies by hand, you set criteria (like "show me undervalued companies with strong finances") and the tool narrows the list down to your best candidates.

It analyzes companies across **5 continents**: US, Europe, Asia, South America, and Africa — giving you a truly global view that most retail investor tools don't offer.

---

## The Home Screen at a Glance

When you open Mexxie Prism, you land on the **Screener** tab. At the top you'll see:

| Element | What It Does |
|---------|-------------|
| **⚡ Live Refresh** | Fetches real-time price data from financial APIs (requires your API keys in Settings) |
| **↻ Simulate** | Generates a fresh simulated screen using randomized but realistic data — great for learning without API keys |
| **SIMULATED / LIVE** badge | Tells you whether the current results are simulated or from real market data |
| **Date & Time** | Shows when data was last refreshed |

---

## The Five Tabs

### 📊 Screener — Your Main Workspace
This is where you find and evaluate stocks.

**Filters you can set:**
- **Region buttons** (Worldwide / 🇺🇸 US / 🇪🇺 Europe / 🌏 Asia / 🇧🇷 S. America / 🇿🇦 Africa) — focus on one market or all of them
- **TOP** — how many stocks to show (5, 8, 10, 15, 20, 30)
- **SECTOR** — filter by industry (Technology, Healthcare, Finance, etc.)
- **Market Cap tier pills** — filter by company size:
  - **All** — shows every company regardless of size
  - **Mega** (>$200B) — the world's largest companies (Apple, Microsoft, etc.)
  - **Large** ($10–200B) — big established companies
  - **Mid** ($2–10B) — medium-sized businesses with growth potential
  - **Small** ($250M–2B) — smaller companies, higher risk/reward
  - **Micro** ($150–300M) — very small companies including OTC (over-the-counter) stocks
- **Valuation filter** (🔴 Overvalued / 🟡 Neutral / 🟢 Undervalued) — filter by how expensive the market currently appears

### 📦 ETFs — Ready-Made Investment Baskets
ETFs (Exchange-Traded Funds) are like pre-packaged portfolios. Instead of picking individual stocks, you buy a share of a fund that holds dozens or hundreds of stocks at once.

Each ETF card shows:
- **Expense ratio** — the annual fee you pay (lower is better)
- **Yield** — dividend income as a % of your investment
- **Momentum** — recent performance trend

### 📈 History — Your Prior Investment Picks
This is a personal journal of stocks you've added to your watchlist. It shows:
- **Entry price** — what the stock cost when you added it
- **Current price** — today's price
- **Return** — how much it's gained or lost since you tracked it
- **Action** — Hold, Buy, Sell, or Watch

### 🎯 Strategies — Investment Philosophies Explained
Learn about the famous investing strategies that power the screener's scores. Each strategy card explains the investing approach, what metrics it looks for, and when to use it more or less heavily.

### ⚙️ Settings — Customize Your Experience
- **Theme** — choose from 8 color themes (Obsidian Night, Emerald Terminal, etc.)
- **Strategy Weights** — increase or decrease how much each strategy influences the score
- **API Keys** — add your Finnhub, FMP, or EODHD API keys for real-time data
- **API Server** — enter your Railway backend URL for cloud data sync

---

## Understanding a Stock Card

Each company appears as a card with key information:

```
#1  🇨🇳  0700
    Tencent Holdings
    [Technology] [Asia] [5/5 factors]              ●●  80

    VALUE      QUALITY    MOMENTUM    SAFETY
    ● Strong   ● Strong   ● Good      ● Strong

    ▸ View Executive Analysis
```

| Part | What It Means |
|------|--------------|
| **#1** | Rank — lower number = higher score |
| **🇨🇳 0700** | Country flag + stock ticker symbol |
| **[5/5 factors]** | How many of the 5 main screening factors this stock passes |
| **80** | Composite Prism Score (0–100, higher is better) |
| **VALUE** | How cheap the stock is relative to what it earns |
| **QUALITY** | How financially strong and well-managed the business is |
| **MOMENTUM** | Whether the stock price is trending upward |
| **SAFETY** | Financial health — low debt, positive cash flow, not distress risk |

### What the colour dots mean
- 🟢 **Strong** — well above average, a genuine positive signal
- 🔵 **Good** — above average, a mild positive
- 🟡 **Fair** — average, neither positive nor negative
- 🔴 **Weak** — below average, a warning signal

---

## The Prism Score Explained

The **Prism Score (0–100)** is a weighted combination of up to 12 different investing strategies. A score of:

| Score | Interpretation |
|-------|---------------|
| 75–100 | **Excellent** — passes most quality, value, and momentum tests |
| 60–74 | **Good** — solid across most metrics |
| 45–59 | **Average** — mixed signals |
| Below 45 | **Below average** — fails multiple screening criteria |

The score is built from these legendary investor frameworks (see Strategies tab for full details):

| Strategy | What It Measures | Famous For |
|----------|-----------------|------------|
| **Greenblatt Magic Formula** | Earnings yield + return on capital | 30.8% annual return 1988–2004 |
| **Tweedy Browne Value** | Price-to-book, dividends, insider buying | Beat S&P by ~2%/yr for 40 years |
| **Munger Quality/Moat** | Business durability, management quality | Berkshire Hathaway approach |
| **Simons Quantitative** | Price momentum, mean reversion | Medallion Fund: 66%/yr (30 years) |
| **Piotroski F-Score** | 9 financial health checks | ~23% annual return in backtests |
| **Altman Z-Score** | Bankruptcy risk detection | 72–80% accuracy predicting failure |
| **RSI Zone Filter** | Avoids overbought stocks | Reduces buying at market peaks |
| **EV/EBIT Multiple** | True earnings power vs. enterprise value | More accurate than P/E ratio |
| **Shareholder Yield** | Total cash returned to shareholders | Dividends + buybacks + debt paydown |
| **Revenue Growth** | Avoids companies at peak earnings | Reduces cyclical traps |
| **Short Interest** | Contrarian signal from short sellers | 5–15% short = potential opportunity |
| **Druckenmiller Growth** | Secular growth + macro momentum | ~30%/yr at Duquesne Capital |

---

## The Executive Analysis (Click Any Stock Card)

Clicking on a stock card expands an **Executive Summary** that gives you:

1. **Conviction badge** — Highest / High / Moderate / Watch
2. **Investment case** — A plain-English explanation of why this stock scored well
3. **Key strengths** — Specific metrics that stand out positively
4. **Risks to watch** — Areas of concern or uncertainty
5. **Factor bars** — Visual breakdown of each scoring dimension

---

## Understanding Market Valuation

At the top of the Screener, you'll see the market valuation filter:
- 🔴 **Overvalued** — the overall market appears expensive by historical measures (CAPE, Buffett Indicator, earnings yield vs risk-free rates)
- 🟡 **Neutral** — market is fairly valued
- 🟢 **Undervalued** — market appears cheap — historically the best time to invest more aggressively

When you select "Undervalued", Prism only shows stocks from regions where the market is currently cheap. This is a powerful filter to avoid buying expensive markets.

---

## Step-by-Step: Running Your First Screen

1. **Click ↻ Simulate** to generate your first set of results (no API key needed)
2. **Start with Worldwide** region and **All** market caps to see the full picture
3. **Look at the #1 ranked stock** — click the card to read the executive analysis
4. **Try filtering by region** — click "🇺🇸 US" to focus on American stocks
5. **Try filtering by sector** — select "Technology" to see only tech companies
6. **Try Mega caps** — click the "Mega" pill to see only the world's largest companies
7. **Add interesting stocks to History** — use the ⊕ button to track a pick
8. **Adjust Strategy Weights** — go to Settings → change sliders to match your investing style

---

## Common Questions

**Q: Why does it show the same results after refreshing?**
A: In Simulate mode, results change each time you click Simulate. To get real-time prices, you need a free API key (see Settings → API Keys).

**Q: What is a "ticker symbol"?**
A: It's the short code for a stock. For example, Apple = AAPL, Microsoft = MSFT, Toyota = 7203.

**Q: What does "market cap" mean?**
A: Market capitalization = the total value of all a company's shares. Apple is ~$3.5 trillion, making it "Mega" cap. A $500 million company would be "Small" cap.

**Q: Why might a very cheap stock have a low score?**
A: Cheap isn't always good. A stock might be cheap because the business is deteriorating. The Piotroski F-Score and Altman Z-Score specifically check for financial distress — if those fail, the score drops.

**Q: What's the difference between Live Refresh and Simulate?**
A: **Simulate** uses randomized fictional data — great for learning the tool. **Live Refresh** fetches real current stock prices and financial data from professional market data providers (requires a free API key).

**Q: Can I use this for crypto?**
A: No — Mexxie Prism is designed specifically for publicly traded stocks and ETFs.

---

## Tips for Beginners

- **Start with Mega or Large cap filters** — these are the most well-known, stable companies
- **Focus on 🟢 Undervalued markets** — historically the best risk/reward timing
- **Look for 5/5 factors** stocks — these pass every screening dimension
- **Don't rely on a single metric** — the power of Prism is combining many strategies
- **Use the History tab** — tracking picks teaches you a lot about how companies perform over time
- **Read the Strategy tab** — understanding *why* each metric matters makes you a better investor

---

*Mexxie Prism — Educational tool only. Not investment advice.*
*© Mexxie Ultimate Stock Intelligence*
