import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, Building2, Receipt, BarChart3,
  Bell, BellOff, BellRing, LogOut, ChevronDown, ChevronUp,
  Home, AlertCircle, TrendingDown, Landmark, CalendarClock
} from 'lucide-react';
import { isPushSupported, getNotificationPermission, requestNotificationPermission } from '../utils/push';

// ========== Types ==========

interface StakeholderPortalProps {
  user: { id: number; name: string; role: string; phone?: string };
  onLogout: () => void;
  hideHeader?: boolean;
}

type StakeholderTab = 'home' | 'properties' | 'billing' | 'reports';

interface PropertyRow {
  id: number;
  name: string;
  address: string;
  type: string;
  status: string;
  loan_amount: number;
  loan_balance: number;
  monthly_repayment: number;
  loan_interest_rate: number;
  loan_start: string;
  loan_tenure_months: number;
  owner_id: number;
  [key: string]: unknown;
}

interface FloorUnitRow {
  id: number;
  property_id: number;
  floor_label: string;
  tenant_name: string;
  tenant_phone: string;
  rent_amount: number;
  deposit: number;
  lease_start: string;
  lease_end: string;
  status: string;
  notes: string;
  [key: string]: unknown;
}

interface InvoiceRow {
  id: number;
  invoice_no: string;
  property_id: number;
  property_name: string;
  tenant_name: string;
  floor_label: string;
  amount: number;
  due_date: string;
  paid_date: string;
  status: string;
  billing_month: string;
  description: string;
  created_at: string;
  [key: string]: unknown;
}

interface OwnerRow {
  id: number;
  name: string;
  owner_type: string;
  contact_person: string;
  phone: string;
  email: string;
  [key: string]: unknown;
}

interface RecurringChargeRow {
  id: number;
  property_id: number;
  charge_name: string;
  amount: number;
  [key: string]: unknown;
}

// ========== Helpers ==========

