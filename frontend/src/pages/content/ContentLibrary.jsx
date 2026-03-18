import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Library, Upload, Trash2, FileText, Video, File } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL, API_BASE_URL } from '../../config/api';

const typeIcons = { pdf: FileText, video: Video, document: File };

export default function ContentLibrary() {
  const { user } = useAuth();
  const [contents, setContents] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filterType, setFilterType] = useState('');

  const [form, setForm] = useState({ title: '', description: '', type: 'pdf', class_id: '', subject_id: '' });
  const [file, setFile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  useEffect(() => { fetchData(); }, [filterType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = filterType ? `?type=${filterType}` : '';
      const [contentRes, clsRes, subRes] = await Promise.all([
        axios.get(`${API_URL}/content${params}`),
        axios.get(`${API_URL}/classes/classes`),
        axios.get(`${API_URL}/classes/subjects`)
      ]);
      setContents(contentRes.data.contents);
      setClasses(clsRes.data.classes);
      setSubjects(subRes.data.subjects);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return setMessage('Please select a file to upload.');
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => { if (val) formData.append(key, val); });
      formData.append('file', file);

      await axios.post(`${API_URL}/content`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage('Content uploaded!');
      setShowUpload(false);
      setForm({ title: '', description: '', type: 'pdf', class_id: '', subject_id: '' });
      setFile(null);
      fetchData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Upload failed.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this content?')) return;
    try {
      await axios.delete(`${API_URL}/content/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const canUpload = ['ContentManager', 'Teacher', 'SchoolAdmin'].includes(user.role);
  const canDelete = ['ContentManager', 'SchoolAdmin'].includes(user.role);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2"><Library className="w-5 h-5 text-purple-600" /> Learning Library</h2>
          <p className="text-sm text-gray-500">Browse and manage offline learning materials</p>
        </div>
        {canUpload && (
          <button onClick={() => setShowUpload(!showUpload)} className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium">
            <Upload className="w-4 h-4 mr-1" /> Upload Content
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['', 'pdf', 'video', 'document'].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${filterType === t ? 'bg-purple-100 text-purple-800 border-2 border-purple-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t === '' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
          </button>
        ))}
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.includes('uploaded') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{message}</div>
      )}

      {showUpload && (
        <form onSubmit={handleUpload} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-semibold text-gray-800">Upload Learning Content</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="border rounded-md p-2" required />
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="border rounded-md p-2">
              <option value="pdf">PDF</option>
              <option value="video">Video</option>
              <option value="document">Document</option>
            </select>
            <select value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})} className="border rounded-md p-2">
              <option value="">All Classes (General)</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={form.subject_id} onChange={e => setForm({...form, subject_id: e.target.value})} className="border rounded-md p-2">
              <option value="">All Subjects (General)</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="border rounded-md p-2 w-full" rows={2} />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-purple-600 hover:underline">
              <Upload className="w-4 h-4" /> Choose File
              <input type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
            </label>
            {file && <span className="text-sm text-gray-500">{file.name}</span>}
          </div>
          <button type="submit" className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium text-sm">Upload</button>
        </form>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading library...</div>
      ) : contents.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-xl border shadow-sm">No content found. Upload some learning materials!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contents.map(c => {
            const Icon = typeIcons[c.type] || File;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${c.type === 'video' ? 'text-red-500' : c.type === 'pdf' ? 'text-orange-500' : 'text-blue-500'}`} />
                    <h3 className="font-semibold text-gray-800">{c.title}</h3>
                  </div>
                  {canDelete && <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                </div>
                {c.description && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{c.description}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.type === 'video' ? 'bg-red-50 text-red-600' : c.type === 'pdf' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                    {c.type.toUpperCase()}
                  </span>
                </div>
                <a href={`${API_BASE_URL}${c.file_path}`} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline mt-3 inline-block">📥 Download / View</a>
                <p className="text-xs text-gray-400 mt-1">By {c.uploader_name || 'Unknown'}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
