import { Invoice } from '../types';
import { formatDate } from '../utils/helpers';
import { getPropertyById, getFloorUnits, getRecurringCharges, getOwners } from '../utils/db';

export async function printInvoice(invoice: Invoice): Promise<void> {
  // Fetch property details
  const prop = invoice.property_id ? await getPropertyById(invoice.property_id) : null;

  // Fetch owner payment info
  let ownerPayment: { bank_name: string; bank_account: string; account_name: string } | null = null;
  if (prop && prop.owner_id) {
    const owners = await getOwners();
    const owner = owners.find(o => o.id === prop.owner_id);
    if (owner && owner.payment_bank_name) {
      ownerPayment = {
        bank_name: owner.payment_bank_name,
        bank_account: owner.payment_bank_account || '',
        account_name: owner.payment_account_name || '',
      };
    }
  }

  // Fetch floor unit info and recurring charges
  let floorUnits: any[] = [];
  let recurringCharges: any[] = [];
  if (invoice.property_id) {
    floorUnits = await getFloorUnits(invoice.property_id);
    recurringCharges = await getRecurringCharges(invoice.property_id);
  }

  const floorUnit = invoice.floor_label
    ? floorUnits.find((f: any) => f.floor_label === invoice.floor_label)
    : null;

  const statusLabel = invoice.status === 'paid' ? '已付款 PAID' :
                      invoice.status === 'overdue' ? '已逾期 OVERDUE' : '待付款 PENDING';
  const statusColor = invoice.status === 'paid' ? '#22c55e' :
                      invoice.status === 'overdue' ? '#ef4444' : '#f59e0b';

  // Parse stored charges detail
  let chargeItems: Array<{name: string; amount: number}> = [];
  if (invoice.charges_detail) {
    try {
      const parsed = JSON.parse(invoice.charges_detail);
      if (Array.isArray(parsed) && parsed.length > 0) chargeItems = parsed;
    } catch {}
  }

  // If no stored detail, fall back to recurring charges from DB
  if (chargeItems.length === 0 && recurringCharges.length > 0) {
    chargeItems = recurringCharges
      .filter((c: any) => !c.floor_label || c.floor_label === invoice.floor_label)
      .map((c: any) => ({ name: c.charge_name, amount: c.amount }));
  }

  const chargeRows = chargeItems.map(c =>
    `<tr><td>${escapeHtml(c.name)}</td><td class="amount">${Number(c.amount).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`
  ).join('');

  // Parse adjustments
  let adjItems: Array<{name: string; amount: number}> = [];
  if (invoice.adjustments) {
    try {
      const parsed = JSON.parse(invoice.adjustments);
      if (Array.isArray(parsed) && parsed.length > 0) adjItems = parsed;
    } catch {}
  }

  // Adjustments use same black color as other items
  const adjRows = adjItems.map(a =>
    `<tr><td>${escapeHtml(a.name)}</td><td class="amount">${a.amount < 0 ? '-' : '+'}${Math.abs(a.amount).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`
  ).join('');

  const rentDisplay = (invoice.rent_amount || invoice.amount).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalDisplay = invoice.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const htmlContent = `<!DOCTYPE html><html><head><title>Invoice ${escapeHtml(invoice.invoice_no)}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
      .header h1 { font-size: 20px; letter-spacing: 2px; margin-bottom: 5px; }
      .header h2 { font-size: 24px; font-weight: bold; color: #555; }
      .meta { display: flex; justify-content: space-between; margin-bottom: 25px; }
      .meta-left, .meta-right { font-size: 13px; line-height: 1.8; }
      .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; color: white; background: ${statusColor}; }
      .section { margin-bottom: 20px; }
      .section-title { font-size: 13px; font-weight: bold; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; }
      .info-row { display: flex; justify-content: space-between; font-size: 13px; line-height: 1.8; }
      .info-row .label { color: #666; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; color: #333; }
      th { background: #f5f5f5; font-weight: bold; }
      td.amount { text-align: right; }
      th.amount { text-align: right; }
      .total-row { border-top: 2px solid #333; font-weight: bold; font-size: 15px; }
      .total-row td { padding-top: 12px; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #ddd; padding-top: 15px; }
      .payment-info { background: #f9f9f9; border: 1px solid #eee; border-radius: 8px; padding: 15px; margin-top: 20px; font-size: 13px; }
      @media print { body { padding: 20px; } .no-print { display: none; } }
    </style></head><body>
    <div class="header">
      <h1>VENCOS PROPERTY MANAGEMENT</h1>
      <h2>${invoice.status === 'paid' ? '收据 / RECEIPT' : '账单 / INVOICE'}</h2>
    </div>
    <div class="meta">
      <div class="meta-left">
        <div><strong>账单号:</strong> ${escapeHtml(invoice.invoice_no)}</div>
        <div><strong>开具日期:</strong> ${formatDate(invoice.created_at)}</div>
        <div><strong>到期日:</strong> ${formatDate(invoice.due_date)}</div>
        ${invoice.paid_date ? `<div><strong>付款日:</strong> ${formatDate(invoice.paid_date)}</div>` : ''}
      </div>
      <div class="meta-right" style="text-align:right;">
        <span class="status">${statusLabel}</span>
      </div>
    </div>
    ${prop ? `<div class="section"><div class="section-title">物业信息 Property Info</div>
      <div class="info-row"><span class="label">物业名称</span><span>${escapeHtml(prop.name)}</span></div>
      <div class="info-row"><span class="label">地址</span><span>${escapeHtml(prop.address || '-')}</span></div>
      ${invoice.floor_label ? `<div class="info-row"><span class="label">楼层</span><span>${escapeHtml(invoice.floor_label)}楼</span></div>` : ''}
    </div>` : ''}
    ${floorUnit ? `<div class="section"><div class="section-title">租户信息 Tenant Info</div>
      <div class="info-row"><span class="label">租户</span><span>${escapeHtml(floorUnit.tenant_name)}</span></div>
      ${floorUnit.tenant_phone ? `<div class="info-row"><span class="label">联系电话</span><span>${escapeHtml(floorUnit.tenant_phone)}</span></div>` : ''}
      ${floorUnit.tenant_company_reg ? `<div class="info-row"><span class="label">公司注册号 (SSM)</span><span>${escapeHtml(floorUnit.tenant_company_reg)}</span></div>` : ''}
    </div>` : `<div class="section"><div class="section-title">租户信息 Tenant Info</div>
      <div class="info-row"><span class="label">租户</span><span>${escapeHtml(invoice.tenant_name || '-')}</span></div>
    </div>`}
    <div class="section"><div class="section-title">费用明细 Charges Breakdown</div>
      <table>
        <tr><th>项目 Item</th><th class="amount">金额 Amount (RM)</th></tr>
        <tr><td>月租金 Monthly Rent</td><td class="amount">${rentDisplay}</td></tr>
        ${chargeRows}
        ${adjRows}
        <tr class="total-row"><td>总计 Total</td><td class="amount">RM ${totalDisplay}</td></tr>
      </table>
    </div>
    ${ownerPayment ? `<div class="payment-info">
      <strong>付款信息 / Payment Details:</strong><br>
      银行 Bank: ${escapeHtml(ownerPayment.bank_name)}<br>
      ${ownerPayment.bank_account ? `户口号码 Account No: ${escapeHtml(ownerPayment.bank_account)}<br>` : ''}
      ${ownerPayment.account_name ? `收款人 Account Name: ${escapeHtml(ownerPayment.account_name)}` : ''}
    </div>` : (prop && prop.bank_name ? `<div class="payment-info">
      <strong>付款信息 / Payment Details:</strong><br>
      银行 Bank: ${escapeHtml(prop.bank_name)}<br>
      ${prop.loan_account_no ? `户口号码 Account: ${escapeHtml(prop.loan_account_no)}<br>` : ''}
      ${prop.bank_code ? `银行代码 Bank Code: ${escapeHtml(prop.bank_code)}` : ''}
    </div>` : '')}
    <div class="footer">
      <p>感谢您的付款 / Thank you for your payment</p>
      <p>此为系统自动生成的账单 — VENCOS Property Management</p>
    </div>
    <div class="no-print" style="text-align:center;margin-top:20px;">
      <button onclick="window.print()" style="padding:10px 30px;font-size:14px;background:#BE5F28;color:white;border:none;border-radius:8px;cursor:pointer;">🖨️ 打印 / 保存PDF</button>
    </div>
    </body></html>`;

  // Use iframe approach for reliable printing in sandbox/iframe environments
  // First try window.open, fall back to iframe if blocked
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    // Fallback: create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;border:none;background:white;';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      // Add close button to content
      const closeBtn = `<div class="no-print" style="position:fixed;top:10px;right:10px;z-index:100000;">
        <button onclick="parent.document.getElementById('vencos-print-frame')?.remove()" style="padding:8px 20px;font-size:14px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;">✕ 关闭</button>
      </div>`;
      iframe.id = 'vencos-print-frame';
      iframeDoc.write(htmlContent.replace('</body>', closeBtn + '</body>'));
      iframeDoc.close();
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
