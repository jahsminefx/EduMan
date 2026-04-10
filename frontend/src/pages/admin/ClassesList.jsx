import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, UserCheck } from 'lucide-react';
import API_URL from '../../config/api';

export default function ClassesList() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', level: 1, form_teacher_id: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClasses = classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await axios.get(`${API_URL}/classes/classes`);
      setClasses(res.data.classes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const res = await axios.get(`${API_URL}/teachers`);
      setTeachers(res.data.teachers);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenModal = (cls = null) => {
    if (cls) {
      setEditingId(cls.id);
      setFormData({ name: cls.name, level: cls.level, form_teacher_id: cls.form_teacher_id || '' });
    } else {
      setEditingId(null);
      setFormData({ name: '', level: 1, form_teacher_id: '' });
    }
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const payload = {
        ...formData,
        form_teacher_id: formData.form_teacher_id || null
      };
      if (editingId) {
        await axios.put(`${API_URL}/classes/classes/${editingId}`, payload);
        setSuccess('Class updated successfully!');
      } else {
        await axios.post(`${API_URL}/classes/classes`, payload);
        setSuccess('Class created successfully!');
      }
      setTimeout(() => setSuccess(''), 3000);
      setShowModal(false);
      fetchClasses();
      setFormData({ name: '', level: 1, form_teacher_id: '' });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this class? This will completely remove it from the system.')) {
      try {
        await axios.delete(`${API_URL}/classes/classes/${id}`);
        fetchClasses();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete class');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Classes</h2>
          <p className="text-sm text-gray-500">Manage school classes and levels</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            placeholder="Search classes..." 
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Class
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading classes...</div>
        ) : filteredClasses.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No classes match your search.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form Teacher</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClasses.map((cls) => (
                <tr key={cls.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cls.level}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cls.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cls.form_teacher_name ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
                        <UserCheck className="w-3 h-3" />
                        {cls.form_teacher_name}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic text-xs">Not assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleOpenModal(cls)} className="text-blue-600 hover:text-blue-900 mr-4"><Edit2 className="w-4 h-4 inline" /></button>
                    <button onClick={() => handleDelete(cls.id)} className="text-red-600 hover:text-red-900"><Trash2 className="w-4 h-4 inline" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit Class' : 'Create New Class'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Class Name (e.g., Grade 1A)</label>
                  <input type="text" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Level (Numeric)</label>
                  <input type="number" required min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" value={formData.level} onChange={(e) => setFormData({...formData, level: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Form Teacher</label>
                  <select 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900 bg-white"
                    value={formData.form_teacher_id}
                    onChange={(e) => setFormData({...formData, form_teacher_id: e.target.value})}
                  >
                    <option value="">-- No Form Teacher --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">The Form Teacher can record attendance for this class</p>
                </div>
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                {success && <p className="text-green-500 text-sm mt-2">{success}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
