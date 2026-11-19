import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { Database } from './server/db.js';
import { MarketDataService } from './server/marketData.js';
import { NewsSentimentService } from './server/newsSentiment.js';
import { PredictionRunnerService } from './server/predictionRunner.js';
import { WalkForwardBacktester } from './server/backtest.js';
import { NIFTY_50_CONSTITUENTS, getNowInIst, formatIstDate, formatIstTime, getMarketSessionStatus } from './server/config/stocks.js';
import { seedInitialPredictionsIfEmpty } from './server/seed.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize services and seed if empty
seedInitialPredictionsIfEmpty();
NewsSentimentService.init();
PredictionRunnerService.initModel();

// --- API Routes ---

// 1. Market Status & IST Clock
app.get('/api/status', async (req: Request, res: Response) => {
  try {
    const nowIst = getNowInIst();
    const sessionInfo = getMarketSessionStatus(nowIst);

    let niftyContext = { price: 24000, change: 0, changePct: 0, prevClose: 24000 };
    let vixContext = { price: 14.0, change: 0, changePct: 0, prevClose: 14.0 };

    try {
      const ctx = await MarketDataService.getMarketContext();
      niftyContext = ctx.nifty;
      vixContext = ctx.vix;
    } catch (e: any) {
      console.warn('Market context fetch note:', e?.message);
    }

    res.json({
      istTime: formatIstTime(nowIst),
      istDate: formatIstDate(nowIst),
      session: sessionInfo.session,
      sessionMessage: sessionInfo.message,
      isAllowedToPredict: sessionInfo.isAllowedToPredict,
      nifty50: niftyContext,
      indiaVix: vixContext,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get status' });
  }
});

// 2. Stock Universe
app.get('/api/stocks', (req: Request, res: Response) => {
  const settings = Database.getSettings();
  res.json({
    constituents: NIFTY_50_CONSTITUENTS,
    activeSymbols: settings.stockSymbols,
  });
});

// 3. App Settings
app.get('/api/settings', (req: Request, res: Response) => {
  res.json(Database.getSettings());
});

app.post('/api/settings', (req: Request, res: Response) => {
  try {
    const updated = Database.saveSettings(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Invalid settings' });
  }
});

// 4. Run Analysis (Live Predictions)
app.post('/api/predictions/run', async (req: Request, res: Response) => {
  try {
    const manualOverride = Boolean(req.body.manualOverride);
    const result = await PredictionRunnerService.runAnalysis(manualOverride);
    res.json(result);
  } catch (err: any) {
    console.error('Error running analysis:', err);
    res.status(500).json({ error: err?.message || 'Failed to run analysis' });
  }
});

// 5. Get All Logged Predictions
app.get('/api/predictions', (req: Request, res: Response) => {
  try {
    const predictions = Database.getPredictions();
    res.json(predictions);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch predictions' });
  }
});

// 6. Evaluate Outcomes (Scoreboard resolution)
app.post('/api/predictions/evaluate', async (req: Request, res: Response) => {
  try {
    const result = await PredictionRunnerService.evaluateOutcomes();
    const updatedPredictions = Database.getPredictions();
    res.json({
      ...result,
      predictions: updatedPredictions,
    });
  } catch (err: any) {
    console.error('Error evaluating outcomes:', err);
    res.status(500).json({ error: err?.message || 'Failed to evaluate outcomes' });
  }
});

// 7. Export CSV
app.get('/api/predictions/export-csv', (req: Request, res: Response) => {
  try {
    const csvData = Database.exportPredictionsCsv();
    const dateStr = formatIstDate(getNowInIst());
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="intrascan_predictions_${dateStr}.csv"`);
    res.send(csvData);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to export CSV' });
  }
});

// 8. Walk-forward Backtest
app.get('/api/backtest', async (req: Request, res: Response) => {
  try {
    const settings = Database.getSettings();
    const result = await WalkForwardBacktester.runBacktest({
      stockSymbols: settings.stockSymbols,
      costRoundTripPct: settings.costRoundTripPct,
      moveThresholdPct: settings.moveThresholdPct,
    });
    res.json(result);
  } catch (err: any) {
    console.error('Error running backtest:', err);
    res.status(500).json({ error: err?.message || 'Failed to run walk-forward backtest' });
  }
});

// 9. Retrain Model
app.post('/api/model/retrain', async (req: Request, res: Response) => {
  try {
    const settings = Database.getSettings();
    const result = await WalkForwardBacktester.runBacktest({
      stockSymbols: settings.stockSymbols,
      costRoundTripPct: settings.costRoundTripPct,
      moveThresholdPct: settings.moveThresholdPct,
    });
    // Return backtest results and newly trained coefficients
    res.json({
      message: 'Model walk-forward retrained successfully',
      result,
    });
  } catch (err: any) {
    console.error('Error retraining model:', err);
    res.status(500).json({ error: err?.message || 'Failed to retrain model' });
  }
});

// 10. News & Sentiment
app.get('/api/news', async (req: Request, res: Response) => {
  try {
    const force = req.query.refresh === 'true';
    const news = await NewsSentimentService.refreshNews(force);
    res.json(news);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch news' });
  }
});

// Vite Middleware for Frontend in Dev, static file serving in Production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IntraScan server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start IntraScan server:', err);
});
