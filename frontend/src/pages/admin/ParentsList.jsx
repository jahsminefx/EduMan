import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  GraduationCap, 
  Mail, 
  Calendar, 
  AlertCircle, 
  CheckCircle,
  Link as LinkIcon,
  UserCheck,
  UserX,
  Filter,
  X
} from 'lucide-react';
import API_URL from '../../config/api';

export default function ParentsList() {
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLinkStatus, setFilterLinkStatus] = useState('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [admissionNumberInput, setAdmissionNumberInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchParents();
    fetchStudents();
  }, []);

  const fetchParents = async () => {
    try {
      const res = await axios.get(`${API_URL}/students/parents-list`);
      setParents(res.data.parents || []);
    } catch (err) {
      console.error('Failed to load parents:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await axios.get(`${API_URL}/students`);
      setStudents(res.data.students || []);
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  };

  const handleOpenLinkModal = (parent) => {
    setSelectedParent(parent);
    setSelectedStudentId('');
    setAdmissionNumberInput('');
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        parent_user_id: selectedParent.id,
        student_id: selectedStudentId || undefined,
        admission_number: admissionNumberInput || undefined
      };

      const res = await axios.post(`${API_URL}/students/link-parent`, payload);
      setSuccess(res.data.message || 'Parent linked to student successfully!');
      fetchParents();
      setTimeout(() => {
        setShowModal(false);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to link parent and student.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async (linkId, parentName, studentName) => {
    if (!window.confirm(`Are you sure you want to remove the link between ${parentName} and ${studentName}?`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/students/unlink-parent/${linkId}`);
      fetchParents();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove link');
    }
  };

  const filteredParents = parents.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesName = p.name.toLowerCase().includes(term);
    const matchesEmail = p.email.toLowerCase().includes(term);
    const matchesChild = p.children && p.children.some(c => 
      c.full_name.toLowerCase().includes(term) || c.admission_number.toLowerCase().includes(term)
    );
    const matchesSearch = matchesName || matchesEmail || matchesChild;
    
    const isLinked = p.children && p.children.length > 0;
    const matchesStatus = filterLinkStatus === 'ALL' ||
      (filterLinkStatus === 'LINKED' && isLinked) ||
      (filterLinkStatus === 'UNLINKED' && !isLinked);

    return matchesSearch && matchesStatus;
  });

  const totalParents = parents.length;
  const linkedParents = parents.filter(p => p.children && p.children.length > 0).length;
  const unlinkedParents = totalParents - linkedParents;
  const totalLinkedChildren = parents.reduce((acc, p) => acc + (p.children ? p.children.length : 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Parents Directory & Linkages
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            View all parent accounts in your school, manage student connections, and link new children.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Parents</p>
            <p className="text-2xl font-bold text-gray-900">{totalParents}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Linked Parents</p>
            <p className="text-2xl font-bold text-emerald-600">{linkedParents}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Unlinked Parents</p>
            <p className="text-2xl font-bold text-amber-600">{unlinkedParents}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Linked Students</p>
            <p className="text-2xl font-bold text-purple-600">{totalLinkedChildren}</p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search parents by name, email, or child's name/admission number..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-indigo-600" /> Filter:
          </div>
          <select
            value={filterLinkStatus}
            onChange={(e) => setFilterLinkStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
          >
            <option value="ALL">All Link Statuses</option>
            <option value="LINKED">Linked to Students</option>
            <option value="UNLINKED">Unlinked</option>
          </select>

          {(filterLinkStatus !== 'ALL' || searchTerm) && (
            <button
              onClick={() => {
                setFilterLinkStatus('ALL');
                setSearchTerm('');
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-2 rounded-lg transition"
            >
              <X className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Parents Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading parent accounts...</div>
        ) : filteredParents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No Parents Found</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {searchTerm ? 'No parents match your search query.' : 'No parent accounts have registered or been linked in this school yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-semibold">Parent Name</th>
                  <th className="px-6 py-3 font-semibold">Email</th>
                  <th className="px-6 py-3 font-semibold">Linked Children</th>
                  <th className="px-6 py-3 font-semibold">Registered Date</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredParents.map((parent) => (
                  <tr key={parent.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {parent.name}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className="flex items-center gap-1.5 text-xs">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {parent.email}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {parent.children && parent.children.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {parent.children.map((child) => (
                            <span 
                              key={child.link_id} 
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg text-xs font-medium"
                            >
                              <GraduationCap className="w-3.5 h-3.5 text-purple-600" />
                              <span>{child.full_name}</span>
                              <span className="font-mono text-purple-600 text-[10px]">({child.admission_number})</span>
                              {child.class_name && (
                                <span className="bg-purple-200/60 px-1.5 py-0.5 rounded text-[10px] text-purple-900">
                                  {child.class_name}
                                </span>
                              )}
                              <button
                                onClick={() => handleUnlink(child.link_id, parent.name, child.full_name)}
                                className="ml-1 text-purple-400 hover:text-red-600 transition-colors"
                                title={`Unlink ${child.full_name}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <AlertCircle className="w-3 h-3" /> No Student Linked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {parent.created_at ? new Date(parent.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenLinkModal(parent)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Link Student
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Link Student Modal */}
      {showModal && selectedParent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-indigo-600" />
                Link Student to {selectedParent.name}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {success}
              </div>
            )}

            <form onSubmit={handleLinkSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Select Student from Roster
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    setSelectedStudentId(e.target.value);
                    if (e.target.value) setAdmissionNumberInput('');
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">-- Choose a Student --</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name} ({student.admission_number}) {student.class_name ? `- ${student.class_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-3 text-xs text-gray-400 font-semibold uppercase">Or Enter ID</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Student Admission Number
                </label>
                <input
                  type="text"
                  value={admissionNumberInput}
                  onChange={(e) => {
                    setAdmissionNumberInput(e.target.value);
                    if (e.target.value) setSelectedStudentId('');
                  }}
                  placeholder="e.g. GF-2025-001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono uppercase"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!selectedStudentId && !admissionNumberInput.trim())}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Linking...' : 'Establish Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
