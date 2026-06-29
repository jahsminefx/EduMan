import { Fragment, useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import API_URL from '../../config/api';
import { displayLabel } from '../ai/aiUtils';

export default function AIUsageLogs() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ status: '', generation_type: '' });
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/ai/admin/usage`, { params: { ...filters, limit: 100 } });
      setLogs(response.data.logs || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to load EduMan AI usage logs.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><History className="h-5 w-5 text-blue-600" /> EduMan AI Usage Logs</h2>
        <p className="mt-1 text-sm text-gray-500">Audit every EduMan AI prompt, response, model, token count, and failure.</p>
      </div>
      {message && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{message}</div>}

      <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })} className="rounded-lg border border-gray-300 bg-white p-2 text-sm">
          <option value="">All statuses</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="pending">Pending</option>
        </select>
        <select value={filters.generation_type} onChange={event => setFilters({ ...filters, generation_type: event.target.value })} className="rounded-lg border border-gray-300 bg-white p-2 text-sm">
          <option value="">All generation types</option><option value="quiz">Quiz</option><option value="learning_content">Learning Content</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? <div className="p-8 text-center text-gray-500">Loading usage logs...</div> : logs.length === 0 ? <div className="p-8 text-center text-gray-500">No EduMan AI usage found.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr>{['Teacher', 'Type', 'Class / Subject', 'Model', 'Tokens', 'Status', 'Date', ''].map(label => <th key={label} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => (
                  <Fragment key={log.id}>
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="text-sm font-semibold text-gray-900">{log.teacher_name}</p><p className="text-xs text-gray-400">{log.teacher_email}</p></td>
                      <td className="px-4 py-3 text-sm text-gray-700">{displayLabel(log.generation_type)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{log.class_name}<br /><span className="text-xs text-gray-400">{log.subject_name}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-600">{log.model}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{log.total_tokens || 0}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${log.status === 'completed' ? 'bg-green-50 text-green-700' : log.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{log.status}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3"><button onClick={() => setExpanded(expanded === log.id ? null : log.id)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">{expanded === log.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button></td>
                    </tr>
                    {expanded === log.id && (
                      <tr key={`${log.id}-detail`}>
                        <td colSpan="8" className="bg-gray-50 px-5 py-4">
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <div><p className="mb-2 text-xs font-bold uppercase text-gray-500">Prompt</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-xs text-gray-700">{log.prompt}</pre></div>
                            <div><p className="mb-2 text-xs font-bold uppercase text-gray-500">Response / Error</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-xs text-gray-700">{log.error_message || log.response || 'No response saved.'}</pre></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
