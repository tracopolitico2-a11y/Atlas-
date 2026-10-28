/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ATLASΩ Trader Intelligence - Core Simulation Engine
 * 100% Simulado - Sem ordens reais - Sem conexão Binance
 */

import {
  WalletState,
  RiskSettings,
  SimulationSummary,
  ValidationResult,
  Trade,
  OrderType,
  Candle,
  PriceAlert,
} from '../types/trading';

export const LOCAL_STORAGE_KEY = 'atlas_omega_state_v1';
export const INITIAL_BALANCE_BRL = 10.0;
export const DEFAULT_PENDLE_PRICE_BRL = 25.0; // ~4.46 USDT com USD/BRL a 5.60
export const DEFAULT_USDT_BRL_RATE = 5.60;

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  maxExposurePercent: 80.0, // Máximo 80% do patrimônio em PENDLE
  maxLossLimitBrl: 3.0, // Limite de perda máxima de R$ 3,00 (30% do capital inicial)
  feeRatePercent: 0.10, // Taxa padrão de 0.10% (estilo Binance spot maker/taker)
  killSwitchActive: false, // Disjuntor desligado por padrão
};

export function getDefaultWalletState(): WalletState {
  return {
    balanceBrl: INITIAL_BALANCE_BRL,
    pendleAmount: 0,
    averageEntryPriceBrl: 0,
    totalFeesPaidBrl: 0,
    realizedPnlBrl: 0,
    trades: [],
    riskSettings: { ...DEFAULT_RISK_SETTINGS },
  };
}

/**
 * Sanitiza e recupera com segurança dados da carteira vindos do armazenamento local,
 * prevenindo quebras por schema corrompido, NaN, injeção de valores negativos ou tipos inválidos.
 */
export function sanitizeAndValidateWalletState(raw: any): WalletState {
  const defaults = getDefaultWalletState();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  // Validação estrita do saldo em caixa (deve ser finito e não negativo)
  const balanceBrl =
    typeof raw.balanceBrl === 'number' && isFinite(raw.balanceBrl) && raw.balanceBrl >= 0
      ? roundCurrency(raw.balanceBrl, 4)
      : defaults.balanceBrl;

  // Validação da custódia de PENDLE
  const pendleAmount =
    typeof raw.pendleAmount === 'number' && isFinite(raw.pendleAmount) && raw.pendleAmount >= 0
      ? roundCrypto(raw.pendleAmount, 6)
      : defaults.pendleAmount;

  // Validação do preço médio
  const averageEntryPriceBrl =
    typeof raw.averageEntryPriceBrl === 'number' && isFinite(raw.averageEntryPriceBrl) && raw.averageEntryPriceBrl >= 0
      ? roundCurrency(raw.averageEntryPriceBrl, 4)
      : defaults.averageEntryPriceBrl;

  // Validação das taxas pagas acumuladas
  const totalFeesPaidBrl =
    typeof raw.totalFeesPaidBrl === 'number' && isFinite(raw.totalFeesPaidBrl) && raw.totalFeesPaidBrl >= 0
      ? roundCurrency(raw.totalFeesPaidBrl, 4)
      : defaults.totalFeesPaidBrl;

  // Validação do P&L realizado acumulado
  const realizedPnlBrl =
    typeof raw.realizedPnlBrl === 'number' && isFinite(raw.realizedPnlBrl)
      ? roundCurrency(raw.realizedPnlBrl, 4)
      : defaults.realizedPnlBrl;

  // Validação da lista de trades
  const trades: Trade[] = Array.isArray(raw.trades)
    ? raw.trades.filter(
        (t: any) =>
          t &&
          typeof t.id === 'string' &&
          (t.type === 'BUY' || t.type === 'SELL') &&
          typeof t.priceBrl === 'number' &&
          isFinite(t.priceBrl) &&
          typeof t.amount === 'number' &&
          isFinite(t.amount)
      )
    : [];

  // Validação dos parâmetros de risco
  const rawRisk = raw.riskSettings && typeof raw.riskSettings === 'object' ? raw.riskSettings : {};
  const riskSettings: RiskSettings = {
    maxExposurePercent:
      typeof rawRisk.maxExposurePercent === 'number' && isFinite(rawRisk.maxExposurePercent)
        ? Math.max(10, Math.min(100, rawRisk.maxExposurePercent))
        : DEFAULT_RISK_SETTINGS.maxExposurePercent,
    maxLossLimitBrl:
      typeof rawRisk.maxLossLimitBrl === 'number' && isFinite(rawRisk.maxLossLimitBrl) && rawRisk.maxLossLimitBrl > 0
        ? rawRisk.maxLossLimitBrl
        : DEFAULT_RISK_SETTINGS.maxLossLimitBrl,
    feeRatePercent:
      typeof rawRisk.feeRatePercent === 'number' && isFinite(rawRisk.feeRatePercent) && rawRisk.feeRatePercent >= 0
        ? rawRisk.feeRatePercent
        : DEFAULT_RISK_SETTINGS.feeRatePercent,
    killSwitchActive: typeof rawRisk.killSwitchActive === 'boolean' ? rawRisk.killSwitchActive : false,
  };

  return {
    balanceBrl,
    pendleAmount,
    averageEntryPriceBrl,
    totalFeesPaidBrl,
    realizedPnlBrl,
    trades,
    riskSettings,
  };
}

