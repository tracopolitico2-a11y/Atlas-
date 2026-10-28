/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RiskSettings } from '../types/trading';
import {
  ShieldAlert,
  Flame,
  X,
  Save,
  Percent,
  DollarSign,
  AlertOctagon,
  Check
} from 'lucide-react';

interface RiskSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RiskSettings;
  onSave: (updated: RiskSettings) => void;
}

export const RiskSettingsModal: React.FC<RiskSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [maxExposure, setMaxExposure] = useState<number>(settings.maxExposurePercent);
  const [maxLoss, setMaxLoss] = useState<number>(settings.maxLossLimitBrl);
  const [feeRate, setFeeRate] = useState<number>(settings.feeRatePercent);
  const [killSwitch, setKillSwitch] = useState<boolean>(settings.killSwitchActive);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      maxExposurePercent: Math.max(10, Math.min(100, maxExposure)),
      maxLossLimitBrl: Math.max(0.5, maxLoss),
      feeRatePercent: Math.max(0, Math.min(5, feeRate)),
      killSwitchActive: killSwitch,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#101520] border border-[#222c42] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl font-mono text-xs">
        {/* Header */}
        <div className="bg-[#141b2b] px-4 py-3 border-b border-[#222c42] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-sm">
              Gestão de Risco & Parâmetros
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1f2940]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* KILL SWITCH HIGHLIGHT */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            killSwitch
              ? 'bg-rose-950/60 border-rose-500/80 shadow-rose-900/30 shadow-lg'
              : 'bg-[#141c2c] border-[#222c42]'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className={`w-5 h-5 ${killSwitch ? 'text-rose-400 animate-bounce' : 'text-slate-400'}`} />
                <div>
                  <strong className="text-white block text-xs">Disjuntor Geral (Kill Switch)</strong>
                  <span className="text-[11px] text-slate-400">
                    Bloqueia imediatamente compras • Mantém vendas ativas
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={killSwitch}
                  onChange={(e) => setKillSwitch(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>
            {killSwitch && (
              <p className="mt-2 text-[10px] text-rose-300 bg-rose-900/40 p-2 rounded border border-rose-700/40">
                ⚠️ Kill Switch ativado! Nenhuma nova ordem de compra será aceita pela engine enquanto esta chave estiver ligada.
              </p>
            )}
          </div>

          {/* Limite de Perda Máxima (Max Drawdown Limiter) */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-slate-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                Limite de Perda Máxima Tolerada (R$)
              </span>
              <span className="text-cyan-400 font-bold">R$ {maxLoss.toFixed(2)}</span>
            </label>
            <p className="text-[10px] text-slate-400">
              Se o prejuízo total acumulado (realizado + não realizado) atingir esse valor, novas compras são bloqueadas automaticamente.
            </p>
            <input
              type="range"
              min="0.5"
              max="10.0"
              step="0.5"
              value={maxLoss}
              onChange={(e) => setMaxLoss(parseFloat(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>R$ 0,50 (Conservador)</span>
              <span>R$ 3,00 (Padrão)</span>
              <span>R$ 10,00 (Total)</span>
            </div>
          </div>

          {/* Limite de Exposição Máxima */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-slate-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                Limite de Exposição Máxima em PENDLE (%)
              </span>
              <span className="text-cyan-400 font-bold">{maxExposure}%</span>
            </label>
            <p className="text-[10px] text-slate-400">
              Percentual máximo do patrimônio total permitido em tokens PENDLE. Evita sobreconcentração.
            </p>
            <input
              type="range"
              min="20"
              max="100"
              step="5"
              value={maxExposure}
              onChange={(e) => setMaxExposure(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>20% (Diversificado)</span>
              <span>80% (Padrão)</span>
              <span>100% (All-in)</span>
            </div>
          </div>

          {/* Taxa de Corretagem Simulada */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-slate-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                Taxa de Corretagem por Operação (%)
              </span>
              <span className="text-cyan-400 font-bold">{feeRate.toFixed(2)}%</span>
            </label>
            <p className="text-[10px] text-slate-400">
              Taxa fictícia cobrada sobre o volume de compra e venda (padrão 0.10% spot maker/taker).
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[0.0, 0.05, 0.10, 0.25].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setFeeRate(rate)}
                  className={`py-1.5 rounded-lg border text-[11px] font-bold ${
                    feeRate === rate
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-[#141c2c] border-[#222c42] text-slate-400 hover:text-white'
                  }`}
                >
                  {rate.toFixed(2)}%
                </button>
              ))}
            </div>
          </div>

          {/* Botões do Rodapé */}
          <div className="pt-3 border-t border-[#1e273a] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg bg-[#141c2c] hover:bg-[#1a253a] border border-[#222c42] text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-600/20"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Parâmetros</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
