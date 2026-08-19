import React, { useState, useEffect } from 'react';
import { 
  Search, 
  BookOpen, 
  Bookmark, 
  Eye, 
  ChevronRight, 
  HelpCircle, 
  FileText, 
  UserCheck, 
  Sparkles, 
  ArrowLeft, 
  X 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import API_URL from '../../config/api';
import MarkdownRenderer from '../../components/MarkdownRenderer';

const CATEGORIES = [
  'All Categories',
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

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const [articles, setArticles] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Active Article modal
  const [activeArticle, setActiveArticle] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== 'All Categories') params.set('category', selectedCategory);
      if (search.trim()) params.set('search', search.trim());

      const res = await axios.get(`${API_URL}/knowledge-base/articles?${params.toString()}`);
      setArticles(res.data || []);
    } catch (err) {
      console.error('Failed to fetch KB articles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [selectedCategory]);

  const handleOpenArticle = async (slug) => {
    try {
      const res = await axios.get(`${API_URL}/knowledge-base/articles/${slug}`);
      setActiveArticle(res.data.article);
      setIsBookmarked(res.data.isBookmarked);
    } catch (err) {
      console.error('Failed to load article detail:', err);
    }
  };

  const handleToggleBookmark = async (id) => {
    try {
      const res = await axios.post(`${API_URL}/knowledge-base/articles/${id}/bookmark`);
      setIsBookmarked(res.data.isBookmarked);
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-3xl p-8 text-white shadow-xl text-center relative overflow-hidden">
        <div className="max-w-2xl mx-auto space-y-4 relative z-10">
          <span className="px-3.5 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-md inline-flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> EDUMAN Knowledge Base & Help Center
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">How can we help you today?</h1>
          <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
            Search our comprehensive guides, step-by-step documentation, and troubleshooting resources.
          </p>

          {/* Search Form */}
          <form onSubmit={(e) => { e.preventDefault(); fetchArticles(); }} className="relative max-w-xl mx-auto pt-2">
            <Search className="absolute left-4 top-5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for articles, guides, CSV formatting, AI assistant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-24 py-3.5 text-xs sm:text-sm bg-white text-gray-900 rounded-2xl shadow-lg focus:outline-hidden"
            />
            <button
              type="submit"
              className="absolute right-2 top-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-xs"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Articles Grid */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading articles...</div>
      ) : articles.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-gray-200 text-center">
          <HelpCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h3 className="text-base font-bold text-gray-900">No Articles Found</h3>
          <p className="text-xs text-gray-500 mt-1">Try adjusting your search query or category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((art) => (
            <div
              key={art.id}
              onClick={() => handleOpenArticle(art.slug)}
              className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                    {art.category}
                  </span>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {art.views} views
                  </span>
                </div>

                <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {art.title}
                </h3>

                <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                  {art.content.replace(/<[^>]*>?/gm, '').replace(/[#*`_~-]/g, '').trim()}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-blue-600">
                <span>Read article</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Article Reader Modal */}
      {activeArticle && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                {activeArticle.category}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleBookmark(activeArticle.id)}
                  className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isBookmarked ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
                  {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                </button>
                <button
                  onClick={() => setActiveArticle(null)}
                  className="p-2 text-gray-400 hover:text-gray-900 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{activeArticle.title}</h2>
              <div className="text-xs text-gray-400 flex items-center gap-4 border-b border-gray-100 pb-3">
                <span>By {activeArticle.author_name || 'EDUMAN Team'}</span>
                <span>•</span>
                <span>{new Date(activeArticle.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <span>{activeArticle.views} views</span>
              </div>

              <div className="py-2">
                <MarkdownRenderer content={activeArticle.content} />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
              <button
                onClick={() => setActiveArticle(null)}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                Close Article
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
