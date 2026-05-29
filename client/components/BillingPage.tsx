import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, AlertTriangle, Clock, FileText, Trash2, Zap, Calendar, Download, Printer, MessageCircle, Send, Smartphone, Eye } from 'lucide-react';
import { Invoice, InvoiceStatus, INVOICE_STATUSES } from '../types';
import { getInvoices, markInvoicePaid, markInvoiceOverdue, deleteInvoice, generateMonthlyInvoices, previewMonthlyInvoices, getInvoiceSummaryByMonth, getFloorUnits, getTemplates, MergedPreviewItem } from '../utils/db';
import { downloadCsv } from '../utils/export';
import { ConfirmModal } from './ConfirmModal';
import { printInvoice } from './PrintableInvoice';
import { sendWhatsAppMessage, buildInvoiceMessage } from '../utils/whatsapp';

interface BillingPageProps {
  onAdd: () => void;
  onEdit: (inv: Invoice) => void;
  refreshKey: number;
  userId?: number;
}

interface MonthlySummary {
  month: string;
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  count: number;
}

const STATUS_ICONS: Record<InvoiceStatus, React.ReactNode> = {
  pending: <Clock size={16} className="text-warning" />,
  paid: <CheckCircle size={16} className="text-success" />,
  overdue: <AlertTriangle size={16} className="text-error" />,
  cancelled: <FileText size={16} className="text-base-content" />,
};

