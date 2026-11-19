import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { AppSettings, StockConstituent } from '../types';

interface SettingsTabProps {
  settings: AppSettings | null;
  constituents: StockConstituent[];
  onSaveSettings: (settings: Partial<AppSettings>) => Promise<void>;
  isSaving: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  constituents,
  onSaveSettings,
  isSaving,
}) => {
  const [costPct, setCostPct] = useState<number>(0.1);
  const [thresholdPct, setThresholdPct] = useState<number>(1.0);
  const [predTime, setPredTime] = useState<string>('10:15');
  const [activeSymbols, setActiveSymbols] = useState<string[]>([]);
  const [customTicker, setCustomTicker] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [stockSearch, setStockSearch] = useState<string>('');

  useEffect(() => {
    if (settings) {
      setCostPct(settings.costRoundTripPct);
      setThresholdPct(settings.moveThresholdPct);
      setPredTime(settings.predictionTimeIst);
      setActiveSymbols(settings.stockSymbols || []);
    }
  }, [settings]);

  const toggleSymbol = (sym: string) => {
    if (activeSymbols.includes(sym)) {
      setActiveSymbols(activeSymbols.filter((s) => s !== sym));
    } else {
      setActiveSymbols([...activeSymbols, sym]);
    }
  };

  const handleSelectAll = () => {
    setActiveSymbols(constituents.map((c) => c.symbol));
  };

  const handleDeselectAll = () => {
    setActiveSymbols([]);
  };

  const handleResetDefaults = () => {
    setCostPct(0.1);
    setThresholdPct(1.0);
    setPredTime('10:15');
    setActiveSymbols(constituents.map((c) => c.symbol));
  };

  const handleAddCustomTicker = () => {
    let formatted = customTicker.trim().toUpperCase();
    if (!formatted) return;
    if (!formatted.endsWith('.NS')) {
      formatted = `${formatted}.NS`;
    }
    if (!activeSymbols.includes(formatted)) {
      setActiveSymbols([...activeSymbols, formatted]);
    }
    setCustomTicker('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings({
      costRoundTripPct: Number(costPct),
      moveThresholdPct: Number(thresholdPct),
      predictionTimeIst: predTime,
      stockSymbols: activeSymbols,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const filteredConstituents = constituents.filter(
    (c) =>
      c.symbol.toLowerCase().includes(stockSearch.toLowerCase()) ||
      c.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
      c.sector.toLowerCase().includes(stockSearch.toLowerCase())
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Settings Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/60 p-5 rounded-xl border border-zinc-800">
        <div>
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Quantitative Engine Parameters &amp; Universe Editor
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Configure round-trip friction, target move threshold for UP/DOWN labels, and manage Nifty 50 constituents.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-md shadow-emerald-950 disabled:opacity-50"
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Numerical Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Cost Assumption */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-2">
          <label className="block text-xs font-bold text-zinc-200">
            Cost Assumption (% Round-Trip)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              max="2"
              value={costPct}
              onChange={(e) => setCostPct(parseFloat(e.target.value) || 0)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono">%</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Includes STT, broker commissions, exchange fees, and slippage (default 0.1%).
          </p>
        </div>

        {/* Move Threshold */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-2">
          <label className="block text-xs font-bold text-zinc-200">
            Intraday Move Threshold (%)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0.2"
              max="5"
              value={thresholdPct}
              onChange={(e) => setThresholdPct(parseFloat(e.target.value) || 0)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono">%</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Minimum required price move between 10:15 IST and 15:30 close to label UP (+1%) or DOWN (-1%).
          </p>
        </div>

        {/* Prediction Time */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-2">
          <label className="block text-xs font-bold text-zinc-200">
            Prediction Window (IST)
          </label>
          <div className="relative">
            <input
              type="text"
              value={predTime}
              onChange={(e) => setPredTime(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono">IST</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Fixed institutional snapshot time after early price discovery (default 10:15 IST).
          </p>
        </div>
      </div>

      {/* Stock Universe Manager */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Stock Universe Editor</h3>
            <p className="text-xs text-zinc-400">
              Active constituents: <span className="text-emerald-400 font-bold">{activeSymbols.length}</span> / {constituents.length}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-xs px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
            >
              Deselect All
            </button>

            {/* Add Custom Ticker Input */}
            <div className="flex items-center space-x-1.5 ml-2">
              <input
                type="text"
                placeholder="e.g. TATAPOWER"
                value={customTicker}
                onChange={(e) => setCustomTicker(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 w-28 uppercase font-mono focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddCustomTicker}
                className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-zinc-700 transition"
                title="Add custom ticker"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Search Constituents Filter */}
        <input
          type="text"
          placeholder="Filter stocks by name, symbol, or sector..."
          value={stockSearch}
          onChange={(e) => setStockSearch(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
        />

        {/* Stock Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-80 overflow-y-auto pr-1">
          {filteredConstituents.map((stock) => {
            const isActive = activeSymbols.includes(stock.symbol);
            return (
              <div
                key={stock.symbol}
                onClick={() => toggleSymbol(stock.symbol)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer select-none transition flex items-center justify-between ${
                  isActive
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                    : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="truncate pr-2">
                  <div className="font-bold font-mono tracking-tight text-white">
                    {stock.symbol.replace('.NS', '')}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">{stock.name}</div>
                </div>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-emerald-500 border-emerald-500 text-zinc-950' : 'border-zinc-700'
                  }`}
                >
                  {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </form>
  );
};
