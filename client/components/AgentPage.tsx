import React, { useState, useEffect, useCallback } from 'react';
import { Briefcase, Plus, Edit2, Trash2, Save, X, MapPin, Navigation, MessageSquare, Phone, Send, ExternalLink, ChevronDown, ChevronRight, Search, Building2, Users } from 'lucide-react';
import { Agent, Property, FloorUnit } from '../types';
import { getAgents, saveAgent, deleteAgent, getProperties, getAllFloorUnits } from '../utils/db';

type AgentTab = 'list' | 'vacant';

interface AreaGroup {
  area: string;
  properties: Array<{
    property: Property;
    vacantFloors: FloorUnit[];
    matchedAgents: Agent[];
  }>;
  allMatchedAgents: Agent[];
}

function formatPhone(phone: string): string {
  if (!phone) return '';
  let p = phone.replace(/[\s\-()]/g, '');
  if (p.startsWith('+')) p = p.substring(1);
  else if (p.startsWith('0')) p = '60' + p.substring(1);
  else if (!p.startsWith('60')) p = '60' + p;
  return p;
}

function buildVacancyMessage(property: Property, vacantFloors: FloorUnit[]): string {
  const lines = [
    `🏢 空置物业通知`,
    ``,
    `物业: ${property.name}`,
    `地址: ${property.address || '未填写'}`,
  ];
  if (vacantFloors.length > 0) {
    lines.push(`空置楼层: ${vacantFloors.map(f => f.floor_label || `第${f.floor_number}层`).join(', ')}`);
  }
  if (property.area_sqft) lines.push(`面积: ${property.area_sqft} sqft`);
  if (property.rental_price) lines.push(`参考月租: RM ${Number(property.rental_price).toLocaleString()}`);
  lines.push(``, `如有合适租户请联系我们，谢谢！`, `— Vencos Property Management`);
  return lines.join('\n');
}

