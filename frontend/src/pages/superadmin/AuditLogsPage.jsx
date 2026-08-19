import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../config/api';
import { Shield, FileText, User, Calendar, AlertCircle } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/superadmin/audit-logs`)
      .then(res => setLogs(res.data.auditLogs || []))
      .catch(err => setError(err.response?.data?.message || 'Failed to load audit logs.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-7 h-7 text-indigo-600" />
          SuperAdmin Audit Trail
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Append-only audit trail logging all sensitive platform administration actions.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-gray-500">Loading audit records...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 italic">No audit records logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase border-b border-gray-100">
                <tr>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Admin Actor</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Target</th>
                  <th className="p-4">Details & Reason</th>
                  <th className="p-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/50">
                    <td className="p-4 text-gray-500 text-[11px]">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{l.actor_name}</div>
                      <div className="text-[11px] text-gray-500">{l.actor_email}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        {l.action}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700">
                      {l.target_type} #{l.target_id || 'N/A'}
                    </td>
                    <td className="p-4 text-gray-800">
                      <div>{l.details}</div>
                      {l.reason && (
                        <div className="text-[11px] text-amber-700 font-medium mt-0.5 italic">
                          Reason: {l.reason}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-gray-400 font-mono text-[11px]">
                      {l.ip_address}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
