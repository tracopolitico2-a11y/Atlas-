/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ATLASΩ Trader Intelligence - Notification Service Test Suite
 * Validação de:
 * 1. Detecção de suporte à Notification API
 * 2. Leitura e alteração de preferências locais (localStorage)
 * 3. Formatação correta das notificações para alertas de preço
 * 4. Tratamento defensivo em ambientes sem suporte ou sem permissão
 */

import { notificationService, LOCAL_STORAGE_NOTIFICATION_KEY } from '../src/services/notificationService';
import { PriceAlert } from '../src/types/trading';

console.log('======================================================================');
console.log('🔔 ATLASΩ — SUÍTE DE TESTES: NOTIFICATION API NATIVA (SEGUNDO PLANO) 🔔');
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

// 1. Detecção e Comportamento Sem Crash em Node/Server
await runTest('NOTIF-01', 'Comportamento seguro em ambiente sem Notification global (Node.js/SSR)', async () => {
  const isSupported = notificationService.checkSupport();
  const perm = notificationService.getPermission();
  const isEnabled = notificationService.isEnabled();

  // No Node.js puro sem window.Notification, deve retornar false e 'unsupported' sem lançar erro
  const passed = isSupported === false && perm === 'unsupported' && isEnabled === false;

  return {
    passed,
    details: `checkSupport(): ${isSupported}, getPermission(): '${perm}', isEnabled(): ${isEnabled}. Sem crash.`,
  };
});

// 2. Mock do Ambiente de Navegador com Notification API
await runTest('NOTIF-02', 'Disparo e formatação correta de alerta de preço com Notification Mock', async () => {
  let createdNotification: { title: string; options: any } | null = null;

  // Criar mock global do Notification
  class MockNotification {
    static permission: string = 'granted';
    static requestPermission = async () => 'granted';
    title: string;
    options: any;
    onclick: any = null;

    constructor(title: string, options: any) {
      this.title = title;
      this.options = options;
      createdNotification = { title, options };
    }

    close() {}
  }

  (global as any).window = {
    Notification: MockNotification,
    focus: () => {},
  };
  (global as any).Notification = MockNotification;

  // Testar envio de notificação com alerta de alta
  const alert: PriceAlert = {
    id: 'alert-test-1',
    targetPriceBrl: 28.50,
    condition: 'ABOVE_OR_EQUAL',
    soundType: 'CHIME',
    note: 'Rompimento de Resistência',
    isActive: true,
    isTriggered: false,
  };

  const sent = notificationService.sendAlertNotification(alert, 28.75);

  const passed =
    sent === true &&
    createdNotification !== null &&
    createdNotification.title.includes('Alerta PENDLE/BRL: R$ 28.75') &&
    createdNotification.options.body.includes('Rompimento de Resistência') &&
    createdNotification.options.body.includes('≥ R$ 28.50') &&
    createdNotification.options.tag === 'atlas-alert-alert-test-1';

  return {
    passed,
    details: `Notificação enviada: ${sent}. Título: "${createdNotification?.title}". Tag: "${createdNotification?.options?.tag}".`,
  };
});

// 3. Controle e Persistência de Ativação do Usuário (setEnabled)
await runTest('NOTIF-03', 'Controle de toggle de notificações e respeito a desativação', async () => {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  };

  notificationService.setEnabled(false);
  const disabledState = notificationService.isEnabled();

  notificationService.setEnabled(true);
  const enabledState = notificationService.isEnabled();

  const passed = disabledState === false && enabledState === true;

  return {
    passed,
    details: `Toggle verificado: desabilitado=${!disabledState}, reabilitado=${enabledState}. Armazenado em localStorage: ${store[LOCAL_STORAGE_NOTIFICATION_KEY]}.`,
  };
});

// 4. Teste de Notificação de Teste (sendTestNotification)
await runTest('NOTIF-04', 'Disparo de notificação de teste para validação do usuário', async () => {
  const testSent = notificationService.sendTestNotification();

  const passed = testSent === true;

  return {
    passed,
    details: `sendTestNotification() disparou com sucesso: ${testSent}.`,
  };
});

// ==========================================
// RESUMO DA SUÍTE NOTIFICAÇÃO
// ==========================================
console.log('----------------------------------------------------------------------');
const passedTotal = records.filter((r) => r.passed).length;
const failedTotal = records.filter((r) => !r.passed).length;

console.log(`TOTAL DE TESTES EXECUTADOS: ${records.length}`);
console.log(`TESTES APROVADOS: ${passedTotal}`);
console.log(`TESTES REPROVADOS: ${failedTotal}`);
console.log('----------------------------------------------------------------------');

if (failedTotal > 0) {
  console.error(`❌ FALHA: ${failedTotal} teste(s) de notificação reprovados!`);
  process.exit(1);
} else {
  console.log(`🎉 TODOS OS ${passedTotal} TESTES DE NOTIFICAÇÃO FORAM APROVADOS!`);
  process.exit(0);
}
