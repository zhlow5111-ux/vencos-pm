import React, { useState, useEffect, useMemo } from 'react';
import { X, Users, User, ChevronDown, ChevronRight, CheckSquare, Square, Search } from 'lucide-react';
import { BillingSchedule, Property, FloorUnit, MessageTemplate, CHANNEL_TYPES } from '../types';
import { saveSchedule, batchSaveSchedules, getProperties, getFloorUnits, getTemplates, getSchedules } from '../utils/db';

interface ScheduleFormProps {
  schedule?: BillingSchedule;
  onClose: () => void;
  onSaved: () => void;
}

export const ScheduleForm: React.FC<ScheduleFormProps> = ({ schedule, onClose, onSaved }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [floorUnitsMap, setFloorUnitsMap] = useState<Record<number, FloorUnit[]>>({});
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loadingFloors, setLoadingFloors] = useState(false);

  // Selection state
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>(
    schedule?.property_id ? [schedule.property_id] : []
  );
  const [selectedTenantId, setSelectedTenantId] = useState(schedule?.tenant_id || 0);
  const [tenantMode, setTenantMode] = useState<'single' | 'all'>('single');
  const [searchText, setSearchText] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    amount: schedule?.amount || 0,
    due_day: schedule?.due_day || 1,
    generate_day: schedule?.generate_day ?? 0,
    reminder_day: schedule?.reminder_day?.toString() ?? '',
    grace_days: schedule?.grace_days ?? 7,
    template_id: schedule?.template_id || 0,
    reminder_template_id: schedule?.reminder_template_id || 0,
    channel: schedule?.channel || 'both',
    active: schedule?.active ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const isEditMode = !!schedule;

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    const [props, tmpls, existingSchedules] = await Promise.all([getProperties(), getTemplates(), getSchedules()]);
    setProperties(props);
    setTemplates(tmpls);
    // expand all groups by default
    const groups: Record<string, boolean> = {};
    props.forEach((p) => {
      const gn = (p as any).owner_name || '未分类';
      groups[gn] = true;
    });
    setExpandedGroups(groups);
    // Default grace_days from last schedule (if creating new)
    if (!schedule && existingSchedules.length > 0) {
      const last = existingSchedules[existingSchedules.length - 1];
      setForm(prev => ({ ...prev, grace_days: last.grace_days ?? 7 }));
    }
    // If editing, load floor units for existing property
    if (schedule?.property_id) {
      const units = await getFloorUnits(schedule.property_id);
      setFloorUnitsMap({ [schedule.property_id]: units });
    }
  }

  // Group properties by owner_name (company)
  const grouped = useMemo(() => {
    const filtered = searchText
      ? properties.filter(
          (p) =>
            p.name.toLowerCase().includes(searchText.toLowerCase()) ||
            p.address.toLowerCase().includes(searchText.toLowerCase())
        )
      : properties;

    const map = new Map<string, Property[]>();
    filtered.forEach((p) => {
      const gn = (p as any).owner_name || '未分类';
      if (!map.has(gn)) map.set(gn, []);
      map.get(gn)!.push(p);
    });
    return map;
  }, [properties, searchText]);

  const allPropertyIds = useMemo(() => {
    const ids: number[] = [];
    grouped.forEach((props) => props.forEach((p) => ids.push(p.id)));
    return ids;
  }, [grouped]);

  const isAllSelected = allPropertyIds.length > 0 && allPropertyIds.every((id) => selectedPropertyIds.includes(id));
  const isSomeSelected = allPropertyIds.some((id) => selectedPropertyIds.includes(id)) && !isAllSelected;

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedPropertyIds([]);
    } else {
      setSelectedPropertyIds([...allPropertyIds]);
    }
    setSelectedTenantId(0);
    setTenantMode('all');
  }

  function toggleGroupAll(groupName: string) {
    const groupIds = grouped.get(groupName)?.map((p) => p.id) || [];
    const allGroupSelected = groupIds.every((id) => selectedPropertyIds.includes(id));
    if (allGroupSelected) {
      setSelectedPropertyIds(selectedPropertyIds.filter((id) => !groupIds.includes(id)));
    } else {
      const newIds = [...new Set([...selectedPropertyIds, ...groupIds])];
      setSelectedPropertyIds(newIds);
    }
    setSelectedTenantId(0);
    if (selectedPropertyIds.length > 1) setTenantMode('all');
  }

  function toggleProperty(pid: number) {
    const exists = selectedPropertyIds.includes(pid);
    let newIds: number[];
    if (exists) {
      newIds = selectedPropertyIds.filter((id) => id !== pid);
    } else {
      newIds = [...selectedPropertyIds, pid];
    }
    setSelectedPropertyIds(newIds);
    setSelectedTenantId(0);

    // If only 1 property selected, load its floor units
    if (newIds.length === 1) {
      setTenantMode('single');
      loadFloorUnits(newIds[0]);
    } else {
      setTenantMode('all');
    }
  }

  async function loadFloorUnits(pid: number) {
    if (floorUnitsMap[pid]) return;
    setLoadingFloors(true);
    const units = await getFloorUnits(pid);
    setFloorUnitsMap((prev) => ({ ...prev, [pid]: units }));
    setLoadingFloors(false);
  }

  // Load floor units for all selected properties (for batch)
  async function loadAllSelectedFloorUnits() {
    const toLoad = selectedPropertyIds.filter((id) => !floorUnitsMap[id]);
    if (toLoad.length === 0) return;
    setLoadingFloors(true);
    const results = await Promise.all(toLoad.map((id) => getFloorUnits(id).then((u) => [id, u] as [number, FloorUnit[]])));
    const newMap = { ...floorUnitsMap };
    results.forEach(([id, units]) => { newMap[id] = units; });
    setFloorUnitsMap(newMap);
    setLoadingFloors(false);
  }

  function toggleGroup(gn: string) {
    setExpandedGroups((prev) => ({ ...prev, [gn]: !prev[gn] }));
  }

  // Current single-property floor units
  const currentFloorUnits = selectedPropertyIds.length === 1 ? (floorUnitsMap[selectedPropertyIds[0]] || []) : [];
  const occupiedFloors = currentFloorUnits.filter((f) => f.tenant_name);
  const selectedFloor = currentFloorUnits.find((f) => f.id === selectedTenantId);

  // Count total tenants across all selected properties
  const totalTenantCount = useMemo(() => {
    let count = 0;
    selectedPropertyIds.forEach((pid) => {
      const units = floorUnitsMap[pid] || [];
      count += units.filter((f) => f.tenant_name).length;
    });
    return count;
  }, [selectedPropertyIds, floorUnitsMap]);

  function handleTenantChange(floorUnitId: number) {
    const fu = currentFloorUnits.find((f) => f.id === floorUnitId);
    setSelectedTenantId(floorUnitId);
    setForm({ ...form, amount: fu?.rent_amount || 0 });
    setTenantMode('single');
  }

  function handleAllTenantsMode() {
    setTenantMode('all');
    setSelectedTenantId(0);
    setForm({ ...form, amount: 0 });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (selectedPropertyIds.length > 1 || tenantMode === 'all') {
        // Batch: load all floor units first
        await loadAllSelectedFloorUnits();
        let totalCreated = 0;
        for (const pid of selectedPropertyIds) {
          const units = floorUnitsMap[pid] || [];
          if (units.filter((u) => u.tenant_name).length === 0) continue;
          const count = await batchSaveSchedules(pid, units, {
            due_day: form.due_day,
            generate_day: form.generate_day,
            reminder_day: form.reminder_day as any,
            grace_days: form.grace_days,
            template_id: form.template_id,
            reminder_template_id: form.reminder_template_id,
            channel: form.channel,
          });
          totalCreated += count;
        }
        setToast(`✓ 已为 ${totalCreated} 个租户创建排程`);
        setTimeout(() => { setToast(''); onSaved(); }, 1500);
      } else if (selectedPropertyIds.length === 1) {
        // Single property, single tenant
        await saveSchedule({
          ...(schedule?.id ? { id: schedule.id } : {}),
          property_id: selectedPropertyIds[0],
          tenant_id: selectedTenantId,
          amount: form.amount,
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
  for (let i = 1; i <= 31; i++) dayOptions.push(i);

  const canSubmit = (() => {
    if (selectedPropertyIds.length === 0) return false;
    if (selectedPropertyIds.length > 1 || tenantMode === 'all') return true;
    return selectedTenantId > 0 && form.amount > 0;
  })();

  const submitLabel = (() => {
    if (selectedPropertyIds.length > 1) return `为 ${selectedPropertyIds.length} 个物业创建排程`;
    if (tenantMode === 'all' && selectedPropertyIds.length === 1) return `为 ${occupiedFloors.length} 个租户创建排程`;
    return schedule ? '保存' : '创建排程';
  })();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-base-100 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <h3 className="font-bold text-lg">{schedule ? '编辑排程' : '新建自动账单排程'}</h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* ===== Property Selection Panel ===== */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs font-semibold">📋 选择物业</span></label>

            {/* Search */}
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                type="text"
                className="input input-bordered input-sm w-full pl-8"
                placeholder="搜索物业名称或地址..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            {/* Select All */}
            {!isEditMode && (
              <button
                type="button"
                className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all mb-1 ${
                  isAllSelected ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'
                }`}
                onClick={toggleSelectAll}
              >
                {isAllSelected ? <CheckSquare size={16} className="text-primary" /> : isSomeSelected ? <Square size={16} className="text-primary opacity-50" /> : <Square size={16} className="opacity-30" />}
                全选所有物业 ({allPropertyIds.length})
              </button>
            )}

            {/* Grouped Property List */}
            <div className="border border-base-300 rounded-lg max-h-48 overflow-y-auto">
              {Array.from(grouped.entries()).map(([groupName, props]) => {
                const isExpanded = expandedGroups[groupName] !== false;
                const groupIds = props.map((p) => p.id);
                const allGroupSelected = groupIds.every((id) => selectedPropertyIds.includes(id));
                const someGroupSelected = groupIds.some((id) => selectedPropertyIds.includes(id)) && !allGroupSelected;
                return (
                  <div key={groupName}>
                    {/* Group Header */}
                    <div className="flex items-center sticky top-0 bg-base-200/90 backdrop-blur px-3 py-1.5 border-b border-base-300">
                      <button type="button" className="flex-1 flex items-center gap-1.5 text-xs font-semibold text-base-content/70" onClick={() => toggleGroup(groupName)}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {groupName}
                        <span className="badge badge-xs">{props.length}</span>
                      </button>
                      {!isEditMode && (
                        <button
                          type="button"
                          className="text-[10px] text-primary hover:underline"
                          onClick={() => toggleGroupAll(groupName)}
                        >
                          {allGroupSelected ? '取消' : '全选'}
                        </button>
                      )}
                    </div>

                    {/* Properties in group */}
                    {isExpanded && props.map((p) => {
                      const isSelected = selectedPropertyIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs border-b border-base-200 transition-all ${
                            isSelected ? 'bg-primary/5' : 'hover:bg-base-200/50'
                          } ${isEditMode ? 'cursor-default' : ''}`}
                          onClick={() => !isEditMode && toggleProperty(p.id)}
                          disabled={isEditMode}
                        >
                          {!isEditMode && (
                            isSelected
                              ? <CheckSquare size={14} className="text-primary flex-shrink-0" />
                              : <Square size={14} className="opacity-30 flex-shrink-0" />
                          )}
                          <span className="truncate">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {grouped.size === 0 && (
                <div className="p-4 text-center text-xs opacity-50">无匹配物业</div>
              )}
            </div>

            {/* Selection summary */}
            {selectedPropertyIds.length > 0 && (
              <div className="text-xs text-primary mt-1.5 font-medium">
                ✓ 已选 {selectedPropertyIds.length} 个物业
              </div>
            )}
          </div>

          {/* ===== Tenant Selection (single property only) ===== */}
          {selectedPropertyIds.length === 1 && (
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs font-semibold">👤 选择租户</span></label>
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
                  {/* Batch option */}
                  {!isEditMode && occupiedFloors.length > 1 && (
                    <button
                      type="button"
                      className={`btn btn-sm w-full mb-2 gap-2 ${tenantMode === 'all' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={handleAllTenantsMode}
                    >
                      <Users size={14} />
                      所有租户一键创建 ({occupiedFloors.length} 个)
                    </button>
                  )}

                  <div className="space-y-1.5">
                    {currentFloorUnits.map((fu) => {
                      if (!fu.tenant_name) return null;
                      const isSelected = tenantMode === 'single' && selectedTenantId === fu.id;
                      return (
                        <button
                          key={fu.id}
                          type="button"
                          className={`w-full text-left p-2.5 rounded-lg border transition-all text-sm ${
                            isSelected
                              ? 'border-primary bg-primary/10 ring-1 ring-primary'
                              : tenantMode === 'all'
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

                  {tenantMode === 'all' && (
                    <div className="text-xs text-primary mt-1 flex items-center gap-1">
                      <Users size={12} /> 将为以上 {occupiedFloors.length} 个租户各创建独立排程
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Multi-property batch info */}
          {selectedPropertyIds.length > 1 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-primary">
              <div className="flex items-center gap-1.5 font-semibold mb-1">
                <Users size={14} /> 批量创建模式
              </div>
              <p>将为 <b>{selectedPropertyIds.length}</b> 个物业的所有租户各创建独立排程（每个租户使用其现有租金金额）</p>
            </div>
          )}

          {/* Amount - only for single tenant */}
          {selectedPropertyIds.length === 1 && tenantMode === 'single' && (
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
          {(selectedPropertyIds.length > 1 || tenantMode === 'all') && (
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
                  onChange={(e) => setForm({ ...form, generate_day: Math.min(31, Math.max(0, Number(e.target.value))) })}
                  min={0}
                  max={31}
                  placeholder="0"
                />
                <span className="text-xs opacity-60 whitespace-nowrap">号</span>
              </div>
              <span className="text-[10px] opacity-40 mt-0.5">{form.generate_day === 0 ? '到期当天生成' : form.generate_day < form.due_day ? '当月生成' : form.generate_day === form.due_day ? '到期当天生成' : '上月提前生成'}</span>
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
              <label className="label py-1"><span className="label-text text-xs">🔔 逾期提醒日 <span className="text-[10px] opacity-50">(可多天，逗号分隔)</span></span></label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={form.reminder_day}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9,，]/g, '').replace(/，/g, ',');
                    setForm({ ...form, reminder_day: v });
                  }}
                  placeholder="如 5,10,15"
                />
                <span className="text-xs opacity-60 whitespace-nowrap">号</span>
              </div>
              <span className="text-[10px] opacity-40 mt-0.5">{(() => {
                const days = form.reminder_day.split(',').map(d => parseInt(d.trim())).filter(d => d > 0 && d <= 31);
                return days.length === 0 ? '不提醒' : `每月${days.join('、')}号发送`;
              })()}</span>
            </div>
          </div>

          {/* Templates — split by type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">📄 账单模板</span></label>
              <select
                className="select select-bordered select-sm w-full"
                value={form.template_id}
                onChange={(e) => setForm({ ...form, template_id: Number(e.target.value) })}
              >
                <option value={0}>不使用模板</option>
                {templates.filter(t => t.template_type === 'billing' || !t.template_type).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <span className="text-[10px] opacity-40 mt-0.5">生成账单时使用</span>
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">🔔 提醒模板</span></label>
              <select
                className="select select-bordered select-sm w-full"
                value={form.reminder_template_id}
                onChange={(e) => setForm({ ...form, reminder_template_id: Number(e.target.value) })}
              >
                <option value={0}>不使用模板</option>
                {templates.filter(t => t.template_type === 'reminder' || !t.template_type).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <span className="text-[10px] opacity-40 mt-0.5">逾期提醒时使用</span>
            </div>
          </div>

          {/* Active toggle */}
          {selectedPropertyIds.length <= 1 && tenantMode === 'single' && (
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
              <p>📄 {form.generate_day > form.due_day ? '上月' : '每月'} <b>{form.generate_day} 号</b> → 生成账单</p>
            ) : (
              <p>📄 每月 <b>{form.due_day} 号</b> → 到期当天生成账单</p>
            )}
            <p>📅 每月 <b>{form.due_day} 号</b> → 账单到期日</p>
            {form.grace_days > 0 && (
              <p>⏳ 到期后 <b>{form.grace_days} 天</b> → 宽限期截止</p>
            )}
            {(() => {
              const days = String(form.reminder_day || '').split(',').map(d => parseInt(d.trim())).filter(d => d > 0 && d <= 31);
              return days.length > 0 ? (
                <p>🔔 每月 <b>{days.join('、')} 号</b> → 发送逾期提醒</p>
              ) : null;
            })()}
            <p className="text-[10px] text-base-content/40 pt-1">
              渠道: {CHANNEL_TYPES.find((c) => c.value === form.channel)?.label}
              {selectedPropertyIds.length > 1 && ` · ${selectedPropertyIds.length} 个物业`}
              {selectedPropertyIds.length === 1 && tenantMode === 'all' && ` · ${occupiedFloors.length} 个租户`}
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary btn-sm w-full"
            disabled={saving || !canSubmit}
          >
            {saving ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              submitLabel
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
