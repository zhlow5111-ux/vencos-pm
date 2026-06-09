// ========== Navigation ==========
export type Page = 'dashboard' | 'properties' | 'sales' | 'rentals' | 'clients' | 'billing' | 'maintenance' | 'settings' | 'agents';
export type PortalMode = 'admin' | 'tenant' | 'worker' | 'stakeholder';

// ========== Property ==========
export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'land';
export type PropertyStatus = 'available' | 'rented' | 'sold' | 'pending';
export type ListingType = 'sale' | 'rent' | 'both';
export type PropertyCategory = 'standalone' | 'building' | 'unit';

export interface Property {
  id: number;
  name: string;
  address: string;
  type: PropertyType;
  status: PropertyStatus;
  listing_type: ListingType;
  property_category: PropertyCategory;
  parent_id: number;
  unit_number: string;
  total_units: number;
  floor_count: number;
  price: number;
  rental_price: number;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  description: string;
  image_url: string;
  // Loan fields
  bank_code: string;
  bank_name: string;
  loan_amount: number;
  loan_balance: number;
  monthly_repayment: number;
  loan_start: string;
  loan_tenure_months: number;
  loan_interest_rate: number;
  loan_repayment_day: number;
  loan_account_no: string;     // 贷款户口号码
  loan_si_account: string;     // Standing Instruction 扣款户口号码
  // Property expenses
  land_tax: number;           // 地税 (Cukai Tanah) - annual
  land_tax_due: string;       // Due date (e.g. "2026-05-31")
  assessment_tax: number;     // 门牌税 (Cukai Taksiran) - biannual
  assessment_tax_due: string; // Next due date
  hakmilik_no: string;          // 地契号码 Hakmilik No.
  land_tax_ref: string;        // 地税参考号码
  assessment_tax_ref: string;  // 门牌税参考号码
  indah_water: number;         // Indah Water 月费
  indah_water_acc: string;     // Indah Water 账户号码
  service_charge: number;     // 管理费/服务费 - monthly
  mgmt_company_name: string;  // Management company name
  mgmt_company_phone: string; // Management company contact
  mgmt_company_address: string; // Management company address
  mgmt_fee_pct: number;       // Management fee percentage (e.g. 8 = 8%)
  mgmt_fee_type: 'percentage' | 'fixed';  // Management fee type
  mgmt_fee_amount: number;    // Fixed management fee amount (RM)
  // Ownership
  owner_id: number;
  created_at: string;
  updated_at: string;
  // Virtual fields from queries
  parent_name?: string;
  unit_count?: number;
  owner_name?: string;
  owner_type?: string;
}

export interface Meter {
  id: number;
  property_id: number;
  meter_type: 'electricity' | 'water';
  meter_number: string;
  account_holder: string;
  label: string;    // e.g., "G楼", "公共区域", "电梯"
  notes: string;
  created_at: string;
}

// ========== Floor Unit ==========
export interface FloorUnit {
  id: number;
  property_id: number;
  floor_label: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_company_reg: string;   // SSM / Company registration no
  tenant_address: string;       // Other address (if any)
  director_name: string;        // Director name
  director_ic: string;          // Director IC / passport
  director_phone: string;       // Director phone
  director_notes: string;       // Director notes/remarks
  tenant_bank_name: string;     // Bank name
  tenant_bank_account: string;  // Bank account number
  agent_name: string;       // Referring property agent name
  agent_phone: string;      // Agent phone
  agent_company: string;    // Agent company
  linked_lease_ref: string;  // 关联租约编号 (合并租约标记)
  rent_amount: number;
  deposit: number;
  utility_deposit: number;
  lease_start: string;
  lease_end: string;
  status: 'vacant' | 'occupied';
  notes: string;
  created_at: string;
  updated_at: string;
}

// ========== Owner (Company or Individual) ==========
export type OwnerType = 'company' | 'individual';

export interface Owner {
  id: number;
  name: string;
  owner_type: OwnerType;
  registration_no: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  payment_bank_name: string;
  payment_bank_account: string;
  payment_account_name: string;
  created_at: string;
  updated_at: string;
  // Virtual
  property_count?: number;
}


