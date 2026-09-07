const request = require('supertest');
const app = require('../app');
const { initDB, closeDB } = require('../config/database');

let adminToken = '';
let generatedCode = '';
let generatedLinkId = null;

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

describe('Invite Links System API', () => {
  it('should allow SchoolAdmin to create a new invitation link', async () => {
    const res = await request(app)
      .post('/api/invite-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        role: 'Student',
        max_uses: 10,
        expires_in_days: 7
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('inviteLink');
    expect(res.body.inviteLink.role).toEqual('Student');
    expect(res.body.inviteLink.display_code).toBeTruthy();

    generatedCode = res.body.inviteLink.display_code;
    generatedLinkId = res.body.inviteLink.id;
  });

  it('should list invitation links for the school', async () => {
    const res = await request(app)
      .get('/api/invite-links')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.inviteLinks)).toBe(true);
    const found = res.body.inviteLinks.find(l => l.id === generatedLinkId);
    expect(found).toBeTruthy();
    expect(found.status).toEqual('ACTIVE');
  });

  it('should allow public verification of invitation code', async () => {
    const res = await request(app)
      .get(`/api/invite-links/info/${generatedCode}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.invite.role).toEqual('Student');
    expect(res.body.invite.school_name).toBeTruthy();
  });

  it('should allow self-registration via valid invitation code', async () => {
    const uniqueEmail = `test.student.${Date.now()}@test.local`;
    const res = await request(app)
      .post('/api/invite-links/register')
      .send({
        code: generatedCode,
        first_name: 'Test',
        last_name: 'SelfRegisterStudent',
        email: uniqueEmail,
        password: 'password123',
        gender: 'Female'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toEqual('Student');
    expect(res.body.user.email).toEqual(uniqueEmail);
  });

  it('should handle parent registration with student auto-linking', async () => {
    // 1. Create Parent invite link
    const parentLinkRes = await request(app)
      .post('/api/invite-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        role: 'Parent',
        max_uses: 5
      });

    expect(parentLinkRes.statusCode).toEqual(201);
    const parentCode = parentLinkRes.body.inviteLink.display_code;

    // 2. Reject parent registration if student admission number is invalid
    const invalidRegRes = await request(app)
      .post('/api/invite-links/register')
      .send({
        code: parentCode,
        first_name: 'Invalid',
        last_name: 'Parent',
        email: `invalid.parent.${Date.now()}@test.local`,
        password: 'password123',
        student_admission_number: 'ADM-INVALID-999'
      });

    expect(invalidRegRes.statusCode).toEqual(400);
    expect(invalidRegRes.body.message).toContain('No student found');

    // 3. Successfully register parent with valid student admission number (GF-2025-001 from seed)
    const validParentEmail = `test.parent.${Date.now()}@test.local`;
    const validRegRes = await request(app)
      .post('/api/invite-links/register')
      .send({
        code: parentCode,
        first_name: 'Valid',
        last_name: 'Parent',
        email: validParentEmail,
        password: 'password123',
        student_admission_number: 'GF-2025-001'
      });

    expect(validRegRes.statusCode).toEqual(201);
    expect(validRegRes.body.user.role).toEqual('Parent');
  });

  it('should allow SchoolAdmin to revoke the invitation link', async () => {
    const res = await request(app)
      .delete(`/api/invite-links/${generatedLinkId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);

    // Verify code info check now returns error/invalid
    const checkRes = await request(app)
      .get(`/api/invite-links/info/${generatedCode}`);

    expect(checkRes.statusCode).toEqual(400);
    expect(checkRes.body.valid).toBe(false);
  });
});
