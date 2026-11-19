import { StockFeatures, FeatureContribution } from './types.js';

export interface ModelFeatureMetadata {
  key: keyof Omit<StockFeatures, 'symbol' | 'timestamp' | 'priceAtPred' | 'prevDayClose' | 'dayOpen'>;
  label: string;
  defaultWeightUp: number;
  defaultWeightDown: number;
}

export const FEATURE_METADATA: ModelFeatureMetadata[] = [
  { key: 'openingGap', label: 'Opening Gap', defaultWeightUp: 0.35, defaultWeightDown: -0.35 },
  { key: 'first30mReturn', label: 'First 30m Return', defaultWeightUp: 0.55, defaultWeightDown: -0.55 },
  { key: 'first30mRange', label: 'First 30m Volatility Range', defaultWeightUp: 0.20, defaultWeightDown: 0.20 },
  { key: 'distVWAP', label: 'Distance from VWAP', defaultWeightUp: 0.60, defaultWeightDown: -0.60 },
  { key: 'distDayOpen', label: 'Distance from Day Open', defaultWeightUp: 0.45, defaultWeightDown: -0.45 },
  { key: 'relVolume', label: 'Relative Volume Surge', defaultWeightUp: 0.40, defaultWeightDown: 0.30 },
  { key: 'rsi14', label: 'Daily RSI (14)', defaultWeightUp: 0.25, defaultWeightDown: -0.25 },
  { key: 'ema20Dist', label: 'Distance from 20 EMA', defaultWeightUp: 0.30, defaultWeightDown: -0.30 },
  { key: 'ema50Dist', label: 'Distance from 50 EMA', defaultWeightUp: 0.20, defaultWeightDown: -0.20 },
  { key: 'atrVolatility', label: 'ATR Expected Range', defaultWeightUp: 0.15, defaultWeightDown: 0.15 },
  { key: 'relativeStrength', label: 'Relative Strength vs Nifty', defaultWeightUp: 0.65, defaultWeightDown: -0.65 },
  { key: 'vixLevel', label: 'India VIX Level', defaultWeightUp: -0.15, defaultWeightDown: 0.25 },
  { key: 'vixChange', label: 'India VIX % Change', defaultWeightUp: -0.30, defaultWeightDown: 0.40 },
  { key: 'newsSentiment', label: 'Gemini News Sentiment', defaultWeightUp: 0.50, defaultWeightDown: -0.50 },
];

export interface ModelScalars {
  means: Record<string, number>;
  stds: Record<string, number>;
}

export interface TrainedModelWeights {
  weightsUp: Record<string, number>;
  biasUp: number;
  weightsDown: Record<string, number>;
  biasDown: number;
  scalars: ModelScalars;
  trainingRange: { start: string; end: string };
  trainedSamplesCount: number;
  trainedAt: string;
}

export class TransparentLogisticModel {
  private weightsUp: Record<string, number> = {};
  private biasUp = 0;
  private weightsDown: Record<string, number> = {};
  private biasDown = 0;
  private scalars: ModelScalars = { means: {}, stds: {} };
  public trainingRange = { start: 'N/A', end: 'N/A' };
  public trainedSamplesCount = 0;

  constructor(trainedWeights?: TrainedModelWeights) {
    if (trainedWeights) {
      this.weightsUp = { ...trainedWeights.weightsUp };
      this.biasUp = trainedWeights.biasUp;
      this.weightsDown = { ...trainedWeights.weightsDown };
      this.biasDown = trainedWeights.biasDown;
      this.scalars = { ...trainedWeights.scalars };
      this.trainingRange = { ...trainedWeights.trainingRange };
      this.trainedSamplesCount = trainedWeights.trainedSamplesCount;
    } else {
      // Default initial institutional prior weights
      this.resetToDefaults();
    }
  }

  private resetToDefaults(): void {
    this.biasUp = -0.6;   // Base prior ~35% base rate for >= +1% move
    this.biasDown = -0.6; // Base prior ~35% base rate for <= -1% move

    for (const f of FEATURE_METADATA) {
      this.weightsUp[f.key] = f.defaultWeightUp;
      this.weightsDown[f.key] = f.defaultWeightDown;
      this.scalars.means[f.key] = 0;
      this.scalars.stds[f.key] = 1;
    }
    // Specific standard deviations based on typical equity market scales
    this.scalars.stds['openingGap'] = 0.01;      // 1%
    this.scalars.stds['first30mReturn'] = 0.01;  // 1%
    this.scalars.stds['first30mRange'] = 0.012;  // 1.2%
    this.scalars.stds['distVWAP'] = 0.008;       // 0.8%
    this.scalars.stds['distDayOpen'] = 0.01;     // 1%
    this.scalars.stds['relVolume'] = 1.0;        // 1x
    this.scalars.means['rsi14'] = 50;
    this.scalars.stds['rsi14'] = 12;
    this.scalars.stds['ema20Dist'] = 0.03;       // 3%
    this.scalars.stds['ema50Dist'] = 0.05;       // 5%
    this.scalars.stds['atrVolatility'] = 0.015;  // 1.5%
    this.scalars.stds['relativeStrength'] = 0.008;// 0.8%
    this.scalars.means['vixLevel'] = 14;
    this.scalars.stds['vixLevel'] = 3.5;
    this.scalars.stds['vixChange'] = 3.0;        // 3%
    this.scalars.stds['newsSentiment'] = 0.5;
  }

