import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Inbox, 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  UserCheck, 
  Tag, 
  Clock, 
  Building2, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  Layers
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import API_URL from '../../config/api';

export default function EnterpriseInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [threads, setThreads] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [loading, setLoading] = useState(true);

  // Tabs: OPEN, ASSIGNED, WAITING, RESOLVED, CLOSED, ALL
  const [activeTab, setActiveTab] = useState('OPEN');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [executingBulk, setExecutingBulk] = useState(false);

  const fetchInboxTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      params.set('filterTab', activeTab);
      if (search.trim()) params.set('search', search.trim());

      const res = await axios.get(`${API_URL}/support/tickets?${params.toString()}`);
      setThreads(res.data.threads || []);
      setPagination(res.data.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 });
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to load inbox tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInboxTickets();
  }, [activeTab, page]);

  const handleSelectAll = () => {
    if (selectedIds.length === threads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(threads.map(t => t.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleExecuteBulk = async () => {
    if (selectedIds.length === 0 || !bulkAction || !bulkValue) return;
    try {
      setExecutingBulk(true);
      await axios.post(`${API_URL}/support/bulk`, {
        threadIds: selectedIds,
        action: bulkAction,
        value: bulkValue
      });
      setBulkAction('');
      setBulkValue('');
      fetchInboxTickets();
    } catch (err) {
      console.error('Failed to execute bulk operation:', err);
    } finally {
      setExecutingBulk(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Inbox className="w-6 h-6 text-blue-600" /> Enterprise Support Inbox
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">Cross-school support ticket triage & response management</p>
        </div>
      </div>

      {/* Main Workspace Tabs + Search */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-4 sm:p-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-100 pb-3">
          {[
            { key: 'OPEN', label: 'Open' },
            { key: 'ASSIGNED', label: 'Assigned to Me' },
            { key: 'WAITING', label: 'Waiting for Customer' },
            { key: 'RESOLVED', label: 'Resolved' },
            { key: 'CLOSED', label: 'Closed' },
            { key: 'ALL', label: 'All Tickets' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Bulk Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchInboxTickets(); }} className="w-full sm:w-80 relative">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ticket, school, user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl bg-gray-50/50"
            />
          </form>

          {/* Bulk operations toolbar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 p-2 rounded-xl text-xs w-full sm:w-auto">
              <span className="font-bold text-blue-800">{selectedIds.length} selected</span>
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="px-2 py-1 border rounded-lg bg-white text-xs"
              >
                <option value="">Bulk Action...</option>
                <option value="change_status">Change Status</option>
                <option value="change_priority">Change Priority</option>
              </select>

              {bulkAction === 'change_status' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="px-2 py-1 border rounded-lg bg-white text-xs"
                >
                  <option value="">Select Status...</option>
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              )}

              {bulkAction === 'change_priority' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="px-2 py-1 border rounded-lg bg-white text-xs"
                >
                  <option value="">Select Priority...</option>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              )}

              <button
                onClick={handleExecuteBulk}
                disabled={executingBulk || !bulkAction || !bulkValue}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Tickets Table */}
        <div className="overflow-x-auto border border-gray-100 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={threads.length > 0 && selectedIds.length === threads.length}
                    onChange={handleSelectAll}
                    className="rounded text-blue-600"
                  />
                </th>
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-4">School</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned To</th>
                <th className="py-3 px-4">Last Reply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">Loading inbox...</td>
                </tr>
              ) : threads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">No tickets found in this tab.</td>
                </tr>
              ) : (
                threads.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        className="rounded text-blue-600"
                      />
                    </td>
                    <td className="py-3 px-4 font-bold text-blue-600" onClick={() => navigate(`/dashboard/support/tickets/${t.id}`)}>
                      {t.ticket_number}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900" onClick={() => navigate(`/dashboard/support/tickets/${t.id}`)}>
                      {t.school_name || 'Global'}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800 max-w-xs truncate" onClick={() => navigate(`/dashboard/support/tickets/${t.id}`)}>
                      {t.subject}
                    </td>
                    <td className="py-3 px-4" onClick={() => navigate(`/dashboard/support/tickets/${t.id}`)}>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                        t.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                        t.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4" onClick={() => navigate(`/dashboard/support/tickets/${t.id}`)}>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        t.status === 'OPEN' ? 'bg-blue-600 text-white' :
                        t.status === 'RESOLVED' ? 'bg-emerald-600 text-white' : 'bg-gray-600 text-white'
                      }`}>
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium" onClick={() => navigate(`/dashboard/support/tickets/${t.id}`)}>
                      {t.agent_name || <span className="text-gray-400 italic">Unassigned</span>}
                    </td>
                    <td className="py-3 px-4 text-gray-400" onClick={() => navigate(`/dashboard/support/tickets/${t.id}`)}>
                      {new Date(t.last_reply_at || t.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
