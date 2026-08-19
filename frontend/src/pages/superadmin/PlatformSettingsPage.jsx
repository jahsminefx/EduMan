import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../config/api';
import { Settings, Save, ShieldAlert, CheckCircle2, Globe, Mail, Clock, HardDrive } from 'lucide-react';

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    axios.get(`${API_URL}/superadmin/settings`)
      .then(res => {
        const map = {};
        (res.data.settings || []).forEach(s => {
          map[s.setting_key] = s.setting_value;
        });
        setSettings(map);
      })
      .catch(err => setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load settings.' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await axios.put(`${API_URL}/superadmin/settings`, { settings });
      setMessage({ type: 'success', text: res.data.message || 'Platform settings updated successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update settings.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-gray-500">Loading platform settings...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-7 h-7 text-indigo-600" />
          Global Platform Settings
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Manage safe non-secret configuration variables across the EduMan platform.
        </p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600" />
            General Platform Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Platform Name</label>
              <input
                type="text"
                value={settings.platform_name || ''}
                onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Default Timezone</label>
              <input
                type="text"
                value={settings.timezone || ''}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Official Support Email</label>
              <input
                type="email"
                value={settings.support_email || ''}
                onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">General Inquiries Email</label>
              <input
                type="email"
                value={settings.contact_email || ''}
                onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-600" />
            Operational & Registration Flags
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Max Upload Limit (MB)</label>
              <input
                type="number"
                min="1"
                max="500"
                value={settings.max_upload_size_mb || '50'}
                onChange={(e) => setSettings({ ...settings, max_upload_size_mb: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Maintenance Mode</label>
              <select
                value={settings.maintenance_mode || 'false'}
                onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-bold"
              >
                <option value="false">Disabled (Normal Operations)</option>
                <option value="true">Enabled (Maintenance Banner)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Self-Service Registration</label>
              <select
                value={settings.registration_open || 'true'}
                onChange={(e) => setSettings({ ...settings, registration_open: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-bold"
              >
                <option value="true">Open</option>
                <option value="false">Closed (Invite Only)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {submitting ? 'Saving Settings...' : 'Save Platform Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}