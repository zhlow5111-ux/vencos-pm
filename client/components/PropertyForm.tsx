import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Landmark, UserCheck, Home, Receipt, Building2, Plus, Trash2, Edit, DollarSign, FileText, Upload, Download, Eye, Clock, ChevronDown } from 'lucide-react';
import { Property, Owner, PurchaseCost, PurchaseCostCategory, PROPERTY_TYPES, PROPERTY_STATUSES, LISTING_TYPES, BANK_CODES, OWNER_TYPES, PURCHASE_COST_CATEGORIES, DOC_TYPES, DOC_CATEGORIES, PropertyDocument, TenantHistory, ArrearsPayment, DocType, Meter, LOAN_LABEL_OPTIONS, RATE_TYPE_OPTIONS, Loan } from '../types';
import { saveProperty, getPropertyById, getOwners, ensureFloorUnits, getPurchaseCosts, savePurchaseCost, deletePurchaseCost, getDocuments, saveDocument, deleteDocument, getTenantHistory, getRentalIncomeByProperty, getArrearsPayments, saveArrearsPayment, deleteArrearsPayment, getArrearsBalance, getMeters, saveMeter, deleteMeter, getLoanPayments, addLoanPayment, deleteLoanPayment, LoanPayment, getValuations, saveValuation, deleteValuation, Valuation, getLoansForProperty, saveLoan, deleteLoanRecord, getLoanPaymentsForLoan } from '../utils/db';
import { calculateEstimatedBalance, calculateLoanProjection, PrepaymentRecord } from '../utils/helpers';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  property?: Property;
  onClose: () => void;
  onSaved: (updatedProperty: Property) => void;
}

type FormTab = 'basic' | 'loan' | 'expenses' | 'owner' | 'docs' | 'history' | 'valuation';

