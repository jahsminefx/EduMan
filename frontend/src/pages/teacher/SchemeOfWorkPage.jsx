import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BookOpen, 
  Plus, 
  Sparkles, 
  Eye, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Download, 
  Printer, 
  Calendar, 
  ChevronRight, 
  Layers, 
  ArrowLeft,
  X,
  Loader2,
  ListOrdered
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import API_URL from '../../config/api';

export default function SchemeOfWorkPage() {
  const { user } = useAuth();
  const [schemes, setSchemes] = useState([]);
  const [options, setOptions] = useState({ classes: [], subjects: [], sessions: [], terms: [] });
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Modal / Editor State
  const [activeScheme, setActiveScheme] = useState(null); // scheme object with weeks
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiReport, setAiReport] = useState(null); // active AI review modal

  // Create Form State
  const [formHeader, setFormHeader] = useState({
    class_id: '',
    subject_id: '',
    academic_session_id: '',
    term_id: '',
    title: '',
    description: '',
    total_weeks: 12
  });

  const [editorWeeks, setEditorWeeks] = useState([]);

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    fetchSchemes();
  }, [selectedSubjectId, selectedClassId]);

  const fetchOptions = async () => {
    try {
      const res = await axios.get(`${API_URL}/schemes/options`);
      setOptions(res.data);
      if (res.data.classes?.length > 0 && !selectedClassId) {
        setSelectedClassId(String(res.data.classes[0].id));
      }
      if (res.data.subjects?.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(String(res.data.subjects[0].id));
      }
    } catch (err) {
      console.error('Error fetching scheme options:', err);
    }
  };

  const fetchSchemes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedSubjectId) params.set('subject_id', selectedSubjectId);
      if (selectedClassId) params.set('class_id', selectedClassId);

      const res = await axios.get(`${API_URL}/schemes?${params.toString()}`);
      setSchemes(res.data || []);
    } catch (err) {
      console.error('Error fetching schemes:', err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load schemes of work.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    const defaultClass = selectedClassId || (options.classes[0]?.id ? String(options.classes[0].id) : '');
    const defaultSubject = selectedSubjectId || (options.subjects[0]?.id ? String(options.subjects[0].id) : '');
    const currentSession = options.sessions.find(s => s.is_current)?.id || options.sessions[0]?.id || '';
    const currentTerm = options.terms.find(t => t.is_current)?.id || options.terms[0]?.id || '';

    const subjectObj = options.subjects.find(s => String(s.id) === String(defaultSubject));
    const classObj = options.classes.find(c => String(c.id) === String(defaultClass));

    setFormHeader({
      class_id: defaultClass,
      subject_id: defaultSubject,
      academic_session_id: currentSession,
      term_id: currentTerm,
      title: subjectObj && classObj ? `${subjectObj.name} Scheme of Work - ${classObj.name}` : 'Scheme of Work',
      description: '',
      total_weeks: 12
    });

    const initialWeeks = Array.from({ length: 12 }, (_, i) => ({
      week_number: i + 1,
      topic: i === 6 ? 'Mid-Term Break & Review' : (i === 11 ? 'Revision & Terminal Examinations' : ''),
      sub_topics: '',
      learning_objectives: '',
      activities_and_resources: ''
    }));

    setEditorWeeks(initialWeeks);
    setIsCreating(true);
  };

  const handleOpenDetail = async (schemeId) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/schemes/${schemeId}`);
      setActiveScheme(res.data);
      setEditorWeeks(res.data.weeks || []);
      setIsEditing(false);
      setIsCreating(false);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load scheme details.' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleSaveScheme = async () => {
    if (isCreating) {
      if (!formHeader.class_id || !formHeader.subject_id || !formHeader.title.trim()) {
        return setMessage({ type: 'error', text: 'Please fill in Class, Subject, and Scheme Title.' });
      }

      try {
        setSaving(true);
        const res = await axios.post(`${API_URL}/schemes`, {
          ...formHeader,
          weeks: editorWeeks
        });
        setMessage({ type: 'success', text: 'Scheme of Work created successfully!' });
        setIsCreating(false);
        await fetchSchemes();
        handleOpenDetail(res.data.scheme.id);
      } catch (err) {
        setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create scheme.' });
      } finally {
        setSaving(false);
      }
    } else if (activeScheme) {
      try {
        setSaving(true);
        await axios.put(`${API_URL}/schemes/${activeScheme.id}`, {
          title: activeScheme.title,
          description: activeScheme.description,
          academic_session_id: activeScheme.academic_session_id,
          term_id: activeScheme.term_id,
          weeks: editorWeeks
        });
        setMessage({ type: 'success', text: 'Scheme of Work updated successfully!' });
        setIsEditing(false);
        handleOpenDetail(activeScheme.id);
        fetchSchemes();
      } catch (err) {
        setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update scheme.' });
      } finally {
        setSaving(false);
      }
    }
  };

  const handleTogglePublish = async (schemeId) => {
    try {
      const res = await axios.patch(`${API_URL}/schemes/${schemeId}/publish`);
      setMessage({ type: 'success', text: res.data.message });
      if (activeScheme && activeScheme.id === schemeId) {
        setActiveScheme({ ...activeScheme, status: res.data.status });
      }
      fetchSchemes();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update status.' });
    }
  };

  const handleDeleteScheme = async (schemeId) => {
    if (!confirm('Are you sure you want to delete this Scheme of Work?')) return;
    try {
      await axios.delete(`${API_URL}/schemes/${schemeId}`);
      setMessage({ type: 'success', text: 'Scheme of Work deleted.' });
      setActiveScheme(null);
      fetchSchemes();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete.' });
    }
  };

  const handleRunAiReview = async (schemeId) => {
    try {
      setAiReviewing(true);
      const res = await axios.post(`${API_URL}/schemes/${schemeId}/ai-review`);
      setAiReport(res.data.review);
      if (activeScheme && activeScheme.id === schemeId) {
        setActiveScheme({ ...activeScheme, ai_review: res.data.review });
      }
      fetchSchemes();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'AI review failed.' });
    } finally {
      setAiReviewing(false);
    }
  };

  const handleAddWeek = () => {
    const nextWeekNum = editorWeeks.length + 1;
    setEditorWeeks([
      ...editorWeeks,
      {
        week_number: nextWeekNum,
        topic: '',
        sub_topics: '',
        learning_objectives: '',
        activities_and_resources: ''
      }
    ]);
  };

  const handleRemoveWeek = (weekIdx) => {
    const updated = editorWeeks.filter((_, idx) => idx !== weekIdx).map((w, idx) => ({
      ...w,
      week_number: idx + 1
    }));
    setEditorWeeks(updated);
  };

  const handleWeekChange = (idx, field, val) => {
    const updated = [...editorWeeks];
    updated[idx] = { ...updated[idx], [field]: val };
    setEditorWeeks(updated);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-blue-600" />
            Scheme of Work
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create, structure, and publish weekly curriculum roadmaps per subject, reviewed by EduMan AI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!activeScheme && !isCreating && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-blue-700 transition shadow-xs"
            >
              <Plus className="w-4 h-4" /> New Scheme of Work
            </button>
          )}
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl text-xs sm:text-sm flex items-center justify-between border ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Main View Controller */}
      {!activeScheme && !isCreating ? (
        /* List View */
        <div className="space-y-6">
          {/* Subject & Class Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center gap-4">
            <div className="w-full md:w-1/2 flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[70px]">Subject:</span>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs sm:text-sm font-semibold text-gray-900 bg-gray-50/50 focus:bg-white transition"
              >
                <option value="">All Assigned Subjects</option>
                {options.subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-1/2 flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[70px]">Class:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs sm:text-sm font-semibold text-gray-900 bg-gray-50/50 focus:bg-white transition"
              >
                <option value="">All Assigned Classes</option>
                {options.classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Schemes Grid */}
          {loading ? (
            <div className="p-12 text-center text-gray-400 bg-white rounded-3xl border border-gray-100">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
              Loading Schemes of Work...
            </div>
          ) : schemes.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 shadow-xs space-y-4">
              <Layers className="w-12 h-12 text-gray-300 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-gray-900">No Scheme of Work Found</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                  You have not created a scheme of work for this subject and class yet.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" /> Create Scheme of Work
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {schemes.map(sch => {
                const aiReview = sch.ai_review ? (typeof sch.ai_review === 'string' ? JSON.parse(sch.ai_review) : sch.ai_review) : null;
                return (
                  <div
                    key={sch.id}
                    className="bg-white rounded-3xl border border-gray-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold truncate">
                          {sch.subject_name}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          sch.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {sch.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-gray-900 line-clamp-2">{sch.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {sch.class_name} • {sch.session_name || 'Session'} • {sch.term_name || 'Term'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-600 pt-1">
                        <span className="flex items-center gap-1 font-semibold">
                          <ListOrdered className="w-3.5 h-3.5 text-gray-400" /> {sch.total_weeks} Weeks
                        </span>
                        {aiReview && (
                          <span className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-[11px] ${
                            aiReview.score >= 80 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            <Sparkles className="w-3 h-3" /> AI Score: {aiReview.score}/100
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(sch.id)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        Open Scheme <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(sch.id)}
                          className={`p-1.5 rounded-lg text-xs font-bold transition ${
                            sch.status === 'published' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={sch.status === 'published' ? 'Revert to Draft' : 'Publish to Students'}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteScheme(sch.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete Scheme"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : isCreating ? (
        /* Create Mode */
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-500 mr-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900">New Subject Scheme of Work</h2>
                <p className="text-xs text-gray-500">Plan out the weekly syllabus roadmap for your class.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveScheme}
                disabled={saving}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save Scheme of Work
              </button>
            </div>
          </div>

          {/* Form Header Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Subject *</label>
              <select
                value={formHeader.subject_id}
                onChange={(e) => {
                  const subObj = options.subjects.find(s => String(s.id) === e.target.value);
                  const classObj = options.classes.find(c => String(c.id) === formHeader.class_id);
                  setFormHeader({
                    ...formHeader,
                    subject_id: e.target.value,
                    title: subObj && classObj ? `${subObj.name} Scheme of Work - ${classObj.name}` : formHeader.title
                  });
                }}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-xs sm:text-sm font-semibold"
              >
                <option value="">Select Subject</option>
                {options.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Class *</label>
              <select
                value={formHeader.class_id}
                onChange={(e) => {
                  const classObj = options.classes.find(c => String(c.id) === e.target.value);
                  const subObj = options.subjects.find(s => String(s.id) === formHeader.subject_id);
                  setFormHeader({
                    ...formHeader,
                    class_id: e.target.value,
                    title: subObj && classObj ? `${subObj.name} Scheme of Work - ${classObj.name}` : formHeader.title
                  });
                }}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-xs sm:text-sm font-semibold"
              >
                <option value="">Select Class</option>
                {options.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Academic Session</label>
              <select
                value={formHeader.academic_session_id}
                onChange={(e) => setFormHeader({ ...formHeader, academic_session_id: e.target.value })}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-xs sm:text-sm"
              >
                <option value="">Select Session</option>
                {options.sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Term</label>
              <select
                value={formHeader.term_id}
                onChange={(e) => setFormHeader({ ...formHeader, term_id: e.target.value })}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-xs sm:text-sm"
              >
                <option value="">Select Term</option>
                {options.terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Scheme Title *</label>
            <input
              type="text"
              value={formHeader.title}
              onChange={(e) => setFormHeader({ ...formHeader, title: e.target.value })}
              className="w-full rounded-xl border border-gray-300 p-2.5 text-xs sm:text-sm font-bold"
              placeholder="e.g. JSS 1 Mathematics 1st Term Scheme of Work"
            />
          </div>

          {/* Weekly Editor Table */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ListOrdered className="w-5 h-5 text-blue-600" />
                Weekly Topics Breakdown ({editorWeeks.length} Weeks)
              </h3>
              <button
                type="button"
                onClick={handleAddWeek}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Week
              </button>
            </div>

            <div className="space-y-4">
              {editorWeeks.map((week, idx) => (
                <div key={idx} className="p-4 bg-gray-50/70 rounded-2xl border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-black">
                      Week {week.week_number}
                    </span>
                    {editorWeeks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveWeek(idx)}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold p-1"
                      >
                        Remove Week
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">Topic / Theme *</label>
                      <input
                        type="text"
                        value={week.topic}
                        onChange={(e) => handleWeekChange(idx, 'topic', e.target.value)}
                        placeholder={`e.g. ${formHeader.title.includes('Math') ? 'Fractions & Decimals' : 'Main Topic'}`}
                        className="w-full rounded-xl border border-gray-300 p-2 text-xs font-semibold bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">Sub-Topics / Concepts</label>
                      <input
                        type="text"
                        value={week.sub_topics}
                        onChange={(e) => handleWeekChange(idx, 'sub_topics', e.target.value)}
                        placeholder="e.g. Proper fractions, improper fractions, conversion"
                        className="w-full rounded-xl border border-gray-300 p-2 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">Learning Objectives (SMART)</label>
                      <textarea
                        rows={2}
                        value={week.learning_objectives}
                        onChange={(e) => handleWeekChange(idx, 'learning_objectives', e.target.value)}
                        placeholder="By the end of the lesson, students should be able to: 1. Identify..., 2. Solve..."
                        className="w-full rounded-xl border border-gray-300 p-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">Teacher / Student Activities & Resources</label>
                      <textarea
                        rows={2}
                        value={week.activities_and_resources}
                        onChange={(e) => handleWeekChange(idx, 'activities_and_resources', e.target.value)}
                        placeholder="Textbook ch. 3, chart of fractions, interactive group problem solving"
                        className="w-full rounded-xl border border-gray-300 p-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Detail / Edit View */
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 sm:p-8 space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setActiveScheme(null); setIsEditing(false); }}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                    {activeScheme.subject_name}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    activeScheme.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {activeScheme.status}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mt-1">{activeScheme.title}</h2>
                <p className="text-xs text-gray-500">
                  {activeScheme.class_name} • {activeScheme.session_name || 'Current Session'} • {activeScheme.term_name || 'Current Term'} • Teacher: {activeScheme.teacher_name}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* EduMan AI Review Button */}
              <button
                type="button"
                onClick={() => handleRunAiReview(activeScheme.id)}
                disabled={aiReviewing}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:from-violet-700 hover:to-indigo-700 transition flex items-center gap-1.5 shadow-xs disabled:opacity-60"
              >
                {aiReviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiReviewing ? 'Reviewing...' : 'Review with EduMan AI'}
              </button>

              {activeScheme.ai_review && (
                <button
                  type="button"
                  onClick={() => {
                    const rev = typeof activeScheme.ai_review === 'string' ? JSON.parse(activeScheme.ai_review) : activeScheme.ai_review;
                    setAiReport(rev);
                  }}
                  className="px-3 py-2 bg-violet-50 text-violet-700 rounded-xl text-xs font-bold hover:bg-violet-100 border border-violet-200 transition flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> View AI Report ({activeScheme.ai_review?.score || 0}/100)
                </button>
              )}

              {isEditing ? (
                <button
                  type="button"
                  onClick={handleSaveScheme}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Weeks
                </button>
              )}

              <button
                type="button"
                onClick={() => handleTogglePublish(activeScheme.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                  activeScheme.status === 'published' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {activeScheme.status === 'published' ? 'Revert to Draft' : 'Publish to Students'}
              </button>
            </div>
          </div>

          {/* AI Review Banner Summary if exists */}
          {activeScheme.ai_review && (
            (() => {
              const rev = typeof activeScheme.ai_review === 'string' ? JSON.parse(activeScheme.ai_review) : activeScheme.ai_review;
              return (
                <div className="p-4 bg-gradient-to-r from-violet-50 via-indigo-50 to-blue-50 border border-violet-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                      <span className="text-xs font-extrabold text-violet-900 uppercase tracking-wider">EduMan AI Pedagogical Review</span>
                      <span className="px-2 py-0.5 bg-violet-600 text-white rounded-md text-[10px] font-black">Score: {rev.score}/100</span>
                      <span className="text-xs text-violet-700 font-semibold">• Pacing: {rev.pacing_rating}</span>
                    </div>
                    <p className="text-xs text-violet-900 font-medium leading-relaxed">{rev.verdict}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiReport(rev)}
                    className="px-3.5 py-1.5 bg-white text-violet-700 text-xs font-bold rounded-xl shadow-xs hover:bg-violet-50 transition flex-shrink-0"
                  >
                    Read Full Review Details →
                  </button>
                </div>
              );
            })()
          )}

          {/* Weekly Content Breakdown Table / Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                Weekly Syllabus Schedule ({editorWeeks.length} Weeks)
              </h3>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleAddWeek}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Week
                </button>
              )}
            </div>

            {isEditing ? (
              /* Editable Weeks */
              <div className="space-y-4">
                {editorWeeks.map((week, idx) => (
                  <div key={idx} className="p-4 bg-gray-50/70 rounded-2xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-black">
                        Week {week.week_number}
                      </span>
                      {editorWeeks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWeek(idx)}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold p-1"
                        >
                          Remove Week
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-600 block mb-1">Topic / Theme *</label>
                        <input
                          type="text"
                          value={week.topic}
                          onChange={(e) => handleWeekChange(idx, 'topic', e.target.value)}
                          className="w-full rounded-xl border border-gray-300 p-2 text-xs font-semibold bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-600 block mb-1">Sub-Topics / Concepts</label>
                        <input
                          type="text"
                          value={week.sub_topics || ''}
                          onChange={(e) => handleWeekChange(idx, 'sub_topics', e.target.value)}
                          className="w-full rounded-xl border border-gray-300 p-2 text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-600 block mb-1">Learning Objectives (SMART)</label>
                        <textarea
                          rows={2}
                          value={week.learning_objectives || ''}
                          onChange={(e) => handleWeekChange(idx, 'learning_objectives', e.target.value)}
                          className="w-full rounded-xl border border-gray-300 p-2 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-600 block mb-1">Activities & Resources</label>
                        <textarea
                          rows={2}
                          value={week.activities_and_resources || ''}
                          onChange={(e) => handleWeekChange(idx, 'activities_and_resources', e.target.value)}
                          className="w-full rounded-xl border border-gray-300 p-2 text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Read-only Weekly Timeline Cards */
              <div className="space-y-4">
                {editorWeeks.map((week) => (
                  <div key={week.id || week.week_number} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs hover:border-blue-300 transition space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                          W{week.week_number}
                        </span>
                        <div>
                          <h4 className="text-sm sm:text-base font-bold text-gray-900">{week.topic || 'Untitled Topic'}</h4>
                          {week.sub_topics && (
                            <p className="text-xs text-gray-500 mt-0.5">{week.sub_topics}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {(week.learning_objectives || week.activities_and_resources) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-100 text-xs">
                        {week.learning_objectives && (
                          <div className="p-3 bg-blue-50/50 rounded-xl space-y-1">
                            <span className="font-bold text-blue-900 block">Learning Objectives:</span>
                            <p className="text-gray-700 whitespace-pre-line leading-relaxed">{week.learning_objectives}</p>
                          </div>
                        )}
                        {week.activities_and_resources && (
                          <div className="p-3 bg-emerald-50/50 rounded-xl space-y-1">
                            <span className="font-bold text-emerald-900 block">Activities & Teaching Aids:</span>
                            <p className="text-gray-700 whitespace-pre-line leading-relaxed">{week.activities_and_resources}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Review Report Modal */}
      {aiReport && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-gradient-to-r from-violet-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">EduMan AI Scheme of Work Review</h3>
                  <p className="text-xs text-violet-200">Curriculum alignment & pedagogical assessment</p>
                </div>
              </div>
              <button
                onClick={() => setAiReport(null)}
                className="p-2 text-violet-200 hover:text-white rounded-xl transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
              {/* Score & Verdict */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-5 bg-violet-50 border border-violet-200 rounded-2xl">
                <div className="w-16 h-16 rounded-2xl bg-violet-600 text-white flex flex-col items-center justify-center shadow-xs flex-shrink-0">
                  <span className="text-xl font-black">{aiReport.score}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">/ 100</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-violet-900">Pedagogical Verdict</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      aiReport.subject_alignment ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {aiReport.subject_alignment ? '✓ Subject Aligned' : '⚠️ Subject Mismatch'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-violet-950 leading-relaxed font-medium">{aiReport.verdict}</p>
                </div>
              </div>

              {/* Strengths */}
              {aiReport.strengths?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-green-600" /> Key Strengths
                  </h4>
                  <ul className="space-y-1.5 pl-2 text-xs sm:text-sm text-gray-700">
                    {aiReport.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-500 font-bold">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weaknesses */}
              {aiReport.weaknesses?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" /> Areas for Improvement
                  </h4>
                  <ul className="space-y-1.5 pl-2 text-xs sm:text-sm text-gray-700">
                    {aiReport.weaknesses.map((w, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {aiReport.recommendations?.length > 0 && (
                <div className="space-y-2 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" /> Actionable Recommendations
                  </h4>
                  <ul className="space-y-2 pl-2 text-xs sm:text-sm text-gray-700">
                    {aiReport.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-[11px] text-gray-400 font-medium">Reviewed on {new Date(aiReport.reviewed_at || Date.now()).toLocaleDateString()}</span>
              <button
                type="button"
                onClick={() => setAiReport(null)}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
