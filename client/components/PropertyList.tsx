import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit, Trash2, Landmark, UserCheck, Save, AlertTriangle, Building2, CalendarDays, Phone, X, CheckSquare, DollarSign, Construction, LogOut, Download } from 'lucide-react';
import { Property, FloorUnit, RenovationExpense, PROPERTY_TYPES, PROPERTY_STATUSES, RENOVATION_CATEGORIES, RecurringCharge, COMMON_CHARGES } from '../types';
import { getProperties, deleteProperty, getAllFloorUnits, saveFloorUnit, getFloorUnits, getRenovationExpenses, saveRenovationExpense, deleteRenovationExpense, getTotalPurchaseCosts, archiveTenantToHistory, getRecurringCharges, saveRecurringCharge, deleteRecurringCharge } from '../utils/db';
import { formatCurrency, calculateEstimatedBalance } from '../utils/helpers';
import { downloadCsv } from '../utils/export';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  onAdd: () => void;
  onEdit: (p: Property) => void;
  refreshKey: number;
  userId?: number; // stakeholder filter
}

// Tenant form data
interface TenantFormData {
  propertyId: number;
  selectedFloorIds: number[];
  editingTenantName?: string; // track original tenant name for edit mode (to clear unchecked floors)
  tenant_name: string;
  tenant_phone: string;
  tenant_company_reg: string;
  tenant_address: string;
  director_name: string;
  director_ic: string;
  director_phone: string;
  director_notes: string;
  tenant_bank_name: string;
  tenant_bank_account: string;
  agent_name: string;
  agent_phone: string;
  agent_company: string;
  rent_amount: number;
  deposit: number;
  utility_deposit: number;
  lease_start: string;
  lease_end: string;
  notes: string;
}

