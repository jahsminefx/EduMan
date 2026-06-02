import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Megaphone, ArrowRight, Plus, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import API_URL from '../../config/api';

function formatDate(value) {
  if (!value) return 'Unpublished';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

function excerpt(content) {
  if (!content) return '';
  return content.length > 150 ? `${content.slice(0, 150).trim()}...` : content;
}

export default function AnnouncementList() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canManage = ['SchoolAdmin', 'Teacher'].includes(user.role);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/announcements`, {
        params: { status: 'Published' }
      });
      setAnnouncements(res.data.announcements || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center">
            <Megaphone className="w-6 h-6 mr-2 text-blue-600" />
            Announcements
          </h2>
          <p className="mt-1 text-sm text-gray-500 uppercase tracking-widest font-bold">School Bulletin</p>
        </div>
        {canManage && (
          <Link
            to="/announcements/manage"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            Manage
          </Link>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-800 rounded-lg border border-red-100 text-sm font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
          Loading announcements...
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <Megaphone className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Announcements</h3>
          <p className="text-sm text-gray-500 mt-2">Published announcements will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {announcements.map((announcement) => (
            <article key={announcement.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="h-40 bg-gray-100">
                {announcement.featured_image ? (
                  <img
                    src={announcement.featured_image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <ImageIcon className="w-9 h-9" />
                  </div>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center justify-between gap-3 text-xs text-gray-500 mb-3">
                  <span className="font-bold text-blue-700">{announcement.author_name || 'EduMan'}</span>
                  <span>{formatDate(announcement.published_at || announcement.created_at)}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 leading-snug">{announcement.title}</h3>
                <p className="mt-3 text-sm text-gray-600 leading-6 flex-1">{excerpt(announcement.content)}</p>
                <Link
                  to={`/announcements/${announcement.id}`}
                  className="mt-5 inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800"
                >
                  Read More
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
