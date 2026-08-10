import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Download, ExternalLink, Eye, FileText, Image as ImageIcon, Library, Sparkles, Trash2, Upload, Video, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config/api';
import { displayLabel, downloadProtected } from '../ai/aiUtils';
import { mediaUrl } from '../../utils/media';

const emptyForm = { title: '', description: '', type: 'image', class_id: '', subject_id: '' };

const contentTypes = [
  {
    value: 'image',
    label: 'Images',
    singular: 'Image',
    accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
    Icon: ImageIcon,
    iconClass: 'text-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700',
  },
  {
    value: 'video',
    label: 'Videos',
    singular: 'Video',
    accept: 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v',
    Icon: Video,
    iconClass: 'text-red-600',
    badgeClass: 'bg-red-50 text-red-700',
  },
  {
    value: 'document',
    label: 'Documents',
    singular: 'Document',
    accept: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf',
    Icon: FileText,
    iconClass: 'text-blue-600',
    badgeClass: 'bg-blue-50 text-blue-700',
  },
];

const legacyTypeMap = { pdf: 'document' };

function getContentType(type) {
  const normalized = legacyTypeMap[type] || type;
  return contentTypes.find(item => item.value === normalized) || contentTypes[2];
}

export default function ContentLibrary() {
  const { user } = useAuth();
  const [contents, setContents] = useState([]);
  const [aiResources, setAiResources] = useState([]);
  const [selectedAiResource, setSelectedAiResource] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filterType, setFilterType] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const selectedType = useMemo(() => getContentType(form.type), [form.type]);

  useEffect(() => {
    fetchData();
  }, [filterType, user?.school_id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = filterType ? `?type=${filterType}` : '';
      const requests = [axios.get(`${API_URL}/content${params}`)];
      if (user?.school_id && ['SchoolAdmin', 'Teacher', 'Student', 'Parent', 'ContentManager'].includes(user.role)) {
        requests.push(axios.get(`${API_URL}/ai/library`));
      }
      const [contentRes, aiRes] = await Promise.all(requests);
      setContents(contentRes.data.contents || []);
      setAiResources(aiRes?.data?.resources || []);

      if (user?.school_id) {
        const [clsRes, subRes] = await Promise.all([
          axios.get(`${API_URL}/classes/classes`),
          axios.get(`${API_URL}/classes/subjects`),
        ]);
        setClasses(clsRes.data.classes || []);
        setSubjects(subRes.data.subjects || []);
      } else {
        setClasses([]);
        setSubjects([]);
      }
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Unable to load library content.');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type) => {
    setForm({ ...form, type });
    setFile(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return setMessage('Please select a file to upload.');

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (val) formData.append(key, val);
      });
      formData.append('file', file);

      await axios.post(`${API_URL}/content`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage('Content uploaded!');
      setShowUpload(false);
      setForm(emptyForm);
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
      setMessage('Content deleted successfully.');
      await fetchData();
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Delete failed.');
    }
  };

  const canUpload = ['ContentManager', 'Teacher', 'SchoolAdmin'].includes(user.role);
  const canDeleteContent = (content) => (
    ['ContentManager', 'SchoolAdmin'].includes(user.role)
    || (user.role === 'Teacher' && Number(content.uploaded_by) === Number(user.id))
  );

  const handleAiDownload = async (resource, format) => {
    try {
      await downloadProtected(`${API_URL}/ai/library/${resource.id}/download?format=${format}`, `${resource.title}.${format}`);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Download failed.');
    }
  };

  const handleAiDelete = async (resource) => {
    if (!confirm('Delete this EduMan AI learning content? Students will no longer see it.')) return;
    try {
      await axios.delete(`${API_URL}/ai/resources/${resource.id}`);
      if (selectedAiResource?.id === resource.id) setSelectedAiResource(null);
      setMessage('EduMan AI learning content deleted successfully.');
      await fetchData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Delete failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <Library className="w-5 h-5 text-blue-600" />
            Learning Library
          </h2>
          <p className="text-sm text-gray-500">Images, videos, and documents for class learning materials</p>
        </div>
        {canUpload && (
          <button onClick={() => setShowUpload(!showUpload)} className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            <Upload className="w-4 h-4 mr-2" />
            Upload Content
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType('')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${filterType === '' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
        >
          <Library className="w-4 h-4" />
          All
        </button>
        {contentTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setFilterType(type.value)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${filterType === type.value ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {React.createElement(type.Icon, { className: 'w-4 h-4' })}
            {type.label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.includes('uploaded') || message.includes('deleted') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message}
        </div>
      )}

      {showUpload && (
        <form onSubmit={handleUpload} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-semibold text-gray-800">Upload Learning Content</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="border rounded-md p-2" required />
            <select value={form.type} onChange={e => handleTypeChange(e.target.value)} className="border rounded-md p-2">
              {contentTypes.map(type => (
                <option key={type.value} value={type.value}>{type.singular}</option>
              ))}
            </select>
            <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })} className="border rounded-md p-2">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} className="border rounded-md p-2">
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="border rounded-md p-2 w-full" rows={2} />
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-blue-600 hover:text-blue-700">
              <Upload className="w-4 h-4" />
              Choose File
              <input type="file" accept={selectedType.accept} className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
            {file && <span className="text-sm text-gray-500 break-all">{file.name}</span>}
          </div>
          <button type="submit" className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </button>
        </form>
      )}

      {(!filterType || filterType === 'document') && aiResources.length > 0 && (
        <section className="space-y-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Sparkles className="h-5 w-5 text-violet-600" /> EduMan AI Learning Content</h3>
            <p className="mt-1 text-sm text-gray-500">Teacher-reviewed documents published for your class.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {aiResources.map(resource => (
              <div key={`ai-${resource.id}`} className="rounded-lg border border-violet-100 bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">EduMan AI • Teacher Approved</span>
                    <h4 className="mt-3 truncate font-bold text-gray-900">{resource.title}</h4>
                    <p className="mt-1 text-xs text-gray-500">{resource.class_name} • {resource.subject_name}</p>
                  </div>
                  <FileText className="h-6 w-6 flex-shrink-0 text-blue-600" />
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">{resource.body}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button onClick={() => setSelectedAiResource(resource)} className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"><Eye className="mr-1 h-3.5 w-3.5" /> View</button>
                  <button onClick={() => handleAiDownload(resource, 'pdf')} className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-bold text-gray-700"><Download className="mr-1 h-3.5 w-3.5" /> PDF</button>
                  <button onClick={() => handleAiDownload(resource, 'docx')} className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-bold text-gray-700"><Download className="mr-1 h-3.5 w-3.5" /> DOCX</button>
                  {user.role === 'Teacher' && Number(resource.teacher_user_id) === Number(user.id) && (
                    <button onClick={() => handleAiDelete(resource)} className="inline-flex items-center rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</button>
                  )}
                </div>
                <p className="mt-3 text-xs text-gray-400">{displayLabel(resource.content_type)} • By {resource.teacher_name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading library...</div>
      ) : contents.length === 0 && aiResources.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg border shadow-sm">No content found.</div>
      ) : contents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contents.map(content => {
            const meta = getContentType(content.type);
            const fileUrl = mediaUrl(content.file_path);
            const isImage = meta.value === 'image';
            const isVideo = meta.value === 'video';

            return (
              <div key={content.id} className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 hover:shadow-md transition">
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-gray-100 border border-gray-100 flex items-center justify-center">
                  {isImage ? (
                    <img src={fileUrl} alt={content.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : isVideo ? (
                    <video src={fileUrl} controls preload="metadata" className="w-full h-full bg-black object-contain" />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                      {React.createElement(meta.Icon, { className: 'w-10 h-10 text-blue-500' })}
                      <span className="text-xs font-semibold uppercase tracking-wide">{content.type === 'pdf' ? 'PDF' : 'Document'}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {React.createElement(meta.Icon, { className: `w-5 h-5 flex-shrink-0 ${meta.iconClass}` })}
                      <h3 className="font-semibold text-gray-800 truncate">{content.title}</h3>
                    </div>
                    {content.description && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{content.description}</p>}
                  </div>
                  {canDeleteContent(content) && (
                    <button onClick={() => handleDelete(content.id)} className="text-red-400 hover:text-red-600 p-1" title="Delete content">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className={`px-2 py-1 rounded-md text-xs font-semibold ${meta.badgeClass}`}>
                    {meta.singular}
                  </span>
                  <div className="flex items-center gap-2">
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                      <ExternalLink className="w-3.5 h-3.5" />
                      View
                    </a>
                    <a href={fileUrl} download className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800">
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 truncate">By {content.uploader_name || 'Unknown'}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {selectedAiResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-violet-600">EduMan AI • Teacher Approved</span>
                <h3 className="mt-1 text-xl font-bold text-gray-900">{selectedAiResource.title}</h3>
                <p className="text-sm text-gray-500">{selectedAiResource.class_name} • {selectedAiResource.subject_name}</p>
              </div>
              <button onClick={() => setSelectedAiResource(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 whitespace-pre-wrap rounded-xl bg-gray-50 p-5 text-sm leading-7 text-gray-800">{selectedAiResource.body}</div>
          </div>
        </div>
      )}
    </div>
  );
}
