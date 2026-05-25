import React, { useEffect, useState } from 'react';
import { Plus, ChevronRight, ChevronLeft, Trash2, Edit, Key, Calendar, AlertTriangle } from 'lucide-react';
import { RentalDeal, RENTAL_STAGES, RentalStage } from '../types';
import { getRentals, deleteRental, moveRentalStage } from '../utils/db';
import { formatCurrency, formatDate } from '../utils/helpers';
import { ConfirmModal } from './ConfirmModal';

interface RentalPipelineProps {
  onAdd: () => void;
  onEdit: (deal: RentalDeal) => void;
  refreshKey: number;
}

function getDaysUntilExpiry(leaseEnd: string): number | null {
  if (!leaseEnd) return null;
  const end = new Date(leaseEnd);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getExpiryBadge(days: number | null): React.ReactNode {
  if (days === null) return null;
  if (days < 0) {
    return <span className="badge badge-error badge-xs gap-1"><AlertTriangle size={10} />已过期 {Math.abs(days)}天</span>;
  }
  if (days <= 30) {
    return <span className="badge badge-error badge-xs gap-1 animate-pulse"><AlertTriangle size={10} />{days}天后到期</span>;
  }
  if (days <= 60) {
    return <span className="badge badge-warning badge-xs gap-1"><Calendar size={10} />{days}天后到期</span>;
  }
  if (days <= 90) {
    return <span className="badge badge-info badge-xs gap-1"><Calendar size={10} />{days}天后到期</span>;
  }
  return null;
}

function getLeaseDuration(start: string, end: string): string {
  if (!start || !end) return '';
  const s = new Date(start);
  const e = new Date(end);
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem > 0 ? `${years}年${rem}月` : `${years}年`;
  }
  return `${months}个月`;
}

export const RentalPipeline: React.FC<RentalPipelineProps> = ({ onAdd, onEdit, refreshKey }) => {
  const [deals, setDeals] = useState<RentalDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<RentalStage>('inquiry');

  useEffect(() => {
    loadDeals();
  }, [refreshKey]);

  async function loadDeals() {
    setLoading(true);
    try {
      const data = await getRentals();
      setDeals(data);
    } catch (e) {
      console.error('Failed to load rentals:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleMoveStage(deal: RentalDeal, direction: 'next' | 'prev') {
    const stageOrder: RentalStage[] = ['inquiry', 'viewing', 'agreement', 'deposit', 'active'];
    const currentIdx = stageOrder.indexOf(deal.stage);
    const newIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (newIdx < 0 || newIdx >= stageOrder.length) return;
    const newStage = stageOrder[newIdx];
    setDeals((prev) => prev.map((d) => d.id === deal.id ? { ...d, stage: newStage } : d));
    moveRentalStage(deal.id, newStage).catch((e) => {
      console.error('Failed to move stage:', e);
      loadDeals();
    });
  }

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  function handleDeleteConfirm() {
    if (deleteConfirmId === null) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    setDeals((prev) => prev.filter((d) => d.id !== id));
    deleteRental(id).catch((e) => {
      console.error('Failed to delete rental:', e);
      loadDeals();
    });
  }

  // Count expiring leases across all stages
  const expiringCount = deals.filter(d => {
    const days = getDaysUntilExpiry(d.lease_end);
    return days !== null && days <= 90;
  }).length;

  const stageDeals = deals.filter((d) => d.stage === activeStage);
  const stageCounts = RENTAL_STAGES.map((s) => ({
    ...s,
    count: deals.filter((d) => d.stage === s.value).length,
  }));

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-base-content">租赁流程管道</h2>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>
          <Plus size={14} /> 新增
        </button>
      </div>

      {/* Expiry warning banner */}
      {expiringCount > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-warning shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-warning">⚠️ {expiringCount} 份租约即将到期或已过期</p>
            <p className="text-xs text-base-content">请尽快联系租户洽谈续约事宜</p>
          </div>
        </div>
      )}

      {/* Stage tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {stageCounts.map((stage) => (
          <button
            key={stage.value}
            className={`btn btn-xs shrink-0 gap-1 ${activeStage === stage.value ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveStage(stage.value)}
          >
            {stage.label}
            <span className={`badge badge-xs ${activeStage === stage.value ? 'badge-primary-content bg-primary-content/20' : 'badge-ghost'}`}>
              {stage.count}
            </span>
          </button>
        ))}
      </div>

      {/* Progress indicator */}
      <div className="flex gap-0.5">
        {RENTAL_STAGES.map((stage, idx) => (
          <div
            key={stage.value}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              RENTAL_STAGES.findIndex((s) => s.value === activeStage) >= idx ? 'bg-primary' : 'bg-base-300'
            }`}
          />
        ))}
      </div>

      {/* Deal cards */}
      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : stageDeals.length === 0 ? (
        <div className="text-center py-8">
          <Key size={40} className="mx-auto opacity-30 mb-2" />
          <p className="text-base-content text-sm">此阶段暂无租赁</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stageDeals.map((deal) => {
            const stageIdx = RENTAL_STAGES.findIndex((s) => s.value === deal.stage);
            const canPrev = stageIdx > 0;
            const canNext = stageIdx < RENTAL_STAGES.length - 1;
            const daysUntilExpiry = getDaysUntilExpiry(deal.lease_end);
            const isExpiring = daysUntilExpiry !== null && daysUntilExpiry <= 90;
            return (
              <div key={deal.id} className={`card ${isExpiring ? 'bg-warning/5 border border-warning/30' : 'bg-base-200'}`}>
                <div className="card-body p-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm truncate">{deal.property_name || '未指定物业'}</h4>
                      <p className="text-xs text-base-content">{deal.client_name || '未指定客户'}</p>
                      {deal.monthly_rent > 0 && (
                        <p className="text-sm font-bold text-primary mt-1">{formatCurrency(deal.monthly_rent)}/月</p>
                      )}
                    </div>
                    {getExpiryBadge(daysUntilExpiry)}
                  </div>

                  {/* Lease period — prominent display */}
                  {deal.lease_start && (
                    <div className={`rounded-lg p-2 mt-1 ${isExpiring ? 'bg-warning/10' : 'bg-primary/5'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className={isExpiring ? 'text-warning' : 'text-primary'} />
                          <span className="text-xs font-medium">租赁期限</span>
                        </div>
                        <span className="text-xs text-base-content">
                          {getLeaseDuration(deal.lease_start, deal.lease_end)}
                        </span>
                      </div>
                      <p className="text-xs font-bold mt-0.5">
                        {formatDate(deal.lease_start)} → {formatDate(deal.lease_end)}
                      </p>
                    </div>
                  )}

                  {deal.notes && <p className="text-xs text-base-content mt-1 truncate">{deal.notes}</p>}

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-1">
                      <button
                        className="btn btn-ghost btn-xs"
                        disabled={!canPrev}
                        onClick={() => handleMoveStage(deal, 'prev')}
                        title="上一阶段"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        className="btn btn-primary btn-xs"
                        disabled={!canNext}
                        onClick={() => handleMoveStage(deal, 'next')}
                        title="下一阶段"
                      >
                        <ChevronRight size={14} /> 推进
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-xs" onClick={() => onEdit(deal)}>
                        <Edit size={12} />
                      </button>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeleteConfirmId(deal.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmModal
        open={deleteConfirmId !== null}
        message="确定删除此租赁交易？此操作不可撤销。"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};
