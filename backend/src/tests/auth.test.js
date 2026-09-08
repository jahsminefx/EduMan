const request = require('supertest');
const app = require('../app');
const { initDB, closeDB } = require('../config/database');

beforeAll(async () => {
  await initDB();
});

afterAll(async () => {
  await closeDB();
});

describe('Auth API', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('ok');
  });

  it('should login with default admin credentials', async () => {
    const defaultPassword = process.env.NODE_ENV === 'test' ? 'password123' : (process.env.SUPERADMIN_PASSWORD || 'ASDFGHJKL');
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@eduman.local',
        password: defaultPassword
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toEqual('admin@eduman.local');
  });

  it('should fail login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@eduman.local',
        password: 'wrongpassword'
      });
    
    expect(res.statusCode).toEqual(401);
  });

  it('should get current user info with valid token', async () => {
    const defaultPassword = process.env.NODE_ENV === 'test' ? 'password123' : (process.env.SUPERADMIN_PASSWORD || 'ASDFGHJKL');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@eduman.local',
        password: defaultPassword
      });
    
    const token = loginRes.body.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.user.email).toEqual('admin@eduman.local');
  });

  it('should process forgot password, verify 6-digit code, and reset password', async () => {
    const { getDB } = require('../config/database');
    const db = getDB();

    // 1. Request forgot password code
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'admin@eduman.local' });
    expect(forgotRes.statusCode).toEqual(200);
    expect(forgotRes.body.message).toContain('6-digit');

    // 2. Fetch reset code from database
    const user = await db.get("SELECT reset_code FROM users WHERE email = 'admin@eduman.local'");
    expect(user.reset_code).toBeDefined();
    expect(user.reset_code.length).toEqual(6);

    // 3. Verify code
    const verifyRes = await request(app)
      .post('/api/auth/verify-reset-code')
      .send({ email: 'admin@eduman.local', code: user.reset_code });
    expect(verifyRes.statusCode).toEqual(200);
    expect(verifyRes.body.valid).toBe(true);

    // 4. Reset password
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        email: 'admin@eduman.local',
        code: user.reset_code,
        newPassword: 'BrandNewPassword123!'
      });
    expect(resetRes.statusCode).toEqual(200);

    // 5. Login with new password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@eduman.local',
        password: 'BrandNewPassword123!'
      });
    expect(loginRes.statusCode).toEqual(200);
    expect(loginRes.body).toHaveProperty('token');
  });
});
