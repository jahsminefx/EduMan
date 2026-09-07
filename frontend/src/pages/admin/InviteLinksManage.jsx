import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Link as LinkIcon, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  ExternalLink,
  QrCode
} from 'lucide-react';
import API_URL from '../../config/api';

export default function InviteLinksManage() {
  const [links, setLinks] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [createdModalLink, setCreatedModalLink] = useState(null);

  const [formData, setFormData] = useState({
    role: 'Student',
    class_id: '',
    max_uses: '0',
    expires_in_days: '7'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchInviteLinks();
    fetchClasses();
  }, []);

  const fetchInviteLinks = async () => {
    try {
      const res = await axios.get(`${API_URL}/invite-links`);
      setLinks(res.data.inviteLinks || []);
    } catch (err) {
      console.error('Failed to load invite links:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await axios.get(`${API_URL}/classes/classes`);
      setClasses(res.data.classes || []);
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  };

  const handleOpenModal = () => {
    setFormData({
      role: 'Student',
      class_id: '',
      max_uses: '0',
      expires_in_days: '7'
    });
    setError('');
    setCreatedModalLink(null);
    setShowModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/invite-links`, {
        role: formData.role,
        class_id: formData.class_id || null,
        max_uses: parseInt(formData.max_uses, 10) || 0,
        expires_in_days: parseInt(formData.expires_in_days, 10) || 0
      });
      setCreatedModalLink(res.data.inviteLink);
      setSuccess('Invitation link generated successfully!');
      fetchInviteLinks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create invitation link');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this invitation link? Users will no longer be able to sign up using it.')) {
      return;
    }
    try {
      await axios.delete(`${API_URL}/invite-links/${id}`);
      fetchInviteLinks();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to revoke link');
    }
  };

  const getJoinUrl = (displayCode) => {
    return `${window.location.origin}/join/${displayCode}`;
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Stats calculation
  const totalLinks = links.length;
  const activeLinks = links.filter(l => l.status === 'ACTIVE').length;
  const totalRegistrations = links.reduce((acc, l) => acc + (l.used_count || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LinkIcon className="w-7 h-7 text-indigo-600" />
            School Invitation Links
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Generate shareable sign-up links for students, teachers, or parents to self-register into your school.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors gap-2"
        >
          <Plus className="w-4 h-4" />
          Generate New Link
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <LinkIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Links</p>
            <p className="text-2xl font-bold text-gray-900">{totalLinks}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Active Links</p>
            <p className="text-2xl font-bold text-emerald-600">{activeLinks}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Self-Registered Users</p>
            <p className="text-2xl font-bold text-purple-600">{totalRegistrations}</p>
          </div>
        </div>
      </div>

      {/* Links List Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Active & Past Invitation Links</h2>
          <span className="text-xs text-gray-500">{links.length} total generated</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading invitation links...</div>
        ) : links.length === 0 ? (
          <div className="p-12 text-center">
            <LinkIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No Invitation Links Created Yet</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
              Click "Generate New Link" to create a custom sign-up URL for students or teachers.
            </p>
            <button
              onClick={handleOpenModal}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors gap-2"
            >
              <Plus className="w-4 h-4" />
              Generate First Link
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-semibold">Invite Code</th>
                  <th className="px-6 py-3 font-semibold">Target Role</th>
                  <th className="px-6 py-3 font-semibold">Pre-assigned Class</th>
                  <th className="px-6 py-3 font-semibold">Usage</th>
                  <th className="px-6 py-3 font-semibold">Expires At</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {links.map((link) => {
                  const joinUrl = getJoinUrl(link.display_code);
                  const isCopied = copiedId === link.id;

                  return (
                    <tr key={link.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded inline-block">
                          {link.display_code}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          link.role === 'Student' ? 'bg-blue-100 text-blue-800' :
                          link.role === 'Teacher' ? 'bg-purple-100 text-purple-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {link.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {link.class_name ? (
                          <span className="font-medium text-gray-900">{link.class_name}</span>
                        ) : (
                          <span className="text-gray-400 italic">General (None)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        <span className="font-semibold text-gray-900">{link.used_count}</span>
                        <span className="text-gray-400"> / {link.max_uses > 0 ? link.max_uses : '∞'}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {link.expires_at ? (
                          <span className="flex items-center gap-1.5 text-xs">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {new Date(link.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Never Expires</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {link.status === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        )}
                        {link.status === 'EXPIRED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" /> Expired
                          </span>
                        )}
                        {link.status === 'EXHAUSTED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                            <AlertCircle className="w-3 h-3" /> Exhausted
                          </span>
                        )}
                        {link.status === 'REVOKED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3" /> Revoked
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => copyToClipboard(joinUrl, link.id)}
                            className={`p-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                              isCopied 
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                            title="Copy full join URL"
                          >
                            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                            {isCopied ? 'Copied!' : 'Copy'}
                          </button>
                          
                          {link.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleRevoke(link.id)}
                              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                              title="Revoke link"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Generate Link */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-5">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-indigo-600" />
                Generate Invitation Link
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {createdModalLink ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-emerald-900 text-base">Link Generated Successfully!</h4>
                  <p className="text-xs text-emerald-700 mt-1">
                    Share this code or link with students or staff to allow self-registration into your school.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Invite Code</label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-indigo-700 bg-white px-3 py-1.5 border border-indigo-200 rounded-lg flex-1 text-center">
                        {createdModalLink.display_code}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Full Registration URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={getJoinUrl(createdModalLink.display_code)}
                        className="text-xs text-gray-800 bg-white border border-gray-300 rounded-lg px-3 py-2 flex-1 focus:outline-none"
                      />
                      <button
                        onClick={() => copyToClipboard(getJoinUrl(createdModalLink.display_code), 'modal-copy')}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shrink-0"
                      >
                        {copiedId === 'modal-copy' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedId === 'modal-copy' ? 'Copied' : 'Copy Link'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Target User Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="Student">Student</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Parent">Parent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Pre-assign to Class (Optional)</label>
                  <select
                    value={formData.class_id}
                    onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">No Class (General School Invite)</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} (Level {cls.level})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">If selected, new students will be automatically placed in this class.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Max Usages</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.max_uses}
                      onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                      placeholder="0 for unlimited"
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">0 = Unlimited uses</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Expiration</label>
                    <select
                      value={formData.expires_in_days}
                      onChange={(e) => setFormData({ ...formData, expires_in_days: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="1">1 Day</option>
                      <option value="7">7 Days</option>
                      <option value="30">30 Days</option>
                      <option value="90">90 Days</option>
                      <option value="0">Never Expires</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Generating...' : 'Generate Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
