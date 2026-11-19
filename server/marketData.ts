import YahooFinance from 'yahoo-finance2';
import { MarketCandle } from './types.js';
import { BENCHMARKS } from './config/stocks.js';

// Instantiate YahooFinance client
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// In-memory cache entry
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

// Simple concurrency queue / throttle
let activeRequests = 0;
const MAX_CONCURRENT = 4;
const queue: (() => void)[] = [];

function acquireThrottle(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    queue.push(resolve);
  });
}

function releaseThrottle(): void {
  activeRequests--;
  if (queue.length > 0 && activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    const next = queue.shift();
    if (next) next();
  }
}

// Retry with exponential backoff
async function withRetry<T>(
  task: () => Promise<T>,
  retries = 3,
  delayMs = 600,
  contextDesc = 'operation'
): Promise<T> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      await acquireThrottle();
      try {
        return await task();
      } finally {
        releaseThrottle();
      }
    } catch (err: any) {
      attempt++;
      if (attempt > retries) {
        const errorMsg = err?.message || String(err);
        throw new Error(`Yahoo Finance failure for ${contextDesc} after ${retries} retries: ${errorMsg}`);
      }
      const wait = delayMs * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error(`Failed to execute ${contextDesc}`);
}

export class MarketDataService {
  // Clear cache manually if required
  static clearCache(): void {
    cache.clear();
  }

  // Fetch 5-minute candles (~55-60 days max supported by Yahoo)
  static async get5mCandles(symbol: string, forceRefresh = false): Promise<MarketCandle[]> {
    const cacheKey = `5m_${symbol}`;
    const cached = cache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const startDate = new Date(Date.now() - 55 * 24 * 3600 * 1000);
    const result = await withRetry(
      async () => {
        const res = await yf.chart(symbol, {
          period1: startDate,
          interval: '5m',
        });
        return res;
      },
      3,
      700,
      `5m candles (${symbol})`
    );

    if (!result || !result.quotes || result.quotes.length === 0) {
      throw new Error(`No 5-minute market data returned for ${symbol}`);
    }

    const validQuotes: MarketCandle[] = result.quotes
      .filter((q) => q.open !== null && q.close !== null && q.high !== null && q.low !== null && q.volume !== null)
      .map((q) => ({
        date: new Date(q.date).toISOString(),
        open: Number(q.open),
        high: Number(q.high),
        low: Number(q.low),
        close: Number(q.close),
        volume: Number(q.volume || 0),
        adjclose: q.adjclose ? Number(q.adjclose) : Number(q.close),
      }));

    cache.set(cacheKey, { data: validQuotes, timestamp: Date.now() });
    return validQuotes;
  }

  // Fetch daily candles (~2 years)
  static async getDailyCandles(symbol: string, forceRefresh = false): Promise<MarketCandle[]> {
    const cacheKey = `1d_${symbol}`;
    const cached = cache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const startDate = new Date(Date.now() - 730 * 24 * 3600 * 1000); // 2 years
    const result = await withRetry(
      async () => {
        const res = await yf.chart(symbol, {
          period1: startDate,
          interval: '1d',
        });
        return res;
      },
      3,
      600,
      `1d candles (${symbol})`
    );

    if (!result || !result.quotes || result.quotes.length === 0) {
      throw new Error(`No daily market data returned for ${symbol}`);
    }

    const validQuotes: MarketCandle[] = result.quotes
      .filter((q) => q.open !== null && q.close !== null && q.high !== null && q.low !== null)
      .map((q) => ({
        date: new Date(q.date).toISOString(),
        open: Number(q.open),
        high: Number(q.high),
        low: Number(q.low),
        close: Number(q.close),
        volume: Number(q.volume || 0),
        adjclose: q.adjclose ? Number(q.adjclose) : Number(q.close),
      }));

    cache.set(cacheKey, { data: validQuotes, timestamp: Date.now() });
    return validQuotes;
  }

  // Fetch latest quote for a symbol
  static async getQuote(symbol: string): Promise<{ price: number; change: number; changePct: number; prevClose: number }> {
    const cacheKey = `quote_${symbol}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const quote = await withRetry(
      async () => {
        return await yf.quote(symbol);
      },
      3,
      500,
      `quote (${symbol})`
    );

    const price = quote.regularMarketPrice || quote.postMarketPrice || 0;
    const prevClose = quote.regularMarketPreviousClose || price;
    const change = quote.regularMarketChange || (price - prevClose);
    const changePct = quote.regularMarketChangePercent || (prevClose ? (change / prevClose) * 100 : 0);

    const data = { price, change, changePct, prevClose };
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  // Fetch market benchmarks (Nifty 50 and India VIX)
  static async getMarketContext(): Promise<{
    nifty: { price: number; change: number; changePct: number; prevClose: number };
    vix: { price: number; change: number; changePct: number; prevClose: number };
  }> {
    const [nifty, vix] = await Promise.all([
      this.getQuote(BENCHMARKS.NIFTY_50),
      this.getQuote(BENCHMARKS.INDIA_VIX),
    ]);
    return { nifty, vix };
  }
}
