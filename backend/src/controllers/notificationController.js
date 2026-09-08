const { getDB } = require('../config/database');

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const db = getDB();

        const notifications = await db.all(
            `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
            [userId]
        );

        const unreadCountRes = await db.get(
            `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = 0`,
            [userId]
        );

        return res.json({
            notifications,
            unreadCount: parseInt(unreadCountRes.count || 0, 10)
        });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve notifications' });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const db = getDB();

        await db.run(`UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2`, [id, userId]);
        return res.json({ message: 'Notification marked as read.' });
    } catch (err) {
        console.error('Error marking notification read:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to update notification' });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const db = getDB();

        await db.run(`UPDATE notifications SET is_read = 1 WHERE user_id = $1`, [userId]);
        return res.json({ message: 'All notifications marked as read.' });
    } catch (err) {
        console.error('Error marking all notifications read:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to update notifications' });
    }
};

const pushService = require('../services/pushNotificationService');
const { createNotification } = require('../services/notificationService');

exports.getVapidPublicKey = async (req, res) => {
    return res.json({ publicKey: pushService.getVapidPublicKey() });
};

exports.subscribePush = async (req, res) => {
    try {
        const userId = req.user.id;
        const { endpoint, keys } = req.body;

        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({ error: 'Bad Request', message: 'Endpoint and subscription keys (p256dh, auth) are required.' });
        }

        const userAgent = req.headers['user-agent'] || null;
        const db = getDB();

        await db.run(
            `INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`,
            [userId, endpoint, keys.p256dh, keys.auth, userAgent]
        );

        return res.status(201).json({ message: 'Device subscribed to native push notifications successfully.' });
    } catch (err) {
        console.error('Error subscribing to push notifications:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to save push subscription' });
    }
};

exports.unsubscribePush = async (req, res) => {
    try {
        const userId = req.user.id;
        const { endpoint } = req.body;
        const db = getDB();

        if (endpoint) {
            await db.run(`DELETE FROM web_push_subscriptions WHERE endpoint = $1 AND user_id = $2`, [endpoint, userId]);
        } else {
            await db.run(`DELETE FROM web_push_subscriptions WHERE user_id = $1`, [userId]);
        }

        return res.json({ message: 'Unsubscribed from push notifications.' });
    } catch (err) {
        console.error('Error unsubscribing push notifications:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to unsubscribe push notifications' });
    }
};

exports.broadcastNotification = async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin') {
            return res.status(403).json({ error: 'Forbidden', message: 'Only SuperAdmin can broadcast platform notifications.' });
        }

        const { title, message, link, targetRole = 'ALL', schoolId = null } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: 'Bad Request', message: 'Title and message are required.' });
        }

        const db = getDB();

        // 1. Fetch targeted users
        let userQuery = `SELECT id FROM users WHERE is_active = 1`;
        const params = [];

        if (targetRole && targetRole !== 'ALL') {
            userQuery += ` AND role = $${params.length + 1}`;
            params.push(targetRole);
        }

        if (schoolId) {
            userQuery += ` AND school_id = $${params.length + 1}`;
            params.push(parseInt(schoolId, 10));
        }

        const users = await db.all(userQuery, params);

        // 2. Create in-app notifications
        for (const u of users) {
            await createNotification({
                userId: u.id,
                title: title.trim(),
                message: message.trim(),
                type: 'broadcast',
                link: link || '/dashboard'
            });
        }

        // 3. Trigger native Web Push Broadcast
        const pushedDeviceCount = await pushService.broadcastPushNotification({
            title: title.trim(),
            message: message.trim(),
            link: link || '/dashboard',
            targetRole,
            schoolId: schoolId ? parseInt(schoolId, 10) : null
        });

        return res.json({
            message: `Platform broadcast sent to ${users.length} user(s) and ${pushedDeviceCount} active device(s).`,
            usersNotified: users.length,
            pushedDevices: pushedDeviceCount
        });
    } catch (err) {
        console.error('Error broadcasting platform notification:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to broadcast notification' });
    }
};
