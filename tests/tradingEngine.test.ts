/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ATLASΩ Trader Intelligence - Terminal CLI Test Suite
 */

import { runTradingEngineTests } from '../src/core/testRunner';

console.log('===============================================================');
console.log('⚡ ATLASΩ TRADER INTELLIGENCE — SUÍTE DE TESTES AUTOMATIZADOS ⚡');
console.log('===============================================================');
console.log('Executando bateria de testes para regras de simulação e risco...\n');

const results = await runTradingEngineTests();

let passedCount = 0;
let failedCount = 0;

results.forEach((test, idx) => {
  const status = test.passed ? '✅ [PASSOU]' : '❌ [FALHOU]';
  if (test.passed) {
    passedCount++;
  } else {
    failedCount++;
  }

  console.log(`${idx + 1}. ${status} [${test.category}] ${test.title} (${test.executionTimeMs}ms)`);
  console.log(`   Descrição: ${test.description}`);
  console.log(`   Detalhes:  ${test.details}\n`);
});

console.log('---------------------------------------------------------------');
console.log(`RESUMO DA EXECUÇÃO:`);
console.log(`Total de testes: ${results.length}`);
console.log(`Testes Aprovados: ${passedCount}`);
console.log(`Testes Reprovados: ${failedCount}`);
console.log('---------------------------------------------------------------');

if (failedCount > 0) {
  console.error(`❌ ALERTA: ${failedCount} teste(s) falharam!`);
  process.exit(1);
} else {
  console.log(`🎉 TODOS OS ${passedCount} TESTES FORAM APROVADOS COM SUCESSO!`);
  process.exit(0);
}
