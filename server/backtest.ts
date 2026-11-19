import { MarketCandle, BacktestResult, StockFeatures } from './types.js';
import { MarketDataService } from './marketData.js';
import { groupCandlesByIstDate } from './indicators.js';
import { FeatureExtractor } from './featureExtractor.js';
import { TransparentLogisticModel } from './model.js';
import { BENCHMARKS } from './config/stocks.js';

export class WalkForwardBacktester {
  static async runBacktest(params: {
    stockSymbols: string[];
    costRoundTripPct: number;
    moveThresholdPct: number;
  }): Promise<BacktestResult> {
    const { stockSymbols, costRoundTripPct, moveThresholdPct } = params;

    // Use a robust representative subset of symbols (top 15 liquid Nifty 50 constituents)
    // to maintain fast response while providing statistically significant walk-forward history
    const symbolsToTest = stockSymbols.slice(0, 15);

    // Fetch market context (^NSEI)
    let nifty5m: MarketCandle[] = [];
    try {
      nifty5m = await MarketDataService.get5mCandles(BENCHMARKS.NIFTY_50);
    } catch (e) {
      console.warn('Could not fetch Nifty 50 5m for backtest:', e);
    }
    const niftyGrouped = groupCandlesByIstDate(nifty5m);
    const niftyMap = new Map(niftyGrouped.map((g) => [g.dateStr, g.candles]));

    // Fetch 5m candles and daily candles for each stock
    interface StockDataBundle {
      symbol: string;
      daily: MarketCandle[];
      grouped5m: Array<{ dateStr: string; candles: MarketCandle[] }>;
      dateMap: Map<string, MarketCandle[]>;
    }

    const stockBundles: StockDataBundle[] = [];

    for (const sym of symbolsToTest) {
      try {
        const [fiveM, daily] = await Promise.all([
          MarketDataService.get5mCandles(sym),
          MarketDataService.getDailyCandles(sym),
        ]);
        const grouped = groupCandlesByIstDate(fiveM);
        stockBundles.push({
          symbol: sym,
          daily,
          grouped5m: grouped,
          dateMap: new Map(grouped.map((g) => [g.dateStr, g.candles])),
        });
      } catch (e) {
        console.warn(`Skipping ${sym} in backtest due to data fetch issue:`, e);
      }
    }

    if (stockBundles.length === 0) {
      throw new Error('Unable to fetch market data for walk-forward backtest. Check network connection.');
    }

    // Collect all common trading days across stocks
    const allDatesSet = new Set<string>();
    for (const b of stockBundles) {
      for (const g of b.grouped5m) {
        allDatesSet.add(g.dateStr);
      }
    }
    const sortedDates = Array.from(allDatesSet).sort();

    // Require at least 15 days of historical data for walk-forward
    const minHistoryDays = 12;
    if (sortedDates.length <= minHistoryDays) {
      throw new Error(`Insufficient historical days (${sortedDates.length}) for walk-forward validation (minimum ${minHistoryDays} required).`);
    }

    // Walk-forward simulation variables
    let totalTop5UpPredictions = 0;
    let hitTop5Up = 0;
    let totalTop5DownPredictions = 0;
    let hitTop5Down = 0;

    // Baselines
    let randomHits = 0;
    let randomTotal = 0;
    let momentumHits = 0;
    let momentumTotal = 0;

    // Net return
    let totalNetReturn = 0;
    let totalTradesCount = 0;

    // Calibration buckets: [50-60%), [60-70%), [70-80%), [80-100%]
    const calibrationBuckets = [
      { bucket: '50% - 60%', minProb: 0.50, maxProb: 0.60, count: 0, hits: 0 },
      { bucket: '60% - 70%', minProb: 0.60, maxProb: 0.70, count: 0, hits: 0 },
      { bucket: '70% - 80%', minProb: 0.70, maxProb: 0.80, count: 0, hits: 0 },
      { bucket: '80% - 100%', minProb: 0.80, maxProb: 1.00, count: 0, hits: 0 },
    ];

    // Cumulative equity curves
    let cumStrategyReturn = 0;
    let cumMomentumReturn = 0;
    let cumRandomReturn = 0;
    const equityCurve: Array<{
      date: string;
      strategyCumulativeReturn: number;
      momentumCumulativeReturn: number;
      randomCumulativeReturn: number;
    }> = [];

    const threshold = moveThresholdPct / 100;
    const cost = costRoundTripPct / 100;

    // Build samples for each day
    interface DailyEvaluationItem {
      dateStr: string;
      symbol: string;
      features: StockFeatures;
      price1015: number;
      close1530: number;
      actualReturn: number;
      labelUp: boolean;
      labelDown: boolean;
    }

    const daySamples = new Map<string, DailyEvaluationItem[]>();

    for (let dayIdx = 0; dayIdx < sortedDates.length; dayIdx++) {
      const dateStr = sortedDates[dayIdx];
      const items: DailyEvaluationItem[] = [];

      for (const bundle of stockBundles) {
        const dayCandles = bundle.dateMap.get(dateStr);
        if (!dayCandles || dayCandles.length < 10) continue;

        // Daily candles strictly up to prior day (no look-ahead)
        const dailyPrior = bundle.daily.filter((d) => d.date.slice(0, 10) < dateStr);
        if (dailyPrior.length < 15) continue;

        // 5m history strictly up to prior day
        const historical5m = bundle.grouped5m.filter((g) => g.dateStr < dateStr);

        const niftyDayCandles = niftyMap.get(dateStr);

        const feat = FeatureExtractor.extractFeaturesAt1015({
          symbol: bundle.symbol,
          day5mCandles: dayCandles,
          dailyCandlesPrior: dailyPrior,
          historical5mDays: historical5m,
          niftyDay5mCandles: niftyDayCandles,
        });

        if (!feat) continue;

        // Actual close at 15:30 IST (~09:55-10:00 UTC)
        const close1530 = dayCandles[dayCandles.length - 1].close;
        const price1015 = feat.priceAtPred;
        const actualReturn = price1015 > 0 ? (close1530 - price1015) / price1015 : 0;

        const labelUp = actualReturn >= threshold;
        const labelDown = actualReturn <= -threshold;

        items.push({
          dateStr,
          symbol: bundle.symbol,
          features: feat,
          price1015,
          close1530,
          actualReturn,
          labelUp,
          labelDown,
        });
      }

      if (items.length > 0) {
        daySamples.set(dateStr, items);
      }
    }

    // Walk forward day by day
    const model = new TransparentLogisticModel();

    for (let t = minHistoryDays; t < sortedDates.length; t++) {
      const testDateStr = sortedDates[t];
      const testItems = daySamples.get(testDateStr);
      if (!testItems || testItems.length < 5) continue;

      // 1. Gather all past training samples strictly up to day t - 1
      const trainingSamples: Array<{ features: StockFeatures; labelUp: boolean; labelDown: boolean }> = [];
      for (let p = 0; p < t; p++) {
        const pastDate = sortedDates[p];
        const pastItems = daySamples.get(pastDate);
        if (pastItems) {
          for (const item of pastItems) {
            trainingSamples.push({
              features: item.features,
              labelUp: item.labelUp,
              labelDown: item.labelDown,
            });
          }
        }
      }

      if (trainingSamples.length < 30) continue;

      // 2. Retrain model weights strictly on past samples (never shuffled)
      model.train(trainingSamples, { start: sortedDates[0], end: sortedDates[t - 1] }, 60, 0.05, 0.02);

      // 3. Score test day stocks at 10:15 IST
      const scored = testItems.map((item) => {
        const pred = model.predict(item.features);
        return {
          ...item,
          pred,
        };
      });

      // Top 5 UP picks
      const sortedUp = [...scored].sort((a, b) => b.pred.probUp - a.pred.probUp);
      const top5Up = sortedUp.slice(0, Math.min(5, sortedUp.length));

      // Top 5 DOWN picks
      const sortedDown = [...scored].sort((a, b) => b.pred.probDown - a.pred.probDown);
      const top5Down = sortedDown.slice(0, Math.min(5, sortedDown.length));

      // Baseline 2: Biggest early gainers (momentum: highest first30mReturn)
      const sortedMomentum = [...scored].sort((a, b) => b.features.first30mReturn - a.features.first30mReturn);
      const top5Momentum = sortedMomentum.slice(0, Math.min(5, sortedMomentum.length));

      let dayStrategyNetReturn = 0;
      let dayStrategyTrades = 0;
      let dayMomentumNetReturn = 0;
      let dayRandomNetReturn = 0;

      // Evaluate Top 5 UP
      for (const pick of top5Up) {
        if (pick.pred.probUp >= 0.50) {
          totalTop5UpPredictions++;
          const hit = pick.actualReturn >= threshold;
          if (hit) hitTop5Up++;

          const net = pick.actualReturn - cost;
          dayStrategyNetReturn += net;
          dayStrategyTrades++;

          // Calibration
          for (const b of calibrationBuckets) {
            if (pick.pred.probUp >= b.minProb && pick.pred.probUp < b.maxProb) {
              b.count++;
              if (hit) b.hits++;
              break;
            }
          }
        }
      }

      // Evaluate Top 5 DOWN
      for (const pick of top5Down) {
        if (pick.pred.probDown >= 0.50) {
          totalTop5DownPredictions++;
          const hit = pick.actualReturn <= -threshold;
          if (hit) hitTop5Down++;

          // Short position net return: -actualReturn - cost
          const net = -pick.actualReturn - cost;
          dayStrategyNetReturn += net;
          dayStrategyTrades++;

          // Calibration
          for (const b of calibrationBuckets) {
            if (pick.pred.probDown >= b.minProb && pick.pred.probDown < b.maxProb) {
              b.count++;
              if (hit) b.hits++;
              break;
            }
          }
        }
      }

      // Evaluate Baseline 2 (Momentum)
      for (const pick of top5Momentum) {
        momentumTotal++;
        const hit = pick.actualReturn >= threshold;
        if (hit) momentumHits++;
        dayMomentumNetReturn += pick.actualReturn - cost;
      }

      // Evaluate Baseline 1 (Random pick: take 5 uniformly distributed)
      const randomSubset = scored.slice(0, Math.min(5, scored.length));
      for (const pick of randomSubset) {
        randomTotal++;
        const hit = pick.actualReturn >= threshold;
        if (hit) randomHits++;
        dayRandomNetReturn += pick.actualReturn - cost;
      }

      if (dayStrategyTrades > 0) {
        const avgStratDay = dayStrategyNetReturn / dayStrategyTrades;
        cumStrategyReturn += avgStratDay;
        totalNetReturn += dayStrategyNetReturn;
        totalTradesCount += dayStrategyTrades;
      }
      if (top5Momentum.length > 0) {
        cumMomentumReturn += dayMomentumNetReturn / top5Momentum.length;
      }
      if (randomSubset.length > 0) {
        cumRandomReturn += dayRandomNetReturn / randomSubset.length;
      }

      equityCurve.push({
        date: testDateStr,
        strategyCumulativeReturn: Number((cumStrategyReturn * 100).toFixed(2)),
        momentumCumulativeReturn: Number((cumMomentumReturn * 100).toFixed(2)),
        randomCumulativeReturn: Number((cumRandomReturn * 100).toFixed(2)),
      });
    }

    const top5UpAccuracy = totalTop5UpPredictions > 0 ? (hitTop5Up / totalTop5UpPredictions) * 100 : 0;
    const top5DownAccuracy = totalTop5DownPredictions > 0 ? (hitTop5Down / totalTop5DownPredictions) * 100 : 0;
    const totalPicks = totalTop5UpPredictions + totalTop5DownPredictions;
    const totalHits = hitTop5Up + hitTop5Down;
    const top5CombinedPrecision = totalPicks > 0 ? (totalHits / totalPicks) * 100 : 0;

    const randomPickHitRate = randomTotal > 0 ? (randomHits / randomTotal) * 100 : 0;
    const momentumGainersHitRate = momentumTotal > 0 ? (momentumHits / momentumTotal) * 100 : 0;
    const strategyHitRate = top5CombinedPrecision;

    const netReturnPerTrade = totalTradesCount > 0 ? (totalNetReturn / totalTradesCount) * 100 : 0;

    const calibration = calibrationBuckets.map((b) => ({
      bucket: b.bucket,
      minProb: b.minProb,
      maxProb: b.maxProb,
      count: b.count,
      actualHitRate: b.count > 0 ? Number(((b.hits / b.count) * 100).toFixed(1)) : 0,
    }));

    return {
      trainingRange: {
        start: sortedDates[0],
        end: sortedDates[sortedDates.length - 1],
      },
      totalDays: sortedDates.length,
      totalSamples: totalTradesCount,
      top5UpAccuracy: Number(top5UpAccuracy.toFixed(1)),
      top5DownAccuracy: Number(top5DownAccuracy.toFixed(1)),
      top5CombinedPrecision: Number(top5CombinedPrecision.toFixed(1)),
      baselines: {
        randomPickHitRate: Number(randomPickHitRate.toFixed(1)),
        momentumGainersHitRate: Number(momentumGainersHitRate.toFixed(1)),
        strategyHitRate: Number(strategyHitRate.toFixed(1)),
      },
      netReturnPerTrade: Number(netReturnPerTrade.toFixed(2)),
      costRoundTripPct,
      moveThresholdPct,
      calibration,
      equityCurve,
      coefficients: model.getCoefficients(),
    };
  }
}
