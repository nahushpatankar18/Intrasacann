# IntraScan — NSE Intraday Walk-Forward Probability Engine & Scoreboard

> **Mandatory Disclaimer:** Educational analysis only, not investment advice. Predictions are probabilistic and can be wrong. IntraScan is strictly an analytical quantitative system and never places trades.

---

## 1. Overview
**IntraScan** is a personal quantitative research tool built specifically for Indian National Stock Exchange (NSE) equity markets, focusing on the **Nifty 50** universe.

At **10:15 IST** (after the initial 30–60 minutes of opening price discovery), IntraScan computes **14 strictly non-lookahead features** combining price action, volume pace, daily technical context, volatility, relative strength versus the NIFTY 50 index (`^NSEI`), India VIX (`^INDIAVIX`), and fresh news sentiment scored server-side with Gemini 3.8 Flash.

It uses a transparent, walk-forward logistic scorer to estimate:
- **$P(\text{UP})$**: Probability that the stock closes at least **+1.0%** above its 10:15 IST price by market close (15:30 IST).
- **$P(\text{DOWN})$**: Probability that the stock closes at least **1.0%** below its 10:15 IST price by market close.

Every prediction is cryptographically timestamped and immutably logged to persistent storage **before** the market close. After 15:30 IST, the **Scoreboard** fetches official NSE closing prices, calculates actual percentage moves, grades predictions as **HIT**, **MISS**, or **FLAT**, and updates running accuracy and net paper returns after costs.

---

## 2. Technical Stack & Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, Recharts, Lucide icons.
- **Backend**: Node.js & Express server running with Vite middleware mode in development (`server.ts`).
- **Data Layer**:
  - Real market candles via Yahoo Finance (`yahoo-finance2` package) with 5-minute candles (~60 days) and daily candles (2 years).
  - Exponential backoff retry, in-memory 5-minute TTL caching, and request concurrency throttling.
  - No silent fake data fallback: if upstream data fails, real error messages are displayed visibly in the UI.
- **News & Sentiment Engine**:
  - Live RSS feed scraper for Google News Equities, Economic Times Markets, and Moneycontrol.
  - Server-side `@google/genai` SDK using `gemini-3.8-flash` with exponential time-decay weighting over a 24-hour window.
- **Persistence**:
  - Atomic JSON database in `./data/predictions.json` and `./data/settings.json`.
  - Immutable prediction records: once created, inputs cannot be altered or removed from the UI.
  - One-click **Export CSV** for complete external spreadsheet auditing.

---

## 3. The 14 Prediction Features (Strictly Non-Lookahead)

All features are constructed strictly using information available at **10:15 IST** on day $T$:
1. **Opening Gap**: $\frac{\text{Open}_{09:15} - \text{Close}_{T-1}}{\text{Close}_{T-1}}$
2. **First 30m Return**: Return from 09:15 to 09:45 IST.
3. **First 30m Range**: Normalized high-low spread of the first six 5-minute candles.
4. **Distance from VWAP**: $\frac{\text{Price}_{10:15} - \text{VWAP}_{10:15}}{\text{VWAP}_{10:15}}$
5. **Distance from Day Open**: $\frac{\text{Price}_{10:15} - \text{Open}_{09:15}}{\text{Open}_{09:15}}$
6. **Relative Volume**: Volume from 09:15 to 10:15 divided by the 20-day historical average volume for that exact morning window.
7. **Daily RSI (14)**: Calculated on daily candles strictly up to prior day $T-1$.
8. **20 EMA Distance**: Relative distance of prior close to 20-day exponential moving average.
9. **50 EMA Distance**: Relative distance of prior close to 50-day exponential moving average.
10. **ATR Volatility**: 14-day Average True Range normalized by prior close (expected daily volatility range).
11. **Relative Strength vs Nifty**: Stock's 09:15–10:15 percentage return minus Nifty 50's 09:15–10:15 return.
12. **India VIX Level**: Real-time India VIX index level.
13. **India VIX % Change**: Day's percentage change in India VIX.
14. **News Sentiment Score**: Time-decay weighted average score ($-1.0$ to $+1.0$) of recent headlines from the last 24 hours analyzed by Gemini.

---

## 4. How to Read the Scoreboard

The **Scoreboard Tab** is the core accountability module of IntraScan:

1. **Running Hit Rate**: Percentage of all resolved predictions that achieved their target direction move ($\ge +1\%$ for UP or $\le -1\%$ for DOWN).
2. **Top-5 Precision**: Hit rate filtered specifically for top-5 ranked picks.
3. **Sample-Size Warning**:
   - In accordance with quantitative standards, a visible warning banner is shown until at least **30 resolved predictions** are logged. Statistical claims should not be generalized on small sample sizes.
4. **Calibration Chart**:
   - Compares predicted probability buckets ($50\text{--}60\%$, $60\text{--}70\%$, $70\text{--}80\%$, $>80\%$) against the actual empirical win rate. In a calibrated model, higher predicted confidence yields proportionally higher hit rates.
5. **Cumulative Paper P&L Curve**:
   - Running net percentage return calculated trade-by-trade after deducting a configurable round-trip cost (default **0.1%** for STT, broker commissions, and exchange charges).
6. **Immutable Ledger**:
   - Lists every prediction with timestamp, prediction price, actual close, return %, and outcome.
   - Click **Export CSV** to download the ledger as an audit file.

---

## 5. Walk-Forward Backtesting

In the **Backtest Tab**:
- The model trains on earlier chronological days, steps forward to predict on subsequent days, and rolls forward continuously.
- **Never shuffles**: Preserves temporal causality without lookahead bias.
- Compares IntraScan against two transparent baselines:
  1. **Random Pick Baseline**: The unconditional baseline frequency of stocks hitting $\ge +1\%$ intraday.
  2. **Biggest Early Gainers Baseline (Momentum)**: The naïve strategy of simply buying stocks with the largest first 30-minute surge.

---

## 6. Data Limits & Market Hours

- **Timezone**: All times are in **IST (Indian Standard Time, UTC + 5:30)**.
- **Trading Hours**: Regular NSE equity trading hours are 09:15 to 15:30 IST, Monday through Friday.
- **Market Holidays & Weekends**: IntraScan detects non-trading days and displays a clear session indicator.
- **Manual Test Mode**: A toggle on the Live Predictions tab allows running analysis outside regular market hours for verification and backtest analysis using the latest available session data.
- **Data Limits**: Yahoo Finance provides 5-minute candles for the most recent ~55–60 calendar days (approximately 40–45 NSE trading sessions). Stocks with missing or incomplete morning candles are safely skipped with a visible note.
