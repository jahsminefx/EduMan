import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, BookMarked, Check, UserPlus, Users } from 'lucide-react';

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
    class_id: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [subRes, clsRes, teaRes] = await Promise.all([
        axios.get('http://localhost:5000/api/subjects'),
        axios.get('http://localhost:5000/api/classes/classes'),
        axios.get('http://localhost:5000/api/teachers')
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
      await axios.post(`http://localhost:5000/api/subjects/${assignData.subject_id}/assign`, {
        teacher_id: assignData.teacher_id,
        class_id: assignData.class_id
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
        await axios.put(`http://localhost:5000/api/subjects/${editingId}`, formData);
        setSuccess('Subject updated successfully!');
      } else {
        await axios.post('http://localhost:5000/api/subjects', formData);
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
        await axios.delete(`http://localhost:5000/api/subjects/${id}`);
        fetchData();
      } catch (err) {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Subjects Management</h2>
          <p className="text-sm text-gray-500">Define curriculum subjects and link them to classes</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Subject
        </button>
      </div>

      <div className="bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading subjects...</div>
        ) : subjects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No subjects found. Create one to define your school's curriculum.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Classes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teachers</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <BookMarked className="w-4 h-4 text-blue-500 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{sub.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.code || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {sub.classes.length > 0 ? (
                          sub.classes.map(c => (
                            <span key={c.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                              {c.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">None assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {sub.teachers && sub.teachers.length > 0 ? (
                          sub.teachers.map((t, i) => (
                            <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded-full border border-green-100 flex items-center">
                              <Users className="w-2 h-2 mr-1" /> {t.first_name} {t.last_name.charAt(0)}.
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 italic">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => {
                          setAssignData({ subject_id: sub.id, teacher_id: '', class_id: sub.classes[0]?.id || '' });
                          setShowAssignModal(true);
                        }} 
                        className="text-green-600 hover:text-green-900 mr-4"
                        title="Assign Teacher"
                      >
                        <UserPlus className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => handleOpenModal(sub)} className="text-blue-600 hover:text-blue-900 mr-4">
                        <Edit2 className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => handleDelete(sub.id)} className="text-red-600 hover:text-red-900">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit Subject' : 'Add New Subject'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Subject Name *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Mathematics"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" 
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Subject Code (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. MATH-101"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" 
                      value={formData.code} 
                      onChange={(e) => setFormData({...formData, code: e.target.value})} 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Classes</label>
                  <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-gray-50">
                    {classes.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No classes found. Please create classes first.</p>
                    ) : (
                      classes.map(cls => (
                        <div 
                          key={cls.id} 
                          onClick={() => toggleClass(cls.id)}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                            formData.class_ids.includes(cls.id) 
                              ? 'bg-blue-100 border border-blue-200' 
                              : 'bg-white border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-sm text-gray-700 font-medium">{cls.name}</span>
                          {formData.class_ids.includes(cls.id) && <Check className="w-4 h-4 text-blue-600" />}
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Subjects must be assigned to classes to appear in gradebooks and reports.</p>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm mt-4 p-2 bg-red-50 rounded border border-red-100">{error}</p>}
              {success && <p className="text-green-500 text-sm mt-4 p-2 bg-green-50 rounded border border-green-100">{success}</p>}

              <div className="mt-8 flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                  {editingId ? 'Update Subject' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Assign Teacher to Subject</h3>
            <form onSubmit={handleAssignTeacher} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Teacher *</label>
                <select 
                  required 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900"
                  value={assignData.teacher_id}
                  onChange={(e) => setAssignData({...assignData, teacher_id: e.target.value})}
                >
                  <option value="">Choose a teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Class *</label>
                <select 
                  required 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900"
                  value={assignData.class_id}
                  onChange={(e) => setAssignData({...assignData, class_id: e.target.value})}
                >
                  <option value="">Select class</option>
                  {subjects.find(s => s.id === assignData.subject_id)?.classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              {success && <p className="text-green-500 text-sm">{success}</p>}
              <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowAssignModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Confirm Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
