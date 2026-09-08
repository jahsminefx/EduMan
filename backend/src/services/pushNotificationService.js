const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
const { getDB } = require('../config/database');

let vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
};

// Auto-generate VAPID keys if not present in environment
const keyFilePath = path.join(__dirname, '../config/vapid_keys.json');

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    if (fs.existsSync(keyFilePath)) {
        try {
            const saved = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
            vapidKeys.publicKey = saved.publicKey;
            vapidKeys.privateKey = saved.privateKey;
        } catch (e) {
            console.error('Failed to read saved VAPID keys:', e);
        }
    }

    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
        const generated = webpush.generateVAPIDKeys();
        vapidKeys.publicKey = generated.publicKey;
        vapidKeys.privateKey = generated.privateKey;
        try {
            fs.writeFileSync(keyFilePath, JSON.stringify(vapidKeys, null, 2), 'utf8');
            console.log('Generated new persistent VAPID keys for Web Push Notifications.');
        } catch (e) {
            console.error('Failed to save VAPID keys file:', e);
        }
    }
}

try {
    webpush.setVapidDetails(
        'mailto:support@eduman.africa',
        vapidKeys.publicKey,
        vapidKeys.privateKey
    );
} catch (err) {
    console.error('Error setting VAPID details:', err);
}

function getVapidPublicKey() {
    return vapidKeys.publicKey;
}

/**
 * Send Web Push notification to a specific user across all their registered devices
 */
async function sendPushToUser(userId, payload) {
    if (!userId) return;
    try {
        const db = getDB();
        const subs = await db.all(
            `SELECT id, endpoint, p256dh, auth FROM web_push_subscriptions WHERE user_id = $1`,
            [userId]
        );

        if (!subs || subs.length === 0) return;

        const pushPayload = JSON.stringify({
            title: payload.title || 'EduMan Notification',
            body: payload.message || payload.body || '',
            icon: payload.icon || '/favicon.ico',
            badge: '/favicon.ico',
            data: {
                link: payload.link || '/dashboard',
                timestamp: Date.now()
            }
        });

        for (const sub of subs) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, pushPayload);
            } catch (err) {
                // If subscription expired or invalid (404 Not Found, 410 Gone), remove from DB
                if (err.statusCode === 404 || err.statusCode === 410) {
                    await db.run(`DELETE FROM web_push_subscriptions WHERE id = $1`, [sub.id]);
                } else {
                    console.error(`Web push error for sub ID ${sub.id}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error(`Failed to send web push to user ${userId}:`, err);
    }
}

/**
 * Broadcast Web Push notification to target users (All, specific role, or specific school)
 */
async function broadcastPushNotification({ title, message, link, targetRole = 'ALL', schoolId = null }) {
    try {
        const db = getDB();
        let query = `SELECT DISTINCT s.user_id 
                     FROM web_push_subscriptions s 
                     JOIN users u ON u.id = s.user_id 
                     WHERE u.is_active = 1`;
        const params = [];

        if (targetRole && targetRole !== 'ALL') {
            query += ` AND u.role = $${params.length + 1}`;
            params.push(targetRole);
        }

        if (schoolId) {
            query += ` AND u.school_id = $${params.length + 1}`;
            params.push(schoolId);
        }

        const userRows = await db.all(query, params);

        for (const userRow of userRows) {
            await sendPushToUser(userRow.user_id, { title, message, link });
        }

        return userRows.length;
    } catch (err) {
        console.error('Failed to broadcast push notification:', err);
        return 0;
    }
}

module.exports = {
    getVapidPublicKey,
    sendPushToUser,
    broadcastPushNotification
};
