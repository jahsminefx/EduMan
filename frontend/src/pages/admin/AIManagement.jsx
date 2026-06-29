import { createElement, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, Bot, CheckCircle, FileClock, Gauge, Settings, Sparkles } from 'lucide-react';
import API_URL from '../../config/api';

export default function AIManagement() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/ai/admin/overview`)
      .then(response => setData(response.data))
      .catch(error => setMessage(error.response?.data?.message || 'Unable to load EduMan AI management.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading EduMan AI management...</div>;
  if (!data) return <div className="rounded-xl bg-red-50 p-4 text-red-700">{message}</div>;

  const stats = [
    ['Generations Today', data.overview.today, Sparkles, 'bg-violet-600'],
    ['All Generations', data.overview.total, Gauge, 'bg-blue-600'],
    ['Drafts Awaiting Review', data.overview.drafts, FileClock, 'bg-amber-500'],
    ['Published Resources', data.overview.published, CheckCircle, 'bg-emerald-600'],
    ['Failed Requests', data.overview.failed, AlertTriangle, 'bg-red-500'],
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><Bot className="h-5 w-5 text-violet-600" /> EduMan AI Management</h2>
        <p className="mt-1 text-sm text-gray-500">Monitor EduMan AI adoption, configuration, and teacher review workflows.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value, Icon, color]) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${color}`}>{createElement(Icon, { className: 'h-5 w-5' })}</div>
            <p className="mt-4 text-2xl font-black text-gray-900">{value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Link to="/dashboard/admin/ai/usage" className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
          <Gauge className="h-6 w-6 text-blue-600" />
          <h3 className="mt-4 text-lg font-bold text-gray-900">EduMan AI Usage Logs</h3>
          <p className="mt-2 text-sm text-gray-500">Review prompts, provider responses, token usage, failures, teachers, classes, and subjects.</p>
          <span className="mt-4 inline-block text-sm font-bold text-blue-600">Open logs →</span>
        </Link>
        <Link to="/dashboard/admin/ai/settings" className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
          <Settings className="h-6 w-6 text-violet-600" />
          <h3 className="mt-4 text-lg font-bold text-gray-900">EduMan AI Settings</h3>
          <p className="mt-2 text-sm text-gray-500">Choose the OpenRouter model, daily teacher limit, and whether generation is enabled.</p>
          <span className="mt-4 inline-block text-sm font-bold text-violet-600">Configure EduMan AI →</span>
        </Link>
      </div>

      <div className={`rounded-xl border p-4 text-sm ${data.settings.api_key_configured ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
        <strong>OpenRouter:</strong> {data.settings.api_key_configured ? 'server key configured' : 'server key missing'} • Model: {data.settings.model} • Daily limit: {data.settings.daily_teacher_limit} per teacher • {data.settings.is_enabled ? 'Enabled' : 'Disabled'}
      </div>
    </div>
  );
}
