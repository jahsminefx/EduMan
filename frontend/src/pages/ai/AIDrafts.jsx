import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { BookOpenCheck, FileClock, FileText } from 'lucide-react';
import API_URL from '../../config/api';
import { displayLabel } from './aiUtils';

export default function AIDrafts() {
  const [data, setData] = useState({ quizzes: [], resources: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/ai/drafts`)
      .then(response => setData(response.data))
      .catch(error => setMessage(error.response?.data?.message || 'Unable to load EduMan AI drafts.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading EduMan AI drafts...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><FileClock className="h-5 w-5 text-amber-600" /> EduMan AI Drafts</h2>
        <p className="mt-1 text-sm text-gray-500">These items are private and cannot be accessed by students.</p>
      </div>
      {message && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{message}</div>}

      <section>
        <h3 className="mb-3 font-bold text-gray-800">Quiz drafts</h3>
        {data.quizzes.length === 0 ? <p className="rounded-xl border bg-white p-5 text-sm text-gray-500">No EduMan AI quiz drafts.</p> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.quizzes.map(quiz => (
              <Link key={quiz.id} to={`/dashboard/teacher/ai/quiz?id=${quiz.id}`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
                <BookOpenCheck className="h-5 w-5 text-violet-600" />
                <h4 className="mt-3 font-bold text-gray-900">{quiz.title}</h4>
                <p className="mt-1 text-xs text-gray-500">{quiz.class_name} • {quiz.subject_name}</p>
                <p className="mt-3 text-sm text-gray-600">{quiz.question_count} questions • {displayLabel(quiz.difficulty)}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-violet-600">Review and edit →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 font-bold text-gray-800">Learning content drafts</h3>
        {data.resources.length === 0 ? <p className="rounded-xl border bg-white p-5 text-sm text-gray-500">No EduMan AI learning content drafts.</p> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.resources.map(resource => (
              <Link key={resource.id} to={`/dashboard/teacher/ai/content?id=${resource.id}`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
                <FileText className="h-5 w-5 text-blue-600" />
                <h4 className="mt-3 font-bold text-gray-900">{resource.title}</h4>
                <p className="mt-1 text-xs text-gray-500">{resource.class_name} • {resource.subject_name}</p>
                <p className="mt-3 text-sm text-gray-600">{displayLabel(resource.content_type)}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-blue-600">Review and edit →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
