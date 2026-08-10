import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  PlusCircle, 
  Ticket, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  Building2,
  User,
  Clock,
  AlertTriangle,
  Tag
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import API_URL from '../../config/api';

const CATEGORIES = [
  'All Categories',
  'General Question',
  'Bug Report',
  'Student Management',
  'Teacher Management',
  'Attendance',
  'Results',
  'Report Cards',
  'Timetable',
  'Library',
  'AI Assistant',
  'Billing',
  'Account',
  'Feature Request',
  'Technical Support',
  'Other'
];

export default function TicketList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [threads, setThreads] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'All Categories');
  const [priority, setPriority] = useState(searchParams.get('priority') || 'ALL');
  const [status, setStatus] = useState(searchParams.get('status') || 'ALL');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '12');
      if (search.trim()) params.set('search', search.trim());
      if (category !== 'All Categories') params.set('category', category);
      if (priority !== 'ALL') params.set('priority', priority);
      if (status !== 'ALL') params.set('status', status);

      const res = await axios.get(`${API_URL}/support/tickets?${params.toString()}`);
      setThreads(res.data.threads || []);
      setPagination(res.data.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 });
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [page, category, priority, status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTickets();
  };

  const getPriorityColor = (p) => {
    switch (p) {
      case 'CRITICAL': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'HIGH': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'MEDIUM': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusColor = (s) => {
    switch (s) {
      case 'OPEN': return 'bg-blue-600 text-white';
      case 'IN_PROGRESS': return 'bg-indigo-600 text-white';
      case 'WAITING_FOR_CUSTOMER': return 'bg-amber-500 text-white';
      case 'RESOLVED': return 'bg-emerald-600 text-white';
      case 'CLOSED': return 'bg-gray-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Support Tickets</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {user.role === 'Teacher' ? 'Manage your support inquiries and technical requests' : 'View tickets created across your school'}
          </p>
        </div>
        {user.role !== 'Student' && (
          <button
            onClick={() => navigate('/dashboard/support/tickets/new')}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4" /> Create Ticket
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ticket number, subject, or school name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="px-3 py-2.5 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-hidden focus:border-blue-500 bg-white font-medium text-gray-700"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={priority}
              onChange={(e) => { setPriority(e.target.value); setPage(1); }}
              className="px-3 py-2.5 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-hidden focus:border-blue-500 bg-white font-medium text-gray-700"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>

            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="px-3 py-2.5 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-hidden focus:border-blue-500 bg-white font-medium text-gray-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors flex items-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
          </div>
        </form>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" /> Loading support tickets...
          </div>
        ) : threads.length === 0 ? (
          <div className="p-12 text-center">
            <Ticket className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h3 className="text-base font-bold text-gray-900">No Tickets Found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              There are no support tickets matching your current search and filter criteria.
            </p>
            {user.role !== 'Student' && (
              <button
                onClick={() => navigate('/dashboard/support/tickets/new')}
                className="mt-5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-all inline-flex items-center gap-2 shadow-sm"
              >
                <PlusCircle className="w-4 h-4" /> Create First Ticket
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="py-3.5 px-4">Ticket Number</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Last Reply</th>
                  <th className="py-3.5 px-4">Assigned Agent</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm text-gray-700">
                {threads.map((t) => (
                  <tr 
                    key={t.id}
                    onClick={() => navigate(`/dashboard/support/tickets/${t.id}`)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-bold text-blue-600 whitespace-nowrap">
                      {t.ticket_number}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900 max-w-xs truncate">
                      {t.subject}
                      {t.school_name && ['SuperAdmin', 'SupportOfficer'].includes(user.role) && (
                        <span className="block text-[11px] font-normal text-gray-400 truncate">
                          {t.school_name}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
                        <Tag className="w-3 h-3 text-gray-400" /> {t.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md border ${getPriorityColor(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${getStatusColor(t.status)}`}>
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(t.last_reply_at || t.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap font-medium">
                      {t.agent_name || <span className="text-gray-400 italic">Unassigned</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button className="px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded-lg text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        Open Thread
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">
              Showing page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} total tickets)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(prev => Math.min(pagination.totalPages, prev + 1))}
                className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
