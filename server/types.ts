export interface StockConstituent {
  symbol: string;         // e.g. "RELIANCE.NS"
  name: string;           // e.g. "Reliance Industries Ltd."
  sector: string;         // e.g. "Energy & Petrochemicals"
}

export interface MarketCandle {
  date: string;           // ISO timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjclose?: number;
}

export interface StockFeatures {
  symbol: string;
  timestamp: string;      // IST timestamp
  priceAtPred: number;
  prevDayClose: number;
  dayOpen: number;
  openingGap: number;     // (open - prevClose) / prevClose
  first30mReturn: number; // (price_945 - open) / open
  first30mRange: number;  // (high_30m - low_30m) / open
  distVWAP: number;       // (price_1015 - vwap_1015) / vwap_1015
  distDayOpen: number;    // (price_1015 - open) / open
  relVolume: number;      // 10:15 volume / 20d avg volume at 10:15
  rsi14: number;          // RSI(14) on daily candles
  ema20Dist: number;      // (close - ema20) / ema20
  ema50Dist: number;      // (close - ema50) / ema50
  atrVolatility: number;  // atr14 / close
  relativeStrength: number; // stock move to 10:15 - nifty move to 10:15
  vixLevel: number;       // India VIX current
  vixChange: number;      // India VIX day change
  newsSentiment: number;  // -1 to +1 weighted average
}

export interface FeatureContribution {
  featureName: string;
  label: string;
  value: number;
  contribution: number;   // weight * normalized value
  direction: 'bullish' | 'bearish' | 'neutral';
}

export interface PredictionRecord {
  id: string;             // unique UUID
  runId: string;          // grouped run ID
  timestamp: string;      // IST ISO string
  date: string;           // YYYY-MM-DD
  symbol: string;
  companyName: string;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  probUp: number;         // 0 to 1
  probDown: number;       // 0 to 1
  confidence: number;     // max(probUp, probDown)
  rank: number;           // rank within run
  priceAtPred: number;
  features: StockFeatures;
  featureContributions: FeatureContribution[];
  keyReasons: string[];
  recentHeadlines: Array<{
    title: string;
    source: string;
    sentiment: number;
    reason: string;
  }>;
  // Outcome fields resolved after market close
  actualClose?: number;
  actualReturn?: number;  // (actualClose - priceAtPred) / priceAtPred
  outcome?: 'HIT' | 'MISS' | 'FLAT' | 'PENDING';
  paperPnlPct?: number;   // return after cost
  evaluatedAt?: string;   // IST timestamp when evaluated
}

export interface AppSettings {
  costRoundTripPct: number;    // default 0.1%
  moveThresholdPct: number;    // default 1.0%
  predictionTimeIst: string;   // default "10:15"
  stockSymbols: string[];
}

export interface NewsItem {
  id: string;
  symbol?: string;
  companyName?: string;
  title: string;
  link: string;
  source: string;
  pubDate: string;             // IST
  sentiment: number;           // -1.0 to 1.0
  reason: string;
}

export interface MarketStatus {
  istTime: string;
  istDate: string;
  isTradingDay: boolean;
  marketSession: 'pre_open' | 'early_session' | 'prediction_ready' | 'regular_trading' | 'market_closed' | 'weekend_holiday';
  nifty50: {
    symbol: string;
    price: number;
    change: number;
    changePct: number;
  };
  indiaVix: {
    symbol: string;
    price: number;
    change: number;
    changePct: number;
  };
}

export interface BacktestResult {
  trainingRange: { start: string; end: string };
  totalDays: number;
  totalSamples: number;
  top5UpAccuracy: number;
  top5DownAccuracy: number;
  top5CombinedPrecision: number;
  baselines: {
    randomPickHitRate: number;
    momentumGainersHitRate: number;
    strategyHitRate: number;
  };
  netReturnPerTrade: number;
  costRoundTripPct: number;
  moveThresholdPct: number;
  calibration: Array<{
    bucket: string;
    minProb: number;
    maxProb: number;
    count: number;
    actualHitRate: number;
  }>;
  equityCurve: Array<{
    date: string;
    strategyCumulativeReturn: number;
    momentumCumulativeReturn: number;
    randomCumulativeReturn: number;
  }>;
  coefficients: Record<string, { weightUp: number; weightDown: number; label: string }>;
}
