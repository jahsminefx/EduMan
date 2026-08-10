import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  Search, 
  BookOpen, 
  Check, 
  X, 
  FileText,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import API_URL from '../../config/api';

const CATEGORIES = [
  'Getting Started',
  'Managing Students',
  'Managing Teachers',
  'Attendance',
  'Results',
  'Timetable',
  'CSV Import',
  'AI Assistant',
  'Frequently Asked Questions',
  'Troubleshooting'
];

export default function AdminKnowledgeBase() {
  const { user } = useAuth();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Getting Started');
  const [content, setContent] = useState('');
  const [featuredImage, setFeaturedImage] = useState('');
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/knowledge-base/articles`);
      setArticles(res.data || []);
    } catch (err) {
      console.error('Failed to load KB articles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const openCreateModal = () => {
    setEditingArticle(null);
    setTitle('');
    setCategory('Getting Started');
    setContent('');
    setFeaturedImage('');
    setPublished(true);
    setIsModalOpen(true);
  };

  const openEditModal = (article) => {
    setEditingArticle(article);
    setTitle(article.title);
    setCategory(article.category);
    setContent(article.content);
    setFeaturedImage(article.featured_image || '');
    setPublished(article.published === 1);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setSaving(true);
      const payload = {
        title: title.trim(),
        category,
        content: content.trim(),
        featured_image: featuredImage.trim() || null,
        published: published ? 1 : 0
      };

      if (editingArticle) {
        await axios.put(`${API_URL}/knowledge-base/articles/${editingArticle.id}`, payload);
      } else {
        await axios.post(`${API_URL}/knowledge-base/articles`, payload);
      }

      setIsModalOpen(false);
      fetchArticles();
    } catch (err) {
      console.error('Failed to save KB article:', err);
      alert('Failed to save article.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, titleStr) => {
    if (!window.confirm(`Are you sure you want to delete "${titleStr}"?`)) return;
    try {
      await axios.delete(`${API_URL}/knowledge-base/articles/${id}`);
      fetchArticles();
    } catch (err) {
      console.error('Failed to delete KB article:', err);
    }
  };

  const handleTogglePublish = async (article) => {
    try {
      await axios.put(`${API_URL}/knowledge-base/articles/${article.id}`, {
        published: article.published === 1 ? 0 : 1
      });
      fetchArticles();
    } catch (err) {
      console.error('Failed to toggle publish:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" /> Admin Knowledge Base Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">Create, edit, publish, and delete Help Center articles</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Article
        </button>
      </div>

      {/* Table Workspace */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="overflow-x-auto border border-gray-100 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Views</th>
                <th className="py-3 px-4">Author</th>
                <th className="py-3 px-4">Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">Loading articles...</td>
                </tr>
              ) : articles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">No articles created yet.</td>
                </tr>
              ) : (
                articles.map((art) => (
                  <tr key={art.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900 max-w-xs truncate">
                      {art.title}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-semibold text-[11px]">
                        {art.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleTogglePublish(art)}
                        className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border flex items-center gap-1 transition-all ${
                          art.published === 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {art.published === 1 ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {art.published === 1 ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-medium">{art.views}</td>
                    <td className="py-3 px-4 text-gray-600 font-medium">{art.author_name || 'Admin'}</td>
                    <td className="py-3 px-4 text-gray-400">{new Date(art.updated_at || art.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(art)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Article"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(art.id, art.title)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Article"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Article Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-lg font-bold text-gray-900">
                {editingArticle ? 'Edit Knowledge Base Article' : 'Create New Article'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-900 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Article Title *</label>
                <input
                  type="text"
                  placeholder="e.g. How to Import Student CSV Records"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50/50"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Content (Rich Markdown / Text) *</label>
                <textarea
                  rows={8}
                  placeholder="Write documentation content here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50/50 resize-y"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="rounded text-blue-600 w-4 h-4"
                  />
                  Publish Article Immediately
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-xs"
                  >
                    {saving ? 'Saving...' : 'Save Article'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
