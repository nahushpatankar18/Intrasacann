import React, { useState, useMemo } from 'react';
import {
  Award,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  Search,
  Filter,
  DollarSign,
  Percent,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import { PredictionRecord } from '../types';

interface ScoreboardTabProps {
  predictions: PredictionRecord[];
  onEvaluateOutcomes: () => Promise<void>;
  isEvaluating: boolean;
  costRoundTripPct: number;
  moveThresholdPct: number;
}

export const ScoreboardTab: React.FC<ScoreboardTabProps> = ({
  predictions,
  onEvaluateOutcomes,
  isEvaluating,
  costRoundTripPct,
  moveThresholdPct,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'HIT' | 'MISS' | 'FLAT' | 'PENDING'>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'UP' | 'DOWN'>('ALL');

  // Compute strictly from logged resolved predictions
  const resolved = useMemo(() => {
    return predictions.filter((p) => p.outcome && p.outcome !== 'PENDING' && p.actualClose !== undefined);
  }, [predictions]);

  const pending = useMemo(() => {
    return predictions.filter((p) => !p.outcome || p.outcome === 'PENDING' || p.actualClose === undefined);
  }, [predictions]);

  const hits = useMemo(() => resolved.filter((p) => p.outcome === 'HIT'), [resolved]);
  const misses = useMemo(() => resolved.filter((p) => p.outcome === 'MISS'), [resolved]);

  // Overall Running Hit Rate
  const runningHitRate = resolved.length > 0 ? (hits.length / resolved.length) * 100 : 0;

  // Top 5 Precision (only consider top-5 ranked picks)
  const resolvedTop5 = useMemo(() => resolved.filter((p) => p.rank <= 5), [resolved]);
  const hitsTop5 = useMemo(() => resolvedTop5.filter((p) => p.outcome === 'HIT'), [resolvedTop5]);
  const top5Precision = resolvedTop5.length > 0 ? (hitsTop5.length / resolvedTop5.length) * 100 : 0;

  // Cumulative Paper P&L after cost
  // Chronological order for cumulative P&L chart
  const pnlCurveData = useMemo(() => {
    const sortedChronological = [...resolved].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let runningPnl = 0;
    return sortedChronological.map((p, idx) => {
      runningPnl += p.paperPnlPct || 0;
      return {
        tradeIndex: idx + 1,
        date: p.date,
        symbol: p.symbol.replace('.NS', ''),
        tradePnl: p.paperPnlPct || 0,
        cumulativePnl: Number(runningPnl.toFixed(2)),
      };
    });
  }, [resolved]);

  const totalPaperPnl = pnlCurveData.length > 0 ? pnlCurveData[pnlCurveData.length - 1].cumulativePnl : 0;

  // Calibration Buckets for Scoreboard: 50-60%, 60-70%, 70-80%, >80%
  const calibrationData = useMemo(() => {
    const buckets = [
      { range: '50-60%', min: 0.50, max: 0.60, count: 0, hits: 0 },
      { range: '60-70%', min: 0.60, max: 0.70, count: 0, hits: 0 },
      { range: '70-80%', min: 0.70, max: 0.80, count: 0, hits: 0 },
      { range: '80-100%', min: 0.80, max: 1.00, count: 0, hits: 0 },
    ];

    for (const r of resolved) {
      const prob = r.direction === 'UP' ? r.probUp : r.probDown;
      for (const b of buckets) {
        if (prob >= b.min && prob < b.max) {
          b.count++;
          if (r.outcome === 'HIT') b.hits++;
          break;
        }
      }
    }

    return buckets.map((b) => ({
      range: b.range,
      count: b.count,
      actualHitRate: b.count > 0 ? Number(((b.hits / b.count) * 100).toFixed(1)) : 0,
      expectedHitRate: Math.round(((b.min + b.max) / 2) * 100),
    }));
  }, [resolved]);

  // Filtered predictions table
  const filteredPredictions = useMemo(() => {
    return predictions.filter((p) => {
      const matchSearch =
        p.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.companyName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchOutcome =
        outcomeFilter === 'ALL'
          ? true
          : outcomeFilter === 'PENDING'
          ? !p.outcome || p.outcome === 'PENDING'
          : p.outcome === outcomeFilter;
      const matchDirection = directionFilter === 'ALL' ? true : p.direction === directionFilter;
      return matchSearch && matchOutcome && matchDirection;
    });
  }, [predictions, searchTerm, outcomeFilter, directionFilter]);

  const handleExportCsv = () => {
    window.location.href = '/api/predictions/export-csv';
  };

  return (
    <div className="space-y-6">
      {/* Sample Size Warning Banner (mandatory until >= 30 resolved) */}
      {resolved.length < 30 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 flex items-start space-x-3.5 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h4 className="font-bold text-amber-200 text-sm">Statistical Sample-Size Warning</h4>
              <span className="text-[11px] font-mono px-2 py-0.5 bg-amber-900/60 text-amber-300 rounded font-semibold">
                {resolved.length} / 30 Resolved
              </span>
            </div>
            <p className="text-xs text-amber-300/90 leading-relaxed">
              IntraScan strictly enforces audit transparency: statistical hit rates and win ratios require at least <strong>30 resolved predictions</strong> before conclusions reach minimal sample confidence. All metrics below reflect strictly logged outcomes.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Running Hit Rate */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Running Hit Rate</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {resolved.length > 0 ? `${runningHitRate.toFixed(1)}%` : '--'}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            {hits.length} hits / {resolved.length} resolved (threshold &gt;= {moveThresholdPct}%)
          </div>
        </div>

        {/* Top-5 Precision */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Top-5 Precision</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {resolvedTop5.length > 0 ? `${top5Precision.toFixed(1)}%` : '--'}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            {hitsTop5.length} hits / {resolvedTop5.length} top-ranked picks
          </div>
        </div>

        {/* Cumulative Paper P&L */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Cumulative Paper P&amp;L</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              totalPaperPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {totalPaperPnl >= 0 ? '+' : ''}
            {totalPaperPnl.toFixed(2)}%
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            Net after {costRoundTripPct}% round-trip costs
          </div>
        </div>

        {/* Total Predictions Logged */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Logged Ledger</span>
            <TrendingUp className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {predictions.length}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            {resolved.length} resolved • {pending.length} pending close
          </div>
        </div>
      </div>

      {/* Control Actions Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
        <div>
          <h3 className="text-sm font-bold text-white">Scoreboard Actions &amp; Audit</h3>
          <p className="text-xs text-zinc-400">
            After 15:30 IST market close, evaluate logged predictions against official NSE closing candles.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onEvaluateOutcomes}
            disabled={isEvaluating}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isEvaluating ? 'Evaluating Actuals...' : 'Evaluate Outcomes (Fetch Actuals)'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Charts Row: Cumulative Paper P&L and Calibration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative Paper P&L Curve */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Cumulative Paper P&amp;L After Costs ({costRoundTripPct}%)
            </h4>
            <span className="text-[11px] font-mono text-zinc-400">Sequential Resolved Trades</span>
          </div>

          <div className="h-60 w-full">
            {pnlCurveData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                No resolved trades to plot yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pnlCurveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="tradeIndex" stroke="#71717a" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val: any) => [`${Number(val).toFixed(2)}%`, 'Cumulative P&L']}
                    labelFormatter={(idx: any) => `Trade #${idx}`}
                  />
                  <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="cumulativePnl"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Calibration Chart: Predicted Prob vs Actual Hit Rate */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Scoreboard Calibration (Bucket vs Hit Rate)
            </h4>
            <span className="text-[11px] font-mono text-zinc-400">Target: 45° Alignment</span>
          </div>

          <div className="h-60 w-full">
            {resolved.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                No resolved predictions to calibrate yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calibrationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="range" stroke="#71717a" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val: any, name: any) => [`${val}%`, name === 'actualHitRate' ? 'Actual Hit Rate' : 'Expected Midpoint']}
                  />
                  <Bar dataKey="expectedHitRate" fill="#3f3f46" name="Expected Prob" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actualHitRate" fill="#10b981" name="Actual Hit Rate" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Immutable Predictions Ledger */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden space-y-3 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Immutable Predictions Log</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                {filteredPredictions.length} Records
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Predictions are permanently logged before market close and can never be edited or deleted from the UI.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search symbol or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Outcome Filter */}
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Outcomes</option>
              <option value="HIT">HIT Only</option>
              <option value="MISS">MISS Only</option>
              <option value="FLAT">FLAT Only</option>
              <option value="PENDING">PENDING Only</option>
            </select>

            {/* Direction Filter */}
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Directions</option>
              <option value="UP">UP Only</option>
              <option value="DOWN">DOWN Only</option>
            </select>
          </div>
        </div>

        {/* Predictions Table */}
        <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Timestamp (IST)</th>
                <th className="py-2.5 px-3">Stock</th>
                <th className="py-2.5 px-3">Pred</th>
                <th className="py-2.5 px-3">P(UP) / P(DN)</th>
                <th className="py-2.5 px-3">Price @ 10:15</th>
                <th className="py-2.5 px-3">Actual Close</th>
                <th className="py-2.5 px-3">Actual %</th>
                <th className="py-2.5 px-3">Outcome</th>
                <th className="py-2.5 px-3">Net Paper P&amp;L</th>
                <th className="py-2.5 px-3">Primary Factor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
              {filteredPredictions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-zinc-500 text-xs">
                    No predictions match the active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredPredictions.map((p) => {
                  const prob = p.direction === 'UP' ? p.probUp : p.probDown;
                  return (
                    <tr key={p.id} className="hover:bg-zinc-900/50 transition">
                      <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap text-[11px]">
                        {p.timestamp ? p.timestamp.slice(0, 16).replace('T', ' ') : p.date}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        <div className="flex flex-col">
                          <span>{p.symbol.replace('.NS', '')}</span>
                          <span className="text-[10px] text-zinc-400 font-sans truncate max-w-[120px] font-normal">
                            {p.companyName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            p.direction === 'UP'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {p.direction}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-zinc-200">
                        {(prob * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-zinc-300">₹{p.priceAtPred.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-zinc-300">
                        {p.actualClose ? `₹${p.actualClose.toFixed(2)}` : '--'}
                      </td>
                      <td className="py-2.5 px-3">
                        {p.actualReturn !== undefined ? (
                          <span className={p.actualReturn >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                            {p.actualReturn >= 0 ? '+' : ''}{(p.actualReturn * 100).toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-zinc-500">Pending</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {p.outcome === 'HIT' && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>HIT</span>
                          </span>
                        )}
                        {p.outcome === 'MISS' && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                            <XCircle className="w-3 h-3" />
                            <span>MISS</span>
                          </span>
                        )}
                        {p.outcome === 'FLAT' && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-bold">
                            <MinusCircle className="w-3 h-3" />
                            <span>FLAT</span>
                          </span>
                        )}
                        {(!p.outcome || p.outcome === 'PENDING') && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                            <Clock className="w-3 h-3" />
                            <span>PENDING</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        {p.paperPnlPct !== undefined ? (
                          <span className={p.paperPnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {p.paperPnlPct >= 0 ? '+' : ''}{p.paperPnlPct.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-zinc-500">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 font-sans text-[11px] truncate max-w-[200px]" title={p.keyReasons?.[0]}>
                        {p.keyReasons?.[0] || 'Technical & Sentiment composite'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
