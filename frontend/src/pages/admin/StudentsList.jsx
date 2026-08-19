import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, CheckCircle, Upload } from 'lucide-react';
import API_URL from '../../config/api';

const normalizeGender = (value) => {
  if (value === 'M') return 'Male';
  if (value === 'F') return 'Female';
  return value || '';
};

export default function StudentsList() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    admission_number: '',
    first_name: '',
    last_name: '',
    gender: '',
    age: '',
    dob: '',
    class_id: '',
    parent_name: '',
    parent_phone: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'last_name', direction: 'asc' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [stuRes, clsRes] = await Promise.all([
        axios.get(`${API_URL}/students`),
        axios.get(`${API_URL}/classes/classes`)
      ]);
      setStudents(stuRes.data.students);
      setClasses(clsRes.data.classes);
      if (clsRes.data.classes.length > 0) {
        setFormData(prev => ({ ...prev, class_id: clsRes.data.classes[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (student = null) => {
    if (student) {
      setEditingId(student.id);
      setFormData({
        admission_number: student.admission_number,
        first_name: student.first_name,
        last_name: student.last_name,
        gender: normalizeGender(student.gender),
        age: student.age || '',
        dob: student.dob ? new Date(student.dob).toISOString().split('T')[0] : '',
        class_id: student.class_id || '',
        parent_name: student.parent_name || '',
        parent_phone: student.parent_phone || '',
        email: '', password: '' // Password hidden for edits
      });
    } else {
      setEditingId(null);
      setFormData({
        admission_number: '', first_name: '', last_name: '', gender: '', age: '',
        dob: '', class_id: classes[0]?.id || '', parent_name: '', parent_phone: '',
        email: '', password: ''
      });
    }
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    const headers = ['Admission No', 'First Name', 'Last Name', 'Gender', 'Age', 'Class', 'Parent Name', 'Parent Phone'];
    const csvContent = [
      headers.join(','),
      ...filteredStudents.map(s => [
        s.admission_number, s.first_name, s.last_name, s.gender, s.age, s.class_name, s.parent_name, s.parent_phone
      ].map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'students_export.csv';
    link.click();
  };

  const filteredStudents = [...students]
    .filter(s => {
      const q = searchTerm.toLowerCase();
      return (s.first_name + ' ' + s.last_name).toLowerCase().includes(q) || s.admission_number.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setError('');
      if (!formData.class_id) {
          setError('Please create a class first.');
          return;
      }
      if (!formData.gender) {
          setError('Please select a valid gender.');
          return;
      }
      if (editingId) {
          await axios.put(`${API_URL}/students/${editingId}`, formData);
          setSuccess('Student record updated successfully!');
      } else {
          await axios.post(`${API_URL}/students`, formData);
          setSuccess('Student record created successfully!');
      }
      setTimeout(() => setSuccess(''), 3000);
      setShowModal(false);
      fetchData();
      setFormData({
        admission_number: '',
        first_name: '',
        last_name: '',
        gender: '',
        age: '',
        dob: '',
        class_id: classes[0]?.id || '',
        parent_name: '',
        parent_phone: '',
        email: '',
        password: ''
      });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to create student');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await axios.delete(`${API_URL}/students/${id}`);
        fetchData();
      } catch {
        alert('Failed to delete');
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Students Directory</h2>
          <p className="text-xs sm:text-sm text-gray-500">Manage student records and enrollments</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          <input 
            type="text" 
            placeholder="Search students..." 
            className="w-full sm:w-64 border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={handleExport}
              className="flex-1 sm:flex-none flex items-center justify-center px-3.5 py-2 bg-green-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-green-700 transition shadow-xs"
            >
              Export CSV
            </button>
            <Link
              to="/dashboard/admin/students/bulk-upload"
              className="flex-1 sm:flex-none flex items-center justify-center px-3.5 py-2 bg-gray-800 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-gray-900 transition shadow-xs"
            >
              <Upload className="w-4 h-4 mr-1.5" /> Bulk Upload
            </Link>
            <button 
              onClick={() => handleOpenModal()}
              className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add Student
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-xs border border-gray-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading students...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No students match your search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th onClick={() => handleSort('admission_number')} className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Admission No {sortConfig.key === 'admission_number' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th onClick={() => handleSort('last_name')} className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Name {sortConfig.key === 'last_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Parent Phone</th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map((stu) => (
                  <tr key={stu.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-semibold text-gray-900">{stu.admission_number}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 font-medium">{stu.first_name} {stu.last_name}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">{stu.class_name || 'Unassigned'}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">{stu.parent_phone || 'N/A'}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                      <button onClick={() => handleOpenModal(stu)} className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors mr-2" title="Edit Student">
                        <Edit2 className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => handleDelete(stu.id)} className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors" title="Delete Student">
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
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">{editingId ? 'Edit Student' : 'Register New Student'}</h3>
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Admission Number *</label>
                  <input type="text" required className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900" value={formData.admission_number} onChange={(e) => setFormData({...formData, admission_number: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Class *</label>
                  <select required className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900 bg-white" value={formData.class_id} onChange={(e) => setFormData({...formData, class_id: e.target.value})}>
                    <option value="">Select a class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} (Level {c.level})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input type="text" required className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900" value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input type="text" required className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900" value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select required className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900 bg-white" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Age</label>
                  <input type="number" min="1" max="120" className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input type="date" className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Parent/Guardian Name</label>
                  <input type="text" className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900" value={formData.parent_name} onChange={(e) => setFormData({...formData, parent_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Parent Phone</label>
                  <input type="tel" className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900" value={formData.parent_phone} onChange={(e) => setFormData({...formData, parent_phone: e.target.value})} />
                </div>

                {!editingId && (
                  <div className="sm:col-span-2 border-t pt-4 mt-2 space-y-4">
                    <h4 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2 text-blue-500" />
                      Parent Portal Account Link
                    </h4>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <label className={`p-2.5 border rounded-xl text-center text-xs font-semibold cursor-pointer transition ${formData.parent_action === 'CREATE_NEW' ? 'border-blue-600 bg-blue-50/50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                        <input type="radio" name="parent_action" value="CREATE_NEW" checked={formData.parent_action === 'CREATE_NEW'} onChange={(e) => setFormData({...formData, parent_action: e.target.value})} className="sr-only" />
                        Create New Parent
                      </label>
                      <label className={`p-2.5 border rounded-xl text-center text-xs font-semibold cursor-pointer transition ${formData.parent_action === 'LINK_EXISTING' ? 'border-blue-600 bg-blue-50/50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                        <input type="radio" name="parent_action" value="LINK_EXISTING" checked={formData.parent_action === 'LINK_EXISTING'} onChange={(e) => setFormData({...formData, parent_action: e.target.value})} className="sr-only" />
                        Link Existing Parent
                      </label>
                      <label className={`p-2.5 border rounded-xl text-center text-xs font-semibold cursor-pointer transition ${formData.parent_action === 'NONE' ? 'border-blue-600 bg-blue-50/50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                        <input type="radio" name="parent_action" value="NONE" checked={formData.parent_action === 'NONE'} onChange={(e) => setFormData({...formData, parent_action: e.target.value})} className="sr-only" />
                        No Parent Account
                      </label>
                    </div>

                    {formData.parent_action === 'CREATE_NEW' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Parent Email *</label>
                          <input type="email" required className="w-full rounded-xl border-gray-300 p-2 border text-xs" placeholder="parent@gmail.com" value={formData.parent_email || ''} onChange={(e) => setFormData({...formData, parent_email: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Relationship</label>
                          <select className="w-full rounded-xl border-gray-300 p-2 border text-xs bg-white" value={formData.parent_relationship || 'Parent'} onChange={(e) => setFormData({...formData, parent_relationship: e.target.value})}>
                            <option value="Father">Father</option>
                            <option value="Mother">Mother</option>
                            <option value="Guardian">Guardian</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <h4 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                        Student Login Credentials
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Student Login Email *</label>
                          <input type="email" required className="w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="student@school.com" />
                          <p className="text-[11px] text-gray-500 mt-1">An invitation link with a 1-click password setup will be emailed to the student.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {error && <p className="text-red-500 text-xs sm:text-sm mt-3 font-medium">{error}</p>}
              {success && <p className="text-green-500 text-xs sm:text-sm mt-3 font-medium">{success}</p>}
              <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2.5 border-t pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition shadow-xs">{editingId ? 'Update Student' : 'Register Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
