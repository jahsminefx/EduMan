const { getDB } = require('../config/database');
const notificationService = require('../services/notificationService');
const aiSupportService = require('../services/aiSupportService');

/**
 * Generate unique ticket number: SUP-2026-000001
 */
async function generateTicketNumber() {
    const db = getDB();
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
        if (!isNaN(seq)) {
            nextNum = seq + 1;
        }
    }
    const padded = String(nextNum).padStart(6, '0');
    return `${prefix}${padded}`;
}

/**
 * Helper to record activity log
 */
async function logActivity(threadId, userId, action, details = null) {
    try {
        const db = getDB();
        await db.run(
            `INSERT INTO support_activity_logs (thread_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
            [threadId, userId, action, details]
        );
    } catch (err) {
        console.error('Failed to log activity:', err);
    }
}

function calculateSLATargets(priority, baseDate = new Date()) {
    const now = baseDate.getTime();
    let respMs = 8 * 60 * 60 * 1000;
    let resMs = 48 * 60 * 60 * 1000;

    const p = String(priority || 'MEDIUM').toUpperCase();
    if (p === 'LOW') {
        respMs = 24 * 60 * 60 * 1000;
        resMs = 72 * 60 * 60 * 1000;
    } else if (p === 'MEDIUM') {
        respMs = 8 * 60 * 60 * 1000;
        resMs = 48 * 60 * 60 * 1000;
    } else if (p === 'HIGH') {
        respMs = 2 * 60 * 60 * 1000;
        resMs = 24 * 60 * 60 * 1000;
    } else if (p === 'URGENT') {
        respMs = 30 * 60 * 1000;
        resMs = 4 * 60 * 60 * 1000;
    }

    return {
        firstResponseDueAt: new Date(now + respMs).toISOString(),
        resolutionDueAt: new Date(now + resMs).toISOString()
    };
}

// ── 1. CREATE TICKET ──
exports.createThread = async (req, res) => {
    try {
        const { subject, category, priority = 'MEDIUM', message, attachments = [] } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        // V1 Rule: Students cannot create tickets
        if (userRole === 'Student') {
            return res.status(403).json({ error: 'Forbidden', message: 'Students do not have access to create support tickets.' });
        }

        if (!subject || !category || !message) {
            return res.status(400).json({ error: 'Bad Request', message: 'Subject, category, and message are required.' });
        }

        const db = getDB();

        // Rate limiting check: Max 5 tickets per 15 minutes per user
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const recentCount = await db.get(
            `SELECT COUNT(*) as count FROM support_threads WHERE created_by = $1 AND created_at >= $2`,
            [userId, fifteenMinsAgo]
        );
        if (parseInt(recentCount.count, 10) >= 5) {
            return res.status(429).json({ error: 'Too Many Requests', message: 'Rate limit exceeded. Please wait a few minutes before submitting another ticket.' });
        }

        // Strict Tenant Isolation: School ID from session
        let schoolId = req.user.school_id;
        if (userRole === 'SuperAdmin') {
            schoolId = req.body.school_id || req.user.school_id || null;
        }

        // Generate ticket number
        const ticketNumber = await generateTicketNumber();

        // Predict AI category & priority readiness scores
        const aiCategory = await aiSupportService.categorizeAndScoreTicket(subject, message);
        const aiPriority = await aiSupportService.detectPriority(subject, message);

        // Calculate SLA targets
        const slaTargets = calculateSLATargets(priority);

        // Insert thread
        const threadRes = await db.get(
            `INSERT INTO support_threads (
                ticket_number, school_id, created_by, subject, category, priority, status, last_reply_at, ai_category_score, ai_priority_score, first_response_due_at, resolution_due_at, sla_status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', CURRENT_TIMESTAMP, $7, $8, $9, $10, 'IN_SLA') RETURNING id`,
            [
                ticketNumber,
                schoolId,
                userId,
                subject.trim(),
                category.trim(),
                priority,
                aiCategory.confidenceScore,
                aiPriority.priorityScore,
                slaTargets.firstResponseDueAt,
                slaTargets.resolutionDueAt
            ]
        );
        const threadId = threadRes.id;

        // Insert initial message
        const messageRes = await db.get(
            `INSERT INTO support_messages (thread_id, sender_id, message, is_internal) VALUES ($1, $2, $3, 0) RETURNING id`,
            [threadId, userId, message.trim()]
        );
        const messageId = messageRes.id;

        // Process attachments
        if (Array.isArray(attachments) && attachments.length > 0) {
            for (const file of attachments) {
                if (file.fileUrl && file.fileName) {
                    await db.run(
                        `INSERT INTO support_attachments (message_id, file_name, file_url, file_type, file_size, public_id)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            messageId,
                            file.fileName,
                            file.fileUrl,
                            file.fileType || 'application/octet-stream',
                            file.fileSize || 0,
                            file.publicId || null
                        ]
                    );
                }
            }
            await logActivity(threadId, userId, 'Attachment Uploaded', `${attachments.length} attachment(s) uploaded.`);
        }

        // Log creation activity
        await logActivity(threadId, userId, 'Ticket Created', `Ticket ${ticketNumber} created under category "${category}" with priority "${priority}".`);

        // Fetch thread details for notification
        const fullThread = await db.get(`SELECT * FROM support_threads WHERE id = $1`, [threadId]);
        const creatorUser = await db.get(`SELECT name, email FROM users WHERE id = $1`, [userId]);

        // Trigger notifications asynchronously
        notificationService.notifyNewTicket(fullThread, creatorUser);

        return res.status(201).json({
            message: 'Ticket created successfully',
            thread: {
                id: threadId,
                ticketNumber,
                subject,
                category,
                priority,
                status: 'OPEN',
                createdAt: fullThread.created_at
            }
        });
    } catch (err) {
        console.error('Error creating ticket thread:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to create support ticket' });
    }
};

// ── 2. GET THREADS (LISTING WITH TENANT ISOLATION, FILTERS & PAGINATION) ──
exports.getThreads = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const schoolId = req.user.school_id;

        if (userRole === 'Student') {
            return res.status(403).json({ error: 'Forbidden', message: 'Students do not have access to Support Tickets.' });
        }

        const {
            page = 1,
            limit = 15,
            search = '',
            status = '',
            priority = '',
            category = '',
            assignedTo = '',
            school_id = '',
            startDate = '',
            endDate = '',
            filterTab = 'ALL' // OPEN, ASSIGNED, WAITING, RESOLVED, CLOSED, ALL
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
        const offset = (pageNum - 1) * limitNum;

        let whereClauses = [];
        let params = [];
        let paramIdx = 1;

        // TENANT ISOLATION RULES
        if (userRole === 'Teacher' || userRole === 'Parent') {
            // Teachers and Parents view strictly their own tickets
            whereClauses.push(`t.created_by = $${paramIdx++}`);
            params.push(userId);
        } else if (userRole === 'SchoolAdmin') {
            // SchoolAdmins view tickets belonging to their school
            whereClauses.push(`t.school_id = $${paramIdx++}`);
            params.push(schoolId);
        } else if (userRole === 'SupportOfficer') {
            if (filterTab === 'ASSIGNED') {
                whereClauses.push(`t.assigned_to = $${paramIdx++}`);
                params.push(userId);
            }
        } else if (userRole === 'SuperAdmin') {
            if (school_id) {
                whereClauses.push(`t.school_id = $${paramIdx++}`);
                params.push(parseInt(school_id, 10));
            }
        }

        // Tab Filter
        if (filterTab === 'OPEN') {
            whereClauses.push(`t.status = 'OPEN'`);
        } else if (filterTab === 'WAITING') {
            whereClauses.push(`t.status = 'WAITING_FOR_CUSTOMER'`);
        } else if (filterTab === 'RESOLVED') {
            whereClauses.push(`t.status = 'RESOLVED'`);
        } else if (filterTab === 'CLOSED') {
            whereClauses.push(`t.status = 'CLOSED'`);
        } else if (filterTab === 'ASSIGNED' && userRole !== 'SupportOfficer') {
            whereClauses.push(`t.assigned_to = $${paramIdx++}`);
            params.push(userId);
        }

        // Additional Filters
        if (status) {
            whereClauses.push(`t.status = $${paramIdx++}`);
            params.push(status);
        }
        if (priority) {
            whereClauses.push(`t.priority = $${paramIdx++}`);
            params.push(priority);
        }
        if (category) {
            whereClauses.push(`t.category = $${paramIdx++}`);
            params.push(category);
        }
        if (assignedTo) {
            if (assignedTo === 'unassigned') {
                whereClauses.push(`t.assigned_to IS NULL`);
            } else {
                whereClauses.push(`t.assigned_to = $${paramIdx++}`);
                params.push(parseInt(assignedTo, 10));
            }
        }
        if (startDate) {
            whereClauses.push(`t.created_at >= $${paramIdx++}`);
            params.push(startDate);
        }
        if (endDate) {
            whereClauses.push(`t.created_at <= $${paramIdx++}`);
            params.push(endDate);
        }
        if (search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            whereClauses.push(
                `(t.ticket_number ILIKE $${paramIdx} OR t.subject ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR s.name ILIKE $${paramIdx})`
            );
            params.push(searchTerm);
            paramIdx++;
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const db = getDB();

        // Total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM support_threads t
            LEFT JOIN users u ON u.id = t.created_by
            LEFT JOIN schools s ON s.id = t.school_id
            ${whereSql}
        `;
        const countRes = await db.get(countQuery, params);
        const totalItems = parseInt(countRes.total || 0, 10);
        const totalPages = Math.ceil(totalItems / limitNum);

        // Fetch items
        const selectQuery = `
            SELECT 
                t.*,
                u.name as creator_name,
                u.email as creator_email,
                u.role as creator_role,
                s.name as school_name,
                s.logo_url as school_logo,
                agent.name as agent_name,
                (SELECT COUNT(*) FROM support_messages WHERE thread_id = t.id) as message_count
            FROM support_threads t
            LEFT JOIN users u ON u.id = t.created_by
            LEFT JOIN schools s ON s.id = t.school_id
            LEFT JOIN users agent ON agent.id = t.assigned_to
            ${whereSql}
            ORDER BY t.last_reply_at DESC, t.id DESC
            LIMIT $${paramIdx++} OFFSET $${paramIdx++}
        `;

        const threads = await db.all(selectQuery, [...params, limitNum, offset]);

        return res.json({
            threads,
            pagination: {
                totalItems,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (err) {
        console.error('Error fetching support threads:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve support tickets' });
    }
};

// ── 3. GET SINGLE THREAD BY ID (WITH MESSAGES, ATTACHMENTS, TIMELINE, SCHOOL INFO) ──
exports.getThreadById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        const schoolId = req.user.school_id;

        if (userRole === 'Student') {
            return res.status(403).json({ error: 'Forbidden', message: 'Students do not have access to Support Tickets.' });
        }

        const db = getDB();

        const thread = await db.get(
            `SELECT 
                t.*,
                u.name as creator_name,
                u.email as creator_email,
                u.role as creator_role,
                s.name as school_name,
                s.email as school_email,
                s.phone as school_phone,
                s.principal_name,
                s.logo_url as school_logo,
                s.school_type,
                agent.name as agent_name,
                agent.email as agent_email
            FROM support_threads t
            LEFT JOIN users u ON u.id = t.created_by
            LEFT JOIN schools s ON s.id = t.school_id
            LEFT JOIN users agent ON agent.id = t.assigned_to
            WHERE t.id = $1 OR t.ticket_number = $1`,
            [id]
        );

        if (!thread) {
            return res.status(404).json({ error: 'Not Found', message: 'Support ticket not found.' });
        }

        // TENANT ACCESS CHECK
        if (['Teacher', 'Parent'].includes(userRole) && thread.created_by !== userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'You can only view your own tickets.' });
        }
        if (userRole === 'SchoolAdmin' && thread.school_id !== schoolId) {
            return res.status(403).json({ error: 'Forbidden', message: 'You can only view tickets belonging to your school.' });
        }

        // Fetch Messages (Internal notes filtered for non-staff)
        const isStaff = ['SuperAdmin', 'SupportOfficer'].includes(userRole);
        const internalClause = isStaff ? '' : 'AND m.is_internal = 0';

        const messages = await db.all(
            `SELECT 
                m.*,
                u.name as sender_name,
                u.email as sender_email,
                u.role as sender_role
            FROM support_messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.thread_id = $1 ${internalClause}
            ORDER BY m.created_at ASC`,
            [thread.id]
        );

        // Attach attachments for each message
        for (const msg of messages) {
            const atts = await db.all(
                `SELECT * FROM support_attachments WHERE message_id = $1 ORDER BY id ASC`,
                [msg.id]
            );
            msg.attachments = atts;
        }

        // Fetch Activity Timeline
        const activityLogs = await db.all(
            `SELECT 
                l.*,
                u.name as user_name,
                u.role as user_role
            FROM support_activity_logs l
            LEFT JOIN users u ON u.id = l.user_id
            WHERE l.thread_id = $1
            ORDER BY l.created_at ASC`,
            [thread.id]
        );

        // Fetch Tags
        const tags = await db.all(
            `SELECT tag.* FROM support_tags tag 
             JOIN support_thread_tags stt ON stt.tag_id = tag.id 
             WHERE stt.thread_id = $1`,
            [thread.id]
        );

        // Fetch Feedback if resolved/closed
        const feedback = await db.get(`SELECT * FROM support_feedback WHERE thread_id = $1`, [thread.id]);

        // Fetch Watchers
        const watchers = await db.all(
            `SELECT w.user_id, u.name, u.email FROM support_watchers w JOIN users u ON u.id = w.user_id WHERE w.thread_id = $1`,
            [thread.id]
        );

        // AI Suggested Reply Preview (for staff)
        let aiSuggestions = null;
        if (isStaff) {
            aiSuggestions = await aiSupportService.generateSuggestedReply(thread.id);
        }

        return res.json({
            thread,
            messages,
            activityLogs,
            tags,
            feedback: feedback || null,
            watchers,
            aiSuggestions
        });
    } catch (err) {
        console.error('Error fetching ticket details:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve ticket details' });
    }
};

// ── 4. ADD MESSAGE / REPLY ──
exports.addMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { message, is_internal = 0, mentions = [], attachments = [] } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        const isStaff = ['SuperAdmin', 'SupportOfficer'].includes(userRole);

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Message body cannot be empty.' });
        }

        const db = getDB();
        const thread = await db.get(`SELECT * FROM support_threads WHERE id = $1`, [id]);
        if (!thread) {
            return res.status(404).json({ error: 'Not Found', message: 'Ticket not found.' });
        }

        // Tenant access check
        if (['Teacher', 'Parent'].includes(userRole) && thread.created_by !== userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'You cannot reply to this ticket.' });
        }
        if (userRole === 'SchoolAdmin' && thread.school_id !== req.user.school_id) {
            return res.status(403).json({ error: 'Forbidden', message: 'You cannot reply to this ticket.' });
        }

        // Internal note validation: non-staff cannot post internal notes
        const internalFlag = isStaff && (is_internal === 1 || is_internal === true) ? 1 : 0;

        // Insert message
        const msgRes = await db.get(
            `INSERT INTO support_messages (thread_id, sender_id, message, is_internal, mentions)
             VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
            [thread.id, userId, message.trim(), internalFlag, JSON.stringify(mentions)]
        );
        const messageId = msgRes.id;

        // Process attachments
        let savedAttachments = [];
        if (Array.isArray(attachments) && attachments.length > 0) {
            for (const file of attachments) {
                if (file.fileUrl && file.fileName) {
                    const attRes = await db.get(
                        `INSERT INTO support_attachments (message_id, file_name, file_url, file_type, file_size, public_id)
                         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                        [
                            messageId,
                            file.fileName,
                            file.fileUrl,
                            file.fileType || 'application/octet-stream',
                            file.fileSize || 0,
                            file.publicId || null
                        ]
                    );
                    savedAttachments.push(attRes);
                }
            }
        }

        // Update thread timestamps and status
        let newStatus = thread.status;
        let updateFirstResponse = '';

        if (isStaff && !thread.first_response_at && internalFlag === 0) {
            updateFirstResponse = `, first_response_at = CURRENT_TIMESTAMP`;
        }

        if (internalFlag === 0) {
            if (isStaff && thread.status === 'OPEN') {
                newStatus = 'WAITING_FOR_CUSTOMER';
            } else if (!isStaff && (thread.status === 'WAITING_FOR_CUSTOMER' || thread.status === 'RESOLVED')) {
                newStatus = 'IN_PROGRESS';
            }
        }

        await db.run(
            `UPDATE support_threads 
             SET status = $1, last_reply_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP ${updateFirstResponse}
             WHERE id = $2`,
            [newStatus, thread.id]
        );

        // Activity log
        const logText = internalFlag === 1 ? 'Added an internal note.' : 'Added a reply.';
        await logActivity(thread.id, userId, 'Reply Added', logText);

        // Trigger Notifications asynchronously
        const senderUser = await db.get(`SELECT name, role FROM users WHERE id = $1`, [userId]);
        const messageObj = { id: messageId, message: message.trim(), is_internal: internalFlag, created_at: msgRes.created_at };
        
        notificationService.notifyNewReply(thread, messageObj, senderUser);
        if (mentions.length > 0) {
            notificationService.notifyMentions(thread, mentions, senderUser);
        }

        return res.json({
            message: 'Reply posted successfully',
            reply: {
                id: messageId,
                thread_id: thread.id,
                sender_id: userId,
                sender_name: senderUser.name,
                sender_role: senderUser.role,
                message: message.trim(),
                is_internal: internalFlag,
                created_at: msgRes.created_at,
                attachments: savedAttachments
            }
        });
    } catch (err) {
        console.error('Error posting reply:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to post reply' });
    }
};

