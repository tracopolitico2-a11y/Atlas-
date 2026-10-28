/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { Candle, Trade, MarketState, PriceAlert, WalletState } from '../types/trading';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Layers,
  Eye,
  EyeOff,
  Crosshair,
  BarChart2,
  Calendar,
  AlertCircle,
  Bell
} from 'lucide-react';

interface MarketChartProps {
  candles: Candle[];
  trades: Trade[];
  marketState: MarketState;
  wallet?: WalletState;
  averageEntryPriceBrl?: number;
  pendleAmount?: number;
  alerts?: PriceAlert[];
  onPriceSelect?: (price: number) => void;
  onOpenAlertsModal?: () => void;
}

export const MarketChart: React.FC<MarketChartProps> = ({
  candles,
  trades,
  marketState,
  wallet,
  averageEntryPriceBrl,
  pendleAmount,
  alerts = [],
  onPriceSelect,
  onOpenAlertsModal,
}) => {
  const [chartType, setChartType] = useState<'candles' | 'line'>('candles');
  const [showTrades, setShowTrades] = useState<boolean>(true);
  const [showIndicators, setShowIndicators] = useState<boolean>(true);
  const [showRsi, setShowRsi] = useState<boolean>(true);
  const [showAlertLines, setShowAlertLines] = useState<boolean>(true);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [hoveredTrade, setHoveredTrade] = useState<Trade | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Obtenção do Preço Médio e Custódia da Posição Atual
  // Prioriza wallet / props diretas; calcula a partir de trades como fallback
  const { currentPendleAmount, currentAverageEntryPrice } = useMemo(() => {
    if (wallet) {
      return {
        currentPendleAmount: wallet.pendleAmount,
        currentAverageEntryPrice: wallet.averageEntryPriceBrl,
      };
    }
    if (pendleAmount !== undefined && averageEntryPriceBrl !== undefined) {
      return {
        currentPendleAmount: pendleAmount,
        currentAverageEntryPrice: averageEntryPriceBrl,
      };
    }
    // Fallback: calcula cronologicamente a partir dos trades
    let qty = 0;
    let avg = 0;
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    for (const t of sortedTrades) {
      if (t.type === 'BUY') {
        const newQty = qty + t.amount;
        avg = newQty > 0 ? (qty * avg + t.grossTotalBrl) / newQty : 0;
        qty = newQty;
      } else {
        qty = Math.max(0, qty - t.amount);
        if (qty === 0) avg = 0;
      }
    }
    return {
      currentPendleAmount: qty,
      currentAverageEntryPrice: avg,
    };
  }, [wallet, pendleAmount, averageEntryPriceBrl, trades]);

  // 2. Cálculo do PnL Não Realizado atualizado a cada TICK da cotação
  const hasOpenPosition = currentPendleAmount > 0.000001 && currentAverageEntryPrice > 0;

  const unrealizedPnlData = useMemo(() => {
    if (!hasOpenPosition) {
      return {
        hasPosition: false,
        pnlBrl: 0,
        pnlPercent: 0,
        positionValueBrl: 0,
        priceDiff: 0,
        isProfitable: false,
      };
    }

    const priceDiff = marketState.currentPriceBrl - currentAverageEntryPrice;
    const pnlBrl = priceDiff * currentPendleAmount;
    const pnlPercent = currentAverageEntryPrice > 0 ? (priceDiff / currentAverageEntryPrice) * 100 : 0;
    const positionValueBrl = currentPendleAmount * marketState.currentPriceBrl;

    return {
      hasPosition: true,
      pnlBrl,
      pnlPercent,
      positionValueBrl,
      priceDiff,
      isProfitable: pnlBrl >= 0,
    };
  }, [hasOpenPosition, marketState.currentPriceBrl, currentAverageEntryPrice, currentPendleAmount]);

  // Determinar limites de preço para escala
  const { minPrice, maxPrice, priceRange, ema9Points, ema21Points } = useMemo(() => {
    if (candles.length === 0) {
      return { minPrice: 20, maxPrice: 30, priceRange: 10, ema9Points: [], ema21Points: [] };
    }

    let min = Math.min(...candles.map((c) => c.low));
    let max = Math.max(...candles.map((c) => c.high));

    // Incluir preços de trades relevantes no range
    trades.forEach((t) => {
      min = Math.min(min, t.priceBrl);
      max = Math.max(max, t.priceBrl);
    });

    // Se houver posição aberta, incluir preço médio da posição nos limites do gráfico
    if (hasOpenPosition && currentAverageEntryPrice > 0) {
      min = Math.min(min, currentAverageEntryPrice);
      max = Math.max(max, currentAverageEntryPrice);
    }

    // Adiciona margem de 5% no topo e fundo
    const padding = Math.max(0.2, (max - min) * 0.08);
    min = Math.max(0.1, min - padding);
    max = max + padding;
    const range = max - min;

    // Calcular EMAs para os candles
    const closes = candles.map((c) => c.close);
    const k9 = 2 / (9 + 1);
    const k21 = 2 / (21 + 1);

    let ema9 = closes[0];
    let ema21 = closes[0];

    const ema9Pts: number[] = [];
    const ema21Pts: number[] = [];

    closes.forEach((c) => {
      ema9 = c * k9 + ema9 * (1 - k9);
      ema21 = c * k21 + ema21 * (1 - k21);
      ema9Pts.push(ema9);
      ema21Pts.push(ema21);
    });

    return { minPrice: min, maxPrice: max, priceRange: range, ema9Points: ema9Pts, ema21Points: ema21Pts };
  }, [candles, trades, hasOpenPosition, currentAverageEntryPrice]);

  // Dimensões do SVG
  const width = 800;
  const height = 340;
  const chartHeight = showRsi ? 250 : 310;
  const rsiHeight = 65;
  const rsiTop = chartHeight + 15;
  const paddingRight = 65; // espaço para escala de preço à direita
  const paddingBottom = 25; // espaço para datas

  const availableWidth = width - paddingRight;

  const candleWidth = Math.max(4, Math.min(18, (availableWidth / Math.max(1, candles.length)) * 0.7));

  const getX = (index: number) => {
    if (candles.length <= 1) return availableWidth / 2;
    return (index / (candles.length - 1)) * (availableWidth - 20) + 10;
  };

  const getY = (price: number) => {
    return chartHeight - ((price - minPrice) / (priceRange || 1)) * (chartHeight - 30) - 15;
  };

  // Mapear trades aos candles mais próximos ou aos índices de tempo
  const mappedTrades = useMemo(() => {
    if (!showTrades || trades.length === 0 || candles.length === 0) return [];

    const firstTime = candles[0].timestamp;
    const lastTime = candles[candles.length - 1].timestamp;
    const timeSpan = Math.max(1, lastTime - firstTime);

    return trades.map((trade) => {
      // Encontrar candle mais próximo por timestamp ou proporcional
      let x = availableWidth / 2;
      if (trade.timestamp <= firstTime) {
        x = getX(0);
      } else if (trade.timestamp >= lastTime) {
        x = getX(candles.length - 1);
      } else {
        const ratio = (trade.timestamp - firstTime) / timeSpan;
        x = 10 + ratio * (availableWidth - 20);
      }
      const y = getY(trade.priceBrl);
      return { trade, x, y };
    });
  }, [trades, showTrades, candles, availableWidth]);

  // Interação do mouse/touch
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const scaleX = width / rect.width;
    const svgX = clientX * scaleX;

    if (svgX < 0 || svgX > availableWidth) {
      setHoveredCandle(null);
      setHoverX(null);
      return;
    }

    setHoverX(svgX);
    // Encontrar candle mais próximo
    let closestIdx = 0;
    let closestDist = Infinity;
    candles.forEach((_, idx) => {
      const cx = getX(idx);
      const dist = Math.abs(cx - svgX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = idx;
      }
    });

    if (candles[closestIdx]) {
      setHoveredCandle(candles[closestIdx]);
    }
  };

  const handlePointerLeave = () => {
    setHoveredCandle(null);
    setHoverX(null);
    setHoveredTrade(null);
  };

  // Traçado da linha de preço (se modo linha)
  const linePoints = useMemo(() => {
    if (candles.length === 0) return '';
    return candles.map((c, i) => `${getX(i)},${getY(c.close)}`).join(' ');
  }, [candles, minPrice, priceRange]);

  const areaPoints = useMemo(() => {
    if (candles.length === 0) return '';
    const firstX = getX(0);
    const lastX = getX(candles.length - 1);
    return `${firstX},${chartHeight} ` + candles.map((c, i) => `${getX(i)},${getY(c.close)}`).join(' ') + ` ${lastX},${chartHeight}`;
  }, [candles, minPrice, priceRange, chartHeight]);

  // Linhas das EMAs
  const ema9Path = useMemo(() => {
    if (!showIndicators || ema9Points.length === 0) return '';
    return ema9Points.map((val, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(val)}`).join(' ');
  }, [ema9Points, showIndicators]);

  const ema21Path = useMemo(() => {
    if (!showIndicators || ema21Points.length === 0) return '';
    return ema21Points.map((val, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(val)}`).join(' ');
  }, [ema21Points, showIndicators]);

  // Geração de linhas de grid horizontal
  const gridLevels = 5;
  const gridPrices = Array.from({ length: gridLevels }, (_, i) => {
    return minPrice + (priceRange / (gridLevels - 1)) * i;
  });

  const trendBadgeColor =
    marketState.trend === 'ALTA'
      ? 'text-emerald-400 bg-emerald-950/70 border-emerald-500/40'
      : marketState.trend === 'BAIXA'
      ? 'text-rose-400 bg-rose-950/70 border-rose-500/40'
      : 'text-cyan-400 bg-cyan-950/70 border-cyan-500/40';

  const TrendIcon =
    marketState.trend === 'ALTA'
      ? TrendingUp
      : marketState.trend === 'BAIXA'
      ? TrendingDown
      : Minus;

  return (
    <div
      ref={containerRef}
      className="bg-[#101520] border border-[#222c42] rounded-xl overflow-hidden shadow-2xl flex flex-col relative"
    >
      {/* Top Header do Gráfico */}
      <div className="bg-[#131a28] border-b border-[#222c42] px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Par e Identificação de Simulação Obrigatória */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-mono font-bold text-sm tracking-wide text-white">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            PENDLE / USDT
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            SIMULAÇÃO
          </span>
          <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
            Cotação base R$: <strong className="text-white">R$ {marketState.currentPriceBrl.toFixed(2)}</strong> (~${marketState.currentPriceUsdt.toFixed(2)} USDT)
          </span>
        </div>

        {/* Tendência Fictícia e Indicadores */}
        <div className="flex items-center gap-2">
          {/* Badge de Tendência Fictícia */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border ${trendBadgeColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span className="font-semibold">TENDÊNCIA: {marketState.trend}</span>
            <span className="text-[10px] opacity-80">({marketState.trendStrength}%)</span>
          </div>

          {/* Alternadores de visualização */}
          <div className="flex items-center bg-[#0d121c] border border-[#222c42] rounded-lg p-0.5">
            <button
              onClick={() => setChartType('candles')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1 ${
                chartType === 'candles' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Gráfico de Candlesticks"
            >
              <BarChart2 className="w-3 h-3" />
              Candles
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1 ${
                chartType === 'line' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Gráfico de Linha"
            >
              <Activity className="w-3 h-3" />
              Linha
            </button>
          </div>

          {/* Toggle de Trades no Gráfico */}
          <button
            onClick={() => setShowTrades(!showTrades)}
            className={`px-2 py-1 rounded border text-[11px] font-mono transition-colors flex items-center gap-1 ${
              showTrades
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-300'
                : 'bg-[#0d121c] border-[#222c42] text-slate-400 hover:text-white'
            }`}
            title="Exibir/Ocultar Ordens do Usuário sobre o gráfico"
          >
            <Layers className="w-3 h-3" />
            Trades ({trades.length})
          </button>

          {/* Toggle de Médias Móveis */}
          <button
            onClick={() => setShowIndicators(!showIndicators)}
            className={`px-2 py-1 rounded border text-[11px] font-mono transition-colors hidden sm:flex items-center gap-1 ${
              showIndicators
                ? 'bg-blue-950/60 border-blue-500/50 text-blue-300'
                : 'bg-[#0d121c] border-[#222c42] text-slate-400 hover:text-white'
            }`}
            title="Exibir Médias Móveis EMA 9 e EMA 21"
          >
            {showIndicators ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            EMA 9/21
          </button>

          {/* Botão de Alertas de Preço no Gráfico */}
          <button
            onClick={() => onOpenAlertsModal ? onOpenAlertsModal() : setShowAlertLines(!showAlertLines)}
            className={`px-2 py-1 rounded border text-[11px] font-mono transition-colors flex items-center gap-1 ${
              alerts.some((a) => a.isActive)
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                : 'bg-[#0d121c] border-[#222c42] text-slate-400 hover:text-white'
            }`}
            title="Gerenciar e Visualizar Alertas de Preço no Gráfico"
          >
            <Bell className="w-3 h-3 text-amber-400" />
            <span>Alertas ({alerts.filter((a) => a.isActive).length})</span>
          </button>
        </div>
      </div>

      {/* Sub-barra de Info OHLC do Candle sob o cursor */}
      <div className="bg-[#0c1018] px-3 py-1.5 border-b border-[#1b2336] flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-x-4 gap-y-1">
        <div className="flex items-center gap-3">
          {hoveredCandle ? (
            <>
              <span className="text-slate-300 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-cyan-400" />
                {new Date(hoveredCandle.timestamp).toLocaleTimeString('pt-BR')}
              </span>
              <span>A: <strong className="text-white">R$ {hoveredCandle.open.toFixed(2)}</strong></span>
              <span>MÁX: <strong className="text-emerald-400">R$ {hoveredCandle.high.toFixed(2)}</strong></span>
              <span>MÍN: <strong className="text-rose-400">R$ {hoveredCandle.low.toFixed(2)}</strong></span>
              <span>F: <strong className={hoveredCandle.close >= hoveredCandle.open ? 'text-emerald-400' : 'text-rose-400'}>
                R$ {hoveredCandle.close.toFixed(2)}
              </strong></span>
              <span>VOL: <strong className="text-cyan-400">{hoveredCandle.volume.toFixed(2)}</strong></span>
            </>
          ) : (
            <>
              <span className="text-slate-400 flex items-center gap-1">
                <Crosshair className="w-3 h-3 text-slate-500" />
                Passe o cursor sobre o gráfico para detalhes OHLC
              </span>
              <span>Preço Atual: <strong className="text-cyan-300">R$ {marketState.currentPriceBrl.toFixed(2)}</strong></span>
              {showIndicators && (
                <>
                  <span className="text-amber-400 font-semibold">EMA(9): R$ {marketState.ema9.toFixed(2)}</span>
                  <span className="text-indigo-400 font-semibold">EMA(21): R$ {marketState.ema21.toFixed(2)}</span>
                </>
              )}
            </>
          )}
        </div>

        {/* RSI em tempo real */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">RSI(14):</span>
          <span className={`font-bold ${
            marketState.rsi14 >= 70
              ? 'text-rose-400'
              : marketState.rsi14 <= 30
              ? 'text-emerald-400'
              : 'text-cyan-300'
          }`}>
            {marketState.rsi14.toFixed(1)} {marketState.rsi14 >= 70 ? '(Sobrecompra)' : marketState.rsi14 <= 30 ? '(Sobrevenda)' : '(Neutro)'}
          </span>
        </div>
      </div>

      {/* Área Principal de Renderização Gráfica em SVG */}
      <div className="relative w-full h-[320px] sm:h-[350px] bg-gradient-to-b from-[#0e131d] to-[#0a0d14] select-none">
        {/* Marca d'água permanente de segurança e simulação no fundo do gráfico */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.06]">
          <div className="text-center font-mono font-extrabold uppercase tracking-widest text-white leading-none">
            <div className="text-5xl sm:text-7xl">ATLASΩ</div>
            <div className="text-xl sm:text-2xl mt-2 text-amber-400">SIMULADOR PENDLE/USDT</div>
            <div className="text-xs sm:text-sm mt-1">NÃO É MERCADO REAL</div>
          </div>
        </div>

        {/* INDICADOR FLUTUANTE DE PnL NÃO REALIZADO (TICK-BY-TICK) */}
        <div
          className={`absolute top-2.5 left-2.5 z-10 pointer-events-auto backdrop-blur-md rounded-lg border shadow-xl transition-all duration-200 select-none ${
            unrealizedPnlData.hasPosition
              ? unrealizedPnlData.isProfitable
                ? 'bg-[#081816]/92 border-emerald-500/50 shadow-emerald-950/30'
                : 'bg-[#1b0d14]/92 border-rose-500/50 shadow-rose-950/30'
              : 'bg-[#0e1420]/88 border-[#232f48] shadow-black/40'
          }`}
        >
          <div className="px-2.5 py-1.5 sm:px-3 sm:py-2 font-mono">
            {/* Linha 1: Status e Quantidade */}
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider">
                <span
                  className={`w-2 h-2 rounded-full ${
                    unrealizedPnlData.hasPosition
                      ? unrealizedPnlData.isProfitable
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-rose-400 animate-pulse'
                      : 'bg-slate-500'
                  }`}
                />
                <span
                  className={
                    unrealizedPnlData.hasPosition
                      ? unrealizedPnlData.isProfitable
                        ? 'text-emerald-300'
                        : 'text-rose-300'
                      : 'text-slate-400'
                  }
                >
                  {unrealizedPnlData.hasPosition ? 'Posição Aberta' : 'Sem Posição'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">
                {unrealizedPnlData.hasPosition
                  ? `${currentPendleAmount.toFixed(4)} PENDLE`
                  : '0.0000 PENDLE'}
              </span>
            </div>

            {/* Linha 2: PnL Não Realizado em R$ e % */}
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-medium">
                PnL Não Realizado:
              </span>
              <span
                className={`text-xs sm:text-sm font-black flex items-center gap-0.5 ${
                  unrealizedPnlData.hasPosition
                    ? unrealizedPnlData.isProfitable
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {unrealizedPnlData.hasPosition ? (
                  <>
                    {unrealizedPnlData.isProfitable ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    {unrealizedPnlData.pnlBrl >= 0 ? '+' : ''}R${' '}
                    {unrealizedPnlData.pnlBrl.toFixed(2)}
                    <span className="text-[11px] sm:text-xs font-semibold ml-1">
                      ({unrealizedPnlData.pnlPercent >= 0 ? '+' : ''}
                      {unrealizedPnlData.pnlPercent.toFixed(2)}%)
                    </span>
                  </>
                ) : (
                  <span>R$ 0,00 (0,00%)</span>
                )}
              </span>
            </div>

            {/* Linha 3: Detalhes de Preço Médio e Tick Atual (visível quando há posição aberta) */}
            {unrealizedPnlData.hasPosition && (
              <div className="flex items-center gap-2 text-[9px] text-slate-300/80 pt-1 mt-1 border-t border-white/10">
                <span>
                  PM: <strong className="text-indigo-300">R$ {currentAverageEntryPrice.toFixed(2)}</strong>
                </span>
                <span className="text-slate-500">•</span>
                <span>
                  Tick: <strong className="text-cyan-300">R$ {marketState.currentPriceBrl.toFixed(2)}</strong>
                </span>
                <span className="text-slate-500 hidden sm:inline">•</span>
                <span className="hidden sm:inline">
                  Posição: <strong className="text-white">R$ {unrealizedPnlData.positionValueBrl.toFixed(2)}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full cursor-crosshair overflow-visible"
          preserveAspectRatio="none"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#182030" strokeWidth="0.75" />
            </pattern>
          </defs>

          {/* Fundo com Grid */}
          <rect width={availableWidth} height={chartHeight} fill="url(#grid)" />

          {/* Linhas de Preço Grid Horizontal */}
          {gridPrices.map((price, i) => {
            const y = getY(price);
            return (
              <g key={`grid-h-${i}`}>
                <line
                  x1={0}
                  y1={y}
                  x2={availableWidth}
                  y2={y}
                  stroke="#1c2538"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                {/* Rótulo de preço à direita */}
                <text
                  x={availableWidth + 6}
                  y={y + 3}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  R$ {price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Gráfico de Linha + Área */}
          {chartType === 'line' && (
            <>
              <polygon points={areaPoints} fill="url(#areaGradient)" />
              <polyline
                points={linePoints}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Médias Móveis EMA 9 e EMA 21 */}
          {showIndicators && (
            <>
              <path
                d={ema9Path}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.5"
                strokeOpacity="0.85"
              />
              <path
                d={ema21Path}
                fill="none"
                stroke="#818cf8"
                strokeWidth="1.5"
                strokeOpacity="0.85"
              />
            </>
          )}

          {/* Candlesticks */}
          {chartType === 'candles' &&
            candles.map((candle, idx) => {
              const x = getX(idx);
              const isBullish = candle.close >= candle.open;
              const color = isBullish ? '#10b981' : '#f43f5e';

              const highY = getY(candle.high);
              const lowY = getY(candle.low);
              const openY = getY(candle.open);
              const closeY = getY(candle.close);

              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(2, Math.abs(closeY - openY));

              return (
                <g key={`candle-${idx}`} className="transition-opacity hover:opacity-80">
                  {/* Pavio (Wick) */}
                  <line
                    x1={x}
                    y1={highY}
                    x2={x}
                    y2={lowY}
                    stroke={color}
                    strokeWidth="1.2"
                  />
                  {/* Corpo do Candle */}
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyTop}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={color}
                    rx="1"
                  />
                </g>
              );
            })}

          {/* Linha do Preço Atual Fictício Pontilhada */}
          <line
            x1={0}
            y1={getY(marketState.currentPriceBrl)}
            x2={availableWidth}
            y2={getY(marketState.currentPriceBrl)}
            stroke="#06b6d4"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          {/* Tag do preço atual no eixo direito */}
          <g transform={`translate(${availableWidth + 2}, ${getY(marketState.currentPriceBrl) - 9})`}>
            <rect width="60" height="18" fill="#0891b2" rx="3" />
            <text x="4" y="13" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="monospace">
              R$ {marketState.currentPriceBrl.toFixed(2)}
            </text>
          </g>

          {/* Linha de Preço Médio (Break-Even) da Posição Aberta */}
          {hasOpenPosition && currentAverageEntryPrice > 0 && (
            <g key="avg-entry-price-line">
              <line
                x1={0}
                y1={getY(currentAverageEntryPrice)}
                x2={availableWidth}
                y2={getY(currentAverageEntryPrice)}
                stroke="#818cf8"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                strokeOpacity="0.85"
              />
              <g transform={`translate(${availableWidth + 2}, ${getY(currentAverageEntryPrice) - 9})`}>
                <rect width="60" height="18" fill="#312e81" stroke="#6366f1" strokeWidth="0.8" rx="3" />
                <text x="3" y="13" fill="#e0e7ff" fontSize="9" fontWeight="bold" fontFamily="monospace">
                  PM R${currentAverageEntryPrice.toFixed(2)}
                </text>
              </g>
            </g>
          )}

          {/* LINHAS DE ALERTAS DE PREÇO CUSTOMIZADOS NO GRÁFICO */}
          {showAlertLines &&
            alerts.map((alert) => {
              if (!alert.isActive && !alert.isTriggered) return null;
              const y = getY(alert.targetPriceBrl);
              // Se estiver fora do range visível, não renderiza
              if (y < 0 || y > chartHeight) return null;

              const isAbove = alert.condition === 'ABOVE_OR_EQUAL';
              const strokeColor = alert.isTriggered ? '#f59e0b' : isAbove ? '#10b981' : '#f43f5e';

              return (
                <g
                  key={`alert-line-${alert.id}`}
                  className="cursor-pointer group"
                  onClick={() => onOpenAlertsModal && onOpenAlertsModal()}
                >
                  <line
                    x1={0}
                    y1={y}
                    x2={availableWidth}
                    y2={y}
                    stroke={strokeColor}
                    strokeDasharray="5 3"
                    strokeWidth="1.2"
                    strokeOpacity={alert.isTriggered ? '0.9' : '0.75'}
                  />
                  <g transform={`translate(${availableWidth + 2}, ${y - 8})`}>
                    <rect
                      width="60"
                      height="16"
                      fill={alert.isTriggered ? '#78350f' : '#1e293b'}
                      stroke={strokeColor}
                      strokeWidth="1"
                      rx="3"
                    />
                    <text
                      x="3"
                      y="11"
                      fill={strokeColor}
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      🔔 {alert.targetPriceBrl.toFixed(2)}
                    </text>
                  </g>
                </g>
              );
            })}

          {/* SOBREPOSIÇÃO DOS TRADES DO USUÁRIO (Compras e Vendas) */}
          {showTrades &&
            mappedTrades.map(({ trade, x, y }) => {
              const isBuy = trade.type === 'BUY';
              const markerBg = isBuy ? '#059669' : '#e11d48';
              const isHovered = hoveredTrade?.id === trade.id;

              return (
                <g
                  key={trade.id}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer"
                  onPointerEnter={() => setHoveredTrade(trade)}
                  onPointerLeave={() => setHoveredTrade(null)}
                  onClick={() => onPriceSelect && onPriceSelect(trade.priceBrl)}
                >
                  {/* Halo pulsante */}
                  <circle
                    r={isHovered ? 11 : 7}
                    fill={markerBg}
                    fillOpacity={isHovered ? 0.4 : 0.25}
                    stroke={isBuy ? '#34d399' : '#fb7185'}
                    strokeWidth="1"
                  />

                  {/* Símbolo do trade (Seta cima para compra, baixo para venda) */}
                  <circle r="4.5" fill={isBuy ? '#10b981' : '#f43f5e'} />
                  <path
                    d={isBuy ? 'M -2 1 L 0 -2 L 2 1' : 'M -2 -1 L 0 2 L 2 -1'}
                    stroke="#ffffff"
                    strokeWidth="1.2"
                    fill="none"
                    strokeLinecap="round"
                  />

                  {/* Rótulo rápido acima do marker */}
                  <text
                    x="0"
                    y={isBuy ? -10 : 16}
                    textAnchor="middle"
                    fill={isBuy ? '#34d399' : '#fb7185'}
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {isBuy ? '▲ C' : '▼ V'}
                  </text>
                </g>
              );
            })}

          {/* Cursor / Crosshair ao mover o ponteiro */}
          {hoverX !== null && hoverX <= availableWidth && (
            <>
              <line
                x1={hoverX}
                y1={0}
                x2={hoverX}
                y2={chartHeight}
                stroke="#64748b"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
            </>
          )}

          {/* MINI PAINEL DO INDICADOR RSI (se ativado) */}
          {showRsi && (
            <g transform={`translate(0, ${rsiTop})`}>
              {/* Linha separadora */}
              <line x1={0} y1={-5} x2={availableWidth} y2={-5} stroke="#1f293d" strokeWidth="1" />
              
              {/* Faixa neutra 30-70 */}
              <rect
                x={0}
                y={rsiHeight * 0.3}
                width={availableWidth}
                height={rsiHeight * 0.4}
                fill="#131b2c"
                fillOpacity="0.5"
              />
              <line x1={0} y1={rsiHeight * 0.3} x2={availableWidth} y2={rsiHeight * 0.3} stroke="#ef4444" strokeDasharray="2 2" strokeWidth="0.8" opacity="0.6" />
              <line x1={0} y1={rsiHeight * 0.7} x2={availableWidth} y2={rsiHeight * 0.7} stroke="#10b981" strokeDasharray="2 2" strokeWidth="0.8" opacity="0.6" />

              {/* Rótulos de sobrecompra / sobrevenda */}
              <text x={availableWidth + 6} y={rsiHeight * 0.3 + 3} fill="#ef4444" fontSize="9" fontFamily="monospace">70</text>
              <text x={availableWidth + 6} y={rsiHeight * 0.7 + 3} fill="#10b981" fontSize="9" fontFamily="monospace">30</text>
              <text x={4} y={12} fill="#94a3b8" fontSize="9" fontFamily="monospace" fontWeight="bold">RSI(14) SIMULADO</text>

              {/* Linha dinâmica fictícia do RSI */}
              <polyline
                points={candles.map((_, i) => {
                  const x = getX(i);
                  // Simula valor harmônico de RSI variando entre 20 e 80
                  const candlePrice = candles[i].close;
                  const normalized = Math.max(0.15, Math.min(0.85, (candlePrice - minPrice) / (priceRange || 1)));
                  const y = rsiHeight - normalized * rsiHeight;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke="#c084fc"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* TOOLTIP FLUTUANTE DE TRADE SOBREPOSTO */}
        {hoveredTrade && (
          <div
            className="absolute z-20 pointer-events-none bg-[#131b2e] border border-cyan-500/40 rounded-lg p-2.5 shadow-2xl text-[11px] font-mono text-slate-200 max-w-xs animate-in fade-in"
            style={{
              top: unrealizedPnlData.hasPosition ? '96px' : '72px',
              left: '12px',
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#232f48] pb-1.5 mb-1.5">
              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                hoveredTrade.type === 'BUY'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/50'
                  : 'bg-rose-950 text-rose-400 border border-rose-500/50'
              }`}>
                {hoveredTrade.type === 'BUY' ? 'COMPRA SIMULADA' : 'VENDA SIMULADA'}
              </span>
              <span className="text-slate-400 text-[10px]">{hoveredTrade.formattedTime}</span>
            </div>
            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Preço Executado:</span>
                <span className="text-white font-bold">R$ {hoveredTrade.priceBrl.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Quantidade:</span>
                <span className="text-cyan-300 font-bold">{hoveredTrade.amount.toFixed(4)} PENDLE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Bruto:</span>
                <span className="text-slate-200">R$ {hoveredTrade.grossTotalBrl.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Taxa Simulada:</span>
                <span className="text-amber-400 font-medium">R$ {hoveredTrade.feeBrl.toFixed(4)}</span>
              </div>
              {hoveredTrade.realizedPnlBrl !== undefined && (
                <div className="flex justify-between pt-1 border-t border-[#232f48] mt-1">
                  <span className="text-slate-400">P&L Realizado:</span>
                  <span className={`font-bold ${hoveredTrade.realizedPnlBrl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {hoveredTrade.realizedPnlBrl >= 0 ? '+' : ''}R$ {hoveredTrade.realizedPnlBrl.toFixed(4)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legenda Inferior do Gráfico */}
      <div className="bg-[#101520] border-t border-[#1b2336] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>▲ Compra executada</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>▼ Venda executada</span>
          </div>
          {showIndicators && (
            <>
              <div className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-amber-400"></span>
                <span>EMA 9</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-indigo-400"></span>
                <span>EMA 21</span>
              </div>
            </>
          )}
        </div>
        <div className="text-slate-500 italic">
          Dica: Clique sobre o gráfico ou arraste para inspecionar pontos históricos
        </div>
      </div>
    </div>
  );
};
