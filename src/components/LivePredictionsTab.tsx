import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Play,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Newspaper,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PredictionRecord, MarketStatus } from '../types';

interface LivePredictionsTabProps {
  status: MarketStatus | null;
  onRunAnalysis: (manualOverride: boolean) => Promise<void>;
  isRunning: boolean;
  top5Up: PredictionRecord[];
  top5Down: PredictionRecord[];
  allRanked: PredictionRecord[];
  lastRunTimestamp?: string;
  lastRunId?: string;
  skippedStocks?: Array<{ symbol: string; reason: string }>;
  errorMessage?: string | null;
}

export const LivePredictionsTab: React.FC<LivePredictionsTabProps> = ({
  status,
  onRunAnalysis,
  isRunning,
  top5Up,
  top5Down,
  allRanked,
  lastRunTimestamp,
  lastRunId,
  skippedStocks = [],
  errorMessage,
}) => {
  const [manualOverride, setManualOverride] = useState(false);
  const [showAllUniverse, setShowAllUniverse] = useState(false);
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null);

  const isEligibleToRun = status?.isAllowedToPredict || manualOverride;

  const toggleExpand = (id: string) => {
    setExpandedStockId(expandedStockId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Error Banner if any Yahoo or data failure occurred */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-rose-200 text-sm">Market Data Fetch Error</h4>
            <p className="text-xs text-rose-300/90">{errorMessage}</p>
            <p className="text-[11px] text-zinc-400">
              IntraScan never silently fabricates fake market data. When upstream providers throttle or fail, real status is exposed directly.
            </p>
          </div>
        </div>
      )}

      {/* Control Banner Card */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Intraday Probability Engine (10:15 IST Window)
              </h2>
            </div>
            <p className="text-xs text-zinc-400 max-w-2xl">
              Constructs 14 strictly non-lookahead features at 10:15 IST (opening gap, VWAP distance, 30m return, volume pace, daily RSI/EMAs, ATR volatility, relative strength vs Nifty, and Gemini news sentiment) to score directional probability.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Manual Override switch */}
            <label className="flex items-center space-x-2 text-xs text-zinc-400 cursor-pointer bg-zinc-950/80 px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 select-none">
              <input
                type="checkbox"
                checked={manualOverride}
                onChange={(e) => setManualOverride(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Manual Test Mode (Bypass 10:15 IST Gate)</span>
            </label>

            {/* Run Analysis Button */}
            <button
              onClick={() => onRunAnalysis(manualOverride)}
              disabled={isRunning || !isEligibleToRun}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition shadow-lg ${
                isEligibleToRun && !isRunning
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/10'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
              }`}
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Analyzing Universe...' : 'Run 10:15 Analysis'}</span>
            </button>
          </div>
        </div>

        {/* Status / Last Run bar */}
        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center space-x-2">
            <Info className="w-3.5 h-3.5 text-zinc-400" />
            <span>
              {status?.sessionMessage || 'Awaiting market session information...'}
            </span>
          </div>

          {lastRunTimestamp && (
            <div className="flex items-center space-x-3 text-[11px] font-mono">
              <span className="text-zinc-400">Last Scored:</span>
              <span className="text-zinc-200">{new Date(lastRunTimestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
              {lastRunId && <span className="text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">ID: {lastRunId.slice(0, 14)}</span>}
            </div>
          )}
        </div>

        {/* Skipped stocks notice if any */}
        {skippedStocks.length > 0 && (
          <div className="mt-3 p-2.5 bg-amber-950/20 border border-amber-800/40 rounded text-xs text-amber-300/80 flex items-center justify-between">
            <span>Skipped {skippedStocks.length} stock(s) due to missing 10:15 opening candles: {skippedStocks.map(s => s.symbol.replace('.NS', '')).join(', ')}</span>
            <span className="text-[11px] text-amber-400/60 font-mono">Zero lookahead guard active</span>
          </div>
        )}
      </div>

      {/* Main Two Ranked Cards: Top 5 UP and Top 5 DOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOP 5 LIKELY UP */}
        <div className="bg-zinc-900/40 border border-emerald-900/30 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-emerald-950/20 border-b border-emerald-900/30 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <h3 className="font-bold text-sm text-emerald-300">Top 5 Intraday UP Candidates</h3>
            </div>
            <span className="text-[11px] font-mono font-medium text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Threshold: &gt;=+1.0% by Close
            </span>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {top5Up.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No active UP predictions generated yet. Click &quot;Run 10:15 Analysis&quot; above to scan the Nifty 50 constituents.
              </div>
            ) : (
              top5Up.map((stock, idx) => (
                <div key={stock.id} className="p-4 hover:bg-zinc-900/60 transition">
                  <div className="flex items-start justify-between gap-4">
                    {/* Rank & Stock Info */}
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center font-mono shrink-0 mt-0.5">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-sm tracking-tight">{stock.symbol.replace('.NS', '')}</span>
                          <span className="text-[11px] text-zinc-400 font-normal truncate max-w-[150px]">{stock.companyName}</span>
                        </div>
                        <div className="text-xs text-zinc-400 font-mono mt-0.5">
                          Price @ 10:15: <span className="text-zinc-200 font-semibold">₹{stock.priceAtPred.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Probability Meter */}
                    <div className="text-right shrink-0">
                      <div className="flex items-baseline justify-end space-x-1.5">
                        <span className="text-[11px] text-zinc-400 uppercase font-semibold">P(UP):</span>
                        <span className="text-base font-extrabold text-emerald-400 font-mono">
                          {(stock.probUp * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1 ml-auto">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, stock.probUp * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Key Reasons Tags */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {stock.keyReasons.map((reason, rIdx) => (
                      <span
                        key={rIdx}
                        className="inline-flex items-center text-[11px] bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-emerald-400 mr-1" />
                        {reason}
                      </span>
                    ))}
                  </div>

                  {/* Headline snippet if available */}
                  {stock.recentHeadlines && stock.recentHeadlines.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-zinc-900 flex items-start space-x-2 text-[11px] text-zinc-400">
                      <Newspaper className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
                      <div className="truncate">
                        <span className="text-zinc-300 font-medium">{stock.recentHeadlines[0].title}</span>
                        <span className="ml-1.5 text-emerald-400 font-mono text-[10px]">
                          [{stock.recentHeadlines[0].source} • Sentiment: {stock.recentHeadlines[0].sentiment > 0 ? '+' : ''}{stock.recentHeadlines[0].sentiment.toFixed(2)}]
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Expand technical feature contributions breakdown */}
                  <button
                    onClick={() => toggleExpand(stock.id)}
                    className="mt-2 text-[11px] text-zinc-400 hover:text-emerald-400 flex items-center space-x-1 transition"
                  >
                    <span>{expandedStockId === stock.id ? 'Hide Feature Breakdown' : 'Show 14-Feature Weights Breakdown'}</span>
                    {expandedStockId === stock.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {expandedStockId === stock.id && (
                    <div className="mt-3 p-3 bg-zinc-950 rounded-lg border border-zinc-800/80 space-y-2">
                      <h5 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                        Feature Contributions (Normalized Linear Component)
                      </h5>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        {stock.featureContributions?.map((fc, fcIdx) => (
                          <div key={fcIdx} className="flex justify-between items-center bg-zinc-900/60 px-2 py-1 rounded">
                            <span className="text-zinc-400 truncate max-w-[130px]">{fc.label}:</span>
                            <span className={fc.contribution > 0 ? 'text-emerald-400 font-bold' : fc.contribution < 0 ? 'text-rose-400 font-bold' : 'text-zinc-400'}>
                              {fc.contribution > 0 ? '+' : ''}{fc.contribution.toFixed(3)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* TOP 5 LIKELY DOWN */}
        <div className="bg-zinc-900/40 border border-rose-900/30 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-rose-950/20 border-b border-rose-900/30 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <h3 className="font-bold text-sm text-rose-300">Top 5 Intraday DOWN Candidates</h3>
            </div>
            <span className="text-[11px] font-mono font-medium text-rose-400/90 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
              Threshold: &lt;=-1.0% by Close
            </span>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {top5Down.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No active DOWN predictions generated yet. Click &quot;Run 10:15 Analysis&quot; above to scan the Nifty 50 constituents.
              </div>
            ) : (
              top5Down.map((stock, idx) => (
                <div key={stock.id} className="p-4 hover:bg-zinc-900/60 transition">
                  <div className="flex items-start justify-between gap-4">
                    {/* Rank & Stock Info */}
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center justify-center font-mono shrink-0 mt-0.5">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-sm tracking-tight">{stock.symbol.replace('.NS', '')}</span>
                          <span className="text-[11px] text-zinc-400 font-normal truncate max-w-[150px]">{stock.companyName}</span>
                        </div>
                        <div className="text-xs text-zinc-400 font-mono mt-0.5">
                          Price @ 10:15: <span className="text-zinc-200 font-semibold">₹{stock.priceAtPred.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Probability Meter */}
                    <div className="text-right shrink-0">
                      <div className="flex items-baseline justify-end space-x-1.5">
                        <span className="text-[11px] text-zinc-400 uppercase font-semibold">P(DOWN):</span>
                        <span className="text-base font-extrabold text-rose-400 font-mono">
                          {(stock.probDown * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1 ml-auto">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${Math.min(100, stock.probDown * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Key Reasons Tags */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {stock.keyReasons.map((reason, rIdx) => (
                      <span
                        key={rIdx}
                        className="inline-flex items-center text-[11px] bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-zinc-300"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-rose-400 mr-1" />
                        {reason}
                      </span>
                    ))}
                  </div>

                  {/* Headline snippet if available */}
                  {stock.recentHeadlines && stock.recentHeadlines.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-zinc-900 flex items-start space-x-2 text-[11px] text-zinc-400">
                      <Newspaper className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
                      <div className="truncate">
                        <span className="text-zinc-300 font-medium">{stock.recentHeadlines[0].title}</span>
                        <span className="ml-1.5 text-rose-400 font-mono text-[10px]">
                          [{stock.recentHeadlines[0].source} • Sentiment: {stock.recentHeadlines[0].sentiment > 0 ? '+' : ''}{stock.recentHeadlines[0].sentiment.toFixed(2)}]
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Expand technical feature contributions breakdown */}
                  <button
                    onClick={() => toggleExpand(stock.id)}
                    className="mt-2 text-[11px] text-zinc-400 hover:text-rose-400 flex items-center space-x-1 transition"
                  >
                    <span>{expandedStockId === stock.id ? 'Hide Feature Breakdown' : 'Show 14-Feature Weights Breakdown'}</span>
                    {expandedStockId === stock.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {expandedStockId === stock.id && (
                    <div className="mt-3 p-3 bg-zinc-950 rounded-lg border border-zinc-800/80 space-y-2">
                      <h5 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                        Feature Contributions (Normalized Linear Component)
                      </h5>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        {stock.featureContributions?.map((fc, fcIdx) => (
                          <div key={fcIdx} className="flex justify-between items-center bg-zinc-900/60 px-2 py-1 rounded">
                            <span className="text-zinc-400 truncate max-w-[130px]">{fc.label}:</span>
                            <span className={fc.contribution < 0 ? 'text-rose-400 font-bold' : fc.contribution > 0 ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>
                              {fc.contribution > 0 ? '+' : ''}{fc.contribution.toFixed(3)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Expandable Section: View All Ranked Universe */}
      {allRanked.length > 0 && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAllUniverse(!showAllUniverse)}
            className="w-full px-5 py-3.5 bg-zinc-900/80 hover:bg-zinc-900 flex items-center justify-between text-xs font-semibold text-zinc-300 transition"
          >
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-zinc-400" />
              <span>Full Analyzed Universe ({allRanked.length} Stocks)</span>
            </div>
            <div className="flex items-center space-x-1 text-zinc-400">
              <span>{showAllUniverse ? 'Collapse' : 'Expand Full Table'}</span>
              {showAllUniverse ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showAllUniverse && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 text-[11px] font-mono">
                  <tr>
                    <th className="py-2.5 px-4">Symbol</th>
                    <th className="py-2.5 px-4">Price @ 10:15</th>
                    <th className="py-2.5 px-4">P(UP)</th>
                    <th className="py-2.5 px-4">P(DOWN)</th>
                    <th className="py-2.5 px-4">VWAP Dist</th>
                    <th className="py-2.5 px-4">Rel Vol</th>
                    <th className="py-2.5 px-4">RS vs Nifty</th>
                    <th className="py-2.5 px-4">Daily RSI</th>
                    <th className="py-2.5 px-4">Sentiment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 font-mono">
                  {allRanked.map((stock) => (
                    <tr key={stock.id} className="hover:bg-zinc-900/50">
                      <td className="py-2.5 px-4 font-semibold text-white">
                        {stock.symbol.replace('.NS', '')}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-300">₹{stock.priceAtPred.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-emerald-400 font-bold">{(stock.probUp * 100).toFixed(1)}%</td>
                      <td className="py-2.5 px-4 text-rose-400 font-bold">{(stock.probDown * 100).toFixed(1)}%</td>
                      <td className="py-2.5 px-4 text-zinc-300">{(stock.features.distVWAP * 100).toFixed(2)}%</td>
                      <td className="py-2.5 px-4 text-zinc-300">{stock.features.relVolume.toFixed(2)}x</td>
                      <td className="py-2.5 px-4 text-zinc-300">{(stock.features.relativeStrength * 100).toFixed(2)}%</td>
                      <td className="py-2.5 px-4 text-zinc-300">{stock.features.rsi14.toFixed(1)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          stock.features.newsSentiment > 0.2 ? 'bg-emerald-500/10 text-emerald-400' :
                          stock.features.newsSentiment < -0.2 ? 'bg-rose-500/10 text-rose-400' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {stock.features.newsSentiment > 0 ? '+' : ''}{stock.features.newsSentiment.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
