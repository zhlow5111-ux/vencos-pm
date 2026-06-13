import React, { useState } from 'react';
import { X, Eye } from 'lucide-react';
import { MessageTemplate, CHANNEL_TYPES, TEMPLATE_TYPES, TemplateType } from '../types';
import { saveTemplate } from '../utils/db';

interface TemplateFormProps {
  template?: MessageTemplate;
  onClose: () => void;
  onSaved: () => void;
}

export const TemplateForm: React.FC<TemplateFormProps> = ({ template, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: template?.name || '',
    channel: template?.channel || 'both',
    subject: template?.subject || '',
    content: template?.content || '',
    template_type: (template?.template_type || '') as TemplateType,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const previewContent = form.content
    .replace(/{tenant_name}/g, '张三')
    .replace(/{property_name}/g, 'Sunway Residence Unit A')
    .replace(/{amount}/g, '1,500')
    .replace(/{due_date}/g, '2026-06-01');

  const previewSubject = form.subject
    .replace(/{tenant_name}/g, '张三')
    .replace(/{property_name}/g, 'Sunway Residence Unit A')
    .replace(/{amount}/g, '1,500')
    .replace(/{due_date}/g, '2026-06-01');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await saveTemplate({
        ...(template?.id ? { id: template.id } : {}),
        name: form.name.trim(),
        channel: form.channel as MessageTemplate['channel'],
        subject: form.subject,
        content: form.content,
        template_type: form.template_type,
      });
      onSaved();
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-base-100 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <h3 className="font-bold text-lg">{template ? '编辑模板' : '新建消息模板'}</h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">模板类型</span></label>
            <select
              className="select select-bordered select-sm w-full"
              value={form.template_type}
              onChange={(e) => setForm({ ...form, template_type: e.target.value as TemplateType })}
            >
              <option value="">未分类</option>
              {TEMPLATE_TYPES.map((tt) => (
                <option key={tt.value} value={tt.value}>{tt.label}</option>
              ))}
            </select>
          </div>

          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">模板名称</span></label>
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：每月租金提醒"
              required
            />
          </div>

          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">发送渠道</span></label>
            <select
              className="select select-bordered select-sm w-full"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              {CHANNEL_TYPES.map((ch) => (
                <option key={ch.value} value={ch.value}>{ch.label}</option>
              ))}
            </select>
          </div>

          {(form.channel === 'email' || form.channel === 'both') && (
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs">邮件主题</span></label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="如：租金到期提醒 - {property_name}"
              />
            </div>
          )}

          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs">消息内容</span>
              <button
                type="button"
                className="btn btn-xs btn-ghost gap-1"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye size={12} /> {showPreview ? '编辑' : '预览'}
              </button>
            </label>
            {showPreview ? (
              <div className="bg-base-200 rounded-lg p-3 text-sm whitespace-pre-wrap min-h-[120px]">
                {previewSubject && <p className="font-semibold mb-2 text-xs text-primary">主题：{previewSubject}</p>}
                {previewContent || <span className="text-base-content">无内容</span>}
              </div>
            ) : (
              <textarea
                className="textarea textarea-bordered textarea-sm w-full"
                rows={6}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder={'尊敬的 {tenant_name}，\n\n您物业 {property_name} 的租金 RM{amount} 将于 {due_date} 到期。'}
              />
            )}
            <p className="text-xs text-base-content mt-1">
              占位符：{'{tenant_name}'} {'{property_name}'} {'{amount}'} {'{due_date}'}
            </p>
          </div>

          <button type="submit" className="btn btn-primary btn-sm w-full" disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : (template ? '保存' : '创建模板')}
          </button>
        </form>
      </div>
    </div>
  );
};
