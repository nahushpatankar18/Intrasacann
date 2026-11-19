import React from 'react';
import {
  TrendingUp,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Activity,
  Layers,
  Sliders,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { BacktestResult } from '../types';

interface BacktestTabProps {
  backtest: BacktestResult | null;
  loading: boolean;
  onRetrain: () => Promise<void>;
  isRetraining: boolean;
}

export const BacktestTab: React.FC<BacktestTabProps> = ({
  backtest,
  loading,
  onRetrain,
  isRetraining,
}) => {
  return (
    <div className="space-y-6">
      {/* Historical Disclaimer Banner */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-300 flex items-start space-x-3.5 shadow-sm">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <h4 className="font-bold text-white text-sm">Walk-Forward Historical Validation Audit</h4>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-zinc-800 text-amber-400 rounded border border-zinc-700">
              Zero Lookahead
            </span>
          </div>
          <p className="text-zinc-400 leading-relaxed">
            Historical walk-forward backtest results are for research and educational purposes only. Past performance does not guarantee future results.
            The engine trains solely on past days, constructs features strictly at 10:15 IST, and tests chronologically out-of-sample on later days without shuffling.
          </p>
        </div>
      </div>

      {/* Control Strip & Training Date Range */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-white">Model Training State &amp; Walk-Forward Window</h3>
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">
            Range: <span className="text-emerald-400 font-semibold">{backtest?.trainingRange?.start || '2026-08'}</span> to{' '}
            <span className="text-emerald-400 font-semibold">{backtest?.trainingRange?.end || '2026-10'}</span> •{' '}
            <span>{backtest?.totalDays || 45} Trading Sessions</span> •{' '}
            <span>{backtest?.totalSamples || 0} Out-of-Sample Trades</span>
          </p>
        </div>

        <button
          onClick={onRetrain}
          disabled={isRetraining || loading}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition disabled:opacity-50 shadow-md shadow-emerald-950"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRetraining ? 'animate-spin' : ''}`} />
          <span>{isRetraining ? 'Retraining Walk-Forward Engine...' : 'Retrain Walk-Forward Scorer'}</span>
        </button>
      </div>

      {/* KPI Performance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Top-5 UP Accuracy */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Top-5 UP Accuracy</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {backtest ? `${backtest.top5UpAccuracy}%` : '--'}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            Actual move &gt;= +{backtest?.moveThresholdPct || 1.0}% by close
          </div>
        </div>

        {/* Top-5 DOWN Accuracy */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Top-5 DOWN Accuracy</span>
            <TrendingUp className="w-4 h-4 text-rose-400 rotate-180" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            {backtest ? `${backtest.top5DownAccuracy}%` : '--'}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            Actual move &lt;= -{backtest?.moveThresholdPct || 1.0}% by close
          </div>
        </div>

        {/* Top-5 Combined Precision */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Top-5 Precision</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {backtest ? `${backtest.top5CombinedPrecision}%` : '--'}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            Combined directional hit rate
          </div>
        </div>

        {/* Simulated Net Return Per Trade */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Simulated Net / Trade</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              (backtest?.netReturnPerTrade || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {backtest ? `${(backtest.netReturnPerTrade >= 0 ? '+' : '')}${backtest.netReturnPerTrade}%` : '--'}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            After {backtest?.costRoundTripPct || 0.1}% round-trip costs
          </div>
        </div>
      </div>

      {/* Baseline Comparisons Row */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white">Strategy vs. 2 Market Baselines</h4>
            <p className="text-xs text-zinc-400">
              Validates that the 14-feature logistic model provides predictive edge over simplistic alternatives.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
          {/* IntraScan Strategy */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-400 font-bold uppercase">IntraScan Scorer</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Strategy</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {backtest ? `${backtest.baselines.strategyHitRate}%` : '--'}
            </div>
            <div className="text-[11px] text-zinc-400">
              Top-5 picks using multivariable logistic scoring + Gemini sentiment
            </div>
          </div>

          {/* Baseline 2: Biggest Early Gainers */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-bold uppercase">Biggest Early Gainers</span>
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">Momentum</span>
            </div>
            <div className="text-2xl font-bold text-zinc-300">
              {backtest ? `${backtest.baselines.momentumGainersHitRate}%` : '--'}
            </div>
            <div className="text-[11px] text-zinc-400">
              Picks top-5 stocks with highest first 30-min return (naïve chase)
            </div>
          </div>

          {/* Baseline 1: Random Pick */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-bold uppercase">Random Pick</span>
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">Uniform</span>
            </div>
            <div className="text-2xl font-bold text-zinc-300">
              {backtest ? `${backtest.baselines.randomPickHitRate}%` : '--'}
            </div>
            <div className="text-[11px] text-zinc-400">
              Baseline unconditional rate of reaching &gt;= +{backtest?.moveThresholdPct || 1.0}% by close
            </div>
          </div>
        </div>
      </div>

      {/* Walk-Forward Equity Curve Chart */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Cumulative Out-of-Sample Walk-Forward Return (%)
            </h4>
            <p className="text-[11px] text-zinc-400">
              Net return per trade after {backtest?.costRoundTripPct || 0.1}% round-trip trading costs
            </p>
          </div>
          <div className="flex items-center space-x-4 text-xs font-mono">
            <span className="flex items-center space-x-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>IntraScan</span>
            </span>
            <span className="flex items-center space-x-1.5 text-sky-400">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
              <span>Momentum</span>
            </span>
            <span className="flex items-center space-x-1.5 text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-500 inline-block" />
              <span>Random</span>
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          {!backtest || !backtest.equityCurve || backtest.equityCurve.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
              {loading ? 'Running walk-forward backtest...' : 'No backtest data loaded.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={backtest.equityCurve} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 10 }} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '11px' }}
                  formatter={(val: any, name: any) => [`${Number(val).toFixed(2)}%`, name]}
                />
                <Line
                  type="monotone"
                  dataKey="strategyCumulativeReturn"
                  name="IntraScan Top-5"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="momentumCumulativeReturn"
                  name="Early Gainers"
                  stroke="#0284c7"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="randomCumulativeReturn"
                  name="Random Baseline"
                  stroke="#71717a"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Calibration Table & Feature Weights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calibration Table */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Walk-Forward Calibration Table
            </h4>
            <span className="text-[11px] text-zinc-400 font-mono">Predicted vs. Actual</span>
          </div>
          <p className="text-xs text-zinc-400">
            A well-calibrated probabilistic model shows actual hit rates rising proportionally with predicted probability buckets.
          </p>

          <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Probability Bucket</th>
                  <th className="py-2.5 px-3">Sample Count</th>
                  <th className="py-2.5 px-3">Actual Hit Rate</th>
                  <th className="py-2.5 px-3">Calibration Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {backtest?.calibration.map((cal, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/40">
                    <td className="py-2.5 px-3 font-semibold text-white">{cal.bucket}</td>
                    <td className="py-2.5 px-3 text-zinc-300">{cal.count} trades</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">{cal.actualHitRate}%</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">
                        {cal.actualHitRate >= cal.minProb * 100 ? 'Calibrated' : 'Conservatively under'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feature Coefficients / Model Drivers */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Trained Model Feature Weights (Coefficients)
            </h4>
            <span className="text-[11px] text-zinc-400 font-mono">L2 Regularized</span>
          </div>
          <p className="text-xs text-zinc-400">
            Transparent logistic coefficients. Positive weights for UP increase P(UP) as the feature value rises.
          </p>

          <div className="overflow-x-auto border border-zinc-800/80 rounded-lg max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 text-[11px] sticky top-0">
                <tr>
                  <th className="py-2 px-3">Feature Indicator</th>
                  <th className="py-2 px-3 text-right">Weight (UP)</th>
                  <th className="py-2 px-3 text-right">Weight (DOWN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {backtest &&
                  Object.entries(backtest.coefficients || {}).map(([key, coef]) => (
                    <tr key={key} className="hover:bg-zinc-900/40">
                      <td className="py-1.5 px-3 text-zinc-200">{coef.label}</td>
                      <td className="py-1.5 px-3 text-right text-emerald-400 font-semibold">
                        {coef.weightUp > 0 ? '+' : ''}{coef.weightUp.toFixed(3)}
                      </td>
                      <td className="py-1.5 px-3 text-right text-rose-400 font-semibold">
                        {coef.weightDown > 0 ? '+' : ''}{coef.weightDown.toFixed(3)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
