import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FileSpreadsheet, ShieldAlert } from 'lucide-react';
import API_URL from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

export default function GradesEntry() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [termId, setTermId] = useState('');
  const [assessmentType, setAssessmentType] = useState('test');
  const [maxScore, setMaxScore] = useState(100);

  const [students, setStudents] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorConfig, setErrorConfig] = useState('');

  const isTeacher = user.role === 'Teacher';

  const subjectsForSelectedClass = useMemo(() => {
    if (!isTeacher) return subjects;
    const classItem = classes.find(item => String(item.id) === String(selectedClass));
    return classItem?.subjects || [];
  }, [classes, isTeacher, selectedClass, subjects]);

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    if (!isTeacher) return;

    const hasSelectedSubject = subjectsForSelectedClass.some(subject => String(subject.id) === String(selectedSubject));
    if (subjectsForSelectedClass.length > 0 && !hasSelectedSubject) {
      setSelectedSubject(subjectsForSelectedClass[0].id);
    }
    if (subjectsForSelectedClass.length === 0) {
      setSelectedSubject('');
    }
  }, [isTeacher, selectedSubject, subjectsForSelectedClass]);

  useEffect(() => {
    if (selectedClass && selectedSubject && termId && assessmentType) {
      fetchGrades();
    } else {
      setStudents([]);
    }
  }, [selectedClass, selectedSubject, termId, assessmentType]);

  const buildTeacherClassOptions = (assignments) => {
    const classMap = new Map();

    for (const assignment of assignments) {
      const classId = assignment.class_id;
      if (!classMap.has(classId)) {
        classMap.set(classId, {
          id: classId,
          name: assignment.class_name,
          level: assignment.class_level,
          subjects: []
        });
      }

      classMap.get(classId).subjects.push({
        id: assignment.subject_id,
        name: assignment.subject_name,
        code: assignment.subject_code
      });
    }

    return [...classMap.values()];
  };

  const fetchOptions = async () => {
    setOptionsLoading(true);
    setErrorConfig('');
    try {
      const profilePromise = axios.get(`${API_URL}/schools/profile`);

      if (isTeacher) {
        const [assignmentRes, profileRes] = await Promise.all([
          axios.get(`${API_URL}/assignments/my`),
          profilePromise
        ]);

        const teacherClasses = buildTeacherClassOptions(assignmentRes.data.assignments || []);
        setClasses(teacherClasses);
        setSubjects([]);

        if (teacherClasses.length > 0) {
          setSelectedClass(teacherClasses[0].id);
          setSelectedSubject(teacherClasses[0].subjects[0]?.id || '');
        } else {
          setSelectedClass('');
          setSelectedSubject('');
        }

        const profile = profileRes.data.profile;
        if (profile?.current_term_id) {
          setTermId(profile.current_term_id.toString());
        } else {
          setErrorConfig('Your school has not set an active academic term yet. Please contact the School Admin.');
        }
        return;
      }

      const [clsRes, subRes, profileRes] = await Promise.all([
        axios.get(`${API_URL}/classes/classes`),
        axios.get(`${API_URL}/classes/subjects`),
        profilePromise
      ]);

      setClasses(clsRes.data.classes || []);
      setSubjects(subRes.data.subjects || []);

      const profile = profileRes.data.profile;
      if (profile?.current_term_id) {
        setTermId(profile.current_term_id.toString());
      } else {
        setErrorConfig('Your school has not set an active academic term yet. Please configure it in Settings.');
      }

      if (clsRes.data.classes?.length > 0) setSelectedClass(clsRes.data.classes[0].id);
      if (subRes.data.subjects?.length > 0) setSelectedSubject(subRes.data.subjects[0].id);
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Failed to load grade entry options.');
    } finally {
      setOptionsLoading(false);
    }
  };

  const fetchGrades = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.get(`${API_URL}/grades`, {
        params: {
          class_id: selectedClass,
          subject_id: selectedSubject,
          term_id: termId,
          type: assessmentType
        }
      });

      const records = res.data.records.map(record => ({
        ...record,
        score: record.score !== null ? record.score : ''
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

  const handleClassChange = (classId) => {
    setSelectedClass(classId);
    if (!isTeacher) return;

    const classItem = classes.find(item => String(item.id) === String(classId));
    setSelectedSubject(classItem?.subjects[0]?.id || '');
  };

  const handleScoreChange = (studentId, value) => {
    setStudents(students.map(student =>
      student.student_id === studentId ? { ...student, score: value } : student
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
        records: students.map(student => ({
          student_id: student.student_id,
          score: Number(student.score) || 0
        }))
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

  const showTeacherEmptyState = isTeacher && !optionsLoading && classes.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Grade Entry</h2>
          <p className="text-xs sm:text-sm text-gray-500">Record assessment scores for assigned courses</p>
        </div>
      </div>

      {optionsLoading ? (
        <div className="p-8 text-center text-xs sm:text-sm text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-xs">
          Loading grade options...
        </div>
      ) : showTeacherEmptyState ? (
        <div className="bg-white border border-dashed border-blue-200 rounded-2xl p-6 sm:p-8 text-center shadow-xs">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900">No Assigned Courses</h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Your gradebook will appear after your School Admin assigns you to a class and subject.
          </p>
        </div>
      ) : (
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              className="block w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900 bg-white"
              value={selectedClass}
              onChange={(event) => handleClassChange(event.target.value)}
            >
              <option value="">-- Choose --</option>
              {classes.map(classItem => <option key={classItem.id} value={classItem.id}>{classItem.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              className="block w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900 bg-white"
              value={selectedSubject}
              onChange={(event) => setSelectedSubject(event.target.value)}
            >
              <option value="">-- Choose --</option>
              {subjectsForSelectedClass.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              className="block w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900 bg-white"
              value={assessmentType}
              onChange={(event) => setAssessmentType(event.target.value)}
            >
              <option value="test">Continuous Assessment / Test</option>
              <option value="assignment">Assignment</option>
              <option value="exam">Final Exam</option>
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Max Score</label>
            <input
              type="number"
              className="block w-full rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2.5 border text-sm text-gray-900"
              value={maxScore}
              onChange={(event) => setMaxScore(Number(event.target.value))}
              min="1"
            />
          </div>
        </div>
      )}

      {errorConfig && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-2xl border border-yellow-200 text-xs sm:text-sm font-medium shadow-xs">
          {errorConfig}
        </div>
      )}

      {message && (
        <div className={`p-4 rounded-2xl text-xs sm:text-sm font-medium ${message.includes('success') ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs sm:text-sm text-gray-500 bg-white rounded-2xl border border-gray-100">Loading grade spreadsheet...</div>
      ) : students.length > 0 ? (
        <div className="bg-white shadow-xs border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Roll / ID</th>
                  <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Student Name</th>
                  <th className="px-4 sm:px-6 py-3.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Score (out of {maxScore})</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.student_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 font-mono">{student.admission_number}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-gray-900">{student.first_name} {student.last_name}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                      <input
                        type="number"
                        min="0"
                        max={maxScore}
                        className="inline-block w-24 sm:w-28 text-right rounded-xl border-gray-300 shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2 border text-sm text-gray-900 font-semibold"
                        value={student.score}
                        onChange={(event) => handleScoreChange(student.student_id, event.target.value)}
                        placeholder="0"
                      />
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
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Grades'}
            </button>
          </div>
        </div>
      ) : selectedClass && selectedSubject && !showTeacherEmptyState ? (
        <div className="p-8 text-center text-xs sm:text-sm text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-xs">
          No students found matching this class.
        </div>
      ) : null}
    </div>
  );
}

