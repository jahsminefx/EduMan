import React from 'react';

export default function StatCard({ name, stat, icon, color, subtext }) {
  return (
    <div className="bg-white overflow-hidden shadow-xs rounded-2xl border border-gray-100 p-4 sm:p-6 flex items-center hover:shadow-md transition-all duration-300 h-full">
      <div className={`p-3 sm:p-4 rounded-xl flex-shrink-0 ${color.replace('bg-', 'bg-opacity-10 text-').replace('500', '600')}`}>
        {React.createElement(icon, {
          className: `h-6 w-6 sm:h-8 sm:w-8 ${color.replace('bg-', 'text-')}`,
          'aria-hidden': true
        })}
      </div>
      <div className="ml-3 sm:ml-5 min-w-0 flex-1">
        <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">{name}</dt>
        <dd className="flex items-baseline flex-wrap gap-x-2">
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">{stat}</div>
          {subtext && (
            <div className="text-xs sm:text-sm font-medium text-gray-500">
              {subtext}
            </div>
          )}
        </dd>
      </div>
    </div>
  );
}
