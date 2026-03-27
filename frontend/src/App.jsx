import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import MainLayout from './layouts/MainLayout';
import PublicLayout from './layouts/PublicLayout';

// Public Pages
import HomePage from './pages/public/HomePage';
import AboutPage from './pages/public/AboutPage';
import ContactPage from './pages/public/ContactPage';

// Dashboard Pages
import Dashboard from './pages/Dashboard';
import ClassesList from './pages/admin/ClassesList';
import StudentsList from './pages/admin/StudentsList';
import TeachersList from './pages/admin/TeachersList';
import SubjectsList from './pages/admin/SubjectsList';
import Settings from './pages/admin/Settings';
import AttendanceEntry from './pages/teacher/AttendanceEntry';
import GradesEntry from './pages/teacher/GradesEntry';
import HomeworkPage from './pages/teacher/HomeworkPage';
import ContentLibrary from './pages/content/ContentLibrary';
import QuizPage from './pages/quiz/QuizPage';
import ReportCard from './pages/reports/ReportCard';
import SchoolsList from './pages/superadmin/SchoolsList';
import SchoolAdminsList from './pages/superadmin/SchoolAdminsList';

// Placeholder Components for future features
// SuperAdmin pages are now real components imported above
const ParentDashboard = () => <div className="p-8"><h1>Parent Dashboard</h1><p>View your children and fee statements here.</p></div>;
const ContentDashboard = () => <ContentLibrary />;
const FinanceDashboard = () => <div className="p-8"><h1>Fee Management</h1><p>Manage school finances here.</p></div>;
const SupportDashboard = () => <div className="p-8"><h1>System Logs</h1><p>View error traces here.</p></div>;

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* ─── Public Routes (Navbar + Footer) ─── */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Route>

      {/* Legacy login redirect */}
      <Route path="/login" element={<Navigate to="/" />} />

      {/* ─── Protected Dashboard Routes ─── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        
        {/* Admin Routes */}
        <Route 
          path="admin/classes" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin']}>
              <ClassesList />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="admin/subjects" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin']}>
              <SubjectsList />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="admin/students" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin']}>
              <StudentsList />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="admin/teachers" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin']}>
              <TeachersList />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="admin/settings" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin']}>
              <Settings />
            </ProtectedRoute>
          } 
        />

        {/* Teacher Routes */}
        <Route 
          path="teacher/attendance" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin', 'Teacher']}>
               <AttendanceEntry />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="teacher/grades" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin', 'Teacher']}>
               <GradesEntry />
            </ProtectedRoute>
          } 
        />

        {/* Homework Route */}
        <Route 
          path="teacher/homework" 
          element={
            <ProtectedRoute allowedRoles={['SchoolAdmin', 'Teacher', 'Student', 'Parent']}>
               <HomeworkPage />
            </ProtectedRoute>
          } 
        />

        {/* Quiz Route */}
        <Route 
          path="quiz" 
          element={
            <ProtectedRoute allowedRoles={['SchoolAdmin', 'Teacher', 'Student']}>
               <QuizPage />
            </ProtectedRoute>
          } 
        />

        {/* Report Card Route */}
        <Route 
          path="reports/card" 
          element={
            <ProtectedRoute allowedRoles={['SchoolAdmin', 'Teacher', 'Student', 'Parent']}>
               <ReportCard />
            </ProtectedRoute>
          } 
        />

        {/* Super Admin Routes */}
        <Route 
          path="admin/schools" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin']}>
              <SchoolsList />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="admin/school-admins" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin']}>
              <SchoolAdminsList />
            </ProtectedRoute>
          } 
        />

        {/* Parent Routes */}
        <Route 
          path="parent/*" 
          element={
            <ProtectedRoute allowedRoles={['Parent']}>
              <ParentDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Content Manager / Library Routes */}
        <Route 
          path="content/*" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin', 'ContentManager', 'Teacher', 'Student', 'Parent']}>
              <ContentDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Finance Routes */}
        <Route 
          path="finance/*" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin', 'Accountant']}>
              <FinanceDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Support Routes */}
        <Route 
          path="support/*" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SupportOfficer']}>
              <SupportDashboard />
            </ProtectedRoute>
          } 
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
