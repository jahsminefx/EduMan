import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, Loader2, Plus, RefreshCw, Save, Send, Sparkles, Trash2 } from 'lucide-react';
import API_URL from '../../config/api';
import { applyOptionDefaults, assignmentValue, selectAssignment } from './aiUtils';

const emptyForm = {
  class_id: '',
  subject_id: '',
  topic: '',
  difficulty: 'medium',
  number_of_questions: 10,
  question_type: 'multiple_choice',
  duration_minutes: 30,
  academic_session_id: '',
  term_id: '',
};

const blankQuestion = () => ({
  question_text: '',
  question_type: 'multiple_choice',
  options: ['', '', '', ''],
  correct_option_index: 0,
  explanation: '',
});

export default function AIQuizGenerator() {
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('id');
  const [options, setOptions] = useState({ assignments: [], sessions: [], terms: [], usage: null });
  const [form, setForm] = useState(emptyForm);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const filteredTerms = useMemo(
    () => options.terms.filter(term => String(term.session_id) === String(form.academic_session_id)),
    [options.terms, form.academic_session_id]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const requests = [axios.get(`${API_URL}/ai/options`)];
        if (draftId) requests.push(axios.get(`${API_URL}/ai/quizzes/${draftId}`));
        const [optionResponse, draftResponse] = await Promise.all(requests);
        setOptions(optionResponse.data);
        applyOptionDefaults(optionResponse.data, setForm);
        if (draftResponse) {
          setQuiz(draftResponse.data.quiz);
          setForm(current => ({
            ...current,
            class_id: draftResponse.data.quiz.class_id,
            subject_id: draftResponse.data.quiz.subject_id,
            topic: draftResponse.data.quiz.topic || '',
            difficulty: draftResponse.data.quiz.difficulty || 'medium',
            duration_minutes: draftResponse.data.quiz.duration_minutes || 30,
          }));
        }
      } catch (error) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to load the EduMan AI quiz workspace.' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [draftId]);

  const showMessage = (text, type = 'success') => setMessage({ text, type });

  const refreshUsage = async () => {
    const response = await axios.get(`${API_URL}/ai/options`);
    setOptions(response.data);
  };

  const generate = async event => {
    event.preventDefault();
    setBusy('generate');
    setMessage({ type: '', text: '' });
    try {
      const response = await axios.post(`${API_URL}/ai/generate/quiz`, form);
      setQuiz(response.data.quiz);
      showMessage(response.data.message);
      await refreshUsage();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Quiz generation failed.', 'error');
    } finally {
      setBusy('');
    }
  };

  const updateQuestion = (index, field, value) => {
    setQuiz(current => ({
      ...current,
      questions: current.questions.map((question, questionIndex) => (
        questionIndex === index ? { ...question, [field]: value } : question
      )),
    }));
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    setQuiz(current => ({
      ...current,
      questions: current.questions.map((question, index) => {
        if (index !== questionIndex) return question;
        const optionsList = [...question.options];
        optionsList[optionIndex] = value;
        return { ...question, options: optionsList };
      }),
    }));
  };

  const save = async () => {
    setBusy('save');
    try {
      const response = await axios.put(`${API_URL}/ai/quizzes/${quiz.id}`, quiz);
      setQuiz(response.data.quiz);
      showMessage(response.data.message);
    } catch (error) {
      showMessage(error.response?.data?.message || 'Could not save the quiz draft.', 'error');
    } finally {
      setBusy('');
    }
  };

  const publish = async () => {
    setBusy('publish');
    try {
      await axios.put(`${API_URL}/ai/quizzes/${quiz.id}`, quiz);
      const response = await axios.post(`${API_URL}/ai/quizzes/${quiz.id}/publish`);
      setQuiz(response.data.quiz);
      showMessage(response.data.message);
    } catch (error) {
      showMessage(error.response?.data?.message || 'Could not publish the quiz.', 'error');
    } finally {
      setBusy('');
    }
  };

  const regenerate = async () => {
    setBusy('regenerate');
    try {
      const response = await axios.post(`${API_URL}/ai/quizzes/${quiz.id}/regenerate`);
      setQuiz(response.data.quiz);
      showMessage(response.data.message);
      await refreshUsage();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Could not regenerate the quiz.', 'error');
    } finally {
      setBusy('');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading EduMan AI quiz generator...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><Sparkles className="h-5 w-5 text-violet-600" /> EduMan AI Quiz Generator</h2>
          <p className="mt-1 text-sm text-gray-500">Generated quizzes remain private drafts until you publish them.</p>
        </div>
        {options.usage && (
          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
            {options.usage.remaining} of {options.usage.limit} generations remaining today
          </span>
        )}
      </div>

      {message.text && (
        <div className={`rounded-xl border p-4 text-sm font-medium ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {!quiz && (
        <form onSubmit={generate} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          {options.assignments.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              You need a class and subject assignment before using EduMan AI generation. Contact your School Admin.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">
                  Assigned class and subject
                  <select required value={assignmentValue(form)} onChange={event => selectAssignment(event.target.value, setForm)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5">
                    <option value="">Select assignment</option>
                    {options.assignments.map(item => <option key={item.id} value={`${item.class_id}:${item.subject_id}`}>{item.class_name} — {item.subject_name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Topic
                  <input required value={form.topic} onChange={event => setForm({ ...form, topic: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5" placeholder="e.g. Photosynthesis" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Difficulty
                  <select value={form.difficulty} onChange={event => setForm({ ...form, difficulty: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5">
                    <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Question type
                  <select value={form.question_type} onChange={event => setForm({ ...form, question_type: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5">
                    <option value="multiple_choice">Multiple Choice</option><option value="true_false">True / False</option><option value="mixed">Mixed</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Number of questions
                  <input type="number" min="1" max="30" required value={form.number_of_questions} onChange={event => setForm({ ...form, number_of_questions: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Duration (minutes)
                  <input type="number" min="1" max="240" value={form.duration_minutes} onChange={event => setForm({ ...form, duration_minutes: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Academic session
                  <select required value={form.academic_session_id} onChange={event => setForm({ ...form, academic_session_id: event.target.value, term_id: '' })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5">
                    <option value="">Select session</option>
                    {options.sessions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Term
                  <select required value={form.term_id} onChange={event => setForm({ ...form, term_id: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5">
                    <option value="">Select term</option>
                    {filteredTerms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              </div>
              <button disabled={busy || !options.ai_enabled} className="inline-flex items-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
                {busy === 'generate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {busy === 'generate' ? 'Generating quiz…' : 'Generate Quiz'}
              </button>
            </>
          )}
        </form>
      )}

      {quiz && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="md:col-span-2 text-sm font-medium text-gray-700">Quiz title<input value={quiz.title} onChange={event => setQuiz({ ...quiz, title: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5" /></label>
              <label className="text-sm font-medium text-gray-700">Duration<input type="number" min="1" value={quiz.duration_minutes || 30} onChange={event => setQuiz({ ...quiz, duration_minutes: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5" /></label>
              <label className="md:col-span-2 text-sm font-medium text-gray-700">Topic<input value={quiz.topic || ''} onChange={event => setQuiz({ ...quiz, topic: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5" /></label>
              <label className="text-sm font-medium text-gray-700">Difficulty<select value={quiz.difficulty || 'medium'} onChange={event => setQuiz({ ...quiz, difficulty: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
            </div>
          </div>

          {quiz.questions.map((question, questionIndex) => (
            <div key={question.id || questionIndex} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-2 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">Q{questionIndex + 1}</span>
                <textarea rows="2" value={question.question_text} onChange={event => updateQuestion(questionIndex, 'question_text', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 font-medium" />
                <button type="button" onClick={() => setQuiz({ ...quiz, questions: quiz.questions.filter((_, index) => index !== questionIndex) })} className="mt-2 text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {question.options.map((option, optionIndex) => (
                  <label key={optionIndex} className={`flex items-center gap-2 rounded-lg border p-2 ${question.correct_option_index === optionIndex ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                    <input type="radio" name={`correct-${questionIndex}`} checked={question.correct_option_index === optionIndex} onChange={() => updateQuestion(questionIndex, 'correct_option_index', optionIndex)} />
                    <input value={option} onChange={event => updateOption(questionIndex, optionIndex, event.target.value)} className="min-w-0 flex-1 bg-transparent p-1 text-sm outline-none" />
                  </label>
                ))}
              </div>
              <label className="mt-4 block text-sm font-medium text-gray-700">Explanation<textarea rows="2" value={question.explanation || ''} onChange={event => updateQuestion(questionIndex, 'explanation', event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" /></label>
            </div>
          ))}

          <button type="button" onClick={() => setQuiz({ ...quiz, questions: [...quiz.questions, blankQuestion()] })} className="inline-flex items-center rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50">
            <Plus className="mr-2 h-4 w-4" /> Add Question
          </button>

          <div className="sticky bottom-4 flex flex-wrap gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            <button onClick={save} disabled={busy} className="inline-flex items-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"><Save className="mr-2 h-4 w-4" /> Save Draft</button>
            <button onClick={regenerate} disabled={busy} className="inline-flex items-center rounded-xl border border-violet-300 px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-60">{busy === 'regenerate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Regenerate</button>
            <button onClick={publish} disabled={busy} className="inline-flex items-center rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60">{quiz.status === 'published' ? <CheckCircle className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />} {quiz.status === 'published' ? 'Published' : 'Save & Publish'}</button>
            {!draftId && <button onClick={() => setQuiz(null)} className="ml-auto text-sm font-semibold text-gray-500 hover:text-gray-800">Start another quiz</button>}
          </div>
        </div>
      )}
    </div>
  );
}