// ========== Agent (Property Agent / 中介) ==========
export interface Agent {
  id: number;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  company: string;
  areas: string;       // Comma-separated area names (e.g. "Jenjarom, Nilai, Klang")
  status: string;      // active | inactive
  notes: string;
  created_at: string;
  updated_at: string;
}

// ========== Unified User System ==========
export type UserRole = 'super_admin' | 'admin' | 'stakeholder' | 'tenant' | 'worker';

export interface SystemUser {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  phone: string;
  email: string;
  pin?: string;
  notes: string;
  active: number;
  must_change_pin: number;
  created_at: string;
  updated_at: string;
  // Virtual
  access_count?: number;
  last_login?: string;
}


export interface UserAccess {
  id: number;
  user_id: number;
  property_id: number;
  access_level: string;
  user_name?: string;
  property_name?: string;
}

export interface UserOwnerAccess {
  id: number;
  user_id: number;
  owner_id: number;
  access_level: string;
  owner_name?: string;
}

// ========== Loan Payment Record ==========
export interface LoanPayment {
  id: number;
  property_id: number;
  amount: number;
  payment_date: string;
  reference_no: string;
  notes: string;
  balance_after: number;
  created_at: string;
}

// ========== Document ==========
export type DocType = 'spa' | 'tenancy' | 'loan' | 'assessment_tax' | 'quit_rent' | 'insurance' | 'maintenance' | 'utility' | 'strata' | 'title' | 'other';

export interface PropertyDocument {
  id: number;
  property_id: number;
  property_name: string;
  doc_type: DocType;
  file_name: string;
  notes: string;
  linked_client_id: number;
  linked_client_name: string;
  linked_deal_id: number;
  created_at: string;
  updated_at: string;
}

// ========== Client ==========
export type ClientRole = 'buyer' | 'seller' | 'tenant' | 'landlord';
export type ClientType = 'individual' | 'company';

export interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: ClientRole;
  client_type: ClientType;
  // Individual fields
  ic_number: string;
  // Company fields
  company_name: string;
  registration_no: string; // SSM number
  // Director info (for company)
  director_name: string;
  director_ic: string;
  director_phone: string;
  director_email: string;
  // Address
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ========== Sales Pipeline ==========
export type SaleStage = 'lead' | 'viewing' | 'negotiation' | 'contract' | 'completed';

