import { Property, FloorUnit, Client, SaleDeal, RentalDeal, DashboardStats, Invoice, MessageTemplate, BillingSchedule, PropertyDocument, Owner, SystemUser, UserAccess, LoanPayment, MaintenanceTicket, Worker, ChangeLog, RenovationExpense, PurchaseCost, RecurringCharge, TenantHistory, ArrearsPayment, Meter, Agent, PenaltyConfig } from '../types';
import { escapeSQL, nowISO, generateId } from './helpers';

// ========== Init DB ==========
const SCHEMA_VERSION = 29;

export async function initDB(): Promise<void> {
  // Step 1: Check schema version (2 SQL calls)
  await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS vc_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  const verRows = await window.tasklet.sqlQuery(`SELECT value FROM vc_meta WHERE key='schema_version'`);
  const currentVer = Number((verRows[0] as any)?.value || 0);
  if (currentVer >= SCHEMA_VERSION) return; // Already up-to-date

  // Step 2: Fresh install — create all tables with all columns, then return
  if (currentVer < 1) {
    const tables = [
      `CREATE TABLE IF NOT EXISTS vc_properties (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'residential', status TEXT NOT NULL DEFAULT 'available',
        listing_type TEXT NOT NULL DEFAULT 'sale', property_category TEXT NOT NULL DEFAULT 'standalone',
        parent_id INTEGER NOT NULL DEFAULT 0, unit_number TEXT NOT NULL DEFAULT '',
        total_units INTEGER NOT NULL DEFAULT 0, price REAL NOT NULL DEFAULT 0,
        rental_price REAL NOT NULL DEFAULT 0, bedrooms INTEGER NOT NULL DEFAULT 0,
        bathrooms INTEGER NOT NULL DEFAULT 0, area_sqft REAL NOT NULL DEFAULT 0,
        description TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '',
        bank_code TEXT NOT NULL DEFAULT '', bank_name TEXT NOT NULL DEFAULT '',
        loan_amount REAL NOT NULL DEFAULT 0, loan_balance REAL NOT NULL DEFAULT 0,
        monthly_repayment REAL NOT NULL DEFAULT 0, loan_start TEXT NOT NULL DEFAULT '',
        loan_tenure_months INTEGER NOT NULL DEFAULT 0, loan_interest_rate REAL NOT NULL DEFAULT 0,
        loan_account_no TEXT NOT NULL DEFAULT '', loan_si_account TEXT NOT NULL DEFAULT '',
        land_tax_ref TEXT NOT NULL DEFAULT '', assessment_tax_ref TEXT NOT NULL DEFAULT '',
        hakmilik_no TEXT NOT NULL DEFAULT '',
        indah_water REAL NOT NULL DEFAULT 0, indah_water_acc TEXT NOT NULL DEFAULT '',
        floor_count INTEGER NOT NULL DEFAULT 1, land_tax REAL NOT NULL DEFAULT 0,
        land_tax_due TEXT NOT NULL DEFAULT '', assessment_tax REAL NOT NULL DEFAULT 0,
        assessment_tax_due TEXT NOT NULL DEFAULT '', service_charge REAL NOT NULL DEFAULT 0,
        mgmt_company_name TEXT NOT NULL DEFAULT '', mgmt_company_phone TEXT NOT NULL DEFAULT '',
        mgmt_fee_pct REAL NOT NULL DEFAULT 0, mgmt_company_address TEXT NOT NULL DEFAULT '',
        mgmt_fee_type TEXT NOT NULL DEFAULT 'percentage', mgmt_fee_amount REAL NOT NULL DEFAULT 0,
        loan_repayment_day INTEGER NOT NULL DEFAULT 0,
        owner_id INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_clients (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'buyer',
        client_type TEXT NOT NULL DEFAULT 'individual', ic_number TEXT NOT NULL DEFAULT '',
        company_name TEXT NOT NULL DEFAULT '', registration_no TEXT NOT NULL DEFAULT '',
        director_name TEXT NOT NULL DEFAULT '', director_ic TEXT NOT NULL DEFAULT '',
        director_phone TEXT NOT NULL DEFAULT '', director_email TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_sales (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL, client_id INTEGER NOT NULL,
        stage TEXT NOT NULL DEFAULT 'lead', offer_price REAL NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_rentals (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL, client_id INTEGER NOT NULL,
        stage TEXT NOT NULL DEFAULT 'inquiry', monthly_rent REAL NOT NULL DEFAULT 0,
        lease_start TEXT NOT NULL DEFAULT '', lease_end TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_invoices (
        id INTEGER PRIMARY KEY, invoice_no TEXT NOT NULL DEFAULT '',
        property_id INTEGER NOT NULL DEFAULT 0, tenant_id INTEGER NOT NULL DEFAULT 0,
        amount REAL NOT NULL DEFAULT 0, due_date TEXT NOT NULL DEFAULT '',
        paid_date TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
        description TEXT NOT NULL DEFAULT '',
        floor_label TEXT NOT NULL DEFAULT '', billing_month TEXT NOT NULL DEFAULT '',
        rent_amount REAL NOT NULL DEFAULT 0, charges_amount REAL NOT NULL DEFAULT 0,
        adjustments TEXT NOT NULL DEFAULT '[]',
        charges_detail TEXT NOT NULL DEFAULT '[]',
        auto_generated INTEGER NOT NULL DEFAULT 0,
        merged_data TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_message_templates (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'both',
        subject TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_billing_schedules (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL DEFAULT 0,
        tenant_id INTEGER NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0,
        due_day INTEGER NOT NULL DEFAULT 1, reminder_days_before INTEGER NOT NULL DEFAULT 3,
        template_id INTEGER NOT NULL DEFAULT 0, channel TEXT NOT NULL DEFAULT 'both',
        active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_documents (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL DEFAULT 0,
        doc_type TEXT NOT NULL DEFAULT 'other', file_name TEXT NOT NULL DEFAULT '',
        file_data TEXT NOT NULL DEFAULT '', file_size INTEGER NOT NULL DEFAULT 0,
        file_mime TEXT NOT NULL DEFAULT '', floor_label TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        linked_client_id INTEGER NOT NULL DEFAULT 0, linked_deal_id INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_owners (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, owner_type TEXT NOT NULL DEFAULT 'individual',
        registration_no TEXT NOT NULL DEFAULT '', contact_person TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
        payment_bank_name TEXT NOT NULL DEFAULT '', payment_bank_account TEXT NOT NULL DEFAULT '',
        payment_account_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_user_access (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, property_id INTEGER NOT NULL,
        access_level TEXT NOT NULL DEFAULT 'readonly', UNIQUE(user_id, property_id)
      )`,
      `CREATE TABLE IF NOT EXISTS vc_user_owner_access (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, owner_id INTEGER NOT NULL,
        access_level TEXT NOT NULL DEFAULT 'readonly', UNIQUE(user_id, owner_id)
      )`,
      `CREATE TABLE IF NOT EXISTS vc_loan_payments (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL, amount REAL NOT NULL DEFAULT 0,
        payment_date TEXT NOT NULL DEFAULT '', reference_no TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '', balance_after REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_loans (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL,
        loan_label TEXT NOT NULL DEFAULT '房屋贷款',
        bank_code TEXT NOT NULL DEFAULT '', bank_name TEXT NOT NULL DEFAULT '',
        loan_amount REAL NOT NULL DEFAULT 0, loan_balance REAL NOT NULL DEFAULT 0,
        monthly_repayment REAL NOT NULL DEFAULT 0,
        rate_type TEXT NOT NULL DEFAULT 'SBR',
        base_rate REAL NOT NULL DEFAULT 0, spread REAL NOT NULL DEFAULT 0,
        effective_rate REAL NOT NULL DEFAULT 0,
        loan_start TEXT NOT NULL DEFAULT '', loan_tenure_months INTEGER NOT NULL DEFAULT 0,
        loan_repayment_day INTEGER NOT NULL DEFAULT 0,
        loan_account_no TEXT NOT NULL DEFAULT '', loan_si_account TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_workers (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '', specialty TEXT NOT NULL DEFAULT 'general',
        status TEXT NOT NULL DEFAULT 'active', notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_maintenance_tickets (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL DEFAULT 0,
        tenant_id INTEGER NOT NULL DEFAULT 0, category TEXT NOT NULL DEFAULT 'other',
        priority TEXT NOT NULL DEFAULT 'medium', status TEXT NOT NULL DEFAULT 'submitted',
        title TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
        photos TEXT NOT NULL DEFAULT '[]', assigned_worker_id INTEGER NOT NULL DEFAULT 0,
        admin_notes TEXT NOT NULL DEFAULT '', submitted_at TEXT NOT NULL DEFAULT '',
        acknowledged_at TEXT NOT NULL DEFAULT '', started_at TEXT NOT NULL DEFAULT '',
        completed_at TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_change_logs (
        id INTEGER PRIMARY KEY, entity_type TEXT NOT NULL DEFAULT '',
        entity_id INTEGER NOT NULL DEFAULT 0, field_name TEXT NOT NULL DEFAULT '',
        field_label TEXT NOT NULL DEFAULT '', old_value TEXT NOT NULL DEFAULT '',
        new_value TEXT NOT NULL DEFAULT '', change_source TEXT NOT NULL DEFAULT 'manual',
        change_reason TEXT NOT NULL DEFAULT '', changed_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_floor_units (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL,
        floor_label TEXT NOT NULL DEFAULT '', tenant_name TEXT NOT NULL DEFAULT '',
        tenant_phone TEXT NOT NULL DEFAULT '', rent_amount REAL NOT NULL DEFAULT 0,
        deposit REAL NOT NULL DEFAULT 0, utility_deposit REAL NOT NULL DEFAULT 0,
        lease_start TEXT NOT NULL DEFAULT '', lease_end TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'vacant', notes TEXT NOT NULL DEFAULT '',
        tenant_company_reg TEXT NOT NULL DEFAULT '', tenant_address TEXT NOT NULL DEFAULT '',
        director_name TEXT NOT NULL DEFAULT '', director_ic TEXT NOT NULL DEFAULT '',
        director_phone TEXT NOT NULL DEFAULT '', director_notes TEXT NOT NULL DEFAULT '',
        tenant_bank_name TEXT NOT NULL DEFAULT '', tenant_bank_account TEXT NOT NULL DEFAULT '',
        agent_name TEXT NOT NULL DEFAULT '', agent_phone TEXT NOT NULL DEFAULT '',
        agent_company TEXT NOT NULL DEFAULT '',
        linked_lease_ref TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_renovation_expenses (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL,
        description TEXT NOT NULL DEFAULT '', amount REAL NOT NULL DEFAULT 0,
        expense_date TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
        contractor TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
        floor_label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS vc_purchase_costs (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL,
        category TEXT NOT NULL DEFAULT 'other', description TEXT NOT NULL DEFAULT '',
        amount REAL NOT NULL DEFAULT 0, paid_date TEXT NOT NULL DEFAULT '',
        paid_to TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS vc_recurring_charges (
        id INTEGER PRIMARY KEY,
        property_id INTEGER NOT NULL,
        charge_name TEXT NOT NULL DEFAULT '',
        amount REAL NOT NULL DEFAULT 0,
        frequency TEXT NOT NULL DEFAULT 'monthly',
        floor_label TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS vc_tenant_history (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL,
        floor_label TEXT NOT NULL DEFAULT '', tenant_name TEXT NOT NULL DEFAULT '',
        tenant_phone TEXT NOT NULL DEFAULT '', tenant_company_reg TEXT NOT NULL DEFAULT '',
        tenant_address TEXT NOT NULL DEFAULT '', director_name TEXT NOT NULL DEFAULT '',
        director_ic TEXT NOT NULL DEFAULT '', director_phone TEXT NOT NULL DEFAULT '',
        director_notes TEXT NOT NULL DEFAULT '', tenant_bank_name TEXT NOT NULL DEFAULT '',
        tenant_bank_account TEXT NOT NULL DEFAULT '', agent_name TEXT NOT NULL DEFAULT '',
        agent_phone TEXT NOT NULL DEFAULT '', agent_company TEXT NOT NULL DEFAULT '',
        rent_amount REAL NOT NULL DEFAULT 0, deposit REAL NOT NULL DEFAULT 0,
        utility_deposit REAL NOT NULL DEFAULT 0, lease_start TEXT NOT NULL DEFAULT '',
        lease_end TEXT NOT NULL DEFAULT '', archived_at TEXT NOT NULL,
        archive_reason TEXT NOT NULL DEFAULT 'vacated',
        vacate_date TEXT NOT NULL DEFAULT '',
        vacate_reason TEXT NOT NULL DEFAULT 'vacated',
        vacate_notes TEXT NOT NULL DEFAULT '',
        arrears_amount REAL NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS vc_arrears_payments (
        id INTEGER PRIMARY KEY,
        history_id INTEGER NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        payment_date TEXT NOT NULL DEFAULT '',
        payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS vc_agents (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
        whatsapp TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
        company TEXT NOT NULL DEFAULT '', areas TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active', notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS vc_meters (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL,
        meter_type TEXT NOT NULL DEFAULT 'electricity',
        meter_number TEXT NOT NULL DEFAULT '', label TEXT NOT NULL DEFAULT '',
        account_holder TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS vc_users (
        id INTEGER PRIMARY KEY, username TEXT NOT NULL DEFAULT '',
        pin TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'admin',
        phone TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1, must_change_pin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS vc_whatsapp_config (
        id INTEGER PRIMARY KEY, phone_number_id TEXT NOT NULL DEFAULT '',
        access_token TEXT NOT NULL DEFAULT '', business_id TEXT NOT NULL DEFAULT '',
        webhook_verify_token TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS vc_message_log (
        id INTEGER PRIMARY KEY, recipient_phone TEXT NOT NULL DEFAULT '',
        recipient_name TEXT NOT NULL DEFAULT '', message_type TEXT NOT NULL DEFAULT 'invoice',
        template_name TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'queued', whatsapp_message_id TEXT NOT NULL DEFAULT '',
        error_message TEXT NOT NULL DEFAULT '', property_id INTEGER NOT NULL DEFAULT 0,
        invoice_id INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT ''
      )`,
    ];
    for (const ddl of tables) {
      await window.tasklet.sqlExec(ddl);
    }
    // Seed default admin
    try {
      await window.tasklet.sqlExec(`INSERT INTO vc_users (id, username, pin, role, name, email, notes, active, must_change_pin, created_at, updated_at) VALUES (1, 'admin', '1234', 'super_admin', '管理员', '', '', 1, 0, '${nowISO()}', '${nowISO()}')`);
    } catch {}
    // Seed default templates
    const now = nowISO();
    try {
      await window.tasklet.sqlExec(`
        INSERT INTO vc_message_templates (id, name, channel, subject, content, created_at, updated_at) VALUES
        (1, '租金提醒', 'both', '租金到期提醒 - {property_name}', '尊敬的 {tenant_name},\n\n提醒您，物业 {property_name} 的租金 RM{amount} 将于 {due_date} 到期。\n\n请及时缴纳租金，谢谢！\n\nVencos Property Management', '${now}', '${now}'),
        (2, '账单通知', 'both', '月度账单 - {property_name}', '尊敬的 {tenant_name},\n\n以下是您本月的租金账单：\n物业：{property_name}\n金额：RM{amount}\n到期日：{due_date}\n\n请在到期日前完成付款，谢谢！\n\nVencos Property Management', '${now}', '${now}'),
        (3, '逾期提醒', 'both', '租金逾期通知 - {property_name}', '尊敬的 {tenant_name},\n\n您物业 {property_name} 的租金 RM{amount}（到期日：{due_date}）已逾期未付。\n\n请尽快处理，如有疑问请联系我们。\n\nVencos Property Management', '${now}', '${now}'),
        (4, '收款确认', 'both', '付款确认 - {property_name}', '尊敬的 {tenant_name},\n\n已确认收到您物业 {property_name} 的租金 RM{amount}。\n\n感谢您的及时付款！\n\nVencos Property Management', '${now}', '${now}')
      `);
    } catch {}
    await window.tasklet.sqlExec(`INSERT OR REPLACE INTO vc_meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}')`);
    return; // Fresh install complete — no migrations needed
  }

  // Step 3: Existing database — only run version-specific migrations
  // Tables already exist, only add missing columns for the gap between currentVer and SCHEMA_VERSION

  if (currentVer < 9) {
    // Very old DB: add all missing tables and columns
    try { await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS vc_users (id INTEGER PRIMARY KEY, username TEXT NOT NULL DEFAULT '', pin TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'admin', phone TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT '')`); } catch {}
    try { await window.tasklet.sqlExec(`INSERT INTO vc_users (id, username, pin, role, name, created_at) VALUES (1, 'admin', '1234', 'admin', '管理员', '${nowISO()}')`); } catch {}
    // Old ALTER TABLE migrations for pre-v9 columns
    const oldAlters = [
      `ALTER TABLE vc_properties ADD COLUMN floor_count INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE vc_properties ADD COLUMN land_tax REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_properties ADD COLUMN land_tax_due TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_properties ADD COLUMN assessment_tax REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_properties ADD COLUMN assessment_tax_due TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_properties ADD COLUMN service_charge REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_properties ADD COLUMN mgmt_company_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_properties ADD COLUMN mgmt_company_phone TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_properties ADD COLUMN mgmt_fee_pct REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_properties ADD COLUMN mgmt_company_address TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_properties ADD COLUMN mgmt_fee_type TEXT NOT NULL DEFAULT 'percentage'`,
      `ALTER TABLE vc_properties ADD COLUMN mgmt_fee_amount REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_properties ADD COLUMN loan_repayment_day INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_properties ADD COLUMN loan_account_no TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_properties ADD COLUMN loan_si_account TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_properties ADD COLUMN land_tax_ref TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_properties ADD COLUMN assessment_tax_ref TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_properties ADD COLUMN indah_water REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_properties ADD COLUMN indah_water_acc TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_properties ADD COLUMN hakmilik_no TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_floor_units ADD COLUMN deposit REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_floor_units ADD COLUMN utility_deposit REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_floor_units ADD COLUMN tenant_company_reg TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_floor_units ADD COLUMN tenant_address TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_floor_units ADD COLUMN director_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_floor_units ADD COLUMN director_ic TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_floor_units ADD COLUMN director_phone TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_floor_units ADD COLUMN director_notes TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_floor_units ADD COLUMN tenant_bank_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_floor_units ADD COLUMN tenant_bank_account TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_floor_units ADD COLUMN agent_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_floor_units ADD COLUMN agent_phone TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_floor_units ADD COLUMN agent_company TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_documents ADD COLUMN file_data TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_documents ADD COLUMN file_mime TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_documents ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_documents ADD COLUMN floor_label TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_tenant_history ADD COLUMN vacate_date TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_tenant_history ADD COLUMN vacate_reason TEXT NOT NULL DEFAULT 'vacated'`,
      `ALTER TABLE vc_tenant_history ADD COLUMN vacate_notes TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_tenant_history ADD COLUMN arrears_amount REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_invoices ADD COLUMN floor_label TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_invoices ADD COLUMN billing_month TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE vc_invoices ADD COLUMN rent_amount REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_invoices ADD COLUMN charges_amount REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE vc_invoices ADD COLUMN auto_generated INTEGER NOT NULL DEFAULT 0`,
    ];
    for (const sql of oldAlters) {
      try { await window.tasklet.sqlExec(sql); } catch {}
    }
    // Migrate old floor labels
    try {
      const oldFloors = await window.tasklet.sqlQuery(`SELECT id, floor_label FROM vc_floor_units WHERE floor_label LIKE '%楼'`);
      for (const f of oldFloors as any[]) {
        const num = parseInt((f as any).floor_label);
        if (!isNaN(num)) {
          const newLabel = num === 1 ? 'G' : String(num - 1);
          await window.tasklet.sqlExec(`UPDATE vc_floor_units SET floor_label='${newLabel}' WHERE id=${(f as any).id}`);
        }
      }
    } catch {}
    // Seed templates if empty
    try {
      const existing = await window.tasklet.sqlQuery('SELECT COUNT(*) as cnt FROM vc_message_templates');
      if (Number((existing[0] as any)?.cnt || 0) === 0) {
        const now = nowISO();
        await window.tasklet.sqlExec(`INSERT INTO vc_message_templates (id, name, channel, subject, content, created_at, updated_at) VALUES (1, '租金提醒', 'both', '租金到期提醒', '提醒租金到期', '${now}', '${now}'), (2, '账单通知', 'both', '月度账单', '月度账单', '${now}', '${now}'), (3, '逾期提醒', 'both', '逾期通知', '租金逾期', '${now}', '${now}'), (4, '收款确认', 'both', '付款确认', '已收到付款', '${now}', '${now}')`);
      }
    } catch {}
  }

  if (currentVer < 10) {
    try { await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS vc_whatsapp_config (id INTEGER PRIMARY KEY, phone_number_id TEXT NOT NULL DEFAULT '', access_token TEXT NOT NULL DEFAULT '', business_id TEXT NOT NULL DEFAULT '', webhook_verify_token TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT '')`); } catch {}
    try { await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS vc_message_log (id INTEGER PRIMARY KEY, recipient_phone TEXT NOT NULL DEFAULT '', recipient_name TEXT NOT NULL DEFAULT '', message_type TEXT NOT NULL DEFAULT 'invoice', template_name TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'queued', whatsapp_message_id TEXT NOT NULL DEFAULT '', error_message TEXT NOT NULL DEFAULT '', property_id INTEGER NOT NULL DEFAULT 0, invoice_id INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT '')`); } catch {}
  }

  if (currentVer < 11) {
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_renovation_expenses ADD COLUMN floor_label TEXT NOT NULL DEFAULT ''`); } catch {}
  }

  if (currentVer < 12) {
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_meters ADD COLUMN account_holder TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_properties ADD COLUMN hakmilik_no TEXT NOT NULL DEFAULT ''`); } catch {}
  }

  if (currentVer < 13) {
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_recurring_charges ADD COLUMN floor_label TEXT NOT NULL DEFAULT ''`); } catch {}
  }

  if (currentVer < 14) {
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_invoices ADD COLUMN adjustments TEXT NOT NULL DEFAULT '[]'`); } catch {}
  }

  if (currentVer < 15) {
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_invoices ADD COLUMN charges_detail TEXT NOT NULL DEFAULT '[]'`); } catch {}
  }

  if (currentVer < 16) {
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_owners ADD COLUMN payment_bank_name TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_owners ADD COLUMN payment_bank_account TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_owners ADD COLUMN payment_account_name TEXT NOT NULL DEFAULT ''`); } catch {}
  }

  if (currentVer < 17) {
    // Expand vc_users with email, notes, must_change_pin, updated_at
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_users ADD COLUMN email TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_users ADD COLUMN notes TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_users ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0`); } catch {}
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_users ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_users ADD COLUMN last_login TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_users ADD COLUMN session_revoked_at TEXT NOT NULL DEFAULT ''`); } catch {}
    // Create vc_user_access table (replaces vc_stakeholder_access)
    try { await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS vc_user_access (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, property_id INTEGER NOT NULL, access_level TEXT NOT NULL DEFAULT 'readonly', UNIQUE(user_id, property_id))`); } catch {}
    // Migrate stakeholder data → users + user_access
    try {
      const stakeholders = await window.tasklet.sqlQuery(`SELECT * FROM vc_stakeholders`);
      for (const s of stakeholders as any[]) {
        const roleMap: Record<string, string> = { admin: 'admin', manager: 'admin', viewer: 'stakeholder' };
        const newRole = roleMap[String(s.role)] || 'stakeholder';
        const uid = generateId();
        try {
          await window.tasklet.sqlExec(`INSERT INTO vc_users (id, username, pin, role, phone, name, email, notes, active, must_change_pin, created_at, updated_at) VALUES (${uid}, '${escapeSQL(String(s.phone || ''))}', '1234', '${newRole}', '${escapeSQL(String(s.phone || ''))}', '${escapeSQL(String(s.name))}', '${escapeSQL(String(s.email || ''))}', '${escapeSQL(String(s.notes || ''))}', 1, 1, '${String(s.created_at || nowISO())}', '${nowISO()}')`);
          // Copy access records
          const accessRows = await window.tasklet.sqlQuery(`SELECT * FROM vc_stakeholder_access WHERE stakeholder_id=${s.id}`);
          for (const a of accessRows as any[]) {
            try { await window.tasklet.sqlExec(`INSERT INTO vc_user_access (id, user_id, property_id, access_level) VALUES (${generateId()}, ${uid}, ${a.property_id}, '${a.access_level}')`); } catch {}
          }
        } catch {}
      }
    } catch {}
    // Update default admin to super_admin
    try { await window.tasklet.sqlExec(`UPDATE vc_users SET role='super_admin' WHERE id=1 AND role='admin'`); } catch {}
  }

  // === V18: Add tenant_phone to maintenance_tickets ===
  if (currentVer < 18) {
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_maintenance_tickets ADD COLUMN tenant_phone TEXT NOT NULL DEFAULT ''`); } catch {}
    // Backfill tenant_phone from vc_clients for existing tickets
    try {
      await window.tasklet.sqlExec(`UPDATE vc_maintenance_tickets SET tenant_phone = COALESCE((SELECT phone FROM vc_clients WHERE id = vc_maintenance_tickets.tenant_id), '') WHERE tenant_phone = ''`);
    } catch {}
  }

  // === V19: Add linked_lease_ref to floor_units + agents table ===
  if (currentVer < 19) {
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_floor_units ADD COLUMN linked_lease_ref TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS vc_agents (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
      whatsapp TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '', areas TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active', notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
    )`); } catch {}

  // === V21: Add merged_data column to invoices for merged billing ===
  try { await window.tasklet.sqlExec(`ALTER TABLE vc_invoices ADD COLUMN merged_data TEXT NOT NULL DEFAULT ''`); } catch {}
  }

  // === V22: Company-based user access ===
  if (currentVer < 22) {
    try { await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS vc_user_owner_access (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, owner_id INTEGER NOT NULL, access_level TEXT NOT NULL DEFAULT 'readonly', UNIQUE(user_id, owner_id))`); } catch {}
  }

  // === V23: SPA vs actual price + penalty config + invoice attachments ===
  if (currentVer < 23) {
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_properties ADD COLUMN actual_price REAL NOT NULL DEFAULT 0`); } catch {}
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_documents ADD COLUMN linked_invoice_id INTEGER NOT NULL DEFAULT 0`); } catch {}
    try { await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS vc_penalty_config (id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL DEFAULT 0, rate_pct REAL NOT NULL DEFAULT 0, grace_days INTEGER NOT NULL DEFAULT 7, calc_method TEXT NOT NULL DEFAULT 'monthly_pct', min_amount REAL NOT NULL DEFAULT 0, max_amount REAL NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '')`); } catch {}
  }

  // === V24: Payment receipt fields + penalty invoice fields ===
  if (currentVer < 24) {
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_invoices ADD COLUMN payment_method TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_invoices ADD COLUMN payment_ref TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_invoices ADD COLUMN is_penalty INTEGER NOT NULL DEFAULT 0`); } catch {}
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_invoices ADD COLUMN penalty_parent_id INTEGER NOT NULL DEFAULT 0`); } catch {}
  }

  // V25: Activity tracking
  if (currentVer < 25) {
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_users ADD COLUMN last_active TEXT NOT NULL DEFAULT ''`); } catch {}
  }

  if (currentVer < 26) {
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_loan_payments ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'normal'`); } catch {}
    await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS vc_valuations (
      id INTEGER PRIMARY KEY,
      property_id INTEGER NOT NULL DEFAULT 0,
      valuation_date TEXT NOT NULL DEFAULT '',
      market_value REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    )`);
    await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS vc_tenancy_charges (
      id INTEGER PRIMARY KEY,
      property_id INTEGER NOT NULL DEFAULT 0,
      floor_unit_id INTEGER NOT NULL DEFAULT 0,
      charge_type TEXT NOT NULL DEFAULT 'other',
      charge_name TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      payment_date TEXT NOT NULL DEFAULT '',
      tenant_name TEXT NOT NULL DEFAULT '',
      lease_start TEXT NOT NULL DEFAULT '',
      lease_end TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL DEFAULT '',
      file_data TEXT NOT NULL DEFAULT '',
      file_size INTEGER NOT NULL DEFAULT 0,
      file_mime TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    )`);
  }

  if (currentVer < 27) {
    await window.tasklet.sqlExec(`CREATE TABLE IF NOT EXISTS vc_valuations (
      id INTEGER PRIMARY KEY,
      property_id INTEGER NOT NULL DEFAULT 0,
      valuation_date TEXT NOT NULL DEFAULT '',
      market_value REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    )`);
    // loan_balance can legitimately exceed loan_amount — no auto-reset
  }

  if (currentVer < 29) {
    // Add loan_id to vc_loan_payments (V28)
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_loan_payments ADD COLUMN loan_id INTEGER NOT NULL DEFAULT 0`); } catch {}
    // Add spa_date to properties (V29)
    try { await window.tasklet.sqlExec(`ALTER TABLE vc_properties ADD COLUMN spa_date TEXT NOT NULL DEFAULT ''`); } catch {}

    // Migrate existing property-level loans into vc_loans table (re-runnable: checks for existing)
    try {
      const propsWithLoans = await window.tasklet.sqlQuery(
        `SELECT id, bank_code, bank_name, loan_amount, loan_balance, monthly_repayment,
         loan_start, loan_tenure_months, loan_interest_rate, loan_repayment_day,
         loan_account_no, loan_si_account FROM vc_properties
         WHERE loan_amount > 0 OR COALESCE(bank_name, '') != '' OR monthly_repayment > 0`
      ) as any[];
      for (const p of propsWithLoans) {
        const existing = await window.tasklet.sqlQuery(`SELECT id FROM vc_loans WHERE property_id=${p.id} LIMIT 1`) as any[];
        if (existing.length === 0) {
          const mNow = nowISO();
          const loanId = Date.now() + Math.floor(Math.random() * 10000) + p.id;
          await window.tasklet.sqlExec(`INSERT INTO vc_loans (id, property_id, loan_label, bank_code, bank_name, loan_amount, loan_balance, monthly_repayment, rate_type, base_rate, spread, effective_rate, loan_start, loan_tenure_months, loan_repayment_day, loan_account_no, loan_si_account, notes, created_at, updated_at)
            VALUES (${loanId}, ${p.id}, '房屋贷款', '${escapeSQL(String(p.bank_code || ''))}', '${escapeSQL(String(p.bank_name || ''))}', ${p.loan_amount || 0}, ${p.loan_balance || 0}, ${p.monthly_repayment || 0}, 'SBR', ${p.loan_interest_rate || 0}, 0, ${p.loan_interest_rate || 0}, '${escapeSQL(String(p.loan_start || ''))}', ${p.loan_tenure_months || 0}, ${p.loan_repayment_day || 0}, '${escapeSQL(String(p.loan_account_no || ''))}', '${escapeSQL(String(p.loan_si_account || ''))}', '', '${mNow}', '${mNow}')`);
          // Link existing payments to the new loan
          await window.tasklet.sqlExec(`UPDATE vc_loan_payments SET loan_id=${loanId} WHERE property_id=${p.id} AND loan_id=0`);
        }
      }
    } catch (migErr) { console.error('Loan migration error:', migErr); }
  }

  // Mark schema as current version
  await window.tasklet.sqlExec(`INSERT OR REPLACE INTO vc_meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}')`);
}

