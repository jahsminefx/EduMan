import React, { useState, useEffect } from 'react';
import { DollarSign, CreditCard, TrendingUp, AlertCircle, RefreshCw, UserPlus, FileText, CheckCircle, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../../config/api';

export default function FinanceDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAccountantModal, setShowAccountantModal] = useState(false);
  const [accountantForm, setAccountantForm] = useState({ name: '', email: '' });
  const [accountantSubmitting, setAccountantSubmitting] = useState(false);
  const [accountantAlert, setAccountantAlert] = useState('');

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/finance/overview`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch finance overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccountant = async (e) => {
    e.preventDefault();
    if (!accountantForm.name || !accountantForm.email) return;

    setAccountantSubmitting(true);
    setAccountantAlert('');
    try {
      const res = await axios.post(`${API_URL}/finance/accountants`, accountantForm);
      setAccountantAlert('Accountant staff account created successfully!');
      setAccountantForm({ name: '', email: '' });
      setTimeout(() => {
        setShowAccountantModal(false);
        setAccountantAlert('');
      }, 2000);
    } catch (err) {
      console.error('Failed to create accountant:', err);
      setAccountantAlert(err.response?.data?.message || 'Failed to create accountant.');
    } finally {
      setAccountantSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">Loading financial overview...</div>;
  }

  const overview = data?.overview || {};

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-green-600" /> School Finance & Fee Overview
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time revenue metrics, fee collection rates, outstanding balances, and financial transaction logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAccountantModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition shadow-xs"
          >
            <UserPlus className="w-4 h-4" /> Add Accountant Staff
          </button>
          <button
            onClick={fetchOverview}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition shadow-xs"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
          <span className="text-xs font-bold text-gray-500 uppercase">Expected Revenue</span>
          <div className="text-3xl font-extrabold text-gray-900">
            ₦{(overview.expected || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400">Total fees billed to students</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
          <span className="text-xs font-bold text-green-600 uppercase">Collected Revenue</span>
          <div className="text-3xl font-extrabold text-green-700">
            ₦{(overview.collected || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400">Collection Rate: <span className="font-bold text-gray-900">{overview.collectionRate}%</span></p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
          <span className="text-xs font-bold text-amber-600 uppercase">Outstanding Balance</span>
          <div className="text-3xl font-extrabold text-amber-700">
            ₦{(overview.outstanding || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400">Uncollected student balances</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
          <span className="text-xs font-bold text-blue-600 uppercase">Today's Collections</span>
          <div className="text-3xl font-extrabold text-blue-700">
            ₦{(overview.todayCollections || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400">Payments recorded today</p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/dashboard/finance/fees"
          className="p-5 bg-white rounded-2xl border border-gray-200 hover:border-blue-500 transition shadow-xs space-y-1 block"
        >
          <div className="font-bold text-sm text-gray-900">Fee Structure & Assignments</div>
          <p className="text-xs text-gray-500">Configure tuition, exam, & transport fees, and bulk assign to classes.</p>
        </Link>
        <Link
          to="/dashboard/finance/invoices"
          className="p-5 bg-white rounded-2xl border border-gray-200 hover:border-blue-500 transition shadow-xs space-y-1 block"
        >
          <div className="font-bold text-sm text-gray-900">Invoices & Statements</div>
          <p className="text-xs text-gray-500">Search student invoices, apply discounts, & view payment statuses.</p>
        </Link>
        <Link
          to="/dashboard/finance/payments"
          className="p-5 bg-white rounded-2xl border border-gray-200 hover:border-blue-500 transition shadow-xs space-y-1 block"
        >
          <div className="font-bold text-sm text-gray-900">Payments & Receipts</div>
          <p className="text-xs text-gray-500">Record cash/card payments, verify bank transfers, & issue receipts.</p>
        </Link>
      </div>

      {/* Recent Payments Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-gray-900">Recent Payment Transactions</h2>

        {data?.recentPayments?.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase">
                <tr>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {data?.recentPayments?.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-gray-50/50">
                    <td className="p-3 font-bold text-blue-600">{pmt.payment_reference}</td>
                    <td className="p-3 font-semibold text-gray-900">{pmt.student_name} ({pmt.admission_number})</td>
                    <td className="p-3 text-gray-600">{pmt.class_name || 'N/A'}</td>
                    <td className="p-3 font-extrabold text-green-700">₦{parseFloat(pmt.amount).toLocaleString()}</td>
                    <td className="p-3 text-gray-600">{pmt.payment_method}</td>
                    <td className="p-3 text-gray-400">{new Date(pmt.payment_date).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pmt.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {pmt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Accountant Staff Modal */}
      {showAccountantModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900">Add Accountant Account</h3>
              <button onClick={() => setShowAccountantModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            {accountantAlert && (
              <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded-xl font-semibold">
                {accountantAlert}
              </div>
            )}

            <form onSubmit={handleCreateAccountant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={accountantForm.name}
                  onChange={(e) => setAccountantForm({ ...accountantForm, name: e.target.value })}
                  placeholder="e.g. Samuel Accountant"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={accountantForm.email}
                  onChange={(e) => setAccountantForm({ ...accountantForm, email: e.target.value })}
                  placeholder="accountant@school.com"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <p className="text-xs text-gray-500 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                  An email invitation link with a 1-click password setup will be sent to the accountant's email address.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAccountantModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={accountantSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
                >
                  {accountantSubmitting ? 'Creating...' : 'Create Accountant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
