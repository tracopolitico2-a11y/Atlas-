/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ATLASΩ Trader Intelligence - Binance Spot Testnet Test Suite
 * Validação rigorosa de:
 * 1. Conectividade (ping)
 * 2. Sincronização de horário (/v3/time)
 * 3. Validação de par no exchangeInfo (PENDLEUSDT)
 * 4. Leitura dos filtros reais (LOT_SIZE, PRICE_FILTER, MIN_NOTIONAL)
 * 5. Tratamento de timeout e falhas (HTTP 451 restrição geográfica, HTTP 429 rate limit, 500)
 * 6. Símbolo ausente ou não suportado (código -1121)
 * 7. Bloqueio absoluto contra endpoints de produção (api.binance.com)
 * 8. Bloqueio absoluto de envio de ordens (POST /v3/order)
 * 9. Isolamento total: falhas da Testnet NÃO afetam saldo, trades ou regras de risco do simulador
 */

import {
  BINANCE_TESTNET_BASE_URL,
  assertSafeTestnetUrl,
  assertNoOrdersAllowed,
  isOrderPlacementAllowed,
  pingTestnet,
  checkServerTime,
  validateSymbolExchangeInfo,
  fetchTestnetPrice,
  binanceTestnetService,
  ERROR_BINANCE_TESTNET_RESTRICTED,
  HTTP_451_USER_MESSAGE,
  binanceTestnetProvider,
  localSimulationProvider,
} from '../src/services/binanceTestnet';

import {
  getDefaultWalletState,
  executeBuy,
  executeSell,
  calculateSimulationSummary,
} from '../src/core/tradingEngine';

console.log('======================================================================');
console.log('🛡️ ATLASΩ — SUÍTE DE TESTES: INTEGRAÇÃO SEGURA BINANCE SPOT TESTNET 🛡️');
console.log('======================================================================\n');