// ========== Properties ==========
export async function getProperties(userId?: number): Promise<Property[]> {
  let accessFilter = '';
  if (userId && userId > 0) {
    accessFilter = `AND (p.id IN (SELECT property_id FROM vc_user_access WHERE user_id = ${userId}) OR p.owner_id IN (SELECT owner_id FROM vc_user_owner_access WHERE user_id = ${userId}))`;
  }
  const rows = await window.tasklet.sqlQuery(`
    SELECT p.*,
      parent.name as parent_name,
      o.name as owner_name,
      o.owner_type as owner_type,
      (SELECT COUNT(*) FROM vc_properties u WHERE u.parent_id = p.id) as unit_count
    FROM vc_properties p
    LEFT JOIN vc_properties parent ON p.parent_id = parent.id
    LEFT JOIN vc_owners o ON p.owner_id = o.id
    WHERE 1=1 ${accessFilter}
    ORDER BY
      CASE WHEN p.property_category = 'building' THEN 0
           WHEN p.property_category = 'unit' THEN 1
           ELSE 2 END,
      p.parent_id,
      p.unit_number,
      p.updated_at DESC
  `);
  return rows as unknown as Property[];
}

export async function getPropertyById(id: number): Promise<Property | null> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT p.*,
      parent.name as parent_name,
      o.name as owner_name,
      o.owner_type as owner_type,
      (SELECT COUNT(*) FROM vc_properties u WHERE u.parent_id = p.id) as unit_count
    FROM vc_properties p
    LEFT JOIN vc_properties parent ON p.parent_id = parent.id
    LEFT JOIN vc_owners o ON p.owner_id = o.id
    WHERE p.id = ${id}
  `);
  return rows.length > 0 ? (rows[0] as unknown as Property) : null;
}

export async function getBuildings(): Promise<Property[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT p.*,
      (SELECT COUNT(*) FROM vc_properties u WHERE u.parent_id = p.id) as unit_count
    FROM vc_properties p
    WHERE p.property_category = 'building'
    ORDER BY p.name ASC
  `);
  return rows as unknown as Property[];
}

export async function getUnitsForBuilding(buildingId: number): Promise<Property[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT * FROM vc_properties WHERE parent_id = ${buildingId} ORDER BY unit_number ASC
  `);
  return rows as unknown as Property[];
}

export async function saveProperty(p: Partial<Property> & { name: string }): Promise<number> {
  const now = nowISO();
  const id = p.id || Date.now();
  if (p.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_properties SET
        name='${escapeSQL(p.name)}',
        address='${escapeSQL(p.address || '')}',
        type='${p.type || 'residential'}',
        status='${p.status || 'available'}',
        listing_type='${p.listing_type || 'sale'}',
        property_category='${p.property_category || 'standalone'}',
        parent_id=${p.parent_id || 0},
        unit_number='${escapeSQL(p.unit_number || '')}',
        total_units=${p.total_units || 0},
        floor_count=${p.floor_count || 1},
        price=${p.price || 0},
        rental_price=${p.rental_price || 0},
        bedrooms=${p.bedrooms || 0},
        bathrooms=${p.bathrooms || 0},
        area_sqft=${p.area_sqft || 0},
        description='${escapeSQL(p.description || '')}',
        image_url='${escapeSQL(p.image_url || '')}',
        bank_code='${escapeSQL(p.bank_code || '')}',
        bank_name='${escapeSQL(p.bank_name || '')}',
        loan_amount=${p.loan_amount || 0},
        loan_balance=${p.loan_balance || 0},
        monthly_repayment=${p.monthly_repayment || 0},
        loan_start='${p.loan_start || ''}',
        loan_tenure_months=${p.loan_tenure_months || 0},
        loan_interest_rate=${p.loan_interest_rate || 0},
        loan_repayment_day=${p.loan_repayment_day || 0},
        loan_account_no='${escapeSQL(p.loan_account_no || '')}',
        loan_si_account='${escapeSQL(p.loan_si_account || '')}',
        land_tax=${p.land_tax || 0},
        land_tax_due='${p.land_tax_due || ''}',
        assessment_tax=${p.assessment_tax || 0},
        assessment_tax_due='${p.assessment_tax_due || ''}',
        hakmilik_no='${escapeSQL(p.hakmilik_no || '')}',
        land_tax_ref='${escapeSQL(p.land_tax_ref || '')}',
        assessment_tax_ref='${escapeSQL(p.assessment_tax_ref || '')}',
        indah_water=${p.indah_water || 0},
        indah_water_acc='${escapeSQL(p.indah_water_acc || '')}',
        service_charge=${p.service_charge || 0},
        mgmt_company_name='${escapeSQL(p.mgmt_company_name || '')}',
        mgmt_company_phone='${escapeSQL(p.mgmt_company_phone || '')}',
        mgmt_company_address='${escapeSQL(p.mgmt_company_address || '')}',
        mgmt_fee_pct=${p.mgmt_fee_pct || 0},
        mgmt_fee_type='${p.mgmt_fee_type || 'percentage'}',
        mgmt_fee_amount=${p.mgmt_fee_amount || 0},
        actual_price=${p.actual_price || 0},
        spa_date='${escapeSQL((p as any).spa_date || '')}',
        owner_id=${p.owner_id || 0},
        updated_at='${now}'
      WHERE id=${p.id}
    `);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_properties (id, name, address, type, status, listing_type, property_category, parent_id, unit_number, total_units, floor_count, price, rental_price, bedrooms, bathrooms, area_sqft, description, image_url, bank_code, bank_name, loan_amount, loan_balance, monthly_repayment, loan_start, loan_tenure_months, loan_interest_rate, loan_repayment_day, loan_account_no, loan_si_account, land_tax, land_tax_due, assessment_tax, assessment_tax_due, hakmilik_no, land_tax_ref, assessment_tax_ref, indah_water, indah_water_acc, service_charge, mgmt_company_name, mgmt_company_phone, mgmt_company_address, mgmt_fee_pct, mgmt_fee_type, mgmt_fee_amount, actual_price, spa_date, owner_id, created_at, updated_at)
      VALUES (${id}, '${escapeSQL(p.name)}', '${escapeSQL(p.address || '')}', '${p.type || 'residential'}', '${p.status || 'available'}', '${p.listing_type || 'sale'}', '${p.property_category || 'standalone'}', ${p.parent_id || 0}, '${escapeSQL(p.unit_number || '')}', ${p.total_units || 0}, ${p.floor_count || 1}, ${p.price || 0}, ${p.rental_price || 0}, ${p.bedrooms || 0}, ${p.bathrooms || 0}, ${p.area_sqft || 0}, '${escapeSQL(p.description || '')}', '${escapeSQL(p.image_url || '')}', '${escapeSQL(p.bank_code || '')}', '${escapeSQL(p.bank_name || '')}', ${p.loan_amount || 0}, ${p.loan_balance || 0}, ${p.monthly_repayment || 0}, '${p.loan_start || ''}', ${p.loan_tenure_months || 0}, ${p.loan_interest_rate || 0}, ${p.loan_repayment_day || 0}, '${escapeSQL(p.loan_account_no || '')}', '${escapeSQL(p.loan_si_account || '')}', ${p.land_tax || 0}, '${p.land_tax_due || ''}', ${p.assessment_tax || 0}, '${p.assessment_tax_due || ''}', '${escapeSQL(p.hakmilik_no || '')}', '${escapeSQL(p.land_tax_ref || '')}', '${escapeSQL(p.assessment_tax_ref || '')}', ${p.indah_water || 0}, '${escapeSQL(p.indah_water_acc || '')}', ${p.service_charge || 0}, '${escapeSQL(p.mgmt_company_name || '')}', '${escapeSQL(p.mgmt_company_phone || '')}', '${escapeSQL(p.mgmt_company_address || '')}', ${p.mgmt_fee_pct || 0}, '${p.mgmt_fee_type || 'percentage'}', ${p.mgmt_fee_amount || 0}, ${p.actual_price || 0}, '${escapeSQL((p as any).spa_date || '')}', ${p.owner_id || 0}, '${now}', '${now}')
    `);
  }
  return id;
}

export async function deleteProperty(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_floor_units WHERE property_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_properties WHERE id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_properties WHERE parent_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_documents WHERE property_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_user_access WHERE property_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_loan_payments WHERE property_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_renovation_expenses WHERE property_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_purchase_costs WHERE property_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_meters WHERE property_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_recurring_charges WHERE property_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_invoices WHERE property_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_tenant_history WHERE property_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_billing_schedules WHERE property_id=${id}`);
}

