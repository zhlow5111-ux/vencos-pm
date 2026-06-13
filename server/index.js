const express = require('express');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'vencos-pm-secret-2024';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

// Ensure data and uploads directories exist
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

// Initialize SQLite
const db = new Database(path.join(DATA_DIR, 'vencos.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ========== DB Schema Initialization ==========
function initDatabase() {
  const SCHEMA_VERSION = 36;
  db.exec(`CREATE TABLE IF NOT EXISTS vc_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  const row = db.prepare(`SELECT value FROM vc_meta WHERE key='schema_version'`).get();
  const currentVer = Number(row?.value || 0);
  if (currentVer >= SCHEMA_VERSION) { console.log(`DB schema v${currentVer} is current.`); return; }

  console.log(`Migrating DB from v${currentVer} to v${SCHEMA_VERSION}...`);
  const now = new Date().toISOString();

  if (currentVer < 1) {
    // Fresh install
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
        actual_price REAL NOT NULL DEFAULT 0,
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
        payment_method TEXT NOT NULL DEFAULT '',
        payment_ref TEXT NOT NULL DEFAULT '',
        is_penalty INTEGER NOT NULL DEFAULT 0,
        penalty_parent_id INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_message_templates (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'both',
        subject TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
        template_type TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_billing_schedules (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL DEFAULT 0,
        tenant_id INTEGER NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0,
        due_day INTEGER NOT NULL DEFAULT 1, reminder_days_before INTEGER NOT NULL DEFAULT 3,
        generate_day INTEGER NOT NULL DEFAULT 0, reminder_day INTEGER NOT NULL DEFAULT 0,
        template_id INTEGER NOT NULL DEFAULT 0, reminder_template_id INTEGER NOT NULL DEFAULT 0,
        channel TEXT NOT NULL DEFAULT 'both',
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
      `CREATE TABLE IF NOT EXISTS vc_loan_payments (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL, amount REAL NOT NULL DEFAULT 0,
        payment_date TEXT NOT NULL DEFAULT '', reference_no TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '', balance_after REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL
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
        completed_at TEXT NOT NULL DEFAULT '',
        tenant_phone TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
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
        tenant_email TEXT NOT NULL DEFAULT '',
        tenant_pin TEXT NOT NULL DEFAULT '1234',
        tenant_must_change_pin INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS vc_renovation_expenses (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL,
        description TEXT NOT NULL DEFAULT '', amount REAL NOT NULL DEFAULT 0,
        expense_date TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
        contractor TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
        floor_label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS vc_purchase_costs (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL,
        category TEXT NOT NULL DEFAULT 'other', description TEXT NOT NULL DEFAULT '',
        amount REAL NOT NULL DEFAULT 0, paid_date TEXT NOT NULL DEFAULT '',
        paid_to TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS vc_recurring_charges (
        id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL,
        charge_name TEXT NOT NULL DEFAULT '', amount REAL NOT NULL DEFAULT 0,
        frequency TEXT NOT NULL DEFAULT 'monthly', floor_label TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
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
        vacate_date TEXT NOT NULL DEFAULT '', vacate_reason TEXT NOT NULL DEFAULT 'vacated',
        vacate_notes TEXT NOT NULL DEFAULT '', arrears_amount REAL NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS vc_arrears_payments (
        id INTEGER PRIMARY KEY, history_id INTEGER NOT NULL,
        amount REAL NOT NULL DEFAULT 0, payment_date TEXT NOT NULL DEFAULT '',
        payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
        notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT ''
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
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '',
        last_login TEXT NOT NULL DEFAULT '', last_active TEXT NOT NULL DEFAULT '',
        session_revoked_at TEXT NOT NULL DEFAULT ''
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
    for (const ddl of tables) { db.exec(ddl); }
    // Seed default admin
    try {
      db.exec(`INSERT INTO vc_users (id, username, pin, role, name, email, notes, active, must_change_pin, created_at, updated_at) VALUES (1, 'admin', '1234', 'super_admin', '管理员', '', '', 1, 0, '${now}', '${now}')`);
    } catch(e) {}
    // Seed default templates
    try {
      db.exec(`
        INSERT INTO vc_message_templates (id, name, channel, subject, content, template_type, created_at, updated_at) VALUES
        (1, '租金提醒', 'both', '租金到期提醒 - {property_name}', '尊敬的 {tenant_name},\n\n提醒您，物业 {property_name} 的租金 RM{amount} 将于 {due_date} 到期。\n\n请及时缴纳租金，谢谢！\n\nVencos Property Management', 'reminder', '${now}', '${now}'),
        (2, '账单通知', 'both', '月度账单 - {property_name}', '尊敬的 {tenant_name},\n\n以下是您本月的租金账单：\n物业：{property_name}\n金额：RM{amount}\n到期日：{due_date}\n\n请在到期日前完成付款，谢谢！\n\nVencos Property Management', 'billing', '${now}', '${now}'),
        (3, '逾期提醒', 'both', '租金逾期通知 - {property_name}', '尊敬的 {tenant_name},\n\n您物业 {property_name} 的租金 RM{amount}（到期日：{due_date}）已逾期未付。\n\n请尽快处理，如有疑问请联系我们。\n\nVencos Property Management', 'reminder', '${now}', '${now}'),
        (4, '收款确认', 'both', '付款确认 - {property_name}', '尊敬的 {tenant_name},\n\n已确认收到您物业 {property_name} 的租金 RM{amount}。\n\n感谢您的及时付款！\n\nVencos Property Management', 'confirmation', '${now}', '${now}')
      `);
    } catch(e) {}
    db.exec(`INSERT OR REPLACE INTO vc_meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}')`);
    console.log('Fresh DB install complete (v' + SCHEMA_VERSION + ')');
    return;
  }

  // Migrations for existing databases
  const safeExec = (sql) => { try { db.exec(sql); } catch(e) {} };

  if (currentVer < 9) {
    safeExec(`CREATE TABLE IF NOT EXISTS vc_users (id INTEGER PRIMARY KEY, username TEXT NOT NULL DEFAULT '', pin TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'admin', phone TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT '')`);
    safeExec(`INSERT INTO vc_users (id, username, pin, role, name, created_at) VALUES (1, 'admin', '1234', 'admin', '管理员', '${now}')`);
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
    for (const sql of oldAlters) { safeExec(sql); }
  }
  if (currentVer < 10) {
    safeExec(`CREATE TABLE IF NOT EXISTS vc_whatsapp_config (id INTEGER PRIMARY KEY, phone_number_id TEXT NOT NULL DEFAULT '', access_token TEXT NOT NULL DEFAULT '', business_id TEXT NOT NULL DEFAULT '', webhook_verify_token TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT '')`);
    safeExec(`CREATE TABLE IF NOT EXISTS vc_message_log (id INTEGER PRIMARY KEY, recipient_phone TEXT NOT NULL DEFAULT '', recipient_name TEXT NOT NULL DEFAULT '', message_type TEXT NOT NULL DEFAULT 'invoice', template_name TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'queued', whatsapp_message_id TEXT NOT NULL DEFAULT '', error_message TEXT NOT NULL DEFAULT '', property_id INTEGER NOT NULL DEFAULT 0, invoice_id INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT '')`);
  }
  if (currentVer < 11) { safeExec(`ALTER TABLE vc_renovation_expenses ADD COLUMN floor_label TEXT NOT NULL DEFAULT ''`); }
  if (currentVer < 12) {
    safeExec(`ALTER TABLE vc_meters ADD COLUMN account_holder TEXT NOT NULL DEFAULT ''`);
    safeExec(`ALTER TABLE vc_properties ADD COLUMN hakmilik_no TEXT NOT NULL DEFAULT ''`);
  }
  if (currentVer < 13) { safeExec(`ALTER TABLE vc_recurring_charges ADD COLUMN floor_label TEXT NOT NULL DEFAULT ''`); }
  if (currentVer < 14) { safeExec(`ALTER TABLE vc_invoices ADD COLUMN adjustments TEXT NOT NULL DEFAULT '[]'`); }
  if (currentVer < 15) { safeExec(`ALTER TABLE vc_invoices ADD COLUMN charges_detail TEXT NOT NULL DEFAULT '[]'`); }
  if (currentVer < 16) {
    safeExec(`ALTER TABLE vc_owners ADD COLUMN payment_bank_name TEXT NOT NULL DEFAULT ''`);
    safeExec(`ALTER TABLE vc_owners ADD COLUMN payment_bank_account TEXT NOT NULL DEFAULT ''`);
    safeExec(`ALTER TABLE vc_owners ADD COLUMN payment_account_name TEXT NOT NULL DEFAULT ''`);
  }
  if (currentVer < 17) {
    safeExec(`ALTER TABLE vc_users ADD COLUMN email TEXT NOT NULL DEFAULT ''`);
    safeExec(`ALTER TABLE vc_users ADD COLUMN notes TEXT NOT NULL DEFAULT ''`);
    safeExec(`ALTER TABLE vc_users ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0`);
    safeExec(`ALTER TABLE vc_users ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
    safeExec(`CREATE TABLE IF NOT EXISTS vc_user_access (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, property_id INTEGER NOT NULL, access_level TEXT NOT NULL DEFAULT 'readonly', UNIQUE(user_id, property_id))`);
    safeExec(`UPDATE vc_users SET role='super_admin' WHERE id=1 AND role='admin'`);
  }
  if (currentVer < 18) {
    safeExec(`ALTER TABLE vc_maintenance_tickets ADD COLUMN tenant_phone TEXT NOT NULL DEFAULT ''`);
    safeExec(`UPDATE vc_maintenance_tickets SET tenant_phone = COALESCE((SELECT phone FROM vc_clients WHERE id = vc_maintenance_tickets.tenant_id), '') WHERE tenant_phone = ''`);
  }
  if (currentVer < 19) {
    safeExec(`ALTER TABLE vc_users ADD COLUMN last_login TEXT NOT NULL DEFAULT ''`);
    safeExec(`ALTER TABLE vc_users ADD COLUMN session_revoked_at TEXT NOT NULL DEFAULT ''`);
  }
  if (currentVer < 20) {
    safeExec(`ALTER TABLE vc_floor_units ADD COLUMN linked_lease_ref TEXT NOT NULL DEFAULT ''`);
    safeExec(`CREATE TABLE IF NOT EXISTS vc_agents (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
      whatsapp TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '', areas TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active', notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
    )`);
  }
  // V21: Add merged_data column to invoices for merged billing
  if (currentVer < 21) {
    safeExec(`ALTER TABLE vc_invoices ADD COLUMN merged_data TEXT NOT NULL DEFAULT ''`);
  }

  // V22: Company-based user access
  if (currentVer < 22) {
    safeExec(`CREATE TABLE IF NOT EXISTS vc_user_owner_access (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, owner_id INTEGER NOT NULL,
      access_level TEXT NOT NULL DEFAULT 'readonly', UNIQUE(user_id, owner_id)
    )`);
  }

  // V23: SPA vs actual price + late penalty config + invoice attachments
  if (currentVer < 23) {
    safeExec(`ALTER TABLE vc_properties ADD COLUMN actual_price REAL NOT NULL DEFAULT 0`);
    safeExec(`ALTER TABLE vc_documents ADD COLUMN linked_invoice_id INTEGER NOT NULL DEFAULT 0`);
    safeExec(`CREATE TABLE IF NOT EXISTS vc_penalty_config (
      id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL DEFAULT 0,
      rate_pct REAL NOT NULL DEFAULT 0, grace_days INTEGER NOT NULL DEFAULT 7,
      calc_method TEXT NOT NULL DEFAULT 'monthly_pct', min_amount REAL NOT NULL DEFAULT 0,
      max_amount REAL NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
    )`);
  }

  // V24: Payment receipt fields + penalty invoice fields on vc_invoices
  if (currentVer < 24) {
    safeExec(`ALTER TABLE vc_invoices ADD COLUMN payment_method TEXT NOT NULL DEFAULT ''`);
    safeExec(`ALTER TABLE vc_invoices ADD COLUMN payment_ref TEXT NOT NULL DEFAULT ''`);
    safeExec(`ALTER TABLE vc_invoices ADD COLUMN is_penalty INTEGER NOT NULL DEFAULT 0`);
    safeExec(`ALTER TABLE vc_invoices ADD COLUMN penalty_parent_id INTEGER NOT NULL DEFAULT 0`);
  }

  // V25: Activity tracking - last_active column
  if (currentVer < 25) {
    safeExec(`ALTER TABLE vc_users ADD COLUMN last_active TEXT NOT NULL DEFAULT ''`);
  }

  if (currentVer < 26) {
    safeExec(`ALTER TABLE vc_loan_payments ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'normal'`);
    db.exec(`CREATE TABLE IF NOT EXISTS vc_valuations (
      id INTEGER PRIMARY KEY,
      property_id INTEGER NOT NULL DEFAULT 0,
      valuation_date TEXT NOT NULL DEFAULT '',
      market_value REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS vc_tenancy_charges (
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
    db.exec(`CREATE TABLE IF NOT EXISTS vc_valuations (
      id INTEGER PRIMARY KEY,
      property_id INTEGER NOT NULL DEFAULT 0,
      valuation_date TEXT NOT NULL DEFAULT '',
      market_value REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    )`);
    // loan_balance can legitimately exceed loan_amount (e.g. business loans) — no auto-reset
  }

  // V28: vc_loans table + loan_id on payments
  if (currentVer < 28) {
    db.exec(`CREATE TABLE IF NOT EXISTS vc_loans (
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
      created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
    )`);
    try { db.exec(`ALTER TABLE vc_loan_payments ADD COLUMN loan_id INTEGER NOT NULL DEFAULT 0`); } catch (e) {}

    // Migrate property-level loan data to vc_loans
    const mNow = new Date().toISOString();
    const propsWithLoans = db.prepare(
      `SELECT id, bank_code, bank_name, loan_amount, loan_balance, monthly_repayment,
       loan_start, loan_tenure_months, loan_interest_rate, loan_repayment_day,
       loan_account_no, loan_si_account FROM vc_properties
       WHERE loan_amount > 0 OR COALESCE(bank_name, '') != '' OR monthly_repayment > 0`
    ).all();
    console.log(`Migrating ${propsWithLoans.length} properties with loan data to vc_loans...`);
    for (const p of propsWithLoans) {
      const existing = db.prepare(`SELECT id FROM vc_loans WHERE property_id=? LIMIT 1`).get(p.id);
      if (!existing) {
        const loanId = Date.now() + Math.floor(Math.random() * 10000) + p.id;
        db.prepare(`INSERT INTO vc_loans (id, property_id, loan_label, bank_code, bank_name, loan_amount, loan_balance, monthly_repayment, rate_type, base_rate, spread, effective_rate, loan_start, loan_tenure_months, loan_repayment_day, loan_account_no, loan_si_account, notes, created_at, updated_at)
          VALUES (?, ?, '房屋贷款', ?, ?, ?, ?, ?, 'SBR', ?, 0, ?, ?, ?, ?, ?, ?, '', ?, ?)`).run(
          loanId, p.id, p.bank_code || '', p.bank_name || '',
          p.loan_amount || 0, p.loan_balance || 0, p.monthly_repayment || 0,
          p.loan_interest_rate || 0, p.loan_interest_rate || 0,
          p.loan_start || '', p.loan_tenure_months || 0, p.loan_repayment_day || 0,
          p.loan_account_no || '', p.loan_si_account || '', mNow, mNow
        );
        // Link existing payments
        db.prepare(`UPDATE vc_loan_payments SET loan_id=? WHERE property_id=? AND loan_id=0`).run(loanId, p.id);
        console.log(`  Migrated loan for property ${p.id} (${p.bank_name || 'unknown bank'}) -> loan ${loanId}`);
      }
    }
    console.log(`Loan migration complete.`);
  }

  // V29: spa_date
  if (currentVer < 29) {
    try { db.exec(`ALTER TABLE vc_properties ADD COLUMN spa_date TEXT NOT NULL DEFAULT ''`); } catch (e) {}
  }

  // V30: billing schedule generate_days_before + grace_days + tenant_email
  if (currentVer < 30) {
    try { db.exec(`ALTER TABLE vc_billing_schedules ADD COLUMN generate_days_before INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
    try { db.exec(`ALTER TABLE vc_billing_schedules ADD COLUMN grace_days INTEGER NOT NULL DEFAULT 7`); } catch (e) {}
    try { db.exec(`ALTER TABLE vc_floor_units ADD COLUMN tenant_email TEXT NOT NULL DEFAULT ''`); } catch (e) {}
  }

  // V31: replace days-before with day-of-month columns for generate & reminder
  if (currentVer < 31) {
    try { db.exec(`ALTER TABLE vc_billing_schedules ADD COLUMN generate_day INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
    try { db.exec(`ALTER TABLE vc_billing_schedules ADD COLUMN reminder_day INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
  }

  // V32: Tenant PIN login (phone + PIN from floor_units, not vc_users)
  if (currentVer < 32) {
    try { db.exec(`ALTER TABLE vc_floor_units ADD COLUMN tenant_pin TEXT NOT NULL DEFAULT '1234'`); } catch (e) {}
    try { db.exec(`ALTER TABLE vc_floor_units ADD COLUMN tenant_must_change_pin INTEGER NOT NULL DEFAULT 1`); } catch (e) {}
  }

  // V33: Add tenant_email to floor_units (was missing from V31 migration)
  if (currentVer < 33) {
    try { db.exec(`ALTER TABLE vc_floor_units ADD COLUMN tenant_email TEXT NOT NULL DEFAULT ''`); } catch (e) {}
  }

  // V34: Payment notifications + bank accounts
  if (currentVer < 34) {
    db.exec(`CREATE TABLE IF NOT EXISTS vc_payment_notifications (
      id INTEGER PRIMARY KEY, invoice_id INTEGER NOT NULL DEFAULT 0,
      tenant_phone TEXT NOT NULL DEFAULT '', tenant_name TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT '', payment_ref TEXT NOT NULL DEFAULT '',
      receipt_path TEXT NOT NULL DEFAULT '', receipt_filename TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
      admin_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '', confirmed_at TEXT NOT NULL DEFAULT '', rejected_at TEXT NOT NULL DEFAULT ''
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS vc_bank_accounts (
      id INTEGER PRIMARY KEY, bank_name TEXT NOT NULL DEFAULT '',
      account_no TEXT NOT NULL DEFAULT '', account_name TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
    )`);
  }

  // V35: Template types + reminder_template_id on schedules
  if (currentVer < 35) {
    try { db.exec(`ALTER TABLE vc_message_templates ADD COLUMN template_type TEXT NOT NULL DEFAULT ''`); } catch (e) {}
    try { db.exec(`ALTER TABLE vc_billing_schedules ADD COLUMN reminder_template_id INTEGER NOT NULL DEFAULT 0`); } catch (e) {}
    try { db.exec(`UPDATE vc_message_templates SET template_type='billing' WHERE name='账单通知' AND template_type=''`); } catch (e) {}
    try { db.exec(`UPDATE vc_message_templates SET template_type='reminder' WHERE name IN ('租金提醒','逾期提醒') AND template_type=''`); } catch (e) {}
    try { db.exec(`UPDATE vc_message_templates SET template_type='confirmation' WHERE name='收款确认' AND template_type=''`); } catch (e) {}
  }

  // V36: Billing log table + auto-overdue
  if (currentVer < 36) {
    db.exec(`CREATE TABLE IF NOT EXISTS vc_billing_log (
      id INTEGER PRIMARY KEY, log_type TEXT NOT NULL DEFAULT 'generate',
      schedule_id INTEGER NOT NULL DEFAULT 0, invoice_id INTEGER NOT NULL DEFAULT 0,
      property_name TEXT NOT NULL DEFAULT '', tenant_name TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'success',
      details TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT ''
    )`);
  }

  db.exec(`INSERT OR REPLACE INTO vc_meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}')`);
  console.log(`DB migration to v${SCHEMA_VERSION} complete.`);
}

// Run DB init on startup
initDatabase();

// ========== Middleware ==========
app.use(express.json({ limit: '100mb' }));

// Activity tracking — debounce per user (update at most once per 60 seconds)
const _lastActivityUpdate = {};
function trackActivity(userId) {
  const now = Date.now();
  if (_lastActivityUpdate[userId] && now - _lastActivityUpdate[userId] < 60000) return;
  _lastActivityUpdate[userId] = now;
  try { db.prepare('UPDATE vc_users SET last_active=? WHERE id=?').run(new Date().toISOString(), userId); } catch(e) {}
}

// Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    // Check if session has been force-revoked
    try {
      const user = db.prepare('SELECT session_revoked_at FROM vc_users WHERE id=?').get(decoded.id);
      if (user && user.session_revoked_at) {
        const revokedAt = Math.floor(new Date(user.session_revoked_at).getTime() / 1000);
        if (decoded.iat && decoded.iat < revokedAt) {
          return res.status(401).json({ error: 'Session revoked' });
        }
      }
    } catch (e) { /* column may not exist yet, skip check */ }
    req.user = decoded;
    trackActivity(decoded.id);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ========== Auth Routes ==========
app.post('/api/auth/login', (req, res) => {
  const { username, pin } = req.body;
  if (!username || !pin) return res.status(400).json({ error: 'Missing credentials' });

  const user = db.prepare(
    `SELECT id, name, role, phone, must_change_pin FROM vc_users WHERE (LOWER(username)=LOWER(?) OR phone=? OR LOWER(name)=LOWER(?)) AND pin=? AND active=1`
  ).get(username, username, username, pin);

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  // Record last login + last active time
  const loginNow = new Date().toISOString();
  try { db.prepare('UPDATE vc_users SET last_login=?, last_active=? WHERE id=?').run(loginNow, loginNow, user.id); } catch(e) {}

  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role, phone: user.phone || '' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      phone: user.phone || '',
      must_change_pin: user.must_change_pin || 0,
    }
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// Force logout a user (admin/super_admin only)
app.post('/api/auth/force-logout', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  try {
    const now = new Date().toISOString();
    db.prepare('UPDATE vc_users SET session_revoked_at=? WHERE id=?').run(now, userId);
    res.json({ ok: true, message: 'User session revoked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// ========== Tenant Login (phone + PIN from vc_floor_units) ==========
app.post('/api/tenant/login', (req, res) => {
  const { phone, pin } = req.body;
  if (!phone || !pin) return res.status(400).json({ error: 'Missing credentials' });

  const unit = db.prepare(
    `SELECT f.tenant_name, f.tenant_phone, f.tenant_pin, f.tenant_must_change_pin
     FROM vc_floor_units f
     WHERE f.tenant_phone=? AND f.tenant_pin=? AND f.tenant_name != ''
     LIMIT 1`
  ).get(phone, pin);

  if (!unit) return res.status(401).json({ error: '电话号码或PIN错误' });

  const token = jwt.sign(
    { id: 0, name: unit.tenant_name, role: 'tenant', phone: unit.tenant_phone },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    token,
    user: {
      id: 0,
      name: unit.tenant_name,
      role: 'tenant',
      phone: unit.tenant_phone,
      must_change_pin: unit.tenant_must_change_pin || 0,
    }
  });
});

app.post('/api/tenant/change-pin', (req, res) => {
  const { phone, old_pin, new_pin } = req.body;
  if (!phone || !old_pin || !new_pin) return res.status(400).json({ error: 'Missing fields' });
  if (new_pin.length < 4) return res.status(400).json({ error: 'PIN至少4位' });

  const unit = db.prepare(
    `SELECT id FROM vc_floor_units WHERE tenant_phone=? AND tenant_pin=? AND tenant_name != '' LIMIT 1`
  ).get(phone, old_pin);
  if (!unit) return res.status(401).json({ error: '当前PIN错误' });

  db.prepare(`UPDATE vc_floor_units SET tenant_pin=?, tenant_must_change_pin=0 WHERE tenant_phone=?`).run(new_pin, phone);
  res.json({ ok: true });
});

app.post('/api/tenant/reset-pin', authMiddleware, (req, res) => {
  if (!['admin', 'super_admin', 'stakeholder'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Missing phone' });

  const result = db.prepare(`UPDATE vc_floor_units SET tenant_pin='1234', tenant_must_change_pin=1 WHERE tenant_phone=?`).run(phone);
  res.json({ ok: true, updated: result.changes });
});

// ========== SQL Proxy Routes ==========
// ========== Payment Notification ==========
app.post('/api/tenant/payment-notify', authMiddleware, (req, res) => {
  const { invoice_id, tenant_phone, tenant_name, payment_method, payment_ref, receipt_data, receipt_filename, notes } = req.body;
  if (!invoice_id) return res.status(400).json({ error: 'Missing invoice_id' });

  // Verify invoice exists
  const inv = db.prepare('SELECT * FROM vc_invoices WHERE id=?').get(invoice_id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.status !== 'pending' && inv.status !== 'overdue') return res.status(400).json({ error: 'Invoice is not payable' });

  // Check no pending notification already exists
  const existing = db.prepare('SELECT id FROM vc_payment_notifications WHERE invoice_id=? AND status=?').get(invoice_id, 'pending');
  if (existing) return res.status(400).json({ error: '已有待确认的付款通知' });

  const now = new Date().toISOString();
  const id = Date.now();

  // Save receipt to disk if provided
  let receiptPath = '';
  if (receipt_data && receipt_data.length > 50) {
    try {
      const ext = (receipt_filename || 'receipt.jpg').split('.').pop() || 'jpg';
      const fname = `pay_${id}.${ext}`;
      const fpath = path.join(DATA_DIR, 'receipts', fname);
      fs.mkdirSync(path.dirname(fpath), { recursive: true });
      // Strip data URL prefix if present
      const raw = receipt_data.replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(fpath, raw, 'base64');
      receiptPath = `/receipts/${fname}`;
    } catch (e) { console.error('Receipt save error:', e); }
  }

  db.prepare(`INSERT INTO vc_payment_notifications (id, invoice_id, tenant_phone, tenant_name, payment_method, payment_ref, receipt_path, receipt_filename, notes, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`).run(
    id, invoice_id, tenant_phone || '', tenant_name || '', payment_method || '', payment_ref || '', receiptPath, receipt_filename || '', notes || '', now
  );

  // Update invoice status to confirming
  db.prepare("UPDATE vc_invoices SET status='confirming', updated_at=? WHERE id=?").run(now, invoice_id);

  res.json({ ok: true, id });
});

// ========== Bank Accounts ==========
app.get('/api/bank-accounts', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM vc_bank_accounts ORDER BY is_default DESC, id').all();
  res.json(rows);
});

app.post('/api/bank-accounts', authMiddleware, (req, res) => {
  const { bank_name, account_no, account_name, is_default, notes } = req.body;
  const now = new Date().toISOString();
  const id = Date.now();
  db.prepare(`INSERT INTO vc_bank_accounts (id, bank_name, account_no, account_name, is_default, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, bank_name || '', account_no || '', account_name || '', is_default ? 1 : 0, notes || '', now, now);
  res.json({ ok: true, id });
});

app.put('/api/bank-accounts/:id', authMiddleware, (req, res) => {
  const { bank_name, account_no, account_name, is_default, notes } = req.body;
  const now = new Date().toISOString();
  db.prepare(`UPDATE vc_bank_accounts SET bank_name=?, account_no=?, account_name=?, is_default=?, notes=?, updated_at=? WHERE id=?`).run(
    bank_name || '', account_no || '', account_name || '', is_default ? 1 : 0, notes || '', now, req.params.id
  );
  res.json({ ok: true });
});

app.delete('/api/bank-accounts/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM vc_bank_accounts WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ========== Payment Notification Management ==========
app.get('/api/payment-notifications', authMiddleware, (req, res) => {
  const rows = db.prepare(`SELECT pn.*, i.invoice_no, i.amount as invoice_amount, i.billing_month, p.name as property_name
    FROM vc_payment_notifications pn
    LEFT JOIN vc_invoices i ON pn.invoice_id = i.id
    LEFT JOIN vc_properties p ON i.property_id = p.id
    ORDER BY pn.created_at DESC`).all();
  res.json(rows);
});

app.get('/api/payment-notifications/invoice/:invoiceId', authMiddleware, (req, res) => {
  const rows = db.prepare(`SELECT * FROM vc_payment_notifications WHERE invoice_id=? ORDER BY created_at DESC`).all(req.params.invoiceId);
  res.json(rows);
});

app.post('/api/payment-notifications/:id/confirm', authMiddleware, (req, res) => {
  const now = new Date().toISOString();
  const notif = db.prepare('SELECT * FROM vc_payment_notifications WHERE id=?').get(req.params.id);
  if (!notif) return res.status(404).json({ error: 'Not found' });

  // Update notification
  db.prepare("UPDATE vc_payment_notifications SET status='confirmed', confirmed_at=?, admin_notes=? WHERE id=?").run(now, req.body.admin_notes || '', req.params.id);

  // Mark invoice as paid
  db.prepare("UPDATE vc_invoices SET status='paid', paid_date=?, payment_method=?, payment_ref=?, updated_at=? WHERE id=?").run(
    now.slice(0, 10), notif.payment_method || '', notif.payment_ref || '', now, notif.invoice_id
  );

  res.json({ ok: true });
});

app.get('/api/payment-notifications/:id/receipt', authMiddleware, (req, res) => {
  const notif = db.prepare('SELECT * FROM vc_payment_notifications WHERE id=?').get(req.params.id);
  if (!notif) return res.status(404).json({ error: 'Not found' });
  if (!notif.receipt_path) return res.status(404).json({ error: 'No receipt' });
  const fpath = path.join(DATA_DIR, notif.receipt_path);
  if (!fs.existsSync(fpath)) return res.status(404).json({ error: 'File not found on disk' });
  try {
    const raw = fs.readFileSync(fpath);
    const ext = (notif.receipt_filename || 'file.jpg').split('.').pop().toLowerCase();
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf', gif: 'image/gif', webp: 'image/webp' };
    const mime = mimeMap[ext] || 'application/octet-stream';
    const base64 = raw.toString('base64');
    res.json({ data: `data:${mime};base64,${base64}`, filename: notif.receipt_filename, mime });
  } catch (e) { res.status(500).json({ error: 'Failed to read file' }); }
});

app.post('/api/payment-notifications/:id/reject', authMiddleware, (req, res) => {
  const now = new Date().toISOString();
  const notif = db.prepare('SELECT * FROM vc_payment_notifications WHERE id=?').get(req.params.id);
  if (!notif) return res.status(404).json({ error: 'Not found' });

  // Update notification
  db.prepare("UPDATE vc_payment_notifications SET status='rejected', rejected_at=?, admin_notes=? WHERE id=?").run(now, req.body.reason || '', req.params.id);

  // Restore invoice status — check if overdue
  const inv = db.prepare('SELECT due_date FROM vc_invoices WHERE id=?').get(notif.invoice_id);
  const newStatus = (inv && inv.due_date && inv.due_date < now.slice(0, 10)) ? 'overdue' : 'pending';
  db.prepare("UPDATE vc_invoices SET status=?, updated_at=? WHERE id=?").run(newStatus, now, notif.invoice_id);

  res.json({ ok: true });
});

app.post('/api/sql/query', authMiddleware, (req, res) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'Missing SQL' });
  try {
    const rows = db.prepare(sql).all();
    res.json(rows);
  } catch (err) {
    console.error('SQL Query Error:', err.message, '\nSQL:', sql.substring(0, 200));
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sql/exec', authMiddleware, (req, res) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'Missing SQL' });
  try {
    db.exec(sql);
    res.json({ ok: true });
  } catch (err) {
    console.error('SQL Exec Error:', err.message, '\nSQL:', sql.substring(0, 200));
    res.status(400).json({ error: err.message });
  }
});

// ========== File Routes ==========
app.post('/api/files/write', authMiddleware, (req, res) => {
  const { path: filePath, data } = req.body;
  if (!filePath || data === undefined) return res.status(400).json({ error: 'Missing path or data' });

  // /tmp/ paths go to real /tmp/; /agent/home/ paths go to DATA_DIR
  const safePath = filePath.startsWith('/tmp/')
    ? filePath
    : path.join(DATA_DIR, filePath.replace(/^\/agent\/home\//, ''));
  const dir = path.dirname(safePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(safePath, data, 'utf-8');
  res.json({ ok: true });
});

app.post('/api/files/read', authMiddleware, (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'Missing path' });

  const safePath = filePath.startsWith('/tmp/')
    ? filePath
    : path.join(DATA_DIR, filePath.replace(/^\/agent\/home\//, ''));
  if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'File not found' });
  const data = fs.readFileSync(safePath, 'utf-8');
  res.json({ data });
});

app.post('/api/command', authMiddleware, (req, res) => {
  const { cmd } = req.body;
  if (!cmd) return res.status(400).json({ error: 'Missing command' });

  // Rewrite /agent/home/ paths to DATA_DIR
  const rewrittenCmd = cmd.replace(/\/agent\/home\//g, DATA_DIR + '/');

  const { execSync } = require('child_process');
  try {
    const output = execSync(rewrittenCmd, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 50 * 1024 * 1024,
    });
    res.json({ log: output, exitCode: 0 });
  } catch (err) {
    res.json({ log: err.stdout || err.message, exitCode: err.status || 1 });
  }
});

// ========== AI Valuation ==========
app.post('/api/ai-valuation', authMiddleware, async (req, res) => {
  try {
    const { address, propertyType, areaSqft } = req.body;
    if (!address) return res.status(400).json({ error: 'Address required' });

    // Extract area keywords from address (take last 2-3 words that are likely area names)
    const addrParts = address.replace(/[,.\-\/]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    // Try to find meaningful area name (skip numbers, unit, lot, etc.)
    const skipWords = new Set(['no', 'lot', 'jalan', 'lorong', 'blok', 'block', 'unit', 'tingkat', 'floor', 'level', 'taman', 'persiaran', 'lebuh']);
    const areaWords = addrParts.filter(w => !skipWords.has(w.toLowerCase()) && !/^\d+/.test(w));
    // Use last 2-3 meaningful words as area search
    const areaSearch = areaWords.slice(-3).join(' ') || addrParts.slice(-2).join(' ');

    const typeMap = { residential: 'residential', commercial: 'commercial', industrial: 'industrial', land: 'land' };
    const searchType = typeMap[propertyType] || 'residential';

    // Search queries
    const queries = [
      `${areaSearch} property price per sqft ${searchType} 2024 2025`,
      `${areaSearch} ${searchType} transaction price brickz edgeprop`,
    ];

    const allResults = [];

    for (const query of queries) {
      try {
        const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) continue;
        const html = await resp.text();

        // Extract result titles and links
        const titleMatches = [...html.matchAll(/<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gs)];
        
        // Extract RM values with context from the whole page
        const rmContexts = [...html.matchAll(/.{0,100}RM\s*[\d,]+(?:\.\d+)?.{0,100}/g)];
        for (const m of rmContexts) {
          const text = m[0].replace(/<[^>]*>/g, '').trim();
          if (text.length > 10) allResults.push(text);
        }

        // Extract title info
        for (const tm of titleMatches) {
          const title = tm[2].replace(/<[^>]*>/g, '').trim();
          const href = tm[1];
          if (title.length > 5) {
            allResults.push(`[SOURCE] ${title} | ${href}`);
          }
        }
      } catch (e) {
        // continue to next query
      }
    }

    // Parse extracted data for prices
    const prices = [];
    const psfValues = [];
    const sources = [];

    for (const text of allResults) {
      if (text.startsWith('[SOURCE]')) {
        const parts = text.replace('[SOURCE] ', '').split(' | ');
        sources.push({ title: parts[0], url: parts[1] || '' });
        continue;
      }

      // Extract median/average price per sqft
      const psfMatch = text.match(/(?:median|average|mean)?\s*(?:price\s*)?(?:per\s*sq(?:uare)?\s*f(?:oo|ee)?t|psf|per\s*sqft)\s*(?:is|of|at|:)?\s*RM\s*([\d,]+(?:\.\d+)?)/i)
        || text.match(/RM\s*([\d,]+(?:\.\d+)?)\s*(?:per\s*sq(?:uare)?\s*f(?:oo|ee)?t|psf|\/\s*sqft)/i);
      if (psfMatch) {
        const val = parseFloat(psfMatch[1].replace(/,/g, ''));
        if (val > 50 && val < 5000) psfValues.push(val);
      }

      // Extract property prices (full values RM xxx,xxx)
      const priceMatches = text.matchAll(/RM\s*([\d,]+(?:\.\d+)?)/g);
      for (const pm of priceMatches) {
        const val = parseFloat(pm[1].replace(/,/g, ''));
        if (val >= 50000 && val <= 50000000) prices.push(val);
      }
    }

    // Calculate estimates
    const uniquePsf = [...new Set(psfValues)];
    const uniquePrices = [...new Set(prices)].sort((a, b) => a - b);
    
    let estimatedValue = null;
    let medianPsf = null;
    let method = '';

    if (uniquePsf.length > 0) {
      // Use PSF * area method (most accurate)
      medianPsf = uniquePsf.reduce((a, b) => a + b, 0) / uniquePsf.length;
      const sqft = areaSqft || 1000;
      estimatedValue = Math.round(medianPsf * sqft / 1000) * 1000;
      method = 'psf';
    } else if (uniquePrices.length >= 2) {
      // Use median of found prices
      const mid = Math.floor(uniquePrices.length / 2);
      estimatedValue = uniquePrices.length % 2 === 0
        ? Math.round((uniquePrices[mid - 1] + uniquePrices[mid]) / 2 / 1000) * 1000
        : uniquePrices[mid];
      method = 'median';
    }

    // Deduplicate sources
    const seenUrls = new Set();
    const uniqueSources = sources.filter(s => {
      if (seenUrls.has(s.url)) return false;
      seenUrls.add(s.url);
      return true;
    }).slice(0, 8);

    res.json({
      area: areaSearch,
      estimatedValue,
      medianPsf: medianPsf ? Math.round(medianPsf * 100) / 100 : null,
      method,
      priceRange: uniquePrices.length >= 2 ? { min: uniquePrices[0], max: uniquePrices[uniquePrices.length - 1] } : null,
      psfValues: uniquePsf.slice(0, 5),
      samplePrices: uniquePrices.slice(0, 10),
      sources: uniqueSources,
      dataPoints: uniquePsf.length + uniquePrices.length,
      searchArea: areaSearch,
    });
  } catch (err) {
    console.error('AI valuation error:', err);
    res.status(500).json({ error: 'Valuation search failed' });
  }
});

// ========== Diagnostic (temporary) ==========
app.get('/api/diag', (req, res) => {
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(t => t.name);
    let meta = [], loanCount = null, loans = [], propsWithLoan = [], propCount = null, loanCols = [], propCols = [];
    try { meta = db.prepare('SELECT * FROM vc_meta').all(); } catch {}
    try { loanCount = db.prepare('SELECT COUNT(*) as cnt FROM vc_loans').get(); } catch {}
    try { loans = db.prepare('SELECT id, property_id, loan_label, bank_name, loan_amount, loan_balance FROM vc_loans LIMIT 30').all(); } catch {}
    try { propsWithLoan = db.prepare('SELECT id, name, bank_code, bank_name, loan_amount, loan_balance, monthly_repayment, loan_interest_rate, loan_start, loan_account_no FROM vc_properties LIMIT 40').all(); } catch {}
    try { propCount = db.prepare('SELECT COUNT(*) as cnt FROM vc_properties').get(); } catch {}
    try { loanCols = db.prepare("PRAGMA table_info(vc_loans)").all().map(c => c.name); } catch {}
    try { propCols = db.prepare("PRAGMA table_info(vc_properties)").all().map(c => c.name); } catch {}
    let floorUnitCols = [];
    try { floorUnitCols = db.prepare("PRAGMA table_info(vc_floor_units)").all().map(c => c.name); } catch {}
    let sampleUnit = null;
    try { sampleUnit = db.prepare("SELECT id, tenant_name, tenant_phone, tenant_pin, tenant_must_change_pin FROM vc_floor_units WHERE tenant_name != '' LIMIT 3").all(); } catch {}
    let users = [];
    try { users = db.prepare('SELECT id, username, name, role, phone, active, must_change_pin, last_login FROM vc_users ORDER BY id').all(); } catch {}
    res.json({ tables, meta, loanCount, loans, propsWithLoan, propCount, loanCols, propCols, floorUnitCols, sampleUnit, users });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ========== Serve Frontend ==========
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.use('/icons', express.static(path.join(distPath, 'icons')));

// ========== Billing Log API ==========
app.get('/api/billing-log', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM vc_billing_log ORDER BY created_at DESC LIMIT 200').all();
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  // Don't serve index.html for missing asset files (prevents cache MIME mismatch)
  if (req.path.startsWith('/assets/')) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// ========== Auto-Billing Cron (runs every hour) ==========
function runAutoBilling() {
  const now = new Date();
  const today = now.getDate();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dateStr = `${year}-${month}-${String(today).padStart(2, '0')}`;
  const nowISO = now.toISOString().slice(0, 19).replace('T', ' ');

  console.log(`[AutoBilling] Check at ${nowISO}, day=${today}`);

  try {
    // 1. Auto-overdue: mark pending invoices past due date as overdue
    const pendingInvoices = db.prepare(`SELECT id, due_date, amount, property_id FROM vc_invoices WHERE status='pending' AND due_date < '${dateStr}'`).all();
    for (const inv of pendingInvoices) {
      db.prepare(`UPDATE vc_invoices SET status='overdue', updated_at='${nowISO}' WHERE id=${inv.id}`).run();
      console.log(`[AutoBilling] Marked INV-${String(inv.id).slice(-8)} overdue (due: ${inv.due_date})`);
      try {
        db.prepare(`INSERT INTO vc_billing_log (id, log_type, invoice_id, amount, status, details, created_at) VALUES (${Date.now()}, 'auto_overdue', ${inv.id}, ${inv.amount}, 'success', 'Auto-marked overdue (due: ${inv.due_date})', '${nowISO}')`).run();
      } catch {}
    }

    // 2. Auto-generate invoices from active schedules
    const schedules = db.prepare(`
      SELECT s.*, p.name as property_name, f.tenant_name, f.tenant_phone, f.floor_label
      FROM vc_billing_schedules s
      LEFT JOIN vc_properties p ON s.property_id = p.id
      LEFT JOIN vc_floor_units f ON s.tenant_id = f.id
      WHERE s.active = 1 AND s.generate_day > 0
    `).all();

    for (const sch of schedules) {
      const genDay = sch.generate_day;
      if (genDay !== today) continue;

      // Determine billing month
      let billYear = year;
      let billMonth = now.getMonth() + 1;
      if (genDay > sch.due_day) {
        // Generate in advance: bill is for next month
        billMonth++;
        if (billMonth > 12) { billMonth = 1; billYear++; }
      }
      const billMonthStr = `${billYear}-${String(billMonth).padStart(2, '0')}`;
      const dueDate = `${billMonthStr}-${String(sch.due_day).padStart(2, '0')}`;

      // Check if invoice already exists for this schedule + month
      const existing = db.prepare(`SELECT id FROM vc_invoices WHERE tenant_id=${sch.tenant_id} AND property_id=${sch.property_id} AND strftime('%Y-%m', due_date) = '${billMonthStr}' AND amount = ${sch.amount}`).get();
      if (existing) continue;

      // Create invoice
      const invId = Date.now() + Math.floor(Math.random() * 1000);
      const propName = sch.property_name || '';
      const tenantName = sch.tenant_name || '';
      const floorLabel = sch.floor_label || '';
      db.prepare(`INSERT INTO vc_invoices (id, property_id, tenant_id, tenant_name, floor_label, amount, due_date, status, is_penalty, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`).run(
        invId, sch.property_id, sch.tenant_id, tenantName, floorLabel, sch.amount, dueDate,
        `自动生成 - 排程#${sch.id}`, nowISO, nowISO
      );

      console.log(`[AutoBilling] Generated invoice for ${propName} ${floorLabel} ${tenantName} RM${sch.amount} due ${dueDate}`);
      try {
        db.prepare(`INSERT INTO vc_billing_log (id, log_type, schedule_id, invoice_id, property_name, tenant_name, amount, status, details, created_at)
          VALUES (?, 'generate', ?, ?, ?, ?, ?, 'success', ?, ?)`).run(
          Date.now() + Math.floor(Math.random() * 100), sch.id, invId, propName, tenantName, sch.amount,
          `自动生成${billMonthStr}账单 到期${dueDate}`, nowISO
        );
      } catch {}
    }
  } catch (err) {
    console.error('[AutoBilling] Error:', err.message);
  }
}

// Run on startup and then every hour
setTimeout(() => runAutoBilling(), 5000);
setInterval(() => runAutoBilling(), 60 * 60 * 1000);

// (billing-log route moved above catch-all)

// ========== Start Server ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏠 Vencos Property Management running on http://localhost:${PORT}`);
});