interface TestRecord {
  id: string;
  name: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

const records: TestRecord[] = [];

async function runTest(id: string, name: string, fn: () => Promise<{ passed: boolean; details: string }>) {
  const start = performance.now();
  try {
    const res = await fn();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    records.push({ id, name, passed: res.passed, details: res.details, durationMs });
    console.log(`${records.length}. ${res.passed ? '✅ [PASSOU]' : '❌ [FALHOU]'} ${id}: ${name} (${durationMs}ms)`);
    console.log(`   Detalhes: ${res.details}\n`);
  } catch (err: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    records.push({ id, name, passed: false, details: `Exceção: ${err?.message || String(err)}`, durationMs });
    console.log(`${records.length}. ❌ [FALHOU] ${id}: ${name} (${durationMs}ms)`);
    console.log(`   Detalhes: Exceção inesperada: ${err?.message || String(err)}\n`);
  }
}

// ==========================================
// BATERIA DE TESTES DE INTEGRAÇÃO TESTNET
// ==========================================

// 1. Bloqueio de Endpoints de Produção
await runTest('SEG-01', 'Bloqueio estrito de endpoints de produção da Binance', async () => {
  let blockedCount = 0;
  const dangerousUrls = [
    'https://api.binance.com/api/v3/ping',
    'https://api1.binance.com/api/v3/order',
    'https://fapi.binance.com/fapi/v1/ticker/price',
    'https://api.binance.com/api/v3/exchangeInfo',
  ];

  for (const url of dangerousUrls) {
    try {
      assertSafeTestnetUrl(url);
    } catch (e: any) {
      if (e.message.includes('VIOLAÇÃO CRÍTICA DE SEGURANÇA')) {
        blockedCount++;
      }
    }
  }

  // E a url da testnet deve passar
  let testnetApproved = false;
  try {
    assertSafeTestnetUrl('https://testnet.binance.vision/api/v3/ping');
    testnetApproved = true;
  } catch {
    testnetApproved = false;
  }

  const passed = blockedCount === dangerousUrls.length && testnetApproved;
  return {
    passed,
    details: `${blockedCount}/${dangerousUrls.length} URLs de produção interceptadas e bloqueadas. URL oficial da Testnet permitida: ${testnetApproved}`,
  };
});

// 2. Bloqueio Estrito de Envio de Ordens
await runTest('SEG-02', 'Bloqueio absoluto contra postagem de ordens ou negociações na exchange', async () => {
  let exceptionThrown = false;
  try {
    assertNoOrdersAllowed();
  } catch (e: any) {
    exceptionThrown = e.message.includes('VIOLAÇÃO DE SEGURANÇA');
  }

  const allowedFlag = isOrderPlacementAllowed();
  const passed = exceptionThrown && allowedFlag === false;

  return {
    passed,
    details: `assertNoOrdersAllowed() bloqueou com exceção de segurança: ${exceptionThrown}. isOrderPlacementAllowed(): ${allowedFlag} (Falso garantido).`,
  };
});

// 3. Ping da Testnet com Sucesso
await runTest('CON-01', 'Conectividade e latência com ping /v3/ping na Testnet (Mock 200 OK)', async () => {
  const mockFetch: typeof fetch = async (input, init) => {
    return new Response('{}', { status: 200, statusText: 'OK' });
  };

  const res = await pingTestnet(mockFetch, 5000);
  const passed = res.success && res.httpStatus === 200 && res.latencyMs >= 0;

  return {
    passed,
    details: `Ping executado com sucesso: HTTP ${res.httpStatus}, Latência aferida: ${res.latencyMs}ms`,
  };
});

// 4. Tratamento de Timeout na Conexão
await runTest('CON-02', 'Tratamento seguro de timeout na Testnet (AbortController)', async () => {
  const slowFetch: typeof fetch = async (input, init) => {
    return new Promise((resolve, reject) => {
      // Simula lentidão além do timeout
      const signal = init?.signal;
      if (signal) {
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }
    });
  };

  const res = await pingTestnet(slowFetch, 80); // 80ms timeout
  const passed = !res.success && !!res.error && res.error.includes('Timeout');

  return {
    passed,
    details: `Timeout interceptado com segurança sem travar a aplicação: "${res.error}"`,
  };
});

// 5. Tratamento de Falha de Rede e Restrição Geográfica (HTTP 451)
await runTest('CON-03', 'Tratamento de bloqueio geográfico (HTTP 451 Restricted Location)', async () => {
  const mock451Fetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        code: 0,
        msg: "Service unavailable from a restricted location according to 'b. Eligibility' in https://www.binance.com/en/terms.",
      }),
      { status: 451, statusText: 'Unavailable For Legal Reasons' }
    );
  };

  const res = await pingTestnet(mock451Fetch, 5000);
  const passed =
    !res.success &&
    res.httpStatus === 451 &&
    res.errorCode === ERROR_BINANCE_TESTNET_RESTRICTED &&
    res.error === HTTP_451_USER_MESSAGE;

  return {
    passed,
    details: `Código 451 tratado com errorCode="${res.errorCode}" e mensagem obrigatória: "${res.error}"`,
  };
});

// 6. Tratamento de Limite de Requisições (HTTP 429 Rate Limit)
await runTest('CON-04', 'Tratamento de Rate Limit da Testnet (HTTP 429)', async () => {
  const mock429Fetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({ code: -1003, msg: 'Too many requests; IP banned until 1720000000000.' }),
      { status: 429, statusText: 'Too Many Requests' }
    );
  };

  const res = await pingTestnet(mock429Fetch, 5000);
  const passed = !res.success && res.httpStatus === 429 && !!res.error && res.error.includes('Rate limit excedido');

  return {
    passed,
    details: `Rate limit 429 capturado e formatado: "${res.error}"`,
  };
});

