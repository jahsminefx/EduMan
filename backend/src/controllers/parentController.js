const { getDB } = require('../config/database');

async function isParentLinked(db, parentUserId, studentId) {
    const link = await db.get(
        `SELECT psl.id 
         FROM parent_student_links psl
         JOIN students s ON psl.student_id = s.id
         WHERE psl.parent_user_id = $1 AND s.id = $2`,
        [parentUserId, studentId]
    );
    return !!link;
}

// ── 1. GET ALL LINKED CHILDREN WITH REAL METRICS ──
exports.getChildren = async (req, res) => {
    try {
        const parentUserId = req.user.id;
        const db = getDB();

        const children = await db.all(`
            SELECT 
                s.id,
                s.admission_number,
                s.first_name,
                s.last_name,
                s.gender,
                s.age,
                s.dob,
                s.class_id,
                c.name as class_name,
                c.level as class_level,
                sch.id as school_id,
                sch.name as school_name,
                psl.relationship,
                psl.is_primary
            FROM parent_student_links psl
            JOIN students s ON psl.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            JOIN schools sch ON s.school_id = sch.id
            WHERE psl.parent_user_id = $1
            ORDER BY s.id ASC
        `, [parentUserId]);

        for (const child of children) {
            // 1. Academic Average
            const gradeStats = await db.get(`
                SELECT AVG(score / max_score * 100) as avg_score
                FROM assessments
                WHERE student_id = $1 AND max_score > 0
            `, [child.id]);
            child.academicAverage = gradeStats?.avg_score != null ? Math.round(gradeStats.avg_score) : 0;

            // 2. Attendance %
            const attStats = await db.get(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) as present,
                    COUNT(CASE WHEN status = 'LATE' THEN 1 END) as late,
                    COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) as absent
                FROM attendance_records
                WHERE student_id = $1
            `, [child.id]);

            const totalDays = parseInt(attStats?.total || 0, 10);
            const presentDays = parseInt(attStats?.present || 0, 10);
            const lateDays = parseInt(attStats?.late || 0, 10);
            child.attendancePercentage = totalDays > 0 ? Math.round(((presentDays + (lateDays * 0.5)) / totalDays) * 100 * 10) / 10 : 100;
            child.attendanceCounts = { total: totalDays, present: presentDays, late: lateDays, absent: parseInt(attStats?.absent || 0, 10) };

            // 3. Outstanding Fees
            const feeStats = await db.get(`
                SELECT 
                    COALESCE(SUM(total_amount), 0) as total_fees,
                    COALESCE(SUM(paid_amount), 0) as total_paid,
                    COALESCE(SUM(outstanding_amount), 0) as total_outstanding
                FROM student_fee_invoices
                WHERE student_id = $1 AND status != 'CANCELLED'
            `, [child.id]);
            child.outstandingFees = parseFloat(feeStats?.total_outstanding || 0);
            child.feeTotals = {
                total: parseFloat(feeStats?.total_fees || 0),
                paid: parseFloat(feeStats?.total_paid || 0),
                outstanding: parseFloat(feeStats?.total_outstanding || 0)
            };

            // 4. Pending Homework Count
            if (child.class_id) {
                const hwCount = await db.get(`
                    SELECT COUNT(*) as count
                    FROM homework h
                    WHERE h.class_id = $1 AND h.id NOT IN (
                        SELECT homework_id FROM homework_submissions WHERE student_id = $2
                    )
                `, [child.class_id, child.id]);
                child.pendingHomeworkCount = parseInt(hwCount?.count || 0, 10);
            } else {
                child.pendingHomeworkCount = 0;
            }

            // 5. Recent Result
            const recentGrade = await db.get(`
                SELECT a.type, a.score, a.max_score, s.name as subject_name
                FROM assessments a
                LEFT JOIN subjects s ON a.subject_id = s.id
                WHERE a.student_id = $1
                ORDER BY a.id DESC
                LIMIT 1
            `, [child.id]);
            child.recentResult = recentGrade ? {
                subject: recentGrade.subject_name || 'Subject',
                score: recentGrade.score,
                maxScore: recentGrade.max_score,
                percentage: Math.round((recentGrade.score / recentGrade.max_score) * 100)
            } : null;
        }

        res.json({ children });
    } catch (err) {
        console.error('Error fetching parent children:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve children records' });
    }
};

// ── 2. GET SINGLE CHILD PROFILE (IDOR GUARDED) ──
exports.getChildProfile = async (req, res) => {
    try {
        const { studentId } = req.params;
        const parentUserId = req.user.id;
        const db = getDB();

        if (!await isParentLinked(db, parentUserId, studentId)) {
            return res.status(403).json({ error: 'Forbidden', message: 'This student is not linked to your parent account.' });
        }

        const child = await db.get(`
            SELECT 
                s.*,
                c.name as class_name,
                sch.name as school_name
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            JOIN schools sch ON s.school_id = sch.id
            WHERE s.id = $1
        `, [studentId]);

        res.json({ child });
    } catch (err) {
        console.error('Error fetching child profile:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve child profile' });
    }
};

// ── 3. GET CHILD ACADEMICS (IDOR GUARDED) ──
exports.getChildAcademics = async (req, res) => {
    try {
        const { studentId } = req.params;
        const parentUserId = req.user.id;
        const db = getDB();

        if (!await isParentLinked(db, parentUserId, studentId)) {
            return res.status(403).json({ error: 'Forbidden', message: 'This student is not linked to your parent account.' });
        }

        const assessments = await db.all(`
            SELECT 
                a.*,
                sub.name as subject_name,
                sub.code as subject_code,
                c.name as class_name,
                u.name as teacher_name
            FROM assessments a
            LEFT JOIN subjects sub ON a.subject_id = sub.id
            LEFT JOIN classes c ON a.class_id = c.id
            LEFT JOIN users u ON a.recorded_by = u.id
            WHERE a.student_id = $1
            ORDER BY a.term_id DESC, sub.name ASC
        `, [studentId]);

        // Subject averages
        const subjectAverages = await db.all(`
            SELECT 
                sub.name as subject_name,
                AVG(a.score / a.max_score * 100) as average_pct
            FROM assessments a
            JOIN subjects sub ON a.subject_id = sub.id
            WHERE a.student_id = $1 AND a.max_score > 0
            GROUP BY sub.name
        `, [studentId]);

        res.json({ assessments, subjectAverages });
    } catch (err) {
        console.error('Error fetching child academics:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve academic records' });
    }
};

// ── 4. GET CHILD ATTENDANCE (IDOR GUARDED) ──
exports.getChildAttendance = async (req, res) => {
    try {
        const { studentId } = req.params;
        const parentUserId = req.user.id;
        const db = getDB();

        if (!await isParentLinked(db, parentUserId, studentId)) {
            return res.status(403).json({ error: 'Forbidden', message: 'This student is not linked to your parent account.' });
        }

        const records = await db.all(`
            SELECT ar.*, c.name as class_name
            FROM attendance_records ar
            LEFT JOIN classes c ON ar.class_id = c.id
            WHERE ar.student_id = $1
            ORDER BY ar.date DESC
        `, [studentId]);

        const summary = await db.get(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) as present,
                COUNT(CASE WHEN status = 'LATE' THEN 1 END) as late,
                COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) as absent
            FROM attendance_records
            WHERE student_id = $1
        `, [studentId]);

        const totalDays = parseInt(summary?.total || 0, 10);
        const presentDays = parseInt(summary?.present || 0, 10);
        const lateDays = parseInt(summary?.late || 0, 10);
        const percentage = totalDays > 0 ? Math.round(((presentDays + (lateDays * 0.5)) / totalDays) * 100 * 10) / 10 : 100;

        res.json({
            summary: {
                total: totalDays,
                present: presentDays,
                late: lateDays,
                absent: parseInt(summary?.absent || 0, 10),
                percentage
            },
            records
        });
    } catch (err) {
        console.error('Error fetching child attendance:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve attendance records' });
    }
};

