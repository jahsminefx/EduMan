import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertCircle, CalendarDays, Clock, Mail, Megaphone, Phone, UserCheck } from 'lucide-react';
import API_URL from '../../config/api';

export default function ClassInfo() {
  const [classInfo, setClassInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClassInfo();
  }, []);

  const fetchClassInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/class-info/my`);
      setClassInfo(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load class information.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100">Loading class information...</div>;
  }

  if (error) {
    return (
      <div className="p-5 bg-red-50 text-red-800 rounded-xl border border-red-100 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <span className="text-sm font-medium">{error}</span>
      </div>
    );
  }

  const { class: classRecord, school, timetable = [], announcements = [], events = [] } = classInfo || {};

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{classRecord?.name || 'My Class'}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {school?.current_session_name || 'Current session not set'} - {school?.current_term_name || 'Current term not set'}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 min-w-[260px]">
            <h3 className="text-sm font-bold text-blue-900 flex items-center mb-2">
              <UserCheck className="w-4 h-4 mr-2" />
              Form Teacher
            </h3>
            <p className="text-sm font-semibold text-gray-900">{classRecord?.form_teacher_name || 'Not assigned'}</p>
            {classRecord?.form_teacher_email && (
              <p className="text-xs text-gray-600 mt-1 flex items-center">
                <Mail className="w-3 h-3 mr-1" />
                {classRecord.form_teacher_email}
              </p>
            )}
            {classRecord?.form_teacher_phone && (
              <p className="text-xs text-gray-600 mt-1 flex items-center">
                <Phone className="w-3 h-3 mr-1" />
                {classRecord.form_teacher_phone}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-blue-600" />
          Class Timetable
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Day</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Room</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {timetable.map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.day_of_week}</td>
                  <td className="px-4 py-3 text-gray-600">{item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)}</td>
                  <td className="px-4 py-3 text-gray-600">{item.subject}</td>
                  <td className="px-4 py-3 text-gray-600">{item.room || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {timetable.length === 0 && <p className="text-center text-sm text-gray-500 py-6">No timetable has been published yet.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Megaphone className="w-5 h-5 mr-2 text-blue-600" />
            Class Announcements
          </h3>
          <div className="space-y-3">
            {announcements.map(item => (
              <div key={item.id} className="border border-gray-100 rounded-lg p-4">
                <h4 className="font-bold text-gray-900">{item.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{item.message}</p>
                <p className="text-xs text-gray-400 mt-2">{new Date(item.created_at).toLocaleDateString()}</p>
              </div>
            ))}
            {announcements.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No class announcements yet.</p>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <CalendarDays className="w-5 h-5 mr-2 text-blue-600" />
            Important Class Dates
          </h3>
          <div className="space-y-3">
            {events.map(item => (
              <div key={item.id} className="border border-gray-100 rounded-lg p-4">
                <h4 className="font-bold text-gray-900">{item.title}</h4>
                <p className="text-sm text-blue-700 font-medium mt-1">{item.event_date?.slice(0, 10)}</p>
                {item.description && <p className="text-sm text-gray-600 mt-1">{item.description}</p>}
              </div>
            ))}
            {events.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No important dates have been added yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
