const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendWelcomeEmail, createNotification } = require('../services/notificationService');
const { generateSetupToken, recordInvitationAudit } = require('../utils/tokenUtils');

async function logFinancialAudit(client, schoolId, userId, action, entityType, entityId, details) {
    try {
        await client.run(
            `INSERT INTO financial_audit_logs (school_id, user_id, action, entity_type, entity_id, details)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [schoolId, userId || null, action, entityType, entityId || null, details || '']
        );
    } catch (err) {
        console.error('Failed to record financial audit log:', err);
    }
}

// ── 1. FINANCE OVERVIEW DASHBOARD METRICS ──
exports.getOverview = async (req, res) => {
    try {
        const school_id = req.user.school_id;
        const db = getDB();

        const invStats = await db.get(`
            SELECT 
                COALESCE(SUM(total_amount - discount_amount), 0) as expected,
                COALESCE(SUM(paid_amount), 0) as collected,
                COALESCE(SUM(outstanding_amount), 0) as outstanding,
                COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END) as overdue_count,
                COUNT(*) as total_invoices
            FROM student_fee_invoices
            WHERE school_id = $1 AND status != 'CANCELLED'
        `, [school_id]);

        const todayStr = new Date().toISOString().split('T')[0];
        const todayCollections = await db.get(`
            SELECT COALESCE(SUM(amount), 0) as today_total
            FROM fee_payments
            WHERE school_id = $1 AND status = 'VERIFIED' AND DATE(payment_date) = $2
        `, [school_id, todayStr]);

        const expected = parseFloat(invStats?.expected || 0);
        const collected = parseFloat(invStats?.collected || 0);
        const outstanding = parseFloat(invStats?.outstanding || 0);
        const collectionRate = expected > 0 ? Math.round((collected / expected) * 100 * 10) / 10 : 0;

        const recentPayments = await db.all(`
            SELECT 
                p.*,
                s.first_name || ' ' || s.last_name as student_name,
                s.admission_number,
                c.name as class_name
            FROM fee_payments p
            JOIN students s ON p.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE p.school_id = $1
            ORDER BY p.payment_date DESC
            LIMIT 10
        `, [school_id]);

        res.json({
            overview: {
                expected,
                collected,
                outstanding,
                collectionRate,
                todayCollections: parseFloat(todayCollections?.today_total || 0),
                overdueCount: parseInt(invStats?.overdue_count || 0, 10),
                totalInvoices: parseInt(invStats?.total_invoices || 0, 10)
            },
            recentPayments
        });
    } catch (err) {
        console.error('Error fetching finance overview:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve financial overview' });
    }
};

// ── 2. FEE STRUCTURE MANAGEMENT ──
exports.getFeeStructures = async (req, res) => {
    try {
        const school_id = req.user.school_id;
        const db = getDB();

        const feeStructures = await db.all(`
            SELECT 
                fs.*,
                acs.name as session_name,
                act.name as term_name,
                c.name as class_name
            FROM fee_structures fs
            LEFT JOIN academic_sessions acs ON fs.academic_session_id = acs.id
            LEFT JOIN academic_terms act ON fs.term_id = act.id
            LEFT JOIN classes c ON fs.class_id = c.id
            WHERE fs.school_id = $1
            ORDER BY fs.id DESC
        `, [school_id]);

        res.json({ feeStructures });
    } catch (err) {
        console.error('Error fetching fee structures:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve fee structures' });
    }
};

exports.createFeeStructure = async (req, res) => {
    try {
        const { name, amount, academic_session_id, term_id, class_id, description, due_date } = req.body;
        const school_id = req.user.school_id;
        const userId = req.user.id;

        if (!name || amount == null || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'Valid fee name and positive amount are required.' });
        }

        const db = getDB();
        const result = await db.get(`
            INSERT INTO fee_structures (school_id, name, amount, academic_session_id, term_id, class_id, description, due_date, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
        `, [school_id, name.trim(), parseFloat(amount), academic_session_id || null, term_id || null, class_id || null, description || null, due_date || null, userId]);

        await logFinancialAudit(db, school_id, userId, 'FEE_CREATED', 'fee_structures', result.id, `Created fee structure "${name}" (₦${amount})`);

        res.status(201).json({ message: 'Fee structure created successfully', feeStructure: result });
    } catch (err) {
        console.error('Error creating fee structure:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to create fee structure' });
    }
};

exports.assignFeesToStudents = async (req, res) => {
    try {
        const { fee_structure_ids = [], class_id = null, academic_session_id = null, term_id = null, due_date = null } = req.body;
        const school_id = req.user.school_id;
        const userId = req.user.id;

        if (!Array.isArray(fee_structure_ids) || fee_structure_ids.length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'Please select at least one fee structure.' });
        }

        const db = getDB();

        // Get target students
        let studentQuery = `SELECT id FROM students WHERE school_id = $1`;
        let params = [school_id];
        if (class_id) {
            studentQuery += ` AND class_id = $2`;
            params.push(class_id);
        }
        const students = await db.all(studentQuery, params);

        if (students.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'No students found matching target criteria.' });
        }

        // Fetch selected fee structures
        const feeItems = await db.all(`SELECT * FROM fee_structures WHERE id = ANY($1) AND school_id = $2`, [fee_structure_ids, school_id]);

        let invoicesCreated = 0;

        await db.transaction(async (client) => {
            const countRes = await client.get(`SELECT COUNT(*) as count FROM student_fee_invoices`);
            let invSeq = parseInt(countRes?.count || 0, 10);

            for (const student of students) {
                // Check if an open invoice already exists for this term/session
                let existingInvoice = await client.get(`
                    SELECT id, total_amount, discount_amount, paid_amount 
                    FROM student_fee_invoices 
                    WHERE school_id = $1 AND student_id = $2 AND session_id IS NOT DISTINCT FROM $3 AND term_id IS NOT DISTINCT FROM $4 AND status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID')
                    LIMIT 1
                `, [school_id, student.id, academic_session_id || null, term_id || null]);

                let invoiceId;
                let currentTotal = 0;

                if (existingInvoice) {
                    invoiceId = existingInvoice.id;
                    currentTotal = parseFloat(existingInvoice.total_amount);
                } else {
                    invSeq++;
                    const invNum = `INV-2026-${String(invSeq).padStart(6, '0')}-${Math.floor(100 + Math.random() * 900)}`;
                    const invRes = await client.run(`
                        INSERT INTO student_fee_invoices (invoice_number, school_id, student_id, session_id, term_id, status, due_date, created_by)
                        VALUES ($1, $2, $3, $4, $5, 'ISSUED', $6, $7) RETURNING id
                    `, [invNum, school_id, student.id, academic_session_id || null, term_id || null, due_date || null, userId]);
                    invoiceId = invRes.lastID;
                    invoicesCreated++;
                }

                // Add line items
                for (const fee of feeItems) {
                    await client.run(`
                        INSERT INTO invoice_items (invoice_id, fee_structure_id, description, amount)
                        VALUES ($1, $2, $3, $4)
                    `, [invoiceId, fee.id, fee.name, fee.amount]);
                    currentTotal += parseFloat(fee.amount);
                }

                // Update invoice totals
                const discount = existingInvoice ? parseFloat(existingInvoice.discount_amount) : 0;
                const paid = existingInvoice ? parseFloat(existingInvoice.paid_amount) : 0;
                const outstanding = Math.max(0, currentTotal - discount - paid);

                await client.run(`
                    UPDATE student_fee_invoices
                    SET total_amount = $1, outstanding_amount = $2, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3
                `, [currentTotal, outstanding, invoiceId]);
            }

            await logFinancialAudit(client, school_id, userId, 'FEE_ASSIGNED', 'student_fee_invoices', null, `Assigned fees to ${students.length} students (${invoicesCreated} new invoices)`);
        });

        res.json({ message: `Successfully assigned fees to ${students.length} student(s).`, invoicesCreated });
    } catch (err) {
        console.error('Error assigning fees:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to assign fees' });
    }
};

// ── 3. INVOICE LISTING & DETAILS ──
exports.getInvoices = async (req, res) => {
    try {
        const school_id = req.user.school_id;
        const { status = '', search = '', class_id = '' } = req.query;
        const db = getDB();

        let whereClauses = [`inv.school_id = $1`];
        let params = [school_id];
        let pIdx = 2;

        if (status) {
            whereClauses.push(`inv.status = $${pIdx++}`);
            params.push(status);
        }
        if (class_id) {
            whereClauses.push(`s.class_id = $${pIdx++}`);
            params.push(parseInt(class_id, 10));
        }
        if (search.trim()) {
            const term = `%${search.trim()}%`;
            whereClauses.push(`(inv.invoice_number ILIKE $${pIdx} OR s.first_name ILIKE $${pIdx} OR s.last_name ILIKE $${pIdx} OR s.admission_number ILIKE $${pIdx})`);
            params.push(term);
            pIdx++;
        }

        const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

        const invoices = await db.all(`
            SELECT 
                inv.*,
                s.first_name || ' ' || s.last_name as student_name,
                s.admission_number,
                c.name as class_name,
                acs.name as session_name,
                act.name as term_name
            FROM student_fee_invoices inv
            JOIN students s ON inv.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN academic_sessions acs ON inv.session_id = acs.id
            LEFT JOIN academic_terms act ON inv.term_id = act.id
            ${whereSql}
            ORDER BY inv.id DESC
        `, params);

        res.json({ invoices });
    } catch (err) {
        console.error('Error fetching invoices:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve invoices' });
    }
};

exports.getInvoiceById = async (req, res) => {
    try {
        const { id } = req.params;
        const school_id = req.user.school_id;
        const db = getDB();

        const invoice = await db.get(`
            SELECT 
                inv.*,
                s.first_name || ' ' || s.last_name as student_name,
                s.admission_number,
                s.parent_name,
                s.parent_phone,
                c.name as class_name,
                sch.name as school_name,
                acs.name as session_name,
                act.name as term_name
            FROM student_fee_invoices inv
            JOIN students s ON inv.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            JOIN schools sch ON inv.school_id = sch.id
            LEFT JOIN academic_sessions acs ON inv.session_id = acs.id
            LEFT JOIN academic_terms act ON inv.term_id = act.id
            WHERE inv.id = $1 AND inv.school_id = $2
        `, [id, school_id]);

        if (!invoice) {
            return res.status(404).json({ error: 'Not Found', message: 'Invoice not found.' });
        }

        const items = await db.all(`SELECT * FROM invoice_items WHERE invoice_id = $1`, [invoice.id]);
        const payments = await db.all(`SELECT * FROM fee_payments WHERE invoice_id = $1 ORDER BY payment_date DESC`, [invoice.id]);
        const discounts = await db.all(`SELECT * FROM fee_discounts WHERE invoice_id = $1 ORDER BY created_at DESC`, [invoice.id]);

        res.json({ invoice: { ...invoice, items, payments, discounts } });
    } catch (err) {
        console.error('Error fetching invoice details:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve invoice details' });
    }
};

// ── 4. TRANSACTIONAL PAYMENT RECORDING ──
exports.recordPayment = async (req, res) => {
    try {
        const { invoice_id, amount, payment_method = 'CASH', notes = '' } = req.body;
        const school_id = req.user.school_id;
        const userId = req.user.id;

        const payAmount = parseFloat(amount);
        if (!invoice_id || isNaN(payAmount) || payAmount <= 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invoice ID and positive payment amount are required.' });
        }

        const db = getDB();

        const paymentResult = await db.transaction(async (client) => {
            // 1. Lock and validate invoice
            const invoice = await client.get(`SELECT * FROM student_fee_invoices WHERE id = $1 AND school_id = $2`, [invoice_id, school_id]);
            if (!invoice) {
                throw new Error('INVOICE_NOT_FOUND');
            }
            if (invoice.status === 'CANCELLED') {
                throw new Error('INVOICE_CANCELLED');
            }

            // 2. Generate unique payment reference
            const countRes = await client.get(`SELECT COUNT(*) as count FROM fee_payments`);
            const paySeq = parseInt(countRes?.count || 0, 10) + 1;
            const payRef = `PAY-2026-${String(paySeq).padStart(6, '0')}-${Math.floor(100 + Math.random() * 900)}`;

            // 3. Status determination (CASH/CARD/ONLINE = VERIFIED by default, BANK_TRANSFER pending if specified)
            const payStatus = payment_method === 'BANK_TRANSFER' ? 'PENDING' : 'VERIFIED';

            // 4. Create payment record
            const payRes = await client.run(`
                INSERT INTO fee_payments (payment_reference, school_id, invoice_id, student_id, amount, payment_method, status, recorded_by, verified_by, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
            `, [payRef, school_id, invoice.id, invoice.student_id, payAmount, payment_method, payStatus, userId, payStatus === 'VERIFIED' ? userId : null, notes || null]);

            let updatedPaid = parseFloat(invoice.paid_amount);
            let updatedOutstanding = parseFloat(invoice.outstanding_amount);
            let newStatus = invoice.status;

            if (payStatus === 'VERIFIED') {
                updatedPaid += payAmount;
                updatedOutstanding = Math.max(0, parseFloat(invoice.total_amount) - parseFloat(invoice.discount_amount) - updatedPaid);

                if (updatedOutstanding <= 0) {
                    newStatus = 'PAID';
                } else if (updatedPaid > 0) {
                    newStatus = 'PARTIALLY_PAID';
                }

                await client.run(`
                    UPDATE student_fee_invoices
                    SET paid_amount = $1, outstanding_amount = $2, status = $3, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $4
                `, [updatedPaid, updatedOutstanding, newStatus, invoice.id]);
            }

            await logFinancialAudit(client, school_id, userId, 'PAYMENT_RECORDED', 'fee_payments', payRes.lastID, `Recorded ${payment_method} payment of ₦${payAmount} (${payRef}) for invoice ${invoice.invoice_number}`);

            return { payment: payRes, invoiceStatus: newStatus, outstanding: updatedOutstanding };
        });

        // Async Parent In-App Notification
        const student = await db.get(`SELECT first_name, last_name FROM students WHERE id = (SELECT student_id FROM student_fee_invoices WHERE id = $1)`, [invoice_id]);
        const parentLinks = await db.all(`SELECT parent_user_id FROM parent_student_links WHERE student_id = (SELECT student_id FROM student_fee_invoices WHERE id = $1)`, [invoice_id]);
        
        for (const p of parentLinks) {
            await createNotification({
                userId: p.parent_user_id,
                title: `Fee Payment Received: ₦${payAmount.toLocaleString()}`,
                message: `Payment received for ${student?.first_name || 'student'}'s school fees (${paymentResult.payment.payment_reference}).`,
                type: 'finance',
                link: `/dashboard/parent/fees`
            });
        }

        res.status(201).json({ message: 'Payment recorded successfully', ...paymentResult });
    } catch (err) {
        if (err.message === 'INVOICE_NOT_FOUND') {
            return res.status(404).json({ error: 'Not Found', message: 'Invoice not found.' });
        }
        if (err.message === 'INVOICE_CANCELLED') {
            return res.status(400).json({ error: 'Bad Request', message: 'Cannot record payment on a cancelled invoice.' });
        }
        console.error('Error recording payment:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to record payment' });
    }
};

