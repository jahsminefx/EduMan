import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Printer, GraduationCap, BookOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import API_URL from '../../config/api';
import { mediaUrl } from '../../utils/media';

export default function ReportCard() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [termId, setTermId] = useState('');
  const [report, setReport] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [academicInfo, setAcademicInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isStudent = user.role === 'Student';

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    setError('');
    try {
      const [profileRes, sessionsRes, termsRes] = await Promise.all([
        axios.get(`${API_URL}/schools/profile`),
        axios.get(`${API_URL}/schools/sessions`),
        axios.get(`${API_URL}/schools/terms`)
      ]);
      setSessions(sessionsRes.data.sessions || []);
      setTerms(termsRes.data.terms || []);

      const activeSessionId = profileRes.data.profile?.current_session_id?.toString() || '';
      const activeTermId = profileRes.data.profile?.current_term_id?.toString() || '';
      setSessionId(activeSessionId);
      setTermId(activeTermId);
      setSchoolInfo(profileRes.data.profile || null);

      if (isStudent) {
        const studentRes = await axios.get(`${API_URL}/students/me`);
        const student = studentRes.data.student;
        setStudents([student]);
        setSelectedStudent(student.id);
        setStudentInfo(student);

        if (activeTermId) {
          await fetchReport(student.id, activeTermId);
        } else {
          setError('Your school has not set an active academic term yet.');
        }
        return;
      }

      const studentRes = await axios.get(`${API_URL}/students`);
      setStudents(studentRes.data.students || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load report card options.');
    }
  };

  const fetchReport = async (studentId = selectedStudent, term = termId) => {
    if (!studentId || !term) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/grades/report/${studentId}/${term}`);
      setReport(res.data.report);
      setStudentInfo(res.data.student || students.find(student => student.id === Number(studentId)) || null);
      setSchoolInfo(res.data.school || schoolInfo);
      setAcademicInfo(res.data.academic || null);
    } catch (err) {
      console.error(err);
      setReport(null);
      setStudentInfo(null);
      setAcademicInfo(null);
      setError(err.response?.data?.message || 'Failed to load this report card.');
    } finally {
      setLoading(false);
    }
  };

  const handleSessionChange = (value) => {
    setSessionId(value);
    setTermId('');
    setReport(null);
    setAcademicInfo(null);
  };

  const handlePrint = () => window.print();

  const subjectSummary = {};
  if (report) {
    for (const row of report) {
      if (!subjectSummary[row.subject_name]) {
        subjectSummary[row.subject_name] = { test: null, exam: null, assignment: null };
      }
      subjectSummary[row.subject_name][row.type] = { score: row.score, max: row.max_score };
    }
  }

  const subjects = Object.entries(subjectSummary);
  const totalObtained = subjects.reduce((sum, [, value]) => (
    sum + (value.test?.score || 0) + (value.exam?.score || 0)
  ), 0);
  const totalMax = subjects.reduce((sum, [, value]) => (
    sum + (value.test?.max || 0) + (value.exam?.max || 0)
  ), 0);
  const average = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : 0;

  const getGrade = (score) => {
    const numericScore = Number(score);
    if (numericScore >= 70) return 'A';
    if (numericScore >= 60) return 'B';
    if (numericScore >= 50) return 'C';
    if (numericScore >= 40) return 'D';
    return 'F';
  };

  const getRemark = (grade) => {
    const map = { A: 'Excellent', B: 'Very Good', C: 'Good', D: 'Fair', F: 'Needs Improvement' };
    return map[grade] || '';
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">{isStudent ? 'My Report Card' : 'Report Cards'}</h2>
            <p className="text-xs sm:text-sm text-gray-500">Academic performance report</p>
          </div>

          {isStudent ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 flex-wrap">
              <div className="w-full sm:w-48">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Session</label>
                <select value={sessionId} onChange={event => handleSessionChange(event.target.value)} className="border rounded-xl p-2.5 w-full text-sm bg-white shadow-xs focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Session</option>
                  {sessions.map(session => <option key={session.id} value={session.id}>{session.name}</option>)}
                </select>
              </div>
              <div className="w-full sm:w-48">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Term</label>
                <select value={termId} onChange={event => setTermId(event.target.value)} className="border rounded-xl p-2.5 w-full text-sm bg-white shadow-xs focus:ring-2 focus:ring-blue-500" disabled={!sessionId}>
                  <option value="">Select Term</option>
                  {terms.filter(term => String(term.session_id) === String(sessionId)).map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
                </select>
              </div>
              <button onClick={() => fetchReport()} className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-xs sm:text-sm font-semibold transition shadow-xs">Load Report</button>
              <div className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-xs sm:text-sm font-bold flex items-center justify-center">
                <BookOpen className="w-4 h-4 mr-2" />
                My Report Card
              </div>
              {report && (
                <button onClick={handlePrint} className="w-full sm:w-auto flex items-center justify-center px-5 py-2.5 bg-gray-800 text-white rounded-xl hover:bg-gray-900 text-xs sm:text-sm font-semibold transition shadow-xs">
                  <Printer className="w-4 h-4 mr-1.5" /> Print
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 flex-wrap">
              <div className="w-full sm:w-60">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Student</label>
                <select value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)} className="border rounded-xl p-2.5 w-full text-sm bg-white shadow-xs focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Student</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name} ({student.admission_number})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full sm:w-44">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Session</label>
                <select value={sessionId} onChange={event => handleSessionChange(event.target.value)} className="border rounded-xl p-2.5 w-full text-sm bg-white shadow-xs focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Session</option>
                  {sessions.map(session => <option key={session.id} value={session.id}>{session.name}</option>)}
                </select>
              </div>
              <div className="w-full sm:w-44">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Term</label>
                <select value={termId} onChange={event => setTermId(event.target.value)} className="border rounded-xl p-2.5 w-full text-sm bg-white shadow-xs focus:ring-2 focus:ring-blue-500" disabled={!sessionId}>
                  <option value="">Select Term</option>
                  {terms.filter(term => String(term.session_id) === String(sessionId)).map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
                </select>
              </div>
              <button onClick={() => fetchReport()} className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-xs sm:text-sm font-semibold transition shadow-xs">Load Report</button>
              {report && (
                <button onClick={handlePrint} className="w-full sm:w-auto flex items-center justify-center px-5 py-2.5 bg-gray-800 text-white rounded-xl hover:bg-gray-900 text-xs sm:text-sm font-semibold transition shadow-xs">
                  <Printer className="w-4 h-4 mr-1.5" /> Print
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-800 rounded-2xl border border-red-100 text-xs sm:text-sm font-medium">
          {error}
        </div>
      )}

      {loading && <div className="p-8 text-center text-xs sm:text-sm text-gray-500 bg-white rounded-2xl border border-gray-100">Loading report...</div>}

      {report && studentInfo && (
        <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-xs border border-gray-100 print:shadow-none print:border-0 print:p-0" id="report-card">
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex justify-center mb-3">
              {schoolInfo?.logo_url ? (
                <img src={mediaUrl(schoolInfo.logo_url)} alt="School logo" className="w-14 h-14 sm:w-16 sm:h-16 object-contain" />
              ) : (
                <GraduationCap className="w-12 h-12 text-blue-600" />
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 uppercase tracking-wider">{schoolInfo?.name || 'School'}</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">{schoolInfo?.address || 'School Address'}</p>
            <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
              {schoolInfo?.phone && <span>Phone: {schoolInfo.phone}</span>}
              {schoolInfo?.email && <span>{schoolInfo?.phone ? ' | ' : ''}{schoolInfo.email}</span>}
            </p>
            {schoolInfo?.motto && <p className="text-xs text-gray-500 italic mt-1">{schoolInfo.motto}</p>}
            <h2 className="text-base sm:text-lg font-bold text-gray-900 uppercase tracking-wider mt-4">Student Report Card</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 mb-6 text-xs sm:text-sm">
            <div><span className="font-semibold text-gray-600">Name:</span> <span className="text-gray-900 font-bold">{studentInfo.first_name} {studentInfo.last_name}</span></div>
            <div><span className="font-semibold text-gray-600">Adm No:</span> <span className="text-gray-900 font-mono">{studentInfo.admission_number}</span></div>
            <div><span className="font-semibold text-gray-600">Class:</span> <span className="text-gray-900 font-bold">{studentInfo.class_name || 'N/A'}</span></div>
            <div><span className="font-semibold text-gray-600">Session:</span> <span className="text-gray-900">{academicInfo?.session_name || schoolInfo?.current_session_name || 'N/A'}</span></div>
            <div><span className="font-semibold text-gray-600">Term:</span> <span className="text-gray-900">{academicInfo?.term_name || schoolInfo?.current_term_name || 'N/A'}</span></div>
          </div>

          {subjects.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300 text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="border border-gray-300 px-3 sm:px-4 py-2.5 text-left">Subject</th>
                      <th className="border border-gray-300 px-3 sm:px-4 py-2.5 text-center">CA Score</th>
                      <th className="border border-gray-300 px-3 sm:px-4 py-2.5 text-center">Exam Score</th>
                      <th className="border border-gray-300 px-3 sm:px-4 py-2.5 text-center">Total</th>
                      <th className="border border-gray-300 px-3 sm:px-4 py-2.5 text-center">Grade</th>
                      <th className="border border-gray-300 px-3 sm:px-4 py-2.5 text-center">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map(([name, data], index) => {
                      const caScore = data.test?.score ?? '-';
                      const examScore = data.exam?.score ?? '-';
                      const total = (data.test?.score || 0) + (data.exam?.score || 0);
                      const subjectMax = (data.test?.max || 0) + (data.exam?.max || 0);
                      const percentage = subjectMax > 0 ? (total / subjectMax) * 100 : 0;
                      const grade = getGrade(percentage);

                      return (
                        <tr key={name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-3 sm:px-4 py-2 font-medium">{name}</td>
                          <td className="border border-gray-300 px-3 sm:px-4 py-2 text-center">{caScore}</td>
                          <td className="border border-gray-300 px-3 sm:px-4 py-2 text-center">{examScore}</td>
                          <td className="border border-gray-300 px-3 sm:px-4 py-2 text-center font-semibold">{total}</td>
                          <td className="border border-gray-300 px-3 sm:px-4 py-2 text-center font-bold">{grade}</td>
                          <td className="border border-gray-300 px-3 sm:px-4 py-2 text-center text-xs">{getRemark(grade)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold">
                      <td className="border border-gray-300 px-3 sm:px-4 py-2">Overall</td>
                      <td className="border border-gray-300 px-3 sm:px-4 py-2 text-center" colSpan="2"></td>
                      <td className="border border-gray-300 px-3 sm:px-4 py-2 text-center">{totalObtained}</td>
                      <td className="border border-gray-300 px-3 sm:px-4 py-2 text-center font-bold">{getGrade(average)}</td>
                      <td className="border border-gray-300 px-3 sm:px-4 py-2 text-center text-xs">Avg: {average}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-8 text-xs sm:text-sm">
                <div className="border-t border-gray-400 pt-2 text-center">
                  <p className="text-gray-600">Class Teacher's Signature</p>
                </div>
                <div className="border-t border-gray-400 pt-2 text-center">
                  <p className="text-gray-600">Principal's Signature & Stamp</p>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs sm:text-sm text-gray-500">No grades recorded for this term.</div>
          )}
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-card, #report-card * { visibility: visible; }
          #report-card { position: absolute; left: 0; top: 0; width: 100%; padding: 15mm; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

