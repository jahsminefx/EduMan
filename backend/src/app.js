const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

// Simple health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EduMan backend is running correctly.' });
});

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong', message: err.message });
});

module.exports = app;
