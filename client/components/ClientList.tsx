import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit, Trash2, Users, Phone, Mail, Building2, User } from 'lucide-react';
import { Client, CLIENT_ROLES, ClientRole } from '../types';
import { getClients, deleteClient } from '../utils/db';
import { ConfirmModal } from './ConfirmModal';

interface ClientListProps {
  onAdd: () => void;
  onEdit: (client: Client) => void;
  refreshKey: number;
}

const ROLE_BADGE: Record<ClientRole, string> = {
  buyer: 'badge-info',
  seller: 'badge-secondary',
  tenant: 'badge-warning',
  landlord: 'badge-primary',
};

export const ClientList: React.FC<ClientListProps> = ({ onAdd, onEdit, refreshKey }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    loadClients();
  }, [refreshKey]);

  async function loadClients() {
    setLoading(true);
    try {
      const data = await getClients();
      setClients(data);
    } catch (e) {
      console.error('Failed to load clients:', e);
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteConfirm() {
    if (deleteConfirmId === null) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    setClients((prev) => prev.filter((c) => c.id !== id));
    deleteClient(id).catch((e) => {
      console.error('Failed to delete client:', e);
      loadClients();
    });
  }

  const filtered = clients.filter((c) => {
    const searchLower = search.toLowerCase();
    const matchSearch = !search ||
      c.name.toLowerCase().includes(searchLower) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(searchLower) ||
      (c.company_name || '').toLowerCase().includes(searchLower) ||
      (c.registration_no || '').toLowerCase().includes(searchLower);
    const matchRole = roleFilter === 'all' || c.role === roleFilter;
    const matchType = typeFilter === 'all' || (c.client_type || 'individual') === typeFilter;
    return matchSearch && matchRole && matchType;
  });

  const roleLabel = (r: string) => CLIENT_ROLES.find((role) => role.value === r)?.label || r;

  return (
    <div className="space-y-3">
      {/* Search & Add */}
      <div className="flex gap-2">
        <label className="input input-bordered input-sm flex items-center gap-2 flex-1">
          <Search className="h-[1em] opacity-50" />
          <input
            type="search"
            className="grow"
            placeholder="搜索客户/公司..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>
          <Plus size={16} />
        </button>
      </div>

      {/* Type filter */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        <button className={`btn btn-xs ${typeFilter === 'all' ? 'btn-info' : 'btn-ghost'}`} onClick={() => setTypeFilter('all')}>全部</button>
        <button className={`btn btn-xs gap-1 ${typeFilter === 'individual' ? 'btn-info' : 'btn-ghost'}`} onClick={() => setTypeFilter('individual')}>👤 个人</button>
        <button className={`btn btn-xs gap-1 ${typeFilter === 'company' ? 'btn-info' : 'btn-ghost'}`} onClick={() => setTypeFilter('company')}>🏢 公司</button>
        <div className="divider divider-horizontal mx-0" />
        {CLIENT_ROLES.map((r) => (
          <button
            key={r.value}
            className={`btn btn-xs ${roleFilter === r.value ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setRoleFilter(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Client cards */}
      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <Users size={40} className="mx-auto opacity-30 mb-2" />
          <p className="text-base-content text-sm">暂无客户数据</p>
          <button className="btn btn-primary btn-sm mt-3" onClick={onAdd}>
            <Plus size={14} /> 添加第一个客户
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const isCompany = (c.client_type || 'individual') === 'company';
            return (
              <div key={c.id} className="card bg-base-200 cursor-pointer hover:bg-base-300 transition-colors" onClick={() => onEdit(c)}>
                <div className="card-body p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Name + badges */}
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        {isCompany ? (
                          <Building2 size={14} className="text-primary shrink-0" />
                        ) : (
                          <User size={14} className="text-info shrink-0" />
                        )}
                        <h3 className="font-semibold text-sm truncate">
                          {isCompany ? (c.company_name || c.name) : c.name}
                        </h3>
                        <span className={`badge badge-xs ${isCompany ? 'badge-primary' : 'badge-info'}`}>
                          {isCompany ? '公司' : '个人'}
                        </span>
                        <span className={`badge badge-xs ${ROLE_BADGE[c.role]}`}>
                          {roleLabel(c.role)}
                        </span>
                      </div>

                      {/* Company extra info */}
                      {isCompany && (
                        <div className="text-xs text-base-content mb-1 space-y-0.5">
                          {c.registration_no && <p>📋 SSM: {c.registration_no}</p>}
                          {c.name && c.name !== c.company_name && <p>👔 联系人: {c.name}</p>}
                        </div>
                      )}

                      {/* Individual IC */}
                      {!isCompany && c.ic_number && (
                        <p className="text-xs text-base-content mb-1">🪪 IC: {c.ic_number}</p>
                      )}

                      {/* Contact info */}
                      <div className="flex flex-wrap gap-3 text-xs text-base-content">
                        {c.phone && (
                          <span className="flex items-center gap-1"><Phone size={10} />{c.phone}</span>
                        )}
                        {c.email && (
                          <span className="flex items-center gap-1"><Mail size={10} />{c.email}</span>
                        )}
                      </div>
                      {c.notes && <p className="text-xs text-base-content mt-1 truncate">{c.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={(e) => { e.stopPropagation(); onEdit(c); }}
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(c.id); }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmModal
        open={deleteConfirmId !== null}
        message="确定删除此客户？相关交易记录不会被删除。"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};
