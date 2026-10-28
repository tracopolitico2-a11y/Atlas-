/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { SimulationSummary, RiskSettings } from '../types/trading';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Coins,
  ShieldAlert,
  Percent,
  Receipt,
  Scale,
  HelpCircle,
  X,
  Calculator,
  Info,
  CheckCircle2
} from 'lucide-react';

interface WalletSummaryCardsProps {
  summary: SimulationSummary;
  riskSettings: RiskSettings;
}

type TooltipKey = 'balance' | 'custody' | 'equity' | 'pnl';

interface MetricTooltipData {
  title: string;
  metric: string;
  formula: string;
  explanation: string;
  example: string;
  ruleTip: string;
}

const TOOLTIP_DETAILS: Record<TooltipKey, MetricTooltipData> = {
  balance: {
    title: 'Saldo Livre em Caixa (BRL)',
    metric: 'Saldo disponível para novas compras',
    formula: 'Saldo Inicial (R$ 10,00) − Total Compras + Vendas − Taxas',
    explanation: 'Montante em reais imediatamente disponível para emissão de novas ordens simuladas.',
    example: 'Com R$ 10,00, ao comprar R$ 5,00 em PENDLE (taxa R$ 0,005), seu saldo livre torna-se R$ 4,995.',
    ruleTip: 'O sistema bloqueia compras caso o custo da ordem mais taxa exceda o saldo em caixa.',
  },
  custody: {
    title: 'Custódia & Preço Médio (PM)',
    metric: 'Quantidade em carteira e custo médio ponderado',
    formula: 'PM = Σ(Quantidade Comprada × Preço Pago) ÷ Quantidade Total',
    explanation: 'Quantidade total de PENDLE sob custódia e o preço médio ponderado de aquisição da posição.',
    example: 'Comprar 0,10 PENDLE a R$ 20 e 0,10 a R$ 30 resulta em 0,20 PENDLE com Preço Médio de R$ 25,00.',
    ruleTip: 'Vendas parciais realizam lucro mas preservam o PM inalterado até o zeramento total (100%).',
  },
  equity: {
    title: 'Patrimônio Total & Exposição (%)',
    metric: 'Valor de liquidação da carteira e alocação',
    formula: 'Patrimônio = Saldo Livre + (Custódia PENDLE × Preço Atual BRL)\nExposição (%) = (Posição em Cripto ÷ Patrimônio Total) × 100',
    explanation: 'Patrimônio total a valor de mercado e o percentual do capital alocado em ativos de risco.',
    example: 'Com R$ 5,00 em caixa e PENDLE valendo R$ 5,00, seu patrimônio é R$ 10,00 e sua exposição é 50%.',
    ruleTip: 'Compras são suspensas automaticamente caso excedam o teto de exposição configurado (ex: 80%).',
  },
  pnl: {
    title: 'Lucro / Prejuízo (P&L Consolidado)',
    metric: 'Rentabilidade total (Não Realizado + Realizado)',
    formula: 'P&L Não Realizado = (Preço Mercado − Preço Médio) × Custódia\nP&L Realizado = Σ(Preço Venda − Preço Médio) × Qtd − Taxas',
    explanation: 'Soma do resultado flutuante da posição aberta com os lucros/prejuízos já consolidados em vendas.',
    example: 'Com PM de R$ 25,00 e cotação a R$ 27,50 (+10%), o Não Realizado é positivo. Ao vender, vira Realizado.',
    ruleTip: 'Todas as taxas operacionais (0,10%) são deduzidas no cálculo final do lucro líquido.',
  },
};

