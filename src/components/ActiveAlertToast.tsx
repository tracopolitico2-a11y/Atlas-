/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PriceAlert } from '../types/trading';
import {
  BellRing,
  X,
  TrendingUp,
  TrendingDown,
  Volume2,
  ExternalLink
} from 'lucide-react';

interface ActiveAlertToastProps {
  alert: PriceAlert | null;
  onDismiss: () => void;
  onOpenTradePanel?: () => void;
}

export const ActiveAlertToast: React.FC<ActiveAlertToastProps> = ({
  alert,
  onDismiss,
  onOpenTradePanel,
}) => {
  if (!alert) return null;

  const isAbove = alert.condition === 'ABOVE_OR_EQUAL';

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-lg animate-in slide-in-from-top-4 duration-300 shadow-2xl font-mono text-xs">
      <div className="bg-[#121929] border-2 border-amber-500 rounded-2xl p-3.5 shadow-amber-500/20 shadow-2xl relative overflow-hidden ring-4 ring-amber-500/30 animate-pulse">
        {/* Glow de fundo */}
        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/40">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black text-[10px] uppercase tracking-wider">
                  ALERTA DE PREÇO DISPARADO!
                </span>
                <span className="text-[10px] text-amber-300 flex items-center gap-1">
                  <Volume2 className="w-3 h-3" />
                  {alert.soundType}
                </span>
              </div>

              <div className="text-white font-bold text-sm flex items-center gap-1.5">
                {isAbove ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
                <span>PENDLE atingiu</span>
                <span className="text-amber-300 font-black text-base">
                  R$ {alert.triggeredPrice?.toFixed(2) || alert.targetPriceBrl.toFixed(2)}
                </span>
                <span className="text-slate-400 text-xs font-normal">
                  (Alvo: {isAbove ? '≥' : '≤'} R$ {alert.targetPriceBrl.toFixed(2)})
                </span>
              </div>

              <p className="text-[11px] text-slate-300 font-sans">
                {alert.note || 'O preço simulado atingiu o nível configurado.'}
              </p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            title="Dispensar alerta"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Ações Rápidas no Toast */}
        <div className="mt-3 pt-2 border-t border-[#232f48] flex items-center justify-end gap-2 relative z-10">
          <button
            onClick={onDismiss}
            className="px-3 py-1 rounded-lg bg-[#182236] hover:bg-[#202d48] text-slate-300 text-[11px]"
          >
            Dispensar
          </button>
          {onOpenTradePanel && (
            <button
              onClick={() => {
                onOpenTradePanel();
                onDismiss();
              }}
              className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-md shadow-cyan-600/30"
            >
              <span>Abrir Boleta de Trade</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
