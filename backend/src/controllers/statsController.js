const { getDB } = require('../config/database');

exports.getDashboardStats = async (req, res) => {
    try {
        const db = getDB();
        const { role, school_id, id: user_id } = req.user;

        if (role === 'SuperAdmin') {
            const schoolsCount = await db.get("SELECT COUNT(*) as count FROM schools");
            const usersCount = await db.get("SELECT COUNT(*) as count FROM users");
            const activeSubs = await db.get("SELECT COUNT(*) as count FROM schools WHERE is_active = 1");

            return res.json({
                schools: schoolsCount.count || 0,
                users: usersCount.count || 0,
                subscriptions: activeSubs.count || 0,
                status: 'Global Overview'
            });
        }

        if (!school_id && role !== 'SuperAdmin') {
            return res.json({
                students: 0,
                teachers: 0,
                classes: 0,
                attendance: '0%'
            });
        }

        if (role === 'SchoolAdmin') {
            const studentsCount = await db.get("SELECT COUNT(*) as count FROM students WHERE school_id = $1", [school_id]);
            const teachersCount = await db.get("SELECT COUNT(*) as count FROM teachers WHERE school_id = $1", [school_id]);
            const classesCount = await db.get("SELECT COUNT(*) as count FROM classes WHERE school_id = $1", [school_id]);
            const subjectsCount = await db.get("SELECT COUNT(*) as count FROM subjects WHERE school_id = $1", [school_id]);

            const attendanceData = await db.get(`
                SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present
                FROM attendance_records ar
                JOIN students s ON ar.student_id = s.id
                WHERE s.school_id = $1 AND ar.date = CURRENT_DATE
            `, [school_id]);

            let attendancePercentage = 0;
            if (attendanceData && attendanceData.total > 0) {
                attendancePercentage = Math.round((attendanceData.present / attendanceData.total) * 100);
            }

            return res.json({
                students: studentsCount.count || 0,
                teachers: teachersCount.count || 0,
                classes: classesCount.count || 0,
                subjects: subjectsCount.count || 0,
                todayAttendance: `${attendancePercentage}%`
            });
        }

        if (role === 'Teacher') {
            const teacher = await db.get("SELECT id FROM teachers WHERE user_id = $1", [user_id]);
            if (!teacher) return res.status(404).json({ error: 'Not Found', message: 'Teacher record not found' });

            const studentsCount = await db.get(`
                SELECT COUNT(DISTINCT s.id) as count 
                FROM students s
                JOIN teacher_classes tc ON s.class_id = tc.class_id
                WHERE tc.teacher_id = $1
            `, [teacher.id]);

            const classesCount = await db.get("SELECT COUNT(*) as count FROM teacher_classes WHERE teacher_id = $1", [teacher.id]);
            
            const pendingHomework = await db.get(`
                SELECT COUNT(*) as count 
                FROM homework_submissions hs
                JOIN homework h ON hs.homework_id = h.id
                WHERE h.teacher_id = $1 AND hs.status = 'pending'
            `, [teacher.id]);

            const attendanceData = await db.get(`
                SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present
                FROM attendance_records ar
                JOIN teacher_classes tc ON ar.class_id = tc.class_id
                WHERE tc.teacher_id = $1 AND ar.date = CURRENT_DATE
            `, [teacher.id]);

            let attendancePercentage = 0;
            if (attendanceData && attendanceData.total > 0) {
                attendancePercentage = Math.round((attendanceData.present / attendanceData.total) * 100);
            }

            return res.json({
                totalStudents: studentsCount.count || 0,
                classesAssigned: classesCount.count || 0,
                pendingHomework: pendingHomework.count || 0,
                todayAttendance: `${attendancePercentage}%`
            });
        }

        if (role === 'Student') {
            const student = await db.get("SELECT id, class_id FROM students WHERE user_id = $1", [user_id]);
            if (!student) return res.status(404).json({ error: 'Not Found', message: 'Student record not found' });

            const subjectsCount = await db.get("SELECT COUNT(*) as count FROM class_subjects WHERE class_id = $1", [student.class_id]);
            const completedAssignments = await db.get("SELECT COUNT(*) as count FROM homework_submissions WHERE student_id = $1 AND status != 'pending'", [student.id]);
            
            const attendanceData = await db.get(`
                SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present
                FROM attendance_records
                WHERE student_id = $1
            `, [student.id]);

            const averageScore = await db.get("SELECT AVG(score) as avg FROM assessments WHERE student_id = $1", [student.id]);

            let attendancePercentage = 0;
            if (attendanceData && attendanceData.total > 0) {
                attendancePercentage = Math.round((attendanceData.present / attendanceData.total) * 100);
            }

            return res.json({
                subjectsEnrolled: subjectsCount.count || 0,
                assignmentsCompleted: completedAssignments.count || 0,
                attendance: `${attendancePercentage}%`,
                averageScore: Math.round(averageScore.avg || 0)
            });
        }

        res.json({ message: 'Dashboard stats for this role are coming soon.' });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getPerformanceSnapshot = async (req, res) => {
    try {
        const db = getDB();
        const { role, school_id, id: user_id } = req.user;

        if (role === 'SchoolAdmin') {
            const bestClass = await db.get(`
                SELECT c.name, AVG(a.score) as avg_score
                FROM assessments a
                JOIN classes c ON a.class_id = c.id
                WHERE c.school_id = $1
                GROUP BY c.id, c.name
                ORDER BY avg_score DESC LIMIT 1
            `, [school_id]);

            const attendanceTrend = await db.all(`
                SELECT date, ROUND(SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as percentage
                FROM attendance_records ar
                JOIN students s ON ar.student_id = s.id
                WHERE s.school_id = $1
                GROUP BY date
                ORDER BY date DESC LIMIT 7
            `, [school_id]);

            return res.json({
                bestClass: bestClass ? { name: bestClass.name, score: Math.round(bestClass.avg_score) } : null,
                attendanceTrend: attendanceTrend ? attendanceTrend.reverse() : []
            });
        }

        if (role === 'Teacher') {
            const teacher = await db.get("SELECT id FROM teachers WHERE user_id = $1", [user_id]);
            if (!teacher) return res.status(404).json({ error: 'Not Found', message: 'Teacher record not found' });
            
            const classAverages = await db.all(`
                SELECT c.name, AVG(a.score) as avg_score
                FROM assessments a
                JOIN classes c ON a.class_id = c.id
                JOIN teacher_classes tc ON c.id = tc.class_id
                WHERE tc.teacher_id = $1
                GROUP BY c.id, c.name
            `, [teacher.id]);

            const topStudent = await db.get(`
                SELECT s.first_name, s.last_name, AVG(a.score) as avg_score
                FROM assessments a
                JOIN students s ON a.student_id = s.id
                JOIN teacher_classes tc ON s.class_id = tc.class_id
                WHERE tc.teacher_id = $1
                GROUP BY s.id, s.first_name, s.last_name
                ORDER BY avg_score DESC LIMIT 1
            `, [teacher.id]);

            const weakSubjects = await db.all(`
                SELECT sub.name, AVG(a.score) as avg_score
                FROM assessments a
                JOIN subjects sub ON a.subject_id = sub.id
                JOIN teacher_subject_assignments tsa ON sub.id = tsa.subject_id AND a.class_id = tsa.class_id
                WHERE tsa.teacher_id = $1
                GROUP BY sub.id, sub.name
                ORDER BY avg_score ASC LIMIT 3
            `, [teacher.id]);

            return res.json({
                classAverages: classAverages.map(c => ({ name: c.name, score: Math.round(c.avg_score) })),
                topStudent: topStudent ? `${topStudent.first_name} ${topStudent.last_name}` : 'N/A',
                weakSubjects: weakSubjects.map(s => ({ name: s.name, score: Math.round(s.avg_score) }))
            });
        }

        if (role === 'Student') {
            const student = await db.get("SELECT id FROM students WHERE user_id = $1", [user_id]);
            if (!student) return res.status(404).json({ error: 'Not Found', message: 'Student record not found' });
            
            const performance = await db.get(`
                SELECT AVG(score) as avg_score
                FROM assessments
                WHERE student_id = $1
            `, [student.id]);

            const bestSubject = await db.get(`
                SELECT s.name, AVG(a.score) as avg_score
                FROM assessments a
                JOIN subjects s ON a.subject_id = s.id
                WHERE a.student_id = $1
                GROUP BY s.id, s.name
                ORDER BY avg_score DESC LIMIT 1
            `, [student.id]);

            const weakSubject = await db.get(`
                SELECT s.name, AVG(a.score) as avg_score
                FROM assessments a
                JOIN subjects s ON a.subject_id = s.id
                WHERE a.student_id = $1
                GROUP BY s.id, s.name
                ORDER BY avg_score ASC LIMIT 1
            `, [student.id]);

            return res.json({
                average: Math.round(performance?.avg_score || 0),
                bestSubject: bestSubject ? { name: bestSubject.name, score: Math.round(bestSubject.avg_score) } : null,
                weakSubject: weakSubject ? { name: weakSubject.name, score: Math.round(weakSubject.avg_score) } : null
            });
        }

        res.json({});
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getPendingTasks = async (req, res) => {
    try {
        const db = getDB();
        const { role, id: user_id } = req.user;

        if (role === 'Teacher') {
            const teacher = await db.get("SELECT id FROM teachers WHERE user_id = $1", [user_id]);
            if (!teacher) return res.status(404).json({ error: 'Not Found', message: 'Teacher record not found' });
            
            const pendingHomework = await db.get(`
                SELECT COUNT(*) as count FROM homework_submissions hs
                JOIN homework h ON hs.homework_id = h.id
                WHERE h.teacher_id = $1 AND hs.status = 'pending'
            `, [teacher.id]);

            const attendanceDue = await db.get(`
                SELECT COUNT(*) as count FROM teacher_classes tc
                LEFT JOIN attendance_records ar ON tc.class_id = ar.class_id AND ar.date = CURRENT_DATE
                WHERE tc.teacher_id = $1 AND ar.id IS NULL
            `, [teacher.id]);

            return res.json([
                { label: 'Assignments to review', count: pendingHomework.count || 0, action: '/homework' },
                { label: 'Classes without attendance', count: attendanceDue.count || 0, action: '/attendance' }
            ]);
        }

        if (role === 'SchoolAdmin') {
            return res.json([
                { label: 'Unassigned Subjects', count: 0, action: '/subjects' },
                { label: 'Teachers without Classes', count: 0, action: '/teachers' }
            ]);
        }

        res.json([]);
    } catch (err) {
        console.error('Pending tasks error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