// 7. Sincronização de Horário (/v3/time)
await runTest('TIME-01', 'Consulta de horário do servidor e cálculo de offset (/v3/time)', async () => {
  const now = Date.now();
  const mockTimeFetch: typeof fetch = async () => {
    return new Response(JSON.stringify({ serverTime: now + 150 }), { status: 200 });
  };

  const res = await checkServerTime(mockTimeFetch, 5000);
  const passed = res.success && typeof res.serverTime === 'number' && typeof res.timeOffsetMs === 'number';

  return {
    passed,
    details: `Horário do servidor Testnet: ${res.serverTime}, Offset calculado: ${res.timeOffsetMs}ms`,
  };
});

// 8. Resposta Inválida ou Corrompida no Horário
await runTest('TIME-02', 'Rejeição de resposta malformada ou sem serverTime numérico', async () => {
  const mockBadFetch: typeof fetch = async () => {
    return new Response(JSON.stringify({ status: 'unknown' }), { status: 200 });
  };

  const res = await checkServerTime(mockBadFetch, 5000);
  const passed = !res.success && !!res.error && res.error.includes('Resposta inválida');

  return {
    passed,
    details: `Resposta malformada rejeitada com segurança: "${res.error}"`,
  };
});

// 9. Validação do Par no exchangeInfo com Sucesso e Leitura dos Filtros
await runTest('INFO-01', 'Leitura dos filtros reais (LOT_SIZE, PRICE_FILTER, MIN_NOTIONAL) quando o par está ativo', async () => {
  const mockExchangeData = {
    timezone: 'UTC',
    serverTime: 1720000000000,
    symbols: [
      {
        symbol: 'PENDLEUSDT',
        status: 'TRADING',
        baseAsset: 'PENDLE',
        quoteAsset: 'USDT',
        permissions: ['SPOT'],
        filters: [
          {
            filterType: 'PRICE_FILTER',
            minPrice: '0.01000000',
            maxPrice: '1000.00000000',
            tickSize: '0.01000000',
          },
          {
            filterType: 'LOT_SIZE',
            minQty: '0.01000000',
            maxQty: '900000.00000000',
            stepSize: '0.01000000',
          },
          {
            filterType: 'NOTIONAL',
            minNotional: '5.00000000',
          },
        ],
      },
    ],
  };

  const mockFetch: typeof fetch = async () => {
    return new Response(JSON.stringify(mockExchangeData), { status: 200 });
  };

  const res = await validateSymbolExchangeInfo('PENDLEUSDT', mockFetch);
  const passed =
    res.available &&
    res.symbolInfo?.symbol === 'PENDLEUSDT' &&
    res.symbolInfo?.status === 'TRADING' &&
    res.symbolInfo?.lotSizeFilter?.minQty === 0.01 &&
    res.symbolInfo?.lotSizeFilter?.stepSize === 0.01 &&
    res.symbolInfo?.priceFilter?.tickSize === 0.01 &&
    res.symbolInfo?.notionalFilter?.minNotional === 5.0;

  return {
    passed,
    details: `Par validado! Filtros capturados: MinQty: ${res.symbolInfo?.lotSizeFilter?.minQty}, StepSize: ${res.symbolInfo?.lotSizeFilter?.stepSize}, MinNotional: ${res.symbolInfo?.notionalFilter?.minNotional} USDT`,
  };
});

// 10. Símbolo Ausente na Testnet (Código -1121 Invalid Symbol)
await runTest('INFO-02', 'Detecção de símbolo não listado na Testnet (Retorno oficial -1121)', async () => {
  const mockNotFoundFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({ code: -1121, msg: 'Invalid symbol.' }),
      { status: 400, statusText: 'Bad Request' }
    );
  };

  const res = await validateSymbolExchangeInfo('PENDLEUSDT', mockNotFoundFetch);
  const passed =
    !res.available &&
    res.httpStatus === 400 &&
    res.rawResponseCode === -1121 &&
    res.reason.includes('PENDLEUSDT indisponível na Spot Testnet');

  return {
    passed,
    details: `Resposta tratada conforme especificação: "${res.reason}"`,
  };
});

