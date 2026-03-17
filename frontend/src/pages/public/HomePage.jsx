import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  BookOpen, Users, Calendar, ClipboardCheck, FileText,
  Library, HelpCircle, BarChart3, Wifi, WifiOff, Shield,
  Mail, Lock, User, ArrowRight, CheckCircle
} from 'lucide-react';

const features = [
  { icon: Users, title: 'Student Management', desc: 'Enroll, track, and manage student records with ease.' },
  { icon: Calendar, title: 'Attendance Tracking', desc: 'Daily attendance with class-level filters and reports.' },
  { icon: BarChart3, title: 'Grade Management', desc: 'Enter CA and exam scores, auto-generate report cards.' },
  { icon: ClipboardCheck, title: 'Homework System', desc: 'Assign homework, collect submissions with file uploads.' },
  { icon: Library, title: 'Learning Library', desc: 'Upload PDFs, videos, and documents for offline access.' },
  { icon: HelpCircle, title: 'Quiz System', desc: 'Create MCQ quizzes with instant auto-grading.' },
  { icon: FileText, title: 'Report Cards', desc: 'Print-friendly, professional report cards per term.' },
];

export default function HomePage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('signin');

  // Sign In state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign Up state
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirm, setSignUpConfirm] = useState('');

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

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    if (signUpPassword !== signUpConfirm) {
      return setError('Passwords do not match.');
    }
    if (signUpPassword.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    setLoading(true);
    try {
      await register(signUpName, signUpEmail, signUpPassword);
      setSuccessMsg('Institution account created! Redirecting to dashboard...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left — Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm font-medium mb-6 backdrop-blur-sm border border-white/20">
                <WifiOff className="w-4 h-4" /> Works offline, always
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                School Management
                <span className="block text-blue-200">Made Simple</span>
              </h1>
              <p className="mt-6 text-lg text-blue-100 leading-relaxed max-w-lg">
                Manage students, attendance, grades, homework, and learning content — even without constant internet access.
                Built for schools across Africa.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="#auth" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-700 rounded-xl font-semibold hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/30">
                  Get Started <ArrowRight className="w-4 h-4" />
                </a>
                <a href="#features" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-white/30 text-white rounded-xl font-semibold hover:bg-white/10 transition-colors">
                  See Features
                </a>
              </div>

              {/* Trust badges */}
              <div className="mt-10 flex items-center gap-6 text-sm text-blue-200">
                <div className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> Secure & Private</div>
                <div className="flex items-center gap-1.5"><WifiOff className="w-4 h-4" /> Offline-First</div>
                <div className="flex items-center gap-1.5"><Users className="w-4 h-4" /> 8 User Roles</div>
              </div>
            </div>

            {/* Right — Auth Forms */}
            <div id="auth" className="w-full max-w-md mx-auto lg:ml-auto">
              <div className="bg-white rounded-2xl shadow-2xl shadow-blue-900/40 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                  <button onClick={() => { setActiveTab('signin'); setError(''); setSuccessMsg(''); }}
                    className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                      activeTab === 'signin' ? 'text-blue-700 border-b-2 border-blue-600 bg-white' : 'text-gray-500 bg-gray-50 hover:text-gray-700'
                    }`}>
                    Sign In
                  </button>
                  <button onClick={() => { setActiveTab('signup'); setError(''); setSuccessMsg(''); }}
                    className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                      activeTab === 'signup' ? 'text-blue-700 border-b-2 border-blue-600 bg-white' : 'text-gray-500 bg-gray-50 hover:text-gray-700'
                    }`}>
                    Sign Up
                  </button>
                </div>

                <div className="p-6">
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-sm text-red-700 rounded-r-lg">{error}</div>
                  )}
                  {successMsg && (
                    <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-sm text-green-700 rounded-r-lg flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> {successMsg}
                    </div>
                  )}

                  {activeTab === 'signin' ? (
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="email" required value={signInEmail} onChange={e => setSignInEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="you@school.edu" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="password" required value={signInPassword} onChange={e => setSignInPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="••••••••" />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <a href="#" className="text-xs text-blue-600 hover:underline">Forgot password?</a>
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-sm">
                        {loading ? 'Signing in...' : 'Sign In'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name of Institution</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="text" required value={signUpName} onChange={e => setSignUpName(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="Enter your institution name" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="email" required value={signUpEmail} onChange={e => setSignUpEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="you@school.edu" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="password" required value={signUpPassword} onChange={e => setSignUpPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="Min. 6 characters" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="password" required value={signUpConfirm} onChange={e => setSignUpConfirm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="Re-enter password" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">You will be registered as a <strong>School Admin</strong>.</p>
                      <button type="submit" disabled={loading}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-sm">
                        {loading ? 'Creating account...' : 'Create Account'}
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
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Everything your school needs</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              A complete suite of tools built to work offline-first, so your school never misses a beat.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
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

      {/* CTA Section */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to transform your school?</h2>
          <p className="text-blue-100 mb-8 text-lg">Join schools across Africa using EduMan to manage their institutions, even offline.</p>
          <a href="#auth" className="inline-flex items-center gap-2 px-8 py-3 bg-white text-blue-700 rounded-xl font-semibold hover:bg-blue-50 transition-colors shadow-lg">
            Get Started Free <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
