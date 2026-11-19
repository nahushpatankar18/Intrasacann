import { XMLParser } from 'fast-xml-parser';
import { GoogleGenAI, Type } from '@google/genai';
import { NewsItem } from './types.js';
import { NIFTY_50_CONSTITUENTS } from './config/stocks.js';
import { Database } from './db.js';

const parser = new XMLParser();

// Keywords map for matching headlines to Nifty 50 stocks
interface StockKeyword {
  symbol: string;
  name: string;
  keywords: string[];
}

const STOCK_KEYWORDS: StockKeyword[] = NIFTY_50_CONSTITUENTS.map((stock) => {
  const shortName = stock.name.split(' ')[0].toLowerCase();
  const symbolRoot = stock.symbol.replace('.NS', '').toLowerCase();
  const customKeywords: string[] = [symbolRoot, shortName];

  if (stock.symbol === 'HDFCBANK.NS') customKeywords.push('hdfc bank', 'hdfc');
  if (stock.symbol === 'ICICIBANK.NS') customKeywords.push('icici bank', 'icici');
  if (stock.symbol === 'SBIN.NS') customKeywords.push('state bank of india', 'sbi');
  if (stock.symbol === 'BHARTIARTL.NS') customKeywords.push('bharti airtel', 'airtel');
  if (stock.symbol === 'TATAMOTORS.NS') customKeywords.push('tata motors');
  if (stock.symbol === 'TATASTEEL.NS') customKeywords.push('tata steel');
  if (stock.symbol === 'TATACONSUM.NS') customKeywords.push('tata consumer');
  if (stock.symbol === 'BAJFINANCE.NS') customKeywords.push('bajaj finance');
  if (stock.symbol === 'BAJAJFINSV.NS') customKeywords.push('bajaj finserv');
  if (stock.symbol === 'HINDUNILVR.NS') customKeywords.push('hindustan unilever', 'hul');
  if (stock.symbol === 'LT.NS') customKeywords.push('larsen & toubro', 'larsen and toubro', 'l&t');
  if (stock.symbol === 'SUNPHARMA.NS') customKeywords.push('sun pharma', 'sun pharmaceutical');
  if (stock.symbol === 'MARUTI.NS') customKeywords.push('maruti suzuki', 'maruti');
  if (stock.symbol === 'ULTRACEMCO.NS') customKeywords.push('ultratech cement', 'ultratech');
  if (stock.symbol === 'POWERGRID.NS') customKeywords.push('power grid');
  if (stock.symbol === 'ADANIENT.NS') customKeywords.push('adani enterprises');
  if (stock.symbol === 'ADANIPORTS.NS') customKeywords.push('adani ports');
  if (stock.symbol === 'ASIANPAINT.NS') customKeywords.push('asian paints');
  if (stock.symbol === 'M&M.NS') customKeywords.push('mahindra & mahindra', 'mahindra');
  if (stock.symbol === 'JSWSTEEL.NS') customKeywords.push('jsw steel');

  return {
    symbol: stock.symbol,
    name: stock.name,
    keywords: Array.from(new Set(customKeywords.filter((k) => k.length >= 3))),
  };
});

