import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../../config/api';
import {
  Building2, Users, AlertTriangle, LifeBuoy, FileText, CheckCircle2,
  Server, Shield, Search, ArrowRight, Activity, HelpCircle
} from 'lucide-react';

export default function SuperAdminCommandCenter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/superadmin/command-center`)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load command center data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-gray-500">Loading Platform Command Center...</div>;
  }

  const platform = data?.platform || {};
  const operations = data?.operations || {};
  const health = data?.systemHealth || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-indigo-600" />
            Platform Command Center
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Global ecosystem metrics, operational alerts, and system health oversight.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/superadmin/platform-staff"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Platform Staff
          </Link>
          <Link
            to="/superadmin/user-search"
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Global User Search
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* ── 1. PLATFORM METRICS GRID ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Platform Ecosystem Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="text-xs font-semibold text-gray-500 flex items-center justify-between">
              Total Schools
              <Building2 className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-gray-900">{platform.totalSchools}</div>
            <div className="text-[11px] text-emerald-600 font-bold">{platform.activeSchools} Active • {platform.suspendedSchools} Suspended</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="text-xs font-semibold text-gray-500 flex items-center justify-between">
              Enrolled Students
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-gray-900">{platform.totalStudents}</div>
            <div className="text-[11px] text-gray-500">Across all institutions</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="text-xs font-semibold text-gray-500 flex items-center justify-between">
              Teaching Faculty
              <Users className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-black text-gray-900">{platform.totalTeachers}</div>
            <div className="text-[11px] text-gray-500">Active instructors</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="text-xs font-semibold text-gray-500 flex items-center justify-between">
              Global Platform Staff
              <Shield className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-gray-900">{platform.totalGlobalStaff}</div>
            <div className="text-[11px] text-amber-600 font-bold">ContentManagers & SupportOfficers</div>
          </div>
        </div>
      </div>

      {/* ── 2. OPERATIONAL ALERTS ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Operational Alerts & Escalations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/superadmin/escalations"
            className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-indigo-500 transition shadow-xs flex items-center justify-between group"
          >
            <div className="space-y-1">
              <div className="text-xs font-bold text-gray-500 uppercase">Support Escalations</div>
              <div className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>{operations.urgentTickets} Urgent</span>
                {operations.slaBreachedTickets > 0 && (
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px]">
                    {operations.slaBreachedTickets} SLA Breached
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500">{operations.openTickets} total open support tickets</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition" />
          </Link>

          <Link
            to="/support/inbox"
            className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-indigo-500 transition shadow-xs flex items-center justify-between group"
          >
            <div className="space-y-1">
              <div className="text-xs font-bold text-gray-500 uppercase">Contact Inquiries</div>
              <div className="text-xl font-bold text-gray-900">{operations.newInquiries} New Inquiries</div>
              <p className="text-[11px] text-gray-500">Unanswered website contact forms</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition" />
          </Link>

          <Link
            to="/content/library"
            className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-indigo-500 transition shadow-xs flex items-center justify-between group"
          >
            <div className="space-y-1">
              <div className="text-xs font-bold text-gray-500 uppercase">Content Library</div>
              <div className="text-xl font-bold text-gray-900">{operations.pendingContent} Pending Items</div>
              <p className="text-[11px] text-gray-500">Draft educational materials</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition" />
          </Link>
        </div>
      </div>

      {/* ── 3. SYSTEM HEALTH & NAVIGATION QUICK LINKS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-600" />
            System Infrastructure Health
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
              <span className="text-gray-600 font-medium">Database Status</span>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                {health.databaseStatus}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
              <span className="text-gray-600 font-medium">SMTP Email Dispatch</span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                health.smtpStatus === 'CONFIGURED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {health.smtpStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Platform Control Links
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <Link to="/superadmin/schools" className="p-3 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 rounded-xl font-bold text-indigo-900 transition">
              Manage Institutions
            </Link>
            <Link to="/superadmin/admins" className="p-3 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 rounded-xl font-bold text-indigo-900 transition">
              School Admins
            </Link>
            <Link to="/superadmin/audit-logs" className="p-3 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 rounded-xl font-bold text-indigo-900 transition">
              Audit Logs
            </Link>
            <Link to="/superadmin/settings" className="p-3 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 rounded-xl font-bold text-indigo-900 transition">
              Platform Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