// ── 5. VERIFY PENDING BANK TRANSFER ──
exports.verifyPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const school_id = req.user.school_id;
        const userId = req.user.id;
        const db = getDB();

        await db.transaction(async (client) => {
            const payment = await client.get(`SELECT * FROM fee_payments WHERE id = $1 AND school_id = $2`, [id, school_id]);
            if (!payment) throw new Error('PAYMENT_NOT_FOUND');
            if (payment.status === 'VERIFIED') throw new Error('ALREADY_VERIFIED');

            const invoice = await client.get(`SELECT * FROM student_fee_invoices WHERE id = $1`, [payment.invoice_id]);
            if (!invoice) throw new Error('INVOICE_NOT_FOUND');

            const updatedPaid = parseFloat(invoice.paid_amount) + parseFloat(payment.amount);
            const updatedOutstanding = Math.max(0, parseFloat(invoice.total_amount) - parseFloat(invoice.discount_amount) - updatedPaid);

            let newStatus = invoice.status;
            if (updatedOutstanding <= 0) {
                newStatus = 'PAID';
            } else if (updatedPaid > 0) {
                newStatus = 'PARTIALLY_PAID';
            }

            await client.run(`UPDATE fee_payments SET status = 'VERIFIED', verified_by = $1 WHERE id = $2`, [userId, payment.id]);
            await client.run(`UPDATE student_fee_invoices SET paid_amount = $1, outstanding_amount = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`, [updatedPaid, updatedOutstanding, invoice.id]);

            await logFinancialAudit(client, school_id, userId, 'PAYMENT_VERIFIED', 'fee_payments', payment.id, `Verified payment ${payment.payment_reference}`);
        });

        res.json({ message: 'Payment verified successfully' });
    } catch (err) {
        console.error('Error verifying payment:', err);
        res.status(500).json({ error: 'Server Error', message: err.message || 'Failed to verify payment' });
    }
};

