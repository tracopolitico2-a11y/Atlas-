/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ATLASΩ Trader Intelligence - Notification Service
 * Gerenciador da Web Notification API para alertas em segundo plano
 */

import { PriceAlert } from '../types/trading';

export type BrowserNotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export const LOCAL_STORAGE_NOTIFICATION_KEY = 'atlas_omega_native_notifications_enabled';

class NativeNotificationService {
  /**
   * Verifica dinamicamente se o ambiente atual suporta a API de Notificações
   */
  public checkSupport(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Obtém o status atual de permissão do navegador
   */
  public getPermission(): BrowserNotificationPermission {
    if (!this.checkSupport()) return 'unsupported';
    try {
      return Notification.permission as BrowserNotificationPermission;
    } catch {
      return 'unsupported';
    }
  }

  /**
   * Verifica se o usuário permitiu o envio nas preferências locais
   */
  public isEnabled(): boolean {
    if (!this.checkSupport()) return false;
    if (this.getPermission() !== 'granted') return false;

    try {
      if (typeof localStorage === 'undefined') return true;
      const stored = localStorage.getItem(LOCAL_STORAGE_NOTIFICATION_KEY);
      if (stored === null) return true; // Habilitado por padrão se já concedido
      return stored === 'true';
    } catch {
      return true;
    }
  }

  /**
   * Salva a preferência de ativação/desativação de notificações
   */
  public setEnabled(enabled: boolean): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_NOTIFICATION_KEY, enabled ? 'true' : 'false');
      }
    } catch (e) {
      console.warn('Erro ao salvar preferência de notificação no localStorage:', e);
    }
  }

  /**
   * Solicita permissão nativa ao usuário via navegador
   */
  public async requestPermission(): Promise<BrowserNotificationPermission> {
    if (!this.isSupported) {
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        this.setEnabled(true);
      }
      return result as BrowserNotificationPermission;
    } catch (err) {
      console.warn('Erro ao solicitar permissão de notificação:', err);
      return this.getPermission();
    }
  }

  /**
   * Envia uma notificação nativa para um alerta disparado
   */
  public sendAlertNotification(alert: PriceAlert, currentPriceBrl: number): boolean {
    if (!this.isEnabled()) return false;

    const conditionText = alert.condition === 'ABOVE_OR_EQUAL' ? '≥' : '≤';
    const title = `🚨 Alerta PENDLE/BRL: R$ ${currentPriceBrl.toFixed(2)}`;
    const body = `${alert.note || 'Meta de preço atingida'}\nAlvo: ${conditionText} R$ ${alert.targetPriceBrl.toFixed(2)} (Cotação atual: R$ ${currentPriceBrl.toFixed(2)})`;

    try {
      const notification = new Notification(title, {
        body,
        tag: `atlas-alert-${alert.id}`,
        renotify: true,
        silent: alert.soundType === 'MUTED',
        icon: '/favicon.ico',
      });

      notification.onclick = () => {
        try {
          window.focus();
        } catch {
          // Ignora se bloqueado pelo navegador
        }
        notification.close();
      };

      return true;
    } catch (err) {
      console.warn('Erro ao disparar Notification API:', err);
      return false;
    }
  }

  /**
   * Envia uma notificação de teste para verificar se o sistema operacional e navegador estão recebendo
   */
  public sendTestNotification(): boolean {
    if (!this.isEnabled()) return false;

    try {
      const notification = new Notification('🔔 ATLASΩ Trader Intelligence', {
        body: 'Notificações nativas ativas! Você receberá avisos mesmo com a aba em segundo plano.',
        tag: 'atlas-test-notification',
        renotify: true,
        icon: '/favicon.ico',
      });

      notification.onclick = () => {
        try {
          window.focus();
        } catch {}
        notification.close();
      };

      return true;
    } catch (err) {
      console.warn('Erro ao enviar notificação de teste:', err);
      return false;
    }
  }
}

export const notificationService = new NativeNotificationService();
