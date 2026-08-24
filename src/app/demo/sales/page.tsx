'use client';

import { useState } from 'react';
import {
  useDemoStore,
  lineItemUnitPrice,
  type DemoClosedSale,
  type DemoFiado,
  type DemoLineItem,
  type DemoCartCombo,
  type DemoTabObservation,
  type PayMethod,
} from '@/stores/demo-store';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { DemoShiftGuard } from '@/components/layout/demo-shift-guard';

type MethodFilter = 'all' | PayMethod | 'fiado';

// Fila unificada — junta ventas cerradas normales y fiados, igual que la
// tabla "sales" real (todo vive junto ahí, el fiado es solo otro método de pago).
interface SaleRow {
  id: string;
  tableNumber: string;
  items: DemoLineItem[];
  combos: DemoCartCombo[];
  tabObservations: DemoTabObservation[];
  total: number;
  paymentMethod: PayMethod | 'fiado';
  cashAmount: number;
  transferAmount: number;
  cashChange: number;
  closedAt: string;
  fiadoCustomerName?: string;
  fiadoPaid?: boolean;
}

export default function DemoSalesHistoryPage() {
  return (
    <DemoShiftGuard>
      <DemoSalesHistoryContent />
    </DemoShiftGuard>
  );
}

function DemoSalesHistoryContent() {
  const { closedSales, fiados } = useDemoStore();
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [selectedRow, setSelectedRow] = useState<SaleRow | null>(null);

  const rows: SaleRow[] = [
    ...closedSales.map((s: DemoClosedSale): SaleRow => ({
      id: s.id,
      tableNumber: s.tableNumber,
      items: s.items,
      combos: s.combos,
      tabObservations: s.tabObservations,
      total: s.total,
      paymentMethod: s.paymentMethod,
      cashAmount: s.cashAmount,
      transferAmount: s.transferAmount,
      cashChange: s.cashChange,
      closedAt: s.closedAt,
    })),
    ...fiados.map((f: DemoFiado): SaleRow => ({
      id: f.id,
      tableNumber: f.tableNumber,
      items: f.items,
      combos: f.combos,
      tabObservations: f.tabObservations,
      total: f.total,
      paymentMethod: 'fiado',
      cashAmount: f.abono,
      transferAmount: 0,
      cashChange: 0,
      closedAt: f.createdAt,
      fiadoCustomerName: f.customerName,
      fiadoPaid: f.paid,
    })),
  ].sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());

  const filtered = rows.filter((r) => methodFilter === 'all' || r.paymentMethod === methodFilter);

  const totals = {
    total_sales: rows.reduce((sum, r) => sum + r.total, 0),
    cash_sales: rows.reduce((sum, r) => sum + r.cashAmount, 0),
    transfer_sales: rows.reduce((sum, r) => sum + r.transferAmount, 0),
    transactions: rows.length,
  };

  const itemsPreview = (row: SaleRow) => {
    const parts: string[] = [
      ...row.combos.map((c) => `🎁 ${c.comboName}`),
      ...row.items.map((i) => `${i.quantity}x ${i.product.name}`),
    ];
    if (parts.length === 0) return '—';
    if (parts.length <= 2) return parts.join(', ');
    return `${parts.slice(0, 2).join(', ')} +${parts.length - 2} más`;
  };

  const methodBadge = (method: PayMethod | 'fiado') => {
    const map: Record<string, string> = {
      cash: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400',
      transfer: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400',
      mixed: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-400',
      fiado: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-400',
    };
    const label: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia', mixed: 'Mixto', fiado: 'Fiado' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[method]}`}>{label[method]}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Ventas — Práctica</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-neutral-800 rounded-xl p-4 border border-gray-200 dark:border-neutral-700">
          <p className="text-sm text-gray-600 dark:text-neutral-300">Total Ventas</p>
          <p className="text-xl font-bold text-gray-900 dark:text-neutral-100">{formatCurrency(totals.total_sales)}</p>
        </div>
        <div className="bg-white dark:bg-neutral-800 rounded-xl p-4 border border-gray-200 dark:border-neutral-700">
          <p className="text-sm text-gray-600 dark:text-neutral-300">Efectivo</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.cash_sales)}</p>
        </div>
        <div className="bg-white dark:bg-neutral-800 rounded-xl p-4 border border-gray-200 dark:border-neutral-700">
          <p className="text-sm text-gray-600 dark:text-neutral-300">Transferencias</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totals.transfer_sales)}</p>
        </div>
        <div className="bg-white dark:bg-neutral-800 rounded-xl p-4 border border-gray-200 dark:border-neutral-700">
          <p className="text-sm text-gray-600 dark:text-neutral-300">Transacciones</p>
          <p className="text-xl font-bold text-gray-900 dark:text-neutral-100">{totals.transactions}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 bg-white dark:bg-neutral-800 p-4 rounded-xl border border-gray-200 dark:border-neutral-700">
        <div>
          <label className="block text-sm text-gray-600 dark:text-neutral-300 mb-1">Método de Pago</label>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as MethodFilter)}
            className="px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg"
          >
            <option value="all">Todos</option>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="mixed">Mixto</option>
            <option value="fiado">Fiado</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">Fecha/Hora</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">Mesa</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">Productos</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300">Pago</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Total</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-neutral-950">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-neutral-100">{formatDate(row.closedAt)}</p>
                    <p className="text-sm text-gray-500 dark:text-neutral-400">{formatTime(row.closedAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-neutral-300">
                    {row.tableNumber}
                    {row.fiadoCustomerName && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">{row.fiadoCustomerName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-neutral-300">{itemsPreview(row)}</td>
                  <td className="px-4 py-3 text-center">
                    {methodBadge(row.paymentMethod)}
                    {row.paymentMethod === 'fiado' && (
                      <p className="text-xs mt-1 text-gray-500 dark:text-neutral-400">{row.fiadoPaid ? 'Pagado' : 'Pendiente'}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-neutral-100">{formatCurrency(row.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedRow(row)}
                      className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 text-sm font-medium"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-neutral-400">No hay ventas en esta categoría</div>
        )}
      </div>

      {selectedRow && <SaleDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </div>
  );
}

function SaleDetailModal({ row, onClose }: { row: SaleRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-neutral-100">Detalle de Venta</h2>

        <div className="space-y-3 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-neutral-300">Fecha:</span>
            <span className="text-gray-900 dark:text-neutral-100">{formatDate(row.closedAt)} {formatTime(row.closedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-neutral-300">Mesa:</span>
            <span className="text-gray-900 dark:text-neutral-100">{row.tableNumber}</span>
          </div>
          {row.fiadoCustomerName && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-neutral-300">Cliente (fiado):</span>
              <span className="text-gray-900 dark:text-neutral-100">{row.fiadoCustomerName}</span>
            </div>
          )}
        </div>

        {row.tabObservations.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 mb-4 border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-400 mb-2">Observaciones:</p>
            <ul className="space-y-1">
              {row.tabObservations.map((obs) => (
                <li key={obs.id} className="text-sm text-amber-900 dark:text-amber-300">• {obs.text}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-gray-50 dark:bg-neutral-950 rounded-xl p-4 mb-4 space-y-2">
          {row.combos.map((c, idx) => (
            <div key={`c-${idx}`} className="flex justify-between text-sm">
              <span className="text-gray-700 dark:text-neutral-300">🎁 {c.comboName}</span>
              <span className="font-medium text-gray-900 dark:text-neutral-100">{formatCurrency(c.finalPrice)}</span>
            </div>
          ))}
          {row.items.map((item, idx) => (
            <div key={`i-${idx}`} className="flex justify-between text-sm">
              <span className="text-gray-700 dark:text-neutral-300">
                {item.quantity}x {item.product.name}
                {item.isMichelada && ' 🌶️'}
                {item.isBomba && ' 💣'}
              </span>
              <span className="font-medium text-gray-900 dark:text-neutral-100">{formatCurrency(lineItemUnitPrice(item) * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center border-t border-gray-200 dark:border-neutral-700 pt-3 mb-6">
          <span className="font-bold text-gray-900 dark:text-neutral-100">Total</span>
          <span className="font-bold text-xl text-gray-900 dark:text-neutral-100">{formatCurrency(row.total)}</span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 border border-gray-300 dark:border-neutral-600 rounded-xl text-sm font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-950"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
