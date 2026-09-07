const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendWelcomeEmail } = require('../services/notificationService');
const { generateSetupToken, recordInvitationAudit } = require('../utils/tokenUtils');

const VALID_GENDERS = new Set(['Male', 'Female', 'Other']);

function normalizeGender(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'm' || raw === 'male') return 'Male';
    if (raw === 'f' || raw === 'female') return 'Female';
    if (raw === 'o' || raw === 'other') return 'Other';
    return value;
}

function cleanString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const clean = email.trim();
    if (!clean || clean.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
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

exports.searchParents = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const { q = '' } = req.query;
        const searchTerm = `%${q.trim()}%`;

        const parents = await db.all(`
            SELECT DISTINCT u.id, u.name, u.email, s.parent_phone as phone
            FROM users u
            JOIN parent_student_links psl ON u.id = psl.parent_user_id
            JOIN students s ON psl.student_id = s.id
            WHERE s.school_id = $1 AND u.role = 'Parent' AND (u.name ILIKE $2 OR u.email ILIKE $2)
            ORDER BY u.name ASC
            LIMIT 20
        `, [school_id, searchTerm]);

        res.json({ parents });
    } catch (err) {
        console.error('Error searching parents:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to search parents' });
    }
};

exports.createStudent = async (req, res) => {
    const {
        admission_number,
        first_name,
        last_name,
        gender,
        age,
        dob,
        class_id,
        parent_name,
        parent_phone,
        email,
        password,
        parent_action = 'NONE', // CREATE_NEW, LINK_EXISTING, NONE
        parent_email = '',
        parent_relationship = 'Parent',
        parent_user_id = null
    } = req.body;
    
    try {
        const db = getDB();
        
        const normalizedGender = normalizeGender(gender);
        if (!admission_number || !first_name || !last_name) {
            return res.status(400).json({ error: 'Validation Error', message: 'Missing required fields (admission_number, first_name, last_name).' });
        }
        if (!VALID_GENDERS.has(normalizedGender)) {
            return res.status(400).json({ error: 'Validation Error', message: 'Please select a valid gender.' });
        }

        const cleanEmail = email ? String(email).trim().toLowerCase() : '';
        if (cleanEmail && !isValidEmail(cleanEmail)) {
            return res.status(400).json({ error: 'Validation Error', message: 'Please enter a valid email address.' });
        }

        const school_id = req.user.school_id;
        const existingAdmission = await db.get(
            'SELECT id FROM students WHERE school_id = $1 AND LOWER(admission_number) = LOWER($2)',
            [school_id, admission_number]
        );
        if (existingAdmission) {
            return res.status(400).json({ error: 'Duplicate', message: 'Admission number already exists in this school.' });
        }

        if (cleanEmail) {
            const existingEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
            if (existingEmail) {
                return res.status(400).json({ error: 'Duplicate', message: 'Student email already exists.' });
            }
        }

        let createdParentUserId = null;
        let rawParentToken = null;
        let user_id = null;
        let rawStudentToken = null;

        const result = await db.transaction(async (client) => {
            // 1. Create Student User record for login ONLY if email is provided
            if (cleanEmail) {
                const tokenObj = generateSetupToken();
                rawStudentToken = tokenObj.rawToken;
                const password_hash = await bcrypt.hash(password || crypto.randomBytes(16).toString('hex'), 10);
                const userResult = await client.run(
                    `INSERT INTO users (name, email, password_hash, role, setup_token, setup_token_expires) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP + INTERVAL '7 days') RETURNING id`,
                    [`${first_name} ${last_name}`, cleanEmail, password_hash, 'Student', tokenObj.tokenHash]
                );
                user_id = userResult.lastID;
            }

            // 2. Create Student record (user_id will be NULL if no email/account)
            const finalParentName = parent_name || (parent_action === 'CREATE_NEW' ? parent_name : '');
            const finalParentPhone = parent_phone || '';
            const studentResult = await client.run(
                `INSERT INTO students (user_id, school_id, admission_number, first_name, last_name, gender, age, dob, class_id, parent_name, parent_phone) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
                [user_id, school_id, admission_number, first_name, last_name, normalizedGender, age || null, dob || null, class_id || null, finalParentName, finalParentPhone]
            );
            const student_id = studentResult.lastID;

            // 3. Handle Parent Creation / Linking Workflow
            if (parent_action === 'CREATE_NEW' && parent_email && parent_email.trim()) {
                const cleanParentEmail = parent_email.trim().toLowerCase();
                const pName = parent_name ? parent_name.trim() : `Parent of ${first_name}`;
                
                // Check if user already exists
                const existingPUser = await client.get(`SELECT id FROM users WHERE LOWER(email) = $1`, [cleanParentEmail]);
                if (existingPUser) {
                    createdParentUserId = existingPUser.id;
                } else {
                    const parentTokenObj = generateSetupToken();
                    rawParentToken = parentTokenObj.rawToken;
                    const pHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
                    const pUserRes = await client.run(
                        `INSERT INTO users (name, email, password_hash, role, setup_token, setup_token_expires) VALUES ($1, $2, $3, 'Parent', $4, CURRENT_TIMESTAMP + INTERVAL '7 days') RETURNING id`,
                        [pName, cleanParentEmail, pHash, parentTokenObj.tokenHash]
                    );
                    createdParentUserId = pUserRes.lastID;
                }

                // Link to student
                await client.run(
                    `INSERT INTO parent_student_links (parent_user_id, student_id, relationship, is_primary)
                     VALUES ($1, $2, $3, 1) ON CONFLICT DO NOTHING`,
                    [createdParentUserId, student_id, parent_relationship || 'Parent']
                );
            } else if (parent_action === 'LINK_EXISTING' && parent_user_id) {
                // Ensure parent exists and belongs to a student in current school
                const validParent = await client.get(`SELECT id FROM users WHERE id = $1 AND role = 'Parent'`, [parent_user_id]);
                if (validParent) {
                    await client.run(
                        `INSERT INTO parent_student_links (parent_user_id, student_id, relationship, is_primary)
                         VALUES ($1, $2, $3, 1) ON CONFLICT DO NOTHING`,
                        [parent_user_id, student_id, parent_relationship || 'Parent']
                    );
                }
            }

            return { student_id, user_id, parent_user_id: createdParentUserId };
        });

        // Audit Trail
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
        await recordInvitationAudit({
            actorId: req.user?.id,
            action: 'INVITATION_CREATED',
            targetUserId: result.user_id,
            role: 'Student',
            reason: `Created student account for ${first_name} ${last_name}`,
            ipAddress: clientIp
        });

        if (createdParentUserId && rawParentToken) {
            await recordInvitationAudit({
                actorId: req.user?.id,
                action: 'INVITATION_CREATED',
                targetUserId: createdParentUserId,
                role: 'Parent',
                reason: `Created parent account for ${parent_name || 'Parent'}`,
                ipAddress: clientIp
            });
        }

        // Send welcome email with setup_token invitation link using RAW token ONLY if email is provided
        const schoolObj = await db.get('SELECT name FROM schools WHERE id = $1', [school_id]);
        if (cleanEmail && rawStudentToken) {
            sendWelcomeEmail({
                email: cleanEmail,
                name: `${first_name} ${last_name}`,
                role: 'Student',
                schoolName: schoolObj?.name || 'EduMan School',
                token: rawStudentToken
            }).catch(() => {});
        }

        if (rawParentToken && parent_email) {
            sendWelcomeEmail({
                email: parent_email,
                name: parent_name || 'Parent',
                role: 'Parent',
                schoolName: schoolObj?.name || 'EduMan School',
                token: rawParentToken
            }).catch(() => {});
        }

        res.json({ 
            message: 'Student and login account created successfully', 
            id: result.student_id,
            user_id: result.user_id,
            parent_user_id: result.parent_user_id
        });
    } catch (err) {
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
        const requiredHeaders = ['studentId', 'name', 'gender', 'class'];
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
            const age = row.age ? Number(cleanString(row.age)) : null;
            const guardianName = cleanString(row.guardianName);
            const guardianPhone = cleanString(row.guardianPhone);

            if (!studentId || !fullName || !gender || !className) {
                rowErrors.push(`Row ${rowNumber}: studentId, name, gender, and class are required.`);
                continue;
            }

            if (!VALID_GENDERS.has(gender)) {
                rowErrors.push(`Row ${rowNumber}: gender must be Male, Female, or Other.`);
            }

            if (email && !isValidEmail(email)) {
                rowErrors.push(`Row ${rowNumber}: email "${email}" is invalid.`);
            }

            if (age !== null && (!Number.isInteger(age) || age < 1 || age > 120)) {
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

            if (email) {
                if (seenEmails.has(email)) {
                    rowErrors.push(`Row ${rowNumber}: duplicate email also appears on row ${seenEmails.get(email)}.`);
                } else {
                    seenEmails.set(email, rowNumber);
                }
            }

            const { first_name, last_name } = splitName(fullName);
            normalizedRows.push({
                rowNumber,
                admission_number: studentId,
                first_name,
                last_name,
                email: email || '',
                gender,
                class_id: classRecord?.id,
                age,
                parent_name: guardianName || '',
                parent_phone: guardianPhone || '',
                password: `${studentId}@123`
            });
        }

        if (normalizedRows.length === 0 && rowErrors.length === 0) {
            rowErrors.push('The CSV file does not contain student rows.');
        }

        if (normalizedRows.length > 0) {
            const ids = normalizedRows.map(row => row.admission_number.toLowerCase());
            const emails = normalizedRows.map(row => row.email.toLowerCase()).filter(Boolean);
            const idPlaceholders = ids.map((_, index) => `$${index + 2}`).join(', ');

            const existingIds = await db.all(
                `SELECT admission_number FROM students WHERE school_id = $1 AND LOWER(admission_number) IN (${idPlaceholders})`,
                [school_id, ...ids]
            );
            for (const item of existingIds) {
                rowErrors.push(`Student ID "${item.admission_number}" already exists in this school.`);
            }

            if (emails.length > 0) {
                const emailPlaceholders = emails.map((_, index) => `$${index + 1}`).join(', ');
                const existingEmails = await db.all(
                    `SELECT email FROM users WHERE LOWER(email) IN (${emailPlaceholders})`,
                    emails
                );
                for (const item of existingEmails) {
                    rowErrors.push(`Email "${item.email}" already exists.`);
                }
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
                let user_id = null;
                if (row.email) {
                    const password_hash = await bcrypt.hash(row.password, 10);
                    const userResult = await client.run(
                        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
                        [`${row.first_name} ${row.last_name}`.trim(), row.email, password_hash, 'Student']
                    );
                    user_id = userResult.lastID;
                }

                await client.run(
                    `INSERT INTO students (user_id, school_id, admission_number, first_name, last_name, gender, age, class_id, parent_name, parent_phone)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        user_id,
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

// SchoolAdmin: Get all parents associated with the school
exports.getParents = async (req, res) => {
    const school_id = req.user.school_id;
    if (!school_id) {
        return res.status(400).json({ error: 'Bad Request', message: 'User has no associated school' });
    }

    try {
        const db = getDB();
        // Fetch all users with role = 'Parent' linked to students in this school OR registered via invite link
        const parents = await db.all(`
            SELECT DISTINCT 
                u.id, 
                u.name, 
                u.email, 
                u.is_active, 
                u.created_at
            FROM users u
            LEFT JOIN parent_student_links psl ON u.id = psl.parent_user_id
            LEFT JOIN students s ON psl.student_id = s.id
            WHERE u.role = 'Parent'
              AND (
                s.school_id = $1 
                OR u.id IN (
                    SELECT psl2.parent_user_id 
                    FROM parent_student_links psl2 
                    JOIN students s2 ON psl2.student_id = s2.id 
                    WHERE s2.school_id = $1
                )
              )
            ORDER BY u.name ASC
        `, [school_id]);

        // Also fetch all parent-student links for this school to populate children
        const links = await db.all(`
            SELECT 
                psl.id as link_id,
                psl.parent_user_id,
                s.id as student_id,
                s.first_name,
                s.last_name,
                s.admission_number,
                c.name as class_name,
                c.level as class_level
            FROM parent_student_links psl
            JOIN students s ON psl.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.school_id = $1
        `, [school_id]);

        // Map children to parent records
        const parentsWithChildren = parents.map(parent => {
            const children = links
                .filter(l => l.parent_user_id === parent.id)
                .map(l => ({
                    link_id: l.link_id,
                    student_id: l.student_id,
                    first_name: l.first_name,
                    last_name: l.last_name,
                    full_name: `${l.first_name} ${l.last_name}`,
                    admission_number: l.admission_number,
                    class_name: l.class_name,
                    class_level: l.class_level
                }));

            return {
                ...parent,
                children
            };
        });

        res.json({ parents: parentsWithChildren });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// SchoolAdmin: Manually link a parent user to a student
exports.linkParentToStudent = async (req, res) => {
    const school_id = req.user.school_id;
    const { parent_user_id, student_id, admission_number } = req.body;

    if (!parent_user_id) {
        return res.status(400).json({ error: 'Validation Error', message: 'Parent user ID is required.' });
    }

    try {
        const db = getDB();

        // 1. Verify parent user exists and has Parent role
        const parentUser = await db.get("SELECT id, name, role FROM users WHERE id = $1 AND role = 'Parent'", [parent_user_id]);
        if (!parentUser) {
            return res.status(404).json({ error: 'Not Found', message: 'Parent user account not found.' });
        }

        // 2. Find target student by ID or admission_number in this school
        let targetStudent = null;
        if (student_id) {
            targetStudent = await db.get("SELECT id, first_name, last_name, admission_number FROM students WHERE id = $1 AND school_id = $2", [student_id, school_id]);
        } else if (admission_number) {
            targetStudent = await db.get("SELECT id, first_name, last_name, admission_number FROM students WHERE LOWER(admission_number) = LOWER($1) AND school_id = $2", [admission_number.trim(), school_id]);
        }

        if (!targetStudent) {
            return res.status(404).json({ error: 'Not Found', message: 'Student not found in your school.' });
        }

        // 3. Check if link already exists
        const existingLink = await db.get("SELECT id FROM parent_student_links WHERE parent_user_id = $1 AND student_id = $2", [parent_user_id, targetStudent.id]);
        if (existingLink) {
            return res.status(400).json({ error: 'Duplicate Link', message: `${parentUser.name} is already linked to ${targetStudent.first_name} ${targetStudent.last_name}.` });
        }

        // 4. Create link
        const result = await db.run("INSERT INTO parent_student_links (parent_user_id, student_id) VALUES ($1, $2) RETURNING id", [parent_user_id, targetStudent.id]);

        res.status(201).json({
            message: `Successfully linked ${parentUser.name} to ${targetStudent.first_name} ${targetStudent.last_name}.`,
            linkId: result.lastID
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// SchoolAdmin: Unlink a parent user from a student
exports.unlinkParentFromStudent = async (req, res) => {
    const school_id = req.user.school_id;
    const { linkId } = req.params;

    try {
        const db = getDB();

        // Verify link belongs to a student in this school
        const link = await db.get(`
            SELECT psl.id 
            FROM parent_student_links psl
            JOIN students s ON psl.student_id = s.id
            WHERE psl.id = $1 AND s.school_id = $2
        `, [linkId, school_id]);

        if (!link) {
            return res.status(404).json({ error: 'Not Found', message: 'Parent-student link not found for your school.' });
        }

        await db.run("DELETE FROM parent_student_links WHERE id = $1", [linkId]);

        res.json({ message: 'Parent-student link removed successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
