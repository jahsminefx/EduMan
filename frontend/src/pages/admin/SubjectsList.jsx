import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, BookMarked, Check, UserPlus, Users } from 'lucide-react';
import API_URL from '../../config/api';

export default function SubjectsList() {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    class_ids: []
  });
  const [teachers, setTeachers] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignData, setAssignData] = useState({
    subject_id: null,
    teacher_id: '',
    class_ids: []
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSubjects = subjects.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [subRes, clsRes, teaRes] = await Promise.all([
        axios.get(`${API_URL}/subjects`),
        axios.get(`${API_URL}/classes/classes`),
        axios.get(`${API_URL}/teachers`)
      ]);
      setSubjects(subRes.data.subjects);
      setClasses(clsRes.data.classes);
      setTeachers(teaRes.data.teachers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (subject = null) => {
    if (subject) {
      setEditingId(subject.id);
      setFormData({
        name: subject.name,
        code: subject.code || '',
        class_ids: subject.classes.map(c => c.id)
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        code: '',
        class_ids: []
      });
    }
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleAssignTeacher = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await axios.post(`${API_URL}/subjects/${assignData.subject_id}/assign`, {
        teacher_id: assignData.teacher_id,
        class_ids: assignData.class_ids
      });
      setSuccess('Teacher assigned successfully!');
      setTimeout(() => {
        setShowAssignModal(false);
        fetchData();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Assignment failed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      if (editingId) {
        await axios.put(`${API_URL}/subjects/${editingId}`, formData);
        setSuccess('Subject updated successfully!');
      } else {
        await axios.post(`${API_URL}/subjects`, formData);
        setSuccess('Subject created successfully!');
      }
      setTimeout(() => {
        setShowModal(false);
        fetchData();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this subject?')) {
      try {
        await axios.delete(`${API_URL}/subjects/${id}`);
        fetchData();
      } catch {
        alert('Failed to delete subject');
      }
    }
  };

  const toggleClass = (classId) => {
    setFormData(prev => ({
      ...prev,
      class_ids: prev.class_ids.includes(classId)
        ? prev.class_ids.filter(id => id !== classId)
        : [...prev.class_ids, classId]
    }));
  };

  const toggleAllClasses = () => {
    setFormData(prev => ({
      ...prev,
      class_ids: prev.class_ids.length === classes.length ? [] : classes.map(c => c.id)
    }));
  };

  const toggleAssignClass = (classId) => {
    setAssignData(prev => ({
      ...prev,
      class_ids: prev.class_ids.includes(classId)
        ? prev.class_ids.filter(id => id !== classId)
        : [...prev.class_ids, classId]
    }));
  };

  const toggleAllAssignClasses = (subjectClasses) => {
    setAssignData(prev => ({
      ...prev,
      class_ids: prev.class_ids.length === subjectClasses.length ? [] : subjectClasses.map(c => c.id)
    }));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showModal) setShowModal(false);
        if (showAssignModal) setShowAssignModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, showAssignModal]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Subjects Management</h2>
          <p className="text-xs sm:text-sm text-gray-500">Define curriculum subjects and link them to classes</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <input 
            type="text" 
            placeholder="Search subjects..." 
            className="w-full sm:w-64 border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition shadow-xs w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Subject
          </button>
        </div>
      </div>

      <div className="bg-white shadow-xs border border-gray-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading subjects...</div>
        ) : filteredSubjects.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No subjects match your search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject Name</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned Classes</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Teachers</th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSubjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <BookMarked className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-semibold text-gray-900">{sub.name}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 font-mono">{sub.code || 'N/A'}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {sub.classes.length > 0 ? (
                          sub.classes.map(c => (
                            <span key={c.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] sm:text-xs font-medium rounded-full border border-blue-100">
                              {c.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 italic">None assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {sub.teachers && sub.teachers.length > 0 ? (
                          sub.teachers.map((t, i) => (
                            <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded-full border border-green-100 flex items-center font-medium">
                              <Users className="w-2.5 h-2.5 mr-1" /> {t.first_name} {t.last_name.charAt(0)}.
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 italic">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                      <button 
                        onClick={() => {
                          setAssignData({ subject_id: sub.id, teacher_id: '', class_ids: [] });
                          setShowAssignModal(true);
                        }} 
                        className="p-1.5 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors mr-2"
                        title="Assign Teacher"
                      >
                        <UserPlus className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => handleOpenModal(sub)} className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors mr-2" title="Edit Subject">
                        <Edit2 className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => handleDelete(sub.id)} className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors" title="Delete Subject">
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xl w-full max-w-2xl my-auto max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">{editingId ? 'Edit Subject' : 'Add New Subject'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Subject Name *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Mathematics"
                      className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900" 
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Subject Code (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. MATH-101"
                      className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900" 
                      value={formData.code} 
                      onChange={(e) => setFormData({...formData, code: e.target.value})} 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">Assign to Classes</label>
                    {classes.length > 0 && (
                      <button 
                        type="button" 
                        onClick={toggleAllClasses}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        {formData.class_ids.length === classes.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 bg-gray-50">
                    {classes.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No classes found. Please create classes first.</p>
                    ) : (
                      classes.map(cls => (
                        <div 
                          key={cls.id} 
                          onClick={() => toggleClass(cls.id)}
                          className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                            formData.class_ids.includes(cls.id) 
                              ? 'bg-blue-100 border border-blue-200 font-semibold' 
                              : 'bg-white border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-xs sm:text-sm text-gray-700">{cls.name}</span>
                          {formData.class_ids.includes(cls.id) && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Subjects must be assigned to classes to appear in gradebooks and reports.</p>
                </div>
              </div>

              {error && <p className="text-red-500 text-xs sm:text-sm mt-4 p-2 bg-red-50 rounded-xl border border-red-100 font-medium">{error}</p>}
              {success && <p className="text-green-500 text-xs sm:text-sm mt-4 p-2 bg-green-50 rounded-xl border border-green-100 font-medium">{success}</p>}

              <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2.5 border-t pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition shadow-xs">
                  {editingId ? 'Update Subject' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-xl w-full max-w-md my-auto max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">Assign Teacher to Subject</h3>
            <form onSubmit={handleAssignTeacher} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Select Teacher *</label>
                <select 
                  required 
                  className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900 bg-white"
                  value={assignData.teacher_id}
                  onChange={(e) => setAssignData({...assignData, teacher_id: e.target.value})}
                >
                  <option value="">Choose a teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700">Select Classes *</label>
                  {subjects.find(s => s.id === assignData.subject_id)?.classes.length > 0 && (
                    <button 
                      type="button" 
                      onClick={() => toggleAllAssignClasses(subjects.find(s => s.id === assignData.subject_id)?.classes || [])}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      {assignData.class_ids.length === (subjects.find(s => s.id === assignData.subject_id)?.classes || []).length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
                <div className="border border-gray-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2 bg-gray-50">
                  {subjects.find(s => s.id === assignData.subject_id)?.classes.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No classes available for this subject.</p>
                  ) : (
                    subjects.find(s => s.id === assignData.subject_id)?.classes.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => toggleAssignClass(c.id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                          assignData.class_ids.includes(c.id) 
                            ? 'bg-blue-100 border border-blue-200 font-semibold' 
                            : 'bg-white border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-xs sm:text-sm text-gray-700">{c.name}</span>
                        {assignData.class_ids.includes(c.id) && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                      </div>
                    ))
                  )}
                </div>
              </div>
              {error && <p className="text-red-500 text-xs sm:text-sm font-medium">{error}</p>}
              {success && <p className="text-green-500 text-xs sm:text-sm font-medium">{success}</p>}
              <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2.5 border-t pt-4">
                <button type="button" onClick={() => setShowAssignModal(false)} className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="w-full sm:w-auto px-5 py-2.5 bg-green-600 text-white font-semibold text-sm rounded-xl hover:bg-green-700 transition shadow-xs">Confirm Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
