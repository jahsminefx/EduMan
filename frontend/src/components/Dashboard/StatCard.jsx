import React from 'react';

export default function StatCard({ name, stat, icon: Icon, color, subtext }) {
  return (
    <div className="bg-white overflow-hidden shadow-sm rounded-2xl border border-gray-100 p-6 flex items-center hover:shadow-md transition-all duration-300">
      <div className={`p-4 rounded-xl ${color.replace('bg-', 'bg-opacity-10 text-').replace('500', '600')}`}>
        <Icon className={`h-8 w-8 ${color.replace('bg-', 'text-')}`} aria-hidden="true" />
      </div>
      <div className="ml-5 w-0 flex-1">
        <dt className="text-sm font-medium text-gray-500 truncate">{name}</dt>
        <dd className="flex items-baseline">
          <div className="text-3xl font-bold text-gray-900">{stat}</div>
          {subtext && (
            <div className="ml-2 text-sm font-medium text-gray-500">
              {subtext}
            </div>
          )}
        </dd>
      </div>
    </div>
  );
}