// 11. Símbolo com Status Não-Trading (ex: BREAK / HALT)
await runTest('INFO-03', 'Rejeição quando o par existe mas status não é TRADING (ex: BREAK)', async () => {
  const mockBreakData = {
    symbols: [
      {
        symbol: 'PENDLEUSDT',
        status: 'BREAK',
        baseAsset: 'PENDLE',
        quoteAsset: 'USDT',
        permissions: ['SPOT'],
        filters: [],
      },
    ],
  };

  const mockFetch: typeof fetch = async () => {
    return new Response(JSON.stringify(mockBreakData), { status: 200 });
  };

  const res = await validateSymbolExchangeInfo('PENDLEUSDT', mockFetch);
  const passed = !res.available && res.reason.includes("status 'BREAK'");

  return {
    passed,
    details: `Bloqueio correto para par suspenso: "${res.reason}"`,
  };
});

// 12. Isolamento Total: Falha na Testnet NÃO Altera Saldo nem Histórico da Simulação
await runTest('ISOL-01', 'Falha externa da Binance Testnet não altera saldo R$ 10 nem estado financeiro local', async () => {
  const initialWallet = getDefaultWalletState();
  const initialBalance = initialWallet.balanceBrl; // R$ 10.00
  const initialTradesCount = initialWallet.trades.length; // 0

  // Dispara diagnóstico com falha na Testnet
  const mockFailFetch: typeof fetch = async () => {
    throw new Error('Falha catastrófica de rede externa simulada');
  };

  const diag = await binanceTestnetService.runFullDiagnostics(mockFailFetch);

  // Executa uma compra local com o motor para garantir que o motor funciona de forma independente
  const { updatedWallet } = executeBuy(initialWallet, 0.1, 25.0, 5.60, Date.now());
  const summary = calculateSimulationSummary(updatedWallet, 25.0);

  const passed =
    diag.state === 'error' &&
    initialWallet.balanceBrl === 10.0 &&
    updatedWallet.balanceBrl < 10.0 &&
    updatedWallet.pendleAmount === 0.1 &&
    updatedWallet.trades.length === 1 &&
    summary.totalEquityBrl === 10.0 - 0.0025; // R$ 10 menos taxa R$ 0.0025

  return {
    passed,
    details: `Diagnóstico em estado 'error' não interferiu na simulação. Motor executou compra local: Saldo restante R$ ${updatedWallet.balanceBrl}, Custódia: ${updatedWallet.pendleAmount} PENDLE.`,
  };
});

// 13. Preservação de R$ 10 de Capital e Separação Visual Fictícia
await runTest('ISOL-02', 'Separação explícita entre SIMULAÇÃO LOCAL (R$ 10) e BINANCE SPOT TESTNET', async () => {
  const state = binanceTestnetService.getDiagnostics();
  const passed =
    state.environmentName === 'BINANCE SPOT TESTNET — AMBIENTE DE TESTE' &&
    state.isOrderPlacementBlocked === true &&
    state.isProductionEndpointBlocked === true;

  return {
    passed,
    details: `Ambiente identificado: "${state.environmentName}", Ordens bloqueadas: ${state.isOrderPlacementBlocked}, Produção bloqueada: ${state.isProductionEndpointBlocked}`,
  };
});

