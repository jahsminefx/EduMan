const request = require('supertest');
const app = require('../app');
const { initDB, closeDB, getDB } = require('../config/database');
const pushService = require('../services/pushNotificationService');

let adminToken = '';

beforeAll(async () => {
  await initDB();

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'admin@eduman.local',
      password: 'password123'
    });
  adminToken = adminLogin.body.token;
});

afterAll(async () => {
  await closeDB();
});

describe('Web Push Notification System Tests', () => {
  it('should return a valid VAPID public key', async () => {
    const res = await request(app)
      .get('/api/notifications/vapid-public-key')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('publicKey');
    expect(typeof res.body.publicKey).toBe('string');
    expect(res.body.publicKey.length).toBeGreaterThan(10);
  });

  it('should save a device push subscription for the logged in user', async () => {
    const dummyEndpoint = `https://fcm.googleapis.com/fcm/send/test-endpoint-${Date.now()}`;
    const res = await request(app)
      .post('/api/notifications/push-subscribe')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        endpoint: dummyEndpoint,
        keys: {
          p256dh: 'BNcRdreA1Ki9yO5pY9',
          auth: 'tHB2w7yK'
        }
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toContain('subscribed to native push notifications');

    // Verify DB entry
    const db = getDB();
    const sub = await db.get(`SELECT * FROM web_push_subscriptions WHERE endpoint = $1`, [dummyEndpoint]);
    expect(sub).toBeDefined();
    expect(sub.p256dh).toBe('BNcRdreA1Ki9yO5pY9');

    // Clean up test endpoint
    await request(app)
      .delete('/api/notifications/push-subscribe')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ endpoint: dummyEndpoint });
  });

  it('should allow SuperAdmin to broadcast notifications to users and active push devices', async () => {
    const res = await request(app)
      .post('/api/notifications/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Platform Maintenance Notice',
        message: 'EduMan will undergo scheduled maintenance tonight at midnight.',
        link: '/dashboard',
        targetRole: 'ALL'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('usersNotified');
    expect(res.body).toHaveProperty('pushedDevices');
    expect(res.body.message).toContain('Platform broadcast sent');
  });
});
