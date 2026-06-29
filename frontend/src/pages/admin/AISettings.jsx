import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle, Save, Settings } from 'lucide-react';
import API_URL from '../../config/api';

export default function AISettings() {
  const [form, setForm] = useState({ model: 'openai/gpt-4o', daily_teacher_limit: 10, is_enabled: true });
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    axios.get(`${API_URL}/ai/admin/settings`)
      .then(response => {
        setForm({
          model: response.data.settings.model,
          daily_teacher_limit: response.data.settings.daily_teacher_limit,
          is_enabled: response.data.settings.is_enabled,
        });
        setApiKeyConfigured(response.data.settings.api_key_configured);
      })
      .catch(error => setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to load EduMan AI settings.' }))
      .finally(() => setLoading(false));
  }, []);

  const save = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await axios.put(`${API_URL}/ai/admin/settings`, form);
      setForm(response.data.settings);
      setMessage({ type: 'success', text: response.data.message });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to save EduMan AI settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading EduMan AI settings...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><Settings className="h-5 w-5 text-violet-600" /> EduMan AI Settings</h2>
        <p className="mt-1 text-sm text-gray-500">Configure the model and school-level teacher usage policy. API keys remain server-side.</p>
      </div>

      {message.text && (
        <div className={`flex items-center rounded-xl border p-4 text-sm ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {message.type === 'error' ? <AlertCircle className="mr-2 h-5 w-5" /> : <CheckCircle className="mr-2 h-5 w-5" />}{message.text}
        </div>
      )}

      <div className={`rounded-xl border p-4 text-sm ${apiKeyConfigured ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
        OpenRouter API key: <strong>{apiKeyConfigured ? 'configured on the backend' : 'not configured'}</strong>. The key is never returned to this page.
      </div>

      <form onSubmit={save} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700">
          OpenRouter model
          <input required value={form.model} onChange={event => setForm({ ...form, model: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5" placeholder="openai/gpt-4o" />
          <span className="mt-1 block text-xs text-gray-400">Use an OpenRouter model slug that supports structured outputs.</span>
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Daily generation limit per teacher
          <input type="number" min="1" max="500" required value={form.daily_teacher_limit} onChange={event => setForm({ ...form, daily_teacher_limit: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5" />
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-4">
          <input type="checkbox" checked={form.is_enabled} onChange={event => setForm({ ...form, is_enabled: event.target.checked })} />
          <span><strong className="block text-sm text-gray-900">Enable EduMan AI generation</strong><span className="text-xs text-gray-500">When disabled, teachers can still access saved drafts and published resources.</span></span>
        </label>
        <button disabled={saving} className="inline-flex items-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"><Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save EduMan AI Settings'}</button>
      </form>
    </div>
  );
}
