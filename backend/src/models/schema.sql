-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('SuperAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Parent', 'ContentManager', 'Accountant', 'SupportOfficer')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schools (Multi-Tenant Identifier)
CREATE TABLE IF NOT EXISTS schools (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    current_session_id INTEGER,
    current_term_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- School Admin Assignments
CREATE TABLE IF NOT EXISTS school_admin_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Academic Sessions
CREATE TABLE IF NOT EXISTS academic_sessions (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    is_active INTEGER DEFAULT 0,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Academic Terms
CREATE TABLE IF NOT EXISTS academic_terms (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY(session_id) REFERENCES academic_sessions(id) ON DELETE CASCADE
);

-- Classes
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    level INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Teachers
CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Students
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    user_id INTEGER, -- Optional if students log in
    school_id INTEGER NOT NULL,
    admission_number TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT,
    dob DATE,
    class_id INTEGER,
    parent_name TEXT,
    parent_phone TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE SET NULL
);

-- Parent-Student Links
CREATE TABLE IF NOT EXISTS parent_student_links (
    id SERIAL PRIMARY KEY,
    parent_user_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    FOREIGN KEY(parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Teacher-Subject Assignments (who teaches what in which class)
CREATE TABLE IF NOT EXISTS teacher_subject_assignments (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Class-Subject Mappings (which subjects are taught in which class)
CREATE TABLE IF NOT EXISTS class_subjects (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Teacher-Class Assignments (which classes a teacher is responsible for)
CREATE TABLE IF NOT EXISTS teacher_classes (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    recorded_by INTEGER,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Assessments (Grades)
CREATE TABLE IF NOT EXISTS assessments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    term_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'test', 'exam', 'assignment'
    score REAL,
    max_score REAL,
    recorded_by INTEGER,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY(term_id) REFERENCES academic_terms(id) ON DELETE CASCADE,
    FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Homework
CREATE TABLE IF NOT EXISTS homework (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    file_path TEXT,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- Homework Submissions
CREATE TABLE IF NOT EXISTS homework_submissions (
    id SERIAL PRIMARY KEY,
    homework_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    text_answer TEXT,
    file_path TEXT,
    status TEXT DEFAULT 'pending',
    grade REAL,
    FOREIGN KEY(homework_id) REFERENCES homework(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Learning Contents (Library)
CREATE TABLE IF NOT EXISTS learning_contents (
    id SERIAL PRIMARY KEY,
    school_id INTEGER, -- Nullable for global content manager uploads
    class_id INTEGER,  -- Nullable for all-class general
    subject_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- 'video', 'pdf', 'document'
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    uploaded_by INTEGER,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    duration_minutes INTEGER,
    FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- Quiz Questions
CREATE TABLE IF NOT EXISTS quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    options TEXT NOT NULL, -- JSON array of strings
    correct_option_index INTEGER NOT NULL,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- Quiz Attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    score REAL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Assignment Submissions (for file-based submissions via submissionRoutes)
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assignment_id) REFERENCES homework(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Clean up any duplicates before applying unique constraints
DELETE FROM teacher_subject_assignments
WHERE id NOT IN (
    SELECT MIN(id)
    FROM teacher_subject_assignments
    GROUP BY teacher_id, class_id, subject_id
);

DELETE FROM teacher_classes
WHERE id NOT IN (
    SELECT MIN(id)
    FROM teacher_classes
    GROUP BY teacher_id, class_id, school_id
);

-- Unique constraints (required for ON CONFLICT DO NOTHING in PostgreSQL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_tsa_teacher_class_subject
    ON teacher_subject_assignments (teacher_id, class_id, subject_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tc_teacher_class_school
    ON teacher_classes (teacher_id, class_id, school_id);
