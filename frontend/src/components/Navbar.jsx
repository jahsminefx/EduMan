import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-blue-600 p-2 rounded-lg shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">EduMan</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'text-blue-700 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.name}
              </Link>
            ))}

            {user ? (
              <Link
                to="/dashboard"
                className="ml-3 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
              >
                Go to Dashboard
              </Link>
            ) : (
              <a
                href="#auth"
                className="ml-3 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
              >
                Sign In
              </a>
            )}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-gray-600 hover:text-gray-900">
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-100 mt-2 pt-3 space-y-1">
            {links.map(link => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'text-blue-700 bg-blue-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {link.name}
              </Link>
            ))}
            {user ? (
              <Link to="/dashboard" onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg">
                Go to Dashboard
              </Link>
            ) : (
              <a href="#auth" onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg">
                Sign In
              </a>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
