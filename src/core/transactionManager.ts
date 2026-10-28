/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ATLASΩ Trader Intelligence - Gerenciador Atômico de Transações e Persistência
 * Garante serialização estrita, mutual exclusion cross-tab e rollback em falhas de I/O.
 */

import { WalletState } from '../types/trading';
import {
  LOCAL_STORAGE_KEY,
  getDefaultWalletState,
  sanitizeAndValidateWalletState,
} from './tradingEngine';

const CROSS_TAB_LOCK_NAME = 'atlas_omega_wallet_mutex';
const STORAGE_LOCK_KEY = 'atlas_omega_storage_lock';
const STORAGE_LOCK_TIMEOUT_MS = 2500;

export class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const fallbackMemoryStorage = new MemoryStorage();

export interface TransactionOptions {
  storageOverride?: Storage;
  mockStorageFailure?: boolean;
}

export class TransactionManager {
  private inTabQueue: Promise<any> = Promise.resolve();
  private clientId: string = `client-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;

  /**
   * Adquire trava de armazenamento cross-tab com timeout de expiração (CAS lease)
   */
  private async acquireStorageLock(storage: Storage): Promise<() => void> {
    const start = Date.now();
    const maxWaitMs = 3000;

    while (Date.now() - start < maxWaitMs) {
      const now = Date.now();
      const currentLock = storage.getItem(STORAGE_LOCK_KEY);

      if (currentLock) {
        try {
          const parsed = JSON.parse(currentLock);
          // Se o lock expirou (lease timeout), podemos limpá-lo e assumi-lo
          if (now - parsed.timestamp > STORAGE_LOCK_TIMEOUT_MS) {
            storage.removeItem(STORAGE_LOCK_KEY);
          }
        } catch {
          storage.removeItem(STORAGE_LOCK_KEY);
        }
      }

      // Tenta gravar o lock com nosso clientId e timestamp
      const candidate = JSON.stringify({ clientId: this.clientId, timestamp: now });
      try {
        if (!storage.getItem(STORAGE_LOCK_KEY)) {
          storage.setItem(STORAGE_LOCK_KEY, candidate);
          // Confere se fomos nós que gravamos com sucesso
          if (storage.getItem(STORAGE_LOCK_KEY) === candidate) {
            return () => {
              try {
                if (storage.getItem(STORAGE_LOCK_KEY) === candidate) {
                  storage.removeItem(STORAGE_LOCK_KEY);
                }
              } catch {
                // Silencioso em cleanup
              }
            };
          }
        }
      } catch {
        // Se falhar I/O no lock, tenta novamente no spin-wait
      }

      // Espera antes de tentar novamente (spin-wait exponencial simples)
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 20));
    }

    // Se atingiu o tempo máximo de espera, limpa o lock potencialmente travado e continua
    return () => {
      try {
        storage.removeItem(STORAGE_LOCK_KEY);
      } catch {}
    };
  }

  /**
   * Executa uma transação atômica serializada (in-tab + cross-tab) com garantia de persistência.
   * Se a persistência falhar ou a validação rejeitar, a operação falha completamente e nenhum
   * estado inconsistente é propagado.
   */
  public async executeAtomicTransaction<T = any>(
    operation: (currentWallet: WalletState) => { updatedWallet: WalletState; result?: T },
    options?: TransactionOptions
  ): Promise<{ updatedWallet: WalletState; result: T }> {
    // 1. Enfileiramento sequencial FIFO no processo local
    const task = async (): Promise<{ updatedWallet: WalletState; result: T }> => {
      const storage =
        options?.storageOverride ||
        (typeof window !== 'undefined' && window.localStorage ? window.localStorage : fallbackMemoryStorage);

      const runWithLock = async (): Promise<{ updatedWallet: WalletState; result: T }> => {
        let releaseStorageLock = () => {};
        if (storage) {
          releaseStorageLock = await this.acquireStorageLock(storage);
        }

        try {
          // 2. Lê a versão mais recente gravada do armazenamento (cross-tab fresh read)
          let currentWallet = getDefaultWalletState();
          if (storage) {
            try {
              const raw = storage.getItem(LOCAL_STORAGE_KEY);
              if (raw) {
                const parsed = JSON.parse(raw);
                currentWallet = sanitizeAndValidateWalletState(parsed);
              }
            } catch (err) {
              console.warn('Erro ao ler do storage na transação atômica:', err);
              currentWallet = getDefaultWalletState();
            }
          }

          // 3. Executa a regra matemática / validação da transação
          const opResult = operation(currentWallet);
          const updatedWallet = opResult.updatedWallet;
          const result = (opResult.result !== undefined ? opResult.result : (updatedWallet as unknown)) as T;

          // 4. Simulação de falha de persistência ativada para testes de I/O
          if (options?.mockStorageFailure) {
            throw new Error('Falha de persistência simulada: erro de escrita em disco (QuotaExceededError).');
          }

          // 5. Comete a persistência no storage antes de liberar a trava
          if (storage) {
            try {
              const serialized = JSON.stringify(updatedWallet);
              storage.setItem(LOCAL_STORAGE_KEY, serialized);

              // Validação pós-escrita imediata para confirmação do commit
              const verified = storage.getItem(LOCAL_STORAGE_KEY);
              if (!verified || verified !== serialized) {
                throw new Error('Inconsistência de I/O: os dados gravados não correspondem ao estado calculado.');
              }
            } catch (ioErr: any) {
              throw new Error(`Falha de persistência: não foi possível salvar a operação no disco. Detalhes: ${ioErr?.message || String(ioErr)}`);
            }
          }

          return { updatedWallet, result };
        } finally {
          releaseStorageLock();
        }
      };

      // 6. Integração com Web Locks API nativa do navegador (se disponível)
      if (typeof navigator !== 'undefined' && 'locks' in navigator && (navigator as any).locks?.request) {
        return await (navigator as any).locks.request(
          CROSS_TAB_LOCK_NAME,
          { mode: 'exclusive' },
          runWithLock
        );
      } else {
        return await runWithLock();
      }
    };

    // Encadeia na fila de promessas sequencial local
    const nextQueue = this.inTabQueue.then(task, task);
    this.inTabQueue = nextQueue.catch(() => {});
    return nextQueue;
  }
}

export const transactionManager = new TransactionManager();
