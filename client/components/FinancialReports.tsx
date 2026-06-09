import React, { useEffect, useState } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Building2, Landmark,
  BarChart3, Percent, Home, ArrowUpRight, ArrowDownRight, Wallet, PiggyBank, Calendar, Download
} from 'lucide-react';
import { getPropertyFinancials, getFinancialSummary, PropertyFinancial } from '../utils/db';
import { formatCurrency, formatDate } from '../utils/helpers';
import { downloadCsv } from '../utils/export';

type SubTab = 'overview' | 'pnl' | 'roi' | 'loans';

export const FinancialReports: React.FC = () => {
  const [tab, setTab] = useState<SubTab>('overview');
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyFinancial[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getFinancialSummary>> | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getPropertyFinancials(), getFinancialSummary()])
      .then(([props, sum]) => {
        setProperties(props);
        setSummary(sum);
      })
      .catch(e => console.error('Financial data load error:', e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const s = summary!;

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'overview', label: '📊 总览' },
    { key: 'pnl', label: '💰 损益表' },
    { key: 'roi', label: '📈 ROI' },
    { key: 'loans', label: '🏦 贷款' },
  ];

  // ===== Overview Tab =====
  const renderOverview = () => {
    const maxRent = Math.max(...properties.map(p => p.monthlyRent), 1);
    const maxExp = Math.max(...properties.map(p => p.totalMonthlyExpense), 1);
    const maxBar = Math.max(maxRent, maxExp);

    const cards = [
      { label: '月租金总收入', value: formatCurrency(s.totalMonthlyRent), icon: <DollarSign size={20} />, bg: 'bg-success/15', color: 'text-success' },
      { label: '月总支出', value: formatCurrency(s.totalMonthlyExpense), icon: <Wallet size={20} />, bg: 'bg-error/15', color: 'text-error' },
      { label: '月净收入', value: formatCurrency(s.totalNetMonthly), icon: s.totalNetMonthly >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />, bg: s.totalNetMonthly >= 0 ? 'bg-primary/15' : 'bg-error/15', color: s.totalNetMonthly >= 0 ? 'text-primary' : 'text-error' },
      { label: '总购买价值', value: formatCurrency(s.totalPurchaseValue), sub: `购买价格 ${formatCurrency(s.totalPurchasePrice)} · 其他费用 ${formatCurrency(s.totalPurchaseFees)}`, icon: <Building2 size={20} />, bg: 'bg-accent/15', color: 'text-accent' },
      { label: '总欠款', value: formatCurrency(s.totalLoanBalance), sub: `月供 ${formatCurrency(s.totalMonthlyRepayment)}`, icon: <Landmark size={20} />, bg: 'bg-info/15', color: 'text-info' },
      { label: '入住率', value: `${s.occupancyRate.toFixed(1)}%`, sub: `${s.occupiedFloors}/${s.totalFloors} 单位`, icon: <Home size={20} />, bg: 'bg-warning/15', color: 'text-warning' },
      { label: '收款率', value: `${s.collectionRate.toFixed(1)}%`, icon: <Percent size={20} />, bg: 'bg-secondary/15', color: 'text-secondary' },
    ];

    return (
      <div className="space-y-4">
        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-2">
          {cards.map(c => (
            <div key={c.label} className={`rounded-xl p-3 ${c.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={c.color}>{c.icon}</span>
                <span className="text-xs text-base-content/70">{c.label}</span>
              </div>
              <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
              {(c as any).sub && <p className="text-[10px] text-base-content/50">{(c as any).sub}</p>}
            </div>
          ))}
        </div>

        {/* Income vs Expense bar chart */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-primary" />
              收入 vs 支出 (月)
            </h3>
            <div className="space-y-3">
              {properties.map(p => (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate max-w-[50%]">{p.name}</span>
                    <span className={`text-xs font-bold ${p.monthlyRent - p.totalMonthlyExpense >= 0 ? 'text-success' : 'text-error'}`}>
                      净 {formatCurrency(p.monthlyRent - p.totalMonthlyExpense)}
                    </span>
                  </div>
                  {/* Income bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-8 text-right text-success">收入</span>
                    <div className="flex-1 bg-base-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-success h-full rounded-full transition-all"
                        style={{ width: `${maxBar > 0 ? (p.monthlyRent / maxBar) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] w-16 text-right">{formatCurrency(p.monthlyRent)}</span>
                  </div>
                  {/* Expense bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-8 text-right text-error">支出</span>
                    <div className="flex-1 bg-base-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-error h-full rounded-full transition-all"
                        style={{ width: `${maxBar > 0 ? (p.totalMonthlyExpense / maxBar) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] w-16 text-right">{formatCurrency(p.totalMonthlyExpense)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===== P&L Tab =====
  const renderPnL = () => {
    const totals = {
      rent: properties.reduce((s, p) => s + p.monthlyRent, 0),
      repayment: properties.reduce((s, p) => s + p.monthlyRepayment, 0),
      mgmt: properties.reduce((s, p) => s + p.mgmtFee, 0),
      other: properties.reduce((s, p) => s + p.indahWater + p.recurringChargesTotal + p.landTaxMonthly + p.assessmentTaxMonthly, 0),
      netMonthly: properties.reduce((s, p) => s + (p.monthlyRent - p.totalMonthlyExpense), 0),
      netAnnual: properties.reduce((s, p) => s + p.annualNetIncome, 0),
    };

    function handleExportPnL() {
      const headers = ['物业', '月租金', '月供', '管理费', '其他费用', '月净收入', '年净收入'];
      const rows = properties.map(p => {
        const otherExp = p.indahWater + p.recurringChargesTotal + p.landTaxMonthly + p.assessmentTaxMonthly;
        const netMonthly = p.monthlyRent - p.totalMonthlyExpense;
        return [p.name, p.monthlyRent, p.monthlyRepayment, p.mgmtFee, otherExp, netMonthly, p.annualNetIncome] as (string | number)[];
      });
      rows.push(['合计', totals.rent, totals.repayment, totals.mgmt, totals.other, totals.netMonthly, totals.netAnnual]);
      downloadCsv(`损益表_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <DollarSign size={16} className="text-primary" />
            损益表 (按物业)
          </h3>
          <button className="btn btn-ghost btn-xs gap-1" onClick={handleExportPnL} title="导出CSV">
            <Download size={12} /> 导出
          </button>
        </div>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="table table-xs w-full">
            <thead>
              <tr className="text-base-content/70">
                <th className="text-left">物业</th>
                <th className="text-right">月租金</th>
                <th className="text-right">月供</th>
                <th className="text-right">管理费</th>
                <th className="text-right">其他费用</th>
                <th className="text-right">月净收入</th>
                <th className="text-right">年净收入</th>
              </tr>
            </thead>
            <tbody>
              {properties.map(p => {
                const otherExp = p.indahWater + p.recurringChargesTotal + p.landTaxMonthly + p.assessmentTaxMonthly;
                const netMonthly = p.monthlyRent - p.totalMonthlyExpense;
                return (
                  <tr key={p.id} className="hover">
                    <td className="font-medium max-w-[120px] truncate">{p.name}</td>
                    <td className="text-right text-success">{formatCurrency(p.monthlyRent)}</td>
                    <td className="text-right">{formatCurrency(p.monthlyRepayment)}</td>
                    <td className="text-right">{formatCurrency(p.mgmtFee)}</td>
                    <td className="text-right">{formatCurrency(otherExp)}</td>
                    <td className={`text-right font-semibold ${netMonthly >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatCurrency(netMonthly)}
                    </td>
                    <td className={`text-right font-semibold ${p.annualNetIncome >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatCurrency(p.annualNetIncome)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-base-content/20">
                <td>合计</td>
                <td className="text-right text-success">{formatCurrency(totals.rent)}</td>
                <td className="text-right">{formatCurrency(totals.repayment)}</td>
                <td className="text-right">{formatCurrency(totals.mgmt)}</td>
                <td className="text-right">{formatCurrency(totals.other)}</td>
                <td className={`text-right ${totals.netMonthly >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatCurrency(totals.netMonthly)}
                </td>
                <td className={`text-right ${totals.netAnnual >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatCurrency(totals.netAnnual)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Summary cards below table */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-success/10 rounded-xl p-3 text-center">
            <p className="text-[10px] text-base-content/60">年总收入</p>
            <p className="text-sm font-bold text-success">{formatCurrency(totals.rent * 12)}</p>
          </div>
          <div className="bg-error/10 rounded-xl p-3 text-center">
            <p className="text-[10px] text-base-content/60">年总支出</p>
            <p className="text-sm font-bold text-error">{formatCurrency((totals.repayment + totals.mgmt + totals.other) * 12)}</p>
          </div>
          <div className={`${totals.netAnnual >= 0 ? 'bg-primary/10' : 'bg-error/10'} rounded-xl p-3 text-center`}>
            <p className="text-[10px] text-base-content/60">年净收入</p>
            <p className={`text-sm font-bold ${totals.netAnnual >= 0 ? 'text-primary' : 'text-error'}`}>{formatCurrency(totals.netAnnual)}</p>
          </div>
        </div>
      </div>
    );
  };

  // ===== ROI Tab =====
  const renderROI = () => {
    const sorted = [...properties].sort((a, b) => b.roi - a.roi);
    const avgROI = properties.length > 0 ? properties.reduce((s, p) => s + p.roi, 0) / properties.length : 0;

    const roiColor = (roi: number) => roi >= 8 ? 'text-success' : roi >= 4 ? 'text-warning' : 'text-error';
    const roiBg = (roi: number) => roi >= 8 ? 'bg-success' : roi >= 4 ? 'bg-warning' : 'bg-error';

    return (
      <div className="space-y-3">
        {/* Average ROI card */}
        <div className="card bg-primary/10">
          <div className="card-body p-4 flex-row items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg">
              <TrendingUp size={24} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-base-content/60">平均投资回报率</p>
              <p className="text-2xl font-bold text-primary">{avgROI.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Per-property ROI cards */}
        <div className="space-y-2">
          {sorted.map((p, i) => (
            <div key={p.id} className="card bg-base-100 shadow-sm">
              <div className="card-body p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-sm badge-outline">#{i + 1}</span>
                      <span className="text-sm font-semibold truncate">{p.name}</span>
                    </div>
                    {p.address && <p className="text-[10px] text-base-content/50 truncate mt-0.5">{p.address}</p>}
                  </div>
                  <span className={`text-xl font-bold ${roiColor(p.roi)}`}>{p.roi.toFixed(1)}%</span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-base-content/60">总购入成本</span>
                    <span className="font-medium">{formatCurrency(p.totalPurchaseCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/60">年净收入</span>
                    <span className={`font-medium ${p.annualNetIncome >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatCurrency(p.annualNetIncome)}
                    </span>
                  </div>
                </div>

                {/* ROI progress bar */}
                <div className="mt-2">
                  <div className="w-full bg-base-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`${roiBg(p.roi)} h-full rounded-full transition-all`}
                      style={{ width: `${Math.min(Math.max(p.roi, 0), 15) / 15 * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5 text-[10px] text-base-content/40">
                    <span>0%</span>
                    <span>15%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ===== Loans Tab =====
  const renderLoans = () => {
    const propertiesWithLoans = properties.filter(p => p.loanAmount > 0);
    const totalLoan = propertiesWithLoans.reduce((s, p) => s + p.loanAmount, 0);
    const totalBalance = propertiesWithLoans.reduce((s, p) => s + p.loanBalance, 0);
    const totalMonthlyPayment = propertiesWithLoans.reduce((s, p) => s + p.monthlyPayment, 0);

    return (
      <div className="space-y-3">
        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-info/10 rounded-xl p-3 text-center">
            <Landmark size={16} className="text-info mx-auto mb-1" />
            <p className="text-[10px] text-base-content/60">总贷款额</p>
            <p className="text-xs font-bold text-info">{formatCurrency(totalLoan)}</p>
          </div>
          <div className="bg-warning/10 rounded-xl p-3 text-center">
            <Wallet size={16} className="text-warning mx-auto mb-1" />
            <p className="text-[10px] text-base-content/60">贷款余额</p>
            <p className="text-xs font-bold text-warning">{formatCurrency(totalBalance)}</p>
          </div>
          <div className="bg-error/10 rounded-xl p-3 text-center">
            <DollarSign size={16} className="text-error mx-auto mb-1" />
            <p className="text-[10px] text-base-content/60">月还款</p>
            <p className="text-xs font-bold text-error">{formatCurrency(totalMonthlyPayment)}</p>
          </div>
        </div>

        {/* Per-property loan cards */}
        {propertiesWithLoans.length === 0 ? (
          <div className="text-center py-8 text-base-content/40">
            <Landmark size={40} className="mx-auto mb-2" />
            <p>暂无贷款记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {propertiesWithLoans.map(p => {
              const paidOff = p.loanAmount > 0 ? ((p.loanAmount - p.loanBalance) / p.loanAmount) * 100 : 0;
              return (
                <div key={p.id} className="card bg-base-100 shadow-sm">
                  <div className="card-body p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 size={16} className="text-primary shrink-0" />
                      <span className="text-sm font-semibold truncate">{p.name}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-base-content/60">贷款总额</span>
                        <span className="font-medium">{formatCurrency(p.loanAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base-content/60">当前余额</span>
                        <span className="font-medium text-warning">{formatCurrency(p.loanBalance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base-content/60">月还款额</span>
                        <span className="font-medium">{formatCurrency(p.monthlyPayment)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-base-content/60">利率</span>
                        <span className="font-medium">{p.interestRate.toFixed(2)}%</span>
                      </div>
                      {p.loanStart && (
                        <div className="flex justify-between">
                          <span className="text-base-content/60">开始日期</span>
                          <span className="font-medium">{formatDate(p.loanStart)}</span>
                        </div>
                      )}
                      {p.estimatedPayoffDate && (
                        <div className="flex justify-between">
                          <span className="text-base-content/60">预计还清</span>
                          <span className="font-medium">{formatDate(p.estimatedPayoffDate)}</span>
                        </div>
                      )}
                      {p.loanAccountNo && (
                        <div className="flex justify-between col-span-2">
                          <span className="text-base-content/60">贷款账号</span>
                          <span className="font-medium font-mono text-[11px]">{p.loanAccountNo}</span>
                        </div>
                      )}
                    </div>

                    {/* Paid-off progress */}
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-base-content/60 mb-0.5">
                        <span>已还 {paidOff.toFixed(1)}%</span>
                        <span>{formatCurrency(p.loanAmount - p.loanBalance)} / {formatCurrency(p.loanAmount)}</span>
                      </div>
                      <div className="w-full bg-base-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-success h-full rounded-full transition-all"
                          style={{ width: `${Math.min(paidOff, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab pills */}
      <div className="flex gap-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`btn btn-xs flex-1 ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && renderOverview()}
      {tab === 'pnl' && renderPnL()}
      {tab === 'roi' && renderROI()}
      {tab === 'loans' && renderLoans()}
    </div>
  );
};