function fmtCurrency(amount: number): string {
  return `RM ${Math.round(amount).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  const end = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function leaseStatusBadge(leaseEnd: string): { emoji: string; label: string; cls: string } | null {
  if (!leaseEnd) return null;
  const days = getDaysUntil(leaseEnd);
  if (days < 0) return { emoji: '🔴', label: '已过期', cls: 'badge-error' };
  if (days <= 30) return { emoji: '🟡', label: `${days}天到期`, cls: 'badge-warning' };
  if (days <= 90) return { emoji: '🔵', label: `${days}天到期`, cls: 'badge-info' };
  return null;
}

function invoiceStatusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'paid': return { label: '已付', cls: 'badge-success' };
    case 'overdue': return { label: '逾期', cls: 'badge-error' };
    case 'cancelled': return { label: '取消', cls: 'badge-ghost' };
    default: return { label: '待付', cls: 'badge-warning' };
  }
}

function estimateBalance(loanAmount: number, monthlyPayment: number, annualRate: number, loanStart: string): number {
  if (!loanAmount || !monthlyPayment || !annualRate || !loanStart) return loanAmount || 0;
  const start = new Date(loanStart);
  const now = new Date();
  if (start >= now) return loanAmount;
  const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (monthsElapsed <= 0) return loanAmount;
  let balance = loanAmount;
  const monthlyRate = annualRate / 12 / 100;
  for (let i = 0; i < monthsElapsed; i++) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    if (principal <= 0) break;
    balance -= principal;
    if (balance <= 0) { balance = 0; break; }
  }
  return Math.round(balance);
}

// ========== Notification Bell ==========

const NotificationBell: React.FC = () => {
  const [permState, setPermState] = useState<string>('default');
  const [requesting, setRequesting] = useState(false);
  const supported = isPushSupported();

  useEffect(() => {
    setPermState(getNotificationPermission());
  }, []);

  const handleClick = async () => {
    if (!supported || permState === 'granted') return;
    setRequesting(true);
    try {
      const granted = await requestNotificationPermission();
      setPermState(granted ? 'granted' : 'denied');
    } finally {
      setRequesting(false);
    }
  };

  if (!supported) return null;

  const Icon = permState === 'granted' ? BellRing : permState === 'denied' ? BellOff : Bell;
  return (
    <button
      onClick={handleClick}
      disabled={requesting || permState === 'granted'}
      className={`btn btn-ghost btn-sm btn-circle ${permState === 'granted' ? 'text-success' : permState === 'denied' ? 'text-error/60' : 'text-base-content/70'}`}
      title={permState === 'granted' ? '通知已开启' : permState === 'denied' ? '通知已被拒绝' : '开启通知'}
    >
      {requesting ? <span className="loading loading-spinner loading-xs" /> : <Icon size={18} />}
    </button>
  );
};

// ========== Main Component ==========

export const StakeholderPortal: React.FC<StakeholderPortalProps> = ({ user, onLogout, hideHeader }) => {
  const [tab, setTab] = useState<StakeholderTab>('home');
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [floorUnits, setFloorUnits] = useState<Record<number, FloorUnitRow[]>>({});
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [owners, setOwners] = useState<Record<number, OwnerRow>>({});
  const [purchaseCostsTotal, setPurchaseCostsTotal] = useState(0);
  const [hoveredTab, setHoveredTab] = useState<StakeholderTab | null>(null);

  // ===== Data Loading =====
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load properties
      const props = (await window.tasklet.sqlQuery(
        `SELECT p.* FROM vc_properties p WHERE (p.id IN (SELECT property_id FROM vc_user_access WHERE user_id = ${user.id}) OR p.owner_id IN (SELECT owner_id FROM vc_user_owner_access WHERE user_id = ${user.id})) ORDER BY p.name ASC`
      )) as PropertyRow[];
      setProperties(props);

      // Load floor units for each property
      const fuMap: Record<number, FloorUnitRow[]> = {};
      for (const p of props) {
        const units = (await window.tasklet.sqlQuery(
          `SELECT * FROM vc_floor_units WHERE property_id = ${p.id} ORDER BY CASE WHEN floor_label='G' THEN 0 ELSE CAST(floor_label AS INTEGER) END ASC`
        )) as FloorUnitRow[];
        fuMap[p.id] = units;
      }
      setFloorUnits(fuMap);

      // Load invoices
      const invs = (await window.tasklet.sqlQuery(
        `SELECT i.*, f.tenant_name FROM vc_invoices i LEFT JOIN vc_floor_units f ON i.property_id = f.property_id AND i.floor_label = f.floor_label WHERE (i.property_id IN (SELECT property_id FROM vc_user_access WHERE user_id = ${user.id}) OR i.property_id IN (SELECT p.id FROM vc_properties p WHERE p.owner_id IN (SELECT owner_id FROM vc_user_owner_access WHERE user_id = ${user.id}))) ORDER BY i.created_at DESC`
      )) as InvoiceRow[];
      setInvoices(invs);

      // Load purchase costs for these properties
      const propIds = props.map(p => p.id);
      if (propIds.length > 0) {
        const costRows = (await window.tasklet.sqlQuery(
          `SELECT COALESCE(SUM(amount), 0) as total FROM vc_purchase_costs WHERE property_id IN (${propIds.join(',')})`
        )) as any[];
        setPurchaseCostsTotal(Number(costRows[0]?.total) || 0);
      }

      // Load owners
      const ownerIds = [...new Set(props.map(p => p.owner_id).filter(Boolean))];
      const ownerMap: Record<number, OwnerRow> = {};
      for (const oid of ownerIds) {
        const rows = (await window.tasklet.sqlQuery(
          `SELECT * FROM vc_owners WHERE id = ${oid}`
        )) as OwnerRow[];
        if (rows.length > 0) ownerMap[oid] = rows[0];
      }
      setOwners(ownerMap);
    } catch (err) {
      console.error('[StakeholderPortal] Data load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ===== Computed Values =====
  const allFloors = properties.flatMap(p => (floorUnits[p.id] || []).map(f => ({ ...f, propertyName: p.name })));
  const floorRentTotal = Math.round(allFloors.reduce((s, f) => s + (Number(f.rent_amount) || 0), 0));
  // Add property-level rental_price for rented properties without floor-level rent data
  const propRentFallback = properties.reduce((s, p) => {
    const propFloorRent = (floorUnits[p.id] || []).reduce((sum: number, f: Record<string, unknown>) => sum + (Number(f.rent_amount) || 0), 0);
    if (propFloorRent > 0) return s;
    if (p.status === 'rented' && Number(p.rental_price || 0) > 0) return s + Number(p.rental_price);
    return s;
  }, 0);
  const totalRent = floorRentTotal + Math.round(propRentFallback);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthInvoices = invoices.filter(i => (i.billing_month || '').startsWith(thisMonth));
  const paidThisMonth = thisMonthInvoices.filter(i => i.status === 'paid').length;
  const pendingThisMonth = thisMonthInvoices.filter(i => i.status === 'pending' || i.status === 'overdue').length;

  // Expiring leases
  const expiringFloors = allFloors.filter(f => {
    if (!f.lease_end) return false;
    const days = getDaysUntil(f.lease_end);
    return days <= 90;
  }).sort((a, b) => getDaysUntil(a.lease_end) - getDaysUntil(b.lease_end));

  // ===== Tab Navigation Config =====
  const TABS: { key: StakeholderTab; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
    { key: 'home', label: '首页', Icon: LayoutDashboard },
    { key: 'properties', label: '物业', Icon: Building2 },
    { key: 'billing', label: '收租', Icon: Receipt },
    { key: 'reports', label: '报表', Icon: BarChart3 },
  ];

  // ===== Loading State =====
  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center" style={{ fontFamily: 'Avenir, Arial, sans-serif' }}>
        <div className="text-center space-y-4">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-sm text-base-content/60">加载中...</p>
        </div>
      </div>
    );
  }

  // ===== Renderers =====

  function renderDashboard() {
    return (
      <div className="space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200">
            <div className="text-2xl mb-1">🏢</div>
            <p className="text-xs text-base-content/50">我的物业</p>
            <p className="text-xl font-bold text-base-content">{properties.length}</p>
          </div>
          <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200">
            <div className="text-2xl mb-1">💰</div>
            <p className="text-xs text-base-content/50">月租收入</p>
            <p className="text-lg font-bold text-base-content">{fmtCurrency(totalRent)}</p>
          </div>
          <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200">
            <div className="text-2xl mb-1">✅</div>
            <p className="text-xs text-base-content/50">已收租</p>
            <p className="text-xl font-bold text-success">{paidThisMonth}</p>
          </div>
          <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200">
            <div className="text-2xl mb-1">⏳</div>
            <p className="text-xs text-base-content/50">待收租</p>
            <p className="text-xl font-bold text-warning">{pendingThisMonth}</p>
          </div>
        </div>

        {/* Lease Expiry Alerts */}
        <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200">
          <h3 className="text-sm font-bold text-base-content mb-3 flex items-center gap-2">
            <CalendarClock size={16} className="text-primary" />
            租约到期提醒
          </h3>
          {expiringFloors.length === 0 ? (
            <p className="text-xs text-base-content/40 text-center py-4">暂无即将到期的租约 🎉</p>
          ) : (
            <div className="space-y-2">
              {expiringFloors.map((f, idx) => {
                const badge = leaseStatusBadge(f.lease_end);
                return (
                  <div key={`${f.property_id}-${f.floor_label}-${idx}`} className="flex items-center justify-between py-2 border-b border-base-200 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-base-content truncate">{f.propertyName} · {f.floor_label}楼</p>
                      <p className="text-[11px] text-base-content/50">{f.tenant_name || '空置'} · 到期 {fmtDate(f.lease_end)}</p>
                    </div>
                    {badge && (
                      <span className={`badge badge-sm ${badge.cls} shrink-0 ml-2`}>
                        {badge.emoji} {badge.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Loan Overview */}
        <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200">
          <h3 className="text-sm font-bold text-base-content mb-3 flex items-center gap-2">
            <Landmark size={16} className="text-primary" />
            贷款概览
          </h3>
          {properties.filter(p => Number(p.loan_amount) > 0).length === 0 ? (
            <p className="text-xs text-base-content/40 text-center py-4">暂无贷款记录</p>
          ) : (
            <div className="space-y-2">
              {properties.filter(p => Number(p.loan_amount) > 0).map(p => {
                const bal = estimateBalance(
                  Number(p.loan_amount),
                  Number(p.monthly_repayment),
                  Number(p.loan_interest_rate),
                  p.loan_start
                );
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-base-200 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-base-content truncate">{p.name}</p>
                      <p className="text-[11px] text-base-content/50">余额 {fmtCurrency(bal)}</p>
                    </div>
                    <span className="text-xs font-medium text-error shrink-0 ml-2">
                      -{fmtCurrency(Number(p.monthly_repayment) || 0)}/月
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderProperties() {
    if (properties.length === 0) {
      return (
        <div className="text-center py-16">
          <Home size={48} className="mx-auto text-base-content/20 mb-3" />
          <p className="text-sm text-base-content/40">暂无物业</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {properties.map(p => (
          <PropertyCard key={p.id} property={p} floors={floorUnits[p.id] || []} owner={owners[p.owner_id]} />
        ))}
      </div>
    );
  }

  function renderBilling() {
    return <BillingTab invoices={invoices} />;
  }

  function renderReports() {
    return <ReportsTab properties={properties} floorUnits={floorUnits} invoices={invoices} />;
  }

  // ===== Main Layout =====
  return (
    <div className="min-h-screen bg-base-200" style={{ fontFamily: 'Avenir, Arial, sans-serif' }}>
      {/* Header — only shown when standalone (not embedded in admin) */}
      {!hideHeader && (
        <header className="sticky top-0 z-40 px-4 pt-3 pb-2 flex items-center justify-between bg-base-100 border-b border-base-300/60">
          <div>
            <h1 className="text-lg font-extrabold tracking-wider">
              <span style={{ color: '#BE5F28' }}>V</span><span style={{ color: '#D29B61' }}>E</span><span className="text-base-content">NCOS</span>
            </h1>
            <p className="text-[11px] text-base-content/40 font-medium -mt-0.5">业主入口</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-base-content/50 font-medium whitespace-nowrap">{user.name}</span>
            <button onClick={onLogout} className="btn btn-xs btn-ghost text-base-content/30 hover:text-base-content/60" title="退出">
              <LogOut size={14} />
            </button>
          </div>
        </header>
      )}

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-4 pb-24">
        {tab === 'home' && renderDashboard()}
        {tab === 'properties' && renderProperties()}
        {tab === 'billing' && renderBilling()}
        {tab === 'reports' && renderReports()}
      </main>

      {/* Bottom Nav — warm elevated */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 shadow-[0_-2px_12px_rgba(19,58,81,0.08)]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {TABS.map(({ key, label, Icon }) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`
                  relative flex flex-col items-center justify-center gap-1
                  flex-1 h-14 rounded-xl transition-all duration-200 mx-1
                  ${isActive
                    ? 'text-primary'
                    : 'text-base-content/35 hover:text-base-content/60'
                  }
                `}
              >
                <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-primary/10' : ''}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                </div>
                <span className={`text-[10px] leading-none transition-all duration-200 ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {label}
                </span>
                {isActive && <span className="absolute bottom-1 w-5 h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </nav>
    </div>
  );
};

