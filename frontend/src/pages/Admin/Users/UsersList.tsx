import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Users, Search, Pencil, UserX } from 'lucide-react';
import api from '../../../api';

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  staff: 'bg-purple-100 text-purple-800',
  customer: 'bg-blue-100 text-blue-800',
};

export default function UsersList() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'customer', is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async (p = 1, s = search) => {
    setLoading(true);
    try {
      const res = await api.get('/users', { params: { page: p, limit: 15, search: s || undefined } });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, search);
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role, is_active: u.is_active });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put(`/users/${editUser.id}`, editForm);
      setUsers((prev) => prev.map((u) => u.id === editUser.id ? { ...u, ...res.data.user } : u));
      toast.success('User updated');
      setEditUser(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Deactivate user "${name}"?`)) return;
    try {
      await api.delete(`/users/${id}`);
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, is_active: false } : u));
      toast.success('User deactivated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} users total</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="submit" className="btn-secondary">Search</button>
      </form>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-40" />
            <p>No users found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">User</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500 hidden md:table-cell">Role</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500 hidden sm:table-cell">Orders</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {u.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className={`badge ${roleColors[u.role]}`}>{u.role}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 hidden sm:table-cell">{u.order_count}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Pencil size={14} />
                      </button>
                      {u.is_active && (
                        <button onClick={() => handleDeactivate(u.id, u.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <UserX size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button className="btn-secondary py-1.5 px-3 text-sm" disabled={page === 1} onClick={() => { setPage(page - 1); fetchUsers(page - 1); }}>Previous</button>
          <span className="text-sm text-gray-600">Page {page} of {pages}</span>
          <button className="btn-secondary py-1.5 px-3 text-sm" disabled={page === pages} onClick={() => { setPage(page + 1); fetchUsers(page + 1); }}>Next</button>
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditUser(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Edit User</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="input" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select className="input" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                  <option value="customer">Customer</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="u_active" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} className="w-4 h-4 rounded" />
                <label htmlFor="u_active" className="text-sm font-medium text-gray-700">Active</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setEditUser(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
