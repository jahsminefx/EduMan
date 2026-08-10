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
      <div className="rounded-2xl bg-gradient-to-r from-violet-700 to-blue-600 p-4 sm:p-6 text-white shadow-xs">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0" />
          <h2 className="text-xl sm:text-2xl font-bold">EduMan AI</h2>
        </div>
        <p className="mt-2 max-w-2xl text-xs sm:text-sm text-blue-100 leading-relaxed">
          Generate a strong first draft, then use your professional judgment to edit and publish it.
          Nothing generated here is visible to students until you approve it.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <Link key={card.path} to={card.path} className="group rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl text-white ${card.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3.5 text-base sm:text-lg font-bold text-gray-900">{card.title}</h3>
              <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-gray-500">{card.description}</p>
              <span className="mt-3.5 inline-block text-xs sm:text-sm font-semibold text-blue-600 group-hover:underline">Open tool →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
