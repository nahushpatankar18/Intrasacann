import crypto from 'crypto';
import { MarketCandle, PredictionRecord, StockFeatures } from './types.js';
import { NIFTY_50_CONSTITUENTS, formatIstDate, formatIstTime, getNowInIst, BENCHMARKS } from './config/stocks.js';
import { MarketDataService } from './marketData.js';
import { groupCandlesByIstDate } from './indicators.js';
import { FeatureExtractor } from './featureExtractor.js';
import { TransparentLogisticModel } from './model.js';
import { NewsSentimentService } from './newsSentiment.js';
import { Database } from './db.js';

export interface RunAnalysisResult {
  runId: string;
  timestamp: string;
  date: string;
  top5Up: PredictionRecord[];
  top5Down: PredictionRecord[];
  allRanked: PredictionRecord[];
  skippedStocks: Array<{ symbol: string; reason: string }>;
  marketContext: {
    nifty: { price: number; change: number; changePct: number };
    vix: { price: number; change: number; changePct: number };
  };
}

export class PredictionRunnerService {
  private static model = new TransparentLogisticModel();

  static async initModel(): Promise<void> {
    const saved = Database.getSavedModel();
    if (saved) {
      this.model = new TransparentLogisticModel(saved);
    }
  }

  static getModel(): TransparentLogisticModel {
    return this.model;
  }

  static setModel(m: TransparentLogisticModel): void {
    this.model = m;
    Database.saveModel(m.serialize());
  }