function matchStockToTitle(title: string): StockKeyword | null {
  const lower = title.toLowerCase();
  for (const item of STOCK_KEYWORDS) {
    for (const kw of item.keywords) {
      // Regex word boundary matching
      const regex = new RegExp(`\\b${kw.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lower)) {
        return item;
      }
    }
  }
  return null;
}

export class NewsSentimentService {
  private static cachedNews: NewsItem[] = [];
  private static lastFetchTime = 0;
  private static FETCH_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

  // Initialize from db cache on start
  static init(): void {
    this.cachedNews = Database.getNews();
  }

  // Fetch raw RSS items from Google News, Economic Times, and Moneycontrol
  static async fetchRssItems(): Promise<Array<{ title: string; link: string; source: string; pubDate: string }>> {
    const rawItems: Array<{ title: string; link: string; source: string; pubDate: string }> = [];

    // 1. Economic Times Markets
    try {
      const etRes = await fetch('https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IntraScan/1.0' },
      });
      if (etRes.ok) {
        const text = await etRes.text();
        const json = parser.parse(text);
        const items = json?.rss?.channel?.item || [];
        const arr = Array.isArray(items) ? items : [items];
        for (const it of arr) {
          if (it.title) {
            rawItems.push({
              title: String(it.title).trim(),
              link: String(it.link || ''),
              source: 'Economic Times',
              pubDate: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch Economic Times RSS:', e);
    }

    // 2. Moneycontrol Markets
    try {
      const mcRes = await fetch('https://www.moneycontrol.com/rss/MCtopnews.xml', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IntraScan/1.0' },
      });
      if (mcRes.ok) {
        const text = await mcRes.text();
        const json = parser.parse(text);
        const items = json?.rss?.channel?.item || [];
        const arr = Array.isArray(items) ? items : [items];
        for (const it of arr) {
          if (it.title) {
            rawItems.push({
              title: String(it.title).trim(),
              link: String(it.link || ''),
              source: 'Moneycontrol',
              pubDate: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch Moneycontrol RSS:', e);
    }

    // 3. Google News RSS for Indian Equities
    try {
      const gnRes = await fetch('https://news.google.com/rss/search?q=Nifty+50+Indian+stock+market&hl=en-IN&gl=IN&ceid=IN:en', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IntraScan/1.0' },
      });
      if (gnRes.ok) {
        const text = await gnRes.text();
        const json = parser.parse(text);
        const items = json?.rss?.channel?.item || [];
        const arr = Array.isArray(items) ? items : [items];
        for (const it of arr) {
          if (it.title) {
            rawItems.push({
              title: String(it.title).trim(),
              link: String(it.link || ''),
              source: 'Google News',
              pubDate: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch Google News RSS:', e);
    }

    return rawItems;
  }

  // Rate headlines with Gemini API
  static async rateHeadlinesWithGemini(
    items: Array<{ title: string; source: string; matchedStock: string; pubDate: string; id: string }>
  ): Promise<Map<string, { sentiment: number; reason: string }>> {
    const results = new Map<string, { sentiment: number; reason: string }>();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not configured; using heuristic sentiment fallback');
      for (const it of items) {
        const lower = it.title.toLowerCase();
        let sentiment = 0;
        let reason = 'Neutral tone';
        if (/surge|jump|gain|profit rises|rally|buy|upgrade|high|soar|record/i.test(lower)) {
          sentiment = 0.6;
          reason = 'Positive news terminology';
        } else if (/fall|drop|loss|tumble|sell|downgrade|low|slump|weak|probe|penalty/i.test(lower)) {
          sentiment = -0.6;
          reason = 'Negative news terminology';
        }
        results.set(it.id, { sentiment, reason });
      }
      return results;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Chunk into batches of up to 15 headlines to avoid token limits
    const BATCH_SIZE = 15;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const promptLines = batch.map((item, idx) => `[${idx}] Stock: ${item.matchedStock} | Headline: "${item.title}"`);

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Analyze each Indian stock market headline for its probable INTRADAY price impact on the specified stock.
For each item, output:
- index: integer matching [0], [1], etc.
- sentiment: float from -1.0 (strongly bearish) to +1.0 (strongly bullish), where 0.0 is completely neutral.
- reason: brief 1-sentence explanation of why it will impact intraday sentiment.

Headlines:
${promptLines.join('\n')}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.INTEGER },
                  sentiment: { type: Type.NUMBER },
                  reason: { type: Type.STRING },
                },
                required: ['index', 'sentiment', 'reason'],
              },
            },
          },
        });

        const text = response.text?.trim() || '[]';
        const parsed = JSON.parse(text) as Array<{ index: number; sentiment: number; reason: string }>;
        for (const p of parsed) {
          const item = batch[p.index];
          if (item) {
            const clamped = Math.max(-1.0, Math.min(1.0, Number(p.sentiment) || 0));
            results.set(item.id, {
              sentiment: clamped,
              reason: p.reason || 'Evaluated by Gemini',
            });
          }
        }
      } catch (err) {
        console.error('Gemini sentiment analysis error for batch:', err);
        // Fallback for this batch
        for (const it of batch) {
          results.set(it.id, { sentiment: 0.0, reason: 'Gemini rate limit or network issue (Neutral fallback)' });
        }
      }
    }

    return results;
  }

  // Refresh and get processed news
  static async refreshNews(force = false): Promise<NewsItem[]> {
    const now = Date.now();
    if (!force && this.cachedNews.length > 0 && now - this.lastFetchTime < this.FETCH_COOLDOWN_MS) {
      return this.cachedNews;
    }

    const raw = await this.fetchRssItems();
    const existingCache = Database.getNews();
    const existingMap = new Map(existingCache.map((n) => [n.title, n]));

    const unratedToProcess: Array<{ title: string; link: string; source: string; pubDate: string; id: string; matchedStock: string; symbol: string; companyName: string }> = [];
    const updatedNews: NewsItem[] = [];

    // Filter to last 48 hours
    const cutoffMs = now - 48 * 3600 * 1000;

    for (const r of raw) {
      const pubMs = new Date(r.pubDate).getTime();
      if (pubMs < cutoffMs) continue;

      const matched = matchStockToTitle(r.title);
      const id = `news_${Buffer.from(r.title).toString('base64').slice(0, 16)}`;

      if (existingMap.has(r.title)) {
        updatedNews.push(existingMap.get(r.title)!);
      } else {
        unratedToProcess.push({
          id,
          title: r.title,
          link: r.link,
          source: r.source,
          pubDate: r.pubDate,
          matchedStock: matched ? matched.name : 'NIFTY Market',
          symbol: matched ? matched.symbol : 'GENERAL',
          companyName: matched ? matched.name : 'Broad Market',
        });
      }
    }

    // Rate new headlines (limit to top 25 newest unrated to conserve API quota)
    if (unratedToProcess.length > 0) {
      const toScore = unratedToProcess.slice(0, 25);
      const ratings = await this.rateHeadlinesWithGemini(toScore);

      for (const item of toScore) {
        const rating = ratings.get(item.id) || { sentiment: 0, reason: 'Neutral' };
        updatedNews.push({
          id: item.id,
          symbol: item.symbol,
          companyName: item.companyName,
          title: item.title,
          link: item.link,
          source: item.source,
          pubDate: item.pubDate,
          sentiment: rating.sentiment,
          reason: rating.reason,
        });
      }
    }

    // Sort descending by date
    updatedNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    this.cachedNews = updatedNews;
    this.lastFetchTime = now;
    Database.saveNews(updatedNews);
    return updatedNews;
  }

  // Calculate weighted sentiment score for a stock
  // Headlines from the last 24h are weighted with exponential time decay
  static getSentimentForStock(symbol: string): { score: number; headlines: Array<{ title: string; source: string; sentiment: number; reason: string }> } {
    const now = Date.now();
    const relevant = this.cachedNews.filter((n) => n.symbol === symbol || (symbol === 'GENERAL' && !n.symbol));
    const recent = relevant.filter((n) => now - new Date(n.pubDate).getTime() < 24 * 3600 * 1000);

    if (recent.length === 0) {
      return { score: 0.0, headlines: [] };
    }

    let weightedSum = 0;
    let totalWeight = 0;

    for (const h of recent) {
      const ageHours = Math.max(0, (now - new Date(h.pubDate).getTime()) / (3600 * 1000));
      // Exponential decay: half-life of 8 hours
      const weight = Math.exp(-ageHours / 8);
      weightedSum += h.sentiment * weight;
      totalWeight += weight;
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : 0.0;
    const clamped = Math.max(-1.0, Math.min(1.0, score));

    return {
      score: clamped,
      headlines: recent.slice(0, 3).map((h) => ({
        title: h.title,
        source: h.source,
        sentiment: h.sentiment,
        reason: h.reason,
      })),
    };
  }
}
