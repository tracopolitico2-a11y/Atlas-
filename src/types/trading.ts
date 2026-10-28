export type OrderType = 'BUY' | 'SELL';

export interface Trade {
  id: string;
  timestamp: number;
  formattedTime: string;
  type: OrderType;
  priceBrl: number;
  priceUsdt: number;
  amount: number; // Quantidade de PENDLE
  grossTotalBrl: number; // Preço * Quantidade
  feeBrl: number; // Taxa cobrada
  netTotalBrl: number; // Compra: total + taxa | Venda: total - taxa
  realizedPnlBrl?: number; // Lucro ou prejuízo auferido nesta venda específica
  notes?: string;
}

export interface RiskSettings {
  maxExposurePercent: number; // Ex: 80 (%)
  maxLossLimitBrl: number; // Ex: 3.00 (R$ de perda máxima acumulada tolerada)
  feeRatePercent: number; // Ex: 0.10 (%)
  killSwitchActive: boolean; // Disjuntor ativado
}

export interface WalletState {
  balanceBrl: number; // Saldo em caixa R$
  pendleAmount: number; // PENDLE em custódia
  averageEntryPriceBrl: number; // Preço médio ponderado de entrada
  totalFeesPaidBrl: number; // Taxas totais pagas acumuladas
  realizedPnlBrl: number; // P&L realizado acumulado
  trades: Trade[];
  riskSettings: RiskSettings;
}

export interface MarketState {
  currentPriceBrl: number; // Preço atual fictício
  currentPriceUsdt: number;
  usdtBrlRate: number; // Ex: 5.60
  priceChangePercent24h: number;
  high24hBrl: number;
  low24hBrl: number;
  volume24hPendle: number;
  trend: 'ALTA' | 'BAIXA' | 'LATERAL';
  trendStrength: number; // 0 a 100%
  volatilityMode: 'BAIXA' | 'MEDIA' | 'ALTA' | 'PAUSADO';
  rsi14: number; // 0 a 100
  ema9: number;
  ema21: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceAlert {
  id: string;
  targetPriceBrl: number;
  condition: 'ABOVE_OR_EQUAL' | 'BELOW_OR_EQUAL';
  soundType: 'BEEP' | 'CHIME' | 'RADAR' | 'SIREN' | 'MUTED';
  note: string;
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt?: number;
  triggeredPrice?: number;
  autoReset?: boolean;
}

export interface SimulationSummary {
  balanceBrl: number;
  pendleAmount: number;
  positionValueBrl: number;
  totalEquityBrl: number;
  exposurePercent: number;
  averageEntryPriceBrl: number;
  unrealizedPnlBrl: number;
  unrealizedPnlPercent: number;
  realizedPnlBrl: number;
  totalPnlBrl: number; // realized + unrealized
  totalFeesPaidBrl: number;
  isLossLimitBreached: boolean;
  isMaxExposureBreached: boolean;
  killSwitchActive: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  warningMessage?: string;
}

export interface TestCaseResult {
  id: string;
  title: string;
  description: string;
  category: 'COMPRA' | 'VENDA' | 'TAXAS' | 'PNL' | 'EXPOSICAO' | 'RISCO' | 'KILL_SWITCH' | 'ALERTAS';
  passed: boolean;
  details: string;
  executionTimeMs: number;
}
