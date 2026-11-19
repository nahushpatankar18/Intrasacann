import React, { useState, useMemo } from 'react';
import {
  Newspaper,
  RefreshCw,
  Search,
  ExternalLink,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Clock,
  Tag,
} from 'lucide-react';
import { NewsItem } from '../types';

interface NewsTabProps {
  news: NewsItem[];
  onRefreshNews: () => Promise<void>;
  isRefreshing: boolean;
}

export const NewsTab: React.FC<NewsTabProps> = ({
  news,
  onRefreshNews,
  isRefreshing,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL'>('ALL');

  const filteredNews = useMemo(() => {
    return news.filter((item) => {
      const matchSearch =
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.companyName && item.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.symbol && item.symbol.toLowerCase().includes(searchTerm.toLowerCase())) ||
        item.source.toLowerCase().includes(searchTerm.toLowerCase());

      const matchSentiment =
        sentimentFilter === 'ALL'
          ? true
          : sentimentFilter === 'BULLISH'
          ? item.sentiment >= 0.2
          : sentimentFilter === 'BEARISH'
          ? item.sentiment <= -0.2
          : item.sentiment > -0.2 && item.sentiment < 0.2;

      return matchSearch && matchSentiment;
    });
  }, [news, searchTerm, sentimentFilter]);

  const getSentimentBadge = (sentiment: number) => {
    if (sentiment >= 0.2) {
      return {
        label: `+${sentiment.toFixed(2)} Bullish`,
        classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        icon: <TrendingUp className="w-3 h-3 text-emerald-400 mr-1" />,
      };
    } else if (sentiment <= -0.2) {
      return {
        label: `${sentiment.toFixed(2)} Bearish`,
        classes: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        icon: <TrendingDown className="w-3 h-3 text-rose-400 mr-1" />,
      };
    } else {
      return {
        label: `${sentiment.toFixed(2)} Neutral`,
        classes: 'bg-zinc-800 text-zinc-400 border-zinc-700',
        icon: null,
      };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/60 p-5 rounded-xl border border-zinc-800">
        <div>
          <div className="flex items-center space-x-2">
            <Newspaper className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Indian Market News &amp; Gemini Sentiment Feed
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Real-time RSS feeds scraped from Google News, Economic Times, and Moneycontrol. Scored server-side using Gemini Flash for intraday stock sentiment with 24-hour time decay weighting.
          </p>
        </div>

        <button
          onClick={onRefreshNews}
          disabled={isRefreshing}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          <span>{isRefreshing ? 'Refreshing RSS Feeds...' : 'Fetch Latest Headlines'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search headline, stock, company or source..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-zinc-400">Sentiment:</span>
          <div className="flex rounded-lg bg-zinc-950 border border-zinc-800 p-0.5 text-xs">
            {(['ALL', 'BULLISH', 'NEUTRAL', 'BEARISH'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setSentimentFilter(filter)}
                className={`px-3 py-1 rounded-md transition ${
                  sentimentFilter === filter
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* News Stream List */}
      <div className="space-y-3">
        {filteredNews.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs bg-zinc-900/20 border border-zinc-800 rounded-xl">
            No news items found matching criteria. Click &quot;Fetch Latest Headlines&quot; to refresh RSS feeds.
          </div>
        ) : (
          filteredNews.map((item) => {
            const badge = getSentimentBadge(item.sentiment);
            return (
              <div
                key={item.id}
                className="p-4 bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-800/80 rounded-xl transition space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {/* Stock Tag & Source */}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="font-bold text-white bg-zinc-950 border border-zinc-800 px-2.5 py-0.5 rounded-md font-mono">
                      {item.symbol && item.symbol !== 'GENERAL' ? item.symbol.replace('.NS', '') : 'NIFTY BROAD'}
                    </span>
                    {item.companyName && item.companyName !== 'Broad Market' && (
                      <span className="text-zinc-400 font-medium">{item.companyName}</span>
                    )}
                    <span className="text-zinc-400">•</span>
                    <span className="text-zinc-400 font-semibold">{item.source}</span>
                  </div>

                  {/* Sentiment Score Badge */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border font-mono ${badge.classes}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>{new Date(item.pubDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })} IST</span>
                    </span>
                  </div>
                </div>

                {/* Headline Title */}
                <div>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-zinc-100 hover:text-emerald-400 transition inline-flex items-center group"
                  >
                    <span>{item.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1.5 opacity-0 group-hover:opacity-100 transition text-emerald-400" />
                  </a>
                </div>

                {/* Gemini Rationale One-Liner */}
                {item.reason && (
                  <div className="flex items-start space-x-2 text-xs bg-zinc-950/80 px-3 py-2 rounded-lg border border-zinc-800/60 text-zinc-300">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-zinc-400 font-medium">Gemini Impact Assessment:</strong>{' '}
                      {item.reason}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