function openWhatsApp(phone: string, message: string) {
  const formatted = formatPhone(phone);
  if (!formatted) return;
  const url = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

export const AgentPage: React.FC<{ refreshKey?: number }> = ({ refreshKey }) => {
  const [tab, setTab] = useState<AgentTab>('list');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // Agent form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', whatsapp: '', email: '', company: '', areas: '', status: 'active', notes: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);

  // Vacant state
  const [areaGroups, setAreaGroups] = useState<AreaGroup[]>([]);
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [vacantLoading, setVacantLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [vacantCount, setVacantCount] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const ag = await getAgents();
      setAgents(ag);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  // Load vacant properties when switching to vacant tab
  useEffect(() => {
    if (tab === 'vacant') loadVacant();
  }, [tab]);

  async function loadVacant() {
    setVacantLoading(true);
    try {
      const [allProps, allFloors, allAgents] = await Promise.all([
        getProperties(), getAllFloorUnits(), getAgents()
      ]);

      // Find vacant properties/floors
      const vacantData: Array<{ property: Property; vacantFloors: FloorUnit[] }> = [];
      for (const p of allProps) {
        const floors = allFloors.filter(f => f.property_id === p.id);
        const vacant = floors.filter(f => f.status === 'vacant');
        if (vacant.length > 0 || (p.status === 'available' && floors.length === 0)) {
          vacantData.push({ property: p, vacantFloors: vacant });
        }
      }
      setVacantCount(vacantData.length);

      // Extract all unique areas from agents
      const agentAreas = new Map<string, Agent[]>(); // area keyword -> agents
      for (const a of allAgents) {
        if (!a.areas || a.status !== 'active') continue;
        const areas = a.areas.split(',').map(x => x.trim()).filter(Boolean);
        for (const area of areas) {
          const key = area.toLowerCase();
          if (!agentAreas.has(key)) agentAreas.set(key, []);
          agentAreas.get(key)!.push(a);
        }
      }

      // Group vacant properties by area
      const groupMap = new Map<string, AreaGroup>();
      const ungrouped: AreaGroup['properties'] = [];

      for (const v of vacantData) {
        const addr = v.property.address?.toLowerCase() || '';
        let matched = false;

        for (const [areaKey, areaAgents] of agentAreas.entries()) {
          if (addr.includes(areaKey)) {
            matched = true;
            // Use original case from first agent's area
            const displayArea = areaAgents[0].areas.split(',')
              .map(x => x.trim())
              .find(x => x.toLowerCase() === areaKey) || areaKey;

            if (!groupMap.has(areaKey)) {
              groupMap.set(areaKey, { area: displayArea, properties: [], allMatchedAgents: [] });
            }
            const group = groupMap.get(areaKey)!;
            group.properties.push({ ...v, matchedAgents: areaAgents });
            // Dedupe agents
            for (const a of areaAgents) {
              if (!group.allMatchedAgents.find(x => x.id === a.id)) {
                group.allMatchedAgents.push(a);
              }
            }
          }
        }

        if (!matched) {
          ungrouped.push({ ...v, matchedAgents: [] });
        }
      }

      // Build final groups array
      const groups = Array.from(groupMap.values());
      // Sort by number of properties descending
      groups.sort((a, b) => b.properties.length - a.properties.length);

      // Add ungrouped as "其他区域"
      if (ungrouped.length > 0) {
        groups.push({ area: '其他区域（未匹配中介）', properties: ungrouped, allMatchedAgents: [] });
      }

      setAreaGroups(groups);
      // Auto-expand all areas
      setExpandedAreas(new Set(groups.map(g => g.area)));
    } catch (e) { console.error(e); }
    setVacantLoading(false);
  }

  function openForm(a?: Agent) {
    if (a) {
      setEditing(a);
      setForm({ name: a.name, phone: a.phone, whatsapp: a.whatsapp, email: a.email, company: a.company, areas: a.areas, status: a.status, notes: a.notes });
    } else {
      setEditing(null);
      setForm({ name: '', phone: '', whatsapp: '', email: '', company: '', areas: '', status: 'active', notes: '' });
    }
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('请输入中介名称'); return; }
    setSaving(true);
    try {
      await saveAgent({
        id: editing?.id,
        name: form.name.trim(), phone: form.phone.trim(), whatsapp: form.whatsapp.trim(),
        email: form.email.trim(), company: form.company.trim(), areas: form.areas.trim(),
        status: form.status, notes: form.notes.trim(),
      });
      setShowForm(false);
      setEditing(null);
      await loadData();
    } catch (e) { showToast('保存失败'); }
    setSaving(false);
  }

  async function confirmDelete() {
    if (!deleteModal) return;
    try {
      await deleteAgent(deleteModal.id);
      setDeleteModal(null);
      await loadData();
    } catch (e) { showToast('删除失败'); }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function toggleArea(area: string) {
    setExpandedAreas(prev => {
      const n = new Set(prev);
      n.has(area) ? n.delete(area) : n.add(area);
      return n;
    });
  }

  // Build message for all vacant properties in an area
  function buildAreaMessage(group: AreaGroup): string {
    const lines = [`🏢 ${group.area} - 空置物业列表`, ``];
    for (const p of group.properties) {
      lines.push(`📍 ${p.property.name}`);
      lines.push(`   地址: ${p.property.address || '未填写'}`);
      if (p.vacantFloors.length > 0) {
        lines.push(`   空置: ${p.vacantFloors.map(f => f.floor_label || `第${f.floor_number}层`).join(', ')}`);
      }
      if (p.property.rental_price) lines.push(`   参考月租: RM ${Number(p.property.rental_price).toLocaleString()}`);
      lines.push(``);
    }
    lines.push(`如有合适租户请联系我们，谢谢！`, `— Vencos Property Management`);
    return lines.join('\n');
  }

  // Build message for ALL vacant properties
  function buildAllMessage(): string {
    const lines = [`🏢 全部空置物业列表`, ``];
    for (const group of areaGroups) {
      lines.push(`📌 ${group.area}`);
      for (const p of group.properties) {
        lines.push(`  📍 ${p.property.name} - ${p.property.address || '未填写'}`);
        if (p.vacantFloors.length > 0) {
          lines.push(`     空置: ${p.vacantFloors.map(f => f.floor_label || `第${f.floor_number}层`).join(', ')}`);
        }
        if (p.property.rental_price) lines.push(`     参考月租: RM ${Number(p.property.rental_price).toLocaleString()}`);
      }
      lines.push(``);
    }
    lines.push(`如有合适租户请联系我们，谢谢！`, `— Vencos Property Management`);
    return lines.join('\n');
  }

  function handleSendToAgent(agent: Agent, message: string) {
    const phone = agent.whatsapp || agent.phone;
    if (!phone) { showToast('该中介没有电话/WhatsApp号码'); return; }
    openWhatsApp(phone, message);
  }

  function handleAreaSend(group: AreaGroup) {
    const msg = buildAreaMessage(group);
    const targets = group.allMatchedAgents.filter(a => a.whatsapp || a.phone);
    if (targets.length === 0) { showToast('该区域没有可发送的中介'); return; }
    // Open each agent in new tab
    for (const a of targets) {
      const phone = a.whatsapp || a.phone;
      openWhatsApp(phone, msg);
    }
    showToast(`已打开 ${targets.length} 个 WhatsApp 窗口`);
  }

  function handleSendAll() {
    const msg = buildAllMessage();
    const allTargets = new Map<number, Agent>();
    for (const g of areaGroups) {
      for (const a of g.allMatchedAgents) {
        if ((a.whatsapp || a.phone) && !allTargets.has(a.id)) allTargets.set(a.id, a);
      }
    }
    if (allTargets.size === 0) { showToast('没有可发送的中介'); return; }
    for (const a of allTargets.values()) {
      openWhatsApp(a.whatsapp || a.phone, msg);
    }
    showToast(`已打开 ${allTargets.size} 个 WhatsApp 窗口`);
  }

  // Filter area groups by search
  const filteredGroups = searchTerm
    ? areaGroups.map(g => ({
        ...g,
        properties: g.properties.filter(p =>
          p.property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.property.address || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      })).filter(g => g.properties.length > 0)
    : areaGroups;

  if (loading) {
    return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md" /></div>;
  }

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex bg-base-100 rounded-xl p-1 shadow-sm border border-base-200">
        {([
          { key: 'list' as AgentTab, label: '中介列表', icon: <Users size={13} />, count: agents.filter(a => a.status === 'active').length },
          { key: 'vacant' as AgentTab, label: '空置物业', icon: <Building2 size={13} />, count: vacantCount },
        ]).map(t => (
          <button key={t.key}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.key ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-base-content/70'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
            {t.count > 0 && (
              <span className={`badge badge-xs ${tab === t.key ? 'badge-ghost text-primary-content' : 'badge-primary'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="bg-info/10 border border-info/30 text-info rounded-lg px-3 py-2 text-xs font-medium animate-pulse">
          {toast}
        </div>
      )}

      {/* ===== AGENT LIST TAB ===== */}
      {tab === 'list' && (
        <div className="space-y-3">
          {/* Agent Form */}
          {showForm && (
            <div className="bg-base-100 rounded-xl p-4 shadow-sm border-2 border-primary/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm">{editing ? '编辑中介' : '新增中介'}</h4>
                <button className="btn btn-xs btn-ghost" onClick={() => { setShowForm(false); setEditing(null); }}>
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">名称 *</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="中介姓名" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">公司</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="中介公司" value={form.company}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">电话</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="手机号码" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">WhatsApp</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="WhatsApp 号码" value={form.whatsapp}
                    onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0.5"><span className="label-text text-xs">邮箱</span></label>
                  <input type="email" autoCapitalize="none" className="input input-bordered input-sm w-full" placeholder="选填" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0.5"><span className="label-text text-xs">📍 负责区域 (用逗号分隔)</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="如: Jenjarom, Nilai, Klang" value={form.areas}
                    onChange={e => setForm(f => ({ ...f, areas: e.target.value }))} />
                  <label className="label py-0"><span className="label-text-alt text-xs text-base-content/50">
                    系统会根据物业地址自动匹配含有这些关键词的区域
                  </span></label>
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0.5"><span className="label-text text-xs">备注</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="选填" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              {editing && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className={`toggle toggle-sm ${form.status === 'active' ? 'toggle-success' : 'toggle-error'}`}
                    checked={form.status === 'active'}
                    onChange={e => setForm(f => ({ ...f, status: e.target.checked ? 'active' : 'inactive' }))} />
                  <span className={`text-xs font-medium ${form.status === 'active' ? 'text-success' : 'text-error'}`}>
                    {form.status === 'active' ? '✅ 活跃' : '🚫 停用'}
                  </span>
                </label>
              )}
              <div className="flex gap-2 justify-end">
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setEditing(null); }}>取消</button>
                <button className="btn btn-primary btn-sm gap-1" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="loading loading-spinner loading-xs" /> : <Save size={12} />}
                  保存
                </button>
              </div>
            </div>
          )}

          {/* Agent Cards */}
          {agents.length === 0 ? (
            <div className="text-center py-8 text-base-content/40">
              <Briefcase size={32} className="mx-auto mb-2" />
              <p className="text-sm">暂无中介</p>
              <p className="text-xs mt-1">添加中介并设置负责区域，空置物业会自动匹配</p>
            </div>
          ) : (
            agents.map(a => (
              <div key={a.id} className={`bg-base-100 rounded-xl p-3 shadow-sm border border-base-200 space-y-1.5 ${a.status !== 'active' ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">🤝</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{a.name}</p>
                      <div className="flex items-center gap-2 text-xs text-base-content/60 flex-wrap">
                        {a.company && <span>{a.company}</span>}
                        {a.status !== 'active' && <span className="badge badge-xs badge-error">停用</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {(a.whatsapp || a.phone) && (
                      <button className="btn btn-xs btn-success btn-outline gap-0.5"
                        onClick={() => openWhatsApp(a.whatsapp || a.phone, `你好 ${a.name}，这里是 Vencos Property Management。`)}>
                        <MessageSquare size={10} />
                      </button>
                    )}
                    <button className="btn btn-xs btn-ghost" onClick={() => openForm(a)}><Edit2 size={12} /></button>
                    <button className="btn btn-xs btn-ghost text-error" onClick={() => setDeleteModal({ id: a.id, name: a.name })}><Trash2 size={12} /></button>
                  </div>
                </div>
                {(a.phone || a.whatsapp || a.email) && (
                  <div className="flex gap-3 text-xs text-base-content/50 flex-wrap">
                    {a.phone && <span>📞 {a.phone}</span>}
                    {a.whatsapp && <span className="text-success">💬 {a.whatsapp}</span>}
                    {a.email && <span>✉️ {a.email}</span>}
                  </div>
                )}
                {a.areas && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {a.areas.split(',').map((area, i) => (
                      <span key={i} className="badge badge-xs badge-outline badge-primary">
                        <MapPin size={8} className="mr-0.5" /> {area.trim()}
                      </span>
                    ))}
                  </div>
                )}
                {a.notes && <p className="text-xs text-base-content/40 truncate">📝 {a.notes}</p>}
              </div>
            ))
          )}

          {!showForm && (
            <button className="btn btn-primary btn-sm w-full gap-1" onClick={() => openForm()}>
              <Plus size={14} /> 新增中介
            </button>
          )}
        </div>
      )}

      {/* ===== VACANT PROPERTIES TAB ===== */}
      {tab === 'vacant' && (
        <div className="space-y-3">
          {/* Search + refresh */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
              <input className="input input-bordered input-sm w-full pl-9" placeholder="搜索物业名称或地址..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button className="btn btn-sm btn-outline gap-1" onClick={loadVacant} disabled={vacantLoading}>
              {vacantLoading ? <span className="loading loading-spinner loading-xs" /> : <Navigation size={14} />}
              刷新
            </button>
          </div>

          {vacantLoading ? (
            <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md" /></div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-8 text-base-content/40">
              <Building2 size={32} className="mx-auto mb-2" />
              <p className="text-sm">🎉 目前没有空置物业</p>
              <p className="text-xs mt-1">所有物业都已出租</p>
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div className="bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium">
                  📊 {vacantCount} 个空置物业 · {filteredGroups.length} 个区域
                </span>
                {agents.filter(a => a.status === 'active' && (a.whatsapp || a.phone)).length > 0 && (
                  <button className="btn btn-xs btn-success gap-1" onClick={handleSendAll}>
                    <Send size={10} /> 一键群发全部
                  </button>
                )}
              </div>

              {/* Area groups */}
              {filteredGroups.map((group, gi) => (
                <div key={gi} className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
                  {/* Area header */}
                  <button
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-base-200/50 transition-colors"
                    onClick={() => toggleArea(group.area)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {expandedAreas.has(group.area) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <MapPin size={14} className="text-primary shrink-0" />
                      <span className="font-semibold text-sm truncate">{group.area}</span>
                      <span className="badge badge-xs badge-warning">{group.properties.length} 空置</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {group.allMatchedAgents.length > 0 && (
                        <span className="badge badge-xs badge-success gap-0.5">
                          <Users size={8} /> {group.allMatchedAgents.length} 中介
                        </span>
                      )}
                      {group.allMatchedAgents.length > 0 && (
                        <button className="btn btn-xs btn-success btn-outline gap-0.5"
                          onClick={(e) => { e.stopPropagation(); handleAreaSend(group); }}>
                          <Send size={10} /> 群发
                        </button>
                      )}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {expandedAreas.has(group.area) && (
                    <div className="border-t border-base-200 px-3 py-2 space-y-2">
                      {/* Matched agents for this area */}
                      {group.allMatchedAgents.length > 0 && (
                        <div className="bg-success/5 rounded-lg px-2.5 py-2 space-y-1">
                          <p className="text-xs font-semibold text-success">✅ 负责中介:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.allMatchedAgents.map(a => (
                              <div key={a.id} className="flex items-center gap-1 bg-base-100 rounded-full px-2 py-0.5 border border-base-200">
                                <span className="text-xs font-medium">{a.name}</span>
                                {(a.whatsapp || a.phone) && (
                                  <button className="text-success hover:text-success/70"
                                    onClick={() => {
                                      const msg = buildAreaMessage(group);
                                      handleSendToAgent(a, msg);
                                    }}>
                                    <MessageSquare size={11} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Properties */}
                      {group.properties.map((p, pi) => (
                        <div key={pi} className="border border-base-200 rounded-lg px-2.5 py-2 space-y-1">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-xs truncate">{p.property.name}</p>
                              <p className="text-[10px] text-base-content/50 truncate">{p.property.address}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              {p.property.rental_price && (
                                <span className="badge badge-xs badge-ghost">RM {Number(p.property.rental_price).toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                          {p.vacantFloors.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {p.vacantFloors.map((f, fi) => (
                                <span key={fi} className="badge badge-xs badge-warning badge-outline">
                                  {f.floor_label || `第${f.floor_number}层`} 空置
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Individual send buttons for this property */}
                          {p.matchedAgents.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {p.matchedAgents.map(a => (
                                (a.whatsapp || a.phone) && (
                                  <button key={a.id} className="btn btn-xs btn-outline btn-success gap-0.5"
                                    onClick={() => {
                                      const msg = buildVacancyMessage(p.property, p.vacantFloors);
                                      handleSendToAgent(a, msg);
                                    }}>
                                    <MessageSquare size={9} /> {a.name}
                                  </button>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* WhatsApp info */}
              <div className="bg-success/5 border border-success/20 rounded-lg px-3 py-2">
                <p className="text-xs text-success">
                  💬 点击发送按钮会直接打开 WhatsApp 对话窗口，消息已预填好，你确认后发送即可。
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={() => setDeleteModal(null)}>
          <div className="bg-base-100 rounded-xl p-5 shadow-xl max-w-xs w-full mx-4 space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold">确定删除中介「{deleteModal.name}」？</p>
            <p className="text-xs text-base-content/60">此操作不可撤销</p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-sm btn-ghost" onClick={() => setDeleteModal(null)}>取消</button>
              <button className="btn btn-sm btn-error" onClick={confirmDelete}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
