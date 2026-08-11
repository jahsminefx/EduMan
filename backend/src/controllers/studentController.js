const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail } = require('../services/notificationService');

const VALID_GENDERS = new Set(['Male', 'Female', 'Other']);

function normalizeGender(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'm' || raw === 'male') return 'Male';
    if (raw === 'f' || raw === 'female') return 'Female';
    if (raw === 'other') return 'Other';
    return '';
}

function cleanString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];

        if (char === '"' && inQuotes && next === '"') {
            current += '"';
            index += 1;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current.trim());
    return values;
}

function parseCsv(buffer) {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        return { headers: [], rows: [] };
    }

    const headers = parseCsvLine(lines[0]);
    const rows = lines.slice(1).map((line, index) => {
        const values = parseCsvLine(line);
        return headers.reduce((row, header, headerIndex) => {
            row[header] = values[headerIndex] || '';
            return row;
        }, { __rowNumber: index + 2 });
    });

    return { headers, rows };
}

function splitName(fullName) {
    const parts = cleanString(fullName).split(/\s+/).filter(Boolean);
    return {
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || ''
    };
}

exports.getStudents = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        if (req.user.role === 'Student') {
            const student = await db.get(`
                SELECT s.*, c.name as class_name, c.level as class_level
                FROM students s
                LEFT JOIN classes c ON s.class_id = c.id
                WHERE s.user_id = $1 AND s.school_id = $2
            `, [req.user.id, school_id]);
            return res.json({ students: student ? [student] : [] });
        }

        const students = await db.all(`
            SELECT s.*, c.name as class_name, c.level as class_level
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.school_id = $1
            ORDER BY s.last_name ASC
        `, [school_id]);
        res.json({ students });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getMyStudentProfile = async (req, res) => {
    try {
        const db = getDB();
        const student = await db.get(`
            SELECT s.*, c.name as class_name, c.level as class_level
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.user_id = $1 AND s.school_id = $2
        `, [req.user.id, req.user.school_id]);

        if (!student) {
            return res.status(404).json({ error: 'Not Found', message: 'Student profile not found.' });
        }

        res.json({ student });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createStudent = async (req, res) => {
    const { admission_number, first_name, last_name, gender, age, dob, class_id, parent_name, parent_phone, email, password } = req.body;
    
    try {
        const db = getDB();
        
        const normalizedGender = normalizeGender(gender);
        if (!admission_number || !first_name || !last_name || !email || !password) {
            return res.status(400).json({ error: 'Validation Error', message: 'Missing required fields (admission_number, name, email, password)' });
        }
        if (!VALID_GENDERS.has(normalizedGender)) {
            return res.status(400).json({ error: 'Validation Error', message: 'Please select a valid gender.' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Validation Error', message: 'Please enter a valid email address.' });
        }

        const school_id = req.user.school_id;
        const existingAdmission = await db.get(
            'SELECT id FROM students WHERE school_id = $1 AND LOWER(admission_number) = LOWER($2)',
            [school_id, admission_number]
        );
        if (existingAdmission) {
            return res.status(400).json({ error: 'Duplicate', message: 'Admission number already exists.' });
        }

        const existingEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        if (existingEmail) {
            return res.status(400).json({ error: 'Duplicate', message: 'Email already exists.' });
        }

        const result = await db.transaction(async (client) => {
            // 1. Create User record for login
            const password_hash = await bcrypt.hash(password, 10);
            const userResult = await client.run(
                `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id`,
                [`${first_name} ${last_name}`, email, password_hash, 'Student']
            );
            const user_id = userResult.lastID;

            // 2. Create Student record linked to User
            const studentResult = await client.run(
                `INSERT INTO students (user_id, school_id, admission_number, first_name, last_name, gender, age, dob, class_id, parent_name, parent_phone) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
                [user_id, school_id, admission_number, first_name, last_name, normalizedGender, age || null, dob || null, class_id || null, parent_name, parent_phone]
            );

            return { student_id: studentResult.lastID, user_id };
        });

        // Send welcome email with credentials
        const schoolObj = await db.get('SELECT name FROM schools WHERE id = $1', [school_id]);
        sendWelcomeEmail({
            email,
            name: `${first_name} ${last_name}`,
            role: 'Student',
            schoolName: schoolObj?.name || 'EduMan School',
            password
        });

        res.json({ 
            message: 'Student and login account created successfully', 
            id: result.student_id,
            user_id: result.user_id
        });
    } catch (err) {
        // PostgreSQL unique violation error code
        if (err.code === '23505') {
            const field = err.detail && err.detail.includes('email') ? 'Email' : 'Admission number';
            return res.status(400).json({ error: 'Duplicate', message: `${field} already exists.` });
        }
        console.error('Create student error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.updateStudent = async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, gender, age, dob, class_id, parent_name, parent_phone } = req.body;
    
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const normalizedGender = normalizeGender(gender);
        if (!VALID_GENDERS.has(normalizedGender)) {
            return res.status(400).json({ error: 'Validation Error', message: 'Please select a valid gender.' });
        }
        await db.run(
            `UPDATE students 
             SET first_name=$1, last_name=$2, gender=$3, age=$4, dob=$5, class_id=$6, parent_name=$7, parent_phone=$8 
             WHERE id=$9 AND school_id=$10`,
            [first_name, last_name, normalizedGender, age || null, dob || null, class_id || null, parent_name, parent_phone, id, school_id]
        );
        res.json({ message: 'Student updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.bulkUploadStudents = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Validation Error', message: 'Please upload a CSV file.' });
    }

    const originalName = req.file.originalname || '';
    if (!originalName.toLowerCase().endsWith('.csv') && req.file.mimetype !== 'text/csv') {
        return res.status(400).json({ error: 'Validation Error', message: 'Only CSV files are supported.' });
    }

    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const requiredHeaders = ['studentId', 'name', 'email', 'gender', 'class', 'age', 'guardianName', 'guardianPhone'];
        const { headers, rows } = parseCsv(req.file.buffer);
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));

        if (missingHeaders.length > 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: `Missing required CSV columns: ${missingHeaders.join(', ')}.`
            });
        }

        const classes = await db.all('SELECT id, name FROM classes WHERE school_id = $1', [school_id]);
        const classMap = new Map(classes.map(item => [item.name.toLowerCase(), item]));
        const rowErrors = [];
        const seenStudentIds = new Map();
        const seenEmails = new Map();
        const normalizedRows = [];

        for (const row of rows) {
            const rowNumber = row.__rowNumber;
            const studentId = cleanString(row.studentId);
            const fullName = cleanString(row.name);
            const email = cleanString(row.email).toLowerCase();
            const gender = normalizeGender(row.gender);
            const className = cleanString(row.class);
            const age = Number(cleanString(row.age));
            const guardianName = cleanString(row.guardianName);
            const guardianPhone = cleanString(row.guardianPhone);

            if (!studentId || !fullName || !email || !gender || !className || !row.age || !guardianName || !guardianPhone) {
                rowErrors.push(`Row ${rowNumber}: studentId, name, email, gender, class, age, guardianName, and guardianPhone are required.`);
                continue;
            }

            if (!VALID_GENDERS.has(gender)) {
                rowErrors.push(`Row ${rowNumber}: gender must be Male, Female, or Other.`);
            }

            if (!isValidEmail(email)) {
                rowErrors.push(`Row ${rowNumber}: email is invalid.`);
            }

            if (!Number.isInteger(age) || age < 1 || age > 120) {
                rowErrors.push(`Row ${rowNumber}: age must be a whole number between 1 and 120.`);
            }

            const classRecord = classMap.get(className.toLowerCase());
            if (!classRecord) {
                rowErrors.push(`Row ${rowNumber}: class "${className}" does not exist.`);
            }

            const studentKey = studentId.toLowerCase();
            if (seenStudentIds.has(studentKey)) {
                rowErrors.push(`Row ${rowNumber}: duplicate studentId also appears on row ${seenStudentIds.get(studentKey)}.`);
            } else {
                seenStudentIds.set(studentKey, rowNumber);
            }

            if (seenEmails.has(email)) {
                rowErrors.push(`Row ${rowNumber}: duplicate email also appears on row ${seenEmails.get(email)}.`);
            } else {
                seenEmails.set(email, rowNumber);
            }

            const { first_name, last_name } = splitName(fullName);
            normalizedRows.push({
                rowNumber,
                admission_number: studentId,
                first_name,
                last_name,
                email,
                gender,
                class_id: classRecord?.id,
                age,
                parent_name: guardianName,
                parent_phone: guardianPhone,
                password: `${studentId}@123`
            });
        }

        if (normalizedRows.length === 0 && rowErrors.length === 0) {
            rowErrors.push('The CSV file does not contain student rows.');
        }

        if (normalizedRows.length > 0) {
            const ids = normalizedRows.map(row => row.admission_number.toLowerCase());
            const emails = normalizedRows.map(row => row.email.toLowerCase());
            const idPlaceholders = ids.map((_, index) => `$${index + 2}`).join(', ');
            const emailPlaceholders = emails.map((_, index) => `$${index + 1}`).join(', ');

            const existingIds = await db.all(
                `SELECT admission_number FROM students WHERE school_id = $1 AND LOWER(admission_number) IN (${idPlaceholders})`,
                [school_id, ...ids]
            );
            for (const item of existingIds) {
                rowErrors.push(`Student ID "${item.admission_number}" already exists in this school.`);
            }

            const existingEmails = await db.all(
                `SELECT email FROM users WHERE LOWER(email) IN (${emailPlaceholders})`,
                emails
            );
            for (const item of existingEmails) {
                rowErrors.push(`Email "${item.email}" already exists.`);
            }
        }

        if (rowErrors.length > 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'CSV validation failed. Please fix the listed issues and upload again.',
                errors: rowErrors
            });
        }

        await db.transaction(async (client) => {
            for (const row of normalizedRows) {
                const password_hash = await bcrypt.hash(row.password, 10);
                const userResult = await client.run(
                    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
                    [`${row.first_name} ${row.last_name}`.trim(), row.email, password_hash, 'Student']
                );
                await client.run(
                    `INSERT INTO students (user_id, school_id, admission_number, first_name, last_name, gender, age, class_id, parent_name, parent_phone)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        userResult.lastID,
                        school_id,
                        row.admission_number,
                        row.first_name,
                        row.last_name,
                        row.gender,
                        row.age,
                        row.class_id,
                        row.parent_name,
                        row.parent_phone
                    ]
                );
            }
        });

        res.json({
            message: `${normalizedRows.length} student${normalizedRows.length === 1 ? '' : 's'} imported successfully. Default password format is studentId@123.`,
            imported: normalizedRows.length
        });
    } catch (err) {
        console.error('Bulk upload students error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.deleteStudent = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const result = await db.run(`DELETE FROM students WHERE id=$1 AND school_id=$2`, [id, school_id]);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Student not found in your school' });
        }
        
        res.json({ message: 'Student deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