// ── 5. GET CHILD HOMEWORK (IDOR GUARDED) ──
exports.getChildHomework = async (req, res) => {
    try {
        const { studentId } = req.params;
        const parentUserId = req.user.id;
        const db = getDB();

        if (!await isParentLinked(db, parentUserId, studentId)) {
            return res.status(403).json({ error: 'Forbidden', message: 'This student is not linked to your parent account.' });
        }

        const student = await db.get(`SELECT class_id FROM students WHERE id = $1`, [studentId]);
        if (!student || !student.class_id) {
            return res.json({ homework: [] });
        }

        const homeworkList = await db.all(`
            SELECT 
                h.*,
                sub.name as subject_name,
                u.name as teacher_name,
                hs.id as submission_id,
                hs.status as submission_status,
                hs.grade,
                hs.feedback,
                hs.submitted_at
            FROM homework h
            LEFT JOIN subjects sub ON h.subject_id = sub.id
            LEFT JOIN users u ON h.teacher_id = u.id
            LEFT JOIN homework_submissions hs ON h.id = hs.homework_id AND hs.student_id = $1
            WHERE h.class_id = $2
            ORDER BY h.due_date DESC
        `, [studentId, student.class_id]);

        res.json({ homework: homeworkList });
    } catch (err) {
        console.error('Error fetching child homework:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve homework assignments' });
    }
};