// ── 6. APPLY AUTHORIZED DISCOUNT / WAIVER ──
exports.applyDiscount = async (req, res) => {
    try {
        const { invoice_id, discount_amount, reason } = req.body;
        const school_id = req.user.school_id;
        const userId = req.user.id;
        const disc = parseFloat(discount_amount);

        if (!invoice_id || isNaN(disc) || disc <= 0 || !reason || !reason.trim()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invoice ID, positive discount amount, and reason are required.' });
        }

        const db = getDB();

        await db.transaction(async (client) => {
            const invoice = await client.get(`SELECT * FROM student_fee_invoices WHERE id = $1 AND school_id = $2`, [invoice_id, school_id]);
            if (!invoice) throw new Error('INVOICE_NOT_FOUND');

            const newDiscount = parseFloat(invoice.discount_amount) + disc;
            const newOutstanding = Math.max(0, parseFloat(invoice.total_amount) - newDiscount - parseFloat(invoice.paid_amount));

            let newStatus = invoice.status;
            if (newOutstanding <= 0) newStatus = 'PAID';

            await client.run(`INSERT INTO fee_discounts (invoice_id, school_id, discount_amount, reason, applied_by) VALUES ($1, $2, $3, $4, $5)`, [invoice.id, school_id, disc, reason.trim(), userId]);
            await client.run(`UPDATE student_fee_invoices SET discount_amount = $1, outstanding_amount = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`, [newDiscount, newOutstanding, newStatus, invoice.id]);

            await logFinancialAudit(client, school_id, userId, 'DISCOUNT_APPLIED', 'student_fee_invoices', invoice.id, `Applied discount of ₦${disc}. Reason: ${reason.trim()}`);
        });

        res.json({ message: 'Discount applied successfully' });
    } catch (err) {
        console.error('Error applying discount:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to apply discount' });
    }
};

