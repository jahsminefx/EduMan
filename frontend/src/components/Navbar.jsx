import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Menu, X } from 'lucide-react';
import BrandLogo from './BrandLogo';

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const links = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <nav aria-label="Public Navbar" className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16 items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center" onClick={() => setMenuOpen(false)}>
            <BrandLogo className="h-9 sm:h-11 w-auto" />
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'text-blue-700 bg-blue-50 font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.name}
              </Link>
            ))}

            {user ? (
              <Link
                to="/dashboard"
                className="ml-3 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-xs shadow-blue-500/20"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                to="/#auth"
                className="ml-3 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-xs shadow-blue-500/20"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button 
            type="button"
            aria-label="Toggle Navigation Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)} 
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-100 mt-1 pt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {links.map(link => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'text-blue-700 bg-blue-50 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {link.name}
              </Link>
            ))}
            {user ? (
              <Link to="/dashboard" onClick={() => setMenuOpen(false)}
                className="block text-center px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-xs">
                Go to Dashboard
              </Link>
            ) : (
              <Link to="/#auth" onClick={() => setMenuOpen(false)}
                className="block text-center px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-xs">
                Sign In
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
