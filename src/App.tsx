/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ATLASΩ Trader Intelligence
 * Terminal Profissional Simulado para PENDLE/USDT
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  WalletState,
  MarketState,
  Candle,
  RiskSettings,
  PriceAlert,
} from './types/trading';
import {
  LOCAL_STORAGE_KEY,
  getDefaultWalletState,
  calculateSimulationSummary,
  executeBuy,
  executeSell,
  DEFAULT_PENDLE_PRICE_BRL,
  DEFAULT_USDT_BRL_RATE,
  calculateEMA,
  calculateRSI,
  checkPriceAlerts,
  DEFAULT_RISK_SETTINGS,
  sanitizeAndValidateWalletState,
} from './core/tradingEngine';
import { transactionManager } from './core/transactionManager';
import { soundEffects } from './services/soundEffects';
import { notificationService } from './services/notificationService';

import { RegulatoryBanner } from './components/RegulatoryBanner';
import { TerminalHeader } from './components/TerminalHeader';
import { TickerBar } from './components/TickerBar';
import { WalletSummaryCards } from './components/WalletSummaryCards';
import { MarketChart } from './components/MarketChart';
import { OrderBook } from './components/OrderBook';
import { TradingPanel } from './components/TradingPanel';
import { TradeHistoryTable } from './components/TradeHistoryTable';
import { RiskSettingsModal } from './components/RiskSettingsModal';
import { TestAuditModal } from './components/TestAuditModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { PriceAlertsModal } from './components/PriceAlertsModal';
import { ActiveAlertToast } from './components/ActiveAlertToast';
import { BinanceTestnetModal } from './components/BinanceTestnetModal';
import {
  binanceTestnetService,
  TestnetDiagnostics,
} from './services/binanceTestnet';

import {
  BarChart2,
  Wallet,
  ArrowLeftRight,
  History,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Layers,
  Smartphone,
  Bell
} from 'lucide-react';

const LOCAL_STORAGE_ALERTS_KEY = 'atlas_omega_alerts_v1';

// Gerar candles históricos iniciais realistas para o par PENDLE/USDT
function generateInitialCandles(basePrice: number = DEFAULT_PENDLE_PRICE_BRL, count: number = 30): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const intervalMs = 60 * 1000; // 1 minuto por candle

  let price = basePrice * 0.92; // Começa um pouco abaixo para criar histórico

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i * intervalMs;
    const delta = (Math.random() - 0.48) * (price * 0.02);
    const open = price;
    const close = Math.max(1.0, open + delta);
    const high = Math.max(open, close) + Math.random() * (price * 0.012);
    const low = Math.max(0.5, Math.min(open, close) - Math.random() * (price * 0.012));
    const volume = Math.round((Math.random() * 40 + 15) * 10) / 10;

    candles.push({ timestamp, open, high, low, close, volume });
    price = close;
  }

  return candles;
}

