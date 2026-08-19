import React, { useState } from 'react';
import { HelpCircle, Phone, MapPin, Send, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const contactInfo = [
  { icon: HelpCircle, label: 'In-App Support', value: 'EduMan Ticket System', href: '/dashboard/support' },
  { icon: Phone, label: 'Phone', value: '09156457073', href: 'tel:09156457073' },
  { icon: MapPin, label: 'Office', value: 'Delta state, Nigeria', href: null },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState(''); // '' | 'sending' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Basic validation
    if (!form.name || !form.email || !form.subject || !form.message) {
      return setErrorMsg('Please fill in all fields.');
    }

    setStatus('sending');

    try {
      await axios.post(`${API_URL}/contact`, form);
      setStatus('success');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setStatus('error');
      setErrorMsg('Failed to send message. Please try again.');
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">Get in Touch</h1>
          <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-blue-100 max-w-xl mx-auto">
            Have a question, suggestion, or want to bring EduMan to your school? We'd love to hear from you.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            {/* Left — Contact Info */}
            <div className="space-y-5 sm:space-y-6">
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900">Contact Information</h2>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                Reach out to us through any of these channels and we'll get back to you as soon as possible.
              </p>

              <div className="space-y-3 sm:space-y-4">
                {contactInfo.map((item, i) => {
                  const Icon = item.icon;
                  const isInternal = item.href && item.href.startsWith('/');
                  
                  const content = (
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-blue-50 transition-colors group cursor-pointer">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors flex-shrink-0">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-semibold">{item.label}</div>
                        <div className="text-xs sm:text-sm font-medium text-gray-900">{item.value}</div>
                      </div>
                    </div>
                  );

                  if (isInternal) {
                    return <Link key={i} to={item.href}>{content}</Link>;
                  }
                  if (item.href) {
                    return <a key={i} href={item.href}>{content}</a>;
                  }
                  return <div key={i}>{content}</div>;
                })}
              </div>
            </div>

            {/* Right — Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-6">Send us a Message</h2>

                {status === 'success' ? (
                  <div className="text-center py-8 sm:py-12">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Message Sent!</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Thank you for reaching out. We'll get back to you shortly.</p>
                    <button onClick={() => setStatus('')}
                      className="mt-6 px-6 py-2.5 text-xs sm:text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    {errorMsg && (
                      <div className="p-3 bg-red-50 border-l-4 border-red-500 text-xs sm:text-sm text-red-700 rounded-r-xl">{errorMsg}</div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                          placeholder="Your full name" />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                          placeholder="you@example.com" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Subject</label>
                      <input type="text" required value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="What is this about?" />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Message</label>
                      <textarea required rows={5} value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
                        placeholder="Tell us more..." />
                    </div>

                    <button type="submit" disabled={status === 'sending'}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-xs">
                      <Send className="w-4 h-4" />
                      {status === 'sending' ? 'Sending...' : 'Send Message'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
