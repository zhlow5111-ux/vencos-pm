import React, { useState, useEffect, useMemo } from 'react';
import { X, Building2, Layers } from 'lucide-react';
import { Invoice, Property, FloorUnit, RecurringCharge, INVOICE_STATUSES } from '../types';
import { saveInvoice, getProperties, getFloorUnits, getRecurringCharges, getFloorUnitsByLeaseRef } from '../utils/db';

interface InvoiceFormProps {
  invoice?: Invoice;
  onClose: () => void;
  onSaved: () => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ invoice, onClose, onSaved }) => {
  const [properties, setProperties] = useState<Property[]>([]);

  const [floors, setFloors] = useState<FloorUnit[]>([]);
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<string>(invoice?.floor_label || '');

  // Charge toggles & adjustments
  const [chargeToggles, setChargeToggles] = useState<Record<number, boolean>>({});
  const [adjustments, setAdjustments] = useState<Array<{name: string; amount: number}>>([]);
  const [adjName, setAdjName] = useState('');
  // Linked lease state
  const [linkedFloors, setLinkedFloors] = useState<Array<{property_id: number; property_name: string; floor_label: string; tenant_name: string; rent_amount: number}>>([]);
  const [linkedLeaseRef, setLinkedLeaseRef] = useState('');
  const [adjAmount, setAdjAmount] = useState<number>(0);

  const now = new Date();
  const defaultBillingMonth = invoice?.billing_month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [form, setForm] = useState({
    property_id: invoice?.property_id || 0,
    tenant_id: invoice?.tenant_id || 0,
    due_date: invoice?.due_date || '',
    status: invoice?.status || 'pending',
    description: invoice?.description || '',
    billing_month: defaultBillingMonth,
    floor_label: invoice?.floor_label || '',
    rent_amount: invoice?.rent_amount || 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (form.property_id > 0) {
      loadPropertyDetails(form.property_id);
    } else {
      setFloors([]);
      setCharges([]);
    }
  }, [form.property_id]);

  // Check for linked leases when floor is selected
  useEffect(() => {
    if (selectedFloor && floors.length > 0) {
      const fl = floors.find(f => f.floor_label === selectedFloor);
      if (fl && fl.linked_lease_ref) {
        getFloorUnitsByLeaseRef(fl.linked_lease_ref).then(linked => {
          const others = linked.filter(lf => lf.property_id !== form.property_id);
          setLinkedFloors(others.map(lf => ({
            property_id: lf.property_id,
            property_name: (lf as any).property_name || '',
            floor_label: lf.floor_label,
            tenant_name: lf.tenant_name,
            rent_amount: lf.rent_amount || 0,
          })));
          setLinkedLeaseRef(fl.linked_lease_ref);
        }).catch(() => { setLinkedFloors([]); setLinkedLeaseRef(''); });
      } else {
        setLinkedFloors([]);
        setLinkedLeaseRef('');
      }
    } else {
      setLinkedFloors([]);
      setLinkedLeaseRef('');
    }
  }, [selectedFloor, floors, form.property_id]);

  // Initialize adjustments from existing invoice
  useEffect(() => {
    if (invoice?.adjustments) {
      try {
        const parsed = JSON.parse(invoice.adjustments);
        if (Array.isArray(parsed)) setAdjustments(parsed);
      } catch {}
    }
  }, []);

  async function loadData() {
    const props = await getProperties();
    setProperties(props);
  }

  async function loadPropertyDetails(propertyId: number) {
    const [floorData, chargeData] = await Promise.all([
      getFloorUnits(propertyId),
      getRecurringCharges(propertyId),
    ]);
    setFloors(floorData);
    setCharges(chargeData);
    // Initialize toggles to true for all charges
    const toggles: Record<number, boolean> = {};
    chargeData.forEach(c => { toggles[c.id] = true; });
    setChargeToggles(toggles);

    // Auto-select if only one occupied floor
    const occupied = floorData.filter(f => f.tenant_name && f.rent_amount > 0);
    if (occupied.length === 1) {
      const fl = occupied[0];
      setSelectedFloor(fl.floor_label);
      setForm(prev => ({...prev, floor_label: fl.floor_label, rent_amount: fl.rent_amount || 0}));
    }
  }

  function handleFloorSelect(floorLabel: string) {
    setSelectedFloor(floorLabel);
    const floor = floors.find((f) => f.floor_label === floorLabel);
    if (floor) {
      const rent = floor.rent_amount || 0;
      // Reset toggles to all enabled
      const toggles: Record<number, boolean> = {};
      charges.forEach(c => { toggles[c.id] = true; });
      setChargeToggles(toggles);

      setForm({
        ...form,
        floor_label: floorLabel,
        rent_amount: rent,
      });
    } else {
      setForm({ ...form, floor_label: '', rent_amount: 0 });
    }
  }

  function handleBillingMonthChange(val: string) {
    setForm({ ...form, billing_month: val });
    if (val) {
      setForm((prev) => ({ ...prev, billing_month: val, due_date: `${val}-01` }));
    }
  }

  // Applicable charges: matching floor or whole-building (empty floor_label)
  const applicableCharges = useMemo(() => {
    return charges.filter(c => {
      const cFl = c.floor_label || '';
      return cFl === '' || cFl === selectedFloor;
    });
  }, [charges, selectedFloor]);

  // Linked rent total
  const linkedRentTotal = useMemo(() => {
    return linkedFloors.reduce((s, lf) => s + (lf.rent_amount || 0), 0);
  }, [linkedFloors]);

  // Computed total (includes linked rent)
  const computedTotal = useMemo(() => {
    const rent = form.rent_amount || 0;
    const linked = linkedRentTotal;
    const enabledCharges = applicableCharges
      .filter(c => chargeToggles[c.id] !== false)
      .reduce((s, c) => s + c.amount, 0);
    const adjTotal = adjustments.reduce((s, a) => s + a.amount, 0);
    return Math.round(rent + linked + enabledCharges + adjTotal);
  }, [form.rent_amount, linkedRentTotal, applicableCharges, chargeToggles, adjustments]);

  const enabledChargesTotal = useMemo(() => {
    return applicableCharges
      .filter(c => chargeToggles[c.id] !== false)
      .reduce((s, c) => s + c.amount, 0);
  }, [applicableCharges, chargeToggles]);

  const adjTotal = useMemo(() => {
    return adjustments.reduce((s, a) => s + a.amount, 0);
  }, [adjustments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const prop = properties.find((p) => p.id === form.property_id);
      let desc = form.description;
      if (!desc && form.billing_month && selectedFloor) {
        desc = linkedFloors.length > 0
          ? `${form.billing_month} 租金 - ${prop?.name || ''} + ${linkedFloors.map(lf => lf.property_name).join(' + ')} (合并租约)`
          : `${form.billing_month} 租金 - ${prop?.name || ''} ${selectedFloor}楼`;
        if (enabledChargesTotal > 0) desc += ` (含附加费 RM${enabledChargesTotal})`;
        if (adjustments.length > 0) desc += ` | 调整: ${adjustments.map(a => `${a.name} ${a.amount > 0 ? '+' : ''}${a.amount}`).join(', ')}`;
      }

      // Build charges detail from enabled charges
      const chargesDetail = applicableCharges
        .filter(c => chargeToggles[c.id] !== false)
        .map(c => ({ name: c.charge_name, amount: c.amount }));

      // Build merged_data if linked lease exists
      const mergedData = linkedFloors.length > 0 ? JSON.stringify([
        { property_id: form.property_id, property_name: prop?.name || '', floor_label: selectedFloor, tenant_name: floors.find(f => f.floor_label === selectedFloor)?.tenant_name || '', rent: form.rent_amount },
        ...linkedFloors.map(lf => ({ property_id: lf.property_id, property_name: lf.property_name, floor_label: lf.floor_label, tenant_name: lf.tenant_name, rent: lf.rent_amount }))
      ]) : '';

      // For merged bills, combine floor labels
      const mergedFloorLabel = linkedFloors.length > 0
        ? `${selectedFloor}(${prop?.name || ''})` + linkedFloors.map(lf => `+${lf.floor_label}(${lf.property_name})`).join('')
        : form.floor_label;

      // Combined rent for storage
      const totalRent = (form.rent_amount || 0) + linkedRentTotal;

      await saveInvoice({
        ...(invoice?.id ? { id: invoice.id, invoice_no: invoice.invoice_no } : {}),
        property_id: form.property_id,
        tenant_id: 0,
        amount: computedTotal,
        due_date: form.due_date,
        status: form.status as any,
        description: desc,
        billing_month: form.billing_month,
        floor_label: mergedFloorLabel,
        rent_amount: totalRent,
        charges_amount: enabledChargesTotal,
        adjustments: JSON.stringify(adjustments),
        charges_detail: JSON.stringify(chargesDetail),
        merged_data: mergedData,
      });
      onSaved();
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  const occupiedFloors = floors.filter((f) => f.tenant_name && f.rent_amount > 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-base-100 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <h3 className="font-bold text-lg">{invoice ? '编辑账单' : '新建账单'}</h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Property */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">物业</span></label>
            <select
              className="select select-bordered select-sm w-full"
              value={form.property_id}
              onChange={(e) => {
                const pid = Number(e.target.value);
                setForm({ ...form, property_id: pid, floor_label: '', rent_amount: 0 });
                setSelectedFloor('');
                setChargeToggles({});
                setAdjustments([]);
                setLinkedFloors([]);
                setLinkedLeaseRef('');
              }}
              required
            >
              <option value={0} disabled>选择物业</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Floor Selection */}
          {form.property_id > 0 && occupiedFloors.length > 0 && (
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs flex items-center gap-1">
                  <Layers size={12} /> 选择楼层 / 租户
                </span>
                {occupiedFloors.length > 1 && !selectedFloor && (
                  <span className="label-text-alt text-xs text-warning animate-pulse">👆 请选择</span>
                )}
              </label>
              <div className="space-y-2">
                {occupiedFloors.map((f) => (
                  <div
                    key={f.floor_label}
                    className={`rounded-lg border-2 p-3 cursor-pointer transition-all ${
                      selectedFloor === f.floor_label
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-base-300 hover:border-primary/50 hover:bg-base-200'
                    }`}
                    onClick={() => handleFloorSelect(f.floor_label)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        selectedFloor === f.floor_label ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content'
                      }`}>
                        {f.floor_label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.tenant_name}</p>
                        <p className="text-xs text-base-content/60">租金 RM {(f.rent_amount || 0).toLocaleString()}</p>
                      </div>
                      {selectedFloor === f.floor_label && (
                        <span className="badge badge-primary badge-sm">已选</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Breakdown card */}
              {selectedFloor && (
                <div className="bg-base-200 rounded-lg p-2 mt-2 text-xs space-y-1">
                  {/* Rent */}
                  <div className="flex justify-between">
                    <span>🏠 租金</span>
                    <span className="font-medium">RM {form.rent_amount.toLocaleString()}</span>
                  </div>

                  {/* Charges with checkboxes */}
                  {applicableCharges.length > 0 && applicableCharges.map(c => {
                    const enabled = chargeToggles[c.id] !== false;
                    return (
                      <label key={c.id} className={`flex items-center justify-between text-xs rounded px-2 py-1.5 cursor-pointer hover:bg-base-200/30 ${!enabled ? 'opacity-40 line-through' : ''}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" className="checkbox checkbox-xs checkbox-primary"
                            checked={enabled}
                            onChange={() => setChargeToggles(prev => ({...prev, [c.id]: !enabled}))}
                          />
                          <span>{c.charge_name}</span>
                          {!c.floor_label && <span className="badge badge-ghost badge-xs">整栋</span>}
                        </div>
                        <span>RM {c.amount.toLocaleString()}</span>
                      </label>
                    );
                  })}

                  {/* Custom Adjustments */}
                  <div className="mt-2 pt-2 border-t border-base-300">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">📝 调整项目</span>
                    </div>
                    {adjustments.length === 0 && (
                      <div className="text-xs text-base-content/40 px-2 py-1">(暂无调整)</div>
                    )}
                    {adjustments.map((adj, i) => (
                      <div key={i} className={`flex items-center justify-between text-xs px-2 py-1 ${adj.amount < 0 ? 'text-success' : 'text-warning'}`}>
                        <span>{adj.name}</span>
                        <div className="flex items-center gap-1">
                          <span>{adj.amount < 0 ? '-' : '+'}RM {Math.abs(adj.amount).toLocaleString()}</span>
                          <button type="button" className="btn btn-ghost btn-xs px-0.5 text-error/60 hover:text-error" onClick={() => setAdjustments(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                        </div>
                      </div>
                    ))}
                    {/* Add adjustment inline form */}
                    <div className="flex gap-1 mt-1">
                      <input className="input input-bordered input-xs flex-1" placeholder="项目名称" value={adjName} onChange={e => setAdjName(e.target.value)} />
                      <input type="number" className="input input-bordered input-xs w-24" placeholder="金额" value={adjAmount || ''}
                        onChange={e => setAdjAmount(Number(e.target.value))}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && adjName && adjAmount !== 0) {
                            e.preventDefault();
                            setAdjustments(prev => [...prev, {name: adjName, amount: adjAmount}]);
                            setAdjName(''); setAdjAmount(0);
                          }
                        }}
                      />
                      <button type="button" className="btn btn-sm btn-primary" disabled={!adjName || adjAmount === 0} onClick={() => {
                        setAdjustments(prev => [...prev, {name: adjName, amount: adjAmount}]);
                        setAdjName(''); setAdjAmount(0);
                      }}>+</button>
                    </div>
                    <p className="text-[10px] text-base-content/50 mt-0.5">正数=额外收费，负数=扣减（如上月多付退款输入 -100）</p>
                  </div>

                  {/* Divider & Total */}
                  <div className="divider my-0.5" />
                  <div className="flex justify-between font-bold">
                    <span>合计</span>
                    <span>RM {computedTotal.toLocaleString()}</span>
                  </div>
                  {adjTotal !== 0 && (
                    <div className="text-[10px] text-base-content/50 text-right">
                      (租金 {form.rent_amount.toLocaleString()} + 附加费 {enabledChargesTotal.toLocaleString()}{adjTotal !== 0 ? ` ${adjTotal > 0 ? '+' : ''}${adjTotal.toLocaleString()} 调整` : ''})
                    </div>
                  )}

                  {/* Linked lease info */}
                  {linkedFloors.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-info/30">
                      <div className="flex items-center gap-1 text-xs font-bold text-info mb-1">
                        <span>🔗</span>
                        <span>合并租约</span>
                        <span className="badge badge-info badge-xs">{linkedLeaseRef}</span>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-xs text-base-content/70">
                          <span>📍 {properties.find(p => p.id === form.property_id)?.name || ''} {selectedFloor}楼</span>
                          <span>RM {(form.rent_amount || 0).toLocaleString()}</span>
                        </div>
                        {linkedFloors.map((lf, i) => (
                          <div key={i} className="flex justify-between text-xs text-base-content/70">
                            <span>📍 {lf.property_name} {lf.floor_label}楼</span>
                            <span>RM {lf.rent_amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-xs font-bold mt-1 pt-1 border-t border-info/20 text-info">
                        <span>🔗 合并总租金</span>
                        <span>RM {((form.rent_amount || 0) + linkedRentTotal).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Billing Month */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">账单月份</span></label>
            <input
              type="month"
              className="input input-bordered input-sm w-full"
              value={form.billing_month}
              onChange={(e) => handleBillingMonthChange(e.target.value)}
            />
          </div>

          {/* Tenant auto-display from floor data */}
          {selectedFloor && (() => {
            const fl = floors.find(f => f.floor_label === selectedFloor);
            return fl?.tenant_name ? (
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">租户</span></label>
                <div className="bg-base-200 rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2">
                  <Building2 size={14} className="text-primary" />
                  <span>{fl.tenant_name}</span>
                  <span className="badge badge-primary badge-xs ml-auto">{selectedFloor}楼</span>
                </div>
              </div>
            ) : null;
          })()}

          {/* Amount (computed, readonly when floor selected) & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">金额 (RM)</span></label>
              <input
                type="number"
                className="input input-bordered input-sm w-full"
                value={selectedFloor ? computedTotal : (computedTotal || '')}
                onChange={(e) => {
                  // Only allow manual edit if no floor selected
                  if (!selectedFloor) {
                    setForm({ ...form, rent_amount: Number(e.target.value) });
                  }
                }}
                readOnly={!!selectedFloor}
                required
                min={0}
                step={0.01}
              />
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">到期日</span></label>
              <div className="relative">
                <input
                  type="date"
                  className="input input-bordered input-sm w-full pr-7"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  required
                />
                {form.due_date && <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs px-1 text-base-content/40 hover:text-error" onClick={() => setForm({ ...form, due_date: '' })}>✕</button>}
              </div>
            </div>
          </div>

          {/* Status (edit only) */}
          {invoice && (
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">状态</span></label>
              <select
                className="select select-bordered select-sm w-full"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {INVOICE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">备注</span></label>
            <textarea
              className="textarea textarea-bordered textarea-sm w-full"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="如：5月份租金"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-sm w-full mt-2" disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : (invoice ? '保存' : '创建账单')}
          </button>
        </form>
      </div>
    </div>
  );
};