  // Run live analysis across stocks
  static async runAnalysis(manualOverride = false): Promise<RunAnalysisResult> {
    const settings = Database.getSettings();
    const symbols = settings.stockSymbols && settings.stockSymbols.length > 0
      ? settings.stockSymbols
      : NIFTY_50_CONSTITUENTS.map((s) => s.symbol);

    const nowIst = getNowInIst();
    const dateStr = formatIstDate(nowIst);
    const timestampStr = `${dateStr}T${formatIstTime(nowIst)}+05:30`;
    const runId = `run_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    // 1. Fetch market benchmarks (^NSEI, ^INDIAVIX)
    let niftyContext = { price: 24000, change: 0, changePct: 0, prevClose: 24000 };
    let vixContext = { price: 14.0, change: 0, changePct: 0, prevClose: 14.0 };
    let nifty5mCandles: MarketCandle[] = [];

    try {
      const ctx = await MarketDataService.getMarketContext();
      niftyContext = ctx.nifty;
      vixContext = ctx.vix;
    } catch (e) {
      console.warn('Could not fetch real-time market context benchmarks:', e);
    }

    try {
      nifty5mCandles = await MarketDataService.get5mCandles(BENCHMARKS.NIFTY_50);
    } catch (e) {
      console.warn('Could not fetch NIFTY 50 5m candles:', e);
    }

    // 2. Refresh news feeds
    try {
      await NewsSentimentService.refreshNews();
    } catch (e) {
      console.warn('News refresh error:', e);
    }

    // 3. Process stocks
    const analyzedPredictions: PredictionRecord[] = [];
    const skippedStocks: Array<{ symbol: string; reason: string }> = [];

    // Analyze stocks (throttle/batch to avoid rate limits)
    for (const sym of symbols) {
      const constituent = NIFTY_50_CONSTITUENTS.find((c) => c.symbol === sym) || {
        symbol: sym,
        name: sym.replace('.NS', ''),
        sector: 'Equities',
      };

      try {
        const [fiveM, daily] = await Promise.all([
          MarketDataService.get5mCandles(sym),
          MarketDataService.getDailyCandles(sym),
        ]);

        const grouped = groupCandlesByIstDate(fiveM);
        if (grouped.length === 0) {
          skippedStocks.push({ symbol: sym, reason: 'Zero 5-minute candles available' });
          continue;
        }

        // Today's candles or latest available session
        const latestGroup = grouped[grouped.length - 1];
        const dayCandles = latestGroup.candles;

        // Daily candles strictly up to prior day
        const dailyPrior = daily.filter((d) => d.date.slice(0, 10) < latestGroup.dateStr);

        // Historical 5m days prior
        const hist5m = grouped.filter((g) => g.dateStr < latestGroup.dateStr);

        // Sentiment from RSS
        const sentimentResult = NewsSentimentService.getSentimentForStock(sym);

        const feat = FeatureExtractor.extractFeaturesAt1015({
          symbol: sym,
          day5mCandles: dayCandles,
          dailyCandlesPrior: dailyPrior,
          historical5mDays: hist5m,
          niftyDay5mCandles: nifty5mCandles,
          vixCurrent: vixContext.price,
          vixChange: vixContext.changePct,
          newsSentiment: sentimentResult.score,
        });

        if (!feat) {
          skippedStocks.push({
            symbol: sym,
            reason: `Missing required 10:15 IST opening candles (found ${dayCandles.length} candles for session)`,
          });
          continue;
        }

        // Predict using model
        const pred = this.model.predict(feat);

        analyzedPredictions.push({
          id: `pred_${runId}_${sym.replace(/[^a-zA-Z0-9]/g, '')}`,
          runId,
          timestamp: timestampStr,
          date: dateStr,
          symbol: sym,
          companyName: constituent.name,
          direction: pred.direction,
          probUp: pred.probUp,
          probDown: pred.probDown,
          confidence: pred.confidence,
          rank: 0,
          priceAtPred: feat.priceAtPred,
          features: feat,
          featureContributions: pred.featureContributions,
          keyReasons: pred.keyReasons,
          recentHeadlines: sentimentResult.headlines,
          outcome: 'PENDING',
        });
      } catch (err: any) {
        skippedStocks.push({
          symbol: sym,
          reason: err?.message || 'Failed fetching candle data from Yahoo',
        });
      }
    }

    if (analyzedPredictions.length === 0) {
      const reasons = skippedStocks.map((s) => `${s.symbol}: ${s.reason}`).join('; ');
      throw new Error(`Unable to analyze any stocks. Reasons: ${reasons || 'No market data returned'}`);
    }

    // Rank Top 5 UP
    const rankedUp = [...analyzedPredictions]
      .sort((a, b) => b.probUp - a.probUp)
      .slice(0, 5)
      .map((p, idx) => ({ ...p, rank: idx + 1, direction: 'UP' as const }));

    // Rank Top 5 DOWN
    const rankedDown = [...analyzedPredictions]
      .sort((a, b) => b.probDown - a.probDown)
      .slice(0, 5)
      .map((p, idx) => ({ ...p, rank: idx + 1, direction: 'DOWN' as const }));

    // Combine top picks for immutable storage
    const loggedPicks = [...rankedUp, ...rankedDown];

    // Immutable append to database: predictions can never be deleted or modified
    Database.appendPredictions(loggedPicks);

    return {
      runId,
      timestamp: timestampStr,
      date: dateStr,
      top5Up: rankedUp,
      top5Down: rankedDown,
      allRanked: analyzedPredictions,
      skippedStocks,
      marketContext: {
        nifty: { price: niftyContext.price, change: niftyContext.change, changePct: niftyContext.changePct },
        vix: { price: vixContext.price, change: vixContext.change, changePct: vixContext.changePct },
      },
    };
  }

  // Scoreboard evaluation: fetches actual close for pending predictions and computes outcome
  static async evaluateOutcomes(): Promise<{ evaluatedCount: number; errors: string[] }> {
    const predictions = Database.getPredictions();
    const pending = predictions.filter((p) => p.outcome === 'PENDING' || !p.actualClose);

    if (pending.length === 0) {
      return { evaluatedCount: 0, errors: [] };
    }

    const settings = Database.getSettings();
    const threshold = settings.moveThresholdPct / 100;
    const cost = settings.costRoundTripPct / 100;

    const updates = new Map<
      string,
      { actualClose: number; actualReturn: number; outcome: 'HIT' | 'MISS' | 'FLAT'; paperPnlPct: number; evaluatedAt: string }
    >();
    const errors: string[] = [];

    // Group pending by symbol to avoid duplicate fetches
    const bySymbol = new Map<string, PredictionRecord[]>();
    for (const p of pending) {
      if (!bySymbol.has(p.symbol)) bySymbol.set(p.symbol, []);
      bySymbol.get(p.symbol)!.push(p);
    }

    const nowIst = getNowInIst();
    const evaluatedAt = `${formatIstDate(nowIst)}T${formatIstTime(nowIst)}+05:30`;

    for (const [sym, records] of bySymbol.entries()) {
      try {
        const [daily, fiveM] = await Promise.all([
          MarketDataService.getDailyCandles(sym, true),
          MarketDataService.get5mCandles(sym, true),
        ]);

        const fiveMGrouped = groupCandlesByIstDate(fiveM);
        const fiveMDateMap = new Map(fiveMGrouped.map((g) => [g.dateStr, g.candles]));
        const dailyDateMap = new Map(daily.map((d) => [d.date.slice(0, 10), d.close]));

        for (const rec of records) {
          const recDate = rec.date;
          let actualClose: number | undefined;

          // Check if we have 5m candles for that date to get exact close of day
          const day5m = fiveMDateMap.get(recDate);
          if (day5m && day5m.length > 0) {
            actualClose = day5m[day5m.length - 1].close;
          } else if (dailyDateMap.has(recDate)) {
            actualClose = dailyDateMap.get(recDate);
          }

          if (actualClose && actualClose > 0 && rec.priceAtPred > 0) {
            const actualReturn = (actualClose - rec.priceAtPred) / rec.priceAtPred;

            let outcome: 'HIT' | 'MISS' | 'FLAT' = 'FLAT';
            let paperPnlPct = 0;

            if (rec.direction === 'UP') {
              if (actualReturn >= threshold) {
                outcome = 'HIT';
              } else if (actualReturn <= -0.002) {
                outcome = 'MISS';
              } else {
                outcome = 'FLAT';
              }
              // Long net return
              paperPnlPct = Number(((actualReturn - cost) * 100).toFixed(2));
            } else if (rec.direction === 'DOWN') {
              if (actualReturn <= -threshold) {
                outcome = 'HIT';
              } else if (actualReturn >= 0.002) {
                outcome = 'MISS';
              } else {
                outcome = 'FLAT';
              }
              // Short net return
              paperPnlPct = Number(((-actualReturn - cost) * 100).toFixed(2));
            }

            updates.set(rec.id, {
              actualClose: Number(actualClose.toFixed(2)),
              actualReturn: Number(actualReturn.toFixed(4)),
              outcome,
              paperPnlPct,
              evaluatedAt,
            });
          }
        }
      } catch (err: any) {
        errors.push(`Could not fetch closing price for ${sym}: ${err?.message}`);
      }
    }

    const evaluatedCount = Database.updatePredictionOutcomes(updates);
    return { evaluatedCount, errors };
  }
}
