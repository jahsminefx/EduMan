import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Layers, 
  BookOpen, 
  Calendar, 
  CheckCircle, 
  Clock, 
  ChevronRight, 
  Printer, 
  ListOrdered, 
  Sparkles,
  Loader2,
  FileText
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import API_URL from '../../config/api';

export default function StudentSchemeOfWork() {
  const { user } = useAuth();
  const [schemes, setSchemes] = useState([]);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeWeek, setActiveWeek] = useState(null);

  useEffect(() => {
    fetchSchemes();
  }, []);

  const fetchSchemes = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/schemes`);
      setSchemes(res.data || []);
      if (res.data?.length > 0) {
        handleSelectScheme(res.data[0].id);
      }
    } catch (err) {
      console.error('Error loading student schemes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectScheme = async (schemeId) => {
    try {
      setLoadingDetail(true);
      const res = await axios.get(`${API_URL}/schemes/${schemeId}`);
      setSelectedScheme(res.data);
      if (res.data.weeks?.length > 0) {
        setActiveWeek(res.data.weeks[0].week_number);
      }
    } catch (err) {
      console.error('Error fetching scheme detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400 bg-white rounded-3xl border border-gray-100 max-w-7xl mx-auto">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
        Loading your Class Schemes of Work...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-blue-600" />
            Class Scheme of Work
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Weekly subject curriculum roadmaps, lesson objectives, and learning materials for this term.
          </p>
        </div>

        {selectedScheme && (
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs sm:text-sm font-bold rounded-xl hover:bg-gray-50 transition shadow-xs"
          >
            <Printer className="w-4 h-4" /> Print Syllabus
          </button>
        )}
      </div>

      {schemes.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 shadow-xs space-y-3">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-900">No Published Schemes of Work Yet</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Your teachers have not published the scheme of work for this term yet. Check back soon!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subject Switcher Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {schemes.map((sch) => (
              <button
                key={sch.id}
                type="button"
                onClick={() => handleSelectScheme(sch.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
                  selectedScheme?.id === sch.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{sch.subject_name}</span>
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                  selectedScheme?.id === sch.id ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {sch.total_weeks} Wks
                </span>
              </button>
            ))}
          </div>

          {/* Active Subject Scheme Breakdown */}
          {loadingDetail ? (
            <div className="p-12 text-center text-gray-400 bg-white rounded-3xl border border-gray-100">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
              Loading {selectedScheme?.subject_name} syllabus...
            </div>
          ) : selectedScheme ? (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 sm:p-8 space-y-6">
              {/* Scheme Meta Card */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                      {selectedScheme.subject_name}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                      Official Syllabus
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{selectedScheme.title}</h2>
                  <p className="text-xs text-gray-500">
                    {selectedScheme.class_name} • {selectedScheme.session_name || 'Academic Session'} • {selectedScheme.term_name || 'Term'} • Teacher: {selectedScheme.teacher_name}
                  </p>
                </div>
              </div>

              {/* Weekly Timeline Breakdown */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-blue-600" />
                  Weekly Curriculum Roadmap
                </h3>

                <div className="space-y-4">
                  {selectedScheme.weeks?.map((week) => (
                    <div
                      key={week.id || week.week_number}
                      className="bg-gray-50/50 hover:bg-blue-50/20 rounded-2xl border border-gray-200 p-5 transition space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs flex-shrink-0">
                            W{week.week_number}
                          </span>
                          <div>
                            <h4 className="text-base font-bold text-gray-900">{week.topic || 'Untitled Topic'}</h4>
                            {week.sub_topics && (
                              <p className="text-xs text-gray-600 mt-0.5">{week.sub_topics}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {(week.learning_objectives || week.activities_and_resources) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                          {week.learning_objectives && (
                            <div className="p-3.5 bg-white rounded-xl border border-gray-100 space-y-1 shadow-xs">
                              <span className="font-bold text-blue-900 flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5 text-blue-600" /> What You Will Learn:
                              </span>
                              <p className="text-gray-700 whitespace-pre-line leading-relaxed">{week.learning_objectives}</p>
                            </div>
                          )}
                          {week.activities_and_resources && (
                            <div className="p-3.5 bg-white rounded-xl border border-gray-100 space-y-1 shadow-xs">
                              <span className="font-bold text-emerald-900 flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-emerald-600" /> Suggested Study Materials & Activities:
                              </span>
                              <p className="text-gray-700 whitespace-pre-line leading-relaxed">{week.activities_and_resources}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
