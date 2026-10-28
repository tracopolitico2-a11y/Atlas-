/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Trade, OrderType } from '../types/trading';
import {
  History,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter,
  Receipt,
  Clock,
  Check
} from 'lucide-react';

interface TradeHistoryTableProps {
  trades: Trade[];
}

export const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({ trades }) => {
  const [filterType, setFilterType] = useState<'ALL' | OrderType>('ALL');
  const [copied, setCopied] = useState<boolean>(false);

  const filteredTrades = trades.filter((t) => {
    if (filterType === 'ALL') return true;
    return t.type === filterType;
  });

  const handleCopyHistory = () => {
    if (trades.length === 0) return;
    const jsonStr = JSON.stringify(trades, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCsv = () => {
    if (trades.length === 0) return;
    const headers = ['ID', 'Horário', 'Tipo', 'Preço Unitário (R$)', 'Quantidade (PENDLE)', 'Taxa (R$)', 'Total Líquido (R$)', 'P&L Realizado (R$)', 'Notas'];
    const rows = trades.map((t) => [
      t.id,
      t.formattedTime,
      t.type === 'BUY' ? 'COMPRA' : 'VENDA',
      t.priceBrl.toFixed(2),
      t.amount.toFixed(4),
      t.feeBrl.toFixed(4),
      t.netTotalBrl.toFixed(2),
      t.realizedPnlBrl !== undefined ? t.realizedPnlBrl.toFixed(4) : '',
      t.notes || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `atlas_omega_trades_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#101520] border border-[#222c42] rounded-xl overflow-hidden shadow-2xl flex flex-col font-mono text-xs">
      {/* Header da Tabela com Filtros e Ações */}
      <div className="bg-[#131a28] px-3.5 py-2.5 border-b border-[#222c42] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white text-xs tracking-wider uppercase">
            Histórico de Operações ({trades.length})
          </span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">• Simulado</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filtros */}
          <div className="flex items-center bg-[#0b0e14] border border-[#222c42] rounded-lg p-0.5 text-[11px]">
            {(['ALL', 'BUY', 'SELL'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterType(mode)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  filterType === mode
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'ALL' ? 'Todas' : mode === 'BUY' ? 'Compras' : 'Vendas'}
              </button>
            ))}
          </div>

          {/* Exportações */}
          {trades.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyHistory}
                className="px-2 py-1 rounded bg-[#151c2c] border border-[#26334d] hover:text-white text-slate-300 text-[10px] flex items-center gap-1 transition-colors"
                title="Copiar JSON do histórico"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Receipt className="w-3 h-3" />}
                <span className="hidden md:inline">{copied ? 'Copiado!' : 'Copiar JSON'}</span>
              </button>
              <button
                onClick={handleDownloadCsv}
                className="px-2 py-1 rounded bg-[#151c2c] border border-[#26334d] hover:text-white text-slate-300 text-[10px] flex items-center gap-1 transition-colors"
                title="Baixar planilha CSV de trades"
              >
                <Download className="w-3 h-3 text-cyan-400" />
                <span className="hidden md:inline">CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo / Tabela */}
      <div className="overflow-x-auto max-h-[360px] divide-y divide-[#182030]">
        {filteredTrades.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-mono text-xs">
            <History className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            <p>Nenhuma operação simulada registrada ainda.</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Execute compras ou vendas simuladas para visualizar o histórico detalhado com taxas e P&L.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#0b0e14]/70 text-[10px] uppercase text-slate-500 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="py-2 px-3">Horário</th>
                <th className="py-2 px-3">Tipo</th>
                <th className="py-2 px-3">Preço (R$)</th>
                <th className="py-2 px-3">Quantidade</th>
                <th className="py-2 px-3">Taxa (R$)</th>
                <th className="py-2 px-3">Total Líquido</th>
                <th className="py-2 px-3 text-right">P&L Realizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171f2e] text-[11px]">
              {filteredTrades.map((t) => {
                const isBuy = t.type === 'BUY';
                return (
                  <tr key={t.id} className="hover:bg-[#151c2c]/60 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {t.formattedTime}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isBuy
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                      }`}>
                        {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {isBuy ? 'COMPRA' : 'VENDA'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-200 whitespace-nowrap">
                      R$ {t.priceBrl.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-cyan-300 font-bold whitespace-nowrap">
                      {t.amount.toFixed(4)} <span className="text-[10px] text-slate-500">PENDLE</span>
                    </td>
                    <td className="py-2.5 px-3 text-amber-400/90 whitespace-nowrap">
                      R$ {t.feeBrl.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium whitespace-nowrap">
                      R$ {t.netTotalBrl.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {t.realizedPnlBrl !== undefined ? (
                        <span className={`font-bold ${t.realizedPnlBrl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.realizedPnlBrl >= 0 ? '+' : ''}R$ {t.realizedPnlBrl.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
