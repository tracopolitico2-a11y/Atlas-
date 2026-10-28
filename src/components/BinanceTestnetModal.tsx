/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ATLASΩ Trader Intelligence
 * Modal de Diagnóstico e Gestão da Conexão com Binance Spot Testnet
 */

import React, { useState } from 'react';
import {
  TestnetDiagnostics,
  BINANCE_TESTNET_BASE_URL,
  binanceTestnetService,
} from '../services/binanceTestnet';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
  Lock,
  Globe,
  Clock,
  Activity,
  Layers,
  FileText
} from 'lucide-react';

interface BinanceTestnetModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: TestnetDiagnostics;
  onRunDiagnostics: () => Promise<void>;
  isChecking: boolean;
}

export const BinanceTestnetModal: React.FC<BinanceTestnetModalProps> = ({
  isOpen,
  onClose,
  diagnostics,
  onRunDiagnostics,
  isChecking,
}) => {
  if (!isOpen) return null;

  const getStatusBadge = () => {
    switch (diagnostics.state) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            CONECTADO
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-950/80 border border-amber-500/50 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            CONECTANDO...
          </span>
        );
      case 'symbol_unavailable':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-950/80 border border-amber-600/50 text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            SÍMBOLO INDISPONÍVEL
          </span>
        );
      case 'restricted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-950/90 border border-rose-500/60 text-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            INDISPONÍVEL (HTTP 451)
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-950/80 border border-rose-500/50 text-rose-400">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            ERRO NA CONEXÃO
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            DESCONECTADO
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[#0e131d] border border-[#222d42] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-[#1f293d] flex items-center justify-between bg-[#121926]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-bold text-white text-base">
                  BINANCE SPOT TESTNET
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 font-semibold">
                  AMBIENTE DE TESTE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Endpoint Oficial: {BINANCE_TESTNET_BASE_URL}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Card de Regras de Segurança e Isolamento */}
          <div className="bg-[#121a29] border border-cyan-900/50 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-cyan-300 flex items-center gap-1.5 uppercase text-[11px]">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Arquitetura de Segurança & Isolamento Estrito
              </span>
              <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                100% PROTEGIDO
              </span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 font-mono pt-1">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Endpoint exclusivo:</strong> Acesso restrito a <code className="text-cyan-300">testnet.binance.vision</code>.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Produção bloqueada:</strong> <code className="text-rose-400">api.binance.com</code> bloqueado no código.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Ordens bloqueadas:</strong> Zero chamadas a <code className="text-amber-300">POST /v3/order</code>.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Zero Credenciais:</strong> Nenhuma API Key ou secret armazenado no navegador.</span>
              </li>
            </ul>
          </div>

          {/* Card de Aviso Específico de Restrição de Localização HTTP 451 */}
          {(diagnostics.state === 'restricted' || diagnostics.httpStatusCode === 451 || diagnostics.errorCode === 'BINANCE_TESTNET_RESTRICTED') && (
            <div className="bg-rose-950/60 border border-rose-500/60 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <h4 className="font-mono font-bold text-rose-200 text-sm">
                  Binance Spot Testnet indisponível nesta conexão — HTTP 451. Consulte o suporte oficial
                </h4>
              </div>
              <div className="text-rose-200/90 text-xs font-mono space-y-1.5 pt-1">
                <p>
                  <strong>Diagnóstico de Elegibilidade:</strong> O IP desta conexão pertence a uma região geográfica restrita pelos termos da Binance.
                </p>
                <p>
                  <strong>Diretriz de Conformidade:</strong> O ATLASΩ não utiliza proxies nem VPNs para burlar restrições e interrompeu tentativas repetitivas de conexão.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="bg-rose-900/80 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-500/60 text-rose-200">
                    CÓDIGO: BINANCE_TESTNET_RESTRICTED
                  </span>
                  <span className="text-[10px] text-slate-300">
                    Preços e negociações operando em Modo de Simulação Local (R$ 10,00)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Status do Par PENDLEUSDT */}
          <div className={`p-4 rounded-xl border ${
            diagnostics.pendleAvailable
              ? 'bg-emerald-950/30 border-emerald-500/40'
              : 'bg-amber-950/30 border-amber-500/40'
          }`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white text-sm">
                  Par: PENDLEUSDT
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  diagnostics.pendleAvailable
                    ? 'bg-emerald-900 text-emerald-200 border border-emerald-700'
                    : 'bg-amber-900 text-amber-200 border border-amber-700'
                }`}>
                  {diagnostics.pendleAvailable ? 'ATIVO NA TESTNET' : 'PENDLEUSDT INDISPONÍVEL'}
                </span>
              </div>
            </div>

            <p className="text-slate-300 text-xs font-mono leading-relaxed mb-3">
              {diagnostics.pendleStatusMessage}
            </p>

            {/* Aviso obrigatório de fallback */}
            {!diagnostics.pendleAvailable && (
              <div className="bg-[#0b0e14]/80 p-2.5 rounded-lg border border-amber-700/30 text-[11px] text-amber-200/90 font-mono">
                ⚠️ <strong>Atenção:</strong> O ativo PENDLE não é substituído automaticamente por outro par. O simulador local permanece operando com motor financeiro autônomo, capital base de R$ 10,00 e gestão de risco inalterada.
              </div>
            )}

            {/* Exibição dos filtros reais quando disponível */}
            {diagnostics.symbolInfo && (
              <div className="mt-3 pt-3 border-t border-[#1f293d] space-y-2">
                <span className="font-mono font-bold text-slate-300 text-[11px] uppercase tracking-wider block">
                  Filtros Reais da Binance Testnet:
                </span>
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="bg-[#0e131d] p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">LOT_SIZE (Min Qty)</span>
                    <strong className="text-cyan-400 text-xs">
                      {diagnostics.symbolInfo.lotSizeFilter?.minQty ?? 'N/D'} PENDLE
                    </strong>
                  </div>
                  <div className="bg-[#0e131d] p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">PRICE_FILTER (Tick)</span>
                    <strong className="text-cyan-400 text-xs">
                      {diagnostics.symbolInfo.priceFilter?.tickSize ?? 'N/D'} USDT
                    </strong>
                  </div>
                  <div className="bg-[#0e131d] p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">MIN_NOTIONAL</span>
                    <strong className="text-cyan-400 text-xs">
                      {diagnostics.symbolInfo.notionalFilter?.minNotional ?? 'N/D'} USDT
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Diagnósticos de Rede & Conectividade */}
          <div className="bg-[#121824] border border-[#1e273a] rounded-xl p-3.5 space-y-3 font-mono">
            <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5 uppercase">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Métricas da Conexão REST
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
              <div className="bg-[#0e131d] p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Ping (/v3/ping)</span>
                <strong className={diagnostics.lastPingLatencyMs ? 'text-emerald-400' : 'text-slate-500'}>
                  {diagnostics.lastPingLatencyMs ? `${diagnostics.lastPingLatencyMs} ms` : 'Não testado'}
                </strong>
              </div>
              <div className="bg-[#0e131d] p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Time Offset (/v3/time)</span>
                <strong className={diagnostics.lastTimeOffsetMs !== undefined ? 'text-cyan-400' : 'text-slate-500'}>
                  {diagnostics.lastTimeOffsetMs !== undefined ? `${diagnostics.lastTimeOffsetMs} ms` : 'Não sinc.'}
                </strong>
              </div>
              <div className="bg-[#0e131d] p-2.5 rounded-lg border border-slate-800 col-span-2 sm:col-span-1">
                <span className="text-slate-400 text-[10px] block">Código HTTP Retornado</span>
                <strong className={diagnostics.httpStatusCode === 200 ? 'text-emerald-400' : diagnostics.httpStatusCode ? 'text-rose-400' : 'text-slate-500'}>
                  {diagnostics.httpStatusCode ? `HTTP ${diagnostics.httpStatusCode}` : 'Nenhum'}
                </strong>
              </div>
            </div>

            {diagnostics.errorMessage && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  Detalhe Técnico da Falha:
                </div>
                <div className="break-words text-rose-200/90 text-[10px] font-mono">
                  {diagnostics.errorMessage}
                </div>
              </div>
            )}
          </div>

          {/* Origem Atual dos Dados */}
          <div className="bg-[#0d121c] border border-slate-800 rounded-xl p-3 text-[11px] font-mono flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[10px]">ORIGEM DOS DADOS DE MERCADO:</span>
              <strong className="text-cyan-300 font-bold">
                SIMULAÇÃO LOCAL (DADOS GERADOS AUTÔNOMOS)
              </strong>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">CAPITAL SIMULADO:</span>
              <strong className="text-emerald-400 font-bold">
                R$ 10,00 (REAIS)
              </strong>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#1f293d] bg-[#121926] flex items-center justify-between gap-3">
          <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
            Modo seguro: Nenhuma ordem real ou fictícia é postada na exchange externa.
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={onRunDiagnostics}
              disabled={isChecking}
              className={`px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-2 shadow-lg transition-all ${
                isChecking ? 'opacity-70 cursor-wait' : 'active:scale-95'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Verificando Testnet...' : 'Testar Conexão Testnet'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
