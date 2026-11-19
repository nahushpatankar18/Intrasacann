import { MarketCandle, StockFeatures } from './types.js';
import { calculateEMA, calculateRSI, calculateATR, calculateVWAP, groupCandlesByIstDate } from './indicators.js';

export class FeatureExtractor {
  // Extract features for a stock on a specific day at 10:15 IST
  // No look-ahead: ONLY candles from 09:15 to 10:15 on that day, and daily candles strictly up to prior day!
  static extractFeaturesAt1015(params: {
    symbol: string;
    day5mCandles: MarketCandle[];
    dailyCandlesPrior: MarketCandle[];
    historical5mDays: Array<{ dateStr: string; candles: MarketCandle[] }>;
    niftyDay5mCandles?: MarketCandle[];
    vixCurrent?: number;
    vixChange?: number;
    newsSentiment?: number;
  }): StockFeatures | null {
    const {
      symbol,
      day5mCandles,
      dailyCandlesPrior,
      historical5mDays,
      niftyDay5mCandles,
      vixCurrent = 14.0,
      vixChange = 0.0,
      newsSentiment = 0.0,
    } = params;

    // Filter day's candles up to 10:15 IST (04:45 UTC)
    // 09:15 IST is 03:45 UTC (225 min from UTC 00:00), 10:15 IST is 04:45 UTC (285 min from UTC 00:00)
    const candlesTo1015 = day5mCandles.filter((c) => {
      const d = new Date(c.date);
      const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
      return utcMinutes >= 225 && utcMinutes <= 285;
    });

    if (candlesTo1015.length < 5) {
      // Thin data or missing early session candles - skip with null
      return null;
    }

    const open915 = candlesTo1015[0].open;
    const candle1015 = candlesTo1015[candlesTo1015.length - 1];
    const price1015 = candle1015.close;

    // First 30m candles: up to 09:45 IST (04:15 UTC = 255 min)
    const candles30m = candlesTo1015.filter((c) => {
      const d = new Date(c.date);
      const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
      return utcMinutes <= 255;
    });

    const price945 = candles30m.length > 0 ? candles30m[candles30m.length - 1].close : open915;
    const high30m = candles30m.length > 0 ? Math.max(...candles30m.map((c) => c.high)) : open915;
    const low30m = candles30m.length > 0 ? Math.min(...candles30m.map((c) => c.low)) : open915;

    // Prior day close
    let prevDayClose = open915;
    if (dailyCandlesPrior.length > 0) {
      prevDayClose = dailyCandlesPrior[dailyCandlesPrior.length - 1].close;
    }

    // Features:
    // 1. Opening gap vs previous close
    const openingGap = prevDayClose > 0 ? (open915 - prevDayClose) / prevDayClose : 0;

    // 2. First 30m return & range
    const first30mReturn = open915 > 0 ? (price945 - open915) / open915 : 0;
    const first30mRange = open915 > 0 ? (high30m - low30m) / open915 : 0;

    // 3. Distance from VWAP and from day open
    const vwap1015 = calculateVWAP(candlesTo1015);
    const distVWAP = vwap1015 > 0 ? (price1015 - vwap1015) / vwap1015 : 0;
    const distDayOpen = open915 > 0 ? (price1015 - open915) / open915 : 0;

    // 4. Volume vs 20-day average volume at the same time of day (to 10:15)
    const currentVol1015 = candlesTo1015.reduce((sum, c) => sum + c.volume, 0);
    let historicalPaceVols: number[] = [];

    for (const pastDay of historical5mDays.slice(-20)) {
      const pastCandles1015 = pastDay.candles.filter((c) => {
        const d = new Date(c.date);
        const m = d.getUTCHours() * 60 + d.getUTCMinutes();
        return m >= 225 && m <= 285;
      });
      const v = pastCandles1015.reduce((sum, c) => sum + c.volume, 0);
      if (v > 0) historicalPaceVols.push(v);
    }

    const avg20dVol = historicalPaceVols.length > 0
      ? historicalPaceVols.reduce((a, b) => a + b, 0) / historicalPaceVols.length
      : currentVol1015 || 1;

    const relVolume = avg20dVol > 0 ? currentVol1015 / avg20dVol : 1.0;

    // 5. RSI(14) and 20/50 EMA position on daily candles up to prior day
    const dailyCloses = dailyCandlesPrior.map((c) => c.close);
    const rsi14 = dailyCloses.length >= 15 ? calculateRSI(dailyCloses, 14) : 50;

    const ema20Arr = dailyCloses.length >= 20 ? calculateEMA(dailyCloses, 20) : [];
    const ema50Arr = dailyCloses.length >= 50 ? calculateEMA(dailyCloses, 50) : [];

    const ema20 = ema20Arr.length > 0 ? ema20Arr[ema20Arr.length - 1] : prevDayClose;
    const ema50 = ema50Arr.length > 0 ? ema50Arr[ema50Arr.length - 1] : prevDayClose;

    const ema20Dist = ema20 > 0 ? (prevDayClose - ema20) / ema20 : 0;
    const ema50Dist = ema50 > 0 ? (prevDayClose - ema50) / ema50 : 0;

    // 6. ATR-based volatility (expected daily range)
    const atr14 = dailyCandlesPrior.length >= 15 ? calculateATR(dailyCandlesPrior, 14) : prevDayClose * 0.015;
    const atrVolatility = prevDayClose > 0 ? atr14 / prevDayClose : 0.015;

    // 7. Stock's move relative to Nifty 50 (relative strength)
    let relativeStrength = 0;
    if (niftyDay5mCandles && niftyDay5mCandles.length > 0) {
      const nifty1015Candles = niftyDay5mCandles.filter((c) => {
        const d = new Date(c.date);
        const m = d.getUTCHours() * 60 + d.getUTCMinutes();
        return m >= 225 && m <= 285;
      });
      if (nifty1015Candles.length > 0) {
        const niftyOpen = nifty1015Candles[0].open;
        const niftyPrice1015 = nifty1015Candles[nifty1015Candles.length - 1].close;
        const niftyReturn = niftyOpen > 0 ? (niftyPrice1015 - niftyOpen) / niftyOpen : 0;
        const stockReturn = open915 > 0 ? (price1015 - open915) / open915 : 0;
        relativeStrength = stockReturn - niftyReturn;
      }
    }

    return {
      symbol,
      timestamp: candle1015.date,
      priceAtPred: Number(price1015.toFixed(2)),
      prevDayClose: Number(prevDayClose.toFixed(2)),
      dayOpen: Number(open915.toFixed(2)),
      openingGap: Number(openingGap.toFixed(4)),
      first30mReturn: Number(first30mReturn.toFixed(4)),
      first30mRange: Number(first30mRange.toFixed(4)),
      distVWAP: Number(distVWAP.toFixed(4)),
      distDayOpen: Number(distDayOpen.toFixed(4)),
      relVolume: Number(relVolume.toFixed(2)),
      rsi14: Number(rsi14.toFixed(1)),
      ema20Dist: Number(ema20Dist.toFixed(4)),
      ema50Dist: Number(ema50Dist.toFixed(4)),
      atrVolatility: Number(atrVolatility.toFixed(4)),
      relativeStrength: Number(relativeStrength.toFixed(4)),
      vixLevel: Number(vixCurrent.toFixed(2)),
      vixChange: Number(vixChange.toFixed(2)),
      newsSentiment: Number(newsSentiment.toFixed(2)),
    };
  }
}
