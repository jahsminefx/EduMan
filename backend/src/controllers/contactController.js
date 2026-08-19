const { getDB } = require('../config/database');
const { createNotification, sendEmailNotification } = require('../services/notificationService');

async function generateInquiryNumber() {
    const db = getDB();
    const year = new Date().getFullYear();
    const prefix = `CNT-${year}-`;
    const lastInquiry = await db.get(
        `SELECT inquiry_number FROM contact_inquiries WHERE inquiry_number LIKE $1 ORDER BY id DESC LIMIT 1`,
        [`${prefix}%`]
    );

    let nextNum = 1;
    if (lastInquiry && lastInquiry.inquiry_number) {
        const parts = lastInquiry.inquiry_number.split('-');
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq)) nextNum = seq + 1;
    }
    const padded = String(nextNum).padStart(6, '0');
    return `${prefix}${padded}`;
}

exports.submitContactForm = async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    try {
        const db = getDB();
        const inquiryNumber = await generateInquiryNumber();

        const result = await db.transaction(async (client) => {
            const inqRes = await client.run(
                `INSERT INTO contact_inquiries (inquiry_number, name, email, subject, message, status)
                 VALUES ($1, $2, $3, $4, $5, 'NEW') RETURNING id`,
                [inquiryNumber, name, email, subject, message]
            );
            const inquiryId = inqRes.lastID || inqRes.rows?.[0]?.id;

            await client.run(
                `INSERT INTO contact_inquiry_messages (inquiry_id, sender_name, sender_email, message, is_internal)
                 VALUES ($1, $2, $3, $4, 0)`,
                [inquiryId, name, email, message]
            );

            return inquiryId;
        });

        // Send 1 single email notification to support inbox email if configured
        const supportEmail = process.env.CONTACT_EMAIL_TO || process.env.SMTP_USER;
        if (supportEmail) {
            sendEmailNotification({
                to: supportEmail,
                subject: `[EDUMAN Contact Inquiry ${inquiryNumber}] ${subject}`,
                text: `New contact form inquiry ${inquiryNumber} received from ${name} <${email}>:\n\nSubject: ${subject}\nMessage:\n${message}`
            });
        }

        // Notify active Support Officers & SuperAdmins in-app
        const supportStaff = await db.all(
            `SELECT id FROM users WHERE role IN ('SuperAdmin', 'SupportOfficer') AND is_active = 1`
        );
        for (const staff of supportStaff) {
            await createNotification({
                userId: staff.id,
                title: `Contact Inquiry ${inquiryNumber}`,
                message: `${name}: ${subject}`.substring(0, 150),
                type: 'support',
                link: `/dashboard/support/contact`
            });
        }

        res.status(200).json({
            message: 'Thank you! Your message has been received by EduMan Support.',
            inquiry_number: inquiryNumber
        });
    } catch (error) {
        console.error('Error submitting contact form:', error);
        res.status(500).json({ message: 'Failed to submit contact message' });
    }
};

