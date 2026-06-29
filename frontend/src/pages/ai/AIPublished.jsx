import { useEffect, useState } from 'react';
import axios from 'axios';
import { BookOpenCheck, Download, Eye, FileText, Library, X } from 'lucide-react';
import API_URL from '../../config/api';
import { displayLabel, downloadProtected } from './aiUtils';

export default function AIPublished() {
  const [data, setData] = useState({ quizzes: [], resources: [] });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/ai/published`)
      .then(response => setData(response.data))
      .catch(error => setMessage(error.response?.data?.message || 'Unable to load published EduMan AI resources.'))
      .finally(() => setLoading(false));
  }, []);

  const download = async (resource, format) => {
    try {
      await downloadProtected(`${API_URL}/ai/library/${resource.id}/download?format=${format}`, `${resource.title}.${format}`);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Download failed.');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading published EduMan AI resources...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><Library className="h-5 w-5 text-emerald-600" /> Published EduMan AI Resources</h2>
        <p className="mt-1 text-sm text-gray-500">These items are available to students in their assigned class.</p>
      </div>
      {message && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{message}</div>}

      <section>
        <h3 className="mb-3 font-bold text-gray-800">Published quizzes</h3>
        {data.quizzes.length === 0 ? <p className="rounded-xl border bg-white p-5 text-sm text-gray-500">No published EduMan AI quizzes.</p> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.quizzes.map(quiz => (
              <div key={quiz.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <BookOpenCheck className="h-5 w-5 text-violet-600" />
                <h4 className="mt-3 font-bold text-gray-900">{quiz.title}</h4>
                <p className="mt-1 text-xs text-gray-500">{quiz.class_name} • {quiz.subject_name}</p>
                <p className="mt-3 text-sm text-gray-600">{quiz.question_count} questions • {displayLabel(quiz.difficulty)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 font-bold text-gray-800">Published learning content</h3>
        {data.resources.length === 0 ? <p className="rounded-xl border bg-white p-5 text-sm text-gray-500">No published EduMan AI learning content.</p> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.resources.map(resource => (
              <div key={resource.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <FileText className="h-5 w-5 text-blue-600" />
                <h4 className="mt-3 font-bold text-gray-900">{resource.title}</h4>
                <p className="mt-1 text-xs text-gray-500">{resource.class_name} • {resource.subject_name}</p>
                <p className="mt-3 text-sm text-gray-600">{displayLabel(resource.content_type)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => setSelected(resource)} className="inline-flex items-center rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"><Eye className="mr-1 h-3.5 w-3.5" /> View</button>
                  <button onClick={() => download(resource, 'pdf')} className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-bold text-gray-700"><Download className="mr-1 h-3.5 w-3.5" /> PDF</button>
                  <button onClick={() => download(resource, 'docx')} className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-bold text-gray-700"><Download className="mr-1 h-3.5 w-3.5" /> DOCX</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div><h3 className="text-xl font-bold text-gray-900">{selected.title}</h3><p className="text-sm text-gray-500">{selected.class_name} • {selected.subject_name}</p></div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 whitespace-pre-wrap rounded-xl bg-gray-50 p-5 text-sm leading-7 text-gray-800">{selected.body}</div>
          </div>
        </div>
      )}
    </div>
  );
}
