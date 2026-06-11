import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Mail, MessageSquare, Calendar, Power, PowerOff, Trash2, Edit2, Wifi, WifiOff, Bell, Building2, User, Shield, Key, Users, UserPlus, Save, X, Eye, EyeOff, Send, CheckCircle, XCircle, Clock, LogOut, MapPin, Briefcase, Phone, Navigation } from 'lucide-react';
import { MessageTemplate, BillingSchedule, Owner, SystemUser, UserRole, Agent, CHANNEL_TYPES, REMINDER_OPTIONS, OWNER_TYPES, USER_ROLES } from '../types';
import { getTemplates, deleteTemplate, getSchedules, deleteSchedule, toggleSchedule, getOwners, deleteOwner, getSystemUsers, saveSystemUser, deleteSystemUser, getWhatsAppConfig, saveWhatsAppConfig, getMessageLog, getProperties, addUserAccess, addUserOwnerAccess, forceLogoutUser, getAgents, saveAgent, deleteAgent, getAgentsByArea, getAllFloorUnits, getPenaltyConfigs, savePenaltyConfig, deletePenaltyConfig } from '../utils/db';
import { PenaltyConfig } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { sendWhatsAppMessage } from '../utils/whatsapp';

type SettingsTab = 'templates' | 'schedules' | 'integrations' | 'owners' | 'users_permissions' | 'penalty';

