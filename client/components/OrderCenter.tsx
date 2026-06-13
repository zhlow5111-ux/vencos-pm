import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, Wrench } from 'lucide-react';
import { Invoice } from '../types';
import { BillingPage } from './BillingPage';
import { MaintenanceTickets } from './MaintenanceTickets';
import { getInvoices, getTickets } from '../utils/db';

interface OrderCenterProps {
  onAdd: () => void;
  onEdit: (inv: Invoice) => void;
  refreshKey: number;
  userId?: number;
  onRefresh: () => void;
  initialTab?: 'billing' | 'maintenance';
}

export const OrderCenter: React.FC<OrderCenterProps> = ({ onAdd, onEdit, refreshKey, userId, onRefresh, initialTab }) => {
  const [tab, setTab] = useState<'billing' | 'maintenance'>(initialTab || 'billing');
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [ticketCount, setTicketCount] = useState(0);

  const loadCounts = useCallback(async () => {
    try {
      const invoices = await getInvoices(userId);
      const unpaid = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').length;
      setUnpaidCount(unpaid);
    } catch (e) { console.error('loadCounts invoices:', e); }
    try {
      const tickets = await getTickets();
      const open = tickets.filter(t => t.status === 'submitted' || t.status === 'acknowledged' || t.status === 'in_progress').length;
      setTicketCount(open);
    } catch (e) { console.error('loadCounts tickets:', e); }
  }, [userId]);

  useEffect(() => { loadCounts(); }, [refreshKey, loadCounts]);

  function handleRefresh() {
    loadCounts();
    onRefresh();
  }

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 bg-base-200/60 rounded-xl p-1">
        <button
          onClick={() => setTab('billing')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
            tab === 'billing'
              ? 'bg-base-100 text-primary shadow-sm'
              : 'text-base-content/50 hover:text-base-content/70'
          }`}
        >
          <Receipt size={16} />
          账单管理
          {unpaidCount > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
              tab === 'billing' ? 'bg-warning/15 text-warning' : 'bg-warning text-warning-content'
            }`}>
              {unpaidCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('maintenance')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
            tab === 'maintenance'
              ? 'bg-base-100 text-primary shadow-sm'
              : 'text-base-content/50 hover:text-base-content/70'
          }`}
        >
          <Wrench size={16} />
          维修工单
          {ticketCount > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
              tab === 'maintenance' ? 'bg-error/15 text-error' : 'bg-error text-error-content'
            }`}>
              {ticketCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {tab === 'billing' && (
        <BillingPage
          onAdd={onAdd}
          onEdit={onEdit}
          refreshKey={refreshKey}
          userId={userId}
        />
      )}
      {tab === 'maintenance' && (
        <MaintenanceTickets
          refreshKey={refreshKey}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
};