// ── 6. GET CHILD FEES & STATEMENTS (IDOR GUARDED) ──
exports.getChildFees = async (req, res) => {
    try {
        const { studentId } = req.params;
        const parentUserId = req.user.id;
        const db = getDB();

        if (!await isParentLinked(db, parentUserId, studentId)) {
            return res.status(403).json({ error: 'Forbidden', message: 'This student is not linked to your parent account.' });
        }

        const invoices = await db.all(`
            SELECT 
                inv.*,
                acs.name as session_name,
                act.name as term_name
            FROM student_fee_invoices inv
            LEFT JOIN academic_sessions acs ON inv.session_id = acs.id
            LEFT JOIN academic_terms act ON inv.term_id = act.id
            WHERE inv.student_id = $1 AND inv.status != 'CANCELLED'
            ORDER BY inv.id DESC
        `, [studentId]);

        for (const inv of invoices) {
            const items = await db.all(`SELECT * FROM invoice_items WHERE invoice_id = $1`, [inv.id]);
            const payments = await db.all(`SELECT * FROM fee_payments WHERE invoice_id = $1 ORDER BY payment_date DESC`, [inv.id]);
            inv.items = items;
            inv.payments = payments;
        }

        const summary = await db.get(`
            SELECT 
                COALESCE(SUM(total_amount), 0) as total,
                COALESCE(SUM(paid_amount), 0) as paid,
                COALESCE(SUM(outstanding_amount), 0) as outstanding
            FROM student_fee_invoices
            WHERE student_id = $1 AND status != 'CANCELLED'
        `, [studentId]);

        res.json({
            summary: {
                total: parseFloat(summary?.total || 0),
                paid: parseFloat(summary?.paid || 0),
                outstanding: parseFloat(summary?.outstanding || 0)
            },
            invoices
        });
    } catch (err) {
        console.error('Error fetching child fees:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve fee statements' });
    }
};

// ── 7. GET PAYMENT RECEIPT DETAILS (IDOR GUARDED) ──
exports.getPaymentReceipt = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const parentUserId = req.user.id;
        const db = getDB();

        const payment = await db.get(`
            SELECT 
                p.*,
                inv.invoice_number,
                inv.total_amount as invoice_total,
                inv.paid_amount as invoice_paid,
                inv.outstanding_amount as invoice_outstanding,
                s.first_name || ' ' || s.last_name as student_name,
                s.admission_number,
                c.name as class_name,
                sch.name as school_name,
                sch.address as school_address,
                sch.phone as school_phone,
                sch.logo_url as school_logo
            FROM fee_payments p
            JOIN student_fee_invoices inv ON p.invoice_id = inv.id
            JOIN students s ON p.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            JOIN schools sch ON p.school_id = sch.id
            WHERE p.id = $1
        `, [paymentId]);

        if (!payment) {
            return res.status(404).json({ error: 'Not Found', message: 'Payment record not found.' });
        }

        if (!await isParentLinked(db, parentUserId, payment.student_id)) {
            return res.status(403).json({ error: 'Forbidden', message: 'You are not authorized to access this receipt.' });
        }

        res.json({ receipt: payment });
    } catch (err) {
        console.error('Error fetching receipt:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve receipt' });
    }
};
