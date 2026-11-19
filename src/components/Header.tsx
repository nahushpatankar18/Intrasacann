import React from 'react';
import {
  TrendingUp,
  Activity,
  Award,
  Newspaper,
  Sliders,
  RefreshCw,
  Clock,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import { MarketStatus } from '../types';

interface HeaderProps {
  status: MarketStatus | null;
  activeTab: 'predictions' | 'scoreboard' | 'backtest' | 'news' | 'settings';
  setActiveTab: (tab: 'predictions' | 'scoreboard' | 'backtest' | 'news' | 'settings') => void;
  onRefreshStatus: () => void;
  loadingStatus: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  activeTab,
  setActiveTab,
  onRefreshStatus,
  loadingStatus,
}) => {
  const getSessionBadge = (session?: MarketStatus['session']) => {
    switch (session) {
      case 'regular_trading':
      case 'prediction_ready':
        return { label: 'MARKET OPEN', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'early_session':
        return { label: 'PRICE DISCOVERY (UNTIL 10:15)', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'pre_open':
        return { label: 'PRE-OPEN', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      case 'market_closed':
        return { label: 'MARKET CLOSED', bg: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
      case 'weekend_holiday':
      default:
        return { label: 'WEEKEND / HOLIDAY', bg: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
    }
  };

  const sessionBadge = getSessionBadge(status?.session);

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
      {/* Top Disclaimer Banner */}
      <div className="bg-amber-950/30 border-b border-amber-900/30 px-4 py-1.5 text-xs text-amber-300/90 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            <strong className="font-semibold text-amber-300">Mandatory Disclaimer:</strong> Educational analysis only, not investment advice. Predictions are probabilistic and can be wrong. Analysis only; never executes trades.
          </span>
        </div>
        <div className="hidden md:flex items-center space-x-1.5 text-zinc-400 text-[11px]">
          <span>IST: UTC + 5:30</span>
          <span>•</span>
          <span>NSE Data via Yahoo Finance</span>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-lg tracking-wider shadow-inner shadow-emerald-500/20">
            IS
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-white">IntraScan</h1>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                NSE Nifty 50 Quant
              </span>
            </div>
            <p className="text-xs text-zinc-400">10:15 IST Walk-Forward Intraday Scorer &amp; Scoreboard</p>
          </div>
        </div>

        {/* Live Market Context Ticker */}
        <div className="flex items-center gap-3 overflow-x-auto py-1">
          {/* IST Clock */}
          <div className="flex items-center space-x-1.5 bg-zinc-900/90 border border-zinc-800 rounded-md px-2.5 py-1 text-xs">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-400 font-mono">IST</span>
            <span className="text-zinc-100 font-mono font-medium">{status?.istTime || '--:--:--'}</span>
          </div>

          {/* Session Status */}
          <div className={`text-[11px] font-bold tracking-wider px-2.5 py-1 rounded-md border ${sessionBadge.bg}`}>
            {sessionBadge.label}
          </div>

          {/* Nifty 50 */}
          <div className="flex items-center space-x-2 bg-zinc-900/90 border border-zinc-800 rounded-md px-2.5 py-1 text-xs">
            <span className="text-zinc-400 font-medium">NIFTY 50</span>
            <span className="text-white font-mono font-semibold">
              {status?.nifty50?.price ? status.nifty50.price.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : '23,500'}
            </span>
            <span
              className={`font-mono text-[11px] font-semibold ${
                (status?.nifty50?.changePct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {(status?.nifty50?.changePct || 0) >= 0 ? '+' : ''}
              {(status?.nifty50?.changePct || 0).toFixed(2)}%
            </span>
          </div>

          {/* India VIX */}
          <div className="flex items-center space-x-2 bg-zinc-900/90 border border-zinc-800 rounded-md px-2.5 py-1 text-xs">
            <div className="flex items-center space-x-1 text-zinc-400">
              <Flame className="w-3 h-3 text-orange-400" />
              <span className="font-medium">INDIA VIX</span>
            </div>
            <span className="text-white font-mono font-semibold">
              {status?.indiaVix?.price ? status.indiaVix.price.toFixed(2) : '14.00'}
            </span>
            <span
              className={`font-mono text-[11px] font-semibold ${
                (status?.indiaVix?.changePct || 0) <= 0 ? 'text-emerald-400' : 'text-orange-400'
              }`}
            >
              {(status?.indiaVix?.changePct || 0) >= 0 ? '+' : ''}
              {(status?.indiaVix?.changePct || 0).toFixed(1)}%
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefreshStatus}
            disabled={loadingStatus}
            title="Refresh market state"
            className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="max-w-7xl mx-auto px-4 flex space-x-1 border-t border-zinc-900 overflow-x-auto">
        <button
          onClick={() => setActiveTab('predictions')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'predictions'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Predictions</span>
        </button>

        <button
          onClick={() => setActiveTab('scoreboard')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'scoreboard'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Scoreboard</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded-full font-mono">
            Audit
          </span>
        </button>

        <button
          onClick={() => setActiveTab('backtest')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'backtest'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Walk-Forward Backtest</span>
        </button>

        <button
          onClick={() => setActiveTab('news')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'news'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
          }`}
        >
          <Newspaper className="w-4 h-4" />
          <span>News &amp; Sentiment</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'settings'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
};
