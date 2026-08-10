import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Clock, 
  CheckCircle2, 
  Building2, 
  Users, 
  Tag, 
  TrendingUp, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import API_URL from '../../config/api';

export default function SupportAnalytics() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/support/analytics`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to load support analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center text-gray-400 text-sm flex flex-col items-center justify-center gap-2">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="font-semibold text-gray-700">Loading Support Analytics...</p>
      </div>
    );
  }

  const counts = data?.counts || {};
  const metrics = data?.metrics || {};
  const ticketsPerSchool = data?.ticketsPerSchool || [];
  const categoryCounts = data?.categoryCounts || [];
  const agentStats = data?.agentStats || [];

  const formatMins = (mins) => {
    if (!mins || isNaN(mins)) return '0m';
    if (mins < 60) return `${mins} mins`;
    const hrs = (mins / 60).toFixed(1);
    return `${hrs} hrs`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" /> Support Analytics & Metrics
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">Response time KPIs, ticket volume per school, and agent performance</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Volume</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3">{metrics.totalTickets || 0}</p>
          <p className="text-xs text-blue-600 font-medium mt-1">Submitted support tickets</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Avg First Response</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3">{formatMins(metrics.avgFirstResponseMins)}</p>
          <p className="text-xs text-indigo-600 font-medium mt-1">Time to initial agent reply</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Avg Resolution Time</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3">{formatMins(metrics.avgResolutionMins)}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Time to resolve issue</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Open</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3">{(counts.OPEN || 0) + (counts.WAITING_FOR_CUSTOMER || 0)}</p>
          <p className="text-xs text-amber-600 font-medium mt-1">Currently active threads</p>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tickets Per School */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" /> Tickets Per School (Top 10)
          </h3>

          <div className="space-y-3">
            {ticketsPerSchool.length === 0 ? (
              <p className="text-xs text-gray-400">No school ticket data available.</p>
            ) : (
              ticketsPerSchool.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-800">{item.school_name}</span>
                    <span className="text-blue-600 font-bold">{item.ticket_count} tickets</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (parseInt(item.ticket_count) / (metrics.totalTickets || 1)) * 100 * 2)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Most Common Categories */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-600" /> Most Common Categories
          </h3>

          <div className="space-y-3">
            {categoryCounts.length === 0 ? (
              <p className="text-xs text-gray-400">No category breakdown data available.</p>
            ) : (
              categoryCounts.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                  <span className="font-semibold text-gray-800">{item.category}</span>
                  <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                    {item.count} tickets
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
