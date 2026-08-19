import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// Layouts
import MainLayout from './layouts/MainLayout';
import PublicLayout from './layouts/PublicLayout';

// Public Pages
import HomePage from './pages/public/HomePage';
import AboutPage from './pages/public/AboutPage';
import ContactPage from './pages/public/ContactPage';
import SetupPasswordPage from './pages/public/SetupPasswordPage';

// Dashboard Pages
import Dashboard from './pages/Dashboard';
import ClassesList from './pages/admin/ClassesList';
import StudentsList from './pages/admin/StudentsList';
import BulkUploadStudents from './pages/admin/BulkUploadStudents';
import TeachersList from './pages/admin/TeachersList';
import SubjectsList from './pages/admin/SubjectsList';
import Settings from './pages/admin/Settings';
import AttendanceEntry from './pages/teacher/AttendanceEntry';
import GradesEntry from './pages/teacher/GradesEntry';
import HomeworkPage from './pages/teacher/HomeworkPage';
import TimetableManagement from './pages/teacher/TimetableManagement';
import SchemeOfWorkPage from './pages/teacher/SchemeOfWorkPage';
import StudentSchemeOfWork from './pages/student/StudentSchemeOfWork';
import ClassInfo from './pages/student/ClassInfo';
import ContentLibrary from './pages/content/ContentLibrary';
import QuizPage from './pages/quiz/QuizPage';
import ReportCard from './pages/reports/ReportCard';
import AnnouncementList from './pages/announcements/AnnouncementList';
import AnnouncementDetail from './pages/announcements/AnnouncementDetail';
import AnnouncementManage from './pages/announcements/AnnouncementManage';
import SchoolsList from './pages/superadmin/SchoolsList';
import SchoolAdminsList from './pages/superadmin/SchoolAdminsList';
import AIAssistant from './pages/ai/AIAssistant';
import AIQuizGenerator from './pages/ai/AIQuizGenerator';
import AIContentGenerator from './pages/ai/AIContentGenerator';
import AIDrafts from './pages/ai/AIDrafts';
import AIPublished from './pages/ai/AIPublished';
import AIManagement from './pages/admin/AIManagement';
import AIUsageLogs from './pages/admin/AIUsageLogs';
import AISettings from './pages/admin/AISettings';

// Support Center Pages
import SupportDashboardPage from './pages/support/SupportDashboard';
import TicketList from './pages/support/TicketList';
import CreateTicket from './pages/support/CreateTicket';
import TicketDetail from './pages/support/TicketDetail';
import EnterpriseInbox from './pages/support/EnterpriseInbox';
import ContactInbox from './pages/support/ContactInbox';
import KnowledgeBasePage from './pages/support/KnowledgeBasePage';
import AdminKnowledgeBase from './pages/support/AdminKnowledgeBase';
import SupportAnalytics from './pages/support/SupportAnalytics';

// Parent Portal Pages
import ParentDashboardPage from './pages/parent/ParentDashboardPage';
import MyChildrenPage from './pages/parent/MyChildrenPage';
import ParentFeeStatements from './pages/parent/ParentFeeStatements';

// SuperAdmin Platform Pages
import PlatformStaffPage from './pages/superadmin/PlatformStaffPage';
import SuperAdminCommandCenter from './pages/superadmin/SuperAdminCommandCenter';
import GlobalUserSearchPage from './pages/superadmin/GlobalUserSearchPage';
import SuperAdminAuditLogsPage from './pages/superadmin/AuditLogsPage';
import SuperAdminEscalationsPage from './pages/superadmin/EscalationsPage';
import PlatformSettingsPage from './pages/superadmin/PlatformSettingsPage';

// Accountant & Finance Portal Pages
import FinanceDashboardPage from './pages/finance/FinanceDashboardPage';
import FeeManagementPage from './pages/finance/FeeManagementPage';
import InvoicesPage from './pages/finance/InvoicesPage';
import PaymentRecordsPage from './pages/finance/PaymentRecordsPage';
import FinancialReportsPage from './pages/finance/FinancialReportsPage';

