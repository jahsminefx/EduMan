const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// Production-safe CORS configuration
const allowedOrigins = [
  'https://eduman.africa',
  'https://www.eduman.africa'
];

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5173'
  );
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy violation: Access from this origin is not allowed.'));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiters for sensitive endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too Many Requests', message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too Many Requests', message: 'Too many contact messages sent. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Routes
const authRoutes = require('./routes/authRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const classRoutes = require('./routes/classRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const gradeRoutes = require('./routes/gradeRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const homeworkRoutes = require('./routes/homeworkRoutes');
const contentRoutes = require('./routes/contentRoutes');
const quizRoutes = require('./routes/quizRoutes');
const statsRoutes = require('./routes/statsRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const classInfoRoutes = require('./routes/classInfoRoutes');
const aiRoutes = require('./routes/aiRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const contactRoutes = require('./routes/contactRoutes');
const supportRoutes = require('./routes/supportRoutes');
const knowledgeBaseRoutes = require('./routes/knowledgeBaseRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Simple health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EduMan backend is running correctly.' });
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/class-info', classInfoRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/contact', contactLimiter, contactRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/notifications', notificationRoutes);


// ── Serve frontend build in production ──
// This fixes "Not Found" on page refresh when backend serves the frontend
const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendBuildPath));

// Catch-all: serve index.html for any non-API route (SPA client-side routing)
app.use((req, res, next) => {
  // Only intercept GET requests
  if (req.method !== 'GET') return next();

  // Don't intercept API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
    return next();
  }
  const indexPath = path.join(frontendBuildPath, 'index.html');
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    next();
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const responseMessage = isProd && status === 500 
    ? 'An unexpected error occurred on the server. Please try again later.'
    : err.message || 'Something went wrong';

  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : (err.name || 'Error'),
    message: responseMessage
  });
});

module.exports = app;
