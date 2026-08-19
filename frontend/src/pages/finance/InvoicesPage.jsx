import React, { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, DollarSign, Percent, AlertCircle } from 'lucide-react';
import axios from 'axios';
import API_URL from '../../config/api';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [discountForm, setDiscountForm] = useState({ discount_amount: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, search]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/finance/invoices?search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await axios.get(url);
      setInvoices(res.data.invoices || []);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDiscount = async (e) => {
    e.preventDefault();
    if (!selectedInvoice || !discountForm.discount_amount || !discountForm.reason) return;

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/finance/discounts`, {
        invoice_id: selectedInvoice.id,
        discount_amount: discountForm.discount_amount,
        reason: discountForm.reason
      });

      setShowDiscountModal(false);
      setDiscountForm({ discount_amount: '', reason: '' });
      fetchInvoices();
    } catch (err) {
      console.error('Failed to apply discount:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" /> Student Fee Invoices & Statements
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View student invoices, track paid & outstanding balances, and apply authorized discounts.
          </p>
        </div>

        <button
          onClick={fetchInvoices}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition shadow-xs"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {['', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === st ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st || 'ALL'}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search invoice or student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No student invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase">
                <tr>
                  <th className="p-3">Invoice No</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Total Billed</th>
                  <th className="p-3">Paid</th>
                  <th className="p-3">Outstanding</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/50">
                    <td className="p-3 font-bold text-blue-600">{inv.invoice_number}</td>
                    <td className="p-3 font-semibold text-gray-900">{inv.student_name} ({inv.admission_number})</td>
                    <td className="p-3 text-gray-600">{inv.class_name || 'N/A'}</td>
                    <td className="p-3 font-bold text-gray-900">₦{parseFloat(inv.total_amount).toLocaleString()}</td>
                    <td className="p-3 font-bold text-green-700">₦{parseFloat(inv.paid_amount).toLocaleString()}</td>
                    <td className="p-3 font-bold text-amber-700">₦{parseFloat(inv.outstanding_amount).toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        inv.status === 'PARTIALLY_PAID' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => { setSelectedInvoice(inv); setShowDiscountModal(true); }}
                        className="px-2.5 py-1 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-lg hover:bg-purple-100 transition flex items-center gap-1"
                      >
                        <Percent className="w-3 h-3" /> Apply Discount
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Discount Modal */}
      {showDiscountModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900">Apply Discount / Waiver</h3>
              <button onClick={() => setShowDiscountModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <div className="text-xs text-gray-600 bg-purple-50 p-3 rounded-xl">
              Invoice: <span className="font-bold text-purple-900">{selectedInvoice.invoice_number}</span> ({selectedInvoice.student_name})
              <br />Current Outstanding: <span className="font-extrabold text-amber-700">₦{parseFloat(selectedInvoice.outstanding_amount).toLocaleString()}</span>
            </div>

            <form onSubmit={handleApplyDiscount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Discount Amount (₦)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedInvoice.outstanding_amount}
                  placeholder="e.g. 5000"
                  value={discountForm.discount_amount}
                  onChange={(e) => setDiscountForm({ ...discountForm, discount_amount: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Authorization Reason</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Reason for discount/scholarship..."
                  value={discountForm.reason}
                  onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowDiscountModal(false)} className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700">{submitting ? 'Applying...' : 'Apply Discount'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
