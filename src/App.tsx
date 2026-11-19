import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { LivePredictionsTab } from './components/LivePredictionsTab';
import { ScoreboardTab } from './components/ScoreboardTab';
import { BacktestTab } from './components/BacktestTab';
import { NewsTab } from './components/NewsTab';
import { SettingsTab } from './components/SettingsTab';
import {
  MarketStatus,
  PredictionRecord,
  BacktestResult,
  NewsItem,
  AppSettings,
  StockConstituent,
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'predictions' | 'scoreboard' | 'backtest' | 'news' | 'settings'>('predictions');

  // App State
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [top5Up, setTop5Up] = useState<PredictionRecord[]>([]);
  const [top5Down, setTop5Down] = useState<PredictionRecord[]>([]);
  const [allRanked, setAllRanked] = useState<PredictionRecord[]>([]);
  const [lastRunTimestamp, setLastRunTimestamp] = useState<string | undefined>();
  const [lastRunId, setLastRunId] = useState<string | undefined>();
  const [skippedStocks, setSkippedStocks] = useState<Array<{ symbol: string; reason: string }>>([]);

  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [constituents, setConstituents] = useState<StockConstituent[]>([]);

  // Loading States
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isRetraining, setIsRetraining] = useState(false);
  const [loadingBacktest, setLoadingBacktest] = useState(false);
  const [isRefreshingNews, setIsRefreshingNews] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Global Error State
  const [globalError, setGlobalError] = useState<string | null>(null);

  // 1. Fetch Market Status
  const fetchStatus = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`Status HTTP ${res.status}`);
      const data = await res.json();
      setMarketStatus(data);
    } catch (err: any) {
      console.warn('Failed to fetch status:', err);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // 2. Fetch Logged Predictions
  const fetchPredictions = useCallback(async () => {
    try {
      const res = await fetch('/api/predictions');
      if (!res.ok) throw new Error(`Predictions HTTP ${res.status}`);
      const data = await res.json();
      setPredictions(data);

      // Populate latest live view from predictions if available
      if (data.length > 0) {
        const latestRunId = data[0].runId;
        const latestRunItems = data.filter((p: PredictionRecord) => p.runId === latestRunId);
        const up = latestRunItems.filter((p: PredictionRecord) => p.direction === 'UP').slice(0, 5);
        const down = latestRunItems.filter((p: PredictionRecord) => p.direction === 'DOWN').slice(0, 5);

        setTop5Up(up);
        setTop5Down(down);
        setAllRanked(latestRunItems);
        setLastRunTimestamp(data[0].timestamp);
        setLastRunId(latestRunId);
      }
    } catch (err: any) {
      console.error('Failed to fetch predictions:', err);
    }
  }, []);

  // 3. Fetch Settings & Universe
  const fetchSettingsAndUniverse = useCallback(async () => {
    try {
      const [settRes, stockRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/stocks'),
      ]);
      if (settRes.ok) {
        const sett = await settRes.json();
        setSettings(sett);
      }
      if (stockRes.ok) {
        const stockData = await stockRes.json();
        setConstituents(stockData.constituents || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch settings/universe:', err);
    }
  }, []);

  // 4. Fetch News
  const fetchNews = useCallback(async (force = false) => {
    try {
      setIsRefreshingNews(true);
      const res = await fetch(`/api/news${force ? '?refresh=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        setNews(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch news:', err);
    } finally {
      setIsRefreshingNews(false);
    }
  }, []);

  // 5. Fetch Backtest
  const fetchBacktest = useCallback(async () => {
    try {
      setLoadingBacktest(true);
      const res = await fetch('/api/backtest');
      if (res.ok) {
        const data = await res.json();
        setBacktest(data);
      }
    } catch (err: any) {
      console.warn('Failed to fetch initial backtest:', err);
    } finally {
      setLoadingBacktest(false);
    }
  }, []);

  // Initial Boot
  useEffect(() => {
    fetchStatus();
    fetchPredictions();
    fetchSettingsAndUniverse();
    fetchNews();
    fetchBacktest();

    // Periodic market clock refresh every 30s
    const interval = setInterval(() => {
      fetchStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchPredictions, fetchSettingsAndUniverse, fetchNews, fetchBacktest]);

  // Actions
  const handleRunAnalysis = async (manualOverride: boolean) => {
    try {
      setIsRunningAnalysis(true);
      setGlobalError(null);
      const res = await fetch('/api/predictions/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualOverride }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned error ${res.status}`);
      }

      const result = await res.json();
      setTop5Up(result.top5Up);
      setTop5Down(result.top5Down);
      setAllRanked(result.allRanked);
      setLastRunTimestamp(result.timestamp);
      setLastRunId(result.runId);
      setSkippedStocks(result.skippedStocks || []);

      // Refresh master predictions ledger
      await fetchPredictions();
    } catch (err: any) {
      console.error('Run analysis failed:', err);
      setGlobalError(err.message || 'Failed to complete analysis');
    } finally {
      setIsRunningAnalysis(false);
    }
  };

  const handleEvaluateOutcomes = async () => {
    try {
      setIsEvaluating(true);
      setGlobalError(null);
      const res = await fetch('/api/predictions/evaluate', {
        method: 'POST',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Evaluation error ${res.status}`);
      }
      const data = await res.json();
      if (data.predictions) {
        setPredictions(data.predictions);
      }
      if (data.errors && data.errors.length > 0) {
        setGlobalError(`Outcome evaluation notes: ${data.errors.slice(0, 2).join('; ')}`);
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to evaluate outcomes');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRetrainModel = async () => {
    try {
      setIsRetraining(true);
      setGlobalError(null);
      const res = await fetch('/api/model/retrain', {
        method: 'POST',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Retraining error ${res.status}`);
      }
      const data = await res.json();
      if (data.result) {
        setBacktest(data.result);
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to retrain walk-forward model');
    } finally {
      setIsRetraining(false);
    }
  };

  const handleSaveSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      setIsSavingSettings(true);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
      }
    } catch (err: any) {
      setGlobalError('Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Header */}
      <Header
        status={marketStatus}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefreshStatus={fetchStatus}
        loadingStatus={loadingStatus}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {activeTab === 'predictions' && (
          <LivePredictionsTab
            status={marketStatus}
            onRunAnalysis={handleRunAnalysis}
            isRunning={isRunningAnalysis}
            top5Up={top5Up}
            top5Down={top5Down}
            allRanked={allRanked}
            lastRunTimestamp={lastRunTimestamp}
            lastRunId={lastRunId}
            skippedStocks={skippedStocks}
            errorMessage={globalError}
          />
        )}

        {activeTab === 'scoreboard' && (
          <ScoreboardTab
            predictions={predictions}
            onEvaluateOutcomes={handleEvaluateOutcomes}
            isEvaluating={isEvaluating}
            costRoundTripPct={settings?.costRoundTripPct || 0.1}
            moveThresholdPct={settings?.moveThresholdPct || 1.0}
          />
        )}

        {activeTab === 'backtest' && (
          <BacktestTab
            backtest={backtest}
            loading={loadingBacktest}
            onRetrain={handleRetrainModel}
            isRetraining={isRetraining}
          />
        )}

        {activeTab === 'news' && (
          <NewsTab
            news={news}
            onRefreshNews={() => fetchNews(true)}
            isRefreshing={isRefreshingNews}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            constituents={constituents}
            onSaveSettings={handleSaveSettings}
            isSaving={isSavingSettings}
          />
        )}
      </main>

      {/* Footer with Persistent Legal & Educational Disclaimer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 px-4 py-6 text-xs text-zinc-400 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-2">
              <span className="font-bold text-zinc-300">IntraScan Quant Research Engine</span>
              <span>•</span>
              <span>NSE Nifty 50 constituents</span>
            </div>
            <p className="text-zinc-400">
              Personal research tool for educational purposes only. Not investment advice or trading recommendation.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-zinc-400 font-mono">
            <span>IST (UTC + 5:30)</span>
            <span>•</span>
            <span>Market Data: Yahoo Finance (Real)</span>
            <span>•</span>
            <span>Sentiment: Gemini 3.8 Flash</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
