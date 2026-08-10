import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CalendarDays, FileText, Pencil, UserCircle } from 'lucide-react';
import API_URL from '../../config/api';
import { mediaUrl } from '../../utils/media';

function formatDate(value) {
  if (!value) return 'Draft';
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

export default function AnnouncementDetail() {
  const { id } = useParams();
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnnouncement();
  }, [id]);

  const fetchAnnouncement = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/announcements/${id}`);
      setAnnouncement(res.data.announcement);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load announcement.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
        Loading announcement...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/announcements" className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Link>
        <div className="p-4 bg-red-50 text-red-800 rounded-lg border border-red-100 text-sm font-medium">
          {error}
        </div>
      </div>
    );
  }

  if (!announcement) return null;

  return (
    <article className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/announcements" className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Link>
        {announcement.can_edit && (
          <Link
            to="/announcements/manage"
            className="inline-flex items-center justify-center px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-black transition"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Manage
          </Link>
        )}
      </div>

      {(announcement.featured_image || announcement.attachment_type === 'image') && (
        <div className="w-full aspect-[16/7] rounded-xl overflow-hidden bg-gray-100 border border-gray-100">
          <img src={mediaUrl(announcement.featured_image || announcement.attachment_path)} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 md:p-8">
        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-5">
          <span className="inline-flex items-center">
            <UserCircle className="w-4 h-4 mr-1 text-gray-400" />
            {announcement.author_name || 'EduMan'}
          </span>
          <span className="inline-flex items-center">
            <CalendarDays className="w-4 h-4 mr-1 text-gray-400" />
            {formatDate(announcement.published_at || announcement.created_at)}
          </span>
        </div>
        <h1 className="text-3xl font-black text-gray-900 leading-tight">{announcement.title}</h1>
        <div className="mt-6 text-gray-700 leading-7 whitespace-pre-wrap">
          {announcement.content}
        </div>
        {announcement.attachment_path && (
          <div className="mt-8 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <a
              href={mediaUrl(announcement.attachment_path)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center text-sm font-bold text-blue-700 hover:text-blue-900 hover:underline"
            >
              <FileText className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="truncate">{announcement.attachment_name || 'Open attachment'}</span>
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
