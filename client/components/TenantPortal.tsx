import React, { useState, useEffect, useRef } from 'react';
import { Home, Wrench, Plus, Camera, LogOut, Send, Clock, CheckCircle, FileText, DollarSign, Calendar, Building2, Key, ArrowLeft } from 'lucide-react';
import { FloorUnit, Invoice, MaintenanceTicket, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../types';
import { getFloorUnitsByPhone, getInvoicesForFloor, getTicketsByPhone, saveTicket } from '../utils/db';
import { getAuthToken } from '../tasklet-shim';

type TenantFloor = FloorUnit & { property_name: string; property_address: string };

interface TenantPortalProps {
  userPhone?: string; // auto-login when user is a tenant (admin preview mode)
  hideHeader?: boolean;
  onBackToMain?: () => void; // callback to go back to main login
}

export const TenantPortal: React.FC<TenantPortalProps> = ({ userPhone, hideHeader, onBackToMain }) => {
  const [phone, setPhone] = useState(userPhone || '');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');

  // PIN change flow
  const [showPinChange, setShowPinChange] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [mustChangePin, setMustChangePin] = useState(false);

  // Auto-login if userPhone is provided (admin preview mode — no PIN needed)
  useEffect(() => {
    if (userPhone && !loggedIn) {
      setPhone(userPhone);
      handleAutoLogin(userPhone);
    }
  }, [userPhone]);

  async function handleAutoLogin(ph: string) {
    setLoading(true);
    try {
      const f = await getFloorUnitsByPhone(ph);
      if (f && f.length > 0) {
        setFloors(f);
        setTenantName(f[0].tenant_name);
        setTenantPhone(ph);
        setLoggedIn(true);
        await loadInvoicesAndTickets(f, ph);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const [tab, setTab] = useState<'home' | 'invoices' | 'tickets' | 'new'>('home');
  const [floors, setFloors] = useState<TenantFloor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);

  // New ticket form
  const [form, setForm] = useState({ property_id: 0, category: 'other', priority: 'medium', title: '', description: '' });
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogin() {
    if (!phone.trim()) { setLoginError('请输入电话号码'); return; }
    if (!pin.trim()) { setLoginError('请输入PIN密码'); return; }
    setLoading(true); setLoginError('');
    try {
      const resp = await fetch('/api/tenant/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), pin: pin.trim() }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setLoginError(err.error || '电话号码或PIN错误');
        setLoading(false);
        return;
      }
      const data = await resp.json();
      // If must_change_pin, show PIN change dialog before entering portal
      if (data.user.must_change_pin) {
        setTenantName(data.user.name);
        setTenantPhone(data.user.phone);
        setOldPin(pin.trim());
        setMustChangePin(true);
        setShowPinChange(true);
        setLoading(false);
        return;
      }
      // Normal login — load floors
      const f = await getFloorUnitsByPhone(phone.trim());
      if (!f || f.length === 0) {
        setLoginError('未找到租户记录');
        setLoading(false);
        return;
      }
      setFloors(f);
      setTenantName(data.user.name);
      setTenantPhone(phone.trim());
      setLoggedIn(true);
      await loadInvoicesAndTickets(f, phone.trim());
    } catch (e) {
      console.error(e);
      setLoginError('登录失败');
    }
    setLoading(false);
  }

  async function handlePinChange(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setPinError('');
    if (!newPin.trim() || newPin.length < 4) { setPinError('PIN至少4位'); return; }
    if (newPin !== confirmNewPin) { setPinError('两次输入的PIN不一致'); return; }
    setPinSaving(true);
    try {
      const resp = await fetch('/api/tenant/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: tenantPhone || phone.trim(), old_pin: oldPin || pin.trim(), new_pin: newPin }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setPinError(err.error || '修改失败');
        setPinSaving(false);
        return;
      }
      // PIN changed — now load portal
      setShowPinChange(false);
      setMustChangePin(false);
      setNewPin(''); setConfirmNewPin(''); setOldPin('');
      const f = await getFloorUnitsByPhone(tenantPhone || phone.trim());
      if (f && f.length > 0) {
        setFloors(f);
        setLoggedIn(true);
        await loadInvoicesAndTickets(f, tenantPhone || phone.trim());
      }
    } catch (e) {
      console.error(e);
      setPinError('修改失败，请重试');
    }
    setPinSaving(false);
  }

  async function loadInvoicesAndTickets(floorList?: TenantFloor[], phoneOverride?: string) {
    const fl = floorList || floors;
    const ph = phoneOverride || tenantPhone;
    try {
      // Get invoices for all tenant's floors
      const allInvoices: Invoice[] = [];
      for (const f of fl) {
        const inv = await getInvoicesForFloor(f.property_id, f.floor_label);
        allInvoices.push(...inv);
      }
      // Deduplicate by id
      const seen = new Set<number>();
      const unique = allInvoices.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
      unique.sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''));
      setInvoices(unique);

      // Get tickets by phone number
      const tix = await getTicketsByPhone(ph);
      setTickets(tix);
    } catch (e) { console.error(e); }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).slice(0, 5 - photos.length).forEach((file: File) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 800 / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPhotos(prev => [...prev, canvas.toDataURL('image/jpeg', 0.6)]);
      };
      img.src = URL.createObjectURL(file);
    });
    e.target.value = '';
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.property_id) return;
    setSubmitting(true);
    try {
      await saveTicket({
        property_id: form.property_id,
        tenant_id: 0,
        tenant_phone: tenantPhone,
        category: form.category as MaintenanceTicket['category'],
        priority: form.priority as MaintenanceTicket['priority'],
        title: form.title,
        description: form.description,
        photos: JSON.stringify(photos),
      });
      setSubmitted(true);
      setForm({ property_id: 0, category: 'other', priority: 'medium', title: '', description: '' });
      setPhotos([]);
      await loadInvoicesAndTickets();
      setTimeout(() => { setSubmitted(false); setTab('tickets'); }, 2000);
    } catch (e) { console.error(e); }
    setSubmitting(false);
  }

  function leaseStatusBadge(start?: string, end?: string) {
    if (!end) return null;
    const endDate = new Date(end);
    const now = new Date();
    const diff = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 0) return <span className="badge badge-error badge-sm">已过期</span>;
    if (diff <= 30) return <span className="badge badge-warning badge-sm">即将到期</span>;
    if (diff <= 90) return <span className="badge badge-info badge-sm">90天内到期</span>;
    return <span className="badge badge-success badge-sm">有效</span>;
  }

  // ========== PIN CHANGE SCREEN ==========
  if (showPinChange) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="bg-warning/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Key size={32} className="text-warning" />
            </div>
            <h1 className="text-xl font-bold">{mustChangePin ? '首次登录' : '修改PIN密码'}</h1>
            <p className="text-sm text-base-content/60">
              {mustChangePin ? `欢迎 ${tenantName}！请设置新的PIN密码` : '设置新的PIN密码'}
            </p>
          </div>
          <form onSubmit={handlePinChange} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-base-content/70 mb-1 block">新PIN密码</label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="至少4位"
                value={newPin}
                onChange={e => { setNewPin(e.target.value); setPinError(''); }}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-base-content/70 mb-1 block">确认新PIN</label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="再次输入新PIN"
                value={confirmNewPin}
                onChange={e => { setConfirmNewPin(e.target.value); setPinError(''); }}
              />
            </div>
            {pinError && <p className="text-error text-sm">{pinError}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={pinSaving}>
              {pinSaving ? <span className="loading loading-spinner loading-sm" /> : <><Key size={16} /> 设置新PIN并登录</>}
            </button>
            {!mustChangePin && (
              <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => { setShowPinChange(false); setNewPin(''); setConfirmNewPin(''); }}>
                取消
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // ========== LOGIN SCREEN ==========
  if (!loggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Home size={32} className="text-primary" />
            </div>
            <h1 className="text-xl font-bold">租户入口</h1>
            <p className="text-sm text-base-content/60">Tenant Portal</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-base-content/70 mb-1 block">电话号码</label>
              <input
                className="input input-bordered w-full"
                placeholder="输入租赁登记的电话号码"
                value={phone}
                onChange={e => { setPhone(e.target.value); setLoginError(''); }}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-base-content/70 mb-1 block">PIN密码</label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="输入PIN密码"
                value={pin}
                onChange={e => { setPin(e.target.value); setLoginError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            {loginError && <p className="text-error text-sm">{loginError}</p>}
            <button className="btn btn-primary w-full" onClick={handleLogin} disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-sm" /> : '登录'}
            </button>
          </div>
          <p className="text-xs text-center text-base-content/50">首次登录默认PIN: 1234</p>
          {onBackToMain && (
            <button className="btn btn-ghost btn-sm w-full" onClick={onBackToMain}>
              <ArrowLeft size={14} /> 返回管理员登录
            </button>
          )}
        </div>
      </div>
    );
  }

  // ========== MAIN PORTAL ==========
  const propIds = [...new Set(floors.map(f => f.property_id))];
  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue');
  const openTickets = tickets.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* Header — hidden when embedded in admin unified header */}
      {!hideHeader && (
        <header className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0 border-b border-base-300" data-theme="vencos-dark">
          <div>
            <h1 className="text-lg font-bold">🏠 租户入口</h1>
            <p className="text-xs opacity-70">欢迎, {tenantName}</p>
          </div>
          <div className="flex items-center gap-1">
            {!userPhone && (
              <button className="btn btn-ghost btn-xs" onClick={() => { setOldPin(''); setShowPinChange(true); setMustChangePin(false); }} title="修改PIN">
                <Key size={14} />
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => { setLoggedIn(false); setFloors([]); setInvoices([]); setTickets([]); setPin(''); }}>
              <LogOut size={16} /> 退出
            </button>
          </div>
        </header>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 pb-20 pt-3">

        {/* ===== HOME TAB ===== */}
        {tab === 'home' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="card bg-primary/10 p-3 text-center">
                <Building2 size={20} className="text-primary mx-auto mb-1" />
                <p className="text-xl font-bold">{floors.length}</p>
                <p className="text-[10px] text-base-content/70">我的楼层</p>
              </div>
              <div className="card bg-warning/10 p-3 text-center">
                <FileText size={20} className="text-warning mx-auto mb-1" />
                <p className="text-xl font-bold">{pendingInvoices.length}</p>
                <p className="text-[10px] text-base-content/70">待付账单</p>
              </div>
              <div className="card bg-info/10 p-3 text-center">
                <Wrench size={20} className="text-info mx-auto mb-1" />
                <p className="text-xl font-bold">{openTickets.length}</p>
                <p className="text-[10px] text-base-content/70">进行中工单</p>
              </div>
            </div>

            {/* Floor Details */}
            <h3 className="text-sm font-semibold flex items-center gap-1">
              <Building2 size={14} /> 我的租赁详情
            </h3>
            {floors.map(f => (
              <div key={f.id} className="card bg-base-200">
                <div className="card-body p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">{f.property_name}</h3>
                    <span className="badge badge-primary badge-sm">{f.floor_label === 'G' ? '底层' : `${f.floor_label}楼`}</span>
                  </div>
                  <p className="text-xs text-base-content/60">{f.property_address}</p>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-base-content/60">月租</span>
                      <span className="font-bold text-primary">RM {(f.rent_amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-base-content/60">押金</span>
                      <span>RM {(f.deposit || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-base-content/60">租期开始</span>
                      <span>{f.lease_start || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-base-content/60">租期结束</span>
                      <span className="flex items-center gap-1">{f.lease_end || '-'} {leaseStatusBadge(f.lease_start, f.lease_end)}</span>
                    </div>
                    {f.utility_deposit ? (
                      <div className="flex justify-between col-span-2">
                        <span className="text-base-content/60">水电押金</span>
                        <span>RM {f.utility_deposit.toLocaleString()}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {/* Recent Pending Invoices */}
            {pendingInvoices.length > 0 && (
              <>
                <h3 className="text-sm font-semibold flex items-center gap-1 text-warning">
                  <DollarSign size={14} /> 待付账单
                </h3>
                {pendingInvoices.slice(0, 3).map(inv => (
                  <div key={inv.id} className="card bg-base-200">
                    <div className="card-body p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs">{inv.invoice_no}</span>
                        <span className={`badge badge-sm ${inv.status === 'overdue' ? 'badge-error' : 'badge-warning'}`}>
                          {inv.status === 'overdue' ? '逾期' : '待付'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-base-content/60">{inv.billing_month || inv.description}</span>
                        <span className="font-bold text-primary">RM {inv.amount.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-base-content/50">到期日: {inv.due_date}</p>
                    </div>
                  </div>
                ))}
                {pendingInvoices.length > 3 && (
                  <button className="btn btn-ghost btn-sm w-full" onClick={() => setTab('invoices')}>
                    查看全部 {pendingInvoices.length} 张待付账单 →
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ===== INVOICES TAB ===== */}
        {tab === 'invoices' && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1">
              <FileText size={14} /> 全部账单 ({invoices.length})
            </h3>
            {invoices.length === 0 ? (
              <div className="text-center py-12 text-base-content/50">
                <FileText size={40} className="mx-auto mb-2 opacity-30" />
                <p>暂无账单记录</p>
              </div>
            ) : (
              invoices.map(inv => {
                const statusMap: Record<string, { label: string; cls: string }> = {
                  paid: { label: '已付', cls: 'badge-success' },
                  pending: { label: '待付', cls: 'badge-warning' },
                  overdue: { label: '逾期', cls: 'badge-error' },
                  cancelled: { label: '已取消', cls: 'badge-ghost' },
                };
                const s = statusMap[inv.status] || { label: inv.status, cls: '' };
                // Parse adjustments
                let adjustments: Array<{ name: string; amount: number }> = [];
                try { adjustments = JSON.parse(inv.adjustments || '[]'); } catch {}

                return (
                  <div key={inv.id} className="card bg-base-200">
                    <div className="card-body p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold">{inv.invoice_no}</span>
                        <span className={`badge badge-sm ${s.cls}`}>{s.label}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-base-content/60">
                          {inv.property_name} · {inv.floor_label === 'G' ? '底层' : `${inv.floor_label}楼`}
                        </span>
                        <span className="font-bold text-primary">RM {inv.amount.toLocaleString()}</span>
                      </div>
                      {/* Breakdown */}
                      <div className="text-[11px] text-base-content/50 space-y-0.5">
                        {inv.rent_amount > 0 && <div className="flex justify-between"><span>月租</span><span>RM {inv.rent_amount.toLocaleString()}</span></div>}
                        {inv.charges_amount > 0 && <div className="flex justify-between"><span>附加费</span><span>RM {inv.charges_amount.toLocaleString()}</span></div>}
                        {adjustments.map((adj, i) => (
                          <div key={i} className={`flex justify-between ${adj.amount >= 0 ? 'text-error' : 'text-success'}`}>
                            <span>{adj.name}</span>
                            <span>{adj.amount >= 0 ? '+' : ''}RM {adj.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-base-content/40">
                        <span>账单月份: {inv.billing_month || '-'}</span>
                        <span>到期: {inv.due_date || '-'}</span>
                      </div>
                      {inv.paid_date && <p className="text-[10px] text-success">✅ 付款日: {inv.paid_date}</p>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ===== TICKETS TAB ===== */}
        {tab === 'tickets' && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1">
              <Wrench size={14} /> 我的报修记录
            </h3>
            {tickets.length === 0 ? (
              <div className="text-center py-12 text-base-content/50">
                <Wrench size={40} className="mx-auto mb-2 opacity-30" />
                <p>暂无报修记录</p>
                <button className="btn btn-primary btn-sm mt-3" onClick={() => setTab('new')}>
                  <Plus size={14} /> 提交报修
                </button>
              </div>
            ) : (
              tickets.map(t => {
                const sta = TICKET_STATUSES.find(s => s.value === t.status);
                const cat = TICKET_CATEGORIES.find(c => c.value === t.category);
                const tPhotos: string[] = (() => { try { return JSON.parse(t.photos || '[]'); } catch { return []; } })();
                return (
                  <div key={t.id} className="card bg-base-200">
                    <div className="card-body p-3 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`badge badge-sm ${sta?.color || ''}`}>{sta?.label}</span>
                        <span className="text-xs text-base-content/60">{cat?.label}</span>
                      </div>
                      <h3 className="font-bold text-sm">{t.title}</h3>
                      <p className="text-xs text-base-content/60">🏢 {t.property_name}</p>
                      {t.description && <p className="text-xs whitespace-pre-wrap">{t.description}</p>}
                      {tPhotos.length > 0 && (
                        <div className="flex gap-1 overflow-x-auto">
                          {tPhotos.map((p, i) => <img key={i} src={p} className="w-16 h-16 rounded object-cover shrink-0" />)}
                        </div>
                      )}
                      {t.worker_name && <p className="text-xs text-primary">🔧 维修人员: {t.worker_name}</p>}
                      <div className="text-[10px] text-base-content/40 flex items-center gap-1">
                        <Clock size={10} /> {t.submitted_at || t.created_at}
                        {t.completed_at && <><CheckCircle size={10} className="text-success ml-2" /> 完成: {t.completed_at}</>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ===== NEW TICKET TAB ===== */}
        {tab === 'new' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1">
              <Plus size={14} /> 提交维修请求
            </h3>

            {submitted ? (
              <div className="alert alert-success">
                <CheckCircle size={20} /> 报修已成功提交！管理员将尽快处理。
              </div>
            ) : (
              <>
                <select className="select select-bordered w-full" value={form.property_id} onChange={e => setForm({ ...form, property_id: Number(e.target.value) })}>
                  <option value={0}>-- 选择物业 --</option>
                  {floors.filter((f, i, arr) => arr.findIndex(x => x.property_id === f.property_id) === i).map(f => (
                    <option key={f.property_id} value={f.property_id}>{f.property_name}</option>
                  ))}
                </select>

                <select className="select select-bordered w-full" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {TICKET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>

                <select className="select select-bordered w-full" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {TICKET_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>

                <input className="input input-bordered w-full" placeholder="问题标题 *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />

                <textarea className="textarea textarea-bordered w-full" rows={4} placeholder="详细描述问题..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

                {/* Photo upload */}
                <div>
                  <p className="text-xs font-semibold mb-1">📷 上传照片 ({photos.length}/5)</p>
                  <div className="flex gap-2 flex-wrap">
                    {photos.map((p, i) => (
                      <div key={i} className="relative">
                        <img src={p} className="w-20 h-20 rounded-lg object-cover" />
                        <button className="btn btn-xs btn-circle btn-error absolute -top-1 -right-1" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}>✕</button>
                      </div>
                    ))}
                    {photos.length < 5 && (
                      <button className="w-20 h-20 rounded-lg border-2 border-dashed border-base-300 flex items-center justify-center hover:border-primary transition-colors" onClick={() => fileRef.current?.click()}>
                        <Camera size={24} className="opacity-40" />
                      </button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
                </div>

                <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={submitting || !form.title.trim() || !form.property_id}>
                  {submitting ? <span className="loading loading-spinner loading-sm" /> : <><Send size={16} /> 提交报修</>}
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-base-300" data-theme="vencos-dark">
        <div className="flex items-center justify-around h-14 max-w-md mx-auto">
          {[
            { key: 'home' as const, label: '首页', Icon: Home },
            { key: 'invoices' as const, label: '账单', Icon: FileText },
            { key: 'tickets' as const, label: '报修记录', Icon: Wrench },
            { key: 'new' as const, label: '提交报修', Icon: Plus },
          ].map(n => (
            <button key={n.key} onClick={() => setTab(n.key)} className={`flex flex-col items-center justify-center flex-1 h-12 rounded-lg mx-0.5 transition-all ${tab === n.key ? 'bg-primary/15 text-primary' : 'text-base-content/70'}`}>
              <n.Icon size={20} />
              <span className="text-[10px] mt-0.5">{n.label}</span>
            </button>
          ))}
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </nav>
    </div>
  );
};
