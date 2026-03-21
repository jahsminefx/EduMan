import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, CheckCircle } from 'lucide-react';
import API_URL from '../../config/api';

export default function StudentsList() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    admission_number: '',
    first_name: '',
    last_name: '',
    gender: 'M',
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
        gender: student.gender || 'M',
        dob: student.dob ? new Date(student.dob).toISOString().split('T')[0] : '',
        class_id: student.class_id || '',
        parent_name: student.parent_name || '',
        parent_phone: student.parent_phone || '',
        email: '', password: '' // Password hidden for edits
      });
    } else {
      setEditingId(null);
      setFormData({
        admission_number: '', first_name: '', last_name: '', gender: 'M',
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
    const headers = ['Admission No', 'First Name', 'Last Name', 'Gender', 'Class', 'Parent Name', 'Parent Phone'];
    const csvContent = [
      headers.join(','),
      ...filteredStudents.map(s => [
        s.admission_number, s.first_name, s.last_name, s.gender, s.class_name, s.parent_name, s.parent_phone
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
        gender: 'M',
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
      } catch (err) {
        alert('Failed to delete');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Students Directory</h2>
          <p className="text-sm text-gray-500">Manage student records and enrollments</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            placeholder="Search students..." 
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
          >
            Export CSV
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Student
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading students...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No students match your search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th onClick={() => handleSort('admission_number')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100">Admission No {sortConfig.key === 'admission_number' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th onClick={() => handleSort('last_name')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100">Name {sortConfig.key === 'last_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent Phone</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map((stu) => (
                  <tr key={stu.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stu.admission_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stu.first_name} {stu.last_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stu.class_name || 'Unassigned'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stu.parent_phone || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleOpenModal(stu)} className="text-blue-600 hover:text-blue-900 mr-4"><Edit2 className="w-4 h-4 inline" /></button>
                      <button onClick={() => handleDelete(stu.id)} className="text-red-600 hover:text-red-900"><Trash2 className="w-4 h-4 inline" /></button>
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
            <h3 className="text-lg font-bold mb-4">Register New Student</h3>
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Admission Number *</label>
                  <input type="text" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.admission_number} onChange={(e) => setFormData({...formData, admission_number: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Class *</label>
                  <select required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.class_id} onChange={(e) => setFormData({...formData, class_id: e.target.value})}>
                    <option value="">Select a class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} (Level {c.level})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name *</label>
                  <input type="text" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                  <input type="text" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Gender</label>
                  <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                  <input type="date" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Parent/Guardian Name</label>
                  <input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.parent_name} onChange={(e) => setFormData({...formData, parent_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Parent Phone</label>
                  <input type="tel" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.parent_phone} onChange={(e) => setFormData({...formData, parent_phone: e.target.value})} />
                </div>
                <div className="md:col-span-2 border-t pt-4 mt-2">
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    Student Login Credentials
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email Address *</label>
                      <input type="email" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="student@school.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Login Password *</label>
                      <input type="password" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Min 6 characters" />
                    </div>
                  </div>
                </div>
              </div>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              {success && <p className="text-green-500 text-sm mt-2">{success}</p>}
              <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Register Student</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
