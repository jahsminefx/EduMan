import React, { useState, useEffect } from 'react';
import { CreditCard, FileText, Download, CheckCircle, AlertCircle, RefreshCw, Printer, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import API_URL from '../../config/api';

export default function ParentFeeStatements() {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [feeData, setFeeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      fetchFees(selectedChildId);
    }
  }, [selectedChildId]);

  const fetchChildren = async () => {
    try {
      const res = await axios.get(`${API_URL}/parent/children`);
      const data = res.data;
      setChildren(data.children || []);
      if (data.children && data.children.length > 0) {
        setSelectedChildId(data.children[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch children:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFees = async (childId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/parent/children/${childId}/fees`);
      setFeeData(res.data);
    } catch (err) {
      console.error('Failed to fetch fees:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReceipt = async (paymentId) => {
    setReceiptLoading(true);
    try {
      const res = await axios.get(`${API_URL}/parent/receipts/${paymentId}`);
      setSelectedReceipt(res.data.receipt);
    } catch (err) {
      console.error('Failed to fetch receipt:', err);
    } finally {
      setReceiptLoading(false);
    }
  };

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-blue-600" /> Fee Statements & Payments
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review invoices, payment logs, and official receipts for your children.
          </p>
        </div>
      </div>

      {/* Child Selector Tabs */}
      {children.length > 0 && (
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-gray-200 shadow-xs overflow-x-auto">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                selectedChildId === child.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {child.first_name} {child.last_name} ({child.class_name || 'N/A'})
            </button>
          ))}
        </div>
      )}

      {selectedChild && feeData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
              <span className="text-xs font-bold text-gray-500 uppercase">Total Billed Fees</span>
              <div className="text-2xl font-extrabold text-gray-900 mt-1">
                ₦{(feeData.summary?.total || 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
              <span className="text-xs font-bold text-green-600 uppercase">Total Amount Paid</span>
              <div className="text-2xl font-extrabold text-green-700 mt-1">
                ₦{(feeData.summary?.paid || 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
              <span className="text-xs font-bold text-amber-600 uppercase">Outstanding Balance</span>
              <div className="text-2xl font-extrabold text-amber-700 mt-1">
                ₦{(feeData.summary?.outstanding || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Invoices & Line Items */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Invoices & Payment History</h2>

            {feeData.invoices.length === 0 ? (
              <div className="p-8 bg-gray-50 rounded-2xl border border-gray-200 text-center text-gray-400 text-xs">
                No fee invoices issued for this student yet.
              </div>
            ) : (
              feeData.invoices.map((inv) => (
                <div key={inv.id} className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                  {/* Invoice Header */}
                  <div className="p-5 bg-gray-50/50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600">{inv.invoice_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                          inv.status === 'PARTIALLY_PAID' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Term: {inv.term_name || 'N/A'} | Session: {inv.session_name || 'N/A'} | Due Date: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-sm font-extrabold text-gray-900">Total: ₦{parseFloat(inv.total_amount).toLocaleString()}</div>
                      <div className="text-xs font-bold text-amber-700 mt-0.5">Outstanding: ₦{parseFloat(inv.outstanding_amount).toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="p-5 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">Fee Items Breakdown</h4>
                      <div className="divide-y divide-gray-100 bg-gray-50 rounded-xl p-3">
                        {inv.items.map((item) => (
                          <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                            <span className="text-gray-700 font-medium">{item.description}</span>
                            <span className="font-bold text-gray-900">₦{parseFloat(item.amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Logs */}
                    {inv.payments.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">Payments & Receipts</h4>
                        <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl p-3">
                          {inv.payments.map((pmt) => (
                            <div key={pmt.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                              <div>
                                <span className="font-bold text-gray-900">{pmt.payment_reference}</span>
                                <span className="text-gray-400 text-[10px] ml-2">({pmt.payment_method} • {new Date(pmt.payment_date).toLocaleDateString()})</span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="font-bold text-green-700">₦{parseFloat(pmt.amount).toLocaleString()}</span>
                                <button
                                  onClick={() => handleViewReceipt(pmt.id)}
                                  className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg hover:bg-blue-100 transition flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" /> View Receipt
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Official Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-green-600" />
                <h3 className="text-lg font-bold text-gray-900">Official Fee Receipt</h3>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-base font-extrabold text-gray-900">{selectedReceipt.school_name}</h2>
              <p className="text-[11px] text-gray-500">{selectedReceipt.school_address || 'Official School Receipt'}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Receipt Ref:</span>
                <span className="font-bold text-blue-600">{selectedReceipt.payment_reference}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Invoice Ref:</span>
                <span className="font-semibold text-gray-900">{selectedReceipt.invoice_number}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Student:</span>
                <span className="font-semibold text-gray-900">{selectedReceipt.student_name}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Class:</span>
                <span className="font-semibold text-gray-900">{selectedReceipt.class_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Payment Method:</span>
                <span className="font-semibold text-gray-900">{selectedReceipt.payment_method}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Payment Date:</span>
                <span className="font-semibold text-gray-900">{new Date(selectedReceipt.payment_date).toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-extrabold text-gray-900">
                <span>Amount Paid:</span>
                <span className="text-green-700">₦{parseFloat(selectedReceipt.amount).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
