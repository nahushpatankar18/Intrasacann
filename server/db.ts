import fs from 'fs';
import path from 'path';
import { PredictionRecord, AppSettings, NewsItem, BacktestResult } from './types.js';
import { NIFTY_50_CONSTITUENTS } from './config/stocks.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');

const PREDICTIONS_FILE = path.join(DATA_DIR, 'predictions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const MODEL_FILE = path.join(DATA_DIR, 'model.json');
const NEWS_FILE = path.join(DATA_DIR, 'news_cache.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeReadJson<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as T;
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return defaultValue;
}

function safeWriteJson<T>(filePath: string, data: T): void {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  }
}

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  costRoundTripPct: 0.1,    // 0.1% round-trip trading cost
  moveThresholdPct: 1.0,    // 1.0% intraday move threshold for UP/DOWN
  predictionTimeIst: '10:15',
  stockSymbols: NIFTY_50_CONSTITUENTS.map(s => s.symbol),
};

export class Database {
  // --- Predictions ---
  static getPredictions(): PredictionRecord[] {
    const list = safeReadJson<PredictionRecord[]>(PREDICTIONS_FILE, []);
    // Sort descending by timestamp
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Immutable append: once written, inputs cannot be altered or removed
  static appendPredictions(newPredictions: PredictionRecord[]): void {
    const existing = safeReadJson<PredictionRecord[]>(PREDICTIONS_FILE, []);
    const existingIds = new Set(existing.map(p => p.id));
    const toAdd = newPredictions.filter(p => !existingIds.has(p.id));
    const combined = [...existing, ...toAdd];
    safeWriteJson(PREDICTIONS_FILE, combined);
  }

  // Outcome resolution: updates only outcome/close fields
  static updatePredictionOutcomes(
    updates: Map<string, { actualClose: number; actualReturn: number; outcome: 'HIT' | 'MISS' | 'FLAT'; paperPnlPct: number; evaluatedAt: string }>
  ): number {
    const existing = safeReadJson<PredictionRecord[]>(PREDICTIONS_FILE, []);
    let updatedCount = 0;
    const modified = existing.map(p => {
      const upd = updates.get(p.id);
      if (upd && (!p.actualClose || p.outcome === 'PENDING')) {
        updatedCount++;
        return {
          ...p,
          actualClose: upd.actualClose,
          actualReturn: upd.actualReturn,
          outcome: upd.outcome,
          paperPnlPct: upd.paperPnlPct,
          evaluatedAt: upd.evaluatedAt,
        };
      }
      return p;
    });

    if (updatedCount > 0) {
      safeWriteJson(PREDICTIONS_FILE, modified);
    }
    return updatedCount;
  }

  // Generate CSV string
  static exportPredictionsCsv(): string {
    const predictions = this.getPredictions();
    const headers = [
      'id',
      'runId',
      'timestamp_ist',
      'date',
      'symbol',
      'company_name',
      'direction',
      'prob_up',
      'prob_down',
      'confidence',
      'price_at_prediction',
      'actual_close',
      'actual_return_pct',
      'outcome',
      'paper_pnl_pct_after_cost',
      'opening_gap_pct',
      'first_30m_return_pct',
      'dist_vwap_pct',
      'rel_volume',
      'daily_rsi14',
      'relative_strength_vs_nifty',
      'news_sentiment',
      'evaluated_at_ist'
    ];

    const rows = predictions.map(p => [
      `"${p.id}"`,
      `"${p.runId}"`,
      `"${p.timestamp}"`,
      `"${p.date}"`,
      `"${p.symbol}"`,
      `"${p.companyName.replace(/"/g, '""')}"`,
      `"${p.direction}"`,
      (p.probUp * 100).toFixed(2),
      (p.probDown * 100).toFixed(2),
      (p.confidence * 100).toFixed(2),
      p.priceAtPred.toFixed(2),
      p.actualClose !== undefined ? p.actualClose.toFixed(2) : '',
      p.actualReturn !== undefined ? (p.actualReturn * 100).toFixed(2) : '',
      `"${p.outcome || 'PENDING'}"`,
      p.paperPnlPct !== undefined ? p.paperPnlPct.toFixed(2) : '',
      p.features ? (p.features.openingGap * 100).toFixed(2) : '',
      p.features ? (p.features.first30mReturn * 100).toFixed(2) : '',
      p.features ? (p.features.distVWAP * 100).toFixed(2) : '',
      p.features ? p.features.relVolume.toFixed(2) : '',
      p.features ? p.features.rsi14.toFixed(1) : '',
      p.features ? (p.features.relativeStrength * 100).toFixed(2) : '',
      p.features ? p.features.newsSentiment.toFixed(2) : '',
      `"${p.evaluatedAt || ''}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // --- Settings ---
  static getSettings(): AppSettings {
    return safeReadJson<AppSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);
  }

  static saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated: AppSettings = { ...current, ...settings };
    safeWriteJson(SETTINGS_FILE, updated);
    return updated;
  }

  // --- News Cache ---
  static getNews(): NewsItem[] {
    return safeReadJson<NewsItem[]>(NEWS_FILE, []);
  }

  static saveNews(news: NewsItem[]): void {
    // Keep last 300 news items
    const limited = news.slice(0, 300);
    safeWriteJson(NEWS_FILE, limited);
  }

  // --- Model Weights & Cache ---
  static getSavedModel(): any {
    return safeReadJson<any>(MODEL_FILE, null);
  }

  static saveModel(modelData: any): void {
    safeWriteJson(MODEL_FILE, modelData);
  }
}
