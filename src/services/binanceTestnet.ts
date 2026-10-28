/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ATLASΩ Trader Intelligence - Binance Spot Testnet Service
 * 
 * REGRAS DE SEGURANÇA E RESTRIÇÕES:
 * 1. Usa EXCLUSIVAMENTE o endpoint REST oficial da Binance Spot Testnet: https://testnet.binance.vision/api
 * 2. NUNCA conecta à Binance de produção (https://api.binance.com e derivados são estritamente bloqueados).
 * 3. NUNCA envia ordens (POST /api/v3/order), cancelamentos ou qualquer requisição de escrita/execução.
 * 4. NUNCA armazena, solicita ou aceita chaves de API reais no frontend.
 * 5. Não mistura dados de mercado externos com a contabilidade da simulação local (R$ 10,00).
 */

export const BINANCE_TESTNET_BASE_URL = 'https://testnet.binance.vision/api';

/**
 * Constantes de Erro e Mensagens Conformes
 */
export const ERROR_BINANCE_TESTNET_RESTRICTED = 'BINANCE_TESTNET_RESTRICTED';
export const HTTP_451_USER_MESSAGE =
  'Binance Spot Testnet indisponível nesta conexão — HTTP 451. Consulte o suporte oficial';

// Lista de bloqueio estrito para impedir qualquer vazamento para a Binance de Produção
export const BLOCKED_PRODUCTION_DOMAINS = [
  'api.binance.com',
  'api1.binance.com',
  'api2.binance.com',
  'api3.binance.com',
  'api4.binance.com',
  'fapi.binance.com',
  'dapi.binance.com',
  'binance.com',
];

export type BinanceConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'symbol_unavailable'
  | 'restricted';

/**
 * Interface Desacoplada de Provedor de Dados de Mercado
 * Permite que o motor de simulação opere independentemente e possibilita
 * a integração futura com qualquer outro provedor de dados autorizado.
 */
export interface MarketDataProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly isExternal: boolean;
  checkConnectivity(): Promise<{ success: boolean; errorCode?: string; message: string }>;
  fetchPrice(symbol: string): Promise<{ price: number; timestamp: number } | null>;
}

export interface SymbolFilterLotSize {
  minQty: number;
  maxQty: number;
  stepSize: number;
}

export interface SymbolFilterPrice {
  minPrice: number;
  maxPrice: number;
  tickSize: number;
}

export interface SymbolFilterNotional {
  minNotional: number;
}

export interface SymbolExchangeInfo {
  symbol: string;
  status: string; // e.g., 'TRADING', 'BREAK'
  baseAsset: string;
  quoteAsset: string;
  isSpotAllowed: boolean;
  lotSizeFilter?: SymbolFilterLotSize;
  priceFilter?: SymbolFilterPrice;
  notionalFilter?: SymbolFilterNotional;
  rawFilters?: any[];
}

export interface PingResult {
  success: boolean;
  latencyMs: number;
  httpStatus?: number;
  errorCode?: string;
  error?: string;
}

export interface TimeSyncResult {
  success: boolean;
  serverTime?: number;
  timeOffsetMs?: number;
  httpStatus?: number;
  errorCode?: string;
  error?: string;
}

export interface ExchangeInfoValidationResult {
  available: boolean;
  reason: string;
  symbolInfo?: SymbolExchangeInfo;
  httpStatus?: number;
  errorCode?: string;
  rawResponseCode?: number;
}

export interface TestnetDiagnostics {
  state: BinanceConnectionState;
  environmentName: string;
  endpoint: string;
  lastPingLatencyMs?: number;
  lastTimeOffsetMs?: number;
  serverTime?: number;
  pendleAvailable: boolean;
  pendleStatusMessage: string;
  symbolInfo?: SymbolExchangeInfo;
  errorMessage?: string;
  errorCode?: string;
  httpStatusCode?: number;
  lastCheckedAt?: number;
  isOrderPlacementBlocked: boolean; // Sempre true
  isProductionEndpointBlocked: boolean; // Sempre true
}

/**
 * Validador de segurança de URLs: garante que nenhuma requisição aponte para a produção
 */
export function assertSafeTestnetUrl(url: string): void {
  for (const domain of BLOCKED_PRODUCTION_DOMAINS) {
    if (url.includes(domain) && !url.includes('testnet.binance.vision')) {
      throw new Error(`VIOLAÇÃO CRÍTICA DE SEGURANÇA: Tentativa de acesso ao endpoint de produção '${domain}'. Bloqueado pelo ATLASΩ.`);
    }
  }

  if (!url.startsWith(BINANCE_TESTNET_BASE_URL)) {
    throw new Error(`URL de destino inválida para a Testnet: '${url}'. Deve iniciar com '${BINANCE_TESTNET_BASE_URL}'.`);
  }
}

