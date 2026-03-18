import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Printer, GraduationCap, BookOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import API_URL from '../../config/api';

export default function ReportCard() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [termId, setTermId] = useState('1');
  const [report, setReport] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchOptions(); }, []);

  const fetchOptions = async () => {
    try {
      const [clsRes, stuRes] = await Promise.all([
        axios.get(`${API_URL}/classes/classes`),
        axios.get(`${API_URL}/api/students`)
      ]);
      setClasses(clsRes.data.classes);
      setStudents(stuRes.data.students || []);
    } catch (err) { console.error(err); }
  };

  const fetchReport = async () => {
    if (!selectedStudent || !termId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/grades/report/${selectedStudent}/${termId}`);
      setReport(res.data.report);
      const stu = students.find(s => s.id === Number(selectedStudent));
      setStudentInfo(stu);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const handlePrint = () => window.print();

  // Aggregate subject data
  const subjectSummary = {};
  if (report) {
    for (const r of report) {
      if (!subjectSummary[r.subject_name]) {
        subjectSummary[r.subject_name] = { test: null, exam: null, assignment: null };
      }
      subjectSummary[r.subject_name][r.type] = { score: r.score, max: r.max_score };
    }
  }

  const subjects = Object.entries(subjectSummary);
  const totalObtained = subjects.reduce((sum, [, v]) => {
    const t = v.test?.score || 0;
    const e = v.exam?.score || 0;
    return sum + t + e;
  }, 0);
  const totalMax = subjects.reduce((sum, [, v]) => {
    const t = v.test?.max || 0;
    const e = v.exam?.max || 0;
    return sum + t + e;
  }, 0);
  const average = subjects.length > 0 ? (totalObtained / subjects.length).toFixed(1) : 0;

  const getGrade = (score) => {
    if (score >= 70) return 'A';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  };

  const getRemark = (grade) => {
    const map = { A: 'Excellent', B: 'Very Good', C: 'Good', D: 'Fair', F: 'Needs Improvement' };
    return map[grade] || '';
  };

  return (
    <div className="space-y-6">
      {/* Controls — hidden during print */}
      <div className="print:hidden flex gap-4 items-end bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="border rounded-md p-2 w-full">
            <option value="">Select Student</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_number})</option>)}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
          <input type="text" value={termId} onChange={e => setTermId(e.target.value)} className="border rounded-md p-2 w-full" />
        </div>
        <button onClick={fetchReport} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Load Report</button>
        {report && (
          <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm font-medium">
            <Printer className="w-4 h-4 mr-1" /> Print
          </button>
        )}
      </div>

      {loading && <div className="p-8 text-center text-gray-500">Loading report...</div>}

      {report && studentInfo && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 print:shadow-none print:border-0 print:p-0" id="report-card">
          {/* Header */}
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex justify-center mb-2">
              <GraduationCap className="w-12 h-12 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wider">Student Report Card</h1>
            <p className="text-sm text-gray-600 mt-1">Academic Performance Report</p>
          </div>

          {/* Student Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
            <div><span className="font-semibold text-gray-600">Name:</span> <span className="text-gray-900">{studentInfo.first_name} {studentInfo.last_name}</span></div>
            <div><span className="font-semibold text-gray-600">Adm No:</span> <span className="text-gray-900">{studentInfo.admission_number}</span></div>
            <div><span className="font-semibold text-gray-600">Gender:</span> <span className="text-gray-900">{studentInfo.gender || 'N/A'}</span></div>
            <div><span className="font-semibold text-gray-600">Term:</span> <span className="text-gray-900">{termId}</span></div>
          </div>

          {/* Grades Table */}
          {subjects.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="border border-gray-300 px-4 py-2 text-left">Subject</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">CA Score</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Exam Score</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Total</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Grade</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map(([name, data], idx) => {
                      const caScore = data.test?.score ?? '-';
                      const examScore = data.exam?.score ?? '-';
                      const total = (data.test?.score || 0) + (data.exam?.score || 0);
                      const grade = getGrade(total / 2);
                      return (
                        <tr key={name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-4 py-2 font-medium">{name}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{caScore}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{examScore}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center font-semibold">{total}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center font-bold">{grade}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center text-xs">{getRemark(grade)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold">
                      <td className="border border-gray-300 px-4 py-2">Overall</td>
                      <td className="border border-gray-300 px-4 py-2 text-center" colSpan="2"></td>
                      <td className="border border-gray-300 px-4 py-2 text-center">{totalObtained}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-bold">{getGrade(average)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center text-xs">Avg: {average}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signature Section */}
              <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
                <div className="border-t border-gray-400 pt-2 text-center">
                  <p className="text-gray-600">Class Teacher's Signature</p>
                </div>
                <div className="border-t border-gray-400 pt-2 text-center">
                  <p className="text-gray-600">Principal's Signature & Stamp</p>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">No grades recorded for this term.</div>
          )}
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-card, #report-card * { visibility: visible; }
          #report-card { position: absolute; left: 0; top: 0; width: 100%; padding: 20mm; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
