import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  GraduationCap, 
  Calendar,
  Clock,
  LogOut,
  FolderOpen,
  HelpCircle,
  Library,
  Menu,
  Megaphone,
  X,
  Settings,
  UserCog,
  Info,
  Sparkles,
  History,
  Bot
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

import NotificationDropdown from '../components/NotificationDropdown';

const ANNOUNCEMENT_ROLES = ['SchoolAdmin', 'Teacher', 'Student', 'Parent'];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const getLinks = () => {
    const base = [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ];

    if (ANNOUNCEMENT_ROLES.includes(user.role)) {
      base.push({ name: 'Announcements', path: '/announcements', icon: Megaphone });
    }

    switch(user.role) {
      case 'SuperAdmin':
        base.push(
          { name: 'Manage Schools', path: '/dashboard/admin/schools', icon: BookOpen },
          { name: 'School Admins', path: '/dashboard/admin/school-admins', icon: UserCog },
          { name: 'Support Inbox', path: '/dashboard/support/inbox', icon: HelpCircle },
          { name: 'Manage Knowledge Base', path: '/dashboard/support/kb/manage', icon: FolderOpen },
          { name: 'Support Analytics', path: '/dashboard/support/analytics', icon: Sparkles }
        );
        break;
      
      case 'SchoolAdmin':
        base.push(
          { name: 'Classes', path: '/dashboard/admin/classes', icon: BookOpen },
          { name: 'Subjects', path: '/dashboard/admin/subjects', icon: Library },
          { name: 'Teachers', path: '/dashboard/admin/teachers', icon: Users },
          { name: 'Students', path: '/dashboard/admin/students', icon: GraduationCap },
          { name: 'Report Cards', path: '/dashboard/reports/card', icon: FolderOpen },
          { name: 'EduMan AI', path: '/dashboard/admin/ai', icon: Bot },
          { name: 'EduMan AI Logs', path: '/dashboard/admin/ai/usage', icon: History },
          { name: 'EduMan AI Settings', path: '/dashboard/admin/ai/settings', icon: Sparkles },
          { name: 'Academic Settings', path: '/dashboard/admin/settings', icon: Settings },
          { name: 'Support Center', path: '/dashboard/support', icon: HelpCircle },
          { name: 'School Tickets', path: '/dashboard/support/tickets', icon: FolderOpen },
          { name: 'Knowledge Base', path: '/dashboard/support/kb', icon: BookOpen }
        );
        break;

      case 'Teacher':
        base.push(
          { name: 'Attendance', path: '/dashboard/teacher/attendance', icon: Calendar },
          { name: 'Gradebook', path: '/dashboard/teacher/grades', icon: BookOpen },
          { name: 'Timetable', path: '/dashboard/teacher/timetable', icon: Clock },
          { name: 'Homework', path: '/dashboard/teacher/homework', icon: FolderOpen },
          { name: 'EduMan AI', path: '/dashboard/teacher/ai', icon: Sparkles },
          { name: 'EduMan AI Drafts', path: '/dashboard/teacher/ai/drafts', icon: History },
          { name: 'Published EduMan AI', path: '/dashboard/teacher/ai/published', icon: Library },
          { name: 'Quizzes', path: '/dashboard/quiz', icon: HelpCircle },
          { name: 'Library', path: '/dashboard/content/library', icon: Library },
          { name: 'Report Cards', path: '/dashboard/reports/card', icon: GraduationCap },
          { name: 'Support Center', path: '/dashboard/support', icon: HelpCircle },
          { name: 'My Tickets', path: '/dashboard/support/tickets', icon: FolderOpen },
          { name: 'Knowledge Base', path: '/dashboard/support/kb', icon: BookOpen }
        );
        break;

      case 'Student':
        base.push(
          { name: 'My Homework', path: '/dashboard/teacher/homework', icon: FolderOpen },
          { name: 'Class Info', path: '/dashboard/student/class-info', icon: Info },
          { name: 'Quizzes', path: '/dashboard/quiz', icon: HelpCircle },
          { name: 'My Report Card', path: '/dashboard/reports/card', icon: BookOpen },
          { name: 'Library', path: '/dashboard/content/library', icon: Library },
          { name: 'Help Center', path: '/dashboard/support/kb', icon: HelpCircle }
        );
        break;

      case 'Parent':
        base.push(
          { name: 'My Children', path: '/dashboard/parent/children', icon: Users },
          { name: 'Report Cards', path: '/dashboard/reports/card', icon: GraduationCap },
          { name: 'Fee Statements', path: '/dashboard/parent/fees', icon: FolderOpen },
          { name: 'Help Center', path: '/dashboard/support/kb', icon: HelpCircle }
        );
        break;
        
      case 'ContentManager':
        base.push(
          { name: 'Content Library', path: '/dashboard/content/library', icon: Library },
          { name: 'Help Center', path: '/dashboard/support/kb', icon: HelpCircle }
        );
        break;
        
      case 'Accountant':
        base.push(
          { name: 'Fee Management', path: '/dashboard/finance/fees', icon: FolderOpen },
          { name: 'Help Center', path: '/dashboard/support/kb', icon: HelpCircle }
        );
        break;

      case 'SupportOfficer':
        base.push(
          { name: 'Support Inbox', path: '/dashboard/support/inbox', icon: HelpCircle },
          { name: 'Knowledge Base', path: '/dashboard/support/kb', icon: BookOpen }
        );
        break;
      
      default:
        break;
    }

    return base;
  };

  const links = getLinks();

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  React.useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  // Compute title & breadcrumbs
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentTitle = (location.pathname === '/' || location.pathname === '/dashboard') 
    ? (user.school_name || 'Dashboard Overview') 
    : pathSegments[pathSegments.length - 1].replace(/-/g, ' ');

  return (
    <div className="min-h-screen bg-gray-50 flex transition-colors duration-200">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close Navigation Sidebar"
        />
      )}

      {/* Sidebar */}
      <aside 
        aria-label="Sidebar Navigation"
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col shadow-2xl lg:shadow-sm
          transition-transform duration-300 ease-in-out transform lg:translate-x-0 lg:static lg:inset-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between h-14 sm:h-16 border-b border-gray-200 px-5 sm:px-6 flex-shrink-0">
          <Link to="/dashboard" className="flex items-center" onClick={() => setIsSidebarOpen(false)}>
            <BrandLogo className="h-9 sm:h-11 w-auto" />
          </Link>
          <button 
            type="button"
            aria-label="Close Menu"
            className="p-2 rounded-lg lg:hidden hover:bg-gray-100 text-gray-500 transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <nav aria-label="Main navigation" className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const exactOnly = ['/dashboard', '/dashboard/teacher/ai', '/dashboard/admin/ai', '/dashboard/support'].includes(link.path);
              const isActive = exactOnly
                ? location.pathname === link.path
                : location.pathname === link.path || location.pathname.startsWith(`${link.path}/`);
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs' 
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  <span className="truncate">{link.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex-shrink-0 border-t border-gray-200 p-4 bg-white">
          <div className="flex items-center px-2">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {user.name?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
            <div className="ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{user.name}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider truncate">{user.role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full flex items-center justify-center px-4 py-2 border border-gray-200 shadow-xs text-xs sm:text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-all active:scale-[0.98]"
          >
            <LogOut className="mr-2 w-4 h-4 text-gray-400" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="sticky top-0 z-30 bg-white shadow-xs border-b border-gray-200 h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button 
              type="button"
              aria-label="Open Navigation Sidebar"
              className="p-2 rounded-lg lg:hidden hover:bg-gray-100 text-gray-600 transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            
            <div className="min-w-0">
              {/* Desktop Breadcrumbs */}
              <div className="hidden md:flex items-center text-xs text-gray-400 space-x-1.5 mb-0.5">
                <Link to="/dashboard" className="hover:text-gray-600">Home</Link>
                {pathSegments.map((seg, idx) => (
                  <React.Fragment key={idx}>
                    <span>/</span>
                    <span className={`capitalize ${idx === pathSegments.length - 1 ? 'font-semibold text-gray-600' : ''}`}>
                      {seg.replace(/-/g, ' ')}
                    </span>
                  </React.Fragment>
                ))}
              </div>
              
              <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 tracking-tight capitalize truncate">
                {currentTitle}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
             <NotificationDropdown />
             <div className="hidden sm:block text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Authenticated As</p>
                <p className="text-xs font-bold text-gray-900 truncate max-w-[140px]">{user.name}</p>
             </div>
             <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-xs">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-blue-600 font-bold text-xs sm:text-sm">
                  {user.name?.[0]?.toUpperCase()}
                </div>
             </div>
          </div>
        </header>

        
        <main className="flex-1 overflow-y-auto bg-gray-50/50 p-3 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