/**
 * Bloqueio de ordens e negociação na exchange:
 * Garante que a aplicação NUNCA tente postar ordens reais ou fictícias na Binance Testnet
 */
export function assertNoOrdersAllowed(): never {
  throw new Error('VIOLAÇÃO DE SEGURANÇA: O ATLASΩ opera em modo estrito de simulação local. Nenhuma ordem pode ser enviada à Binance Testnet ou Produção.');
}

export function isOrderPlacementAllowed(): boolean {
  return false;
}

/**
 * Executa ping no endpoint REST /v3/ping da Binance Spot Testnet
 */
export async function pingTestnet(
  fetchFn: typeof fetch = fetch,
  timeoutMs: number = 8000
): Promise<PingResult> {
  const targetUrl = `${BINANCE_TESTNET_BASE_URL}/v3/ping`;
  assertSafeTestnetUrl(targetUrl);

  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(targetUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Math.round(performance.now() - start);

    if (res.ok) {
      return { success: true, latencyMs, httpStatus: res.status };
    }

    let errorDetail = `HTTP ${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.msg) errorDetail = `${errorDetail}: ${data.msg}`;
    } catch {
      // Ignora erro ao parsear corpo de erro não-JSON
    }

    // Tratamento explícito de código 451 (Restrição de Elegibilidade/Localização Geográfica)
    if (res.status === 451) {
      return {
        success: false,
        latencyMs,
        httpStatus: 451,
        errorCode: ERROR_BINANCE_TESTNET_RESTRICTED,
        error: HTTP_451_USER_MESSAGE,
      };
    } else if (res.status === 429) {
      errorDetail = `Rate limit excedido (HTTP 429): Muitas requisições enviadas à Testnet.`;
    }

    return {
      success: false,
      latencyMs,
      httpStatus: res.status,
      error: errorDetail,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);

    if (err?.name === 'AbortError') {
      return {
        success: false,
        latencyMs,
        error: `Timeout na conexão com Binance Testnet (${timeoutMs}ms excedidos)`,
      };
    }

    return {
      success: false,
      latencyMs,
      error: `Falha na requisição de rede: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Consulta horário do servidor /v3/time e calcula desvio (offset)
 */
export async function checkServerTime(
  fetchFn: typeof fetch = fetch,
  timeoutMs: number = 8000
): Promise<TimeSyncResult> {
  const targetUrl = `${BINANCE_TESTNET_BASE_URL}/v3/time`;
  assertSafeTestnetUrl(targetUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const clientBefore = Date.now();

  try {
    const res = await fetchFn(targetUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const clientAfter = Date.now();

    if (!res.ok) {
      if (res.status === 451) {
        return {
          success: false,
          httpStatus: 451,
          errorCode: ERROR_BINANCE_TESTNET_RESTRICTED,
          error: HTTP_451_USER_MESSAGE,
        };
      }
      return { success: false, httpStatus: res.status, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    if (typeof data?.serverTime !== 'number') {
      return { success: false, error: 'Resposta inválida: serverTime não numérico' };
    }

    const serverTime = data.serverTime;
    const clientEstimatedTime = Math.round((clientBefore + clientAfter) / 2);
    const timeOffsetMs = serverTime - clientEstimatedTime;

    return {
      success: true,
      serverTime,
      timeOffsetMs,
      httpStatus: res.status,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      return { success: false, error: `Timeout ao consultar horário (${timeoutMs}ms)` };
    }
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Consulta e valida o símbolo na Binance Spot Testnet (ex: 'PENDLEUSDT')
 * Lê status, permissões SPOT e filtros obrigatórios (LOT_SIZE, PRICE_FILTER, MIN_NOTIONAL/NOTIONAL).
 */
export async function validateSymbolExchangeInfo(
  symbol: string = 'PENDLEUSDT',
  fetchFn: typeof fetch = fetch,
  timeoutMs: number = 8000
): Promise<ExchangeInfoValidationResult> {
  const normalizedSymbol = symbol.toUpperCase().trim();
  const targetUrl = `${BINANCE_TESTNET_BASE_URL}/v3/exchangeInfo?symbol=${encodeURIComponent(normalizedSymbol)}`;
  assertSafeTestnetUrl(targetUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(targetUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Se o símbolo não existir, a Binance retorna HTTP 400 com código -1121 "Invalid symbol."
    if (res.status === 400) {
      try {
        const errJson = await res.json();
        if (errJson?.code === -1121) {
          return {
            available: false,
            reason: `${normalizedSymbol} indisponível na Spot Testnet (código -1121: Símbolo não encontrado no catálogo da Testnet)`,
            httpStatus: 400,
            rawResponseCode: -1121,
          };
        }
      } catch {
        // Continua para erro genérico 400
      }
      return {
        available: false,
        reason: `${normalizedSymbol} indisponível na Spot Testnet (HTTP 400 - Requisição inválida)`,
        httpStatus: 400,
      };
    }

    if (res.status === 451) {
      return {
        available: false,
        reason: HTTP_451_USER_MESSAGE,
        httpStatus: 451,
        errorCode: ERROR_BINANCE_TESTNET_RESTRICTED,
      };
    }

    if (!res.ok) {
      return {
        available: false,
        reason: `Falha na consulta ao exchangeInfo: HTTP ${res.status} ${res.statusText}`,
        httpStatus: res.status,
      };
    }

    const data = await res.json();

    if (!data || !Array.isArray(data.symbols)) {
      return {
        available: false,
        reason: 'Resposta inválida da exchange: estrutura symbols ausente ou corrompida',
      };
    }

    const symbolData = data.symbols.find(
      (s: any) => s.symbol === normalizedSymbol
    );

    if (!symbolData) {
      return {
        available: false,
        reason: `${normalizedSymbol} indisponível na Spot Testnet (não listado no catálogo oficial da Testnet)`,
      };
    }

    // Verificar status e permissões
    const isTrading = symbolData.status === 'TRADING';
    const permissions: string[] = Array.isArray(symbolData.permissions)
      ? symbolData.permissions
      : Array.isArray(symbolData.permissionSets)
      ? symbolData.permissionSets.flat()
      : [];

    const isSpotAllowed =
      permissions.length === 0 || permissions.includes('SPOT') || symbolData.isSpotTradingAllowed === true;

    if (!isTrading) {
      return {
        available: false,
        reason: `${normalizedSymbol} presente na Testnet, porém com status '${symbolData.status}' (negociação suspensa)`,
        httpStatus: 200,
      };
    }

    // Extrair filtros reais da Binance
    const rawFilters: any[] = Array.isArray(symbolData.filters) ? symbolData.filters : [];
    let lotSizeFilter: SymbolFilterLotSize | undefined;
    let priceFilter: SymbolFilterPrice | undefined;
    let notionalFilter: SymbolFilterNotional | undefined;

    for (const filter of rawFilters) {
      if (filter.filterType === 'LOT_SIZE') {
        lotSizeFilter = {
          minQty: parseFloat(filter.minQty) || 0,
          maxQty: parseFloat(filter.maxQty) || 0,
          stepSize: parseFloat(filter.stepSize) || 0,
        };
      } else if (filter.filterType === 'PRICE_FILTER') {
        priceFilter = {
          minPrice: parseFloat(filter.minPrice) || 0,
          maxPrice: parseFloat(filter.maxPrice) || 0,
          tickSize: parseFloat(filter.tickSize) || 0,
        };
      } else if (filter.filterType === 'MIN_NOTIONAL' || filter.filterType === 'NOTIONAL') {
        notionalFilter = {
          minNotional: parseFloat(filter.minNotional || filter.notional) || 0,
        };
      }
    }

    const symbolInfo: SymbolExchangeInfo = {
      symbol: symbolData.symbol,
      status: symbolData.status,
      baseAsset: symbolData.baseAsset,
      quoteAsset: symbolData.quoteAsset,
      isSpotAllowed,
      lotSizeFilter,
      priceFilter,
      notionalFilter,
      rawFilters,
    };

    return {
      available: true,
      reason: `${normalizedSymbol} validado e ativo na Binance Spot Testnet (Status: TRADING)`,
      symbolInfo,
      httpStatus: 200,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      return {
        available: false,
        reason: `Timeout ao consultar exchangeInfo para ${normalizedSymbol} (${timeoutMs}ms)`,
      };
    }

    return {
      available: false,
      reason: `Erro na consulta da Testnet: ${err?.message || String(err)}`,
    };
  }
}

/**
 * Consulta cotação pública de mercado /v3/ticker/price (apenas leitura, sem chaves)
 */
export async function fetchTestnetPrice(
  symbol: string = 'PENDLEUSDT',
  fetchFn: typeof fetch = fetch,
  timeoutMs: number = 8000
): Promise<{ price: number; timestamp: number } | null> {
  const targetUrl = `${BINANCE_TESTNET_BASE_URL}/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
  assertSafeTestnetUrl(targetUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(targetUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const data = await res.json();
    const price = parseFloat(data?.price);
    if (isNaN(price) || price <= 0) return null;

    return {
      price,
      timestamp: Date.now(),
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Classe de Serviço Singleton para gerenciamento de estado no React
 */
class BinanceTestnetManager {
  private diagnostics: TestnetDiagnostics = {
    state: 'disconnected',
    environmentName: 'BINANCE SPOT TESTNET — AMBIENTE DE TESTE',
    endpoint: BINANCE_TESTNET_BASE_URL,
    pendleAvailable: false,
    pendleStatusMessage: 'Conexão ainda não iniciada. Simulador local ativo.',
    isOrderPlacementBlocked: true,
    isProductionEndpointBlocked: true,
  };

  private listeners: Set<(diag: TestnetDiagnostics) => void> = new Set();
  private isChecking: boolean = false;
  // Trava de segurança: impede repetição contínua de requisições quando bloqueado por HTTP 451
  private isRestricted: boolean = false;

  public getDiagnostics(): TestnetDiagnostics {
    return { ...this.diagnostics };
  }

  public isRestrictedLocation(): boolean {
    return this.isRestricted;
  }

  public subscribe(listener: (diag: TestnetDiagnostics) => void): () => void {
    this.listeners.add(listener);
    listener(this.getDiagnostics());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = this.getDiagnostics();
    this.listeners.forEach((l) => {
      try {
        l(snapshot);
      } catch (e) {
        console.error('Erro no listener de diagnóstico da Testnet:', e);
      }
    });
  }

  /**
   * Executa a verificação segura de conectividade.
   * REGRAS DE CONFORMIDADE:
   * - Quando HTTP 451 é detectado, registra "BINANCE_TESTNET_RESTRICTED".
   * - NÃO repete requisições continuamente (isRestricted bloqueia novas tentativas automáticas).
   * - NÃO alterna domínios nem usa proxies/VPNs.
   * - Interrompe imediatamente novas chamadas se restrito.
   */
  public async runFullDiagnostics(
    fetchFn: typeof fetch = fetch,
    manualForce: boolean = false
  ): Promise<TestnetDiagnostics> {
    // Se já estiver restrito por 451 e não for um clique manual explícito, não reenvia requisições
    if (this.isRestricted && !manualForce) {
      return this.getDiagnostics();
    }

    if (this.isChecking) return this.getDiagnostics();
    this.isChecking = true;

    this.diagnostics = {
      ...this.diagnostics,
      state: 'connecting',
      errorMessage: undefined,
      errorCode: undefined,
      lastCheckedAt: Date.now(),
    };
    this.notify();

    // 1. Ping defensivo
    const pingRes = await pingTestnet(fetchFn, 8000);

    // TRATAMENTO OBRIGATÓRIO DE HTTP 451 (Restrição Geográfica / Elegibilidade)
    if (pingRes.httpStatus === 451 || pingRes.errorCode === ERROR_BINANCE_TESTNET_RESTRICTED) {
      this.isRestricted = true; // Bloqueia repetições contínuas
      this.diagnostics = {
        ...this.diagnostics,
        state: 'restricted',
        lastPingLatencyMs: pingRes.latencyMs,
        httpStatusCode: 451,
        errorCode: ERROR_BINANCE_TESTNET_RESTRICTED,
        errorMessage: HTTP_451_USER_MESSAGE,
        pendleAvailable: false,
        pendleStatusMessage: HTTP_451_USER_MESSAGE,
        lastCheckedAt: Date.now(),
      };
      this.isChecking = false;
      this.notify();
      return this.getDiagnostics();
    }

    if (!pingRes.success) {
      this.diagnostics = {
        ...this.diagnostics,
        state: 'error',
        lastPingLatencyMs: pingRes.latencyMs,
        httpStatusCode: pingRes.httpStatus,
        errorCode: pingRes.errorCode,
        errorMessage: pingRes.error || 'Falha ao conectar com o endpoint da Testnet',
        pendleAvailable: false,
        pendleStatusMessage: 'Falha de conectividade com a Testnet. Simulador local permanece operando normalmente.',
        lastCheckedAt: Date.now(),
      };
      this.isChecking = false;
      this.notify();
      return this.getDiagnostics();
    }

    // Se respondeu com sucesso, desmarca a trava de restrição caso estivesse ativa
    this.isRestricted = false;

    // 2. Sincronização de horário
    const timeRes = await checkServerTime(fetchFn, 8000);
    if (timeRes.httpStatus === 451 || timeRes.errorCode === ERROR_BINANCE_TESTNET_RESTRICTED) {
      this.isRestricted = true;
      this.diagnostics = {
        ...this.diagnostics,
        state: 'restricted',
        httpStatusCode: 451,
        errorCode: ERROR_BINANCE_TESTNET_RESTRICTED,
        errorMessage: HTTP_451_USER_MESSAGE,
        pendleAvailable: false,
        pendleStatusMessage: HTTP_451_USER_MESSAGE,
        lastCheckedAt: Date.now(),
      };
      this.isChecking = false;
      this.notify();
      return this.getDiagnostics();
    }

    // 3. Validação do par PENDLEUSDT no exchangeInfo
    const symbolRes = await validateSymbolExchangeInfo('PENDLEUSDT', fetchFn, 8000);
    if (symbolRes.httpStatus === 451 || symbolRes.errorCode === ERROR_BINANCE_TESTNET_RESTRICTED) {
      this.isRestricted = true;
      this.diagnostics = {
        ...this.diagnostics,
        state: 'restricted',
        httpStatusCode: 451,
        errorCode: ERROR_BINANCE_TESTNET_RESTRICTED,
        errorMessage: HTTP_451_USER_MESSAGE,
        pendleAvailable: false,
        pendleStatusMessage: HTTP_451_USER_MESSAGE,
        lastCheckedAt: Date.now(),
      };
      this.isChecking = false;
      this.notify();
      return this.getDiagnostics();
    }

    let state: BinanceConnectionState = 'connected';
    if (!symbolRes.available) {
      state = 'symbol_unavailable';
    }

    this.diagnostics = {
      ...this.diagnostics,
      state,
      lastPingLatencyMs: pingRes.latencyMs,
      serverTime: timeRes.serverTime,
      lastTimeOffsetMs: timeRes.timeOffsetMs,
      httpStatusCode: symbolRes.httpStatus || pingRes.httpStatus,
      errorCode: symbolRes.errorCode,
      pendleAvailable: symbolRes.available,
      pendleStatusMessage: symbolRes.reason,
      symbolInfo: symbolRes.symbolInfo,
      errorMessage: symbolRes.available ? undefined : symbolRes.reason,
      lastCheckedAt: Date.now(),
    };

    this.isChecking = false;
    this.notify();
    return this.getDiagnostics();
  }
}

export const binanceTestnetService = new BinanceTestnetManager();

/**
 * Adaptador Provedor Binance Spot Testnet (Desacoplado)
 * Implementa a interface genérica MarketDataProvider
 */
export class BinanceTestnetProvider implements MarketDataProvider {
  readonly providerId = 'binance_spot_testnet';
  readonly providerName = 'Binance Spot Testnet (Ambiente de Teste)';
  readonly isExternal = true;

  async checkConnectivity(): Promise<{ success: boolean; errorCode?: string; message: string }> {
    const res = await pingTestnet();
    if (res.success) {
      return { success: true, message: 'Conectado à Binance Spot Testnet' };
    }
    return {
      success: false,
      errorCode: res.errorCode,
      message: res.error || 'Falha de conexão',
    };
  }

  async fetchPrice(symbol: string): Promise<{ price: number; timestamp: number } | null> {
    return fetchTestnetPrice(symbol);
  }
}

/**
 * Adaptador Provedor Simulador Local (Desacoplado)
 * Opera de forma autônoma sem dependência de serviços externos
 */
export class LocalSimulationMarketProvider implements MarketDataProvider {
  readonly providerId = 'local_simulation';
  readonly providerName = 'Simulador Local Autônomo ATLASΩ';
  readonly isExternal = false;

  async checkConnectivity(): Promise<{ success: boolean; errorCode?: string; message: string }> {
    return { success: true, message: 'Motor local ativo e saudável' };
  }

  async fetchPrice(symbol: string): Promise<{ price: number; timestamp: number } | null> {
    return null;
  }
}

export const binanceTestnetProvider = new BinanceTestnetProvider();
export const localSimulationProvider = new LocalSimulationMarketProvider();
