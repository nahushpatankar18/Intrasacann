export interface StockConstituent {
  symbol: string;
  name: string;
  sector: string;
}

export interface StockFeatures {
  symbol: string;
  timestamp: string;
  priceAtPred: number;
  prevDayClose: number;
  dayOpen: number;
  openingGap: number;
  first30mReturn: number;
  first30mRange: number;
  distVWAP: number;
  distDayOpen: number;
  relVolume: number;
  rsi14: number;
  ema20Dist: number;
  ema50Dist: number;
  atrVolatility: number;
  relativeStrength: number;
  vixLevel: number;
  vixChange: number;
  newsSentiment: number;
}

export interface FeatureContribution {
  featureName: string;
  label: string;
  value: number;
  contribution: number;
  direction: 'bullish' | 'bearish' | 'neutral';
}

export interface PredictionRecord {
  id: string;
  runId: string;
  timestamp: string;
  date: string;
  symbol: string;
  companyName: string;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  probUp: number;
  probDown: number;
  confidence: number;
  rank: number;
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
  actualClose?: number;
  actualReturn?: number;
  outcome?: 'HIT' | 'MISS' | 'FLAT' | 'PENDING';
  paperPnlPct?: number;
  evaluatedAt?: string;
}

export interface AppSettings {
  costRoundTripPct: number;
  moveThresholdPct: number;
  predictionTimeIst: string;
  stockSymbols: string[];
}

export interface NewsItem {
  id: string;
  symbol?: string;
  companyName?: string;
  title: string;
  link: string;
  source: string;
  pubDate: string;
  sentiment: number;
  reason: string;
}

export interface MarketStatus {
  istTime: string;
  istDate: string;
  session: 'pre_open' | 'early_session' | 'prediction_ready' | 'regular_trading' | 'market_closed' | 'weekend_holiday';
  sessionMessage: string;
  isAllowedToPredict: boolean;
  nifty50: {
    symbol?: string;
    price: number;
    change: number;
    changePct: number;
  };
  indiaVix: {
    symbol?: string;
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