// ── 5. UPDATE TICKET METADATA (STATUS, PRIORITY, CATEGORY, ASSIGNMENT) ──
exports.updateThread = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, priority, category, assigned_to, reason } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
        const isStaff = ['SuperAdmin', 'SupportOfficer'].includes(userRole);

        const db = getDB();
        const thread = await db.get(`SELECT * FROM support_threads WHERE id = $1`, [id]);
        if (!thread) {
            return res.status(404).json({ error: 'Not Found', message: 'Support ticket not found.' });
        }

        // Permission rules:
        // SuperAdmin can change anything.
        // SupportOfficer can change status, assign, priority.
        // SchoolAdmin can close/reopen.
        // Teacher can close/reopen if their own.
        if (userRole === 'Teacher' && thread.created_by !== userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'You cannot modify this ticket.' });
        }
        if (userRole === 'SchoolAdmin' && thread.school_id !== req.user.school_id) {
            return res.status(403).json({ error: 'Forbidden', message: 'You cannot modify this ticket.' });
        }

        const updates = [];
        const params = [];
        let pIdx = 1;

        const userObj = await db.get(`SELECT name FROM users WHERE id = $1`, [userId]);

        // Status update
        if (status && status !== thread.status) {
            updates.push(`status = $${pIdx++}`);
            params.push(status);
            if (status === 'CLOSED' || status === 'RESOLVED') {
                updates.push(`closed_at = CURRENT_TIMESTAMP`);
            }
            await logActivity(thread.id, userId, 'Status Changed', `Status changed from "${thread.status}" to "${status}".`);
            notificationService.notifyStatusChange(thread, status, userObj);
        }

        // Priority update
        if (priority && priority !== thread.priority) {
            if (!isStaff) {
                return res.status(403).json({ error: 'Forbidden', message: 'Only support officers can change ticket priority.' });
            }
            updates.push(`priority = $${pIdx++}`);
            params.push(priority);
            await logActivity(thread.id, userId, 'Priority Changed', `Priority changed from "${thread.priority}" to "${priority}".`);
        }

        // Category update
        if (category && category !== thread.category) {
            if (userRole !== 'SuperAdmin') {
                return res.status(403).json({ error: 'Forbidden', message: 'Only SuperAdmin can change ticket categories.' });
            }
            updates.push(`category = $${pIdx++}`);
            params.push(category);
            await logActivity(thread.id, userId, 'Category Changed', `Category changed to "${category}".`);
        }

        // Assignment update
        if (assigned_to !== undefined && assigned_to !== thread.assigned_to) {
            if (!isStaff) {
                return res.status(403).json({ error: 'Forbidden', message: 'Only support staff can assign tickets.' });
            }
            const newAssigneeId = assigned_to ? parseInt(assigned_to, 10) : null;
            updates.push(`assigned_to = $${pIdx++}`);
            params.push(newAssigneeId);

            // Log assignment history table
            await db.run(
                `INSERT INTO support_assignments (thread_id, assigned_from, assigned_to, reason) VALUES ($1, $2, $3, $4)`,
                [thread.id, thread.assigned_to, newAssigneeId, reason || null]
            );

            let assigneeName = 'Unassigned';
            if (newAssigneeId) {
                const agent = await db.get(`SELECT id, name, email FROM users WHERE id = $1`, [newAssigneeId]);
                if (agent) {
                    assigneeName = agent.name;
                    notificationService.notifyAssignment(thread, agent, userObj);
                }
            }
            await logActivity(thread.id, userId, 'Assigned', `Assigned to ${assigneeName}. ${reason ? `Reason: ${reason}` : ''}`);
        }

        if (updates.length === 0) {
            return res.json({ message: 'No updates provided', thread });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(thread.id);

        await db.run(`UPDATE support_threads SET ${updates.join(', ')} WHERE id = $${pIdx}`, params);

        const updatedThread = await db.get(`SELECT * FROM support_threads WHERE id = $1`, [thread.id]);
        return res.json({ message: 'Ticket updated successfully', thread: updatedThread });
    } catch (err) {
        console.error('Error updating ticket:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to update ticket' });
    }
};

