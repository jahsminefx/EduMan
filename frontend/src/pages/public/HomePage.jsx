import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  BookOpen, Users, Calendar, ClipboardCheck, FileText,
  Library, HelpCircle, BarChart3, Wifi, WifiOff, Shield,
  Mail, Lock, User, ArrowRight, CheckCircle, KeyRound, Building2, Phone, FileCheck
} from 'lucide-react';

const features = [
  { icon: Users, title: 'Student Management', desc: 'Enroll, track, and manage student records with ease.' },
  { icon: Calendar, title: 'Attendance Tracking', desc: 'Daily attendance with class-level filters and reports.' },
  { icon: BarChart3, title: 'Grade Management', desc: 'Enter CA and exam scores, auto-generate report cards.' },
  { icon: ClipboardCheck, title: 'Homework System', desc: 'Assign homework, collect submissions with file uploads.' },
  { icon: Library, title: 'Learning Library', desc: 'Upload images, videos, and documents for offline access.' },
  { icon: HelpCircle, title: 'Quiz System', desc: 'Create MCQ quizzes with instant auto-grading.' },
  { icon: FileText, title: 'Report Cards', desc: 'Print-friendly, professional report cards per term.' },
];

export default function HomePage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('signin'); // 'signin' | 'join' | 'register_school'

  // Sign In state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Join School with Code state
  const [inviteCode, setInviteCode] = useState('');

  // School Registration Application state
  const [schoolForm, setSchoolForm] = useState({
    school_name: '',
    reg_number: '',
    contact_name: '',
    official_email: '',
    phone: '',
    estimated_students: '100-500'
  });

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  if (user) return <Navigate to="/dashboard" />;

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(signInEmail, signInPassword);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally { setLoading(false); }
  };

  const handleJoinWithCode = (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      return setError('Please enter a valid school invitation code.');
    }
    navigate(`/join/${encodeURIComponent(inviteCode.trim())}`);
  };

  const handleSchoolRegistrationRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const messageBody = `NEW SCHOOL REGISTRATION APPLICATION:
- Institution Name: ${schoolForm.school_name}
- Government License / Reg No: ${schoolForm.reg_number || 'N/A'}
- Contact Person: ${schoolForm.contact_name}
- Official Email: ${schoolForm.official_email}
- Phone Line: ${schoolForm.phone}
- Estimated Students: ${schoolForm.estimated_students}`;

      await axios.post(`${API_URL}/contact`, {
        name: schoolForm.contact_name,
        email: schoolForm.official_email,
        subject: `School Registration Request: ${schoolForm.school_name}`,
        message: messageBody
      });

      setSuccessMsg('Your school registration request has been submitted to SuperAdmin! We will verify your institution details and email your School Admin invitation token.');
      setSchoolForm({
        school_name: '',
        reg_number: '',
        contact_name: '',
        official_email: '',
        phone: '',
        estimated_students: '100-500'
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit school registration request.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left — Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6 backdrop-blur-sm border border-white/20">
                <WifiOff className="w-4 h-4" /> Works offline, always
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                School Management
                <span className="block text-blue-200">Made Simple</span>
              </h1>
              <p className="mt-4 sm:mt-6 text-sm sm:text-lg text-blue-100 leading-relaxed max-w-lg">
                Manage students, attendance, grades, homework, and learning content — even without constant internet access.
                Built for schools across Africa.
              </p>
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
                <a href="#auth" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-700 rounded-xl font-semibold hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/30 text-sm">
                  Get Started <ArrowRight className="w-4 h-4" />
                </a>
                <a href="#features" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-white/30 text-white rounded-xl font-semibold hover:bg-white/10 transition-colors text-sm">
                  See Features
                </a>
              </div>

              {/* Trust badges */}
              <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-blue-200">
                <div className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> Secure & Private</div>
                <div className="flex items-center gap-1.5"><WifiOff className="w-4 h-4" /> Offline-First</div>
                <div className="flex items-center gap-1.5"><Users className="w-4 h-4" /> 8 User Roles</div>
              </div>
            </div>

            {/* Right — Auth Forms */}
            <div id="auth" className="w-full max-w-md mx-auto lg:ml-auto">
              <div className="bg-white rounded-2xl shadow-2xl shadow-blue-900/40 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-gray-100 bg-gray-50/50 text-[11px] sm:text-xs">
                  <button onClick={() => { setActiveTab('signin'); setError(''); setSuccessMsg(''); }}
                    className={`flex-1 py-3 font-bold transition-colors ${
                      activeTab === 'signin' ? 'text-blue-700 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    Sign In
                  </button>
                  <button onClick={() => { setActiveTab('join'); setError(''); setSuccessMsg(''); }}
                    className={`flex-1 py-3 font-bold transition-colors ${
                      activeTab === 'join' ? 'text-blue-700 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    Join with Code
                  </button>
                  <button onClick={() => { setActiveTab('register_school'); setError(''); setSuccessMsg(''); }}
                    className={`flex-1 py-3 font-bold transition-colors ${
                      activeTab === 'register_school' ? 'text-blue-700 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    Register School
                  </button>
                </div>

                <div className="p-5 sm:p-6">
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-xs text-red-700 rounded-r-xl">{error}</div>
                  )}
                  {successMsg && (
                    <div className="mb-4 p-3 bg-emerald-50 border-l-4 border-emerald-500 text-xs text-emerald-800 rounded-r-xl flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <div>{successMsg}</div>
                    </div>
                  )}

                  {activeTab === 'signin' && (
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="email" required value={signInEmail} onChange={e => setSignInEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 transition"
                            placeholder="you@school.edu" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="password" required value={signInPassword} onChange={e => setSignInPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 transition"
                            placeholder="••••••••" />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline font-medium">Forgot password?</Link>
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-sm">
                        {loading ? 'Signing in...' : 'Sign In'}
                      </button>
                    </form>
                  )}

                  {activeTab === 'join' && (
                    <form onSubmit={handleJoinWithCode} className="space-y-4">
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed font-medium">
                        Teachers, Students, and Parents can enter an invitation code generated by their School Administrator.
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">School Invitation Code</label>
                        <div className="relative">
                          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            required
                            value={inviteCode}
                            onChange={e => setInviteCode(e.target.value.toUpperCase())}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 font-mono font-bold tracking-wider focus:ring-2 focus:ring-blue-500 transition uppercase"
                            placeholder="e.g. EDU-STU-98X2A"
                          />
                        </div>
                      </div>
                      <button type="submit"
                        className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                        Verify Code & Join School <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  )}

                  {activeTab === 'register_school' && (
                    <form onSubmit={handleSchoolRegistrationRequest} className="space-y-3 text-xs">
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 font-medium leading-normal">
                        School registrations require SuperAdmin accreditation verification. Fill out your details below to request onboarding.
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-700 mb-0.5">Institution Name</label>
                        <input
                          type="text"
                          required
                          value={schoolForm.school_name}
                          onChange={e => setSchoolForm({ ...schoolForm, school_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. Grace International Academy"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-700 mb-0.5">Govt License / Reg Number (Optional)</label>
                        <input
                          type="text"
                          value={schoolForm.reg_number}
                          onChange={e => setSchoolForm({ ...schoolForm, reg_number: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. MOE/REG/2024/098"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-gray-700 mb-0.5">Contact Person</label>
                          <input
                            type="text"
                            required
                            value={schoolForm.contact_name}
                            onChange={e => setSchoolForm({ ...schoolForm, contact_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-blue-500"
                            placeholder="Principal / Admin Name"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-gray-700 mb-0.5">Phone Line</label>
                          <input
                            type="tel"
                            required
                            value={schoolForm.phone}
                            onChange={e => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-blue-500"
                            placeholder="+234..."
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-700 mb-0.5">Official School Email</label>
                        <input
                          type="email"
                          required
                          value={schoolForm.official_email}
                          onChange={e => setSchoolForm({ ...schoolForm, official_email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-blue-500"
                          placeholder="admin@school.edu.ng"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-sm flex items-center justify-center gap-1.5"
                      >
                        {loading ? 'Submitting Application...' : 'Submit School Onboarding Application'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900">Everything your school needs</h2>
            <p className="mt-3 text-sm sm:text-lg text-gray-500 max-w-2xl mx-auto">
              A complete suite of tools built to work offline-first, so your school never misses a beat.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 hover:shadow-lg hover:border-blue-100 transition-all group">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-1.5">{f.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">Ready to transform your school?</h2>
          <p className="text-blue-100 mb-6 text-sm sm:text-lg max-w-xl mx-auto">Join schools across Africa using EduMan to manage their institutions, even offline.</p>
          <a href="#auth" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-white text-blue-700 rounded-xl font-semibold hover:bg-blue-50 transition-colors shadow-lg text-sm">
            Get Started Free <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
