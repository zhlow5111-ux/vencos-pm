import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { Client, CLIENT_ROLES, ClientType } from '../types';
import { saveClient } from '../utils/db';

interface ClientFormProps {
  client?: Client | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ClientForm: React.FC<ClientFormProps> = ({ client, onClose, onSaved }) => {
  const [clientType, setClientType] = useState<ClientType>(client?.client_type || 'individual');
  const [form, setForm] = useState({
    name: client?.name || '',
    phone: client?.phone || '',
    email: client?.email || '',
    role: client?.role || 'buyer',
    ic_number: client?.ic_number || '',
    company_name: client?.company_name || '',
    registration_no: client?.registration_no || '',
    director_name: client?.director_name || '',
    director_ic: client?.director_ic || '',
    director_phone: client?.director_phone || '',
    director_email: client?.director_email || '',
    address: client?.address || '',
    notes: client?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nameCheck = clientType === 'company' ? form.company_name.trim() : form.name.trim();
    if (!nameCheck) return;
    setSaving(true);
    try {
      await saveClient({
        ...form,
        id: client?.id,
        client_type: clientType,
        name: clientType === 'company' ? (form.name || form.director_name || form.company_name) : form.name,
      });
      onSaved();
    } catch (err) {
      console.error('Failed to save client:', err);
    } finally {
      setSaving(false);
    }
  }

  const canSave = clientType === 'company'
    ? form.company_name.trim().length > 0
    : form.name.trim().length > 0;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md max-h-[90vh] p-0 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-base-300 shrink-0">
          <h3 className="font-bold text-lg">{client ? '编辑客户' : '新增客户'}</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Individual / Company toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              className={`btn btn-sm flex-1 gap-1 ${clientType === 'individual' ? 'btn-info' : 'btn-outline'}`}
              onClick={() => setClientType('individual')}
            >👤 个人 Individual</button>
            <button
              type="button"
              className={`btn btn-sm flex-1 gap-1 ${clientType === 'company' ? 'btn-info' : 'btn-outline'}`}
              onClick={() => setClientType('company')}
            >🏢 公司 Company</button>
          </div>

          {/* Role */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">角色</span></label>
            <select
              className="select select-bordered select-sm w-full"
              value={form.role}
              onChange={(e) => updateField('role', e.target.value)}
            >
              {CLIENT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {clientType === 'individual' ? (
            /* ===== Individual ===== */
            <div className="bg-info/5 border border-info/20 rounded-xl p-3 space-y-2">
              <p className="font-medium text-sm text-info flex items-center gap-1">👤 个人资料</p>
              <div className="form-control">
                <label className="label py-0.5"><span className="label-text text-xs font-medium">姓名 * Name</span></label>
                <input className="input input-bordered input-sm w-full" placeholder="Full Name" value={form.name} onChange={(e) => updateField('name', e.target.value)} required />
              </div>
              <div className="form-control">
                <label className="label py-0.5"><span className="label-text text-xs">身份证号码 IC / Passport</span></label>
                <input className="input input-bordered input-sm w-full" placeholder="如: 880101-14-5678" value={form.ic_number} onChange={(e) => updateField('ic_number', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">手机号码</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="+60123456789" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">电子邮箱</span></label>
                  <input type="email" className="input input-bordered input-sm w-full" placeholder="email@example.com" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
                </div>
              </div>
              <div className="form-control">
                <label className="label py-0.5"><span className="label-text text-xs">地址 Address</span></label>
                <input className="input input-bordered input-sm w-full" placeholder="联系地址" value={form.address} onChange={(e) => updateField('address', e.target.value)} />
              </div>
            </div>
          ) : (
            /* ===== Company ===== */
            <div className="space-y-3">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
                <p className="font-medium text-sm text-primary flex items-center gap-1">🏢 公司资料</p>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">公司名称 * Company Name</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="ABC Sdn Bhd" value={form.company_name} onChange={(e) => updateField('company_name', e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">SSM 注册号码 Registration No.</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="如: 202301012345 (1234567-A)" value={form.registration_no} onChange={(e) => updateField('registration_no', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="form-control">
                    <label className="label py-0.5"><span className="label-text text-xs">公司电话</span></label>
                    <input className="input input-bordered input-sm w-full" placeholder="+603-12345678" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
                  </div>
                  <div className="form-control">
                    <label className="label py-0.5"><span className="label-text text-xs">公司邮箱</span></label>
                    <input type="email" className="input input-bordered input-sm w-full" placeholder="info@company.com" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
                  </div>
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">公司地址 Address</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="公司注册地址" value={form.address} onChange={(e) => updateField('address', e.target.value)} />
                </div>
              </div>

              {/* Director */}
              <div className="bg-warning/5 border border-warning/20 rounded-xl p-3 space-y-2">
                <p className="font-medium text-sm text-warning flex items-center gap-1">👔 董事/负责人资料 Director Info</p>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs font-medium">负责人姓名 Contact Person</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="Director / PIC Name" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label py-0.5"><span className="label-text text-xs">董事 IC Director IC</span></label>
                  <input className="input input-bordered input-sm w-full" placeholder="如: 880101-14-5678" value={form.director_ic} onChange={(e) => updateField('director_ic', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="form-control">
                    <label className="label py-0.5"><span className="label-text text-xs">董事手机</span></label>
                    <input className="input input-bordered input-sm w-full" placeholder="+60123456789" value={form.director_phone} onChange={(e) => updateField('director_phone', e.target.value)} />
                  </div>
                  <div className="form-control">
                    <label className="label py-0.5"><span className="label-text text-xs">董事邮箱</span></label>
                    <input type="email" className="input input-bordered input-sm w-full" placeholder="director@company.com" value={form.director_email} onChange={(e) => updateField('director_email', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">备注</span></label>
            <textarea
              className="textarea textarea-bordered textarea-sm w-full"
              rows={2}
              placeholder="备注信息..."
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !canSave}>
              {saving ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
              {client ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
};
