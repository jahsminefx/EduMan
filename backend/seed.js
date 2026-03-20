/**
 * EduMan Comprehensive Seed Script (PostgreSQL)
 * Populates the database with realistic test data for all 8 user roles.
 * Run: node seed.js
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('ERROR: DATABASE_URL not set. Check your .env file.');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper functions for pg
const get = async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows[0];
};
const run = async (text, params) => {
    const res = await pool.query(text, params);
    return { lastID: res.rows[0]?.id || null, changes: res.rowCount };
};

async function seed() {
    const hash = await bcrypt.hash('password123', 10);
    console.log('🌱 Seeding EduMan database...\n');

    // ──────────────────────────────────────
    // 1. SCHOOLS
    // ──────────────────────────────────────
    const schools = [
        { name: 'Greenfield Academy', address: '12 Lagos Road, Ikeja', phone: '08012345678', email: 'info@greenfield.edu.ng' },
        { name: 'Sunrise International School', address: '45 Airport Road, Abuja', phone: '08098765432', email: 'admin@sunrise.edu.ng' },
    ];
    const schoolIds = [];
    for (const s of schools) {
        const existing = await get('SELECT id FROM schools WHERE name = $1', [s.name]);
        if (existing) { schoolIds.push(existing.id); continue; }
        const r = await run('INSERT INTO schools (name, address, phone, email) VALUES ($1, $2, $3, $4) RETURNING id', [s.name, s.address, s.phone, s.email]);
        schoolIds.push(r.lastID);
    }
    console.log(`✅ ${schoolIds.length} schools ready`);

    // ──────────────────────────────────────
    // 2. ACADEMIC SESSIONS & TERMS
    // ──────────────────────────────────────
    for (const sid of schoolIds) {
        const existingSession = await get('SELECT id FROM academic_sessions WHERE school_id = $1', [sid]);
        if (existingSession) continue;
        const sess = await run('INSERT INTO academic_sessions (school_id, name, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, 1) RETURNING id',
            [sid, '2025/2026', '2025-09-01', '2026-07-15']);
        await run('INSERT INTO academic_terms (school_id, session_id, name, is_active) VALUES ($1, $2, $3, 1) RETURNING id', [sid, sess.lastID, 'First Term']);
        await run('INSERT INTO academic_terms (school_id, session_id, name, is_active) VALUES ($1, $2, $3, 0) RETURNING id', [sid, sess.lastID, 'Second Term']);
        await run('INSERT INTO academic_terms (school_id, session_id, name, is_active) VALUES ($1, $2, $3, 0) RETURNING id', [sid, sess.lastID, 'Third Term']);
    }
    console.log('✅ Academic sessions & terms seeded');

    // ──────────────────────────────────────
    // 3. USERS (all 8 roles)
    // ──────────────────────────────────────
    const users = [
        // SchoolAdmins
        { name: 'Mrs. Adebayo', email: 'adebayo@greenfield.edu.ng', role: 'SchoolAdmin', schoolIdx: 0 },
        { name: 'Mr. Okonkwo', email: 'okonkwo@sunrise.edu.ng', role: 'SchoolAdmin', schoolIdx: 1 },
        // Teachers
        { name: 'Mr. Chidi Eze', email: 'chidi@greenfield.edu.ng', role: 'Teacher', schoolIdx: 0 },
        { name: 'Ms. Amina Bello', email: 'amina@greenfield.edu.ng', role: 'Teacher', schoolIdx: 0 },
        { name: 'Mr. Tunde Bakare', email: 'tunde@sunrise.edu.ng', role: 'Teacher', schoolIdx: 1 },
        // Students
        { name: 'Femi Adesola', email: 'femi@student.greenfield.edu.ng', role: 'Student', schoolIdx: 0 },
        { name: 'Joy Okafor', email: 'joy@student.greenfield.edu.ng', role: 'Student', schoolIdx: 0 },
        { name: 'Bola Hassan', email: 'bola@student.greenfield.edu.ng', role: 'Student', schoolIdx: 0 },
        { name: 'Kemi Ojo', email: 'kemi@student.sunrise.edu.ng', role: 'Student', schoolIdx: 1 },
        // Parents
        { name: 'Chief Adesola', email: 'chief.adesola@gmail.com', role: 'Parent' },
        { name: 'Mrs. Okafor', email: 'mrs.okafor@gmail.com', role: 'Parent' },
        // ContentManager
        { name: 'Dr. Ibrahim', email: 'ibrahim@eduman.local', role: 'ContentManager' },
        // Accountant
        { name: 'Mrs. Fashola', email: 'fashola@greenfield.edu.ng', role: 'Accountant', schoolIdx: 0 },
        // SupportOfficer
        { name: 'Emeka IT', email: 'emeka@eduman.local', role: 'SupportOfficer' },
    ];

    const userMap = {};
    for (const u of users) {
        const existing = await get('SELECT id FROM users WHERE email = $1', [u.email]);
        if (existing) { userMap[u.email] = existing.id; continue; }
        const r = await run('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id', [u.name, u.email, hash, u.role]);
        userMap[u.email] = r.lastID;
    }
    console.log(`✅ ${Object.keys(userMap).length} users seeded (password: password123)`);

    // ──────────────────────────────────────
    // 4. SCHOOL ADMIN ASSIGNMENTS
    // ──────────────────────────────────────
    const adminAssignments = [
        { email: 'adebayo@greenfield.edu.ng', schoolIdx: 0 },
        { email: 'okonkwo@sunrise.edu.ng', schoolIdx: 1 },
    ];
    for (const a of adminAssignments) {
        const exists = await get('SELECT id FROM school_admin_assignments WHERE user_id = $1', [userMap[a.email]]);
        if (!exists) await run('INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)', [userMap[a.email], schoolIds[a.schoolIdx]]);
    }
    console.log('✅ School admin assignments set');

    // ──────────────────────────────────────
    // 5. CLASSES
    // ──────────────────────────────────────
    const classDefs = [
        { name: 'JSS 1A', level: 1, schoolIdx: 0 },
        { name: 'JSS 2A', level: 2, schoolIdx: 0 },
        { name: 'SS 1A', level: 4, schoolIdx: 0 },
        { name: 'JSS 1A', level: 1, schoolIdx: 1 },
    ];
    const classIds = {};
    for (const c of classDefs) {
        const sid = schoolIds[c.schoolIdx];
        const existing = await get('SELECT id FROM classes WHERE school_id = $1 AND name = $2', [sid, c.name]);
        if (existing) { classIds[`${c.schoolIdx}_${c.name}`] = existing.id; continue; }
        const r = await run('INSERT INTO classes (school_id, name, level) VALUES ($1, $2, $3) RETURNING id', [sid, c.name, c.level]);
        classIds[`${c.schoolIdx}_${c.name}`] = r.lastID;
    }
    console.log(`✅ ${Object.keys(classIds).length} classes seeded`);

    // ──────────────────────────────────────
    // 6. SUBJECTS
    // ──────────────────────────────────────
    const subjectNames = ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Civic Education'];
    const subjectIds = {};
    for (const sIdx of [0, 1]) {
        const sid = schoolIds[sIdx];
        for (const sn of subjectNames) {
            const existing = await get('SELECT id FROM subjects WHERE school_id = $1 AND name = $2', [sid, sn]);
            if (existing) { subjectIds[`${sIdx}_${sn}`] = existing.id; continue; }
            const r = await run('INSERT INTO subjects (school_id, name, code) VALUES ($1, $2, $3) RETURNING id', [sid, sn, sn.substring(0, 3).toUpperCase()]);
            subjectIds[`${sIdx}_${sn}`] = r.lastID;
        }
    }
    console.log(`✅ ${Object.keys(subjectIds).length} subjects seeded`);

    // ──────────────────────────────────────
    // 7. TEACHERS (profiles)
    // ──────────────────────────────────────
    const teacherProfiles = [
        { email: 'chidi@greenfield.edu.ng', first: 'Chidi', last: 'Eze', phone: '08011111111', schoolIdx: 0 },
        { email: 'amina@greenfield.edu.ng', first: 'Amina', last: 'Bello', phone: '08022222222', schoolIdx: 0 },
        { email: 'tunde@sunrise.edu.ng', first: 'Tunde', last: 'Bakare', phone: '08033333333', schoolIdx: 1 },
    ];
    const teacherIds = {};
    for (const t of teacherProfiles) {
        const uid = userMap[t.email];
        const sid = schoolIds[t.schoolIdx];
        const existing = await get('SELECT id FROM teachers WHERE user_id = $1', [uid]);
        if (existing) { teacherIds[t.email] = existing.id; continue; }
        const r = await run('INSERT INTO teachers (user_id, school_id, first_name, last_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [uid, sid, t.first, t.last, t.phone]);
        teacherIds[t.email] = r.lastID;
    }
    console.log(`✅ ${Object.keys(teacherIds).length} teacher profiles seeded`);

    // ──────────────────────────────────────
    // 8. TEACHER-SUBJECT ASSIGNMENTS
    // ──────────────────────────────────────
    const assignments = [
        { teacher: 'chidi@greenfield.edu.ng', class: '0_JSS 1A', subject: '0_Mathematics' },
        { teacher: 'chidi@greenfield.edu.ng', class: '0_JSS 1A', subject: '0_Basic Science' },
        { teacher: 'chidi@greenfield.edu.ng', class: '0_JSS 2A', subject: '0_Mathematics' },
        { teacher: 'amina@greenfield.edu.ng', class: '0_JSS 1A', subject: '0_English Language' },
        { teacher: 'amina@greenfield.edu.ng', class: '0_SS 1A', subject: '0_English Language' },
        { teacher: 'tunde@sunrise.edu.ng', class: '1_JSS 1A', subject: '1_Mathematics' },
    ];
    for (const a of assignments) {
        const tid = teacherIds[a.teacher]; const cid = classIds[a.class]; const sid = subjectIds[a.subject];
        const existing = await get('SELECT id FROM teacher_subject_assignments WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3', [tid, cid, sid]);
        if (!existing) await run('INSERT INTO teacher_subject_assignments (teacher_id, class_id, subject_id) VALUES ($1, $2, $3)', [tid, cid, sid]);
    }
    console.log('✅ Teacher-subject assignments set');

    // ──────────────────────────────────────
    // 9. STUDENTS
    // ──────────────────────────────────────
    const studentDefs = [
        { email: 'femi@student.greenfield.edu.ng', first: 'Femi', last: 'Adesola', adm: 'GF-2025-001', gender: 'Male', dob: '2012-03-15', class: '0_JSS 1A', schoolIdx: 0 },
        { email: 'joy@student.greenfield.edu.ng', first: 'Joy', last: 'Okafor', adm: 'GF-2025-002', gender: 'Female', dob: '2012-06-20', class: '0_JSS 1A', schoolIdx: 0 },
        { email: 'bola@student.greenfield.edu.ng', first: 'Bola', last: 'Hassan', adm: 'GF-2025-003', gender: 'Male', dob: '2011-11-08', class: '0_JSS 2A', schoolIdx: 0 },
        { email: 'kemi@student.sunrise.edu.ng', first: 'Kemi', last: 'Ojo', adm: 'SR-2025-001', gender: 'Female', dob: '2012-01-12', class: '1_JSS 1A', schoolIdx: 1 },
    ];
    const studentIds = {};
    for (const s of studentDefs) {
        const sid = schoolIds[s.schoolIdx]; const cid = classIds[s.class]; const uid = userMap[s.email];
        const existing = await get('SELECT id FROM students WHERE admission_number = $1 AND school_id = $2', [s.adm, sid]);
        if (existing) { studentIds[s.email] = existing.id; continue; }
        const r = await run('INSERT INTO students (user_id, school_id, admission_number, first_name, last_name, gender, dob, class_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [uid, sid, s.adm, s.first, s.last, s.gender, s.dob, cid]);
        studentIds[s.email] = r.lastID;
    }
    console.log(`✅ ${Object.keys(studentIds).length} students seeded`);

    // ──────────────────────────────────────
    // 10. PARENT-STUDENT LINKS
    // ──────────────────────────────────────
    const parentLinks = [
        { parent: 'chief.adesola@gmail.com', student: 'femi@student.greenfield.edu.ng' },
        { parent: 'mrs.okafor@gmail.com', student: 'joy@student.greenfield.edu.ng' },
    ];
    for (const pl of parentLinks) {
        const pid = userMap[pl.parent]; const sid = studentIds[pl.student];
        const existing = await get('SELECT id FROM parent_student_links WHERE parent_user_id = $1 AND student_id = $2', [pid, sid]);
        if (!existing) await run('INSERT INTO parent_student_links (parent_user_id, student_id) VALUES ($1, $2)', [pid, sid]);
    }
    console.log('✅ Parent-student links set');

    // ──────────────────────────────────────
    // 11. SAMPLE ATTENDANCE RECORDS
    // ──────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    const jss1aId = classIds['0_JSS 1A'];
    for (const email of ['femi@student.greenfield.edu.ng', 'joy@student.greenfield.edu.ng']) {
        const sid = studentIds[email];
        const existing = await get('SELECT id FROM attendance_records WHERE student_id = $1 AND date = $2', [sid, today]);
        if (!existing) {
            await run('INSERT INTO attendance_records (student_id, class_id, date, status, recorded_by) VALUES ($1, $2, $3, $4, $5)',
                [sid, jss1aId, today, email.includes('femi') ? 'Present' : 'Absent', userMap['chidi@greenfield.edu.ng']]);
        }
    }
    console.log('✅ Sample attendance records seeded');

    // ──────────────────────────────────────
    // 12. SAMPLE ASSESSMENTS (GRADES)
    // ──────────────────────────────────────
    const term = await get('SELECT id FROM academic_terms WHERE school_id = $1 AND is_active = 1', [schoolIds[0]]);
    if (term) {
        const mathId = subjectIds['0_Mathematics'];
        const engId = subjectIds['0_English Language'];
        const gradeData = [
            { student: 'femi@student.greenfield.edu.ng', subject: mathId, type: 'test', score: 78, max: 100 },
            { student: 'femi@student.greenfield.edu.ng', subject: mathId, type: 'exam', score: 85, max: 100 },
            { student: 'femi@student.greenfield.edu.ng', subject: engId, type: 'test', score: 65, max: 100 },
            { student: 'femi@student.greenfield.edu.ng', subject: engId, type: 'exam', score: 72, max: 100 },
            { student: 'joy@student.greenfield.edu.ng', subject: mathId, type: 'test', score: 92, max: 100 },
            { student: 'joy@student.greenfield.edu.ng', subject: mathId, type: 'exam', score: 88, max: 100 },
            { student: 'joy@student.greenfield.edu.ng', subject: engId, type: 'test', score: 80, max: 100 },
            { student: 'joy@student.greenfield.edu.ng', subject: engId, type: 'exam', score: 75, max: 100 },
        ];
        for (const g of gradeData) {
            const sid = studentIds[g.student];
            const existing = await get('SELECT id FROM assessments WHERE student_id = $1 AND subject_id = $2 AND term_id = $3 AND type = $4',
                [sid, g.subject, term.id, g.type]);
            if (!existing) {
                await run('INSERT INTO assessments (student_id, class_id, subject_id, term_id, type, score, max_score, recorded_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                    [sid, jss1aId, g.subject, term.id, g.type, g.score, g.max, userMap['chidi@greenfield.edu.ng']]);
            }
        }
        console.log('✅ Sample grades seeded');
    }

    // ──────────────────────────────────────
    // 13. SAMPLE HOMEWORK
    // ──────────────────────────────────────
    const hwExists = await get('SELECT id FROM homework WHERE school_id = $1 LIMIT 1', [schoolIds[0]]);
    if (!hwExists) {
        await run('INSERT INTO homework (school_id, class_id, subject_id, teacher_id, title, description, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [schoolIds[0], jss1aId, subjectIds['0_Mathematics'], teacherIds['chidi@greenfield.edu.ng'],
             'Algebra Practice Set 1', 'Solve equations 1-20 from textbook page 45', '2026-04-01']);
        await run('INSERT INTO homework (school_id, class_id, subject_id, teacher_id, title, description, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [schoolIds[0], jss1aId, subjectIds['0_English Language'], teacherIds['amina@greenfield.edu.ng'],
             'Essay: My Best Holiday', 'Write a 300-word essay about your best holiday experience.', '2026-03-28']);
    }
    console.log('✅ Sample homework seeded');

    console.log('\n🎉 Seeding complete! All test accounts use password: password123');
    console.log('\n📋 Test Accounts:');
    console.log('   SuperAdmin:      admin@eduman.local');
    console.log('   SchoolAdmin A:   adebayo@greenfield.edu.ng');
    console.log('   SchoolAdmin B:   okonkwo@sunrise.edu.ng');
    console.log('   Teacher (Math):  chidi@greenfield.edu.ng');
    console.log('   Teacher (Eng):   amina@greenfield.edu.ng');
    console.log('   Student A:       femi@student.greenfield.edu.ng');
    console.log('   Student B:       joy@student.greenfield.edu.ng');
    console.log('   Parent:          chief.adesola@gmail.com');
    console.log('   Content Mgr:     ibrahim@eduman.local');
    console.log('   Accountant:      fashola@greenfield.edu.ng');
    console.log('   Support:         emeka@eduman.local');

    await pool.end();
}

seed().catch(err => {
    console.error('Seed error:', err);
    pool.end();
    process.exit(1);
});
