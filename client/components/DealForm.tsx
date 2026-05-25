import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Property, Client, SaleDeal, RentalDeal, SALE_STAGES, RENTAL_STAGES } from '../types';
import { getProperties, getClients, saveSale, saveRental } from '../utils/db';

interface DealFormProps {
  type: 'sale' | 'rental';
  deal?: SaleDeal | RentalDeal | null;
  onClose: () => void;
  onSaved: () => void;
}

export const DealForm: React.FC<DealFormProps> = ({ type, deal, onClose, onSaved }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    property_id: deal?.property_id || 0,
    client_id: deal?.client_id || 0,
    stage: deal?.stage || (type === 'sale' ? 'lead' : 'inquiry'),
    offer_price: (deal as SaleDeal)?.offer_price || 0,
    monthly_rent: (deal as RentalDeal)?.monthly_rent || 0,
    lease_start: (deal as RentalDeal)?.lease_start || '',
    lease_end: (deal as RentalDeal)?.lease_end || '',
    notes: deal?.notes || '',
  });

  useEffect(() => {
    Promise.all([getProperties(), getClients()]).then(([p, c]) => {
      setProperties(p);
      setClients(c);
    });
  }, []);

  function updateField(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (type === 'sale') {
        await saveSale({
          id: deal?.id,
          property_id: form.property_id,
          client_id: form.client_id,
          stage: form.stage as SaleDeal['stage'],
          offer_price: form.offer_price,
          notes: form.notes,
        });
      } else {
        await saveRental({
          id: deal?.id,
          property_id: form.property_id,
          client_id: form.client_id,
          stage: form.stage as RentalDeal['stage'],
          monthly_rent: form.monthly_rent,
          lease_start: form.lease_start,
          lease_end: form.lease_end,
          notes: form.notes,
        });
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save deal:', err);
    } finally {
      setSaving(false);
    }
  }

  const stages = type === 'sale' ? SALE_STAGES : RENTAL_STAGES;
  const title = type === 'sale'
    ? (deal ? '编辑买卖交易' : '新增买卖交易')
    : (deal ? '编辑租赁交易' : '新增租赁交易');

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{title}</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Property select */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">物业</span></label>
            <select
              className="select select-bordered select-sm w-full"
              value={form.property_id}
              onChange={(e) => updateField('property_id', Number(e.target.value))}
            >
              <option value={0}>-- 选择物业 --</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Client select */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">客户</span></label>
            <select
              className="select select-bordered select-sm w-full"
              value={form.client_id}
              onChange={(e) => updateField('client_id', Number(e.target.value))}
            >
              <option value={0}>-- 选择客户 --</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
            </select>
          </div>

          {/* Stage */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">阶段</span></label>
            <select
              className="select select-bordered select-sm w-full"
              value={form.stage}
              onChange={(e) => updateField('stage', e.target.value)}
            >
              {stages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Price fields */}
          {type === 'sale' ? (
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">报价 (RM)</span></label>
              <input
                type="number"
                className="input input-bordered input-sm w-full"
                value={form.offer_price || ''}
                onChange={(e) => updateField('offer_price', Number(e.target.value))}
                placeholder="0"
              />
            </div>
          ) : (
            <>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">月租 (RM)</span></label>
                <input
                  type="number"
                  className="input input-bordered input-sm w-full"
                  value={form.monthly_rent || ''}
                  onChange={(e) => updateField('monthly_rent', Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs">租期开始</span></label>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={form.lease_start}
                    onChange={(e) => updateField('lease_start', e.target.value)}
                  />
                </div>
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs">租期结束</span></label>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={form.lease_end}
                    onChange={(e) => updateField('lease_end', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">备注</span></label>
            <textarea
              className="textarea textarea-bordered textarea-sm w-full"
              rows={2}
              placeholder="备注信息..."
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>

          <div className="modal-action mt-4">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
              {deal ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
};
