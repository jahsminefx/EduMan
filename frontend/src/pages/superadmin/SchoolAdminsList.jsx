import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../config/api';
import {
  UserCog, Plus, Search, Edit3, X, Check, AlertCircle, Loader2, Building2
} from 'lucide-react';

export default function SchoolAdminsList() {
  const [admins, setAdmins] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', school_id: '', is_active: 1 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adminsRes, schoolsRes] = await Promise.all([
        axios.get(`${API_URL}/superadmin/admins`, { params: search ? { search } : {} }),
        axios.get(`${API_URL}/superadmin/schools`),
      ]);
      setAdmins(adminsRes.data.admins);
      setSchools(schoolsRes.data.schools);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [search]);

  const openCreate = () => {
    setEditingAdmin(null);
    setForm({ name: '', email: '', password: '', school_id: '', is_active: 1 });
    setError('');
    setShowModal(true);
  };

  const openEdit = (admin) => {
    setEditingAdmin(admin);
    setForm({ name: admin.name, email: admin.email, password: '', school_id: admin.school_id || '', is_active: admin.is_active });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required'); return; }
    if (!editingAdmin && !form.password) { setError('Password is required for new admins'); return; }
    if (!form.school_id) { setError('Please select a school'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, school_id: parseInt(form.school_id) };
      if (!payload.password) delete payload.password; // don't send empty password on edit
      if (editingAdmin) {
        await axios.put(`${API_URL}/superadmin/admins/${editingAdmin.id}`, payload);
      } else {
        await axios.post(`${API_URL}/superadmin/admins`, payload);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center">
            <UserCog className="w-7 h-7 mr-2 text-emerald-600" />
            School Admins
          </h2>
          <p className="mt-1 text-sm text-gray-500">Manage all School Admin accounts and their school assignments</p>
        </div>
        <button
          id="btn-create-admin"
          onClick={openCreate}
          className="inline-flex items-center px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-[0.97]"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Admin
        </button>
      </div>

      {/* Search */}
      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          id="search-admins"
          type="text"
          placeholder="Search admins by name, email, or school..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
      ) : admins.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <UserCog className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">No school admins found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Admin</th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Assigned School</th>
                <th className="px-6 py-3.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {admins.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm mr-3">
                        {a.name?.[0]?.toUpperCase()}
                      </div>
                      <p className="text-sm font-bold text-gray-900">{a.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-600">{a.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    {a.school_name ? (
                      <div className="flex items-center">
                        <Building2 className="w-4 h-4 text-indigo-400 mr-1.5" />
                        <span className="text-sm font-medium text-gray-800">{a.school_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-orange-500 font-bold italic">⚠ Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${a.is_active === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {a.is_active === 1 ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEdit(a)}
                      className="p-2 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors"
                      title="Edit Admin"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 text-gray-400">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-gray-900 mb-6">{editingAdmin ? 'Edit School Admin' : 'Create School Admin'}</h3>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" /> {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Full Name *</label>
                <input id="input-admin-name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Jane Doe" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email *</label>
                <input id="input-admin-email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="admin@school.edu" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{editingAdmin ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Assign to School *</label>
                <select
                  id="select-admin-school"
                  value={form.school_id}
                  onChange={e => setForm({...form, school_id: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">— Select a school —</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {editingAdmin && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                  <select value={form.is_active} onChange={e => setForm({...form, is_active: parseInt(e.target.value)})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value={1}>Active</option>
                    <option value={0}>Disabled</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button
                id="btn-save-admin"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                {editingAdmin ? 'Save Changes' : 'Create Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