// ── 7. NON-DESTRUCTIVE PAYMENT REFUND / REVERSAL ──
exports.processRefund = async (req, res) => {
    try {
        const { payment_id, refund_amount, reason } = req.body;
        const school_id = req.user.school_id;
        const userId = req.user.id;
        const refAmt = parseFloat(refund_amount);

        if (!payment_id || isNaN(refAmt) || refAmt <= 0 || !reason || !reason.trim()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Payment ID, positive refund amount, and reason are required.' });
        }

        const db = getDB();

        await db.transaction(async (client) => {
            const payment = await client.get(`SELECT * FROM fee_payments WHERE id = $1 AND school_id = $2`, [payment_id, school_id]);
            if (!payment) throw new Error('PAYMENT_NOT_FOUND');
            if (payment.status !== 'VERIFIED') throw new Error('ONLY_VERIFIED_REFUNDABLE');

            const invoice = await client.get(`SELECT * FROM student_fee_invoices WHERE id = $1`, [payment.invoice_id]);

            const updatedPaid = Math.max(0, parseFloat(invoice.paid_amount) - refAmt);
            const updatedOutstanding = Math.max(0, parseFloat(invoice.total_amount) - parseFloat(invoice.discount_amount) - updatedPaid);

            let newStatus = invoice.status;
            if (updatedOutstanding > 0 && updatedPaid > 0) newStatus = 'PARTIALLY_PAID';
            if (updatedPaid === 0) newStatus = 'ISSUED';

            await client.run(`INSERT INTO fee_refunds (payment_id, school_id, refund_amount, reason, processed_by) VALUES ($1, $2, $3, $4, $5)`, [payment.id, school_id, refAmt, reason.trim(), userId]);
            await client.run(`UPDATE fee_payments SET status = 'REFUNDED' WHERE id = $1`, [payment.id]);
            await client.run(`UPDATE student_fee_invoices SET paid_amount = $1, outstanding_amount = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`, [updatedPaid, updatedOutstanding, newStatus, invoice.id]);

            await logFinancialAudit(client, school_id, userId, 'REFUND_PROCESSED', 'fee_payments', payment.id, `Refunded ₦${refAmt} on payment ${payment.payment_reference}. Reason: ${reason.trim()}`);
        });

        res.json({ message: 'Refund processed successfully' });
    } catch (err) {
        console.error('Error processing refund:', err);
        res.status(500).json({ error: 'Server Error', message: err.message || 'Failed to process refund' });
    }
};