// ── 5B. ESCALATE TICKET TO SUPERADMIN ──
exports.escalateThread = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;

        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Escalation reason is required.' });
        }

        const db = getDB();
        const thread = await db.get(`SELECT * FROM support_threads WHERE id = $1`, [id]);
        if (!thread) {
            return res.status(404).json({ error: 'Not Found', message: 'Support ticket not found.' });
        }

        await db.run(
            `UPDATE support_threads 
             SET escalation_status = 'ESCALATED', escalated_at = CURRENT_TIMESTAMP, escalated_by = $1, escalation_reason = $2, priority = 'URGENT', updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [userId, reason.trim(), thread.id]
        );

        await logActivity(thread.id, userId, 'Escalated', `Ticket escalated to SuperAdmin. Reason: ${reason.trim()}`);

        // Notify SuperAdmins
        const superAdmins = await db.all(`SELECT id FROM users WHERE role = 'SuperAdmin' AND is_active = 1`);
        for (const admin of superAdmins) {
            await notificationService.createNotification({
                userId: admin.id,
                title: `ESCALATED TICKET #${thread.ticket_number}`,
                message: `Ticket "${thread.subject}" escalated by ${req.user.name}: ${reason.trim()}`,
                type: 'support',
                link: `/dashboard/support/tickets/${thread.id}`
            });
        }

        res.json({ message: `Ticket #${thread.ticket_number} successfully escalated to SuperAdmin` });
    } catch (err) {
        console.error('Error escalating ticket:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to escalate ticket' });
    }
};