interface SettingsPageProps {
  onAddTemplate: () => void;
  onEditTemplate: (t: MessageTemplate) => void;
  onAddSchedule: () => void;
  onEditSchedule: (s: BillingSchedule) => void;
  onAddOwner: () => void;
  onEditOwner: (o: Owner) => void;
  onManageUserAccess: (u: SystemUser) => void;
  refreshKey: number;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onAddTemplate, onEditTemplate, onAddSchedule, onEditSchedule,
  onAddOwner, onEditOwner, onManageUserAccess,
  refreshKey,
}) => {
  const [tab, setTabState] = useState<SettingsTab>(() => {
    const saved = localStorage.getItem('vencos_settingsTab');
    return (saved && ['templates', 'schedules', 'integrations', 'owners', 'users_permissions', 'penalty'].includes(saved)) ? saved as SettingsTab : 'owners';
  });
  const setTab = (t: SettingsTab) => { setTabState(t); localStorage.setItem('vencos_settingsTab', t); };
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [schedules, setSchedules] = useState<BillingSchedule[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);

  // WhatsApp config state
  const [waConfig, setWaConfig] = useState({ phone_number_id: '', access_token: '', business_id: '' });
  const [waActive, setWaActive] = useState(false);
  const [waLoaded, setWaLoaded] = useState(false);
  const [waSaving, setWaSaving] = useState(false);
  const [waShowToken, setWaShowToken] = useState(false);
  const [waToast, setWaToast] = useState('');
  const [msgLog, setMsgLog] = useState<Array<{id: number; recipient_phone: string; recipient_name: string; message_type: string; content: string; status: string; error_message: string; created_at: string}>>([]);

  // Agent state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentForm, setAgentForm] = useState({
    name: '', phone: '', whatsapp: '', email: '', company: '', areas: '', status: 'active', notes: '',
  });
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentToast, setAgentToast] = useState('');
  const [showVacantMatch, setShowVacantMatch] = useState(false);
  const [vacantMatches, setVacantMatches] = useState<Array<{property: any; matchedAgents: Agent[]; allAgents: Agent[]}>>([]);
  const [agentSending, setAgentSending] = useState<Record<string, boolean>>({});
  const [agentSendResult, setAgentSendResult] = useState<Record<string, 'success' | 'failed'>>({});
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Properties for penalty config dropdown
  const [properties, setProperties] = useState<{id: number; name: string}[]>([]);
  // Penalty config state
  const [penaltyConfigs, setPenaltyConfigs] = useState<PenaltyConfig[]>([]);
  const [showPenaltyForm, setShowPenaltyForm] = useState(false);
  const [editingPenalty, setEditingPenalty] = useState<PenaltyConfig | null>(null);
  const [penaltyForm, setPenaltyForm] = useState({ property_id: 0, rate_pct: 10, grace_days: 0, calc_method: 'monthly_pct', min_amount: 0, max_amount: 0, enabled: 1 });

  const showWaToast = useCallback((msg: string) => {
    setWaToast(msg);
    setTimeout(() => setWaToast(''), 3000);
  }, []);

  // User form state
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [userForm, setUserForm] = useState({
    username: '', pin: '', role: '' as UserRole | '', phone: '', name: '', email: '', notes: '', must_change_pin: true, active: true, grantAllCompanies: false,
  });
  const [userSaving, setUserSaving] = useState(false);
  const [userToast, setUserToast] = useState('');

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  async function loadData() {
    setLoading(true);
    try {
      const [t, s, o, u, waCfg, logs, ag, pc] = await Promise.all([
        getTemplates(), getSchedules(), getOwners(), getSystemUsers(),
        getWhatsAppConfig(), getMessageLog(20), getAgents(), getPenaltyConfigs(),
      ]);
      setTemplates(t);
      setSchedules(s);
      setOwners(o);
      setUsers(u);
      if (waCfg) {
        setWaConfig({ phone_number_id: waCfg.phone_number_id, access_token: waCfg.access_token, business_id: waCfg.business_id });
        setWaActive(waCfg.active);
      }
      setPenaltyConfigs(pc);
      try { const allP = await getProperties(); setProperties(allP.map(p => ({ id: p.id, name: p.name }))); } catch {}
      setWaLoaded(true);
      setMsgLog(logs);
      setAgents(ag);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const [deleteModal, setDeleteModal] = useState<{type: string; id: number; msg: string} | null>(null);

  async function handleDeleteConfirm() {
    if (!deleteModal) return;
    const { type, id } = deleteModal;
    setDeleteModal(null);
    if (type === 'template') await deleteTemplate(id);
    else if (type === 'schedule') await deleteSchedule(id);
    else if (type === 'owner') await deleteOwner(id);
    else if (type === 'user') await deleteSystemUser(id);
    else if (type === 'agent') await deleteAgent(id);
    else if ((type as string) === 'penalty') await deletePenaltyConfig(id);
    await loadData();
  }

  function handleDeleteTemplate(id: number) {
    setDeleteModal({ type: 'template', id, msg: '确定删除此模板？' });
  }
  function handleDeleteSchedule(id: number) {
    setDeleteModal({ type: 'schedule', id, msg: '确定删除此排程？' });
  }
  async function handleToggleSchedule(id: number, active: number) {
    await toggleSchedule(id, active ? 0 : 1); await loadData();
  }
  function handleDeleteOwner(id: number) {
    setDeleteModal({ type: 'owner', id, msg: '确定删除此持有人？相关物业将不再关联持有人。' });
  }
  function handleDeleteUser(id: number) {
    setDeleteModal({ type: 'user', id, msg: '确定删除此用户？其物业访问权限也会被清除。' });
  }

  async function handleForceLogout(userId: number, userName: string) {
    if (!confirm(`确定要强制登出「${userName}」吗？该用户需要重新登录。`)) return;
    const ok = await forceLogoutUser(userId);
    if (ok) {
      setUserToast(`已强制登出「${userName}」`);
      setTimeout(() => setUserToast(''), 3000);
    } else {
      setUserToast('操作失败，请重试');
      setTimeout(() => setUserToast(''), 3000);
    }
  }


  // Agent handlers
  function openAgentForm(a?: Agent) {
    if (a) {
      setEditingAgent(a);
      setAgentForm({
        name: a.name, phone: a.phone, whatsapp: a.whatsapp, email: a.email,
        company: a.company, areas: a.areas, status: a.status, notes: a.notes,
      });
    } else {
      setEditingAgent(null);
      setAgentForm({ name: '', phone: '', whatsapp: '', email: '', company: '', areas: '', status: 'active', notes: '' });
    }
    setShowAgentForm(true);
  }

  async function handleSaveAgent() {
    if (!agentForm.name.trim()) {
      setAgentToast('请输入中介名称');
      setTimeout(() => setAgentToast(''), 2000);
      return;
    }
    setAgentSaving(true);
    try {
      await saveAgent({
        id: editingAgent?.id,
        name: agentForm.name.trim(),
        phone: agentForm.phone.trim(),
        whatsapp: agentForm.whatsapp.trim(),
        email: agentForm.email.trim(),
        company: agentForm.company.trim(),
        areas: agentForm.areas.trim(),
        status: agentForm.status,
        notes: agentForm.notes.trim(),
      });
      setShowAgentForm(false);
      setEditingAgent(null);
      setAgentToast('');
      await loadData();
    } catch (e) {
      console.error(e);
      setAgentToast('保存失败');
      setTimeout(() => setAgentToast(''), 2000);
    }
    setAgentSaving(false);
  }

  function handleDeleteAgent(id: number) {
    setDeleteModal({ type: 'agent', id, msg: '确定删除此中介？' });
  }

  async function handleMatchVacant() {
    setShowVacantMatch(true);
    try {
      const allProps = await getProperties();
      const allFloors = await getAllFloorUnits();
      const allAg = await getAgents();
      // Find properties with at least one vacant floor
      const vacantProps = allProps.filter(p => {
        const floors = allFloors.filter(f => f.property_id === p.id);
        return floors.some(f => f.status === 'vacant') || (p.status === 'available' && floors.length === 0);
      });
      const matches = vacantProps.map(p => {
        const addrLower = p.address.toLowerCase();
        const matched = allAg.filter(a => {
          if (!a.areas || a.status !== 'active') return false;
          const areas = a.areas.split(',').map(x => x.trim().toLowerCase());
          return areas.some(area => area && addrLower.includes(area));
        });
        return { property: p, matchedAgents: matched, allAgents: allAg };
      });
      setVacantMatches(matches);
    } catch (e) {
      console.error(e);
    }
  }

  function openUserForm(u?: SystemUser) {
    if (u) {
      setEditingUser(u);
      setUserForm({
        username: u.username, pin: '', role: u.role, phone: u.phone,
        name: u.name, email: u.email, notes: u.notes, must_change_pin: false, active: u.active === 1, grantAllCompanies: false,
      });
    } else {
      setEditingUser(null);
      setUserForm({ username: '', pin: '', role: '', phone: '', name: '', email: '', notes: '', must_change_pin: true, active: true, grantAllCompanies: false });
    }
    setShowUserForm(true);
  }

  async function handleSaveUser() {
    if (!userForm.name.trim()) {
      setUserToast('请输入用户名称');
      setTimeout(() => setUserToast(''), 2000);
      return;
    }
    if (!userForm.role) {
      setUserToast('请选择用户角色');
      setTimeout(() => setUserToast(''), 2000);
      return;
    }
    if (!editingUser && !userForm.pin.trim()) {
      setUserToast('新用户必须设置密码');
      setTimeout(() => setUserToast(''), 2000);
      return;
    }
    setUserSaving(true);
    try {
      const savedId = await saveSystemUser({
        id: editingUser?.id,
        username: userForm.username.trim(),
        pin: userForm.pin.trim() || undefined,
        role: userForm.role as UserRole,
        phone: userForm.phone.trim(),
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        notes: userForm.notes.trim(),
        must_change_pin: userForm.must_change_pin ? 1 : 0,
        active: userForm.active ? 1 : 0,
      });
      // Auto-grant all company access for admin/stakeholder
      if (userForm.grantAllCompanies && (userForm.role === 'admin' || userForm.role === 'stakeholder')) {
        try {
          for (const o of owners) {
            await addUserOwnerAccess(savedId, o.id, 'full');
          }
        } catch (e) { console.error('Failed to grant company access:', e); }
      }
      setShowUserForm(false);
      setEditingUser(null);
      setUserToast('');
      await loadData();
    } catch (e) {
      console.error(e);
      setUserToast('保存失败');
      setTimeout(() => setUserToast(''), 2000);
    }
    setUserSaving(false);
  }

  function channelIcon(ch: string) {
    if (ch === 'whatsapp') return <MessageSquare size={14} className="text-success" />;
    if (ch === 'email') return <Mail size={14} className="text-info" />;
    return <><MessageSquare size={14} className="text-success" /><Mail size={14} className="text-info" /></>;
  }
  function channelLabel(ch: string) {
    return CHANNEL_TYPES.find((c) => c.value === ch)?.label || ch;
  }
  function reminderLabel(days: number) {
    return REMINDER_OPTIONS.find((r) => r.value === String(days))?.label || `提前${days}天`;
  }

  const formatLastLogin = (dt: string) => {
    if (!dt) return '从未登录';
    try {
      const d = new Date(dt);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return diffMins + ' 分钟前';
      if (diffHours < 24) return diffHours + ' 小时前';
      if (diffDays < 7) return diffDays + ' 天前';
      return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } catch { return dt; }
  };

  const roleIcon = (r: string) => r === 'super_admin' ? '👑' : r === 'admin' ? '🛡️' : r === 'stakeholder' ? '📊' : r === 'tenant' ? '🏠' : r === 'worker' ? '🔧' : '👤';
  const roleLabel = (r: string) => USER_ROLES.find(ur => ur.value === r)?.label || r;
  const roleBadgeColor = (r: string) => r === 'super_admin' ? 'badge-warning' : r === 'admin' ? 'badge-success' : r === 'stakeholder' ? 'badge-info' : r === 'tenant' ? 'badge-primary' : 'badge-ghost';

  if (loading) {
    return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md" /></div>;
  }


  // Build vacancy notification message for agents
  function buildVacancyMessage(property: any, agent: Agent): string {
    const lines = [
      `🏢 空置物业通知`,
      ``,
      `物业: ${property.name}`,
      `地址: ${property.address || '未填写'}`,
    ];
    if (property.size_sqft) lines.push(`面积: ${property.size_sqft} sqft`);
    if (property.rental_price) lines.push(`参考月租: RM ${Number(property.rental_price).toLocaleString()}`);
    if (property.property_type) lines.push(`类型: ${property.property_type === 'commercial' ? '商业' : property.property_type === 'residential' ? '住宅' : property.property_type}`);
    lines.push(``, `如有合适租户请联系我们，谢谢！`, `— Vencos Property Management`);
    return lines.join('\n');
  }

  async function handleSendToAgent(property: any, agent: Agent) {
    const phone = agent.whatsapp || agent.phone;
    if (!phone) { setAgentToast('该中介没有电话/WhatsApp号码'); setTimeout(() => setAgentToast(''), 2000); return; }
    const key = `${property.id}-${agent.id}`;
    setAgentSending(prev => ({ ...prev, [key]: true }));
    const message = buildVacancyMessage(property, agent);
    const result = await sendWhatsAppMessage(phone, message, {
      recipientName: agent.name,
      messageType: 'agent_vacancy',
      propertyId: property.id,
    });
    setAgentSending(prev => ({ ...prev, [key]: false }));
    setAgentSendResult(prev => ({ ...prev, [key]: result.success ? 'success' : 'failed' }));
    setAgentToast(result.success ? `✅ 已发送给 ${agent.name}` : `❌ 发送失败: ${result.error}`);
    setTimeout(() => setAgentToast(''), 3000);
  }

  async function handleBatchSendToAgents() {
    const allTargets: Array<{property: any; agent: Agent}> = [];
    for (const m of vacantMatches) {
      const targetAgents = m.matchedAgents.length > 0 ? m.matchedAgents : m.allAgents.filter(a => a.status === 'active');
      for (const a of targetAgents) {
        if (a.whatsapp || a.phone) allTargets.push({ property: m.property, agent: a });
      }
    }
    if (allTargets.length === 0) { setAgentToast('没有可发送的目标'); setTimeout(() => setAgentToast(''), 2000); return; }
    
    let success = 0, failed = 0;
    for (const t of allTargets) {
      const key = `${t.property.id}-${t.agent.id}`;
      setAgentSending(prev => ({ ...prev, [key]: true }));
      const phone = t.agent.whatsapp || t.agent.phone;
      const message = buildVacancyMessage(t.property, t.agent);
      const result = await sendWhatsAppMessage(phone, message, {
        recipientName: t.agent.name,
        messageType: 'agent_vacancy',
        propertyId: t.property.id,
      });
      setAgentSending(prev => ({ ...prev, [key]: false }));
      setAgentSendResult(prev => ({ ...prev, [key]: result.success ? 'success' : 'failed' }));
      if (result.success) success++; else failed++;
    }
    setAgentToast(`群发完成: ✅ ${success} 成功 / ❌ ${failed} 失败`);
    setTimeout(() => setAgentToast(''), 5000);
  }

    const tabItems: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'owners', label: '持有人', icon: <Building2 size={13} /> },
    { key: 'users_permissions', label: '用户与权限', icon: <Shield size={13} /> },
    { key: 'templates', label: '模板', icon: <Mail size={13} /> },
    { key: 'schedules', label: '排程', icon: <Calendar size={13} /> },
    { key: 'integrations', label: '集成', icon: <Wifi size={13} /> },
    { key: 'penalty', label: '罚款', icon: <Bell size={13} /> },
  ];

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex gap-1 bg-base-200 rounded-xl p-1 overflow-x-auto">
        {tabItems.map((t) => (
          <button
            key={t.key}
            className={`flex-1 min-w-0 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap px-2 ${
              tab === t.key ? 'bg-primary text-primary-content' : 'text-base-content'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ===== OWNERS TAB ===== */}
      {tab === 'owners' && (
        <div className="space-y-2">
          <p className="text-xs text-base-content/60">管理物业持有公司或个人，可在物业表单中关联</p>
          {owners.length === 0 ? (
            <div className="text-center py-12 text-base-content/40">
              <Building2 size={40} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无持有人</p>
              <p className="text-xs mt-1">添加持有公司或个人</p>
            </div>
          ) : (
            owners.map((o) => (
              <div key={o.id} className="bg-base-100 rounded-xl p-3 shadow-sm border border-base-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">{o.owner_type === 'company' ? '🏢' : '👤'}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{o.name}</p>
                      <div className="flex items-center gap-2 text-xs text-base-content/60">
                        <span>{OWNER_TYPES.find((t) => t.value === o.owner_type)?.label}</span>
                        {o.registration_no && <span>· {o.registration_no}</span>}
                        {(o.property_count ?? 0) > 0 && <span>· {o.property_count} 物业</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button className="btn btn-xs btn-ghost" onClick={() => onEditOwner(o)}><Edit2 size={12} /></button>
                    <button className="btn btn-xs btn-ghost text-error" onClick={() => handleDeleteOwner(o.id)}><Trash2 size={12} /></button>
                  </div>
                </div>
                {(o.phone || o.email) && (
                  <div className="flex gap-3 mt-1 text-xs text-base-content/60">
                    {o.phone && <span>📞 {o.phone}</span>}
                    {o.email && <span>✉️ {o.email}</span>}
                  </div>
                )}
              </div>
            ))
          )}
          <button className="btn btn-primary btn-sm w-full gap-1" onClick={onAddOwner}>
            <Plus size={16} /> 新增持有人
          </button>
        </div>
      )}

      {/* ===== UNIFIED USERS & PERMISSIONS TAB ===== */}
      {tab === 'users_permissions' && (
        <div className="space-y-3">
          <div className="bg-secondary/5 border border-secondary/20 rounded-lg p-2.5">
            <p className="text-xs text-secondary">
              👥 统一管理所有用户。每个用户一个账户，角色决定权限范围。新用户首次登录需修改密码。
            </p>
          </div>

          {/* User Form (inline) */}
          {showUserForm && (
            <div className="bg-base-100 rounded-xl p-4 shadow-sm border-2 border-primary/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm">{editingUser ? '编辑用户' : '新增用户'}</h4>
                <button className="btn btn-xs btn-ghost" onClick={() => { setShowUserForm(false); setEditingUser(null); }}>
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">名称 *</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="如: 张三" value={userForm.name}
                    onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">角色 *</span></label>
                  <select className="select select-bordered select-sm w-full" value={userForm.role}
                    onChange={e => setUserForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                    <option value="" disabled>请选择角色</option>
                    {USER_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">用户名</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="登录用户名" value={userForm.username}
                    autoCapitalize="off" autoCorrect="off" autoComplete="off"
                    onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">手机号</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="可用手机号登录" value={userForm.phone}
                    onChange={e => setUserForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">邮箱</span></label>
                  <input type="email" autoCapitalize="none" className="input input-bordered input-sm w-full" placeholder="选填" value={userForm.email}
                    onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5">
                    <span className="label-text text-xs">密码 {editingUser ? '(留空不修改)' : '*'}</span>
                  </label>
                  <input type="password" className="input input-bordered input-sm w-full" placeholder="支持数字和字母"
                    value={userForm.pin} onChange={e => setUserForm(f => ({ ...f, pin: e.target.value }))} />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0.5"><span className="label-text text-xs">备注</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="选填" value={userForm.notes}
                    onChange={e => setUserForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                {(userForm.role === 'admin' || userForm.role === 'stakeholder') && (
                  <div className="form-control col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer py-1">
                      <input type="checkbox" className="checkbox checkbox-sm checkbox-primary"
                        checked={userForm.grantAllCompanies}
                        onChange={e => setUserForm(f => ({ ...f, grantAllCompanies: e.target.checked }))} />
                      <span className="text-xs font-medium">授权全部公司访问权</span>
                    </label>
                    <label className="label py-0">
                      <span className="label-text-alt text-xs text-base-content/50">
                        {userForm.grantAllCompanies ? '✅ 保存后将自动授权所有公司的物业' : '保存后可在权限按钮中逐个配置公司'}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Toggles row */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="checkbox checkbox-xs checkbox-primary"
                    checked={userForm.must_change_pin}
                    onChange={e => setUserForm(f => ({ ...f, must_change_pin: e.target.checked }))} />
                  <span className="text-xs text-base-content/70">{editingUser ? '下次登录强制修改密码' : '首次登录强制修改密码'}</span>
                </label>
                {editingUser && editingUser.role !== 'super_admin' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className={`toggle toggle-sm ${userForm.active ? 'toggle-success' : 'toggle-error'}`}
                      checked={userForm.active}
                      onChange={e => setUserForm(f => ({ ...f, active: e.target.checked }))} />
                    <span className={`text-xs font-medium ${userForm.active ? 'text-success' : 'text-error'}`}>
                      {userForm.active ? '✅ 账号启用' : '🚫 账号已停用'}
                    </span>
                  </label>
                )}
              </div>

              {/* Role description */}
              <div className="bg-base-200/50 rounded-lg p-2">
                <p className="text-xs text-base-content/50">
                  {roleIcon(userForm.role)} {USER_ROLES.find(r => r.value === userForm.role)?.desc}
                  {(userForm.role === 'stakeholder' || userForm.role === 'admin') && !userForm.grantAllCompanies && (editingUser ? ' — 可在上方勾选或用权限按钮配置' : ' — 保存后可配置公司访问权限')}
                </p>
              </div>

              {userToast && <div className="text-error text-xs">{userToast}</div>}

              <div className="flex gap-2 justify-end">
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowUserForm(false); setEditingUser(null); }}>取消</button>
                <button className="btn btn-primary btn-sm gap-1" onClick={handleSaveUser} disabled={userSaving}>
                  {userSaving ? <span className="loading loading-spinner loading-xs" /> : <Save size={12} />}
                  保存
                </button>
              </div>
            </div>
          )}

          {/* User List */}
          {users.length === 0 ? (
            <div className="text-center py-8 text-base-content/40">
              <Users size={32} className="mx-auto mb-2" />
              <p className="text-sm">暂无用户</p>
            </div>
          ) : (
            users.map((u) => (
              <div key={u.id} className="bg-base-100 rounded-xl p-3 shadow-sm border border-base-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">{roleIcon(u.role)}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{u.name}</p>
                      <div className="flex items-center gap-2 text-xs text-base-content/60 flex-wrap">
                        <span className={`badge badge-xs ${roleBadgeColor(u.role)}`}>
                          {roleLabel(u.role)}
                        </span>
                        {u.username && <span>@{u.username}</span>}
                        {u.role === 'stakeholder' && <span>· {u.access_count ?? 0} 物业</span>}
                        {u.must_change_pin === 1 && <span className="badge badge-xs badge-outline badge-warning">待改密</span>}
                        <span className="text-base-content/40">· 🕐 {formatLastLogin(u.last_login || '')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {(u.role === 'stakeholder' || u.role === 'admin') && u.role !== 'super_admin' && (
                      <button className="btn btn-xs btn-outline btn-primary gap-0.5" onClick={() => onManageUserAccess(u)} title="管理物业权限">
                        <Key size={11} /> 权限
                      </button>
                    )}
                    <button className="btn btn-xs btn-ghost text-warning" onClick={() => handleForceLogout(u.id, u.name)} title="强制登出"><LogOut size={12} /></button>
                    <button className="btn btn-xs btn-ghost" onClick={() => openUserForm(u)}><Edit2 size={12} /></button>
                    {u.id !== 1 && (
                      <button className="btn btn-xs btn-ghost text-error" onClick={() => handleDeleteUser(u.id)}><Trash2 size={12} /></button>
                    )}
                  </div>
                </div>
                {(u.phone || u.email) && (
                  <div className="flex gap-3 text-xs text-base-content/50">
                    {u.phone && <span>📞 {u.phone}</span>}
                    {u.email && <span>✉️ {u.email}</span>}
                  </div>
                )}
              </div>
            ))
          )}

          {!showUserForm && (
            <button className="btn btn-primary btn-sm w-full gap-1" onClick={() => openUserForm()}>
              <UserPlus size={14} /> 新增用户
            </button>
          )}
        </div>
      )}


      {/* ===== AGENTS TAB ===== */}
      {tab === 'agents' && (
        <div className="space-y-3">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
            <p className="text-xs text-primary">
              🤝 管理物业中介，设置负责区域。系统会自动匹配空置物业给对应区域的中介。
            </p>
          </div>

          {/* Agent Form */}
          {showAgentForm && (
            <div className="bg-base-100 rounded-xl p-4 shadow-sm border-2 border-primary/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm">{editingAgent ? '编辑中介' : '新增中介'}</h4>
                <button className="btn btn-xs btn-ghost" onClick={() => { setShowAgentForm(false); setEditingAgent(null); }}>
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">名称 *</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="中介姓名" value={agentForm.name}
                    onChange={e => setAgentForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">公司</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="中介公司" value={agentForm.company}
                    onChange={e => setAgentForm(f => ({ ...f, company: e.target.value }))} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">电话</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="手机号码" value={agentForm.phone}
                    onChange={e => setAgentForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">WhatsApp</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="WhatsApp 号码" value={agentForm.whatsapp}
                    onChange={e => setAgentForm(f => ({ ...f, whatsapp: e.target.value }))} />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0.5"><span className="label-text text-xs">邮箱</span></label>
                  <input type="email" autoCapitalize="none" className="input input-bordered input-sm w-full" placeholder="选填" value={agentForm.email}
                    onChange={e => setAgentForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0.5"><span className="label-text text-xs">📍 负责区域 (用逗号分隔)</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="如: Jenjarom, Nilai, Klang, Eco Santuari" value={agentForm.areas}
                    onChange={e => setAgentForm(f => ({ ...f, areas: e.target.value }))} />
                  <label className="label py-0"><span className="label-text-alt text-xs text-base-content/50">
                    系统会根据物业地址自动匹配含有这些关键词的区域
                  </span></label>
                </div>
                <div className="form-control col-span-2">
                  <label className="label py-0.5"><span className="label-text text-xs">备注</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="选填" value={agentForm.notes}
                    onChange={e => setAgentForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              {editingAgent && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className={`toggle toggle-sm ${agentForm.status === 'active' ? 'toggle-success' : 'toggle-error'}`}
                    checked={agentForm.status === 'active'}
                    onChange={e => setAgentForm(f => ({ ...f, status: e.target.checked ? 'active' : 'inactive' }))} />
                  <span className={`text-xs font-medium ${agentForm.status === 'active' ? 'text-success' : 'text-error'}`}>
                    {agentForm.status === 'active' ? '✅ 活跃' : '🚫 停用'}
                  </span>
                </label>
              )}
              {agentToast && <div className="text-error text-xs">{agentToast}</div>}
              <div className="flex gap-2 justify-end">
                <button className="btn btn-ghost btn-sm" onClick={() => { setShowAgentForm(false); setEditingAgent(null); }}>取消</button>
                <button className="btn btn-primary btn-sm gap-1" onClick={handleSaveAgent} disabled={agentSaving}>
                  {agentSaving ? <span className="loading loading-spinner loading-xs" /> : <Save size={12} />}
                  保存
                </button>
              </div>
            </div>
          )}

          {/* Agent List */}
          {agents.length === 0 ? (
            <div className="text-center py-8 text-base-content/40">
              <Briefcase size={32} className="mx-auto mb-2" />
              <p className="text-sm">暂无中介</p>
              <p className="text-xs mt-1">添加中介并设置负责区域</p>
            </div>
          ) : (
            agents.map((a) => (
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
                    <button className="btn btn-xs btn-ghost" onClick={() => openAgentForm(a)}><Edit2 size={12} /></button>
                    <button className="btn btn-xs btn-ghost text-error" onClick={() => handleDeleteAgent(a.id)}><Trash2 size={12} /></button>
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

          {!showAgentForm && (
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm flex-1 gap-1" onClick={() => openAgentForm()}>
                <Plus size={14} /> 新增中介
              </button>
              {agents.length > 0 && (
                <button className="btn btn-outline btn-sm flex-1 gap-1" onClick={handleMatchVacant}>
                  <Navigation size={14} /> AI 匹配空置物业
                </button>
              )}
            </div>
          )}

          {/* Vacant Property Matching Results */}
          {showVacantMatch && (
            <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Navigation size={14} className="text-primary" /> 空置物业 → 中介匹配
                </h4>
                <button className="btn btn-xs btn-ghost" onClick={() => setShowVacantMatch(false)}>
                  <X size={14} />
                </button>
              </div>
              {vacantMatches.length === 0 ? (
                <p className="text-xs text-base-content/60 text-center py-4">🎉 目前没有空置物业</p>
              ) : (
                <div className="space-y-3">
                  {vacantMatches.map((m, i) => (
                    <div key={i} className="border border-base-300 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{m.property.name}</p>
                          <p className="text-xs text-base-content/60">{m.property.address}</p>
                        </div>
                        <span className="badge badge-sm badge-warning">空置</span>
                      </div>
                      {m.matchedAgents.length > 0 ? (
                        <div>
                          <p className="text-xs text-success font-medium mb-1">✅ 匹配到 {m.matchedAgents.length} 位中介:</p>
                          <div className="space-y-1">
                            {m.matchedAgents.map(a => {
                              const key = `${m.property.id}-${a.id}`;
                              return (
                              <div key={a.id} className="flex items-center justify-between bg-success/5 rounded px-2 py-1">
                                <span className="text-xs font-medium">{a.name}{a.company ? ` · ${a.company}` : ''}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-base-content/50">{a.whatsapp || a.phone}</span>
                                  {(a.whatsapp || a.phone) && (
                                    agentSendResult[key] === 'success' ? (
                                      <span className="badge badge-xs badge-success gap-0.5"><CheckCircle size={8} /> 已发</span>
                                    ) : agentSendResult[key] === 'failed' ? (
                                      <button className="btn btn-xs btn-error gap-0.5" onClick={() => handleSendToAgent(m.property, a)} disabled={agentSending[key]}>
                                        <Send size={10} /> 重试
                                      </button>
                                    ) : (
                                      <button className="btn btn-xs btn-success btn-outline gap-0.5" onClick={() => handleSendToAgent(m.property, a)} disabled={agentSending[key]}>
                                        {agentSending[key] ? <span className="loading loading-spinner loading-xs" /> : <><MessageSquare size={10} /> 发送</>}
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-warning font-medium">⚠️ 未匹配到区域中介</p>
                          <p className="text-[10px] text-base-content/50">可发送给全部 {m.allAgents.filter(a => a.status === 'active').length} 位活跃中介</p>
                          <div className="space-y-1 mt-1">
                            {m.allAgents.filter(a => a.status === 'active').map(a => {
                              const key = `${m.property.id}-${a.id}`;
                              return (
                              <div key={a.id} className="flex items-center justify-between bg-warning/5 rounded px-2 py-1">
                                <span className="text-xs font-medium">{a.name}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-base-content/50">{a.whatsapp || a.phone}</span>
                                  {(a.whatsapp || a.phone) && (
                                    agentSendResult[key] === 'success' ? (
                                      <span className="badge badge-xs badge-success gap-0.5"><CheckCircle size={8} /> 已发</span>
                                    ) : (
                                      <button className="btn btn-xs btn-success btn-outline gap-0.5" onClick={() => handleSendToAgent(m.property, a)} disabled={agentSending[key]}>
                                        {agentSending[key] ? <span className="loading loading-spinner loading-xs" /> : <><MessageSquare size={10} /> 发送</>}
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button className="btn btn-success btn-sm flex-1 gap-1" onClick={handleBatchSendToAgents}>
                      <MessageSquare size={14} /> 📱 一键群发所有中介
                    </button>
                  </div>
                  <div className="bg-info/10 rounded-lg p-2">
                    <p className="text-xs text-info">
                      💡 请先在「集成」标签页中配置 WhatsApp Cloud API，才能发送消息。
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== TEMPLATES TAB ===== */}
      {tab === 'templates' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-base-content/60">可用占位符：{'{tenant_name}'} {'{property_name}'} {'{amount}'} {'{due_date}'}</p>
          </div>
          {templates.length === 0 ? (
            <div className="text-center py-12 text-base-content/40">
              <Mail size={40} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无消息模板</p>
            </div>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="bg-base-100 rounded-xl p-3 shadow-sm border border-base-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {channelIcon(t.channel)}
                    <span className="font-semibold text-sm">{t.name}</span>
                    <span className="badge badge-xs badge-outline">{channelLabel(t.channel)}</span>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn btn-xs btn-ghost" onClick={() => onEditTemplate(t)}><Edit2 size={12} /></button>
                    <button className="btn btn-xs btn-ghost text-error" onClick={() => handleDeleteTemplate(t.id)}><Trash2 size={12} /></button>
                  </div>
                </div>
                {t.subject && <p className="text-xs text-base-content/60">主题：{t.subject}</p>}
                <p className="text-xs text-base-content/70 whitespace-pre-wrap line-clamp-3">{t.content}</p>
              </div>
            ))
          )}
          <button className="btn btn-primary btn-sm w-full gap-1" onClick={onAddTemplate}>
            <Plus size={16} /> 新建模板
          </button>
        </div>
      )}

      {/* ===== SCHEDULES TAB ===== */}
      {tab === 'schedules' && (
        <div className="space-y-2">
          {schedules.length === 0 ? (
            <div className="text-center py-12 text-base-content/40">
              <Calendar size={40} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无自动账单排程</p>
              <p className="text-xs mt-1">设定每月自动发送租金提醒</p>
            </div>
          ) : (
            schedules.map((s) => (
              <div key={s.id} className={`bg-base-100 rounded-xl p-3 shadow-sm border border-base-200 space-y-2 ${!s.active ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Bell size={14} className={s.active ? 'text-primary' : 'text-base-content/40'} />
                      <span className="font-semibold text-sm truncate">{s.property_name || '未指定物业'}</span>
                    </div>
                    <p className="text-xs text-base-content/60 mt-0.5">
                      {(s as any).floor_label ? `${(s as any).floor_label === 'G' ? 'G楼' : (s as any).floor_label + '楼'} · ` : ''}{s.tenant_name || '未指定租户'} · 每月 {s.due_day} 号 · RM {s.amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      className={`btn btn-xs ${s.active ? 'btn-success' : 'btn-ghost'}`}
                      onClick={() => handleToggleSchedule(s.id, s.active)}
                      title={s.active ? '点击停用' : '点击启用'}
                    >
                      {s.active ? <Power size={12} /> : <PowerOff size={12} />}
                    </button>
                    <button className="btn btn-xs btn-ghost" onClick={() => onEditSchedule(s)}><Edit2 size={12} /></button>
                    <button className="btn btn-xs btn-ghost text-error" onClick={() => handleDeleteSchedule(s.id)}><Trash2 size={12} /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-base-content/60">
                  {channelIcon(s.channel)}
                  <span>{channelLabel(s.channel)}</span>
                  <span>·</span>
                  <span>{reminderLabel(s.reminder_days_before)}</span>
                  {s.template_name && <><span>·</span><span>模板：{s.template_name}</span></>}
                </div>
              </div>
            ))
          )}
          <button className="btn btn-primary btn-sm w-full gap-1" onClick={onAddSchedule}>
            <Plus size={16} /> 新建排程
          </button>
        </div>
      )}

      {/* ===== INTEGRATIONS TAB ===== */}
      {tab === 'integrations' && (
        <div className="space-y-3">
          {/* Meta Business Setup Guide */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <button className="w-full flex items-center justify-between p-3" onClick={() => setShowSetupGuide(!showSetupGuide)}>
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <div className="text-left">
                  <h4 className="font-semibold text-sm">WhatsApp 设置指南</h4>
                  <p className="text-xs text-base-content/60">首次使用？按步骤设置 Meta Business 账号</p>
                </div>
              </div>
              <span className={`text-xs transition-transform ${showSetupGuide ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {showSetupGuide && (
              <div className="px-4 pb-4 space-y-2 border-t border-base-200 pt-3">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-primary">1</span></div>
                  <div>
                    <p className="text-sm font-medium">注册 Meta Business 账号</p>
                    <p className="text-xs text-base-content/60">前往 <a href="https://business.facebook.com" target="_blank" rel="noopener" className="link link-primary">business.facebook.com</a> 注册企业账号</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-primary">2</span></div>
                  <div>
                    <p className="text-sm font-medium">创建 Meta 应用</p>
                    <p className="text-xs text-base-content/60">前往 <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="link link-primary">developers.facebook.com</a> → 我的应用 → 创建应用 → 选择「商务」类型</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-primary">3</span></div>
                  <div>
                    <p className="text-sm font-medium">添加 WhatsApp 产品</p>
                    <p className="text-xs text-base-content/60">在应用面板左侧 → 添加产品 → WhatsApp → 设置</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-primary">4</span></div>
                  <div>
                    <p className="text-sm font-medium">注册电话号码</p>
                    <p className="text-xs text-base-content/60">WhatsApp → 开始使用 → 添加电话号码 → 输入你的 WhatsApp Business 专用号码 → 验证</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-primary">5</span></div>
                  <div>
                    <p className="text-sm font-medium">获取凭证填入下方</p>
                    <p className="text-xs text-base-content/60">在 WhatsApp → API 设置中找到 <strong>Phone Number ID</strong>、<strong>Access Token</strong> 和 <strong>Business ID</strong></p>
                  </div>
                </div>
                <div className="bg-warning/10 rounded-lg p-2 mt-1">
                  <p className="text-xs text-warning">⚠️ 临时 Token 仅 24 小时有效。建议在 Business Settings → 系统用户 → 生成令牌 → 选择 WhatsApp 权限，生成<strong>永久令牌</strong>。</p>
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp Cloud API Configuration */}
          <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-success/20 rounded-lg flex items-center justify-center">
                  <MessageSquare size={16} className="text-success" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">WhatsApp Cloud API</h4>
                  <p className="text-xs text-base-content/60">连接 Meta Business 平台</p>
                </div>
              </div>
              {waLoaded && (
                <span className={`badge badge-sm ${waActive && waConfig.phone_number_id ? 'badge-success' : 'badge-ghost'}`}>
                  {waActive && waConfig.phone_number_id ? (
                    <><Wifi size={10} className="mr-1" /> 已连接</>
                  ) : (
                    <><WifiOff size={10} className="mr-1" /> 未配置</>
                  )}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Phone Number ID</span></label>
                <input type="text" className="input input-bordered input-sm w-full" placeholder="从 Meta Business 后台获取"
                  value={waConfig.phone_number_id} onChange={(e) => setWaConfig({ ...waConfig, phone_number_id: e.target.value })} />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Access Token</span></label>
                <div className="relative">
                  <input type={waShowToken ? 'text' : 'password'} className="input input-bordered input-sm w-full pr-10"
                    placeholder="永久访问令牌" value={waConfig.access_token}
                    onChange={(e) => setWaConfig({ ...waConfig, access_token: e.target.value })} />
                  <button type="button" className="btn btn-ghost btn-xs absolute right-1 top-1" onClick={() => setWaShowToken(!waShowToken)}>
                    {waShowToken ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Business ID</span></label>
                <input type="text" className="input input-bordered input-sm w-full" placeholder="WhatsApp Business Account ID"
                  value={waConfig.business_id} onChange={(e) => setWaConfig({ ...waConfig, business_id: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm flex-1 gap-1"
                disabled={waSaving || !waConfig.phone_number_id || !waConfig.access_token}
                onClick={async () => {
                  setWaSaving(true);
                  try {
                    await saveWhatsAppConfig(waConfig);
                    setWaActive(true);
                    showWaToast('WhatsApp 配置已保存');
                    await loadData();
                  } catch (e) { showWaToast('保存失败，请重试'); }
                  setWaSaving(false);
                }}>
                {waSaving ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
                保存配置
              </button>
              <button className="btn btn-ghost btn-sm gap-1"
                disabled={!waActive || !waConfig.phone_number_id}
                onClick={async () => {
                  showWaToast('正在测试连接...');
                  try {
                    const resp = await fetch(`https://graph.facebook.com/v18.0/${waConfig.phone_number_id}`,
                      { headers: { 'Authorization': `Bearer ${waConfig.access_token}` } });
                    const data = await resp.json();
                    if (data.id) { showWaToast('✅ 连接成功！号码: ' + (data.display_phone_number || data.id)); }
                    else { showWaToast('❌ 连接失败: ' + (data.error?.message || '未知错误')); }
                  } catch (e: any) { showWaToast('❌ 测试失败: ' + (e.message || '网络错误')); }
                }}>
                <Send size={14} /> 测试
              </button>
            </div>
          </div>

          {/* Message Log */}
          <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200 space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Bell size={14} /> 消息日志
            </h4>
            {msgLog.length === 0 ? (
              <p className="text-xs text-base-content/60 text-center py-4">暂无发送记录</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {msgLog.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-base-200 last:border-0">
                    <div className="mt-0.5">
                      {log.status === 'sent' ? <CheckCircle size={14} className="text-success" /> :
                       log.status === 'failed' ? <XCircle size={14} className="text-error" /> :
                       <Clock size={14} className="text-warning" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate">{log.recipient_name || log.recipient_phone}</span>
                        <span className={`badge badge-xs ${log.status === 'sent' ? 'badge-success' : log.status === 'failed' ? 'badge-error' : 'badge-warning'}`}>
                          {log.status === 'sent' ? '已发送' : log.status === 'failed' ? '失败' : '排队中'}
                        </span>
                      </div>
                      <p className="text-xs text-base-content/60 truncate">{log.content}</p>
                      <p className="text-xs text-base-content/40">{log.created_at ? log.created_at.slice(0, 16).replace('T', ' ') : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Other Services */}
          <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200 space-y-3">
            <h4 className="font-semibold text-sm">其他服务</h4>
            <div className="flex items-center justify-between py-2 border-b border-base-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-info/20 rounded-lg flex items-center justify-center">
                  <Mail size={16} className="text-info" />
                </div>
                <div>
                  <p className="text-sm font-medium">Email / Gmail</p>
                  <p className="text-xs text-base-content/60">发送账单邮件至租户</p>
                </div>
              </div>
              <span className="badge badge-xs badge-ghost">未连接</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                  <span className="text-primary font-bold text-xs">$</span>
                </div>
                <div>
                  <p className="text-sm font-medium">银行 API</p>
                  <p className="text-xs text-base-content/60">自动检测收款并确认</p>
                </div>
              </div>
              <span className="badge badge-xs badge-ghost">未连接</span>
            </div>
          </div>

          <div className="bg-info/10 rounded-xl p-3">
            <p className="text-xs text-info">
              💡 Email 和银行 API 功能即将推出。
            </p>
          </div>

          {waToast && (
            <div className="toast toast-top toast-center z-[10000]">
              <div className="alert alert-info shadow-lg">
                <span className="text-sm">{waToast}</span>
              </div>
            </div>
          )}
        </div>
      )}
      {tab === 'penalty' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm">逾期罚款配置</h3>
            <button className="btn btn-primary btn-sm gap-1" onClick={() => {
              setEditingPenalty(null);
              setPenaltyForm({ property_id: 0, rate_pct: 10, grace_days: 0, calc_method: 'monthly_pct', min_amount: 0, max_amount: 0, enabled: 1 });
              setShowPenaltyForm(true);
            }}><Plus size={14} /> 添加配置</button>
          </div>

          <div className="bg-info/10 rounded-xl p-3">
            <p className="text-xs text-info">
              💡 罚款公式: 账单金额 × 利率% × 逾期月数（扣除宽限期后）。系统会在账单页面手动生成罚款账单。
            </p>
          </div>

          {penaltyConfigs.length === 0 ? (
            <div className="text-center py-8 text-base-content/50">
              <Bell size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无罚款配置</p>
              <p className="text-xs mt-1">点击"添加配置"设置全局或物业级别的逾期罚款规则</p>
            </div>
          ) : (
            <div className="space-y-2">
              {penaltyConfigs.map(pc => (
                <div key={pc.id} className={`card bg-base-200 p-3 ${!pc.enabled ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm">{pc.property_id === 0 ? '🌐 全局默认' : `🏠 ${pc.property_name}`}</p>
                      <p className="text-xs text-base-content/60 mt-0.5">
                        利率: <span className="font-bold text-primary">{pc.rate_pct}%/月</span>
                        {' · '}宽限期: <span className="font-bold">{pc.grace_days}天</span>
                        {pc.min_amount > 0 && <> · 最低: RM {pc.min_amount.toLocaleString()}</>}
                        {pc.max_amount > 0 && <> · 最高: RM {pc.max_amount.toLocaleString()}</>}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <span className={`badge badge-xs ${pc.enabled ? 'badge-success' : 'badge-ghost'}`}>{pc.enabled ? '启用' : '停用'}</span>
                      <button className="btn btn-ghost btn-xs" onClick={() => {
                        setEditingPenalty(pc);
                        setPenaltyForm({ property_id: pc.property_id, rate_pct: pc.rate_pct, grace_days: pc.grace_days, calc_method: pc.calc_method, min_amount: pc.min_amount, max_amount: pc.max_amount, enabled: pc.enabled });
                        setShowPenaltyForm(true);
                      }}><Edit2 size={12} /></button>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeleteModal({ type: 'penalty' as any, id: pc.id, msg: '确定删除此罚款配置？' })}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Penalty Form Modal */}
          {showPenaltyForm && (
            <div className="modal modal-open">
              <div className="modal-box max-w-sm">
                <h3 className="font-bold text-lg mb-3">{editingPenalty ? '编辑罚款配置' : '新增罚款配置'}</h3>
                <div className="space-y-3">
                  <div className="form-control">
                    <label className="label py-0.5"><span className="label-text text-xs">适用范围</span></label>
                    <select className="select select-bordered select-sm" value={penaltyForm.property_id} onChange={e => setPenaltyForm({...penaltyForm, property_id: Number(e.target.value)})}>
                      <option value={0}>🌐 全局默认（所有物业）</option>
                      {properties.map(p => <option key={p.id} value={p.id}>🏠 {p.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-xs">利率 (%/月)</span></label>
                      <input type="number" className="input input-bordered input-sm" step="0.1" min="0" value={penaltyForm.rate_pct} onChange={e => setPenaltyForm({...penaltyForm, rate_pct: Number(e.target.value)})} />
                    </div>
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-xs">宽限期 (天)</span></label>
                      <input type="number" className="input input-bordered input-sm" min="0" value={penaltyForm.grace_days} onChange={e => setPenaltyForm({...penaltyForm, grace_days: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-xs">最低罚款 (RM)</span></label>
                      <input type="number" className="input input-bordered input-sm" min="0" value={penaltyForm.min_amount} onChange={e => setPenaltyForm({...penaltyForm, min_amount: Number(e.target.value)})} />
                    </div>
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-xs">最高罚款 (RM)</span></label>
                      <input type="number" className="input input-bordered input-sm" min="0" value={penaltyForm.max_amount} onChange={e => setPenaltyForm({...penaltyForm, max_amount: Number(e.target.value)})} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={penaltyForm.enabled === 1} onChange={e => setPenaltyForm({...penaltyForm, enabled: e.target.checked ? 1 : 0})} />
                    <span className="text-xs">启用此配置</span>
                  </label>
                </div>
                <div className="modal-action">
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowPenaltyForm(false)}>取消</button>
                  <button className="btn btn-primary btn-sm" onClick={async () => {
                    await savePenaltyConfig(editingPenalty ? { ...penaltyForm, id: editingPenalty.id } : penaltyForm);
                    setShowPenaltyForm(false);
                    await loadData();
                  }}>保存</button>
                </div>
              </div>
              <div className="modal-backdrop" onClick={() => setShowPenaltyForm(false)} />
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={deleteModal !== null}
        message={deleteModal?.msg || ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal(null)}
      />
    </div>
  );
};