export interface SaleDeal {
  id: number;
  property_id: number;
  property_name: string;
  client_id: number;
  client_name: string;
  stage: SaleStage;
  offer_price: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ========== Rental Pipeline ==========
export type RentalStage = 'inquiry' | 'viewing' | 'agreement' | 'deposit' | 'active';

export interface RentalDeal {
  id: number;
  property_id: number;
  property_name: string;
  client_id: number;
  client_name: string;
  stage: RentalStage;
  monthly_rent: number;
  lease_start: string;
  lease_end: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ========== Invoice / Billing ==========
export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: number;
  invoice_no: string;
  property_id: number;
  property_name: string;
  tenant_id: number;
  tenant_name: string;
  amount: number;
  due_date: string;
  paid_date: string;
  status: InvoiceStatus;
  description: string;
  floor_label: string;
  billing_month: string;
  rent_amount: number;
  charges_amount: number;
  adjustments: string;
  charges_detail?: string;
  auto_generated: number;
  created_at: string;
  updated_at: string;
}

// ========== Message Template ==========
export type ChannelType = 'whatsapp' | 'email' | 'both';

export interface MessageTemplate {
  id: number;
  name: string;
  channel: ChannelType;
  subject: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ========== Billing Schedule ==========
export interface BillingSchedule {
  id: number;
  property_id: number;
  property_name: string;
  tenant_id: number;
  tenant_name: string;
  tenant_phone: string;
  tenant_email: string;
  amount: number;
  due_day: number;
  reminder_days_before: number;
  template_id: number;
  template_name: string;
  channel: ChannelType;
  active: number;
  created_at: string;
  updated_at: string;
}

// ========== Dashboard Stats ==========
export interface DashboardStats {
  totalProperties: number;
  availableProperties: number;
  activeRentals: number;
  completedSales: number;
  totalClients: number;
  pendingDeals: number;
  monthlyRevenue: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalCollected: number;
  totalLoanBalance: number;
  totalMonthlyRepayment: number;
  openTickets: number;
  inProgressTickets: number;
  totalPurchaseCosts: number;
}

// ========== Tenant History ==========
export interface TenantHistory {
  id: number;
  property_id: number;
  floor_label: string;
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
  archived_at: string;
  archive_reason: string;  // 'replaced' | 'vacated' | 'expired'
  vacate_date: string;      // actual termination date chosen by user
  vacate_reason: string;    // 'contract_expired' | 'early_termination' | 'eviction_arrears' | 'mutual_agreement' | 'other'
  vacate_notes: string;     // custom notes / reason details
  arrears_amount: number;   // outstanding rent owed at vacate time
}

export interface ArrearsPayment {
  id: number;
  history_id: number;
  amount: number;
  payment_date: string;
  payment_method: string;  // 'cash' | 'bank_transfer' | 'cheque' | 'other'
  notes: string;
  created_at: string;
}

// ========== Common ==========
export interface SelectOption {
  value: string;
  label: string;
}

export const PROPERTY_TYPES: SelectOption[] = [
  { value: 'residential', label: '住宅' },
  { value: 'commercial', label: '商业' },
  { value: 'industrial', label: '工业' },
  { value: 'land', label: '土地' },
];

export const PROPERTY_STATUSES: SelectOption[] = [
  { value: 'available', label: '空置' },
  { value: 'rented', label: '已出租' },
  { value: 'sold', label: '已售出' },
  { value: 'pending', label: '处理中' },
];

export const LISTING_TYPES: SelectOption[] = [
  { value: 'sale', label: '出售' },
  { value: 'rent', label: '出租' },
  { value: 'both', label: '出售/出租' },
];


export const DOC_TYPES: SelectOption[] = [
  { value: 'spa', label: 'SPA 买卖合同' },
  { value: 'tenancy', label: '租赁合同 Tenancy Agreement' },
  { value: 'loan', label: '银行贷款文件 Loan Document' },
  { value: 'assessment_tax', label: '门牌税 Assessment Tax' },
  { value: 'quit_rent', label: '地税 Quit Rent' },
  { value: 'insurance', label: '保险 Insurance' },
  { value: 'maintenance', label: '维修记录 Maintenance' },
  { value: 'utility', label: '水电费 Utility Bill' },
  { value: 'strata', label: '管理费 Strata/Management Fee' },
  { value: 'title', label: '物业产权 Property Title' },
  { value: 'other', label: '其他文件 Others' },
];

export const CLIENT_TYPES: SelectOption[] = [
  { value: 'individual', label: '个人 Individual' },
  { value: 'company', label: '公司 Company' },
];

export const CLIENT_ROLES: SelectOption[] = [
  { value: 'buyer', label: '买家' },
  { value: 'seller', label: '卖家' },
  { value: 'tenant', label: '租客' },
  { value: 'landlord', label: '房东' },
];

export const OWNER_TYPES: SelectOption[] = [
  { value: 'company', label: '公司持有' },
  { value: 'individual', label: '个人持有' },
];

export const USER_ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'super_admin', label: '超级管理员', desc: '全部权限，管理系统和用户' },
  { value: 'admin', label: '管理员', desc: '管理全部物业，大部分功能' },
  { value: 'stakeholder', label: '业主', desc: '查看被授权公司的全部物业资料' },
  { value: 'tenant', label: '租户', desc: '查看自己的租约和账单' },
  { value: 'worker', label: '维修人员', desc: '查看分配的维修工单' },
];


export const BANK_CODES: SelectOption[] = [
  { value: '', label: '-- 选择银行 --' },
  { value: 'MBB', label: 'Maybank (MBB)' },
  { value: 'CIMB', label: 'CIMB Bank' },
  { value: 'PBB', label: 'Public Bank (PBB)' },
  { value: 'RHB', label: 'RHB Bank' },
  { value: 'HLB', label: 'Hong Leong Bank (HLB)' },
  { value: 'AMBANK', label: 'AmBank' },
  { value: 'UOB', label: 'UOB Malaysia' },
  { value: 'OCBC', label: 'OCBC Bank' },
  { value: 'HSBC', label: 'HSBC Malaysia' },
  { value: 'SCB', label: 'Standard Chartered' },
  { value: 'AFFIN', label: 'Affin Bank' },
  { value: 'ALLIANCE', label: 'Alliance Bank' },
  { value: 'BSN', label: 'BSN' },
  { value: 'BIMB', label: 'Bank Islam (BIMB)' },
  { value: 'MUAMALAT', label: 'Bank Muamalat' },
  { value: 'AGROBANK', label: 'Agrobank' },
  { value: 'OTHER', label: '其他银行' },
];