// ── 8. FINANCIAL REPORTS & AUDIT LOGS ──
exports.getReports = async (req, res) => {
    try {
        const school_id = req.user.school_id;
        const db = getDB();

        const byCategory = await db.all(`
            SELECT ii.description as fee_name, SUM(ii.amount) as total_expected
            FROM invoice_items ii
            JOIN student_fee_invoices inv ON ii.invoice_id = inv.id
            WHERE inv.school_id = $1 AND inv.status != 'CANCELLED'
            GROUP BY ii.description
        `, [school_id]);

        const byClass = await db.all(`
            SELECT c.name as class_name, SUM(inv.total_amount) as expected, SUM(inv.paid_amount) as collected, SUM(inv.outstanding_amount) as outstanding
            FROM student_fee_invoices inv
            JOIN students s ON inv.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE inv.school_id = $1 AND inv.status != 'CANCELLED'
            GROUP BY c.name
        `, [school_id]);

        res.json({ byCategory, byClass });
    } catch (err) {
        console.error('Error fetching financial reports:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve reports' });
    }
};

exports.getAuditLogs = async (req, res) => {
    try {
        const school_id = req.user.school_id;
        const db = getDB();

        const auditLogs = await db.all(`
            SELECT fal.*, u.name as user_name, u.role as user_role
            FROM financial_audit_logs fal
            LEFT JOIN users u ON fal.user_id = u.id
            WHERE fal.school_id = $1
            ORDER BY fal.created_at DESC
            LIMIT 100
        `, [school_id]);

        res.json({ auditLogs });
    } catch (err) {
        console.error('Error fetching financial audit logs:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve audit logs' });
    }
};

