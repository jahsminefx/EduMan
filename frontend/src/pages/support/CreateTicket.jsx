import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  UploadCloud, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Paperclip,
  Image as ImageIcon,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import axios from 'axios';
import API_URL from '../../config/api';

const CATEGORIES = [
  'General Question',
  'Bug Report',
  'Student Management',
  'Teacher Management',
  'Attendance',
  'Results',
  'Report Cards',
  'Timetable',
  'Library',
  'AI Assistant',
  'Billing',
  'Account',
  'Feature Request',
  'Technical Support',
  'Other'
];

export default function CreateTicket() {
  const navigate = useNavigate();

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General Question');
  const [priority, setPriority] = useState('MEDIUM');
  const [message, setMessage] = useState('');

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    const newAttachments = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds the 10MB limit.`);
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await axios.post(`${API_URL}/uploads`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        newAttachments.push({
          fileName: file.name,
          fileUrl: res.data.fileUrl || res.data.url,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          publicId: res.data.publicId || null
        });
      } catch (err) {
        console.error('Failed to upload attachment:', err);
        setError(`Failed to upload "${file.name}". Please try again.`);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    setUploading(false);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError('Please provide a subject and message body.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await axios.post(`${API_URL}/support/tickets`, {
        subject: subject.trim(),
        category,
        priority,
        message: message.trim(),
        attachments
      });

      const newId = res.data.thread?.id;
      if (newId) {
        navigate(`/dashboard/support/tickets/${newId}`);
      } else {
        navigate('/dashboard/support/tickets');
      }
    } catch (err) {
      console.error('Error creating ticket:', err);
      setError(err.response?.data?.message || 'Failed to submit support ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Create Support Ticket</h1>
          <p className="text-xs sm:text-sm text-gray-500">Submit your request directly to EDUMAN support officers</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Form Workspace */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Category & Priority Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50 font-medium"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Urgency / Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-4 py-3 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50 font-medium"
            >
              <option value="LOW">Low (General Inquiry)</option>
              <option value="MEDIUM">Medium (Standard Request)</option>
              <option value="HIGH">High (Impacts Daily Operations)</option>
              <option value="CRITICAL">Critical (System Downtime / Cannot Work)</option>
            </select>
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Subject Line <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Brief description of the issue (e.g. Cannot process CSV student import for JSS1)..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="w-full px-4 py-3 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
          />
        </div>

        {/* Message Body */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Detailed Description <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={6}
            placeholder="Explain what happened, steps to reproduce, or specific error messages encountered..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            className="w-full px-4 py-3 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50 resize-y"
          />
        </div>

        {/* File Dropzone Attachments */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Attachments (Images, PDF, DOCX, CSV, TXT up to 10MB)
          </label>

          <div className="relative border-2 border-dashed border-gray-200 hover:border-blue-500 rounded-2xl p-6 text-center bg-gray-50/50 transition-colors">
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.docx,.csv,.txt"
              onChange={handleFileUpload}
              disabled={uploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <UploadCloud className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-xs sm:text-sm font-semibold text-gray-700">
              {uploading ? 'Uploading files...' : 'Click or drag files to upload attachments'}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">Supports PNG, JPG, PDF, DOCX, CSV, TXT (Max 10MB each)</p>
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-100/70 border border-gray-200 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="font-semibold text-gray-800 truncate">{att.fileName}</span>
                    <span className="text-gray-400 text-[10px]">({Math.round(att.fileSize / 1024)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="p-1 text-gray-400 hover:text-rose-600 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Bar */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || uploading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center gap-2"
          >
            {submitting ? 'Submitting...' : 'Submit Support Ticket'} <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
