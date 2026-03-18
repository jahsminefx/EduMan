import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  GraduationCap, 
  Calendar,
  LogOut,
  FolderOpen,
  HelpCircle,
  Library,
  Menu,
  X
} from 'lucide-react';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const getLinks = () => {
    const base = [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ];

    switch(user.role) {
      case 'SuperAdmin':
        base.push(
          { name: 'Manage Schools', path: '/dashboard/admin/schools', icon: BookOpen },
          { name: 'Global Metrics', path: '/dashboard/admin/metrics', icon: LayoutDashboard }
        );
        break;
      
      case 'SchoolAdmin':
        base.push(
          { name: 'Classes', path: '/dashboard/admin/classes', icon: BookOpen },
          { name: 'Subjects', path: '/dashboard/admin/subjects', icon: Library },
          { name: 'Teachers', path: '/dashboard/admin/teachers', icon: Users },
          { name: 'Students', path: '/dashboard/admin/students', icon: GraduationCap },
          { name: 'Report Cards', path: '/dashboard/reports/card', icon: FolderOpen }
        );
        break;

      case 'Teacher':
        base.push(
          { name: 'Attendance', path: '/dashboard/teacher/attendance', icon: Calendar },
          { name: 'Gradebook', path: '/dashboard/teacher/grades', icon: BookOpen },
          { name: 'Homework', path: '/dashboard/teacher/homework', icon: FolderOpen },
          { name: 'Quizzes', path: '/dashboard/quiz', icon: HelpCircle },
          { name: 'Library', path: '/dashboard/content/library', icon: Library },
          { name: 'Report Cards', path: '/dashboard/reports/card', icon: GraduationCap },
        );
        break;

      case 'Student':
        base.push(
          { name: 'My Homework', path: '/dashboard/teacher/homework', icon: FolderOpen },
          { name: 'Quizzes', path: '/dashboard/quiz', icon: HelpCircle },
          { name: 'My Results', path: '/dashboard/reports/card', icon: BookOpen },
          { name: 'Library', path: '/dashboard/content/library', icon: Library },
        );
        break;

      case 'Parent':
        base.push(
          { name: 'My Children', path: '/dashboard/parent/children', icon: Users },
          { name: 'Report Cards', path: '/dashboard/reports/card', icon: GraduationCap },
          { name: 'Fee Statements', path: '/dashboard/parent/fees', icon: FolderOpen },
        );
        break;
        
      case 'ContentManager':
        base.push(
          { name: 'Content Library', path: '/dashboard/content/library', icon: Library },
        );
        break;
        
      case 'Accountant':
        base.push(
          { name: 'Fee Management', path: '/dashboard/finance/fees', icon: FolderOpen },
        );
        break;

      case 'SupportOfficer':
        base.push(
          { name: 'Troubleshooting Logs', path: '/dashboard/support/logs', icon: BookOpen },
        );
        break;
      
      default:
        break;
    }

    return base;
  };

  const links = getLinks();

  return (
    <div className="min-h-screen bg-gray-50 flex transition-colors duration-200">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col shadow-xl lg:shadow-sm
        transition-transform duration-300 transform lg:translate-x-0 lg:static lg:inset-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 border-b border-gray-200 px-6">
          <div className="flex items-center">
            <BookOpen className="w-8 h-8 text-blue-600 mr-2" />
            <span className="text-xl font-bold text-gray-900 tracking-tight">EduMan</span>
          </div>
          <button 
            className="p-2 rounded-lg lg:hidden hover:bg-gray-100 text-gray-500"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="px-3 space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex-shrink-0 border-t border-gray-200 p-4">
          <div className="flex items-center px-2">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {user.name?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
            <div className="ml-3 min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider truncate">{user.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-4 w-full flex items-center justify-center px-4 py-2 border border-gray-200 shadow-sm text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-all active:scale-[0.98]"
          >
            <LogOut className="mr-2 w-4 h-4 text-gray-400" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-8 z-30">
          <div className="flex items-center gap-4">
            <button 
              className="p-2 rounded-lg lg:hidden hover:bg-gray-100 text-gray-600"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg lg:text-xl font-bold text-gray-900 tracking-tight capitalize truncate">
              {(location.pathname === '/' || location.pathname === '/dashboard') ? (user.school_name || 'Dashboard') : location.pathname.split('/').slice(-1)[0].replace('-', ' ')}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="hidden sm:block text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Authenticated As</p>
                <p className="text-xs font-bold text-gray-900">{user.name}</p>
             </div>
             <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-sm">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-blue-600 font-bold text-sm">
                  {user.name?.[0]?.toUpperCase()}
                </div>
             </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto bg-gray-50/50 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