export default function App() {
  // 1. Estado da Carteira e Persistência Local com Sanitização Defensiva
  const [wallet, setWallet] = useState<WalletState>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return sanitizeAndValidateWalletState(parsed);
      }
    } catch (e) {
      console.warn('Erro ao carregar carteira do localStorage', e);
    }
    return getDefaultWalletState();
  });

  // A persistência da carteira agora ocorre de forma transacional e atômica diretamente no transactionManager,
  // eliminando condições de corrida causadas por efeitos assíncronos desordenados.

  // Sincronização em tempo real entre múltiplas abas / processos do navegador
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const sanitized = sanitizeAndValidateWalletState(parsed);
          setWallet(sanitized);
        } catch (err) {
          console.warn('Erro ao sincronizar carteira de outra aba:', err);
        }
      } else if (e.key === LOCAL_STORAGE_ALERTS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setAlerts(parsed);
        } catch (err) {
          console.warn('Erro ao sincronizar alertas de outra aba:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 2. Sistema de Alertas Sonoros e Visuais Customizáveis
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_ALERTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar alertas do localStorage', e);
    }
    // Alertas de exemplo pré-configurados
    return [
      {
        id: 'alt-default-1',
        targetPriceBrl: 27.50,
        condition: 'ABOVE_OR_EQUAL',
        soundType: 'CHIME',
        note: 'Resistência / Alvo de Realização (+10%)',
        isActive: true,
        isTriggered: false,
      },
      {
        id: 'alt-default-2',
        targetPriceBrl: 23.50,
        condition: 'BELOW_OR_EQUAL',
        soundType: 'RADAR',
        note: 'Suporte Técnico / Ponto de Atenção (-6%)',
        isActive: true,
        isTriggered: false,
      },
    ];
  });

  // Salva alertas no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_ALERTS_KEY, JSON.stringify(alerts));
    } catch (e) {
      console.warn('Erro ao salvar alertas no localStorage', e);
    }
  }, [alerts]);

  const [activeAlertToast, setActiveAlertToast] = useState<PriceAlert | null>(null);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState<boolean>(false);

  // 3. Estado de Mercado e Velas (Candles)
  const [candles, setCandles] = useState<Candle[]>(() => generateInitialCandles(DEFAULT_PENDLE_PRICE_BRL, 32));
  
  const [marketState, setMarketState] = useState<MarketState>(() => {
    const lastPrice = DEFAULT_PENDLE_PRICE_BRL;
    return {
      currentPriceBrl: lastPrice,
      currentPriceUsdt: lastPrice / DEFAULT_USDT_BRL_RATE,
      usdtBrlRate: DEFAULT_USDT_BRL_RATE,
      priceChangePercent24h: 3.42,
      high24hBrl: lastPrice * 1.08,
      low24hBrl: lastPrice * 0.94,
      volume24hPendle: 18450,
      trend: 'ALTA',
      trendStrength: 72,
      volatilityMode: 'MEDIA',
      rsi14: 58.4,
      ema9: lastPrice * 0.99,
      ema21: lastPrice * 0.97,
    };
  });

  const previousPriceRef = useRef<number>(marketState.currentPriceBrl);

  // 4. Modais e Navegação
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState<boolean>(false);
  const [isTestAuditModalOpen, setIsTestAuditModalOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isTestnetModalOpen, setIsTestnetModalOpen] = useState<boolean>(false);
  const [testnetDiagnostics, setTestnetDiagnostics] = useState<TestnetDiagnostics>(() =>
    binanceTestnetService.getDiagnostics()
  );
  const [isCheckingTestnet, setIsCheckingTestnet] = useState<boolean>(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'terminal' | 'chart' | 'wallet' | 'history'>('terminal');

  // Assinatura e inicialização da Binance Spot Testnet (Ambiente de Teste)
  useEffect(() => {
    const unsubscribe = binanceTestnetService.subscribe((diag) => {
      setTestnetDiagnostics(diag);
    });

    // Executa verificação inicial de conectividade e par
    binanceTestnetService.runFullDiagnostics().catch((err) => {
      console.warn('Diagnóstico inicial Binance Testnet:', err);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRunTestnetDiagnostics = useCallback(async () => {
    setIsCheckingTestnet(true);
    try {
      await binanceTestnetService.runFullDiagnostics(fetch, true);
    } finally {
      setIsCheckingTestnet(false);
    }
  }, []);

  // 5. Resumo da Simulação Consolidado
  const summary = useMemo(() => {
    return calculateSimulationSummary(wallet, marketState.currentPriceBrl);
  }, [wallet, marketState.currentPriceBrl]);

  // Função centralizada para processar alertas quando o preço muda
  const processAlertsForPrice = useCallback((newPrice: number) => {
    const prevPrice = previousPriceRef.current;
    previousPriceRef.current = newPrice;

    setAlerts((currentAlerts) => {
      const { updatedAlerts, triggeredAlerts } = checkPriceAlerts(
        currentAlerts,
        prevPrice,
        newPrice
      );

      if (triggeredAlerts.length > 0) {
        // Disparar efeito sonoro do primeiro alerta ativado
        const primary = triggeredAlerts[0];
        soundEffects.play(primary.soundType);
        // Exibir toast visual no topo
        setActiveAlertToast(primary);

        // Disparar notificação nativa do navegador (Notification API) para alertas em segundo plano
        triggeredAlerts.forEach((alert) => {
          notificationService.sendAlertNotification(alert, newPrice);
        });
      }

      return updatedAlerts;
    });
  }, []);

  // 6. Loop do Gerador de Ticks Fictícios em Tempo Real
  useEffect(() => {
    if (!isSimulating || marketState.volatilityMode === 'PAUSADO') return;

    const volatilityMultiplier =
      marketState.volatilityMode === 'BAIXA' ? 0.003 :
      marketState.volatilityMode === 'ALTA' ? 0.015 : 0.007;

    const interval = setInterval(() => {
      setMarketState((prev) => {
        const shock = (Math.random() - 0.495) * (prev.currentPriceBrl * volatilityMultiplier);
        const newPriceBrl = Math.max(1.0, prev.currentPriceBrl + shock);
        const newPriceUsdt = newPriceBrl / prev.usdtBrlRate;

        // Processar alertas sonoros/visuais para a nova cotação
        processAlertsForPrice(newPriceBrl);

        const high24h = Math.max(prev.high24hBrl, newPriceBrl);
        const low24h = Math.min(prev.low24hBrl, newPriceBrl);
        const initialCandle = candles[0]?.open || DEFAULT_PENDLE_PRICE_BRL;
        const changePct = ((newPriceBrl - initialCandle) / initialCandle) * 100;

        return {
          ...prev,
          currentPriceBrl: newPriceBrl,
          currentPriceUsdt: newPriceUsdt,
          high24hBrl: high24h,
          low24hBrl: low24h,
          priceChangePercent24h: changePct,
          volume24hPendle: prev.volume24hPendle + Math.round(Math.random() * 5),
        };
      });

      // Atualizar candles
      setCandles((prevCandles) => {
        if (prevCandles.length === 0) return prevCandles;
        const last = prevCandles[prevCandles.length - 1];
        const now = Date.now();

        if (now - last.timestamp > 30000) {
          const newCandle: Candle = {
            timestamp: now,
            open: last.close,
            high: Math.max(last.close, marketState.currentPriceBrl),
            low: Math.min(last.close, marketState.currentPriceBrl),
            close: marketState.currentPriceBrl,
            volume: Math.round((Math.random() * 20 + 5) * 10) / 10,
          };
          const updated = [...prevCandles.slice(1), newCandle];

          const closes = updated.map((c) => c.close);
          const ema9 = calculateEMA(closes, 9);
          const ema21 = calculateEMA(closes, 21);
          const rsi14 = calculateRSI(closes, 14);

          const trend = ema9 > ema21 ? 'ALTA' : ema9 < ema21 ? 'BAIXA' : 'LATERAL';
          const trendDiff = Math.abs(ema9 - ema21) / (ema21 || 1);
          const trendStrength = Math.min(99, Math.round(trendDiff * 1000 + 40));

          setMarketState((s) => ({
            ...s,
            ema9,
            ema21,
            rsi14,
            trend,
            trendStrength,
          }));

          return updated;
        } else {
          const updatedLast: Candle = {
            ...last,
            high: Math.max(last.high, marketState.currentPriceBrl),
            low: Math.min(last.low, marketState.currentPriceBrl),
            close: marketState.currentPriceBrl,
            volume: last.volume + 0.1,
          };
          return [...prevCandles.slice(0, -1), updatedLast];
        }
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [isSimulating, marketState.volatilityMode, marketState.currentPriceBrl, candles, processAlertsForPrice]);

  // Ações de Negociação com Gerenciador Atômico de Transações e Mutual Exclusion Cross-Tab
  const handleExecuteBuy = useCallback(async (amount: number, priceBrl: number) => {
    const { updatedWallet } = await transactionManager.executeAtomicTransaction((currentWallet) => {
      return executeBuy(
        currentWallet,
        amount,
        priceBrl,
        marketState.usdtBrlRate
      );
    });
    setWallet(updatedWallet);
  }, [marketState.usdtBrlRate]);

  const handleExecuteSell = useCallback(async (amount: number, priceBrl: number) => {
    const { updatedWallet } = await transactionManager.executeAtomicTransaction((currentWallet) => {
      return executeSell(
        currentWallet,
        amount,
        priceBrl,
        marketState.usdtBrlRate
      );
    });
    setWallet(updatedWallet);
  }, [marketState.usdtBrlRate]);

  const handleToggleKillSwitch = useCallback(async () => {
    try {
      const { updatedWallet } = await transactionManager.executeAtomicTransaction((current) => {
        const updated: WalletState = {
          ...current,
          riskSettings: {
            ...current.riskSettings,
            killSwitchActive: !current.riskSettings.killSwitchActive,
          },
        };
        return { updatedWallet: updated, result: updated };
      });
      setWallet(updatedWallet);
    } catch (err) {
      console.warn('Falha ao alternar kill switch:', err);
    }
  }, []);

  const handleSaveRiskSettings = useCallback(async (updated: RiskSettings) => {
    try {
      const { updatedWallet } = await transactionManager.executeAtomicTransaction((current) => {
        const updatedWallet: WalletState = {
          ...current,
          riskSettings: updated,
        };
        return { updatedWallet, result: updatedWallet };
      });
      setWallet(updatedWallet);
    } catch (err) {
      console.warn('Falha ao salvar configurações de risco:', err);
    }
  }, []);

  const handleResetSimulation = useCallback(async () => {
    try {
      const freshWallet = getDefaultWalletState();
      await transactionManager.executeAtomicTransaction(() => ({
        updatedWallet: freshWallet,
        result: freshWallet,
      }));
      setWallet(freshWallet);
    } catch (e) {
      console.warn('Erro ao resetar localStorage', e);
    }
  }, []);

  const handleSetPrice = useCallback((newPrice: number) => {
    processAlertsForPrice(newPrice);
    setMarketState((prev) => ({
      ...prev,
      currentPriceBrl: newPrice,
      currentPriceUsdt: newPrice / prev.usdtBrlRate,
    }));
  }, [processAlertsForPrice]);

  const handleChangeVolatility = useCallback((mode: MarketState['volatilityMode']) => {
    setMarketState((prev) => ({
      ...prev,
      volatilityMode: mode,
    }));
  }, []);

  // Handlers para Alertas
  const handleAddAlert = useCallback((newAlertData: Omit<PriceAlert, 'id' | 'isTriggered'>) => {
    const newAlert: PriceAlert = {
      ...newAlertData,
      id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      isTriggered: false,
    };
    setAlerts((prev) => [newAlert, ...prev]);
  }, []);

  const handleToggleAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a))
    );
  }, []);

  const handleDeleteAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleResetTriggeredAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, isTriggered: false, isActive: true, triggeredAt: undefined, triggeredPrice: undefined }
          : a
      )
    );
  }, []);

  const activeAlertCount = alerts.filter((a) => a.isActive && !a.isTriggered).length;

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#e2e8f0] flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-300">
      {/* Toast Flutuante de Alerta Disparado */}
      <ActiveAlertToast
        alert={activeAlertToast}
        onDismiss={() => setActiveAlertToast(null)}
        onOpenTradePanel={() => setMobileActiveTab('terminal')}
      />

      {/* 1. Tarja Regulatória Obrigatória de Simulação */}
      <RegulatoryBanner
        onOpenTestnetModal={() => setIsTestnetModalOpen(true)}
        testnetState={testnetDiagnostics.state}
        testnetErrorCode={testnetDiagnostics.errorCode}
        testnetErrorMessage={testnetDiagnostics.errorMessage}
      />

      {/* 2. Top Bar do Terminal (Header) */}
      <TerminalHeader
        riskSettings={wallet.riskSettings}
        onToggleKillSwitch={handleToggleKillSwitch}
        onOpenRiskSettings={() => setIsRiskModalOpen(true)}
        onOpenTestAudit={() => setIsTestAuditModalOpen(true)}
        onOpenReset={() => setIsResetModalOpen(true)}
        onOpenAlerts={() => setIsAlertsModalOpen(true)}
        activeAlertCount={activeAlertCount}
        isSimulating={isSimulating}
        onToggleSimulation={() => setIsSimulating(!isSimulating)}
        onOpenTestnetModal={() => setIsTestnetModalOpen(true)}
        testnetState={testnetDiagnostics.state}
      />

      {/* 3. Ticker Bar com Preço Fictício e Controles Rápidos */}
      <TickerBar
        marketState={marketState}
        onSetPrice={handleSetPrice}
        onChangeVolatility={handleChangeVolatility}
      />

      {/* 4. Navegação por Abas Otimizada para Celular Android */}
      <div className="lg:hidden bg-[#0d121c] border-b border-[#1b2336] sticky top-[48px] z-20 px-2 py-1 flex items-center justify-around font-mono text-[11px]">
        <button
          onClick={() => setMobileActiveTab('terminal')}
          className={`py-1.5 px-2.5 rounded-lg flex items-center gap-1.5 transition-all ${
            mobileActiveTab === 'terminal'
              ? 'bg-cyan-600 text-white font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Boleta / Negociar</span>
        </button>

        <button
          onClick={() => setMobileActiveTab('chart')}
          className={`py-1.5 px-2.5 rounded-lg flex items-center gap-1.5 transition-all ${
            mobileActiveTab === 'chart'
              ? 'bg-cyan-600 text-white font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Gráfico & Book</span>
        </button>

        <button
          onClick={() => setMobileActiveTab('wallet')}
          className={`py-1.5 px-2.5 rounded-lg flex items-center gap-1.5 transition-all ${
            mobileActiveTab === 'wallet'
              ? 'bg-cyan-600 text-white font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Carteira</span>
        </button>

        <button
          onClick={() => setMobileActiveTab('history')}
          className={`py-1.5 px-2.5 rounded-lg flex items-center gap-1.5 transition-all ${
            mobileActiveTab === 'history'
              ? 'bg-cyan-600 text-white font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Trades ({wallet.trades.length})</span>
        </button>
      </div>

      {/* 5. Área de Conteúdo Principal */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-2.5 sm:p-4 space-y-3.5">
        
        {/* Sumário Patrimonial da Carteira */}
        <div className={`transition-all ${mobileActiveTab === 'wallet' ? 'block' : 'hidden lg:block'}`}>
          <WalletSummaryCards
            summary={summary}
            riskSettings={wallet.riskSettings}
          />
        </div>

        {/* Layout em Grid Profissional de Terminal para Desktop / Tablet */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          
          {/* Coluna Esquerda/Centro: Gráfico Interativo com Trades, Alertas e Book L2 */}
          <div className={`lg:col-span-8 space-y-3.5 ${
            mobileActiveTab === 'chart' ? 'block' : 'hidden lg:block'
          }`}>
            <MarketChart
              candles={candles}
              trades={wallet.trades}
              marketState={marketState}
              wallet={wallet}
              averageEntryPriceBrl={wallet.averageEntryPriceBrl}
              pendleAmount={wallet.pendleAmount}
              alerts={alerts}
              onPriceSelect={handleSetPrice}
              onOpenAlertsModal={() => setIsAlertsModalOpen(true)}
            />

            {/* Book de Ofertas e Histórico */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="md:col-span-5">
                <OrderBook
                  currentPrice={marketState.currentPriceBrl}
                  onSelectPrice={handleSetPrice}
                />
              </div>
              <div className="md:col-span-7">
                <TradeHistoryTable trades={wallet.trades} />
              </div>
            </div>
          </div>

          {/* Coluna Direita: Boleta de Negociação (Trading Panel) */}
          <div className={`lg:col-span-4 space-y-3.5 ${
            mobileActiveTab === 'terminal' ? 'block' : 'hidden lg:block'
          }`}>
            <TradingPanel
              wallet={wallet}
              summary={summary}
              currentPriceBrl={marketState.currentPriceBrl}
              onExecuteBuy={handleExecuteBuy}
              onExecuteSell={handleExecuteSell}
            />

            {/* Card Rápido de Gestão de Risco & Alertas Ativos */}
            <div className="bg-[#101520] border border-[#222c42] rounded-xl p-3.5 font-mono text-xs space-y-2.5">
              <div className="flex items-center justify-between text-slate-300 font-bold border-b border-[#1f293d] pb-2">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <ShieldAlert className="w-4 h-4" />
                  Monitor de Risco & Alertas
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAlertsModalOpen(true)}
                    className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <Bell className="w-3 h-3" />
                    Alertas ({activeAlertCount})
                  </button>
                  <button
                    onClick={() => setIsRiskModalOpen(true)}
                    className="text-[10px] text-cyan-400 hover:underline"
                  >
                    Limites
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Limite Perda Máxima:</span>
                  <span className="text-white font-semibold">R$ {wallet.riskSettings.maxLossLimitBrl.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Limite de Exposição:</span>
                  <span className="text-white font-semibold">{wallet.riskSettings.maxExposurePercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Taxa por Trade:</span>
                  <span className="text-white font-semibold">{wallet.riskSettings.feeRatePercent}%</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-[#1a2336]">
                  <span className="text-slate-400">Kill Switch:</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    wallet.riskSettings.killSwitchActive
                      ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                  }`}>
                    {wallet.riskSettings.killSwitchActive ? 'LIGADO (COMPRAS BLOQUEADAS)' : 'DESLIGADO'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seção de Histórico expandida para visualização em aba Mobile se selecionada */}
        {mobileActiveTab === 'history' && (
          <div className="lg:hidden">
            <TradeHistoryTable trades={wallet.trades} />
          </div>
        )}

        {/* Visão Complementar de Gestão de Risco na Aba Carteira Mobile */}
        {mobileActiveTab === 'wallet' && (
          <div className="lg:hidden space-y-2">
            <div className="bg-[#101520] border border-[#222c42] rounded-xl p-2.5 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300 font-bold border-b border-[#1f293d] pb-1.5">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Monitor de Risco da Carteira
                </span>
                <button
                  onClick={() => setIsRiskModalOpen(true)}
                  className="text-[10px] text-cyan-400 hover:underline bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40"
                >
                  Configurar
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="bg-[#0c1018] p-2 rounded-lg border border-[#1a2336]">
                  <span className="text-slate-400 block text-[9px] uppercase">Perda Máxima</span>
                  <span className="text-white font-bold">R$ {wallet.riskSettings.maxLossLimitBrl.toFixed(2)}</span>
                </div>
                <div className="bg-[#0c1018] p-2 rounded-lg border border-[#1a2336]">
                  <span className="text-slate-400 block text-[9px] uppercase">Teto Exposição</span>
                  <span className="text-white font-bold">{wallet.riskSettings.maxExposurePercent}%</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-[#1a2336] text-[11px]">
                <span className="text-slate-400">Kill Switch:</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  wallet.riskSettings.killSwitchActive
                    ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                }`}>
                  {wallet.riskSettings.killSwitchActive ? 'ATIVO (BLOQUEADO)' : 'DESATIVADO'}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 6. Modais do Sistema */}
      <PriceAlertsModal
        isOpen={isAlertsModalOpen}
        onClose={() => setIsAlertsModalOpen(false)}
        alerts={alerts}
        currentPriceBrl={marketState.currentPriceBrl}
        onAddAlert={handleAddAlert}
        onToggleAlert={handleToggleAlert}
        onDeleteAlert={handleDeleteAlert}
        onResetTriggered={handleResetTriggeredAlert}
      />

      <RiskSettingsModal
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
        settings={wallet.riskSettings}
        onSave={handleSaveRiskSettings}
      />

      <TestAuditModal
        isOpen={isTestAuditModalOpen}
        onClose={() => setIsTestAuditModalOpen(false)}
      />

      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleResetSimulation}
      />

      <BinanceTestnetModal
        isOpen={isTestnetModalOpen}
        onClose={() => setIsTestnetModalOpen(false)}
        diagnostics={testnetDiagnostics}
        onRunDiagnostics={handleRunTestnetDiagnostics}
        isChecking={isCheckingTestnet}
      />
    </div>
  );
}