// ========== Meters ==========
export async function getMeters(propertyId: number): Promise<Meter[]> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT * FROM vc_meters WHERE property_id=${propertyId} ORDER BY meter_type ASC, label ASC`
  );
  return rows as unknown as Meter[];
}

export async function saveMeter(m: Partial<Meter> & { property_id: number; meter_type: string; meter_number: string }): Promise<number> {
  const now = nowISO();
  const id = m.id || Date.now();
  if (m.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_meters SET
        meter_type='${escapeSQL(m.meter_type)}',
        meter_number='${escapeSQL(m.meter_number)}',
        account_holder='${escapeSQL(m.account_holder || '')}',
        label='${escapeSQL(m.label || '')}',
        notes='${escapeSQL(m.notes || '')}'
      WHERE id=${m.id}
    `);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_meters (id, property_id, meter_type, meter_number, account_holder, label, notes, created_at)
      VALUES (${id}, ${m.property_id}, '${escapeSQL(m.meter_type)}', '${escapeSQL(m.meter_number)}', '${escapeSQL(m.account_holder || '')}', '${escapeSQL(m.label || '')}', '${escapeSQL(m.notes || '')}', '${now}')
    `);
  }
  return id;
}

export async function deleteMeter(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_meters WHERE id=${id}`);
}

// ========== Owners ==========
export async function getOwners(): Promise<Owner[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT o.*,
      (SELECT COUNT(*) FROM vc_properties WHERE owner_id = o.id) as property_count
    FROM vc_owners o
    ORDER BY o.name ASC
  `);
  return rows as unknown as Owner[];
}

export async function saveOwner(o: Partial<Owner> & { name: string }): Promise<number> {
  const now = nowISO();
  const id = o.id || Date.now();
  if (o.id) {
    // Log payment bank changes for audit trail
    const oldRows = await window.tasklet.sqlQuery(`SELECT payment_bank_name, payment_bank_account, payment_account_name FROM vc_owners WHERE id=${o.id}`);
    const old = oldRows[0] as any;
    if (old) {
      const fields = [
        { key: 'payment_bank_name', label: '收款银行' },
        { key: 'payment_bank_account', label: '收款账号' },
        { key: 'payment_account_name', label: '收款人名称' },
      ];
      for (const f of fields) {
        const oldVal = String(old[f.key] || '');
        const newVal = String((o as any)[f.key] || '');
        if (oldVal !== newVal && (oldVal || newVal)) {
          const logId = Date.now() + Math.floor(Math.random() * 1000);
          await window.tasklet.sqlExec(`
            INSERT INTO vc_change_logs (id, entity_type, entity_id, field_name, field_label, old_value, new_value, change_source, change_reason, changed_at)
            VALUES (${logId}, 'owner', ${o.id}, '${f.key}', '${f.label}', '${escapeSQL(oldVal)}', '${escapeSQL(newVal)}', 'admin', '持有人收款信息变更', '${now}')
          `);
        }
      }
    }
    await window.tasklet.sqlExec(`
      UPDATE vc_owners SET
        name='${escapeSQL(o.name)}',
        owner_type='${o.owner_type || 'individual'}',
        registration_no='${escapeSQL(o.registration_no || '')}',
        contact_person='${escapeSQL(o.contact_person || '')}',
        phone='${escapeSQL(o.phone || '')}',
        email='${escapeSQL(o.email || '')}',
        address='${escapeSQL(o.address || '')}',
        notes='${escapeSQL(o.notes || '')}',
        payment_bank_name='${escapeSQL(o.payment_bank_name || '')}',
        payment_bank_account='${escapeSQL(o.payment_bank_account || '')}',
        payment_account_name='${escapeSQL(o.payment_account_name || '')}',
        updated_at='${now}'
      WHERE id=${o.id}
    `);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_owners (id, name, owner_type, registration_no, contact_person, phone, email, address, notes, payment_bank_name, payment_bank_account, payment_account_name, created_at, updated_at)
      VALUES (${id}, '${escapeSQL(o.name)}', '${o.owner_type || 'individual'}', '${escapeSQL(o.registration_no || '')}', '${escapeSQL(o.contact_person || '')}', '${escapeSQL(o.phone || '')}', '${escapeSQL(o.email || '')}', '${escapeSQL(o.address || '')}', '${escapeSQL(o.notes || '')}', '${escapeSQL(o.payment_bank_name || '')}', '${escapeSQL(o.payment_bank_account || '')}', '${escapeSQL(o.payment_account_name || '')}', '${now}', '${now}')
    `);
  }
  return id;
}

export async function deleteOwner(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_owners WHERE id=${id}`);
  await window.tasklet.sqlExec(`UPDATE vc_properties SET owner_id=0 WHERE owner_id=${id}`);
}

// ========== System Users (Unified) ==========
export async function getSystemUsers(roleFilter?: string): Promise<SystemUser[]> {
  let where = '';
  if (roleFilter) where = `WHERE u.role='${escapeSQL(roleFilter)}'`;
  const rows = await window.tasklet.sqlQuery(`
    SELECT u.id, u.username, u.name, u.role, u.phone, u.email, u.notes, u.active, u.must_change_pin, u.created_at, u.updated_at, u.last_login, u.last_active,
      (SELECT COUNT(*) FROM vc_user_owner_access WHERE user_id = u.id) as access_count
    FROM vc_users u
    ${where}
    ORDER BY CASE u.role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 WHEN 'stakeholder' THEN 2 WHEN 'tenant' THEN 3 WHEN 'worker' THEN 4 ELSE 5 END, u.name ASC
  `);
  return (rows as Record<string, unknown>[]).map(r => ({
    id: Number(r.id), username: String(r.username || ''), name: String(r.name || ''),
    role: String(r.role || 'stakeholder') as any, phone: String(r.phone || ''),
    email: String(r.email || ''), notes: String(r.notes || ''),
    active: Number(r.active ?? 1), must_change_pin: Number(r.must_change_pin ?? 0),
    created_at: String(r.created_at || ''), updated_at: String(r.updated_at || ''),
    access_count: Number(r.access_count ?? 0),
    last_login: String(r.last_login || ''),
    last_active: String(r.last_active || ''),
  }));
}

export async function saveSystemUser(u: Partial<SystemUser> & { name: string }): Promise<number> {
  const now = nowISO();
  const id = u.id || generateId();
  if (u.id) {
    const setParts = [
      `name='${escapeSQL(u.name)}'`, `role='${u.role || 'stakeholder'}'`,
      `username='${escapeSQL(u.username || '')}'`, `phone='${escapeSQL(u.phone || '')}'`,
      `email='${escapeSQL(u.email || '')}'`, `notes='${escapeSQL(u.notes || '')}'`,
      `updated_at='${now}'`,
    ];
    if (u.pin) setParts.push(`pin='${escapeSQL(u.pin)}'`);
    if (u.must_change_pin !== undefined) setParts.push(`must_change_pin=${u.must_change_pin}`);
    if (u.active !== undefined) setParts.push(`active=${u.active}`);
    await window.tasklet.sqlExec(`UPDATE vc_users SET ${setParts.join(', ')} WHERE id=${u.id}`);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_users (id, username, pin, role, phone, name, email, notes, active, must_change_pin, created_at, updated_at)
      VALUES (${id}, '${escapeSQL(u.username || '')}', '${escapeSQL(u.pin || '1234')}', '${u.role || 'stakeholder'}', '${escapeSQL(u.phone || '')}', '${escapeSQL(u.name)}', '${escapeSQL(u.email || '')}', '${escapeSQL(u.notes || '')}', 1, ${u.must_change_pin ?? 1}, '${now}', '${now}')
    `);
  }
  return id;
}

export async function deleteSystemUser(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_users WHERE id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_user_access WHERE user_id=${id}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_user_owner_access WHERE user_id=${id}`);
}

// ========== User Access (Property Permissions) ==========
export async function getUserAccess(userId: number): Promise<UserAccess[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT a.*, p.name as property_name, u.name as user_name
    FROM vc_user_access a
    LEFT JOIN vc_properties p ON a.property_id = p.id
    LEFT JOIN vc_users u ON a.user_id = u.id
    WHERE a.user_id = ${userId}
    ORDER BY p.name ASC
  `);
  return (rows as Record<string, unknown>[]).map(r => ({
    id: Number(r.id), user_id: Number(r.user_id), property_id: Number(r.property_id),
    access_level: String(r.access_level || 'readonly') as any,
    user_name: String(r.user_name || ''), property_name: String(r.property_name || ''),
  }));
}

export async function addUserAccess(userId: number, propertyId: number, accessLevel: string): Promise<void> {
  const id = generateId();
  try {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_user_access (id, user_id, property_id, access_level)
      VALUES (${id}, ${userId}, ${propertyId}, '${accessLevel}')
    `);
  } catch (_) {
    await window.tasklet.sqlExec(`
      UPDATE vc_user_access SET access_level='${accessLevel}'
      WHERE user_id=${userId} AND property_id=${propertyId}
    `);
  }
}

export async function removeUserAccess(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_user_access WHERE id=${id}`);
}

// ========== User Owner Access (Company-level Permissions) ==========
export async function getUserOwnerAccess(userId: number): Promise<import('../types').UserOwnerAccess[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT a.*, o.name as owner_name
    FROM vc_user_owner_access a
    LEFT JOIN vc_owners o ON a.owner_id = o.id
    WHERE a.user_id = ${userId}
    ORDER BY o.name ASC
  `);
  return (rows as Record<string, unknown>[]).map(r => ({
    id: Number(r.id), user_id: Number(r.user_id), owner_id: Number(r.owner_id),
    access_level: String(r.access_level || 'readonly') as any,
    owner_name: String(r.owner_name || ''),
  }));
}

export async function addUserOwnerAccess(userId: number, ownerId: number, accessLevel: string): Promise<void> {
  const id = generateId();
  try {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_user_owner_access (id, user_id, owner_id, access_level)
      VALUES (${id}, ${userId}, ${ownerId}, '${accessLevel}')
    `);
  } catch (_) {
    await window.tasklet.sqlExec(`
      UPDATE vc_user_owner_access SET access_level='${accessLevel}'
      WHERE user_id=${userId} AND owner_id=${ownerId}
    `);
  }
}

export async function removeUserOwnerAccess(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_user_owner_access WHERE id=${id}`);
}

// ========== Loan Payments ==========
export async function getLoanPayments(propertyId: number): Promise<LoanPayment[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT * FROM vc_loan_payments
    WHERE property_id = ${propertyId}
    ORDER BY payment_date DESC, created_at DESC
  `);
  return rows as unknown as LoanPayment[];
}

export async function addLoanPayment(propertyId: number, amount: number, paymentDate: string, referenceNo: string, notes: string, paymentType: string = 'normal', loanId: number = 0): Promise<void> {
  const now = nowISO();
  let currentBalance = 0;
  if (loanId) {
    const loan = await window.tasklet.sqlQuery(`SELECT loan_balance FROM vc_loans WHERE id=${loanId}`) as any[];
    currentBalance = Number(loan[0]?.loan_balance || 0);
  } else {
    const prop = await window.tasklet.sqlQuery(`SELECT loan_balance FROM vc_properties WHERE id=${propertyId}`) as any[];
    currentBalance = Number(prop[0]?.loan_balance || 0);
  }
  const balanceAfter = Math.max(0, currentBalance - amount);

  await window.tasklet.sqlExec(`
    INSERT INTO vc_loan_payments (id, property_id, loan_id, amount, payment_date, reference_no, notes, balance_after, payment_type, created_at)
    VALUES (${Date.now()}, ${propertyId}, ${loanId}, ${amount}, '${paymentDate}', '${escapeSQL(referenceNo)}', '${escapeSQL(notes)}', ${balanceAfter}, '${escapeSQL(paymentType)}', '${now}')
  `);

  if (loanId) {
    await window.tasklet.sqlExec(`UPDATE vc_loans SET loan_balance=${balanceAfter}, updated_at='${now}' WHERE id=${loanId}`);
  }
  await syncPropertyLoanTotals(propertyId);
}

export async function deleteLoanPayment(id: number, propertyId: number, amount: number, loanId: number = 0): Promise<void> {
  const now = nowISO();
  await window.tasklet.sqlExec(`DELETE FROM vc_loan_payments WHERE id=${id}`);
  if (loanId) {
    await window.tasklet.sqlExec(`UPDATE vc_loans SET loan_balance = loan_balance + ${amount}, updated_at='${now}' WHERE id=${loanId}`);
  } else {
    await window.tasklet.sqlExec(`UPDATE vc_properties SET loan_balance = loan_balance + ${amount}, updated_at='${now}' WHERE id=${propertyId}`);
  }
  await syncPropertyLoanTotals(propertyId);
}

// Sync property-level totals from vc_loans
async function syncPropertyLoanTotals(propertyId: number): Promise<void> {
  const now = nowISO();
  await window.tasklet.sqlExec(`UPDATE vc_properties SET
    loan_amount = COALESCE((SELECT SUM(loan_amount) FROM vc_loans WHERE property_id=${propertyId}), 0),
    loan_balance = COALESCE((SELECT SUM(loan_balance) FROM vc_loans WHERE property_id=${propertyId}), 0),
    monthly_repayment = COALESCE((SELECT SUM(monthly_repayment) FROM vc_loans WHERE property_id=${propertyId}), 0),
    updated_at='${now}'
  WHERE id=${propertyId}`);
}

// ========== Loans (Multi-loan) ==========
export async function getLoansForProperty(propertyId: number): Promise<any[]> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM vc_loans WHERE property_id=${propertyId} ORDER BY created_at ASC`);
  return rows as any[];
}

export async function saveLoan(loan: any): Promise<number> {
  const now = nowISO();
  const er = loan.rate_type === 'BLR'
    ? (Number(loan.base_rate) || 0) - Math.abs(Number(loan.spread) || 0)
    : loan.rate_type === 'FIXED'
      ? (Number(loan.base_rate) || 0)
      : (Number(loan.base_rate) || 0) + (Number(loan.spread) || 0);
  if (loan.id) {
    await window.tasklet.sqlExec(`UPDATE vc_loans SET
      loan_label='${escapeSQL(loan.loan_label || '房屋贷款')}',
      bank_code='${escapeSQL(loan.bank_code || '')}', bank_name='${escapeSQL(loan.bank_name || '')}',
      loan_amount=${loan.loan_amount || 0}, loan_balance=${loan.loan_balance || 0},
      monthly_repayment=${loan.monthly_repayment || 0},
      rate_type='${escapeSQL(loan.rate_type || 'SBR')}',
      base_rate=${loan.base_rate || 0}, spread=${loan.spread || 0}, effective_rate=${er},
      loan_start='${loan.loan_start || ''}', loan_tenure_months=${loan.loan_tenure_months || 0},
      loan_repayment_day=${loan.loan_repayment_day || 0},
      loan_account_no='${escapeSQL(loan.loan_account_no || '')}',
      loan_si_account='${escapeSQL(loan.loan_si_account || '')}',
      notes='${escapeSQL(loan.notes || '')}', updated_at='${now}'
    WHERE id=${loan.id}`);
    await syncPropertyLoanTotals(loan.property_id);
    return loan.id;
  } else {
    const id = Date.now();
    await window.tasklet.sqlExec(`INSERT INTO vc_loans (id, property_id, loan_label, bank_code, bank_name, loan_amount, loan_balance, monthly_repayment, rate_type, base_rate, spread, effective_rate, loan_start, loan_tenure_months, loan_repayment_day, loan_account_no, loan_si_account, notes, created_at, updated_at)
      VALUES (${id}, ${loan.property_id}, '${escapeSQL(loan.loan_label || '房屋贷款')}', '${escapeSQL(loan.bank_code || '')}', '${escapeSQL(loan.bank_name || '')}', ${loan.loan_amount || 0}, ${loan.loan_balance || 0}, ${loan.monthly_repayment || 0}, '${escapeSQL(loan.rate_type || 'SBR')}', ${loan.base_rate || 0}, ${loan.spread || 0}, ${er}, '${loan.loan_start || ''}', ${loan.loan_tenure_months || 0}, ${loan.loan_repayment_day || 0}, '${escapeSQL(loan.loan_account_no || '')}', '${escapeSQL(loan.loan_si_account || '')}', '${escapeSQL(loan.notes || '')}', '${now}', '${now}')`);
    await syncPropertyLoanTotals(loan.property_id);
    return id;
  }
}

export async function deleteLoanRecord(loanId: number, propertyId: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_loans WHERE id=${loanId}`);
  await window.tasklet.sqlExec(`DELETE FROM vc_loan_payments WHERE loan_id=${loanId}`);
  await syncPropertyLoanTotals(propertyId);
}

