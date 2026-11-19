import { StockConstituent } from '../types.js';

export const NIFTY_50_CONSTITUENTS: StockConstituent[] = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Oil & Gas / Conglomerate' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services', sector: 'Information Technology' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', sector: 'Private Banking' },
  { symbol: 'INFY.NS', name: 'Infosys', sector: 'Information Technology' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', sector: 'Private Banking' },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', sector: 'Telecommunication' },
  { symbol: 'SBIN.NS', name: 'State Bank of India', sector: 'Public Banking' },
  { symbol: 'ITC.NS', name: 'ITC Ltd.', sector: 'Consumer Goods (FMCG)' },
  { symbol: 'LT.NS', name: 'Larsen & Toubro', sector: 'Construction & Engineering' },
  { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', sector: 'Consumer Goods (FMCG)' },
  { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', sector: 'Non-Banking Financials' },
  { symbol: 'MARUTI.NS', name: 'Maruti Suzuki India', sector: 'Automobile' },
  { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', sector: 'Automobile' },
  { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical', sector: 'Pharmaceuticals' },
  { symbol: 'AXISBANK.NS', name: 'Axis Bank', sector: 'Private Banking' },
  { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank', sector: 'Private Banking' },
  { symbol: 'TITAN.NS', name: 'Titan Company', sector: 'Consumer Discretionary' },
  { symbol: 'ONGC.NS', name: 'Oil & Natural Gas Corp', sector: 'Oil & Gas Exploration' },
  { symbol: 'NTPC.NS', name: 'NTPC Ltd.', sector: 'Power Generation' },
  { symbol: 'POWERGRID.NS', name: 'Power Grid Corp', sector: 'Power Transmission' },
  { symbol: 'ADANIENT.NS', name: 'Adani Enterprises', sector: 'Metals & Mining / Conglomerate' },
  { symbol: 'ADANIPORTS.NS', name: 'Adani Ports & SEZ', sector: 'Logistics & Ports' },
  { symbol: 'COALINDIA.NS', name: 'Coal India', sector: 'Mining & Coal' },
  { symbol: 'BAJAJFINSV.NS', name: 'Bajaj Finserv', sector: 'Financial Services' },
  { symbol: 'ASIANPAINT.NS', name: 'Asian Paints', sector: 'Consumer Durables' },
  { symbol: 'TATASTEEL.NS', name: 'Tata Steel', sector: 'Steel & Metals' },
  { symbol: 'M&M.NS', name: 'Mahindra & Mahindra', sector: 'Automobile' },
  { symbol: 'JSWSTEEL.NS', name: 'JSW Steel', sector: 'Steel & Metals' },
  { symbol: 'ULTRACEMCO.NS', name: 'UltraTech Cement', sector: 'Cement & Building Products' },
  { symbol: 'GRASIM.NS', name: 'Grasim Industries', sector: 'Cement & Chemicals' },
  { symbol: 'NESTLEIND.NS', name: 'Nestle India', sector: 'Consumer Goods (FMCG)' },
  { symbol: 'WIPRO.NS', name: 'Wipro', sector: 'Information Technology' },
  { symbol: 'HCLTECH.NS', name: 'HCL Technologies', sector: 'Information Technology' },
  { symbol: 'TECHM.NS', name: 'Tech Mahindra', sector: 'Information Technology' },
  { symbol: 'CIPLA.NS', name: 'Cipla', sector: 'Pharmaceuticals' },
  { symbol: 'APOLLOHOSP.NS', name: 'Apollo Hospitals', sector: 'Healthcare Services' },
  { symbol: 'DRREDDY.NS', name: 'Dr. Reddy\'s Laboratories', sector: 'Pharmaceuticals' },
  { symbol: 'HEROMOTOCO.NS', name: 'Hero MotoCorp', sector: 'Automobile' },
  { symbol: 'EICHERMOT.NS', name: 'Eicher Motors', sector: 'Automobile' },
  { symbol: 'DIVISLAB.NS', name: 'Divi\'s Laboratories', sector: 'Pharmaceuticals' },
  { symbol: 'BPCL.NS', name: 'Bharat Petroleum', sector: 'Refining & Marketing' },
  { symbol: 'SBILIFE.NS', name: 'SBI Life Insurance', sector: 'Life Insurance' },
  { symbol: 'HDFCLIFE.NS', name: 'HDFC Life Insurance', sector: 'Life Insurance' },
  { symbol: 'BRITANNIA.NS', name: 'Britannia Industries', sector: 'Consumer Goods (FMCG)' },
  { symbol: 'INDUSINDBK.NS', name: 'IndusInd Bank', sector: 'Private Banking' },
  { symbol: 'TATACONSUM.NS', name: 'Tata Consumer Products', sector: 'Consumer Goods (FMCG)' },
  { symbol: 'SHRIRAMFIN.NS', name: 'Shriram Finance', sector: 'Non-Banking Financials' },
  { symbol: 'BEL.NS', name: 'Bharat Electronics', sector: 'Aerospace & Defence' },
  { symbol: 'TRENT.NS', name: 'Trent Ltd.', sector: 'Retail & Consumer' },
  { symbol: 'LTIM.NS', name: 'LTIMindtree', sector: 'Information Technology' },
];

export const BENCHMARKS = {
  NIFTY_50: '^NSEI',
  INDIA_VIX: '^INDIAVIX',
};

// NSE Trading Calendar & IST Helpers
// IST is UTC + 5:30
export function getNowInIst(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000);
}

export function formatIstDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatIstTime(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function isTradingDay(d: Date): boolean {
  const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  // NSE standard national holidays can be checked here if needed
  return true;
}

export function getMarketSessionStatus(d: Date = getNowInIst()): {
  session: 'pre_open' | 'early_session' | 'prediction_ready' | 'regular_trading' | 'market_closed' | 'weekend_holiday';
  message: string;
  isAllowedToPredict: boolean;
} {
  if (!isTradingDay(d)) {
    return {
      session: 'weekend_holiday',
      message: 'Weekend / Market Holiday (NSE Closed)',
      isAllowedToPredict: false,
    };
  }

  const hours = d.getHours();
  const minutes = d.getMinutes();
  const timeNum = hours * 60 + minutes;

  const openTime = 9 * 60 + 15;      // 09:15 IST
  const predTime = 10 * 60 + 15;     // 10:15 IST
  const closeTime = 15 * 60 + 30;    // 15:30 IST

  if (timeNum < openTime) {
    return {
      session: 'pre_open',
      message: 'Pre-Market Session (Opens at 09:15 IST)',
      isAllowedToPredict: false,
    };
  } else if (timeNum < predTime) {
    return {
      session: 'early_session',
      message: `Initial 30-min price discovery in progress. Predictions unlock at 10:15 IST (${predTime - timeNum}m remaining).`,
      isAllowedToPredict: false,
    };
  } else if (timeNum <= closeTime) {
    return {
      session: 'regular_trading',
      message: 'Active Trading Session (Predictions Ready)',
      isAllowedToPredict: true,
    };
  } else {
    return {
      session: 'market_closed',
      message: 'Market Closed (15:30 IST). Ready for Outcome Evaluation.',
      isAllowedToPredict: true, // After market close, can analyze latest session
    };
  }
}
