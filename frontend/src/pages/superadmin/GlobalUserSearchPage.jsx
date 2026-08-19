import React, { useState } from 'react';
import axios from 'axios';
import API_URL from '../../config/api';
import { Search, Users, Shield, Building2, Calendar, CheckCircle2, XCircle } from 'lucide-react';

export default function GlobalUserSearchPage() {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || query.trim().length < 2) {
      setError('Please enter at least 2 characters to search.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const params = { q: query.trim() };
      if (roleFilter) params.role = roleFilter;
      if (statusFilter !== '') params.status = statusFilter;
      const res = await axios.get(`${API_URL}/superadmin/users/search`, { params });
      setUsers(res.data.users || []);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to search users.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Search className="w-7 h-7 text-indigo-600" />
          Global User Search
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Search users across all roles and multi-tenant schools in the EduMan ecosystem.
        </p>
      </div>

      <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              required
              placeholder="Search by name, email, or school name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Roles</option>
              <option value="SuperAdmin">SuperAdmin</option>
              <option value="SchoolAdmin">SchoolAdmin</option>
              <option value="ContentManager">ContentManager</option>
              <option value="SupportOfficer">SupportOfficer</option>
              <option value="Teacher">Teacher</option>
              <option value="Student">Student</option>
              <option value="Parent">Parent</option>
              <option value="Accountant">Accountant</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Searching...' : 'Search System'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* Results Table */}
      {searched && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
          {users.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 italic">No users found matching query "{query}".</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase border-b border-gray-100">
                  <tr>
                    <th className="p-4">User</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Assigned Institution</th>
                    <th className="p-4">Account Status</th>
                    <th className="p-4">Last Login</th>
                    <th className="p-4">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/50">
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{u.name}</div>
                        <div className="text-[11px] text-gray-500">{u.email}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          <span>{u.school_name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                          u.is_active ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {u.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 text-[11px]">
                        {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                      </td>
                      <td className="p-4 text-gray-500 text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
