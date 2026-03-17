const request = require('supertest');
const app = require('../app');
const { initDB, getDB } = require('../config/database');

let db;

beforeAll(async () => {
  db = await initDB();
});

describe('Auth API', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('ok');
  });

  it('should login with default admin credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@eduman.local',
        password: 'password123'
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
    // First login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@eduman.local',
        password: 'password123'
      });
    
    const token = loginRes.body.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.user.email).toEqual('admin@eduman.local');
  });
});