/**
 * Arredondamento financeiro seguro para evitar anomalias de ponto flutuante
 */
export function roundCurrency(val: number, decimals: number = 2): number {
  return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function roundCrypto(val: number, decimals: number = 6): number {
  return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Calcula o resumo consolidado patrimonial e indicadores em tempo real
 */
export function calculateSimulationSummary(
  wallet: WalletState,
  currentPriceBrl: number
): SimulationSummary {
  const safeCurrentPrice = Math.max(0.01, currentPriceBrl);
  const positionValueBrl = wallet.pendleAmount * safeCurrentPrice;
  const totalEquityBrl = wallet.balanceBrl + positionValueBrl;
  
  const exposurePercent = totalEquityBrl > 0 
    ? (positionValueBrl / totalEquityBrl) * 100 
    : 0;

  // P&L não realizado da posição aberta
  const unrealizedPnlBrl = wallet.pendleAmount > 0
    ? (safeCurrentPrice - wallet.averageEntryPriceBrl) * wallet.pendleAmount
    : 0;

  const costBasis = wallet.pendleAmount * wallet.averageEntryPriceBrl;
  const unrealizedPnlPercent = costBasis > 0
    ? (unrealizedPnlBrl / costBasis) * 100
    : 0;

  const totalPnlBrl = wallet.realizedPnlBrl + unrealizedPnlBrl;

  // Verifica se o limite de perda foi violado (prejuízo acumulado >= limite de perda)
  // Ex: se maxLossLimitBrl for 3.00, prejuízo total <= -3.00 dispara violação
  const isLossLimitBreached = totalPnlBrl <= -wallet.riskSettings.maxLossLimitBrl;

  // Verifica se a exposição atual ultrapassa o limite
  const isMaxExposureBreached = exposurePercent > wallet.riskSettings.maxExposurePercent;

  return {
    balanceBrl: roundCurrency(wallet.balanceBrl, 4),
    pendleAmount: roundCrypto(wallet.pendleAmount, 6),
    positionValueBrl: roundCurrency(positionValueBrl, 4),
    totalEquityBrl: roundCurrency(totalEquityBrl, 4),
    exposurePercent: roundCurrency(exposurePercent, 2),
    averageEntryPriceBrl: roundCurrency(wallet.averageEntryPriceBrl, 4),
    unrealizedPnlBrl: roundCurrency(unrealizedPnlBrl, 4),
    unrealizedPnlPercent: roundCurrency(unrealizedPnlPercent, 2),
    realizedPnlBrl: roundCurrency(wallet.realizedPnlBrl, 4),
    totalPnlBrl: roundCurrency(totalPnlBrl, 4),
    totalFeesPaidBrl: roundCurrency(wallet.totalFeesPaidBrl, 4),
    isLossLimitBreached,
    isMaxExposureBreached,
    killSwitchActive: wallet.riskSettings.killSwitchActive,
  };
}

/**
 * Validação rigorosa de ordens antes da execução
 */
export function validateOrder(
  type: OrderType,
  amount: number,
  priceBrl: number,
  wallet: WalletState,
  usdtBrlRate: number = DEFAULT_USDT_BRL_RATE
): ValidationResult {
  if (amount <= 0 || isNaN(amount) || !isFinite(amount)) {
    return { isValid: false, errorMessage: 'Quantidade deve ser um número finito maior que zero.' };
  }

  if (priceBrl <= 0 || isNaN(priceBrl) || !isFinite(priceBrl)) {
    return { isValid: false, errorMessage: 'Preço unitário simulado inválido.' };
  }

  if (amount < 0.0001) {
    return { isValid: false, errorMessage: 'Quantidade mínima para ordem simulada é de 0.0001 PENDLE.' };
  }

  const grossTotal = amount * priceBrl;
  if (grossTotal < 0.001) {
    return { isValid: false, errorMessage: 'Valor bruto mínimo da ordem simulada é de R$ 0,001.' };
  }

  // Prevenção contra ordens duplicadas acidentais (submissão idêntica em < 1 segundo)
  if (wallet.trades && wallet.trades.length > 0) {
    const lastTrade = wallet.trades[0];
    const isSameType = lastTrade.type === type;
    const isSameAmount = Math.abs(lastTrade.amount - amount) < 0.00001;
    const isSamePrice = Math.abs(lastTrade.priceBrl - priceBrl) < 0.01;
    const timeSinceLastMs = Date.now() - lastTrade.timestamp;

    if (isSameType && isSameAmount && isSamePrice && timeSinceLastMs < 1000) {
      return {
        isValid: false,
        errorMessage: 'Operação duplicada detectada: aguarde 1 segundo antes de repetir a mesma ordem.',
      };
    }
  }

  const feeRate = wallet.riskSettings.feeRatePercent / 100;
  const feeBrl = grossTotal * feeRate;

  if (type === 'BUY') {
    // 1. Kill Switch Check
    if (wallet.riskSettings.killSwitchActive) {
      return {
        isValid: false,
        errorMessage: 'KILL SWITCH ATIVO: Novas compras bloqueadas para preservação de capital. Apenas vendas permitidas.',
      };
    }

    // 2. Limite de Perda Máxima Check
    const summary = calculateSimulationSummary(wallet, priceBrl);
    if (summary.isLossLimitBreached) {
      return {
        isValid: false,
        errorMessage: `LIMITE DE PERDA ATINGIDO: Prejuízo total (R$ ${Math.abs(summary.totalPnlBrl).toFixed(2)}) atingiu ou excedeu a perda máxima tolerada de R$ ${wallet.riskSettings.maxLossLimitBrl.toFixed(2)}.`,
      };
    }

    // 3. Saldo em caixa suficiente
    const requiredTotal = grossTotal + feeBrl;
    if (requiredTotal > wallet.balanceBrl + 0.00001) {
      return {
        isValid: false,
        errorMessage: `Saldo insuficiente em reais. Necessário: R$ ${requiredTotal.toFixed(2)} (incluindo R$ ${feeBrl.toFixed(2)} de taxa). Saldo disponível: R$ ${wallet.balanceBrl.toFixed(2)}.`,
      };
    }

    // 4. Limite de Exposição Pós-Ordem
    const projectedPendleAmount = wallet.pendleAmount + amount;
    const projectedPositionValue = projectedPendleAmount * priceBrl;
    const projectedBalance = wallet.balanceBrl - requiredTotal;
    const projectedEquity = projectedBalance + projectedPositionValue;
    const projectedExposure = projectedEquity > 0
      ? (projectedPositionValue / projectedEquity) * 100
      : 0;

    if (projectedExposure > wallet.riskSettings.maxExposurePercent + 0.01) {
      return {
        isValid: false,
        errorMessage: `Exposição excessiva: Esta compra resultaria em ${projectedExposure.toFixed(1)}% de exposição em PENDLE, ultrapassando o limite de ${wallet.riskSettings.maxExposurePercent.toFixed(1)}%.`,
      };
    }
  } else if (type === 'SELL') {
    // Para venda: verificar se possui quantidade suficiente de PENDLE
    const tolerance = 0.000001;
    if (amount > wallet.pendleAmount + tolerance) {
      return {
        isValid: false,
        errorMessage: `Quantidade de PENDLE insuficiente para venda. Solicitado: ${amount.toFixed(6)}, Em carteira: ${wallet.pendleAmount.toFixed(6)} PENDLE.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Executa uma compra simulada com precisão contábil
 */
export function executeBuy(
  wallet: WalletState,
  amount: number,
  priceBrl: number,
  usdtBrlRate: number = DEFAULT_USDT_BRL_RATE,
  customTimestamp?: number,
  notes?: string
): { updatedWallet: WalletState; trade: Trade } {
  const validation = validateOrder('BUY', amount, priceBrl, wallet, usdtBrlRate);
  if (!validation.isValid) {
    throw new Error(validation.errorMessage || 'Falha na validação da ordem de compra.');
  }

  const grossTotalBrl = amount * priceBrl;
  const feeRate = wallet.riskSettings.feeRatePercent / 100;
  const feeBrl = grossTotalBrl * feeRate;
  const netTotalBrl = grossTotalBrl + feeBrl;

  // Atualização do Preço Médio Ponderado
  const currentTotalCost = wallet.pendleAmount * wallet.averageEntryPriceBrl;
  const newTotalCost = currentTotalCost + grossTotalBrl;
  const newPendleAmount = wallet.pendleAmount + amount;
  const newAverageEntryPriceBrl = newPendleAmount > 0 ? newTotalCost / newPendleAmount : 0;

  const timestamp = customTimestamp || Date.now();
  const trade: Trade = {
    id: `BUY-${timestamp}-${Math.floor(Math.random() * 1000)}`,
    timestamp,
    formattedTime: formatTradeDate(timestamp),
    type: 'BUY',
    priceBrl: roundCurrency(priceBrl, 4),
    priceUsdt: roundCurrency(priceBrl / usdtBrlRate, 4),
    amount: roundCrypto(amount, 6),
    grossTotalBrl: roundCurrency(grossTotalBrl, 4),
    feeBrl: roundCurrency(feeBrl, 4),
    netTotalBrl: roundCurrency(netTotalBrl, 4),
    notes: notes || 'Compra simulada a mercado',
  };

  const updatedWallet: WalletState = {
    ...wallet,
    balanceBrl: roundCurrency(wallet.balanceBrl - netTotalBrl, 4),
    pendleAmount: roundCrypto(newPendleAmount, 6),
    averageEntryPriceBrl: roundCurrency(newAverageEntryPriceBrl, 4),
    totalFeesPaidBrl: roundCurrency(wallet.totalFeesPaidBrl + feeBrl, 4),
    trades: [trade, ...wallet.trades],
  };

  return { updatedWallet, trade };
}

/**
 * Executa uma venda simulada (total ou parcial) calculando o P&L realizado e taxas
 */
export function executeSell(
  wallet: WalletState,
  amount: number,
  priceBrl: number,
  usdtBrlRate: number = DEFAULT_USDT_BRL_RATE,
  customTimestamp?: number,
  notes?: string
): { updatedWallet: WalletState; trade: Trade } {
  // 1. Valida a quantidade solicitada original antes de qualquer recorte
  const validation = validateOrder('SELL', amount, priceBrl, wallet, usdtBrlRate);
  if (!validation.isValid) {
    throw new Error(validation.errorMessage || 'Falha na validação da ordem de venda.');
  }

  // 2. Ajuste fino para evitar erro de float em 100%
  const safeAmount = Math.min(amount, wallet.pendleAmount);

  const grossTotalBrl = safeAmount * priceBrl;
  const feeRate = wallet.riskSettings.feeRatePercent / 100;
  const feeBrl = grossTotalBrl * feeRate;
  const netTotalBrl = grossTotalBrl - feeBrl;

  // Cálculo do P&L Realizado desta venda específica:
  // Custo base da quantidade vendida com base no preço médio de entrada
  const costBasis = safeAmount * wallet.averageEntryPriceBrl;
  const grossTradePnl = grossTotalBrl - costBasis;
  const netTradePnl = grossTradePnl - feeBrl; // Lucro líquido realizado descontando a taxa

  const remainingAmount = roundCrypto(Math.max(0, wallet.pendleAmount - safeAmount), 6);
  // Se zerar a posição, reseta o preço médio para 0. Caso contrário, mantém o mesmo preço médio
  const newAverageEntryPrice = remainingAmount > 0.000001 ? wallet.averageEntryPriceBrl : 0;

  const timestamp = customTimestamp || Date.now();
  const trade: Trade = {
    id: `SELL-${timestamp}-${Math.floor(Math.random() * 1000)}`,
    timestamp,
    formattedTime: formatTradeDate(timestamp),
    type: 'SELL',
    priceBrl: roundCurrency(priceBrl, 4),
    priceUsdt: roundCurrency(priceBrl / usdtBrlRate, 4),
    amount: roundCrypto(safeAmount, 6),
    grossTotalBrl: roundCurrency(grossTotalBrl, 4),
    feeBrl: roundCurrency(feeBrl, 4),
    netTotalBrl: roundCurrency(netTotalBrl, 4),
    realizedPnlBrl: roundCurrency(netTradePnl, 4),
    notes: notes || (safeAmount >= wallet.pendleAmount - 0.00001 ? 'Venda Total (100%)' : 'Venda Parcial'),
  };

  const updatedWallet: WalletState = {
    ...wallet,
    balanceBrl: roundCurrency(wallet.balanceBrl + netTotalBrl, 4),
    pendleAmount: remainingAmount,
    averageEntryPriceBrl: roundCurrency(newAverageEntryPrice, 4),
    totalFeesPaidBrl: roundCurrency(wallet.totalFeesPaidBrl + feeBrl, 4),
    realizedPnlBrl: roundCurrency(wallet.realizedPnlBrl + netTradePnl, 4),
    trades: [trade, ...wallet.trades],
  };

  return { updatedWallet, trade };
}

export function formatTradeDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${day}/${month} ${hours}:${minutes}:${seconds}`;
}

/**
 * Indicador técnico RSI (Relative Strength Index) simplificado para simulação
 */
export function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50.0;

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Math.max(0, Math.min(100, roundCurrency(rsi, 1)));
}

/**
 * Indicador técnico EMA (Exponential Moving Average)
 */
export function calculateEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  if (data.length < period) {
    const sum = data.reduce((a, b) => a + b, 0);
    return roundCurrency(sum / data.length, 2);
  }

  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }

  return roundCurrency(ema, 2);
}

/**
 * Avalia se algum alerta de preço configurado pelo usuário atingiu a condição de disparo
 */
export function checkPriceAlerts(
  alerts: PriceAlert[],
  previousPriceBrl: number,
  currentPriceBrl: number,
  timestamp: number = Date.now()
): { updatedAlerts: PriceAlert[]; triggeredAlerts: PriceAlert[] } {
  const triggeredAlerts: PriceAlert[] = [];
  const updatedAlerts = alerts.map((alert) => {
    if (!alert.isActive || alert.isTriggered) {
      return alert;
    }

    let shouldTrigger = false;

    if (alert.condition === 'ABOVE_OR_EQUAL') {
      if (currentPriceBrl >= alert.targetPriceBrl) {
        shouldTrigger = true;
      }
    } else if (alert.condition === 'BELOW_OR_EQUAL') {
      if (currentPriceBrl <= alert.targetPriceBrl) {
        shouldTrigger = true;
      }
    }

    if (shouldTrigger) {
      const triggered: PriceAlert = {
        ...alert,
        isTriggered: true,
        triggeredAt: timestamp,
        triggeredPrice: currentPriceBrl,
        isActive: alert.autoReset ? true : false,
      };
      triggeredAlerts.push(triggered);
      return triggered;
    }

    return alert;
  });

  return { updatedAlerts, triggeredAlerts };
}

