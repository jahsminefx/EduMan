import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../config/api';
import {
  Users, UserPlus, RefreshCw, KeyRound, LogOut, CheckCircle2, XCircle,
  Search, Filter, ShieldAlert, Mail, Calendar, Activity
} from 'lucide-react';

export default function PlatformStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', role: 'SupportOfficer' });
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (statusFilter !== '') params.status = statusFilter;
      const res = await axios.get(`${API_URL}/superadmin/platform-staff`, { params });
      setStaff(res.data.staff || []);
    } catch (err) {
      console.error('Failed to fetch platform staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [roleFilter, statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await axios.post(`${API_URL}/superadmin/platform-staff`, createForm);
      setMessage({ type: 'success', text: res.data.message || 'Staff account created successfully.' });
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', role: 'SupportOfficer' });
      fetchStaff();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create staff account.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const actionName = user.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionName} ${user.name}?`)) return;

    try {
      const res = await axios.put(`${API_URL}/superadmin/platform-staff/${user.id}/status`, {
        is_active: user.is_active ? 0 : 1
      });
      setMessage({ type: 'success', text: res.data.message });
      fetchStaff();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update status.' });
    }
  };

  const handleResendInvitation = async (user) => {
    try {
      const res = await axios.post(`${API_URL}/superadmin/platform-staff/${user.id}/resend-invitation`);
      setMessage({ type: 'success', text: res.data.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to resend invitation.' });
    }
  };

  const handleResetAccess = async (user) => {
    if (!window.confirm(`Are you sure you want to reset access for ${user.name}? This will invalidate active sessions and send a 1-click password setup link.`)) return;

    try {
      const res = await axios.post(`${API_URL}/superadmin/platform-staff/${user.id}/reset-access`);
      setMessage({ type: 'success', text: res.data.message });
      fetchStaff();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to reset access.' });
    }
  };

  const handleRevokeSessions = async (user) => {
    if (!window.confirm(`Are you sure you want to revoke all active sessions for ${user.name}?`)) return;

    try {
      const res = await axios.post(`${API_URL}/superadmin/platform-staff/${user.id}/revoke-sessions`);
      setMessage({ type: 'success', text: res.data.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to revoke sessions.' });
    }
  };

  const filteredStaff = staff.filter(s => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Platform Staff Management
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Provision, manage, and audit global platform staff accounts (ContentManager & SupportOfficer).
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Create Global Staff
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
          {message.text}
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Roles</option>
            <option value="ContentManager">ContentManager</option>
            <option value="SupportOfficer">SupportOfficer</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-gray-500">Loading platform staff...</div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 italic">No platform staff accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase border-b border-gray-100">
                <tr>
                  <th className="p-4">Staff Member</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Setup Status</th>
                  <th className="p-4">Activity Metric</th>
                  <th className="p-4">Last Login</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredStaff.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{u.name}</div>
                      <div className="text-[11px] text-gray-500">{u.email}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        u.role === 'ContentManager' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                        u.is_active ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {u.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        u.setup_status === 'INVITED' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {u.setup_status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 text-[11px]">
                      {u.role === 'ContentManager'
                        ? `${u.content_published_count || 0} published items`
                        : `${u.tickets_handled_count || 0} replies sent`
                      }
                    </td>
                    <td className="p-4 text-gray-500 text-[11px]">
                      {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                    </td>
                    <td className="p-4 text-right space-x-1">
                      {u.setup_status === 'INVITED' && (
                        <button
                          onClick={() => handleResendInvitation(u)}
                          title="Resend Invitation Link"
                          className="p-1.5 hover:bg-gray-100 text-amber-600 rounded-lg"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleResetAccess(u)}
                        title="Reset Access & Issue New Token"
                        className="p-1.5 hover:bg-gray-100 text-indigo-600 rounded-lg"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRevokeSessions(u)}
                        title="Revoke Active Sessions"
                        className="p-1.5 hover:bg-gray-100 text-rose-600 rounded-lg"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${
                          u.is_active ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">Provision Global Platform Staff</h3>
            <p className="text-xs text-gray-500">
              An invitation email containing a 1-click password setup link will be dispatched to the staff member.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Staff Member Name *</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="staff@eduman.africa"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Assigned Role *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="ContentManager">ContentManager (Educational Content)</option>
                  <option value="SupportOfficer">SupportOfficer (Help Center & Ticketing)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Provision Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
