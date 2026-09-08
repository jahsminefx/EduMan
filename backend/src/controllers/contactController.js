const crypto = require('crypto');
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
        const accessToken = crypto.randomBytes(24).toString('hex');

        const result = await db.transaction(async (client) => {
            const inqRes = await client.run(
                `INSERT INTO contact_inquiries (inquiry_number, name, email, subject, message, status, access_token)
                 VALUES ($1, $2, $3, $4, $5, 'NEW', $6) RETURNING id`,
                [inquiryNumber, name, email, subject, message, accessToken]
            );
            const inquiryId = inqRes.lastID || inqRes.rows?.[0]?.id;

            await client.run(
                `INSERT INTO contact_inquiry_messages (inquiry_id, sender_name, sender_email, message, is_internal)
                 VALUES ($1, $2, $3, $4, 0)`,
                [inquiryId, name, email, message]
            );

            return inquiryId;
        });

        // Send automated receipt email notification to the VISITOR with guest chat tracking link
        const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
        const trackFullUrl = `${baseUrl.replace(/\/$/, '')}/contact/track/${inquiryNumber}?token=${accessToken}`;

        sendEmailNotification({
            to: email,
            subject: `[EDUMAN] Message Received - Inquiry #${inquiryNumber}`,
            text: `Hello ${name},\n\nThank you for reaching out to EduMan! We have received your inquiry #${inquiryNumber} regarding "${subject}".\n\nYou can chat live with our support team or check updates anytime using your secure link:\n${trackFullUrl}\n\nBest regards,\nEduMan Support Team`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px;">
                    <h2 style="color: #2563eb; margin-top: 0;">Message Received!</h2>
                    <p style="color: #374151; font-size: 14px; line-height: 1.5;">
                        Hello <strong>${name}</strong>,<br/><br/>
                        Thank you for reaching out to EduMan! We have received your message regarding <strong>"${subject}"</strong> (Inquiry <strong>#${inquiryNumber}</strong>).
                    </p>
                    <div style="margin: 25px 0; text-align: center;">
                        <a href="${trackFullUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-weight: bold; border-radius: 8px; text-decoration: none; display: inline-block;">
                            Chat Live with EduMan Support &rarr;
                        </a>
                    </div>
                    <p style="color: #6b7280; font-size: 12px;">
                        If the button above does not work, copy and paste this secure link into your browser:<br/>
                        <a href="${trackFullUrl}" style="color: #2563eb;">${trackFullUrl}</a>
                    </p>
                    <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 20px 0;"/>
                    <p style="color: #9ca3af; font-size: 11px;">EduMan Educational Management Platform</p>
                </div>
            `
        });

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
            inquiry_number: inquiryNumber,
            access_token: accessToken,
            track_url: `/contact/track/${inquiryNumber}?token=${accessToken}`
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
        const numId = parseInt(id, 10);

        const inquiry = await db.get(
            `SELECT ci.*, u.name as assigned_to_name 
             FROM contact_inquiries ci 
             LEFT JOIN users u ON ci.assigned_to = u.id 
             WHERE ci.id = $1 OR ci.inquiry_number = $2`,
            [isNaN(numId) ? -1 : numId, String(id).trim()]
        );

        if (!inquiry) return res.status(404).json({ error: 'Not Found', message: 'Inquiry not found' });

        const messages = await db.all(
            `SELECT cim.*, u.name as sender_user_name 
             FROM contact_inquiry_messages cim 
             LEFT JOIN users u ON cim.sender_id = u.id 
             WHERE cim.inquiry_id = $1 
             ORDER BY cim.id ASC`,
            [inquiry.id]
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
        const numId = parseInt(id, 10);
        const inquiry = await db.get('SELECT * FROM contact_inquiries WHERE id = $1 OR inquiry_number = $2', [isNaN(numId) ? -1 : numId, String(id).trim()]);
        if (!inquiry) return res.status(404).json({ error: 'Not Found', message: 'Inquiry not found' });

        // Check how many previous non-internal staff replies exist
        const staffReplyCount = await db.get(
            `SELECT COUNT(*) as count FROM contact_inquiry_messages WHERE inquiry_id = $1 AND sender_id IS NOT NULL AND is_internal = 0`,
            [inquiry.id]
        );
        const isFirstStaffReply = parseInt(staffReplyCount.count || 0, 10) === 0;

        const result = await db.run(
            `INSERT INTO contact_inquiry_messages (inquiry_id, sender_id, sender_name, sender_email, message, is_internal)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [inquiry.id, req.user.id, req.user.name, req.user.email, message, is_internal ? 1 : 0]
        );

        // Update inquiry status to IN_PROGRESS if currently NEW or READ
        if (inquiry.status === 'NEW' || inquiry.status === 'READ') {
            await db.run(`UPDATE contact_inquiries SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [inquiry.id]);
        }

        // Send email ONLY on the FIRST outbound public reply to provide the visitor with their guest tracking link
        if (!is_internal && isFirstStaffReply && inquiry.email) {
            const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
            const trackFullUrl = `${baseUrl.replace(/\/$/, '')}/contact/track/${inquiry.inquiry_number}?token=${inquiry.access_token || ''}`;

            sendEmailNotification({
                to: inquiry.email,
                subject: `[EDUMAN] Response to Inquiry #${inquiry.inquiry_number} - ${inquiry.subject}`,
                text: `Hello ${inquiry.name},\n\nOur support team has responded to your message:\n\n"${message.trim()}"\n\nYou can chat live with our team and view updates anytime using your secure link:\n${trackFullUrl}\n\nBest regards,\nEduMan Support Team`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px;">
                        <h2 style="color: #2563eb; margin-top: 0;">New Response from EduMan Support</h2>
                        <p style="color: #374151; font-size: 14px; line-height: 1.5;">
                            Hello <strong>${inquiry.name}</strong>,<br/><br/>
                            Our team has responded to your inquiry regarding <strong>"${inquiry.subject}"</strong>:
                        </p>
                        <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 15px; border-radius: 8px; margin: 15px 0; font-size: 14px; color: #1f2937;">
                            ${message.trim().replace(/\n/g, '<br/>')}
                        </div>
                        <div style="margin: 25px 0; text-align: center;">
                            <a href="${trackFullUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-weight: bold; border-radius: 8px; text-decoration: none; display: inline-block;">
                                Continue Live Chat on EduMan &rarr;
                            </a>
                        </div>
                        <p style="color: #6b7280; font-size: 12px;">
                            Click the button above to continue chatting directly with our team on EduMan.
                        </p>
                    </div>
                `
            });
        }

        res.json({ message: 'Message added successfully', id: result.lastID || result.rows?.[0]?.id, emailedVisitor: !is_internal && isFirstStaffReply });
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

// ── GUEST PUBLIC TRACKING & CHAT ENDPOINTS ──

exports.getTrackedInquiry = async (req, res) => {
    try {
        const { inquiryNumber } = req.params;
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: 'Bad Request', message: 'Access token is required to view inquiry.' });
        }

        const db = getDB();
        const inquiry = await db.get(
            `SELECT inquiry_number, name, email, subject, status, created_at, updated_at, access_token
             FROM contact_inquiries 
             WHERE inquiry_number = $1`,
            [inquiryNumber]
        );

        if (!inquiry || inquiry.access_token !== token) {
            return res.status(403).json({ error: 'Forbidden', message: 'Invalid or expired tracking link.' });
        }

        const messages = await db.all(
            `SELECT id, sender_id, sender_name, sender_email, message, is_internal, created_at 
             FROM contact_inquiry_messages 
             WHERE inquiry_id = (SELECT id FROM contact_inquiries WHERE inquiry_number = $1)
               AND is_internal = 0
             ORDER BY id ASC`,
            [inquiryNumber]
        );

        const { access_token, ...safeInquiry } = inquiry;

        res.json({ inquiry: safeInquiry, messages });
    } catch (error) {
        console.error('Error fetching tracked inquiry:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve inquiry' });
    }
};

exports.addTrackedInquiryMessage = async (req, res) => {
    try {
        const { inquiryNumber } = req.params;
        const { token, message } = req.body;

        if (!token || !message || !message.trim()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Access token and message body are required.' });
        }

        const db = getDB();
        const inquiry = await db.get(
            `SELECT id, inquiry_number, name, email, subject, access_token 
             FROM contact_inquiries 
             WHERE inquiry_number = $1`,
            [inquiryNumber]
        );

        if (!inquiry || inquiry.access_token !== token) {
            return res.status(403).json({ error: 'Forbidden', message: 'Invalid or expired tracking link.' });
        }

        const msgRes = await db.get(
            `INSERT INTO contact_inquiry_messages (inquiry_id, sender_name, sender_email, message, is_internal)
             VALUES ($1, $2, $3, $4, 0) RETURNING id, created_at`,
            [inquiry.id, inquiry.name, inquiry.email, message.trim()]
        );

        await db.run(
            `UPDATE contact_inquiries SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [inquiry.id]
        );

        // Notify support officers in-app
        const supportStaff = await db.all(
            `SELECT id FROM users WHERE role IN ('SuperAdmin', 'SupportOfficer') AND is_active = 1`
        );
        for (const staff of supportStaff) {
            await createNotification({
                userId: staff.id,
                title: `Visitor Reply on ${inquiry.inquiry_number}`,
                message: `${inquiry.name}: ${message.trim()}`.substring(0, 150),
                type: 'support',
                link: `/dashboard/support/contact`
            });
        }

        res.json({
            message: 'Response posted successfully',
            reply: {
                id: msgRes.id,
                sender_name: inquiry.name,
                sender_email: inquiry.email,
                message: message.trim(),
                created_at: msgRes.created_at
            }
        });
    } catch (error) {
        console.error('Error adding tracked inquiry message:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to post message' });
    }
};