export const SALE_STAGES: { value: SaleStage; label: string; color: string }[] = [
  { value: 'lead', label: '潜在客户', color: 'badge-info' },
  { value: 'viewing', label: '看房安排', color: 'badge-warning' },
  { value: 'negotiation', label: '价格协商', color: 'badge-secondary' },
  { value: 'contract', label: '合同签署', color: 'badge-primary' },
  { value: 'completed', label: '交易完成', color: 'badge-success' },
];

export const RENTAL_STAGES: { value: RentalStage; label: string; color: string }[] = [
  { value: 'inquiry', label: '租赁咨询', color: 'badge-info' },
  { value: 'viewing', label: '看房安排', color: 'badge-warning' },
  { value: 'agreement', label: '协议签署', color: 'badge-secondary' },
  { value: 'deposit', label: '押金支付', color: 'badge-primary' },
  { value: 'active', label: '租赁中', color: 'badge-success' },
];

export const INVOICE_STATUSES: { value: InvoiceStatus; label: string; color: string }[] = [
  { value: 'pending', label: '待付款', color: 'badge-warning' },
  { value: 'paid', label: '已付款', color: 'badge-success' },
  { value: 'overdue', label: '已逾期', color: 'badge-error' },
  { value: 'cancelled', label: '已取消', color: 'badge-ghost' },
];

export const CHANNEL_TYPES: SelectOption[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'both', label: 'WhatsApp + Email' },
];

export const REMINDER_OPTIONS: SelectOption[] = [
  { value: '0', label: '当天发送' },
  { value: '1', label: '提前1天' },
  { value: '3', label: '提前3天' },
  { value: '7', label: '提前7天' },
];

// ========== Purchase Cost ==========
export type PurchaseCostCategory = 'legal_spa' | 'legal_loan' | 'stamp_duty_spa' | 'stamp_duty_loan' | 'valuation' | 'agent_commission' | 'insurance' | 'renovation_initial' | 'other';

