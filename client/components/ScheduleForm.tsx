import React, { useState, useEffect } from 'react';
import { X, Users, User } from 'lucide-react';
import { BillingSchedule, Property, FloorUnit, MessageTemplate, CHANNEL_TYPES } from '../types';
import { saveSchedule, batchSaveSchedules, getProperties, getFloorUnits, getTemplates } from '../utils/db';

interface ScheduleFormProps {
  schedule?: BillingSchedule;
  onClose: () => void;
  onSaved: () => void;
}

export const ScheduleForm: React.FC<ScheduleFormProps> = ({ schedule, onClose, onSaved }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [floorUnits, setFloorUnits] = useState<FloorUnit[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [mode, setMode] = useState<'single' | 'all'>('single'); // single floor or all floors

  const [form, setForm] = useState({
    property_id: schedule?.property_id || 0,
    tenant_id: schedule?.tenant_id || 0, // actually floor_unit_id
    amount: schedule?.amount || 0,
    due_day: schedule?.due_day || 1,
    generate_day: schedule?.generate_day ?? 0,
    reminder_day: schedule?.reminder_day ?? 0,
    grace_days: schedule?.grace_days ?? 7,
    template_id: schedule?.template_id || 0,
    channel: schedule?.channel || 'both',
    active: schedule?.active ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    const [props, tmpls] = await Promise.all([getProperties(), getTemplates()]);
    setProperties(props);
    setTemplates(tmpls);
    // If editing, load floor units for existing property
    if (schedule?.property_id) {
      const units = await getFloorUnits(schedule.property_id);
      setFloorUnits(units);
    }
  }

  async function handlePropertyChange(propertyId: number) {
    setForm({ ...form, property_id: propertyId, tenant_id: 0, amount: 0 });
    setMode('single');
    if (propertyId) {
      setLoadingFloors(true);
      const units = await getFloorUnits(propertyId);
      setFloorUnits(units);
      setLoadingFloors(false);
    } else {
      setFloorUnits([]);
    }
  }

  function handleTenantChange(floorUnitId: number) {
    const fu = floorUnits.find(f => f.id === floorUnitId);
    setForm({
      ...form,
      tenant_id: floorUnitId,
      amount: fu?.rent_amount || 0,
    });
    setMode('single');
  }

  function handleAllTenantsMode() {
    setMode('all');
    setForm({ ...form, tenant_id: 0, amount: 0 });
  }

  const occupiedFloors = floorUnits.filter(f => f.tenant_name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === 'all' && !schedule) {
        // Batch create for all tenants of this property
        const count = await batchSaveSchedules(form.property_id, floorUnits, {
          due_day: form.due_day,
          generate_day: form.generate_day,
          reminder_day: form.reminder_day,
          grace_days: form.grace_days,
          template_id: form.template_id,
          channel: form.channel,
        });
        setToast(`✓ 已为 ${count} 个租户创建排程`);
        setTimeout(() => { setToast(''); onSaved(); }, 1500);
      } else {
        // Single schedule
        await saveSchedule({
          ...(schedule?.id ? { id: schedule.id } : {}),
          ...form,
        });
        setToast('✓ 已保存');
        setTimeout(() => { setToast(''); onSaved(); }, 1500);
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  const dayOptions: number[] = [];
  for (let i = 1; i <= 28; i++) dayOptions.push(i);

  const selectedFloor = floorUnits.find(f => f.id === form.tenant_id);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-base-100 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <h3 className="font-bold text-lg">{schedule ? '编辑排程' : '新建自动账单排程'}</h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Property Selection */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">物业</span></label>
            <select
              className="select select-bordered select-sm w-full"
              value={form.property_id}
              onChange={(e) => handlePropertyChange(Number(e.target.value))}
              required
            >
              <option value={0} disabled>选择物业</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name} - {p.address}</option>
              ))}
            </select>
          </div>

          {/* Floor/Tenant Selection */}
          {form.property_id > 0 && (
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">租户</span></label>
              {loadingFloors ? (
                <div className="flex items-center gap-2 p-2 text-xs opacity-60">
                  <span className="loading loading-spinner loading-xs" /> 加载楼层...
                </div>
              ) : occupiedFloors.length === 0 ? (
                <div className="text-xs text-warning p-2 bg-warning/10 rounded-lg">
                  ⚠️ 此物业暂无租户，请先在物业管理中添加租户
                </div>
              ) : (
                <>
                  {/* Batch option - only for new schedules */}
                  {!schedule && occupiedFloors.length > 1 && (
                    <button
                      type="button"
                      className={`btn btn-sm w-full mb-2 gap-2 ${mode === 'all' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={handleAllTenantsMode}
                    >
                      <Users size={14} />
                      所有租户一键创建 ({occupiedFloors.length} 个)
                    </button>
                  )}

                  {/* Individual tenant selection */}
                  <div className="space-y-1.5">
                    {floorUnits.map((fu) => {
                      if (!fu.tenant_name) return null;
                      const isSelected = mode === 'single' && form.tenant_id === fu.id;
                      return (
                        <button
                          key={fu.id}
                          type="button"
                          className={`w-full text-left p-2.5 rounded-lg border transition-all text-sm ${
                            isSelected
                              ? 'border-primary bg-primary/10 ring-1 ring-primary'
                              : mode === 'all'
                              ? 'border-primary/30 bg-primary/5'
                              : 'border-base-300 hover:border-primary/50'
                          }`}
                          onClick={() => handleTenantChange(fu.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="badge badge-sm badge-outline">{fu.floor_label === 'G' ? 'G楼' : `${fu.floor_label}楼`}</span>
                              <span className="font-medium">{fu.tenant_name}</span>
                            </div>
                            <span className="text-xs opacity-70">RM {(fu.rent_amount || 0).toLocaleString()}</span>
                          </div>
                          {fu.tenant_phone && (
                            <div className="text-xs opacity-50 mt-0.5 ml-12">{fu.tenant_phone}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {mode === 'all' && (
                    <div className="text-xs text-primary mt-1 flex items-center gap-1">
                      <Users size={12} /> 将为以上 {occupiedFloors.length} 个租户各创建独立排程
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Amount - only for single mode */}
          {mode === 'single' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">月租金 (RM)</span></label>
                <input
                  type="number"
                  className="input input-bordered input-sm w-full"
                  value={form.amount || ''}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  required
                  min={0}
                  step={0.01}
                />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">每月到期日</span></label>
                <select
                  className="select select-bordered select-sm w-full"
                  value={form.due_day}
                  onChange={(e) => setForm({ ...form, due_day: Number(e.target.value) })}
                >
                  {dayOptions.map((d) => (
                    <option key={d} value={d}>{d} 号</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Due day for batch mode */}
          {mode === 'all' && (
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">每月到期日</span></label>
              <select
                className="select select-bordered select-sm w-full"
                value={form.due_day}
                onChange={(e) => setForm({ ...form, due_day: Number(e.target.value) })}
              >
                {dayOptions.map((d) => (
                  <option key={d} value={d}>{d} 号</option>
                ))}
              </select>
            </div>
          )}

          {/* Generate Day & Grace Days */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">📄 生成账单日 <span className="text-[10px] opacity-50">(每月几号)</span></span></label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  className="input input-bordered input-sm w-full"
                  value={form.generate_day || ''}
                  onChange={(e) => setForm({ ...form, generate_day: Math.min(28, Math.max(0, Number(e.target.value))) })}
                  min={0}
                  max={28}
                  placeholder="0"
                />
                <span className="text-xs opacity-60 whitespace-nowrap">号</span>
              </div>
              <span className="text-[10px] opacity-40 mt-0.5">{form.generate_day === 0 ? '到期当天生成' : form.generate_day < form.due_day ? '上月生成' : form.generate_day === form.due_day ? '到期当天生成' : '当月生成'}</span>
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">⏳ 宽限期 <span className="text-[10px] opacity-50">(到期后天数)</span></span></label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  className="input input-bordered input-sm w-full"
                  value={form.grace_days || ''}
                  onChange={(e) => setForm({ ...form, grace_days: Math.min(30, Math.max(0, Number(e.target.value))) })}
                  min={0}
                  max={30}
                  placeholder="0"
                />
                <span className="text-xs opacity-60 whitespace-nowrap">天</span>
              </div>
              <span className="text-[10px] opacity-40 mt-0.5">{form.grace_days === 0 ? '无宽限期' : `截止 = ${form.due_day}号 + ${form.grace_days}天`}</span>
            </div>
          </div>

          {/* Channel & Reminder Day */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">发送渠道</span></label>
              <select
                className="select select-bordered select-sm w-full"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
              >
                {CHANNEL_TYPES.map((ch) => (
                  <option key={ch.value} value={ch.value}>{ch.label}</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">🔔 逾期提醒日 <span className="text-[10px] opacity-50">(每月几号)</span></span></label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  className="input input-bordered input-sm w-full"
                  value={form.reminder_day || ''}
                  onChange={(e) => setForm({ ...form, reminder_day: Math.min(28, Math.max(0, Number(e.target.value))) })}
                  min={0}
                  max={28}
                  placeholder="0"
                />
                <span className="text-xs opacity-60 whitespace-nowrap">号</span>
              </div>
              <span className="text-[10px] opacity-40 mt-0.5">{form.reminder_day === 0 ? '不提醒' : `每月${form.reminder_day}号发送`}</span>
            </div>
          </div>

          {/* Template */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">消息模板</span></label>
            <select
              className="select select-bordered select-sm w-full"
              value={form.template_id}
              onChange={(e) => setForm({ ...form, template_id: Number(e.target.value) })}
            >
              <option value={0}>不使用模板</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Active toggle */}
          {mode === 'single' && (
            <div className="form-control">
              <label className="label cursor-pointer py-1">
                <span className="label-text text-xs">启用此排程</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={!!form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })}
                />
              </label>
            </div>
          )}

          {/* Info — timeline flow */}
          <div className="bg-base-200/60 rounded-lg p-3 text-xs text-base-content/70 space-y-1">
            <p className="font-semibold text-base-content/80 mb-1.5">📋 排程流程预览</p>
            {form.generate_day > 0 && form.generate_day !== form.due_day ? (
              <p>📄 {form.generate_day < form.due_day ? '上月' : '每月'} <b>{form.generate_day} 号</b> → 生成账单并发送</p>
            ) : (
              <p>📄 每月 <b>{form.due_day} 号</b> → 到期当天生成账单并发送</p>
            )}
            <p>📅 每月 <b>{form.due_day} 号</b> → 账单到期日</p>
            {form.grace_days > 0 && (
              <p>⏳ 到期后 <b>{form.grace_days} 天</b> → 宽限期截止</p>
            )}
            {form.reminder_day > 0 && (
              <p>🔔 每月 <b>{form.reminder_day} 号</b> → 发送逾期提醒</p>
            )}
            <p className="text-[10px] text-base-content/40 pt-1">
              渠道: {CHANNEL_TYPES.find((c) => c.value === form.channel)?.label}
              {mode === 'all' && ` · ${occupiedFloors.length} 个租户`}
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary btn-sm w-full"
            disabled={saving || (mode === 'single' && !form.tenant_id) || !form.property_id || (mode === 'single' && !form.amount)}
          >
            {saving ? (
              <span className="loading loading-spinner loading-xs" />
            ) : mode === 'all' ? (
              `为 ${occupiedFloors.length} 个租户创建排程`
            ) : (
              schedule ? '保存' : '创建排程'
            )}
          </button>
        </form>

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]">
            <div className="bg-success text-success-content px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
              {toast}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
