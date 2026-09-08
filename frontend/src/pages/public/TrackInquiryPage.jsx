import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Copy, 
  Check, 
  ShieldCheck, 
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import axios from 'axios';
import API_URL from '../../config/api';

export default function TrackInquiryPage() {
  const { inquiryNumber } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [inquiry, setInquiry] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const chatBottomRef = useRef(null);

  const fetchTrackedInquiry = async (showLoading = false) => {
    if (!token) {
      setError('Access token is missing from URL. Please use the complete link provided after submitting your message.');
      setLoading(false);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      const res = await axios.get(`${API_URL}/contact/track/${inquiryNumber}?token=${encodeURIComponent(token)}`);
      setInquiry(res.data.inquiry);
      setMessages(res.data.messages || []);
      setError(null);
    } catch (err) {
      console.error('Error loading tracked inquiry:', err);
      setError(err.response?.data?.message || 'Failed to load inquiry details. The token may be invalid.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackedInquiry(true);

    // Auto refresh conversation stream every 8 seconds for live chat feeling
    const interval = setInterval(() => {
      fetchTrackedInquiry(false);
    }, 8000);

    return () => clearInterval(interval);
  }, [inquiryNumber, token]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    try {
      setSending(true);
      await axios.post(`${API_URL}/contact/track/${inquiryNumber}/reply`, {
        token,
        message: replyText.trim()
      });
      setReplyText('');
      await fetchTrackedInquiry(false);
    } catch (err) {
      console.error('Failed to post reply:', err);
      alert(err.response?.data?.message || 'Failed to post message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const copyTrackingLink = () => {
    const fullUrl = window.location.href;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="font-semibold text-gray-700 text-sm">Connecting to EduMan Support Thread...</p>
        </div>
      </div>
    );
  }

  if (error || !inquiry) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-200 shadow-sm text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Inquiry Not Accessible</h2>
          <p className="text-xs text-gray-500 leading-relaxed">{error}</p>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Contact Page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-200 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-extrabold border border-blue-200">
                {inquiry.inquiry_number}
              </span>
              <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                inquiry.status === 'NEW' ? 'bg-blue-600 text-white' :
                inquiry.status === 'IN_PROGRESS' ? 'bg-amber-500 text-white' :
                inquiry.status === 'RESOLVED' ? 'bg-emerald-600 text-white' : 'bg-gray-600 text-white'
              }`}>
                {inquiry.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-900">{inquiry.subject}</h1>
            <p className="text-xs text-gray-500">
              Submitted by <span className="font-semibold text-gray-800">{inquiry.name}</span> ({inquiry.email})
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={copyTrackingLink}
              className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              title="Copy secure link to revisit this chat anytime"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Link Copied!' : 'Copy Guest Link'}
            </button>
            <Link
              to="/contact"
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl text-xs text-blue-800 flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <p>
            <span className="font-bold">Secure Guest Chat:</span> You can bookmark or return to this page link anytime to continue your conversation with EduMan Support.
          </p>
        </div>

        {/* Conversation Feed */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col min-h-[500px] overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" /> EduMan Support Chat ({messages.length} messages)
            </span>
            <span className="text-[11px] text-gray-400">Created: {new Date(inquiry.created_at).toLocaleString()}</span>
          </div>

          <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[450px]">
            {messages.map((msg) => {
              const isVisitor = msg.sender_email === inquiry.email && !msg.sender_id;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${isVisitor ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-xs ${
                    isVisitor ? 'bg-gradient-to-tr from-blue-600 to-cyan-600' : 'bg-gradient-to-tr from-purple-600 to-indigo-600'
                  }`}>
                    {msg.sender_name?.[0]?.toUpperCase() || 'E'}
                  </div>

                  <div className={`max-w-xl space-y-1 ${isVisitor ? 'items-end text-right' : ''}`}>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="font-bold text-gray-900">{msg.sender_name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 font-semibold text-gray-600">
                        {isVisitor ? 'Visitor' : 'EduMan Support'}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isVisitor
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Guest Reply Box */}
          <form onSubmit={handleSendReply} className="p-4 bg-gray-50/80 border-t border-gray-200 space-y-3">
            <textarea
              rows={3}
              placeholder="Type your response to EduMan Support..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full p-3.5 text-xs sm:text-sm border border-gray-200 rounded-2xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-hidden resize-none transition-colors"
            />

            <div className="flex items-center justify-between">
              <p className="text-[11px] text-gray-400">EduMan Support team will be notified immediately upon reply.</p>
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-2"
              >
                {sending ? 'Sending...' : 'Send Message'} <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