const ANNOUNCEMENT_ROLES = ['SchoolAdmin', 'Teacher', 'Student', 'Parent'];
const TICKETING_ROLES = ['SuperAdmin', 'SupportOfficer', 'SchoolAdmin', 'Teacher', 'Parent'];
const ALL_KB_ROLES = ['SuperAdmin', 'SupportOfficer', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'ContentManager', 'Accountant'];


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
        <Route path="/setup-password" element={<SetupPasswordPage />} />
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
          path="admin/students/bulk-upload" 
          element={
            <ProtectedRoute allowedRoles={['SchoolAdmin']}>
              <BulkUploadStudents />
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
          path="admin/school-profile" 
          element={<Navigate to="/dashboard/admin/settings" replace />}
        />
        <Route 
          path="admin/settings" 
          element={
            <ProtectedRoute allowedRoles={['SchoolAdmin']}>
              <Settings />
            </ProtectedRoute>
          } 
        />
        <Route
          path="admin/ai"
          element={
            <ProtectedRoute allowedRoles={['SchoolAdmin']}>
              <AIManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/ai/usage"
          element={
            <ProtectedRoute allowedRoles={['SchoolAdmin']}>
              <AIUsageLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/ai/settings"
          element={
            <ProtectedRoute allowedRoles={['SchoolAdmin']}>
              <AISettings />
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
        <Route 
          path="teacher/timetable" 
          element={
            <ProtectedRoute allowedRoles={['Teacher']}>
               <TimetableManagement />
            </ProtectedRoute>
          } 
        />
        <Route
          path="teacher/ai"
          element={
            <ProtectedRoute allowedRoles={['Teacher']}>
              <AIAssistant />
            </ProtectedRoute>
          }
        />
        <Route
          path="teacher/ai/quiz"
          element={
            <ProtectedRoute allowedRoles={['Teacher']}>
              <AIQuizGenerator />
            </ProtectedRoute>
          }
        />
        <Route
          path="teacher/ai/content"
          element={
            <ProtectedRoute allowedRoles={['Teacher']}>
              <AIContentGenerator />
            </ProtectedRoute>
          }
        />
        <Route
          path="teacher/ai/drafts"
          element={
            <ProtectedRoute allowedRoles={['Teacher']}>
              <AIDrafts />
            </ProtectedRoute>
          }
        />
        <Route
          path="teacher/ai/published"
          element={
            <ProtectedRoute allowedRoles={['Teacher']}>
              <AIPublished />
            </ProtectedRoute>
          }
        />

        <Route 
          path="teacher/schemes" 
          element={
            <ProtectedRoute allowedRoles={['Teacher', 'SchoolAdmin', 'SuperAdmin']}>
               <SchemeOfWorkPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="student/schemes" 
          element={
            <ProtectedRoute allowedRoles={['Student', 'Parent']}>
               <StudentSchemeOfWork />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="student/class-info" 
          element={
            <ProtectedRoute allowedRoles={['Student']}>
               <ClassInfo />
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

        <Route path="announcements" element={<Navigate to="/announcements" />} />
        <Route path="announcements/manage" element={<Navigate to="/announcements/manage" />} />
        <Route path="announcements/:id" element={<Navigate to="/announcements" />} />

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
        <Route 
          path="superadmin/command-center" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin']}>
              <SuperAdminCommandCenter />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="superadmin/platform-staff" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin']}>
              <PlatformStaffPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="superadmin/user-search" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin']}>
              <GlobalUserSearchPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="superadmin/audit-logs" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin']}>
              <SuperAdminAuditLogsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="superadmin/escalations" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin']}>
              <SuperAdminEscalationsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="superadmin/settings" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin']}>
              <PlatformSettingsPage />
            </ProtectedRoute>
          } 
        />

        {/* Parent Routes */}
        <Route 
          path="parent/overview" 
          element={
            <ProtectedRoute allowedRoles={['Parent']}>
              <ParentDashboardPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="parent/children" 
          element={
            <ProtectedRoute allowedRoles={['Parent']}>
              <MyChildrenPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="parent/fees" 
          element={
            <ProtectedRoute allowedRoles={['Parent']}>
              <ParentFeeStatements />
            </ProtectedRoute>
          } 
        />

        {/* Content Manager / Library Routes */}
        <Route 
          path="content/*" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin', 'ContentManager', 'Teacher', 'Student', 'Parent']}>
              <ContentLibrary />
            </ProtectedRoute>
          } 
        />

        {/* Finance Routes */}
        <Route 
          path="finance/overview" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin', 'Accountant']}>
              <FinanceDashboardPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="finance/fees" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin', 'Accountant']}>
              <FeeManagementPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="finance/invoices" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin', 'Accountant']}>
              <InvoicesPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="finance/payments" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin', 'Accountant']}>
              <PaymentRecordsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="finance/reports" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SchoolAdmin', 'Accountant']}>
              <FinancialReportsPage />
            </ProtectedRoute>
          } 
        />

        {/* Support Center Routes */}
        <Route 
          path="support" 
          element={
            <ProtectedRoute allowedRoles={ALL_KB_ROLES}>
              <SupportDashboardPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="support/inbox" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SupportOfficer']}>
              <EnterpriseInbox />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="support/contact" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SupportOfficer']}>
              <ContactInbox />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="support/tickets" 
          element={
            <ProtectedRoute allowedRoles={TICKETING_ROLES}>
              <TicketList />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="support/tickets/new" 
          element={
            <ProtectedRoute allowedRoles={TICKETING_ROLES}>
              <CreateTicket />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="support/tickets/:id" 
          element={
            <ProtectedRoute allowedRoles={TICKETING_ROLES}>
              <TicketDetail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="support/kb" 
          element={
            <ProtectedRoute allowedRoles={ALL_KB_ROLES}>
              <KnowledgeBasePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="support/kb/manage" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SupportOfficer', 'ContentManager']}>
              <AdminKnowledgeBase />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="support/kb/:slug" 
          element={
            <ProtectedRoute allowedRoles={ALL_KB_ROLES}>
              <KnowledgeBasePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="support/analytics" 
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'SupportOfficer']}>
              <SupportAnalytics />
            </ProtectedRoute>
          } 
        />
      </Route>


      <Route
        path="/announcements"
        element={
          <ProtectedRoute allowedRoles={ANNOUNCEMENT_ROLES}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AnnouncementList />} />
        <Route
          path="manage"
          element={
            <ProtectedRoute allowedRoles={['SchoolAdmin', 'Teacher']}>
              <AnnouncementManage />
            </ProtectedRoute>
          }
        />
        <Route path=":id" element={<AnnouncementDetail />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
