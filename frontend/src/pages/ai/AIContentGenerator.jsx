import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, Download, FileText, Loader2, RefreshCw, Save, Send, Sparkles } from 'lucide-react';
import API_URL from '../../config/api';
import {
  applyOptionDefaults,
  assignmentValue,
  contentTypeOptions,
  downloadProtected,
  selectAssignment,
} from './aiUtils';

const emptyForm = {
  class_id: '',
  subject_id: '',
  topic: '',
  content_type: 'lesson_note',
  length: 'medium',
  tone: 'professional',
  include_examples: true,
  include_assessment: true,
  academic_session_id: '',
  term_id: '',
};

export default function AIContentGenerator() {
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('id');
  const [options, setOptions] = useState({ assignments: [], sessions: [], terms: [], usage: null });
  const [form, setForm] = useState(emptyForm);
  const [resource, setResource] = useState(null);
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
        if (draftId) requests.push(axios.get(`${API_URL}/ai/resources/${draftId}`));
        const [optionResponse, draftResponse] = await Promise.all(requests);
        setOptions(optionResponse.data);
        applyOptionDefaults(optionResponse.data, setForm);
        if (draftResponse) setResource(draftResponse.data.resource);
      } catch (error) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to load the EduMan AI content workspace.' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [draftId]);

  const refreshUsage = async () => {
    const response = await axios.get(`${API_URL}/ai/options`);
    setOptions(response.data);
  };

  const generate = async event => {
    event.preventDefault();
    setBusy('generate');
    setMessage({ type: '', text: '' });
    try {
      const response = await axios.post(`${API_URL}/ai/generate/content`, form);
      setResource(response.data.resource);
      setMessage({ type: 'success', text: response.data.message });
      await refreshUsage();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Learning content generation failed.' });
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    setBusy('save');
    try {
      const response = await axios.put(`${API_URL}/ai/resources/${resource.id}`, resource);
      setResource(response.data.resource);
      setMessage({ type: 'success', text: response.data.message });
      return response.data.resource;
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save the learning content.' });
      throw error;
    } finally {
      setBusy('');
    }
  };

  const publish = async () => {
    setBusy('publish');
    try {
      await axios.put(`${API_URL}/ai/resources/${resource.id}`, resource);
      const response = await axios.post(`${API_URL}/ai/resources/${resource.id}/publish`);
      setResource(response.data.resource);
      setMessage({ type: 'success', text: response.data.message });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not publish the learning content.' });
    } finally {
      setBusy('');
    }
  };

  const regenerate = async () => {
    setBusy('regenerate');
    try {
      const response = await axios.post(`${API_URL}/ai/resources/${resource.id}/regenerate`);
      setResource(response.data.resource);
      setMessage({ type: 'success', text: response.data.message });
      await refreshUsage();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not regenerate the learning content.' });
    } finally {
      setBusy('');
    }
  };

  const download = async format => {
    setBusy(`download-${format}`);
    try {
      await downloadProtected(`${API_URL}/ai/library/${resource.id}/download?format=${format}`, `${resource.title}.${format}`);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || `Could not download ${format.toUpperCase()}.` });
    } finally {
      setBusy('');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading EduMan AI learning content generator...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-900"><Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0" /> EduMan AI Learning Content Generator</h2>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">Create an editable document, review it, then publish it to the learning library.</p>
        </div>
        {options.usage && (
          <span className="self-start sm:self-auto rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
            {options.usage.remaining} of {options.usage.limit} generations remaining today
          </span>
        )}
      </div>

      {message.text && (
        <div className={`rounded-2xl border p-4 text-xs sm:text-sm font-medium ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {!resource && (
        <form onSubmit={generate} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs">
          {options.assignments.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-800">
              You need a class and subject assignment before using EduMan AI generation. Contact your School Admin.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700">
                  Assigned class and subject
                  <select required value={assignmentValue(form)} onChange={event => selectAssignment(event.target.value, setForm)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                    <option value="">Select assignment</option>
                    {options.assignments.map(item => <option key={item.id} value={`${item.class_id}:${item.subject_id}`}>{item.class_name} — {item.subject_name}</option>)}
                  </select>
                </label>
                <label className="text-xs sm:text-sm font-medium text-gray-700">
                  Topic
                  <input required value={form.topic} onChange={event => setForm({ ...form, topic: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" placeholder="e.g. The Water Cycle" />
                </label>
                <label className="text-xs sm:text-sm font-medium text-gray-700">
                  Content type
                  <select value={form.content_type} onChange={event => setForm({ ...form, content_type: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                    {contentTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-xs sm:text-sm font-medium text-gray-700">
                  Length
                  <select value={form.length} onChange={event => setForm({ ...form, length: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                    <option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option>
                  </select>
                </label>
                <label className="text-xs sm:text-sm font-medium text-gray-700">
                  Tone
                  <select value={form.tone} onChange={event => setForm({ ...form, tone: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                    <option value="professional">Professional</option><option value="friendly">Friendly</option><option value="simple">Simple</option><option value="exam_focused">Exam Focused</option>
                  </select>
                </label>
                <div className="flex flex-col justify-center gap-2.5 rounded-xl border border-gray-200 p-3 bg-gray-50/50">
                  <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-700"><input type="checkbox" checked={form.include_examples} onChange={event => setForm({ ...form, include_examples: event.target.checked })} /> Include examples</label>
                  <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-700"><input type="checkbox" checked={form.include_assessment} onChange={event => setForm({ ...form, include_assessment: event.target.checked })} /> Include assessment questions</label>
                </div>
                <label className="text-xs sm:text-sm font-medium text-gray-700">
                  Academic session
                  <select required value={form.academic_session_id} onChange={event => setForm({ ...form, academic_session_id: event.target.value, term_id: '' })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                    <option value="">Select session</option>
                    {options.sessions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="text-xs sm:text-sm font-medium text-gray-700">
                  Term
                  <select required value={form.term_id} onChange={event => setForm({ ...form, term_id: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                    <option value="">Select term</option>
                    {filteredTerms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex justify-end pt-2">
                <button disabled={busy || !options.ai_enabled} className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 transition shadow-xs">
                  {busy === 'generate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {busy === 'generate' ? 'Generating document…' : 'Generate Learning Content'}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {resource && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="sm:col-span-2 text-xs sm:text-sm font-medium text-gray-700">Document title<input value={resource.title} onChange={event => setResource({ ...resource, title: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm text-gray-900 font-bold" /></label>
              <label className="text-xs sm:text-sm font-medium text-gray-700">Content type<select value={resource.content_type} onChange={event => setResource({ ...resource, content_type: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm text-gray-900">{contentTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <label className="mt-5 block text-xs sm:text-sm font-medium text-gray-700">
              Document body
              <textarea value={resource.body} onChange={event => setResource({ ...resource, body: event.target.value })} rows="24" className="mt-1 w-full rounded-xl border border-gray-300 p-3.5 sm:p-4 font-mono text-xs sm:text-sm leading-relaxed text-gray-900 focus:ring-2 focus:ring-blue-500" />
            </label>
          </div>

          <div className="sticky bottom-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 rounded-2xl border border-gray-200 bg-white/95 p-3.5 sm:p-4 shadow-lg backdrop-blur-xs">
            <button onClick={save} disabled={busy} className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2.5 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"><Save className="mr-2 h-4 w-4" /> Save Draft</button>
            <button onClick={regenerate} disabled={busy} className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-blue-300 px-4 py-2.5 text-xs sm:text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-60">{busy === 'regenerate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Regenerate</button>
            <button onClick={publish} disabled={busy} className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-green-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60">{resource.status === 'published' ? <CheckCircle className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />} {resource.status === 'published' ? 'Published' : 'Save & Publish'}</button>
            <div className="flex gap-2">
              <button onClick={() => download('pdf')} disabled={busy} className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2.5 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50"><Download className="mr-1.5 h-4 w-4" /> PDF</button>
              <button onClick={() => download('docx')} disabled={busy} className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2.5 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50"><FileText className="mr-1.5 h-4 w-4" /> DOCX</button>
            </div>
            {!draftId && <button onClick={() => setResource(null)} className="sm:ml-auto text-center text-xs sm:text-sm font-semibold text-gray-500 hover:text-gray-800 py-1">Start another document</button>}
          </div>
        </div>
      )}
    </div>
  );
}

