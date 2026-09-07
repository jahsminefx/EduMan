const request = require('supertest');
const app = require('../app');
const { initDB, closeDB } = require('../config/database');

let adminToken = '';
let parentUserId = null;

beforeAll(async () => {
  await initDB();
  
  // Log in as School Admin (Adebayo at Greenfield Academy)
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'adebayo@greenfield.edu.ng',
      password: 'password123'
    });

  adminToken = loginRes.body.token;
});

afterAll(async () => {
  await closeDB();
});

describe('Parents Management API for School Admins', () => {
  it('should fetch all parent accounts and their linked children for the school', async () => {
    const res = await request(app)
      .get('/api/students/parents-list')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('parents');
    expect(Array.isArray(res.body.parents)).toBe(true);

    const chiefAdesola = res.body.parents.find(p => p.email === 'chief.adesola@gmail.com');
    expect(chiefAdesola).toBeTruthy();
    expect(Array.isArray(chiefAdesola.children)).toBe(true);
    parentUserId = chiefAdesola.id;
  });

  it('should allow SchoolAdmin to manually link a student by admission number', async () => {
    // Link Joy Okafor (GF-2025-002) to Chief Adesola
    const res = await request(app)
      .post('/api/students/link-parent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        parent_user_id: parentUserId,
        admission_number: 'GF-2025-002'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('linkId');

    // Unlink to leave database clean
    const unlinkRes = await request(app)
      .delete(`/api/students/unlink-parent/${res.body.linkId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(unlinkRes.statusCode).toEqual(200);
  });
});