export async function getLoanPaymentsForLoan(loanId: number): Promise<any[]> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM vc_loan_payments WHERE loan_id=${loanId} ORDER BY payment_date DESC, created_at DESC`);
  return rows as any[];
}

// ========== Documents ==========
export async function getDocuments(propertyId?: number): Promise<PropertyDocument[]> {
  const where = propertyId ? `WHERE d.property_id = ${propertyId}` : '';
  const rows = await window.tasklet.sqlQuery(`
    SELECT d.*, p.name as property_name, c.name as linked_client_name
    FROM vc_documents d
    LEFT JOIN vc_properties p ON d.property_id = p.id
    LEFT JOIN vc_clients c ON d.linked_client_id = c.id
    ${where}
    ORDER BY d.created_at DESC
  `);
  return rows as unknown as PropertyDocument[];
}

// Write large base64 data to disk using chunked approach to avoid bridge payload limits
async function writeFileChunked(filePath: string, base64Data: string, onProgress?: (pct: number) => void): Promise<void> {
  // Bridge has payload limit (~200KB). Use 80KB text chunks, write to temp, then cat to final.
  const CHUNK_SIZE = 80 * 1024;
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
  await window.tasklet.runCommand(`mkdir -p '${dirPath}'`);

  if (base64Data.length <= CHUNK_SIZE) {
    onProgress?.(50);
    await window.tasklet.writeFileToDisk(filePath, base64Data);
    onProgress?.(100);
    return;
  }

  // Large file strategy:
  // 1. Write small base64 chunks to /tmp/ via writeFileToDisk (each < 80KB)
  // 2. cat chunks → base64 -d → binary file on disk (saves space, ~25% smaller)
  // 3. Store "BIN:" marker in .b64 file pointing to binary path
  const tmpDir = `/tmp/doc_up_${Date.now()}`;
  await window.tasklet.runCommand(`mkdir -p '${tmpDir}'`);
  const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = base64Data.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const chunkFile = `${tmpDir}/c${String(i).padStart(4, '0')}`;
    await window.tasklet.writeFileToDisk(chunkFile, chunk);
    onProgress?.(Math.round(((i + 1) / totalChunks) * 80));
  }
  // Combine chunks → decode to binary
  const binPath = filePath.replace(/\.b64$/, '.bin');
  await window.tasklet.runCommand(`cat ${tmpDir}/c* | base64 -d > '${binPath}' 2>/dev/null; rm -rf '${tmpDir}'`);
  // Write tiny marker so download knows to read binary file
  await window.tasklet.writeFileToDisk(filePath, 'BIN:' + binPath);
  onProgress?.(100);
}

// Read file from disk, handling both small base64 files and large binary files
export async function readFileFromDiskChunked(b64Path: string, mime: string): Promise<string> {
  // Read the .b64 marker/data file
  const marker = await window.tasklet.readFileFromDisk(b64Path);
  if (marker.startsWith('BIN:')) {
    // Large file stored as binary — encode to base64 for data URL
    const binPath = marker.substring(4);
    // Use single base64 command (works for files up to ~10MB)
    const result = await window.tasklet.runCommand(`base64 -w0 '${binPath}' 2>/dev/null`);
    const b64 = result.log.trim();
    if (!b64) throw new Error('文件不存在或已损坏');
    return `data:${mime};base64,${b64}`;
  }
  // Small file: marker IS the base64 data
  return `data:${mime};base64,${marker}`;
}

export async function saveDocument(doc: Partial<PropertyDocument> & { file_data?: string; file_size?: number; file_mime?: string }, onProgress?: (pct: number) => void): Promise<void> {
  const now = nowISO();
  // Store file on disk instead of SQLite to support large files
  let filePath = '';
  if (doc.file_data) {
    const docId = doc.id || Date.now();
    const safeFileName = (doc.file_name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    filePath = `/agent/home/uploads/documents/${doc.property_id || 0}/${docId}_${safeFileName}.b64`;
    await writeFileChunked(filePath, doc.file_data, onProgress);
  }
  if (doc.id) {
    // Update metadata only (file_data column stores the disk path now)
    const updatePath = filePath ? `file_data='${escapeSQL(filePath)}',` : '';
    const updateSize = doc.file_size !== undefined ? `file_size=${doc.file_size},` : '';
    const updateMime = doc.file_mime !== undefined ? `file_mime='${escapeSQL(doc.file_mime)}',` : '';
    await window.tasklet.sqlExec(`
      UPDATE vc_documents SET
        property_id=${doc.property_id || 0},
        doc_type='${doc.doc_type || 'other'}',
        file_name='${escapeSQL(doc.file_name || '')}',
        ${updatePath}
        ${updateSize}
        ${updateMime}
        notes='${escapeSQL(doc.notes || '')}',
        linked_client_id=${doc.linked_client_id || 0},
        linked_deal_id=${doc.linked_deal_id || 0},
        updated_at='${now}'
      WHERE id=${doc.id}
    `);
  } else {
    const docId = Date.now();
    await window.tasklet.sqlExec(`
      INSERT INTO vc_documents (id, property_id, doc_type, file_name, file_data, file_size, file_mime, notes, linked_client_id, linked_deal_id, linked_invoice_id, created_at, updated_at)
      VALUES (${docId}, ${doc.property_id || 0}, '${doc.doc_type || 'other'}', '${escapeSQL(doc.file_name || '')}', '${escapeSQL(filePath)}', ${doc.file_size || 0}, '${escapeSQL(doc.file_mime || '')}', '${escapeSQL(doc.notes || '')}', ${doc.linked_client_id || 0}, ${doc.linked_deal_id || 0}, ${(doc as any).linked_invoice_id || 0}, '${now}', '${now}')
    `);
  }
}

// ========== Lease Expiry ==========
export async function getExpiringLeases(withinDays: number = 90): Promise<RentalDeal[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT r.*, p.name as property_name, c.name as client_name
    FROM vc_rentals r
    LEFT JOIN vc_properties p ON r.property_id = p.id
    LEFT JOIN vc_clients c ON r.client_id = c.id
    WHERE r.lease_end != '' AND r.lease_end IS NOT NULL
      AND r.stage = 'active'
      AND date(r.lease_end) <= date('now', '+${withinDays} days')
      AND date(r.lease_end) >= date('now', '-30 days')
    ORDER BY r.lease_end ASC
  `);
  return rows as unknown as RentalDeal[];
}

export interface ExpiringFloorLease {
  id: number;
  property_id: number;
  floor_label: string;
  tenant_name: string;
  lease_end: string;
  rent_amount: number;
  property_name: string;
}

export async function getExpiringFloorLeases(withinDays: number = 90): Promise<ExpiringFloorLease[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT f.id, f.property_id, f.floor_label, f.tenant_name, f.lease_end, f.rent_amount,
      p.name as property_name
    FROM vc_floor_units f
    LEFT JOIN vc_properties p ON f.property_id = p.id
    WHERE f.lease_end != '' AND f.lease_end IS NOT NULL
      AND f.tenant_name != ''
      AND date(f.lease_end) <= date('now', '+${withinDays} days')
      AND date(f.lease_end) >= date('now', '-30 days')
    ORDER BY f.lease_end ASC
  `);
  return rows as unknown as ExpiringFloorLease[];
}

export async function deleteDocument(id: number): Promise<void> {
  // Try to delete the file from disk first (both .b64 marker and .bin binary)
  try {
    const rows = await window.tasklet.sqlQuery(`SELECT file_data FROM vc_documents WHERE id=${id}`);
    if (rows.length > 0) {
      const filePath = (rows[0] as any).file_data;
      if (filePath && typeof filePath === 'string' && filePath.startsWith('/agent/')) {
        // Delete the .b64 file
        await window.tasklet.runCommand(`rm -f '${filePath}'`);
        // Also delete the .bin file if it exists (large file binary storage)
        const binPath = filePath.replace(/\.b64$/, '.bin');
        await window.tasklet.runCommand(`rm -f '${binPath}'`);
      }
    }
  } catch (_) { /* ignore cleanup errors */ }
  await window.tasklet.sqlExec(`DELETE FROM vc_documents WHERE id=${id}`);
}

// ========== Clients ==========
export async function getClients(): Promise<Client[]> {
  const rows = await window.tasklet.sqlQuery('SELECT * FROM vc_clients ORDER BY updated_at DESC');
  return rows as unknown as Client[];
}

export async function saveClient(c: Partial<Client> & { name: string }): Promise<number> {
  const now = nowISO();
  const id = c.id || Date.now();
  const ct = c.client_type || 'individual';
  if (c.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_clients SET
        name='${escapeSQL(c.name)}',
        phone='${escapeSQL(c.phone || '')}',
        email='${escapeSQL(c.email || '')}',
        role='${c.role || 'buyer'}',
        client_type='${ct}',
        ic_number='${escapeSQL(c.ic_number || '')}',
        company_name='${escapeSQL(c.company_name || '')}',
        registration_no='${escapeSQL(c.registration_no || '')}',
        director_name='${escapeSQL(c.director_name || '')}',
        director_ic='${escapeSQL(c.director_ic || '')}',
        director_phone='${escapeSQL(c.director_phone || '')}',
        director_email='${escapeSQL(c.director_email || '')}',
        address='${escapeSQL(c.address || '')}',
        notes='${escapeSQL(c.notes || '')}',
        updated_at='${now}'
      WHERE id=${c.id}
    `);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_clients (id, name, phone, email, role, client_type, ic_number, company_name, registration_no, director_name, director_ic, director_phone, director_email, address, notes, created_at, updated_at)
      VALUES (${id}, '${escapeSQL(c.name)}', '${escapeSQL(c.phone || '')}', '${escapeSQL(c.email || '')}', '${c.role || 'buyer'}', '${ct}', '${escapeSQL(c.ic_number || '')}', '${escapeSQL(c.company_name || '')}', '${escapeSQL(c.registration_no || '')}', '${escapeSQL(c.director_name || '')}', '${escapeSQL(c.director_ic || '')}', '${escapeSQL(c.director_phone || '')}', '${escapeSQL(c.director_email || '')}', '${escapeSQL(c.address || '')}', '${escapeSQL(c.notes || '')}', '${now}', '${now}')
    `);
  }
  return id;
}

export async function deleteClient(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_clients WHERE id=${id}`);
}

// ========== Sales Pipeline ==========
export async function getSales(): Promise<SaleDeal[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT s.*, p.name as property_name, c.name as client_name
    FROM vc_sales s
    LEFT JOIN vc_properties p ON s.property_id = p.id
    LEFT JOIN vc_clients c ON s.client_id = c.id
    ORDER BY s.updated_at DESC
  `);
  return rows as unknown as SaleDeal[];
}

export async function saveSale(s: Partial<SaleDeal>): Promise<number> {
  const now = nowISO();
  const id = s.id || Date.now();
  if (s.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_sales SET
        property_id=${s.property_id || 0},
        client_id=${s.client_id || 0},
        stage='${s.stage || 'lead'}',
        offer_price=${s.offer_price || 0},
        notes='${escapeSQL(s.notes || '')}',
        updated_at='${now}'
      WHERE id=${s.id}
    `);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_sales (id, property_id, client_id, stage, offer_price, notes, created_at, updated_at)
      VALUES (${id}, ${s.property_id || 0}, ${s.client_id || 0}, '${s.stage || 'lead'}', ${s.offer_price || 0}, '${escapeSQL(s.notes || '')}', '${now}', '${now}')
    `);
  }
  return id;
}

export async function deleteSale(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_sales WHERE id=${id}`);
}

export async function moveSaleStage(id: number, stage: string): Promise<void> {
  const now = nowISO();
  await window.tasklet.sqlExec(`UPDATE vc_sales SET stage='${stage}', updated_at='${now}' WHERE id=${id}`);
}

// ========== Rental Pipeline ==========
export async function getRentals(): Promise<RentalDeal[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT r.*, p.name as property_name, c.name as client_name
    FROM vc_rentals r
    LEFT JOIN vc_properties p ON r.property_id = p.id
    LEFT JOIN vc_clients c ON r.client_id = c.id
    ORDER BY r.updated_at DESC
  `);
  return rows as unknown as RentalDeal[];
}

export async function saveRental(r: Partial<RentalDeal>): Promise<number> {
  const now = nowISO();
  const id = r.id || Date.now();
  if (r.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_rentals SET
        property_id=${r.property_id || 0},
        client_id=${r.client_id || 0},
        stage='${r.stage || 'inquiry'}',
        monthly_rent=${r.monthly_rent || 0},
        lease_start='${r.lease_start || ''}',
        lease_end='${r.lease_end || ''}',
        notes='${escapeSQL(r.notes || '')}',
        updated_at='${now}'
      WHERE id=${r.id}
    `);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_rentals (id, property_id, client_id, stage, monthly_rent, lease_start, lease_end, notes, created_at, updated_at)
      VALUES (${id}, ${r.property_id || 0}, ${r.client_id || 0}, '${r.stage || 'inquiry'}', ${r.monthly_rent || 0}, '${r.lease_start || ''}', '${r.lease_end || ''}', '${escapeSQL(r.notes || '')}', '${now}', '${now}')
    `);
  }
  return id;
}

export async function deleteRental(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_rentals WHERE id=${id}`);
}

export async function moveRentalStage(id: number, stage: string): Promise<void> {
  const now = nowISO();
  await window.tasklet.sqlExec(`UPDATE vc_rentals SET stage='${stage}', updated_at='${now}' WHERE id=${id}`);
}

// ========== Invoices ==========
export async function getInvoices(userId?: number): Promise<Invoice[]> {
  const accessFilter = userId ? `AND (i.property_id IN (SELECT property_id FROM vc_user_access WHERE user_id=${userId}) OR i.property_id IN (SELECT p.id FROM vc_properties p WHERE p.owner_id IN (SELECT owner_id FROM vc_user_owner_access WHERE user_id=${userId})))` : '';
  const rows = await window.tasklet.sqlQuery(`
    SELECT i.id, i.invoice_no, i.property_id, i.tenant_id, i.amount, i.due_date,
      i.paid_date, i.status, i.description, i.created_at, i.updated_at,
      i.floor_label, i.billing_month, i.rent_amount, i.charges_amount, i.auto_generated,
      i.adjustments, i.charges_detail,
      p.name as property_name,
      COALESCE(fu.tenant_name, c.name, '') as tenant_name
    FROM vc_invoices i
    LEFT JOIN vc_properties p ON i.property_id = p.id
    LEFT JOIN vc_floor_units fu ON i.property_id = fu.property_id AND i.floor_label = fu.floor_label
    LEFT JOIN vc_clients c ON i.tenant_id = c.id
    WHERE 1=1 ${accessFilter}
    ORDER BY i.due_date DESC
  `);
  return (rows as Record<string, unknown>[]).map(r => ({
    id: Number(r.id),
    invoice_no: String(r.invoice_no || ''),
    property_id: Number(r.property_id || 0),
    property_name: String(r.property_name || ''),
    tenant_id: Number(r.tenant_id || 0),
    tenant_name: String(r.tenant_name || ''),
    amount: Number(r.amount || 0),
    due_date: String(r.due_date || ''),
    paid_date: String(r.paid_date || ''),
    status: String(r.status || 'pending') as any,
    description: String(r.description || ''),
    floor_label: String(r.floor_label || ''),
    billing_month: String(r.billing_month || ''),
    rent_amount: Number(r.rent_amount || 0),
    charges_amount: Number(r.charges_amount || 0),
    auto_generated: Number(r.auto_generated || 0),
    adjustments: String(r.adjustments || '[]'),
    charges_detail: String(r.charges_detail || '[]'),
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
  }));
}

export async function saveInvoice(inv: Partial<Invoice>): Promise<void> {
  const now = nowISO();
  const adjStr = escapeSQL(inv.adjustments || '[]');
  const cdStr = escapeSQL(inv.charges_detail || '[]');
  const amt = Math.round(inv.amount || 0);
  const rentAmt = Math.round(inv.rent_amount || 0);
  const chargesAmt = Math.round(inv.charges_amount || 0);
  if (inv.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_invoices SET
        invoice_no='${escapeSQL(inv.invoice_no || '')}',
        property_id=${inv.property_id || 0},
        tenant_id=${inv.tenant_id || 0},
        amount=${amt},
        due_date='${inv.due_date || ''}',
        paid_date='${inv.paid_date || ''}',
        status='${inv.status || 'pending'}',
        description='${escapeSQL(inv.description || '')}',
        floor_label='${escapeSQL(inv.floor_label || '')}',
        billing_month='${escapeSQL(inv.billing_month || '')}',
        rent_amount=${rentAmt},
        charges_amount=${chargesAmt},
        adjustments='${adjStr}',
        charges_detail='${cdStr}',
        merged_data='${escapeSQL(inv.merged_data || '')}',
        updated_at='${now}'
      WHERE id=${inv.id}
    `);
  } else {
    const invNo = 'INV-' + Date.now().toString().slice(-8);
    await window.tasklet.sqlExec(`
      INSERT INTO vc_invoices (id, invoice_no, property_id, tenant_id, amount, due_date, paid_date, status, description, floor_label, billing_month, rent_amount, charges_amount, adjustments, charges_detail, auto_generated, merged_data, created_at, updated_at)
      VALUES (${Date.now()}, '${invNo}', ${inv.property_id || 0}, ${inv.tenant_id || 0}, ${amt}, '${inv.due_date || ''}', '', 'pending', '${escapeSQL(inv.description || '')}', '${escapeSQL(inv.floor_label || '')}', '${escapeSQL(inv.billing_month || '')}', ${rentAmt}, ${chargesAmt}, '${adjStr}', '${cdStr}', 0, '${escapeSQL(inv.merged_data || '')}', '${now}', '${now}')
    `);
  }
}

export async function deleteInvoice(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_invoices WHERE id=${id}`);
}

export async function markInvoicePaid(id: number, opts?: { payment_method?: string; payment_ref?: string }): Promise<void> {
  const now = nowISO();
  const method = escapeSQL(opts?.payment_method || '');
  const ref = escapeSQL(opts?.payment_ref || '');
  await window.tasklet.sqlExec(`UPDATE vc_invoices SET status='paid', paid_date='${now}', payment_method='${method}', payment_ref='${ref}', updated_at='${now}' WHERE id=${id}`);
}

export async function markInvoiceOverdue(id: number): Promise<void> {
  const now = nowISO();
  await window.tasklet.sqlExec(`UPDATE vc_invoices SET status='overdue', updated_at='${now}' WHERE id=${id}`);
}

// ========== Message Templates ==========
export async function getTemplates(): Promise<MessageTemplate[]> {
  const rows = await window.tasklet.sqlQuery('SELECT * FROM vc_message_templates ORDER BY id ASC');
  return rows as unknown as MessageTemplate[];
}

export async function saveTemplate(t: Partial<MessageTemplate> & { name: string }): Promise<void> {
  const now = nowISO();
  if (t.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_message_templates SET
        name='${escapeSQL(t.name)}',
        channel='${t.channel || 'both'}',
        subject='${escapeSQL(t.subject || '')}',
        content='${escapeSQL(t.content || '')}',
        updated_at='${now}'
      WHERE id=${t.id}
    `);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_message_templates (id, name, channel, subject, content, created_at, updated_at)
      VALUES (${Date.now()}, '${escapeSQL(t.name)}', '${t.channel || 'both'}', '${escapeSQL(t.subject || '')}', '${escapeSQL(t.content || '')}', '${now}', '${now}')
    `);
  }
}

