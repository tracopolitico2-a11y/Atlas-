/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in font-mono text-xs">
      <div className="bg-[#101520] border border-rose-500/40 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
        <div className="bg-[#191624] px-4 py-3 border-b border-[#2a2238] flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-white text-sm">
              Confirmar Reinicialização da Simulação
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-slate-300">
            Esta ação irá:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
            <li>Restaurar o saldo em caixa para o capital inicial de <strong className="text-emerald-400">R$ 10,00</strong></li>
            <li>Zerar toda a custódia de PENDLE e o preço médio ponderado</li>
            <li>Limpar todo o histórico de operações simuladas do armazenamento local</li>
            <li>Restaurar os parâmetros de risco padrão (Perda Máx R$ 3,00, Exp. Máx 80%, Taxa 0.10%)</li>
          </ul>

          <div className="pt-3 border-t border-[#1e273a] flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg bg-[#141c2c] hover:bg-[#1a253a] border border-[#222c42] text-slate-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/30"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Sim, Resetar para R$ 10,00</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