export const BillingPage: React.FC<BillingPageProps> = ({ onAdd, onEdit, refreshKey, userId }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);

  // Generate modal state
  const [genModalOpen, setGenModalOpen] = useState(false);
  const now = new Date();
  const [genYear, setGenYear] = useState(now.getFullYear());
  const [genMonth, setGenMonth] = useState(now.getMonth() + 1);
  const [genDueDay, setGenDueDay] = useState(7);
  const [generating, setGenerating] = useState(false);

  // Preview step state
  const [genStep, setGenStep] = useState<1 | 2>(1);
  const [previewData, setPreviewData] = useState<MergedPreviewItem[]>([]);
  const [excludedCharges, setExcludedCharges] = useState<Set<string>>(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);

  // Preview adjustments state: key = "propertyId-floorLabel"
  const [previewAdjustments, setPreviewAdjustments] = useState<Record<string, Array<{name: string; amount: number}>>>({});
  const [adjInputs, setAdjInputs] = useState<Record<string, {name: string; amount: number}>>({});

  // Toast state
  const [toast, setToast] = useState('');

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // WhatsApp send modal
  const [waModal, setWaModal] = useState<{
    open: boolean; invoice: Invoice | null; phone: string; message: string; sending: boolean;
  }>({ open: false, invoice: null, phone: '', message: '', sending: false });

  // Batch WhatsApp send
  const [batchModal, setBatchModal] = useState<{
    open: boolean; targets: Array<{ invoice: Invoice; phone: string; message: string }>; sending: boolean; progress: number; results: { success: number; failed: number };
  }>({ open: false, targets: [], sending: false, progress: 0, results: { success: 0, failed: 0 } });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  async function loadData() {
    setLoading(true);
    try {
      const [data, summary] = await Promise.all([
        getInvoices(userId),
        getInvoiceSummaryByMonth(),
      ]);
      setInvoices(data);
      setMonthlySummary(summary);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function handleExportInvoices() {
    const headers = ['账单号', '物业', '楼层', '租户', '金额', '到期日', '状态', '账单月份', '备注'];
    const statusMap: Record<string, string> = { pending: '待付款', paid: '已付款', overdue: '已逾期', cancelled: '已取消' };
    const rows = invoices.map(inv => [
      inv.invoice_no, inv.property_name || '', inv.floor_label || '', inv.tenant_name || '',
      inv.amount, inv.due_date || '', statusMap[inv.status] || inv.status,
      inv.billing_month || '', inv.description || '',
    ] as (string | number)[]);
    downloadCsv(`账单列表_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  const filtered = filter === 'all' ? invoices : invoices.filter((i) => i.status === filter);

  const summary = {
    total: invoices.reduce((s, i) => s + (i.status !== 'cancelled' ? i.amount : 0), 0),
    paid: invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
    pending: invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0),
    overdue: invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0),
  };

  async function handleMarkPaid(id: number) {
    await markInvoicePaid(id);
    await loadData();
  }

  async function handleMarkOverdue(id: number) {
    await markInvoiceOverdue(id);
    await loadData();
  }

  async function handleDeleteConfirm() {
    if (deleteConfirmId === null) return;
    await deleteInvoice(deleteConfirmId);
    setDeleteConfirmId(null);
    await loadData();
  }

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const data = await previewMonthlyInvoices(genYear, genMonth);
      setPreviewData(data);
      setExcludedCharges(new Set());
      setPreviewAdjustments({});
      setAdjInputs({});
      setGenStep(2);
    } catch (e) {
      console.error(e);
      showToast('加载预览失败');
    }
    setPreviewLoading(false);
  }

  function toggleCharge(mergeKey: string, chargeId: number) {
    const key = `${mergeKey}-${chargeId}`;
    setExcludedCharges(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generateMonthlyInvoices(
        genYear, genMonth, genDueDay,
        previewData,
        excludedCharges.size > 0 ? excludedCharges : undefined,
        Object.keys(previewAdjustments).length > 0 ? previewAdjustments : undefined
      );
      showToast(`已生成 ${result.created} 张账单，跳过 ${result.skipped} 张（已存在）`);
      setGenModalOpen(false);
      setGenStep(1);
      await loadData();
    } catch (e) {
      console.error(e);
      showToast('生成失败，请重试');
    }
    setGenerating(false);
  }

  async function handleSendWhatsApp(inv: Invoice) {
    try {
      // Get floor units for the property to find phone
      const units = await getFloorUnits(inv.property_id);
      const unit = units.find(u => u.floor_label === inv.floor_label || u.tenant_name === inv.tenant_name);
      const phone = unit?.tenant_phone || '';

      // Get first template
      const templates = await getTemplates();
      const tpl = templates.length > 0 ? templates[0] : null;
      const templateContent = tpl?.content || '尊敬的 {tenant_name},\n\n提醒您，物业 {property_name} 的租金 {amount} 将于 {due_date} 到期。\n\n请及时缴纳租金，谢谢！';

      const message = buildInvoiceMessage(templateContent, {
        tenant_name: inv.tenant_name || '租户',
        property_name: inv.property_name || '',
        floor_label: inv.floor_label || '',
        amount: inv.amount,
        due_date: inv.due_date || '',
        invoice_no: inv.invoice_no || '',
      });

      setWaModal({ open: true, invoice: inv, phone, message, sending: false });
    } catch (e) {
      console.error(e);
      showToast('获取数据失败');
    }
  }

  async function handleWaSend() {
    if (!waModal.invoice || !waModal.phone) return;
    setWaModal(prev => ({ ...prev, sending: true }));
    const result = await sendWhatsAppMessage(waModal.phone, waModal.message, {
      recipientName: waModal.invoice.tenant_name,
      messageType: 'invoice',
      propertyId: waModal.invoice.property_id,
      invoiceId: waModal.invoice.id,
    });
    setWaModal(prev => ({ ...prev, sending: false, open: false }));
    showToast(result.success ? '✅ WhatsApp 消息已发送' : `❌ 发送失败: ${result.error}`);
  }

  async function handleBatchWhatsApp() {
    try {
      // Find all pending/overdue invoices with tenant phone
      const pendingInvs = invoices.filter(i => i.status === 'pending' || i.status === 'overdue');
      const templates = await getTemplates();
      const tpl = templates.length > 0 ? templates[0] : null;
      const templateContent = tpl?.content || '尊敬的 {tenant_name},\n\n提醒您，物业 {property_name} 的租金 {amount} 将于 {due_date} 到期。\n\n请及时缴纳租金，谢谢！';

      // Collect targets: for each invoice, find phone from floor units
      const targets: Array<{ invoice: Invoice; phone: string; message: string }> = [];
      const propertyUnitsCache = new Map<number, Awaited<ReturnType<typeof getFloorUnits>>>();

      for (const inv of pendingInvs) {
        if (!propertyUnitsCache.has(inv.property_id)) {
          propertyUnitsCache.set(inv.property_id, await getFloorUnits(inv.property_id));
        }
        const units = propertyUnitsCache.get(inv.property_id)!;
        const unit = units.find(u => u.floor_label === inv.floor_label || u.tenant_name === inv.tenant_name);
        if (unit?.tenant_phone) {
          const message = buildInvoiceMessage(templateContent, {
            tenant_name: inv.tenant_name || unit.tenant_name || '租户',
            property_name: inv.property_name || '',
            floor_label: inv.floor_label || '',
            amount: inv.amount,
            due_date: inv.due_date || '',
            invoice_no: inv.invoice_no || '',
          });
          targets.push({ invoice: inv, phone: unit.tenant_phone, message });
        }
      }

      if (targets.length === 0) {
        showToast('未找到有电话号码的待付/逾期账单');
        return;
      }

      setBatchModal({ open: true, targets, sending: false, progress: 0, results: { success: 0, failed: 0 } });
    } catch (e) {
      console.error(e);
      showToast('获取数据失败');
    }
  }

  async function handleBatchSend() {
    setBatchModal(prev => ({ ...prev, sending: true, progress: 0, results: { success: 0, failed: 0 } }));
    let success = 0;
    let failed = 0;

    for (let i = 0; i < batchModal.targets.length; i++) {
      const t = batchModal.targets[i];
      const result = await sendWhatsAppMessage(t.phone, t.message, {
        recipientName: t.invoice.tenant_name,
        messageType: 'invoice',
        propertyId: t.invoice.property_id,
        invoiceId: t.invoice.id,
      });
      if (result.success) success++; else failed++;
      setBatchModal(prev => ({ ...prev, progress: i + 1, results: { success, failed } }));
    }

    setBatchModal(prev => ({ ...prev, sending: false }));
    showToast(`群发完成：成功 ${success} / 失败 ${failed}`);
  }

  function getStatusLabel(status: InvoiceStatus): string {
    return INVOICE_STATUSES.find((s) => s.value === status)?.label || status;
  }

  function getStatusBadge(status: InvoiceStatus): string {
    return INVOICE_STATUSES.find((s) => s.value === status)?.color || 'badge-ghost';
  }

  function formatMonth(m: string): string {
    if (!m) return '-';
    const [y, mo] = m.split('-');
    return `${y}年${parseInt(mo)}月`;
  }

  // Group invoices by billing_month when filter is 'all'
  const groupedInvoices: Map<string, Invoice[]> = new Map();
  if (filter === 'all') {
    for (const inv of filtered) {
      const key = inv.billing_month || '未分类';
      if (!groupedInvoices.has(key)) groupedInvoices.set(key, []);
      groupedInvoices.get(key)!.push(inv);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md" /></div>;
  }

  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-4">
      {/* Auto Generate & Export Buttons */}
      <div className="flex gap-2">
        <button
          className="btn btn-primary btn-sm flex-1 gap-2"
          onClick={() => { setGenModalOpen(true); setGenStep(1); setPreviewData([]); setExcludedCharges(new Set()); setPreviewAdjustments({}); setAdjInputs({}); }}
        >
          <Zap size={16} /> 一键生成账单
        </button>
        <button
          className="btn btn-success btn-sm gap-1"
          onClick={handleBatchWhatsApp}
          title="群发WhatsApp提醒"
        >
          <Smartphone size={14} /> 群发提醒
        </button>
        <button className="btn btn-ghost btn-sm gap-1" onClick={handleExportInvoices} title="导出CSV">
          <Download size={14} /> 导出
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-base-200 rounded-xl p-3 text-center">
          <p className="text-xs text-base-content">总计账单</p>
          <p className="text-lg font-bold">RM {summary.total.toLocaleString()}</p>
        </div>
        <div className="bg-success/10 rounded-xl p-3 text-center">
          <p className="text-xs text-success">已收款</p>
          <p className="text-lg font-bold text-success">RM {summary.paid.toLocaleString()}</p>
        </div>
        <div className="bg-warning/10 rounded-xl p-3 text-center">
          <p className="text-xs text-warning">待收款</p>
          <p className="text-lg font-bold text-warning">RM {summary.pending.toLocaleString()}</p>
        </div>
        <div className="bg-error/10 rounded-xl p-3 text-center">
          <p className="text-xs text-error">已逾期</p>
          <p className="text-lg font-bold text-error">RM {summary.overdue.toLocaleString()}</p>
        </div>
      </div>

      {/* Monthly Summary */}
      {monthlySummary.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-bold flex items-center gap-1">
            <Calendar size={14} /> 月度收款统计
          </h3>
          <div className="overflow-x-auto">
            <table className="table table-xs w-full">
              <thead>
                <tr>
                  <th>月份</th>
                  <th className="text-right">总额</th>
                  <th className="text-right">已收</th>
                  <th className="text-right">待收</th>
                  <th className="text-center">笔数</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map((ms) => (
                  <tr key={ms.month}>
                    <td className="font-medium">{formatMonth(ms.month)}</td>
                    <td className="text-right">RM {ms.total.toLocaleString()}</td>
                    <td className="text-right text-success">RM {ms.paid.toLocaleString()}</td>
                    <td className="text-right text-warning">RM {ms.pending.toLocaleString()}</td>
                    <td className="text-center">{ms.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-base-200 rounded-xl p-1">
        {(['all', ...INVOICE_STATUSES.map((s) => s.value)] as const).map((val) => (
          <button
            key={val}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === val ? 'bg-primary text-primary-content' : 'text-base-content hover:text-base-content'
            }`}
            onClick={() => setFilter(val as InvoiceStatus | 'all')}
          >
            {val === 'all' ? '全部' : INVOICE_STATUSES.find((s) => s.value === val)?.label}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-base-content">
          <FileText size={40} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">暂无账单</p>
        </div>
      ) : filter === 'all' && groupedInvoices.size > 0 ? (
        // Grouped by billing_month
        <div className="space-y-4">
          {Array.from(groupedInvoices.entries()).map(([month, invs]) => (
            <div key={month} className="space-y-2">
              <h4 className="text-xs font-bold text-base-content/70 px-1">
                {month === '未分类' ? month : formatMonth(month)} ({invs.length}笔)
              </h4>
              {invs.map((inv) => renderInvoiceCard(inv))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => renderInvoiceCard(inv))}
        </div>
      )}

      {/* FAB */}
      <button
        className="btn btn-primary btn-circle shadow-lg fixed bottom-20 right-4 z-40"
        onClick={onAdd}
      >
        <Plus size={24} />
      </button>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        open={deleteConfirmId !== null}
        message="确定删除此账单？此操作不可撤销。"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />

      {/* Generate Modal */}
      {genModalOpen && (
        <div className="modal modal-open" style={{ zIndex: 9999 }}>
          <div className={`modal-box ${genStep === 2 ? 'max-w-2xl' : 'max-w-sm'}`}>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Zap size={20} /> 一键生成月度账单
            </h3>
            
            {genStep === 1 ? (
              <>
                <p className="text-sm text-base-content/70 mt-2">
                  选择账单月份和截止日，点击预览查看所有待生成账单的明细。
                </p>
                <div className="flex gap-3 mt-4">
                  <div className="form-control flex-1">
                    <label className="label py-1"><span className="label-text text-xs">年份</span></label>
                    <select className="select select-bordered select-sm w-full" value={genYear} onChange={(e) => setGenYear(Number(e.target.value))}>
                      {yearOptions.map((y) => (<option key={y} value={y}>{y}年</option>))}
                    </select>
                  </div>
                  <div className="form-control flex-1">
                    <label className="label py-1"><span className="label-text text-xs">月份</span></label>
                    <select className="select select-bordered select-sm w-full" value={genMonth} onChange={(e) => setGenMonth(Number(e.target.value))}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (<option key={m} value={m}>{m}月</option>))}
                    </select>
                  </div>
                  <div className="form-control flex-1">
                    <label className="label py-1"><span className="label-text text-xs">截止日</span></label>
                    <select className="select select-bordered select-sm w-full" value={genDueDay} onChange={(e) => setGenDueDay(Number(e.target.value))}>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (<option key={d} value={d}>{d}号</option>))}
                    </select>
                  </div>
                </div>
                <div className="modal-action">
                  <button className="btn btn-ghost btn-sm" onClick={() => setGenModalOpen(false)}>取消</button>
                  <button className="btn btn-primary btn-sm gap-1" onClick={handlePreview} disabled={previewLoading}>
                    {previewLoading ? <span className="loading loading-spinner loading-xs" /> : <Eye size={14} />}
                    预览账单
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-base-content/70 mt-2">
                  {genYear}年{genMonth}月 · 截止日: {genDueDay}号 · 取消勾选可豁免该费用
                </p>
                
                <div className="mt-3 max-h-[60vh] overflow-y-auto space-y-3">
                  {previewData.filter(d => !d.alreadyExists).length === 0 ? (
                    <div className="text-center py-8 text-base-content/50">
                      <p>本月所有账单已生成，无新增项目</p>
                    </div>
                  ) : (
                    previewData.map((item, idx) => {
                      if (item.alreadyExists) return null;
                      const activeCharges = item.charges.filter(c => !excludedCharges.has(`${item.mergeKey}-${c.id}`));
                      const chargesTotal = activeCharges.reduce((s, c) => s + c.amount, 0);
                      const adjKey = item.mergeKey;
                      const adjs = previewAdjustments[adjKey] || [];
                      const adjTotal = adjs.reduce((s, a) => s + a.amount, 0);
                      const total = Math.round(item.rent + chargesTotal + adjTotal);
                      const adjInput = adjInputs[adjKey] || { name: '', amount: 0 };
                      
                      return (
                        <div key={idx} className="border border-base-300 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-semibold text-sm">{item.tenantName}</span>
                              {item.isMerged && <span className="badge badge-sm badge-info">🔗 合并</span>}
                            </div>
                            <span className="font-bold text-primary">RM {total.toLocaleString()}</span>
                          </div>
                          {item.isMerged && item.components.length > 1 ? (
                            <div className="mt-1 space-y-0.5">
                              {item.components.map((comp, ci) => (
                                <div key={ci} className="flex items-center justify-between text-xs text-base-content/60">
                                  <div className="flex items-center gap-1">
                                    <span>{comp.propertyName}</span>
                                    {comp.floorLabel.split(',').map((fl, fi) => (
                                      <span key={fi} className="badge badge-xs badge-primary">{fl}</span>
                                    ))}
                                  </div>
                                  <span>RM {comp.rent.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          ) : item.isMerged && item.components.length === 1 ? (
                            <div className="flex items-center gap-1 text-xs text-base-content/60 mt-1">
                              <span>{item.propertyName}</span>
                              {item.floorLabel.split(',').map((fl, fi) => (
                                <span key={fi} className="badge badge-xs badge-primary">{fl}</span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-base-content/60 mt-1">
                              <span>{item.propertyName}</span>
                              <span className="badge badge-xs badge-primary">{item.floorLabel}</span>
                            </div>
                          )}
                          
                          <div className="mt-2 space-y-1">
                            {/* Rent - always included, no checkbox */}
                            <div className="flex items-center justify-between text-sm bg-base-200/50 rounded px-2 py-1">
                              <span>🏠 租金</span>
                              <span>RM {item.rent.toLocaleString()}</span>
                            </div>
                            
                            {/* Charges - each with checkbox */}
                            {item.charges.map(c => {
                              const exKey = `${item.mergeKey}-${c.id}`;
                              const isExcluded = excludedCharges.has(exKey);
                              return (
                                <label key={c.id} className={`flex items-center justify-between text-sm rounded px-2 py-1 cursor-pointer hover:bg-base-200/30 ${isExcluded ? 'opacity-40 line-through' : ''}`}>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-xs checkbox-primary"
                                      checked={!isExcluded}
                                      onChange={() => toggleCharge(item.mergeKey, c.id)}
                                    />
                                    <span>{c.name}</span>
                                    {c.floorLabel === '' && <span className="badge badge-ghost badge-xs">整栋</span>}
                                  </div>
                                  <span>RM {c.amount.toLocaleString()}</span>
                                </label>
                              );
                            })}

                            {/* Adjustments section */}
                            <div className="mt-2 pt-2 border-t border-base-300">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">📝 调整项目</span>
                              </div>
                              {adjs.length === 0 && (
                                <div className="text-xs text-base-content/40 px-2 py-1">(暂无调整)</div>
                              )}
                              {adjs.map((adj, i) => (
                                <div key={i} className={`flex items-center justify-between text-xs px-2 py-1 text-base-content/70`}>
                                  <span>{adj.name}</span>
                                  <div className="flex items-center gap-1">
                                    <span>{adj.amount < 0 ? '-' : '+'}RM {Math.abs(adj.amount).toLocaleString()}</span>
                                    <button type="button" className="btn btn-ghost btn-xs px-0.5 text-error/60 hover:text-error" onClick={() => {
                                      setPreviewAdjustments(prev => {
                                        const updated = {...prev};
                                        updated[adjKey] = (updated[adjKey] || []).filter((_, idx2) => idx2 !== i);
                                        if (updated[adjKey].length === 0) delete updated[adjKey];
                                        return updated;
                                      });
                                    }}>✕</button>
                                  </div>
                                </div>
                              ))}
                              {/* Add adjustment inline form */}
                              <div className="flex gap-1 mt-1">
                                <input className="input input-bordered input-xs flex-1" placeholder="项目名称"
                                  value={adjInput.name}
                                  onChange={e => setAdjInputs(prev => ({...prev, [adjKey]: {...adjInput, name: e.target.value}}))}
                                />
                                <input type="number" className="input input-bordered input-xs w-20" placeholder="金额"
                                  value={adjInput.amount || ''}
                                  onChange={e => setAdjInputs(prev => ({...prev, [adjKey]: {...adjInput, amount: Number(e.target.value)}}))}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && adjInput.name && adjInput.amount !== 0) {
                                      e.preventDefault();
                                      setPreviewAdjustments(prev => ({
                                        ...prev,
                                        [adjKey]: [...(prev[adjKey] || []), {name: adjInput.name, amount: adjInput.amount}]
                                      }));
                                      setAdjInputs(prev => ({...prev, [adjKey]: {name: '', amount: 0}}));
                                    }
                                  }}
                                />
                                <button type="button" className="btn btn-sm btn-primary"
                                  disabled={!adjInput.name || adjInput.amount === 0}
                                  onClick={() => {
                                    setPreviewAdjustments(prev => ({
                                      ...prev,
                                      [adjKey]: [...(prev[adjKey] || []), {name: adjInput.name, amount: adjInput.amount}]
                                    }));
                                    setAdjInputs(prev => ({...prev, [adjKey]: {name: '', amount: 0}}));
                                  }}
                                >+</button>
                              </div>
                              <p className="text-[10px] text-base-content/50 mt-0.5">正数=额外收费，负数=扣减</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  
                  {/* Show skipped count */}
                  {previewData.filter(d => d.alreadyExists).length > 0 && (
                    <div className="text-xs text-base-content/50 text-center py-1">
                      {previewData.filter(d => d.alreadyExists).length} 张账单已存在，将自动跳过
                    </div>
                  )}
                </div>
                
                {/* Summary footer */}
                {previewData.filter(d => !d.alreadyExists).length > 0 && (
                  <div className="mt-3 pt-2 border-t border-base-300 flex items-center justify-between text-sm">
                    <span className="text-base-content/70">
                      共 {previewData.filter(d => !d.alreadyExists).length} 张 · 
                      豁免 {excludedCharges.size} 项费用
                      {Object.keys(previewAdjustments).length > 0 && ` · ${Object.values(previewAdjustments).reduce((s: number, a: Array<{name: string; amount: number}>) => s + a.length, 0)} 项调整`}
                    </span>
                    <span className="font-bold">
                      总计 RM {previewData.filter(d => !d.alreadyExists).reduce((s, item) => {
                        const activeCharges = item.charges.filter(c => !excludedCharges.has(`${item.mergeKey}-${c.id}`));
                        const adjKey = item.mergeKey;
                        const adjs = previewAdjustments[adjKey] || [];
                        const adjTotal = adjs.reduce((as2, a) => as2 + a.amount, 0);
                        return s + item.rent + activeCharges.reduce((cs, c) => cs + c.amount, 0) + adjTotal;
                      }, 0).toLocaleString()}
                    </span>
                  </div>
                )}
                
                <div className="modal-action">
                  <button className="btn btn-ghost btn-sm" onClick={() => setGenStep(1)}>返回</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setGenModalOpen(false); setGenStep(1); }}>取消</button>
                  <button
                    className="btn btn-primary btn-sm gap-1"
                    onClick={handleGenerate}
                    disabled={generating || previewData.filter(d => !d.alreadyExists).length === 0}
                  >
                    {generating ? <span className="loading loading-spinner loading-xs" /> : <Zap size={14} />}
                    生成 {previewData.filter(d => !d.alreadyExists).length} 张账单
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="modal-backdrop" onClick={() => { if (!generating && !previewLoading) { setGenModalOpen(false); setGenStep(1); } }} />
        </div>
      )}

      {/* WhatsApp Send Modal */}
      {waModal.open && waModal.invoice && (
        <div className="modal modal-open" style={{ zIndex: 9999 }}>
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <MessageCircle size={20} className="text-success" /> 发送 WhatsApp 提醒
            </h3>
            <div className="space-y-3 mt-3">
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">收件人</span></label>
                <p className="text-sm font-medium">{waModal.invoice.tenant_name || '租户'}</p>
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">电话号码</span></label>
                <input
                  type="tel"
                  className="input input-bordered input-sm w-full"
                  value={waModal.phone}
                  onChange={(e) => setWaModal(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="如: 0123456789"
                />
                {!waModal.phone && (
                  <label className="label py-0.5"><span className="label-text-alt text-error text-xs">该租户未设置电话号码</span></label>
                )}
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">消息内容</span></label>
                <textarea
                  className="textarea textarea-bordered text-sm w-full"
                  rows={6}
                  value={waModal.message}
                  onChange={(e) => setWaModal(prev => ({ ...prev, message: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setWaModal({ open: false, invoice: null, phone: '', message: '', sending: false })}
                disabled={waModal.sending}
              >
                取消
              </button>
              <button
                className="btn btn-success btn-sm gap-1"
                onClick={handleWaSend}
                disabled={waModal.sending || !waModal.phone}
              >
                {waModal.sending ? <span className="loading loading-spinner loading-xs" /> : <Send size={14} />}
                发送
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !waModal.sending && setWaModal({ open: false, invoice: null, phone: '', message: '', sending: false })} />
        </div>
      )}

      {/* Batch WhatsApp Send Modal */}
      {batchModal.open && (
        <div className="modal modal-open" style={{ zIndex: 9999 }}>
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Smartphone size={20} className="text-success" /> 群发 WhatsApp 提醒
            </h3>
            {!batchModal.sending && batchModal.progress === 0 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm">
                  将向 <span className="font-bold text-success">{batchModal.targets.length}</span> 位租户发送 WhatsApp 账单提醒
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {batchModal.targets.map((t, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-base-200 rounded-lg px-2 py-1.5">
                      <span className="truncate">{t.invoice.tenant_name || '租户'}</span>
                      <span className="text-base-content/60 shrink-0 ml-2">{t.phone}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>发送进度</span>
                  <span className="font-medium">{batchModal.progress} / {batchModal.targets.length}</span>
                </div>
                <progress
                  className="progress progress-success w-full"
                  value={batchModal.progress}
                  max={batchModal.targets.length}
                />
                <div className="flex gap-4 text-sm">
                  <span className="text-success">✅ 成功: {batchModal.results.success}</span>
                  <span className="text-error">❌ 失败: {batchModal.results.failed}</span>
                </div>
              </div>
            )}
            <div className="modal-action">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setBatchModal({ open: false, targets: [], sending: false, progress: 0, results: { success: 0, failed: 0 } })}
                disabled={batchModal.sending}
              >
                {batchModal.progress > 0 && !batchModal.sending ? '关闭' : '取消'}
              </button>
              {batchModal.progress === 0 && (
                <button
                  className="btn btn-success btn-sm gap-1"
                  onClick={handleBatchSend}
                  disabled={batchModal.sending}
                >
                  {batchModal.sending ? <span className="loading loading-spinner loading-xs" /> : <Send size={14} />}
                  确认发送
                </button>
              )}
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !batchModal.sending && setBatchModal({ open: false, targets: [], sending: false, progress: 0, results: { success: 0, failed: 0 } })} />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast toast-top toast-center z-[10000]">
          <div className="alert alert-success shadow-lg">
            <span className="text-sm">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );

  function renderInvoiceCard(inv: Invoice) {
    return (
      <div
        key={inv.id}
        className="bg-base-200 rounded-xl p-3 space-y-2"
      >
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0" onClick={() => onEdit(inv)}>
            <div className="flex items-center gap-2 flex-wrap">
              {STATUS_ICONS[inv.status]}
              <span className="font-semibold text-sm truncate">{inv.invoice_no}</span>
              <span className={`badge badge-xs ${getStatusBadge(inv.status)}`}>{getStatusLabel(inv.status)}</span>
              {inv.floor_label && (
                <span className="badge badge-xs badge-outline">{inv.floor_label}楼</span>
              )}
              {inv.auto_generated === 1 && (
                <span className="badge badge-xs badge-info">自动</span>
              )}
            </div>
            <p className="text-xs text-base-content mt-1 truncate">
              {inv.property_name || '未指定物业'} · {inv.tenant_name || (inv.floor_label ? `${inv.floor_label}楼租户` : '未指定租户')}
            </p>
            {inv.rent_amount > 0 && inv.charges_amount > 0 && (
              <p className="text-xs text-base-content/60 mt-0.5">
                租金 RM{inv.rent_amount.toLocaleString()} + 附加费 RM{inv.charges_amount.toLocaleString()}
                {(() => {
                  try {
                    const adjs = JSON.parse(inv.adjustments || '[]');
                    if (Array.isArray(adjs) && adjs.length > 0) {
                      const adjTotal = adjs.reduce((s: number, a: {amount: number}) => s + a.amount, 0);
                      return <span className="text-base-content/70"> {adjTotal > 0 ? '+' : ''}{adjTotal.toLocaleString()} 调整</span>;
                    }
                  } catch {}
                  return null;
                })()}
              </p>
            )}
            {/* Show adjustments line items if present */}
            {(() => {
              try {
                const adjs = JSON.parse(inv.adjustments || '[]');
                if (Array.isArray(adjs) && adjs.length > 0) {
                  return adjs.map((adj: {name: string; amount: number}, i: number) => (
                    <p key={i} className="text-xs mt-0.5 text-base-content/70">
                      ↳ {adj.name}: {adj.amount < 0 ? '-' : '+'}RM {Math.abs(adj.amount).toLocaleString()}
                    </p>
                  ));
                }
              } catch {}
              return null;
            })()}
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-sm">RM {inv.amount.toLocaleString()}</p>
            <p className="text-xs text-base-content">到期 {inv.due_date || '-'}</p>
          </div>
        </div>



        {/* Actions */}
        <div className="flex items-center gap-1 pl-6">
          {inv.status === 'pending' && (
            <>
              <button className="btn btn-xs btn-success gap-1" onClick={() => handleMarkPaid(inv.id)}>
                <CheckCircle size={12} /> 确认收款
              </button>
              <button className="btn btn-xs btn-warning btn-outline gap-1" onClick={() => handleMarkOverdue(inv.id)}>
                <AlertTriangle size={12} /> 标记逾期
              </button>
            </>
          )}
          {inv.status === 'overdue' && (
            <button className="btn btn-xs btn-success gap-1" onClick={() => handleMarkPaid(inv.id)}>
              <CheckCircle size={12} /> 确认收款
            </button>
          )}
          {inv.status === 'paid' && inv.paid_date && (
            <span className="text-xs text-success">✓ 已于 {inv.paid_date.slice(0, 10)} 收款</span>
          )}
          <button className="btn btn-xs btn-ghost gap-1" onClick={() => printInvoice(inv)} title="打印账单">
            <Printer size={12} /> 打印
          </button>
          <button className="btn btn-xs btn-ghost text-success gap-1" onClick={() => handleSendWhatsApp(inv)} title="发送WhatsApp提醒">
            <MessageCircle size={12} /> WhatsApp
          </button>
          <button className="btn btn-xs btn-ghost text-error ml-auto" onClick={() => setDeleteConfirmId(inv.id)}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  }
};
