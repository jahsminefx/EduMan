import React, { useState, useEffect } from 'react';
import { BarChart3, FileSpreadsheet, ShieldAlert, RefreshCw } from 'lucide-react';
import axios from 'axios';
import API_URL from '../../config/api';

export default function FinancialReportsPage() {
  const [reports, setReports] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [repRes, auditRes] = await Promise.all([
        axios.get(`${API_URL}/finance/reports`),
        axios.get(`${API_URL}/finance/audit-logs`)
      ]);

      setReports(repRes.data);
      setAuditLogs(auditRes.data.auditLogs || []);
    } catch (err) {
      console.error('Failed to fetch financial reports:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" /> Financial Reports & Audit Trails
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Revenue collection summaries by category, class breakdown, and immutable financial audit trail.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition shadow-xs"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Loading financial reports...</div>
      ) : (
        <div className="space-y-6">
          {/* Class Revenue Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900">Revenue Breakdown by Class</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase">
                  <tr>
                    <th className="p-3">Class</th>
                    <th className="p-3">Expected Revenue</th>
                    <th className="p-3">Collected Revenue</th>
                    <th className="p-3">Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {reports?.byClass?.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="p-3 font-bold text-gray-900">{row.class_name || 'Unassigned'}</td>
                      <td className="p-3 font-bold text-gray-900">₦{parseFloat(row.expected || 0).toLocaleString()}</td>
                      <td className="p-3 font-bold text-green-700">₦{parseFloat(row.collected || 0).toLocaleString()}</td>
                      <td className="p-3 font-bold text-amber-700">₦{parseFloat(row.outstanding || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Immutable Audit Trail */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-600" /> Immutable Financial Audit Log
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Entity</th>
                    <th className="p-3">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="p-3 text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="p-3 font-semibold text-gray-900">{log.user_name || 'System'} ({log.user_role || 'Staff'})</td>
                      <td className="p-3 font-bold text-indigo-600">{log.action}</td>
                      <td className="p-3 text-gray-600">{log.entity_type} #{log.entity_id}</td>
                      <td className="p-3 text-gray-700">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
