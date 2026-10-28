/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { MarketState } from '../types/trading';

interface OrderBookProps {
  currentPrice: number;
  onSelectPrice?: (price: number) => void;
}

export const OrderBook: React.FC<OrderBookProps> = ({ currentPrice, onSelectPrice }) => {
  // Gera book de ofertas fictício ao redor do preço simulado
  const { asks, bids, spread, spreadPercent } = useMemo(() => {
    const askRows = 6;
    const bidRows = 6;
    const step = Math.max(0.01, currentPrice * 0.0015);

    const generatedAsks = [];
    let cumulativeAskVol = 0;
    for (let i = askRows; i >= 1; i--) {
      const price = currentPrice + step * i;
      const amount = Math.round((Math.sin(i * 1.5) * 15 + 25) * 10) / 10;
      cumulativeAskVol += amount;
      generatedAsks.push({
        price,
        amount,
        total: price * amount,
        cumulativeVol: cumulativeAskVol,
      });
    }

    const generatedBids = [];
    let cumulativeBidVol = 0;
    for (let i = 1; i <= bidRows; i++) {
      const price = Math.max(0.01, currentPrice - step * i);
      const amount = Math.round((Math.cos(i * 1.8) * 15 + 28) * 10) / 10;
      cumulativeBidVol += amount;
      generatedBids.push({
        price,
        amount,
        total: price * amount,
        cumulativeVol: cumulativeBidVol,
      });
    }

    const spreadVal = (currentPrice + step) - (currentPrice - step);
    const spreadPct = (spreadVal / currentPrice) * 100;

    return {
      asks: generatedAsks,
      bids: generatedBids,
      spread: spreadVal,
      spreadPercent: spreadPct,
    };
  }, [currentPrice]);

  const maxVolume = 180;

  return (
    <div className="bg-[#101520] border border-[#222c42] rounded-xl overflow-hidden shadow-xl flex flex-col font-mono text-xs">
      <div className="bg-[#131a28] px-3 py-2 border-b border-[#222c42] flex items-center justify-between">
        <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
          Livro de Ofertas L2 (Simulado)
        </span>
        <span className="text-[10px] text-amber-400/90 font-medium bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700/40">
          Fictício
        </span>
      </div>

      <div className="p-2 space-y-1">
        {/* Cabeçalho de Colunas */}
        <div className="grid grid-cols-3 text-[10px] text-slate-500 pb-1 border-b border-[#1b2336] px-1">
          <span>Preço (R$)</span>
          <span className="text-right">Qtd (PENDLE)</span>
          <span className="text-right">Total (R$)</span>
        </div>

        {/* ASKS (Vendas - Vermelho) */}
        <div className="space-y-0.5">
          {asks.map((ask, idx) => {
            const depthPct = Math.min(100, (ask.cumulativeVol / maxVolume) * 100);
            return (
              <div
                key={`ask-${idx}`}
                onClick={() => onSelectPrice && onSelectPrice(ask.price)}
                className="grid grid-cols-3 text-[11px] py-0.5 px-1 rounded relative cursor-pointer hover:bg-rose-950/40 transition-colors"
              >
                {/* Barra de profundidade */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-rose-500/10 rounded pointer-events-none"
                  style={{ width: `${depthPct}%` }}
                ></div>
                <span className="text-rose-400 font-semibold relative z-10">
                  {ask.price.toFixed(2)}
                </span>
                <span className="text-right text-slate-300 relative z-10">
                  {ask.amount.toFixed(1)}
                </span>
                <span className="text-right text-slate-400 relative z-10">
                  {ask.total.toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Spread Central */}
        <div className="py-1.5 my-0.5 border-y border-[#1e273a] bg-[#0c1017] px-2 flex items-center justify-between text-[11px]">
          <span className="text-cyan-400 font-bold text-xs flex items-center gap-1">
            R$ {currentPrice.toFixed(2)}
          </span>
          <span className="text-slate-400 text-[10px]">
            Spread: R$ {spread.toFixed(2)} ({spreadPercent.toFixed(2)}%)
          </span>
        </div>

        {/* BIDS (Compras - Verde) */}
        <div className="space-y-0.5">
          {bids.map((bid, idx) => {
            const depthPct = Math.min(100, (bid.cumulativeVol / maxVolume) * 100);
            return (
              <div
                key={`bid-${idx}`}
                onClick={() => onSelectPrice && onSelectPrice(bid.price)}
                className="grid grid-cols-3 text-[11px] py-0.5 px-1 rounded relative cursor-pointer hover:bg-emerald-950/40 transition-colors"
              >
                {/* Barra de profundidade */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 rounded pointer-events-none"
                  style={{ width: `${depthPct}%` }}
                ></div>
                <span className="text-emerald-400 font-semibold relative z-10">
                  {bid.price.toFixed(2)}
                </span>
                <span className="text-right text-slate-300 relative z-10">
                  {bid.amount.toFixed(1)}
                </span>
                <span className="text-right text-slate-400 relative z-10">
                  {bid.total.toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
