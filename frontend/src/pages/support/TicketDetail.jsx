import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  FileText, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  User, 
  Building2, 
  Shield, 
  Sparkles, 
  Lock, 
  Eye, 
  Star, 
  Trash2, 
  RefreshCw,
  Tag,
  MessageSquare,
  History,
  Bot
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import API_URL from '../../config/api';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = ['SuperAdmin', 'SupportOfficer'].includes(user.role);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reply Composer state
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);

  // Control Actions State
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [updating, setUpdating] = useState(false);

  // Canned responses & Staff lists
  const [cannedResponses, setCannedResponses] = useState([]);
  const [supportOfficers, setSupportOfficers] = useState([]);

  // Rating Feedback State
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const chatBottomRef = useRef(null);

  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/support/tickets/${id}`);
      setData(res.data);
      setStatus(res.data.thread.status);
      setPriority(res.data.thread.priority);
      setAssignedTo(res.data.thread.assigned_to || '');
    } catch (err) {
      console.error('Failed to load ticket details:', err);
      setError(err.response?.data?.message || 'Failed to load ticket details.');
    } fontally: {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketDetails();
    if (isStaff) {
      axios.get(`${API_URL}/support/canned-responses`).then(res => setCannedResponses(res.data || [])).catch(() => {});
      axios.get(`${API_URL}/superadmin/users?role=SupportOfficer`).then(res => setSupportOfficers(res.data.users || [])).catch(() => {});
    }
  }, [id, isStaff]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.messages]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() && attachments.length === 0) return;

    try {
      setSending(true);

      // Optimistic update UI
      const tempReply = {
        id: Date.now(),
        sender_id: user.id,
        sender_name: user.name,
        sender_role: user.role,
        message: replyText.trim(),
        is_internal: isInternal ? 1 : 0,
        created_at: new Date().toISOString(),
        attachments: [...attachments]
      };

      setData(prev => ({
        ...prev,
        messages: [...(prev?.messages || []), tempReply]
      }));

      const res = await axios.post(`${API_URL}/support/tickets/${data.thread.id}/messages`, {
        message: replyText.trim(),
        is_internal: isInternal,
        attachments
      });

      setReplyText('');
      setAttachments([]);
      setIsInternal(false);

      // Re-sync exact state
      fetchTicketDetails();
    } catch (err) {
      console.error('Error posting reply:', err);
      alert('Failed to post reply. Please check your connection.');
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      setUpdating(true);
      await axios.put(`${API_URL}/support/tickets/${data.thread.id}`, { status: newStatus });
      setStatus(newStatus);
      fetchTicketDetails();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePriority = async (newPriority) => {
    try {
      setUpdating(true);
      await axios.put(`${API_URL}/support/tickets/${data.thread.id}`, { priority: newPriority });
      setPriority(newPriority);
      fetchTicketDetails();
    } catch (err) {
      console.error('Failed to update priority:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateAssignment = async (newAgentId) => {
    try {
      setUpdating(true);
      await axios.put(`${API_URL}/support/tickets/${data.thread.id}`, { assigned_to: newAgentId });
      setAssignedTo(newAgentId);
      fetchTicketDetails();
    } catch (err) {
      console.error('Failed to update assignment:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!window.confirm(`Are you sure you want to delete ticket #${data?.thread?.ticket_number}?`)) return;
    try {
      await axios.delete(`${API_URL}/support/tickets/${data.thread.id}`);
      navigate('/dashboard/support/tickets');
    } catch (err) {
      console.error('Failed to delete ticket:', err);
    }
  };

  const handleToggleWatcher = async () => {
    try {
      await axios.post(`${API_URL}/support/tickets/${data.thread.id}/watch`);
      fetchTicketDetails();
    } catch (err) {
      console.error('Failed to toggle watcher:', err);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/support/tickets/${data.thread.id}/feedback`, {
        rating,
        comment: ratingComment
      });
      setFeedbackSubmitted(true);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-gray-400 text-sm flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="font-semibold text-gray-700">Loading support thread...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-gray-200">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900">Ticket Not Found</h2>
        <p className="text-xs text-gray-500 mt-1">{error || 'The requested support thread could not be found.'}</p>
        <button
          onClick={() => navigate('/dashboard/support/tickets')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold"
        >
          Back to Tickets
        </button>
      </div>
    );
  }

  const { thread, messages, activityLogs, feedback, watchers, aiSuggestions } = data;
  const isWatched = watchers?.some(w => w.user_id === user.id);

  return (
    <div className="space-y-6">
      {/* Conversation Status Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                {thread.ticket_number}
              </span>
              <span className="text-xs font-semibold text-gray-500">{thread.category}</span>
              <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                thread.status === 'OPEN' ? 'bg-blue-600 text-white' :
                thread.status === 'WAITING_FOR_CUSTOMER' ? 'bg-amber-500 text-white' :
                thread.status === 'RESOLVED' ? 'bg-emerald-600 text-white' : 'bg-gray-600 text-white'
              }`}>
                {thread.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">{thread.subject}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="hidden md:block text-right">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Assigned Agent</span>
            <span className="font-semibold text-gray-800">{thread.agent_name || 'Unassigned'}</span>
          </div>

          {user.role === 'SuperAdmin' && (
            <button
              onClick={handleDeleteTicket}
              className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
              title="Delete Ticket"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Message Feed Stream */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col min-h-[600px] overflow-hidden">
          {/* Stream Header */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" /> Conversation Stream ({messages.length} messages)
            </span>
            <span className="text-[11px] text-gray-400">Created: {new Date(thread.created_at).toLocaleString()}</span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[500px]">
            {messages.map((msg) => {
              const isSender = msg.sender_id === user.id;
              const isStaffSender = ['SuperAdmin', 'SupportOfficer'].includes(msg.sender_role);

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${isSender ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-xs ${
                    isStaffSender ? 'bg-gradient-to-tr from-purple-600 to-indigo-600' : 'bg-gradient-to-tr from-blue-600 to-cyan-600'
                  }`}>
                    {msg.sender_name?.[0]?.toUpperCase()}
                  </div>

                  {/* Message Bubble container */}
                  <div className={`max-w-xl space-y-1 ${isSender ? 'items-end text-right' : ''}`}>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="font-bold text-gray-900">{msg.sender_name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 font-semibold text-gray-600">
                        {msg.sender_role}
                      </span>
                      {msg.is_internal === 1 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Internal Staff Note
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 ml-auto">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      msg.is_internal === 1
                        ? 'bg-amber-50/80 border border-amber-200 text-amber-900'
                        : isSender
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.message}</p>

                      {/* Attachments preview */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-black/10 space-y-2">
                          {msg.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-2 p-2 rounded-xl text-xs transition-colors ${
                                isSender ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-gray-50 text-blue-600 border border-gray-200'
                              }`}
                            >
                              <Paperclip className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate flex-1 font-semibold">{att.file_name}</span>
                              <Download className="w-3.5 h-3.5 flex-shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Interactive Reply Box Composer */}
          <div className="p-4 bg-gray-50/80 border-t border-gray-200 space-y-3">
            {/* Staff Controls & Saved Replies Toolbar */}
            {isStaff && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInternal(!isInternal)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                      isInternal ? 'bg-amber-500 text-white shadow-xs' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" /> {isInternal ? 'Internal Note Mode' : 'Public Reply'}
                  </button>
                </div>

                {cannedResponses.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) setReplyText(prev => prev + (prev ? '\n' : '') + e.target.value);
                    }}
                    className="px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-gray-700 text-xs font-semibold"
                  >
                    <option value="">Insert Saved Reply...</option>
                    {cannedResponses.map(c => (
                      <option key={c.id} value={c.content}>{c.title}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Reply Textarea */}
            <form onSubmit={handleSendReply} className="space-y-3">
              <textarea
                rows={3}
                placeholder={isInternal ? "Write a private note visible only to support staff..." : "Type your response here..."}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className={`w-full p-3.5 text-xs sm:text-sm border rounded-2xl focus:outline-hidden resize-none transition-colors ${
                  isInternal
                    ? 'border-amber-300 bg-amber-50/40 focus:ring-2 focus:ring-amber-500/20'
                    : 'border-gray-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors" title="Attach file">
                    <Paperclip className="w-4 h-4" />
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files);
                        for (const f of files) {
                          const formData = new FormData();
                          formData.append('file', f);
                          try {
                            const res = await axios.post(`${API_URL}/uploads`, formData);
                            setAttachments(prev => [...prev, {
                              fileName: f.name,
                              fileUrl: res.data.fileUrl || res.data.url,
                              fileType: f.type,
                              fileSize: f.size
                            }]);
                          } catch (err) {
                            alert('Failed to upload attachment');
                          }
                        }
                      }}
                    />
                  </label>
                  {attachments.length > 0 && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      {attachments.length} file(s) attached
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={sending || (!replyText.trim() && attachments.length === 0)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 ${
                    isInternal ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {sending ? 'Sending...' : 'Send Message'} <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right 1 Col: School Info Card, Support Actions, Timeline & AI Preview */}
        <div className="space-y-6">
          {/* School Information Card */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" /> Customer / School Information
            </h3>

            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs flex-shrink-0">
                {thread.school_name?.[0] || 'S'}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-gray-900 truncate">{thread.school_name || 'Independent Account'}</h4>
                <p className="text-[11px] text-gray-500">{thread.school_type || 'K-12 School'}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between border-b border-gray-100 pb-1.5">
                <span className="text-gray-400">Created By:</span>
                <span className="font-semibold text-gray-900">{thread.creator_name} ({thread.creator_role})</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1.5">
                <span className="text-gray-400">Email:</span>
                <span className="font-semibold text-gray-900 truncate max-w-[150px]">{thread.creator_email}</span>
              </div>
              {thread.school_phone && (
                <div className="flex justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-gray-400">Phone:</span>
                  <span className="font-semibold text-gray-900">{thread.school_phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Support Actions Controls (For Staff or Admin) */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" /> Ticket Management Controls
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  disabled={updating}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="WAITING_FOR_CUSTOMER">WAITING_FOR_CUSTOMER</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              {isStaff && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => handleUpdatePriority(e.target.value)}
                      disabled={updating}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Assigned Agent</label>
                    <select
                      value={assignedTo}
                      onChange={(e) => handleUpdateAssignment(e.target.value)}
                      disabled={updating}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="">Unassigned</option>
                      {supportOfficers.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <button
                onClick={handleToggleWatcher}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-colors ${
                  isWatched ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> {isWatched ? 'Watching Ticket' : 'Watch Ticket'}
              </button>
            </div>
          </div>

          {/* Satisfaction Rating Prompt (When Resolved / Closed) */}
          {['RESOLVED', 'CLOSED'].includes(thread.status) && thread.created_by === user.id && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border border-amber-200 p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Rate Support Satisfaction
              </h4>

              {feedbackSubmitted || feedback ? (
                <div className="p-3 rounded-xl bg-white text-xs text-amber-900 font-semibold text-center">
                  ⭐ Thank you! Your rating has been recorded.
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback} className="space-y-3 text-xs">
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star className={`w-6 h-6 ${star <= rating ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}`} />
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Optional feedback comment..."
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-200 rounded-xl bg-white text-xs"
                  />

                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all"
                  >
                    Submit Feedback
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Future AI Support Architecture Preview Card (Staff Only) */}
          {isStaff && aiSuggestions && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-3xl border border-purple-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-purple-600" /> AI Assistance Preview
                </h4>
                <span className="text-[10px] font-bold bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full">
                  AI Ready
                </span>
              </div>
              <p className="text-xs text-purple-800 leading-relaxed bg-white/70 p-3 rounded-2xl border border-purple-100">
                "{aiSuggestions.suggestedReply}"
              </p>
              <button
                type="button"
                onClick={() => setReplyText(aiSuggestions.suggestedReply)}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all"
              >
                Use AI Suggested Reply
              </button>
            </div>
          )}

          {/* Activity Timeline Stream */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-gray-600" /> Activity Timeline
            </h3>

            <div className="space-y-3 max-h-60 overflow-y-auto text-xs">
              {activityLogs.map((log) => (
                <div key={log.id} className="border-l-2 border-blue-500 pl-3 py-1 space-y-0.5">
                  <div className="flex items-center justify-between font-semibold text-gray-900">
                    <span>{log.action}</span>
                    <span className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">{log.details}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
