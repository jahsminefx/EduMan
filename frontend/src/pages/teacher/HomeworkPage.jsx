import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BookOpen, Plus, Trash2, Upload, Calendar, Send, FileCheck, Eye, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL, API_BASE_URL } from '../../config/api';
import AssignmentSubmit from '../../components/AssignmentSubmit';

export default function HomeworkPage() {
  const { user } = useAuth();
  const [homework, setHomework] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  // Submission Modal state
  const [selectedHw, setSelectedHw] = useState(null);
  const [showSubmissions, setShowSubmissions] = useState(null); // hw id
  const [submissionsList, setSubmissionsList] = useState([]);

  // Form state
  const [form, setForm] = useState({ class_id: '', subject_id: '', title: '', description: '', due_date: '' });
  const [file, setFile] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [hwRes, clsRes, subRes] = await Promise.all([
        axios.get(`${API_URL}/homework`),
        axios.get(`${API_URL}/classes/classes`),
        axios.get(`${API_URL}/classes/subjects`)
      ]);
      setHomework(hwRes.data.homework);
      setClasses(clsRes.data.classes);
      setSubjects(subRes.data.subjects);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => formData.append(key, val));
      if (file) formData.append('file', file);

      await axios.post(`${API_URL}/homework`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage('Homework created!');
      setShowForm(false);
      setForm({ class_id: '', subject_id: '', title: '', description: '', due_date: '' });
      setFile(null);
      fetchData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Error creating homework.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this homework?')) return;
    try {
      await axios.delete(`${API_URL}/homework/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const fetchSubmissions = async (hwId) => {
    try {
      const res = await axios.get(`${API_URL}/submissions/assignment/${hwId}`);
      setSubmissionsList(res.data.submissions);
      setShowSubmissions(hwId);
    } catch (err) {
      alert('Failed to load submissions');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-600" /> Homework & Assignments</h2>
          <p className="text-sm text-gray-500">Manage and view classroom tasks</p>
        </div>
        {user.role === 'Teacher' && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            {showForm ? 'Cancel' : <><Plus className="w-4 h-4 mr-1" /> New Homework</>}
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.includes('created') || message.includes('success') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-semibold text-gray-800">Create Homework</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})} className="border rounded-md p-2 text-gray-900" required>
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={form.subject_id} onChange={e => setForm({...form, subject_id: e.target.value})} className="border rounded-md p-2 text-gray-900" required>
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="text" placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="border rounded-md p-2 text-gray-900 text-sm" required />
            <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="border rounded-md p-2 text-gray-900 text-sm" />
          </div>
          <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="border rounded-md p-2 w-full text-gray-900 text-sm" rows={3} />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-blue-600 hover:underline">
              <Upload className="w-4 h-4" /> Attach Reference File
              <input type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
            </label>
            {file && <span className="text-sm text-gray-500">{file.name}</span>}
          </div>
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">Create</button>
        </form>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500 font-medium">Loading tasks...</div>
      ) : homework.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">No homework found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {homework.map(hw => (
            <div key={hw.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-lg transition-all flex flex-col h-full group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{hw.title}</h3>
                  <p className="text-[10px] font-bold text-blue-600 mt-0.5 bg-blue-50 px-2 py-0.5 rounded-full inline-block border border-blue-100">{hw.class_name} • {hw.subject_name}</p>
                </div>
                {(user.role === 'Teacher' || user.role === 'SchoolAdmin') && (
                  <button onClick={() => handleDelete(hw.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
              
              {hw.description && <p className="text-xs text-gray-600 mt-2 line-clamp-3 leading-relaxed">{hw.description}</p>}
              
              <div className="mt-auto pt-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-gray-500 border-t pt-3">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>Due: <span className="font-semibold text-gray-700">{hw.due_date || 'N/A'}</span></span>
                  </div>
                  <span className="italic">By {hw.teacher_name}</span>
                </div>

                {hw.file_path && (
                  <a href={`${API_BASE_URL}${hw.file_path}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all font-medium">
                    <Plus className="w-3.5 h-3.5 rotate-45" /> View Reference Material
                  </a>
                )}

                <div className="flex gap-2">
                  {user.role === 'Student' && (
                    <button 
                      onClick={() => setSelectedHw(hw)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold text-xs shadow-sm active:scale-[0.98]"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit Work
                    </button>
                  )}
                  {(user.role === 'Teacher' || user.role === 'SchoolAdmin') && (
                    <button 
                      onClick={() => fetchSubmissions(hw.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-bold text-xs border border-blue-100 shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Submissions
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submission Modal for Students */}
      {selectedHw && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl scale-in">
            <div className="flex justify-end mb-2">
              <button onClick={() => setSelectedHw(null)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <AssignmentSubmit 
              assignmentId={selectedHw.id} 
              onComplete={() => setSelectedHw(null)} 
            />
          </div>
        </div>
      )}

      {/* Submissions List Modal for Teachers */}
      {showSubmissions && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col scale-in">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900 uppercase">Submissions List</h3>
                <p className="text-xs text-gray-500 font-medium">Review student work for this assignment</p>
              </div>
              <button onClick={() => setShowSubmissions(null)} className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {submissionsList.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileCheck className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-700">No submissions yet</h4>
                  <p className="text-sm text-gray-500">Students have not uploaded any work for this assignment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {submissionsList.map(sub => (
                    <div key={sub.id} className="p-4 border rounded-xl hover:border-blue-300 hover:shadow-md transition bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                            {sub.first_name[0]}{sub.last_name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{sub.first_name} {sub.last_name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{sub.admission_number}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100 uppercase">
                          {sub.file_type}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-4 border-t pt-3">
                        <span className="text-[10px] text-gray-400">
                          {new Date(sub.submitted_at).toLocaleDateString()} at {new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <a 
                          href={`${API_BASE_URL}${sub.file_path}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold text-[10px]"
                        >
                          <Eye className="w-3 h-3" /> Review Work
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 bg-gray-50 border-t flex justify-end">
              <button onClick={() => setShowSubmissions(null)} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-100 transition shadow-sm">
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
