import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  PlusCircle, 
  BookOpen, 
  BarChart3, 
  ArrowRight, 
  MessageSquare, 
  Sparkles,
  Inbox,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import API_URL from '../../config/api';

export default function SupportDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = ['SuperAdmin', 'SupportOfficer'].includes(user.role);
  const [stats, setStats] = useState({
    counts: { OPEN: 0, WAITING_FOR_CUSTOMER: 0, RESOLVED: 0, CLOSED: 0 },
    recentActivity: [],
    recentThreads: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        if (isStaff) {
          const res = await axios.get(`${API_URL}/support/analytics`);
          setStats({
            counts: res.data.counts || {},
            recentActivity: res.data.recentActivity || [],
            recentThreads: []
          });
        } else {
          const res = await axios.get(`${API_URL}/support/tickets?limit=5`);
          const threads = res.data.threads || [];
          const counts = { OPEN: 0, WAITING_FOR_CUSTOMER: 0, RESOLVED: 0, CLOSED: 0 };
          threads.forEach(t => {
            if (counts[t.status] !== undefined) counts[t.status]++;
          });
          setStats({
            counts,
            recentActivity: [],
            recentThreads: threads
          });
        }
      } catch (err) {
        console.error('Failed to load support dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, [isStaff]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-md mb-3">
            <Sparkles className="w-3.5 h-3.5" /> EDUMAN Integrated Support Workspace
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {isStaff ? 'Enterprise Support Command Center' : `Welcome to Support, ${user.name}`}
          </h1>
          <p className="mt-2 text-blue-100 text-sm leading-relaxed">
            {isStaff 
              ? 'Manage multi-tenant support tickets, assign support staff, monitor customer satisfaction, and access response analytics.'
              : 'Submit questions, track issue status in real-time, and search our Knowledge Base for quick self-service answers.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {user.role !== 'Student' && (
              <button
                onClick={() => navigate('/dashboard/support/tickets/new')}
                className="px-5 py-2.5 bg-white text-blue-600 font-semibold rounded-xl text-xs sm:text-sm hover:bg-blue-50 transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" /> Create Support Ticket
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard/support/kb')}
              className="px-5 py-2.5 bg-white/15 text-white font-semibold rounded-xl text-xs sm:text-sm hover:bg-white/25 transition-all backdrop-blur-md active:scale-95 flex items-center gap-2 border border-white/20"
            >
              <BookOpen className="w-4 h-4" /> Browse Help Center
            </button>
            {isStaff && (
              <button
                onClick={() => navigate('/dashboard/support/inbox')}
                className="px-5 py-2.5 bg-indigo-500/40 text-white font-semibold rounded-xl text-xs sm:text-sm hover:bg-indigo-500/60 transition-all backdrop-blur-md active:scale-95 flex items-center gap-2 border border-white/20"
              >
                <Inbox className="w-4 h-4" /> Enterprise Inbox
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Open Tickets</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3">{stats.counts.OPEN || 0}</p>
          <p className="text-xs text-blue-600 font-medium mt-1">Needs attention</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Waiting</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3">{stats.counts.WAITING_FOR_CUSTOMER || 0}</p>
          <p className="text-xs text-amber-600 font-medium mt-1">Awaiting customer reply</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resolved</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3">{stats.counts.RESOLVED || 0}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Ready for confirmation</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Closed</span>
            <div className="p-2 bg-gray-50 text-gray-600 rounded-xl">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3">{stats.counts.CLOSED || 0}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Completed tickets</p>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Tickets / Activity Stream */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                {isStaff ? 'Recent Activity Log Stream' : 'Recent Support Tickets'}
              </h2>
              <Link 
                to={isStaff ? "/dashboard/support/inbox" : "/dashboard/support/tickets"}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-400 text-sm">Loading activity...</div>
            ) : isStaff ? (
              stats.recentActivity.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">No recent activity logged yet.</div>
              ) : (
                <div className="space-y-3">
                  {stats.recentActivity.map((act) => (
                    <div key={act.id} className="p-3.5 rounded-xl bg-gray-50 flex items-start gap-3 border border-gray-100">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg flex-shrink-0 text-xs font-bold">
                        #{act.ticket_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-900">{act.action}</span>
                          <span className="text-[10px] text-gray-400">{new Date(act.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{act.details || 'System log event'}</p>
                        <p className="text-[10px] text-gray-400 mt-1">By: {act.user_name || 'System'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              stats.recentThreads.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Ticket className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-700">No Support Tickets Yet</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    Have a technical question or issue with student records? Create your first support ticket now.
                  </p>
                  <button
                    onClick={() => navigate('/dashboard/support/tickets/new')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-all inline-flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" /> Create Ticket
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {stats.recentThreads.map((thread) => (
                    <div
                      key={thread.id}
                      onClick={() => navigate(`/dashboard/support/tickets/${thread.id}`)}
                      className="py-3.5 hover:bg-gray-50/80 px-3 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                            {thread.ticket_number}
                          </span>
                          <span className="text-xs font-medium text-gray-500">{thread.category}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{thread.subject}</h3>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                          thread.status === 'OPEN' ? 'bg-blue-100 text-blue-700' :
                          thread.status === 'WAITING_FOR_CUSTOMER' ? 'bg-amber-100 text-amber-700' :
                          thread.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {thread.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Right 1 Col: Quick Help & Help Center Shortcuts */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Popular Help Center Articles
            </h2>
            <div className="space-y-2.5 text-xs">
              <Link 
                to="/dashboard/support/kb/getting-started-with-eduman"
                className="block p-3 rounded-xl bg-gray-50 hover:bg-blue-50/60 hover:text-blue-700 font-medium transition-all text-gray-700 border border-gray-100"
              >
                📖 Getting Started with EDUMAN Support
              </Link>
              <Link 
                to="/dashboard/support/kb/how-to-add-manage-students-in-bulk"
                className="block p-3 rounded-xl bg-gray-50 hover:bg-blue-50/60 hover:text-blue-700 font-medium transition-all text-gray-700 border border-gray-100"
              >
                📊 How to Add & Manage Students in Bulk
              </Link>
              <Link 
                to="/dashboard/support/kb/generating-quizzes-with-eduman-ai"
                className="block p-3 rounded-xl bg-gray-50 hover:bg-blue-50/60 hover:text-blue-700 font-medium transition-all text-gray-700 border border-gray-100"
              >
                🤖 Generating Quizzes with EduMan AI
              </Link>
              <Link 
                to="/dashboard/support/kb/troubleshooting-login-and-file-uploads"
                className="block p-3 rounded-xl bg-gray-50 hover:bg-blue-50/60 hover:text-blue-700 font-medium transition-all text-gray-700 border border-gray-100"
              >
                🛠️ Troubleshooting File Uploads
              </Link>
            </div>

            {isStaff && (
              <div className="pt-2 border-t border-gray-100">
                <Link
                  to="/dashboard/support/analytics"
                  className="w-full py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors"
                >
                  <BarChart3 className="w-4 h-4" /> Open Support Analytics
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