export const WalletSummaryCards: React.FC<WalletSummaryCardsProps> = ({
  summary,
  riskSettings,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<TooltipKey | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<TooltipKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTooltip = activeTooltip || hoveredTooltip;

  // Fechar tooltip ao tocar/clicar fora no celular ou desktop
  useEffect(() => {
    if (!activeTooltip) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveTooltip(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDownOutside);
    return () => window.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [activeTooltip]);

  const toggleTooltip = (key: TooltipKey) => {
    setActiveTooltip((prev) => (prev === key ? null : key));
  };

  const isUnrealizedProfitable = summary.unrealizedPnlBrl >= 0;
  const isRealizedProfitable = summary.realizedPnlBrl >= 0;

  // Cor da barra de exposição: Verde até 50%, Amarelo até o limite, Vermelho se estourar
  const exposureRatio = summary.exposurePercent / riskSettings.maxExposurePercent;
  const exposureColor =
    summary.isMaxExposureBreached
      ? 'bg-rose-500'
      : exposureRatio > 0.8
      ? 'bg-amber-400'
      : 'bg-cyan-400';

  const renderTooltipPopover = (key: TooltipKey, alignRight: boolean = false) => {
    if (currentTooltip !== key) return null;
    const data = TOOLTIP_DETAILS[key];

    return (
      <div
        className={`absolute top-full mt-1.5 z-50 ${
          alignRight ? 'right-0 sm:right-auto' : 'left-0 sm:left-auto'
        } w-[265px] sm:w-[315px] max-w-[calc(100vw-24px)] bg-[#0d131f] border border-cyan-500/50 rounded-xl p-3 shadow-2xl backdrop-blur-xl text-slate-200 text-xs font-sans animate-in fade-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-1.5 border-b border-[#1d273a] pb-2 mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Calculator className="w-3 h-3" />
            </div>
            <div>
              <h4 className="font-mono font-bold text-white text-[11px] sm:text-xs leading-tight">
                {data.title}
              </h4>
              <span className="text-[9px] text-cyan-400 font-mono block">
                {data.metric}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTooltip(null);
              setHoveredTooltip(null);
            }}
            className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition-colors"
            aria-label="Fechar ajuda"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2 text-[11px] leading-relaxed">
          {/* Caixa de Fórmula Matemática */}
          <div className="bg-[#070b12] border border-cyan-900/60 rounded-lg p-2 font-mono text-[10px] text-cyan-300">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-semibold mb-0.5">
              Como é calculado:
            </span>
            <div className="whitespace-pre-line font-medium text-cyan-200">
              {data.formula}
            </div>
          </div>

          <p className="text-slate-300 text-[10.5px]">
            {data.explanation}
          </p>

          <div className="bg-[#121926] p-2 rounded-lg border border-slate-800 text-[10px] text-slate-300">
            <strong className="text-cyan-300 font-mono block mb-0.5">Exemplo Prático:</strong>
            {data.example}
          </div>

          <div className="flex items-start gap-1.5 text-[9.5px] text-amber-300/90 font-mono pt-0.5">
            <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <span>{data.ruleTip}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="space-y-1.5 sm:space-y-2.5">
      {/* Alerta de violação de limites se houver (otimizado e compacto) */}
      {summary.isLossLimitBreached && (
        <div className="bg-rose-950/90 border border-rose-500/70 rounded-lg p-2 sm:p-2.5 text-[11px] sm:text-xs text-rose-200 flex items-center gap-2 shadow-md animate-pulse">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="leading-tight">
            <strong className="font-bold text-rose-300 font-mono mr-1">LIMITE DE PERDA ATINGIDO:</strong>
            Prejuízo (R$ {Math.abs(summary.totalPnlBrl).toFixed(2)}) excedeu o limite de R$ {riskSettings.maxLossLimitBrl.toFixed(2)}. Novas compras suspensas.
          </div>
        </div>
      )}

      {/* Grid Compacto de Cards Financeiros com Tooltips Informativas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2.5">
        
        {/* Card 1: Saldo Disponível (R$) */}
        <div
          className={`bg-[#121724] border rounded-xl p-2 sm:p-3 shadow-md flex flex-col justify-between relative transition-colors cursor-pointer group ${
            currentTooltip === 'balance'
              ? 'border-cyan-500/80 shadow-cyan-950/40'
              : 'border-[#20293d] hover:border-slate-700'
          }`}
          onClick={() => toggleTooltip('balance')}
          onMouseEnter={() => setHoveredTooltip('balance')}
          onMouseLeave={() => setHoveredTooltip(null)}
        >
          <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-[11px] font-mono leading-none mb-1">
            <span className="flex items-center gap-1 uppercase font-semibold text-slate-300">
              <Wallet className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>Saldo Livre</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 hidden xs:inline">Caixa</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTooltip('balance');
                }}
                className={`p-0.5 rounded transition-colors ${
                  currentTooltip === 'balance' ? 'text-cyan-300 bg-cyan-950/80' : 'text-slate-500 hover:text-cyan-300'
                }`}
                title="Exibir fórmula do Saldo Livre"
                aria-label="Ver detalhes de cálculo do Saldo Livre"
              >
                <HelpCircle className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="text-base sm:text-lg lg:text-xl font-mono font-black text-white leading-tight">
            R$ {summary.balanceBrl.toFixed(2)}
          </div>

          <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono mt-0.5 flex items-center justify-between leading-none pt-0.5">
            <span>Base: <strong className="text-slate-300">R$ 10,00</strong></span>
            <span className="text-[9px] text-cyan-400/80 hidden sm:inline underline decoration-dotted">Fórmula</span>
          </div>

          {/* Popover da Tooltip (Card 1: Coluna 1 = alinhado à esquerda) */}
          {renderTooltipPopover('balance', false)}
        </div>

        {/* Card 2: Custódia PENDLE & Preço Médio */}
        <div
          className={`bg-[#121724] border rounded-xl p-2 sm:p-3 shadow-md flex flex-col justify-between relative transition-colors cursor-pointer group ${
            currentTooltip === 'custody'
              ? 'border-indigo-500/80 shadow-indigo-950/40'
              : 'border-[#20293d] hover:border-slate-700'
          }`}
          onClick={() => toggleTooltip('custody')}
          onMouseEnter={() => setHoveredTooltip('custody')}
          onMouseLeave={() => setHoveredTooltip(null)}
        >
          <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-[11px] font-mono leading-none mb-1">
            <span className="flex items-center gap-1 uppercase font-semibold text-slate-300">
              <Coins className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>Custódia</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-indigo-300/80 font-mono">
                ≈ R$ {summary.positionValueBrl.toFixed(2)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTooltip('custody');
                }}
                className={`p-0.5 rounded transition-colors ${
                  currentTooltip === 'custody' ? 'text-indigo-300 bg-indigo-950/80' : 'text-slate-500 hover:text-indigo-300'
                }`}
                title="Exibir fórmula da Custódia e Preço Médio"
                aria-label="Ver detalhes de cálculo da Custódia"
              >
                <HelpCircle className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="text-base sm:text-lg lg:text-xl font-mono font-black text-cyan-300 leading-tight">
            {summary.pendleAmount.toFixed(4)}{' '}
            <span className="text-[10px] sm:text-xs font-normal text-slate-400">PENDLE</span>
          </div>

          <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono mt-0.5 flex items-center justify-between leading-none pt-0.5">
            <span>PM: <strong className="text-slate-200">{summary.averageEntryPriceBrl > 0 ? `R$ ${summary.averageEntryPriceBrl.toFixed(2)}` : '—'}</strong></span>
            <span className="text-[9px] text-indigo-400/80 hidden sm:inline underline decoration-dotted">Fórmula PM</span>
          </div>

          {/* Popover da Tooltip (Card 2: Coluna 2 = alinhado à direita no mobile, esquerda no desktop) */}
          {renderTooltipPopover('custody', true)}
        </div>

        {/* Card 3: Patrimônio Total & Exposição */}
        <div
          className={`bg-[#121724] border rounded-xl p-2 sm:p-3 shadow-md flex flex-col justify-between relative transition-colors cursor-pointer group ${
            currentTooltip === 'equity'
              ? 'border-emerald-500/80 shadow-emerald-950/40'
              : 'border-[#20293d] hover:border-slate-700'
          }`}
          onClick={() => toggleTooltip('equity')}
          onMouseEnter={() => setHoveredTooltip('equity')}
          onMouseLeave={() => setHoveredTooltip(null)}
        >
          <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-[11px] font-mono leading-none mb-1">
            <span className="flex items-center gap-1 uppercase font-semibold text-slate-300">
              <Scale className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Patrimônio</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] sm:text-[10px] font-mono">
                Exp: <strong className={summary.isMaxExposureBreached ? 'text-rose-400' : 'text-slate-200'}>{summary.exposurePercent.toFixed(0)}%</strong>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTooltip('equity');
                }}
                className={`p-0.5 rounded transition-colors ${
                  currentTooltip === 'equity' ? 'text-emerald-300 bg-emerald-950/80' : 'text-slate-500 hover:text-emerald-300'
                }`}
                title="Exibir fórmula do Patrimônio e Exposição"
                aria-label="Ver detalhes de cálculo do Patrimônio e Exposição"
              >
                <HelpCircle className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="text-base sm:text-lg lg:text-xl font-mono font-black text-white leading-tight">
            R$ {summary.totalEquityBrl.toFixed(2)}
          </div>

          {/* Barra de Exposição Compacta */}
          <div className="mt-1 space-y-0.5">
            <div className="w-full bg-[#1c2436] h-1 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${exposureColor}`}
                style={{ width: `${Math.min(100, summary.exposurePercent)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[8px] sm:text-[9px] text-slate-500 font-mono leading-none">
              <span>Alocação</span>
              <span>Máx {riskSettings.maxExposurePercent.toFixed(0)}%</span>
            </div>
          </div>

          {/* Popover da Tooltip (Card 3: Coluna 1 no mobile = alinhado à esquerda, direita no desktop) */}
          {renderTooltipPopover('equity', false)}
        </div>

        {/* Card 4: Lucro / Prejuízo (P&L Consolidado) */}
        <div
          className={`bg-[#121724] border rounded-xl p-2 sm:p-3 shadow-md flex flex-col justify-between relative transition-colors cursor-pointer group ${
            currentTooltip === 'pnl'
              ? 'border-amber-500/80 shadow-amber-950/40'
              : 'border-[#20293d] hover:border-slate-700'
          }`}
          onClick={() => toggleTooltip('pnl')}
          onMouseEnter={() => setHoveredTooltip('pnl')}
          onMouseLeave={() => setHoveredTooltip(null)}
        >
          <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-[11px] font-mono leading-none mb-1">
            <span className="flex items-center gap-1 uppercase font-semibold text-slate-300">
              <Receipt className="w-3 h-3 text-amber-400 shrink-0" />
              <span>P&L Total</span>
            </span>
            <div className="flex items-center gap-1">
              <span className={`text-[9px] sm:text-[10px] font-bold font-mono px-1 py-0.2 rounded ${
                summary.totalPnlBrl >= 0
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
              }`}>
                {summary.totalPnlBrl >= 0 ? '+' : ''}R$ {summary.totalPnlBrl.toFixed(2)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTooltip('pnl');
                }}
                className={`p-0.5 rounded transition-colors ${
                  currentTooltip === 'pnl' ? 'text-amber-300 bg-amber-950/80' : 'text-slate-500 hover:text-amber-300'
                }`}
                title="Exibir fórmula do Lucro e Prejuízo (P&L)"
                aria-label="Ver detalhes de cálculo do P&L"
              >
                <HelpCircle className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-baseline gap-1 leading-tight">
            <span className={`text-base sm:text-lg lg:text-xl font-mono font-black ${
              isUnrealizedProfitable ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {isUnrealizedProfitable ? '+' : ''}R$ {summary.unrealizedPnlBrl.toFixed(2)}
            </span>
            <span className={`text-[10px] sm:text-xs font-mono font-semibold ${
              summary.unrealizedPnlPercent >= 0 ? 'text-emerald-400/90' : 'text-rose-400/90'
            }`}>
              ({summary.unrealizedPnlPercent >= 0 ? '+' : ''}{summary.unrealizedPnlPercent.toFixed(1)}%)
            </span>
          </div>

          <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono mt-0.5 flex items-center justify-between leading-none pt-0.5">
            <span title="Lucro/prejuízo realizado">
              Real: <strong className={isRealizedProfitable ? 'text-emerald-400' : 'text-rose-400'}>
                {isRealizedProfitable ? '+' : ''}R$ {summary.realizedPnlBrl.toFixed(2)}
              </strong>
            </span>
            <span title="Taxas totais pagas" className="text-slate-500 text-[8px] sm:text-[9px]">
              Tx: R$ {summary.totalFeesPaidBrl.toFixed(3)}
            </span>
          </div>

          {/* Popover da Tooltip (Card 4: Coluna 2 no mobile / Coluna 4 no desktop = alinhado à direita) */}
          {renderTooltipPopover('pnl', true)}
        </div>

      </div>
    </div>
  );
};
