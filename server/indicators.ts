import { MarketCandle } from './types.js';

export function calculateEMA(closes: number[], period: number): number[] {
  if (closes.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = new Array(closes.length);
  
  // Initialize with SMA for the first 'period' values if available
  let sum = 0;
  const initialPeriod = Math.min(period, closes.length);
  for (let i = 0; i < initialPeriod; i++) {
    sum += closes[i];
  }
  ema[initialPeriod - 1] = sum / initialPeriod;

  for (let i = 0; i < initialPeriod - 1; i++) {
    ema[i] = closes[i];
  }

  for (let i = initialPeriod; i < closes.length; i++) {
    ema[i] = closes[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function calculateATR(candles: MarketCandle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs.push(tr);
  }

  if (trs.length < period) {
    const sum = trs.reduce((a, b) => a + b, 0);
    return sum / (trs.length || 1);
  }

  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

export function calculateVWAP(candles: MarketCandle[]): number {
  let totalPV = 0;
  let totalVol = 0;

  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    totalPV += typicalPrice * c.volume;
    totalVol += c.volume;
  }

  if (totalVol === 0) {
    return candles.length > 0 ? candles[candles.length - 1].close : 0;
  }
  return totalPV / totalVol;
}

export interface DayCandlesGroup {
  dateStr: string; // YYYY-MM-DD
  candles: MarketCandle[];
}

// Group 5-minute candles by trading date (IST date)
export function groupCandlesByIstDate(candles: MarketCandle[]): DayCandlesGroup[] {
  const groups = new Map<string, MarketCandle[]>();

  for (const c of candles) {
    const dateObj = new Date(c.date);
    // Convert to IST
    const istMs = dateObj.getTime() + 5.5 * 3600000;
    const istDate = new Date(istMs);
    const dateStr = istDate.toISOString().slice(0, 10);

    if (!groups.has(dateStr)) {
      groups.set(dateStr, []);
    }
    groups.get(dateStr)!.push(c);
  }

  const result: DayCandlesGroup[] = [];
  for (const [dateStr, dayCandles] of groups.entries()) {
    // Sort candles chronologically
    dayCandles.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    result.push({ dateStr, candles: dayCandles });
  }

  return result.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

// Extract IST minutes of day from candle ISO date
export function getIstMinuteOfDay(candleDate: string): number {
  const d = new Date(candleDate);
  const istMs = d.getTime() + 5.5 * 3600000;
  const istDate = new Date(istMs);
  return istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
}
