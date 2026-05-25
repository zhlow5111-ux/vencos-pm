import React, { useState, useEffect } from 'react';
import { X, Save, Building2, User, Landmark, ShieldCheck } from 'lucide-react';
import { Owner, OwnerType, OWNER_TYPES } from '../types';
import { saveOwner } from '../utils/db';

const MY_BANKS = [
  'Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'Hong Leong Bank',
  'AmBank', 'Bank Islam', 'Bank Rakyat', 'Affin Bank', 'Alliance Bank',
  'OCBC Bank', 'Standard Chartered', 'HSBC Bank', 'UOB Bank', 'Bank Muamalat',
  'Agrobank', 'BSN (Bank Simpanan Nasional)',
];

interface Props {
  owner?: Owner;
  onClose: () => void;
  onSaved: () => void;
}

export const OwnerForm: React.FC<Props> = ({ owner, onClose, onSaved }) => {
  const isEdit = !!owner;
  const [saving, setSaving] = useState(false);

  const [ownerType, setOwnerType] = useState<OwnerType>(owner?.owner_type || 'company');
  const [name, setName] = useState(owner?.name || '');
  const [registrationNo, setRegistrationNo] = useState(owner?.registration_no || '');
  const [contactPerson, setContactPerson] = useState(owner?.contact_person || '');
  const [phone, setPhone] = useState(owner?.phone || '');
  const [email, setEmail] = useState(owner?.email || '');
  const [address, setAddress] = useState(owner?.address || '');
  const [notes, setNotes] = useState(owner?.notes || '');
  const [paymentBankName, setPaymentBankName] = useState(owner?.payment_bank_name || '');
  const [customBank, setCustomBank] = useState(() => {
    const v = owner?.payment_bank_name || '';
    return MY_BANKS.includes(v) ? '' : v;
  });
  const [isCustomBank, setIsCustomBank] = useState(() => {
    const v = owner?.payment_bank_name || '';
    return v !== '' && !MY_BANKS.includes(v);
  });
  const [paymentBankAccount, setPaymentBankAccount] = useState(owner?.payment_bank_account || '');
  const [paymentAccountName, setPaymentAccountName] = useState(owner?.payment_account_name || owner?.name || '');

  // When owner name changes and payment account name is empty or matches old name, sync it
  useEffect(() => {
    if (!paymentAccountName || paymentAccountName === (owner?.name || '')) {
      setPaymentAccountName(name);
    }
  }, [name]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveOwner({
        id: owner?.id,
        name: name.trim(),
        owner_type: ownerType,
        registration_no: registrationNo,
        contact_person: contactPerson,
        phone,
        email,
        address,
        notes,
        payment_bank_name: paymentBankName,
        payment_bank_account: paymentBankAccount,
        payment_account_name: paymentAccountName,
      });
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md max-h-[85vh] p-0 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-base-300 shrink-0">
          <h3 className="font-bold text-base">{isEdit ? '编辑持有人' : '新增持有人'}</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Type selector */}
          <div className="form-control">
            <label className="label"><span className="label-text font-medium">持有人类型</span></label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOwnerType('company')}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  ownerType === 'company' ? 'border-primary bg-primary/10 text-primary' : 'border-base-300'
                }`}
              >
                <Building2 size={18} />
                <div className="text-left">
                  <p className="text-xs font-medium">公司持有</p>
                  <p className="text-[10px] text-base-content">Sdn Bhd / Bhd</p>
                </div>
              </button>
              <button
                onClick={() => setOwnerType('individual')}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  ownerType === 'individual' ? 'border-primary bg-primary/10 text-primary' : 'border-base-300'
                }`}
              >
                <User size={18} />
                <div className="text-left">
                  <p className="text-xs font-medium">个人持有</p>
                  <p className="text-[10px] text-base-content">个人名下</p>
                </div>
              </button>
            </div>
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text text-xs">
              {ownerType === 'company' ? '公司名称 *' : '个人姓名 *'}
            </span></label>
            <input className="input input-bordered input-sm w-full"
              placeholder={ownerType === 'company' ? '如: ABC Properties Sdn Bhd' : '如: Tan Ah Kow'}
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text text-xs">
              {ownerType === 'company' ? '公司注册号 (SSM)' : '身份证号 (IC)'}
            </span></label>
            <input className="input input-bordered input-sm w-full"
              placeholder={ownerType === 'company' ? '如: 123456-X' : '如: 900101-14-5678'}
              value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} />
          </div>

          {ownerType === 'company' && (
            <div className="form-control">
              <label className="label"><span className="label-text text-xs">联系人</span></label>
              <input className="input input-bordered input-sm w-full" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="form-control">
              <label className="label"><span className="label-text text-xs">电话</span></label>
              <input className="input input-bordered input-sm w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text text-xs">邮箱</span></label>
              <input className="input input-bordered input-sm w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text text-xs">地址</span></label>
            <input className="input input-bordered input-sm w-full" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          {/* Payment Bank Section */}
          <div className="divider text-xs text-base-content/60 my-2">
            <Landmark size={14} className="inline mr-1" />
            收款银行信息 / Payment Account
          </div>
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning-content mb-1">
            <ShieldCheck size={14} className="inline mr-1" />
            账单上的付款信息将自动读取此处资料。修改将被记录到变更日志。
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text text-xs">收款银行名称 *</span></label>
            {!isCustomBank ? (
              <select className="select select-bordered select-sm w-full"
                value={paymentBankName}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__custom__') {
                    setIsCustomBank(true);
                    setPaymentBankName('');
                    setCustomBank('');
                  } else {
                    setPaymentBankName(v);
                  }
                }}>
                <option value="">— 请选择银行 —</option>
                {MY_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                <option value="__custom__">✏️ 其他（自行输入）</option>
              </select>
            ) : (
              <div className="flex gap-1">
                <input className="input input-bordered input-sm flex-1"
                  placeholder="输入银行名称"
                  value={customBank}
                  autoFocus
                  onChange={(e) => { setCustomBank(e.target.value); setPaymentBankName(e.target.value); }} />
                <button className="btn btn-ghost btn-sm btn-square" title="返回列表选择"
                  onClick={() => { setIsCustomBank(false); setPaymentBankName(''); setCustomBank(''); }}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text text-xs">收款银行账号 *</span></label>
            <input className="input input-bordered input-sm w-full"
              placeholder="如: 5123-4567-8901"
              value={paymentBankAccount} onChange={(e) => setPaymentBankAccount(e.target.value)} />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text text-xs">收款人名称</span></label>
            <input className="input input-bordered input-sm w-full"
              placeholder="如: ABC Properties Sdn Bhd"
              value={paymentAccountName} onChange={(e) => setPaymentAccountName(e.target.value)} />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text text-xs">备注</span></label>
            <textarea className="textarea textarea-bordered textarea-sm w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="p-4 border-t border-base-300 flex gap-2 shrink-0">
          <button className="btn btn-ghost btn-sm flex-1" onClick={onClose}>取消</button>
          <button className="btn btn-primary btn-sm flex-1 gap-1" disabled={!name.trim() || saving} onClick={handleSave}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
            {isEdit ? '保存' : '创建'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/40" onClick={onClose} />
    </div>
  );
};
