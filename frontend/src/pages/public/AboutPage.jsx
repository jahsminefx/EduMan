import React from 'react';
import {
  BookOpen, Users, WifiOff, BarChart3, Calendar, ClipboardCheck,
  Library, HelpCircle, FileText, Target, AlertTriangle, Lightbulb, Globe
} from 'lucide-react';

const problems = [
  { icon: AlertTriangle, title: 'Manual Record Keeping', desc: 'Handwritten registers, grade sheets, and reports are error-prone and time-consuming.' },
  { icon: AlertTriangle, title: 'Lost Student Data', desc: 'Paper records get damaged, lost, or stolen — setting schools back years.' },
  { icon: AlertTriangle, title: 'Poor Reporting Systems', desc: 'Term reports take weeks to compile manually and are often inconsistent.' },
  { icon: AlertTriangle, title: 'No Digital Learning Tools', desc: 'Rural schools lack access to interactive quizzes, libraries, and e-content.' },
];

const coreFeatures = [
  { icon: Users, title: 'Student Management', desc: 'Enroll, track, and manage complete student profiles and records.' },
  { icon: Calendar, title: 'Attendance Tracking', desc: 'Daily class attendance with Present/Absent toggles and historical data.' },
  { icon: BarChart3, title: 'Grade Management', desc: 'Enter CA and exam scores with automatic grade computation.' },
  { icon: ClipboardCheck, title: 'Homework System', desc: 'Teachers assign, students submit with file attachments.' },
  { icon: Library, title: 'Offline Learning Library', desc: 'Upload and browse PDFs, videos, and documents without internet.' },
  { icon: HelpCircle, title: 'Quiz & Assessment', desc: 'Create MCQ quizzes with instant auto-grading for students.' },
  { icon: FileText, title: 'Automated Report Cards', desc: 'Print-ready, professional report cards generated per term.' },
];

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full text-sm font-medium backdrop-blur-sm border border-white/20 mb-6">
            <BookOpen className="w-4 h-4" /> About EduMan
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Built for African Schools</h1>
          <p className="mt-6 text-lg text-blue-100 max-w-2xl mx-auto leading-relaxed">
            EduMan is an offline-first school management and learning platform designed specifically 
            for schools with poor or no internet connectivity.
          </p>
        </div>
      </section>

      {/* Platform Overview */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">What is EduMan?</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                EduMan is an <strong>offline-first school management platform</strong> that helps schools
                digitize their administration and learning processes. Unlike cloud-only solutions, EduMan
                is designed to work seamlessly even when internet connectivity is unreliable or unavailable.
              </p>
              <p className="text-gray-600 leading-relaxed mb-6">
                Built for <strong>teachers, school administrators, and students</strong>, it covers everything
                from enrollment and attendance to grades, homework, and digital learning content.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                  <WifiOff className="w-3.5 h-3.5" /> Offline-First
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                  <Users className="w-3.5 h-3.5" /> 8 User Roles
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium">
                  <Globe className="w-3.5 h-3.5" /> Multi-Tenant
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-700">8</div>
                  <div className="text-sm text-gray-500 mt-1">User Roles</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-700">7+</div>
                  <div className="text-sm text-gray-500 mt-1">Core Modules</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-700">100%</div>
                  <div className="text-sm text-gray-500 mt-1">Offline Capable</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-700">RBAC</div>
                  <div className="text-sm text-gray-500 mt-1">Access Control</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problems Solved */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">Problems We Solve</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Schools across Africa face these challenges daily. EduMan was built to fix them.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {problems.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 flex gap-4 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{p.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">Core Features</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Everything a school needs to manage operations and empower learning.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreFeatures.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all group">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-6 backdrop-blur-sm">
            <Lightbulb className="w-8 h-8 text-blue-200" />
          </div>
          <h2 className="text-3xl font-bold mb-6">Our Vision</h2>
          <p className="text-lg text-blue-100 leading-relaxed max-w-2xl mx-auto">
            EduMan aims to digitize school administration across low-connectivity environments and
            empower every school — no matter how remote — with modern education tools. We believe
            that every student deserves access to quality education management, regardless of
            internet availability.
          </p>
        </div>
      </section>
    </div>
  );
}
