import React, { useState, useEffect } from 'react';
import { X, Check, Shield, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';
import { SystemUser, UserAccess, Property, ACCESS_LEVELS, USER_ROLES } from '../types';
import { getUserAccess, addUserAccess, removeUserAccess, getProperties } from '../utils/db';

interface Props {
  user: SystemUser;
  onClose: () => void;
}

interface PropertyRow {
  property: Property;
  access?: UserAccess;
  level: string;
  originalLevel: string;
}

export const AccessManager: React.FC<Props> = ({ user, onClose }) => {
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadData();
  }, [user.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [accessList, properties] = await Promise.all([
        getUserAccess(user.id),
        getProperties(),
      ]);
      const accessMap = new Map<number, UserAccess>();
      for (const a of accessList) accessMap.set(a.property_id, a);
      const list: PropertyRow[] = properties.map(p => {
        const access = accessMap.get(p.id);
        const level = access?.access_level || '';
        return { property: p, access, level, originalLevel: level };
      });
      setRows(list);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function toggleProperty(idx: number) {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      if (r.level) return { ...r, level: '' };
      return { ...r, level: 'readonly' };
    }));
    setSaved(false);
  }

  function setLevel(idx: number, level: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, level } : r));
    setSaved(false);
  }

  function selectAll() {
    setRows(prev => prev.map(r => r.level ? r : { ...r, level: 'readonly' }));
    setSaved(false);
  }

  function clearAll() {
    setRows(prev => prev.map(r => ({ ...r, level: '' })));
    setSaved(false);
  }

  const hasDirty = rows.some(r => r.level !== r.originalLevel);
  const selectedCount = rows.filter(r => r.level).length;

  async function handleSave() {
    setSaving(true);
    try {
      for (const r of rows) {
        if (r.level !== r.originalLevel) {
          if (r.level && r.access) {
            await removeUserAccess(r.access.id);
            await addUserAccess(user.id, r.property.id, r.level);
          } else if (r.level && !r.access) {
            await addUserAccess(user.id, r.property.id, r.level);
          } else if (!r.level && r.access) {
            await removeUserAccess(r.access.id);
          }
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await loadData();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  const roleInfo = USER_ROLES.find(r => r.value === user.role);
  const roleIcon = user.role === 'super_admin' ? '👑' : user.role === 'admin' ? '🛡️' : '📊';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-base-100 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-200">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <Shield size={16} className="text-primary" /> 物业访问权限
            </h3>
            <p className="text-xs text-base-content/60 mt-0.5 flex items-center gap-1.5">
              {roleIcon} {user.name} · {roleInfo?.label}
            </p>
          </div>
          <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {user.role === 'super_admin' ? (
            <div className="text-center py-8 text-base-content/60">
              <p className="text-sm">👑 超级管理员拥有全部物业的完全权限</p>
              <p className="text-xs mt-1">无需单独配置</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md" /></div>
          ) : (
            <div className="space-y-3">
              {/* Batch actions */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-base-content/60">{selectedCount} / {rows.length} 物业已授权</span>
                <div className="flex gap-2">
                  <button className="btn btn-xs btn-ghost" onClick={selectAll}>全选</button>
                  <button className="btn btn-xs btn-ghost" onClick={clearAll}>清除</button>
                </div>
              </div>

              {/* Property list */}
              {rows.map((r, idx) => (
                <div key={r.property.id} className={`rounded-lg border p-2.5 transition-colors ${r.level ? 'border-primary/30 bg-primary/5' : 'border-base-200'}`}>
                  <div className="flex items-center gap-2">
                    <button className="shrink-0" onClick={() => toggleProperty(idx)}>
                      {r.level ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} className="text-base-content/30" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.property.name}</p>
                      <p className="text-xs text-base-content/50 truncate">{r.property.address}</p>
                    </div>
                  </div>
                  {r.level && (
                    <div className="mt-2 ml-7">
                      <select className="select select-bordered select-xs w-full max-w-xs"
                        value={r.level} onChange={e => setLevel(idx, e.target.value)}>
                        {ACCESS_LEVELS.map(l => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {user.role !== 'super_admin' && hasDirty && (
          <div className="p-4 border-t border-base-200">
            <button className="btn btn-primary btn-sm w-full gap-1" onClick={handleSave} disabled={saving}>
              {saving ? <span className="loading loading-spinner loading-xs" /> : <Check size={14} />}
              保存权限设置
            </button>
          </div>
        )}
        {saved && (
          <div className="toast toast-top toast-center z-[10000]">
            <div className="alert alert-success shadow-lg">
              <span className="text-sm">✓ 权限已保存</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
