import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Building2, 
  UserCheck, 
  GraduationCap, 
  BookOpen, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight,
  Lock,
  Mail,
  User,
  Phone,
  ShieldCheck
} from 'lucide-react';
import API_URL from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

export default function JoinSchoolPage() {
  const { code: routeCode } = useParams();
  const [searchParams] = useSearchParams();
  const queryCode = searchParams.get('code');
  const code = routeCode || queryCode || '';

  const navigate = useNavigate();
  const { login } = useAuth();

  const [inputCode, setInputCode] = useState(code);
  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    gender: 'Male',
    admission_number: '',
    phone: '',
    parent_name: '',
    parent_phone: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (code) {
      verifyCode(code);
    } else {
      setLoading(false);
    }
  }, [code]);

  const verifyCode = async (codeToTest) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/invite-links/info/${encodeURIComponent(codeToTest.trim())}`);
      if (res.data.valid) {
        setInviteInfo(res.data.invite);
      } else {
        setError(res.data.message || 'Invalid invitation code.');
        setInviteInfo(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired invitation link.');
      setInviteInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCodeSubmit = (e) => {
    e.preventDefault();
    if (inputCode.trim()) {
      navigate(`/join/${inputCode.trim()}`);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const payload = {
        code: inviteInfo.display_code,
        ...formData
      };

      const res = await axios.post(`${API_URL}/invite-links/register`, payload);
      
      // Save token and trigger login session
      localStorage.setItem('token', res.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      
      // Refresh window auth or redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      setFormError(err.response?.data?.message || 'Registration failed. Please check your information and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center max-w-sm w-full">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
          <h3 className="text-base font-bold text-gray-900">Verifying School Invitation</h3>
          <p className="text-xs text-gray-500 mt-1">Checking link validity and school parameters...</p>
        </div>
      </div>
    );
  }

  // Manual Code Input View (if no code in URL or code is missing)
  if (!code && !inviteInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-white to-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Join Your School</h2>
          <p className="text-sm text-gray-600 text-center mb-6">
            Enter the invitation code provided by your school administrator to register your account.
          </p>

          <form onSubmit={handleManualCodeSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Invitation Code
              </label>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="e.g. GRN-STU-98X2A"
                className="w-full px-4 py-3 text-center text-lg font-mono font-bold tracking-widest border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              Verify Code <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Already have an account? <Link to="/login" className="text-indigo-600 font-semibold hover:underline">Log in here</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error / Invalid Link View
  if (error || !inviteInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-red-100 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invitation Unavailable</h2>
          <p className="text-sm text-gray-600 mb-6">{error || 'This invitation link is invalid or no longer active.'}</p>

          <div className="space-y-3">
            <Link
              to="/join"
              className="block w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Try Another Code
            </Link>
            <Link
              to="/"
              className="block w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Registration Form View
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/30 py-10 px-4 flex items-center justify-center">
      <div className="max-w-xl w-full">
        {/* School Header Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600" />
          
          <div className="w-16 h-16 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-3 font-bold text-2xl shadow-inner border border-indigo-200">
            {inviteInfo.logo_url ? (
              <img src={inviteInfo.logo_url} alt={inviteInfo.school_name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              inviteInfo.school_name.charAt(0)
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-gray-900">{inviteInfo.school_name}</h1>
          {inviteInfo.motto && <p className="text-xs text-gray-500 italic mt-0.5">"{inviteInfo.motto}"</p>}
          {(inviteInfo.city || inviteInfo.state) && (
            <p className="text-xs text-gray-400 mt-1">
              {[inviteInfo.city, inviteInfo.state].filter(Boolean).join(', ')}
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 inline-flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100">
              <ShieldCheck className="w-3.5 h-3.5" />
              Role: {inviteInfo.role}
            </span>
            {inviteInfo.class_name && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-bold border border-purple-100">
                <GraduationCap className="w-3.5 h-3.5" />
                Class: {inviteInfo.class_name}
              </span>
            )}
          </div>
        </div>

        {/* Registration Form Card */}
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Create Your Account</h2>
          <p className="text-xs text-gray-500 mb-6">Complete the details below to join {inviteInfo.school_name}.</p>

          {formError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              {formError}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">First Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="e.g. Femi"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="e.g. Adesola"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 6 chars"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Student-specific fields */}
            {inviteInfo.role === 'Student' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Admission Number (Optional)</label>
                  <input
                    type="text"
                    value={formData.admission_number}
                    onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })}
                    placeholder="Leave blank for auto-assigned ID"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Parent/Guardian Name (Optional)</label>
                    <input
                      type="text"
                      value={formData.parent_name}
                      onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                      placeholder="e.g. Chief Adesola"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Parent Phone (Optional)</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        value={formData.parent_phone}
                        onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                        placeholder="+234..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Teacher-specific fields */}
            {inviteInfo.role === 'Teacher' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number (Optional)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+234..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Parent-specific fields */}
            {inviteInfo.role === 'Parent' && (
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Child's Student Admission Number(s) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.student_admission_number || formData.admission_number || ''}
                    onChange={(e) => setFormData({ ...formData, student_admission_number: e.target.value, admission_number: e.target.value })}
                    placeholder="e.g. ADM-000001 (or ADM-001, ADM-002)"
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Entering your child's Admission Number links your parent account directly to their gradebook, attendance, and fee statements. Separate multiple IDs with commas.
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? 'Creating Account...' : `Register & Join ${inviteInfo.school_name}`}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Already have an account? <Link to="/login" className="text-indigo-600 font-semibold hover:underline">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
