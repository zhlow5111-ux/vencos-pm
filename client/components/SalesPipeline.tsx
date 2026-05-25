import React, { useEffect, useState } from 'react';
import { Plus, ChevronRight, ChevronLeft, Trash2, Edit, TrendingUp } from 'lucide-react';
import { SaleDeal, SALE_STAGES, SaleStage } from '../types';
import { getSales, deleteSale, moveSaleStage } from '../utils/db';
import { formatCurrency } from '../utils/helpers';
import { ConfirmModal } from './ConfirmModal';

interface SalesPipelineProps {
  onAdd: () => void;
  onEdit: (deal: SaleDeal) => void;
  refreshKey: number;
}

export const SalesPipeline: React.FC<SalesPipelineProps> = ({ onAdd, onEdit, refreshKey }) => {
  const [deals, setDeals] = useState<SaleDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<SaleStage>('lead');

  useEffect(() => {
    loadDeals();
  }, [refreshKey]);

  async function loadDeals() {
    setLoading(true);
    try {
      const data = await getSales();
      setDeals(data);
    } catch (e) {
      console.error('Failed to load sales:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleMoveStage(deal: SaleDeal, direction: 'next' | 'prev') {
    const stageOrder: SaleStage[] = ['lead', 'viewing', 'negotiation', 'contract', 'completed'];
    const currentIdx = stageOrder.indexOf(deal.stage);
    const newIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (newIdx < 0 || newIdx >= stageOrder.length) return;
    const newStage = stageOrder[newIdx];
    setDeals((prev) => prev.map((d) => d.id === deal.id ? { ...d, stage: newStage } : d));
    moveSaleStage(deal.id, newStage).catch((e) => {
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
    deleteSale(id).catch((e) => {
      console.error('Failed to delete sale:', e);
      loadDeals();
    });
  }

  const stageDeals = deals.filter((d) => d.stage === activeStage);
  const stageCounts = SALE_STAGES.map((s) => ({
    ...s,
    count: deals.filter((d) => d.stage === s.value).length,
  }));

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-base-content">买卖流程管道</h2>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>
          <Plus size={14} /> 新增
        </button>
      </div>

      {/* Stage tabs - scrollable */}
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
        {SALE_STAGES.map((stage, idx) => (
          <div
            key={stage.value}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              SALE_STAGES.findIndex((s) => s.value === activeStage) >= idx ? 'bg-primary' : 'bg-base-300'
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
          <TrendingUp size={40} className="mx-auto opacity-30 mb-2" />
          <p className="text-base-content text-sm">此阶段暂无交易</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stageDeals.map((deal) => {
            const stageIdx = SALE_STAGES.findIndex((s) => s.value === deal.stage);
            const canPrev = stageIdx > 0;
            const canNext = stageIdx < SALE_STAGES.length - 1;
            return (
              <div key={deal.id} className="card bg-base-200">
                <div className="card-body p-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm truncate">{deal.property_name || '未指定物业'}</h4>
                      <p className="text-xs text-base-content">{deal.client_name || '未指定客户'}</p>
                      {deal.offer_price > 0 && (
                        <p className="text-sm font-bold text-primary mt-1">{formatCurrency(deal.offer_price)}</p>
                      )}
                      {deal.notes && <p className="text-xs text-base-content mt-1 truncate">{deal.notes}</p>}
                    </div>
                  </div>
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
        message="确定删除此销售交易？此操作不可撤销。"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};
