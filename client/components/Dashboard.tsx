import React, { useEffect, useState } from 'react';
import { Building2, TrendingUp, Key, Users, DollarSign, Clock, Home, Plus, Receipt, AlertTriangle, Wrench, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardStats, Page, RentalDeal } from '../types';
import { getDashboardStats, getExpiringLeases, getExpiringFloorLeases, ExpiringFloorLease, getUpcomingExpenseDueDates } from '../utils/db';
import { formatCurrency, formatDate } from '../utils/helpers';
import { FinancialReports } from './FinancialReports';

interface DashboardProps {
  onNavigate: (page: Page) => void;
  onQuickAdd: (type: 'property' | 'client' | 'sale' | 'rental') => void;
  userId?: number;
  userRole?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onQuickAdd, userId, userRole }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [expiringLeases, setExpiringLeases] = useState<RentalDeal[]>([]);
  const [expiringFloors, setExpiringFloors] = useState<ExpiringFloorLease[]>([]);
  const [expenseDues, setExpenseDues] = useState<Array<{
    id: number; name: string;
    land_tax: number; land_tax_due: string;
    assessment_tax: number; assessment_tax_due: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [dashTab, setDashTabState] = useState<'overview' | 'reports' | 'calendar'>(() => {
    const saved = localStorage.getItem('vencos_dashTab');
    return (saved && ['overview', 'reports', 'calendar'].includes(saved)) ? saved as 'overview' | 'reports' | 'calendar' : 'overview';
  });
  const setDashTab = (t: 'overview' | 'reports' | 'calendar') => { setDashTabState(t); localStorage.setItem('vencos_dashTab', t); };

  useEffect(() => {
    Promise.all([getDashboardStats(), getExpiringLeases(90), getExpiringFloorLeases(90), getUpcomingExpenseDueDates()])
      .then(([s, leases, floors, expenses]) => {
        setStats(s);
        setExpiringLeases(leases);
        setExpiringFloors(floors);
        setExpenseDues(expenses);
      })
      .catch((e) => console.error('Failed to load stats:', e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const s = stats!;

  function getDaysUntil(dateStr: string): number {
    const end = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  // ===== Calendar View Component =====
  function CalendarView() {
    const now = new Date();
    const [calYear, setCalYear] = useState(now.getFullYear());
    const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
    const [calEvents, setCalEvents] = useState<Array<{ date: number; type: string; label: string; amount?: number; emoji: string }>>([]);
    const [calLoading, setCalLoading] = useState(true);
    const [selectedCalDay, setSelectedCalDay] = useState<number | null>(null);
    const [calView, setCalView] = useState<'day' | 'week' | 'month' | 'year'>('month');
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
      loadCalendarData();
    }, [calYear, calMonth]);

    useEffect(() => {
      if (calView === 'day' || calView === 'week') {
        const m = selectedDate.getMonth() + 1;
        const y = selectedDate.getFullYear();
        if (m !== calMonth || y !== calYear) {
          setCalYear(y);
          setCalMonth(m);
        }
      }
    }, [selectedDate]);

    async function loadCalendarData() {
      setCalLoading(true);
      try {
        const events: typeof calEvents = [];
        const monthStr = `${calYear}-${String(calMonth).padStart(2, '0')}`;
        const daysInMonth = new Date(calYear, calMonth, 0).getDate();
        const monthStart = `${monthStr}-01`;
        const monthEnd = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

        // Query 1: Properties (loan repayment days + tax due dates)
        const props = await window.tasklet.sqlQuery(`
          SELECT id, name, loan_repayment_day, monthly_repayment, loan_balance,
            land_tax, land_tax_due, assessment_tax, assessment_tax_due
          FROM vc_properties WHERE 1=1
        `) as Array<Record<string, any>>;

        for (const p of props) {
          // Loan repayment
          const repDay = Number(p.loan_repayment_day || 0);
          const repAmt = Number(p.monthly_repayment || 0);
          const loanBal = Number(p.loan_balance || 0);
          if (repDay > 0 && repAmt > 0 && loanBal > 0) {
            const day = Math.min(repDay, daysInMonth);
            events.push({ date: day, type: 'loan', label: `贷款扣款 — ${p.name}`, amount: repAmt, emoji: '🏦' });
          }

          // Land tax
          const landDue = String(p.land_tax_due || '');
          const landAmt = Number(p.land_tax || 0);
          if (landDue && landAmt > 0 && landDue >= monthStart && landDue <= monthEnd) {
            const day = parseInt(landDue.slice(8, 10), 10);
            events.push({ date: day, type: 'tax', label: `地税到期 — ${p.name}`, amount: landAmt, emoji: '🔴' });
          }

          // Assessment tax (biannual: check this month and +6 months)
          const assDue = String(p.assessment_tax_due || '');
          const assAmt = Number(p.assessment_tax || 0);
          if (assDue && assAmt > 0) {
            if (assDue >= monthStart && assDue <= monthEnd) {
              const day = parseInt(assDue.slice(8, 10), 10);
              events.push({ date: day, type: 'tax', label: `门牌税到期 — ${p.name}`, amount: assAmt, emoji: '🔴' });
            }
            // Check +6 months from due date
            const d = new Date(assDue);
            const nextDue = new Date(d);
            nextDue.setMonth(nextDue.getMonth() + 6);
            const nextStr = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, '0')}-${String(nextDue.getDate()).padStart(2, '0')}`;
            if (nextStr >= monthStart && nextStr <= monthEnd) {
              const day = nextDue.getDate();
              events.push({ date: day, type: 'tax', label: `门牌税到期 — ${p.name}`, amount: assAmt, emoji: '🔴' });
            }
          }
        }

        // Query 2: Floor units with lease expiry in this month
        const floors = await window.tasklet.sqlQuery(`
          SELECT f.floor_label, f.tenant_name, f.lease_end, f.rent_amount, p.name as property_name
          FROM vc_floor_units f
          LEFT JOIN vc_properties p ON f.property_id = p.id
          WHERE f.lease_end >= '${monthStart}' AND f.lease_end <= '${monthEnd}'
            AND f.tenant_name != ''
        `) as Array<Record<string, any>>;

        for (const f of floors) {
          const day = parseInt(String(f.lease_end).slice(8, 10), 10);
          events.push({ date: day, type: 'lease', label: `租约到期 — ${f.property_name} ${f.floor_label}楼 ${f.tenant_name}`, amount: Number(f.rent_amount || 0), emoji: '🟡' });
        }

        // Query 3: Pending/overdue invoices due in this month
        const invoices = await window.tasklet.sqlQuery(`
          SELECT i.invoice_no, i.amount, i.due_date, i.status, p.name as property_name,
            COALESCE(fu.tenant_name, '') as tenant_name
          FROM vc_invoices i
          LEFT JOIN vc_properties p ON i.property_id = p.id
          LEFT JOIN vc_floor_units fu ON i.property_id = fu.property_id AND i.floor_label = fu.floor_label
          WHERE i.due_date >= '${monthStart}' AND i.due_date <= '${monthEnd}'
            AND i.status IN ('pending', 'overdue')
        `) as Array<Record<string, any>>;

        for (const inv of invoices) {
          const day = parseInt(String(inv.due_date).slice(8, 10), 10);
          const isOverdue = inv.status === 'overdue';
          events.push({ date: day, type: 'invoice', label: `${isOverdue ? '逾期' : '待收'}账单 ${inv.invoice_no} — ${inv.property_name || ''} ${inv.tenant_name || ''}`, amount: Number(inv.amount || 0), emoji: isOverdue ? '🔴' : '🔵' });
        }

        // Sort by date
        events.sort((a, b) => a.date - b.date);
        setCalEvents(events);
      } catch (e) {
        console.error('Calendar load error:', e);
      }
      setCalLoading(false);
    }

    // --- Constants & Helpers ---
    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const cnWeekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

    function goMonth(delta: number) {
      let m = calMonth + delta;
      let y = calYear;
      if (m < 1) { m = 12; y--; }
      if (m > 12) { m = 1; y++; }
      setCalYear(y);
      setCalMonth(m);
      setSelectedCalDay(null);
    }

    function goToday() {
      const n = new Date();
      setCalYear(n.getFullYear());
      setCalMonth(n.getMonth() + 1);
      setSelectedCalDay(n.getDate());
      setSelectedDate(new Date());
    }

    function navigateDay(delta: number) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + delta);
      setSelectedDate(d);
      setSelectedCalDay(d.getDate());
    }

    function navigateWeek(delta: number) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 7 * delta);
      setSelectedDate(d);
    }

    function getWeekDates(date: Date): Date[] {
      const d = new Date(date);
      d.setDate(d.getDate() - d.getDay());
      const dates: Date[] = [];
      for (let i = 0; i < 7; i++) {
        dates.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
      return dates;
    }

    function isSameDay(a: Date, b: Date): boolean {
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    function getDotColor(type: string): string {
      return type === 'loan' ? 'bg-warning' : type === 'tax' ? 'bg-error' : type === 'lease' ? 'bg-accent' : 'bg-info';
    }

    function getTypeBadge(type: string) {
      switch (type) {
        case 'loan': return <span className="badge badge-xs badge-warning">贷款</span>;
        case 'tax': return <span className="badge badge-xs badge-error">税务</span>;
        case 'lease': return <span className="badge badge-xs badge-accent">租约</span>;
        case 'invoice': return <span className="badge badge-xs badge-info">账单</span>;
        default: return null;
      }
    }

    // --- Group events by date ---
    const grouped = new Map<number, typeof calEvents>();
    for (const ev of calEvents) {
      if (!grouped.has(ev.date)) grouped.set(ev.date, []);
      grouped.get(ev.date)!.push(ev);
    }
    const sortedDates = Array.from(grouped.keys()).sort((a, b) => a - b);
    const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth() + 1;

    // --- Shared render helpers ---

    function renderNavBar(title: string, onPrev: () => void, onNext: () => void, showTodayBtn: boolean) {
      return (
        <div className="flex items-center justify-between px-1">
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onPrev}>
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight">{title}</h2>
            {showTodayBtn && (
              <button className="btn btn-ghost btn-xs text-primary font-semibold" onClick={goToday}>今天</button>
            )}
          </div>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onNext}>
            <ChevronRight size={18} />
          </button>
        </div>
      );
    }

    function renderEventSummary() {
      if (calEvents.length === 0) return null;
      return (
        <div className="flex gap-3 text-xs text-base-content/60 px-2">
          <span>共 {calEvents.length} 项</span>
          {calEvents.filter(e => e.type === 'loan').length > 0 && <span>🏦 {calEvents.filter(e => e.type === 'loan').length}</span>}
          {calEvents.filter(e => e.type === 'tax').length > 0 && <span>🔴 {calEvents.filter(e => e.type === 'tax').length}</span>}
          {calEvents.filter(e => e.type === 'lease').length > 0 && <span>🟡 {calEvents.filter(e => e.type === 'lease').length}</span>}
          {calEvents.filter(e => e.type === 'invoice').length > 0 && <span>🔵 {calEvents.filter(e => e.type === 'invoice').length}</span>}
        </div>
      );
    }

    function renderLegend() {
      return (
        <div className="flex flex-wrap gap-4 px-2 text-xs text-base-content/50">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning inline-block" /> 贷款扣款</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-error inline-block" /> 税务到期</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> 租约到期</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-info inline-block" /> 待收账单</span>
        </div>
      );
    }

    function renderEventCard(ev: typeof calEvents[0], idx: number) {
      return (
        <div key={idx} className="flex items-center gap-3 bg-base-100 rounded-xl px-3 py-2.5 shadow-sm border border-base-200">
          <span className="text-lg shrink-0">{ev.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{ev.label}</p>
            {ev.amount !== undefined && ev.amount > 0 && (
              <p className="text-xs text-base-content/50 mt-0.5">RM {ev.amount.toLocaleString()}{ev.type === 'loan' ? '/月' : ''}</p>
            )}
          </div>
          {getTypeBadge(ev.type)}
        </div>
      );
    }

    // ========== MONTH VIEW ==========
    function renderMonthView() {
      const daysInMonth = new Date(calYear, calMonth, 0).getDate();
      const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
      const cells: Array<number | null> = [];
      for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
      for (let d = 1; d <= daysInMonth; d++) cells.push(d);
      while (cells.length % 7 !== 0) cells.push(null);

      return (
        <div className="space-y-4">
          {renderNavBar(`${calYear}年${calMonth}月`, () => goMonth(-1), () => goMonth(1), !isCurrentMonth)}
          {renderEventSummary()}

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-1">
            {weekDays.map(d => (
              <div key={d} className="text-center text-[11px] font-medium text-base-content/40 py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5 px-1">
            {cells.map((day, idx) => {
              if (day === null) return <div key={idx} className="py-3" />;
              const dayEvents = grouped.get(day) || [];
              const isToday = isCurrentMonth && day === now.getDate();
              const isSelected = selectedCalDay === day;

              return (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-start py-1.5 cursor-pointer rounded-xl transition-all duration-150 hover:bg-base-200/60"
                  onClick={() => setSelectedCalDay(isSelected ? null : day)}
                >
                  <div className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium transition-all duration-150 ${
                    isToday
                      ? 'bg-primary text-primary-content font-bold shadow-sm'
                      : isSelected
                        ? 'ring-2 ring-primary/40 bg-primary/10 text-primary font-semibold'
                        : 'text-base-content/70 hover:text-base-content'
                  }`}>
                    {day}
                  </div>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-[3px] mt-1">
                      {dayEvents.slice(0, 3).map((ev, i) => (
                        <span key={i} className={`w-1 h-1 rounded-full ${getDotColor(ev.type)}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {renderLegend()}

          {/* Selected day events panel */}
          {(() => {
            const highlightDay = selectedCalDay || (isCurrentMonth && grouped.has(now.getDate()) ? now.getDate() : sortedDates[0]);
            const displayEvents = highlightDay ? grouped.get(highlightDay) || [] : [];
            return (
              <div className="bg-base-200/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-primary" />
                  <span className="text-sm font-semibold">
                    {calMonth}月{highlightDay || '—'}日
                  </span>
                  {highlightDay && isCurrentMonth && highlightDay === now.getDate() && (
                    <span className="badge badge-xs badge-primary">今天</span>
                  )}
                </div>
                {displayEvents.length === 0 ? (
                  <div className="text-center py-6">
                    <Calendar size={28} className="mx-auto mb-2 text-base-content/15" />
                    <p className="text-sm text-base-content/40">当天无事项</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {displayEvents.map((ev, idx) => renderEventCard(ev, idx))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      );
    }

    // ========== WEEK VIEW ==========
    function renderWeekView() {
      const weekDates = getWeekDates(selectedDate);
      const ws = weekDates[0];
      const we = weekDates[6];
      const title = ws.getMonth() === we.getMonth()
        ? `${ws.getFullYear()}年${ws.getMonth() + 1}月`
        : `${ws.getMonth() + 1}月${ws.getDate()}日 — ${we.getMonth() + 1}月${we.getDate()}日`;

      return (
        <div className="space-y-4">
          {renderNavBar(title, () => navigateWeek(-1), () => navigateWeek(1), true)}

          {/* Week day strip */}
          <div className="grid grid-cols-7 gap-1 px-1">
            {weekDates.map((d, i) => {
              const isToday = isSameDay(d, now);
              const isSel = isSameDay(d, selectedDate);
              const inMonth = d.getMonth() + 1 === calMonth && d.getFullYear() === calYear;
              const dayEvs = inMonth ? (grouped.get(d.getDate()) || []) : [];

              return (
                <button
                  key={i}
                  className={`flex flex-col items-center py-2 rounded-xl transition-all duration-150 ${
                    isSel ? 'bg-primary/5' : 'hover:bg-base-200/60'
                  }`}
                  onClick={() => {
                    setSelectedDate(new Date(d));
                    setSelectedCalDay(d.getDate());
                  }}
                >
                  <span className="text-[10px] font-medium text-base-content/40 mb-1">{weekDays[i]}</span>
                  <div className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-all duration-150 ${
                    isToday
                      ? 'bg-primary text-primary-content font-bold shadow-sm'
                      : isSel
                        ? 'ring-2 ring-primary/40 bg-primary/10 text-primary font-semibold'
                        : 'text-base-content/70'
                  }`}>
                    {d.getDate()}
                  </div>
                  {dayEvs.length > 0 && (
                    <div className="flex gap-[3px] mt-1">
                      {dayEvs.slice(0, 3).map((ev, j) => (
                        <span key={j} className={`w-1 h-1 rounded-full ${getDotColor(ev.type)}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Events grouped by day */}
          <div className="space-y-4">
            {weekDates.map((d, i) => {
              const inMonth = d.getMonth() + 1 === calMonth && d.getFullYear() === calYear;
              const dayEvs = inMonth ? (grouped.get(d.getDate()) || []) : [];
              if (dayEvs.length === 0) return null;

              return (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2 px-2">
                    <span className={`text-xs font-semibold ${isSameDay(d, now) ? 'text-primary' : 'text-base-content/50'}`}>
                      {d.getMonth() + 1}月{d.getDate()}日 {cnWeekDays[d.getDay()]}
                    </span>
                    {isSameDay(d, now) && <span className="badge badge-xs badge-primary">今天</span>}
                  </div>
                  <div className="space-y-2">
                    {dayEvs.map((ev, idx) => renderEventCard(ev, idx))}
                  </div>
                </div>
              );
            })}

            {weekDates.every(d => {
              const inMonth = d.getMonth() + 1 === calMonth && d.getFullYear() === calYear;
              return (inMonth ? (grouped.get(d.getDate()) || []) : []).length === 0;
            }) && (
              <div className="text-center py-10">
                <Calendar size={32} className="mx-auto mb-3 text-base-content/15" />
                <p className="text-sm text-base-content/40">本周无事项</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // ========== DAY VIEW ==========
    function renderDayView() {
      const d = selectedDate;
      const dayNum = d.getDate();
      const monthNum = d.getMonth() + 1;
      const yearNum = d.getFullYear();
      const dayOfWeek = cnWeekDays[d.getDay()];
      const isToday = isSameDay(d, now);
      const inMonth = monthNum === calMonth && yearNum === calYear;
      const dayEvs = inMonth ? (grouped.get(dayNum) || []) : [];

      return (
        <div className="space-y-5">
          {/* Large date header */}
          <div className="flex items-center justify-between px-2">
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => navigateDay(-1)}>
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-1 ${
                isToday ? 'bg-primary text-primary-content' : 'bg-base-200'
              }`}>
                <span className="text-3xl font-light">{dayNum}</span>
              </div>
              <p className="text-sm font-medium text-base-content/70">{dayOfWeek}</p>
              <p className="text-xs text-base-content/40">{yearNum}年{monthNum}月</p>
            </div>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => navigateDay(1)}>
              <ChevronRight size={18} />
            </button>
          </div>

          {!isToday && (
            <div className="flex justify-center">
              <button className="btn btn-ghost btn-xs text-primary font-semibold" onClick={goToday}>回到今天</button>
            </div>
          )}

          {/* Events list */}
          {dayEvs.length === 0 ? (
            <div className="text-center py-14">
              <Calendar size={36} className="mx-auto mb-3 text-base-content/12" />
              <p className="text-base text-base-content/35 font-light">当天无事项</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-base-content/50 px-2">{dayEvs.length} 项事件</p>
              {dayEvs.map((ev, idx) => renderEventCard(ev, idx))}
            </div>
          )}
        </div>
      );
    }

    // ========== YEAR VIEW ==========
    function renderYearView() {
      const months = Array.from({ length: 12 }, (_, i) => i + 1);

      return (
        <div className="space-y-4">
          {/* Year navigation */}
          <div className="flex items-center justify-between px-1">
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setCalYear(calYear - 1)}>
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">{calYear}</h2>
              {calYear !== now.getFullYear() && (
                <button className="btn btn-ghost btn-xs text-primary font-semibold" onClick={goToday}>今年</button>
              )}
            </div>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setCalYear(calYear + 1)}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 4×3 mini-month grid */}
          <div className="grid grid-cols-3 gap-2">
            {months.map(m => {
              const daysInM = new Date(calYear, m, 0).getDate();
              const firstDay = new Date(calYear, m - 1, 1).getDay();
              const miniCells: (number | null)[] = [];
              for (let i = 0; i < firstDay; i++) miniCells.push(null);
              for (let d = 1; d <= daysInM; d++) miniCells.push(d);
              while (miniCells.length % 7 !== 0) miniCells.push(null);

              const isThisMonth = calYear === now.getFullYear() && m === now.getMonth() + 1;
              // Show event dots for the loaded month
              const isLoadedMonth = m === calMonth;

              return (
                <button
                  key={m}
                  className="text-left p-2 rounded-xl hover:bg-base-200/60 transition-colors duration-150 active:scale-[0.97]"
                  onClick={() => {
                    setCalMonth(m);
                    setCalView('month');
                    setSelectedCalDay(null);
                  }}
                >
                  <p className={`text-[11px] font-bold mb-1.5 ${isThisMonth ? 'text-primary' : 'text-base-content/60'}`}>
                    {m}月
                  </p>
                  {/* Mini weekday headers */}
                  <div className="grid grid-cols-7 gap-px mb-0.5">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, wi) => (
                      <div key={wi} className="text-center text-[6px] text-base-content/25 leading-none py-px">{wd}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px">
                    {miniCells.map((day, idx) => {
                      if (day === null) return <div key={idx} className="py-3" />;
                      const isToday = isThisMonth && day === now.getDate();
                      const hasEvents = isLoadedMonth && grouped.has(day);

                      return (
                        <div key={idx} className="aspect-square flex flex-col items-center justify-center relative">
                          <span className={`text-[8px] leading-none ${
                            isToday
                              ? 'bg-primary text-primary-content rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold'
                              : 'text-base-content/45'
                          }`}>
                            {day}
                          </span>
                          {hasEvents && !isToday && (
                            <span className="absolute bottom-0 w-1 h-1 rounded-full bg-primary/50" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // ========== MAIN RETURN ==========
    return (
      <div className="space-y-4">
        {/* Apple-style Segmented Control */}
        <div className="flex items-center bg-base-200/70 rounded-xl p-1 gap-0.5">
          {(['day', 'week', 'month', 'year'] as const).map(v => (
            <button
              key={v}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all duration-200 ${
                calView === v
                  ? 'bg-base-100 text-primary shadow-sm'
                  : 'text-base-content/45 hover:text-base-content/70'
              }`}
              onClick={() => {
                setCalView(v);
                if ((v === 'day' || v === 'week') && !selectedCalDay && isCurrentMonth) {
                  setSelectedDate(new Date());
                  setSelectedCalDay(now.getDate());
                } else if ((v === 'day' || v === 'week') && selectedCalDay) {
                  setSelectedDate(new Date(calYear, calMonth - 1, selectedCalDay));
                } else if ((v === 'day' || v === 'week')) {
                  setSelectedDate(new Date(calYear, calMonth - 1, 1));
                }
              }}
            >
              {v === 'day' ? 'Day' : v === 'week' ? 'Week' : v === 'month' ? 'Month' : 'Year'}
            </button>
          ))}
        </div>

        {/* Loading spinner */}
        {calLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : (
          <>
            {calView === 'month' && renderMonthView()}
            {calView === 'week' && renderWeekView()}
            {calView === 'day' && renderDayView()}
            {calView === 'year' && renderYearView()}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Dashboard tabs — Apple segmented control */}
      <div className="flex bg-base-100 rounded-xl p-1 gap-0.5 shadow-sm">
        {(['overview', 'reports', 'calendar'] as const).map(t => (
          <button key={t} onClick={() => setDashTab(t)}
            className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition-all duration-200 ${
              dashTab === t
                ? 'bg-base-200 text-base-content shadow-sm'
                : 'text-base-content/40 hover:text-base-content/60'
            }`}>
            {t === 'overview' ? '总览' : t === 'reports' ? '报表' : '日历'}
          </button>
        ))}
      </div>

      {dashTab === 'reports' && <FinancialReports />}
      {dashTab === 'calendar' && <CalendarView />}

      {dashTab === 'overview' && <>

      {/* Revenue Card */}
      <div className="bg-gradient-to-br from-primary/5 to-base-100 rounded-2xl p-5 shadow-sm border border-primary/10">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-base-content/40">每月租金收入</p>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-base-200 text-base-content/40">
            {new Date().getFullYear()}年{new Date().getMonth() + 1}月
          </span>
        </div>
        <p className="text-3xl font-bold tracking-tight text-base-content">{formatCurrency(s.monthlyRevenue)}</p>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-base-200">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-[11px] text-base-content/40">已收 {formatCurrency(s.totalCollected)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            <span className="text-[11px] text-base-content/40">待收 {s.pendingInvoices} 笔</span>
          </div>
        </div>
      </div>

      {/* Billing summary */}
      <div className="grid grid-cols-3 gap-3">
        <button className="bg-success/5 border border-success/10 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow" onClick={() => onNavigate('orders')}>
          <p className="text-lg font-bold text-success">{formatCurrency(s.totalCollected)}</p>
          <p className="text-[11px] text-success/70 font-medium mt-1">已收款</p>
        </button>
        <button className="bg-warning/5 border border-warning/10 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow" onClick={() => onNavigate('orders')}>
          <p className="text-lg font-bold text-warning">{s.pendingInvoices}</p>
          <p className="text-[11px] text-warning/70 font-medium mt-1">待收款</p>
        </button>
        <button className="bg-error/5 border border-error/10 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow" onClick={() => onNavigate('orders')}>
          <p className="text-lg font-bold text-error">{s.overdueInvoices}</p>
          <p className="text-[11px] text-error/70 font-medium mt-1">已逾期</p>
        </button>
      </div>

      {/* Section label */}
      <p className="text-[11px] font-semibold text-base-content/30 tracking-wider uppercase px-1">运营概览</p>

      {/* Stat cards — clean uniform style */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '全部物业', value: s.totalProperties, icon: <Building2 size={16} strokeWidth={1.5} />, page: 'properties' as Page },
          { label: '空置物业', value: s.availableProperties, icon: <Home size={16} strokeWidth={1.5} />, page: 'properties' as Page },
          { label: '租赁中', value: s.activeRentals, icon: <Key size={16} strokeWidth={1.5} />, page: 'rentals' as Page },
          { label: '已成交', value: s.completedSales, icon: <TrendingUp size={16} strokeWidth={1.5} />, page: 'sales' as Page },
          { label: '客户总数', value: s.totalClients, icon: <Users size={16} strokeWidth={1.5} />, page: 'clients' as Page },
          { label: '处理中', value: s.pendingDeals, icon: <Clock size={16} strokeWidth={1.5} />, page: 'sales' as Page },
        ].map((card) => (
          <button
            key={card.label}
            className="bg-base-100 border border-base-200 rounded-2xl p-3 text-center shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.97]"
            onClick={() => onNavigate(card.page)}
          >
            <div className="w-8 h-8 rounded-lg bg-base-200/60 flex items-center justify-center mx-auto mb-2">
              <span className="text-base-content/50">{card.icon}</span>
            </div>
            <p className="text-lg font-bold text-base-content leading-tight">{card.value}</p>
            <p className="text-[10px] text-base-content/40 font-medium mt-0.5">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Maintenance tickets — only if exists */}
      {(s.openTickets > 0 || s.inProgressTickets > 0) && (<>
        <p className="text-[11px] font-semibold text-base-content/30 tracking-wider uppercase px-1">维修工单</p>
        <div className="grid grid-cols-2 gap-3">
          <button className="bg-warning/5 border border-warning/10 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow" onClick={() => onNavigate('orders')}>
            <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center mx-auto mb-2">
              <Wrench size={14} className="text-warning" />
            </div>
            <p className="text-xl font-bold text-warning">{s.openTickets}</p>
            <p className="text-[11px] text-base-content/40 font-medium mt-0.5">待处理工单</p>
          </button>
          <button className="bg-info/5 border border-info/10 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow" onClick={() => onNavigate('orders')}>
            <div className="w-8 h-8 rounded-lg bg-info/15 flex items-center justify-center mx-auto mb-2">
              <Wrench size={14} className="text-info" />
            </div>
            <p className="text-xl font-bold text-info">{s.inProgressTickets}</p>
            <p className="text-[11px] text-base-content/40 font-medium mt-0.5">维修中</p>
          </button>
        </div>
      </>)}

      {/* Section label for alerts */}
      {(expiringFloors.length > 0 || expiringLeases.length > 0) && (
        <p className="text-[11px] font-semibold text-base-content/30 tracking-wider uppercase px-1">到期提醒</p>
      )}

      {/* Alerts section — subtle, muted */}
      {expiringFloors.length > 0 && (
        <div className="bg-base-100 rounded-2xl p-4 shadow-sm space-y-3">
          <button className="flex items-center gap-2 w-full" onClick={() => onNavigate('properties')}>
            <div className="w-6 h-6 rounded-md bg-warning/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={12} className="text-warning" />
            </div>
            <p className="text-xs font-semibold text-base-content flex-1 text-left">{expiringFloors.length} 个楼层租约即将到期</p>
            <span className="text-[11px] text-base-content/30">查看 →</span>
          </button>
          <div className="space-y-2">
            {expiringFloors.slice(0, 5).map((fl) => {
              const days = getDaysUntil(fl.lease_end);
              const isExpired = days < 0;
              return (
                <div key={fl.id} className="flex items-center justify-between py-1.5 border-b border-base-200 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate text-base-content/80">{fl.property_name} · {fl.floor_label}</p>
                    <p className="text-[11px] text-base-content/40">{fl.tenant_name} · RM {fl.rent_amount.toLocaleString()}/月</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[11px] text-base-content/40">{formatDate(fl.lease_end)}</p>
                    <span className={`text-[10px] font-medium ${isExpired ? 'text-error' : days <= 30 ? 'text-warning' : 'text-info'}`}>
                      {isExpired ? `已过期${Math.abs(days)}天` : `${days}天后`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {expiringLeases.length > 0 && (
        <div className="bg-base-100 rounded-2xl p-4 shadow-sm space-y-3">
          <button className="flex items-center gap-2 w-full" onClick={() => onNavigate('rentals')}>
            <span className="w-2 h-2 rounded-full bg-error shrink-0" />
            <p className="text-xs font-semibold text-base-content flex-1 text-left">{expiringLeases.length} 份租约即将到期</p>
            <span className="text-[11px] text-base-content/30">查看 →</span>
          </button>
          <div className="space-y-2">
            {expiringLeases.slice(0, 3).map((lease) => {
              const days = getDaysUntil(lease.lease_end);
              const isExpired = days < 0;
              return (
                <div key={lease.id} className="flex items-center justify-between py-1.5 border-b border-base-200 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate text-base-content/80">{lease.property_name}</p>
                    <p className="text-[11px] text-base-content/40">{lease.client_name}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[11px] text-base-content/40">{formatDate(lease.lease_end)}</p>
                    <span className={`text-[10px] font-medium ${isExpired ? 'text-error' : days <= 30 ? 'text-warning' : 'text-info'}`}>
                      {isExpired ? `已过期${Math.abs(days)}天` : `${days}天后`}
                    </span>
                  </div>
                </div>
              );
            })}
            {expiringLeases.length > 3 && (
              <button className="text-[11px] text-primary text-center w-full pt-1" onClick={() => onNavigate('rentals')}>
                还有 {expiringLeases.length - 3} 份... 查看全部 →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expense due alerts */}
      {(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        function getNextAssessmentDue(dueDate: string): string {
          const d = new Date(dueDate);
          const next = new Date(d);
          next.setMonth(next.getMonth() + 6);
          if (next.getDate() !== d.getDate()) next.setDate(0);
          return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
        }

        function getDaysUntilDate(dateStr: string): number {
          const d = new Date(dateStr);
          d.setHours(0, 0, 0, 0);
          return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }

        const items: Array<{
          id: number; name: string; type: string; amount: number; dueDate: string; days: number; nextDue?: string;
        }> = [];

        for (const p of expenseDues) {
          if (p.land_tax > 0 && p.land_tax_due) {
            const days = getDaysUntilDate(p.land_tax_due);
            if (days <= 90) {
              items.push({ id: p.id, name: p.name, type: '地税', amount: p.land_tax, dueDate: p.land_tax_due, days });
            }
          }
          if (p.assessment_tax > 0 && p.assessment_tax_due) {
            const days = getDaysUntilDate(p.assessment_tax_due);
            const nextDue = getNextAssessmentDue(p.assessment_tax_due);
            const nextDays = getDaysUntilDate(nextDue);
            if (days <= 90) {
              items.push({ id: p.id, name: p.name, type: '门牌税', amount: p.assessment_tax, dueDate: p.assessment_tax_due, days, nextDue });
            } else if (nextDays <= 90) {
              items.push({ id: p.id, name: p.name, type: '门牌税(下期)', amount: p.assessment_tax, dueDate: nextDue, days: nextDays });
            }
          }
        }

        items.sort((a, b) => a.days - b.days);
        if (items.length === 0) return null;

        return (
          <div className="bg-base-100 rounded-2xl p-4 shadow-sm space-y-3">
            <button className="flex items-center gap-2 w-full" onClick={() => onNavigate('properties')}>
              <span className="w-2 h-2 rounded-full bg-info shrink-0" />
              <p className="text-xs font-semibold text-base-content flex-1 text-left">{items.length} 项费用即将到期</p>
              <span className="text-[11px] text-base-content/30">查看 →</span>
            </button>
            <div className="space-y-2">
              {items.slice(0, 6).map((item, idx) => (
                <div key={`${item.id}-${item.type}-${idx}`} className="flex items-center justify-between py-1.5 border-b border-base-200 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate text-base-content/80">{item.name}</p>
                    <p className="text-[11px] text-base-content/40">{item.type} · RM {item.amount.toLocaleString()}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[11px] text-base-content/40">{item.dueDate}</p>
                    <span className={`text-[10px] font-medium ${item.days < 0 ? 'text-error' : item.days <= 30 ? 'text-warning' : 'text-info'}`}>
                      {item.days < 0 ? `已逾期${Math.abs(item.days)}天` : `${item.days}天后`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Quick actions */}
      <p className="text-[11px] font-semibold text-base-content/30 tracking-wider uppercase px-1">快捷操作</p>
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '物业', icon: <Building2 size={16} strokeWidth={1.5} />, action: () => onQuickAdd('property') },
          { label: '客户', icon: <Users size={16} strokeWidth={1.5} />, action: () => onQuickAdd('client') },
          { label: '买卖', icon: <TrendingUp size={16} strokeWidth={1.5} />, action: () => onQuickAdd('sale') },
          { label: '租赁', icon: <Key size={16} strokeWidth={1.5} />, action: () => onQuickAdd('rental') },
        ].map((qa) => (
          <button
            key={qa.label}
            className="bg-base-100 rounded-2xl p-3 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.96]"
            onClick={qa.action}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(190,95,40,0.08)' }}>
              <span style={{ color: '#BE5F28' }}>{qa.icon}</span>
            </div>
            <span className="text-[10px] text-base-content/60 font-medium">{qa.label}</span>
          </button>
        ))}
      </div>
      </>}
    </div>
  );
};