export const PropertyList: React.FC<Props> = ({ onAdd, onEdit, refreshKey, userId }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [floorUnits, setFloorUnits] = useState<FloorUnit[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [tenantForm, setTenantForm] = useState<TenantFormData | null>(null);
  const [savingTenant, setSavingTenant] = useState(false);
  const [showAltAddr, setShowAltAddr] = useState(false);

  // Recurring charges in tenant form
  const [tenantRcList, setTenantRcList] = useState<RecurringCharge[]>([]);
  const [tenantRcForm, setTenantRcForm] = useState<{charge_name: string; custom_name: string; amount: number; frequency: string; notes: string} | null>(null);
  const [savingRc, setSavingRc] = useState(false);

  // Renovation expenses state
  const [renoExpenses, setRenoExpenses] = useState<Record<number, RenovationExpense[]>>({});
  const [renoExpandedIds, setRenoExpandedIds] = useState<Set<number>>(new Set());
  const [renoForm, setRenoForm] = useState<{ propertyId: number; floor_label: string; description: string; amount: number; expense_date: string; category: string; contractor: string; notes: string } | null>(null);
  const [savingReno, setSavingReno] = useState(false);
  const [deleteRenoId, setDeleteRenoId] = useState<number | null>(null);

  // Vacate (退租) state
  const [vacateTarget, setVacateTarget] = useState<{ propertyId: number; tenantName: string; floors: FloorUnit[] } | null>(null);
  const [vacateDate, setVacateDate] = useState('');
  const [vacateReason, setVacateReason] = useState('contract_expired');
  const [vacateNotes, setVacateNotes] = useState('');
  const [vacateArrears, setVacateArrears] = useState('');

  // Purchase costs totals per property
  const [purchaseCostTotals, setPurchaseCostTotals] = useState<Record<number, number>>({});

  useEffect(() => {
    setLoading(true);
    Promise.all([getProperties(userId), getAllFloorUnits()])
      .then(([props, floors]) => {
        setProperties(props);
        setFloorUnits(floors);
      })
      .finally(() => setLoading(false));
  }, [refreshKey, userId]);

  async function handleVacateConfirm() {
    if (!vacateTarget || !vacateDate) return;
    const { propertyId, floors } = vacateTarget;
    const extra = {
      vacate_date: vacateDate,
      vacate_reason: vacateReason,
      vacate_notes: vacateNotes,
      arrears_amount: parseFloat(vacateArrears) || 0,
    };
    setVacateTarget(null);
    setVacateDate('');
    setVacateReason('contract_expired');
    setVacateNotes('');
    setVacateArrears('');
    for (const floor of floors) {
      await archiveTenantToHistory(floor, 'vacated', extra);
      await saveFloorUnit({
        ...floor,
        tenant_name: '', tenant_phone: '', tenant_company_reg: '', tenant_address: '',
        director_name: '', director_ic: '', director_phone: '', director_notes: '',
        tenant_bank_name: '', tenant_bank_account: '',
        agent_name: '', agent_phone: '', agent_company: '',
        rent_amount: 0, deposit: 0, utility_deposit: 0,
        lease_start: '', lease_end: '',
      });
    }
    const updatedFloors = await getAllFloorUnits();
    setFloorUnits(updatedFloors);
  }

  async function handleDeleteConfirm() {
    if (deleteConfirmId === null) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    await deleteProperty(id);
    setProperties((prev) => prev.filter((p) => p.id !== id && p.parent_id !== id));
    setFloorUnits((prev) => prev.filter((f) => f.property_id !== id));
  }

  // Open form for NEW tenant (pre-select all vacant floors)
  function openNewTenantForm(propertyId: number) {
    const floors = floorUnits.filter((f) => f.property_id === propertyId);
    const vacantFloorIds = floors.filter((f) => !f.tenant_name).map((f) => f.id);
    setTenantForm({
      propertyId,
      selectedFloorIds: vacantFloorIds.length > 0 ? vacantFloorIds : floors.map((f) => f.id),
      tenant_name: '',
      tenant_phone: '',
      tenant_company_reg: '',
      tenant_address: '',
      director_name: '',
      director_ic: '',
      director_phone: '',
      director_notes: '',
      tenant_bank_name: '',
      tenant_bank_account: '',
      agent_name: '',
      agent_phone: '',
      agent_company: '',
      rent_amount: 0,
      deposit: 0,
      utility_deposit: 0,
      lease_start: '',
      lease_end: '',
      notes: '',
    });
    setShowAltAddr(false);
    setTenantRcList([]);
    setTenantRcForm(null);
  }

  // Open form for EDITING existing tenant (pre-fill + pre-select their floors)
  function openEditTenantForm(propertyId: number, tenantName: string) {
    const floors = floorUnits.filter((f) => f.property_id === propertyId);
    const tenantFloors = floors.filter((f) => f.tenant_name === tenantName);
    if (tenantFloors.length === 0) return;
    const first = tenantFloors[0];
    const totalRent = tenantFloors.reduce((s, f) => s + (f.rent_amount || 0), 0);
    const totalDeposit = tenantFloors.reduce((s, f) => s + (f.deposit || 0), 0);
    const totalUtility = tenantFloors.reduce((s, f) => s + (f.utility_deposit || 0), 0);
    setTenantForm({
      propertyId,
      selectedFloorIds: tenantFloors.map((f) => f.id),
      editingTenantName: tenantName,
      tenant_name: first.tenant_name,
      tenant_phone: first.tenant_phone,
      tenant_company_reg: first.tenant_company_reg || '',
      tenant_address: first.tenant_address || '',
      director_name: first.director_name || '',
      director_ic: first.director_ic || '',
      director_phone: first.director_phone || '',
      director_notes: first.director_notes || '',
      tenant_bank_name: first.tenant_bank_name || '',
      tenant_bank_account: first.tenant_bank_account || '',
      agent_name: first.agent_name || '',
      agent_phone: first.agent_phone || '',
      agent_company: first.agent_company || '',
      rent_amount: totalRent,
      deposit: totalDeposit,
      utility_deposit: totalUtility,
      lease_start: first.lease_start,
      lease_end: first.lease_end,
      notes: first.notes,
    });
    setShowAltAddr(!!(first.tenant_address));
    getRecurringCharges(propertyId).then(charges => {
      const floorLabels = tenantFloors.map(f => f.floor_label);
      setTenantRcList(charges.filter(c => floorLabels.includes(c.floor_label) || c.floor_label === ''));
    });
  }

  // Toggle floor selection
  function toggleFloor(floorId: number) {
    if (!tenantForm) return;
    setTenantForm((prev) => {
      if (!prev) return prev;
      const ids = prev.selectedFloorIds.includes(floorId)
        ? prev.selectedFloorIds.filter((id) => id !== floorId)
        : [...prev.selectedFloorIds, floorId];
      return { ...prev, selectedFloorIds: ids };
    });
  }

  // Select / deselect all floors
  function toggleAllFloors() {
    if (!tenantForm) return;
    const floors = floorUnits.filter((f) => f.property_id === tenantForm.propertyId);
    const allSelected = floors.every((f) => tenantForm.selectedFloorIds.includes(f.id));
    setTenantForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        selectedFloorIds: allSelected ? [] : floors.map((f) => f.id),
      };
    });
  }

  // Save tenant info to all selected floors
  // Total rent/deposit stored on FIRST floor only, rest get 0 — no division, exact amounts preserved
  async function handleSaveTenant() {
    if (!tenantForm || tenantForm.selectedFloorIds.length === 0) return;
    setSavingTenant(true);
    try {
      const floors = floorUnits.filter((f) => f.property_id === tenantForm.propertyId);
      const selectedFloors = floors.filter((f) => tenantForm.selectedFloorIds.includes(f.id));

      // Archive existing tenants that will be replaced
      for (let i = 0; i < selectedFloors.length; i++) {
        const floor = selectedFloors[i];
        // If floor had a different tenant, archive them as 'replaced'
        if (floor.tenant_name && floor.tenant_name !== tenantForm.tenant_name) {
          await archiveTenantToHistory(floor, 'replaced');
        }
      }

      // Save selected floors with tenant data
      for (let i = 0; i < selectedFloors.length; i++) {
        const floor = selectedFloors[i];
        const isFirst = i === 0;
        await saveFloorUnit({
          id: floor.id,
          property_id: floor.property_id,
          floor_label: floor.floor_label,
          tenant_name: tenantForm.tenant_name,
          tenant_phone: tenantForm.tenant_phone,
          tenant_company_reg: tenantForm.tenant_company_reg,
          tenant_address: tenantForm.tenant_address,
          director_name: tenantForm.director_name,
          director_ic: tenantForm.director_ic,
          director_phone: tenantForm.director_phone,
          director_notes: tenantForm.director_notes,
          tenant_bank_name: tenantForm.tenant_bank_name,
          tenant_bank_account: tenantForm.tenant_bank_account,
          agent_name: tenantForm.agent_name,
          agent_phone: tenantForm.agent_phone,
          agent_company: tenantForm.agent_company,
          rent_amount: isFirst ? tenantForm.rent_amount : 0,
          deposit: isFirst ? tenantForm.deposit : 0,
          utility_deposit: isFirst ? tenantForm.utility_deposit : 0,
          lease_start: tenantForm.lease_start,
          lease_end: tenantForm.lease_end,
          notes: tenantForm.notes,
        });
      }

      // Clear unchecked floors that previously belonged to this tenant
      if (tenantForm.editingTenantName) {
        const previousFloors = floors.filter(
          (f) => f.tenant_name === tenantForm.editingTenantName && !tenantForm.selectedFloorIds.includes(f.id)
        );
        for (const floor of previousFloors) {
          // Archive before clearing
          await archiveTenantToHistory(floor, 'vacated');
          await saveFloorUnit({
            id: floor.id,
            property_id: floor.property_id,
            floor_label: floor.floor_label,
            tenant_name: '',
            tenant_phone: '',
            tenant_company_reg: '',
            tenant_address: '',
            director_name: '',
            director_ic: '',
            director_phone: '',
            director_notes: '',
            tenant_bank_name: '',
            tenant_bank_account: '',
            agent_name: '',
            agent_phone: '',
            agent_company: '',
            rent_amount: 0,
            deposit: 0,
            utility_deposit: 0,
            lease_start: '',
            lease_end: '',
            notes: '',
          });
        }
      }

      // Refresh
      const updatedFloors = await getAllFloorUnits();
      setFloorUnits(updatedFloors);
      setTenantForm(null);
    } catch (e) {
      console.error('Save tenant failed:', e);
    } finally {
      setSavingTenant(false);
    }
  }

  // Clear tenant from a specific floor
  async function clearFloorTenant(floor: FloorUnit) {
    // Archive tenant before clearing
    await archiveTenantToHistory(floor, 'vacated');
    await saveFloorUnit({
      id: floor.id,
      property_id: floor.property_id,
      floor_label: floor.floor_label,
      tenant_name: '',
      tenant_phone: '',
      rent_amount: 0,
      deposit: 0,
      utility_deposit: 0,
      lease_start: '',
      lease_end: '',
      notes: '',
    });
    const updatedFloors = await getAllFloorUnits();
    setFloorUnits(updatedFloors);
  }

  // ========== Recurring Charge Helpers (in Tenant Form) ==========
  async function handleSaveRcInTenant() {
    if (!tenantForm || !tenantRcForm) return;
    setSavingRc(true);
    try {
      const name = tenantRcForm.charge_name === 'Other 其他' ? tenantRcForm.custom_name : tenantRcForm.charge_name;
      // Save to first selected floor
      const floors = floorUnits.filter(f => tenantForm.selectedFloorIds.includes(f.id));
      const floorLabel = floors.length > 0 ? floors[0].floor_label : '';
      await saveRecurringCharge({
        property_id: tenantForm.propertyId,
        charge_name: name,
        amount: Math.round(tenantRcForm.amount * 100) / 100,
        frequency: tenantRcForm.frequency as any,
        floor_label: floorLabel,
        notes: tenantRcForm.notes,
      });
      // Reload
      const charges = await getRecurringCharges(tenantForm.propertyId);
      const floorLabels = floors.map(f => f.floor_label);
      setTenantRcList(charges.filter(c => floorLabels.includes(c.floor_label) || c.floor_label === ''));
      setTenantRcForm(null);
    } catch (e) {
      console.error('Save RC failed:', e);
    } finally {
      setSavingRc(false);
    }
  }

  async function handleDeleteRcInTenant(id: number) {
    try {
      await deleteRecurringCharge(id);
      setTenantRcList(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error('Delete RC failed:', e);
    }
  }

  // ========== Renovation Expense Helpers ==========
  async function toggleRenoExpanded(propertyId: number) {
    const newSet = new Set(renoExpandedIds);
    if (newSet.has(propertyId)) {
      newSet.delete(propertyId);
    } else {
      newSet.add(propertyId);
      // Load expenses if not cached
      if (!renoExpenses[propertyId]) {
        const expenses = await getRenovationExpenses(propertyId);
        setRenoExpenses(prev => ({ ...prev, [propertyId]: expenses }));
      }
    }
    setRenoExpandedIds(newSet);
  }

  function openRenoForm(propertyId: number) {
    setRenoForm({ propertyId, floor_label: '', description: '', amount: 0, expense_date: new Date().toISOString().slice(0, 10), category: 'renovation', contractor: '', notes: '' });
  }

  async function handleSaveReno() {
    if (!renoForm || !renoForm.description.trim()) return;
    setSavingReno(true);
    try {
      await saveRenovationExpense({
        property_id: renoForm.propertyId,
        floor_label: renoForm.floor_label,
        description: renoForm.description.trim(),
        amount: renoForm.amount,
        expense_date: renoForm.expense_date,
        category: renoForm.category,
        contractor: renoForm.contractor,
        notes: renoForm.notes,
      });
      const expenses = await getRenovationExpenses(renoForm.propertyId);
      setRenoExpenses(prev => ({ ...prev, [renoForm.propertyId]: expenses }));
      setRenoForm(null);
    } catch (e) {
      console.error('Save renovation expense failed:', e);
    } finally {
      setSavingReno(false);
    }
  }

  async function handleDeleteRenoConfirm() {
    if (deleteRenoId === null) return;
    const id = deleteRenoId;
    setDeleteRenoId(null);
    await deleteRenovationExpense(id);
    // Refresh all expanded
    const newExpenses = { ...renoExpenses };
    for (const pid of renoExpandedIds) {
      newExpenses[pid] = await getRenovationExpenses(pid);
    }
    setRenoExpenses(newExpenses);
  }

  function getRenoTotal(propertyId: number): number {
    return (renoExpenses[propertyId] || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  }

  function getRepaymentDay(p: Property): number | null {
    if (p.loan_repayment_day && p.loan_repayment_day > 0) return p.loan_repayment_day;
    if (!p.loan_start) return null;
    return new Date(p.loan_start).getDate();
  }

  function getNextNextAssessmentDue(dueDate: string): string | null {
    if (!dueDate) return null;
    const d = new Date(dueDate);
    const nextNext = new Date(d);
    nextNext.setMonth(nextNext.getMonth() + 6);
    if (nextNext.getDate() !== d.getDate()) {
      nextNext.setDate(0);
    }
    return `${nextNext.getFullYear()}-${String(nextNext.getMonth()+1).padStart(2,'0')}-${String(nextNext.getDate()).padStart(2,'0')}`;
  }

  function getPropertyFloors(propertyId: number): FloorUnit[] {
    return floorUnits.filter((f) => f.property_id === propertyId);
  }

  function getTotalRent(propertyId: number): number {
    const floorTotal = getPropertyFloors(propertyId).reduce((sum, f) => sum + (f.rent_amount || 0), 0);
    if (floorTotal > 0) return floorTotal;
    // Fallback: use property-level rental_price for rented properties without floor-level rent data
    const prop = properties.find(p => p.id === propertyId);
    if (prop && prop.status === 'rented' && prop.rental_price > 0) return prop.rental_price;
    return 0;
  }

  function getTotalDeposit(propertyId: number): number {
    return getPropertyFloors(propertyId).reduce((sum, f) => sum + (f.deposit || 0), 0);
  }

  // Lease expiry helpers
  function daysUntilExpiry(dateStr: string): number | null {
    if (!dateStr) return null;
    const end = new Date(dateStr);
    const now = new Date();
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  function leaseExpiryBadge(dateStr: string) {
    const days = daysUntilExpiry(dateStr);
    if (days === null) return null;
    if (days < 0) return <span className="badge badge-sm badge-error gap-1"><AlertTriangle size={10} />已过期</span>;
    if (days <= 30) return <span className="badge badge-sm badge-warning gap-1"><AlertTriangle size={10} />{days}天到期</span>;
    if (days <= 90) return <span className="badge badge-sm badge-info">{days}天到期</span>;
    return <span className="badge badge-sm badge-ghost">{days}天</span>;
  }

  function fmtDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  const filtered = properties.filter((p) => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase()) ||
      (p.owner_name || '').toLowerCase().includes(search.toLowerCase()) ||
      getPropertyFloors(p.id).some((f) => f.tenant_name.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchOwner = ownerFilter === 'all' || (p.owner_name || '') === ownerFilter;
    return matchSearch && matchStatus && matchOwner;
  });

  const statusBadge = (status: string) => {
    const s = PROPERTY_STATUSES.find((st) => st.value === status);
    const colors: Record<string, string> = {
      available: 'badge-success', rented: 'badge-info', sold: 'badge-secondary', pending: 'badge-warning',
    };
    return <span className={`badge badge-sm ${colors[status] || 'badge-ghost'}`}>{s?.label || status}</span>;
  };

  const typeBadge = (type: string) => {
    const t = PROPERTY_TYPES.find((pt) => pt.value === type);
    return <span className="badge badge-sm badge-outline">{t?.label || type}</span>;
  };

  // ========== TENANT FORM (MODAL) ==========
  function renderTenantForm() {
    if (!tenantForm) return null;
    const floors = floorUnits.filter((f) => f.property_id === tenantForm.propertyId);
    const property = properties.find((p) => p.id === tenantForm.propertyId);
    const allSelected = floors.length > 0 && floors.every((f) => tenantForm.selectedFloorIds.includes(f.id));

    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setTenantForm(null)}>
        <div
          className="bg-base-100 w-full max-w-md rounded-2xl overflow-y-auto"
          style={{ maxHeight: '80vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with save button */}
          <div className="px-4 pt-4 pb-2 border-b border-base-300 bg-base-100" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">
                🏠 {tenantForm.tenant_name ? '编辑租户资料' : '填写租户资料'}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  className="btn btn-primary btn-sm gap-1"
                  disabled={savingTenant || !tenantForm.tenant_name || tenantForm.selectedFloorIds.length === 0}
                  onClick={handleSaveTenant}
                >
                  {savingTenant ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
                  保存
                </button>
                <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setTenantForm(null)}>
                  <X size={16} />
                </button>
              </div>
            </div>
            {property && <p className="text-xs text-base-content mt-0.5">{property.name}</p>}
          </div>

          {/* Form body */}
          <div className="p-4 space-y-4">
            {/* Floor checkboxes */}
            {floors.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-base-content mb-2 block">选择楼层</label>
                <div className="space-y-1.5">
                  {/* Select all */}
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-base-100 cursor-pointer hover:bg-base-200">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-primary"
                      checked={allSelected}
                      onChange={toggleAllFloors}
                    />
                    <span className="text-sm font-semibold">全选 · 全栋出租</span>
                  </label>
                  <div className="divider my-0 h-0" />
                  {floors.slice().reverse().map((f) => {
                    const isSelected = tenantForm.selectedFloorIds.includes(f.id);
                    const isSameTenant = f.tenant_name === tenantForm.tenant_name || f.tenant_name === tenantForm.editingTenantName;
                    const hasOtherTenant = f.tenant_name && !isSameTenant;
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                          isSelected ? 'bg-primary/10 border border-primary/30' : 'bg-base-100 border border-base-300 hover:border-primary/30'
                        } ${hasOtherTenant ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
                          checked={isSelected}
                          onChange={() => toggleFloor(f.id)}
                          disabled={!!hasOtherTenant}
                        />
                        <span className="font-mono text-xs font-bold">{f.floor_label}</span>
                        {hasOtherTenant ? (
                          <span className="text-xs text-base-content ml-auto">已租给 {f.tenant_name}</span>
                        ) : f.tenant_name ? (
                          <span className="text-xs text-success ml-auto">当前租户</span>
                        ) : (
                          <span className="text-xs text-base-content ml-auto">空置</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Single floor notice */}
            {floors.length === 1 && (
              <div className="bg-base-200 rounded-lg p-2 text-xs text-base-content text-center">
                单层物业 · {floors[0].floor_label}
              </div>
            )}

            {/* Tenant info */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-base-content mb-1 block">租户姓名 / 公司名 *</label>
                <input
                  className="input input-bordered input-sm w-full"
                  placeholder="填写租户名称"
                  value={tenantForm.tenant_name}
                  onChange={(e) => setTenantForm({ ...tenantForm, tenant_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-base-content mb-1 block">联络电话</label>
                <input
                  className="input input-bordered input-sm w-full"
                  placeholder="012-3456789"
                  value={tenantForm.tenant_phone}
                  onChange={(e) => setTenantForm({ ...tenantForm, tenant_phone: e.target.value })}
                />
              </div>

              {/* Company & Director info */}
              <div className="bg-base-100 rounded-xl p-3 border border-base-300 space-y-3">
                <p className="text-xs font-semibold text-base-content flex items-center gap-1"><Building2 size={12} /> 公司资料 (如有)</p>
                <div>
                  <label className="text-xs text-base-content mb-0.5 block">公司注册号码 (SSM)</label>
                  <input
                    className="input input-bordered input-sm w-full"
                    placeholder="例: 201901012345 (1234567-T)"
                    value={tenantForm.tenant_company_reg}
                    onChange={(e) => setTenantForm({ ...tenantForm, tenant_company_reg: e.target.value })}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs checkbox-primary"
                      checked={showAltAddr}
                      onChange={(e) => {
                        setShowAltAddr(e.target.checked);
                        if (!e.target.checked) setTenantForm({ ...tenantForm, tenant_address: '' });
                      }}
                    />
                    <span className="text-xs text-base-content">有其他地址（注册/通信地址）</span>
                  </label>
                  {showAltAddr && (
                    <textarea
                      className="textarea textarea-bordered textarea-sm w-full mt-1"
                      rows={2}
                      placeholder="通信地址 / 注册地址"
                      value={tenantForm.tenant_address}
                      onChange={(e) => setTenantForm({ ...tenantForm, tenant_address: e.target.value })}
                    />
                  )}
                </div>
                <div className="border-t border-base-300 pt-2 mt-2 space-y-2">
                  <p className="text-xs font-semibold text-base-content">董事/负责人资料</p>
                  <div>
                    <label className="text-xs text-base-content mb-0.5 block">姓名</label>
                    <input
                      className="input input-bordered input-sm w-full"
                      placeholder="董事/负责人全名"
                      value={tenantForm.director_name}
                      onChange={(e) => setTenantForm({ ...tenantForm, director_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-base-content mb-0.5 block">IC / 护照号码</label>
                      <input
                        className="input input-bordered input-sm w-full"
                        placeholder="身份证号码"
                        value={tenantForm.director_ic}
                        onChange={(e) => setTenantForm({ ...tenantForm, director_ic: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-base-content mb-0.5 block">联络电话</label>
                      <input
                        className="input input-bordered input-sm w-full"
                        placeholder="012-3456789"
                        value={tenantForm.director_phone}
                        onChange={(e) => setTenantForm({ ...tenantForm, director_phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-base-content mb-0.5 block">备注</label>
                    <textarea
                      className="textarea textarea-bordered textarea-sm w-full"
                      rows={2}
                      placeholder="董事/负责人相关备注"
                      value={tenantForm.director_notes}
                      onChange={(e) => setTenantForm({ ...tenantForm, director_notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="border-t border-base-300 pt-2 mt-2 space-y-2">
                  <p className="text-xs font-semibold text-base-content">🏦 银行资料</p>
                  <div>
                    <label className="text-xs text-base-content mb-0.5 block">银行名称</label>
                    <input
                      className="input input-bordered input-sm w-full"
                      placeholder="如: Maybank, CIMB, Public Bank"
                      value={tenantForm.tenant_bank_name}
                      onChange={(e) => setTenantForm({ ...tenantForm, tenant_bank_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-base-content mb-0.5 block">银行账户号码</label>
                    <input
                      className="input input-bordered input-sm w-full"
                      placeholder="银行账户号码"
                      value={tenantForm.tenant_bank_account}
                      onChange={(e) => setTenantForm({ ...tenantForm, tenant_bank_account: e.target.value })}
                    />
                  </div>
                </div>
                <div className="border-t border-base-300 pt-2 mt-2 space-y-2">
                  <p className="text-xs font-semibold text-base-content">🤝 介绍中介 Property Agent</p>
                  <div>
                    <label className="text-xs text-base-content mb-0.5 block">中介姓名</label>
                    <input
                      className="input input-bordered input-sm w-full"
                      placeholder="中介姓名"
                      value={tenantForm.agent_name}
                      onChange={(e) => setTenantForm({ ...tenantForm, agent_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-base-content mb-0.5 block">联络电话</label>
                      <input
                        className="input input-bordered input-sm w-full"
                        placeholder="012-3456789"
                        value={tenantForm.agent_phone}
                        onChange={(e) => setTenantForm({ ...tenantForm, agent_phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-base-content mb-0.5 block">中介公司</label>
                      <input
                        className="input input-bordered input-sm w-full"
                        placeholder="公司名称"
                        value={tenantForm.agent_company}
                        onChange={(e) => setTenantForm({ ...tenantForm, agent_company: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial info */}
              <div className="bg-base-100 rounded-xl p-3 border border-base-300 space-y-3">
                <p className="text-xs font-semibold text-base-content flex items-center gap-1"><DollarSign size={12} /> 财务信息</p>
                <div>
                  <label className="text-xs text-base-content mb-0.5 block">
                    月租金 (RM){tenantForm.selectedFloorIds.length > 1 ? ' · 总计' : ''}
                  </label>
                  <input
                    type="number"
                    className="input input-bordered input-sm w-full"
                    placeholder="0"
                    value={tenantForm.rent_amount || ''}
                    onChange={(e) => setTenantForm({ ...tenantForm, rent_amount: Number(e.target.value) })}
                  />
                  {tenantForm.selectedFloorIds.length > 1 && tenantForm.rent_amount > 0 && (
                    <p className="text-[10px] text-base-content mt-0.5">
                      总额 · {tenantForm.selectedFloorIds.length} 层
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-base-content mb-0.5 block">押金 (RM)</label>
                    <input
                      type="number"
                      className="input input-bordered input-sm w-full"
                      placeholder="0"
                      value={tenantForm.deposit || ''}
                      onChange={(e) => setTenantForm({ ...tenantForm, deposit: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-base-content mb-0.5 block">水电押金 (RM)</label>
                    <input
                      type="number"
                      className="input input-bordered input-sm w-full"
                      placeholder="0"
                      value={tenantForm.utility_deposit || ''}
                      onChange={(e) => setTenantForm({ ...tenantForm, utility_deposit: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              {/* Lease period */}
              <div className="bg-primary/5 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-primary flex items-center gap-1"><CalendarDays size={12} /> 租约期限</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-base-content mb-0.5 block">开始日期</label>
                    <div className="relative">
                      <input
                        type="date"
                        className="input input-bordered input-sm w-full pr-7"
                        value={tenantForm.lease_start}
                        onChange={(e) => setTenantForm({ ...tenantForm, lease_start: e.target.value })}
                      />
                      {tenantForm.lease_start && <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs px-1 text-base-content/40 hover:text-error" onClick={() => setTenantForm({ ...tenantForm, lease_start: '' })}>✕</button>}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-base-content mb-0.5 block">结束日期</label>
                    <div className="relative">
                      <input
                        type="date"
                        className="input input-bordered input-sm w-full pr-7"
                        value={tenantForm.lease_end}
                        onChange={(e) => setTenantForm({ ...tenantForm, lease_end: e.target.value })}
                      />
                      {tenantForm.lease_end && <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs px-1 text-base-content/40 hover:text-error" onClick={() => setTenantForm({ ...tenantForm, lease_end: '' })}>✕</button>}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-base-content mb-0.5 block">备注</label>
                <input
                  className="input input-bordered input-sm w-full"
                  placeholder="选填"
                  value={tenantForm.notes}
                  onChange={(e) => setTenantForm({ ...tenantForm, notes: e.target.value })}
                />
              </div>

              {/* Recurring Charges per tenant */}
              {tenantForm.propertyId > 0 && (
                <div className="bg-base-100 rounded-xl p-3 border border-base-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-base-content flex items-center gap-1">📋 月度附加费用 Recurring Charges</p>
                    {!tenantRcForm && (
                      <button type="button" className="btn btn-xs btn-outline btn-primary" onClick={() => setTenantRcForm({ charge_name: COMMON_CHARGES[0], custom_name: '', amount: 0, frequency: 'monthly', notes: '' })}>
                        + 添加
                      </button>
                    )}
                  </div>

                  {/* Add/edit form */}
                  {tenantRcForm && (
                    <div className="bg-base-200 rounded-lg p-2 space-y-2">
                      <select className="select select-bordered select-xs w-full" value={tenantRcForm.charge_name} onChange={(e) => setTenantRcForm({ ...tenantRcForm, charge_name: e.target.value })}>
                        {COMMON_CHARGES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {tenantRcForm.charge_name === 'Other 其他' && (
                        <input className="input input-bordered input-xs w-full" placeholder="费用名称" value={tenantRcForm.custom_name} onChange={(e) => setTenantRcForm({ ...tenantRcForm, custom_name: e.target.value })} />
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-base-content/60">金额 (RM)</label>
                          <input type="number" className="input input-bordered input-xs w-full" placeholder="0" value={tenantRcForm.amount || ''} onChange={(e) => setTenantRcForm({ ...tenantRcForm, amount: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="text-[10px] text-base-content/60">频率</label>
                          <select className="select select-bordered select-xs w-full" value={tenantRcForm.frequency} onChange={(e) => setTenantRcForm({ ...tenantRcForm, frequency: e.target.value })}>
                            <option value="monthly">每月</option>
                            <option value="quarterly">每季</option>
                            <option value="annually">每年</option>
                          </select>
                        </div>
                      </div>
                      <input className="input input-bordered input-xs w-full" placeholder="备注 (选填)" value={tenantRcForm.notes} onChange={(e) => setTenantRcForm({ ...tenantRcForm, notes: e.target.value })} />
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-xs btn-primary" disabled={savingRc || tenantRcForm.amount <= 0} onClick={handleSaveRcInTenant}>
                          {savingRc ? '...' : '保存'}
                        </button>
                        <button type="button" className="btn btn-xs btn-ghost" onClick={() => setTenantRcForm(null)}>取消</button>
                      </div>
                    </div>
                  )}

                  {/* List of existing charges */}
                  {tenantRcList.length > 0 && (
                    <div className="space-y-1">
                      {tenantRcList.map(rc => (
                        <div key={rc.id} className="flex items-center justify-between bg-base-200 rounded-lg px-2 py-1.5">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium">{rc.charge_name}</span>
                            {rc.floor_label && <span className="badge badge-xs badge-primary ml-1">{rc.floor_label}</span>}
                            {rc.notes && <span className="text-[10px] text-base-content/50 ml-1">· {rc.notes}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-primary">RM {rc.amount}</span>
                            <button type="button" className="btn btn-ghost btn-xs px-1 text-error" onClick={() => handleDeleteRcInTenant(rc.id)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="text-right">
                        <span className="text-xs font-bold text-primary">附加费合计: RM {tenantRcList.filter(r => r.frequency === 'monthly').reduce((s, r) => s + r.amount, 0)}</span>
                      </div>
                    </div>
                  )}

                  {!tenantForm.editingTenantName && (
                    <p className="text-[10px] text-info">请先保存租户后，再添加附加费用</p>
                  )}
                </div>
              )}
            </div>

            {/* Save + Cancel buttons at end of form */}
            <div className="pt-2 pb-4 flex gap-2">
              <button className="btn btn-ghost flex-none" onClick={() => setTenantForm(null)}>取消</button>
              <button
                className="btn btn-primary flex-1 gap-2"
                disabled={savingTenant || !tenantForm.tenant_name || tenantForm.selectedFloorIds.length === 0}
                onClick={handleSaveTenant}
              >
                {savingTenant ? <span className="loading loading-spinner loading-sm" /> : <Save size={16} />}
                保存租户资料{tenantForm.selectedFloorIds.length > 1 ? ` (${tenantForm.selectedFloorIds.length}层)` : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== FLOOR DISPLAY ==========
  function renderFloorSection(p: Property) {
    const floors = getPropertyFloors(p.id);
    if (floors.length === 0) return null;

    const totalRent = getTotalRent(p.id);
    const occupiedCount = floors.filter((f) => f.tenant_name).length;
    const allVacant = occupiedCount === 0;

    // Group floors by tenant
    const tenantGroups: Record<string, FloorUnit[]> = {};
    const vacantFloors: FloorUnit[] = [];
    floors.forEach((f) => {
      if (f.tenant_name) {
        if (!tenantGroups[f.tenant_name]) tenantGroups[f.tenant_name] = [];
        tenantGroups[f.tenant_name].push(f);
      } else {
        vacantFloors.push(f);
      }
    });

    return (
      <div className="mt-3 space-y-2">
        {/* Stats bar */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-base-content">
            楼层 · {occupiedCount}/{floors.length} 层已租
          </span>
          {totalRent > 0 && (
            <span className="text-xs font-bold text-primary">
              总月租 RM {totalRent.toLocaleString()}
            </span>
          )}
        </div>

        {/* All vacant → big CTA */}
        {allVacant ? (
          <div
            className="border-2 border-dashed border-primary/20 rounded-xl p-5 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
            onClick={() => openNewTenantForm(p.id)}
          >
            <Plus size={24} className="mx-auto text-primary/50 mb-1" />
            <span className="text-sm text-primary font-semibold">填写租户资料</span>
            <p className="text-[10px] text-base-content mt-0.5">
              选择楼层 → 输入租户、租金、押金、租期
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Tenant groups */}
            {Object.entries(tenantGroups).map(([name, tFloors]) => {
              const first = tFloors[0];
              const groupRent = tFloors.reduce((s, f) => s + (f.rent_amount || 0), 0);
              const groupDeposit = tFloors.reduce((s, f) => s + (f.deposit || 0), 0);
              const groupUtility = tFloors.reduce((s, f) => s + (f.utility_deposit || 0), 0);
              const isWholeBuilding = tFloors.length === floors.length;

              return (
                <div
                  key={name}
                  className="bg-success/5 border border-success/15 rounded-xl p-3 cursor-pointer hover:bg-success/10 transition-colors"
                  onClick={() => openEditTenantForm(p.id, name)}
                >
                  {/* Tenant header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isWholeBuilding ? (
                          <span className="badge badge-sm badge-success">全栋出租</span>
                        ) : (
                          <span className="badge badge-sm badge-info">
                            {tFloors.map((f) => f.floor_label).join(' · ')}
                          </span>
                        )}
                        <span className="font-semibold text-sm truncate">{name}</span>
                      </div>
                      {first.tenant_phone && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-base-content">
                          <Phone size={10} /> {first.tenant_phone}
                        </div>
                      )}
                      {first.tenant_company_reg && (
                        <div className="text-[10px] text-base-content mt-0.5">SSM: {first.tenant_company_reg}</div>
                      )}
                      {first.director_name && (
                        <div className="text-[10px] text-base-content">董事: {first.director_name}{first.director_phone ? ` · ${first.director_phone}` : ''}</div>
                      )}
                      {first.agent_name && (
                        <div className="text-[10px] text-base-content">🤝 中介: {first.agent_name}{first.agent_company ? ` · ${first.agent_company}` : ''}{first.agent_phone ? ` · ${first.agent_phone}` : ''}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-bold text-primary">RM {groupRent.toLocaleString()}</p>
                      <p className="text-[10px] text-base-content">/月</p>
                    </div>
                  </div>

                  {/* Lease period — PROMINENT */}
                  {(first.lease_start || first.lease_end) && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-success/10">
                      <CalendarDays size={13} className="text-primary shrink-0" />
                      <span className="text-sm font-medium">
                        {fmtDate(first.lease_start)} → {fmtDate(first.lease_end)}
                      </span>
                      {first.lease_end && leaseExpiryBadge(first.lease_end)}
                    </div>
                  )}

                  {/* Deposit info */}
                  {(groupDeposit > 0 || groupUtility > 0) && (
                    <div className="flex gap-3 mt-2 text-xs text-base-content">
                      {groupDeposit > 0 && <span>押金: RM {groupDeposit.toLocaleString()}</span>}
                      {groupUtility > 0 && <span>水电押金: RM {groupUtility.toLocaleString()}</span>}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-success/10">
                    <button
                      className="btn btn-xs btn-ghost text-error gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVacateTarget({ propertyId: p.id, tenantName: name, floors: tFloors });
                      }}
                    >
                      <LogOut size={12} /> 退租
                    </button>
                    <span className="text-[10px] text-base-content">点击卡片修改 ✏️</span>
                  </div>
                </div>
              );
            })}

            {/* Vacant floors */}
            {vacantFloors.length > 0 && (
              <div
                className="border border-dashed border-base-300 rounded-xl p-3 text-center cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all"
                onClick={() => openNewTenantForm(p.id)}
              >
                <span className="text-xs text-base-content">
                  {vacantFloors.map((f) => f.floor_label).join(' · ')} 空置
                </span>
                <p className="text-xs text-primary font-medium mt-0.5">+ 添加租户</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ========== PROPERTY CARD ==========
  function renderPropertyCard(p: Property) {
    const floors = getPropertyFloors(p.id);

    return (
      <div key={p.id} className="bg-base-100 rounded-xl border border-base-300 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-4 pb-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base">{p.name}</h3>
                {typeBadge(p.type)}
                {statusBadge(p.status)}
                {(p.floor_count || 1) > 1 && (
                  <span className="badge badge-sm badge-outline gap-0.5">
                    <Building2 size={10} />{p.floor_count}层
                  </span>
                )}
              </div>
              {p.address && (
                <p className="text-xs text-base-content mt-1 leading-relaxed">{p.address}</p>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button className="btn btn-ghost btn-xs btn-square" onClick={() => onEdit(p)}>
                <Edit size={14} />
              </button>
              <button className="btn btn-ghost btn-xs btn-square text-error/60 hover:text-error" onClick={() => setDeleteConfirmId(p.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Property quick stats */}
        <div className="px-4 pt-2">
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-base-content">
            {p.area_sqft > 0 && <span>{p.area_sqft.toLocaleString()} sqft</span>}
            {p.bedrooms > 0 && <span>{p.bedrooms}房{p.bathrooms}卫</span>}
            {p.price > 0 && <span>售价: {formatCurrency(p.price)}</span>}
          </div>
        </div>

        {/* Floor section */}
        {floors.length > 0 && (
          <div className="px-4 pt-1">
            {renderFloorSection(p)}
          </div>
        )}

        {/* Loan info bar */}
        {(p.bank_code || p.loan_balance > 0) && (
          <div className="mx-4 mt-3">
            <div className="flex items-center gap-2 bg-warning/5 border border-warning/15 rounded-lg p-2 text-xs">
              <Landmark size={12} className="text-warning shrink-0" />
              {p.bank_code && <span className="font-medium text-warning">{p.bank_code}</span>}
              {p.loan_balance > 0 && <span className="text-error font-semibold">欠款 {formatCurrency(p.loan_balance)}</span>}
              {getRepaymentDay(p) && <span className="badge badge-xs badge-primary">每月{getRepaymentDay(p)}日扣款</span>}
              {p.monthly_repayment > 0 && <span className="text-base-content ml-auto">月供 {formatCurrency(p.monthly_repayment)}</span>}
            </div>
            {(() => {
              const est = calculateEstimatedBalance(p.loan_amount, p.monthly_repayment, p.loan_interest_rate, p.loan_start);
              if (!est) return null;
              return (
                <div className="flex items-center justify-between text-xs mt-1 pt-1 border-t border-warning/10">
                  <span className="text-base-content">估算当前余额</span>
                  <span className="font-semibold text-info">RM {est.estimatedBalance.toLocaleString()}</span>
                  <span className="text-base-content/60">已还 {est.monthsElapsed} 月</span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Expense/renovation details hidden — accessible via Edit (编辑物业) */}

        {/* Owner info */}
        {p.owner_name && (
          <div className="mx-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-base-content">
              <UserCheck size={11} className="text-primary shrink-0" />
              <span>{p.owner_type === 'company' ? '🏢' : '👤'} {p.owner_name}</span>
            </div>
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-4" />
      </div>
    );
  }

  // ========== LOADING ==========
  if (loading) {
    return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg text-primary" /></div>;
  }

  // Stats
  const totalLoanBalance = properties.reduce((sum, p) => sum + (p.loan_balance || 0), 0);
  const totalMonthlyRepayment = properties.reduce((sum, p) => sum + (p.monthly_repayment || 0), 0);
  const totalMonthlyRent = properties.reduce((sum, p) => sum + getTotalRent(p.id), 0);
  const occupiedFloors = floorUnits.filter((f) => f.tenant_name).length;
  const totalFloors = floorUnits.length;

  async function handleExportProperties() {
    const allProps = await getProperties();
    const allFloors = await getAllFloorUnits();
    const headers = ['物业名称', '地址', '类型', '状态', '楼层数', '已出租', '月租金总额', '贷款余额', '月供', '持有人'];
    const rows = allProps.map(p => {
      const floors = allFloors.filter(f => f.property_id === p.id);
      const occupied = floors.filter(f => f.tenant_name).length;
      const floorRent = floors.reduce((s, f) => s + (f.rent_amount || 0), 0);
      const totalRent = floorRent > 0 ? floorRent : (p.status === 'rented' && p.rental_price > 0 ? p.rental_price : 0);
      return [p.name, p.address || '', p.type, p.status, floors.length || p.floor_count, occupied, totalRent, p.loan_balance || 0, p.monthly_repayment || 0, p.owner_name || ''] as (string | number)[];
    });
    downloadCsv(`物业列表_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button className="btn btn-primary btn-sm gap-1 flex-1" onClick={onAdd}>
          <Plus size={14} /> 新增物业
        </button>
        <button className="btn btn-ghost btn-sm gap-1" onClick={handleExportProperties} title="导出CSV">
          <Download size={14} /> 导出
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content" />
        <input className="input input-bordered input-sm w-full pl-8" placeholder="搜索物业、地址、租户..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex gap-2 flex-wrap">
        <select className="select select-bordered select-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">全部状态</option>
          {PROPERTY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="select select-bordered select-xs" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
          <option value="all">全部持有人</option>
          {[...new Set(properties.map(p => p.owner_name).filter(Boolean))].sort().map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div className="flex-1" />
        <span className="text-xs text-base-content self-center">{filtered.length} 项物业</span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-base-200 rounded-lg py-2">
          <p className="text-lg font-bold text-primary">{properties.length}</p>
          <p className="text-[10px] text-base-content">物业总数</p>
        </div>
        <div className="bg-base-200 rounded-lg py-2">
          <p className="text-lg font-bold text-success">{totalFloors > 0 ? `${occupiedFloors}/${totalFloors}` : '—'}</p>
          <p className="text-[10px] text-base-content">已出租层数</p>
        </div>
        <div className="bg-base-200 rounded-lg py-2">
          <p className="text-lg font-bold text-primary">{totalMonthlyRent > 0 ? `RM ${totalMonthlyRent.toLocaleString()}` : '—'}</p>
          <p className="text-[10px] text-base-content">月租收入</p>
        </div>
      </div>

      {totalLoanBalance > 0 && (
        <div className="bg-error/5 border border-error/20 rounded-lg p-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Landmark size={14} className="text-error" />
            <span className="font-medium">总贷款余额</span>
          </div>
          <div className="text-right">
            <span className="text-error font-bold">{formatCurrency(totalLoanBalance)}</span>
            {totalMonthlyRepayment > 0 && (
              <span className="text-base-content ml-2">月供 {formatCurrency(totalMonthlyRepayment)}</span>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-base-content">
          <Building2 size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">暂无物业</p>
          <p className="text-xs mt-1">点击上方按钮新增物业</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => renderPropertyCard(p))}
        </div>
      )}

      {renderTenantForm()}

      {vacateTarget && (
        <div className="modal modal-open" style={{zIndex: 9999}}>
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg flex items-center gap-2">🚪 退租确认</h3>
            <div className="mt-3 space-y-3">
              <div className="bg-base-200 rounded-lg p-3">
                <p className="text-sm font-medium">👤 {vacateTarget.tenantName}</p>
                <p className="text-xs text-base-content/60 mt-1">涉及楼层：{vacateTarget.floors.map(f => f.floor_label).join('、')}</p>
              </div>

              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs font-medium">📅 停租日期 <span className="text-error">*</span></span></label>
                <div className="relative">
                  <input type="date" className="input input-bordered input-sm w-full pr-7" value={vacateDate} onChange={e => setVacateDate(e.target.value)} />
                  {vacateDate && <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs px-1 text-base-content/40 hover:text-error" onClick={() => setVacateDate('')}>✕</button>}
                </div>
              </div>

              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs font-medium">📋 退租原因</span></label>
                <select className="select select-bordered select-sm w-full" value={vacateReason} onChange={e => setVacateReason(e.target.value)}>
                  <option value="contract_expired">合同到期</option>
                  <option value="early_termination">提前退租</option>
                  <option value="eviction_arrears">欠租驱逐</option>
                  <option value="mutual_agreement">双方协议终止</option>
                  <option value="other">其他原因</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs font-medium">💰 欠租金额 (RM)</span></label>
                <input type="number" className="input input-bordered input-sm w-full" placeholder="0.00 — 如无欠款可留空" value={vacateArrears} onChange={e => setVacateArrears(e.target.value)} min="0" step="0.01" />
                <label className="label py-0"><span className="label-text-alt text-[10px]">记录欠租金额，后续可在历史记录中追踪还款</span></label>
              </div>

              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs font-medium">📝 备注</span></label>
                <textarea className="textarea textarea-bordered textarea-sm w-full" rows={2} placeholder="其他说明..." value={vacateNotes} onChange={e => setVacateNotes(e.target.value)} />
              </div>
            </div>

            <div className="modal-action">
              <button className="btn btn-sm btn-ghost" onClick={() => { setVacateTarget(null); setVacateDate(''); setVacateReason('contract_expired'); setVacateNotes(''); setVacateArrears(''); }}>取消</button>
              <button className="btn btn-sm btn-error" disabled={!vacateDate} onClick={handleVacateConfirm}>确认退租</button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/40" onClick={() => { setVacateTarget(null); setVacateDate(''); setVacateReason('contract_expired'); setVacateNotes(''); setVacateArrears(''); }} />
        </div>
      )}

      <ConfirmModal
        open={deleteConfirmId !== null}
        message="确定删除此物业？所有楼层租户信息也会被删除。此操作不可撤销。"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <ConfirmModal
        open={deleteRenoId !== null}
        message="确定删除此支出记录？此操作不可撤销。"
        onConfirm={handleDeleteRenoConfirm}
        onCancel={() => setDeleteRenoId(null)}
      />
    </div>
  );
};