exports.getInquiries = async (req, res) => {
    try {
        const { status, search } = req.query;
        const db = getDB();
        let query = `SELECT ci.*, u.name as assigned_to_name 
                     FROM contact_inquiries ci 
                     LEFT JOIN users u ON ci.assigned_to = u.id 
                     WHERE 1=1`;
        const params = [];

        if (status) {
            query += ` AND ci.status = $${params.length + 1}`;
            params.push(status.toUpperCase());
        }

        if (search) {
            query += ` AND (ci.name ILIKE $${params.length + 1} OR ci.email ILIKE $${params.length + 1} OR ci.subject ILIKE $${params.length + 1} OR ci.inquiry_number ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY ci.id DESC`;
        const inquiries = await db.all(query, params);
        res.json({ inquiries });
    } catch (error) {
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};

exports.getInquiryById = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();

        const inquiry = await db.get(
            `SELECT ci.*, u.name as assigned_to_name 
             FROM contact_inquiries ci 
             LEFT JOIN users u ON ci.assigned_to = u.id 
             WHERE ci.id = $1`,
            [id]
        );

        if (!inquiry) return res.status(404).json({ error: 'Not Found', message: 'Inquiry not found' });

        const messages = await db.all(
            `SELECT cim.*, u.name as sender_user_name 
             FROM contact_inquiry_messages cim 
             LEFT JOIN users u ON cim.sender_id = u.id 
             WHERE cim.inquiry_id = $1 
             ORDER BY cim.id ASC`,
            [id]
        );

        res.json({ inquiry, messages });
    } catch (error) {
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};

exports.addInquiryMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { message, is_internal = 0 } = req.body;

        if (!message) return res.status(400).json({ error: 'Bad Request', message: 'Message is required' });

        const db = getDB();
        const inquiry = await db.get('SELECT * FROM contact_inquiries WHERE id = $1', [id]);
        if (!inquiry) return res.status(404).json({ error: 'Not Found', message: 'Inquiry not found' });

        const result = await db.run(
            `INSERT INTO contact_inquiry_messages (inquiry_id, sender_id, sender_name, sender_email, message, is_internal)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [id, req.user.id, req.user.name, req.user.email, message, is_internal ? 1 : 0]
        );

        if (!is_internal && inquiry.email) {
            sendEmailNotification({
                to: inquiry.email,
                subject: `Re: [${inquiry.inquiry_number}] ${inquiry.subject}`,
                text: `${message}\n\n---\nEduMan Support Team`
            });
        }

        res.json({ message: 'Message added successfully', id: result.lastID || result.rows?.[0]?.id });
    } catch (error) {
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};

exports.updateInquiryStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assigned_to } = req.body;
        const validStatuses = new Set(['NEW', 'READ', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED', 'CONVERTED']);

        const db = getDB();
        const inquiry = await db.get('SELECT * FROM contact_inquiries WHERE id = $1', [id]);
        if (!inquiry) return res.status(404).json({ error: 'Not Found', message: 'Inquiry not found' });

        let updateSql = 'UPDATE contact_inquiries SET updated_at = CURRENT_TIMESTAMP';
        const params = [];
        let pIdx = 1;

        if (status && validStatuses.has(String(status).toUpperCase())) {
            updateSql += `, status = $${pIdx++}`;
            params.push(String(status).toUpperCase());
        }

        if (assigned_to !== undefined) {
            updateSql += `, assigned_to = $${pIdx++}`;
            params.push(assigned_to || null);
        }

        updateSql += ` WHERE id = $${pIdx++}`;
        params.push(id);

        await db.run(updateSql, params);
        res.json({ message: 'Inquiry updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};

exports.convertInquiryToTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { category = 'General', priority = 'MEDIUM' } = req.body;

        const db = getDB();
        const inquiry = await db.get('SELECT * FROM contact_inquiries WHERE id = $1', [id]);
        if (!inquiry) return res.status(404).json({ error: 'Not Found', message: 'Inquiry not found' });

        if (inquiry.converted_ticket_id) {
            return res.status(400).json({ error: 'Bad Request', message: 'Inquiry has already been converted to a support ticket.' });
        }

        // Generate Ticket Number (SUP-2026-XXXXXX)
        const year = new Date().getFullYear();
        const prefix = `SUP-${year}-`;
        const lastTicket = await db.get(
            `SELECT ticket_number FROM support_threads WHERE ticket_number LIKE $1 ORDER BY id DESC LIMIT 1`,
            [`${prefix}%`]
        );
        let nextNum = 1;
        if (lastTicket && lastTicket.ticket_number) {
            const parts = lastTicket.ticket_number.split('-');
            const seq = parseInt(parts[2], 10);
            if (!isNaN(seq)) nextNum = seq + 1;
        }
        const ticketNumber = `${prefix}${String(nextNum).padStart(6, '0')}`;

        const result = await db.transaction(async (client) => {
            // 1. Create support thread
            const threadRes = await client.run(
                `INSERT INTO support_threads (ticket_number, created_by, subject, category, priority, status, assigned_to)
                 VALUES ($1, $2, $3, $4, $5, 'OPEN', $6) RETURNING id`,
                [ticketNumber, req.user.id, `[From Inquiry ${inquiry.inquiry_number}] ${inquiry.subject}`, category, priority, req.user.id]
            );
            const threadId = threadRes.lastID || threadRes.rows?.[0]?.id;

            // 2. Initial ticket message from inquiry
            await client.run(
                `INSERT INTO support_messages (thread_id, sender_id, message, is_internal)
                 VALUES ($1, $2, $3, $4)`,
                [threadId, req.user.id, `Converted from Contact Inquiry ${inquiry.inquiry_number} submitted by ${inquiry.name} (${inquiry.email}):\n\n${inquiry.message}`, 0]
            );

            // 3. Mark contact inquiry as CONVERTED and link ticket ID
            await client.run(
                `UPDATE contact_inquiries SET status = 'CONVERTED', converted_ticket_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [threadId, id]
            );

            return threadId;
        });

        res.json({
            message: `Contact inquiry ${inquiry.inquiry_number} successfully converted to support ticket ${ticketNumber}`,
            ticket_id: result,
            ticket_number: ticketNumber
        });
    } catch (error) {
        console.error('Error converting inquiry to ticket:', error);
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
};
