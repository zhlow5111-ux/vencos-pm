import React, { useState, useEffect } from 'react';
import { X, Check, Shield, CheckSquare, Square, ChevronDown, ChevronUp, Building2 } from 'lucide-react';
import { SystemUser, UserOwnerAccess, Owner, Property, ACCESS_LEVELS, USER_ROLES } from '../types';
import { getUserOwnerAccess, addUserOwnerAccess, removeUserOwnerAccess, getOwners, getProperties } from '../utils/db';

interface Props {
  user: SystemUser;
  onClose: () => void;
}

interface OwnerRow {
  owner: Owner;
  access?: UserOwnerAccess;
  level: string;
  originalLevel: string;
  properties: Property[];
  expanded: boolean;
}

export const AccessManager: React.FC<Props> = ({ user, onClose }) => {
  const [rows, setRows] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadData();
  }, [user.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [accessList, owners, properties] = await Promise.all([
        getUserOwnerAccess(user.id),
        getOwners(),
        getProperties(),
      ]);
      const accessMap = new Map<number, UserOwnerAccess>();
      for (const a of accessList) accessMap.set(a.owner_id, a);

      // Group properties by owner
      const propsByOwner = new Map<number, Property[]>();
      for (const p of properties) {
        const oid = p.owner_id || 0;
        if (!propsByOwner.has(oid)) propsByOwner.set(oid, []);
        propsByOwner.get(oid)!.push(p);
      }

      const list: OwnerRow[] = owners
        .filter(o => (propsByOwner.get(o.id)?.length || 0) > 0) // Only show owners with properties
        .map(o => {
          const access = accessMap.get(o.id);
          const level = access?.access_level || '';
          return {
            owner: o,
            access,
            level,
            originalLevel: level,
            properties: propsByOwner.get(o.id) || [],
            expanded: false,
          };
        });
      setRows(list);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function toggleOwner(idx: number) {
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

  function toggleExpand(idx: number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, expanded: !r.expanded } : r));
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
  const totalProps = rows.reduce((s, r) => s + (r.level ? r.properties.length : 0), 0);

  async function handleSave() {
    setSaving(true);
    try {
      for (const r of rows) {
        if (r.level !== r.originalLevel) {
          if (r.level && r.access) {
            // Update: remove old, add new
            await removeUserOwnerAccess(r.access.id);
            await addUserOwnerAccess(user.id, r.owner.id, r.level);
          } else if (r.level && !r.access) {
            // New access
            await addUserOwnerAccess(user.id, r.owner.id, r.level);
          } else if (!r.level && r.access) {
            // Remove access
            await removeUserOwnerAccess(r.access.id);
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
              <Shield size={16} className="text-primary" /> 公司访问权限
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
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              <p className="text-sm">暂无持有公司</p>
              <p className="text-xs mt-1">请先在设置中添加持有公司</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Batch actions */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-base-content/60">
                  {selectedCount} / {rows.length} 公司已授权 · 共 {totalProps} 个物业
                </span>
                <div className="flex gap-2">
                  <button className="btn btn-xs btn-ghost" onClick={selectAll}>全选</button>
                  <button className="btn btn-xs btn-ghost" onClick={clearAll}>清除</button>
                </div>
              </div>

              {/* Owner/Company list */}
              {rows.map((r, idx) => (
                <div key={r.owner.id} className={`rounded-lg border transition-colors ${r.level ? 'border-primary/30 bg-primary/5' : 'border-base-200'}`}>
                  {/* Company header */}
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <button className="shrink-0" onClick={() => toggleOwner(idx)}>
                        {r.level ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} className="text-base-content/30" />}
                      </button>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(idx)}>
                        <div className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-base-content/50 shrink-0" />
                          <p className="text-sm font-semibold truncate">{r.owner.name}</p>
                        </div>
                        <p className="text-xs text-base-content/50 ml-5">
                          {r.owner.owner_type === 'company' ? '公司' : '个人'} · {r.properties.length} 个物业
                        </p>
                      </div>
                      <button className="btn btn-xs btn-ghost btn-circle" onClick={() => toggleExpand(idx)}>
                        {r.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>

                    {/* Access level selector */}
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

                  {/* Expanded property list */}
                  {r.expanded && (
                    <div className="border-t border-base-200 bg-base-200/30 px-3 py-2">
                      <p className="text-[10px] text-base-content/40 font-medium mb-1.5 uppercase tracking-wider">
                        此公司名下物业
                      </p>
                      <div className="space-y-1">
                        {r.properties.map(p => {
                          const statusColors: Record<string, string> = {
                            rented: 'badge-success', vacant: 'badge-warning', sold: 'badge-info',
                            'self-use': 'badge-accent', 'under-construction': 'badge-secondary',
                          };
                          const statusLabels: Record<string, string> = {
                            rented: '已出租', vacant: '空置', sold: '已售',
                            'self-use': '自用', 'under-construction': '在建', active: '活跃',
                          };
                          return (
                            <div key={p.id} className="flex items-center gap-2 py-1">
                              <span className="text-xs text-base-content/70 flex-1 truncate">{p.name}</span>
                              <span className={`badge badge-xs ${statusColors[p.status] || 'badge-ghost'}`}>
                                {statusLabels[p.status] || p.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Info note */}
              <div className="text-xs text-base-content/40 text-center mt-4 px-4">
                💡 授权公司后，该公司名下的所有物业（包括将来新增的）都会自动对此用户可见
              </div>
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
