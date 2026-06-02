import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Image as ImageIcon, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import API_URL from '../../config/api';

const EMPTY_FORM = {
  title: '',
  content: '',
  featured_image: '',
  status: 'Draft'
};

function formatDate(value) {
  if (!value) return 'Draft';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

export default function AnnouncementManage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/announcements`, {
        params: user.role === 'Teacher' ? { mine: true } : {}
      });
      setAnnouncements(res.data.announcements || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleEdit = (announcement) => {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title || '',
      content: announcement.content || '',
      featured_image: announcement.featured_image || '',
      status: announcement.status || 'Draft'
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      if (editingId) {
        await axios.put(`${API_URL}/announcements/${editingId}`, form);
        setMessage('Announcement updated successfully.');
      } else {
        await axios.post(`${API_URL}/announcements`, form);
        setMessage('Announcement created successfully.');
      }
      resetForm();
      await fetchAnnouncements();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to save announcement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (announcement) => {
    const confirmed = window.confirm(`Delete "${announcement.title}"?`);
    if (!confirmed) return;

    setError('');
    setMessage('');
    try {
      await axios.delete(`${API_URL}/announcements/${announcement.id}`);
      setMessage('Announcement deleted successfully.');
      if (editingId === announcement.id) resetForm();
      await fetchAnnouncements();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to delete announcement.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/announcements" className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Link>
          <h2 className="text-2xl font-black text-gray-900">Manage Announcements</h2>
        </div>
        <button
          onClick={resetForm}
          className="inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          New
        </button>
      </div>

      {message && (
        <div className="p-4 bg-green-50 text-green-800 rounded-lg border border-green-100 text-sm font-medium">
          {message}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 text-red-800 rounded-lg border border-red-100 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(event) => handleChange('title', event.target.value)}
              className="w-full rounded-md border border-gray-300 p-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Featured Image URL</label>
            <div className="relative">
              <ImageIcon className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={form.featured_image}
                onChange={(event) => handleChange('featured_image', event.target.value)}
                className="w-full rounded-md border border-gray-300 p-2.5 pl-10 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                placeholder="https://"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Content</label>
            <textarea
              value={form.content}
              onChange={(event) => handleChange('content', event.target.value)}
              className="w-full min-h-[220px] rounded-md border border-gray-300 p-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              {['Draft', 'Published'].map(status => (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleChange('status', status)}
                  className={`px-4 py-2 text-sm font-bold rounded-md transition ${
                    form.status === status ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-70"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>

        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Workspace</h3>
          {loading ? (
            <div className="text-sm text-gray-500 text-center py-6">Loading...</div>
          ) : announcements.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">No announcements yet.</div>
          ) : (
            <div className="space-y-3">
              {announcements.map(announcement => (
                <div key={announcement.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 truncate">{announcement.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">{announcement.status} - {formatDate(announcement.published_at || announcement.updated_at)}</p>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                      announcement.status === 'Published' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {announcement.status}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleEdit(announcement)}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(announcement)}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-md bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