export const PropertyForm: React.FC<Props> = ({ property, onClose, onSaved }) => {
  const isEdit = !!property;
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [tab, setTab] = useState<FormTab>('basic');

  // Basic fields
  const [name, setName] = useState(property?.name || '');
  const [address, setAddress] = useState(property?.address || '');
  const [type, setType] = useState(property?.type || 'commercial');
  const [status, setStatus] = useState(property?.status || 'available');
  const [listingType, setListingType] = useState(property?.listing_type || 'rent');
  const [floorCount, setFloorCount] = useState(property?.floor_count || 1);
  const [price, setPrice] = useState(property?.price || 0);
  const [actualPrice, setActualPrice] = useState(property?.actual_price || 0);
  const [spaDate, setSpaDate] = useState(property?.spa_date || '');
  const [rentalPrice, setRentalPrice] = useState(property?.rental_price || 0);
  const [bedrooms, setBedrooms] = useState(property?.bedrooms || 0);
  const [bathrooms, setBathrooms] = useState(property?.bathrooms || 0);
  const [areaUnit, setAreaUnit] = useState<'sqft' | 'm2'>('sqft');
  const [areaInput, setAreaInput] = useState(property?.area_sqft ? String(property.area_sqft) : '');
  const [description, setDescription] = useState(property?.description || '');

  // Multi-loan state
  const [loans, setLoans] = useState<any[]>([]);
  const [expandedLoanId, setExpandedLoanId] = useState<number | null>(null);
  const [editingLoan, setEditingLoan] = useState<any | null>(null);
  const [savingLoan, setSavingLoan] = useState(false);
  const [loanPrepayMap, setLoanPrepayMap] = useState<Record<number, any[]>>({});

  // Expense fields
  const [landTax, setLandTax] = useState(property?.land_tax || 0);
  const [landTaxDue, setLandTaxDue] = useState(property?.land_tax_due || '');
  const [assessmentTax, setAssessmentTax] = useState(property?.assessment_tax || 0);
  const [assessmentTaxDue, setAssessmentTaxDue] = useState(property?.assessment_tax_due || '');
  const [serviceCharge, setServiceCharge] = useState(property?.service_charge || 0);
  const [mgmtCompanyName, setMgmtCompanyName] = useState(property?.mgmt_company_name || '');
  const [mgmtCompanyPhone, setMgmtCompanyPhone] = useState(property?.mgmt_company_phone || '');
  const [mgmtCompanyAddress, setMgmtCompanyAddress] = useState(property?.mgmt_company_address || '');
  const [mgmtFeePct, setMgmtFeePct] = useState(property?.mgmt_fee_pct || 0);
  const [mgmtFeeType, setMgmtFeeType] = useState<'percentage' | 'fixed'>(property?.mgmt_fee_type || 'percentage');
  const [mgmtFeeAmount, setMgmtFeeAmount] = useState(property?.mgmt_fee_amount || 0);

  // (loan account/prepayment states now inside loan cards)

  // Valuation state
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [showValForm, setShowValForm] = useState(false);
  const [valAmount, setValAmount] = useState('');
  const [valDate, setValDate] = useState('');
  const [valNotes, setValNotes] = useState('');
  const [savingVal, setSavingVal] = useState(false);
  // AI valuation state
  const [aiValLoading, setAiValLoading] = useState(false);
  const [aiValResult, setAiValResult] = useState<any>(null);
  const [showAiVal, setShowAiVal] = useState(false);
  const [editingValId, setEditingValId] = useState<number | null>(null);

  // RPGT calculator state
  const [showRpgt, setShowRpgt] = useState(false);
  const [rpgtSellingPrice, setRpgtSellingPrice] = useState('');
  const [rpgtPurchaseDate, setRpgtPurchaseDate] = useState(property?.spa_date || property?.loan_start || '');
  const [rpgtOwnerType, setRpgtOwnerType] = useState<'individual' | 'company'>('individual');
  const [rpgtExtraDeductions, setRpgtExtraDeductions] = useState('');

  // Rental income tax calculator state
  const [showRentalTax, setShowRentalTax] = useState(false);
  const [rtYear, setRtYear] = useState(String(new Date().getFullYear() - 1));
  const [rtOtherIncome, setRtOtherIncome] = useState('');
  const [rtReliefs, setRtReliefs] = useState('9000'); // basic personal relief
  const [hakmilikNo, setHakmilikNo] = useState(property?.hakmilik_no || '');
  const [landTaxRef, setLandTaxRef] = useState(property?.land_tax_ref || '');
  const [assessmentTaxRef, setAssessmentTaxRef] = useState(property?.assessment_tax_ref || '');
  const [indahWater, setIndahWater] = useState(property?.indah_water || 0);
  const [indahWaterAcc, setIndahWaterAcc] = useState(property?.indah_water_acc || '');
  
  // Meters
  const [meters, setMeters] = useState<Meter[]>([]);
  const [showMeterForm, setShowMeterForm] = useState(false);
  const [editingMeter, setEditingMeter] = useState<Meter | null>(null);
  const [meterForm, setMeterForm] = useState({ meter_type: 'electricity' as 'electricity' | 'water', meter_number: '', account_holder: '', label: '', notes: '' });

  // Owner field
  const [ownerId, setOwnerId] = useState(property?.owner_id || 0);

  // Purchase costs state
  const [purchaseCosts, setPurchaseCosts] = useState<PurchaseCost[]>([]);
  const [showMgmt, setShowMgmt] = useState(false);
  const [showAddCost, setShowAddCost] = useState(false);
  const [editingCost, setEditingCost] = useState<PurchaseCost | null>(null);
  const [costForm, setCostForm] = useState<{
    category: PurchaseCostCategory; description: string; amount: number;
    paid_date: string; paid_to: string; notes: string;
  }>({ category: 'other', description: '', amount: 0, paid_date: '', paid_to: '', notes: '' });
  const [savingCost, setSavingCost] = useState(false);
  const [deleteCostId, setDeleteCostId] = useState<number | null>(null);



  // Document state
  const [docs, setDocs] = useState<(PropertyDocument & { file_data?: string; file_size?: number; file_mime?: string })[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<DocType>('other');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileData, setUploadFileData] = useState('');
  const [uploadFileSize, setUploadFileSize] = useState(0);
  const [uploadFileMime, setUploadFileMime] = useState('');
  const [uploadSaving, setUploadSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB (files stored on disk, not SQLite)

  // Tenant history state
  const [tenantHistoryList, setTenantHistoryList] = useState<TenantHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFloorFilter, setHistoryFloorFilter] = useState<string>('all');
  const [historyView, setHistoryView] = useState<'records' | 'arrears'>('records');

  // Arrears state
  const [arrearsMap, setArrearsMap] = useState<Record<number, { payments: ArrearsPayment[]; balance: number }>>({});
  const [showPaymentForm, setShowPaymentForm] = useState<number | null>(null); // history_id
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Rental income state
  const [rentalIncome, setRentalIncome] = useState<{totalCollected: number; invoiceCount: number; monthlyBreakdown: {month: string; amount: number}[]} | null>(null);

  useEffect(() => {
    getOwners().then(setOwners);
  }, []);

  // Load purchase costs when property exists
  useEffect(() => {
    if (property?.id) {
      getPurchaseCosts(property.id).then(setPurchaseCosts);
      getLoansForProperty(property.id).then(setLoans);
      getValuations(property.id).then(setValuations);
    }
  }, [property?.id]);

  // Auto-set bankName when bankCode changes
  // (bankCode auto-set removed — each loan manages its own bank)

  // Load meters
  useEffect(() => {
    if (property?.id) {
      getMeters(property.id).then(setMeters);
    }
  }, [property?.id]);

  // Load docs when on docs tab
  useEffect(() => {
    if (property?.id && tab === 'docs') {
      setDocsLoading(true);
      getDocuments(property.id).then((d) => setDocs(d as any)).finally(() => setDocsLoading(false));
    }
  }, [property?.id, tab]);

  // Load history and rental income when on history tab
  useEffect(() => {
    if (property?.id && tab === 'history') {
      setHistoryLoading(true);
      Promise.all([
        getTenantHistory(property.id),
        getRentalIncomeByProperty(property.id),
      ]).then(async ([h, r]) => {
        setTenantHistoryList(h);
        setRentalIncome(r);
        // Load arrears for any records with arrears_amount > 0
        const aMap: Record<number, { payments: ArrearsPayment[]; balance: number }> = {};
        for (const hist of h) {
          if (hist.arrears_amount > 0) {
            const payments = await getArrearsPayments(hist.id);
            const balance = await getArrearsBalance(hist.id, hist.arrears_amount);
            aMap[hist.id] = { payments, balance };
          }
        }
        setArrearsMap(aMap);
      }).finally(() => setHistoryLoading(false));
    }
  }, [property?.id, tab]);

  async function handleSaveArrearsPayment(historyId: number, arrearsAmount: number) {
    if (!paymentAmount || !paymentDate) return;
    await saveArrearsPayment({
      history_id: historyId,
      amount: parseFloat(paymentAmount) || 0,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      notes: paymentNotes,
    });
    // Refresh arrears data
    const payments = await getArrearsPayments(historyId);
    const balance = await getArrearsBalance(historyId, arrearsAmount);
    setArrearsMap(prev => ({ ...prev, [historyId]: { payments, balance } }));
    setShowPaymentForm(null);
    setPaymentAmount('');
    setPaymentDate('');
    setPaymentMethod('bank_transfer');
    setPaymentNotes('');
  }

  async function loadDocs() {
    if (!property?.id) return;
    const d = await getDocuments(property.id);
    setDocs(d as any);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），最大支持 30MB`);
      setUploadFileName('');
      setUploadFileData('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploadFileName(file.name);
    setUploadFileSize(file.size);
    setUploadFileMime(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      setUploadFileData(base64);
    };
    reader.readAsDataURL(file);
  }

  async function handleUploadDoc() {
    if (!property?.id || !uploadFileData || !uploadFileName) return;
    setUploadSaving(true);
    setUploadProgress('准备上载...');
    setUploadError('');
    try {
      await saveDocument({
        property_id: property.id,
        doc_type: uploadDocType,
        file_name: uploadFileName,
        file_data: uploadFileData,
        file_size: uploadFileSize,
        file_mime: uploadFileMime,
        notes: uploadNotes,
      }, (pct) => {
        setUploadProgress(`上载中 ${pct}%`);
      });
      // Reset form
      setUploadDocType('other');
      setUploadNotes('');
      setUploadFileName('');
      setUploadFileData('');
      setUploadFileSize(0);
      setUploadFileMime('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDocs();
    } catch (e: any) {
      setUploadError(`上载失败：${e?.message || '未知错误'}，请尝试较小的文件`);
    } finally {
      setUploadSaving(false);
      setUploadProgress('');
    }
  }

  async function handleDeleteDocConfirm() {
    if (deleteDocId === null) return;
    const id = deleteDocId;
    setDeleteDocId(null);
    await deleteDocument(id);
    await loadDocs();
  }

  async function handleDownloadDoc(doc: any) {
    try {
      const mime = doc.file_mime || 'application/octet-stream';
      let dataUrl = '';

      if (doc.file_data && doc.file_data.startsWith('/agent/')) {
        // New format: .b64 file on disk — use readFileFromDiskChunked from db.ts
        const { readFileFromDiskChunked } = await import('../utils/db');
        dataUrl = await readFileFromDiskChunked(doc.file_data, mime);
      } else if (doc.file_data) {
        // Legacy format: base64 stored directly in DB
        dataUrl = `data:${mime};base64,${doc.file_data}`;
      }

      if (!dataUrl) {
        setUploadError('文件数据不存在');
        return;
      }

      // Convert data URL to blob for download
      const resp = await fetch(dataUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setUploadError(`下载失败：${e?.message || '未知错误'}`);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function openCostForm(cost?: PurchaseCost) {
    if (cost) {
      setEditingCost(cost);
      setCostForm({
        category: cost.category, description: cost.description, amount: cost.amount,
        paid_date: cost.paid_date, paid_to: cost.paid_to, notes: cost.notes,
      });
    } else {
      setEditingCost(null);
      setCostForm({ category: 'other', description: '', amount: 0, paid_date: '', paid_to: '', notes: '' });
    }
    setShowAddCost(true);
  }

  function cancelCostForm() {
    setShowAddCost(false);
    setEditingCost(null);
    setCostForm({ category: 'other', description: '', amount: 0, paid_date: '', paid_to: '', notes: '' });
  }

  async function handleSaveCost() {
    if (!property?.id) return;
    setSavingCost(true);
    try {
      await savePurchaseCost({
        id: editingCost?.id,
        property_id: property.id,
        category: costForm.category,
        description: costForm.description,
        amount: costForm.amount,
        paid_date: costForm.paid_date,
        paid_to: costForm.paid_to,
        notes: costForm.notes,
      });
      const updated = await getPurchaseCosts(property.id);
      setPurchaseCosts(updated);
      cancelCostForm();
    } catch (e) {
      console.error('Save purchase cost failed:', e);
    } finally {
      setSavingCost(false);
    }
  }

  async function handleDeleteCostConfirm() {
    if (deleteCostId === null || !property?.id) return;
    const id = deleteCostId;
    setDeleteCostId(null);
    await deletePurchaseCost(id);
    const updated = await getPurchaseCosts(property.id);
    setPurchaseCosts(updated);
  }

  const totalPurchaseCostsAmount = purchaseCosts.reduce((sum, c) => sum + (c.amount || 0), 0);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const id = await saveProperty({
        id: property?.id,
        name: name.trim(),
        address,
        type: type as any,
        status: status as any,
        listing_type: listingType as any,
        property_category: 'standalone',
        parent_id: 0,
        unit_number: '',
        total_units: 0,
        floor_count: floorCount,
        price,
        rental_price: rentalPrice,
        bedrooms,
        bathrooms,
        area_sqft: areaUnit === 'sqft' ? (Number(areaInput) || 0) : Math.round((Number(areaInput) || 0) / 0.092903),
        description,
        bank_code: '',
        bank_name: '',
        loan_amount: 0,
        loan_balance: 0,
        monthly_repayment: 0,
        loan_start: '',
        loan_tenure_months: 0,
        loan_interest_rate: 0,
        loan_repayment_day: 0,
        loan_account_no: '',
        loan_si_account: '',
        land_tax: landTax,
        land_tax_due: landTaxDue,
        assessment_tax: assessmentTax,
        assessment_tax_due: assessmentTaxDue,
        hakmilik_no: hakmilikNo,
        land_tax_ref: landTaxRef,
        assessment_tax_ref: assessmentTaxRef,
        indah_water: indahWater,
        indah_water_acc: indahWaterAcc,
        service_charge: serviceCharge,
        mgmt_company_name: mgmtCompanyName,
        mgmt_company_phone: mgmtCompanyPhone,
        mgmt_company_address: mgmtCompanyAddress,
        mgmt_fee_pct: mgmtFeePct,
        mgmt_fee_type: mgmtFeeType,
        mgmt_fee_amount: mgmtFeeAmount,
        actual_price: actualPrice,
        spa_date: spaDate,
        owner_id: ownerId,
      });
      // Ensure floor units exist
      if (floorCount > 0) {
        await ensureFloorUnits(property?.id || id, floorCount);
      }
      // Auto-save any pending purchase cost edit
      if (showAddCost && costForm.amount > 0) {
        const propId = property?.id || id;
        await savePurchaseCost({
          id: editingCost?.id,
          property_id: propId,
          category: costForm.category,
          description: costForm.description,
          amount: costForm.amount,
          paid_date: costForm.paid_date,
          paid_to: costForm.paid_to,
          notes: costForm.notes,
        });
        cancelCostForm();
      }
      // Reload purchase costs
      const propId = property?.id || id;
      getPurchaseCosts(propId).then(setPurchaseCosts);
      // Fetch updated property and pass to parent (stays open)
      const updated = await getPropertyById(propId);
      if (updated) {
        onSaved(updated);
      }
      // Show success toast
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  }

  const tabs: { key: FormTab; label: string; icon: React.ReactNode }[] = [
    { key: 'basic', label: '基本信息', icon: <Home size={14} /> },
    { key: 'loan', label: '贷款', icon: <Landmark size={14} /> },
    { key: 'expenses', label: '费用', icon: <Receipt size={14} /> },
    // Owner is now in basic tab
    { key: 'valuation', label: '市值', icon: <DollarSign size={14} /> },
    { key: 'docs', label: '文件', icon: <FileText size={14} /> },
    { key: 'history', label: '历史', icon: <Clock size={14} /> },
  ];

  const selectedOwner = owners.find((o) => o.id === ownerId);

  const floorLabels: Record<number, string> = {
    1: '1层', 2: '2层', 3: '3层', 4: '4层', 5: '5层',
    6: '6层', 7: '7层', 8: '8层', 9: '9层', 10: '10层',
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg max-h-[90vh] p-0 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-base-300 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base">{isEdit ? '编辑物业' : '新增物业'}</h3>
            {savedToast && (
              <span className="badge badge-success badge-sm gap-1 animate-pulse">✓ 已保存</span>
            )}
          </div>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Form Tabs */}
        <div className="flex gap-1 p-2 bg-base-200 shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                tab === t.key ? 'bg-primary text-primary-content' : 'text-base-content hover:bg-base-300'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* ===== BASIC TAB ===== */}
          {tab === 'basic' && (
            <>
              <div className="form-control">
                <label className="label"><span className="label-text font-medium">物业名称 *</span></label>
                <input className="input input-bordered input-sm w-full" placeholder="如: Taman Maju 店铺" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text text-xs">地址 Address</span></label>
                <textarea className="textarea textarea-bordered textarea-sm w-full" rows={2} placeholder="完整地址" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">类型</span></label>
                  <select className="select select-bordered select-sm w-full" value={type} onChange={(e) => setType(e.target.value)}>
                    {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {type !== 'land' && (
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">楼层数 Floor Count</span></label>
                  <select className="select select-bordered select-sm w-full" value={floorCount} onChange={(e) => setFloorCount(Number(e.target.value))}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{floorLabels[n] || `${n}层`}</option>
                    ))}
                  </select>
                </div>
                )}
              </div>

              {type !== 'land' && floorCount > 1 && (
                <div className="bg-info/5 border border-info/20 rounded-lg p-2.5">
                  <p className="text-xs text-info font-medium">🏢 多层物业 — 每层可独立出租给不同租户</p>
                  <p className="text-[10px] text-base-content mt-0.5">保存后可在物业列表中为每层设置租户信息</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">状态</span></label>
                  <select className="select select-bordered select-sm w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {PROPERTY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">用途</span></label>
                  <select className="select select-bordered select-sm w-full" value={listingType} onChange={(e) => setListingType(e.target.value)}>
                    {LISTING_TYPES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">📝 SPA 合同价 (RM)</span></label>
                  <input type="number" className="input input-bordered input-sm w-full" value={price || ''} onChange={(e) => setPrice(Number(e.target.value))} placeholder="合同签署价格" />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">💰 实际成交价 (RM)</span></label>
                  <input type="number" className="input input-bordered input-sm w-full" value={actualPrice || ''} onChange={(e) => setActualPrice(Number(e.target.value))} placeholder="真实支付价格" />
                </div>
              </div>
              {actualPrice > 0 && actualPrice !== price && (
                <div className={`text-xs px-2 py-1 rounded-lg ${actualPrice < price ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                  台底差额: RM {Math.abs(actualPrice - price).toLocaleString()} ({actualPrice < price ? '实际低于合同' : '实际高于合同'})
                </div>
              )}
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">📅 SPA 签署日期</span></label>
                <input type="date" className="input input-bordered input-sm w-full" value={spaDate} onChange={(e) => setSpaDate(e.target.value)} />
              </div>
              {type !== 'land' && (
              <div className="grid grid-cols-3 gap-2">
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">房间</span></label>
                  <input type="number" className="input input-bordered input-sm w-full" value={bedrooms || ''} onChange={(e) => setBedrooms(Number(e.target.value))} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">浴室</span></label>
                  <input type="number" className="input input-bordered input-sm w-full" value={bathrooms || ''} onChange={(e) => setBathrooms(Number(e.target.value))} />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text text-xs">面积</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs px-1.5 text-[10px] font-semibold"
                      onClick={() => {
                        const numVal = Number(areaInput) || 0;
                        if (areaUnit === 'sqft' && numVal > 0) {
                          setAreaInput((numVal * 0.092903).toFixed(1));
                        } else if (areaUnit === 'm2' && numVal > 0) {
                          setAreaInput(String(Math.round(numVal / 0.092903)));
                        }
                        setAreaUnit(u => u === 'sqft' ? 'm2' : 'sqft');
                      }}
                      title="点击切换单位"
                    >
                      {areaUnit === 'sqft' ? 'sqft ⇄ m²' : 'm² ⇄ sqft'}
                    </button>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered input-sm w-full"
                    value={areaInput}
                    onChange={(e) => setAreaInput(e.target.value)}
                  />
                  {areaInput && Number(areaInput) > 0 && (
                    <span className="text-[10px] text-base-content/60 mt-0.5">
                      = {areaUnit === 'sqft'
                        ? `${(Number(areaInput) * 0.092903).toFixed(1)} m²`
                        : `${Math.round(Number(areaInput) / 0.092903).toLocaleString()} sqft`}
                    </span>
                  )}
                </div>
              </div>
              )}

              {/* ── 面积 (for land, show standalone) ── */}
              {type === 'land' && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs">面积</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs px-1.5 text-[10px] font-semibold"
                    onClick={() => {
                      const cur = Number(areaInput) || 0;
                      if (areaUnit === 'sqft') {
                        setAreaUnit('m2');
                        setAreaInput(cur ? (cur * 0.092903).toFixed(1) : '');
                      } else {
                        setAreaUnit('sqft');
                        setAreaInput(cur ? String(Math.round(cur / 0.092903)) : '');
                      }
                    }}
                  >
                    {areaUnit === 'sqft' ? 'sqft ⇄ m²' : 'm² ⇄ sqft'}
                  </button>
                </label>
                <input
                  type="number"
                  className="input input-bordered input-sm w-full"
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                />
                {areaInput && Number(areaInput) > 0 && (
                  <span className="text-[10px] text-base-content/60 mt-0.5">
                    = {areaUnit === 'sqft'
                      ? `${(Number(areaInput) * 0.092903).toFixed(1)} m²`
                      : `${Math.round(Number(areaInput) / 0.092903).toLocaleString()} sqft`}
                  </span>
                )}
              </div>
              )}

              <div className="form-control">
                <label className="label"><span className="label-text text-xs">描述</span></label>
                <textarea className="textarea textarea-bordered textarea-sm w-full" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              {/* ── 持有人 (moved from separate tab) ── */}
              <div className="divider text-xs text-base-content/40 my-1">持有人</div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">选择持有人</span></label>
                <select className="select select-bordered select-sm w-full" value={ownerId} onChange={(e) => setOwnerId(Number(e.target.value))}>
                  <option value={0}>-- 未指定 --</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.owner_type === 'company' ? '🏢 ' : '👤 '}{o.name}
                      {o.registration_no ? ` (${o.registration_no})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {selectedOwner && (
                <div className="bg-base-200 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{selectedOwner.owner_type === 'company' ? '🏢' : '👤'}</span>
                    <div>
                      <p className="font-semibold text-xs">{selectedOwner.name}</p>
                      <p className="text-[10px] text-base-content">
                        {OWNER_TYPES.find((t) => t.value === selectedOwner.owner_type)?.label}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-0.5 text-[11px] text-base-content">
                    {selectedOwner.registration_no && <div className="flex justify-between"><span>注册号:</span><span>{selectedOwner.registration_no}</span></div>}
                    {selectedOwner.contact_person && <div className="flex justify-between"><span>联系人:</span><span>{selectedOwner.contact_person}</span></div>}
                    {selectedOwner.phone && <div className="flex justify-between"><span>电话:</span><span>{selectedOwner.phone}</span></div>}
                    {selectedOwner.email && <div className="flex justify-between"><span>邮箱:</span><span>{selectedOwner.email}</span></div>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== LOAN TAB ===== */}
          {tab === 'loan' && (
            <>
              {/* Summary bar */}
              {loans.length > 0 && (
                <div className="bg-warning/5 border border-warning/20 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-warning flex items-center gap-1"><Landmark size={13} /> 共 {loans.length} 笔贷款</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-[10px] text-base-content/60">总贷款额</p><p className="text-sm font-bold">RM {loans.reduce((s: number, l: any) => s + Number(l.loan_amount || 0), 0).toLocaleString()}</p></div>
                    <div><p className="text-[10px] text-base-content/60">总余额</p><p className="text-sm font-bold text-error">RM {loans.reduce((s: number, l: any) => s + Number(l.loan_balance || 0), 0).toLocaleString()}</p></div>
                    <div><p className="text-[10px] text-base-content/60">总月供</p><p className="text-sm font-bold text-info">RM {loans.reduce((s: number, l: any) => s + Number(l.monthly_repayment || 0), 0).toLocaleString()}</p></div>
                  </div>
                </div>
              )}

              {loans.length === 0 && !editingLoan && (
                <div className="text-center py-8 text-base-content/50">
                  <Landmark size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">暂无贷款记录</p>
                  <p className="text-[10px]">点击下方按钮添加贷款</p>
                </div>
              )}

              {/* Loan cards */}
              {loans.map((loan: any) => {
                const isExpanded = expandedLoanId === loan.id;
                const isEditing = editingLoan?.id === loan.id;
                const rateLabel = RATE_TYPE_OPTIONS.find(r => r.value === loan.rate_type);
                const effectiveRate = loan.rate_type === 'FIXED'
                  ? (Number(loan.base_rate) || 0)
                  : (Number(loan.base_rate) || 0) + (Number(loan.spread) || 0);
                const bankLabel = BANK_CODES.find(b => b.value === loan.bank_code)?.label || loan.bank_name || '-';
                const prepays = loanPrepayMap[loan.id] || [];

                return (
                  <div key={loan.id} className="border border-base-300 rounded-xl overflow-hidden">
                    {/* Card header - always visible */}
                    <div className={"flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-base-200/50 " + (isExpanded ? "bg-base-200/30" : "")} onClick={() => {
                      if (isExpanded) { setExpandedLoanId(null); setEditingLoan(null); }
                      else {
                        setExpandedLoanId(loan.id);
                        // Load prepayments for this loan
                        getLoanPaymentsForLoan(loan.id).then(all => {
                          setLoanPrepayMap(prev => ({ ...prev, [loan.id]: (all as any[]).filter((p: any) => p.payment_type === 'prepayment') }));
                        });
                      }
                    }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="badge badge-sm badge-warning badge-outline">{loan.loan_label || '房屋贷款'}</span>
                          <span className="text-xs text-base-content/60 truncate">{bankLabel}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-base-content/70">
                          <span>贷款 <b>RM {Number(loan.loan_amount || 0).toLocaleString()}</b></span>
                          <span>余额 <b className="text-error">RM {Number(loan.loan_balance || 0).toLocaleString()}</b></span>
                          <span>月供 <b className="text-info">RM {Number(loan.monthly_repayment || 0).toLocaleString()}</b></span>
                          {effectiveRate > 0 && <span>{rateLabel?.value || ''} <b>{effectiveRate.toFixed(2)}%</b></span>}
                        </div>
                      </div>
                      <ChevronDown size={14} className={"transition-transform " + (isExpanded ? "rotate-180" : "")} />
                    </div>

                    {/* Expanded content */}
                    {isExpanded && !isEditing && (
                      <div className="border-t border-base-300 px-3 py-3 space-y-3 bg-base-100">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <span className="text-base-content/60">利率类型</span>
                          <span className="text-right font-medium">
                            {loan.rate_type === 'FIXED' ? `固定 ${Number(loan.base_rate || 0).toFixed(2)}%`
                              : `${loan.rate_type} ${Number(loan.base_rate || 0).toFixed(2)}% ${Number(loan.spread || 0) >= 0 ? '+' : '-'} ${Math.abs(Number(loan.spread || 0)).toFixed(2)}% = ${effectiveRate.toFixed(2)}%`}
                          </span>
                          {loan.loan_start && <><span className="text-base-content/60">贷款开始</span><span className="text-right">{loan.loan_start}</span></>}
                          {loan.loan_tenure_months > 0 && <><span className="text-base-content/60">贷款期限</span><span className="text-right">{Math.floor(loan.loan_tenure_months / 12)}年{loan.loan_tenure_months % 12}个月</span></>}
                          {loan.loan_repayment_day > 0 && <><span className="text-base-content/60">还款日</span><span className="text-right">每月{loan.loan_repayment_day}日</span></>}
                          {loan.loan_account_no && <><span className="text-base-content/60">贷款户口</span><span className="text-right font-mono text-[10px]">{loan.loan_account_no}</span></>}
                          {loan.loan_si_account && <><span className="text-base-content/60">SI户口</span><span className="text-right font-mono text-[10px]">{loan.loan_si_account}</span></>}
                          {loan.loan_amount > 0 && loan.loan_balance > 0 && (
                            <><span className="text-base-content/60">已还比例</span><span className="text-right text-success font-bold">{((1 - loan.loan_balance / loan.loan_amount) * 100).toFixed(1)}%</span></>
                          )}
                          {loan.notes && <><span className="text-base-content/60">备注</span><span className="text-right">{loan.notes}</span></>}
                        </div>

                        {/* Prepayment records for this loan */}
                        {prepays.length > 0 && (
                          <div className="bg-success/5 border border-success/20 rounded-lg p-2.5 space-y-1.5">
                            <p className="text-[10px] font-semibold text-success">💰 预付本金记录</p>
                            {prepays.map((pp: any) => (
                              <div key={pp.id} className="flex items-center gap-2 bg-base-200/50 rounded px-2 py-1">
                                <span className="text-xs font-bold text-success flex-1">RM {Number(pp.amount).toLocaleString()}</span>
                                <span className="text-[10px] text-base-content/60">{pp.payment_date}</span>
                              </div>
                            ))}
                            <div className="text-right"><span className="text-[10px] font-bold text-success">累计预付: RM {prepays.reduce((s: number, p: any) => s + Number(p.amount), 0).toLocaleString()}</span></div>
                          </div>
                        )}

                        <div className="flex gap-1.5 justify-end">
                          <button type="button" className="btn btn-xs btn-outline btn-error" onClick={async () => {
                            if (!confirm('确认删除此贷款？关联的预付记录也会一并删除。')) return;
                            await deleteLoanRecord(loan.id, property!.id);
                            const updated = await getLoansForProperty(property!.id);
                            setLoans(updated);
                            setExpandedLoanId(null);
                          }}><Trash2 size={11} /> 删除</button>
                          <button type="button" className="btn btn-xs btn-outline btn-warning" onClick={() => setEditingLoan({ ...loan })}><Edit size={11} /> 编辑</button>
                        </div>
                      </div>
                    )}

                    {/* Editing form */}
                    {isExpanded && isEditing && (
                      <div className="border-t border-base-300 px-3 py-3 space-y-2 bg-warning/5">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="form-control">
                            <label className="label py-0.5"><span className="label-text text-[10px]">贷款类型</span></label>
                            <select className="select select-bordered select-xs w-full" value={editingLoan.loan_label || '房屋贷款'}
                              onChange={e => setEditingLoan({...editingLoan, loan_label: e.target.value})}>
                              {LOAN_LABEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                          </div>
                          <div className="form-control">
                            <label className="label py-0.5"><span className="label-text text-[10px]">银行</span></label>
                            <select className="select select-bordered select-xs w-full" value={editingLoan.bank_code || ''}
                              onChange={e => {
                                const bank = BANK_CODES.find(b => b.value === e.target.value);
                                setEditingLoan({...editingLoan, bank_code: e.target.value, bank_name: bank?.label || ''});
                              }}>
                              {BANK_CODES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="form-control">
                            <label className="label py-0.5"><span className="label-text text-[10px]">贷款金额 (RM)</span></label>
                            <input type="number" className="input input-bordered input-xs w-full" value={editingLoan.loan_amount || ''} onChange={e => setEditingLoan({...editingLoan, loan_amount: Number(e.target.value)})} />
                          </div>
                          <div className="form-control">
                            <label className="label py-0.5"><span className="label-text text-[10px]">当前余额 (RM)</span></label>
                            <input type="number" className="input input-bordered input-xs w-full" value={editingLoan.loan_balance || ''} onChange={e => setEditingLoan({...editingLoan, loan_balance: Number(e.target.value)})} />
                          </div>
                        </div>

                        <div className="form-control">
                          <label className="label py-0.5"><span className="label-text text-[10px]">每月还款 (RM)</span></label>
                          <input type="number" className="input input-bordered input-xs w-full" value={editingLoan.monthly_repayment || ''} onChange={e => setEditingLoan({...editingLoan, monthly_repayment: Number(e.target.value)})} />
                        </div>

                        {/* Interest rate section */}
                        <div className="bg-base-200/50 rounded-lg p-2.5 space-y-2">
                          <p className="text-[10px] font-semibold text-base-content/80">📊 利率设置</p>
                          <div className="grid grid-cols-2 gap-2">
                            {RATE_TYPE_OPTIONS.map(rt => (
                              <label key={rt.value} className={"flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer text-[10px] " + (editingLoan.rate_type === rt.value ? "border-warning bg-warning/10" : "border-base-300")}
                                onClick={() => setEditingLoan({...editingLoan, rate_type: rt.value})}>
                                <input type="radio" name="rate_type" className="radio radio-xs radio-warning" checked={editingLoan.rate_type === rt.value} onChange={() => {}} />
                                <div><b>{rt.label}</b><br/><span className="text-base-content/50">{rt.desc}</span></div>
                              </label>
                            ))}
                          </div>
                          {editingLoan.rate_type !== 'FIXED' ? (
                            <div className="grid grid-cols-3 gap-2 items-end">
                              <div className="form-control">
                                <label className="label py-0.5"><span className="label-text text-[10px]">{editingLoan.rate_type || 'SBR'} 基准 (%)</span></label>
                                <input type="number" step="0.01" className="input input-bordered input-xs w-full" value={editingLoan.base_rate || ''} onChange={e => setEditingLoan({...editingLoan, base_rate: Number(e.target.value)})} />
                              </div>
                              <div className="form-control">
                                <label className="label py-0.5"><span className="label-text text-[10px]">调整 (±) %</span></label>
                                <input type="text" inputMode="decimal" className="input input-bordered input-xs w-full" value={editingLoan.spread ?? ''} onChange={e => { const v = e.target.value; if (v === '' || v === '-' || /^-?\d*\.?\d*$/.test(v)) setEditingLoan({...editingLoan, spread: v as any}); }} onBlur={e => { const n = parseFloat(String(editingLoan.spread)); setEditingLoan({...editingLoan, spread: isNaN(n) ? 0 : n}); }} />
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] text-base-content/50">实际利率</p>
                                <p className="text-sm font-bold text-warning">
                                  {((Number(editingLoan.base_rate) || 0) + (parseFloat(String(editingLoan.spread)) || 0)).toFixed(2)}%
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="form-control">
                              <label className="label py-0.5"><span className="label-text text-[10px]">固定利率 (%)</span></label>
                              <input type="number" step="0.01" className="input input-bordered input-xs w-full" value={editingLoan.base_rate || ''} onChange={e => setEditingLoan({...editingLoan, base_rate: Number(e.target.value), spread: 0})} />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="form-control">
                            <label className="label py-0.5"><span className="label-text text-[10px]">贷款开始日期</span></label>
                            <input type="date" className="input input-bordered input-xs w-full" value={editingLoan.loan_start || ''} onChange={e => setEditingLoan({...editingLoan, loan_start: e.target.value})} />
                          </div>
                          <div className="form-control">
                            <label className="label py-0.5"><span className="label-text text-[10px]">期限（月）</span></label>
                            <input type="number" className="input input-bordered input-xs w-full" placeholder="如: 360" value={editingLoan.loan_tenure_months || ''} onChange={e => setEditingLoan({...editingLoan, loan_tenure_months: Number(e.target.value)})} />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="form-control">
                            <label className="label py-0.5"><span className="label-text text-[10px]">还款日 (1-31)</span></label>
                            <input type="number" min="1" max="31" className="input input-bordered input-xs w-full" value={editingLoan.loan_repayment_day || ''} onChange={e => setEditingLoan({...editingLoan, loan_repayment_day: Number(e.target.value)})} />
                          </div>
                          <div className="form-control">
                            <label className="label py-0.5"><span className="label-text text-[10px]">贷款户口</span></label>
                            <input className="input input-bordered input-xs w-full" value={editingLoan.loan_account_no || ''} onChange={e => setEditingLoan({...editingLoan, loan_account_no: e.target.value})} />
                          </div>
                          <div className="form-control">
                            <label className="label py-0.5"><span className="label-text text-[10px]">SI户口</span></label>
                            <input className="input input-bordered input-xs w-full" value={editingLoan.loan_si_account || ''} onChange={e => setEditingLoan({...editingLoan, loan_si_account: e.target.value})} />
                          </div>
                        </div>

                        <div className="form-control">
                          <label className="label py-0.5"><span className="label-text text-[10px]">备注</span></label>
                          <input className="input input-bordered input-xs w-full" placeholder="选填" value={editingLoan.notes || ''} onChange={e => setEditingLoan({...editingLoan, notes: e.target.value})} />
                        </div>

                        {/* Prepayment section inside edit */}
                        {loan.id && loan.loan_amount > 0 && (
                          <div className="bg-success/5 border border-success/20 rounded-lg p-2.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-semibold text-success">💰 预付本金</p>
                              <button type="button" className="btn btn-xs btn-success btn-outline gap-0.5" onClick={() => {
                                const amt = prompt('预付金额 (RM):');
                                if (!amt || Number(amt) <= 0) return;
                                const dt = prompt('预付日期 (YYYY-MM-DD):', new Date().toISOString().slice(0,10));
                                if (!dt) return;
                                const note = prompt('备注 (选填):') || '';
                                (async () => {
                                  await addLoanPayment(property!.id, Number(amt), dt, '', note, 'prepayment', loan.id);
                                  const all = await getLoanPaymentsForLoan(loan.id);
                                  setLoanPrepayMap(prev => ({ ...prev, [loan.id]: (all as any[]).filter((p: any) => p.payment_type === 'prepayment') }));
                                  const updatedLoans = await getLoansForProperty(property!.id);
                                  setLoans(updatedLoans);
                                  const ul = updatedLoans.find((l: any) => l.id === loan.id);
                                  if (ul) setEditingLoan({...editingLoan, loan_balance: ul.loan_balance});
                                })();
                              }}><Plus size={10} /> 新增</button>
                            </div>
                            {prepays.length > 0 && prepays.map((pp: any) => (
                              <div key={pp.id} className="flex items-center gap-2 bg-base-200/50 rounded px-2 py-1">
                                <span className="text-xs font-bold text-success flex-1">RM {Number(pp.amount).toLocaleString()}</span>
                                <span className="text-[10px] text-base-content/60">{pp.payment_date}</span>
                                <button type="button" className="btn btn-ghost btn-xs text-error px-0.5" onClick={async () => {
                                  await deleteLoanPayment(pp.id, property!.id, pp.amount, loan.id);
                                  const all = await getLoanPaymentsForLoan(loan.id);
                                  setLoanPrepayMap(prev => ({ ...prev, [loan.id]: (all as any[]).filter((p: any) => p.payment_type === 'prepayment') }));
                                  const updatedLoans = await getLoansForProperty(property!.id);
                                  setLoans(updatedLoans);
                                  const ul = updatedLoans.find((l: any) => l.id === loan.id);
                                  if (ul) setEditingLoan({...editingLoan, loan_balance: ul.loan_balance});
                                }}><Trash2 size={10} /></button>
                              </div>
                            ))}
                            {prepays.length > 0 && <div className="text-right"><span className="text-[10px] font-bold text-success">累计: RM {prepays.reduce((s: number, p: any) => s + Number(p.amount), 0).toLocaleString()}</span></div>}
                          </div>
                        )}

                        <div className="flex gap-1.5 justify-end pt-1">
                          <button type="button" className="btn btn-xs btn-ghost" onClick={() => setEditingLoan(null)}>取消</button>
                          <button type="button" className="btn btn-xs btn-warning" disabled={savingLoan} onClick={async () => {
                            setSavingLoan(true);
                            try {
                              await saveLoan({ ...editingLoan, property_id: property!.id });
                              const updated = await getLoansForProperty(property!.id);
                              setLoans(updated);
                              setEditingLoan(null);
                            } catch (err) { console.error(err); alert('保存失败'); }
                            setSavingLoan(false);
                          }}>{savingLoan ? '保存中...' : '保存贷款'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add new loan form */}
              {editingLoan && !editingLoan.id && (
                <div className="border border-warning border-dashed rounded-xl px-3 py-3 space-y-2 bg-warning/5">
                  <p className="text-xs font-semibold text-warning flex items-center gap-1"><Plus size={12} /> 添加新贷款</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-[10px]">贷款类型</span></label>
                      <select className="select select-bordered select-xs w-full" value={editingLoan.loan_label || '房屋贷款'}
                        onChange={e => setEditingLoan({...editingLoan, loan_label: e.target.value})}>
                        {LOAN_LABEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-[10px]">银行</span></label>
                      <select className="select select-bordered select-xs w-full" value={editingLoan.bank_code || ''}
                        onChange={e => {
                          const bank = BANK_CODES.find(b => b.value === e.target.value);
                          setEditingLoan({...editingLoan, bank_code: e.target.value, bank_name: bank?.label || ''});
                        }}>
                        {BANK_CODES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-[10px]">贷款金额 (RM)</span></label>
                      <input type="number" className="input input-bordered input-xs w-full" value={editingLoan.loan_amount || ''} onChange={e => setEditingLoan({...editingLoan, loan_amount: Number(e.target.value)})} />
                    </div>
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-[10px]">当前余额 (RM)</span></label>
                      <input type="number" className="input input-bordered input-xs w-full" value={editingLoan.loan_balance || ''} onChange={e => setEditingLoan({...editingLoan, loan_balance: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="form-control">
                    <label className="label py-0.5"><span className="label-text text-[10px]">每月还款 (RM)</span></label>
                    <input type="number" className="input input-bordered input-xs w-full" value={editingLoan.monthly_repayment || ''} onChange={e => setEditingLoan({...editingLoan, monthly_repayment: Number(e.target.value)})} />
                  </div>

                  {/* Interest rate */}
                  <div className="bg-base-200/50 rounded-lg p-2.5 space-y-2">
                    <p className="text-[10px] font-semibold text-base-content/80">📊 利率设置</p>
                    <div className="grid grid-cols-2 gap-2">
                      {RATE_TYPE_OPTIONS.map(rt => (
                        <label key={rt.value} className={"flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer text-[10px] " + (editingLoan.rate_type === rt.value ? "border-warning bg-warning/10" : "border-base-300")}
                          onClick={() => setEditingLoan({...editingLoan, rate_type: rt.value})}>
                          <input type="radio" name="new_rate_type" className="radio radio-xs radio-warning" checked={editingLoan.rate_type === rt.value} onChange={() => {}} />
                          <div><b>{rt.label}</b><br/><span className="text-base-content/50">{rt.desc}</span></div>
                        </label>
                      ))}
                    </div>
                    {editingLoan.rate_type !== 'FIXED' ? (
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div className="form-control">
                          <label className="label py-0.5"><span className="label-text text-[10px]">{editingLoan.rate_type || 'SBR'} 基准 (%)</span></label>
                          <input type="number" step="0.01" className="input input-bordered input-xs w-full" value={editingLoan.base_rate || ''} onChange={e => setEditingLoan({...editingLoan, base_rate: Number(e.target.value)})} />
                        </div>
                        <div className="form-control">
                          <label className="label py-0.5"><span className="label-text text-[10px]">调整 (±) %</span></label>
                          <input type="text" inputMode="decimal" className="input input-bordered input-xs w-full" value={editingLoan.spread ?? ''} onChange={e => { const v = e.target.value; if (v === '' || v === '-' || /^-?\d*\.?\d*$/.test(v)) setEditingLoan({...editingLoan, spread: v as any}); }} onBlur={e => { const n = parseFloat(String(editingLoan.spread)); setEditingLoan({...editingLoan, spread: isNaN(n) ? 0 : n}); }} />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-base-content/50">实际利率</p>
                          <p className="text-sm font-bold text-warning">
                            {((Number(editingLoan.base_rate) || 0) + (parseFloat(String(editingLoan.spread)) || 0)).toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="form-control">
                        <label className="label py-0.5"><span className="label-text text-[10px]">固定利率 (%)</span></label>
                        <input type="number" step="0.01" className="input input-bordered input-xs w-full" value={editingLoan.base_rate || ''} onChange={e => setEditingLoan({...editingLoan, base_rate: Number(e.target.value), spread: 0})} />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-[10px]">贷款开始日期</span></label>
                      <input type="date" className="input input-bordered input-xs w-full" value={editingLoan.loan_start || ''} onChange={e => setEditingLoan({...editingLoan, loan_start: e.target.value})} />
                    </div>
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-[10px]">期限（月）</span></label>
                      <input type="number" className="input input-bordered input-xs w-full" placeholder="如: 360" value={editingLoan.loan_tenure_months || ''} onChange={e => setEditingLoan({...editingLoan, loan_tenure_months: Number(e.target.value)})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-[10px]">还款日 (1-31)</span></label>
                      <input type="number" min="1" max="31" className="input input-bordered input-xs w-full" value={editingLoan.loan_repayment_day || ''} onChange={e => setEditingLoan({...editingLoan, loan_repayment_day: Number(e.target.value)})} />
                    </div>
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-[10px]">贷款户口</span></label>
                      <input className="input input-bordered input-xs w-full" value={editingLoan.loan_account_no || ''} onChange={e => setEditingLoan({...editingLoan, loan_account_no: e.target.value})} />
                    </div>
                    <div className="form-control">
                      <label className="label py-0.5"><span className="label-text text-[10px]">SI户口</span></label>
                      <input className="input input-bordered input-xs w-full" value={editingLoan.loan_si_account || ''} onChange={e => setEditingLoan({...editingLoan, loan_si_account: e.target.value})} />
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label py-0.5"><span className="label-text text-[10px]">备注</span></label>
                    <input className="input input-bordered input-xs w-full" placeholder="选填" value={editingLoan.notes || ''} onChange={e => setEditingLoan({...editingLoan, notes: e.target.value})} />
                  </div>

                  <div className="flex gap-1.5 justify-end pt-1">
                    <button type="button" className="btn btn-xs btn-ghost" onClick={() => setEditingLoan(null)}>取消</button>
                    <button type="button" className="btn btn-xs btn-warning" disabled={savingLoan || !editingLoan.loan_amount} onClick={async () => {
                      setSavingLoan(true);
                      try {
                        await saveLoan({ ...editingLoan, property_id: property!.id });
                        const updated = await getLoansForProperty(property!.id);
                        setLoans(updated);
                        setEditingLoan(null);
                      } catch (err) { console.error(err); alert('保存失败'); }
                      setSavingLoan(false);
                    }}>{savingLoan ? '保存中...' : '添加贷款'}</button>
                  </div>
                </div>
              )}

              {/* Add loan button */}
              {!editingLoan && property?.id && (
                <button type="button" className="btn btn-sm btn-outline btn-warning w-full gap-1" onClick={() => setEditingLoan({ loan_label: '房屋贷款', rate_type: 'SBR', base_rate: 3.0, spread: 0 })}>
                  <Plus size={14} /> 添加贷款
                </button>
              )}

              {!property?.id && (
                <div className="text-center py-4 text-base-content/50 text-xs">
                  请先保存物业基本信息，然后再添加贷款记录
                </div>
              )}
            </>
          )}

                    {/* ===== EXPENSES TAB ===== */}
          {tab === 'expenses' && (
            <>
              <div className="bg-info/5 border border-info/20 rounded-lg p-3">
                <p className="text-xs font-medium text-info flex items-center gap-1"><Receipt size={13} /> 物业相关费用</p>
                <p className="text-[10px] text-base-content mt-0.5">记录地税、门牌税、管理费等定期费用，系统会提醒到期缴费</p>
              </div>

              {/* Land Tax */}
              <div className="bg-base-200/50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold">🏛 地税 Cukai Tanah（年缴）</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">年额 (RM)</span></label>
                    <input type="number" className="input input-bordered input-sm w-full" placeholder="0" value={landTax || ''} onChange={(e) => setLandTax(Number(e.target.value))} />
                  </div>
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">到期日</span></label>
                    <div className="relative">
                      <input type="date" className="input input-bordered input-sm w-full pr-7" value={landTaxDue} onChange={(e) => setLandTaxDue(e.target.value)} />
                      {landTaxDue && <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs px-1 text-base-content/40 hover:text-error" onClick={() => setLandTaxDue('')}>✕</button>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">Hakmilik No. 地契号码</span></label>
                    <input className="input input-bordered input-sm w-full" placeholder="No. Hakmilik" value={hakmilikNo} onChange={(e) => setHakmilikNo(e.target.value)} />
                  </div>
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">账户号码 No. Akaun</span></label>
                    <input className="input input-bordered input-sm w-full" placeholder="No. Akaun Cukai Tanah" value={landTaxRef} onChange={(e) => setLandTaxRef(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Assessment Tax */}
              <div className="bg-base-200/50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold">🏠 门牌税 Cukai Taksiran（半年缴）</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">半年额 (RM)</span></label>
                    <input type="number" className="input input-bordered input-sm w-full" placeholder="0" value={assessmentTax || ''} onChange={(e) => setAssessmentTax(Number(e.target.value))} />
                  </div>
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">下次到期日</span></label>
                    <div className="relative">
                      <input type="date" className="input input-bordered input-sm w-full pr-7" value={assessmentTaxDue} onChange={(e) => setAssessmentTaxDue(e.target.value)} />
                      {assessmentTaxDue && <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs px-1 text-base-content/40 hover:text-error" onClick={() => setAssessmentTaxDue('')}>✕</button>}
                    </div>
                  </div>
                </div>
                <div className="form-control">
                  <label className="label py-0"><span className="label-text text-xs">账户号码 No. Akaun</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="No. Akaun Cukai Taksiran" value={assessmentTaxRef} onChange={(e) => setAssessmentTaxRef(e.target.value)} />
                </div>
                {assessmentTaxDue && (() => {
                  const d = new Date(assessmentTaxDue);
                  const nextNext = new Date(d);
                  nextNext.setMonth(nextNext.getMonth() + 6);
                  // Handle month-end overflow (e.g. Jan 31 + 6 months = Jul 31, not Aug 1)
                  if (nextNext.getDate() !== d.getDate()) {
                    nextNext.setDate(0); // last day of previous month
                  }
                  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
                  return (
                    <div className="flex items-center justify-between bg-info/10 rounded-lg p-2 mt-1">
                      <div className="text-xs">
                        <span className="font-medium">下次到期:</span> <span className="font-semibold">{fmt(d)}</span>
                      </div>
                      <div className="text-xs">
                        <span className="font-medium">后次到期:</span> <span className="font-semibold text-info">{fmt(nextNext)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Indah Water */}
              <div className="bg-base-200/50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold">💧 Indah Water（月缴）</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">月额 (RM)</span></label>
                    <input type="number" className="input input-bordered input-sm w-full" placeholder="0" value={indahWater || ''} onChange={(e) => setIndahWater(Number(e.target.value))} />
                  </div>
                  <div className="form-control">
                    <label className="label py-0"><span className="label-text text-xs">账户号码</span></label>
                    <input className="input input-bordered input-sm w-full" placeholder="Indah Water account no." value={indahWaterAcc} onChange={(e) => setIndahWaterAcc(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Electricity & Water Meters */}
              <div className="bg-base-200/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">⚡💧 电表 / 水表号码</p>
                  {property?.id && (
                    <button type="button" className="btn btn-xs btn-outline btn-primary" onClick={() => {
                      setEditingMeter(null);
                      setMeterForm({ meter_type: 'electricity', meter_number: '', account_holder: '', label: '', notes: '' });
                      setShowMeterForm(true);
                    }}>+ 添加</button>
                  )}
                </div>
                
                {!property?.id && <p className="text-[10px] text-info">请先保存物业后，才能添加电表/水表</p>}
                
                {showMeterForm && (
                  <div className="border border-base-300 rounded-lg p-2 space-y-2 bg-base-100">
                    <p className="text-xs font-medium">{editingMeter ? '编辑' : '添加'}表号</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="form-control">
                        <label className="label py-0"><span className="label-text text-xs">类型</span></label>
                        <select className="select select-bordered select-xs w-full" value={meterForm.meter_type} onChange={(e) => setMeterForm({ ...meterForm, meter_type: e.target.value as any })}>
                          <option value="electricity">⚡ 电表</option>
                          <option value="water">💧 水表</option>
                        </select>
                      </div>
                      <div className="form-control">
                        <label className="label py-0"><span className="label-text text-xs">表号</span></label>
                        <input className="input input-bordered input-xs w-full" placeholder="Meter number" value={meterForm.meter_number} onChange={(e) => setMeterForm({ ...meterForm, meter_number: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-xs">持有人 Account Holder</span></label>
                      <input className="input input-bordered input-xs w-full" placeholder="账户持有人姓名" value={meterForm.account_holder} onChange={(e) => setMeterForm({ ...meterForm, account_holder: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="form-control">
                        <label className="label py-0"><span className="label-text text-xs">位置标签</span></label>
                        <input className="input input-bordered input-xs w-full" placeholder="如: G楼 / 公共区域 / 电梯" value={meterForm.label} onChange={(e) => setMeterForm({ ...meterForm, label: e.target.value })} />
                      </div>
                      <div className="form-control">
                        <label className="label py-0"><span className="label-text text-xs">备注</span></label>
                        <input className="input input-bordered input-xs w-full" placeholder="备注" value={meterForm.notes} onChange={(e) => setMeterForm({ ...meterForm, notes: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" className="btn btn-xs btn-ghost" onClick={() => setShowMeterForm(false)}>取消</button>
                      <button type="button" className="btn btn-xs btn-primary" onClick={async () => {
                        if (!meterForm.meter_number.trim()) { alert('请输入表号'); return; }
                        try {
                          await saveMeter({
                            id: editingMeter?.id,
                            property_id: property!.id,
                            meter_type: meterForm.meter_type,
                            meter_number: meterForm.meter_number,
                            account_holder: meterForm.account_holder,
                            label: meterForm.label,
                            notes: meterForm.notes,
                          });
                          setMeters(await getMeters(property!.id));
                          setShowMeterForm(false);
                        } catch (err: any) {
                          console.error('保存表号失败:', err);
                          alert('保存失败: ' + (err?.message || '未知错误'));
                        }
                      }}>保存</button>
                    </div>
                  </div>
                )}
                
                {meters.length > 0 ? (
                  <div className="space-y-1">
                    {meters.map((m) => (
                      <div key={m.id} className="flex items-center justify-between bg-base-100 rounded p-2 border border-base-300">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{m.meter_type === 'electricity' ? '⚡' : '💧'}</span>
                          <div>
                            <p className="text-xs font-medium">{m.meter_number}</p>
                            {m.account_holder && <p className="text-[10px] text-base-content/70">持有人: {m.account_holder}</p>}
                            <p className="text-[10px] text-base-content/60">{m.label || (m.meter_type === 'electricity' ? '电表' : '水表')}{m.notes ? ` · ${m.notes}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button type="button" className="btn btn-xs btn-ghost" onClick={() => {
                            setEditingMeter(m);
                            setMeterForm({ meter_type: m.meter_type, meter_number: m.meter_number, account_holder: m.account_holder || '', label: m.label, notes: m.notes });
                            setShowMeterForm(true);
                          }}>✏️</button>
                          <button type="button" className="btn btn-xs btn-ghost text-error" onClick={async () => {
                            await deleteMeter(m.id);
                            setMeters(await getMeters(property!.id));
                          }}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  property?.id && <p className="text-[10px] text-base-content/50 text-center">暂无电表/水表记录</p>
                )}
              </div>

              {/* Management Fee & Company (collapsible) */}
              <div className="bg-base-200/50 rounded-lg overflow-hidden">
                <button type="button" className="w-full flex items-center justify-between p-3" onClick={() => setShowMgmt(!showMgmt)}>
                  <div>
                    <p className="text-xs font-semibold flex items-center gap-1"><Building2 size={13} /> 🏢 管理费 / 物业管理公司</p>
                    {!showMgmt && (serviceCharge > 0 || mgmtCompanyName) && (
                      <p className="text-[10px] text-base-content mt-0.5">
                        {serviceCharge > 0 ? `RM ${serviceCharge.toLocaleString()}/月` : ''}{serviceCharge > 0 && mgmtCompanyName ? ' · ' : ''}{mgmtCompanyName || ''}
                      </p>
                    )}
                  </div>
                  <ChevronDown size={14} className={`transition-transform ${showMgmt ? 'rotate-180' : ''}`} />
                </button>
                {showMgmt && (
                  <div className="px-3 pb-3 space-y-2 border-t border-base-300/50">
                    <div className="form-control mt-2">
                      <label className="label py-0"><span className="label-text text-xs">每月管理费 (RM)</span></label>
                      <input type="number" className="input input-bordered input-sm w-full" placeholder="0" value={serviceCharge || ''} onChange={(e) => setServiceCharge(Number(e.target.value))} />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-xs">管理公司名称</span></label>
                      <input className="input input-bordered input-sm w-full" placeholder="公司名称" value={mgmtCompanyName} onChange={(e) => setMgmtCompanyName(e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-xs">管理公司地址</span></label>
                      <input className="input input-bordered input-sm w-full" placeholder="公司地址" value={mgmtCompanyAddress} onChange={(e) => setMgmtCompanyAddress(e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-xs">联络电话</span></label>
                      <input className="input input-bordered input-sm w-full" placeholder="电话号码" value={mgmtCompanyPhone} onChange={(e) => setMgmtCompanyPhone(e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-xs">管理费计算方式</span></label>
                      <div className="flex gap-3 mt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="mgmtFeeType" className="radio radio-sm radio-primary" checked={mgmtFeeType === 'percentage'} onChange={() => setMgmtFeeType('percentage')} />
                          <span className="text-xs">按百分比</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="mgmtFeeType" className="radio radio-sm radio-primary" checked={mgmtFeeType === 'fixed'} onChange={() => setMgmtFeeType('fixed')} />
                          <span className="text-xs">固定金额</span>
                        </label>
                      </div>
                    </div>
                    {mgmtFeeType === 'percentage' ? (
                      <div className="form-control">
                        <label className="label py-0"><span className="label-text text-xs">管理费抽成 (%)</span></label>
                        <input type="number" step="0.1" className="input input-bordered input-sm w-full" placeholder="如: 8" value={mgmtFeePct || ''} onChange={(e) => setMgmtFeePct(Number(e.target.value))} />
                        {mgmtFeePct > 0 && (
                          <p className="text-[10px] text-base-content mt-1">
                            管理公司从租金中抽取 {mgmtFeePct}%，剩余 {(100 - mgmtFeePct).toFixed(1)}% 回到持有人账户
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="form-control">
                        <label className="label py-0"><span className="label-text text-xs">固定管理费 (RM)</span></label>
                        <input type="number" className="input input-bordered input-sm w-full" placeholder="如: 500" value={mgmtFeeAmount || ''} onChange={(e) => setMgmtFeeAmount(Number(e.target.value))} />
                        {mgmtFeeAmount > 0 && (
                          <p className="text-[10px] text-base-content mt-1">
                            每月固定管理费 RM {mgmtFeeAmount.toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ===== PURCHASE COSTS SECTION ===== */}
              <div className="bg-base-200/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold flex items-center gap-1"><DollarSign size={13} /> 💰 购房总成本 Total Acquisition Cost</p>
                  {property?.id && !showAddCost && (
                    <button type="button" className="btn btn-xs btn-primary gap-1" onClick={() => openCostForm()}>
                      <Plus size={12} /> 添加费用
                    </button>
                  )}
                </div>

                {/* Purchase Price — always visible */}
                <div className="bg-base-100 rounded-lg px-3 py-2 flex items-center justify-between border border-base-300">
                  <div>
                    <span className="text-xs font-semibold">🏠 购买价格 Purchase Price</span>
                    <p className="text-[10px] text-base-content/50">在「基本资料」标签中设定</p>
                  </div>
                  <span className="text-lg font-bold text-primary">RM {price.toLocaleString()}</span>
                </div>

                {/* RPGT Calculator button */}
                {property?.id && (actualPrice || price) > 0 && (
                  <button type="button" className="btn btn-sm btn-outline btn-warning w-full gap-1" onClick={() => {
                    setRpgtPurchaseDate(spaDate || property.loan_start || '');
                    setRpgtSellingPrice('');
                    setRpgtExtraDeductions('');
                    // Auto-detect owner type from selected owner
                    if (selectedOwner?.owner_type === 'company') {
                      setRpgtOwnerType('company');
                    } else {
                      setRpgtOwnerType('individual');
                    }
                    setShowRpgt(true);
                  }}>
                    📊 RPGT 产业盈利税计算器
                  </button>
                )}

                {!property?.id && (
                  <div className="bg-info/10 border border-info/20 rounded-lg p-2">
                    <p className="text-[10px] text-info">请先保存物业后，才能添加其他购房费用</p>
                  </div>
                )}

                {/* Add/Edit form */}
                {showAddCost && property?.id && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium">{editingCost ? '编辑费用' : '添加新费用'}</p>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-xs">类别</span></label>
                      <select className="select select-bordered select-xs w-full" value={costForm.category} onChange={(e) => setCostForm({ ...costForm, category: e.target.value as PurchaseCostCategory })}>
                        {PURCHASE_COST_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-xs">描述（选填）</span></label>
                      <input className="input input-bordered input-xs w-full" placeholder="额外说明" value={costForm.description} onChange={(e) => setCostForm({ ...costForm, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="form-control">
                        <label className="label py-0"><span className="label-text text-xs">金额 (RM)</span></label>
                        <input type="number" className="input input-bordered input-xs w-full" placeholder="0" value={costForm.amount || ''} onChange={(e) => setCostForm({ ...costForm, amount: Number(e.target.value) })} />
                      </div>
                      <div className="form-control">
                        <label className="label py-0"><span className="label-text text-xs">付款日期</span></label>
                        <div className="relative">
                          <input type="date" className="input input-bordered input-xs w-full pr-7" value={costForm.paid_date} onChange={(e) => setCostForm({ ...costForm, paid_date: e.target.value })} />
                          {costForm.paid_date && <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs px-1 text-base-content/40 hover:text-error" onClick={() => setCostForm({ ...costForm, paid_date: '' })}>✕</button>}
                        </div>
                      </div>
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-xs">付款对象</span></label>
                      <input className="input input-bordered input-xs w-full" placeholder="律师行/银行/中介" value={costForm.paid_to} onChange={(e) => setCostForm({ ...costForm, paid_to: e.target.value })} />
                    </div>
                    <div className="form-control">
                      <label className="label py-0"><span className="label-text text-xs">备注（选填）</span></label>
                      <textarea className="textarea textarea-bordered textarea-xs w-full" rows={2} placeholder="其他备注" value={costForm.notes} onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })} />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" className="btn btn-xs btn-ghost" onClick={cancelCostForm}>取消</button>
                      <button type="button" className="btn btn-xs btn-primary gap-1" disabled={savingCost || costForm.amount <= 0} onClick={handleSaveCost}>
                        {savingCost ? <span className="loading loading-spinner loading-xs" /> : <Save size={10} />}
                        {editingCost ? '更新' : '保存'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Cost list */}
                {purchaseCosts.length > 0 && (
                  <div className="space-y-1.5">
                    {purchaseCosts.map((c) => {
                      const catLabel = PURCHASE_COST_CATEGORIES.find((cat) => cat.value === c.category)?.label || c.category;
                      return (
                        <div key={c.id} className="flex items-center gap-2 bg-base-100 rounded-lg px-2 py-1.5 text-xs">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="badge badge-xs badge-info">{catLabel}</span>
                              {c.description && <span className="truncate">{c.description}</span>}
                            </div>
                            <div className="flex gap-2 text-base-content/60 mt-0.5">
                              {c.paid_date && <span>{c.paid_date}</span>}
                              {c.paid_to && <span>→ {c.paid_to}</span>}
                            </div>
                          </div>
                          <span className="font-bold text-primary shrink-0">RM {c.amount.toLocaleString()}</span>
                          <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={() => openCostForm(c)}>
                            <Edit size={11} />
                          </button>
                          <button type="button" className="btn btn-ghost btn-xs btn-square text-error/60 hover:text-error" onClick={() => setDeleteCostId(c.id)}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      );
                    })}
                    <div className="flex justify-between items-center bg-primary/5 rounded-lg px-2 py-1.5 text-xs font-semibold">
                      <span>购房费用合计</span>
                      <span className="text-primary">RM {totalPurchaseCostsAmount.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Total Acquisition Cost — always visible */}
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>📝 SPA 合同价格</span>
                      <span className="font-medium">RM {price.toLocaleString()}</span>
                    </div>
                    {actualPrice > 0 && actualPrice !== price && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span>💰 实际成交价格</span>
                          <span className="font-medium">RM {actualPrice.toLocaleString()}</span>
                        </div>
                        <div className={`flex justify-between text-xs ${actualPrice < price ? 'text-success' : 'text-error'}`}>
                          <span>🔄 台底差额</span>
                          <span className="font-medium">{actualPrice < price ? '-' : '+'}RM {Math.abs(actualPrice - price).toLocaleString()}</span>
                        </div>
                      </>
                    )}
                    {purchaseCosts.length > 0 && (
                      <div className="flex justify-between text-xs">
                        <span>📋 一次性费用 ({purchaseCosts.length}笔)</span>
                        <span className="font-medium">RM {totalPurchaseCostsAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-warning/30 pt-1.5">
                      <span className="text-xs font-bold">💰 总购入成本</span>
                      <span className="text-base font-bold text-warning">
                        RM {((actualPrice > 0 ? actualPrice : price) + totalPurchaseCostsAmount).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expense summary */}
              {(landTax > 0 || assessmentTax > 0 || serviceCharge > 0) && (
                <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-semibold">📊 年度费用摘要</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {landTax > 0 && <><span>地税（年）:</span><span className="text-right font-medium">RM {landTax.toLocaleString()}</span></>}
                    {assessmentTax > 0 && <><span>门牌税（半年×2）:</span><span className="text-right font-medium">RM {(assessmentTax * 2).toLocaleString()}</span></>}
                    {serviceCharge > 0 && <><span>管理费（月×12）:</span><span className="text-right font-medium">RM {(serviceCharge * 12).toLocaleString()}</span></>}
                    <span className="font-semibold border-t border-base-300 pt-1">年度总计:</span>
                    <span className="text-right font-bold text-error border-t border-base-300 pt-1">
                      RM {(landTax + assessmentTax * 2 + serviceCharge * 12).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== VALUATION TAB ===== */}
          {tab === 'valuation' && (
            <>
              <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                <p className="text-xs font-medium text-success flex items-center gap-1"><DollarSign size={13} /> 年度市值记录</p>
                <p className="text-[10px] text-base-content mt-0.5">记录物业的市场价值变动，追踪资产增值情况</p>
              </div>

              {/* Summary card */}
              {(property?.actual_price ?? 0) > 0 && valuations.length > 0 && (() => {
                const latestVal = valuations[0];
                const purchasePrice = property.actual_price;
                const appreciation = latestVal.market_value - purchasePrice;
                const appreciationPct = (appreciation / purchasePrice * 100).toFixed(1);
                return (
                  <div className="bg-base-200 rounded-xl p-3 space-y-1">
                    <p className="text-xs font-semibold">📊 增值概况</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span className="text-base-content/60">实际买价:</span>
                      <span className="font-medium text-right">RM {purchasePrice.toLocaleString()}</span>
                      <span className="text-base-content/60">最新市值:</span>
                      <span className="font-medium text-right text-success">RM {latestVal.market_value.toLocaleString()}</span>
                      <span className="text-base-content/60">增值:</span>
                      <span className={`font-bold text-right ${appreciation >= 0 ? 'text-success' : 'text-error'}`}>
                        {appreciation >= 0 ? '+' : ''}RM {appreciation.toLocaleString()} ({appreciation >= 0 ? '+' : ''}{appreciationPct}%)
                      </span>
                      <span className="text-base-content/60">估价日期:</span>
                      <span className="text-right">{latestVal.valuation_date}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Add/Edit form */}
              {property?.id && (
                <div className="flex justify-end gap-1.5">
                  <button type="button" className={`btn btn-xs btn-info btn-outline gap-0.5 ${aiValLoading ? 'loading' : ''}`} disabled={aiValLoading} onClick={async () => {
                    setAiValLoading(true);
                    try {
                      const token = localStorage.getItem('vencos_token');
                      const resp = await fetch('/api/ai-valuation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({
                          address: property?.address || property?.name || '',
                          propertyType: property?.type || 'residential',
                          areaSqft: property?.area_sqft || 1000,
                        }),
                      });
                      const data = await resp.json();
                      setAiValResult(data);
                      setShowAiVal(true);
                    } catch (err) {
                      console.error('AI valuation error:', err);
                      alert('AI估价搜索失败，请稍后重试');
                    }
                    setAiValLoading(false);
                  }}>
                    {aiValLoading ? '搜索中...' : '🔍 AI 估价'}
                  </button>
                  <button type="button" className="btn btn-xs btn-success btn-outline gap-0.5" onClick={() => {
                    setShowValForm(true);
                    setEditingValId(null);
                    setValAmount('');
                    setValDate(new Date().toISOString().slice(0, 10));
                    setValNotes('');
                  }}>
                    <Plus size={11} /> 新增市值记录
                  </button>
                </div>
              )}

              {showValForm && (
                <div className="bg-success/10 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold">{editingValId ? '编辑市值' : '新增市值记录'}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="form-control">
                      <label className="text-[10px] text-base-content/60 block">市值 (RM)</label>
                      <input type="number" className="input input-bordered input-sm w-full" placeholder="0" value={valAmount} onChange={e => setValAmount(e.target.value)} />
                    </div>
                    <div className="form-control">
                      <label className="text-[10px] text-base-content/60 block">估价日期</label>
                      <input type="date" className="input input-bordered input-sm w-full" value={valDate} onChange={e => setValDate(e.target.value)} />
                    </div>
                  </div>
                  <input className="input input-bordered input-sm w-full" placeholder="备注/来源 (选填)" value={valNotes} onChange={e => setValNotes(e.target.value)} />
                  <div className="flex gap-1.5 justify-end">
                    <button type="button" className="btn btn-xs btn-ghost" onClick={() => { setShowValForm(false); setEditingValId(null); }}>取消</button>
                    <button type="button" className="btn btn-xs btn-success" disabled={savingVal || !valAmount || Number(valAmount) <= 0 || !valDate} onClick={async () => {
                      setSavingVal(true);
                      try {
                        await saveValuation({
                          id: editingValId || undefined,
                          property_id: property!.id,
                          valuation_date: valDate,
                          market_value: Number(valAmount),
                          source: 'manual',
                          notes: valNotes,
                        });
                        setValuations(await getValuations(property!.id));
                        setShowValForm(false);
                        setEditingValId(null);
                      } catch (err) { console.error(err); }
                      setSavingVal(false);
                    }}>
                      {savingVal ? '保存中...' : '保存'}
                    </button>
                  </div>
                </div>
              )}

              {/* Valuation timeline */}
              {valuations.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">📅 历史记录</p>
                  {valuations.map((v, idx) => {
                    const prev = valuations[idx + 1];
                    const change = prev ? v.market_value - prev.market_value : 0;
                    const changePct = prev ? (change / prev.market_value * 100).toFixed(1) : '';
                    return (
                      <div key={v.id} className="relative pl-6 border-l-2 border-success/30 pb-3">
                        <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-success border-2 border-white"></div>
                        <div className="bg-base-200/50 rounded-lg p-2.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-success">RM {v.market_value.toLocaleString()}</span>
                              {prev && (
                                <span className={`text-[10px] ml-1.5 ${change >= 0 ? 'text-success' : 'text-error'}`}>
                                  {change >= 0 ? '↑' : '↓'} {change >= 0 ? '+' : ''}RM {change.toLocaleString()} ({change >= 0 ? '+' : ''}{changePct}%)
                                </span>
                              )}
                              {idx === 0 && <span className="badge badge-success badge-xs ml-1.5">最新</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              {idx === 0 && (
                                <button type="button" className="btn btn-ghost btn-xs px-1" onClick={() => {
                                  setEditingValId(v.id);
                                  setValAmount(String(v.market_value));
                                  setValDate(v.valuation_date);
                                  setValNotes(v.notes);
                                  setShowValForm(true);
                                }}>
                                  <Edit size={11} />
                                </button>
                              )}
                              <button type="button" className="btn btn-ghost btn-xs text-error px-1" onClick={async () => {
                                await deleteValuation(v.id);
                                setValuations(await getValuations(property!.id));
                              }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                          <p className="text-[10px] text-base-content/60 mt-0.5">
                            {v.valuation_date} · {v.source === 'manual' ? '手动输入' : v.source}
                            {v.notes && ` · ${v.notes}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                !showValForm && <p className="text-xs text-base-content/50 text-center py-4">暂无市值记录。点击上方按钮添加第一笔。</p>
              )}
            </>
          )}

          {/* ===== DOCS TAB ===== */}
          {tab === 'docs' && (
            <>
              <div className="bg-info/5 border border-info/20 rounded-lg p-3">
                <p className="text-xs font-medium text-info flex items-center gap-1">📎 物业文件库</p>
                <p className="text-[10px] text-base-content mt-0.5">上载和管理此物业的相关文件（合同、保险、产权等）</p>
              </div>

              {!property?.id ? (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                  <p className="text-[10px] text-warning">请先保存物业后，才能上载文件</p>
                </div>
              ) : (
                <>
                  {/* Upload section */}
                  <div className="bg-base-200/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1"><Upload size={13} /> 上载新文件</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="form-control">
                        <label className="label py-0"><span className="label-text text-xs">文件类型</span></label>
                        <select className="select select-bordered select-xs w-full" value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value as DocType)}>
                          {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="form-control">
                        <label className="label py-0"><span className="label-text text-xs">备注（选填）</span></label>
                        <input className="input input-bordered input-xs w-full" placeholder="文件备注" value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="file-input file-input-bordered file-input-xs flex-1"
                        onChange={handleFileSelect}
                      />
                      <button
                        className="btn btn-xs btn-primary gap-1"
                        disabled={!uploadFileData || uploadSaving}
                        onClick={handleUploadDoc}
                      >
                        {uploadSaving ? <span className="loading loading-spinner loading-xs" /> : <Upload size={12} />}
                        {uploadSaving ? (uploadProgress || '上载中...') : '上载'}
                      </button>
                    </div>
                    {uploadFileName && (
                      <p className="text-[10px] text-base-content">已选择: {uploadFileName} ({formatFileSize(uploadFileSize)})</p>
                    )}
                    {uploadError && (
                      <div className="alert alert-error py-1 px-2 text-[10px]">
                        <span>{uploadError}</span>
                        <button className="btn btn-ghost btn-xs" onClick={() => setUploadError('')}>✕</button>
                      </div>
                    )}
                    <p className="text-[10px] opacity-50">支持格式: PDF, 图片, Word 等，最大 30MB</p>
                  </div>

                  {/* Document list */}
                  {docsLoading ? (
                    <div className="text-center py-6"><span className="loading loading-spinner loading-sm" /></div>
                  ) : docs.length === 0 ? (
                    <div className="text-center py-6 text-base-content">
                      <FileText size={28} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">暂无文件</p>
                      <p className="text-[10px] mt-0.5">使用上方表单上载文件</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold">📄 文件列表 ({docs.length})</p>
                      {(() => {
                        // Group docs by category
                        const grouped: Record<string, typeof docs> = {};
                        const catForType = (dt: string) => DOC_CATEGORIES.find(c => c.types.includes(dt))?.key || 'other';
                        docs.forEach((doc) => {
                          const cat = catForType(doc.doc_type);
                          if (!grouped[cat]) grouped[cat] = [];
                          grouped[cat].push(doc);
                        });
                        return DOC_CATEGORIES.filter(cat => grouped[cat.key]?.length > 0).map(cat => (
                          <details key={cat.key} className="group" open>
                            <summary className="cursor-pointer flex items-center gap-2 py-1.5 px-2 rounded-lg bg-base-200/60 hover:bg-base-200 text-xs font-semibold select-none">
                              <ChevronDown size={12} className="transition-transform group-open:rotate-0 -rotate-90 shrink-0 text-base-content/50" />
                              <span>{cat.label}</span>
                              <span className="badge badge-xs badge-ghost ml-auto">{grouped[cat.key].length}</span>
                            </summary>
                            <div className="space-y-1.5 mt-1 ml-1">
                              {grouped[cat.key].map((doc) => {
                                const typeLabel = DOC_TYPES.find((t) => t.value === doc.doc_type)?.label || doc.doc_type;
                                return (
                                  <div key={doc.id} className="bg-base-200/50 rounded-lg px-3 py-2 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <FileText size={14} className="shrink-0 text-primary" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{doc.file_name}</p>
                                        <div className="flex items-center gap-2 text-[10px] text-base-content/60">
                                          <span className="badge badge-xs badge-ghost text-base-content/70">{typeLabel}</span>
                                          {doc.file_size > 0 && <span>{formatFileSize(doc.file_size)}</span>}
                                          <span>{doc.created_at?.slice(0, 10)}</span>
                                        </div>
                                      </div>
                                      <button className="btn btn-ghost btn-xs btn-square" onClick={() => handleDownloadDoc(doc)} title="下载">
                                        <Download size={12} />
                                      </button>
                                      <button className="btn btn-ghost btn-xs btn-square text-error/60 hover:text-error" onClick={() => setDeleteDocId(doc.id)} title="删除">
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                    {doc.notes && (
                                      <p className="text-[10px] text-base-content/60 pl-5">备注: {doc.notes}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        ));
                      })()}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ===== HISTORY TAB ===== */}
          {tab === 'history' && (
            <>
              {!property?.id ? (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                  <p className="text-[10px] text-warning">请先保存物业后，才能查看历史记录</p>
                </div>
              ) : historyLoading ? (
                <div className="text-center py-6"><span className="loading loading-spinner loading-sm" /></div>
              ) : (
                <>
                  {/* Rental Income Summary */}
                  {rentalIncome && (
                    <div className="bg-success/5 border border-success/20 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-success flex items-center gap-1">💰 租金收入总览</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs">总收租:</span>
                        <span className="text-sm font-bold text-success">
                          RM {rentalIncome.totalCollected.toLocaleString()}
                          <span className="text-[10px] font-normal text-base-content ml-1">({rentalIncome.invoiceCount}笔)</span>
                        </span>
                      </div>
                      {rentalIncome.monthlyBreakdown.length > 0 && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-medium text-base-content mt-1">月度明细:</p>
                          {rentalIncome.monthlyBreakdown.slice(0, 12).map((m) => (
                            <div key={m.month} className="flex justify-between text-[10px] text-base-content">
                              <span>{m.month}</span>
                              <span className="font-medium">RM {m.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {rentalIncome.totalCollected === 0 && rentalIncome.invoiceCount === 0 && (
                        <p className="text-[10px] text-base-content/60">暂无已付款的账单记录</p>
                      )}

                      {/* Rental Income Tax Calculator button */}
                      {rentalIncome.totalCollected > 0 && (
                        <button type="button" className="btn btn-xs btn-outline btn-warning w-full mt-1 gap-1" onClick={() => setShowRentalTax(true)}>
                          📊 租金收入税估算器
                        </button>
                      )}
                    </div>
                  )}

                  {/* History View Tabs + Floor Filter */}
                  {tenantHistoryList.length === 0 ? (
                    <div className="text-center py-6 text-base-content">
                      <Clock size={28} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">暂无历史租户记录</p>
                      <p className="text-[10px] mt-0.5">当租户被清除或替换时，系统会自动记录历史</p>
                    </div>
                  ) : (() => {
                    const reasonLabels: Record<string, string> = {
                      'replaced': '换租户', 'vacated': '退租', 'expired': '合同到期',
                      'contract_expired': '合同到期', 'early_termination': '提前退租',
                      'eviction_arrears': '欠租驱逐', 'mutual_agreement': '双方协议', 'other': '其他',
                    };
                    // Get unique floors, sort G first
                    const allFloors: string[] = Array.from(new Set(tenantHistoryList.map(h => h.floor_label || '未知')));
                    allFloors.sort((a: string, b: string) => {
                      if (a === 'G') return -1; if (b === 'G') return 1;
                      const na = parseInt(a), nb = parseInt(b);
                      if (!isNaN(na) && !isNaN(nb)) return na - nb;
                      return a.localeCompare(b);
                    });
                    // Filter by floor
                    const filtered = historyFloorFilter === 'all'
                      ? tenantHistoryList
                      : tenantHistoryList.filter(h => (h.floor_label || '未知') === historyFloorFilter);
                    // Further filter for arrears view
                    const displayList = historyView === 'arrears'
                      ? filtered.filter(h => h.arrears_amount > 0)
                      : filtered;
                    // Sort newest first
                    displayList.sort((a, b) => (b.archived_at || '').localeCompare(a.archived_at || ''));
                    // Stats
                    const totalRecords = tenantHistoryList.length;
                    const arrearsRecords = tenantHistoryList.filter(h => h.arrears_amount > 0);
                    const totalArrears = arrearsRecords.reduce((s, h) => s + h.arrears_amount, 0);

                    return (
                      <div className="space-y-2">
                        {/* View toggle tabs */}
                        <div className="flex rounded-lg bg-base-200 p-0.5">
                          <button
                            className={`flex-1 text-[11px] py-1.5 rounded-md font-medium transition-all ${historyView === 'records' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/60'}`}
                            onClick={() => setHistoryView('records')}
                          >
                            📋 租户记录 ({totalRecords})
                          </button>
                          <button
                            className={`flex-1 text-[11px] py-1.5 rounded-md font-medium transition-all ${historyView === 'arrears' ? 'bg-error text-error-content shadow-sm' : 'text-base-content/60'}`}
                            onClick={() => setHistoryView('arrears')}
                          >
                            💰 欠租追踪 ({arrearsRecords.length})
                          </button>
                        </div>

                        {/* Arrears summary (only in arrears view) */}
                        {historyView === 'arrears' && arrearsRecords.length > 0 && (
                          <div className="bg-error/5 border border-error/20 rounded-lg p-2.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-error font-medium">总欠租</span>
                              <span className="text-sm font-bold text-error">RM {totalArrears.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center mt-0.5">
                              <span className="text-[10px] text-base-content/60">涉及租户</span>
                              <span className="text-[10px] font-medium">{arrearsRecords.length} 笔</span>
                            </div>
                          </div>
                        )}

                        {/* Floor filter pills */}
                        {allFloors.length > 1 && (
                          <div className="flex flex-wrap gap-1">
                            <button
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${historyFloorFilter === 'all' ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'}`}
                              onClick={() => setHistoryFloorFilter('all')}
                            >全部</button>
                            {allFloors.map(f => {
                              const count = (historyView === 'arrears'
                                ? tenantHistoryList.filter(h => (h.floor_label || '未知') === f && h.arrears_amount > 0)
                                : tenantHistoryList.filter(h => (h.floor_label || '未知') === f)
                              ).length;
                              return (
                                <button
                                  key={f}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${historyFloorFilter === f ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'}`}
                                  onClick={() => setHistoryFloorFilter(f)}
                                >
                                  {f}楼 ({count})
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Records list */}
                        {displayList.length === 0 ? (
                          <div className="text-center py-4 text-base-content/50">
                            <p className="text-[10px]">{historyView === 'arrears' ? '此筛选条件下无欠租记录' : '此筛选条件下无历史记录'}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {displayList.map((h) => (
                              <div key={h.id} className="bg-base-100 border border-base-300 rounded-lg px-3 py-2.5 space-y-1.5 shadow-sm">
                                {/* Header: floor badge + tenant + rent */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="badge badge-sm badge-primary font-mono font-bold min-w-[2.5rem] justify-center">{h.floor_label || '?'}楼</span>
                                    <span className="text-xs font-semibold">👤 {h.tenant_name}</span>
                                  </div>
                                  {h.rent_amount > 0 && (
                                    <span className="text-xs text-primary font-bold">RM {h.rent_amount.toLocaleString()}/月</span>
                                  )}
                                </div>

                                {/* Lease period */}
                                {(h.lease_start || h.lease_end) && (
                                  <p className="text-[10px] text-base-content/60">
                                    📅 租期: {h.lease_start || '—'} → {h.lease_end || '—'}
                                  </p>
                                )}

                                {/* Vacate info row */}
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                  {h.vacate_date && (
                                    <span className="text-[10px] text-base-content/60">🗓️ 停租: {h.vacate_date}</span>
                                  )}
                                  <span className="text-[10px] text-base-content/60">
                                    📋 {reasonLabels[h.vacate_reason || h.archive_reason] || reasonLabels[h.archive_reason] || h.archive_reason}
                                  </span>
                                  {h.archived_at && (
                                    <span className="text-[10px] text-base-content/40">归档: {h.archived_at.slice(0, 10)}</span>
                                  )}
                                </div>

                                {/* Contact */}
                                {h.tenant_phone && (
                                  <p className="text-[10px] text-base-content/60">📞 {h.tenant_phone}</p>
                                )}

                                {/* Notes */}
                                {h.vacate_notes && (
                                  <p className="text-[10px] text-base-content/60 bg-base-200 rounded px-2 py-1 mt-0.5">💬 {h.vacate_notes}</p>
                                )}

                                {/* Arrears section */}
                                {h.arrears_amount > 0 && (
                                  <div className="mt-1.5 pt-1.5 border-t border-base-300">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-medium text-error">💰 欠租: RM {h.arrears_amount.toLocaleString()}</span>
                                      {arrearsMap[h.id] && (
                                        <span className={`text-[10px] font-bold ${arrearsMap[h.id].balance <= 0 ? 'text-success' : 'text-warning'}`}>
                                          {arrearsMap[h.id].balance <= 0 ? '✅ 已清' : `余欠: RM ${arrearsMap[h.id].balance.toLocaleString()}`}
                                        </span>
                                      )}
                                    </div>

                                    {/* Payment records */}
                                    {arrearsMap[h.id]?.payments?.length > 0 && (
                                      <div className="mt-1 space-y-0.5">
                                        {arrearsMap[h.id].payments.map(p => (
                                          <div key={p.id} className="flex items-center justify-between text-[10px] text-base-content/60 bg-success/5 rounded px-2 py-0.5">
                                            <span>↩️ {p.payment_date} — RM {p.amount.toLocaleString()}</span>
                                            <span>{{'bank_transfer':'转账','cash':'现金','cheque':'支票','other':'其他'}[p.payment_method] || p.payment_method}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Add payment button / form */}
                                    {arrearsMap[h.id]?.balance > 0 && (
                                      showPaymentForm === h.id ? (
                                        <div className="mt-2 space-y-1.5 bg-base-200 rounded-lg p-2">
                                          <p className="text-[10px] font-medium">记录还款</p>
                                          <input type="number" className="input input-bordered input-xs w-full" placeholder="还款金额 (RM)" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} min="0" step="0.01" />
                                          <div className="relative">
                                            <input type="date" className="input input-bordered input-xs w-full pr-7" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                                            {paymentDate && <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs px-1 text-base-content/40 hover:text-error" onClick={() => setPaymentDate('')}>✕</button>}
                                          </div>
                                          <select className="select select-bordered select-xs w-full" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                            <option value="bank_transfer">银行转账</option>
                                            <option value="cash">现金</option>
                                            <option value="cheque">支票</option>
                                            <option value="other">其他</option>
                                          </select>
                                          <input type="text" className="input input-bordered input-xs w-full" placeholder="备注（可选）" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} />
                                          <div className="flex gap-1">
                                            <button className="btn btn-xs btn-ghost flex-1" onClick={() => setShowPaymentForm(null)}>取消</button>
                                            <button className="btn btn-xs btn-primary flex-1" disabled={!paymentAmount || !paymentDate} onClick={() => handleSaveArrearsPayment(h.id, h.arrears_amount)}>保存</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button className="btn btn-xs btn-outline btn-primary mt-1 w-full" onClick={() => { setShowPaymentForm(h.id); setPaymentDate(new Date().toISOString().slice(0,10)); }}>
                                          ＋ 记录还款
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-base-300 flex gap-2 shrink-0">
          <button className="btn btn-ghost btn-sm flex-1" onClick={onClose}>取消</button>
          <button className="btn btn-primary btn-sm flex-1 gap-1" disabled={!name.trim() || saving} onClick={handleSave}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
            {isEdit ? '保存修改' : '创建物业'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/40" onClick={onClose} />

      {/* Rental Income Tax Calculator Modal */}
      {showRentalTax && rentalIncome && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowRentalTax(false)}>
          <div className="bg-white rounded-xl max-w-md w-full max-h-[85vh] overflow-auto p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">📊 租金收入税估算</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowRentalTax(false)}>✕</button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs text-base-content/60 block">估税年份</label>
                <input type="number" className="input input-bordered input-sm w-full" value={rtYear} onChange={e => setRtYear(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-base-content/60 block">其他收入 (RM, 选填)</label>
                <input type="number" className="input input-bordered input-sm w-full" placeholder="如: 薪资收入等" value={rtOtherIncome} onChange={e => setRtOtherIncome(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-base-content/60 block">个人减免 (RM)</label>
                <input type="number" className="input input-bordered input-sm w-full" value={rtReliefs} onChange={e => setRtReliefs(e.target.value)} />
                <p className="text-[10px] text-base-content/50 mt-0.5">个人减免默认 RM 9,000</p>
              </div>
            </div>

            {(() => {
              const yearStr = rtYear;
              // Filter monthly breakdown for selected year
              const yearlyRent = rentalIncome.monthlyBreakdown
                .filter(m => m.month.startsWith(yearStr))
                .reduce((s, m) => s + m.amount, 0);

              // Deductible expenses for rental
              const monthlyLoanRepayment = Number(property?.monthly_repayment || 0);
              const annualLoanInterest = (() => {
                const balance = Number(property?.loan_balance || property?.loan_amount || 0);
                const rate = Number(property?.loan_interest_rate || 0);
                return Math.round(balance * rate / 100);
              })();
              const annualPropertyTax = (Number(property?.land_tax || 0)) + (Number(property?.assessment_tax || 0) * 2);
              const annualMgmt = (Number(property?.service_charge || 0)) * 12;
              const annualInsurance = 0;
              const totalDeductible = annualLoanInterest + annualPropertyTax + annualMgmt + annualInsurance;

              const netRentalIncome = Math.max(0, yearlyRent - totalDeductible);
              const otherInc = Number(rtOtherIncome) || 0;
              const totalIncome = netRentalIncome + otherInc;
              const reliefs = Number(rtReliefs) || 9000;
              const chargeable = Math.max(0, totalIncome - reliefs);

              // Malaysia individual tax rates 2024
              const calcTax = (income: number) => {
                const brackets = [
                  { limit: 5000, rate: 0 },
                  { limit: 20000, rate: 1 },
                  { limit: 35000, rate: 3 },
                  { limit: 50000, rate: 6 },
                  { limit: 70000, rate: 11 },
                  { limit: 100000, rate: 19 },
                  { limit: 400000, rate: 25 },
                  { limit: 600000, rate: 26 },
                  { limit: 2000000, rate: 28 },
                  { limit: Infinity, rate: 30 },
                ];
                let tax = 0, prev = 0;
                for (const b of brackets) {
                  if (income <= prev) break;
                  const taxableInBracket = Math.min(income, b.limit) - prev;
                  tax += taxableInBracket * b.rate / 100;
                  prev = b.limit;
                }
                return Math.round(tax);
              };

              const taxAmount = calcTax(chargeable);
              const effectiveRate = chargeable > 0 ? (taxAmount / chargeable * 100).toFixed(1) : '0';

              return (
                <div className="bg-base-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold">{yearStr} 年估算</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-base-content/60">年度租金收入:</span>
                    <span className="text-right font-medium">RM {yearlyRent.toLocaleString()}</span>
                    {yearlyRent === 0 && <><span className="col-span-2 text-[10px] text-warning">⚠️ 该年份暂无租金收入记录</span></>}
                  </div>
                  <div className="border-t border-base-300 pt-1 grid grid-cols-2 gap-1 text-xs">
                    <span className="text-base-content/60 font-medium">可扣除费用:</span><span></span>
                    {annualLoanInterest > 0 && <><span className="text-base-content/50 pl-2">贷款利息:</span><span className="text-right">− RM {annualLoanInterest.toLocaleString()}</span></>}
                    {annualPropertyTax > 0 && <><span className="text-base-content/50 pl-2">物业税费:</span><span className="text-right">− RM {annualPropertyTax.toLocaleString()}</span></>}
                    {annualMgmt > 0 && <><span className="text-base-content/50 pl-2">管理费:</span><span className="text-right">− RM {annualMgmt.toLocaleString()}</span></>}
                    <span className="text-base-content/60">净租金收入:</span><span className="text-right font-medium">RM {netRentalIncome.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-base-300 pt-1 grid grid-cols-2 gap-1 text-xs">
                    {otherInc > 0 && <><span className="text-base-content/60">其他收入:</span><span className="text-right">+ RM {otherInc.toLocaleString()}</span></>}
                    <span className="text-base-content/60">总收入:</span><span className="text-right">RM {totalIncome.toLocaleString()}</span>
                    <span className="text-base-content/60">个人减免:</span><span className="text-right">− RM {reliefs.toLocaleString()}</span>
                    <span className="text-base-content/60">应税收入:</span><span className="text-right font-medium">RM {chargeable.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-base-300 pt-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold">预估税额:</span>
                      <span className="text-[10px] text-base-content/60 ml-1">有效税率 {effectiveRate}%</span>
                    </div>
                    <span className={`text-lg font-bold ${taxAmount > 0 ? 'text-error' : 'text-success'}`}>RM {taxAmount.toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-base-content/50">⚠️ 此为简化估算，实际报税请咨询会计师。贷款利息已按年化估算。</p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* AI Valuation Modal */}
      {showAiVal && aiValResult && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setShowAiVal(false)}>✕</button>
            <h3 className="font-bold text-base flex items-center gap-1.5">🔍 AI 估价结果</h3>
            <p className="text-xs text-base-content/60 mt-0.5">搜索区域: {aiValResult.searchArea || aiValResult.area}</p>

            {aiValResult.estimatedValue ? (
              <div className="mt-3 space-y-3">
                {/* Main estimate */}
                <div className="bg-info/10 border border-info/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-base-content/60">AI 参考市值</p>
                  <p className="text-2xl font-bold text-info mt-0.5">RM {aiValResult.estimatedValue.toLocaleString()}</p>
                  {aiValResult.medianPsf && (
                    <p className="text-xs text-base-content/60 mt-1">
                      均价 RM {aiValResult.medianPsf.toLocaleString()}/sqft × {property?.area_sqft?.toLocaleString() || '?'} sqft
                    </p>
                  )}
                  {aiValResult.method === 'median' && (
                    <p className="text-xs text-base-content/60 mt-1">基于区域成交价中位数</p>
                  )}
                </div>

                {/* Price range */}
                {aiValResult.priceRange && (
                  <div className="bg-base-200 rounded-lg p-3">
                    <p className="text-xs font-semibold mb-1">📊 区域价格范围</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span className="text-base-content/60">最低:</span>
                      <span className="text-right">RM {aiValResult.priceRange.min.toLocaleString()}</span>
                      <span className="text-base-content/60">最高:</span>
                      <span className="text-right">RM {aiValResult.priceRange.max.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* PSF data */}
                {aiValResult.psfValues && aiValResult.psfValues.length > 0 && (
                  <div className="bg-base-200 rounded-lg p-3">
                    <p className="text-xs font-semibold mb-1">💰 每平方尺均价 (PSF)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiValResult.psfValues.map((psf: number, i: number) => (
                        <span key={i} className="badge badge-sm badge-info badge-outline">RM {psf.toLocaleString()}/sqft</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compare with purchase price */}
                {property?.actual_price && property.actual_price > 0 && (
                  <div className="bg-base-200 rounded-lg p-3">
                    <p className="text-xs font-semibold mb-1">📈 与买入价对比</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span className="text-base-content/60">实际买价:</span>
                      <span className="text-right">RM {property.actual_price.toLocaleString()}</span>
                      <span className="text-base-content/60">AI 估值:</span>
                      <span className="text-right text-info font-medium">RM {aiValResult.estimatedValue.toLocaleString()}</span>
                      <span className="text-base-content/60">增值:</span>
                      {(() => {
                        const diff = aiValResult.estimatedValue - property.actual_price;
                        const pct = (diff / property.actual_price * 100).toFixed(1);
                        return <span className={`text-right font-bold ${diff >= 0 ? 'text-success' : 'text-error'}`}>
                          {diff >= 0 ? '+' : ''}RM {diff.toLocaleString()} ({diff >= 0 ? '+' : ''}{pct}%)
                        </span>;
                      })()}
                    </div>
                  </div>
                )}

                {/* Sources */}
                {aiValResult.sources && aiValResult.sources.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1">📎 数据来源 ({aiValResult.dataPoints} 条数据)</p>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                      {aiValResult.sources.map((s: any, i: number) => (
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-info hover:underline truncate">
                          {s.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="bg-warning/10 border border-warning/30 rounded p-2">
                  <p className="text-[10px] text-warning">⚠️ AI估价仅供参考，基于公开交易数据。实际市值请以专业估价师报告为准。</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-center py-6">
                <p className="text-sm text-base-content/60">😔 未找到足够的价格数据</p>
                <p className="text-xs text-base-content/40 mt-1">请尝试使用更详细的地址，或手动输入市值</p>
              </div>
            )}

            <div className="modal-action">
              <button className="btn btn-sm btn-ghost" onClick={() => setShowAiVal(false)}>关闭</button>
              {aiValResult.estimatedValue && (
                <button className="btn btn-sm btn-info" onClick={async () => {
                  try {
                    await saveValuation({
                      property_id: property!.id,
                      valuation_date: new Date().toISOString().slice(0, 10),
                      market_value: aiValResult.estimatedValue,
                      source: 'ai_search',
                      notes: `AI估价 - 区域: ${aiValResult.searchArea}${aiValResult.medianPsf ? ', PSF: RM' + aiValResult.medianPsf : ''}`,
                    });
                    setValuations(await getValuations(property!.id));
                    setShowAiVal(false);
                  } catch (err) { console.error(err); }
                }}>
                  ✅ 采纳此估值
                </button>
              )}
            </div>
          </div>
          <div className="modal-backdrop bg-black/40" onClick={() => setShowAiVal(false)}></div>
        </div>
      )}

      {/* RPGT Calculator Modal */}
      {showRpgt && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowRpgt(false)}>
          <div className="bg-white rounded-xl max-w-md w-full max-h-[85vh] overflow-auto p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">📊 RPGT 产业盈利税预测</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowRpgt(false)}>✕</button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-base-content/60 block">购入日期 (SPA签署日期)</label>
                <input type="date" className="input input-bordered input-sm w-full" value={rpgtPurchaseDate} onChange={e => setRpgtPurchaseDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-base-content/60 block">持有人类型</label>
                <select className="select select-bordered select-sm w-full" value={rpgtOwnerType} onChange={e => setRpgtOwnerType(e.target.value as any)}>
                  <option value="individual">个人 (马来西亚公民/永久居民)</option>
                  <option value="company">公司</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-base-content/60 block">预计售价 (RM)</label>
                <input type="number" className="input input-bordered input-sm w-full" placeholder="输入预计售价" value={rpgtSellingPrice} onChange={e => setRpgtSellingPrice(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-base-content/60 block">额外可扣除费用 (RM, 选填)</label>
                <input type="number" className="input input-bordered input-sm w-full" placeholder="如: 律师费、佣金等未录入的费用" value={rpgtExtraDeductions} onChange={e => setRpgtExtraDeductions(e.target.value)} />
              </div>
            </div>

            {rpgtSellingPrice && Number(rpgtSellingPrice) > 0 && rpgtPurchaseDate && (() => {
              const sellPrice = Number(rpgtSellingPrice);
              const buyPrice = price || actualPrice;
              const purchaseDt = new Date(rpgtPurchaseDate);
              const today = new Date();
              const holdingYears = (today.getTime() - purchaseDt.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
              const holdingYear = Math.ceil(holdingYears);
              const recordedDeductions = purchaseCosts.reduce((s, c) => s + (c.amount || 0), 0);
              const extraDed = Number(rpgtExtraDeductions) || 0;
              const totalDeductions = recordedDeductions + extraDed;
              const getRate = (yr: number, tp: string) => {
                if (tp === 'company') return yr <= 3 ? 30 : yr === 4 ? 20 : yr === 5 ? 15 : 10;
                return yr <= 3 ? 30 : yr === 4 ? 20 : yr === 5 ? 15 : 0;
              };
              const rate = getRate(holdingYear, rpgtOwnerType);
              const gain = sellPrice - buyPrice - totalDeductions;
              const exemption = rpgtOwnerType === 'individual' && gain > 0 ? Math.max(10000, gain * 0.1) : 0;
              const taxableGain = Math.max(0, gain - exemption);
              const rpgtTax = Math.round(taxableGain * rate / 100);

              return (
                <div className="bg-base-200 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-base-content/60">SPA价格:</span><span className="text-right font-medium">RM {buyPrice.toLocaleString()}</span>
                    <span className="text-base-content/60">预计售价:</span><span className="text-right font-medium">RM {sellPrice.toLocaleString()}</span>
                    <span className="text-base-content/60">持有年限:</span><span className="text-right">{holdingYears.toFixed(1)} 年 (第{holdingYear}年)</span>
                    <span className="text-base-content/60">适用税率:</span><span className="text-right font-bold">{rate}%</span>
                  </div>
                  <div className="border-t border-base-300 pt-1 grid grid-cols-2 gap-1 text-xs">
                    <span className="text-base-content/60">毛利:</span><span className="text-right">RM {(sellPrice - buyPrice).toLocaleString()}</span>
                    <span className="text-base-content/60">可扣除:</span><span className="text-right">− RM {totalDeductions.toLocaleString()}</span>
                    <span className="text-base-content/60">净盈利:</span><span className="text-right">RM {Math.max(0, gain).toLocaleString()}</span>
                    {exemption > 0 && <><span className="text-base-content/60">个人豁免:</span><span className="text-right">− RM {exemption.toLocaleString()}</span></>}
                    <span className="text-base-content/60">应税盈利:</span><span className="text-right">RM {taxableGain.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-base-300 pt-2 flex items-center justify-between">
                    <span className="text-sm font-bold">RPGT 税额:</span>
                    <span className={`text-lg font-bold ${rpgtTax > 0 ? 'text-error' : 'text-success'}`}>RM {rpgtTax.toLocaleString()}</span>
                  </div>
                  {rate === 0 && gain > 0 && <p className="text-[10px] text-success">✅ 持有超过5年，个人免征 RPGT</p>}
                  {gain <= 0 && <p className="text-[10px] text-info">ℹ️ 无盈利，无需缴纳 RPGT</p>}
                  {holdingYear <= 6 && gain > 0 && (
                    <div className="border-t border-base-300 pt-2">
                      <p className="text-[10px] font-semibold mb-1">📅 不同年份卖出税额对比:</p>
                      {[1,2,3,4,5,6].filter(y => y >= holdingYear).slice(0, 4).map(y => {
                        const r = getRate(y, rpgtOwnerType);
                        const tg = Math.max(0, gain - (rpgtOwnerType === 'individual' ? Math.max(10000, gain * 0.1) : 0));
                        return <div key={y} className="flex justify-between text-[10px]"><span>第{y}年 ({r}%)</span><span className={r > 0 ? 'text-error' : 'text-success'}>RM {Math.round(tg * r / 100).toLocaleString()}</span></div>;
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteCostId !== null}
        message="确定删除此购房费用记录？此操作不可撤销。"
        onConfirm={handleDeleteCostConfirm}
        onCancel={() => setDeleteCostId(null)}
      />
      <ConfirmModal
        open={deleteDocId !== null}
        message="确定删除此文件？此操作不可撤销。"
        onConfirm={handleDeleteDocConfirm}
        onCancel={() => setDeleteDocId(null)}
      />
    </div>
  );
};
