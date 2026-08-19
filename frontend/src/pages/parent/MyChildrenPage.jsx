import React, { useState, useEffect } from 'react';
import { Users, Award, Calendar, BookOpen, CreditCard, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../../config/api';

export default function MyChildrenPage() {
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [activeTab, setActiveTab] = useState('academics'); // academics, attendance, homework, fees
  const [childData, setChildData] = useState({ academics: [], attendance: null, homework: [], fees: null });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      const res = await axios.get(`${API_URL}/parent/children`);
      setChildren(res.data.children || []);
    } catch (err) {
      console.error('Failed to fetch children:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChild = async (child) => {
    setSelectedChild(child);
    setDetailLoading(true);
    try {
      const [acadRes, attRes, hwRes, feeRes] = await Promise.all([
        axios.get(`${API_URL}/parent/children/${child.id}/academics`).catch(() => ({ data: { assessments: [] } })),
        axios.get(`${API_URL}/parent/children/${child.id}/attendance`).catch(() => ({ data: { summary: null, records: [] } })),
        axios.get(`${API_URL}/parent/children/${child.id}/homework`).catch(() => ({ data: { homework: [] } })),
        axios.get(`${API_URL}/parent/children/${child.id}/fees`).catch(() => ({ data: { summary: null, invoices: [] } }))
      ]);

      setChildData({
        academics: acadRes.data.assessments || [],
        attendance: attRes.data,
        homework: hwRes.data.homework || [],
        fees: feeRes.data
      });
    } catch (err) {
      console.error('Failed to fetch child detail views:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-blue-600" /> My Linked Children
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Detailed academic, attendance, homework, and fee records for each child linked to your account.
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Loading children...</div>
      ) : children.length === 0 ? (
        <div className="p-8 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 text-amber-600" />
          <h2 className="text-base font-bold">No Children Linked</h2>
          <p className="text-xs text-amber-700 mt-1">
            Please ask your School Administrator to link your child's student profile to your parent account.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Children List */}
          <div className="space-y-4">
            {children.map((child) => (
              <div
                key={child.id}
                onClick={() => handleSelectChild(child)}
                className={`p-5 bg-white rounded-2xl border transition cursor-pointer shadow-xs ${
                  selectedChild?.id === child.id ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{child.first_name} {child.last_name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{child.class_name || 'Unassigned Class'}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100 text-center text-xs">
                  <div>
                    <div className="font-bold text-gray-900">{child.academicAverage}%</div>
                    <div className="text-[10px] text-gray-400 uppercase">Average</div>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{child.attendancePercentage}%</div>
                    <div className="text-[10px] text-gray-400 uppercase">Attendance</div>
                  </div>
                  <div>
                    <div className="font-bold text-amber-700">₦{(child.outstandingFees || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400 uppercase">Fees Due</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Child Detail Panel */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-xs min-h-[500px]">
            {selectedChild ? (
              <div className="space-y-6">
                {/* Detail Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedChild.first_name} {selectedChild.last_name}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Class: {selectedChild.class_name} | Admission: {selectedChild.admission_number}
                    </p>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
                    {['academics', 'attendance', 'homework', 'fees'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1.5 rounded-lg capitalize transition ${
                          activeTab === tab ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {detailLoading ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Loading details...</div>
                ) : (
                  <div>
                    {/* Academics Tab */}
                    {activeTab === 'academics' && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900">Academic Assessments & Exam Scores</h3>
                        {childData.academics.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No academic assessments recorded yet.</p>
                        ) : (
                          <div className="divide-y divide-gray-100 max-h-[350px] overflow-y-auto pr-2">
                            {childData.academics.map((ass) => (
                              <div key={ass.id} className="py-3 flex items-center justify-between text-xs">
                                <div>
                                  <div className="font-bold text-gray-900">{ass.subject_name || 'Subject'}</div>
                                  <div className="text-[10px] text-gray-400">
                                    {ass.type?.toUpperCase()} | Term: {ass.term || 'N/A'} | Session: {ass.academic_session || 'N/A'}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-blue-700">{ass.score} / {ass.max_score}</div>
                                  <div className="text-[10px] text-gray-400">{Math.round((ass.score / ass.max_score) * 100)}%</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Attendance Tab */}
                    {activeTab === 'attendance' && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900">Attendance History</h3>
                        {childData.attendance?.records?.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No attendance records logged yet.</p>
                        ) : (
                          <div className="divide-y divide-gray-100 max-h-[350px] overflow-y-auto pr-2">
                            {childData.attendance?.records?.map((rec) => (
                              <div key={rec.id} className="py-3 flex items-center justify-between text-xs">
                                <span className="font-semibold text-gray-900">{new Date(rec.date).toLocaleDateString()}</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  rec.status === 'PRESENT' ? 'bg-green-100 text-green-700' :
                                  rec.status === 'LATE' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {rec.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Homework Tab */}
                    {activeTab === 'homework' && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900">Assigned Homework</h3>
                        {childData.homework.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No homework assignments for this class.</p>
                        ) : (
                          <div className="divide-y divide-gray-100 max-h-[350px] overflow-y-auto pr-2">
                            {childData.homework.map((hw) => (
                              <div key={hw.id} className="py-3 space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-gray-900">{hw.title} ({hw.subject_name})</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    hw.submission_status === 'graded' ? 'bg-purple-100 text-purple-700' :
                                    hw.submission_status ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {hw.submission_status ? hw.submission_status.toUpperCase() : 'PENDING'}
                                  </span>
                                </div>
                                <p className="text-gray-500 text-[11px] line-clamp-1">{hw.description}</p>
                                <div className="text-[10px] text-gray-400">Due Date: {new Date(hw.due_date).toLocaleDateString()}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fees Tab */}
                    {activeTab === 'fees' && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900">Fee Invoices & Statements</h3>
                        {childData.fees?.invoices?.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No fee invoices issued yet.</p>
                        ) : (
                          <div className="divide-y divide-gray-100 max-h-[350px] overflow-y-auto pr-2">
                            {childData.fees?.invoices?.map((inv) => (
                              <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                                <div>
                                  <div className="font-bold text-blue-600">{inv.invoice_number}</div>
                                  <div className="text-[10px] text-gray-400">Total: ₦{parseFloat(inv.total_amount).toLocaleString()} | Paid: ₦{parseFloat(inv.paid_amount).toLocaleString()}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-amber-700">Due: ₦{parseFloat(inv.outstanding_amount).toLocaleString()}</div>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                                    inv.status === 'PARTIALLY_PAID' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {inv.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-8">
                <Users className="w-12 h-12 mb-3 text-gray-300" />
                <h3 className="text-base font-bold text-gray-700">Select a Child</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  Click on any child card on the left to view their detailed academic, attendance, homework, and fee statement records.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