// ========== Property Card (Expandable) ==========

const PropertyCard: React.FC<{ property: PropertyRow; floors: FloorUnitRow[]; owner?: OwnerRow }> = ({ property, floors, owner }) => {
  const [expanded, setExpanded] = useState(false);
  const floorRent = Math.round(floors.reduce((s, f) => s + (Number(f.rent_amount) || 0), 0));
  const totalRent = floorRent > 0 ? floorRent : (property.status === 'rented' && Number(property.rental_price || 0) > 0 ? Math.round(Number(property.rental_price)) : 0);

  return (
    <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-base-200/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-base-content truncate">{property.name}</p>
          <p className="text-[11px] text-base-content/50 truncate">{property.address || '-'}</p>
          <div className="flex items-center gap-2 mt-1">
            {owner && <span className="text-[10px] text-base-content/40">{owner.name}</span>}
            <span className="text-[10px] font-medium text-primary">{fmtCurrency(totalRent)}/月</span>
          </div>
        </div>
        <div className="shrink-0 ml-2 text-base-content/30">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-base-200 px-4 py-3">
          {floors.length === 0 ? (
            <p className="text-xs text-base-content/40 text-center py-2">暂无楼层信息</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="table table-xs w-full">
                <thead>
                  <tr className="text-base-content/40">
                    <th className="font-medium">楼层</th>
                    <th className="font-medium">租户</th>
                    <th className="font-medium text-right">租金</th>
                    <th className="font-medium">租约</th>
                    <th className="font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {floors.map(f => {
                    const badge = leaseStatusBadge(f.lease_end);
                    const isVacant = f.status === 'vacant' || !f.tenant_name;
                    return (
                      <tr key={f.id} className="hover">
                        <td className="font-medium text-base-content">{f.floor_label}</td>
                        <td className={isVacant ? 'text-base-content/30 italic' : 'text-base-content'}>
                          {isVacant ? '空置' : f.tenant_name}
                        </td>
                        <td className="text-right text-base-content">
                          {Number(f.rent_amount) > 0 ? fmtCurrency(Number(f.rent_amount)) : '-'}
                        </td>
                        <td className="text-[10px] text-base-content/50 whitespace-nowrap">
                          {f.lease_start && f.lease_end
                            ? `${fmtDate(f.lease_start)} → ${fmtDate(f.lease_end)}`
                            : '-'}
                        </td>
                        <td>
                          {badge ? (
                            <span className={`badge badge-xs ${badge.cls}`}>{badge.emoji} {badge.label}</span>
                          ) : (
                            isVacant
                              ? <span className="badge badge-xs badge-ghost">空置</span>
                              : <span className="badge badge-xs badge-success">正常</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ========== Billing Tab ==========

const BillingTab: React.FC<{ invoices: InvoiceRow[] }> = ({ invoices }) => {
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);

  const monthStr = `${filterYear}-${String(filterMonth).padStart(2, '0')}`;
  const filtered = invoices.filter(i => {
    if (i.billing_month) return i.billing_month.startsWith(monthStr);
    if (i.due_date) return i.due_date.startsWith(monthStr);
    return false;
  });

  const totalAmount = Math.round(filtered.reduce((s, i) => s + (Number(i.amount) || 0), 0));
  const paidAmount = Math.round(filtered.filter(i => i.status === 'paid').reduce((s, i) => s + (Number(i.amount) || 0), 0));
  const pendingAmount = Math.round(filtered.filter(i => i.status === 'pending').reduce((s, i) => s + (Number(i.amount) || 0), 0));
  const overdueAmount = Math.round(filtered.filter(i => i.status === 'overdue').reduce((s, i) => s + (Number(i.amount) || 0), 0));

  const months = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月',
  ];

  const years: number[] = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) years.push(y);

  return (
    <div className="space-y-4">
      {/* Month Filter */}
      <div className="flex items-center gap-2">
        <select
          className="select select-sm select-bordered flex-1"
          value={filterYear}
          onChange={e => setFilterYear(Number(e.target.value))}
        >
          {years.map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select
          className="select select-sm select-bordered flex-1"
          value={filterMonth}
          onChange={e => setFilterMonth(Number(e.target.value))}
        >
          {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {/* Summary Bar */}
      <div className="bg-base-100 rounded-xl p-3 shadow-sm border border-base-200">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-[10px] text-base-content/40">总额</p>
            <p className="text-xs font-bold text-base-content">{fmtCurrency(totalAmount)}</p>
          </div>
          <div>
            <p className="text-[10px] text-base-content/40">已付</p>
            <p className="text-xs font-bold text-success">{fmtCurrency(paidAmount)}</p>
          </div>
          <div>
            <p className="text-[10px] text-base-content/40">待付</p>
            <p className="text-xs font-bold text-warning">{fmtCurrency(pendingAmount)}</p>
          </div>
          <div>
            <p className="text-[10px] text-base-content/40">逾期</p>
            <p className="text-xs font-bold text-error">{fmtCurrency(overdueAmount)}</p>
          </div>
        </div>
      </div>

      {/* Invoice Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Receipt size={48} className="mx-auto text-base-content/20 mb-3" />
          <p className="text-sm text-base-content/40">本月暂无账单</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => {
            const badge = invoiceStatusBadge(inv.status);
            return (
              <div key={inv.id} className="bg-base-100 rounded-xl p-3 shadow-sm border border-base-200">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-base-content truncate">
                      {inv.property_name || '-'} · {inv.floor_label || '-'}楼
                    </p>
                    <p className="text-[11px] text-base-content/50 truncate">{inv.tenant_name || '-'}</p>
                    {inv.invoice_no && (
                      <p className="text-[10px] text-base-content/30 mt-0.5">#{inv.invoice_no}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-base-content">{fmtCurrency(Number(inv.amount) || 0)}</p>
                    <span className={`badge badge-xs ${badge.cls} mt-1`}>{badge.label}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-base-200">
                  <span className="text-[10px] text-base-content/40">到期: {fmtDate(inv.due_date)}</span>
                  {inv.paid_date && <span className="text-[10px] text-success">已付: {fmtDate(inv.paid_date)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ========== Reports Tab (Redesigned - Clean & Easy) ==========

const ReportsTab: React.FC<{
  properties: PropertyRow[];
  floorUnits: Record<number, FloorUnitRow[]>;
  invoices: InvoiceRow[];
}> = ({ properties, floorUnits, invoices }) => {
  const [showAllPL, setShowAllPL] = useState(false);
  const [showAllLoans, setShowAllLoans] = useState(false);

  const now = new Date();

  // ===== Monthly Totals =====
  const totalRentIncome = properties.reduce((s, p) => {
    const floors = floorUnits[p.id] || [];
    const floorRent = floors.reduce((sum, f) => sum + (Number(f.rent_amount) || 0), 0);
    if (floorRent > 0) return s + floorRent;
    if (p.status === 'rented' && Number(p.rental_price || 0) > 0) return s + Number(p.rental_price);
    return s;
  }, 0);

  const totalLoanPayment = properties.reduce((s, p) => s + (Number(p.monthly_repayment) || 0), 0);
  const netIncome = totalRentIncome - totalLoanPayment;

  // Total purchase value breakdown
  const totalPurchasePrice = properties.reduce((s, p) => s + (Number(p.price) || 0), 0);
  const totalPurchaseValue = totalPurchasePrice + purchaseCostsTotal;
  const totalLoanBalance = properties.reduce((s, p) => s + (Number(p.loan_balance) || Number(p.loan_amount) || 0), 0);

  // ===== Rent Collection (last 6 months) =====
  const last6: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last6.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${d.getMonth() + 1}月`,
    });
  }

  const monthlyData = last6.map(m => {
    const mInvs = invoices.filter(i => (i.billing_month || i.due_date || '').startsWith(m.key));
    const total = mInvs.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const collected = mInvs.filter(i => i.status === 'paid').reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const rate = total > 0 ? Math.round((collected / total) * 100) : 0;
    return { ...m, total: Math.round(total), collected: Math.round(collected), rate };
  });
  const maxBar = Math.max(...monthlyData.map(m => m.total), 1);

  // ===== Per-Property P&L (sorted by net) =====
  const propertyPL = properties.map(p => {
    const floors = floorUnits[p.id] || [];
    const floorRent = floors.reduce((s, f) => s + (Number(f.rent_amount) || 0), 0);
    const rent = floorRent > 0 ? floorRent : (p.status === 'rented' && Number(p.rental_price || 0) > 0 ? Number(p.rental_price) : 0);
    const loan = Number(p.monthly_repayment) || 0;
    return { id: p.id, name: p.name, rent: Math.round(rent), loan: Math.round(loan), net: Math.round(rent - loan) };
  }).sort((a, b) => b.net - a.net);

  const profitable = propertyPL.filter(p => p.net > 0).length;
  const losing = propertyPL.filter(p => p.net < 0).length;
  const displayPL = showAllPL ? propertyPL : propertyPL.slice(0, 5);

  // ===== Loan Summary =====
  const propsWithLoans = properties.filter(p => Number(p.loan_amount) > 0);
  const totalOriginal = propsWithLoans.reduce((s, p) => s + (Number(p.loan_amount) || 0), 0);
  const totalBalance = propsWithLoans.reduce((s, p) => {
    return s + estimateBalance(Number(p.loan_amount), Number(p.monthly_repayment), Number(p.loan_interest_rate), p.loan_start);
  }, 0);
  const totalPaid = totalOriginal - totalBalance;
  const overallPct = totalOriginal > 0 ? Math.round((totalPaid / totalOriginal) * 100) : 0;
  const totalMonthlyRepay = propsWithLoans.reduce((s, p) => s + (Number(p.monthly_repayment) || 0), 0);

  const loanDetails = propsWithLoans.map(p => {
    const orig = Number(p.loan_amount) || 0;
    const bal = estimateBalance(orig, Number(p.monthly_repayment), Number(p.loan_interest_rate), p.loan_start);
    const pct = orig > 0 ? Math.round(((orig - bal) / orig) * 100) : 0;
    return { id: p.id, name: p.name, original: orig, balance: Math.round(bal), monthly: Math.round(Number(p.monthly_repayment) || 0), rate: Number(p.loan_interest_rate) || 0, pct };
  }).sort((a, b) => a.pct - b.pct);
  const displayLoans = showAllLoans ? loanDetails : loanDetails.slice(0, 5);

  return (
    <div className="space-y-4">

      {/* ===== 1. Summary KPI ===== */}
      <div className="space-y-2">
        {/* Row 1: 总购买价值 + 总欠款 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-accent/10 rounded-xl p-3">
            <p className="text-[10px] text-base-content/40 mb-1">总购买价值</p>
            <p className="text-base font-bold text-accent">{fmtCurrency(totalPurchaseValue)}</p>
            <p className="text-[9px] text-base-content/40 mt-0.5">购买价格 {fmtCurrency(totalPurchasePrice)}</p>
            <p className="text-[9px] text-base-content/40">其他费用 {fmtCurrency(purchaseCostsTotal)}</p>
          </div>
          <div className="bg-info/10 rounded-xl p-3">
            <p className="text-[10px] text-base-content/40 mb-1">总欠款</p>
            <p className="text-base font-bold text-info">{fmtCurrency(totalLoanBalance)}</p>
            <p className="text-[9px] text-base-content/40 mt-0.5">月供 {fmtCurrency(totalLoanPayment)}</p>
          </div>
        </div>
        {/* Row 2: 月租收入 + 贷款支出 + 净收入 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-success/10 rounded-xl p-3 text-center">
            <p className="text-[10px] text-base-content/40 mb-1">月租收入</p>
            <p className="text-sm font-bold text-success">{fmtCurrency(totalRentIncome)}</p>
          </div>
          <div className="bg-error/10 rounded-xl p-3 text-center">
            <p className="text-[10px] text-base-content/40 mb-1">贷款支出</p>
            <p className="text-sm font-bold text-error">{fmtCurrency(totalLoanPayment)}</p>
          </div>
          <div className={`${netIncome >= 0 ? 'bg-success/10' : 'bg-error/10'} rounded-xl p-3 text-center`}>
            <p className="text-[10px] text-base-content/40 mb-1">净收入</p>
            <p className={`text-sm font-bold ${netIncome >= 0 ? 'text-success' : 'text-error'}`}>
              {netIncome >= 0 ? '+' : ''}{fmtCurrency(netIncome)}
            </p>
          </div>
        </div>
      </div>

      {/* ===== 2. Rent Collection Trend ===== */}
      <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200">
        <h3 className="text-sm font-bold text-base-content mb-3 flex items-center gap-2">
          <BarChart3 size={16} className="text-primary" />
          收租趋势
        </h3>
        {/* Chart - horizontal bars */}
        <div className="space-y-2.5">
          {monthlyData.map(m => (
            <div key={m.key} className="flex items-center gap-2">
              <span className="text-[11px] text-base-content/50 w-8 shrink-0 text-right">{m.label}</span>
              <div className="flex-1 h-5 bg-base-200 rounded-full overflow-hidden relative">
                <div
                  className="absolute inset-y-0 left-0 bg-success/20 rounded-full"
                  style={{ width: `${(m.total / maxBar) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-success rounded-full transition-all duration-300"
                  style={{ width: `${(m.collected / maxBar) * 100}%` }}
                />
              </div>
              <span className={`text-[10px] font-semibold w-10 shrink-0 text-right ${m.rate >= 80 ? 'text-success' : m.rate >= 50 ? 'text-warning' : 'text-error'}`}>
                {m.rate}%
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-2.5 text-[10px] text-base-content/30">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-success inline-block" /> 已收</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-success/20 inline-block" /> 总额</span>
        </div>
      </div>

      {/* ===== 3. Property P&L - Clean Table ===== */}
      <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-base-content flex items-center gap-2">
            <TrendingDown size={16} className="text-primary" />
            物业损益
          </h3>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-success">▲ {profitable}</span>
            <span className="text-error">▼ {losing}</span>
          </div>
        </div>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-base-content/40 border-b border-base-200">
                <th className="text-left py-1.5 pl-1 font-medium">物业</th>
                <th className="text-right py-1.5 font-medium">收入</th>
                <th className="text-right py-1.5 font-medium">支出</th>
                <th className="text-right py-1.5 pr-1 font-medium">净额</th>
              </tr>
            </thead>
            <tbody>
              {displayPL.map(p => (
                <tr key={p.id} className="border-b border-base-200/50 last:border-b-0">
                  <td className="py-2 pl-1 max-w-[120px]">
                    <p className="text-xs text-base-content truncate">{p.name}</p>
                  </td>
                  <td className="py-2 text-right text-success whitespace-nowrap">
                    {p.rent > 0 ? fmtCurrency(p.rent) : <span className="text-base-content/20">-</span>}
                  </td>
                  <td className="py-2 text-right text-error whitespace-nowrap">
                    {p.loan > 0 ? fmtCurrency(p.loan) : <span className="text-base-content/20">-</span>}
                  </td>
                  <td className={`py-2 pr-1 text-right font-semibold whitespace-nowrap ${p.net > 0 ? 'text-success' : p.net < 0 ? 'text-error' : 'text-base-content/30'}`}>
                    {p.net !== 0 ? `${p.net > 0 ? '+' : ''}${fmtCurrency(p.net)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Total row */}
            <tfoot>
              <tr className="border-t-2 border-base-300">
                <td className="py-2 pl-1 text-xs font-bold text-base-content">合计</td>
                <td className="py-2 text-right text-xs font-bold text-success">{fmtCurrency(totalRentIncome)}</td>
                <td className="py-2 text-right text-xs font-bold text-error">{fmtCurrency(totalLoanPayment)}</td>
                <td className={`py-2 pr-1 text-right text-xs font-bold ${netIncome >= 0 ? 'text-success' : 'text-error'}`}>
                  {netIncome >= 0 ? '+' : ''}{fmtCurrency(netIncome)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {propertyPL.length > 5 && (
          <button
            className="w-full text-center text-xs text-primary mt-2 py-1.5 hover:underline"
            onClick={() => setShowAllPL(!showAllPL)}
          >
            {showAllPL ? '收起' : `查看全部 ${propertyPL.length} 个物业 ▼`}
          </button>
        )}
      </div>

      {/* ===== 4. Loan Progress ===== */}
      {propsWithLoans.length > 0 && (
        <div className="bg-base-100 rounded-xl p-4 shadow-sm border border-base-200">
          <h3 className="text-sm font-bold text-base-content mb-3 flex items-center gap-2">
            <Landmark size={16} className="text-primary" />
            贷款进度
          </h3>

          {/* Overall progress */}
          <div className="bg-base-200/40 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-base-content/60">整体还款进度</span>
              <span className="text-xs font-bold text-primary">{overallPct}%</span>
            </div>
            <div className="w-full h-3 bg-base-200 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${overallPct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
              <div>
                <p className="text-[9px] text-base-content/30">贷款总额</p>
                <p className="text-[11px] font-semibold text-base-content">{fmtCurrency(totalOriginal)}</p>
              </div>
              <div>
                <p className="text-[9px] text-base-content/30">剩余</p>
                <p className="text-[11px] font-semibold text-error">{fmtCurrency(totalBalance)}</p>
              </div>
              <div>
                <p className="text-[9px] text-base-content/30">月还款</p>
                <p className="text-[11px] font-semibold text-base-content">{fmtCurrency(totalMonthlyRepay)}</p>
              </div>
            </div>
          </div>

          {/* Per-loan compact list */}
          <div className="space-y-2">
            {displayLoans.map(l => (
              <div key={l.id} className="flex items-center gap-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[11px] text-base-content truncate mr-2">{l.name}</p>
                    <span className="text-[10px] text-base-content/40 shrink-0">{l.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-base-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${l.pct >= 50 ? 'bg-success' : 'bg-primary'}`}
                      style={{ width: `${l.pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9px] text-base-content/30">余额 {fmtCurrency(l.balance)}</span>
                    <span className="text-[9px] text-base-content/30">{l.rate}% · {fmtCurrency(l.monthly)}/月</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {loanDetails.length > 5 && (
            <button
              className="w-full text-center text-xs text-primary mt-2 py-1.5 hover:underline"
              onClick={() => setShowAllLoans(!showAllLoans)}
            >
              {showAllLoans ? '收起' : `查看全部 ${loanDetails.length} 笔贷款 ▼`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