// 14. Registro de BINANCE_TESTNET_RESTRICTED e Bloqueio de Repetições Contínuas
await runTest('REST-01', 'Tratamento de HTTP 451: Registro exato de BINANCE_TESTNET_RESTRICTED e bloqueio de repetições contínuas', async () => {
  let requestCount = 0;
  const mock451Fetch: typeof fetch = async () => {
    requestCount++;
    return new Response(
      JSON.stringify({
        code: 0,
        msg: "Service unavailable from a restricted location according to 'b. Eligibility' in https://www.binance.com/en/terms.",
      }),
      { status: 451, statusText: 'Unavailable For Legal Reasons' }
    );
  };

  // Primeira execução com flag manual (simula inicialização)
  const diag = await binanceTestnetService.runFullDiagnostics(mock451Fetch, true);

  const isStateRestricted = diag.state === 'restricted';
  const isErrorCodeCorrect = diag.errorCode === ERROR_BINANCE_TESTNET_RESTRICTED;
  const isMessageCorrect = diag.errorMessage === HTTP_451_USER_MESSAGE;
  const isCode451 = diag.httpStatusCode === 451;
  const initialCount = requestCount;

  // Tentativa de execução automática de polling subsequente (sem manualForce)
  let extraCallsMade = 0;
  const trackingFetch: typeof fetch = async () => {
    extraCallsMade++;
    return new Response('{}', { status: 200 });
  };

  const secondDiag = await binanceTestnetService.runFullDiagnostics(trackingFetch, false);
  const stoppedPolling = extraCallsMade === 0; // Garantia de que NENHUMA requisição extra foi disparada

  const passed =
    isStateRestricted &&
    isErrorCodeCorrect &&
    isMessageCorrect &&
    isCode451 &&
    stoppedPolling &&
    binanceTestnetService.isRestrictedLocation();

  return {
    passed,
    details: `Estado: '${diag.state}', Código de erro: '${diag.errorCode}', Status: ${diag.httpStatusCode}, Mensagem: "${diag.errorMessage}". Repetição contínua bloqueada com segurança: ${stoppedPolling} (Zero requisições adicionais).`,
  };
});

// 15. Desacoplamento Arquitetural: Interface MarketDataProvider para Futuros Provedores Alternativos
await runTest('REST-02', 'Desacoplamento do Provedor de Dados: Suporte a múltiplos provedores via interface MarketDataProvider', async () => {
  const isBinanceExternal = binanceTestnetProvider.isExternal === true;
  const isLocalInternal = localSimulationProvider.isExternal === false;
  const binanceId = binanceTestnetProvider.providerId;
  const localId = localSimulationProvider.providerId;

  const localHealth = await localSimulationProvider.checkConnectivity();

  const passed =
    isBinanceExternal &&
    isLocalInternal &&
    binanceId === 'binance_spot_testnet' &&
    localId === 'local_simulation' &&
    localHealth.success === true;

  return {
    passed,
    details: `Provedores desacoplados implementam interface comum: Binance [${binanceId}, external=${isBinanceExternal}], Local [${localId}, external=${isLocalInternal}]. Motor de trading opera 100% independente.`,
  };
});

// 16. Garantia de Segurança: Nunca afirmar que a Binance está conectada durante restrição 451 e ordens desabilitadas
await runTest('REST-03', 'Garantia de segurança: Nunca afirmar que a Testnet está conectada durante restrição 451 e ordens desabilitadas', async () => {
  const currentDiag = binanceTestnetService.getDiagnostics();
  const notConnected = currentDiag.state !== 'connected';
  const ordersDisabled = !isOrderPlacementAllowed();

  let orderBlocked = false;
  try {
    assertNoOrdersAllowed();
  } catch {
    orderBlocked = true;
  }

  const passed = notConnected && ordersDisabled && orderBlocked;

  return {
    passed,
    details: `Estado atual: '${currentDiag.state}' (Não conectado garantido: ${notConnected}). Ordens proibidas: ${ordersDisabled}. Interceptação de ordens confirmada: ${orderBlocked}.`,
  };
});

// ==========================================
// RESUMO DA SUÍTE TESTNET
// ==========================================
console.log('----------------------------------------------------------------------');
const passedTotal = records.filter((r) => r.passed).length;
const failedTotal = records.filter((r) => !r.passed).length;

console.log(`TOTAL DE TESTES EXECUTADOS: ${records.length}`);
console.log(`TESTES APROVADOS: ${passedTotal}`);
console.log(`TESTES REPROVADOS: ${failedTotal}`);
console.log('----------------------------------------------------------------------');

if (failedTotal > 0) {
  console.error(`❌ FALHA: ${failedTotal} teste(s) da integração Testnet reprovados!`);
  process.exit(1);
} else {
  console.log(`🎉 TODOS OS ${passedTotal} TESTES DA INTEGRAÇÃO TESTNET FORAM APROVADOS COM SUCESSO!`);
  process.exit(0);
}
