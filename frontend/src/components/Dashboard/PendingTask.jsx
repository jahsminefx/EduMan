import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PendingTask({ label, count, action, color = 'blue' }) {
  if (count === 0) return null;

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100',
    red: 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100 hover:bg-yellow-100',
    green: 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100',
  };

  const currentClass = colorClasses[color] || colorClasses.blue;

  return (
    <Link 
      to={action}
      className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 group ${currentClass}`}
    >
      <div className="flex items-center space-x-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs opacity-75">{count} items pending</span>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-sm font-bold">{count}</span>
        <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}
