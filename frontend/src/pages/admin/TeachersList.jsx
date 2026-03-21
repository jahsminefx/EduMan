import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Trash2, Mail, Phone, Edit2, Check, BookOpen } from 'lucide-react';
import API_URL from '../../config/api';

export default function TeachersList() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    class_ids: []
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'last_name', direction: 'asc' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [teachRes, clsRes] = await Promise.all([
        axios.get(`${API_URL}/teachers`),
        axios.get(`${API_URL}/classes/classes`)
      ]);
      setTeachers(teachRes.data.teachers);
      setClasses(clsRes.data.classes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Assigned Classes'];
    const csvContent = [
      headers.join(','),
      ...filteredTeachers.map(t => [
        t.first_name, 
        t.last_name, 
        t.email, 
        t.phone, 
        (t.classes || []).map(c => c.name).join('; ')
      ].map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'teachers_export.csv';
    link.click();
  };

  const filteredTeachers = [...teachers]
    .filter(t => {
      const q = searchTerm.toLowerCase();
      return (t.first_name + ' ' + t.last_name).toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || (t.phone && t.phone.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const handleOpenModal = (teacher = null) => {
    if (teacher) {
      setEditingId(teacher.id);
      setFormData({
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        email: teacher.email,
        password: '', // Password not editable for security simplified for MVP
        phone: teacher.phone || '',
        class_ids: teacher.classes ? teacher.classes.map(c => c.id) : []
      });
    } else {
      setEditingId(null);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        phone: '',
        class_ids: []
      });
    }
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      if (editingId) {
        await axios.put(`${API_URL}/teachers/${editingId}`, formData);
        setSuccess('Teacher updated successfully!');
      } else {
        await axios.post(`${API_URL}/teachers`, formData);
        setSuccess('Teacher account created successfully!');
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
    if (window.confirm('Are you sure you want to delete this teacher? Their account will also be removed.')) {
      try {
        await axios.delete(`${API_URL}/teachers/${id}`);
        fetchData();
      } catch (err) {
        alert('Failed to delete teacher');
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
          <h2 className="text-xl font-semibold text-gray-800">Teachers Directory</h2>
          <p className="text-sm text-gray-500">Manage teaching staff and their class assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            placeholder="Search teachers..." 
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
            <Plus className="w-4 h-4 mr-2" /> Add Teacher
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading teachers...</div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No teachers match your search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th onClick={() => handleSort('first_name')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100">Teacher Name {sortConfig.key === 'first_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Classes</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{teacher.first_name} {teacher.last_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center text-sm text-gray-500"><Mail className="w-3 h-3 mr-1"/> {teacher.email}</span>
                        {teacher.phone && <span className="flex items-center text-sm text-gray-500"><Phone className="w-3 h-3 mr-1"/> {teacher.phone}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {teacher.classes && teacher.classes.length > 0 ? (
                          teacher.classes.map(c => (
                            <span key={c.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                              <BookOpen className="w-2.5 h-2.5 mr-1" />
                              {c.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleOpenModal(teacher)} className="text-blue-600 hover:text-blue-900 mr-4">
                        <Edit2 className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => handleDelete(teacher.id)} className="text-red-600 hover:text-red-900">
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
            <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit Teacher' : 'Add New Teacher'}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {editingId ? 'Update teacher details and class assignments.' : 'This will generate a teacher account they can use to log in.'}
            </p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">First Name *</label>
                      <input type="text" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                      <input type="text" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} />
                    </div>
                  </div>
                  
                  {!editingId && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email Login *</label>
                        <input type="email" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Temporary Password *</label>
                        <input type="password" required minLength="6" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input type="tel" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign Classes</label>
                  <div className="border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto space-y-2 bg-gray-50">
                    {classes.map(cls => (
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
                    ))}
                  </div>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              {success && <p className="text-green-500 text-sm mt-2">{success}</p>}

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                  {editingId ? 'Update Profile' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
