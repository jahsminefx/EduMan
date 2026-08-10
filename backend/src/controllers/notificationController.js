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
