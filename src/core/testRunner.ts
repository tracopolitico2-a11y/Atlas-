/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ATLASΩ Trader Intelligence - Automated Test Runner
 * Suíte de testes rigorosa para validação da engine de simulação financeira.
 */

import {
  getDefaultWalletState,
  executeBuy,
  executeSell,
  calculateSimulationSummary,
  validateOrder,
  INITIAL_BALANCE_BRL,
  DEFAULT_RISK_SETTINGS,
  checkPriceAlerts,
  sanitizeAndValidateWalletState,
  LOCAL_STORAGE_KEY,
} from './tradingEngine';
import { TransactionManager, MemoryStorage } from './transactionManager';
import { TestCaseResult, WalletState, PriceAlert } from '../types/trading';

export async function runTradingEngineTests(): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];

  function record(
    id: string,
    title: string,
    category: TestCaseResult['category'],
    description: string,
    testFn: () => { passed: boolean; details: string }
  ) {
    const start = performance.now();
    try {
      const res = testFn();
      const elapsed = Math.round((performance.now() - start) * 100) / 100;
      results.push({
        id,
        title,
        category,
        description,
        passed: res.passed,
        details: res.details,
        executionTimeMs: elapsed,
      });
    } catch (err: any) {
      const elapsed = Math.round((performance.now() - start) * 100) / 100;
      results.push({
        id,
        title,
        category,
        description,
        passed: false,
        details: `Exceção inesperada: ${err?.message || String(err)}`,
        executionTimeMs: elapsed,
      });
    }
  }

  async function recordAsync(
    id: string,
    title: string,
    category: TestCaseResult['category'],
    description: string,
    testFn: () => Promise<{ passed: boolean; details: string }>
  ) {
    const start = performance.now();
    try {
      const res = await testFn();
      const elapsed = Math.round((performance.now() - start) * 100) / 100;
      results.push({
        id,
        title,
        category,
        description,
        passed: res.passed,
        details: res.details,
        executionTimeMs: elapsed,
      });
    } catch (err: any) {
      const elapsed = Math.round((performance.now() - start) * 100) / 100;
      results.push({
        id,
        title,
        category,
        description,
        passed: false,
        details: `Exceção inesperada: ${err?.message || String(err)}`,
        executionTimeMs: elapsed,
      });
    }
  }

  // TESTE 1: Capital Inicial
  record(
    'TC-01',
    'Capital Inicial Padrão de R$ 10,00',
    'RISCO',
    'Garante que o estado inicial possui saldo de R$ 10,00, sem PENDLE e sem dívidas.',
    () => {
      const wallet = getDefaultWalletState();
      const passed =
        wallet.balanceBrl === INITIAL_BALANCE_BRL &&
        wallet.balanceBrl === 10.0 &&
        wallet.pendleAmount === 0 &&
        wallet.averageEntryPriceBrl === 0 &&
        wallet.realizedPnlBrl === 0 &&
        wallet.trades.length === 0;

      return {
        passed,
        details: `Saldo: R$ ${wallet.balanceBrl.toFixed(2)}, PENDLE: ${wallet.pendleAmount}, P&L Realizado: R$ ${wallet.realizedPnlBrl.toFixed(2)}`,
      };
    }
  );

  // TESTE 2: Compra Simples e Taxas
  record(
    'TC-02',
    'Execução de Compra e Dedução Precisa de Taxas',
    'COMPRA',
    'Verifica a compra de 0.20 PENDLE a R$ 25,00 com taxa configurada de 0.10%.',
    () => {
      const wallet = getDefaultWalletState();
      // Compra 0.2 PENDLE a R$ 25,00 = R$ 5,00 bruto. Taxa 0.10% = R$ 0,005. Total = R$ 5,005
      const { updatedWallet, trade } = executeBuy(wallet, 0.2, 25.0);

      const expectedGross = 5.0;
      const expectedFee = 0.005;
      const expectedNet = 5.005;
      const expectedBalance = 10.0 - 5.005; // 4.995

      const passed =
        Math.abs(trade.grossTotalBrl - expectedGross) < 0.001 &&
        Math.abs(trade.feeBrl - expectedFee) < 0.001 &&
        Math.abs(trade.netTotalBrl - expectedNet) < 0.001 &&
        Math.abs(updatedWallet.balanceBrl - expectedBalance) < 0.001 &&
        updatedWallet.pendleAmount === 0.2 &&
        updatedWallet.averageEntryPriceBrl === 25.0;

      return {
        passed,
        details: `Bruto: R$ ${trade.grossTotalBrl}, Taxa: R$ ${trade.feeBrl}, Saldo Restante: R$ ${updatedWallet.balanceBrl.toFixed(4)}`,
      };
    }
  );

  // TESTE 3: Bloqueio de Compra por Saldo Insuficiente
  record(
    'TC-03',
    'Bloqueio Estrito por Saldo Insuficiente',
    'COMPRA',
    'Valida rejeição imediata de ordem quando o custo excede o saldo em caixa de R$ 10,00.',
    () => {
      const wallet = getDefaultWalletState();
      const val = validateOrder('BUY', 1.0, 25.0, wallet); // Custo R$ 25,00 > R$ 10,00

      let threw = false;
      try {
        executeBuy(wallet, 1.0, 25.0);
      } catch (e: any) {
        threw = true;
      }

      const passed = !val.isValid && threw && (val.errorMessage?.includes('Saldo insuficiente') ?? false);
      return {
        passed,
        details: `Validação bloqueou corretamente: "${val.errorMessage}"`,
      };
    }
  );

  // TESTE 4: Preço Médio Ponderado em Múltiplas Compras
  record(
    'TC-04',
    'Cálculo de Preço Médio Ponderado',
    'COMPRA',
    'Compra 0.10 PENDLE a R$ 20,00 e 0.10 PENDLE a R$ 30,00. Preço médio deve ser R$ 25,00.',
    () => {
      const wallet = getDefaultWalletState();
      const step1 = executeBuy(wallet, 0.1, 20.0); // Custo R$ 2,00
      const step2 = executeBuy(step1.updatedWallet, 0.1, 30.0); // Custo R$ 3,00. Total R$ 5,00 / 0.2 = R$ 25,00

      const passed =
        step2.updatedWallet.pendleAmount === 0.2 &&
        Math.abs(step2.updatedWallet.averageEntryPriceBrl - 25.0) < 0.01;

      return {
        passed,
        details: `Quantidade acumulada: ${step2.updatedWallet.pendleAmount} PENDLE, Preço Médio Ponderado: R$ ${step2.updatedWallet.averageEntryPriceBrl.toFixed(2)}`,
      };
    }
  );

  // TESTE 5: Venda Parcial com Lucro
  record(
    'TC-05',
    'Venda Parcial (50%) com Lucro e Cálculo de P&L Realizado',
    'VENDA',
    'Compra a R$ 20,00 e vende 50% a R$ 30,00. Verifica ganho realizado positivo.',
    () => {
      const wallet = getDefaultWalletState();
      // Compra 0.2 PENDLE a R$ 20,00 (Total ~ R$ 4,00)
      const buyStep = executeBuy(wallet, 0.2, 20.0);
      // Vende 0.1 PENDLE (50%) a R$ 30,00 (Bruto R$ 3,00, Custo Base R$ 2,00 -> Lucro Bruto R$ 1,00)
      const sellStep = executeSell(buyStep.updatedWallet, 0.1, 30.0);

      const fee = 3.0 * (wallet.riskSettings.feeRatePercent / 100); // 0.003
      const expectedNetPnl = 1.0 - fee; // ~0.997

      const passed =
        sellStep.updatedWallet.pendleAmount === 0.1 &&
        sellStep.updatedWallet.averageEntryPriceBrl === 20.0 && // Preço médio permanece o mesmo na venda parcial
        Math.abs(sellStep.updatedWallet.realizedPnlBrl - expectedNetPnl) < 0.005;

      return {
        passed,
        details: `Quantidade restante: ${sellStep.updatedWallet.pendleAmount} PENDLE, P&L Realizado: +R$ ${sellStep.updatedWallet.realizedPnlBrl.toFixed(4)}, PM mantido em R$ ${sellStep.updatedWallet.averageEntryPriceBrl.toFixed(2)}`,
      };
    }
  );

  // TESTE 6: Venda Parcial com Prejuízo
  record(
    'TC-06',
    'Venda Parcial com Prejuízo Controlado',
    'VENDA',
    'Compra a R$ 25,00 e vende 50% a R$ 20,00. Verifica registro de perda realizada negativa.',
    () => {
      const wallet = getDefaultWalletState();
      const buyStep = executeBuy(wallet, 0.2, 25.0); // Custo R$ 5,00
      const sellStep = executeSell(buyStep.updatedWallet, 0.1, 20.0); // Vende 0.1 a 20 -> Bruto R$ 2,00. Custo base R$ 2,50 -> Perda bruta -R$ 0,50

      const passed =
        sellStep.updatedWallet.pendleAmount === 0.1 &&
        sellStep.updatedWallet.realizedPnlBrl < 0 &&
        Math.abs(sellStep.updatedWallet.realizedPnlBrl - (-0.502)) < 0.01;

      return {
        passed,
        details: `P&L Realizado negativo registrado: R$ ${sellStep.updatedWallet.realizedPnlBrl.toFixed(4)}`,
      };
    }
  );

  // TESTE 7: Venda Total (100%) e Reset de Preço Médio
  record(
    'TC-07',
    'Venda Total (100%) e Reset de Posição',
    'VENDA',
    'Vende 100% da custódia. Garante zeramento da quantidade e reset de preço médio para zero.',
    () => {
      const wallet = getDefaultWalletState();
      const buyStep = executeBuy(wallet, 0.2, 25.0);
      const sellStep = executeSell(buyStep.updatedWallet, 0.2, 28.0);

      const passed =
        sellStep.updatedWallet.pendleAmount === 0 &&
        sellStep.updatedWallet.averageEntryPriceBrl === 0 &&
        sellStep.updatedWallet.trades.length === 2;

      return {
        passed,
        details: `Quantidade final: ${sellStep.updatedWallet.pendleAmount}, Preço médio resetado para R$ ${sellStep.updatedWallet.averageEntryPriceBrl.toFixed(2)}`,
      };
    }
  );

  // TESTE 8: P&L Não Realizado e Exposição Patrimonial
  record(
    'TC-08',
    'Cálculo de P&L Não Realizado e Exposição (%)',
    'PNL',
    'Calcula a valorização flutuante da carteira com base no preço de mercado simulado.',
    () => {
      const wallet = getDefaultWalletState();
      // Compra 0.2 PENDLE a R$ 20,00 (Gasto R$ 4,00). Saldo em caixa: ~R$ 5,996
      const { updatedWallet } = executeBuy(wallet, 0.2, 20.0);

      // Preço de mercado simulado sobe para R$ 30,00 (+50%)
      const summary = calculateSimulationSummary(updatedWallet, 30.0);

      // Valor da posição = 0.2 * 30 = R$ 6,00. P&L não realizado = (30 - 20) * 0.2 = +R$ 2,00 (+50%)
      const expectedUnrealized = 2.0;
      const expectedPositionVal = 6.0;

      const passed =
        Math.abs(summary.unrealizedPnlBrl - expectedUnrealized) < 0.01 &&
        Math.abs(summary.unrealizedPnlPercent - 50.0) < 0.1 &&
        Math.abs(summary.positionValueBrl - expectedPositionVal) < 0.01 &&
        summary.exposurePercent > 45 && summary.exposurePercent < 55;

      return {
        passed,
        details: `P&L Não Realizado: +R$ ${summary.unrealizedPnlBrl.toFixed(2)} (+${summary.unrealizedPnlPercent.toFixed(1)}%), Exposição: ${summary.exposurePercent.toFixed(1)}%`,
      };
    }
  );

  // TESTE 9: Limite de Exposição Máxima
  record(
    'TC-09',
    'Bloqueio por Limite de Exposição Máxima',
    'EXPOSICAO',
    'Configura limite de exposição de 50%. Tenta alocar 80% do patrimônio e valida o bloqueio.',
    () => {
      const wallet: WalletState = {
        ...getDefaultWalletState(),
        riskSettings: {
          ...DEFAULT_RISK_SETTINGS,
          maxExposurePercent: 50.0, // Limite rígido de 50%
        },
      };

      // Compra de R$ 8,00 ultrapassaria 50% de exposição (ficaria ~80%)
      const val = validateOrder('BUY', 0.32, 25.0, wallet); // 0.32 * 25 = R$ 8,00

      const passed =
        !val.isValid &&
        (val.errorMessage?.includes('Exposição excessiva') ?? false);

      return {
        passed,
        details: `Validação bloqueou excesso de exposição: "${val.errorMessage}"`,
      };
    }
  );

  // TESTE 10: Limite de Perda Máxima (Max Drawdown Limiter)
  record(
    'TC-10',
    'Bloqueio por Limite de Perda Máxima',
    'RISCO',
    'Com limite de perda configurado em R$ 2,00, simula perda total de R$ 2,50 e valida bloqueio de novas compras.',
    () => {
      const wallet: WalletState = {
        ...getDefaultWalletState(),
        balanceBrl: 7.5,
        realizedPnlBrl: -2.5, // Perda realizada de R$ 2,50
        riskSettings: {
          ...DEFAULT_RISK_SETTINGS,
          maxLossLimitBrl: 2.0, // Limite de tolerância de R$ 2,00
        },
      };

      const val = validateOrder('BUY', 0.1, 25.0, wallet);
      const passed =
        !val.isValid &&
        (val.errorMessage?.includes('LIMITE DE PERDA ATINGIDO') ?? false);

      return {
        passed,
        details: `Compra bloqueada por drawdown: "${val.errorMessage}"`,
      };
    }
  );

  // TESTE 11: Kill Switch de Emergência
  record(
    'TC-11',
    'Kill Switch: Bloqueio de Compras e Manutenção de Vendas',
    'KILL_SWITCH',
    'Quando o Kill Switch está ativo, compras são 100% rejeitadas, mas vendas continuam autorizadas.',
    () => {
      // Cria carteira com 0.2 PENDLE e Kill Switch ATIVO
      const walletWithPosition: WalletState = {
        ...getDefaultWalletState(),
        balanceBrl: 5.0,
        pendleAmount: 0.2,
        averageEntryPriceBrl: 25.0,
        riskSettings: {
          ...DEFAULT_RISK_SETTINGS,
          killSwitchActive: true, // LIGADO
        },
      };

      // 1. Tentar comprar deve ser BLOQUEADO
      const buyValidation = validateOrder('BUY', 0.1, 25.0, walletWithPosition);

      // 2. Tentar vender deve ser AUTORIZADO
      const sellValidation = validateOrder('SELL', 0.1, 25.0, walletWithPosition);
      const sellExecution = executeSell(walletWithPosition, 0.1, 25.0);

      const passed =
        !buyValidation.isValid &&
        (buyValidation.errorMessage?.includes('KILL SWITCH ATIVO') ?? false) &&
        sellValidation.isValid &&
        sellExecution.updatedWallet.pendleAmount === 0.1;

      return {
        passed,
        details: `Compra bloqueada com sucesso ("${buyValidation.errorMessage}"). Venda autorizada e executada com sucesso.`,
      };
    }
  );

  // TESTE 12: Alertas de Preço (Alta / Alvo)
  record(
    'TC-12',
    'Disparo de Alerta de Preço Customizado (Condição >= Alvo)',
    'ALERTAS',
    'Configura alerta em R$ 28,00. Quando o preço sobe para R$ 28,50, o alerta dispara e é registrado.',
    () => {
      const alerts: PriceAlert[] = [
        {
          id: 'alt-1',
          targetPriceBrl: 28.0,
          condition: 'ABOVE_OR_EQUAL',
          soundType: 'CHIME',
          note: 'Alvo de Venda',
          isActive: true,
          isTriggered: false,
        },
      ];

      // Preço sobe de 25.00 para 28.50
      const { updatedAlerts, triggeredAlerts } = checkPriceAlerts(alerts, 25.0, 28.5);

      const passed =
        triggeredAlerts.length === 1 &&
        triggeredAlerts[0].id === 'alt-1' &&
        updatedAlerts[0].isTriggered === true &&
        updatedAlerts[0].triggeredPrice === 28.5;

      return {
        passed,
        details: `Alerta disparado com sucesso: Alvo R$ 28,00 atingido em R$ ${triggeredAlerts[0]?.triggeredPrice?.toFixed(2)} (${triggeredAlerts[0]?.note})`,
      };
    }
  );

  // TESTE 13: Alertas de Preço (Baixa / Suporte e Inatividade)
  record(
    'TC-13',
    'Alerta em Queda (Condição <= Suporte) e Respeito a Alerta Inativo',
    'ALERTAS',
    'Verifica que alertas inativos não disparam e alertas de suporte <= disparam ao cair de preço.',
    () => {
      const alerts: PriceAlert[] = [
        {
          id: 'alt-active-low',
          targetPriceBrl: 22.0,
          condition: 'BELOW_OR_EQUAL',
          soundType: 'RADAR',
          note: 'Suporte Crítico',
          isActive: true,
          isTriggered: false,
        },
        {
          id: 'alt-disabled',
          targetPriceBrl: 22.0,
          condition: 'BELOW_OR_EQUAL',
          soundType: 'SIREN',
          note: 'Alerta Desligado',
          isActive: false, // Desativado
          isTriggered: false,
        },
      ];

      // Preço cai de 25.0 para 21.80
      const { triggeredAlerts } = checkPriceAlerts(alerts, 25.0, 21.8);

      const passed =
        triggeredAlerts.length === 1 &&
        triggeredAlerts[0].id === 'alt-active-low';

      return {
        passed,
        details: `Apenas o alerta ativo disparou: "${triggeredAlerts[0]?.note}" em R$ ${triggeredAlerts[0]?.triggeredPrice?.toFixed(2)}. Alerta inativo ignorado.`,
      };
    }
  );

  // TESTE 14: Valores Inválidos, Negativos, NaN e Submínimos
  record(
    'TC-14',
    'Bloqueio Estrito de Valores Inválidos (NaN, Negativos, Submínimos)',
    'RISCO',
    'Rejeita ordens com valores não numéricos, quantidades negativas ou abaixo do lote mínimo.',
    () => {
      const wallet = getDefaultWalletState();
      const valNeg = validateOrder('BUY', -0.5, 25.0, wallet);
      const valZero = validateOrder('BUY', 0, 25.0, wallet);
      const valNaN = validateOrder('BUY', NaN, 25.0, wallet);
      const valSubmin = validateOrder('BUY', 0.00001, 25.0, wallet); // < 0.0001 PENDLE

      const passed =
        !valNeg.isValid &&
        !valZero.isValid &&
        !valNaN.isValid &&
        !valSubmin.isValid &&
        (valSubmin.errorMessage?.includes('Quantidade mínima') ?? false);

      return {
        passed,
        details: `Todas as 4 ordens inválidas foram rejeitadas com segurança pela engine. Mensagem submínima: "${valSubmin.errorMessage}"`,
      };
    }
  );

  // TESTE 15: Prevenção contra Operação Duplicada Consecutiva
  record(
    'TC-15',
    'Bloqueio de Operação Duplicada Consecutiva (< 1s)',
    'RISCO',
    'Impede que a mesma ordem seja processada duas vezes consecutivas dentro de 1 segundo.',
    () => {
      const wallet = getDefaultWalletState();
      // Executa primeira compra legítima
      const buy1 = executeBuy(wallet, 0.1, 25.0);

      // Tenta submeter ordem idêntica imediatamente (< 1000ms)
      const valDuplicate = validateOrder('BUY', 0.1, 25.0, buy1.updatedWallet);

      const passed =
        !valDuplicate.isValid &&
        (valDuplicate.errorMessage?.includes('Operação duplicada detectada') ?? false);

      return {
        passed,
        details: `Ordem duplicada bloqueada com sucesso: "${valDuplicate.errorMessage}"`,
      };
    }
  );

  // TESTE 16: Bloqueio Estrito de Venda Superior à Custódia
  record(
    'TC-16',
    'Bloqueio Estrito de Venda Superior à Custódia (Tentativa de Venda Descoberta)',
    'VENDA',
    'Garante que tentar vender mais PENDLE do que o saldo em carteira seja terminantemente rejeitado.',
    () => {
      const wallet = getDefaultWalletState();
      // Compra 0.2 PENDLE
      const buy = executeBuy(wallet, 0.2, 25.0);

      // Tenta vender 0.5 PENDLE (possui apenas 0.2)
      const valOversell = validateOrder('SELL', 0.5, 25.0, buy.updatedWallet);

      let threw = false;
      try {
        executeSell(buy.updatedWallet, 0.5, 25.0);
      } catch (e: any) {
        threw = true;
      }

      const passed =
        !valOversell.isValid &&
        threw &&
        (valOversell.errorMessage?.includes('insuficiente para venda') ?? false);

      return {
        passed,
        details: `Venda acima do saldo bloqueada e exceção disparada: "${valOversell.errorMessage}"`,
      };
    }
  );

  // TESTE 17: Compra no Limite Exato do Capital (All-in com Taxa)
  record(
    'TC-17',
    'Compra no Limite Exato do Capital (R$ 10,00 com Taxa Embutida)',
    'COMPRA',
    'Aloca o saldo disponível máximo considerando a taxa de 0.10%, garantindo saldo residual estritamente não negativo.',
    () => {
      const wallet: WalletState = {
        ...getDefaultWalletState(),
        riskSettings: {
          ...DEFAULT_RISK_SETTINGS,
          maxExposurePercent: 100.0,
        },
      };
      // Capital R$ 10,00. Taxa 0.10%. Valor bruto máximo = 10 / 1.001 = 9.99000999
      // A R$ 25,00 por PENDLE -> 0.3996 PENDLE
      const targetAmount = 0.3996;
      const { updatedWallet, trade } = executeBuy(wallet, targetAmount, 25.0);

      const passed =
        updatedWallet.balanceBrl >= 0 &&
        updatedWallet.balanceBrl <= 0.01 &&
        trade.netTotalBrl <= 10.0 &&
        updatedWallet.pendleAmount === targetAmount;

      return {
        passed,
        details: `Gasto Líquido: R$ ${trade.netTotalBrl.toFixed(4)} (Taxa: R$ ${trade.feeBrl.toFixed(4)}). Saldo residual seguro: R$ ${updatedWallet.balanceBrl.toFixed(4)}`,
      };
    }
  );

  // TESTE 18: Venda Fracionada de Micro-lote (0.0001 PENDLE)
  record(
    'TC-18',
    'Venda Fracionada de Micro-lote com Preservação de Precisão Decimal',
    'VENDA',
    'Compra 0.10 PENDLE e realiza venda mínima de 0.0001 PENDLE a R$ 30,00. Verifica precisão e preservação do PM.',
    () => {
      const wallet = getDefaultWalletState();
      const buy = executeBuy(wallet, 0.10, 25.0);
      const sell = executeSell(buy.updatedWallet, 0.0001, 30.0);

      const expectedRemaining = 0.0999;
      const passed =
        Math.abs(sell.updatedWallet.pendleAmount - expectedRemaining) < 0.000001 &&
        sell.updatedWallet.averageEntryPriceBrl === 25.0 &&
        sell.updatedWallet.realizedPnlBrl > 0;

      return {
        passed,
        details: `Custódia restante: ${sell.updatedWallet.pendleAmount.toFixed(6)} PENDLE, PM mantido em R$ ${sell.updatedWallet.averageEntryPriceBrl.toFixed(2)}, Lucro micro-lote: +R$ ${sell.updatedWallet.realizedPnlBrl.toFixed(6)}`,
      };
    }
  );

  // TESTE 19: Queda Extrema de Cotação (-99.9% Flash Crash)
  record(
    'TC-19',
    'Queda Extrema de Cotação (-99.9%) e Estabilidade Contábil',
    'PNL',
    'Simula desvalorização catastrófica (de R$ 25,00 para R$ 0,025) e valida ausência de NaN e consistência patrimonial.',
    () => {
      const wallet = getDefaultWalletState();
      const buy = executeBuy(wallet, 0.20, 25.0); // R$ 5,00 alocados

      // Cotação cai para R$ 0,025 (-99.9%)
      const crashPrice = 0.025;
      const summary = calculateSimulationSummary(buy.updatedWallet, crashPrice);

      const passed =
        isFinite(summary.unrealizedPnlBrl) &&
        isFinite(summary.unrealizedPnlPercent) &&
        isFinite(summary.totalEquityBrl) &&
        summary.unrealizedPnlBrl < 0 &&
        summary.positionValueBrl >= 0 &&
        summary.totalEquityBrl > 0 &&
        summary.totalEquityBrl < 10.0;

      return {
        passed,
        details: `Patrimônio pós-crash: R$ ${summary.totalEquityBrl.toFixed(4)}, P&L Não Realizado: R$ ${summary.unrealizedPnlBrl.toFixed(4)} (${summary.unrealizedPnlPercent.toFixed(1)}%), Posição residual: R$ ${summary.positionValueBrl.toFixed(4)}`,
      };
    }
  );

  // TESTE 20: Prevenção de Gasto Duplicado/Concorrente em Pipeline
  record(
    'TC-20',
    'Prevenção de Gasto Concorrente / Overspend em Pipeline Atômico',
    'RISCO',
    'Tenta executar duas compras consecutivas de R$ 7,50 com capital de R$ 10,00; a segunda é bloqueada por saldo insuficiente.',
    () => {
      const wallet = getDefaultWalletState(); // Saldo R$ 10,00

      // Ordem 1: 0.3 PENDLE a R$ 25,00 = ~R$ 7,50
      const order1 = executeBuy(wallet, 0.3, 25.0);

      // Ordem 2 subsequente com montante distinto (0.25 PENDLE = ~R$ 6,25) tentando gastar mais que o saldo disponível (~R$ 2,49)
      const valOrder2 = validateOrder('BUY', 0.25, 25.0, order1.updatedWallet);

      let threw = false;
      try {
        executeBuy(order1.updatedWallet, 0.25, 25.0);
      } catch (e: any) {
        threw = true;
      }

      const passed =
        order1.updatedWallet.balanceBrl < 2.50 &&
        !valOrder2.isValid &&
        threw &&
        (valOrder2.errorMessage?.includes('Saldo insuficiente') ?? false);

      return {
        passed,
        details: `Ordem 1 consumiu saldo (restante R$ ${order1.updatedWallet.balanceBrl.toFixed(2)}). Ordem 2 concorrente rejeitada: "${valOrder2.errorMessage}"`,
      };
    }
  );

  // TESTE 21: Recuperação Resiliente de Estado Parcial do LocalStorage
  record(
    'TC-21',
    'Recuperação Resiliente de Estado Parcial ou Corrompido no LocalStorage',
    'RISCO',
    'Testa a hidratação defensiva com propriedades omitidas (riskSettings, trades nulo) aplicando defaults sem crash.',
    () => {
      const corruptPartialState = {
        balanceBrl: 8.50,
        pendleAmount: 0.05,
        // riskSettings e trades propositalmente ausentes/nulos
        riskSettings: null,
        trades: null,
      };

      const recoveredState = sanitizeAndValidateWalletState(corruptPartialState);

      // Testa também injeção de saldo negativo e dados severamente corrompidos
      const negativeBalanceState = sanitizeAndValidateWalletState({
        balanceBrl: -150.0,
        pendleAmount: NaN,
        trades: 'string_invalida_nao_array',
      });

      const passed =
        recoveredState.balanceBrl === 8.50 &&
        recoveredState.pendleAmount === 0.05 &&
        recoveredState.riskSettings.maxExposurePercent === DEFAULT_RISK_SETTINGS.maxExposurePercent &&
        recoveredState.riskSettings.feeRatePercent === DEFAULT_RISK_SETTINGS.feeRatePercent &&
        Array.isArray(recoveredState.trades) &&
        recoveredState.trades.length === 0 &&
        // Verifica que injeção negativa foi saneada para o capital inicial padrão sem quebrar
        negativeBalanceState.balanceBrl === 10.0 &&
        negativeBalanceState.pendleAmount === 0 &&
        Array.isArray(negativeBalanceState.trades);

      return {
        passed,
        details: `Estado recuperado: Saldo R$ ${recoveredState.balanceBrl.toFixed(2)}, Exp. Máx restaurada: ${recoveredState.riskSettings.maxExposurePercent}%. Injeção negativa corrigida para R$ ${negativeBalanceState.balanceBrl.toFixed(2)}.`,
      };
    }
  );

  // TESTE 22: Fila Sequencial FIFO e Concorrência Atômica In-Tab
  await recordAsync(
    'TC-22',
    'Fila Sequencial FIFO e Concorrência Atômica com Fila de Promessas',
    'RISCO',
    'Dispara 3 compras concorrentes (0.10, 0.11 e 0.09 PENDLE) via Promise.all; a fila serializa e debita o saldo progressivamente sem perda de atualização (lost update).',
    async () => {
      const storage = new MemoryStorage();
      storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(getDefaultWalletState())); // Saldo R$ 10,00

      const tx = new TransactionManager();

      // Dispara 3 operações concorrentes com montantes distintos para exercitar a fila de atomicidade
      const p1 = tx.executeAtomicTransaction(
        (w) => executeBuy(w, 0.10, 25.0),
        { storageOverride: storage }
      );
      const p2 = tx.executeAtomicTransaction(
        (w) => executeBuy(w, 0.11, 25.0),
        { storageOverride: storage }
      );
      const p3 = tx.executeAtomicTransaction(
        (w) => executeBuy(w, 0.09, 25.0),
        { storageOverride: storage }
      );

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      const persistedRaw = storage.getItem(LOCAL_STORAGE_KEY);
      const persistedWallet = persistedRaw ? JSON.parse(persistedRaw) : null;

      const passed =
        r1.updatedWallet.pendleAmount === 0.10 &&
        r2.updatedWallet.pendleAmount === 0.21 &&
        r3.updatedWallet.pendleAmount === 0.30 &&
        Math.abs(r3.updatedWallet.balanceBrl - 2.4925) < 0.02 &&
        persistedWallet !== null &&
        persistedWallet.pendleAmount === 0.30 &&
        persistedWallet.trades.length === 3;

      return {
        passed,
        details: `3 compras simultâneas serializadas com sucesso. Saldo final: R$ ${r3.updatedWallet.balanceBrl.toFixed(4)}, Custódia: ${r3.updatedWallet.pendleAmount.toFixed(4)} PENDLE, Trades persistidos: ${persistedWallet?.trades.length}.`,
      };
    }
  );

  // TESTE 23: Saldo Insuficiente após Concorrência (Double-Spend Protection)
  await recordAsync(
    'TC-23',
    'Bloqueio de Saldo Insuficiente sob Disparo Concorrente (Double-Spend)',
    'RISCO',
    'Dispara 2 ordens simultâneas (0.30 e 0.28 PENDLE, total ~R$ 14,50) contra saldo de R$ 10,00. Apenas a primeira é liquidada; a segunda é rejeitada com erro de saldo.',
    async () => {
      const storage = new MemoryStorage();
      storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(getDefaultWalletState())); // Saldo R$ 10,00

      const tx = new TransactionManager();

      // Ordem A: 0.30 PENDLE a R$ 25.00 (~R$ 7.5075)
      // Ordem B: 0.28 PENDLE a R$ 25.00 (~R$ 7.0070)
      const p1 = tx.executeAtomicTransaction(
        (w) => executeBuy(w, 0.30, 25.0),
        { storageOverride: storage }
      );
      const p2 = tx.executeAtomicTransaction(
        (w) => executeBuy(w, 0.28, 25.0),
        { storageOverride: storage }
      );

      const [res1, res2] = await Promise.allSettled([p1, p2]);

      const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r) => r.status === 'rejected');

      const persistedRaw = storage.getItem(LOCAL_STORAGE_KEY);
      const persistedWallet = persistedRaw ? JSON.parse(persistedRaw) : null;

      const rejectReason = rejected.length > 0 ? (rejected[0] as PromiseRejectedResult).reason?.message : '';

      const passed =
        fulfilled.length === 1 &&
        rejected.length === 1 &&
        rejectReason.includes('Saldo insuficiente') &&
        persistedWallet.balanceBrl > 2.40 &&
        persistedWallet.balanceBrl < 2.50 &&
        persistedWallet.pendleAmount === 0.30 &&
        persistedWallet.trades.length === 1;

      return {
        passed,
        details: `1 aprovada, 1 rejeitada com mensagem: "${rejectReason}". Saldo restante: R$ ${persistedWallet?.balanceBrl.toFixed(2)}, impedindo saldo negativo.`,
      };
    }
  );

  // TESTE 24: Falha de Persistência e Rollback Atômico (I/O Fault Injection)
  await recordAsync(
    'TC-24',
    'Rollback Atômico e Não-Comprometimento em Falha de Persistência (I/O)',
    'RISCO',
    'Injeta falha de gravação no storage (ex: disco cheio/QuotaExceededError). Verifica que a transação é rejeitada e nenhum dado corrompido ou parcial é salvo.',
    async () => {
      const storage = new MemoryStorage();
      const initialWallet = getDefaultWalletState();
      storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialWallet));

      const tx = new TransactionManager();

      let failed = false;
      let caughtError = '';
      try {
        await tx.executeAtomicTransaction(
          (w) => executeBuy(w, 0.2, 25.0),
          { storageOverride: storage, mockStorageFailure: true }
        );
      } catch (err: any) {
        failed = true;
        caughtError = err?.message || String(err);
      }

      const storageAfter = storage.getItem(LOCAL_STORAGE_KEY);
      const walletAfter = storageAfter ? JSON.parse(storageAfter) : null;

      const passed =
        failed &&
        caughtError.includes('Falha de persistência simulada') &&
        walletAfter.balanceBrl === 10.0 &&
        walletAfter.pendleAmount === 0 &&
        walletAfter.trades.length === 0;

      return {
        passed,
        details: `Operação rejeitada com: "${caughtError}". Storage preservado intacto com saldo R$ ${walletAfter?.balanceBrl.toFixed(2)} e 0 trades.`,
      };
    }
  );

  // TESTE 25: Persistência Real e Recuperação Pós-Recarregamento Completo
  await recordAsync(
    'TC-25',
    'Ciclo Completo de Persistência e Recuperação Pós-Recarregamento de Página',
    'RISCO',
    'Executa compra, alteração de parâmetros de risco e venda parcial; serializa no storage; simula reload com hidratação e sanitização defensiva.',
    async () => {
      const storage = new MemoryStorage();
      storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(getDefaultWalletState()));
      const tx = new TransactionManager();

      // 1. Compra 0.2 PENDLE a R$ 25,00 (~R$ 5,005)
      await tx.executeAtomicTransaction(
        (w) => executeBuy(w, 0.2, 25.0),
        { storageOverride: storage }
      );

      // 2. Modifica configurações de risco (Kill Switch ativo, Max Exp 50%)
      await tx.executeAtomicTransaction(
        (w) => ({
          updatedWallet: {
            ...w,
            riskSettings: {
              ...w.riskSettings,
              killSwitchActive: true,
              maxExposurePercent: 50.0,
            },
          },
        }),
        { storageOverride: storage }
      );

      // 3. Venda simulada parcial de 0.1 PENDLE a R$ 30,00 (Kill switch permite vendas!)
      await tx.executeAtomicTransaction(
        (w) => executeSell(w, 0.1, 30.0),
        { storageOverride: storage }
      );

      // 4. Simulação de "Reload da Página":
      // Lê a string bruta do storage e executa o processo de boot do React com sanitizeAndValidateWalletState
      const rawStored = storage.getItem(LOCAL_STORAGE_KEY);
      const reloadedWallet = sanitizeAndValidateWalletState(JSON.parse(rawStored!));

      const passed =
        reloadedWallet.pendleAmount === 0.1 &&
        reloadedWallet.trades.length === 2 &&
        reloadedWallet.trades[0].type === 'SELL' &&
        reloadedWallet.trades[1].type === 'BUY' &&
        reloadedWallet.riskSettings.killSwitchActive === true &&
        reloadedWallet.riskSettings.maxExposurePercent === 50.0 &&
        reloadedWallet.realizedPnlBrl > 0.40 &&
        reloadedWallet.balanceBrl > 7.90;

      return {
        passed,
        details: `Pós-reload: Saldo R$ ${reloadedWallet.balanceBrl.toFixed(2)}, PENDLE ${reloadedWallet.pendleAmount}, P&L Realizado: +R$ ${reloadedWallet.realizedPnlBrl.toFixed(2)}, Kill Switch: ${reloadedWallet.riskSettings.killSwitchActive ? 'ATIVO' : 'INATIVO'}, Trades: ${reloadedWallet.trades.length}.`,
      };
    }
  );

  return results;
}