  // Sigmoid activation with numerical stability
  private sigmoid(z: number): number {
    if (z > 30) return 1.0;
    if (z < -30) return 0.0;
    return 1 / (1 + Math.exp(-z));
  }

  // Standardize a single feature value
  public standardize(key: string, val: number): number {
    const mean = this.scalars.means[key] ?? 0;
    const std = this.scalars.stds[key] || 1;
    return (val - mean) / std;
  }

  // Score a single stock given features at prediction time
  public predict(features: StockFeatures): {
    probUp: number;
    probDown: number;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    featureContributions: FeatureContribution[];
    keyReasons: string[];
  } {
    let zUp = this.biasUp;
    let zDown = this.biasDown;

    const contributions: FeatureContribution[] = [];

    for (const f of FEATURE_METADATA) {
      const rawVal = Number((features as any)[f.key]) || 0;
      const normalized = this.standardize(f.key, rawVal);

      const wUp = this.weightsUp[f.key] ?? 0;
      const wDown = this.weightsDown[f.key] ?? 0;

      const cUp = wUp * normalized;
      const cDown = wDown * normalized;

      zUp += cUp;
      zDown += cDown;

      const netImpact = cUp - cDown;
      contributions.push({
        featureName: f.key,
        label: f.label,
        value: rawVal,
        contribution: Number(netImpact.toFixed(4)),
        direction: netImpact > 0.05 ? 'bullish' : netImpact < -0.05 ? 'bearish' : 'neutral',
      });
    }

    const rawProbUp = this.sigmoid(zUp);
    const rawProbDown = this.sigmoid(zDown);

    // Normalize probabilities so probUp + probDown <= 1
    const totalProb = rawProbUp + rawProbDown;
    let probUp = rawProbUp;
    let probDown = rawProbDown;

    if (totalProb > 0.95) {
      const scale = 0.95 / totalProb;
      probUp = rawProbUp * scale;
      probDown = rawProbDown * scale;
    }

    // Determine direction
    let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    if (probUp > probDown && probUp >= 0.50) {
      direction = 'UP';
    } else if (probDown > probUp && probDown >= 0.50) {
      direction = 'DOWN';
    }

    const confidence = Math.max(probUp, probDown);

    // Sort contributions by absolute impact to generate key reasons
    const sorted = [...contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    const topReasons = sorted.slice(0, 3).map((c) => {
      if (c.featureName === 'distVWAP') {
        const pct = (c.value * 100).toFixed(2);
        return c.value >= 0 ? `Trading +${pct}% above intraday VWAP` : `Trading ${pct}% below intraday VWAP`;
      }
      if (c.featureName === 'relativeStrength') {
        const pct = (c.value * 100).toFixed(2);
        return c.value >= 0 ? `Outperforming Nifty by +${pct}%` : `Lagging Nifty by ${pct}%`;
      }
      if (c.featureName === 'relVolume') {
        return `Volume ${c.value.toFixed(1)}x of 20-day historical pace at 10:15`;
      }
      if (c.featureName === 'first30mReturn') {
        const pct = (c.value * 100).toFixed(2);
        return `First 30m momentum: ${pct}%`;
      }
      if (c.featureName === 'openingGap') {
        const pct = (c.value * 100).toFixed(2);
        return `Opening gap: ${pct}% vs previous close`;
      }
      if (c.featureName === 'newsSentiment') {
        return c.value > 0.2 ? `Positive news sentiment score (+${c.value.toFixed(2)})` : c.value < -0.2 ? `Negative news sentiment score (${c.value.toFixed(2)})` : 'Neutral news sentiment';
      }
      if (c.featureName === 'vixChange') {
        return `India VIX change: ${c.value >= 0 ? '+' : ''}${c.value.toFixed(1)}%`;
      }
      return `${c.label}: ${c.value.toFixed(2)} (${c.direction})`;
    });

    return {
      probUp: Number(probUp.toFixed(4)),
      probDown: Number(probDown.toFixed(4)),
      direction,
      confidence: Number(confidence.toFixed(4)),
      featureContributions: contributions,
      keyReasons: topReasons,
    };
  }

  // Train model using gradient descent on walk-forward chronological samples
  // Never shuffles! Trains on earlier days, tests on later days.
  public train(
    samples: Array<{ features: StockFeatures; labelUp: boolean; labelDown: boolean }>,
    dateRange: { start: string; end: string },
    epochs = 150,
    lr = 0.05,
    lambda = 0.01 // L2 regularization
  ): void {
    if (samples.length === 0) return;

    this.trainingRange = dateRange;
    this.trainedSamplesCount = samples.length;

    // 1. Compute means and stds for each feature
    const means: Record<string, number> = {};
    const stds: Record<string, number> = {};

    for (const f of FEATURE_METADATA) {
      let sum = 0;
      for (const s of samples) {
        sum += Number((s.features as any)[f.key]) || 0;
      }
      const mean = sum / samples.length;
      means[f.key] = mean;

      let varSum = 0;
      for (const s of samples) {
        const diff = (Number((s.features as any)[f.key]) || 0) - mean;
        varSum += diff * diff;
      }
      const std = Math.sqrt(varSum / samples.length) || 1;
      stds[f.key] = std;
    }

    this.scalars = { means, stds };

    // 2. Initialize weights
    const wUp: Record<string, number> = {};
    const wDown: Record<string, number> = {};
    let bUp = 0;
    let bDown = 0;

    for (const f of FEATURE_METADATA) {
      wUp[f.key] = 0;
      wDown[f.key] = 0;
    }

    // 3. Mini-batch or full-batch gradient descent (strictly chronological)
    const N = samples.length;
    for (let epoch = 0; epoch < epochs; epoch++) {
      let gradBUp = 0;
      let gradBDown = 0;
      const gradWUp: Record<string, number> = {};
      const gradWDown: Record<string, number> = {};

      for (const f of FEATURE_METADATA) {
        gradWUp[f.key] = 0;
        gradWDown[f.key] = 0;
      }

      for (const s of samples) {
        let zUp = bUp;
        let zDown = bDown;

        const normalizedFeatures: Record<string, number> = {};
        for (const f of FEATURE_METADATA) {
          const raw = Number((s.features as any)[f.key]) || 0;
          const norm = (raw - means[f.key]) / stds[f.key];
          normalizedFeatures[f.key] = norm;
          zUp += wUp[f.key] * norm;
          zDown += wDown[f.key] * norm;
        }

        const pUp = this.sigmoid(zUp);
        const pDown = this.sigmoid(zDown);

        const yUp = s.labelUp ? 1 : 0;
        const yDown = s.labelDown ? 1 : 0;

        const errUp = pUp - yUp;
        const errDown = pDown - yDown;

        gradBUp += errUp;
        gradBDown += errDown;

        for (const f of FEATURE_METADATA) {
          gradWUp[f.key] += errUp * normalizedFeatures[f.key];
          gradWDown[f.key] += errDown * normalizedFeatures[f.key];
        }
      }

      // Update with L2 regularization
      bUp -= lr * (gradBUp / N);
      bDown -= lr * (gradBDown / N);

      for (const f of FEATURE_METADATA) {
        gradWUp[f.key] = gradWUp[f.key] / N + lambda * wUp[f.key];
        gradWDown[f.key] = gradWDown[f.key] / N + lambda * wDown[f.key];

        wUp[f.key] -= lr * gradWUp[f.key];
        wDown[f.key] -= lr * gradWDown[f.key];
      }
    }

    this.weightsUp = wUp;
    this.biasUp = bUp;
    this.weightsDown = wDown;
    this.biasDown = bDown;
  }

  // Export serializable model state
  public serialize(): TrainedModelWeights {
    return {
      weightsUp: { ...this.weightsUp },
      biasUp: this.biasUp,
      weightsDown: { ...this.weightsDown },
      biasDown: this.biasDown,
      scalars: {
        means: { ...this.scalars.means },
        stds: { ...this.scalars.stds },
      },
      trainingRange: { ...this.trainingRange },
      trainedSamplesCount: this.trainedSamplesCount,
      trainedAt: new Date().toISOString(),
    };
  }

  public getCoefficients(): Record<string, { weightUp: number; weightDown: number; label: string }> {
    const res: Record<string, { weightUp: number; weightDown: number; label: string }> = {};
    for (const f of FEATURE_METADATA) {
      res[f.key] = {
        weightUp: Number((this.weightsUp[f.key] ?? 0).toFixed(4)),
        weightDown: Number((this.weightsDown[f.key] ?? 0).toFixed(4)),
        label: f.label,
      };
    }
    return res;
  }
}
