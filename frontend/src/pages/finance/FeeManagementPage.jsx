import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, CheckSquare, Layers, AlertCircle, RefreshCw, Send } from 'lucide-react';
import axios from 'axios';
import API_URL from '../../config/api';

export default function FeeManagementPage() {
  const [feeStructures, setFeeStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [feeForm, setFeeForm] = useState({ name: '', amount: '', description: '', due_date: '' });
  const [assignForm, setAssignForm] = useState({ fee_structure_ids: [], class_id: '' });
  const [classes, setClasses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  useEffect(() => {
    fetchFeeStructures();
    fetchClasses();
  }, []);

  const fetchFeeStructures = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/finance/fees`);
      setFeeStructures(res.data.feeStructures || []);
    } catch (err) {
      console.error('Failed to fetch fee structures:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await axios.get(`${API_URL}/classes/classes`);
      setClasses(res.data.classes || []);
    } catch (err) {
      console.error('Failed to fetch classes:', err);
    }
  };

  const handleCreateFee = async (e) => {
    e.preventDefault();
    if (!feeForm.name || !feeForm.amount) return;

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/finance/fees`, feeForm);
      setFeeForm({ name: '', amount: '', description: '', due_date: '' });
      setShowFeeModal(false);
      fetchFeeStructures();
    } catch (err) {
      console.error('Failed to create fee:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignFees = async (e) => {
    e.preventDefault();
    if (assignForm.fee_structure_ids.length === 0) return;

    setSubmitting(true);
    setAlertMsg('');
    try {
      const res = await axios.post(`${API_URL}/finance/fees/assign`, assignForm);
      setAlertMsg(res.data.message || 'Fees assigned successfully!');
      setTimeout(() => {
        setShowAssignModal(false);
        setAlertMsg('');
        setAssignForm({ fee_structure_ids: [], class_id: '' });
      }, 2000);
    } catch (err) {
      console.error('Failed to assign fees:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFeeSelect = (id) => {
    setAssignForm(prev => {
      const exists = prev.fee_structure_ids.includes(id);
      return {
        ...prev,
        fee_structure_ids: exists ? prev.fee_structure_ids.filter(i => i !== id) : [...prev.fee_structure_ids, id]
      };
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-7 h-7 text-blue-600" /> Fee Structure & Assignments
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create school fee categories and bulk assign them to students and classes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAssignModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-xs font-semibold rounded-xl hover:bg-purple-700 transition shadow-xs"
          >
            <Send className="w-4 h-4" /> Bulk Assign Fees
          </button>
          <button
            onClick={() => setShowFeeModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition shadow-xs"
          >
            <Plus className="w-4 h-4" /> Create Fee Item
          </button>
        </div>
      </div>

      {/* Fee Items List */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-gray-900">Active School Fee Items</h2>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading fee items...</div>
        ) : feeStructures.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No fee items configured yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feeStructures.map((fee) => (
              <div key={fee.id} className="p-5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900">{fee.name}</h3>
                  <span className="text-sm font-extrabold text-blue-700">₦{parseFloat(fee.amount).toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{fee.description || 'Standard school fee item.'}</p>
                <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-200 flex items-center justify-between">
                  <span>Class: {fee.class_name || 'All Classes'}</span>
                  <span>Due: {fee.due_date ? new Date(fee.due_date).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Fee Item Modal */}
      {showFeeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900">Create Fee Item</h3>
              <button onClick={() => setShowFeeModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateFee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Fee Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tuition Fee, Exam Fee, Uniform"
                  value={feeForm.name}
                  onChange={(e) => setFeeForm({ ...feeForm, name: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Amount (₦)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 50000"
                  value={feeForm.amount}
                  onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Due Date (Optional)</label>
                <input
                  type="date"
                  value={feeForm.due_date}
                  onChange={(e) => setFeeForm({ ...feeForm, due_date: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={feeForm.description}
                  onChange={(e) => setFeeForm({ ...feeForm, description: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowFeeModal(false)} className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700">{submitting ? 'Creating...' : 'Save Fee Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Assign Fees Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900">Bulk Assign Fees to Students</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            {alertMsg && (
              <div className="p-3 bg-purple-50 text-purple-700 text-xs rounded-xl font-semibold">
                {alertMsg}
              </div>
            )}

            <form onSubmit={handleAssignFees} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Target Class (Optional)</label>
                <select
                  value={assignForm.class_id}
                  onChange={(e) => setAssignForm({ ...assignForm, class_id: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700"
                >
                  <option value="">All Classes (All Students)</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Select Fee Items to Assign</label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50">
                  {feeStructures.map(fee => (
                    <label key={fee.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100 cursor-pointer">
                      <span className="text-xs font-bold text-gray-900">{fee.name} (₦{parseFloat(fee.amount).toLocaleString()})</span>
                      <input
                        type="checkbox"
                        checked={assignForm.fee_structure_ids.includes(fee.id)}
                        onChange={() => toggleFeeSelect(fee.id)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAssignModal(false)} className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting || assignForm.fee_structure_ids.length === 0} className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700">{submitting ? 'Assigning...' : 'Assign Fees'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
