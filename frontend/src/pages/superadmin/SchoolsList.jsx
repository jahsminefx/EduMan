import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../config/api';
import {
  Building2, Plus, Search, Edit3, X, Check, Users, GraduationCap,
  ChevronDown, ChevronUp, AlertCircle, Loader2
} from 'lucide-react';

export default function SchoolsList() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', is_active: 1 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/superadmin/schools`, { params: search ? { search } : {} });
      setSchools(res.data.schools);
    } catch (err) {
      console.error('Failed to fetch schools:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSchools(); }, [search]);

  const openCreate = () => {
    setEditingSchool(null);
    setForm({ name: '', address: '', phone: '', email: '', is_active: 1 });
    setError('');
    setShowModal(true);
  };

  const openEdit = (school) => {
    setEditingSchool(school);
    setForm({ name: school.name, address: school.address || '', phone: school.phone || '', email: school.email || '', is_active: school.is_active });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('School name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingSchool) {
        await axios.put(`${API_URL}/superadmin/schools/${editingSchool.id}`, form);
      } else {
        await axios.post(`${API_URL}/superadmin/schools`, form);
      }
      setShowModal(false);
      fetchSchools();
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); setExpandedData(null); return; }
    setExpandedId(id);
    try {
      const res = await axios.get(`${API_URL}/superadmin/schools/${id}`);
      setExpandedData(res.data);
    } catch { setExpandedData(null); }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center">
            <Building2 className="w-6 h-6 sm:w-7 sm:h-7 mr-2 text-indigo-600 flex-shrink-0" />
            Schools Management
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Manage all registered schools on the platform</p>
        </div>
        <button
          id="btn-create-school"
          onClick={openCreate}
          className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 active:scale-[0.97]"
        >
          <Plus className="w-4 h-4 mr-2" /> Add School
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          id="search-schools"
          type="text"
          placeholder="Search schools by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
      ) : schools.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100 p-8">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-base sm:text-lg font-bold">No schools found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">School</th>
                  <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Contact</th>
                  <th className="px-4 sm:px-6 py-3.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">Admins</th>
                  <th className="px-4 sm:px-6 py-3.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Teachers</th>
                  <th className="px-4 sm:px-6 py-3.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Students</th>
                  <th className="px-4 sm:px-6 py-3.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 sm:px-6 py-3.5 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {schools.map((s) => (
                  <React.Fragment key={s.id}>
                    <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => toggleExpand(s.id)}>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs sm:text-sm mr-3 flex-shrink-0">
                            {s.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{s.name}</p>
                            <p className="text-[11px] text-gray-400 truncate max-w-[160px] sm:max-w-[220px]">{s.address || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                        <p className="text-xs sm:text-sm text-gray-600 truncate max-w-[180px]">{s.email || '—'}</p>
                        <p className="text-xs text-gray-400">{s.phone || '—'}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-center"><span className="text-xs sm:text-sm font-bold text-gray-700">{s.admin_count}</span></td>
                      <td className="px-4 sm:px-6 py-4 text-center hidden sm:table-cell"><span className="text-xs sm:text-sm font-bold text-gray-700">{s.teacher_count}</span></td>
                      <td className="px-4 sm:px-6 py-4 text-center hidden sm:table-cell"><span className="text-xs sm:text-sm font-bold text-gray-700">{s.student_count}</span></td>
                      <td className="px-4 sm:px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${s.is_active === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {s.is_active === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {expandedId === s.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </td>
                    </tr>
                    {expandedId === s.id && expandedData && (
                      <tr>
                        <td colSpan="7" className="px-4 sm:px-6 py-4 bg-indigo-50/50">
                          <p className="text-xs font-bold uppercase text-indigo-600 tracking-wider mb-2">Assigned School Admins</p>
                          {expandedData.admins?.length > 0 ? (
                            <div className="space-y-2">
                              {expandedData.admins.map(a => (
                                <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-white p-3 rounded-xl border border-indigo-100">
                                  <div>
                                    <p className="text-xs sm:text-sm font-bold text-gray-800">{a.name}</p>
                                    <p className="text-xs text-gray-500">{a.email}</p>
                                  </div>
                                  <span className={`self-start sm:self-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${a.is_active === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {a.is_active === 1 ? 'Active' : 'Disabled'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm text-gray-400 italic">No admins assigned to this school</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 sm:p-6 my-auto max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-6">{editingSchool ? 'Edit School' : 'Create New School'}</h3>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-700 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" /> {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">School Name *</label>
                <input id="input-school-name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Springfield Academy" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Address</label>
                <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="+234..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                  <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="info@school.edu" />
                </div>
              </div>
              {editingSchool && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                  <select value={form.is_active} onChange={e => setForm({...form, is_active: parseInt(e.target.value)})} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value={1}>Active</option>
                    <option value={0}>Inactive / Archived</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2.5 border-t pt-4">
              <button onClick={() => setShowModal(false)} className="w-full sm:w-auto px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button
                id="btn-save-school"
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                {editingSchool ? 'Save Changes' : 'Create School'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