export async function deleteTemplate(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_message_templates WHERE id=${id}`);
}

// ========== Billing Schedules ==========
export async function getSchedules(): Promise<BillingSchedule[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT s.*, p.name as property_name, f.tenant_name, f.tenant_phone, f.floor_label, t.name as template_name
    FROM vc_billing_schedules s
    LEFT JOIN vc_properties p ON s.property_id = p.id
    LEFT JOIN vc_floor_units f ON s.tenant_id = f.id
    LEFT JOIN vc_message_templates t ON s.template_id = t.id
    ORDER BY s.due_day ASC
  `);
  return rows as unknown as BillingSchedule[];
}

export async function saveSchedule(s: Partial<BillingSchedule>): Promise<void> {
  const now = nowISO();
  const amt = Math.round(s.amount || 0);
  if (s.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_billing_schedules SET
        property_id=${s.property_id || 0},
        tenant_id=${s.tenant_id || 0},
        amount=${amt},
        due_day=${s.due_day || 1},
        reminder_days_before=${s.reminder_days_before || 3},
        template_id=${s.template_id || 0},
        channel='${s.channel || 'both'}',
        active=${s.active ?? 1},
        updated_at='${now}'
      WHERE id=${s.id}
    `);
  } else {
    const id = generateId();
    await window.tasklet.sqlExec(`
      INSERT INTO vc_billing_schedules (id, property_id, tenant_id, amount, due_day, reminder_days_before, template_id, channel, active, created_at, updated_at)
      VALUES (${id}, ${s.property_id || 0}, ${s.tenant_id || 0}, ${amt}, ${s.due_day || 1}, ${s.reminder_days_before || 3}, ${s.template_id || 0}, '${s.channel || 'both'}', ${s.active ?? 1}, '${now}', '${now}')
    `);
  }
}

export async function batchSaveSchedules(propertyId: number, floorUnits: FloorUnit[], settings: { due_day: number; reminder_days_before: number; template_id: number; channel: string }): Promise<number> {
  let count = 0;
  for (const fu of floorUnits) {
    if (!fu.tenant_name) continue;
    const amt = Math.round(fu.rent_amount || 0);
    const id = generateId();
    const now = nowISO();
    await window.tasklet.sqlExec(`
      INSERT INTO vc_billing_schedules (id, property_id, tenant_id, amount, due_day, reminder_days_before, template_id, channel, active, created_at, updated_at)
      VALUES (${id}, ${propertyId}, ${fu.id}, ${amt}, ${settings.due_day}, ${settings.reminder_days_before}, ${settings.template_id}, '${settings.channel}', 1, '${now}', '${now}')
    `);
    count++;
  }
  return count;
}

export async function deleteSchedule(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_billing_schedules WHERE id=${id}`);
}

export async function toggleSchedule(id: number, active: number): Promise<void> {
  const now = nowISO();
  await window.tasklet.sqlExec(`UPDATE vc_billing_schedules SET active=${active}, updated_at='${now}' WHERE id=${id}`);
}

// ========== Workers ==========
export async function getWorkers(): Promise<Worker[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT w.*,
      (SELECT COUNT(*) FROM vc_maintenance_tickets WHERE assigned_worker_id = w.id AND status IN ('acknowledged','in_progress')) as active_tickets
    FROM vc_workers w ORDER BY w.name ASC
  `);
  return rows as unknown as Worker[];
}

export async function saveWorker(w: Partial<Worker> & { name: string }): Promise<number> {
  const now = nowISO();
  const id = w.id || Date.now();
  if (w.id) {
    await window.tasklet.sqlExec(`UPDATE vc_workers SET name='${escapeSQL(w.name)}', phone='${escapeSQL(w.phone || '')}', email='${escapeSQL(w.email || '')}', specialty='${w.specialty || 'general'}', status='${w.status || 'active'}', notes='${escapeSQL(w.notes || '')}', updated_at='${now}' WHERE id=${w.id}`);
  } else {
    await window.tasklet.sqlExec(`INSERT INTO vc_workers (id, name, phone, email, specialty, status, notes, created_at, updated_at) VALUES (${id}, '${escapeSQL(w.name)}', '${escapeSQL(w.phone || '')}', '${escapeSQL(w.email || '')}', '${w.specialty || 'general'}', '${w.status || 'active'}', '${escapeSQL(w.notes || '')}', '${now}', '${now}')`);
  }
  return id;
}

export async function deleteWorker(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_workers WHERE id=${id}`);
  await window.tasklet.sqlExec(`UPDATE vc_maintenance_tickets SET assigned_worker_id=0 WHERE assigned_worker_id=${id}`);
}

// ========== Maintenance Tickets ==========
export async function getTickets(tenantId?: number, workerId?: number): Promise<MaintenanceTicket[]> {
  let where = 'WHERE 1=1';
  if (tenantId) where += ` AND t.tenant_id = ${tenantId}`;
  if (workerId) where += ` AND t.assigned_worker_id = ${workerId}`;
  const rows = await window.tasklet.sqlQuery(`
    SELECT t.*, p.name as property_name,
      COALESCE(NULLIF(t.tenant_phone,''), fu.tenant_phone, '') as tenant_phone,
      COALESCE(fu.tenant_name, '') as tenant_name,
      w.name as worker_name
    FROM vc_maintenance_tickets t
    LEFT JOIN vc_properties p ON t.property_id = p.id
    LEFT JOIN vc_floor_units fu ON t.property_id = fu.property_id AND fu.tenant_phone = NULLIF(t.tenant_phone,'')
    LEFT JOIN vc_workers w ON t.assigned_worker_id = w.id
    ${where}
    GROUP BY t.id
    ORDER BY CASE t.status WHEN 'submitted' THEN 0 WHEN 'acknowledged' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END,
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.created_at DESC
  `);
  return rows as unknown as MaintenanceTicket[];
}

export async function getTicketsByPhone(phone: string): Promise<MaintenanceTicket[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT t.*, p.name as property_name, w.name as worker_name
    FROM vc_maintenance_tickets t
    LEFT JOIN vc_properties p ON t.property_id = p.id
    LEFT JOIN vc_workers w ON t.assigned_worker_id = w.id
    WHERE t.tenant_phone='${escapeSQL(phone)}'
    ORDER BY CASE t.status WHEN 'submitted' THEN 0 WHEN 'acknowledged' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END,
      t.created_at DESC
  `);
  return rows as unknown as MaintenanceTicket[];
}

export async function saveTicket(t: Partial<MaintenanceTicket>): Promise<number> {
  const now = nowISO();
  const id = t.id || Date.now();
  if (t.id) {
    await window.tasklet.sqlExec(`UPDATE vc_maintenance_tickets SET property_id=${t.property_id || 0}, tenant_id=${t.tenant_id || 0}, tenant_phone='${escapeSQL(t.tenant_phone || '')}', category='${t.category || 'other'}', priority='${t.priority || 'medium'}', status='${t.status || 'submitted'}', title='${escapeSQL(t.title || '')}', description='${escapeSQL(t.description || '')}', photos='${escapeSQL(t.photos || '[]')}', assigned_worker_id=${t.assigned_worker_id || 0}, admin_notes='${escapeSQL(t.admin_notes || '')}', updated_at='${now}' WHERE id=${t.id}`);
  } else {
    await window.tasklet.sqlExec(`INSERT INTO vc_maintenance_tickets (id, property_id, tenant_id, tenant_phone, category, priority, status, title, description, photos, assigned_worker_id, admin_notes, submitted_at, acknowledged_at, started_at, completed_at, created_at, updated_at) VALUES (${id}, ${t.property_id || 0}, ${t.tenant_id || 0}, '${escapeSQL(t.tenant_phone || '')}', '${t.category || 'other'}', '${t.priority || 'medium'}', 'submitted', '${escapeSQL(t.title || '')}', '${escapeSQL(t.description || '')}', '${escapeSQL(t.photos || '[]')}', 0, '', '${now}', '', '', '', '${now}', '${now}')`);
  }
  return id;
}

export async function deleteTicket(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_maintenance_tickets WHERE id=${id}`);
}

export async function updateTicketStatus(id: number, status: string): Promise<void> {
  const now = nowISO();
  let extra = '';
  if (status === 'acknowledged') extra = `, acknowledged_at='${now}'`;
  if (status === 'in_progress') extra = `, started_at='${now}'`;
  if (status === 'completed') extra = `, completed_at='${now}'`;
  await window.tasklet.sqlExec(`UPDATE vc_maintenance_tickets SET status='${status}'${extra}, updated_at='${now}' WHERE id=${id}`);
}

export async function assignWorkerToTicket(ticketId: number, workerId: number): Promise<void> {
  const now = nowISO();
  await window.tasklet.sqlExec(`UPDATE vc_maintenance_tickets SET assigned_worker_id=${workerId}, updated_at='${now}' WHERE id=${ticketId}`);
}

export async function updateTicketNotes(id: number, notes: string): Promise<void> {
  const now = nowISO();
  await window.tasklet.sqlExec(`UPDATE vc_maintenance_tickets SET admin_notes='${escapeSQL(notes)}', updated_at='${now}' WHERE id=${id}`);
}

export async function getClientByPhone(phone: string): Promise<Client | null> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM vc_clients WHERE phone='${escapeSQL(phone)}' LIMIT 1`);
  return rows.length > 0 ? (rows[0] as unknown as Client) : null;
}

// ========== Tenant Portal Functions (using vc_floor_units) ==========
export async function getFloorUnitsByPhone(phone: string): Promise<Array<FloorUnit & { property_name: string; property_address: string }>> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT f.*, p.name as property_name, p.address as property_address
    FROM vc_floor_units f
    JOIN vc_properties p ON f.property_id = p.id
    WHERE f.tenant_phone='${escapeSQL(phone)}' AND f.tenant_name != ''
    ORDER BY p.name, CASE WHEN f.floor_label='G' THEN 0 ELSE CAST(f.floor_label AS INTEGER)+1 END
  `);
  return rows as unknown as Array<FloorUnit & { property_name: string; property_address: string }>;
}

export async function getInvoicesForFloor(propertyId: number, floorLabel: string): Promise<Invoice[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT i.*, p.name as property_name
    FROM vc_invoices i
    LEFT JOIN vc_properties p ON i.property_id = p.id
    WHERE i.property_id=${propertyId} AND i.floor_label='${escapeSQL(floorLabel)}'
    ORDER BY i.due_date DESC
  `);
  return (rows as Record<string, unknown>[]).map(r => ({
    id: Number(r.id),
    invoice_no: String(r.invoice_no || ''),
    property_id: Number(r.property_id || 0),
    property_name: String(r.property_name || ''),
    tenant_id: Number(r.tenant_id || 0),
    tenant_name: String(r.tenant_name || ''),
    amount: Number(r.amount || 0),
    due_date: String(r.due_date || ''),
    paid_date: String(r.paid_date || ''),
    status: String(r.status || 'pending') as Invoice['status'],
    description: String(r.description || ''),
    floor_label: String(r.floor_label || ''),
    billing_month: String(r.billing_month || ''),
    rent_amount: Number(r.rent_amount || 0),
    charges_amount: Number(r.charges_amount || 0),
    auto_generated: Number(r.auto_generated || 0),
    adjustments: String(r.adjustments || '[]'),
    charges_detail: String(r.charges_detail || '[]'),
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
  })) as Invoice[];
}

export async function getWorkerByPhone(phone: string): Promise<Worker | null> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM vc_workers WHERE phone='${escapeSQL(phone)}' LIMIT 1`);
  return rows.length > 0 ? (rows[0] as unknown as Worker) : null;
}

export async function getPropertiesForTenant(tenantId: number): Promise<Property[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT p.* FROM vc_properties p
    INNER JOIN vc_rentals r ON r.property_id = p.id
    WHERE r.client_id = ${tenantId} AND r.stage = 'active'
    ORDER BY p.name ASC
  `);
  return rows as unknown as Property[];
}

// ========== Change Logs ==========
export async function saveChangeLog(log: Partial<ChangeLog>): Promise<void> {
  const now = nowISO();
  await window.tasklet.sqlExec(`
    INSERT INTO vc_change_logs (id, entity_type, entity_id, field_name, field_label, old_value, new_value, change_source, change_reason, changed_at)
    VALUES (${Date.now() + Math.floor(Math.random() * 1000)}, '${escapeSQL(log.entity_type || '')}', ${log.entity_id || 0}, '${escapeSQL(log.field_name || '')}', '${escapeSQL(log.field_label || '')}', '${escapeSQL(log.old_value || '')}', '${escapeSQL(log.new_value || '')}', '${log.change_source || 'manual'}', '${escapeSQL(log.change_reason || '')}', '${now}')
  `);
}

export async function saveChangeLogs(logs: Partial<ChangeLog>[]): Promise<void> {
  if (logs.length === 0) return;
  const now = nowISO();
  // Batch all inserts into a single SQL statement to avoid hitting batchWriteBlocks limit
  const values = logs.map((log, i) => {
    const id = Date.now() + i;
    return `(${id}, '${escapeSQL(log.entity_type || '')}', ${log.entity_id || 0}, '${escapeSQL(log.field_name || '')}', '${escapeSQL(log.field_label || '')}', '${escapeSQL(log.old_value || '')}', '${escapeSQL(log.new_value || '')}', '${log.change_source || 'manual'}', '${escapeSQL(log.change_reason || '')}', '${now}')`;
  }).join(',\n    ');
  await window.tasklet.sqlExec(`
    INSERT INTO vc_change_logs (id, entity_type, entity_id, field_name, field_label, old_value, new_value, change_source, change_reason, changed_at)
    VALUES ${values}
  `);
}

export async function getChangeLogs(entityType?: string, entityId?: number): Promise<ChangeLog[]> {
  let where = 'WHERE 1=1';
  if (entityType) where += ` AND entity_type='${escapeSQL(entityType)}'`;
  if (entityId) where += ` AND entity_id=${entityId}`;
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM vc_change_logs ${where} ORDER BY changed_at DESC`);
  return rows as unknown as ChangeLog[];
}

// ========== Floor Units ==========
export async function getFloorUnits(propertyId: number): Promise<FloorUnit[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT * FROM vc_floor_units WHERE property_id = ${propertyId} ORDER BY CASE WHEN floor_label='G' THEN 0 ELSE CAST(floor_label AS INTEGER) + 1 END ASC
  `);
  return rows as unknown as FloorUnit[];
}

export async function getAllFloorUnits(): Promise<FloorUnit[]> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM vc_floor_units ORDER BY property_id, CASE WHEN floor_label='G' THEN 0 ELSE CAST(floor_label AS INTEGER) + 1 END ASC`);
  return rows as unknown as FloorUnit[];
}



export async function getFloorUnitsByLeaseRef(leaseRef: string): Promise<Array<FloorUnit & { property_name: string }>> {
  if (!leaseRef) return [];
  const rows = await window.tasklet.sqlQuery(`
    SELECT f.*, p.name as property_name
    FROM vc_floor_units f
    JOIN vc_properties p ON f.property_id = p.id
    WHERE f.linked_lease_ref='${escapeSQL(leaseRef)}' AND f.tenant_name != ''
    ORDER BY p.name, CASE WHEN f.floor_label='G' THEN 0 ELSE CAST(f.floor_label AS INTEGER)+1 END
  `);
  return rows as unknown as Array<FloorUnit & { property_name: string }>;
}

export async function saveFloorUnit(f: Partial<FloorUnit> & { property_id: number; floor_label: string }): Promise<number> {
  const now = nowISO();
  const id = f.id || Date.now() + Math.floor(Math.random() * 1000);
  const status = f.tenant_name ? 'occupied' : 'vacant';
  if (f.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_floor_units SET
        floor_label='${escapeSQL(f.floor_label)}',
        tenant_name='${escapeSQL(f.tenant_name || '')}',
        tenant_phone='${escapeSQL(f.tenant_phone || '')}',
        tenant_company_reg='${escapeSQL(f.tenant_company_reg || '')}',
        tenant_address='${escapeSQL(f.tenant_address || '')}',
        director_name='${escapeSQL(f.director_name || '')}',
        director_ic='${escapeSQL(f.director_ic || '')}',
        director_phone='${escapeSQL(f.director_phone || '')}',
        director_notes='${escapeSQL(f.director_notes || '')}',
        tenant_bank_name='${escapeSQL(f.tenant_bank_name || '')}',
        tenant_bank_account='${escapeSQL(f.tenant_bank_account || '')}',
        agent_name='${escapeSQL(f.agent_name || '')}',
        agent_phone='${escapeSQL(f.agent_phone || '')}',
        agent_company='${escapeSQL(f.agent_company || '')}',
        rent_amount=${Math.round(f.rent_amount || 0)},
        deposit=${Math.round(f.deposit || 0)},
        utility_deposit=${Math.round(f.utility_deposit || 0)},
        lease_start='${f.lease_start || ''}',
        lease_end='${f.lease_end || ''}',
        status='${status}',
        notes='${escapeSQL(f.notes || '')}',
        linked_lease_ref='${escapeSQL(f.linked_lease_ref || '')}',
        updated_at='${now}'
      WHERE id=${f.id}
    `);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_floor_units (id, property_id, floor_label, tenant_name, tenant_phone, tenant_company_reg, tenant_address, director_name, director_ic, director_phone, director_notes, tenant_bank_name, tenant_bank_account, agent_name, agent_phone, agent_company, linked_lease_ref, rent_amount, deposit, utility_deposit, lease_start, lease_end, status, notes, created_at, updated_at)
      VALUES (${id}, ${f.property_id}, '${escapeSQL(f.floor_label)}', '${escapeSQL(f.tenant_name || '')}', '${escapeSQL(f.tenant_phone || '')}', '${escapeSQL(f.tenant_company_reg || '')}', '${escapeSQL(f.tenant_address || '')}', '${escapeSQL(f.director_name || '')}', '${escapeSQL(f.director_ic || '')}', '${escapeSQL(f.director_phone || '')}', '${escapeSQL(f.director_notes || '')}', '${escapeSQL(f.tenant_bank_name || '')}', '${escapeSQL(f.tenant_bank_account || '')}', '${escapeSQL(f.agent_name || '')}', '${escapeSQL(f.agent_phone || '')}', '${escapeSQL(f.agent_company || '')}', '${escapeSQL(f.linked_lease_ref || '')}', ${Math.round(f.rent_amount || 0)}, ${Math.round(f.deposit || 0)}, ${Math.round(f.utility_deposit || 0)}, '${f.lease_start || ''}', '${f.lease_end || ''}', '${status}', '${escapeSQL(f.notes || '')}', '${now}', '${now}')
    `);
  }
  return id;
}

export async function deleteFloorUnit(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_floor_units WHERE id=${id}`);
}

export async function deleteFloorUnitsForProperty(propertyId: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_floor_units WHERE property_id=${propertyId}`);
}

