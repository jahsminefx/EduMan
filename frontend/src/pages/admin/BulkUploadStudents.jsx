import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle, Download, FileUp } from 'lucide-react';
import API_URL from '../../config/api';

const sampleRows = [
  ['studentId', 'name', 'email', 'gender', 'class', 'age', 'guardianName', 'guardianPhone'],
  ['GF-001', 'Amina Bello', 'amina.bello@student.demo', 'Female', 'Grade 1A', '8', 'Mrs Bello', '08030000001'],
  ['GF-002', 'Chinedu Okafor', 'chinedu.okafor@student.demo', 'Male', 'Grade 1A', '9', 'Mr Okafor', '08030000002']
];

export default function BulkUploadStudents() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState([]);

  const downloadTemplate = () => {
    const csv = sampleRows.map(row => row.map(value => `"${value}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'students_bulk_upload_template.csv';
    link.click();
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    setMessage(null);
    setErrors([]);

    if (!file) {
      setMessage({ type: 'error', text: 'Please choose a CSV file first.' });
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage({ type: 'error', text: 'Only CSV files are supported.' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await axios.post(`${API_URL}/students/bulk-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage({ type: 'success', text: res.data.message || 'Students uploaded successfully.' });
      setFile(null);
      event.target.reset();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Upload failed. Please check the file and try again.'
      });
      setErrors(err.response?.data?.errors || []);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100">
        <div>
          <Link to="/dashboard/admin/students" className="inline-flex items-center text-xs sm:text-sm text-blue-600 font-medium mb-1.5 hover:text-blue-800">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Students
          </Link>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Bulk Upload Students</h2>
          <p className="text-xs sm:text-sm text-gray-500">Import student records from a CSV file.</p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-gray-800 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-gray-900 transition shadow-xs"
        >
          <Download className="w-4 h-4 mr-2" />
          Sample CSV
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl flex items-start gap-3 border ${message.type === 'error' ? 'bg-red-50 text-red-800 border-red-100' : 'bg-green-50 text-green-800 border-green-100'}`}>
          {message.type === 'error' ? <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />}
          <div>
            <p className="text-xs sm:text-sm font-medium">{message.text}</p>
            {errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs sm:text-sm list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleUpload} className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100 space-y-5">
        <div className="border border-dashed border-gray-300 rounded-2xl p-4 sm:p-8 bg-gray-50/70">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
              <FileUp className="w-6 h-6 text-blue-600" />
            </div>
            <div className="w-full">
              <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-2">CSV File</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="block w-full text-xs sm:text-sm text-gray-700 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2.5 file:text-xs file:sm:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 cursor-pointer"
              />
            </div>
            <p className="text-[11px] sm:text-xs text-gray-500 max-w-xl">
              Required columns: studentId, name, email, gender, class, age, guardianName, guardianPhone.
              Class names must already exist in EduMan.
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-xs sm:text-sm text-blue-900">
          Imported students receive login accounts automatically. The default password format is <span className="font-bold">studentId@123</span>.
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={uploading}
            className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition shadow-xs"
          >
            <FileUp className="w-4 h-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload Students'}
          </button>
        </div>
      </form>
    </div>
  );
}
