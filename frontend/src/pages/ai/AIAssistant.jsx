import { Link } from 'react-router-dom';
import { BookOpenCheck, FileClock, Library, Sparkles } from 'lucide-react';

const cards = [
  {
    title: 'Generate Quiz',
    description: 'Create editable, answer-keyed quizzes for your assigned classes and subjects.',
    path: '/dashboard/teacher/ai/quiz',
    icon: BookOpenCheck,
    color: 'bg-violet-600',
  },
  {
    title: 'Generate Learning Content',
    description: 'Prepare lesson notes, study guides, revision notes, assignments, and exam prep documents.',
    path: '/dashboard/teacher/ai/content',
    icon: Sparkles,
    color: 'bg-blue-600',
  },
  {
    title: 'EduMan AI Drafts',
    description: 'Review and edit generated work before students can see it.',
    path: '/dashboard/teacher/ai/drafts',
    icon: FileClock,
    color: 'bg-amber-500',
  },
  {
    title: 'Published EduMan AI Resources',
    description: 'See the quizzes and learning documents you have approved and published.',
    path: '/dashboard/teacher/ai/published',
    icon: Library,
    color: 'bg-emerald-600',
  },
];

export default function AIAssistant() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-violet-700 to-blue-600 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <Sparkles className="h-7 w-7" />
          <h2 className="text-2xl font-bold">EduMan AI</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-blue-100">
          Generate a strong first draft, then use your professional judgment to edit and publish it.
          Nothing generated here is visible to students until you approve it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <Link key={card.path} to={card.path} className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${card.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">{card.description}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-blue-600 group-hover:underline">Open tool →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
