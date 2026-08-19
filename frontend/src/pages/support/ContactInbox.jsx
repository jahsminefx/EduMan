import React, { useState, useEffect } from 'react';
import { Mail, Search, RefreshCw, Send, CheckCircle, ArrowRight, UserCheck, ShieldAlert, Lock } from 'lucide-react';
import axios from 'axios';
import API_URL from '../../config/api';

export default function ContactInbox() {
  const [inquiries, setInquiries] = useState([]);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [messageAlert, setMessageAlert] = useState('');

  useEffect(() => {
    fetchInquiries();
  }, [filterStatus, search]);

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/contact/inquiries?search=${encodeURIComponent(search)}`;
      if (filterStatus !== 'ALL') {
        url += `&status=${filterStatus}`;
      }

      const res = await axios.get(url);
      setInquiries(res.data.inquiries || []);
    } catch (err) {
      console.error('Failed to fetch contact inquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInquiry = async (inq) => {
    setSelectedInquiry(inq);
    setMessageAlert('');
    try {
      const res = await axios.get(`${API_URL}/contact/inquiries/${inq.id}`);
      setMessages(res.data.messages || []);
      
      // If status is NEW, auto mark as READ
      if (inq.status === 'NEW') {
        await axios.put(`${API_URL}/contact/inquiries/${inq.id}/status`, { status: 'READ' });
        fetchInquiries();
      }
    } catch (err) {
      console.error('Failed to fetch inquiry details:', err);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedInquiry) return;

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/contact/inquiries/${selectedInquiry.id}/messages`, {
        message: replyText.trim(),
        is_internal: isInternal ? 1 : 0
      });

      setReplyText('');
      handleSelectInquiry(selectedInquiry);
      setMessageAlert(isInternal ? 'Internal note added.' : 'Reply sent via email.');
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedInquiry) return;
    try {
      await axios.put(`${API_URL}/contact/inquiries/${selectedInquiry.id}/status`, { status: newStatus });
      setSelectedInquiry({ ...selectedInquiry, status: newStatus });
      fetchInquiries();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleConvertToTicket = async () => {
    if (!selectedInquiry || selectedInquiry.converted_ticket_id) return;
    setConverting(true);
    try {
      const res = await axios.post(`${API_URL}/contact/inquiries/${selectedInquiry.id}/convert`, {
        category: 'General',
        priority: 'MEDIUM'
      });

      setMessageAlert(`Successfully converted to Support Ticket ${res.data.ticket_number}!`);
      setSelectedInquiry({ ...selectedInquiry, status: 'CONVERTED', converted_ticket_id: res.data.ticket_id });
      fetchInquiries();
    } catch (err) {
      console.error('Failed to convert inquiry to ticket:', err);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-7 h-7 text-blue-600" />
            Public Contact Messages
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Platform-level contact inquiries submitted through the public site.
          </p>
        </div>
        <button
          onClick={fetchInquiries}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition shadow-xs"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'NEW', 'READ', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED', 'CONVERTED'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search inquiries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Main Grid: List & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Inquiry List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden divide-y divide-gray-100 max-h-[700px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading inquiries...</div>
          ) : inquiries.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No contact inquiries found.</div>
          ) : (
            inquiries.map((inq) => (
              <div
                key={inq.id}
                onClick={() => handleSelectInquiry(inq)}
                className={`p-4 cursor-pointer hover:bg-blue-50/50 transition ${
                  selectedInquiry?.id === inq.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-blue-600">{inq.inquiry_number}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    inq.status === 'NEW' ? 'bg-green-100 text-green-700' :
                    inq.status === 'CONVERTED' ? 'bg-purple-100 text-purple-700' :
                    inq.status === 'RESOLVED' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {inq.status}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 truncate">{inq.subject}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{inq.name} ({inq.email})</p>
                <div className="text-[10px] text-gray-400 mt-2">
                  {new Date(inq.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Inquiry Details & Threading */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-xs p-6 flex flex-col min-h-[600px]">
          {selectedInquiry ? (
            <div className="flex-1 flex flex-col justify-between space-y-6">
              {/* Header Details */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-600">{selectedInquiry.inquiry_number}</span>
                      <span className="text-xs text-gray-400">• {new Date(selectedInquiry.created_at).toLocaleString()}</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mt-1">{selectedInquiry.subject}</h2>
                    <p className="text-xs text-gray-600 mt-1">
                      From: <span className="font-semibold text-gray-900">{selectedInquiry.name}</span> ({selectedInquiry.email})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedInquiry.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700"
                    >
                      <option value="NEW">NEW</option>
                      <option value="READ">READ</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="ARCHIVED">ARCHIVED</option>
                    </select>

                    {!selectedInquiry.converted_ticket_id ? (
                      <button
                        onClick={handleConvertToTicket}
                        disabled={converting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-xl hover:bg-purple-700 transition"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        {converting ? 'Converting...' : 'Convert to Ticket'}
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-xl border border-purple-200">
                        Converted to Ticket #{selectedInquiry.converted_ticket_id}
                      </span>
                    )}
                  </div>
                </div>

                {messageAlert && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-xl font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    {messageAlert}
                  </div>
                )}
              </div>

              {/* Conversation Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[350px] pr-2 my-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-2xl border ${
                      msg.is_internal
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : msg.sender_id
                        ? 'bg-blue-50 border-blue-200 text-blue-900 ml-6'
                        : 'bg-gray-50 border-gray-200 text-gray-900 mr-6'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span>{msg.sender_name} {msg.is_internal ? '(Internal Note)' : ''}</span>
                      <span className="text-[10px] text-gray-400">{new Date(msg.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                  </div>
                ))}
              </div>

              {/* Reply / Internal Note Form */}
              <form onSubmit={handleSendReply} className="pt-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700">Add Reply or Internal Note</label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-amber-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <Lock className="w-3.5 h-3.5" /> Internal Note Only
                  </label>
                </div>

                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={isInternal ? "Write internal note (hidden from visitor)..." : "Write response to send via email..."}
                  className="w-full p-3 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || !replyText.trim()}
                    className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl text-white transition disabled:opacity-50 ${
                      isInternal ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? 'Sending...' : isInternal ? 'Post Note' : 'Send Email Reply'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 p-8">
              <Mail className="w-12 h-12 mb-3 text-gray-300" />
              <h3 className="text-base font-bold text-gray-700">Select a Contact Inquiry</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Click on any inquiry from the left menu to view the full message thread, respond, or convert it to a support ticket.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
