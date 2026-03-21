import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, CheckCircle, AlertCircle, Settings as SettingsIcon } from 'lucide-react';
import API_URL from '../../config/api';

export default function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create Session Form State
  const [sessionForm, setSessionForm] = useState({ name: '', start_date: '', end_date: '' });
  const [showSessionForm, setShowSessionForm] = useState(false);
  
  // Create Term Form State
  const [termForm, setTermForm] = useState({ session_id: '', name: '' });
  const [showTermForm, setShowTermForm] = useState(false);
  
  // Active Update State
  const [activeSession, setActiveSession] = useState('');
  const [activeTerm, setActiveTerm] = useState('');

  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileRes, sessionsRes, termsRes] = await Promise.all([
        axios.get(`${API_URL}/schools/profile`),
        axios.get(`${API_URL}/schools/sessions`),
        axios.get(`${API_URL}/schools/terms`)
      ]);
      setProfile(profileRes.data.profile);
      setSessions(sessionsRes.data.sessions);
      setTerms(termsRes.data.terms);
      
      setActiveSession(profileRes.data.profile.current_session_id || '');
      setActiveTerm(profileRes.data.profile.current_term_id || '');
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to load school settings.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/schools/sessions`, sessionForm);
      showMessage('Academic Session created successfully!');
      setSessionForm({ name: '', start_date: '', end_date: '' });
      setShowSessionForm(false);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to create session.', 'error');
    }
  };

  const handleCreateTerm = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/schools/terms`, termForm);
      showMessage('Academic Term created successfully!');
      setTermForm({ session_id: '', name: '' });
      setShowTermForm(false);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to create term.', 'error');
    }
  };

  const handleUpdateActive = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...profile,
        current_session_id: activeSession,
        current_term_id: activeTerm
      };
      await axios.put(`${API_URL}/schools/profile`, payload);
      showMessage('Active Session and Term updated successfully!');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to update active settings.', 'error');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <SettingsIcon className="w-5 h-5 mr-2 text-gray-500" />
            School Settings
          </h2>
          <p className="text-sm text-gray-500">Manage your institution's profile and active academic periods</p>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl flex items-center ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
          {message.type === 'error' ? <AlertCircle className="w-5 h-5 mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
          {message.text}
        </div>
      )}

      {/* Active Academic Period Settings */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Set Current Academic Period</h3>
        <p className="text-sm text-gray-500 mb-6">
          This controls what term and session is considered "active" globally for grading, attendance, and dashboard metrics.
        </p>
        
        <form onSubmit={handleUpdateActive} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Active Session</label>
              <select 
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-gray-50"
                value={activeSession}
                onChange={(e) => setActiveSession(e.target.value)}
                required
              >
                <option value="">-- Select Session --</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Active Term</label>
              <select 
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border bg-gray-50"
                value={activeTerm}
                onChange={(e) => setActiveTerm(e.target.value)}
                required
              >
                <option value="">-- Select Term --</option>
                {terms.filter(t => t.session_id == activeSession).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition">
              Save Active Period
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manage Sessions */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="text-lg font-bold text-gray-900">Academic Sessions</h3>
            <button 
              onClick={() => setShowSessionForm(!showSessionForm)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </button>
          </div>
          
          {showSessionForm && (
            <form onSubmit={handleCreateSession} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3 border border-gray-200">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase">Session Name</label>
                <input type="text" required placeholder="e.g. 2024/2025" className="mt-1 w-full rounded p-2 border" value={sessionForm.name} onChange={e => setSessionForm({...sessionForm, name: e.target.value})} />
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" className="px-3 py-1.5 bg-gray-800 text-white text-sm rounded shadow">Create Session</button>
              </div>
            </form>
          )}

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {sessions.map(s => (
              <div key={s.id} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                <span className="font-medium text-gray-800">{s.name}</span>
                {s.id == profile?.current_session_id && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold">ACTIVE</span>}
              </div>
            ))}
            {sessions.length === 0 && <p className="text-center text-gray-400 text-sm py-2">No sessions defined.</p>}
          </div>
        </div>

        {/* Manage Terms */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="text-lg font-bold text-gray-900">Academic Terms</h3>
            <button 
              onClick={() => setShowTermForm(!showTermForm)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" /> Add
            </button>
          </div>
          
          {showTermForm && (
            <form onSubmit={handleCreateTerm} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3 border border-gray-200">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase">Parent Session</label>
                <select required className="mt-1 w-full rounded p-2 border bg-white" value={termForm.session_id} onChange={e => setTermForm({...termForm, session_id: e.target.value})}>
                  <option value="">Select Session</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase">Term Name</label>
                <input type="text" required placeholder="e.g. First Term" className="mt-1 w-full rounded p-2 border" value={termForm.name} onChange={e => setTermForm({...termForm, name: e.target.value})} />
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" className="px-3 py-1.5 bg-gray-800 text-white text-sm rounded shadow">Create Term</button>
              </div>
            </form>
          )}

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {terms.map(t => (
               <div key={t.id} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                 <div>
                   <span className="font-medium text-gray-800 block">{t.name}</span>
                   <span className="text-[10px] text-gray-400 font-bold uppercase">{sessions.find(s => s.id === t.session_id)?.name}</span>
                 </div>
                 {t.id == profile?.current_term_id && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold">ACTIVE</span>}
               </div>
            ))}
            {terms.length === 0 && <p className="text-center text-gray-400 text-sm py-2">No terms defined.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
