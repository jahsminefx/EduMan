/**
 * Seed Script: Bright Future Academy (info@brightfutureacademy.edu.ng)
 * Populates Bright Future Academy and all associated roles on PostgreSQL.
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

function createConfiguredPool() {
    if (!connectionString) {
        throw new Error('DATABASE_URL not set. Check your environment variables.');
    }
    return new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' || connectionString.includes('sslmode=require') 
            ? { rejectUnauthorized: false } 
            : false
    });
}

async function runSeed() {
    const pool = createConfiguredPool();
    const get = async (text, params) => {
        const res = await pool.query(text, params);
        return res.rows[0];
    };
    const all = async (text, params) => {
        const res = await pool.query(text, params);
        return res.rows;
    };
    const run = async (text, params) => {
        const res = await pool.query(text, params);
        return { lastID: res.rows[0]?.id || null, changes: res.rowCount };
    };

    const hash = await bcrypt.hash('password123', 10);
    console.log('🌱 Seeding Bright Future Academy (info@brightfutureacademy.edu.ng)...\n');

    try {
        // ──────────────────────────────────────
        // 1. SCHOOL RECORD
        // ──────────────────────────────────────
        let school = await get('SELECT id FROM schools WHERE email = $1 OR name = $2', 
            ['info@brightfutureacademy.edu.ng', 'Bright Future Academy']);
        
        let schoolId;
        if (school) {
            schoolId = school.id;
            await run(`UPDATE schools SET name = $1, address = $2, phone = $3, email = $4, is_active = 1, status = 'ACTIVE' WHERE id = $5`,
                ['Bright Future Academy', 'Plot 14 Victoria Island, Lagos', '08034567890', 'info@brightfutureacademy.edu.ng', schoolId]);
            console.log(`✅ Bright Future Academy school record updated (ID: ${schoolId})`);
        } else {
            const r = await run(`INSERT INTO schools (name, address, phone, email, is_active, status) VALUES ($1, $2, $3, $4, 1, 'ACTIVE') RETURNING id`,
                ['Bright Future Academy', 'Plot 14 Victoria Island, Lagos', '08034567890', 'info@brightfutureacademy.edu.ng']);
            schoolId = r.lastID;
            console.log(`✅ Bright Future Academy created (ID: ${schoolId})`);
        }

        // ──────────────────────────────────────
        // 2. ACADEMIC SESSIONS & TERMS
        // ──────────────────────────────────────
        let session = await get('SELECT id FROM academic_sessions WHERE school_id = $1 AND name = $2', [schoolId, '2025/2026']);
        let sessionId;
        if (!session) {
            const sRes = await run('INSERT INTO academic_sessions (school_id, name, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, 1) RETURNING id',
                [schoolId, '2025/2026', '2025-09-01', '2026-07-15']);
            sessionId = sRes.lastID;
        } else {
            sessionId = session.id;
        }

        let terms = await all('SELECT id, name FROM academic_terms WHERE school_id = $1 AND session_id = $2', [schoolId, sessionId]);
        let termIds = {};
        if (terms.length === 0) {
            const t1 = await run('INSERT INTO academic_terms (school_id, session_id, name, is_active) VALUES ($1, $2, $3, 1) RETURNING id', [schoolId, sessionId, 'First Term']);
            const t2 = await run('INSERT INTO academic_terms (school_id, session_id, name, is_active) VALUES ($1, $2, $3, 0) RETURNING id', [schoolId, sessionId, 'Second Term']);
            const t3 = await run('INSERT INTO academic_terms (school_id, session_id, name, is_active) VALUES ($1, $2, $3, 0) RETURNING id', [schoolId, sessionId, 'Third Term']);
            termIds['First Term'] = t1.lastID;
            termIds['Second Term'] = t2.lastID;
            termIds['Third Term'] = t3.lastID;
        } else {
            terms.forEach(t => { termIds[t.name] = t.id; });
        }
        console.log('✅ Academic sessions and terms configured');

        // ──────────────────────────────────────
        // 3. USERS (ADMIN, TEACHERS, ACCOUNTANT, STUDENTS, PARENTS)
        // ──────────────────────────────────────
        const userDefs = [
            // School Admin
            { name: 'Dr. Olumide Johnson', email: 'admin@brightfutureacademy.edu.ng', role: 'SchoolAdmin' },
            { name: 'Bright Future Academy Admin', email: 'info@brightfutureacademy.edu.ng', role: 'SchoolAdmin' },
            // Teachers
            { name: 'Mr. Emeka Nwosu', email: 'nwosu@brightfutureacademy.edu.ng', role: 'Teacher', phone: '08011223344', first: 'Emeka', last: 'Nwosu' },
            { name: 'Mrs. Zainab Aliyu', email: 'aliyu@brightfutureacademy.edu.ng', role: 'Teacher', phone: '08022334455', first: 'Zainab', last: 'Aliyu' },
            { name: 'Mr. Kayode Williams', email: 'williams@brightfutureacademy.edu.ng', role: 'Teacher', phone: '08033445566', first: 'Kayode', last: 'Williams' },
            // Accountant
            { name: 'Mr. Babatunde Lawal', email: 'lawal@brightfutureacademy.edu.ng', role: 'Accountant' },
            // Students
            { name: 'David Johnson', email: 'david@student.brightfutureacademy.edu.ng', role: 'Student' },
            { name: 'Grace Williams', email: 'grace@student.brightfutureacademy.edu.ng', role: 'Student' },
            { name: 'Samuel Okon', email: 'samuel@student.brightfutureacademy.edu.ng', role: 'Student' },
            { name: 'Blessing Adeleke', email: 'blessing@student.brightfutureacademy.edu.ng', role: 'Student' },
            // Parents
            { name: 'Mr. & Mrs. Johnson', email: 'parent.johnson@gmail.com', role: 'Parent' },
            { name: 'Mrs. Funke Williams', email: 'parent.williams@gmail.com', role: 'Parent' },
        ];

        const userMap = {};
        for (const u of userDefs) {
            const existing = await get('SELECT id FROM users WHERE email = $1', [u.email]);
            if (existing) {
                userMap[u.email] = existing.id;
                await run('UPDATE users SET name = $1, password_hash = $2, role = $3, is_active = 1 WHERE id = $4',
                    [u.name, hash, u.role, existing.id]);
            } else {
                const r = await run('INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, 1) RETURNING id',
                    [u.name, u.email, hash, u.role]);
                userMap[u.email] = r.lastID;
            }
        }
        console.log(`✅ ${Object.keys(userMap).length} user accounts ready (Password: password123)`);

        // ──────────────────────────────────────
        // 4. SCHOOL ADMIN ASSIGNMENTS
        // ──────────────────────────────────────
        for (const email of ['admin@brightfutureacademy.edu.ng', 'info@brightfutureacademy.edu.ng']) {
            const uid = userMap[email];
            const exists = await get('SELECT id FROM school_admin_assignments WHERE user_id = $1 AND school_id = $2', [uid, schoolId]);
            if (!exists) {
                await run('INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)', [uid, schoolId]);
            }
        }

        // ──────────────────────────────────────
        // 5. CLASSES
        // ──────────────────────────────────────
        const classes = [
            { name: 'JSS 1A', level: 1 },
            { name: 'JSS 2A', level: 2 },
            { name: 'JSS 3A', level: 3 },
            { name: 'SS 1 Science', level: 4 },
            { name: 'SS 2 Science', level: 5 },
            { name: 'SS 3 Science', level: 6 },
        ];
        const classIds = {};
        for (const c of classes) {
            const existing = await get('SELECT id FROM classes WHERE school_id = $1 AND name = $2', [schoolId, c.name]);
            if (existing) {
                classIds[c.name] = existing.id;
            } else {
                const r = await run('INSERT INTO classes (school_id, name, level) VALUES ($1, $2, $3) RETURNING id', [schoolId, c.name, c.level]);
                classIds[c.name] = r.lastID;
            }
        }
        console.log(`✅ ${Object.keys(classIds).length} classes created`);

        // ──────────────────────────────────────
        // 6. SUBJECTS
        // ──────────────────────────────────────
        const subjects = [
            { name: 'Mathematics', code: 'MTH' },
            { name: 'English Language', code: 'ENG' },
            { name: 'Basic Science', code: 'BSC' },
            { name: 'Biology', code: 'BIO' },
            { name: 'Chemistry', code: 'CHM' },
            { name: 'Physics', code: 'PHY' },
            { name: 'Civic Education', code: 'CVE' },
            { name: 'Agricultural Science', code: 'AGR' },
            { name: 'Economics', code: 'ECN' },
        ];
        const subjectIds = {};
        for (const s of subjects) {
            const existing = await get('SELECT id FROM subjects WHERE school_id = $1 AND name = $2', [schoolId, s.name]);
            if (existing) {
                subjectIds[s.name] = existing.id;
            } else {
                const r = await run('INSERT INTO subjects (school_id, name, code) VALUES ($1, $2, $3) RETURNING id', [schoolId, s.name, s.code]);
                subjectIds[s.name] = r.lastID;
            }
        }
        console.log(`✅ ${Object.keys(subjectIds).length} subjects created`);

        // ──────────────────────────────────────
        // 7. TEACHER PROFILES
        // ──────────────────────────────────────
        const teacherProfiles = [
            { email: 'nwosu@brightfutureacademy.edu.ng', first: 'Emeka', last: 'Nwosu', phone: '08011223344' },
            { email: 'aliyu@brightfutureacademy.edu.ng', first: 'Zainab', last: 'Aliyu', phone: '08022334455' },
            { email: 'williams@brightfutureacademy.edu.ng', first: 'Kayode', last: 'Williams', phone: '08033445566' },
        ];
        const teacherIds = {};
        for (const t of teacherProfiles) {
            const uid = userMap[t.email];
            const existing = await get('SELECT id FROM teachers WHERE user_id = $1', [uid]);
            if (existing) {
                teacherIds[t.email] = existing.id;
            } else {
                const r = await run('INSERT INTO teachers (user_id, school_id, first_name, last_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    [uid, schoolId, t.first, t.last, t.phone]);
                teacherIds[t.email] = r.lastID;
            }
        }
        console.log(`✅ ${Object.keys(teacherIds).length} teacher profiles created`);

        // ──────────────────────────────────────
        // 8. TEACHER ASSIGNMENTS
        // ──────────────────────────────────────
        const assignments = [
            { teacher: 'nwosu@brightfutureacademy.edu.ng', class: 'JSS 1A', subject: 'Mathematics' },
            { teacher: 'nwosu@brightfutureacademy.edu.ng', class: 'JSS 2A', subject: 'Mathematics' },
            { teacher: 'nwosu@brightfutureacademy.edu.ng', class: 'SS 1 Science', subject: 'Physics' },
            { teacher: 'aliyu@brightfutureacademy.edu.ng', class: 'JSS 1A', subject: 'English Language' },
            { teacher: 'aliyu@brightfutureacademy.edu.ng', class: 'JSS 2A', subject: 'English Language' },
            { teacher: 'aliyu@brightfutureacademy.edu.ng', class: 'SS 1 Science', subject: 'Civic Education' },
            { teacher: 'williams@brightfutureacademy.edu.ng', class: 'JSS 1A', subject: 'Basic Science' },
            { teacher: 'williams@brightfutureacademy.edu.ng', class: 'SS 1 Science', subject: 'Biology' },
            { teacher: 'williams@brightfutureacademy.edu.ng', class: 'SS 1 Science', subject: 'Chemistry' },
        ];
        for (const a of assignments) {
            const tid = teacherIds[a.teacher];
            const cid = classIds[a.class];
            const sid = subjectIds[a.subject];
            const exists = await get('SELECT id FROM teacher_subject_assignments WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3',
                [tid, cid, sid]);
            if (!exists) {
                await run('INSERT INTO teacher_subject_assignments (teacher_id, class_id, subject_id) VALUES ($1, $2, $3)', [tid, cid, sid]);
            }
        }
        console.log('✅ Teacher assignments linked');

        // Form Teachers
        await run('UPDATE classes SET form_teacher_id = $1 WHERE id = $2', [teacherIds['nwosu@brightfutureacademy.edu.ng'], classIds['JSS 1A']]);
        await run('UPDATE classes SET form_teacher_id = $1 WHERE id = $2', [teacherIds['aliyu@brightfutureacademy.edu.ng'], classIds['JSS 2A']]);
        await run('UPDATE classes SET form_teacher_id = $1 WHERE id = $2', [teacherIds['williams@brightfutureacademy.edu.ng'], classIds['SS 1 Science']]);

        // ──────────────────────────────────────
        // 9. STUDENTS
        // ──────────────────────────────────────
        const students = [
            { email: 'david@student.brightfutureacademy.edu.ng', first: 'David', last: 'Johnson', adm: 'BFA-2025-001', gender: 'Male', dob: '2012-04-10', class: 'JSS 1A' },
            { email: 'grace@student.brightfutureacademy.edu.ng', first: 'Grace', last: 'Williams', adm: 'BFA-2025-002', gender: 'Female', dob: '2012-08-15', class: 'JSS 1A' },
            { email: 'samuel@student.brightfutureacademy.edu.ng', first: 'Samuel', last: 'Okon', adm: 'BFA-2025-003', gender: 'Male', dob: '2011-12-01', class: 'JSS 2A' },
            { email: 'blessing@student.brightfutureacademy.edu.ng', first: 'Blessing', last: 'Adeleke', adm: 'BFA-2025-004', gender: 'Female', dob: '2009-05-22', class: 'SS 1 Science' },
        ];
        const studentIds = {};
        for (const s of students) {
            const uid = userMap[s.email];
            const cid = classIds[s.class];
            const existing = await get('SELECT id FROM students WHERE admission_number = $1 AND school_id = $2', [s.adm, schoolId]);
            if (existing) {
                studentIds[s.email] = existing.id;
            } else {
                const r = await run(`INSERT INTO students (user_id, school_id, admission_number, first_name, last_name, gender, dob, class_id)
                                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                    [uid, schoolId, s.adm, s.first, s.last, s.gender, s.dob, cid]);
                studentIds[s.email] = r.lastID;
            }
        }
        console.log(`✅ ${Object.keys(studentIds).length} students enrolled`);

        // ──────────────────────────────────────
        // 10. PARENT-STUDENT LINKS
        // ──────────────────────────────────────
        const pLinks = [
            { parent: 'parent.johnson@gmail.com', student: 'david@student.brightfutureacademy.edu.ng' },
            { parent: 'parent.williams@gmail.com', student: 'grace@student.brightfutureacademy.edu.ng' },
        ];
        for (const pl of pLinks) {
            const pid = userMap[pl.parent];
            const sid = studentIds[pl.student];
            const exists = await get('SELECT id FROM parent_student_links WHERE parent_user_id = $1 AND student_id = $2', [pid, sid]);
            if (!exists) {
                await run('INSERT INTO parent_student_links (parent_user_id, student_id) VALUES ($1, $2)', [pid, sid]);
            }
        }
        console.log('✅ Parent-student connections linked');

        // ──────────────────────────────────────
        // 11. TIMETABLE
        // ──────────────────────────────────────
        const jss1Id = classIds['JSS 1A'];
        const sampleTimetable = [
            { day: 'Monday', start: '08:00', end: '09:00', subject: 'Mathematics', room: 'Room 101' },
            { day: 'Monday', start: '09:00', end: '10:00', subject: 'English Language', room: 'Room 101' },
            { day: 'Tuesday', start: '08:00', end: '09:00', subject: 'Basic Science', room: 'Science Lab 1' },
            { day: 'Wednesday', start: '10:30', end: '11:30', subject: 'Mathematics', room: 'Room 101' },
            { day: 'Thursday', start: '08:00', end: '09:00', subject: 'English Language', room: 'Room 101' },
            { day: 'Friday', start: '09:00', end: '10:00', subject: 'Civic Education', room: 'Room 101' },
        ];
        for (const tt of sampleTimetable) {
            const exists = await get('SELECT id FROM timetables WHERE school_id = $1 AND class_id = $2 AND day_of_week = $3 AND start_time = $4',
                [schoolId, jss1Id, tt.day, tt.start]);
            if (!exists) {
                await run('INSERT INTO timetables (school_id, class_id, day_of_week, start_time, end_time, subject, room) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [schoolId, jss1Id, tt.day, tt.start, tt.end, tt.subject, tt.room]);
            }
        }
        console.log('✅ Class timetable slots added');

        // ──────────────────────────────────────
        // 12. SAMPLE SCHEME OF WORK
        // ──────────────────────────────────────
        const mathSubjectId = subjectIds['Mathematics'];
        const nwosuTeacherId = teacherIds['nwosu@brightfutureacademy.edu.ng'];
        const firstTermId = termIds['First Term'];

        const existingScheme = await get('SELECT id FROM schemes_of_work WHERE school_id = $1 AND class_id = $2 AND subject_id = $3',
            [schoolId, jss1Id, mathSubjectId]);
        
        let schemeId;
        if (!existingScheme) {
            const schRes = await run(
                `INSERT INTO schemes_of_work 
                    (school_id, teacher_id, class_id, subject_id, academic_session_id, term_id, title, description, status, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 RETURNING id`,
                [
                    schoolId,
                    nwosuTeacherId,
                    jss1Id,
                    mathSubjectId,
                    sessionId,
                    firstTermId,
                    'JSS 1 Mathematics Scheme of Work (1st Term)',
                    'Official weekly Mathematics syllabus covering whole numbers, fractions, decimals, and basic algebra.'
                ]
            );
            schemeId = schRes.lastID;

            const mathWeeks = [
                { num: 1, topic: 'Whole Numbers & Place Value', sub: 'Counting, notation, Roman numerals', obj: 'Write numbers up to millions, convert Roman numerals.', res: 'New General Mathematics Bk 1, Ch 1' },
                { num: 2, topic: 'Fractions: Types and Conversions', sub: 'Proper, improper fractions, mixed numbers', obj: 'Classify fractions and convert between mixed and improper.', res: 'Fraction wall charts, Textbook Ch 2' },
                { num: 3, topic: 'Operations on Fractions', sub: 'Addition and subtraction with LCM', obj: 'Solve addition and subtraction of unlike fractions.', res: 'Worked examples, Practice worksheet 3' },
                { num: 4, topic: 'Multiplication & Division of Fractions', sub: 'Reciprocals, word problems', obj: 'Multiply fractions and solve real-life sharing problems.', res: 'Textbook Ch 4' },
                { num: 5, topic: 'Decimals & Percentages', sub: 'Conversion between fractions, decimals, and percentages', obj: 'Convert decimals to percentages and vice versa.', res: 'Grid charts, Textbook Ch 5' },
                { num: 6, topic: 'Mid-Term Review & Continuous Assessment Test', sub: 'Revision of Weeks 1 to 5', obj: 'Assess student mastery and identify areas needing support.', res: 'Assessment test paper 1' },
                { num: 7, topic: 'Basic Algebraic Expressions', sub: 'Variables, coefficients, simplifying like terms', obj: 'Identify terms and simplify basic algebraic expressions.', res: 'Algebra tiles, Textbook Ch 6' },
                { num: 8, topic: 'Linear Equations in One Variable', sub: 'Solving simple one-step and two-step equations', obj: 'Solve equations like 2x + 4 = 10.', res: 'Balance scale demonstration, Textbook Ch 7' },
                { num: 9, topic: 'Plane Geometry: Angles & Lines', sub: 'Acute, obtuse, right angles, angles on a straight line', obj: 'Measure angles with a protractor and calculate missing angles.', res: 'Protractors, geometric sets' },
                { num: 10, topic: 'Perimeter and Area of Plane Shapes', sub: 'Rectangles, squares, and triangles', obj: 'Calculate perimeter and area using standard formulas.', res: 'Shape cutouts, Textbook Ch 9' },
                { num: 11, topic: 'General Term Revision', sub: 'Comprehensive review across all topics', obj: 'Consolidate term curriculum in preparation for examinations.', res: 'Past questions and revision guide' },
                { num: 12, topic: 'First Term Examinations', sub: 'End of term assessment', obj: 'Evaluate overall terminal academic performance.', res: 'Examination papers' }
            ];

            for (const w of mathWeeks) {
                await run(
                    `INSERT INTO scheme_of_work_weeks 
                        (scheme_id, week_number, topic, sub_topics, learning_objectives, activities_and_resources, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [schemeId, w.num, w.topic, w.sub, w.obj, w.res]
                );
            }
            console.log('✅ JSS 1 Mathematics Scheme of Work published (12 Weeks)');
        }

        // ──────────────────────────────────────
        // 13. SAMPLE ANNOUNCEMENTS
        // ──────────────────────────────────────
        const existingAnn = await get('SELECT id FROM announcements WHERE school_id = $1', [schoolId]);
        if (!existingAnn) {
            await run(`INSERT INTO announcements (school_id, author_id, title, content, status, published_at)
                       VALUES ($1, $2, $3, $4, 'Published', CURRENT_TIMESTAMP)`,
                [
                    schoolId,
                    userMap['admin@brightfutureacademy.edu.ng'],
                    'Welcome to the 2025/2026 Academic Session!',
                    'Bright Future Academy warmly welcomes all new and returning students, parents, and teachers to a productive new academic session.'
                ]);
            console.log('✅ Welcome announcement published');
        }

        console.log('\n🎉 Bright Future Academy (info@brightfutureacademy.edu.ng) seeded successfully!\n');
        console.log('================================================================');
        console.log('📋 LOGIN CREDENTIALS (All passwords: password123)');
        console.log('----------------------------------------------------------------');
        console.log('• School Admin:  admin@brightfutureacademy.edu.ng');
        console.log('• School Email:  info@brightfutureacademy.edu.ng');
        console.log('• Teacher (Math): nwosu@brightfutureacademy.edu.ng');
        console.log('• Teacher (Eng):  aliyu@brightfutureacademy.edu.ng');
        console.log('• Teacher (Sci):  williams@brightfutureacademy.edu.ng');
        console.log('• Accountant:     lawal@brightfutureacademy.edu.ng');
        console.log('• Student 1:      david@student.brightfutureacademy.edu.ng');
        console.log('• Student 2:      grace@student.brightfutureacademy.edu.ng');
        console.log('• Parent 1:       parent.johnson@gmail.com');
        console.log('• Parent 2:       parent.williams@gmail.com');
        console.log('================================================================\n');

        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ SEEDING FAILED:', err);
        await pool.end().catch(() => {});
        process.exit(1);
    }
}

runSeed();
