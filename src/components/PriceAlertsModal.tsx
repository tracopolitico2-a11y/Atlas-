/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PriceAlert } from '../types/trading';
import { soundEffects, AlertSoundType } from '../services/soundEffects';
import {
  notificationService,
  BrowserNotificationPermission
} from '../services/notificationService';
import {
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Check,
  X,
  Play,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Radio
} from 'lucide-react';

interface PriceAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: PriceAlert[];
  currentPriceBrl: number;
  onAddAlert: (newAlert: Omit<PriceAlert, 'id' | 'isTriggered'>) => void;
  onToggleAlert: (id: string) => void;
  onDeleteAlert: (id: string) => void;
  onResetTriggered: (id: string) => void;
}

export const PriceAlertsModal: React.FC<PriceAlertsModalProps> = ({
  isOpen,
  onClose,
  alerts,
  currentPriceBrl,
  onAddAlert,
  onToggleAlert,
  onDeleteAlert,
  onResetTriggered,
}) => {
  const [targetPriceInput, setTargetPriceInput] = useState<string>(
    (currentPriceBrl * 1.05).toFixed(2)
  );
  const [condition, setCondition] = useState<'ABOVE_OR_EQUAL' | 'BELOW_OR_EQUAL'>('ABOVE_OR_EQUAL');
  const [soundType, setSoundType] = useState<AlertSoundType>('CHIME');
  const [note, setNote] = useState<string>('');
  const [autoReset, setAutoReset] = useState<boolean>(false);

  // Estados da Web Notification API
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationPermission>(() =>
    notificationService.getPermission()
  );
  const [isNativeEnabled, setIsNativeEnabled] = useState<boolean>(() =>
    notificationService.isEnabled()
  );
  const [testNotificationSent, setTestNotificationSent] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setNotificationPermission(notificationService.getPermission());
      setIsNativeEnabled(notificationService.isEnabled());
    }
  }, [isOpen]);

  const handleRequestNotificationPermission = async () => {
    const perm = await notificationService.requestPermission();
    setNotificationPermission(perm);
    setIsNativeEnabled(notificationService.isEnabled());
  };

  const handleToggleNativeNotifications = () => {
    const next = !isNativeEnabled;
    notificationService.setEnabled(next);
    setIsNativeEnabled(next);
  };

  const handleTestNativeNotification = () => {
    const ok = notificationService.sendTestNotification();
    if (ok) {
      setTestNotificationSent(true);
      setTimeout(() => setTestNotificationSent(false), 3500);
    }
  };

  if (!isOpen) return null;

  const handleTestSound = (type: AlertSoundType) => {
    soundEffects.play(type);
  };

  const handleQuickPercent = (pct: number) => {
    const calculated = currentPriceBrl * (1 + pct / 100);
    setTargetPriceInput(calculated.toFixed(2));
    if (pct > 0) {
      setCondition('ABOVE_OR_EQUAL');
      if (!note) setNote(`Alvo de Alta (+${pct}%)`);
    } else {
      setCondition('BELOW_OR_EQUAL');
      if (!note) setNote(`Suporte de Queda (${pct}%)`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(targetPriceInput.replace(',', '.'));
    if (isNaN(price) || price <= 0) return;

    onAddAlert({
      targetPriceBrl: price,
      condition,
      soundType,
      note: note.trim() || (condition === 'ABOVE_OR_EQUAL' ? `Alvo R$ ${price.toFixed(2)}` : `Suporte R$ ${price.toFixed(2)}`),
      isActive: true,
      autoReset,
    });

    setNote('');
    // Reseta para novo alvo sugerido
    setTargetPriceInput((currentPriceBrl * 1.05).toFixed(2));
  };

  const activeAlerts = alerts.filter((a) => !a.isTriggered && a.isActive);
  const triggeredAlerts = alerts.filter((a) => a.isTriggered);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in font-mono text-xs">
      <div className="bg-[#0e131d] border border-[#222c42] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-[#131a28] px-4 py-3 border-b border-[#222c42] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-amber-400 animate-pulse" />
            <div>
              <h3 className="font-bold text-white text-sm">
                Sistema de Alertas Sonoros e Notificações Nativas
              </h3>
              <p className="text-[11px] text-slate-400">
                Disparos em tempo real com suporte a abas em segundo plano no navegador
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1f2940]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Card de Notificações Nativas do Navegador (Segundo Plano) */}
          <div className="bg-[#101623] border border-cyan-900/50 rounded-xl p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    Notificações Nativas do Navegador
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50 font-normal">
                      Notification API
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Receba avisos instantâneos mesmo com a aba em segundo plano ou minimizada
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="text-right">
                {notificationPermission === 'granted' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-600/50">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    AUTORIZADO
                  </span>
                ) : notificationPermission === 'denied' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-600/50">
                    <XCircle className="w-3 h-3 text-rose-400" />
                    BLOQUEADO
                  </span>
                ) : notificationPermission === 'unsupported' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    NÃO SUPORTADO
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-600/50">
                    PENDENTE
                  </span>
                )}
              </div>
            </div>

            {/* Ações e Controles de Permissão */}
            <div className="bg-[#0b0f17] p-2.5 rounded-lg border border-[#1d273a] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
              {notificationPermission === 'granted' ? (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enableNativeNotifications"
                      checked={isNativeEnabled}
                      onChange={handleToggleNativeNotifications}
                      className="w-4 h-4 rounded bg-[#0a0e16] border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="enableNativeNotifications" className="text-slate-300 cursor-pointer text-[11px] font-medium">
                      Disparar notificações do sistema operacional ao atingir alvos
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestNativeNotification}
                    disabled={!isNativeEnabled}
                    className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                      testNotificationSent
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                        : isNativeEnabled
                        ? 'bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border-cyan-700/60'
                        : 'opacity-40 cursor-not-allowed bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    <Send className="w-3 h-3" />
                    <span>{testNotificationSent ? 'Enviado!' : 'Testar Notificação'}</span>
                  </button>
                </>
              ) : notificationPermission === 'denied' ? (
                <div className="text-rose-300/90 text-[10.5px] leading-tight flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    As notificações estão bloqueadas nas preferências do seu navegador. Para reativar, clique no cadeado da barra de navegação e altere "Notificações" para "Permitir".
                  </span>
                </div>
              ) : notificationPermission === 'unsupported' ? (
                <div className="text-slate-400 text-[10.5px]">
                  Este ambiente ou navegador não disponibiliza a API Notification nativa.
                </div>
              ) : (
                <>
                  <span className="text-slate-300 text-[10.5px]">
                    Permita notificações para receber avisos instantâneos mesmo quando estiver em outras abas.
                  </span>
                  <button
                    type="button"
                    onClick={handleRequestNotificationPermission}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-md shadow-cyan-600/30 active:scale-95"
                  >
                    <BellRing className="w-3 h-3" />
                    <span>Habilitar Notificações</span>
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Formulário de Novo Alerta */}
          <form
            onSubmit={handleSubmit}
            className="bg-[#121824] border border-[#222c42] rounded-xl p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-[#1c2538] pb-2">
              <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                Criar Novo Alerta Customizado
              </span>
              <span className="text-[11px] text-slate-400">
                Preço Atual: <strong className="text-cyan-400">R$ {currentPriceBrl.toFixed(2)}</strong>
              </span>
            </div>

            {/* Atalhos Rápidos */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500">Atalhos rápidos:</span>
              {[-10, -5, -2, 2, 5, 10].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleQuickPercent(pct)}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                    pct > 0
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/60'
                      : 'bg-rose-950/40 text-rose-400 border-rose-800/40 hover:bg-rose-900/60'
                  }`}
                >
                  {pct > 0 ? `+${pct}%` : `${pct}%`}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Preço Alvo */}
              <div>
                <label className="block text-slate-400 text-[10px] uppercase mb-1">
                  Preço Alvo (R$):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500 text-xs">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={targetPriceInput}
                    onChange={(e) => setTargetPriceInput(e.target.value)}
                    className="w-full bg-[#0a0e16] border border-[#26334d] focus:border-cyan-500 rounded-lg py-1.5 pl-8 pr-3 text-sm font-mono text-white focus:outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {/* Condição de Disparo */}
              <div>
                <label className="block text-slate-400 text-[10px] uppercase mb-1">
                  Disparar Quando:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCondition('ABOVE_OR_EQUAL')}
                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                      condition === 'ABOVE_OR_EQUAL'
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-500'
                        : 'bg-[#0a0e16] border-[#222c42] text-slate-400'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Preço ≥ Alvo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCondition('BELOW_OR_EQUAL')}
                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                      condition === 'BELOW_OR_EQUAL'
                        ? 'bg-rose-950 text-rose-400 border-rose-500'
                        : 'bg-[#0a0e16] border-[#222c42] text-slate-400'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Preço ≤ Alvo</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Efeito Sonoro */}
            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1">
                Efeito Sonoro (Sintetizador Web Audio):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {(
                  [
                    { type: 'CHIME', label: 'Chime Suave' },
                    { type: 'BEEP', label: 'Beep Duplo' },
                    { type: 'RADAR', label: 'Pulso Radar' },
                    { type: 'SIREN', label: 'Sirene Alerta' },
                    { type: 'MUTED', label: 'Mudo / Silencioso' },
                  ] as const
                ).map((s) => (
                  <div
                    key={s.type}
                    className={`flex items-center justify-between p-1.5 rounded-lg border transition-all ${
                      soundType === s.type
                        ? 'bg-cyan-950/70 border-cyan-500 text-white font-bold'
                        : 'bg-[#0a0e16] border-[#222c42] text-slate-400'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSoundType(s.type)}
                      className="flex-1 text-left text-[10px] truncate"
                    >
                      {s.label}
                    </button>
                    {s.type !== 'MUTED' && (
                      <button
                        type="button"
                        onClick={() => handleTestSound(s.type)}
                        className="p-1 rounded text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/40 ml-1"
                        title="Ouvir teste sonoro"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Rótulo / Nota do Alerta */}
            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1">
                Nota do Alerta (Opcional):
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: Ponto de realização parcial, Stop técnico, Rompimento..."
                className="w-full bg-[#0a0e16] border border-[#26334d] focus:border-cyan-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/20 active:scale-[0.99] transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Ativar Alerta</span>
            </button>
          </form>

          {/* Lista de Alertas Ativos e Disparados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-300 font-bold text-xs">
              <span className="flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-cyan-400" />
                Alertas Cadastrados ({alerts.length})
              </span>
              <span className="text-[10px] text-slate-400">
                {activeAlerts.length} ativos • {triggeredAlerts.length} disparados
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="text-center py-6 text-slate-500 bg-[#121824]/50 rounded-xl border border-[#1b2336]">
                <Bell className="w-6 h-6 text-slate-600 mx-auto mb-1 opacity-50" />
                <p>Nenhum alerta cadastrado no momento.</p>
                <p className="text-[10px] text-slate-600">
                  Crie um alerta acima para receber notificações sonoras e visuais imediatas.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {alerts.map((alert) => {
                  const isAbove = alert.condition === 'ABOVE_OR_EQUAL';
                  return (
                    <div
                      key={alert.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        alert.isTriggered
                          ? 'bg-amber-950/40 border-amber-500/50'
                          : alert.isActive
                          ? 'bg-[#121824] border-[#222c42]'
                          : 'bg-[#0b0e14] border-[#182030] opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            alert.isTriggered
                              ? 'bg-amber-500 text-slate-950 font-black animate-pulse'
                              : isAbove
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {alert.isTriggered ? (
                            <BellRing className="w-4 h-4" />
                          ) : isAbove ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">
                              {isAbove ? '≥' : '≤'} R$ {alert.targetPriceBrl.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400 bg-[#0a0e16] px-1.5 py-0.2 rounded border border-[#1c2436]">
                              Som: {alert.soundType}
                            </span>
                            {alert.isTriggered && (
                              <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded">
                                DISPARADO EM R$ {alert.triggeredPrice?.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-300">{alert.note}</p>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1.5">
                        {alert.isTriggered ? (
                          <button
                            onClick={() => onResetTriggered(alert.id)}
                            className="px-2 py-1 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-600/50 text-[10px] flex items-center gap-1 font-bold transition-colors"
                            title="Reativar este alerta"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reativar</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onToggleAlert(alert.id)}
                            className={`px-2 py-1 rounded text-[10px] border font-bold transition-colors ${
                              alert.isActive
                                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            {alert.isActive ? 'Ativo' : 'Pausado'}
                          </button>
                        )}

                        <button
                          onClick={() => onDeleteAlert(alert.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition-colors"
                          title="Excluir alerta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="bg-[#121824] px-4 py-2.5 border-t border-[#1f293d] flex items-center justify-between text-slate-400 text-[11px]">
          <span>Alertas salvos automaticamente em cache local.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