export async function ensureFloorUnits(propertyId: number, floorCount: number): Promise<void> {
  const existing = await getFloorUnits(propertyId);
  const now = nowISO();
  // Add missing floors
  for (let i = existing.length + 1; i <= floorCount; i++) {
    const id = Date.now() + i;
    await window.tasklet.sqlExec(`
      INSERT INTO vc_floor_units (id, property_id, floor_label, tenant_name, tenant_phone, tenant_company_reg, tenant_address, director_name, director_ic, director_phone, director_notes, tenant_bank_name, tenant_bank_account, agent_name, agent_phone, agent_company, linked_lease_ref, rent_amount, deposit, utility_deposit, lease_start, lease_end, status, notes, created_at, updated_at)
      VALUES (${id}, ${propertyId}, '${i === 1 ? "G" : String(i - 1)}', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 0, 0, 0, '', '', 'vacant', '', '${now}', '${now}')
    `);
  }
  // Remove excess floors (only if vacant)
  if (existing.length > floorCount) {
    for (let i = floorCount; i < existing.length; i++) {
      if (existing[i].status === 'vacant') {
        await window.tasklet.sqlExec(`DELETE FROM vc_floor_units WHERE id=${existing[i].id}`);
      }
    }
  }
}

// ========== Renovation Expenses ==========
export async function getRenovationExpenses(propertyId: number): Promise<RenovationExpense[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT * FROM vc_renovation_expenses
    WHERE property_id = ${propertyId}
    ORDER BY expense_date DESC, created_at DESC
  `);
  return rows as unknown as RenovationExpense[];
}

export async function saveRenovationExpense(e: Partial<RenovationExpense> & { property_id: number; description: string }): Promise<number> {
  const now = nowISO();
  const id = e.id || Date.now();
  const amt = Math.round((e.amount || 0) * 100) / 100;
  if (e.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_renovation_expenses SET
        description='${escapeSQL(e.description)}',
        amount=${amt},
        expense_date='${e.expense_date || ''}',
        category='${escapeSQL(e.category || '')}',
        contractor='${escapeSQL(e.contractor || '')}',
        notes='${escapeSQL(e.notes || '')}',
        floor_label='${escapeSQL(e.floor_label || '')}',
        updated_at='${now}'
      WHERE id=${e.id}
    `);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_renovation_expenses (id, property_id, description, amount, expense_date, category, contractor, notes, floor_label, created_at, updated_at)
      VALUES (${id}, ${e.property_id}, '${escapeSQL(e.description)}', ${amt}, '${e.expense_date || ''}', '${escapeSQL(e.category || '')}', '${escapeSQL(e.contractor || '')}', '${escapeSQL(e.notes || '')}', '${escapeSQL(e.floor_label || '')}', '${now}', '${now}')
    `);
  }
  return id;
}

export async function deleteRenovationExpense(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_renovation_expenses WHERE id=${id}`);
}

// ========== Purchase Costs ==========
export async function getPurchaseCosts(propertyId: number): Promise<PurchaseCost[]> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM vc_purchase_costs WHERE property_id=${propertyId} ORDER BY paid_date ASC, id ASC`);
  return rows as unknown as PurchaseCost[];
}

export async function savePurchaseCost(c: Partial<PurchaseCost>): Promise<number> {
  const now = nowISO();
  const amt = Math.round((c.amount || 0) * 100) / 100;
  if (c.id) {
    await window.tasklet.sqlExec(`UPDATE vc_purchase_costs SET category='${c.category || 'other'}', description='${escapeSQL(c.description || '')}', amount=${amt}, paid_date='${c.paid_date || ''}', paid_to='${escapeSQL(c.paid_to || '')}', notes='${escapeSQL(c.notes || '')}', updated_at='${now}' WHERE id=${c.id}`);
    return c.id;
  }
  const id = Date.now();
  await window.tasklet.sqlExec(`INSERT INTO vc_purchase_costs (id, property_id, category, description, amount, paid_date, paid_to, notes, created_at, updated_at) VALUES (${id}, ${c.property_id}, '${c.category || 'other'}', '${escapeSQL(c.description || '')}', ${amt}, '${c.paid_date || ''}', '${escapeSQL(c.paid_to || '')}', '${escapeSQL(c.notes || '')}', '${now}', '${now}')`);
  return id;
}

export async function deletePurchaseCost(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_purchase_costs WHERE id=${id}`);
}

export async function getTotalPurchaseCosts(propertyId: number): Promise<number> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT 
      COALESCE(p.price, 0) as purchase_price,
      COALESCE((SELECT SUM(amount) FROM vc_purchase_costs WHERE property_id=${propertyId}), 0) as fees_total
    FROM vc_properties p WHERE p.id=${propertyId}
  `);
  const r = rows[0] as any;
  return Number(r?.purchase_price || 0) + Number(r?.fees_total || 0);
}

// ========== Dashboard Stats ==========
export async function getDashboardStats(): Promise<DashboardStats> {
  // Monthly revenue calculation:
  // 1. Sum floor-level rent_amount for properties that HAVE floor-level tenant data
  // 2. For rented properties WITHOUT floor-level tenant data, use property-level rental_price
  // This avoids double-counting while ensuring property-level data is reflected
  const rows = await window.tasklet.sqlQuery(`
    SELECT
      (SELECT COUNT(*) FROM vc_properties) as totalProperties,
      (SELECT COUNT(*) FROM vc_properties WHERE status='available') as availableProperties,
      (SELECT COUNT(*) FROM vc_floor_units WHERE tenant_name != '' AND rent_amount > 0) as floorActiveRentals,
      (SELECT COUNT(*) FROM vc_properties WHERE status='rented' AND rental_price > 0
        AND NOT EXISTS (SELECT 1 FROM vc_floor_units fu WHERE fu.property_id = vc_properties.id AND fu.tenant_name != '' AND fu.rent_amount > 0)
      ) as propOnlyRentals,
      (SELECT COUNT(*) FROM vc_sales WHERE stage='completed') as completedSales,
      (SELECT COUNT(*) FROM vc_clients) as totalClients,
      (SELECT COUNT(*) FROM vc_sales WHERE stage != 'completed') as pendingDeals,
      (SELECT COALESCE(SUM(rent_amount),0) FROM vc_floor_units WHERE tenant_name != '' AND rent_amount > 0) as floorRevenue,
      (SELECT COALESCE(SUM(rental_price),0) FROM vc_properties WHERE status='rented' AND rental_price > 0
        AND NOT EXISTS (SELECT 1 FROM vc_floor_units fu WHERE fu.property_id = vc_properties.id AND fu.tenant_name != '' AND fu.rent_amount > 0)
      ) as propRevenue,
      (SELECT COUNT(*) FROM vc_invoices WHERE status='pending') as pendingInvoices,
      (SELECT COUNT(*) FROM vc_invoices WHERE status='overdue') as overdueInvoices,
      (SELECT COALESCE(SUM(amount),0) FROM vc_invoices WHERE status='paid') as totalCollected,
      (SELECT COALESCE(SUM(loan_balance),0) FROM vc_properties WHERE loan_balance > 0) as totalLoanBalance,
      (SELECT COALESCE(SUM(monthly_repayment),0) FROM vc_properties WHERE monthly_repayment > 0) as totalMonthlyRepayment,
      (SELECT COUNT(*) FROM vc_maintenance_tickets WHERE status IN ('submitted','acknowledged')) as openTickets,
      (SELECT COUNT(*) FROM vc_maintenance_tickets WHERE status='in_progress') as inProgressTickets,
      (SELECT COALESCE(SUM(amount),0) FROM vc_purchase_costs) as totalPurchaseCosts
  `);
  const r = (rows[0] || {}) as Record<string, unknown>;
  const floorActiveRentals = Number(r.floorActiveRentals || 0);
  const propOnlyRentals = Number(r.propOnlyRentals || 0);
  const floorRevenue = Number(r.floorRevenue || 0);
  const propRevenue = Number(r.propRevenue || 0);
  return {
    totalProperties: Number(r.totalProperties || 0),
    availableProperties: Number(r.availableProperties || 0),
    activeRentals: floorActiveRentals + propOnlyRentals,
    completedSales: Number(r.completedSales || 0),
    totalClients: Number(r.totalClients || 0),
    pendingDeals: Number(r.pendingDeals || 0),
    monthlyRevenue: floorRevenue + propRevenue,
    pendingInvoices: Number(r.pendingInvoices || 0),
    overdueInvoices: Number(r.overdueInvoices || 0),
    totalCollected: Number(r.totalCollected || 0),
    totalLoanBalance: Number(r.totalLoanBalance || 0),
    totalMonthlyRepayment: Number(r.totalMonthlyRepayment || 0),
    openTickets: Number(r.openTickets || 0),
    inProgressTickets: Number(r.inProgressTickets || 0),
    totalPurchaseCosts: Number(r.totalPurchaseCosts || 0),
  };
}

// ========== Expense Due Dates ==========
export async function getUpcomingExpenseDueDates(): Promise<Array<{
  id: number; name: string;
  land_tax: number; land_tax_due: string;
  assessment_tax: number; assessment_tax_due: string;
}>> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT id, name, land_tax, land_tax_due, assessment_tax, assessment_tax_due
    FROM vc_properties
    WHERE (land_tax > 0 AND land_tax_due != '') OR (assessment_tax > 0 AND assessment_tax_due != '')
    ORDER BY
      CASE WHEN land_tax_due != '' AND (assessment_tax_due = '' OR land_tax_due <= assessment_tax_due) THEN land_tax_due
           WHEN assessment_tax_due != '' THEN assessment_tax_due
           ELSE land_tax_due END ASC
  `);
  return rows as any[];
}

// ========== Recurring Charges ==========
export async function getRecurringCharges(propertyId: number): Promise<RecurringCharge[]> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM vc_recurring_charges WHERE property_id=${propertyId} ORDER BY charge_name ASC`);
  return rows as unknown as RecurringCharge[];
}

export async function saveRecurringCharge(c: Partial<RecurringCharge> & { property_id: number; charge_name: string }): Promise<number> {
  const now = new Date().toISOString();
  const id = c.id || Date.now();
  const amt = Math.round((c.amount || 0) * 100) / 100;
  if (c.id) {
    await window.tasklet.sqlExec(`UPDATE vc_recurring_charges SET charge_name='${escapeSQL(c.charge_name)}', amount=${amt}, frequency='${c.frequency || 'monthly'}', floor_label='${escapeSQL(c.floor_label || '')}', notes='${escapeSQL(c.notes || '')}', updated_at='${now}' WHERE id=${c.id}`);
  } else {
    await window.tasklet.sqlExec(`INSERT INTO vc_recurring_charges (id, property_id, charge_name, amount, frequency, floor_label, notes, created_at, updated_at) VALUES (${id}, ${c.property_id}, '${escapeSQL(c.charge_name)}', ${amt}, '${c.frequency || 'monthly'}', '${escapeSQL(c.floor_label || '')}', '${escapeSQL(c.notes || '')}', '${now}', '${now}')`);
  }
  return id;
}

export async function deleteRecurringCharge(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_recurring_charges WHERE id=${id}`);
}

// ========== Tenant History ==========
export async function archiveTenantToHistory(
  floor: FloorUnit, 
  reason: string,
  extra?: { vacate_date?: string; vacate_reason?: string; vacate_notes?: string; arrears_amount?: number }
): Promise<void> {
  if (!floor.tenant_name) return; // Don't archive empty floors
  const now = nowISO();
  const id = Date.now() + Math.floor(Math.random() * 1000);
  await window.tasklet.sqlExec(`
    INSERT INTO vc_tenant_history (id, property_id, floor_label, tenant_name, tenant_phone, tenant_company_reg, tenant_address, director_name, director_ic, director_phone, director_notes, tenant_bank_name, tenant_bank_account, agent_name, agent_phone, agent_company, rent_amount, deposit, utility_deposit, lease_start, lease_end, archived_at, archive_reason, vacate_date, vacate_reason, vacate_notes, arrears_amount)
    VALUES (${id}, ${floor.property_id}, '${escapeSQL(floor.floor_label)}', '${escapeSQL(floor.tenant_name)}', '${escapeSQL(floor.tenant_phone)}', '${escapeSQL(floor.tenant_company_reg || '')}', '${escapeSQL(floor.tenant_address || '')}', '${escapeSQL(floor.director_name || '')}', '${escapeSQL(floor.director_ic || '')}', '${escapeSQL(floor.director_phone || '')}', '${escapeSQL(floor.director_notes || '')}', '${escapeSQL(floor.tenant_bank_name || '')}', '${escapeSQL(floor.tenant_bank_account || '')}', '${escapeSQL(floor.agent_name || '')}', '${escapeSQL(floor.agent_phone || '')}', '${escapeSQL(floor.agent_company || '')}', ${floor.rent_amount || 0}, ${floor.deposit || 0}, ${floor.utility_deposit || 0}, '${escapeSQL(floor.lease_start || '')}', '${escapeSQL(floor.lease_end || '')}', '${now}', '${escapeSQL(reason)}', '${escapeSQL(extra?.vacate_date || '')}', '${escapeSQL(extra?.vacate_reason || reason)}', '${escapeSQL(extra?.vacate_notes || '')}', ${extra?.arrears_amount || 0})
  `);
}

export async function getTenantHistory(propertyId: number): Promise<TenantHistory[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT * FROM vc_tenant_history WHERE property_id = ${propertyId} ORDER BY archived_at DESC
  `);
  return rows as unknown as TenantHistory[];
}

// ========== Rental Income Report ==========
export async function getRentalIncomeByProperty(propertyId: number): Promise<{totalCollected: number; invoiceCount: number; monthlyBreakdown: {month: string; amount: number}[]}> {
  // Get total from paid invoices
  const totalRows = await window.tasklet.sqlQuery(`
    SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM vc_invoices WHERE property_id = ${propertyId} AND status = 'paid'
  `);
  const total = totalRows[0] as any;
  
  // Monthly breakdown
  const monthRows = await window.tasklet.sqlQuery(`
    SELECT strftime('%Y-%m', paid_date) as month, SUM(amount) as amount
    FROM vc_invoices WHERE property_id = ${propertyId} AND status = 'paid' AND paid_date != ''
    GROUP BY strftime('%Y-%m', paid_date) ORDER BY month DESC LIMIT 24
  `);
  
  return {
    totalCollected: Number(total?.total || 0),
    invoiceCount: Number(total?.cnt || 0),
    monthlyBreakdown: (monthRows as any[]).map(r => ({ month: r.month, amount: Number(r.amount) }))
  };
}

// ========== Arrears Payments ==========
export async function saveArrearsPayment(payment: Omit<ArrearsPayment, 'id' | 'created_at'>): Promise<void> {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  const now = nowISO();
  await window.tasklet.sqlExec(`
    INSERT INTO vc_arrears_payments (id, history_id, amount, payment_date, payment_method, notes, created_at)
    VALUES (${id}, ${payment.history_id}, ${payment.amount}, '${escapeSQL(payment.payment_date)}', '${escapeSQL(payment.payment_method)}', '${escapeSQL(payment.notes)}', '${now}')
  `);
}

export async function getArrearsPayments(historyId: number): Promise<ArrearsPayment[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT * FROM vc_arrears_payments WHERE history_id = ${historyId} ORDER BY payment_date DESC
  `);
  return rows as unknown as ArrearsPayment[];
}

export async function getArrearsBalance(historyId: number, originalAmount: number): Promise<number> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT COALESCE(SUM(amount), 0) as total_paid FROM vc_arrears_payments WHERE history_id = ${historyId}
  `);
  const totalPaid = Number((rows[0] as any)?.total_paid || 0);
  return originalAmount - totalPaid;
}

export async function deleteArrearsPayment(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_arrears_payments WHERE id=${id}`);
}

// ========== Financial Reports ==========

export interface PropertyFinancial {
  id: number;
  name: string;
  address: string;
  monthlyRent: number;
  annualRent: number;
  monthlyRepayment: number;
  mgmtFee: number;
  indahWater: number;
  recurringChargesTotal: number;
  landTaxMonthly: number;
  assessmentTaxMonthly: number;
  totalMonthlyExpense: number;
  annualExpense: number;
  annualNetIncome: number;
  loanAmount: number;
  loanBalance: number;
  monthlyPayment: number;
  interestRate: number;
  loanStart: string;
  loanAccountNo: string;
  tenureMonths: number;
  estimatedPayoffDate: string;
  spaPrice: number;
  purchasePrice: number;
  purchaseFees: number;
  totalPurchaseCost: number;
  roi: number;
  totalFloors: number;
  occupiedFloors: number;
}