export interface PurchaseCost {
  id: number;
  property_id: number;
  category: PurchaseCostCategory;
  description: string;
  amount: number;
  paid_date: string;
  paid_to: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const PURCHASE_COST_CATEGORIES: { value: PurchaseCostCategory; label: string }[] = [
  { value: 'legal_spa', label: 'SPA律师费' },
  { value: 'legal_loan', label: '贷款律师费' },
  { value: 'stamp_duty_spa', label: 'SPA印花税' },
  { value: 'stamp_duty_loan', label: '贷款印花税' },
  { value: 'valuation', label: '估价费' },
  { value: 'agent_commission', label: '中介佣金' },
  { value: 'insurance', label: '保险 (MRTA/MLTA)' },
  { value: 'renovation_initial', label: '初始装修费' },
  { value: 'other', label: '其他费用' },
];

// ========== Renovation Expense ==========
export interface RenovationExpense {
  id: number;
  property_id: number;
  floor_label: string;
  description: string;
  amount: number;
  expense_date: string;
  category: string;
  contractor: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const RENOVATION_CATEGORIES: SelectOption[] = [
  { value: 'renovation', label: '装修 Renovation' },
  { value: 'repair', label: '维修 Repair' },
  { value: 'upgrade', label: '升级 Upgrade' },
  { value: 'furniture', label: '家具/电器 Furniture' },
  { value: 'other', label: '其他 Others' },
];

// ========== Recurring Charge ==========
export interface RecurringCharge {
  id: number;
  property_id: number;
  floor_label: string;
  charge_name: string;    // e.g., "Fire Insurance", "Public Liability", "Sewerage"
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annually';
  notes: string;
  created_at: string;
  updated_at: string;
}

export const COMMON_CHARGES = [
  'Arson Fire Insurance 火险',
  'Public Liabilities Maintenance 公共责任维护',
  'Sewerage & Garbage Cleaning 排污垃圾',
  'Maintenance of Lift 电梯维护',
  'Other 其他',
];

// ========== Change Log ==========
export interface ChangeLog {
  id: number;
  entity_type: string; // 'client' | 'property' | 'rental' | 'document'
  entity_id: number;
  field_name: string;
  field_label: string;
  old_value: string;
  new_value: string;
  change_source: 'auto_extract' | 'manual';
  change_reason: string;
  changed_at: string;
}

// ========== Extracted Data from Document ==========
export interface ExtractedTenancyData {
  // Property
  propertyName?: string;
  propertyAddress?: string;
  propertyType?: string;       // residential, commercial, industrial, land, mixed
  propertySubType?: string;    // e.g. "3层商铺", "Semi-D", "Bungalow"
  listingType?: string;        // sale, rent
  propertyCategory?: string;   // standalone, building, unit
  totalFloors?: number;        // e.g. 3 for "3层商铺"
  // Client
  isCompany?: boolean;
  tenantName?: string;
  tenantIc?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  companyName?: string;
  registrationNo?: string;
  directorName?: string;
  directorIc?: string;
  // Deal
  monthlyRent?: number;
  leaseStart?: string;
  leaseEnd?: string;
  deposit?: number;
  // Landlord
  landlordName?: string;
  landlordIc?: string;
  // Meta
  rawText?: string;
  confidence: number; // 0-100
  extractedFields: string[]; // list of fields that were successfully extracted
}

// ========== Maintenance Ticket ==========
export type TicketCategory = 'plumbing' | 'electrical' | 'aircon' | 'structural' | 'painting' | 'cleaning' | 'pest_control' | 'appliance' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'submitted' | 'acknowledged' | 'in_progress' | 'completed' | 'cancelled';

export interface MaintenanceTicket {
  id: number;
  property_id: number;
  property_name: string;
  tenant_id: number;
  tenant_name: string;
  tenant_phone: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  title: string;
  description: string;
  photos: string;
  assigned_worker_id: number;
  worker_name: string;
  admin_notes: string;
  submitted_at: string;
  acknowledged_at: string;
  started_at: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

// ========== Worker ==========
export interface Worker {
  id: number;
  name: string;
  phone: string;
  email: string;
  specialty: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
  active_tickets?: number;
}

export const TICKET_CATEGORIES: SelectOption[] = [
  { value: 'plumbing', label: '水管/排水 Plumbing' },
  { value: 'electrical', label: '电路/电器 Electrical' },
  { value: 'aircon', label: '冷气 Air-Cond' },
  { value: 'structural', label: '结构/墙壁 Structural' },
  { value: 'painting', label: '油漆/粉刷 Painting' },
  { value: 'cleaning', label: '清洁 Cleaning' },
  { value: 'pest_control', label: '害虫防治 Pest Control' },
  { value: 'appliance', label: '家电维修 Appliance' },
  { value: 'other', label: '其他 Others' },
];

export const TICKET_PRIORITIES: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'low', label: '低', color: 'badge-info' },
  { value: 'medium', label: '中', color: 'badge-warning' },
  { value: 'high', label: '高', color: 'badge-error' },
  { value: 'urgent', label: '紧急', color: 'badge-error' },
];

export const TICKET_STATUSES: { value: TicketStatus; label: string; color: string }[] = [
  { value: 'submitted', label: '已提交', color: 'badge-info' },
  { value: 'acknowledged', label: '已确认', color: 'badge-warning' },
  { value: 'in_progress', label: '维修中', color: 'badge-primary' },
  { value: 'completed', label: '已完成', color: 'badge-success' },
  { value: 'cancelled', label: '已取消', color: 'badge-ghost' },
];

export const WORKER_SPECIALTIES: SelectOption[] = [
  { value: 'plumbing', label: '水管工 Plumber' },
  { value: 'electrical', label: '电工 Electrician' },
  { value: 'aircon', label: '冷气技师 Air-Cond Tech' },
  { value: 'general', label: '综合维修 General' },
  { value: 'painting', label: '油漆工 Painter' },
  { value: 'cleaning', label: '清洁工 Cleaner' },
  { value: 'pest_control', label: '除虫 Pest Control' },
  { value: 'other', label: '其他 Other' },
];
