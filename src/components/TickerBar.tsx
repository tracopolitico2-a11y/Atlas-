/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MarketState } from '../types/trading';
import {
  TrendingUp,
  TrendingDown,
  Percent,
  SlidersHorizontal,
  Plus,
  Minus,
  Check,
  RefreshCw,
  Gauge
} from 'lucide-react';

interface TickerBarProps {
  marketState: MarketState;
  onSetPrice: (newPrice: number) => void;
  onChangeVolatility: (mode: MarketState['volatilityMode']) => void;
}

export const TickerBar: React.FC<TickerBarProps> = ({
  marketState,
  onSetPrice,
  onChangeVolatility,
}) => {
  const [manualPriceInput, setManualPriceInput] = useState<string>(
    marketState.currentPriceBrl.toFixed(2)
  );
  const [isEditingPrice, setIsEditingPrice] = useState<boolean>(false);

  const isPositive = marketState.priceChangePercent24h >= 0;

  const handleApplyManualPrice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseFloat(manualPriceInput.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      onSetPrice(parsed);
      setIsEditingPrice(false);
    }
  };

  const handleQuickPercentChange = (pct: number) => {
    const newPrice = marketState.currentPriceBrl * (1 + pct / 100);
    if (newPrice > 0.05) {
      onSetPrice(newPrice);
      setManualPriceInput(newPrice.toFixed(2));
    }
  };

  return (
    <div className="bg-[#111723] border-b border-[#1f293d] px-3 sm:px-4 py-2 text-xs font-mono">
      <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
        
        {/* Lado Esquerdo: Cotação e Variação */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
          {/* Cotação Destaque em BRL */}
          <div className="flex items-baseline gap-2">
            <span className="text-slate-400 text-[11px] uppercase tracking-wide">PENDLE/BRL:</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl sm:text-2xl font-black tracking-tight ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                R$ {marketState.currentPriceBrl.toFixed(2)}
              </span>
              <span className="text-slate-400 text-xs">
                (~${marketState.currentPriceUsdt.toFixed(2)} USDT • Câmbio ref.: R$ {marketState.usdtBrlRate.toFixed(2)})
              </span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 hidden sm:inline-flex font-mono font-bold">
              ORIGEM: SIMULAÇÃO LOCAL
            </span>
          </div>

          {/* Variação 24h Fictícia */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold text-xs ${
            isPositive
              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
          }`}>
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span>{isPositive ? '+' : ''}{marketState.priceChangePercent24h.toFixed(2)}%</span>
          </div>

          {/* Métricas 24h */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400 border-l border-[#222c42] pl-3">
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Máx 24h</span>
              <span className="text-slate-200">R$ {marketState.high24hBrl.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Mín 24h</span>
              <span className="text-slate-200">R$ {marketState.low24hBrl.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Vol 24h (Simulado)</span>
              <span className="text-cyan-400">{marketState.volume24hPendle.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} PENDLE</span>
            </div>
          </div>
        </div>

        {/* Lado Direito: Controles do Preço Fictício */}
        <div className="flex items-center flex-wrap gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#1c2436]">
          {/* Ajuste Rápido de Preço (+/- %) */}
          <div className="flex items-center gap-1 bg-[#0b0e14] p-1 rounded-lg border border-[#222c42]">
            <span className="text-[10px] text-slate-400 px-1 hidden md:inline">Ajuste:</span>
            <button
              onClick={() => handleQuickPercentChange(-5)}
              className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-800/40 transition-colors"
              title="Diminuir preço fictício em 5%"
            >
              -5%
            </button>
            <button
              onClick={() => handleQuickPercentChange(-1)}
              className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-800/40 transition-colors"
              title="Diminuir preço fictício em 1%"
            >
              -1%
            </button>
            <button
              onClick={() => handleQuickPercentChange(1)}
              className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-800/40 transition-colors"
              title="Aumentar preço fictício em 1%"
            >
              +1%
            </button>
            <button
              onClick={() => handleQuickPercentChange(5)}
              className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-800/40 transition-colors"
              title="Aumentar preço fictício em 5%"
            >
              +5%
            </button>
          </div>

          {/* Definir Preço Manual */}
          {isEditingPrice ? (
            <form onSubmit={handleApplyManualPrice} className="flex items-center gap-1">
              <div className="relative">
                <span className="absolute left-2 top-1.5 text-slate-500 text-[10px]">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualPriceInput}
                  onChange={(e) => setManualPriceInput(e.target.value)}
                  className="w-20 bg-[#0b0e14] border border-cyan-500 rounded px-2 py-1 pl-6 text-xs text-white focus:outline-none"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="p-1 rounded bg-cyan-600 text-white hover:bg-cyan-500"
                title="Aplicar preço"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setManualPriceInput(marketState.currentPriceBrl.toFixed(2));
                setIsEditingPrice(true);
              }}
              className="px-2 py-1 rounded bg-[#0b0e14] border border-[#222c42] hover:border-cyan-500/60 text-slate-300 hover:text-white text-[11px] flex items-center gap-1 transition-colors"
              title="Digitar preço fictício manualmente"
            >
              <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
              <span>Fixar Preço</span>
            </button>
          )}

          {/* Seletor de Volatilidade da Simulação */}
          <div className="flex items-center gap-1 bg-[#0b0e14] p-1 rounded-lg border border-[#222c42]">
            <Gauge className="w-3 h-3 text-slate-400 ml-1 hidden xs:inline" />
            {(['BAIXA', 'MEDIA', 'ALTA'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onChangeVolatility(mode)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                  marketState.volatilityMode === mode
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Simular volatilidade ${mode.toLowerCase()}`}
              >
                {mode === 'BAIXA' ? 'Vol. Baixa' : mode === 'MEDIA' ? 'Média' : 'Alta'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
