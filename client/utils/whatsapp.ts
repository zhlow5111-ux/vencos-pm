import { getWhatsAppConfig, logWhatsAppMessage } from './db';

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Send a text message via WhatsApp Cloud API
export async function sendWhatsAppMessage(
  phone: string,
  message: string,
  context?: { recipientName?: string; messageType?: string; templateName?: string; propertyId?: number; invoiceId?: number }
): Promise<WhatsAppSendResult> {
  const config = await getWhatsAppConfig();
  if (!config || !config.active) {
    await logWhatsAppMessage({
      recipient_phone: phone,
      recipient_name: context?.recipientName || '',
      message_type: context?.messageType || 'text',
      template_name: context?.templateName || '',
      content: message.substring(0, 500),
      status: 'failed',
      property_id: context?.propertyId,
      invoice_id: context?.invoiceId,
    });
    return { success: false, error: 'WhatsApp 未配置或未启用' };
  }

  try {
    // Format phone: ensure +60 prefix for Malaysian numbers
    const formattedPhone = phone.startsWith('+') ? phone.replace('+', '') :
                          phone.startsWith('60') ? phone : '60' + phone.replace(/^0/, '');

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    const data = await response.json();

    if (data.messages && data.messages[0]?.id) {
      await logWhatsAppMessage({
        recipient_phone: phone,
        recipient_name: context?.recipientName || '',
        message_type: context?.messageType || 'text',
        template_name: context?.templateName || '',
        content: message.substring(0, 500),
        status: 'sent',
        property_id: context?.propertyId,
        invoice_id: context?.invoiceId,
      });
      return { success: true, messageId: data.messages[0].id };
    } else {
      const errMsg = data.error?.message || JSON.stringify(data);
      await logWhatsAppMessage({
        recipient_phone: phone,
        recipient_name: context?.recipientName || '',
        message_type: context?.messageType || 'text',
        template_name: context?.templateName || '',
        content: message.substring(0, 500),
        status: 'failed',
        property_id: context?.propertyId,
        invoice_id: context?.invoiceId,
      });
      return { success: false, error: errMsg };
    }
  } catch (err: any) {
    await logWhatsAppMessage({
      recipient_phone: phone,
      recipient_name: context?.recipientName || '',
      message_type: context?.messageType || 'text',
      template_name: context?.templateName || '',
      content: message.substring(0, 500),
      status: 'failed',
      property_id: context?.propertyId,
      invoice_id: context?.invoiceId,
    });
    return { success: false, error: err.message || String(err) };
  }
}

// Build invoice reminder message from template
export function buildInvoiceMessage(template: string, data: {
  tenant_name: string;
  property_name: string;
  floor_label: string;
  amount: number;
  due_date: string;
  invoice_no: string;
}): string {
  return template
    .replace(/\{tenant_name\}/g, data.tenant_name)
    .replace(/\{property_name\}/g, data.property_name)
    .replace(/\{floor_label\}/g, data.floor_label)
    .replace(/\{amount\}/g, `RM ${data.amount.toLocaleString()}`)
    .replace(/\{due_date\}/g, data.due_date)
    .replace(/\{invoice_no\}/g, data.invoice_no);
}
