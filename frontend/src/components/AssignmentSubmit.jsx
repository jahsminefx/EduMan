import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, File, FileText, Video, ImageIcon, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import API_URL from '../config/api';

export default function AssignmentSubmit({ assignmentId, onComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File size exceeds 50MB limit.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assignment_id', assignmentId);

    try {
      const res = await axios.post(`${API_URL}/submissions/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        }
      });
      setSuccess('Assignment submitted successfully!');
      if (onComplete) setTimeout(() => onComplete(res.data), 2000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="w-12 h-12 text-gray-400" />;
    const ext = file.name.split('.').pop().toLowerCase();
    if (['mp4', 'mov', 'webm'].includes(ext)) return <Video className="w-12 h-12 text-blue-500" />;
    if (ext === 'pdf') return <FileText className="w-12 h-12 text-red-500" />;
    if (['jpg', 'jpeg', 'png'].includes(ext)) return <ImageIcon className="w-12 h-12 text-green-500" />;
    return <File className="w-12 h-12 text-gray-500" />;
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-bold mb-4 flex items-center">
        <Upload className="w-5 h-5 mr-2" /> Submit Your Work
      </h3>
      
      {!success ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              file ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400 bg-gray-50'
            }`}
            onClick={() => document.getElementById('file-upload').click()}
          >
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              accept=".mp4,.mov,.webm,.pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange} 
            />
            
            <div className="flex flex-col items-center">
              {getFileIcon()}
              <div className="mt-4">
                <span className="text-sm font-medium text-gray-900">
                  {file ? file.name : 'Click to select or drag and drop'}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Supports Video (MP4, MOV), PDF, and Images (JPG, PNG) up to 50MB
                </p>
              </div>
            </div>
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-100">
              <AlertCircle className="w-4 h-4 mr-2" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!file || uploading}
            className={`w-full py-3 rounded-lg font-bold text-white transition-all flex items-center justify-center ${
              !file || uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...
              </>
            ) : (
              'Submit Assignment'
            )}
          </button>
        </form>
      ) : (
        <div className="text-center py-8 space-y-4 scale-in">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <div>
            <h4 className="text-xl font-bold text-gray-900">Well Done!</h4>
            <p className="text-gray-500">Your assignment has been submitted successfully.</p>
          </div>
        </div>
      )}
    </div>
  );
}
