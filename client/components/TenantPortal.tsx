import React, { useState, useEffect, useRef } from 'react';
import { Home, FileText, Wrench, User, Plus, Camera, Send, Clock, CheckCircle, Key, ArrowLeft, LogOut, Building2, DollarSign, Upload, CreditCard, Phone, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { FloorUnit, Invoice, MaintenanceTicket, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../types';
import { getFloorUnitsByPhone, getInvoicesForFloor, getTicketsByPhone, saveTicket } from '../utils/db';
import { getAuthToken, setAuthToken } from '../tasklet-shim';

type TenantFloor = FloorUnit & { property_name: string; property_address: string };
interface TenantPortalProps { userPhone?: string; hideHeader?: boolean; onBackToMain?: () => void; }
interface BankAccount { id: number; bank_name: string; account_no: string; account_name: string; }

const PROGRESS_STEPS = [
  { key: 'submitted', label: '已提交' },
  { key: 'acknowledged', label: '已确认' },
  { key: 'in_progress', label: '维修中' },
  { key: 'completed', label: '已完成' },
];

export const TenantPortal: React.FC<TenantPortalProps> = ({ userPhone, hideHeader, onBackToMain }) => {
  // ===== LOGIN STATE =====
  const [phone, setPhone] = useState(userPhone || '');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');

  // ===== PIN CHANGE STATE =====
  const [showPinChange, setShowPinChange] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [mustChangePin, setMustChangePin] = useState(false);

  // ===== MAIN PORTAL STATE =====
  const [tab, setTab] = useState<'home' | 'bills' | 'repair' | 'profile'>('home');
  const [floors, setFloors] = useState<TenantFloor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // ===== BILLS TAB STATE =====
  const [billFilter, setBillFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payMethod, setPayMethod] = useState('银行转账');
  const [payRef, setPayRef] = useState('');
  const [payReceipt, setPayReceipt] = useState('');
  const [payReceiptName, setPayReceiptName] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const receiptRef = useRef<HTMLInputElement>(null);

  // ===== REPAIR TAB STATE =====
  const [showRepairForm, setShowRepairForm] = useState(false);
  const [repairForm, setRepairForm] = useState({ property_id: 0, category: 'other', priority: 'medium', title: '', description: '' });
  const [repairPhotos, setRepairPhotos] = useState<string[]>([]);
  const [repairSubmitting, setRepairSubmitting] = useState(false);
  const [repairSubmitted, setRepairSubmitted] = useState(false);
  const [tpPhotoViewer, setTpPhotoViewer] = useState<{ photos: string[]; index: number } | null>(null);
  const [tpPhotoZoom, setTpPhotoZoom] = useState(1);
  const photoRef = useRef<HTMLInputElement>(null);

  // ===== AUTO-LOGIN (admin preview mode) =====
  useEffect(() => {
    if (userPhone && !loggedIn) { setPhone(userPhone); handleAutoLogin(userPhone); }
  }, [userPhone]);

  // ===== RESTORE SESSION (portal switching) =====
  useEffect(() => {
    if (hideHeader && !userPhone && !loggedIn) {
      const saved = localStorage.getItem('vencos_tenant_session');
      if (saved) {
        try {
          const { phone: p } = JSON.parse(saved);
          if (p) { setPhone(p); handleAutoLogin(p); }
        } catch {}
      }
    }
  }, []);

  // ===== AUTH HANDLERS =====
  async function handleAutoLogin(ph: string) {
    setLoading(true);
    try {
      const f = await getFloorUnitsByPhone(ph);
      if (f && f.length > 0) {
        setFloors(f); setTenantName(f[0].tenant_name); setTenantPhone(ph); setLoggedIn(true);
        await loadData(f, ph);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleLogin() {
    if (!phone.trim()) { setLoginError('请输入电话号码'); return; }
    if (!pin.trim()) { setLoginError('请输入PIN密码'); return; }
    setLoading(true); setLoginError('');
    try {
      const resp = await fetch('/api/tenant/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), pin: pin.trim() }),
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); setLoginError(err.error || '电话号码或PIN错误'); setLoading(false); return; }
      const data = await resp.json();
      // Store token so sqlQuery works
      if (data.token) setAuthToken(data.token);
      if (data.user.must_change_pin) {
        setTenantName(data.user.name); setTenantPhone(data.user.phone);
        setOldPin(pin.trim()); setMustChangePin(true); setShowPinChange(true);
        setLoading(false); return;
      }
      const f = await getFloorUnitsByPhone(phone.trim());
      if (!f || f.length === 0) { setLoginError('未找到租户记录'); setLoading(false); return; }
      setFloors(f); setTenantName(data.user.name); setTenantPhone(phone.trim()); setLoggedIn(true);
      if (hideHeader) localStorage.setItem('vencos_tenant_session', JSON.stringify({ phone: phone.trim(), name: data.user.name }));
      await loadData(f, phone.trim());
    } catch (e) { console.error(e); setLoginError('登录失败'); }
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: tenantPhone || phone.trim(), old_pin: oldPin || pin.trim(), new_pin: newPin }),
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); setPinError(err.error || '修改失败'); setPinSaving(false); return; }
      setShowPinChange(false); setMustChangePin(false); setNewPin(''); setConfirmNewPin(''); setOldPin('');
      const ph = tenantPhone || phone.trim();
      const f = await getFloorUnitsByPhone(ph);
      if (f && f.length > 0) {
        setFloors(f); setLoggedIn(true);
        if (hideHeader) localStorage.setItem('vencos_tenant_session', JSON.stringify({ phone: ph, name: tenantName }));
        await loadData(f, ph);
      }
    } catch (e) { console.error(e); setPinError('修改失败，请重试'); }
    setPinSaving(false);
  }

  function handleLogout() {
    setLoggedIn(false); setFloors([]); setInvoices([]); setTickets([]); setPin(''); setTab('home');
    localStorage.removeItem('vencos_tenant_session');
  }

  // ===== DATA LOADING =====
  async function loadData(floorList?: TenantFloor[], phoneOverride?: string) {
    const fl = floorList || floors;
    const ph = phoneOverride || tenantPhone;
    try {
      const allInvoices: Invoice[] = [];
      for (const f of fl) {
        const inv = await getInvoicesForFloor(f.property_id, f.floor_label);
        allInvoices.push(...inv);
      }
      const seen = new Set<number>();
      const unique = allInvoices.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
      unique.sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''));
      setInvoices(unique);
      const tix = await getTicketsByPhone(ph);
      setTickets(tix);
    } catch (e) { console.error(e); }
    // Load bank accounts
    try {
      const token = getAuthToken();
      const resp = await fetch('/api/bank-accounts', { headers: { 'Authorization': `Bearer ${token}` } });
      if (resp.ok) { const data = await resp.json(); setBankAccounts(data); }
    } catch {}
  }

  // ===== PAYMENT NOTIFICATION =====
  function handleReceiptSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPayReceiptName(file.name);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setPayReceipt(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => {
      // Non-image file: read as data URL
      const reader = new FileReader();
      reader.onload = () => setPayReceipt(reader.result as string);
      reader.readAsDataURL(file);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  }

  async function submitPaymentNotification() {
    if (!payingInvoice) return;
    setPaySubmitting(true);
    try {
      const token = getAuthToken();
      const resp = await fetch('/api/tenant/payment-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          invoice_id: payingInvoice.id,
          tenant_phone: tenantPhone,
          tenant_name: tenantName,
          payment_method: payMethod,
          payment_ref: payRef,
          receipt_data: payReceipt,
          receipt_filename: payReceiptName,
          notes: payNotes,
        }),
      });
      if (resp.ok) {
        setPayingInvoice(null); setPayMethod('银行转账'); setPayRef(''); setPayReceipt(''); setPayReceiptName(''); setPayNotes('');
        await loadData();
      } else {
        const err = await resp.json().catch(() => ({}));
        alert(err.error || '提交失败');
      }
    } catch (e) { console.error(e); alert('提交失败'); }
    setPaySubmitting(false);
  }

  // ===== REPAIR HANDLERS =====
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).slice(0, 5 - repairPhotos.length).forEach((file: File) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 800 / img.width);
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setRepairPhotos(prev => [...prev, canvas.toDataURL('image/jpeg', 0.6)]);
      };
      img.src = URL.createObjectURL(file);
    });
    e.target.value = '';
  }

  async function handleSubmitRepair() {
    if (!repairForm.title.trim() || !repairForm.property_id) return;
    setRepairSubmitting(true);
    try {
      await saveTicket({
        property_id: repairForm.property_id, tenant_id: 0, tenant_phone: tenantPhone,
        category: repairForm.category as MaintenanceTicket['category'],
        priority: repairForm.priority as MaintenanceTicket['priority'],
        title: repairForm.title, description: repairForm.description,
        photos: JSON.stringify(repairPhotos),
      });
      setRepairSubmitted(true); setRepairForm({ property_id: 0, category: 'other', priority: 'medium', title: '', description: '' }); setRepairPhotos([]);
      await loadData();
      setTimeout(() => { setRepairSubmitted(false); setShowRepairForm(false); }, 2500);
    } catch (e) { console.error(e); }
    setRepairSubmitting(false);
  }

  // ===== HELPER FUNCTIONS =====
  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return '早上好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  function leaseInfo(end?: string) {
    if (!end) return { label: '未设置', cls: 'badge-ghost', months: 0 };
    const diff = (new Date(end).getTime() - Date.now()) / (1000 * 86400);
    if (diff < 0) return { label: '已过期', cls: 'badge-error', months: 0 };
    if (diff <= 30) return { label: `剩余${Math.ceil(diff)}天`, cls: 'badge-error', months: Math.ceil(diff / 30) };
    const m = Math.ceil(diff / 30);
    if (diff <= 90) return { label: `剩余${m}个月`, cls: 'badge-warning', months: m };
    return { label: `剩余${m}个月`, cls: 'badge-success', months: m };
  }

  function getRecentActivity() {
    const events: { date: string; text: string; icon: string; color: string }[] = [];
    invoices.forEach(inv => {
      if (inv.status === 'paid' && inv.paid_date) events.push({ date: inv.paid_date, text: `${inv.invoice_no} 已收款`, icon: '✅', color: 'text-success' });
      if (inv.created_at) events.push({ date: inv.created_at.slice(0, 10), text: `新账单 ${inv.invoice_no}`, icon: '📄', color: 'text-info' });
      if ((inv.status as string) === 'confirming') events.push({ date: inv.updated_at?.slice(0, 10) || '', text: `${inv.invoice_no} 付款通知已提交`, icon: '📤', color: 'text-warning' });
    });
    tickets.forEach(t => {
      if (t.completed_at) events.push({ date: t.completed_at.slice(0, 10), text: `维修完成: ${t.title}`, icon: '✅', color: 'text-success' });
      if (t.started_at && t.status === 'in_progress') events.push({ date: t.started_at.slice(0, 10), text: `维修中: ${t.title}`, icon: '🔧', color: 'text-primary' });
    });
    events.sort((a, b) => b.date.localeCompare(a.date));
    return events.slice(0, 5);
  }

  const statusLabel = (s: string) => {
    const m: Record<string, { label: string; cls: string }> = {
      pending: { label: '待付', cls: 'badge-warning' }, paid: { label: '已付', cls: 'badge-success' },
      overdue: { label: '逾期', cls: 'badge-error' }, cancelled: { label: '已取消', cls: 'badge-ghost' },
      confirming: { label: '待确认', cls: 'badge-info' },
    };
    return m[s] || { label: s, cls: '' };
  };

  // ================ PIN CHANGE SCREEN ================
  if (showPinChange) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="bg-warning/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"><Key size={32} className="text-warning" /></div>
            <h1 className="text-xl font-bold">{mustChangePin ? '首次登录' : '修改PIN密码'}</h1>
            <p className="text-sm text-base-content/60">{mustChangePin ? `欢迎 ${tenantName}！请设置新的PIN密码` : '设置新的PIN密码'}</p>
          </div>
          <form onSubmit={handlePinChange} className="space-y-3">
            <div><label className="text-xs font-medium text-base-content/70 mb-1 block">新PIN密码</label>
              <input type="password" className="input input-bordered w-full" placeholder="至少4位" value={newPin} onChange={e => { setNewPin(e.target.value); setPinError(''); }} autoFocus /></div>
            <div><label className="text-xs font-medium text-base-content/70 mb-1 block">确认新PIN</label>
              <input type="password" className="input input-bordered w-full" placeholder="再次输入新PIN" value={confirmNewPin} onChange={e => { setConfirmNewPin(e.target.value); setPinError(''); }} /></div>
            {pinError && <p className="text-error text-sm">{pinError}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={pinSaving}>
              {pinSaving ? <span className="loading loading-spinner loading-sm" /> : <><Key size={16} /> 设置新PIN并登录</>}
            </button>
            {!mustChangePin && <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => { setShowPinChange(false); setNewPin(''); setConfirmNewPin(''); }}>取消</button>}
          </form>
        </div>
      </div>
    );
  }

  // ================ LOGIN SCREEN ================
  if (!loggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"><Home size={32} className="text-primary" /></div>
            <h1 className="text-xl font-bold">租户入口</h1>
            <p className="text-sm text-base-content/60">Tenant Portal</p>
          </div>
          <div className="space-y-3">
            <div><label className="text-xs font-medium text-base-content/70 mb-1 block">电话号码</label>
              <input className="input input-bordered w-full" placeholder="输入租赁登记的电话号码" value={phone} onChange={e => { setPhone(e.target.value); setLoginError(''); }} autoFocus /></div>
            <div><label className="text-xs font-medium text-base-content/70 mb-1 block">PIN密码</label>
              <input type="password" className="input input-bordered w-full" placeholder="输入PIN密码" value={pin} onChange={e => { setPin(e.target.value); setLoginError(''); }} onKeyDown={e => e.key === 'Enter' && handleLogin()} /></div>
            {loginError && <p className="text-error text-sm">{loginError}</p>}
            <button className="btn btn-primary w-full" onClick={handleLogin} disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-sm" /> : '登录'}
            </button>
          </div>
          <p className="text-xs text-center text-base-content/50">首次登录默认PIN: 1234</p>
          {onBackToMain && <button className="btn btn-ghost btn-sm w-full" onClick={onBackToMain}><ArrowLeft size={14} /> 返回管理员登录</button>}
        </div>
      </div>
    );
  }

  // ================ MAIN PORTAL ================
  const pendingInvs = invoices.filter(i => i.status === 'pending' || (i.status as string) === 'confirming');
  const overdueInvs = invoices.filter(i => i.status === 'overdue');
  const allOutstanding = [...pendingInvs, ...overdueInvs];
  const totalOutstanding = allOutstanding.reduce((s, i) => s + i.amount, 0);
  const paymentStatus: 'clear' | 'pending' | 'overdue' = overdueInvs.length > 0 ? 'overdue' : (pendingInvs.length > 0 ? 'pending' : 'clear');
  const openTickets = tickets.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

  // Bill filter
  const filteredInvoices = invoices.filter(i => {
    if (billFilter === 'pending') return i.status === 'pending' || i.status === 'overdue' || (i.status as string) === 'confirming';
    if (billFilter === 'paid') return i.status === 'paid';
    return true;
  });
  const pendingCount = invoices.filter(i => i.status === 'pending' || i.status === 'overdue' || (i.status as string) === 'confirming').length;
  const paidCount = invoices.filter(i => i.status === 'paid').length;

  const recentActivity = getRecentActivity();

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* Header */}
      {!hideHeader && (
        <header className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0 border-b border-base-300" data-theme="vencos-dark">
          <div><h1 className="text-lg font-bold">🏠 租户入口</h1><p className="text-xs opacity-70">欢迎, {tenantName}</p></div>
          <div className="flex items-center gap-1">
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}><LogOut size={16} /> 退出</button>
          </div>
        </header>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 pb-20 pt-3">

        {/* ===== HOME TAB ===== */}
        {tab === 'home' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">{getGreeting()}，{tenantName}</h2>

            {/* Payment Status Card */}
            <div className={`card shadow-md ${paymentStatus === 'clear' ? 'bg-success/10 border border-success/30' : paymentStatus === 'overdue' ? 'bg-error/10 border border-error/30' : 'bg-warning/10 border border-warning/30'}`}>
              <div className="card-body p-4 text-center">
                {paymentStatus === 'clear' ? (
                  <><div className="text-4xl mb-1">✅</div><p className="text-lg font-bold text-success">账单已结清</p><p className="text-sm text-base-content/60">所有账单均已付款，感谢您！</p></>
                ) : paymentStatus === 'overdue' ? (
                  <><div className="text-4xl mb-1">🔴</div>
                    <p className="text-sm font-semibold text-error">有逾期账单</p>
                    <p className="text-2xl font-bold text-error">RM {totalOutstanding.toLocaleString()}</p>
                    <p className="text-xs text-base-content/60">{overdueInvs.length} 张逾期 · {pendingInvs.length} 张待付</p>
                    <button className="btn btn-error btn-sm mt-2" onClick={() => { setTab('bills'); setBillFilter('pending'); }}>查看详情</button>
                  </>
                ) : (
                  <><div className="text-4xl mb-1">⚠️</div>
                    <p className="text-sm font-semibold text-warning">有待付账单</p>
                    <p className="text-2xl font-bold text-warning">RM {totalOutstanding.toLocaleString()}</p>
                    <p className="text-xs text-base-content/60">{pendingInvs.length} 张待付账单</p>
                    {(() => {
                      const nearest = allOutstanding.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))[0];
                      return nearest ? <p className="text-xs text-base-content/50 mt-1">最近到期: {nearest.due_date}</p> : null;
                    })()}
                    <button className="btn btn-warning btn-sm mt-2" onClick={() => { setTab('bills'); setBillFilter('pending'); }}>查看详情</button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-outline btn-sm h-auto py-3 flex-col gap-1" onClick={() => setTab('bills')}>
                <FileText size={20} className="text-primary" /><span className="text-xs">查看账单</span>
              </button>
              <button className="btn btn-outline btn-sm h-auto py-3 flex-col gap-1" onClick={() => { setTab('repair'); setShowRepairForm(true); }}>
                <Wrench size={20} className="text-orange-500" /><span className="text-xs">我要报修</span>
              </button>
            </div>

            {/* Open tickets summary */}
            {openTickets.length > 0 && (
              <div className="card bg-base-200">
                <div className="card-body p-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1"><Wrench size={14} className="text-primary" /> 进行中维修 ({openTickets.length})</h3>
                  {openTickets.slice(0, 2).map(t => {
                    const stepIdx = PROGRESS_STEPS.findIndex(s => s.key === t.status);
                    return (
                      <div key={t.id} className="mt-2 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{t.title}</p>
                          <div className="flex gap-0.5 mt-1">
                            {PROGRESS_STEPS.map((s, i) => (
                              <div key={s.key} className={`h-1 flex-1 rounded-full ${i <= stepIdx ? 'bg-primary' : 'bg-base-300'}`} />
                            ))}
                          </div>
                        </div>
                        <span className="text-[10px] text-base-content/60 shrink-0">{PROGRESS_STEPS[stepIdx]?.label}</span>
                      </div>
                    );
                  })}
                  {openTickets.length > 2 && <button className="btn btn-ghost btn-xs mt-1" onClick={() => setTab('repair')}>查看全部 →</button>}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            {recentActivity.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Clock size={14} /> 最近动态</h3>
                <div className="space-y-1.5">
                  {recentActivity.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span>{ev.icon}</span>
                      <div className="flex-1">
                        <span className={ev.color}>{ev.text}</span>
                        <span className="text-base-content/40 ml-2">{ev.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== BILLS TAB ===== */}
        {tab === 'bills' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1"><FileText size={14} /> 我的账单</h3>

            {/* Filter pills */}
            <div className="flex gap-1">
              {[
                { key: 'all' as const, label: '全部', count: invoices.length },
                { key: 'pending' as const, label: '待付', count: pendingCount },
                { key: 'paid' as const, label: '已付', count: paidCount },
              ].map(f => (
                <button key={f.key} onClick={() => setBillFilter(f.key)}
                  className={`btn btn-xs gap-1 ${billFilter === f.key ? 'btn-primary' : 'btn-ghost bg-base-200'}`}>
                  {f.label} <span className="badge badge-xs">{f.count}</span>
                </button>
              ))}
            </div>

            {/* Bank accounts info */}
            {bankAccounts.length > 0 && billFilter !== 'paid' && (
              <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="card-body p-3">
                  <p className="text-xs font-semibold flex items-center gap-1"><CreditCard size={12} className="text-blue-500" /> 收款账户信息</p>
                  {bankAccounts.map(ba => (
                    <div key={ba.id} className="text-xs mt-1 pl-4">
                      <p><span className="text-base-content/60">银行:</span> {ba.bank_name}</p>
                      <p><span className="text-base-content/60">户口:</span> <span className="font-mono font-bold">{ba.account_no}</span></p>
                      <p><span className="text-base-content/60">户名:</span> {ba.account_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invoice list */}
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-12 text-base-content/50"><FileText size={40} className="mx-auto mb-2 opacity-30" /><p>暂无{billFilter === 'paid' ? '已付' : billFilter === 'pending' ? '待付' : ''}账单</p></div>
            ) : (
              filteredInvoices.map(inv => {
                const st = statusLabel(inv.status);
                let adjustments: Array<{ name: string; amount: number }> = [];
                try { adjustments = JSON.parse(inv.adjustments || '[]'); } catch {}
                const isPayable = inv.status === 'pending' || inv.status === 'overdue';
                const isConfirming = (inv.status as string) === 'confirming';
                return (
                  <div key={inv.id} className={`card ${inv.status === 'overdue' ? 'bg-error/5 border border-error/20' : 'bg-base-200'}`}>
                    <div className="card-body p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold">{inv.invoice_no}</span>
                        <span className={`badge badge-sm ${st.cls}`}>{st.label}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-base-content/60">{inv.property_name} · {inv.floor_label === 'G' ? '底层' : `${inv.floor_label}楼`}</span>
                        <span className={`font-bold text-sm ${inv.status === 'overdue' ? 'text-error' : 'text-primary'}`}>RM {inv.amount.toLocaleString()}</span>
                      </div>
                      {/* Breakdown */}
                      <div className="text-[11px] text-base-content/50 space-y-0.5">
                        {inv.rent_amount > 0 && <div className="flex justify-between"><span>月租</span><span>RM {inv.rent_amount.toLocaleString()}</span></div>}
                        {inv.charges_amount > 0 && <div className="flex justify-between"><span>附加费</span><span>RM {inv.charges_amount.toLocaleString()}</span></div>}
                        {adjustments.map((adj, i) => (
                          <div key={i} className={`flex justify-between ${adj.amount >= 0 ? 'text-error' : 'text-success'}`}>
                            <span>{adj.name}</span><span>{adj.amount >= 0 ? '+' : ''}RM {adj.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-base-content/40">
                        <span>账单月份: {inv.billing_month || '-'}</span><span>到期: {inv.due_date || '-'}</span>
                      </div>
                      {inv.paid_date && <p className="text-[10px] text-success">✅ 付款日: {inv.paid_date}</p>}
                      {inv.payment_method && <p className="text-[10px] text-base-content/50">付款方式: {inv.payment_method}{inv.payment_ref ? ` · Ref: ${inv.payment_ref}` : ''}</p>}

                      {/* Payment action buttons */}
                      {isPayable && (
                        <button className="btn btn-primary btn-sm w-full mt-1 gap-1" onClick={() => { setPayingInvoice(inv); setPayMethod('银行转账'); setPayRef(''); setPayReceipt(''); setPayReceiptName(''); setPayNotes(''); }}>
                          <Upload size={14} /> 我已付款
                        </button>
                      )}
                      {isConfirming && (
                        <div className="flex items-center gap-1 mt-1 bg-info/10 rounded-lg px-2 py-1.5">
                          <Clock size={12} className="text-info shrink-0" />
                          <span className="text-xs text-info">付款通知已提交，等待管理员确认</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ===== REPAIR TAB ===== */}
        {tab === 'repair' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1"><Wrench size={14} /> 维修服务</h3>

            {/* Submit button / form */}
            {!showRepairForm ? (
              <button className="btn btn-primary btn-block gap-1" onClick={() => setShowRepairForm(true)}>
                <Plus size={16} /> 提交新报修
              </button>
            ) : (
              <div className="card bg-base-200">
                <div className="card-body p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">提交维修请求</h4>
                    <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setShowRepairForm(false)}><X size={14} /></button>
                  </div>
                  {repairSubmitted ? (
                    <div className="alert alert-success py-3"><CheckCircle size={18} /> 报修已提交！管理员将尽快处理。</div>
                  ) : (
                    <>
                      <select className="select select-bordered select-sm w-full" value={repairForm.property_id} onChange={e => setRepairForm({ ...repairForm, property_id: Number(e.target.value) })}>
                        <option value={0}>-- 选择物业 --</option>
                        {floors.filter((f, i, arr) => arr.findIndex(x => x.property_id === f.property_id) === i).map(f => (
                          <option key={f.property_id} value={f.property_id}>{f.property_name}</option>
                        ))}
                      </select>
                      <select className="select select-bordered select-sm w-full" value={repairForm.category} onChange={e => setRepairForm({ ...repairForm, category: e.target.value })}>
                        {TICKET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <select className="select select-bordered select-sm w-full" value={repairForm.priority} onChange={e => setRepairForm({ ...repairForm, priority: e.target.value })}>
                        {TICKET_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                      <input className="input input-bordered input-sm w-full" placeholder="问题标题 *" value={repairForm.title} onChange={e => setRepairForm({ ...repairForm, title: e.target.value })} />
                      <textarea className="textarea textarea-bordered textarea-sm w-full" rows={3} placeholder="详细描述问题..." value={repairForm.description} onChange={e => setRepairForm({ ...repairForm, description: e.target.value })} />
                      {/* Photos */}
                      <div>
                        <p className="text-xs font-semibold mb-1">📷 照片 ({repairPhotos.length}/5)</p>
                        <div className="flex gap-2 flex-wrap">
                          {repairPhotos.map((p, i) => (
                            <div key={i} className="relative">
                              <img src={p} className="w-16 h-16 rounded object-cover" />
                              <button className="btn btn-xs btn-circle btn-error absolute -top-1 -right-1" onClick={() => setRepairPhotos(repairPhotos.filter((_, idx) => idx !== i))}>✕</button>
                            </div>
                          ))}
                          {repairPhotos.length < 5 && (
                            <button className="w-16 h-16 rounded border-2 border-dashed border-base-300 flex items-center justify-center" onClick={() => photoRef.current?.click()}>
                              <Camera size={20} className="opacity-40" />
                            </button>
                          )}
                        </div>
                        <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
                      </div>
                      <button className="btn btn-primary btn-sm w-full" onClick={handleSubmitRepair} disabled={repairSubmitting || !repairForm.title.trim() || !repairForm.property_id}>
                        {repairSubmitting ? <span className="loading loading-spinner loading-sm" /> : <><Send size={14} /> 提交</>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Ticket list with progress bar */}
            {tickets.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-base-content/70 mb-2">我的报修记录 ({tickets.length})</h4>
                <div className="space-y-2">
                  {tickets.map(t => {
                    const stepIdx = PROGRESS_STEPS.findIndex(s => s.key === t.status);
                    const isCancelled = t.status === 'cancelled';
                    const isDone = t.status === 'completed';
                    const cat = TICKET_CATEGORIES.find(c => c.value === t.category);
                    const tPhotos: string[] = (() => { try { return JSON.parse(t.photos || '[]'); } catch { return []; } })();
                    return (
                      <div key={t.id} className={`card ${isDone ? 'bg-base-200/50' : 'bg-base-200'}`}>
                        <div className="card-body p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-sm font-bold ${isDone ? 'text-base-content/60' : ''}`}>{t.title}</h4>
                            {isCancelled && <span className="badge badge-ghost badge-sm">已取消</span>}
                          </div>
                          <p className="text-xs text-base-content/60">{cat?.label} · {t.property_name}</p>
                          {t.description && <p className="text-xs text-base-content/70 whitespace-pre-wrap">{t.description}</p>}
                          {tPhotos.length > 0 && (
                            <div className="flex gap-1 overflow-x-auto">{tPhotos.map((p, i) => <img key={i} src={p} className="w-14 h-14 rounded object-cover shrink-0 cursor-pointer hover:ring-2 hover:ring-primary" onClick={() => { setTpPhotoZoom(1); setTpPhotoViewer({ photos: tPhotos, index: i }); }} />)}</div>
                          )}

                          {/* Progress bar */}
                          {!isCancelled && (
                            <div className="pt-1">
                              <div className="flex items-center gap-0">
                                {PROGRESS_STEPS.map((s, i) => (
                                  <React.Fragment key={s.key}>
                                    <div className="flex flex-col items-center" style={{ minWidth: 20 }}>
                                      <div className={`w-3 h-3 rounded-full border-2 ${i <= stepIdx ? 'bg-primary border-primary' : 'bg-base-100 border-base-300'}`} />
                                    </div>
                                    {i < PROGRESS_STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < stepIdx ? 'bg-primary' : 'bg-base-300'}`} />}
                                  </React.Fragment>
                                ))}
                              </div>
                              <div className="flex justify-between mt-0.5">
                                {PROGRESS_STEPS.map((s, i) => (
                                  <span key={s.key} className={`text-[9px] ${i <= stepIdx ? 'text-primary font-semibold' : 'text-base-content/40'}`}>{s.label}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Worker & dates */}
                          <div className="text-[10px] text-base-content/40 space-y-0.5">
                            {t.worker_name && <p className="text-primary font-medium">🔧 维修人员: {t.worker_name}</p>}
                            <p>提交于: {(t.submitted_at || t.created_at || '').slice(0, 10)}</p>
                            {t.completed_at && <p className="text-success">✅ 完成于: {t.completed_at.slice(0, 10)}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {tickets.length === 0 && !showRepairForm && (
              <div className="text-center py-10 text-base-content/50"><Wrench size={40} className="mx-auto mb-2 opacity-30" /><p className="text-sm">暂无报修记录</p></div>
            )}
          </div>
        )}

        {/* ===== PROFILE TAB ===== */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center"><User size={24} className="text-primary" /></div>
              <div><h3 className="font-bold">{tenantName}</h3><p className="text-xs text-base-content/60"><Phone size={10} className="inline mr-1" />{tenantPhone}</p></div>
            </div>

            {/* Lease details */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Building2 size={14} /> 我的租约</h4>
              {floors.map(f => {
                const li = leaseInfo(f.lease_end);
                return (
                  <div key={f.id} className="card bg-base-200 mb-2">
                    <div className="card-body p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm">{f.property_name}</h4>
                        <span className="badge badge-primary badge-sm">{f.floor_label === 'G' ? '底层' : `${f.floor_label}楼`}</span>
                      </div>
                      <p className="text-xs text-base-content/60">{f.property_address}</p>
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-4">
                          <span className="text-base-content/60 w-16 shrink-0">月租</span>
                          <span className="font-bold text-primary">RM {(f.rent_amount || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-base-content/60 w-16 shrink-0">押金</span>
                          <span>RM {(f.deposit || 0).toLocaleString()}</span>
                        </div>
                        {f.utility_deposit ? <div className="flex items-center gap-4">
                          <span className="text-base-content/60 w-16 shrink-0">水电押金</span>
                          <span>RM {f.utility_deposit.toLocaleString()}</span>
                        </div> : null}
                        <div className="flex items-center gap-4">
                          <span className="text-base-content/60 w-16 shrink-0">租期</span>
                          <span>{f.lease_start || '-'} 至 {f.lease_end || '-'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`badge badge-sm ${li.cls}`}>{li.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Account settings */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Key size={14} /> 账户设置</h4>
              <button className="btn btn-outline btn-sm w-full gap-1" onClick={() => { setOldPin(''); setNewPin(''); setConfirmNewPin(''); setPinError(''); setMustChangePin(false); setShowPinChange(true); }}>
                <Key size={14} /> 修改PIN密码
              </button>
            </div>

            {/* Contact management */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Phone size={14} /> 联系管理处</h4>
              <div className="card bg-base-200"><div className="card-body p-3">
                <p className="text-sm font-bold">VENCOS Property Management</p>
                <p className="text-xs text-base-content/60">如有紧急事务，请联系管理处</p>
              </div></div>
            </div>
          </div>
        )}
      </main>

      {/* Payment Notification Modal */}
      {payingInvoice && (
        <div className="modal modal-open" style={{ zIndex: 9999 }}>
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg flex items-center gap-2"><Upload size={20} className="text-primary" /> 通知付款</h3>
            <p className="text-sm text-base-content/70 mt-1">{payingInvoice.invoice_no} · RM {payingInvoice.amount.toLocaleString()}</p>

            {/* Bank info */}
            {bankAccounts.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 mt-3 text-xs">
                <p className="font-semibold text-blue-600 dark:text-blue-400 mb-1">💳 收款账户</p>
                {bankAccounts.map(ba => (
                  <div key={ba.id} className="ml-2">
                    <p>{ba.bank_name} · <span className="font-mono font-bold">{ba.account_no}</span></p>
                    <p className="text-base-content/60">{ba.account_name}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 mt-3">
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">付款方式</span></label>
                <select className="select select-bordered select-sm w-full" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option value="银行转账">银行转账</option>
                  <option value="在线转账">在线转账 (FPX/DuitNow)</option>
                  <option value="现金">现金</option>
                  <option value="支票">支票</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">转账参考号 (选填)</span></label>
                <input className="input input-bordered input-sm w-full" placeholder="如：转账参考号" value={payRef} onChange={e => setPayRef(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">上传付款凭证</span></label>
                {payReceipt ? (
                  <div className="flex items-center gap-2 bg-base-200 rounded-lg px-3 py-2">
                    <CheckCircle size={14} className="text-success shrink-0" />
                    <span className="text-sm truncate flex-1">{payReceiptName}</span>
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => { setPayReceipt(''); setPayReceiptName(''); }}>✕</button>
                  </div>
                ) : (
                  <button className="btn btn-outline btn-sm gap-2 w-full" onClick={() => receiptRef.current?.click()}>
                    <Camera size={14} /> 拍照 / 上传截图
                  </button>
                )}
                <input ref={receiptRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleReceiptSelect} />
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">备注 (选填)</span></label>
                <textarea className="textarea textarea-bordered textarea-sm w-full" rows={2} placeholder="备注..." value={payNotes} onChange={e => setPayNotes(e.target.value)} />
              </div>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setPayingInvoice(null)} disabled={paySubmitting}>取消</button>
              <button className="btn btn-primary btn-sm gap-1" onClick={submitPaymentNotification} disabled={paySubmitting}>
                {paySubmitting ? <span className="loading loading-spinner loading-xs" /> : <Send size={14} />}
                提交付款通知
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !paySubmitting && setPayingInvoice(null)} />
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-base-300" data-theme="vencos-dark">
        <div className="flex items-center justify-around h-14 max-w-md mx-auto">
          {[
            { key: 'home' as const, label: '首页', Icon: Home, badge: 0 },
            { key: 'bills' as const, label: '账单', Icon: FileText, badge: pendingCount },
            { key: 'repair' as const, label: '报修', Icon: Wrench, badge: openTickets.length },
            { key: 'profile' as const, label: '我的', Icon: User, badge: 0 },
          ].map(n => (
            <button key={n.key} onClick={() => setTab(n.key)}
              className={`flex flex-col items-center justify-center flex-1 h-12 rounded-lg mx-0.5 transition-all relative ${tab === n.key ? 'bg-primary/15 text-primary' : 'text-base-content/70'}`}>
              <n.Icon size={20} />
              <span className="text-[10px] mt-0.5">{n.label}</span>
              {n.badge > 0 && <span className="absolute top-0.5 right-1/4 badge badge-error badge-xs text-[8px]">{n.badge}</span>}
            </button>
          ))}
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </nav>

      {/* Photo Viewer Modal */}
      {tpPhotoViewer && (
        <div className="modal modal-open" style={{ zIndex: 9999 }} onClick={() => setTpPhotoViewer(null)}>
          <div className="modal-box max-w-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">📷 照片 ({tpPhotoViewer.index + 1}/{tpPhotoViewer.photos.length})</h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setTpPhotoViewer(null)}><X size={18} /></button>
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              {tpPhotoViewer.photos.length > 1 && (
                <button className="btn btn-sm btn-ghost" onClick={() => setTpPhotoViewer(v => v ? { ...v, index: (v.index - 1 + v.photos.length) % v.photos.length } : null)}><ChevronLeft size={18} /></button>
              )}
              <button className="btn btn-xs btn-ghost gap-1" onClick={() => setTpPhotoZoom(z => Math.max(0.5, z - 0.25))}><ZoomOut size={14} /></button>
              <span className="text-xs font-mono min-w-[40px] text-center">{Math.round(tpPhotoZoom * 100)}%</span>
              <button className="btn btn-xs btn-ghost gap-1" onClick={() => setTpPhotoZoom(z => Math.min(3, z + 0.25))}><ZoomIn size={14} /></button>
              {tpPhotoZoom !== 1 && <button className="btn btn-xs btn-ghost gap-1" onClick={() => setTpPhotoZoom(1)}><RotateCcw size={14} /></button>}
              {tpPhotoViewer.photos.length > 1 && (
                <button className="btn btn-sm btn-ghost" onClick={() => setTpPhotoViewer(v => v ? { ...v, index: (v.index + 1) % v.photos.length } : null)}><ChevronRight size={18} /></button>
              )}
            </div>
            <div className="flex justify-center overflow-auto max-h-[70vh] bg-base-200 rounded-lg">
              <img src={tpPhotoViewer.photos[tpPhotoViewer.index]} alt="照片" className="rounded-lg transition-transform" style={{ transform: `scale(${tpPhotoZoom})`, transformOrigin: 'top center' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
