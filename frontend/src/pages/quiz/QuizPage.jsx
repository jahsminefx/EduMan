import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { HelpCircle, Plus, Clock, CheckCircle, Trash2, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import API_URL from '../../config/api';

export default function QuizPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null); // quiz being taken by student
  const [answers, setAnswers] = useState({});

  // Create form
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({ class_id: '', subject_id: '', title: '', duration_minutes: 30 });
  const [questions, setQuestions] = useState([{ question_text: '', options: ['', '', '', ''], correct_option_index: 0 }]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [qRes, clsRes, subRes] = await Promise.all([
        axios.get(`${API_URL}/quizzes`),
        axios.get(`${API_URL}/classes/classes`),
        axios.get(`${API_URL}/classes/subjects`)
      ]);
      setQuizzes(qRes.data.quizzes);
      setClasses(clsRes.data.classes);
      setSubjects(subRes.data.subjects);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const addQuestion = () => {
    setQuestions([...questions, { question_text: '', options: ['', '', '', ''], correct_option_index: 0 }]);
  };

  const updateQuestion = (idx, field, value) => {
    const updated = [...questions];
    updated[idx][field] = value;
    setQuestions(updated);
  };

  const updateOption = (qIdx, oIdx, value) => {
    const updated = [...questions];
    updated[qIdx].options[oIdx] = value;
    setQuestions(updated);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/quizzes`, { ...form, questions });
      setMessage('Quiz created!');
      setShowCreate(false);
      setForm({ class_id: '', subject_id: '', title: '', duration_minutes: 30 });
      setQuestions([{ question_text: '', options: ['', '', '', ''], correct_option_index: 0 }]);
      fetchData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Error creating quiz.');
    }
  };

  const takeQuiz = async (quizId) => {
    try {
      const res = await axios.get(`${API_URL}/quizzes/${quizId}`);
      setActiveQuiz(res.data);
      setAnswers({});
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not load quiz.');
    }
  };

  const submitQuiz = async () => {
    try {
      const res = await axios.post(`${API_URL}/quizzes/submit`, {
        quiz_id: activeQuiz.quiz.id,
        answers
      });
      setMessage(`Score: ${res.data.correct}/${res.data.total} (${res.data.score.toFixed(0)}%)`);
      setActiveQuiz(null);
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Error submitting quiz.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this quiz?')) return;
    try {
      await axios.delete(`${API_URL}/quizzes/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  // Quiz-taking view for students
  if (activeQuiz) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">{activeQuiz.quiz.title}</h2>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><Clock className="w-4 h-4" /> {activeQuiz.quiz.duration_minutes} minutes</p>
        </div>
        {activeQuiz.questions.map((q, qi) => (
          <div key={q.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="font-medium text-gray-800 mb-3">Q{qi + 1}. {q.question_text}</p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <label key={oi} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${answers[q.id] === oi ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name={`q_${q.id}`} checked={answers[q.id] === oi} onChange={() => setAnswers({...answers, [q.id]: oi})} className="accent-blue-600" />
                  <span className="text-sm text-gray-700">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <button onClick={submitQuiz} className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
          <Send className="w-4 h-4 mr-2" /> Submit Quiz
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2"><HelpCircle className="w-5 h-5 text-green-600" /> Quizzes</h2>
          <p className="text-sm text-gray-500">Create and take multiple-choice quizzes</p>
        </div>
        {user.role === 'Teacher' && (
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium">
            <Plus className="w-4 h-4 mr-1" /> New Quiz
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.includes('Score') || message.includes('created') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{message}</div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-semibold text-gray-800">Create Quiz</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select value={form.class_id} onChange={e => setForm({...form, class_id: e.target.value})} className="border rounded-md p-2" required>
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={form.subject_id} onChange={e => setForm({...form, subject_id: e.target.value})} className="border rounded-md p-2" required>
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="text" placeholder="Quiz Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="border rounded-md p-2" required />
            <input type="number" placeholder="Duration (min)" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: Number(e.target.value)})} className="border rounded-md p-2" min="1" />
          </div>

          <div className="space-y-4">
            {questions.map((q, qi) => (
              <div key={qi} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                <input type="text" placeholder={`Question ${qi + 1}`} value={q.question_text} onChange={e => updateQuestion(qi, 'question_text', e.target.value)} className="border rounded-md p-2 w-full bg-white" required />
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="radio" name={`correct_${qi}`} checked={q.correct_option_index === oi} onChange={() => updateQuestion(qi, 'correct_option_index', oi)} className="accent-green-600" />
                      <input type="text" placeholder={`Option ${oi + 1}`} value={opt} onChange={e => updateOption(qi, oi, e.target.value)} className="border rounded-md p-1.5 text-sm flex-1" required />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={addQuestion} className="px-4 py-2 border border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition text-sm">+ Add Question</button>
            <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm">Create Quiz</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading quizzes...</div>
      ) : quizzes.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-xl border shadow-sm">No quizzes found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map(q => (
            <div key={q.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-gray-800">{q.title}</h3>
                {(user.role === 'Teacher' || user.role === 'SchoolAdmin') && (
                  <button onClick={() => handleDelete(q.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
              <p className="text-xs text-green-600 mt-1">{q.class_name} • {q.subject_name}</p>
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                <Clock className="w-3 h-3" /> {q.duration_minutes} min
              </div>
              {user.role === 'Student' && (
                <button onClick={() => takeQuiz(q.id)} className="mt-3 flex items-center px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-medium">
                  <CheckCircle className="w-3 h-3 mr-1" /> Take Quiz
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
