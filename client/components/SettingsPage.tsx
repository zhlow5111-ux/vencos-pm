import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Mail, MessageSquare, Calendar, Power, PowerOff, Trash2, Edit2, Wifi, WifiOff, Bell, Building2, User, Shield, Key, Users, UserPlus, Save, X, Eye, EyeOff, Send, CheckCircle, XCircle, Clock } from 'lucide-react';
import { MessageTemplate, BillingSchedule, Owner, SystemUser, UserRole, CHANNEL_TYPES, REMINDER_OPTIONS, OWNER_TYPES, USER_ROLES, ACCESS_LEVELS } from '../types';
import { getTemplates, deleteTemplate, getSchedules, deleteSchedule, toggleSchedule, getOwners, deleteOwner, getSystemUsers, saveSystemUser, deleteSystemUser, getWhatsAppConfig, saveWhatsAppConfig, getMessageLog, getProperties, addUserAccess } from '../utils/db';
import { ConfirmModal } from './ConfirmModal';

type SettingsTab = 'templates' | 'schedules' | 'integrations' | 'owners' | 'users_permissions';

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
  const [tab, setTab] = useState<SettingsTab>('owners');
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

  const showWaToast = useCallback((msg: string) => {
    setWaToast(msg);
    setTimeout(() => setWaToast(''), 3000);
  }, []);

  // User form state
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [userForm, setUserForm] = useState({
    username: '', pin: '', role: '' as UserRole | '', phone: '', name: '', email: '', notes: '', must_change_pin: true, active: true, defaultAccessLevel: '' as string,
  });
  const [userSaving, setUserSaving] = useState(false);
  const [userToast, setUserToast] = useState('');

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  async function loadData() {
    setLoading(true);
    try {
      const [t, s, o, u, waCfg, logs] = await Promise.all([
        getTemplates(), getSchedules(), getOwners(), getSystemUsers(),
        getWhatsAppConfig(), getMessageLog(20),
      ]);
      setTemplates(t);
      setSchedules(s);
      setOwners(o);
      setUsers(u);
      if (waCfg) {
        setWaConfig({ phone_number_id: waCfg.phone_number_id, access_token: waCfg.access_token, business_id: waCfg.business_id });
        setWaActive(waCfg.active);
      }
      setWaLoaded(true);
      setMsgLog(logs);
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

  function openUserForm(u?: SystemUser) {
    if (u) {
      setEditingUser(u);
      setUserForm({
        username: u.username, pin: '', role: u.role, phone: u.phone,
        name: u.name, email: u.email, notes: u.notes, must_change_pin: false, active: u.active === 1, defaultAccessLevel: '',
      });
    } else {
      setEditingUser(null);
      setUserForm({ username: '', pin: '', role: '', phone: '', name: '', email: '', notes: '', must_change_pin: true, active: true, defaultAccessLevel: '' });
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
      // Auto-apply default access to all properties for admin/stakeholder (new or edit)
      if (userForm.defaultAccessLevel && (userForm.role === 'admin' || userForm.role === 'stakeholder')) {
        try {
          const allProperties = await getProperties();
          for (const p of allProperties) {
            await addUserAccess(savedId, p.id, userForm.defaultAccessLevel);
          }
        } catch (e) { console.error('Failed to apply default access:', e); }
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

  const roleIcon = (r: string) => r === 'super_admin' ? '👑' : r === 'admin' ? '🛡️' : r === 'stakeholder' ? '📊' : r === 'tenant' ? '🏠' : r === 'worker' ? '🔧' : '👤';
  const roleLabel = (r: string) => USER_ROLES.find(ur => ur.value === r)?.label || r;
  const roleBadgeColor = (r: string) => r === 'super_admin' ? 'badge-warning' : r === 'admin' ? 'badge-success' : r === 'stakeholder' ? 'badge-info' : r === 'tenant' ? 'badge-primary' : 'badge-ghost';

  if (loading) {
    return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md" /></div>;
  }

  const tabItems: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'owners', label: '持有人', icon: <Building2 size={13} /> },
    { key: 'users_permissions', label: '用户与权限', icon: <Shield size={13} /> },
    { key: 'templates', label: '模板', icon: <Mail size={13} /> },
    { key: 'schedules', label: '排程', icon: <Calendar size={13} /> },
    { key: 'integrations', label: '集成', icon: <Wifi size={13} /> },
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
                  <input className="input input-bordered input-sm w-full" placeholder="选填" value={userForm.email}
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
                    <label className="label py-0.5"><span className="label-text text-xs">默认物业权限</span></label>
                    <select className="select select-bordered select-sm w-full" value={userForm.defaultAccessLevel}
                      onChange={e => setUserForm(f => ({ ...f, defaultAccessLevel: e.target.value }))}>
                      <option value="">不设置（稍后手动配置）</option>
                      <option value="full">全部物业 - 完全权限</option>
                      <option value="edit">全部物业 - 编辑物业</option>
                      <option value="financial">全部物业 - 查看财务</option>
                      <option value="readonly">全部物业 - 只读查看</option>
                    </select>
                    <label className="label py-0">
                      <span className="label-text-alt text-xs text-base-content/50">
                        {userForm.defaultAccessLevel ? (editingUser ? '✅ 保存后将重新应用到所有现有物业' : '✅ 保存后将自动应用到所有现有物业') : '保存后可在权限按钮中逐个配置'}
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
                  {(userForm.role === 'stakeholder' || userForm.role === 'admin') && !userForm.defaultAccessLevel && (editingUser ? ' — 可在上方选择默认物业权限' : ' — 保存后可配置物业访问权限')}
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
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {(u.role === 'stakeholder' || u.role === 'admin') && u.role !== 'super_admin' && (
                      <button className="btn btn-xs btn-outline btn-primary gap-0.5" onClick={() => onManageUserAccess(u)} title="管理物业权限">
                        <Key size={11} /> 权限
                      </button>
                    )}
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
      <ConfirmModal
        open={deleteModal !== null}
        message={deleteModal?.msg || ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal(null)}
      />
    </div>
  );
};
