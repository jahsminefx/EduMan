import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, CheckCircle, RefreshCw, RotateCcw, FileText } from 'lucide-react';
import axios from 'axios';
import API_URL from '../../config/api';

export default function PaymentRecordsPage() {
  const [invoices, setInvoices] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ invoice_id: '', amount: '', payment_method: 'CASH', notes: '' });
  const [refundForm, setRefundForm] = useState({ refund_amount: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await axios.get(`${API_URL}/finance/invoices`);
      setInvoices(res.data.invoices || []);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.invoice_id || !paymentForm.amount) return;

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/finance/payments`, paymentForm);
      setShowPaymentModal(false);
      setPaymentForm({ invoice_id: '', amount: '', payment_method: 'CASH', notes: '' });
      fetchInvoices();
    } catch (err) {
      console.error('Failed to record payment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessRefund = async (e) => {
    e.preventDefault();
    if (!selectedPayment || !refundForm.refund_amount || !refundForm.reason) return;

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/finance/refunds`, {
        payment_id: selectedPayment.id,
        refund_amount: refundForm.refund_amount,
        reason: refundForm.reason
      });

      setShowRefundModal(false);
      setRefundForm({ refund_amount: '', reason: '' });
      fetchInvoices();
    } catch (err) {
      console.error('Failed to process refund:', err);
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
            <CreditCard className="w-7 h-7 text-green-600" /> Payments & Receipts Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Record manual payments, verify bank transfers, process reversals, and generate official receipts.
          </p>
        </div>

        <button
          onClick={() => setShowPaymentModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-xl hover:bg-green-700 transition shadow-xs"
        >
          <Plus className="w-4 h-4" /> Record New Payment
        </button>
      </div>

      {/* Payment Entry Form Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900">Record Fee Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select Student Invoice</label>
                <select
                  required
                  value={paymentForm.invoice_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, invoice_id: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700"
                >
                  <option value="">-- Choose Invoice --</option>
                  {invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED').map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} - {inv.student_name} (Outstanding: ₦{parseFloat(inv.outstanding_amount).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Amount Received (₦)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 25000"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700"
                >
                  <option value="CASH">CASH</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="CARD">DEBIT/CREDIT CARD</option>
                  <option value="ONLINE">ONLINE PORTAL</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notes / Transaction Ref</label>
                <textarea
                  rows={2}
                  placeholder="Bank deposit slip reference..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700">{submitting ? 'Recording...' : 'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
