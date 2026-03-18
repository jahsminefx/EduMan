import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, FileSpreadsheet } from 'lucide-react';
import API_URL from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

export default function GradesEntry() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [termId, setTermId] = useState('1'); // Hardcoded for MVP, ideally fetched from active term
  const [assessmentType, setAssessmentType] = useState('test');
  const [maxScore, setMaxScore] = useState(100);
  
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    if (selectedClass && selectedSubject && termId && assessmentType) {
      fetchGrades();
    } else {
      setStudents([]);
    }
  }, [selectedClass, selectedSubject, termId, assessmentType]);

  const fetchOptions = async () => {
    try {
      const [clsRes, subRes] = await Promise.all([
        axios.get(`${API_URL}/classes/classes`),
        axios.get(`${API_URL}/classes/subjects`)
      ]);
      setClasses(clsRes.data.classes);
      setSubjects(subRes.data.subjects);
      if (clsRes.data.classes.length > 0) setSelectedClass(clsRes.data.classes[0].id);
      if (subRes.data.subjects.length > 0) setSelectedSubject(subRes.data.subjects[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGrades = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.get(`${API_URL}/grades?class_id=${selectedClass}&subject_id=${selectedSubject}&term_id=${termId}&type=${assessmentType}`);
      
      const records = res.data.records.map(r => ({
        ...r,
        score: r.score !== null ? r.score : ''
      }));
      setStudents(records);
      if (records.length > 0 && records[0].max_score) {
          setMaxScore(records[0].max_score);
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 403) {
        setMessage(err.response.data.message || 'You are not authorized to view grades for this class/subject.');
      } else {
        setMessage('Failed to load student grade records.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (studentId, value) => {
    setStudents(students.map(s => 
      s.student_id === studentId ? { ...s, score: value } : s
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        term_id: termId,
        class_id: selectedClass,
        subject_id: selectedSubject,
        type: assessmentType,
        max_score: maxScore,
        records: students.map(s => ({ student_id: s.student_id, score: Number(s.score) || 0 }))
      };
      await axios.post(`${API_URL}/grades`, payload);
      setMessage('Grades saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 403) {
        setMessage(err.response.data.message || 'You are not authorized to grade this class/subject combination.');
      } else {
        setMessage('Error saving grades. Please check your connection.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Grade Entry</h2>
          <p className="text-sm text-gray-500">Record assessment scores for your class</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
          <select 
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">-- Choose --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <select 
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="">-- Choose --</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select 
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900"
            value={assessmentType}
            onChange={(e) => setAssessmentType(e.target.value)}
          >
            <option value="test">Continuous Assessment / Test</option>
            <option value="assignment">Assignment</option>
            <option value="exam">Final Exam</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Score</label>
          <input 
            type="number"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900"
            value={maxScore}
            onChange={(e) => setMaxScore(Number(e.target.value))}
            min="1"
          />
        </div>
        <div>
             {/* Term would ideally be fetched, hardcoding 1 for MVP simplicity */}
             <label className="block text-sm font-medium text-gray-700 mb-1">Term ID (MVP)</label>
             <input type="text" value={termId} onChange={(e) => setTermId(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900" />
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.includes('success') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading grade spreadsheet...</div>
      ) : students.length > 0 ? (
        <div className="bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll / ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Score (out of {maxScore})</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.map((stu) => (
                <tr key={stu.student_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stu.admission_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stu.first_name} {stu.last_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <input 
                      type="number"
                      min="0"
                      max={maxScore}
                      className="inline-block w-24 text-right rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border text-gray-900"
                      value={stu.score}
                      onChange={(e) => handleScoreChange(stu.student_id, e.target.value)}
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center px-6 py-2 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 transition disabled:opacity-70"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Grades'}
            </button>
          </div>
        </div>
      ) : selectedClass && selectedSubject ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
          No students found matching this class.
        </div>
      ) : null}
    </div>
  );
}
