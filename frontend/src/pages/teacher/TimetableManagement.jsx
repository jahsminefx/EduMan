import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AlertCircle, CalendarDays, CheckCircle, Clock, Megaphone, Plus, Trash2 } from 'lucide-react';
import API_URL from '../../config/api';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const emptyTimetableForm = {
  day_of_week: 'Monday',
  start_time: '',
  end_time: '',
  subject: '',
  room: '',
  notes: ''
};

export default function TimetableManagement() {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [classInfo, setClassInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [activeDayTab, setActiveDayTab] = useState('Monday');
  const [timetableForm, setTimetableForm] = useState(emptyTimetableForm);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '' });
  const [eventForm, setEventForm] = useState({ title: '', event_date: '', description: '' });

  const showMessage = useCallback((text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/class-info/teacher/classes`);
      const classList = res.data.classes || [];
      setClasses(classList);
      if (classList.length > 0) setSelectedClass(classList[0].id);
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to load form teacher classes.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  const fetchClassInfo = useCallback(async (classId) => {
    try {
      const res = await axios.get(`${API_URL}/class-info/classes/${classId}`);
      setClassInfo(res.data);
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to load class information.', 'error');
    }
  }, [showMessage]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (selectedClass) fetchClassInfo(selectedClass);
  }, [selectedClass, fetchClassInfo]);

  const addTimetable = async (event) => {
    event.preventDefault();
    try {
      await axios.post(`${API_URL}/class-info/timetables`, {
        ...timetableForm,
        class_id: selectedClass
      });
      setTimetableForm(emptyTimetableForm);
      showMessage('Timetable entry added.');
      fetchClassInfo(selectedClass);
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to add timetable entry.', 'error');
    }
  };

  const addAnnouncement = async (event) => {
    event.preventDefault();
    try {
      await axios.post(`${API_URL}/class-info/announcements`, {
        ...announcementForm,
        class_id: selectedClass
      });
      setAnnouncementForm({ title: '', message: '' });
      showMessage('Class announcement posted.');
      fetchClassInfo(selectedClass);
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to post announcement.', 'error');
    }
  };

  const addEvent = async (event) => {
    event.preventDefault();
    try {
      await axios.post(`${API_URL}/class-info/events`, {
        ...eventForm,
        class_id: selectedClass
      });
      setEventForm({ title: '', event_date: '', description: '' });
      showMessage('Class event added.');
      fetchClassInfo(selectedClass);
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to add class event.', 'error');
    }
  };

  const deleteItem = async (type, id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await axios.delete(`${API_URL}/class-info/${type}/${id}`);
      showMessage('Item deleted.');
      fetchClassInfo(selectedClass);
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to delete item.', 'error');
    }
  };

  const activeDayEntries = (classInfo?.timetable || []).filter(
    item => item.day_of_week?.toLowerCase() === activeDayTab.toLowerCase()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100 items-start sm:items-end justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Timetable Management</h2>
          <p className="text-xs sm:text-sm text-gray-500">Manage timetable, announcements, and dates for your form class.</p>
        </div>
        <div className="w-full sm:w-64">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Form Class</label>
          <select value={selectedClass} onChange={event => setSelectedClass(event.target.value)} className="border rounded-xl p-2.5 w-full bg-white text-sm text-gray-900 shadow-xs focus:ring-2 focus:ring-blue-500">
            <option value="">Select class</option>
            {classes.map(classItem => <option key={classItem.id} value={classItem.id}>{classItem.name}</option>)}
          </select>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl flex items-center border ${message.type === 'error' ? 'bg-red-50 text-red-800 border-red-100' : 'bg-green-50 text-green-800 border-green-100'}`}>
          {message.type === 'error' ? <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />}
          <span className="text-xs sm:text-sm font-medium">{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs sm:text-sm text-gray-500 bg-white rounded-2xl border border-gray-100">Loading classes...</div>
      ) : classes.length === 0 ? (
        <div className="p-8 text-center text-xs sm:text-sm text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200">
          You are not assigned as form teacher for any class yet.
        </div>
      ) : (
        <>
          <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-blue-600 flex-shrink-0" />
              Timetable
            </h3>
            <form onSubmit={addTimetable} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
              <select required value={timetableForm.day_of_week} onChange={e => setTimetableForm({...timetableForm, day_of_week: e.target.value})} className="border rounded-xl p-2.5 bg-white text-sm">
                {days.map(day => <option key={day} value={day}>{day}</option>)}
              </select>
              <input required type="time" value={timetableForm.start_time} onChange={e => setTimetableForm({...timetableForm, start_time: e.target.value})} className="border rounded-xl p-2.5 text-sm" />
              <input required type="time" value={timetableForm.end_time} onChange={e => setTimetableForm({...timetableForm, end_time: e.target.value})} className="border rounded-xl p-2.5 text-sm" />
              <input required type="text" placeholder="Subject" value={timetableForm.subject} onChange={e => setTimetableForm({...timetableForm, subject: e.target.value})} className="border rounded-xl p-2.5 text-sm" />
              <input type="text" placeholder="Room" value={timetableForm.room} onChange={e => setTimetableForm({...timetableForm, room: e.target.value})} className="border rounded-xl p-2.5 text-sm" />
              <button type="submit" className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-xs">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </button>
            </form>

            {/* Mobile View: Day Selector Tabs & Card Stack */}
            <div className="block sm:hidden space-y-4">
              <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-none border-b border-gray-100">
                {days.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setActiveDayTab(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      activeDayTab === day
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5">
                {activeDayEntries.map(item => (
                  <div key={item.id} className="p-3.5 bg-gray-50/70 border border-gray-100 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">{item.subject}</span>
                        {item.room && <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">Room {item.room}</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 font-mono">{item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)}</p>
                    </div>
                    <button type="button" onClick={() => deleteItem('timetables', item.id)} className="p-2 text-red-600 hover:text-red-800">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {activeDayEntries.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-6">No timetable entries for {activeDayTab}.</p>
                )}
              </div>
            </div>

            {/* Desktop / Tablet View: Table Grid */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Day</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Room</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(classInfo?.timetable || []).map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">{item.day_of_week}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono">{item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)}</td>
                      <td className="px-4 py-3 text-gray-800 font-bold">{item.subject}</td>
                      <td className="px-4 py-3 text-gray-600">{item.room || 'N/A'}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => deleteItem('timetables', item.id)} className="text-red-600 hover:text-red-800 p-1">
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {classInfo?.timetable?.length === 0 && <p className="text-center text-sm text-gray-500 py-6">No timetable entries yet.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Megaphone className="w-5 h-5 mr-2 text-blue-600 flex-shrink-0" />
                Class Announcements
              </h3>
              <form onSubmit={addAnnouncement} className="space-y-3 mb-5">
                <input required type="text" placeholder="Title" value={announcementForm.title} onChange={e => setAnnouncementForm({...announcementForm, title: e.target.value})} className="border rounded-xl p-2.5 w-full text-sm" />
                <textarea required rows="3" placeholder="Message" value={announcementForm.message} onChange={e => setAnnouncementForm({...announcementForm, message: e.target.value})} className="border rounded-xl p-2.5 w-full text-sm" />
                <button type="submit" className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-xs">
                  <Plus className="w-4 h-4 mr-1" />
                  Post
                </button>
              </form>
              <div className="space-y-3">
                {(classInfo?.announcements || []).map(item => (
                  <div key={item.id} className="border border-gray-100 rounded-xl p-3.5 bg-gray-50/50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-gray-900">{item.title}</h4>
                        <p className="text-xs text-gray-600 mt-1">{item.message}</p>
                      </div>
                      <button type="button" onClick={() => deleteItem('announcements', item.id)} className="text-red-600 hover:text-red-800 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {classInfo?.announcements?.length === 0 && <p className="text-xs sm:text-sm text-gray-500 text-center py-4">No announcements yet.</p>}
              </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center">
                <CalendarDays className="w-5 h-5 mr-2 text-blue-600 flex-shrink-0" />
                Important Dates
              </h3>
              <form onSubmit={addEvent} className="space-y-3 mb-5">
                <input required type="text" placeholder="Title" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} className="border rounded-xl p-2.5 w-full text-sm" />
                <input required type="date" value={eventForm.event_date} onChange={e => setEventForm({...eventForm, event_date: e.target.value})} className="border rounded-xl p-2.5 w-full text-sm" />
                <textarea rows="3" placeholder="Description" value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} className="border rounded-xl p-2.5 w-full text-sm" />
                <button type="submit" className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-xs">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Date
                </button>
              </form>
              <div className="space-y-3">
                {(classInfo?.events || []).map(item => (
                  <div key={item.id} className="border border-gray-100 rounded-xl p-3.5 bg-gray-50/50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-gray-900">{item.title}</h4>
                        <p className="text-xs text-blue-700 font-semibold mt-1">{item.event_date?.slice(0, 10)}</p>
                        {item.description && <p className="text-xs text-gray-600 mt-1">{item.description}</p>}
                      </div>
                      <button type="button" onClick={() => deleteItem('events', item.id)} className="text-red-600 hover:text-red-800 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {classInfo?.events?.length === 0 && <p className="text-xs sm:text-sm text-gray-500 text-center py-4">No important dates yet.</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

