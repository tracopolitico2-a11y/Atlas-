/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  WalletState,
  OrderType,
  SimulationSummary,
  RiskSettings,
} from '../types/trading';
import {
  validateOrder,
  roundCrypto,
  roundCurrency,
} from '../core/tradingEngine';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Flame,
  Zap,
  Info,
  CheckCircle,
  Percent
} from 'lucide-react';

interface TradingPanelProps {
  wallet: WalletState;
  summary: SimulationSummary;
  currentPriceBrl: number;
  onExecuteBuy: (amount: number, priceBrl: number) => Promise<void> | void;
  onExecuteSell: (amount: number, priceBrl: number) => Promise<void> | void;
}

export const TradingPanel: React.FC<TradingPanelProps> = ({
  wallet,
  summary,
  currentPriceBrl,
  onExecuteBuy,
  onExecuteSell,
}) => {
  const [orderType, setOrderType] = useState<OrderType>('BUY');
  const [orderPriceInput, setOrderPriceInput] = useState<string>(
    currentPriceBrl.toFixed(2)
  );
  const [amountInput, setAmountInput] = useState<string>('');
  const [brlTotalInput, setBrlTotalInput] = useState<string>('');
  const [inputMode, setInputMode] = useState<'amount' | 'brl'>('amount');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  // Sincroniza preço ao mudar o preço do ticker caso o usuário não tenha editado manualmente
  useEffect(() => {
    setOrderPriceInput(currentPriceBrl.toFixed(2));
  }, [currentPriceBrl]);

  const activePrice = parseFloat(orderPriceInput.replace(',', '.')) || currentPriceBrl;

  // Atualizar montantes cruzados (PENDLE <-> R$)
  const handleAmountChange = (val: string) => {
    setAmountInput(val);
    setInputMode('amount');
    const parsedAmount = parseFloat(val.replace(',', '.'));
    if (!isNaN(parsedAmount) && parsedAmount > 0 && activePrice > 0) {
      setBrlTotalInput((parsedAmount * activePrice).toFixed(2));
    } else {
      setBrlTotalInput('');
    }
  };

  const handleBrlTotalChange = (val: string) => {
    setBrlTotalInput(val);
    setInputMode('brl');
    const parsedBrl = parseFloat(val.replace(',', '.'));
    if (!isNaN(parsedBrl) && parsedBrl > 0 && activePrice > 0) {
      setAmountInput((parsedBrl / activePrice).toFixed(4));
    } else {
      setAmountInput('');
    }
  };

  // Botões de Percentual Rápido (25%, 50%, 75%, 100%)
  const handlePercentShortcut = (percent: number) => {
    if (orderType === 'BUY') {
      // Baseia-se no saldo em caixa (considerando a taxa)
      const feeRate = wallet.riskSettings.feeRatePercent / 100;
      const targetBrl = (wallet.balanceBrl * (percent / 100)) / (1 + feeRate);
      const targetAmount = activePrice > 0 ? targetBrl / activePrice : 0;
      setAmountInput(roundCrypto(targetAmount, 4).toString());
      setBrlTotalInput(roundCurrency(targetAmount * activePrice, 2).toString());
      setInputMode('amount');
    } else {
      // Baseia-se na custódia de PENDLE
      const targetAmount = roundCrypto(wallet.pendleAmount * (percent / 100), 4);
      setAmountInput(targetAmount.toString());
      setBrlTotalInput(roundCurrency(targetAmount * activePrice, 2).toString());
      setInputMode('amount');
    }
  };

  // Cálculo de projeção em tempo real
  const currentAmount = parseFloat(amountInput.replace(',', '.')) || 0;
  const grossTotal = currentAmount * activePrice;
  const feeRate = wallet.riskSettings.feeRatePercent / 100;
  const estimatedFee = grossTotal * feeRate;
  const netTotal = orderType === 'BUY' ? grossTotal + estimatedFee : grossTotal - estimatedFee;

  // Projeção de P&L para venda
  const projectedSalePnl = orderType === 'SELL' && wallet.averageEntryPriceBrl > 0
    ? (activePrice - wallet.averageEntryPriceBrl) * currentAmount - estimatedFee
    : 0;

  // Projeção de exposição pós-compra
  let projectedExposure = summary.exposurePercent;
  if (orderType === 'BUY' && currentAmount > 0) {
    const projEquity = (wallet.balanceBrl - netTotal) + ((wallet.pendleAmount + currentAmount) * activePrice);
    if (projEquity > 0) {
      projectedExposure = (((wallet.pendleAmount + currentAmount) * activePrice) / projEquity) * 100;
    }
  }

  // Validação dinâmica
  useEffect(() => {
    if (currentAmount > 0) {
      const val = validateOrder(orderType, currentAmount, activePrice, wallet);
      if (!val.isValid) {
        setValidationError(val.errorMessage || 'Ordem inválida');
      } else {
        setValidationError(null);
      }
    } else {
      setValidationError(null);
    }
  }, [orderType, currentAmount, activePrice, wallet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Bloqueio síncrono instantâneo contra cliques rápidos e duplicados
    if (isSubmittingRef.current || isSubmitting) return;

    setActionSuccessMsg(null);

    if (currentAmount <= 0) {
      setValidationError('Insira uma quantidade válida de PENDLE.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (orderType === 'BUY') {
        await onExecuteBuy(currentAmount, activePrice);
        setActionSuccessMsg(`Compra simulada de ${currentAmount.toFixed(4)} PENDLE executada com sucesso!`);
      } else {
        await onExecuteSell(currentAmount, activePrice);
        setActionSuccessMsg(`Venda simulada de ${currentAmount.toFixed(4)} PENDLE executada com sucesso!`);
      }
      setAmountInput('');
      setBrlTotalInput('');
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      setValidationError(err?.message || 'Falha ao executar ordem simulada.');
    } finally {
      // Cooldown de 500ms para evitar duplo toque acidental em telas touch Android
      setTimeout(() => {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }, 500);
    }
  };

  const handlePanicLiquidate = () => {
    if (wallet.pendleAmount <= 0) return;
    if (isSubmittingRef.current || isSubmitting) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      onExecuteSell(wallet.pendleAmount, activePrice);
      setActionSuccessMsg(`Posição 100% liquidada a mercado a R$ ${activePrice.toFixed(2)}!`);
      setAmountInput('');
      setBrlTotalInput('');
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      setValidationError(err?.message || 'Falha ao liquidar posição.');
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }, 500);
    }
  };

  const isBuyBlocked = wallet.riskSettings.killSwitchActive || summary.isLossLimitBreached;

  return (
    <div className="bg-[#101520] border border-[#222c42] rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Abas Superiores Compra / Venda */}
      <div className="grid grid-cols-2 border-b border-[#222c42] font-mono text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setOrderType('BUY');
            setValidationError(null);
          }}
          className={`py-3 flex items-center justify-center gap-2 transition-all ${
            orderType === 'BUY'
              ? 'bg-emerald-950/70 text-emerald-400 border-b-2 border-emerald-500'
              : 'bg-[#0d121c] text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
          <span>COMPRAR PENDLE</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setOrderType('SELL');
            setValidationError(null);
          }}
          className={`py-3 flex items-center justify-center gap-2 transition-all ${
            orderType === 'SELL'
              ? 'bg-rose-950/70 text-rose-400 border-b-2 border-rose-500'
              : 'bg-[#0d121c] text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowDownCircle className="w-4 h-4 text-rose-400" />
          <span>VENDER PENDLE</span>
        </button>
      </div>

      {/* Identificação Explícita: SIMULAÇÃO LOCAL vs BINANCE SPOT TESTNET */}
      <div className="bg-[#0c1018] border-b border-[#1c2436] px-3 py-1.5 flex items-center justify-between text-[10px] font-mono">
        <span className="flex items-center gap-1.5 text-cyan-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          <span>EXECUÇÃO: SIMULAÇÃO LOCAL (R$ 10,00)</span>
        </span>
        <span className="text-amber-400 font-semibold">
          NENHUMA ORDEM ENVIADA À EXCHANGE
        </span>
      </div>

      <div className="p-3.5 sm:p-4 space-y-3.5 flex-1 flex flex-col justify-between">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Badge de aviso se Kill Switch estiver ativo */}
          {wallet.riskSettings.killSwitchActive && orderType === 'BUY' && (
            <div className="bg-rose-950/80 border border-rose-500/80 rounded-lg p-2.5 text-xs text-rose-200 flex items-start gap-2 animate-pulse font-mono">
              <Flame className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong>KILL SWITCH ATIVADO:</strong>
                <p className="text-[11px] text-rose-300">
                  Novas compras estão estritamente bloqueadas. Vendas permanecem liberadas para desalavancagem ou fechamento imediato.
                </p>
              </div>
            </div>
          )}

          {/* Preço Unitário Simulado */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Preço Simulado por PENDLE:</span>
              <button
                type="button"
                onClick={() => setOrderPriceInput(currentPriceBrl.toFixed(2))}
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                Usar Preço de Mercado (R$ {currentPriceBrl.toFixed(2)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 font-mono text-xs">R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={orderPriceInput}
                onChange={(e) => setOrderPriceInput(e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#26334d] focus:border-cyan-500 rounded-lg py-2 pl-8 pr-3 text-sm font-mono text-white focus:outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Quantidade em PENDLE */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Quantidade:</span>
              <span className="text-slate-300 font-mono">
                {orderType === 'BUY' ? (
                  <>Disponível: <strong className="text-white">R$ {wallet.balanceBrl.toFixed(2)}</strong></>
                ) : (
                  <>Em carteira: <strong className="text-cyan-300">{wallet.pendleAmount.toFixed(4)} PENDLE</strong></>
                )}
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#26334d] focus:border-cyan-500 rounded-lg py-2 pl-3 pr-16 text-sm font-mono text-white focus:outline-none"
                placeholder="0.0000"
              />
              <span className="absolute right-3 top-2.5 text-slate-500 font-mono text-xs font-bold">
                PENDLE
              </span>
            </div>
          </div>

          {/* Atalhos Rápidos de Percentual (25%, 50%, 75%, 100%) */}
          <div className="grid grid-cols-4 gap-1.5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handlePercentShortcut(pct)}
                className="py-1.5 rounded-md bg-[#141b2b] hover:bg-[#1f2940] border border-[#222c42] text-[11px] font-mono text-slate-300 hover:text-white transition-colors"
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Valor Equivalente em Reais (R$) */}
          <div>
            <div className="text-[11px] font-mono text-slate-400 mb-1">
              Valor Bruto em Reais (R$):
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 font-mono text-xs">R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={brlTotalInput}
                onChange={(e) => handleBrlTotalChange(e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#26334d] focus:border-cyan-500 rounded-lg py-2 pl-8 pr-3 text-sm font-mono text-white focus:outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Resumo de Projeção Financeira e Taxas */}
          <div className="bg-[#0b0e14] border border-[#1b2336] rounded-lg p-2.5 font-mono text-[11px] space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Taxa Simulada ({wallet.riskSettings.feeRatePercent}%):</span>
              <span className="text-amber-400 font-medium">R$ {estimatedFee.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-slate-300 border-t border-[#182030] pt-1">
              <span>{orderType === 'BUY' ? 'Total a Pagar (com taxa):' : 'Recebimento Líquido:'}</span>
              <span className="font-bold text-white text-xs">R$ {netTotal.toFixed(4)}</span>
            </div>

            {/* Impacto de Exposição Projetada */}
            {orderType === 'BUY' && currentAmount > 0 && (
              <div className="flex justify-between text-slate-400 pt-0.5">
                <span>Exposição Projetada:</span>
                <span className={`font-semibold ${
                  projectedExposure > wallet.riskSettings.maxExposurePercent ? 'text-rose-400 font-bold' : 'text-slate-300'
                }`}>
                  {projectedExposure.toFixed(1)}% (Máx: {wallet.riskSettings.maxExposurePercent}%)
                </span>
              </div>
            )}

            {/* Previsão de P&L para Venda */}
            {orderType === 'SELL' && currentAmount > 0 && wallet.averageEntryPriceBrl > 0 && (
              <div className="flex justify-between text-slate-400 pt-0.5">
                <span>P&L Líquido Previsto:</span>
                <span className={`font-bold ${projectedSalePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {projectedSalePnl >= 0 ? '+' : ''}R$ {projectedSalePnl.toFixed(4)}
                </span>
              </div>
            )}
          </div>

          {/* Mensagens de Erro ou Sucesso */}
          {validationError && (
            <div className="bg-rose-950/70 border border-rose-500/60 rounded-lg p-2 text-xs text-rose-300 flex items-start gap-1.5 font-mono">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {actionSuccessMsg && (
            <div className="bg-emerald-950/70 border border-emerald-500/60 rounded-lg p-2 text-xs text-emerald-300 flex items-center gap-1.5 font-mono">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}

          {/* Botão Principal de Execução */}
          <button
            type="submit"
            disabled={orderType === 'BUY' && isBuyBlocked}
            className={`w-full py-3 rounded-xl font-mono font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
              orderType === 'BUY'
                ? isBuyBlocked
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 active:scale-[0.99]'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20 active:scale-[0.99]'
            }`}
          >
            {orderType === 'BUY' ? (
              <>
                <ArrowUpCircle className="w-4 h-4" />
                <span>{wallet.riskSettings.killSwitchActive ? 'COMPRA BLOQUEADA (KILL SWITCH)' : 'EXECUTAR COMPRA SIMULADA'}</span>
              </>
            ) : (
              <>
                <ArrowDownCircle className="w-4 h-4" />
                <span>EXECUTAR VENDA SIMULADA</span>
              </>
            )}
          </button>
        </form>

        {/* Botão de Pânico / Liquidação Imediata (100% da Custódia) */}
        {wallet.pendleAmount > 0 && (
          <div className="pt-2 border-t border-[#1c2436]">
            <button
              type="button"
              onClick={handlePanicLiquidate}
              className="w-full py-2 px-3 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-600/40 text-amber-300 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              title="Vender 100% dos PENDLE imediatamente pelo preço de mercado"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>LIQUIDAR 100% DA POSIÇÃO A MERCADO</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
