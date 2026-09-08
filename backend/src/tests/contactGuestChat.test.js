const request = require('supertest');
const app = require('../app');
const { initDB, closeDB } = require('../config/database');

let adminToken = '';
let inquiryNumber = '';
let accessToken = '';

beforeAll(async () => {
  await initDB();

  // Log in as SuperAdmin
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

describe('Visitor Guest Inquiry Chat System Tests', () => {
  it('should allow a landing page visitor to submit a contact inquiry and receive an access token', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({
        name: 'Grace Hopper',
        email: 'grace.hopper@navy.mil',
        subject: 'Demo Request for Navy Academy',
        message: 'We would like to test EduMan for our student management workflows.'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('inquiry_number');
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('track_url');

    inquiryNumber = res.body.inquiry_number;
    accessToken = res.body.access_token;
    expect(inquiryNumber).toMatch(/^CNT-\d{4}-\d{6}$/);
    expect(accessToken).toHaveLength(48);
  });

  it('should allow guest visitor to fetch inquiry thread using valid token', async () => {
    const res = await request(app)
      .get(`/api/contact/track/${inquiryNumber}?token=${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('inquiry');
    expect(res.body.inquiry.inquiry_number).toBe(inquiryNumber);
    expect(res.body.inquiry.name).toBe('Grace Hopper');
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].message).toContain('We would like to test EduMan');
  });

  it('should reject guest fetch with invalid or missing token', async () => {
    const resNoToken = await request(app)
      .get(`/api/contact/track/${inquiryNumber}`);
    expect(resNoToken.statusCode).toBe(400);

    const resInvalidToken = await request(app)
      .get(`/api/contact/track/${inquiryNumber}?token=invalid_token_12345`);
    expect(resInvalidToken.statusCode).toBe(403);
  });

  it('should allow visitor to reply on the guest chat thread using valid token', async () => {
    const res = await request(app)
      .post(`/api/contact/track/${inquiryNumber}/reply`)
      .send({
        token: accessToken,
        message: 'Also, when can we schedule a demo call with your support team?'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('reply');
    expect(res.body.reply.message).toBe('Also, when can we schedule a demo call with your support team?');
  });

  it('should reflect visitor reply in support staff inquiry inbox', async () => {
    const res = await request(app)
      .get('/api/contact/inquiries')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    const inq = res.body.inquiries.find(i => i.inquiry_number === inquiryNumber);
    expect(inq).toBeTruthy();
    expect(inq.status).toBe('IN_PROGRESS');
  });
});
