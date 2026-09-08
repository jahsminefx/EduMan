import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { KeyRound, Mail, ArrowLeft, CheckCircle2, Lock, ShieldCheck, RefreshCw } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Request Code, 2: Verify & Reset, 3: Success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Step 1: Send 6-digit verification code to email
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (!email || !email.trim()) {
      setError('Please enter your account email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, { email: email.trim() });
      setSuccessMessage(res.data.message || 'If an account exists with this email, a 6-digit code has been sent.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend code handler
  const handleResendCode = async () => {
    setError('');
    setResending(true);
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, { email: email.trim() });
      setSuccessMessage('A new 6-digit verification code has been dispatched to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend verification code.');
    } finally {
      setResending(false);
    }
  };

  // Step 2: Verify code and reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!code || code.trim().length !== 6) {
      setError('Please enter the complete 6-digit verification code sent to your email.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify your new password.');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/reset-password`, {
        email: email.trim(),
        code: code.trim(),
        newPassword
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-3">
          <BrandLogo className="h-16 w-auto sm:h-20" />
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          Reset Your Password
        </h2>
        <p className="mt-1 text-center text-xs sm:text-sm text-slate-600">
          EduMan School Management & Learning Platform
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200/80 sm:px-10">
          
          {/* Step 1: Request Code */}
          {step === 1 && (
            <form onSubmit={handleRequestCode} className="space-y-5">
              <div className="text-center pb-2">
                <div className="mx-auto w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <p className="text-xs sm:text-sm text-slate-600">
                  Enter your registered account email address below. We will send a <strong>6-digit verification code</strong> to verify your account.
                </p>
              </div>

              {error && (
                <div className="p-3.5 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs sm:text-sm text-red-700 font-medium">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@school.edu"
                    className="block w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-60 shadow-md shadow-blue-500/20"
              >
                {loading ? 'Sending Code...' : 'Send 6-Digit Verification Code'}
              </button>

              <div className="text-center pt-2">
                <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 font-medium transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}

          {/* Step 2: Verify Code & Reset Password */}
          {step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="text-center pb-2">
                <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Check Your Email</h3>
                <p className="mt-1 text-xs text-slate-600">
                  We sent a 6-digit code to <strong className="text-slate-900">{email}</strong>. Enter the code below to reset your password.
                </p>
              </div>

              {successMessage && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 text-center font-medium">
                  {successMessage}
                </div>
              )}

              {error && (
                <div className="p-3.5 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs sm:text-sm text-red-700 font-medium">
                  {error}
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="code" className="block text-xs sm:text-sm font-semibold text-slate-700">
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resending}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                    Resend Code
                  </button>
                </div>
                <input
                  id="code"
                  type="text"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="block w-full text-center tracking-[0.5em] font-mono text-xl py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-bold text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="newPassword"
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="block w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="block w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-60 shadow-md shadow-blue-500/20"
              >
                {loading ? 'Resetting Password...' : 'Verify Code & Reset Password'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 font-medium transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Change Email Address
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Password Reset Complete</h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-600">
                  Your password has been changed successfully. Active sessions have been secured.
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full py-2.5 px-4 border border-transparent rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/20"
                >
                  Proceed to Sign In
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