export async function getPropertyFinancials(): Promise<PropertyFinancial[]> {
  const props = await window.tasklet.sqlQuery(`
    SELECT p.id, p.name, p.address, p.floor_count, p.monthly_repayment, p.loan_amount, p.loan_balance,
      p.loan_interest_rate, p.loan_start, p.loan_tenure_months, p.loan_account_no,
      p.land_tax, p.assessment_tax, p.indah_water,
      p.mgmt_fee_type, p.mgmt_fee_amount, p.mgmt_fee_pct, p.service_charge,
      p.price, p.actual_price, p.rental_price, p.status
    FROM vc_properties p ORDER BY p.name
  `);

  const rents = await window.tasklet.sqlQuery(`
    SELECT property_id, SUM(rent_amount) as total_rent,
      COUNT(CASE WHEN tenant_name != '' THEN 1 END) as occupied,
      COUNT(*) as total
    FROM vc_floor_units GROUP BY property_id
  `);
  const rentMap = new Map<number, {rent: number; occupied: number; total: number}>();
  for (const r of rents as Record<string, unknown>[]) {
    rentMap.set(Number(r.property_id), {
      rent: Number(r.total_rent || 0),
      occupied: Number(r.occupied || 0),
      total: Number(r.total || 0),
    });
  }

  const charges = await window.tasklet.sqlQuery(`
    SELECT property_id, SUM(amount) as total FROM vc_recurring_charges GROUP BY property_id
  `);
  const chargeMap = new Map<number, number>();
  for (const c of charges as Record<string, unknown>[]) {
    chargeMap.set(Number(c.property_id), Number(c.total || 0));
  }

  const costs = await window.tasklet.sqlQuery(`
    SELECT property_id, SUM(amount) as total FROM vc_purchase_costs GROUP BY property_id
  `);
  const costMap = new Map<number, number>();
  for (const c of costs as Record<string, unknown>[]) {
    costMap.set(Number(c.property_id), Number(c.total || 0));
  }

  const results: PropertyFinancial[] = [];
  for (const row of props as Record<string, unknown>[]) {
    const id = Number(row.id);
    const rentData = rentMap.get(id) || { rent: 0, occupied: 0, total: 0 };
    // Use floor-level rent if available; otherwise fallback to property-level rental_price for rented properties
    const propStatus = String(row.status || 'available');
    const propRentalPrice = Number(row.rental_price || 0);
    const hasFloorRentData = rentData.rent > 0;
    const monthlyRent = hasFloorRentData ? rentData.rent : (propStatus === 'rented' && propRentalPrice > 0 ? propRentalPrice : 0);
    const monthlyRepayment = Number(row.monthly_repayment || 0);
    const mgmtFeeType = String(row.mgmt_fee_type || 'percentage');
    const mgmtFee = mgmtFeeType === 'fixed' ? Number(row.mgmt_fee_amount || 0) : (monthlyRent * Number(row.mgmt_fee_pct || 0) / 100);
    const indahWater = Number(row.indah_water || 0);
    const recurringChargesTotal = chargeMap.get(id) || 0;
    const landTax = Number(row.land_tax || 0);
    const assessmentTax = Number(row.assessment_tax || 0);
    const landTaxMonthly = landTax / 12;
    const assessmentTaxMonthly = (assessmentTax * 2) / 12;

    const totalMonthlyExpense = monthlyRepayment + mgmtFee + indahWater + recurringChargesTotal + landTaxMonthly + assessmentTaxMonthly;
    const annualRent = monthlyRent * 12;
    const annualExpense = totalMonthlyExpense * 12;
    const annualNetIncome = annualRent - annualExpense;

    const price = Number(row.price || 0);
    const purchaseFees = costMap.get(id) || 0;
    const effectivePrice = (Number(row.actual_price) || 0) > 0 ? Number(row.actual_price) : price;
    const totalPurchaseCost = effectivePrice + purchaseFees;
    const roi = totalPurchaseCost > 0 ? (annualNetIncome / totalPurchaseCost) * 100 : 0;
    const purchasePrice_val = effectivePrice;
    const purchaseFees_val = purchaseFees;

    let estimatedPayoffDate = '';
    const loanStart = String(row.loan_start || '');
    const tenureMonths = Number(row.loan_tenure_months || 0);
    if (loanStart && tenureMonths > 0) {
      const start = new Date(loanStart);
      start.setMonth(start.getMonth() + tenureMonths);
      estimatedPayoffDate = start.toISOString().slice(0, 10);
    }

    results.push({
      id, name: String(row.name), address: String(row.address || ''),
      monthlyRent, annualRent,
      monthlyRepayment, mgmtFee, indahWater, recurringChargesTotal,
      landTaxMonthly, assessmentTaxMonthly, totalMonthlyExpense,
      annualExpense, annualNetIncome,
      loanAmount: Number(row.loan_amount || 0),
      loanBalance: Number(row.loan_balance || 0),
      monthlyPayment: monthlyRepayment,
      interestRate: Number(row.loan_interest_rate || 0),
      loanStart, loanAccountNo: String(row.loan_account_no || ''),
      tenureMonths, estimatedPayoffDate,
      spaPrice: price, purchasePrice: purchasePrice_val, purchaseFees: purchaseFees_val, totalPurchaseCost, roi,
      totalFloors: rentData.total || Number(row.floor_count || 1),
      occupiedFloors: rentData.occupied,
    });
  }
  return results;
}

export async function getFinancialSummary(): Promise<{
  totalMonthlyRent: number;
  totalMonthlyExpense: number;
  totalNetMonthly: number;
  totalLoanBalance: number;
  totalMonthlyRepayment: number;
  totalProperties: number;
  occupiedFloors: number;
  totalFloors: number;
  occupancyRate: number;
  collectionRate: number;
  totalPurchaseValue: number;
  totalSpaPrice: number;
  totalPurchasePrice: number;
  totalPurchaseFees: number;
  totalMarketValue: number;
}> {
  const data = await getPropertyFinancials();

  // Get latest market value per property from vc_valuations; fallback to actual_price
  let totalMarketValue = 0;
  try {
    const valRows = await window.tasklet.sqlQuery(`
      SELECT v.property_id, v.market_value FROM vc_valuations v
      INNER JOIN (SELECT property_id, MAX(valuation_date) as max_date FROM vc_valuations GROUP BY property_id) latest
      ON v.property_id = latest.property_id AND v.valuation_date = latest.max_date
    `);
    const valuedIds = new Set((valRows as Record<string, unknown>[]).map(r => Number(r.property_id)));
    for (const r of valRows as Record<string, unknown>[]) {
      totalMarketValue += Number(r.market_value || 0);
    }
    // For properties without valuations, use purchasePrice (actual_price) as fallback
    for (const p of data) {
      if (!valuedIds.has(p.id)) {
        totalMarketValue += p.purchasePrice || p.spaPrice || 0;
      }
    }
  } catch {
    // If valuations table doesn't exist, use all purchase prices
    totalMarketValue = data.reduce((s, p) => s + (p.purchasePrice || p.spaPrice || 0), 0);
  }
  const totalPurchaseValue = data.reduce((s, p) => s + p.totalPurchaseCost, 0);
  const totalSpaPrice = data.reduce((s, p) => s + p.spaPrice, 0);
  const totalPurchasePrice = data.reduce((s, p) => s + p.purchasePrice, 0);
  const totalPurchaseFees = data.reduce((s, p) => s + p.purchaseFees, 0);
  const totalMonthlyRent = data.reduce((s, p) => s + p.monthlyRent, 0);
  const totalMonthlyExpense = data.reduce((s, p) => s + p.totalMonthlyExpense, 0);
  const totalLoanBalance = data.reduce((s, p) => s + p.loanBalance, 0);
  const totalMonthlyRepayment = data.reduce((s, p) => s + p.monthlyRepayment, 0);
  const totalFloors = data.reduce((s, p) => s + p.totalFloors, 0);
  const occupiedFloors = data.reduce((s, p) => s + p.occupiedFloors, 0);

  const invRows = await window.tasklet.sqlQuery(`
    SELECT
      COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END), 0) as paid,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN amount ELSE 0 END), 0) as total
    FROM vc_invoices
  `);
  const inv = (invRows[0] || {}) as Record<string, unknown>;
  const totalInv = Number(inv.total || 0);
  const paidInv = Number(inv.paid || 0);

  return {
    totalMonthlyRent,
    totalMonthlyExpense,
    totalNetMonthly: totalMonthlyRent - totalMonthlyExpense,
    totalLoanBalance,
    totalMonthlyRepayment,
    totalProperties: data.length,
    occupiedFloors,
    totalFloors,
    occupancyRate: totalFloors > 0 ? (occupiedFloors / totalFloors) * 100 : 0,
    collectionRate: totalInv > 0 ? (paidInv / totalInv) * 100 : 0,
    totalPurchaseValue,
    totalSpaPrice,
    totalPurchasePrice,
    totalPurchaseFees,
    totalMarketValue,
  };
}

// ========== Auto Billing ==========
export interface PreviewComponent {
  propertyId: number;
  propertyName: string;
  floorLabel: string;
  rent: number;
}

export interface MergedPreviewItem {
  mergeKey: string;
  propertyId: number;
  propertyName: string;
  floorLabel: string;
  tenantName: string;
  rent: number;
  charges: Array<{ id: number; name: string; amount: number; floorLabel: string }>;
  alreadyExists: boolean;
  isMerged: boolean;
  linkedLeaseRef: string;
  components: PreviewComponent[];
}

export async function previewMonthlyInvoices(year: number, month: number): Promise<MergedPreviewItem[]> {
  const billingMonth = `${year}-${String(month).padStart(2, '0')}`;

  // Get existing invoices for this month (check both individual and merged floor_labels)
  const existing = await window.tasklet.sqlQuery(
    `SELECT property_id, floor_label, merged_data FROM vc_invoices WHERE billing_month='${billingMonth}'`
  );
  const existingPropFloors = new Set<string>();
  for (const r of existing as Record<string, unknown>[]) {
    const pid = Number(r.property_id);
    const fl = String(r.floor_label || '');
    // Expand comma-separated floor labels
    for (const f of fl.split(',')) {
      if (f.trim()) existingPropFloors.add(`${pid}-${f.trim()}`);
    }
    // Also expand merged_data
    try {
      const md = JSON.parse(String(r.merged_data || '[]'));
      if (Array.isArray(md)) {
        for (const comp of md) {
          const cpid = Number(comp.propertyId || comp.property_id || 0);
          const cfl = String(comp.floorLabel || comp.floor_label || '');
          for (const f of cfl.split(',')) {
            if (f.trim() && cpid) existingPropFloors.add(`${cpid}-${f.trim()}`);
          }
        }
      }
    } catch {}
  }

  // Get ALL occupied floors (including rent=0 for grouping with same tenant)
  const floors = await window.tasklet.sqlQuery(`
    SELECT f.property_id, f.floor_label, f.tenant_name, f.rent_amount,
      f.linked_lease_ref, p.name as property_name
    FROM vc_floor_units f
    JOIN vc_properties p ON f.property_id = p.id
    WHERE f.tenant_name != ''
    ORDER BY p.name, f.floor_label
  `);

  // Get ALL recurring charges
  const allChargesRaw = await window.tasklet.sqlQuery(`
    SELECT id, property_id, charge_name, amount, floor_label
    FROM vc_recurring_charges ORDER BY charge_name
  `);

  // Step 1: Group floors by (property_id, tenant_name)
  const propTenantMap = new Map<string, Array<Record<string, unknown>>>();
  for (const f of floors as Record<string, unknown>[]) {
    const key = `${f.property_id}|||${f.tenant_name}`;
    if (!propTenantMap.has(key)) propTenantMap.set(key, []);
    propTenantMap.get(key)!.push(f);
  }

  // Step 2: Build intermediate grouped items
  interface IntItem {
    propertyId: number; propertyName: string; floorLabels: string[];
    tenantName: string; rent: number; linkedLeaseRef: string;
    charges: Array<{ id: number; name: string; amount: number; floorLabel: string }>;
    constituentKeys: string[];
  }
  const intermediates: IntItem[] = [];

  for (const [, groupFloors] of propTenantMap) {
    const first = groupFloors[0];
    const propId = Number(first.property_id);
    const floorLabels = groupFloors.map(f => String(f.floor_label));
    const totalRent = groupFloors.reduce((s, f) => s + Number(f.rent_amount || 0), 0);
    if (totalRent <= 0) continue; // Skip if no rent at all for this tenant group
    const ref = String(first.linked_lease_ref || '');

    // Collect charges for all floors in this group (deduplicated)
    const charges: Array<{ id: number; name: string; amount: number; floorLabel: string }> = [];
    const seenIds = new Set<number>();
    for (const c of allChargesRaw as Record<string, unknown>[]) {
      const cPid = Number(c.property_id);
      const cFl = String(c.floor_label || '');
      const cId = Number(c.id);
      if (cPid !== propId || seenIds.has(cId)) continue;
      if (cFl === '' || floorLabels.includes(cFl)) {
        seenIds.add(cId);
        charges.push({ id: cId, name: String(c.charge_name), amount: Number(c.amount || 0), floorLabel: cFl });
      }
    }

    intermediates.push({
      propertyId: propId, propertyName: String(first.property_name || ''),
      floorLabels, tenantName: String(first.tenant_name || ''), rent: totalRent,
      linkedLeaseRef: ref, charges,
      constituentKeys: floorLabels.map(fl => `${propId}-${fl}`),
    });
  }

  // Step 3: Merge by linked_lease_ref across properties
  const leaseGroups = new Map<string, IntItem[]>();
  const ungrouped: IntItem[] = [];
  for (const item of intermediates) {
    if (item.linkedLeaseRef) {
      if (!leaseGroups.has(item.linkedLeaseRef)) leaseGroups.set(item.linkedLeaseRef, []);
      leaseGroups.get(item.linkedLeaseRef)!.push(item);
    } else {
      ungrouped.push(item);
    }
  }

  const result: MergedPreviewItem[] = [];

  // Helper: check if any constituent already has an invoice
  function anyExists(keys: string[]): boolean {
    return keys.some(k => existingPropFloors.has(k));
  }

  // Process linked lease groups
  for (const [ref, items] of leaseGroups) {
    if (items.length === 1 && items[0].floorLabels.length === 1) {
      // Single property, single floor - not merged
      const it = items[0];
      const fl = it.floorLabels[0];
      result.push({
        mergeKey: `${it.propertyId}-${fl}`, propertyId: it.propertyId,
        propertyName: it.propertyName, floorLabel: fl, tenantName: it.tenantName,
        rent: it.rent, charges: it.charges, alreadyExists: anyExists(it.constituentKeys),
        isMerged: false, linkedLeaseRef: ref,
        components: [{ propertyId: it.propertyId, propertyName: it.propertyName, floorLabel: fl, rent: it.rent }],
      });
    } else {
      // Merged across properties or multiple floors
      const allKeys = items.flatMap(i => i.constituentKeys);
      const totalRent = items.reduce((s, i) => s + i.rent, 0);
      const allCharges = items.flatMap(i => i.charges);
      const components = items.map(i => ({
        propertyId: i.propertyId, propertyName: i.propertyName,
        floorLabel: i.floorLabels.join(','), rent: i.rent,
      }));
      const primaryName = items.length === 1
        ? items[0].propertyName
        : items.map(i => i.propertyName).join(' + ');
      const floorLabelCombined = items.length === 1
        ? items[0].floorLabels.join(',')
        : items.map(i => `${i.floorLabels.join(',')}`).join(',');

      result.push({
        mergeKey: `linked-${ref}`, propertyId: items[0].propertyId,
        propertyName: primaryName, floorLabel: floorLabelCombined,
        tenantName: items[0].tenantName, rent: totalRent, charges: allCharges,
        alreadyExists: anyExists(allKeys), isMerged: true, linkedLeaseRef: ref, components,
      });
    }
  }

  // Process ungrouped items
  for (const item of ungrouped) {
    if (item.floorLabels.length === 1) {
      const fl = item.floorLabels[0];
      result.push({
        mergeKey: `${item.propertyId}-${fl}`, propertyId: item.propertyId,
        propertyName: item.propertyName, floorLabel: fl, tenantName: item.tenantName,
        rent: item.rent, charges: item.charges, alreadyExists: anyExists(item.constituentKeys),
        isMerged: false, linkedLeaseRef: '',
        components: [{ propertyId: item.propertyId, propertyName: item.propertyName, floorLabel: fl, rent: item.rent }],
      });
    } else {
      // Multiple floors, same tenant, same property - merged within property
      result.push({
        mergeKey: `${item.propertyId}-${item.floorLabels.join(',')}`, propertyId: item.propertyId,
        propertyName: item.propertyName, floorLabel: item.floorLabels.join(','),
        tenantName: item.tenantName, rent: item.rent, charges: item.charges,
        alreadyExists: anyExists(item.constituentKeys), isMerged: true, linkedLeaseRef: '',
        components: [{ propertyId: item.propertyId, propertyName: item.propertyName, floorLabel: item.floorLabels.join(','), rent: item.rent }],
      });
    }
  }

  return result;
}

export async function generateMonthlyInvoices(
  year: number,
  month: number,
  dueDay: number = 7,
  previewItems?: MergedPreviewItem[],
  excludedChargeKeys?: Set<string>,
  adjustmentsMap?: Record<string, Array<{name: string; amount: number}>>
): Promise<{created: number; skipped: number; total: number}> {
  const billingMonth = `${year}-${String(month).padStart(2, '0')}`;
  const now = nowISO();
  const daysInMonth = new Date(year, month, 0).getDate();
  const safeDueDay = Math.min(dueDay, daysInMonth);
  const dueDate = `${billingMonth}-${String(safeDueDay).padStart(2, '0')}`;

  // Get preview data if not provided
  const items = previewItems || await previewMonthlyInvoices(year, month);

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    if (item.alreadyExists) { skipped++; continue; }

    // Calculate charges (excluding waived ones)
    let chargesTotal = 0;
    const chargesDetailArr: Array<{name: string; amount: number}> = [];
    for (const c of item.charges) {
      const exKey = `${item.mergeKey}-${c.id}`;
      if (excludedChargeKeys && excludedChargeKeys.has(exKey)) continue;
      chargesTotal += c.amount;
      chargesDetailArr.push({ name: c.name, amount: c.amount });
    }

    // Adjustments
    const adjs = adjustmentsMap?.[item.mergeKey] || [];
    const adjTotal = adjs.reduce((s, a) => s + a.amount, 0);
    const adjJson = escapeSQL(JSON.stringify(adjs));
    const cdJson = escapeSQL(JSON.stringify(chargesDetailArr));

    const totalAmount = Math.round(item.rent + chargesTotal + adjTotal);
    const invNo = 'INV-' + Date.now().toString().slice(-8) + '-' + created;

    // Build description
    let desc = `${billingMonth} 租金`;
    if (item.isMerged && item.components.length > 1) {
      desc += ' - 合并账单: ' + item.components.map(c => `${c.propertyName} (${c.floorLabel}楼 RM${c.rent.toLocaleString()})`).join(' + ');
    } else {
      desc += ` - ${item.propertyName} ${item.floorLabel}楼`;
    }
    if (chargesTotal > 0) desc += ` (含附加费 RM${chargesTotal})`;
    if (adjs.length > 0) desc += ` | 调整: ${adjs.map(a => `${a.name} ${a.amount > 0 ? '+' : ''}${a.amount}`).join(', ')}`;

    // Build merged_data JSON
    const mergedDataJson = escapeSQL(JSON.stringify(item.components));

    // Use primary property_id, combined floor_label
    await window.tasklet.sqlExec(`
      INSERT INTO vc_invoices (id, invoice_no, property_id, tenant_id, amount, due_date, paid_date, status, description, floor_label, billing_month, rent_amount, charges_amount, adjustments, charges_detail, auto_generated, merged_data, created_at, updated_at)
      VALUES (${generateId() + created}, '${escapeSQL(invNo)}', ${item.propertyId}, 0, ${totalAmount}, '${dueDate}', '', 'pending', '${escapeSQL(desc)}', '${escapeSQL(item.floorLabel)}', '${billingMonth}', ${item.rent}, ${chargesTotal}, '${adjJson}', '${cdJson}', 1, '${mergedDataJson}', '${now}', '${now}')
    `);
    created++;
  }

  return { created, skipped, total: created + skipped };
}

