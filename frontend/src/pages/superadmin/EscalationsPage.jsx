import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../config/api';
import { AlertTriangle, Clock, LifeBuoy, UserCheck, CheckCircle2 } from 'lucide-react';

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/superadmin/escalations`)
      .then(res => setEscalations(res.data.escalations || []))
      .catch(err => setError(err.response?.data?.message || 'Failed to load escalation queue.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-7 h-7 text-amber-600" />
          Dedicated Support Escalation Queue
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          SuperAdmin queue monitoring urgent support tickets, SLA breaches, and unassigned escalations.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-gray-500">Loading escalation queue...</div>
        ) : escalations.length === 0 ? (
          <div className="p-8 text-center text-xs text-emerald-600 font-medium bg-emerald-50/50">
            ✅ Escalation queue is clear! No urgent or SLA-breached tickets require attention.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase border-b border-gray-100">
                <tr>
                  <th className="p-4">Ticket</th>
                  <th className="p-4">Submitted By</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Assigned Staff</th>
                  <th className="p-4">SLA Status</th>
                  <th className="p-4">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {escalations.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">#{t.id} - {t.subject}</div>
                      <div className="text-[11px] text-gray-500">{t.category || 'General Support'}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{t.creator_name}</div>
                      <div className="text-[11px] text-gray-500">{t.creator_role}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        t.priority === 'URGENT' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700">
                      {t.assigned_name || <span className="text-rose-600 font-bold italic">Unassigned</span>}
                    </td>
                    <td className="p-4">
                      {t.is_sla_breached ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                          SLA Breached
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium">Within SLA</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-500 text-[11px]">
                      {new Date(t.updated_at).toLocaleString()}
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
