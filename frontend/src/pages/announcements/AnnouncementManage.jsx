import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileText, Image as ImageIcon, Pencil, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import API_URL, { API_BASE_URL } from '../../config/api';

const EMPTY_FORM = {
  title: '',
  content: '',
  featured_image: '',
  attachment_path: '',
  attachment_name: '',
  attachment_type: '',
  status: 'Draft'
};

function mediaUrl(value) {
  if (!value) return '';
  return value.startsWith('/uploads/') ? `${API_BASE_URL}${value}` : value;
}

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
  const [featuredImageFile, setFeaturedImageFile] = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [removeFeaturedImage, setRemoveFeaturedImage] = useState(false);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
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
    setFeaturedImageFile(null);
    setAttachmentFile(null);
    setRemoveFeaturedImage(false);
    setRemoveAttachment(false);
    setFileInputKey(key => key + 1);
    setEditingId(null);
    setMessage('');
    setError('');
  };

  const handleEdit = (announcement) => {
    setEditingId(announcement.id);
    setMessage('');
    setError('');
    setForm({
      title: announcement.title || '',
      content: announcement.content || '',
      featured_image: announcement.featured_image || '',
      attachment_path: announcement.attachment_path || '',
      attachment_name: announcement.attachment_name || '',
      attachment_type: announcement.attachment_type || '',
      status: announcement.status || 'Draft'
    });
    setFeaturedImageFile(null);
    setAttachmentFile(null);
    setRemoveFeaturedImage(false);
    setRemoveAttachment(false);
    setFileInputKey(key => key + 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = new FormData();
      payload.append('title', form.title);
      payload.append('content', form.content);
      payload.append('status', form.status);
      payload.append('featured_image', form.featured_image || '');
      payload.append('remove_featured_image', removeFeaturedImage ? 'true' : 'false');
      payload.append('remove_attachment', removeAttachment ? 'true' : 'false');
      if (featuredImageFile) payload.append('featured_image_file', featuredImageFile);
      if (attachmentFile) payload.append('attachment_file', attachmentFile);

      if (editingId) {
        await axios.put(`${API_URL}/announcements/${editingId}`, payload);
        setMessage('Announcement updated successfully.');
      } else {
        await axios.post(`${API_URL}/announcements`, payload);
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Featured Image</label>
              <label className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center hover:border-blue-300 hover:bg-blue-50">
                <ImageIcon className="w-6 h-6 text-blue-600 mb-2" />
                <span className="text-sm font-bold text-gray-800">{featuredImageFile ? featuredImageFile.name : 'Upload picture or image'}</span>
                <span className="text-xs text-gray-500 mt-1">JPG, PNG, GIF, or WEBP</span>
                <input
                  key={`featured-${fileInputKey}`}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(event) => {
                    setFeaturedImageFile(event.target.files?.[0] || null);
                    setRemoveFeaturedImage(false);
                  }}
                  className="sr-only"
                />
              </label>
              {editingId && form.featured_image && !removeFeaturedImage && !featuredImageFile && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white p-3">
                  <a href={mediaUrl(form.featured_image)} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700 hover:underline truncate">
                    Current featured image
                  </a>
                  <button
                    type="button"
                    onClick={() => setRemoveFeaturedImage(true)}
                    className="text-red-600 hover:text-red-800"
                    aria-label="Remove current featured image"
                    title="Remove current featured image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Attachment</label>
              <label className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center hover:border-blue-300 hover:bg-blue-50">
                <Upload className="w-6 h-6 text-blue-600 mb-2" />
                <span className="text-sm font-bold text-gray-800">{attachmentFile ? attachmentFile.name : 'Upload image or document'}</span>
                <span className="text-xs text-gray-500 mt-1">Images, PDF, Word, Excel, PowerPoint, TXT</span>
                <input
                  key={`attachment-${fileInputKey}`}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf"
                  onChange={(event) => {
                    setAttachmentFile(event.target.files?.[0] || null);
                    setRemoveAttachment(false);
                  }}
                  className="sr-only"
                />
              </label>
              {editingId && form.attachment_path && !removeAttachment && !attachmentFile && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white p-3">
                  <a href={mediaUrl(form.attachment_path)} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center text-xs font-bold text-blue-700 hover:underline">
                    <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">{form.attachment_name || 'Current attachment'}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setRemoveAttachment(true)}
                    className="text-red-600 hover:text-red-800"
                    aria-label="Remove current attachment"
                    title="Remove current attachment"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
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
                  {announcement.attachment_path && (
                    <a
                      href={mediaUrl(announcement.attachment_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex max-w-full items-center text-xs font-bold text-blue-700 hover:underline"
                    >
                      <FileText className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{announcement.attachment_name || 'Attachment'}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