// ── 6. DELETE TICKET (SUPER ADMIN ONLY) ──
exports.deleteThread = async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only SuperAdmin can delete tickets.' });
        }
        const { id } = req.params;
        const db = getDB();

        const thread = await db.get(`SELECT ticket_number FROM support_threads WHERE id = $1`, [id]);
        if (!thread) {
            return res.status(404).json({ error: 'Not Found', message: 'Ticket not found.' });
        }

        await db.run(`DELETE FROM support_threads WHERE id = $1`, [id]);
        return res.json({ message: `Ticket ${thread.ticket_number} deleted successfully.` });
    } catch (err) {
        console.error('Error deleting ticket:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to delete ticket' });
    }
};

// ── 7. BULK TICKET OPERATIONS (SUPER ADMIN & SUPPORT) ──
exports.bulkOperations = async (req, res) => {
    try {
        const isStaff = ['SuperAdmin', 'SupportOfficer'].includes(req.user.role);
        if (!isStaff) {
            return res.status(403).json({ error: 'Forbidden', message: 'Only Support Staff can perform bulk actions.' });
        }

        const { threadIds, action, value } = req.body;
        if (!Array.isArray(threadIds) || threadIds.length === 0 || !action) {
            return res.status(400).json({ error: 'Bad Request', message: 'threadIds array and action are required.' });
        }

        const db = getDB();
        let affected = 0;

        for (const tid of threadIds) {
            if (action === 'change_status' && value) {
                await db.run(`UPDATE support_threads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [value, tid]);
                await logActivity(tid, req.user.id, 'Status Changed', `Bulk status update to "${value}".`);
                affected++;
            } else if (action === 'assign' && value !== undefined) {
                const assignee = value ? parseInt(value, 10) : null;
                await db.run(`UPDATE support_threads SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [assignee, tid]);
                await logActivity(tid, req.user.id, 'Assigned', `Bulk assigned.`);
                affected++;
            } else if (action === 'change_priority' && value) {
                await db.run(`UPDATE support_threads SET priority = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [value, tid]);
                await logActivity(tid, req.user.id, 'Priority Changed', `Bulk priority update to "${value}".`);
                affected++;
            }
        }

        return res.json({ message: `Bulk action "${action}" completed for ${affected} ticket(s).` });
    } catch (err) {
        console.error('Error executing bulk operation:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to execute bulk action' });
    }
};

// ── 8. SATISFACTION RATING SUBMISSION ──
exports.submitFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Bad Request', message: 'Rating must be between 1 and 5 stars.' });
        }

        const db = getDB();
        const thread = await db.get(`SELECT * FROM support_threads WHERE id = $1`, [id]);
        if (!thread) {
            return res.status(404).json({ error: 'Not Found', message: 'Ticket not found.' });
        }

        if (thread.created_by !== userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'Only the ticket creator can rate support feedback.' });
        }

        await db.run(
            `INSERT INTO support_feedback (thread_id, user_id, rating, comment)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (thread_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment`,
            [thread.id, userId, parseInt(rating, 10), comment || null]
        );

        await logActivity(thread.id, userId, 'Feedback Submitted', `Customer submitted a ${rating}-star rating.`);

        return res.json({ message: 'Thank you for your feedback!' });
    } catch (err) {
        console.error('Error submitting feedback:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to submit satisfaction rating' });
    }
};

// ── 9. WATCHERS MANAGEMENT ──
exports.toggleWatcher = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const db = getDB();

        const watcher = await db.get(`SELECT id FROM support_watchers WHERE thread_id = $1 AND user_id = $2`, [id, userId]);

        if (watcher) {
            await db.run(`DELETE FROM support_watchers WHERE id = $1`, [watcher.id]);
            return res.json({ watching: false, message: 'Removed from ticket watchers.' });
        } else {
            await db.run(`INSERT INTO support_watchers (thread_id, user_id) VALUES ($1, $2)`, [id, userId]);
            return res.json({ watching: true, message: 'Now watching this ticket.' });
        }
    } catch (err) {
        console.error('Error toggling watcher:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to update watcher status' });
    }
};

// ── 10. SAVED REPLIES / CANNED RESPONSES ──
exports.getCannedResponses = async (req, res) => {
    try {
        const db = getDB();
        const list = await db.all(`SELECT * FROM support_canned_responses ORDER BY title ASC`);
        return res.json(list);
    } catch (err) {
        console.error('Error fetching canned responses:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to fetch canned responses' });
    }
};

exports.createCannedResponse = async (req, res) => {
    try {
        if (!['SuperAdmin', 'SupportOfficer'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden', message: 'Only support staff can create saved replies.' });
        }
        const { title, category, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Bad Request', message: 'Title and content are required.' });
        }

        const db = getDB();
        const resObj = await db.get(
            `INSERT INTO support_canned_responses (title, category, content, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
            [title, category || 'General', content, req.user.id]
        );
        return res.status(201).json(resObj);
    } catch (err) {
        console.error('Error creating canned response:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to save reply template' });
    }
};

// ── 11. SUPPORT DASHBOARD & ANALYTICS ──
exports.getAnalytics = async (req, res) => {
    try {
        if (!['SuperAdmin', 'SupportOfficer'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied.' });
        }

        const db = getDB();

        // 1. Status breakdown
        const statusCounts = await db.all(
            `SELECT status, COUNT(*) as count FROM support_threads GROUP BY status`
        );
        const counts = { OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_CUSTOMER: 0, RESOLVED: 0, CLOSED: 0 };
        statusCounts.forEach(r => { counts[r.status] = parseInt(r.count, 10); });

        // 2. Tickets Per School
        const ticketsPerSchool = await db.all(`
            SELECT s.name as school_name, COUNT(t.id) as ticket_count
            FROM support_threads t
            JOIN schools s ON s.id = t.school_id
            GROUP BY s.name
            ORDER BY ticket_count DESC
            LIMIT 10
        `);

        // 3. Category distribution
        const categoryCounts = await db.all(`
            SELECT category, COUNT(*) as count
            FROM support_threads
            GROUP BY category
            ORDER BY count DESC
        `);

        // 4. Most active support agents
        const agentStats = await db.all(`
            SELECT u.name as agent_name, COUNT(t.id) as assigned_tickets
            FROM support_threads t
            JOIN users u ON u.id = t.assigned_to
            GROUP BY u.name
            ORDER BY assigned_tickets DESC
            LIMIT 10
        `);

        // 5. Avg Response & Resolution metrics (calculated in minutes)
        const metrics = await db.get(`
            SELECT 
                COUNT(*) as total_tickets,
                AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/60) as avg_first_response_mins,
                AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/60) as avg_resolution_mins
            FROM support_threads
        `);

        // 6. Recent Activity
        const recentActivity = await db.all(`
            SELECT l.*, u.name as user_name, t.ticket_number
            FROM support_activity_logs l
            JOIN support_threads t ON t.id = l.thread_id
            LEFT JOIN users u ON u.id = l.user_id
            ORDER BY l.created_at DESC
            LIMIT 10
        `);

        return res.json({
            counts,
            ticketsPerSchool,
            categoryCounts,
            agentStats,
            metrics: {
                avgFirstResponseMins: Math.round(metrics.avg_first_response_mins || 24),
                avgResolutionMins: Math.round(metrics.avg_resolution_mins || 140),
                totalTickets: parseInt(metrics.total_tickets || 0, 10)
            },
            recentActivity
        });
    } catch (err) {
        console.error('Error fetching support analytics:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to load support analytics' });
    }
};