export async function getInvoiceSummaryByMonth(): Promise<Array<{
  month: string; total: number; paid: number; pending: number; overdue: number; count: number;
}>> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT billing_month,
      COALESCE(SUM(amount), 0) as total,
      COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END), 0) as paid,
      COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN status='overdue' THEN amount ELSE 0 END), 0) as overdue,
      COUNT(*) as count
    FROM vc_invoices
    WHERE billing_month != ''
    GROUP BY billing_month
    ORDER BY billing_month DESC
    LIMIT 12
  `);
  return (rows as Record<string, unknown>[]).map(r => ({
    month: String(r.billing_month || ''),
    total: Number(r.total || 0),
    paid: Number(r.paid || 0),
    pending: Number(r.pending || 0),
    overdue: Number(r.overdue || 0),
    count: Number(r.count || 0),
  }));
}

// ========== User Auth ==========
export async function verifyLogin(username: string, pin: string): Promise<{id: number; name: string; role: string; phone: string; must_change_pin: number} | null> {
  const rows = await window.tasklet.sqlQuery(
    `SELECT id, name, role, phone, must_change_pin FROM vc_users WHERE (username='${escapeSQL(username)}' OR phone='${escapeSQL(username)}') AND pin='${escapeSQL(pin)}' AND active=1`
  );
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  // Record last login time
  const now = nowISO();
  try { await window.tasklet.sqlExec(`UPDATE vc_users SET last_login='${now}', last_active='${now}' WHERE id=${Number(r.id)}`); } catch {}
  return { id: Number(r.id), name: String(r.name), role: String(r.role), phone: String(r.phone || ''), must_change_pin: Number(r.must_change_pin ?? 0) };
}

export async function changePin(userId: number, newPin: string): Promise<void> {
  await window.tasklet.sqlExec(`UPDATE vc_users SET pin='${escapeSQL(newPin)}', must_change_pin=0, updated_at='${nowISO()}' WHERE id=${userId}`);
}

export async function forceLogoutUser(userId: number): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/force-logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('vencos_token') || ''}`,
      },
      body: JSON.stringify({ userId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ========== WhatsApp Config ==========
export async function getWhatsAppConfig(): Promise<{phone_number_id: string; access_token: string; business_id: string; active: boolean} | null> {
  const rows = await window.tasklet.sqlQuery(`SELECT phone_number_id, access_token, business_id, active FROM vc_whatsapp_config WHERE id=1`);
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    phone_number_id: String(r.phone_number_id || ''),
    access_token: String(r.access_token || ''),
    business_id: String(r.business_id || ''),
    active: Number(r.active) === 1,
  };
}

export async function saveWhatsAppConfig(config: {phone_number_id: string; access_token: string; business_id: string}): Promise<void> {
  const now = nowISO();
  await window.tasklet.sqlExec(`INSERT OR REPLACE INTO vc_whatsapp_config (id, phone_number_id, access_token, business_id, active, created_at) VALUES (1, '${escapeSQL(config.phone_number_id)}', '${escapeSQL(config.access_token)}', '${escapeSQL(config.business_id)}', 1, '${now}')`);
}

export async function logWhatsAppMessage(msg: {recipient_phone: string; recipient_name: string; message_type: string; template_name: string; content: string; status: string; property_id?: number; invoice_id?: number}): Promise<void> {
  const now = nowISO();
  const id = generateId();
  await window.tasklet.sqlExec(`INSERT INTO vc_message_log (id, recipient_phone, recipient_name, message_type, template_name, content, status, property_id, invoice_id, created_at) VALUES (${id}, '${escapeSQL(msg.recipient_phone)}', '${escapeSQL(msg.recipient_name)}', '${escapeSQL(msg.message_type)}', '${escapeSQL(msg.template_name)}', '${escapeSQL(msg.content)}', '${escapeSQL(msg.status)}', ${msg.property_id || 0}, ${msg.invoice_id || 0}, '${now}')`);
}

export async function getMessageLog(limit?: number): Promise<Array<{id: number; recipient_phone: string; recipient_name: string; message_type: string; content: string; status: string; error_message: string; created_at: string}>> {
  const rows = await window.tasklet.sqlQuery(`SELECT id, recipient_phone, recipient_name, message_type, content, status, error_message, created_at FROM vc_message_log ORDER BY created_at DESC LIMIT ${limit || 50}`);
  return (rows as Record<string, unknown>[]).map(r => ({
    id: Number(r.id),
    recipient_phone: String(r.recipient_phone || ''),
    recipient_name: String(r.recipient_name || ''),
    message_type: String(r.message_type || ''),
    content: String(r.content || ''),
    status: String(r.status || ''),
    error_message: String(r.error_message || ''),
    created_at: String(r.created_at || ''),
  }));
}


// ========== Agent (中介) CRUD ==========
export async function getAgents(): Promise<Agent[]> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM vc_agents ORDER BY name ASC`);
  return rows as unknown as Agent[];
}

export async function saveAgent(a: Partial<Agent>): Promise<number> {
  const now = nowISO();
  const id = a.id || Date.now() + Math.floor(Math.random() * 1000);
  if (a.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_agents SET
        name='${escapeSQL(a.name || '')}',
        phone='${escapeSQL(a.phone || '')}',
        whatsapp='${escapeSQL(a.whatsapp || '')}',
        email='${escapeSQL(a.email || '')}',
        company='${escapeSQL(a.company || '')}',
        areas='${escapeSQL(a.areas || '')}',
        status='${escapeSQL(a.status || 'active')}',
        notes='${escapeSQL(a.notes || '')}',
        updated_at='${now}'
      WHERE id=${a.id}
    `);
    return a.id;
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_agents (id, name, phone, whatsapp, email, company, areas, status, notes, created_at, updated_at)
      VALUES (${id}, '${escapeSQL(a.name || '')}', '${escapeSQL(a.phone || '')}', '${escapeSQL(a.whatsapp || '')}', '${escapeSQL(a.email || '')}', '${escapeSQL(a.company || '')}', '${escapeSQL(a.areas || '')}', '${escapeSQL(a.status || 'active')}', '${escapeSQL(a.notes || '')}', '${now}', '${now}')
    `);
    return id;
  }
}

export async function deleteAgent(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_agents WHERE id=${id}`);
}

export async function getAgentsByArea(address: string): Promise<Agent[]> {
  const allAgents = await getAgents();
  if (!address) return allAgents;
  const addrLower = address.toLowerCase();
  const matched = allAgents.filter(agent => {
    if (!agent.areas || agent.status !== 'active') return false;
    const areas = agent.areas.split(',').map(a => a.trim().toLowerCase());
    return areas.some(area => area && addrLower.includes(area));
  });
  return matched;
}

// ========== Payment Receipts (via vc_documents) ==========
export async function getReceiptsForInvoice(invoiceId: number): Promise<PropertyDocument[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT d.*, p.name as property_name, c.name as linked_client_name
    FROM vc_documents d
    LEFT JOIN vc_properties p ON d.property_id = p.id
    LEFT JOIN vc_clients c ON d.linked_client_id = c.id
    WHERE d.linked_invoice_id = ${invoiceId}
    ORDER BY d.created_at DESC
  `);
  return rows as unknown as PropertyDocument[];
}

export async function savePaymentReceipt(invoiceId: number, propertyId: number, fileName: string, fileData: string, fileSize: number, fileMime: string, onProgress?: (pct: number) => void): Promise<void> {
  await saveDocument({
    property_id: propertyId,
    doc_type: 'other',
    file_name: fileName,
    file_data: fileData,
    file_size: fileSize,
    file_mime: fileMime,
    notes: `收款凭证 - 账单 #${invoiceId}`,
    linked_invoice_id: invoiceId,
  } as any, onProgress);
}

// ========== Penalty Config ==========
export async function getPenaltyConfigs(): Promise<PenaltyConfig[]> {
  const rows = await window.tasklet.sqlQuery(`
    SELECT pc.*, p.name as property_name
    FROM vc_penalty_config pc
    LEFT JOIN vc_properties p ON pc.property_id = p.id
    ORDER BY pc.property_id ASC
  `);
  return (rows as any[]).map(r => ({
    id: Number(r.id),
    property_id: Number(r.property_id || 0),
    property_name: String(r.property_name || '全局默认'),
    rate_pct: Number(r.rate_pct || 0),
    grace_days: Number(r.grace_days || 0),
    calc_method: String(r.calc_method || 'monthly_pct'),
    min_amount: Number(r.min_amount || 0),
    max_amount: Number(r.max_amount || 0),
    enabled: Number(r.enabled ?? 1),
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
  }));
}

export async function savePenaltyConfig(c: Partial<PenaltyConfig>): Promise<void> {
  const now = nowISO();
  if (c.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_penalty_config SET
        property_id=${c.property_id || 0},
        rate_pct=${c.rate_pct || 0},
        grace_days=${c.grace_days || 0},
        calc_method='${escapeSQL(c.calc_method || 'monthly_pct')}',
        min_amount=${c.min_amount || 0},
        max_amount=${c.max_amount || 0},
        enabled=${c.enabled ?? 1},
        updated_at='${now}'
      WHERE id=${c.id}
    `);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_penalty_config (id, property_id, rate_pct, grace_days, calc_method, min_amount, max_amount, enabled, created_at, updated_at)
      VALUES (${Date.now()}, ${c.property_id || 0}, ${c.rate_pct || 0}, ${c.grace_days || 0}, '${escapeSQL(c.calc_method || 'monthly_pct')}', ${c.min_amount || 0}, ${c.max_amount || 0}, ${c.enabled ?? 1}, '${now}', '${now}')
    `);
  }
}

export async function deletePenaltyConfig(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_penalty_config WHERE id=${id}`);
}

export async function generatePenaltyInvoices(): Promise<number> {
  // Get all penalty configs
  const configs = await getPenaltyConfigs();
  if (configs.length === 0) return 0;

  // Get overdue invoices that are NOT already penalty invoices
  const overdueRows = await window.tasklet.sqlQuery(`
    SELECT i.*, p.name as property_name, c.name as tenant_name
    FROM vc_invoices i
    LEFT JOIN vc_properties p ON i.property_id = p.id
    LEFT JOIN vc_clients c ON i.tenant_id = c.id
    WHERE i.status = 'overdue' AND i.is_penalty = 0
  `);
  const overdueInvoices = overdueRows as any[];
  if (overdueInvoices.length === 0) return 0;

  let generated = 0;
  const now = nowISO();
  const today = new Date();

  for (const inv of overdueInvoices) {
    // Find applicable config: property-specific first, then global (property_id=0)
    const propConfig = configs.find(c => c.property_id === Number(inv.property_id) && c.enabled);
    const globalConfig = configs.find(c => c.property_id === 0 && c.enabled);
    const config = propConfig || globalConfig;
    if (!config) continue;

    // Calculate overdue days
    const dueDate = new Date(inv.due_date);
    if (isNaN(dueDate.getTime())) continue;
    const overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (overdueDays <= config.grace_days) continue;

    // Check if penalty already generated for this invoice
    const existing = await window.tasklet.sqlQuery(
      `SELECT id FROM vc_invoices WHERE penalty_parent_id = ${inv.id} AND is_penalty = 1`
    );
    if ((existing as any[]).length > 0) continue;

    // Calculate penalty amount
    // Grace period is just a trigger threshold — once exceeded, ALL overdue days count
    const effectiveDays = overdueDays;
    const months = effectiveDays / 30;
    let penaltyAmount = Math.round(Number(inv.amount) * (config.rate_pct / 100) * months);

    // Apply min/max
    if (config.min_amount > 0 && penaltyAmount < config.min_amount) penaltyAmount = config.min_amount;
    if (config.max_amount > 0 && penaltyAmount > config.max_amount) penaltyAmount = config.max_amount;
    if (penaltyAmount <= 0) continue;

    // Generate penalty invoice
    const penaltyId = Date.now() + generated;
    const invNo = 'PEN-' + penaltyId.toString().slice(-8);
    await window.tasklet.sqlExec(`
      INSERT INTO vc_invoices (id, invoice_no, property_id, tenant_id, amount, due_date, status, description, floor_label, billing_month, is_penalty, penalty_parent_id, created_at, updated_at)
      VALUES (${penaltyId}, '${invNo}', ${inv.property_id}, ${inv.tenant_id}, ${penaltyAmount}, '${now.slice(0,10)}', 'pending', '逾期罚款 - ${escapeSQL(String(inv.invoice_no || ''))} (逾期${effectiveDays}天, ${config.rate_pct}%/月)', '${escapeSQL(String(inv.floor_label || ''))}', '${escapeSQL(String(inv.billing_month || ''))}', 1, ${inv.id}, '${now}', '${now}')
    `);
    generated++;
  }
  return generated;
}

// ========== Activity Tracking ==========
let _lastActivityTs = 0;
export async function updateLastActive(userId: number): Promise<void> {
  const now = Date.now();
  // Debounce: update at most once per 60 seconds
  if (now - _lastActivityTs < 60000) return;
  _lastActivityTs = now;
  try {
    await window.tasklet.sqlExec(`UPDATE vc_users SET last_active='${nowISO()}' WHERE id=${userId}`);
  } catch {}
}

// ========== Tenancy Charges ==========
export interface TenancyCharge {
  id: number;
  property_id: number;
  floor_unit_id: number;
  charge_type: string;
  charge_name: string;
  amount: number;
  payment_date: string;
  tenant_name: string;
  lease_start: string;
  lease_end: string;
  file_name: string;
  file_data: string;
  file_size: number;
  file_mime: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export async function getTenancyCharges(propertyId: number, floorUnitId?: number): Promise<TenancyCharge[]> {
  let sql = `SELECT * FROM vc_tenancy_charges WHERE property_id=${propertyId}`;
  if (floorUnitId) sql += ` AND floor_unit_id=${floorUnitId}`;
  sql += ` ORDER BY created_at DESC`;
  const rows = await window.tasklet.sqlQuery(sql);
  return (rows as Record<string, unknown>[]).map(r => ({
    id: Number(r.id),
    property_id: Number(r.property_id),
    floor_unit_id: Number(r.floor_unit_id),
    charge_type: String(r.charge_type || ''),
    charge_name: String(r.charge_name || ''),
    amount: Number(r.amount || 0),
    payment_date: String(r.payment_date || ''),
    tenant_name: String(r.tenant_name || ''),
    lease_start: String(r.lease_start || ''),
    lease_end: String(r.lease_end || ''),
    file_name: String(r.file_name || ''),
    file_data: String(r.file_data || ''),
    file_size: Number(r.file_size || 0),
    file_mime: String(r.file_mime || ''),
    notes: String(r.notes || ''),
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
  }));
}

export async function saveTenancyCharge(charge: Partial<TenancyCharge> & { file_data_raw?: string }, onProgress?: (pct: number) => void): Promise<void> {
  const now = nowISO();
  // Store file on disk if present
  let filePath = '';
  if (charge.file_data_raw) {
    const chargeId = charge.id || Date.now();
    const safeFileName = (charge.file_name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    filePath = `/agent/home/uploads/tenancy_charges/${charge.property_id || 0}/${chargeId}_${safeFileName}.b64`;
    await writeFileChunked(filePath, charge.file_data_raw, onProgress);
  }

  if (charge.id) {
    const fileUpdate = filePath ? `file_data='${escapeSQL(filePath)}',` : '';
    const sizeUpdate = charge.file_size !== undefined && filePath ? `file_size=${charge.file_size},` : '';
    const mimeUpdate = charge.file_mime && filePath ? `file_mime='${escapeSQL(charge.file_mime)}',` : '';
    const nameUpdate = charge.file_name && filePath ? `file_name='${escapeSQL(charge.file_name)}',` : '';
    await window.tasklet.sqlExec(`
      UPDATE vc_tenancy_charges SET
        charge_type='${escapeSQL(charge.charge_type || 'other')}',
        charge_name='${escapeSQL(charge.charge_name || '')}',
        amount=${charge.amount || 0},
        payment_date='${escapeSQL(charge.payment_date || '')}',
        ${nameUpdate}
        ${fileUpdate}
        ${sizeUpdate}
        ${mimeUpdate}
        notes='${escapeSQL(charge.notes || '')}',
        updated_at='${now}'
      WHERE id=${charge.id}
    `);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_tenancy_charges (property_id, floor_unit_id, charge_type, charge_name, amount, payment_date, tenant_name, lease_start, lease_end, file_name, file_data, file_size, file_mime, notes, created_at, updated_at)
      VALUES (${charge.property_id || 0}, ${charge.floor_unit_id || 0}, '${escapeSQL(charge.charge_type || 'other')}', '${escapeSQL(charge.charge_name || '')}', ${charge.amount || 0}, '${escapeSQL(charge.payment_date || '')}', '${escapeSQL(charge.tenant_name || '')}', '${escapeSQL(charge.lease_start || '')}', '${escapeSQL(charge.lease_end || '')}', '${escapeSQL(charge.file_name || '')}', '${escapeSQL(filePath)}', ${charge.file_size || 0}, '${escapeSQL(charge.file_mime || '')}', '${escapeSQL(charge.notes || '')}', '${now}', '${now}')
    `);
  }
}

export async function deleteTenancyCharge(id: number): Promise<void> {
  // Get file path before deleting to clean up
  const rows = await window.tasklet.sqlQuery(`SELECT file_data FROM vc_tenancy_charges WHERE id=${id}`);
  const r = (rows as Record<string, unknown>[])[0];
  if (r && String(r.file_data || '').startsWith('/agent/')) {
    try { await window.tasklet.runCommand(`rm -f '${r.file_data}'`); } catch {}
  }
  await window.tasklet.sqlExec(`DELETE FROM vc_tenancy_charges WHERE id=${id}`);
}

// ========== Valuations ==========
export interface Valuation {
  id: number;
  property_id: number;
  valuation_date: string;
  market_value: number;
  source: string;
  notes: string;
  created_at: string;
}

export async function getValuations(propertyId: number): Promise<Valuation[]> {
  const rows = await window.tasklet.sqlQuery(`SELECT * FROM vc_valuations WHERE property_id=${propertyId} ORDER BY valuation_date DESC, created_at DESC`);
  return (rows as Record<string, unknown>[]).map(r => ({
    id: Number(r.id),
    property_id: Number(r.property_id),
    valuation_date: String(r.valuation_date || ''),
    market_value: Number(r.market_value || 0),
    source: String(r.source || 'manual'),
    notes: String(r.notes || ''),
    created_at: String(r.created_at || ''),
  }));
}

export async function saveValuation(v: Partial<Valuation>): Promise<void> {
  const now = nowISO();
  if (v.id) {
    await window.tasklet.sqlExec(`
      UPDATE vc_valuations SET
        valuation_date='${escapeSQL(v.valuation_date || '')}',
        market_value=${v.market_value || 0},
        source='${escapeSQL(v.source || 'manual')}',
        notes='${escapeSQL(v.notes || '')}'
      WHERE id=${v.id}
    `);
  } else {
    await window.tasklet.sqlExec(`
      INSERT INTO vc_valuations (property_id, valuation_date, market_value, source, notes, created_at)
      VALUES (${v.property_id || 0}, '${escapeSQL(v.valuation_date || '')}', ${v.market_value || 0}, '${escapeSQL(v.source || 'manual')}', '${escapeSQL(v.notes || '')}', '${now}')
    `);
  }
}

export async function getAllLatestValuations(): Promise<Map<number, number>> {
  try {
    const rows = await window.tasklet.sqlQuery(`
      SELECT v.property_id, v.market_value FROM vc_valuations v
      INNER JOIN (SELECT property_id, MAX(valuation_date) as max_date FROM vc_valuations GROUP BY property_id) latest
      ON v.property_id = latest.property_id AND v.valuation_date = latest.max_date
    `);
    const map = new Map<number, number>();
    for (const r of rows as Record<string, unknown>[]) {
      map.set(Number(r.property_id), Number(r.market_value || 0));
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function deleteValuation(id: number): Promise<void> {
  await window.tasklet.sqlExec(`DELETE FROM vc_valuations WHERE id=${id}`);
}
