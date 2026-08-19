-- Migration 008: Schemes of Work (Per Subject)

CREATE TABLE IF NOT EXISTS schemes_of_work (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL,
    term_id INTEGER REFERENCES academic_terms(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    ai_review JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheme_of_work_weeks (
    id SERIAL PRIMARY KEY,
    scheme_id INTEGER NOT NULL REFERENCES schemes_of_work(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    topic TEXT NOT NULL,
    sub_topics TEXT,
    learning_objectives TEXT,
    activities_and_resources TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schemes_subject_class ON schemes_of_work(school_id, subject_id, class_id);
CREATE INDEX IF NOT EXISTS idx_schemes_teacher ON schemes_of_work(teacher_id);
CREATE INDEX IF NOT EXISTS idx_scheme_weeks ON scheme_of_work_weeks(scheme_id, week_number);
