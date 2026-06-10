import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, Building2, Receipt, BarChart3, Bell, BellOff, BellRing,
  LogOut, ChevronDown, ChevronUp, Home, AlertCircle, TrendingDown, TrendingUp,
  Landmark, CalendarClock, DollarSign, Wallet, Percent, ArrowUpRight,
  ArrowDownRight, PiggyBank, Download, Zap, Droplets, MapPin, Key, Shield,
  Users, FileText, Clock, CreditCard, Activity, Eye, Banknote
} from 'lucide-react';
import { isPushSupported, getNotificationPermission, requestNotificationPermission } from '../utils/push';
import { downloadCsv } from '../utils/export';

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

interface StakeholderPortalProps {
  user: { id: number; name: string; role: string; phone?: string };
  onLogout: () => void;
  hideHeader?: boolean;
}

type Rec = Record<string, unknown>;

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

const N = (v: unknown): number => Number(v || 0);
const S = (v: unknown): string => String(v ?? '');

const fmtCurrency = (v: number): string => {
  if (v < 0) return '-RM ' + Math.abs(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return 'RM ' + v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (v: unknown): string => {
  if (!v) return '-';
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const fmtPct = (v: number): string => v.toFixed(1) + '%';

const daysUntil = (dateStr: unknown): number => {
  if (!dateStr) return Infinity;
  const d = new Date(String(dateStr));
  if (isNaN(d.getTime())) return Infinity;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
};

const todayStr = (): string =>
  new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

const currentBillingMonth = (): string => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
};

/** Estimate current loan balance via amortization */
const estimateLoanBalance = (
  loanAmount: number,
  interestRate: number,
  monthlyPayment: number,
  loanStart: unknown
): number => {
  if (!loanAmount || !monthlyPayment || !loanStart) return loanAmount;
  const startDate = new Date(String(loanStart));
  if (isNaN(startDate.getTime())) return loanAmount;
  const monthlyRate = interestRate / 12 / 100;
  let balance = loanAmount;
  const now = new Date();
  let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cur < now && balance > 0) {
    const interest = balance * monthlyRate;
    if (monthlyPayment <= interest) break;
    const principal = monthlyPayment - interest;
    balance -= principal;
    cur.setMonth(cur.getMonth() + 1);
  }
  return Math.max(0, balance);
};

const estimatePayoffDate = (loanStart: unknown, tenureMonths: number): string => {
  if (!loanStart || !tenureMonths) return '-';
  const d = new Date(String(loanStart));
  if (isNaN(d.getTime())) return '-';
  d.setMonth(d.getMonth() + tenureMonths);
  return fmtDate(d);
};

const sqlQuery = (sql: string): Promise<Rec[]> =>
  (window as any).tasklet.sqlQuery(sql);

/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATION BELL
   ═══════════════════════════════════════════════════════════════════ */

const NotificationBell: React.FC = () => {
  const [perm, setPerm] = useState<string>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(isPushSupported());
    setPerm(getNotificationPermission());
  }, []);

  const toggle = async () => {
    if (perm === 'granted') return;
    const result = await requestNotificationPermission();
    setPerm(result);
  };

  if (!supported) return null;

  const Icon = perm === 'granted' ? BellRing : perm === 'denied' ? BellOff : Bell;
  return (
    <button onClick={toggle} className="btn btn-ghost btn-sm btn-circle" title="通知">
      <Icon size={18} />
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export const StakeholderPortal: React.FC<StakeholderPortalProps> = ({ user, onLogout, hideHeader }) => {
  /* ── state ── */
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Rec[]>([]);
  const [floorUnits, setFloorUnits] = useState<Rec[]>([]);
  const [invoices, setInvoices] = useState<Rec[]>([]);
  const [purchaseCosts, setPurchaseCosts] = useState<Rec[]>([]);
  const [recurringCharges, setRecurringCharges] = useState<Rec[]>([]);
  const [meters, setMeters] = useState<Rec[]>([]);
  const [owners, setOwners] = useState<Rec[]>([]);
  const [expandedProps, setExpandedProps] = useState<Set<number>>(new Set());
  const [expandedAlerts, setExpandedAlerts] = useState(false);
  const [billingFilter, setBillingFilter] = useState<number | 'all'>('all');
  const [reportSub, setReportSub] = useState(0);

  const fontStyle = { fontFamily: 'Avenir, Arial, sans-serif' };

  /* ── data fetching ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const propSql = `SELECT p.* FROM vc_properties p WHERE p.id IN (SELECT property_id FROM vc_user_access WHERE user_id = ${user.id}) OR p.owner_id IN (SELECT owner_id FROM vc_user_owner_access WHERE user_id = ${user.id})`;
      const props = await sqlQuery(propSql);
      setProperties(props);

      if (props.length === 0) { setLoading(false); return; }

      const propIds = props.map(p => N(p.id)).join(',');
      const ownerIds = [...new Set(props.map(p => N(p.owner_id)).filter(id => id > 0))].join(',');

      const [fu, inv, pc, rc, mt, ow] = await Promise.all([
        sqlQuery(`SELECT * FROM vc_floor_units WHERE property_id IN (${propIds}) ORDER BY property_id, floor_label`),
        sqlQuery(`SELECT i.*, f.tenant_name FROM vc_invoices i LEFT JOIN vc_floor_units f ON i.tenant_id = f.id WHERE i.property_id IN (${propIds}) ORDER BY i.due_date DESC`),
        sqlQuery(`SELECT * FROM vc_purchase_costs WHERE property_id IN (${propIds}) ORDER BY property_id, paid_date`),
        sqlQuery(`SELECT * FROM vc_recurring_charges WHERE property_id IN (${propIds}) ORDER BY property_id`),
        sqlQuery(`SELECT * FROM vc_meters WHERE property_id IN (${propIds}) ORDER BY property_id`),
        ownerIds ? sqlQuery(`SELECT * FROM vc_owners WHERE id IN (${ownerIds})`) : Promise.resolve([]),
      ]);

      setFloorUnits(fu);
      setInvoices(inv);
      setPurchaseCosts(pc);
      setRecurringCharges(rc);
      setMeters(mt);
      setOwners(ow);
    } catch (e) {
      console.error('StakeholderPortal fetch error:', e);
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── toggle helpers ── */
  const toggleProp = (id: number) => {
    setExpandedProps(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  /* ── computed data helpers ── */
  const getUnits = (propId: number) => floorUnits.filter(u => N(u.property_id) === propId);
  const getPurchaseCosts = (propId: number) => purchaseCosts.filter(c => N(c.property_id) === propId);
  const getRecurring = (propId: number) => recurringCharges.filter(c => N(c.property_id) === propId);
  const getMeters = (propId: number) => meters.filter(m => N(m.property_id) === propId);
  const getOwner = (ownerId: number) => owners.find(o => N(o.id) === ownerId);

  const getMonthlyRent = (p: Rec): number => {
    const units = getUnits(N(p.id));
    const unitRent = units.reduce((s, u) => s + N(u.rent_amount), 0);
    if (unitRent > 0) return unitRent;
    if (S(p.status) === '出租中' || S(p.status) === 'rented') return N(p.rental_price);
    return 0;
  };

  const getMgmtFee = (p: Rec): number => {
    if (S(p.mgmt_fee_type) === 'fixed') return N(p.mgmt_fee_amount);
    if (N(p.mgmt_fee_pct) > 0) return getMonthlyRent(p) * N(p.mgmt_fee_pct) / 100;
    return N(p.mgmt_fee_amount);
  };

  const getMonthlyExpense = (p: Rec): number => {
    const propId = N(p.id);
    const recurring = getRecurring(propId).reduce((s, c) => {
      const amt = N(c.amount);
      const freq = S(c.frequency).toLowerCase();
      if (freq === 'yearly' || freq === 'annual') return s + amt / 12;
      if (freq === 'quarterly') return s + amt / 3;
      return s + amt;
    }, 0);
    return N(p.monthly_repayment) + getMgmtFee(p) + N(p.indah_water) + N(p.service_charge) +
      recurring + N(p.land_tax) / 12 + (N(p.assessment_tax) * 2) / 12;
  };

  const getEstimatedBalance = (p: Rec): number =>
    estimateLoanBalance(N(p.loan_amount), N(p.loan_interest_rate), N(p.monthly_repayment), p.loan_start);

  const getPurchaseTotal = (p: Rec): number =>
    N(p.price) + getPurchaseCosts(N(p.id)).reduce((s, c) => s + N(c.amount), 0);

  /* ── aggregate calculations ── */
  const totalAssets = properties.reduce((s, p) => s + getPurchaseTotal(p), 0);
  const totalLoanBalance = properties.reduce((s, p) => s + getEstimatedBalance(p), 0);
  const netAssets = totalAssets - totalLoanBalance;
  const totalMonthlyRent = properties.reduce((s, p) => s + getMonthlyRent(p), 0);
  const totalMonthlyExpense = properties.reduce((s, p) => s + getMonthlyExpense(p), 0);
  const monthlyNet = totalMonthlyRent - totalMonthlyExpense;
  const totalPurchasePrice = properties.reduce((s, p) => s + N(p.price), 0);
  const totalPurchaseFees = totalAssets - totalPurchasePrice;

  const totalUnits = floorUnits.length || properties.length;
  const occupiedUnits = floorUnits.length > 0
    ? floorUnits.filter(u => S(u.status) !== '空置' && S(u.status) !== 'vacant' && S(u.tenant_name)).length
    : properties.filter(p => S(p.status) === '出租中' || S(p.status) === 'rented').length;
  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

  const bm = currentBillingMonth();
  const currentInvoices = invoices.filter(i => S(i.billing_month) === bm || S(i.billing_month).startsWith(bm));
  const nonCancelledCurrent = currentInvoices.filter(i => S(i.status) !== 'cancelled' && S(i.status) !== '已取消');
  const paidCurrent = nonCancelledCurrent.filter(i => S(i.status) === 'paid' || S(i.status) === '已付');
  const collectionRate = nonCancelledCurrent.length > 0
    ? (paidCurrent.reduce((s, i) => s + N(i.amount), 0) / nonCancelledCurrent.reduce((s, i) => s + N(i.amount), 0)) * 100
    : 0;

  const overdueInvoices = invoices.filter(i => S(i.status) === 'overdue' || S(i.status) === '逾期');
  const pendingInvoices = invoices.filter(i => S(i.status) === 'pending' || S(i.status) === '待付');
  const expiringLeases = floorUnits.filter(u => {
    const d = daysUntil(u.lease_end);
    return d >= 0 && d <= 90;
  });

  const totalLoanOriginal = properties.reduce((s, p) => s + N(p.loan_amount), 0);
  const totalMonthlyRepayment = properties.reduce((s, p) => s + N(p.monthly_repayment), 0);
  const totalOtherExpense = totalMonthlyExpense - totalMonthlyRepayment;
  const loanPayoffPct = totalLoanOriginal > 0 ? ((totalLoanOriginal - totalLoanBalance) / totalLoanOriginal) * 100 : 0;

  /* ── card wrapper ── */
  const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-base-100 rounded-xl p-4 shadow-sm border border-base-200 ${className || ''}`}>
      {children}
    </div>
  );

  /* ── badge helper ── */
  const StatusBadge: React.FC<{ status: string; small?: boolean }> = ({ status, small }) => {
    const s = status.toLowerCase();
    let color = 'badge-ghost';
    let label = status;
    if (s === 'paid' || s === '已付') { color = 'badge-success'; label = '已付'; }
    else if (s === 'overdue' || s === '逾期') { color = 'badge-error'; label = '逾期'; }
    else if (s === 'pending' || s === '待付') { color = 'badge-warning'; label = '待付'; }
    else if (s === 'cancelled' || s === '已取消') { color = 'badge-ghost'; label = '已取消'; }
    else if (s === 'partial' || s === '部分') { color = 'badge-info'; label = '部分付'; }
    return <span className={`badge ${color} ${small ? 'badge-xs' : 'badge-sm'}`}>{label}</span>;
  };

  const LeaseBadge: React.FC<{ leaseEnd: unknown; status?: unknown }> = ({ leaseEnd, status }) => {
    const st = S(status).toLowerCase();
    if (st === '空置' || st === 'vacant') return <span className="badge badge-ghost badge-sm">空置</span>;
    const d = daysUntil(leaseEnd);
    if (d < 0) return <span className="badge badge-error badge-sm">已过期</span>;
    if (d <= 30) return <span className="badge badge-warning badge-sm">{d}天到期</span>;
    if (d <= 90) return <span className="badge badge-info badge-sm">{d}天到期</span>;
    return <span className="badge badge-success badge-sm">正常</span>;
  };

  /* ═══════════════════════════════════════════════════════════════
     TAB 1: 首页 DASHBOARD
     ═══════════════════════════════════════════════════════════════ */
  const renderDashboard = () => (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="px-1">
        <h2 className="text-xl font-bold">{getGreeting()}，{user.name}</h2>
        <p className="text-xs text-base-content/60 mt-0.5">{todayStr()}</p>
      </div>

      {/* Portfolio Value */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <PiggyBank size={16} className="text-primary" />
          </div>
          <span className="font-semibold text-sm">资产总览</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-xs text-base-content/60">总资产价值</span>
            <span className="text-xl font-bold text-primary">{fmtCurrency(totalAssets)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-base-content/60">总贷款余额</span>
            <span className="text-sm font-semibold text-error">{fmtCurrency(totalLoanBalance)}</span>
          </div>
          <div className="divider my-1"></div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold">净资产</span>
            <span className={`text-lg font-bold ${netAssets >= 0 ? 'text-success' : 'text-error'}`}>
              {fmtCurrency(netAssets)}
            </span>
          </div>
        </div>
      </Card>

      {/* Monthly Cash Flow */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-info/15 flex items-center justify-center">
            <Activity size={16} className="text-info" />
          </div>
          <span className="font-semibold text-sm">月度现金流</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-success/5 rounded-lg p-2">
            <div className="text-[10px] text-base-content/60 mb-1">月租收入</div>
            <div className="text-sm font-bold text-success">{fmtCurrency(totalMonthlyRent)}</div>
            <div className="text-[9px] text-base-content/40 mt-0.5">租金 {fmtCurrency(totalMonthlyRent)}</div>
          </div>
          <div className="bg-error/5 rounded-lg p-2">
            <div className="text-[10px] text-base-content/60 mb-1">月总支出</div>
            <div className="text-sm font-bold text-error">{fmtCurrency(totalMonthlyExpense)}</div>
            <div className="text-[9px] text-base-content/40 mt-0.5">供期 {fmtCurrency(totalMonthlyRepayment)}<br/>其他 {fmtCurrency(totalOtherExpense)}</div>
          </div>
          <div className={`${monthlyNet >= 0 ? 'bg-success/5' : 'bg-error/5'} rounded-lg p-2`}>
            <div className="text-[10px] text-base-content/60 mb-1">月净收入</div>
            <div className={`text-sm font-bold ${monthlyNet >= 0 ? 'text-success' : 'text-error'}`}>
              {fmtCurrency(monthlyNet)}
            </div>
            {monthlyNet >= 0
              ? <ArrowUpRight size={12} className="text-success mx-auto mt-1" />
              : <ArrowDownRight size={12} className="text-error mx-auto mt-1" />}
          </div>
        </div>
      </Card>

      {/* Alerts */}
      {(overdueInvoices.length > 0 || expiringLeases.length > 0 || pendingInvoices.length > 0) && (
        <Card className="border-warning/30">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setExpandedAlerts(!expandedAlerts)}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center">
                <AlertCircle size={16} className="text-warning" />
              </div>
              <span className="font-semibold text-sm">
                提醒事项
                <span className="badge badge-warning badge-xs ml-2">
                  {overdueInvoices.length + expiringLeases.length + pendingInvoices.length}
                </span>
              </span>
            </div>
            {expandedAlerts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedAlerts && (
            <div className="mt-3 space-y-2">
              {overdueInvoices.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-error/5 rounded-lg">
                  <span className="text-error text-lg">🔴</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-error">逾期账单 × {overdueInvoices.length}</div>
                    <div className="text-xs text-base-content/60">
                      总额 {fmtCurrency(overdueInvoices.reduce((s, i) => s + N(i.amount), 0))}
                    </div>
                  </div>
                </div>
              )}
              {expiringLeases.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-warning/5 rounded-lg">
                  <span className="text-warning text-lg">🟡</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-warning">租约即将到期 × {expiringLeases.length}</div>
                    <div className="text-xs text-base-content/60">
                      {expiringLeases.map(u => `${S(u.tenant_name)}(${daysUntil(u.lease_end)}天)`).join('、')}
                    </div>
                  </div>
                </div>
              )}
              {pendingInvoices.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-info/5 rounded-lg">
                  <span className="text-info text-lg">⏳</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-info">待收账单 × {pendingInvoices.length}</div>
                    <div className="text-xs text-base-content/60">
                      总额 {fmtCurrency(pendingInvoices.reduce((s, i) => s + N(i.amount), 0))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-primary" />
            <span className="text-xs text-base-content/60">物业数量</span>
          </div>
          <div className="text-2xl font-bold mt-1">{properties.length}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <Key size={14} className="text-primary" />
            <span className="text-xs text-base-content/60">出租单位</span>
          </div>
          <div className="text-2xl font-bold mt-1">{occupiedUnits}/{totalUnits}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-primary" />
            <span className="text-xs text-base-content/60">入住率</span>
          </div>
          <div className={`text-2xl font-bold mt-1 ${occupancyRate >= 80 ? 'text-success' : occupancyRate >= 50 ? 'text-warning' : 'text-error'}`}>
            {fmtPct(occupancyRate)}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <Wallet size={14} className="text-primary" />
            <span className="text-xs text-base-content/60">收款率</span>
          </div>
          <div className={`text-2xl font-bold mt-1 ${collectionRate >= 80 ? 'text-success' : collectionRate >= 50 ? 'text-warning' : 'text-error'}`}>
            {fmtPct(collectionRate)}
          </div>
        </Card>
      </div>

      {/* Loan Summary Mini */}
      {totalLoanOriginal > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
              <Landmark size={16} className="text-error" />
            </div>
            <span className="font-semibold text-sm">贷款摘要</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
            <div>
              <div className="text-base-content/50">原始贷款</div>
              <div className="font-semibold mt-0.5">{fmtCurrency(totalLoanOriginal)}</div>
            </div>
            <div>
              <div className="text-base-content/50">剩余余额</div>
              <div className="font-semibold text-error mt-0.5">{fmtCurrency(totalLoanBalance)}</div>
            </div>
            <div>
              <div className="text-base-content/50">月总供期</div>
              <div className="font-semibold mt-0.5">{fmtCurrency(totalMonthlyRepayment)}</div>
            </div>
          </div>
          <div className="w-full bg-base-200 rounded-full h-2.5">
            <div
              className="bg-success h-2.5 rounded-full transition-all"
              style={{ width: `${Math.min(loanPayoffPct, 100)}%` }}
            />
          </div>
          <div className="text-right text-xs text-base-content/50 mt-1">已还 {fmtPct(loanPayoffPct)}</div>
        </Card>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     TAB 2: 资产 PROPERTY DEEP-DIVE
     ═══════════════════════════════════════════════════════════════ */
  const renderAssets = () => (
    <div className="space-y-3">
      <h2 className="text-lg font-bold px-1">我的资产</h2>
      {properties.length === 0 && (
        <Card><p className="text-center text-sm text-base-content/50 py-6">暂无物业数据</p></Card>
      )}
      {properties.map(p => {
        const propId = N(p.id);
        const expanded = expandedProps.has(propId);
        const units = getUnits(propId);
        const propRent = getMonthlyRent(p);
        const owner = getOwner(N(p.owner_id));
        const hasLoan = N(p.loan_amount) > 0;
        const costs = getPurchaseCosts(propId);
        const recurring = getRecurring(propId);
        const propMeters = getMeters(propId);
        const balance = getEstimatedBalance(p);
        const payoffPct = N(p.loan_amount) > 0 ? ((N(p.loan_amount) - balance) / N(p.loan_amount)) * 100 : 0;
        const monthlyExp = getMonthlyExpense(p);
        const mgmtFee = getMgmtFee(p);

        const isRented = units.some(u => S(u.status) !== '空置' && S(u.status) !== 'vacant' && S(u.tenant_name))
          || S(p.status) === '出租中' || S(p.status) === 'rented';

        return (
          <Card key={propId}>
            {/* Collapsed header */}
            <button className="flex items-start justify-between w-full text-left" onClick={() => toggleProp(propId)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm truncate">{S(p.name)}</span>
                  <span className={`badge badge-sm ${isRented ? 'badge-success' : 'badge-ghost'}`}>
                    {isRented ? '出租中' : '空置'}
                  </span>
                </div>
                <div className="text-xs text-base-content/50 mt-0.5 truncate">{S(p.address)}</div>
                {owner && <div className="text-xs text-base-content/40 mt-0.5">{S(owner.name)}</div>}
                <div className="text-sm font-semibold text-success mt-1">{fmtCurrency(propRent)}/月</div>
              </div>
              <div className="ml-2 mt-1">
                {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {/* Expanded content */}
            {expanded && (
              <div className="mt-4 space-y-4">
                {/* Section A: Property Info */}
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                    <FileText size={14} className="text-primary" /> 物业资料
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="text-base-content/50">类型</div>
                    <div className="font-medium">{S(p.type) || '-'}</div>
                    <div className="text-base-content/50">面积</div>
                    <div className="font-medium">{N(p.area_sqft) ? `${N(p.area_sqft).toLocaleString()} sqft` : '-'}</div>
                    <div className="text-base-content/50">房间/浴室</div>
                    <div className="font-medium">{N(p.bedrooms) || '-'} / {N(p.bathrooms) || '-'}</div>
                    {N(p.floor_count) > 0 && <>
                      <div className="text-base-content/50">楼层数</div>
                      <div className="font-medium">{N(p.floor_count)}</div>
                    </>}
                    {S(p.hakmilik_no) && <>
                      <div className="text-base-content/50">Hakmilik No</div>
                      <div className="font-medium">{S(p.hakmilik_no)}</div>
                    </>}
                    <div className="text-base-content/50">地址</div>
                    <div className="font-medium col-span-1">{S(p.address) || '-'}</div>
                    <div className="text-base-content/50">购入价</div>
                    <div className="font-medium text-primary">{N(p.price) ? fmtCurrency(N(p.price)) : '-'}</div>
                    <div className="text-base-content/50">月租定价</div>
                    <div className="font-medium">{N(p.rental_price) ? fmtCurrency(N(p.rental_price)) : '-'}</div>
                    <div className="text-base-content/50">状态</div>
                    <div className="font-medium">{S(p.status) || '-'}</div>
                  </div>
                </div>

                {/* Section B: Tenants */}
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                    <Users size={14} className="text-primary" /> 租赁状况
                  </h4>
                  {units.length === 0 ? (
                    <p className="text-xs text-base-content/40">暂无单位数据</p>
                  ) : (
                    <div className="space-y-3">
                      {units.map(u => {
                        const uid = N(u.id);
                        return (
                          <div key={uid} className="bg-base-200/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs">{S(u.floor_label)}</span>
                                <LeaseBadge leaseEnd={u.lease_end} status={u.status} />
                              </div>
                              <span className="text-xs font-bold text-success">{fmtCurrency(N(u.rent_amount))}/月</span>
                            </div>
                            {S(u.tenant_name) && (
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-2">
                                <div className="text-base-content/50">租户</div>
                                <div className="font-medium">{S(u.tenant_name)}</div>
                                {S(u.tenant_phone) && <>
                                  <div className="text-base-content/50">电话</div>
                                  <div className="font-medium">{S(u.tenant_phone)}</div>
                                </>}
                                <div className="text-base-content/50">押金</div>
                                <div className="font-medium">{fmtCurrency(N(u.deposit))}</div>
                                {N(u.utility_deposit) > 0 && <>
                                  <div className="text-base-content/50">杂费押金</div>
                                  <div className="font-medium">{fmtCurrency(N(u.utility_deposit))}</div>
                                </>}
                                <div className="text-base-content/50">租约期</div>
                                <div className="font-medium">{fmtDate(u.lease_start)} ~ {fmtDate(u.lease_end)}</div>
                                {S(u.tenant_company_reg) && <>
                                  <div className="text-base-content/50">公司注册号</div>
                                  <div className="font-medium">{S(u.tenant_company_reg)}</div>
                                </>}
                                {S(u.tenant_address) && <>
                                  <div className="text-base-content/50">租户地址</div>
                                  <div className="font-medium">{S(u.tenant_address)}</div>
                                </>}
                                {S(u.director_name) && <>
                                  <div className="text-base-content/50">负责人</div>
                                  <div className="font-medium">{S(u.director_name)}</div>
                                </>}
                                {S(u.director_ic) && <>
                                  <div className="text-base-content/50">身份证号</div>
                                  <div className="font-medium">{S(u.director_ic)}</div>
                                </>}
                                {S(u.director_phone) && <>
                                  <div className="text-base-content/50">负责人电话</div>
                                  <div className="font-medium">{S(u.director_phone)}</div>
                                </>}
                                {S(u.director_notes) && <>
                                  <div className="text-base-content/50">备注</div>
                                  <div className="font-medium">{S(u.director_notes)}</div>
                                </>}
                                {S(u.tenant_bank_name) && <>
                                  <div className="text-base-content/50">银行</div>
                                  <div className="font-medium">{S(u.tenant_bank_name)}</div>
                                </>}
                                {S(u.tenant_bank_account) && <>
                                  <div className="text-base-content/50">银行户口</div>
                                  <div className="font-medium">{S(u.tenant_bank_account)}</div>
                                </>}
                                {S(u.agent_name) && <>
                                  <div className="text-base-content/50">经纪人</div>
                                  <div className="font-medium">{S(u.agent_name)}{S(u.agent_company) ? ` (${S(u.agent_company)})` : ''}</div>
                                </>}
                                {S(u.agent_phone) && <>
                                  <div className="text-base-content/50">经纪人电话</div>
                                  <div className="font-medium">{S(u.agent_phone)}</div>
                                </>}
                                {S(u.linked_lease_ref) && <>
                                  <div className="text-base-content/50">租约参考</div>
                                  <div className="font-medium">{S(u.linked_lease_ref)}</div>
                                </>}
                                {S(u.notes) && <>
                                  <div className="text-base-content/50">备注</div>
                                  <div className="font-medium">{S(u.notes)}</div>
                                </>}
                              </div>
                            )}
                            {!S(u.tenant_name) && (
                              <div className="text-xs text-base-content/40 mt-1">空置中</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Section C: Loan Details */}
                {hasLoan && (
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                      <Landmark size={14} className="text-error" /> 贷款详情
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div className="text-base-content/50">银行</div>
                      <div className="font-medium">{S(p.bank_name) || S(p.bank_code) || '-'}</div>
                      <div className="text-base-content/50">贷款户口</div>
                      <div className="font-medium">{S(p.loan_account_no) || '-'}</div>
                      <div className="text-base-content/50">原始贷款额</div>
                      <div className="font-medium">{fmtCurrency(N(p.loan_amount))}</div>
                      <div className="text-base-content/50">预估余额</div>
                      <div className="font-medium text-error">{fmtCurrency(balance)}</div>
                      <div className="text-base-content/50">利率</div>
                      <div className="font-medium">{N(p.loan_interest_rate)}%</div>
                      <div className="text-base-content/50">月供</div>
                      <div className="font-medium">{fmtCurrency(N(p.monthly_repayment))}</div>
                      <div className="text-base-content/50">还款日</div>
                      <div className="font-medium">每月 {N(p.loan_repayment_day) || '-'} 日</div>
                      <div className="text-base-content/50">贷款开始</div>
                      <div className="font-medium">{fmtDate(p.loan_start)}</div>
                      <div className="text-base-content/50">预计还清</div>
                      <div className="font-medium">{estimatePayoffDate(p.loan_start, N(p.loan_tenure_months))}</div>
                      {S(p.loan_si_account) && <>
                        <div className="text-base-content/50">SI 户口</div>
                        <div className="font-medium">{S(p.loan_si_account)}</div>
                      </>}
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-base-content/50">还贷进度</span>
                        <span className="font-semibold">{fmtPct(payoffPct)}</span>
                      </div>
                      <div className="w-full bg-base-200 rounded-full h-2">
                        <div className="bg-success h-2 rounded-full transition-all" style={{ width: `${Math.min(payoffPct, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Section D: Purchase Costs */}
                {costs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                      <DollarSign size={14} className="text-primary" /> 购入成本
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="table table-xs">
                        <thead>
                          <tr className="text-base-content/50">
                            <th>类别</th>
                            <th>说明</th>
                            <th className="text-right">金额</th>
                            <th>付给</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costs.map((c, i) => (
                            <tr key={i}>
                              <td className="font-medium">{S(c.category)}</td>
                              <td>{S(c.description)}</td>
                              <td className="text-right font-medium">{fmtCurrency(N(c.amount))}</td>
                              <td>{S(c.paid_to) || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold">
                            <td colSpan={2}>总购入成本 (含房价)</td>
                            <td className="text-right text-primary">{fmtCurrency(getPurchaseTotal(p))}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Section E: Monthly Expenses */}
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                    <CreditCard size={14} className="text-error" /> 每月开支
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {N(p.monthly_repayment) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-base-content/60">贷款月供</span>
                        <span className="font-medium text-error">{fmtCurrency(N(p.monthly_repayment))}</span>
                      </div>
                    )}
                    {mgmtFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-base-content/60">
                          管理费 {S(p.mgmt_fee_type) === 'fixed' ? '' : `(${N(p.mgmt_fee_pct)}%)`}
                        </span>
                        <span className="font-medium">{fmtCurrency(mgmtFee)}</span>
                      </div>
                    )}
                    {(S(p.mgmt_company_name) || S(p.mgmt_company_phone)) && (
                      <div className="bg-base-200/50 rounded p-2 text-xs">
                        <div className="text-base-content/40 text-[10px] mb-1">管理公司</div>
                        {S(p.mgmt_company_name) && <div>{S(p.mgmt_company_name)}</div>}
                        {S(p.mgmt_company_phone) && <div>📞 {S(p.mgmt_company_phone)}</div>}
                        {S(p.mgmt_company_address) && <div>📍 {S(p.mgmt_company_address)}</div>}
                      </div>
                    )}
                    {N(p.service_charge) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-base-content/60">服务费</span>
                        <span className="font-medium">{fmtCurrency(N(p.service_charge))}</span>
                      </div>
                    )}
                    {N(p.indah_water) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-base-content/60">
                          Indah Water {S(p.indah_water_acc) ? `(${S(p.indah_water_acc)})` : ''}
                        </span>
                        <span className="font-medium">{fmtCurrency(N(p.indah_water))}</span>
                      </div>
                    )}
                    {N(p.land_tax) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-base-content/60">
                          地税/月 {S(p.land_tax_ref) ? `(${S(p.land_tax_ref)})` : ''}
                          {S(p.land_tax_due) ? ` 到期:${fmtDate(p.land_tax_due)}` : ''}
                        </span>
                        <span className="font-medium">{fmtCurrency(N(p.land_tax) / 12)}</span>
                      </div>
                    )}
                    {N(p.assessment_tax) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-base-content/60">
                          门牌税/月 {S(p.assessment_tax_ref) ? `(${S(p.assessment_tax_ref)})` : ''}
                          {S(p.assessment_tax_due) ? ` 到期:${fmtDate(p.assessment_tax_due)}` : ''}
                        </span>
                        <span className="font-medium">{fmtCurrency((N(p.assessment_tax) * 2) / 12)}</span>
                      </div>
                    )}
                    {recurring.length > 0 && recurring.map((rc, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-base-content/60">
                          {S(rc.charge_name)} {S(rc.floor_label) ? `[${S(rc.floor_label)}]` : ''}
                          {S(rc.notes) ? ` (${S(rc.notes)})` : ''}
                        </span>
                        <span className="font-medium">{fmtCurrency(N(rc.amount))}/{S(rc.frequency) || '月'}</span>
                      </div>
                    ))}
                    <div className="divider my-1"></div>
                    <div className="flex justify-between font-bold">
                      <span>月总支出</span>
                      <span className="text-error">{fmtCurrency(monthlyExp)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>月净收入</span>
                      <span className={propRent - monthlyExp >= 0 ? 'text-success' : 'text-error'}>
                        {fmtCurrency(propRent - monthlyExp)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section F: Meters */}
                {propMeters.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                      <Zap size={14} className="text-warning" /> 电水表
                    </h4>
                    <div className="space-y-1.5">
                      {propMeters.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 bg-base-200/50 rounded-lg p-2 text-xs">
                          <span className="text-lg">{S(m.meter_type) === 'electricity' ? '⚡' : '💧'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{S(m.meter_number)}</div>
                            <div className="text-base-content/50">
                              {S(m.account_holder)}{S(m.label) ? ` · ${S(m.label)}` : ''}
                              {S(m.notes) ? ` · ${S(m.notes)}` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Owner details */}
                {owner && (
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                      <Shield size={14} className="text-info" /> 业主资料
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div className="text-base-content/50">业主名</div>
                      <div className="font-medium">{S(owner.name)}</div>
                      {S(owner.owner_type) && <>
                        <div className="text-base-content/50">类型</div>
                        <div className="font-medium">{S(owner.owner_type)}</div>
                      </>}
                      {S(owner.registration_no) && <>
                        <div className="text-base-content/50">注册号</div>
                        <div className="font-medium">{S(owner.registration_no)}</div>
                      </>}
                      {S(owner.contact_person) && <>
                        <div className="text-base-content/50">联系人</div>
                        <div className="font-medium">{S(owner.contact_person)}</div>
                      </>}
                      {S(owner.phone) && <>
                        <div className="text-base-content/50">电话</div>
                        <div className="font-medium">{S(owner.phone)}</div>
                      </>}
                      {S(owner.email) && <>
                        <div className="text-base-content/50">邮箱</div>
                        <div className="font-medium">{S(owner.email)}</div>
                      </>}
                      {S(owner.address) && <>
                        <div className="text-base-content/50">地址</div>
                        <div className="font-medium">{S(owner.address)}</div>
                      </>}
                      {S(owner.payment_bank_name) && <>
                        <div className="text-base-content/50">收款银行</div>
                        <div className="font-medium">{S(owner.payment_bank_name)}</div>
                      </>}
                      {S(owner.payment_bank_account) && <>
                        <div className="text-base-content/50">收款户口</div>
                        <div className="font-medium">{S(owner.payment_bank_account)}</div>
                      </>}
                      {S(owner.payment_account_name) && <>
                        <div className="text-base-content/50">户口名</div>
                        <div className="font-medium">{S(owner.payment_account_name)}</div>
                      </>}
                      {S(owner.notes) && <>
                        <div className="text-base-content/50">备注</div>
                        <div className="font-medium">{S(owner.notes)}</div>
                      </>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     TAB 3: 收租 BILLING
     ═══════════════════════════════════════════════════════════════ */
  const renderBilling = () => {
    const filtered = billingFilter === 'all'
      ? invoices
      : invoices.filter(i => N(i.property_id) === billingFilter);

    const nonCancelled = filtered.filter(i => S(i.status) !== 'cancelled' && S(i.status) !== '已取消');
    const totalAmount = nonCancelled.reduce((s, i) => s + N(i.amount), 0);
    const paidAmount = nonCancelled
      .filter(i => S(i.status) === 'paid' || S(i.status) === '已付')
      .reduce((s, i) => s + N(i.amount), 0);
    const rate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold px-1">收租管理</h2>

        {/* Property filter */}
        <div className="px-1">
          <select
            className="select select-bordered select-sm w-full"
            value={billingFilter}
            onChange={e => setBillingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">全部物业</option>
            {properties.map(p => (
              <option key={N(p.id)} value={N(p.id)}>{S(p.name)}</option>
            ))}
          </select>
        </div>

        {/* Billing summary */}
        <Card>
          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
            <div>
              <div className="text-base-content/50">总账单</div>
              <div className="font-bold mt-0.5">{fmtCurrency(totalAmount)}</div>
            </div>
            <div>
              <div className="text-base-content/50">已收</div>
              <div className="font-bold text-success mt-0.5">{fmtCurrency(paidAmount)}</div>
            </div>
            <div>
              <div className="text-base-content/50">未收</div>
              <div className="font-bold text-error mt-0.5">{fmtCurrency(totalAmount - paidAmount)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-base-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${rate >= 80 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-error'}`}
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold">{fmtPct(rate)}</span>
          </div>
        </Card>

        {/* Invoice list */}
        {filtered.length === 0 ? (
          <Card><p className="text-center text-sm text-base-content/50 py-6">暂无账单</p></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((inv, idx) => {
              const prop = properties.find(p => N(p.id) === N(inv.property_id));
              return (
                <Card key={idx}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs">{S(inv.invoice_no)}</span>
                        <StatusBadge status={S(inv.status)} />
                      </div>
                      <div className="text-xs text-base-content/50 mt-0.5">
                        {prop ? S(prop.name) : ''}{S(inv.floor_label) ? ` · ${S(inv.floor_label)}` : ''}
                      </div>
                      {S(inv.tenant_name) && (
                        <div className="text-xs text-base-content/40">{S(inv.tenant_name)}</div>
                      )}
                      {S(inv.description) && (
                        <div className="text-xs text-base-content/40 mt-0.5">{S(inv.description)}</div>
                      )}
                      <div className="text-xs text-base-content/40 mt-1">
                        {S(inv.billing_month) ? `账期: ${S(inv.billing_month)} · ` : ''}
                        到期: {fmtDate(inv.due_date)}
                        {S(inv.paid_date) ? ` · 已付: ${fmtDate(inv.paid_date)}` : ''}
                      </div>
                      {(N(inv.rent_amount) > 0 || N(inv.charges_amount) > 0) && (
                        <div className="text-xs text-base-content/40">
                          {N(inv.rent_amount) > 0 ? `租金: ${fmtCurrency(N(inv.rent_amount))}` : ''}
                          {N(inv.charges_amount) > 0 ? ` + 杂费: ${fmtCurrency(N(inv.charges_amount))}` : ''}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-2">
                      <div className="font-bold text-sm">{fmtCurrency(N(inv.amount))}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     TAB 4: 报表 REPORTS
     ═══════════════════════════════════════════════════════════════ */

  const reportSubTabs = ['总览', '损益表', 'ROI', '贷款'];

  const renderReports = () => {
    /* Pre-compute per-property data for reports */
    const propData = properties.map(p => {
      const propId = N(p.id);
      const rent = getMonthlyRent(p);
      const expense = getMonthlyExpense(p);
      const monthlyRepayment = N(p.monthly_repayment);
      const mgmt = getMgmtFee(p);
      const otherExp = expense - monthlyRepayment - mgmt;
      const netMonthly = rent - expense;
      const netAnnual = netMonthly * 12;
      const purchaseTotal = getPurchaseTotal(p);
      const roi = purchaseTotal > 0 ? (netAnnual / purchaseTotal) * 100 : 0;
      const balance = getEstimatedBalance(p);
      const payoff = N(p.loan_amount) > 0 ? ((N(p.loan_amount) - balance) / N(p.loan_amount)) * 100 : 0;
      return {
        id: propId, name: S(p.name), rent, expense, monthlyRepayment, mgmt, otherExp,
        netMonthly, netAnnual, purchaseTotal, roi, balance, payoff, raw: p,
      };
    });

    const totalAnnualNet = propData.reduce((s, d) => s + d.netAnnual, 0);
    const avgRoi = propData.length > 0
      ? propData.reduce((s, d) => s + d.roi, 0) / propData.length
      : 0;

    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold px-1">财务报表</h2>

        {/* Sub-tab selector */}
        <div className="flex gap-1 overflow-x-auto px-1">
          {reportSubTabs.map((t, i) => (
            <button
              key={i}
              className={`btn btn-sm ${reportSub === i ? 'btn-primary' : 'btn-ghost'} whitespace-nowrap`}
              onClick={() => setReportSub(i)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Sub-tab: 总览 */}
        {reportSub === 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <div className="text-xs text-base-content/50">月租收入</div>
                <div className="text-lg font-bold text-success">{fmtCurrency(totalMonthlyRent)}</div>
                <div className="text-[10px] text-base-content/40 mt-0.5">租金 {fmtCurrency(totalMonthlyRent)}</div>
              </Card>
              <Card>
                <div className="text-xs text-base-content/50">月总支出</div>
                <div className="text-lg font-bold text-error">{fmtCurrency(totalMonthlyExpense)}</div>
                <div className="text-[10px] text-base-content/40 mt-0.5">银行供期 {fmtCurrency(totalMonthlyRepayment)} · 其他 {fmtCurrency(totalOtherExpense)}</div>
              </Card>
              <Card>
                <div className="text-xs text-base-content/50">月净收入</div>
                <div className={`text-lg font-bold ${monthlyNet >= 0 ? 'text-success' : 'text-error'}`}>{fmtCurrency(monthlyNet)}</div>
              </Card>
              <Card>
                <div className="text-xs text-base-content/50">总购入价值</div>
                <div className="text-lg font-bold text-primary">{fmtCurrency(totalAssets)}</div>
                <div className="text-[10px] text-base-content/40 mt-0.5">购买价格 {fmtCurrency(totalPurchasePrice)} · 其他费用 {fmtCurrency(totalPurchaseFees)}</div>
              </Card>
              <Card>
                <div className="text-xs text-base-content/50">总贷款余额</div>
                <div className="text-lg font-bold text-error">{fmtCurrency(totalLoanBalance)}</div>
              </Card>
              <Card>
                <div className="text-xs text-base-content/50">入住率</div>
                <div className={`text-lg font-bold ${occupancyRate >= 80 ? 'text-success' : 'text-warning'}`}>{fmtPct(occupancyRate)}</div>
              </Card>
              <Card>
                <div className="text-xs text-base-content/50">收款率</div>
                <div className={`text-lg font-bold ${collectionRate >= 80 ? 'text-success' : 'text-warning'}`}>{fmtPct(collectionRate)}</div>
              </Card>
              <Card>
                <div className="text-xs text-base-content/50">年净收入</div>
                <div className={`text-lg font-bold ${totalAnnualNet >= 0 ? 'text-success' : 'text-error'}`}>{fmtCurrency(totalAnnualNet)}</div>
              </Card>
            </div>

            {/* Income vs Expense per property */}
            <Card>
              <h4 className="text-sm font-bold mb-3">收入 vs 支出 (按物业)</h4>
              <div className="space-y-3">
                {propData.map(d => {
                  const maxVal = Math.max(d.rent, d.expense, 1);
                  return (
                    <div key={d.id}>
                      <div className="text-xs font-medium mb-1 truncate">{d.name}</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] w-8 text-right text-success">收入</span>
                          <div className="flex-1 bg-base-200 rounded-full h-3 overflow-hidden">
                            <div className="bg-success h-3 rounded-full" style={{ width: `${(d.rent / maxVal) * 100}%` }} />
                          </div>
                          <span className="text-[10px] w-20 text-right">{fmtCurrency(d.rent)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] w-8 text-right text-error">支出</span>
                          <div className="flex-1 bg-base-200 rounded-full h-3 overflow-hidden">
                            <div className="bg-error h-3 rounded-full" style={{ width: `${(d.expense / maxVal) * 100}%` }} />
                          </div>
                          <span className="text-[10px] w-20 text-right">{fmtCurrency(d.expense)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* Sub-tab: 损益表 */}
        {reportSub === 1 && (
          <div className="space-y-3">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold">月度损益表</h4>
                <button
                  className="btn btn-ghost btn-xs gap-1"
                  onClick={() => {
                    const rows = propData.map(d => ({
                      物业: d.name,
                      月租金: d.rent.toFixed(2),
                      月供: d.monthlyRepayment.toFixed(2),
                      管理费: d.mgmt.toFixed(2),
                      其他费用: d.otherExp.toFixed(2),
                      月净收入: d.netMonthly.toFixed(2),
                      年净收入: d.netAnnual.toFixed(2),
                    }));
                    const totals = {
                      物业: '合计',
                      月租金: totalMonthlyRent.toFixed(2),
                      月供: totalMonthlyRepayment.toFixed(2),
                      管理费: propData.reduce((s, d) => s + d.mgmt, 0).toFixed(2),
                      其他费用: propData.reduce((s, d) => s + d.otherExp, 0).toFixed(2),
                      月净收入: monthlyNet.toFixed(2),
                      年净收入: totalAnnualNet.toFixed(2),
                    };
                    downloadCsv([...rows, totals], `损益表_${new Date().toISOString().slice(0, 10)}`);
                  }}
                >
                  <Download size={12} /> 导出
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="table table-xs">
                  <thead>
                    <tr className="text-base-content/50">
                      <th>物业</th>
                      <th className="text-right">月租金</th>
                      <th className="text-right">月供</th>
                      <th className="text-right">管理费</th>
                      <th className="text-right">其他</th>
                      <th className="text-right">月净</th>
                      <th className="text-right">年净</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propData.map(d => (
                      <tr key={d.id}>
                        <td className="font-medium max-w-[80px] truncate">{d.name}</td>
                        <td className="text-right text-success">{fmtCurrency(d.rent)}</td>
                        <td className="text-right text-error">{fmtCurrency(d.monthlyRepayment)}</td>
                        <td className="text-right">{fmtCurrency(d.mgmt)}</td>
                        <td className="text-right">{fmtCurrency(d.otherExp)}</td>
                        <td className={`text-right font-semibold ${d.netMonthly >= 0 ? 'text-success' : 'text-error'}`}>
                          {fmtCurrency(d.netMonthly)}
                        </td>
                        <td className={`text-right font-semibold ${d.netAnnual >= 0 ? 'text-success' : 'text-error'}`}>
                          {fmtCurrency(d.netAnnual)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t-2 border-base-300">
                      <td>合计</td>
                      <td className="text-right text-success">{fmtCurrency(totalMonthlyRent)}</td>
                      <td className="text-right text-error">{fmtCurrency(totalMonthlyRepayment)}</td>
                      <td className="text-right">{fmtCurrency(propData.reduce((s, d) => s + d.mgmt, 0))}</td>
                      <td className="text-right">{fmtCurrency(propData.reduce((s, d) => s + d.otherExp, 0))}</td>
                      <td className={`text-right ${monthlyNet >= 0 ? 'text-success' : 'text-error'}`}>{fmtCurrency(monthlyNet)}</td>
                      <td className={`text-right ${totalAnnualNet >= 0 ? 'text-success' : 'text-error'}`}>{fmtCurrency(totalAnnualNet)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            {/* Annual summary */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <div className="text-xs text-base-content/50">年总租金</div>
                <div className="text-lg font-bold text-success">{fmtCurrency(totalMonthlyRent * 12)}</div>
              </Card>
              <Card>
                <div className="text-xs text-base-content/50">年总支出</div>
                <div className="text-lg font-bold text-error">{fmtCurrency(totalMonthlyExpense * 12)}</div>
              </Card>
              <Card className="col-span-2">
                <div className="text-xs text-base-content/50">年净收入</div>
                <div className={`text-2xl font-bold ${totalAnnualNet >= 0 ? 'text-success' : 'text-error'}`}>
                  {fmtCurrency(totalAnnualNet)}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Sub-tab: ROI */}
        {reportSub === 2 && (
          <div className="space-y-3">
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="text-center">
                <div className="text-xs text-base-content/50">平均投资回报率</div>
                <div className={`text-3xl font-bold mt-1 ${avgRoi >= 0 ? 'text-success' : 'text-error'}`}>
                  {fmtPct(avgRoi)}
                </div>
                <div className="text-xs text-base-content/40 mt-1">年化 ROI</div>
              </div>
            </Card>
            {[...propData].sort((a, b) => b.roi - a.roi).map(d => (
              <Card key={d.id}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{d.name}</div>
                    <div className="text-xs text-base-content/50">总购入: {fmtCurrency(d.purchaseTotal)}</div>
                  </div>
                  <div className={`text-xl font-bold ${d.roi >= 0 ? 'text-success' : 'text-error'}`}>
                    {fmtPct(d.roi)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <span className="text-base-content/50">年租金:</span>
                    <span className="ml-1 font-medium text-success">{fmtCurrency(d.rent * 12)}</span>
                  </div>
                  <div>
                    <span className="text-base-content/50">年支出:</span>
                    <span className="ml-1 font-medium text-error">{fmtCurrency(d.expense * 12)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-base-content/50">年净收入:</span>
                    <span className={`ml-1 font-medium ${d.netAnnual >= 0 ? 'text-success' : 'text-error'}`}>{fmtCurrency(d.netAnnual)}</span>
                  </div>
                </div>
                <div className="w-full bg-base-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${d.roi >= 5 ? 'bg-success' : d.roi >= 0 ? 'bg-warning' : 'bg-error'}`}
                    style={{ width: `${Math.max(0, Math.min(d.roi * 5, 100))}%` }}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Sub-tab: 贷款 */}
        {reportSub === 3 && (
          <div className="space-y-3">
            {/* Loan summary */}
            <Card className="bg-gradient-to-br from-error/5 to-error/10 border-error/20">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-base-content/50">总贷款额</div>
                  <div className="font-bold text-sm mt-1">{fmtCurrency(totalLoanOriginal)}</div>
                </div>
                <div>
                  <div className="text-base-content/50">总余额</div>
                  <div className="font-bold text-sm text-error mt-1">{fmtCurrency(totalLoanBalance)}</div>
                </div>
                <div>
                  <div className="text-base-content/50">总月供</div>
                  <div className="font-bold text-sm mt-1">{fmtCurrency(totalMonthlyRepayment)}</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-base-content/50">总还贷进度</span>
                  <span className="font-semibold">{fmtPct(loanPayoffPct)}</span>
                </div>
                <div className="w-full bg-base-200 rounded-full h-2.5">
                  <div className="bg-success h-2.5 rounded-full" style={{ width: `${Math.min(loanPayoffPct, 100)}%` }} />
                </div>
              </div>
            </Card>

            {/* Per-property loan cards */}
            {properties.filter(p => N(p.loan_amount) > 0).map(p => {
              const propId = N(p.id);
              const loanAmt = N(p.loan_amount);
              const bal = getEstimatedBalance(p);
              const poff = loanAmt > 0 ? ((loanAmt - bal) / loanAmt) * 100 : 0;
              return (
                <Card key={propId}>
                  <div className="font-semibold text-sm mb-2 truncate">{S(p.name)}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="text-base-content/50">银行</div>
                    <div className="font-medium">{S(p.bank_name) || S(p.bank_code) || '-'}</div>
                    <div className="text-base-content/50">户口号</div>
                    <div className="font-medium">{S(p.loan_account_no) || '-'}</div>
                    <div className="text-base-content/50">原始贷款</div>
                    <div className="font-medium">{fmtCurrency(loanAmt)}</div>
                    <div className="text-base-content/50">预估余额</div>
                    <div className="font-medium text-error">{fmtCurrency(bal)}</div>
                    <div className="text-base-content/50">利率</div>
                    <div className="font-medium">{N(p.loan_interest_rate)}%</div>
                    <div className="text-base-content/50">月供</div>
                    <div className="font-medium">{fmtCurrency(N(p.monthly_repayment))}</div>
                    <div className="text-base-content/50">还款日</div>
                    <div className="font-medium">每月 {N(p.loan_repayment_day) || '-'} 日</div>
                    <div className="text-base-content/50">贷款开始</div>
                    <div className="font-medium">{fmtDate(p.loan_start)}</div>
                    <div className="text-base-content/50">期限</div>
                    <div className="font-medium">{N(p.loan_tenure_months) ? `${N(p.loan_tenure_months)}个月 (${(N(p.loan_tenure_months) / 12).toFixed(1)}年)` : '-'}</div>
                    <div className="text-base-content/50">预计还清</div>
                    <div className="font-medium">{estimatePayoffDate(p.loan_start, N(p.loan_tenure_months))}</div>
                    {S(p.loan_si_account) && <>
                      <div className="text-base-content/50">SI 户口</div>
                      <div className="font-medium">{S(p.loan_si_account)}</div>
                    </>}
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-base-content/50">还贷进度</span>
                      <span className="font-semibold">{fmtPct(poff)}</span>
                    </div>
                    <div className="w-full bg-base-200 rounded-full h-2">
                      <div className="bg-success h-2 rounded-full" style={{ width: `${Math.min(poff, 100)}%` }} />
                    </div>
                  </div>
                </Card>
              );
            })}

            {properties.filter(p => N(p.loan_amount) > 0).length === 0 && (
              <Card><p className="text-center text-sm text-base-content/50 py-6">暂无贷款记录</p></Card>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     LAYOUT
     ═══════════════════════════════════════════════════════════════ */

  const tabs = [
    { icon: LayoutDashboard, label: '首页' },
    { icon: Building2, label: '资产' },
    { icon: Receipt, label: '收租' },
    { icon: BarChart3, label: '报表' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={fontStyle}>
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-sm text-base-content/50 mt-3">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200/50 pb-20" style={fontStyle}>
      {/* Header */}
      {!hideHeader && (
        <div className="bg-base-100 border-b border-base-200 sticky top-0 z-50">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span style={{ color: '#BE5F28' }}>V</span>
                <span style={{ color: '#D29B61' }}>E</span>
                <span>NCOS</span>
              </h1>
              <p className="text-[10px] text-base-content/50 -mt-0.5">业主入口</p>
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <div className="text-right mr-1">
                <div className="text-xs font-medium">{user.name}</div>
              </div>
              <button onClick={onLogout} className="btn btn-ghost btn-sm btn-circle" title="退出">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {tab === 0 && renderDashboard()}
        {tab === 1 && renderAssets()}
        {tab === 2 && renderBilling()}
        {tab === 3 && renderReports()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-200 z-50">
        <div className="max-w-lg mx-auto grid grid-cols-4">
          {tabs.map((t, i) => {
            const active = tab === i;
            const Icon = t.icon;
            return (
              <button
                key={i}
                onClick={() => setTab(i)}
                className={`flex flex-col items-center py-2 pt-2.5 relative transition-colors ${active ? 'text-primary' : 'text-base-content/40'}`}
              >
                <div className={`p-1.5 rounded-lg ${active ? 'bg-primary/10' : ''}`}>
                  <Icon size={18} />
                </div>
                <span className={`text-[10px] mt-0.5 ${active ? 'font-bold' : ''}`}>{t.label}</span>
                {active && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
