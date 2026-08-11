const { getDB } = require('../config/database');
const nodemailer = require('nodemailer');

/**
 * Creates an in-app notification record in the database
 */
async function createNotification({ userId, title, message, type = 'support', link = null }) {
    if (!userId) return null;
    try {
        const db = getDB();
        const res = await db.run(
            `INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [userId, title, message, type, link]
        );
        return res.lastID;
    } catch (err) {
        console.error('Failed to create in-app notification:', err);
        return null;
    }
}

/**
 * Sends email alert (log fallback if SMTP is unconfigured)
 */
async function sendEmailNotification({ to, subject, text, html }) {
    if (!to) return;
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
            port: process.env.SMTP_PORT || 587,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const mailOptions = {
            from: process.env.CONTACT_EMAIL_FROM || process.env.SMTP_USER || 'support@eduman.com',
            to,
            subject,
            text,
            html: html || `<p>${text}</p>`
        };

        if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your_brevo_email@example.com') {
            console.log('Intercepted Support Email Notification (Dev Mode):', mailOptions.subject, 'To:', to);
            return;
        }

        await transporter.sendMail(mailOptions);
    } catch (err) {
        console.error('Failed to send email notification:', err.message);
    }
}

/**
 * Triggered when a new ticket is created.
 * Notifies SuperAdmin / Support Officers.
 */
async function notifyNewTicket(thread, creatorUser) {
    try {
        const db = getDB();
        const supportStaff = await db.all(
            `SELECT id, email FROM users WHERE role IN ('SuperAdmin', 'SupportOfficer') AND is_active = 1`
        );

        const title = `New Ticket #${thread.ticket_number}`;
        const message = `[${thread.category}] ${thread.subject} - Submitted by ${creatorUser.name}`;
        const link = `/dashboard/support/tickets/${thread.id}`;

        for (const staff of supportStaff) {
            await createNotification({ userId: staff.id, title, message, link });
            if (staff.email) {
                sendEmailNotification({
                    to: staff.email,
                    subject: `[EDUMAN Support] ${title}`,
                    text: `A new ticket #${thread.ticket_number} has been created by ${creatorUser.name}.\nSubject: ${thread.subject}\nCategory: ${thread.category}\nPriority: ${thread.priority}`
                });
            }
        }
    } catch (err) {
        console.error('Error sending new ticket notifications:', err);
    }
}

/**
 * Triggered when a reply is added.
 * Notifies ticket creator (if support replied) or assigned agent / support (if user replied), plus ticket watchers.
 */
async function notifyNewReply(thread, messageObj, senderUser) {
    try {
        const db = getDB();
        const isSupportSender = ['SuperAdmin', 'SupportOfficer'].includes(senderUser.role);

        // 1. Notify Creator if someone else replied
        if (thread.created_by !== senderUser.id) {
            const creator = await db.get(`SELECT id, email, name FROM users WHERE id = $1`, [thread.created_by]);
            if (creator) {
                const title = `New Reply on Ticket #${thread.ticket_number}`;
                const msg = `${senderUser.name} replied: "${messageObj.message.substring(0, 80)}..."`;
                const link = `/dashboard/support/tickets/${thread.id}`;

                await createNotification({ userId: creator.id, title, message: msg, link });
                if (creator.email) {
                    sendEmailNotification({
                        to: creator.email,
                        subject: `[EDUMAN Support] ${title}`,
                        text: `Hi ${creator.name},\n\nThere is a new reply on ticket #${thread.ticket_number}.\nSender: ${senderUser.name}\nMessage: ${messageObj.message}`
                    });
                }
            }
        }

        // 2. Notify Assigned Agent if user replied
        if (!isSupportSender && thread.assigned_to && thread.assigned_to !== senderUser.id) {
            const agent = await db.get(`SELECT id, email, name FROM users WHERE id = $1`, [thread.assigned_to]);
            if (agent) {
                const title = `Customer Replied on #${thread.ticket_number}`;
                const msg = `${senderUser.name} sent a new response.`;
                const link = `/dashboard/support/tickets/${thread.id}`;

                await createNotification({ userId: agent.id, title, message: msg, link });
                if (agent.email) {
                    sendEmailNotification({
                        to: agent.email,
                        subject: `[EDUMAN Support] ${title}`,
                        text: `Hi ${agent.name},\n\nCustomer ${senderUser.name} replied to ticket #${thread.ticket_number}.\nMessage: ${messageObj.message}`
                    });
                }
            }
        }

        // 3. Notify Watchers
        const watchers = await db.all(
            `SELECT u.id, u.email FROM support_watchers w JOIN users u ON u.id = w.user_id WHERE w.thread_id = $1 AND w.user_id != $2`,
            [thread.id, senderUser.id]
        );
        for (const watcher of watchers) {
            await createNotification({
                userId: watcher.id,
                title: `Activity on Watched Ticket #${thread.ticket_number}`,
                message: `${senderUser.name} added a reply.`,
                link: `/dashboard/support/tickets/${thread.id}`
            });
        }
    } catch (err) {
        console.error('Error sending reply notifications:', err);
    }
}

/**
 * Triggered on assignment change
 */
async function notifyAssignment(thread, assignedToUser, assignerUser) {
    if (!assignedToUser) return;
    try {
        const title = `Assigned to Ticket #${thread.ticket_number}`;
        const message = `You were assigned to handle ticket #${thread.ticket_number} by ${assignerUser.name}`;
        const link = `/dashboard/support/tickets/${thread.id}`;

        await createNotification({ userId: assignedToUser.id, title, message, link });
        if (assignedToUser.email) {
            sendEmailNotification({
                to: assignedToUser.email,
                subject: `[EDUMAN Support] ${title}`,
                text: `Hi ${assignedToUser.name},\n\nYou have been assigned ticket #${thread.ticket_number} (${thread.subject}).`
            });
        }
    } catch (err) {
        console.error('Error sending assignment notification:', err);
    }
}

/**
 * Triggered on status change
 */
async function notifyStatusChange(thread, newStatus, changerUser) {
    try {
        const db = getDB();
        const creator = await db.get(`SELECT id, email, name FROM users WHERE id = $1`, [thread.created_by]);
        if (creator && creator.id !== changerUser.id) {
            const title = `Ticket #${thread.ticket_number} ${newStatus}`;
            const message = `Status changed to ${newStatus} by ${changerUser.name}`;
            const link = `/dashboard/support/tickets/${thread.id}`;

            await createNotification({ userId: creator.id, title, message, link });
            if (creator.email) {
                sendEmailNotification({
                    to: creator.email,
                    subject: `[EDUMAN Support] ${title}`,
                    text: `Hi ${creator.name},\n\nYour ticket #${thread.ticket_number} status has been updated to "${newStatus}".`
                });
            }
        }
    } catch (err) {
        console.error('Error sending status change notification:', err);
    }
}

/**
 * Triggered when users are mentioned with @user
 */
async function notifyMentions(thread, mentionUserIds, senderUser) {
    if (!mentionUserIds || !Array.isArray(mentionUserIds) || mentionUserIds.length === 0) return;
    try {
        const db = getDB();
        for (const uid of mentionUserIds) {
            if (uid === senderUser.id) continue;
            const user = await db.get(`SELECT id, email, name FROM users WHERE id = $1`, [uid]);
            if (user) {
                const title = `Mentioned in Ticket #${thread.ticket_number}`;
                const message = `${senderUser.name} mentioned you in a message on #${thread.ticket_number}`;
                const link = `/dashboard/support/tickets/${thread.id}`;

                await createNotification({ userId: user.id, title, message, link });
                if (user.email) {
                    sendEmailNotification({
                        to: user.email,
                        subject: `[EDUMAN Support] ${title}`,
                        text: `Hi ${user.name},\n\n${senderUser.name} mentioned you in ticket #${thread.ticket_number}.`
                    });
                }
            }
        }
    } catch (err) {
        console.error('Error notifying mentions:', err);
    }
}

/**
 * Sends welcome email with account credentials to newly registered users
 */
async function sendWelcomeEmail({ email, name, role, schoolName = 'EduMan', password = null }) {
    if (!email) return;
    try {
        const appUrl = process.env.OPENROUTER_SITE_URL || 'https://eduman.africa';
        const loginUrl = `${appUrl}/login`;
        const subject = `Welcome to EduMan — Account Access & Credentials`;

        const passwordHtml = password
            ? `<div style="background-color:#f3f4f6; border-left:4px solid #4f46e5; padding:12px 16px; margin:16px 0; border-radius:4px;">
                <p style="margin:0 0 4px 0; font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:bold;">Your Temporary Password</p>
                <code style="font-size:16px; font-weight:bold; color:#1f2937; background:#e5e7eb; padding:4px 8px; border-radius:4px;">${password}</code>
               </div>`
            : '';

        const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #4f46e5; color: #ffffff; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Welcome to EduMan</h1>
                <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Smart School Management System</p>
            </div>
            <div style="padding: 24px; color: #374151; line-height: 1.6;">
                <p style="font-size: 16px; margin-top: 0;">Hi <strong>${name}</strong>,</p>
                <p>Your account has been created for <strong>${schoolName}</strong> with the role of <strong>${role}</strong>.</p>
                
                <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <p style="margin: 0; font-size: 14px;"><strong>Login Email:</strong> ${email}</p>
                    <p style="margin: 6px 0 0 0; font-size: 14px;"><strong>Role:</strong> ${role}</p>
                </div>

                ${passwordHtml}

                <p style="margin-top: 24px; text-align: center;">
                    <a href="${loginUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Log In to EduMan</a>
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                    If you have any questions, contact your school administrator or reach out to us at <a href="mailto:hello@eduman.africa" style="color: #4f46e5;">hello@eduman.africa</a>.
                </p>
            </div>
        </div>
        `;

        const text = `Hi ${name},\n\nWelcome to EduMan! Your account has been created for ${schoolName} as a ${role}.\n\nLogin Email: ${email}\n${password ? `Temporary Password: ${password}\n` : ''}\nLog in here: ${loginUrl}`;

        await sendEmailNotification({ to: email, subject, text, html });
    } catch (err) {
        console.error('Failed to send welcome email:', err);
    }
}

module.exports = {
    createNotification,
    sendEmailNotification,
    sendWelcomeEmail,
    notifyNewTicket,
    notifyNewReply,
    notifyAssignment,
    notifyStatusChange,
    notifyMentions
};