// ── 9. CREATE ACCOUNTANT STAFF ACCOUNT (SCHOOL ADMIN) ──
exports.createAccountant = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const school_id = req.user.school_id;

        if (!name || !email) {
            return res.status(400).json({ error: 'Bad Request', message: 'Name and email are required.' });
        }

        const db = getDB();
        const existing = await db.get(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email.trim()]);
        if (existing) {
            return res.status(400).json({ error: 'Duplicate', message: 'Email already exists.' });
        }

        const { rawToken, tokenHash } = generateSetupToken();
        const initialPass = password || crypto.randomBytes(16).toString('hex');
        const password_hash = await bcrypt.hash(initialPass, 10);
        
        const newUser = await db.get(`
            INSERT INTO users (name, email, password_hash, role, setup_token, setup_token_expires)
            VALUES ($1, $2, $3, 'Accountant', $4, CURRENT_TIMESTAMP + INTERVAL '7 days') RETURNING id, name, email, role
        `, [name.trim(), email.trim().toLowerCase(), password_hash, tokenHash]);

        // Assign to school
        await db.run(`INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)`, [newUser.id, school_id]);

        // Audit Trail
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
        await recordInvitationAudit({
            actorId: req.user?.id,
            action: 'INVITATION_CREATED',
            targetUserId: newUser.id,
            role: 'Accountant',
            reason: `Created accountant account for ${newUser.name}`,
            ipAddress: clientIp
        });

        const schoolObj = await db.get(`SELECT name FROM schools WHERE id = $1`, [school_id]);
        sendWelcomeEmail({
            email: newUser.email,
            name: newUser.name,
            role: 'Accountant',
            schoolName: schoolObj?.name || 'EduMan School',
            token: rawToken
        }).catch(() => {});

        res.status(201).json({ message: 'Accountant account created successfully. Invitation link sent.', accountant: newUser });
    } catch (err) {
        console.error('Error creating accountant:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to create accountant' });
    }
};
