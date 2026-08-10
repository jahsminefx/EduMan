import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Save, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import API_URL from '../../config/api';

export default function AttendanceEntry() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass && selectedDate) {
      fetchAttendance();
    } else {
      setStudents([]);
    }
  }, [selectedClass, selectedDate]);

  const fetchClasses = async () => {
    try {
      const res = await axios.get(`${API_URL}/classes/classes`);
      let classList = res.data.classes;

      // For teachers: only show classes where they are the form teacher
      if (user.role === 'Teacher') {
        const teacherRes = await axios.get(`${API_URL}/teachers`);
        const teacherProfile = teacherRes.data.teachers.find(t => t.user_id === user.id);
        if (teacherProfile) {
          classList = classList.filter(c => c.form_teacher_id === teacherProfile.id);
        } else {
          classList = [];
        }
      }

      setClasses(classList);
      if (classList.length > 0) {
        setSelectedClass(classList[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.get(`${API_URL}/attendance?class_id=${selectedClass}&date=${selectedDate}`);
      // Initialize any null status to 'present' by default to save clicks, or leave empty to force choice
      const records = res.data.records.map(r => ({
        ...r,
        status: (r.status || 'present').toLowerCase()
      }));
      setStudents(records);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 403) {
        setMessage(err.response.data.message || 'You are not authorized to view this class.');
      } else {
        setMessage('Failed to load students.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId, status) => {
    setStudents(students.map(s => 
      s.student_id === studentId ? { ...s, status } : s
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        class_id: selectedClass,
        date: selectedDate,
        records: students.map(s => ({ student_id: s.student_id, status: s.status }))
      };
      await axios.post(`${API_URL}/attendance`, payload);
      const refreshToken = new Date().toISOString();
      localStorage.setItem('eduman:dashboard-refresh', refreshToken);
      window.dispatchEvent(new Event('eduman:dashboard-refresh'));
      setMessage('Attendance saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 403) {
        setMessage(err.response.data.message || 'You are not authorized to mark attendance for this class.');
      } else {
        setMessage('Error saving attendance.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Attendance Entry</h2>
          <p className="text-xs sm:text-sm text-gray-500">Mark daily student attendance</p>
        </div>
      </div>

      {user.role === 'Teacher' && classes.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-amber-800">No Classes Assigned</h4>
            <p className="text-xs text-amber-700 mt-1">You are not assigned as a Form Teacher for any class. Only Form Teachers can record attendance. Please contact your School Admin.</p>
          </div>
        </div>
      )}

      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
        <div className="flex-1 min-w-0">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Select Class</label>
          <select 
            className="block w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900 bg-white"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">-- Choose Class --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Date</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
            <input 
              type="date"
              className="block w-full pl-10 pr-3 py-2.5 rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent border text-sm text-gray-900"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl text-xs sm:text-sm font-medium ${message.includes('success') ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">Loading student list...</div>
      ) : students.length > 0 ? (
        <div className="bg-white shadow-xs border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Roll / ID</th>
                  <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Student Name</th>
                  <th className="px-4 sm:px-6 py-3.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((stu) => (
                  <tr key={stu.student_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 font-mono">{stu.admission_number}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-gray-900">{stu.first_name} {stu.last_name}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center items-center gap-2 sm:gap-4">
                        <button
                          onClick={() => handleStatusChange(stu.student_id, 'present')}
                          className={`flex items-center justify-center min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                            stu.status === 'present' 
                              ? 'bg-green-100 text-green-800 border-2 border-green-500 shadow-xs' 
                              : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                          }`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1 flex-shrink-0" /> Present
                        </button>
                        <button
                          onClick={() => handleStatusChange(stu.student_id, 'absent')}
                          className={`flex items-center justify-center min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                            stu.status === 'absent' 
                              ? 'bg-red-100 text-red-800 border-2 border-red-500 shadow-xs' 
                              : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                          }`}
                        >
                          <XCircle className="w-4 h-4 mr-1 flex-shrink-0" /> Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex justify-end sticky bottom-0 z-10 backdrop-blur-xs">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs hover:bg-blue-700 transition disabled:opacity-70"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </div>
      ) : selectedClass ? (
        <div className="p-8 text-center text-xs sm:text-sm text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-xs">
          No students found in this class. Please assign students first.
        </div>
      ) : null}
    </div>
  );
}

