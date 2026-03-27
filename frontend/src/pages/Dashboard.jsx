import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import API_URL from '../config/api';
import { 
  Users, BookOpen, GraduationCap, TrendingUp, 
  CheckCircle, AlertCircle, Calendar, BarChart3,
  Award, Target
} from 'lucide-react';
import StatCard from '../components/Dashboard/StatCard';
import PendingTask from '../components/Dashboard/PendingTask';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, perfRes, pendingRes] = await Promise.all([
          axios.get(`${API_URL}/stats/dashboard`),
          axios.get(`${API_URL}/stats/performance`),
          axios.get(`${API_URL}/stats/pending`)
        ]);
        setStats(statsRes.data);
        setPerformance(perfRes.data);
        setPending(pendingRes.data);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const renderSuperAdmin = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard name="Total Schools" stat={stats?.schools || 0} icon={BookOpen} color="bg-indigo-500" />
        <StatCard name="Active Schools" stat={stats?.subscriptions || 0} icon={TrendingUp} color="bg-green-500" />
        <StatCard name="Total System Users" stat={stats?.users || 0} icon={Users} color="bg-blue-500" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <a href="/dashboard/admin/schools" className="block bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
          <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center">
            <BookOpen className="w-5 h-5 mr-2 text-indigo-500" />
            Manage Schools
          </h3>
          <p className="text-sm text-gray-500">View, create, edit, and manage all registered schools on the platform.</p>
          <span className="mt-3 inline-block text-sm font-bold text-indigo-600 group-hover:underline">Go to Schools →</span>
        </a>
        <a href="/dashboard/admin/school-admins" className="block bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group">
          <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center">
            <Users className="w-5 h-5 mr-2 text-emerald-500" />
            Manage School Admins
          </h3>
          <p className="text-sm text-gray-500">Create, assign, edit, and manage School Administrator accounts.</p>
          <span className="mt-3 inline-block text-sm font-bold text-emerald-600 group-hover:underline">Go to Admins →</span>
        </a>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-6 h-6 mr-2 text-indigo-500" />
          Global Platform Overview
        </h3>
        <p className="text-gray-600">You are in Super Admin mode. You have visibility across all institutions on the platform.</p>
      </div>
    </div>
  );

  const renderSchoolAdmin = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard name="Total Students" stat={stats?.students || 0} icon={GraduationCap} color="bg-blue-500" />
        <StatCard name="Teachers" stat={stats?.teachers || 0} icon={Users} color="bg-green-500" />
        <StatCard name="Classes" stat={stats?.classes || 0} icon={BookOpen} color="bg-purple-500" />
        <StatCard name="Subjects" stat={stats?.subjects || 0} icon={BarChart3} color="bg-yellow-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
            Attendance Trends (Last 7 Days)
          </h3>
          <div className="flex items-end justify-between h-48 px-4">
            {performance?.attendanceTrend?.map((item, i) => (
              <div key={i} className="flex flex-col items-center w-full">
                <div 
                  className="w-8 bg-blue-500 rounded-t-lg transition-all duration-500 hover:bg-blue-600"
                  style={{ height: `${item.percentage}%` }}
                  title={`${item.date}: ${item.percentage}%`}
                ></div>
                <span className="text-[10px] text-gray-400 mt-2 transform -rotate-45 origin-top-left">{item.date.split('-').slice(1).join('/')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <Award className="w-5 h-5 mr-2 text-yellow-500" />
            Performance Snapshot
          </h3>
          <div className="space-y-6">
            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
              <span className="text-sm text-yellow-700 font-medium block">Best Performing Class</span>
              <span className="text-2xl font-bold text-yellow-900">{performance?.bestClass?.name || 'N/A'}</span>
              <span className="text-sm text-yellow-600 block mt-1">Average: {performance?.bestClass?.score || 0}%</span>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-sm text-blue-700 font-medium block">Today's Attendance</span>
              <span className="text-2xl font-bold text-blue-900">{stats?.todayAttendance || '0%'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTeacher = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard name="Total Students" stat={stats?.totalStudents || 0} icon={Users} color="bg-blue-500" />
        <StatCard name="Classes Assigned" stat={stats?.classesAssigned || 0} icon={Award} color="bg-purple-500" />
        <StatCard name="Pending Homework" stat={stats?.pendingHomework || 0} icon={AlertCircle} color="bg-red-500" />
        <StatCard name="Today's Attendance" stat={stats?.todayAttendance || '0%'} icon={Calendar} color="bg-green-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <Target className="w-5 h-5 mr-2 text-blue-500" />
            Performance Snapshot
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Class Averages</h4>
              <div className="space-y-3">
                {performance?.classAverages?.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{c.name}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${c.score}%` }}></div>
                      </div>
                      <span className="text-xs font-bold">{c.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Insights</h4>
              <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-green-600 font-bold block">TOP STUDENT</span>
                  <span className="text-sm text-green-900 font-bold">{performance?.topStudent}</span>
                </div>
                <Award className="w-8 h-8 text-green-500 opacity-50" />
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                 <span className="text-xs text-red-600 font-bold block mb-2">WEAK AREAS</span>
                 <div className="flex flex-wrap gap-2 justify-center">
                   {performance?.weakSubjects?.map((s, i) => (
                     <span key={i} className="px-2 py-1 bg-white text-red-700 text-[10px] font-bold rounded-lg border border-red-100">{s.name} ({s.score}%)</span>
                   ))}
                 </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-red-500" />
            Pending Tasks
          </h3>
          <div className="space-y-4">
            {pending.length > 0 ? (
              pending.map((task, i) => (
                <PendingTask key={i} {...task} color={task.label.includes('attendance') ? 'yellow' : 'blue'} />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4 italic">No pending tasks!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStudent = () => (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold">Welcome back, {user.name.split(' ')[0]}!</h2>
          <p className="mt-2 text-blue-100 text-lg">{user.class_name || 'Student'} — {user.school_name || 'EduMan'}</p>
        </div>
        <GraduationCap className="absolute right-[-20px] bottom-[-20px] w-48 h-48 text-white/10" />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard name="Subjects Enrolled" stat={stats?.subjectsEnrolled || 0} icon={BookOpen} color="bg-blue-500" />
        <StatCard name="Completed Works" stat={stats?.assignmentsCompleted || 0} icon={CheckCircle} color="bg-green-500" />
        <StatCard name="Attendance Rate" stat={stats?.attendance || '0%'} icon={Calendar} color="bg-purple-500" />
        <StatCard name="Average Score" stat={`${stats?.averageScore || 0}%`} icon={TrendingUp} color="bg-yellow-500" />
      </div>

      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
          <Target className="w-5 h-5 mr-2 text-red-500" />
          Academic Performance Snapshot
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="flex flex-col items-center justify-center p-6 bg-blue-50 rounded-2xl border border-blue-100">
             <span className="text-blue-600 font-bold uppercase text-xs tracking-widest mb-2">Overall Average</span>
             <div className="relative">
                <svg className="w-32 h-32">
                   <circle className="text-gray-200" strokeWidth="8" stroke="currentColor" fill="transparent" r="50" cx="64" cy="64" />
                   <circle className="text-blue-600" strokeWidth="8" strokeDasharray={314} strokeDashoffset={314 - (314 * (stats?.averageScore || 0)) / 100} strokeLinecap="round" stroke="currentColor" fill="transparent" r="50" cx="64" cy="64" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-blue-900">{stats?.averageScore || 0}%</span>
             </div>
          </div>
          
          <div className="md:col-span-2 space-y-4">
             <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex items-center justify-between">
                <div>
                   <span className="text-green-600 font-bold text-xs uppercase block">BEST SUBJECT</span>
                   <span className="text-lg font-bold text-green-900">{performance?.bestSubject?.name || 'N/A'}</span>
                </div>
                <div className="text-right">
                   <span className="text-2xl font-black text-green-600">{performance?.bestSubject?.score || 0}%</span>
                </div>
             </div>
             
             <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex items-center justify-between">
                <div>
                   <span className="text-orange-600 font-bold text-xs uppercase block">NEEDS IMPROVEMENT</span>
                   <span className="text-lg font-bold text-orange-900">{performance?.weakSubject?.name || 'N/A'}</span>
                </div>
                <div className="text-right">
                   <span className="text-2xl font-black text-orange-600">{performance?.weakSubject?.score || 0}%</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center">
            {user.role === 'SuperAdmin' ? 'Global Command Center' : 'Dashboard Overview'}
          </h2>
          {user.role !== 'Student' && <p className="mt-1 text-sm text-gray-500 uppercase tracking-widest font-bold">LIVE METRICS & ANALYTICS</p>}
        </div>
        <div className="hidden sm:block text-right">
          <span className="text-xs font-bold text-gray-400 block uppercase">CURRENT SESSION</span>
          <span className="text-sm font-black text-blue-600">2023/2024 Academic Year</span>
        </div>
      </div>

      {user.role === 'SuperAdmin' && renderSuperAdmin()}
      {user.role === 'SchoolAdmin' && renderSchoolAdmin()}
      {user.role === 'Teacher' && renderTeacher()}
      {user.role === 'Student' && renderStudent()}
      {user.role === 'Parent' && (
        <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
          <Users className="h-16 w-16 text-green-500 mx-auto mb-6 opacity-20" />
          <h3 className="text-xl font-bold text-gray-900">Parental Perspective</h3>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">Monitor your child's academic journey and attendance patterns here. Role-specific view coming soon.</p>
        </div>
      )}
      {['ContentManager', 'Accountant', 'SupportOfficer'].includes(user.role) && (
        <div className="bg-white p-12 border rounded-2xl shadow-sm border-gray-100 text-center">
          <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-6 opacity-20" />
          <h3 className="text-xl font-bold text-gray-900">Module Dashboard</h3>
          <p className="mt-2 text-gray-500">Your specialized tools are available in the left sidebar.</p>
        </div>
      )}
    </div>
  );
}
