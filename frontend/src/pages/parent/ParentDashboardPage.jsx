import React, { useState, useEffect } from 'react';
import { Users, Award, Calendar, BookOpen, AlertCircle, ArrowUpRight, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../../config/api';

export default function ParentDashboardPage() {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      const res = await axios.get(`${API_URL}/parent/children`);
      const data = res.data;
      setChildren(data.children || []);
      if (data.children && data.children.length > 0) {
        setSelectedChildId(data.children[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch parent children:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedChild = children.find(c => c.id === selectedChildId) || children[0];

  if (loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">Loading parental perspective...</div>;
  }

  if (children.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 text-amber-600" />
          <h2 className="text-lg font-bold">No Children Linked Yet</h2>
          <p className="text-xs text-amber-700 mt-1">
            Your parent account is active, but not yet linked to any student profile. Please contact your school administrator to link your child to your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-600" />
            Parental Perspective
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor academic performance, attendance, homework, and fee statements for your children.
          </p>
        </div>
      </div>

      {/* Child Tabs Selector */}
      {children.length > 1 && (
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-gray-200 shadow-xs overflow-x-auto">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                selectedChild?.id === child.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Users className="w-4 h-4" />
              {child.first_name} {child.last_name} ({child.class_name || 'N/A'})
            </button>
          ))}
        </div>
      )}

      {selectedChild && (
        <div className="space-y-6">
          {/* Top Child Overview Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider">
                {selectedChild.school_name}
              </span>
              <h2 className="text-2xl font-extrabold mt-2">{selectedChild.first_name} {selectedChild.last_name}</h2>
              <p className="text-xs text-blue-100 mt-1">
                Class: <span className="font-semibold text-white">{selectedChild.class_name || 'Unassigned'}</span> | Admission No: <span className="font-semibold text-white">{selectedChild.admission_number}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to={`/dashboard/parent/fees`}
                className="px-4 py-2 bg-white text-blue-700 text-xs font-bold rounded-xl hover:bg-blue-50 transition shadow-xs flex items-center gap-1.5"
              >
                Fee Statements <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to={`/dashboard/parent/children`}
                className="px-4 py-2 bg-blue-800/60 hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition border border-white/20 flex items-center gap-1.5"
              >
                All Children <Users className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Academic Average */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
                <span>Academic Average</span>
                <Award className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900">{selectedChild.academicAverage}%</div>
              <p className="text-[11px] text-gray-400">Term assessment average score</p>
            </div>

            {/* Attendance % */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
                <span>Attendance Rate</span>
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900">{selectedChild.attendancePercentage}%</div>
              <p className="text-[11px] text-gray-400">
                {selectedChild.attendanceCounts?.present || 0} Present / {selectedChild.attendanceCounts?.total || 0} Total Days
              </p>
            </div>

            {/* Outstanding Fees */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
                <span>Outstanding Fees</span>
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900">
                ₦{(selectedChild.outstandingFees || 0).toLocaleString()}
              </div>
              <p className="text-[11px] text-gray-400">
                Total Paid: ₦{(selectedChild.feeTotals?.paid || 0).toLocaleString()}
              </p>
            </div>

            {/* Pending Homework */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
                <span>Pending Homework</span>
                <BookOpen className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900">{selectedChild.pendingHomeworkCount}</div>
              <p className="text-[11px] text-gray-400">Assignments due in class</p>
            </div>
          </div>

          {/* Recent Performance & Quick Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Assessment Result */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600" /> Recent Result
              </h3>

              {selectedChild.recentResult ? (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{selectedChild.recentResult.subject}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Score: {selectedChild.recentResult.score} / {selectedChild.recentResult.maxScore}
                    </p>
                  </div>
                  <div className="text-2xl font-extrabold text-blue-700">
                    {selectedChild.recentResult.percentage}%
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No recent assessment recorded yet.</p>
              )}
            </div>

            {/* Attendance Summary */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" /> Attendance Breakdown
              </h3>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-green-50 rounded-xl">
                  <div className="text-xl font-bold text-green-700">{selectedChild.attendanceCounts?.present || 0}</div>
                  <div className="text-[10px] font-semibold text-green-600 uppercase mt-1">Present</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl">
                  <div className="text-xl font-bold text-amber-700">{selectedChild.attendanceCounts?.late || 0}</div>
                  <div className="text-[10px] font-semibold text-amber-600 uppercase mt-1">Late</div>
                </div>
                <div className="p-3 bg-red-50 rounded-xl">
                  <div className="text-xl font-bold text-red-700">{selectedChild.attendanceCounts?.absent || 0}</div>
                  <div className="text-[10px] font-semibold text-red-600 uppercase mt-1">Absent</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
