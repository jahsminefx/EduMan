import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SetupPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(true);
    const [user, setUser] = useState(null);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('Missing password setup token.');
            setVerifying(false);
            setLoading(false);
            return;
        }

        axios.get(`/api/auth/verify-setup-token?token=${token}`)
            .then(res => {
                if (res.data && res.data.valid) {
                    setUser(res.data.user);
                } else {
                    setError('The invitation token is invalid or has expired.');
                }
            })
            .catch(err => {
                setError(err.response?.data?.message || 'The invitation token is invalid or has expired.');
            })
            .finally(() => {
                setVerifying(false);
                setLoading(false);
            });
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await axios.post('/api/auth/setup-password', {
                token,
                password
            });
            setSuccessMessage(res.data.message || 'Password set up successfully! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            }, 2500);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to set up password. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (verifying || loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Verifying invitation link...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-indigo-600 p-6 text-center text-white">
                    <div className="w-12 h-12 bg-indigo-500/50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <KeyRound className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-xl font-bold">EduMan Password Setup</h1>
                    <p className="text-indigo-200 text-xs mt-1">Activate your account & create a secure password</p>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl flex items-start gap-3 text-sm">
                            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl flex items-start gap-3 text-sm">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {user && !successMessage && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="bg-slate-700/50 border border-slate-600/50 p-4 rounded-xl text-xs space-y-1 mb-4">
                                <div className="text-slate-400">Account Name: <strong className="text-slate-200">{user.name}</strong></div>
                                <div className="text-slate-400">Email: <strong className="text-slate-200">{user.email}</strong></div>
                                <div className="text-slate-400">Role: <span className="inline-block px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-medium text-[11px]">{user.role}</span></div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="At least 6 characters"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter new password"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-xl transition shadow-lg shadow-indigo-600/20 text-sm flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
                            >
                                <Shield className="w-4 h-4" />
                                {submitting ? 'Setting Up...' : 'Set Password & Activate Account'}
                            </button>
                        </form>
                    )}

                    {!user && !loading && !successMessage && (
                        <div className="text-center py-4">
                            <button
                                onClick={() => navigate('/login')}
                                className="text-indigo-400 hover:underline text-sm"
                            >
                                Back to Login Page
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
