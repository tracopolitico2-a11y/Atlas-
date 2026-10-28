/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, ShieldCheck, Globe } from 'lucide-react';
import { BinanceConnectionState } from '../services/binanceTestnet';

interface RegulatoryBannerProps {
  onOpenTestnetModal?: () => void;
  testnetState?: BinanceConnectionState;
  testnetErrorCode?: string;
  testnetErrorMessage?: string;
}

export const RegulatoryBanner: React.FC<RegulatoryBannerProps> = ({
  onOpenTestnetModal,
  testnetState = 'disconnected',
  testnetErrorCode,
  testnetErrorMessage,
}) => {
  const isRestricted =
    testnetState === 'restricted' || testnetErrorCode === 'BINANCE_TESTNET_RESTRICTED';

  const getTestnetLabel = () => {
    switch (testnetState) {
      case 'connected':
        return 'CONECTADO';
      case 'connecting':
        return 'CONECTANDO...';
      case 'symbol_unavailable':
        return 'PAR INDISPONÍVEL';
      case 'restricted':
        return 'INDISPONÍVEL (HTTP 451)';
      case 'error':
        return 'ERRO NA TESTNET';
      case 'disconnected':
      default:
        return 'OFFLINE';
    }
  };

  const getTestnetDotColor = () => {
    switch (testnetState) {
      case 'connected':
        return 'bg-emerald-400';
      case 'connecting':
        return 'bg-amber-400 animate-ping';
      case 'symbol_unavailable':
        return 'bg-amber-400';
      case 'restricted':
        return 'bg-rose-500';
      case 'error':
        return 'bg-rose-400';
      case 'disconnected':
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="flex flex-col border-y border-amber-500/30">
      {/* Tarja Principal de Simulação */}
      <div className="bg-amber-950/70 px-3 py-2 text-xs text-amber-200 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <strong className="font-mono uppercase tracking-wider text-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            SIMULAÇÃO LOCAL (R$ 10,00) — NÃO É COTAÇÃO REAL
          </strong>
        </div>

        <div className="text-amber-200/80 text-[11px] truncate hidden md:block">
          Ambiente 100% fictício para PENDLE/USDT • Sem ordens reais • Nenhuma chave privada no navegador
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenTestnetModal && (
            <button
              onClick={onOpenTestnetModal}
              className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                isRestricted
                  ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-200 border-rose-600/60'
                  : 'bg-amber-900/80 hover:bg-amber-800 text-amber-200 border-amber-600/60'
              }`}
              title="Clique para inspecionar a conexão com Binance Spot Testnet"
            >
              <Globe className="w-3 h-3 text-amber-400" />
              <span className="font-bold">BINANCE SPOT TESTNET:</span>
              <span className={`w-1.5 h-1.5 rounded-full ${getTestnetDotColor()}`}></span>
              <span>{getTestnetLabel()}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 text-[10px] bg-emerald-950/70 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-700/50">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            SEM RISCO FINANCEIRO
          </div>
        </div>
      </div>

      {/* Tarja de Alerta Específico de Restrição Geográfica HTTP 451 */}
      {isRestricted && (
        <div className="bg-rose-950/90 border-t border-rose-600/50 px-3 py-1.5 text-xs text-rose-200 flex flex-wrap items-center justify-between gap-2 font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-bold text-rose-200">
              Binance Spot Testnet indisponível nesta conexão — HTTP 451. Consulte o suporte oficial
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="bg-rose-900/80 px-2 py-0.5 rounded border border-rose-500/50 text-rose-200 font-semibold">
              STATUS: BINANCE_TESTNET_RESTRICTED
            </span>
            <span className="text-rose-300/80 hidden sm:inline">
              Simulador local ativo em modo isolado (R$ 10,00)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
