/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  Sliders,
  Cpu,
  Flame,
  Bell,
  Globe
} from 'lucide-react';
import { RiskSettings } from '../types/trading';
import { BinanceConnectionState } from '../services/binanceTestnet';

interface TerminalHeaderProps {
  riskSettings: RiskSettings;
  onToggleKillSwitch: () => void;
  onOpenRiskSettings: () => void;
  onOpenTestAudit: () => void;
  onOpenReset: () => void;
  onOpenAlerts: () => void;
  activeAlertCount: number;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  onOpenTestnetModal?: () => void;
  testnetState?: BinanceConnectionState;
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  riskSettings,
  onToggleKillSwitch,
  onOpenRiskSettings,
  onOpenTestAudit,
  onOpenReset,
  onOpenAlerts,
  activeAlertCount,
  isSimulating,
  onToggleSimulation,
  onOpenTestnetModal,
  testnetState = 'disconnected',
}) => {
  return (
    <header className="bg-[#0e131d] border-b border-[#1f293d] sticky top-0 z-30 shadow-md">
      <div className="max-w-[1700px] mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 via-indigo-600 to-emerald-500 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-[#0b0e14] rounded-[6px] flex items-center justify-center font-mono font-black text-cyan-400 text-sm">
              Ω
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="font-mono font-extrabold tracking-wider text-white text-base">
                ATLAS<span className="text-cyan-400">Ω</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest hidden sm:inline">
                Trader Intelligence
              </span>
              <span className="text-[9px] px-1.5 py-0.2 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded font-mono">
                v1.1 TESTNET
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden md:block">
              Simulador PENDLE/USDT • Capital Base: R$ 10,00 • BINANCE SPOT TESTNET
            </p>
          </div>
        </div>

        {/* Ações e Controles Centrais / Direita */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Status do Gerador de Ticks */}
          <button
            onClick={onToggleSimulation}
            className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-all ${
              isSimulating
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/50'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
            title={isSimulating ? 'Pausar oscilação simulada de ticks' : 'Retomar oscilação simulada de ticks'}
          >
            <span className={`w-2 h-2 rounded-full ${isSimulating ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
            <span className="hidden xs:inline">{isSimulating ? 'TICK: LIVE' : 'TICK: PAUSA'}</span>
          </button>

          {/* Botão BINANCE SPOT TESTNET — AMBIENTE DE TESTE */}
          {onOpenTestnetModal && (
            <button
              onClick={onOpenTestnetModal}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                testnetState === 'connected'
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/70'
                  : testnetState === 'connecting'
                  ? 'bg-amber-950/70 text-amber-300 border-amber-500/50'
                  : testnetState === 'symbol_unavailable'
                  ? 'bg-amber-950/70 text-amber-300 border-amber-600/50 hover:bg-amber-900/70'
                  : testnetState === 'restricted'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-600/60 hover:bg-rose-900/80'
                  : testnetState === 'error'
                  ? 'bg-rose-950/70 text-rose-300 border-rose-500/50 hover:bg-rose-900/70'
                  : 'bg-[#182030] text-slate-300 border-[#2a3752] hover:bg-[#1f2a42]'
              }`}
              title="BINANCE SPOT TESTNET — AMBIENTE DE TESTE: Clique para diagnósticos completos"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">
                {testnetState === 'restricted' ? 'TESTNET (451)' : 'TESTNET'}
              </span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                testnetState === 'connected'
                  ? 'bg-emerald-400'
                  : testnetState === 'connecting'
                  ? 'bg-amber-400 animate-ping'
                  : testnetState === 'symbol_unavailable'
                  ? 'bg-amber-400'
                  : testnetState === 'restricted'
                  ? 'bg-rose-500'
                  : testnetState === 'error'
                  ? 'bg-rose-400'
                  : 'bg-slate-400'
              }`}></span>
            </button>
          )}

          {/* KILL SWITCH (Disjuntor de Emergência) - Destaque Primário */}
          <button
            onClick={onToggleKillSwitch}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              riskSettings.killSwitchActive
                ? 'bg-rose-900/90 text-rose-100 border-rose-500 animate-pulse ring-2 ring-rose-500/50'
                : 'bg-[#182030] text-slate-300 border-[#2a3752] hover:bg-[#1f2a42]'
            }`}
            title="Kill Switch: Quando ativado, bloqueia imediatamente todas as compras e mantém vendas liberadas"
          >
            {riskSettings.killSwitchActive ? (
              <>
                <Flame className="w-3.5 h-3.5 text-rose-300" />
                <span>KILL SWITCH ATIVO</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">KILL SWITCH: OFF</span>
                <span className="sm:hidden">KILL SW</span>
              </>
            )}
          </button>

          {/* Alertas Sonoros e Visuais */}
          <button
            onClick={onOpenAlerts}
            className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors relative ${
              activeAlertCount > 0
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 hover:bg-amber-900/60'
                : 'bg-[#141a29] border-[#222c42] text-slate-300 hover:text-white'
            }`}
            title="Configurar Alertas de Preço Sonoros e Visuais"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold hidden xs:inline">Alertas</span>
            {activeAlertCount > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-none">
                {activeAlertCount}
              </span>
            )}
          </button>

          {/* Auditoria de Testes (25/25) */}
          <button
            onClick={onOpenTestAudit}
            className="px-2 sm:px-2.5 py-1.5 rounded-lg border bg-cyan-950/40 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50 text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Abrir suíte de testes unitários automatizados (25 testes)"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">TESTES (25/25)</span>
          </button>

          {/* Configurações de Risco */}
          <button
            onClick={onOpenRiskSettings}
            className="px-2 sm:px-2.5 py-1.5 rounded-lg border bg-[#141a29] border-[#222c42] hover:bg-[#1a2336] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Ajustar limites de exposição, perda máxima e taxas"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold hidden md:inline">Gestão de Risco</span>
          </button>

          {/* Reset da Carteira */}
          <button
            onClick={onOpenReset}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border bg-slate-900 border-slate-700/80 hover:bg-rose-950/40 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Restaurar saldo inicial de R$ 10,00 e limpar histórico"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
};
